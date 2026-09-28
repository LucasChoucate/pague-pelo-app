/**
 * Teste ponta a ponta: servidor rodando + Supabase real com o seed aplicado.
 *   1) npm run dev          (em outro terminal)
 *   2) npm run test:e2e     (ou: BASE_URL=https://seu-app.vercel.app npm run test:e2e)
 *
 * Usa cliente2@exemplo.com e cria/apaga dados temporários (item, funcionário,
 * restaurante "Restaurante Teste"). Deixa 1 comanda finalizada do cliente2.
 * Leva ~1 min (espera um código de saída vencer).
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let falhas = 0;
const ok = (c, m) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) falhas++;
};
const secao = (t) => console.log(`\n— ${t}`);

async function sessao(email, senha = "demo1234") {
  let jar = [];
  const sb = createServerClient(URL_SB, KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (l) => {
        for (const c of l) {
          jar = jar.filter((x) => x.name !== c.name);
          if (c.value) jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: error.message };
  const http = async (path, opts = {}) => {
    const r = await fetch(BASE + path, {
      redirect: "manual",
      ...opts,
      headers: { cookie: jar.map((c) => `${c.name}=${c.value}`).join("; "), "Content-Type": "application/json" },
    });
    const tipo = r.headers.get("content-type") ?? "";
    return { status: r.status, corpo: tipo.includes("json") ? await r.json() : await r.text(), local: r.headers.get("location") };
  };
  return { sb, http };
}
const enviar = (s, path, corpo, metodo = "POST") => s.http(path, { method: metodo, body: JSON.stringify(corpo) });

try {
  await fetch(BASE);
} catch {
  console.error(`Servidor não respondeu em ${BASE}. Rode "npm run dev" antes.`);
  process.exit(1);
}

const cli = await sessao("cliente2@exemplo.com");
const atd = await sessao("caixa.garfo@exemplo.com");
const port = await sessao("porteiro.garfo@exemplo.com");
const ger = await sessao("gerente.garfo@exemplo.com");
const gerSerra = await sessao("gerente.serra@exemplo.com");
const atdSerra = await sessao("caixa.serra@exemplo.com");
const adm = await sessao("admin@exemplo.com");
for (const [nome, s] of Object.entries({ cli, atd, port, ger, gerSerra, atdSerra, adm })) {
  if (s.erro) {
    console.error(`Login de teste falhou (${nome}): ${s.erro}. Rode "npm run seed" antes.`);
    process.exit(1);
  }
}

// Fecha comanda ativa de uma execução anterior.
const { data: velha } = await cli.sb.from("comandas").select("id").in("status", ["ABERTA", "PENDENTE_PAGAMENTO", "PAGA"]).maybeSingle();
if (velha) await ger.sb.rpc("cancelar_comanda", { p_comanda: velha.id, p_motivo: "limpeza do teste e2e" });

secao("Acesso");
ok((await cli.http("/caixa")).local?.endsWith("/app"), "cliente em /caixa vai para /app");
ok((await fetch(BASE + "/app", { redirect: "manual" })).headers.get("location")?.includes("/login"), "anônimo em /app vai para /login");
ok((await cli.http("/entrar?loja=garfo-de-ouro")).corpo.includes("Pegar minha comanda"), "tela de entrada mostra 'Pegar minha comanda'");

secao("Comanda e caixa");
const { data: comanda, error: e1 } = await cli.sb.rpc("abrir_comanda", { p_slug: "garfo-de-ouro" });
ok(!e1 && comanda?.status === "ABERTA", `cliente abre comanda ${comanda?.codigo_curto ?? e1?.message}`);
if (!comanda) process.exit(1);

let eventos = 0;
const canal = cli.sb
  .channel("e2e")
  .on("postgres_changes", { event: "*", schema: "public", table: "itens_comanda", filter: `comanda_id=eq.${comanda.id}` }, () => eventos++);
await new Promise((res) => canal.subscribe((s) => s === "SUBSCRIBED" && res()));

const qr = await cli.http("/api/comanda/qr");
ok(qr.status === 200 && qr.corpo.token?.split(".").length === 3, "QR da comanda é um token assinado");
ok((await enviar(atd, "/api/caixa/resolver", { texto: qr.corpo.token })).corpo.comandaId === comanda.id, "caixa acha a comanda pelo QR");
ok((await enviar(atd, "/api/caixa/resolver", { texto: comanda.codigo_curto.toLowerCase() })).corpo.comandaId === comanda.id, "caixa acha pelo código curto");
const outro = await enviar(atdSerra, "/api/caixa/resolver", { texto: qr.corpo.token });
ok(outro.status === 400 && /outro restaurante/.test(outro.corpo.erro), "caixa de outro restaurante é barrado");

const { data: cardapio } = await atd.sb.from("itens_avulsos").select("*").eq("ativo", true);
const suco = cardapio.find((i) => i.nome === "Suco natural");
const cafe = cardapio.find((i) => i.nome === "Café expresso");
const { data: pes } = await atd.sb.rpc("lancar_pesagem", { p_comanda: comanda.id, p_peso_g: 450 });
ok(Number(pes?.valor) === 31.46, `pesagem 450 g = R$ ${pes?.valor}`);
await atd.sb.rpc("lancar_avulso", { p_comanda: comanda.id, p_item: suco.id, p_quantidade: 1 });
await new Promise((r) => setTimeout(r, 2500));
ok(eventos >= 2, `cliente recebeu ${eventos} atualizações em tempo real`);

secao("Pagamento");
const pix = await enviar(cli, "/api/pagamentos", { metodo: "pix" });
ok(Number(pix.corpo.pagamento?.valor) === 41.36, `Pix de R$ ${pix.corpo.pagamento?.valor}`);
ok((await enviar(cli, `/api/pagamentos/${pix.corpo.pagamento.id}/simular`, {})).status === 200, "Pix aprovado");
ok((await cli.http(`/app/comprovante/${pix.corpo.pagamento.id}`)).corpo.includes("Pagamento aprovado"), "comprovante abre");

let passe = await cli.http("/api/passe");
ok(/^\d{6}$/.test(passe.corpo.codigo ?? ""), "Passe de Saída gerado");
await atd.sb.rpc("lancar_avulso", { p_comanda: comanda.id, p_item: cafe.id, p_quantidade: 1 });
let v = await enviar(port, "/api/porteiro/validar", { texto: passe.corpo.token, metodo: "qr" });
ok(!v.corpo.liberada && /saldo pendente de R\$\s6,00/.test(v.corpo.motivo), `café depois de pagar bloqueia: "${v.corpo.motivo}"`);
const recusa = await enviar(cli, "/api/pagamentos", { metodo: "cartao", cartao: { numero: "4111111111110002", nome: "B", validade: "12/30", cvv: "123" } });
ok(recusa.status === 402, "cartão final 0002 recusado");
const cartao = await enviar(cli, "/api/pagamentos", { metodo: "cartao", cartao: { numero: "4111111111111111", nome: "B", validade: "12/30", cvv: "123" } });
ok(cartao.status === 200, "diferença paga no cartão");

secao("Saída");
passe = await cli.http("/api/passe");
const espera = passe.corpo.renovaEm - Date.now() + 1500;
console.log(`  (aguardando ${Math.round(espera / 1000)} s para o código vencer)`);
await new Promise((r) => setTimeout(r, espera));
v = await enviar(port, "/api/porteiro/validar", { texto: passe.corpo.codigo, metodo: "codigo" });
ok(!v.corpo.liberada && v.corpo.motivo === "Passe expirado", `código vencido: "${v.corpo.motivo}"`);
v = await enviar(port, "/api/porteiro/validar", { texto: passe.corpo.token, metodo: "qr" });
ok(!v.corpo.liberada && v.corpo.motivo === "Passe expirado", `QR vencido: "${v.corpo.motivo}"`);
v = await enviar(port, "/api/porteiro/validar", { texto: "000000", metodo: "codigo" });
ok(v.corpo.motivo === "Código inválido", "código que não existe: Código inválido");
passe = await cli.http("/api/passe");
v = await enviar(port, "/api/porteiro/validar", { texto: passe.corpo.codigo, metodo: "codigo", duracaoClienteMs: 3000 });
ok(v.corpo.liberada, `saída liberada para ${v.corpo.cliente}`);
v = await enviar(port, "/api/porteiro/validar", { texto: passe.corpo.token, metodo: "qr" });
ok(v.corpo.motivo === "Passe já utilizado", "segundo uso: Passe já utilizado");
ok(!(await cli.sb.rpc("enviar_nps", { p_comanda: comanda.id, p_nota: 10 })).error, "NPS enviado");
await cli.sb.removeChannel(canal);

secao("Gerente: itens avulsos");
let r = await enviar(ger, "/api/gerente/itens", { nome: "Teste", preco: 5, emoji: "abc" });
ok(r.status === 400, "ícone em texto é recusado");
r = await enviar(ger, "/api/gerente/itens", { nome: "Item temporário", preco: 5, emoji: "🧋" });
ok(r.status === 200, "item com emoji criado");
r = await ger.http(`/api/gerente/itens?id=${r.corpo.item.id}`, { method: "DELETE" });
ok(r.status === 200, "item excluído");

secao("Gerente: equipe");
const email = "temp.func@exemplo.com";
r = await enviar(ger, "/api/gerente/funcionarios", { nome: "Funcionário Temporário", identificador: email, senha: "temp1234", papel: "porteiro" });
ok(r.status === 200, "funcionário criado");
const idFunc = r.corpo.id;
ok((await gerSerra.http(`/api/gerente/funcionarios?id=${idFunc}`, { method: "DELETE" })).status === 404, "gerente de outro restaurante não exclui");
ok((await ger.http(`/api/gerente/funcionarios?id=${idFunc}`, { method: "DELETE" })).status === 200, "gerente exclui o funcionário");
ok(Boolean((await sessao(email, "temp1234")).erro), "funcionário excluído não loga");
r = await enviar(ger, "/api/gerente/funcionarios", { nome: "Reuso", identificador: email, senha: "temp1234", papel: "atendente" });
ok(r.status === 200, "e-mail do excluído pode ser reutilizado");
await ger.http(`/api/gerente/funcionarios?id=${r.corpo.id}`, { method: "DELETE" });

secao("Admin: restaurantes");
r = await enviar(adm, "/api/admin/restaurantes", {
  nome: "Restaurante Teste", slug: "restaurante-teste-e2e", preco_kg: 50, cor_destaque: "#0F766E",
  gerente: { nome: "Gerente Teste", identificador: "gerente.teste.e2e@exemplo.com", senha: "teste1234" },
});
ok(r.status === 200, "admin cria restaurante");
const rid = r.corpo.restaurante?.id;
ok((await enviar(adm, "/api/admin/restaurantes", { id: rid, confirmacao: "errado" }, "DELETE")).status === 400, "exclusão exige o nome certo");
ok((await enviar(ger, "/api/admin/restaurantes", { id: rid, confirmacao: "Restaurante Teste" }, "DELETE")).status === 403, "gerente não exclui restaurante");
ok((await enviar(adm, "/api/admin/restaurantes", { id: rid, confirmacao: "Restaurante Teste" }, "DELETE")).status === 200, "admin exclui restaurante");
const svc = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { count } = await svc.from("restaurantes").select("id", { count: "exact", head: true }).eq("id", rid);
ok(count === 0, "restaurante removido do banco");

secao("Páginas");
const paginas = [
  [cli, ["/app", "/app/comanda", "/app/historico", "/app/perfil", "/app/saida", "/app/pagar"]],
  [atd, ["/caixa"]],
  [port, ["/porteiro"]],
  [ger, ["/gerente", "/gerente/comandas", "/gerente/equipe", "/gerente/cardapio", "/gerente/marca"]],
  [adm, ["/admin"]],
];
for (const [s, lista] of paginas) for (const p of lista) ok((await s.http(p)).status === 200, `${p} abre`);
ok((await ger.http("/api/gerente/relatorio")).corpo.includes("Taxa de adoção"), "CSV do relatório gerado");

console.log(falhas ? `\n✗ ${falhas} falha(s)` : "\n✓ Jornada completa OK.");
process.exit(falhas ? 1 : 0);
