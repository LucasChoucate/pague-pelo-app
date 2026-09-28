/**
 * Dados de demonstração. Rode com:  npm run seed
 * Sem os 7 dias de métricas inventadas:  npm run seed -- --sem-historico
 * Pode rodar mais de uma vez: reaproveita o que já existe.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
const db: SupabaseClient = createClient(url, chave, { auth: { persistSession: false } });

const SENHA = "demo1234";

async function falhar(msg: string, erro: unknown): Promise<never> {
  console.error(`✗ ${msg}`, erro);
  process.exit(1);
}

// ---------------------------------------------------------------- usuários
let cacheUsuarios: { id: string; email?: string }[] | null = null;

async function usuario(email: string, nome: string, papel: string, restauranteId: string | null) {
  if (!cacheUsuarios) {
    const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) await falhar("listar usuários", error);
    cacheUsuarios = data!.users;
  }
  let id = cacheUsuarios.find((u) => u.email === email)?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
      user_metadata: { nome, aceitou_privacidade: true },
    });
    if (error) await falhar(`criar ${email}`, error);
    id = data!.user!.id;
  }
  const { error } = await db.from("usuarios").update({ nome, papel, restaurante_id: restauranteId }).eq("id", id);
  if (error) await falhar(`papel de ${email}`, error);
  return id;
}

// ---------------------------------------------------------------- restaurantes
async function restaurante(dados: { nome: string; slug: string; cor_destaque: string; preco_kg: number }) {
  const { data, error } = await db.from("restaurantes").upsert(dados, { onConflict: "slug" }).select().single();
  if (error) await falhar(`restaurante ${dados.slug}`, error);
  return data!;
}

async function itens(restauranteId: string, lista: [string, number, string][]) {
  const { count } = await db.from("itens_avulsos").select("id", { count: "exact", head: true }).eq("restaurante_id", restauranteId);
  if (count) return;
  const { error } = await db
    .from("itens_avulsos")
    .insert(lista.map(([nome, preco, emoji], ordem) => ({ restaurante_id: restauranteId, nome, preco, emoji, ordem })));
  if (error) await falhar("itens avulsos", error);
}

// ---------------------------------------------------------------- histórico
// Gerador pseudoaleatório determinístico (mesmos dados a cada seed).
let semente = 42;
const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
const entre = (a: number, b: number) => Math.floor(a + aleatorio() * (b - a + 1));
const CODIGOS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const codigo = () => Array.from({ length: 4 }, () => CODIGOS[entre(0, CODIGOS.length - 1)]).join("");

async function historico(
  rest: { id: string; preco_kg: number },
  clientes: string[],
  atendente: string,
  porteiro: string,
) {
  const { count } = await db.from("comandas").select("id", { count: "exact", head: true }).eq("restaurante_id", rest.id);
  if (count) {
    console.log("  histórico já existe, pulando");
    return;
  }
  const { data: avulsos } = await db.from("itens_avulsos").select("*").eq("restaurante_id", rest.id);
  const hoje = new Date();

  for (let d = 7; d >= 1; d--) {
    const dia = new Date(hoje.getTime() - d * 86400000);
    const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(dia);
    const n = entre(9, 16);

    for (let i = 0; i < n; i++) {
      const aberta = new Date(`${data}T${String(entre(11, 14)).padStart(2, "0")}:${String(entre(0, 59)).padStart(2, "0")}:00-03:00`);
      const peso = entre(280, 780);
      const valorPeso = Math.round(peso * Number(rest.preco_kg) / 10) / 100;
      const extras = avulsos && aleatorio() < 0.55 ? [avulsos[entre(0, avulsos.length - 1)]] : [];
      const total = Math.round((valorPeso + extras.reduce((s, a) => s + Number(a.preco), 0)) * 100) / 100;
      // ~1 em 70 fica sem pagar (inadimplência)
      const pagou = aleatorio() > 0.014;
      const pagaEm = new Date(aberta.getTime() + entre(18, 40) * 60000);
      const saidaEm = new Date(pagaEm.getTime() + entre(1, 8) * 60000);

      const { data: c, error } = await db
        .from("comandas")
        .insert({
          restaurante_id: rest.id,
          cliente_id: clientes[i % clientes.length],
          codigo_curto: codigo(),
          status: pagou ? "FINALIZADA" : "PENDENTE_PAGAMENTO",
          total,
          total_pago: pagou ? total : 0,
          criada_em: aberta.toISOString(),
          paga_em: pagou ? pagaEm.toISOString() : null,
          saida_em: pagou ? saidaEm.toISOString() : null,
        })
        .select()
        .single();
      if (error) await falhar("comanda histórica", error);

      await db.from("itens_comanda").insert([
        {
          comanda_id: c!.id, restaurante_id: rest.id, tipo: "pesagem", descricao: "Prato a quilo", peso_g: peso,
          preco_unit: rest.preco_kg, valor: valorPeso, lancado_por: atendente, criado_em: new Date(aberta.getTime() + 4 * 60000).toISOString(),
        },
        ...extras.map((a) => ({
          comanda_id: c!.id, restaurante_id: rest.id, tipo: "avulso", item_avulso_id: a.id, descricao: a.nome,
          preco_unit: a.preco, valor: a.preco, lancado_por: atendente, criado_em: new Date(aberta.getTime() + 5 * 60000).toISOString(),
        })),
      ]);

      if (!pagou) continue;
      await db.from("pagamentos").insert({
        comanda_id: c!.id, restaurante_id: rest.id, cliente_id: c!.cliente_id, metodo: aleatorio() < 0.7 ? "pix" : "cartao",
        valor: total, status: "aprovado", referencia_externa: `SEED-${c!.codigo_curto}`, criado_em: pagaEm.toISOString(), aprovado_em: pagaEm.toISOString(),
      });
      await db.from("validacoes_saida").insert({
        comanda_id: c!.id, restaurante_id: rest.id, porteiro_id: porteiro, resultado: "liberada",
        metodo: aleatorio() < 0.85 ? "qr" : "codigo", duracao_ms: entre(2500, 14000), criado_em: saidaEm.toISOString(),
      });
      if (aleatorio() < 0.45) {
        const r = aleatorio();
        await db.from("nps").insert({
          comanda_id: c!.id, restaurante_id: rest.id, cliente_id: c!.cliente_id,
          nota: r < 0.78 ? entre(9, 10) : r < 0.92 ? entre(7, 8) : entre(4, 6), criado_em: saidaEm.toISOString(),
        });
      }
    }
    await db.from("movimento_diario").upsert({ restaurante_id: rest.id, data, clientes_caixa: entre(3, 7) });
  }
  console.log("  histórico de 7 dias criado");
}

// ---------------------------------------------------------------- main
async function main() {
  console.log("→ Restaurantes");
  const garfo = await restaurante({ nome: "Garfo de Ouro", slug: "garfo-de-ouro", cor_destaque: "#A16207", preco_kg: 69.9 });
  const serra = await restaurante({ nome: "Sabor da Serra", slug: "sabor-da-serra", cor_destaque: "#7C3AED", preco_kg: 59.9 });

  await itens(garfo.id, [
    ["Refrigerante lata", 7.0, "🥤"],
    ["Suco natural", 9.9, "🍊"],
    ["Água mineral", 4.5, "💧"],
    ["Cerveja long neck", 12.0, "🍺"],
    ["Pudim", 11.0, "🍮"],
    ["Mousse de maracujá", 9.5, "🍨"],
    ["Café expresso", 6.0, "☕"],
    ["Pão de queijo", 5.5, "🧀"],
  ]);
  await itens(serra.id, [
    ["Refrigerante lata", 6.5, "🥤"],
    ["Suco do dia", 8.5, "🍹"],
    ["Água com gás", 5.0, "💧"],
    ["Doce de leite", 7.5, "🍯"],
    ["Café coado", 4.0, "☕"],
  ]);

  console.log("→ Usuários (senha de todos: demo1234)");
  await usuario("admin@exemplo.com", "Admin da Plataforma", "admin_plataforma", null);
  await usuario("gerente.garfo@exemplo.com", "Marta Oliveira", "gerente", garfo.id);
  const atendGarfo = await usuario("caixa.garfo@exemplo.com", "Carlos Pereira", "atendente", garfo.id);
  const portGarfo = await usuario("porteiro.garfo@exemplo.com", "José Santos", "porteiro", garfo.id);
  await usuario("gerente.serra@exemplo.com", "Paula Ribeiro", "gerente", serra.id);
  const atendSerra = await usuario("caixa.serra@exemplo.com", "Renato Alves", "atendente", serra.id);
  const portSerra = await usuario("porteiro.serra@exemplo.com", "Lúcia Costa", "porteiro", serra.id);
  await usuario("cliente@exemplo.com", "Ana Souza", "cliente", null);
  await usuario("cliente2@exemplo.com", "Bruno Lima", "cliente", null);

  // Clientes "antigos" só para o histórico dos painéis.
  const antigos: string[] = [];
  for (const [i, nome] of ["Fernanda Rocha", "Diego Martins", "Camila Nunes", "Rafael Gomes", "Juliana Dias", "Pedro Barros"].entries()) {
    antigos.push(await usuario(`historico${i + 1}@exemplo.com`, nome, "cliente", null));
  }

  if (process.argv.includes("--sem-historico")) {
    console.log("→ Histórico: pulado (--sem-historico)");
  } else {
    console.log("→ Histórico Garfo de Ouro");
    await historico(garfo, antigos, atendGarfo, portGarfo);
    console.log("→ Histórico Sabor da Serra");
    await historico(serra, antigos, atendSerra, portSerra);
  }

  console.log("\n✓ Pronto! Logins de teste (senha demo1234):");
  console.table([
    { papel: "Cliente", login: "cliente@exemplo.com" },
    { papel: "Cliente 2", login: "cliente2@exemplo.com" },
    { papel: "Atendente (Garfo de Ouro)", login: "caixa.garfo@exemplo.com" },
    { papel: "Porteiro (Garfo de Ouro)", login: "porteiro.garfo@exemplo.com" },
    { papel: "Gerente (Garfo de Ouro)", login: "gerente.garfo@exemplo.com" },
    { papel: "Gerente (Sabor da Serra)", login: "gerente.serra@exemplo.com" },
    { papel: "Admin da plataforma", login: "admin@exemplo.com" },
  ]);
}

main();
