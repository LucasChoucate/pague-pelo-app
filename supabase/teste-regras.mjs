import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Testa as regras do banco (RLS, funções, estados da comanda) num Postgres
 * embutido (PGlite), simulando o que o Supabase fornece. Rode: npm run test:db
 */
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const db = new PGlite();
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) falhas++; };

// ---- Stubs do que o Supabase fornece
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
  create publication supabase_realtime;
`);

try { await db.exec(schema); } catch (e) { console.error("ERRO NO SCHEMA:", e.message, e.where ?? "", e.position ?? ""); process.exit(1); }
ok(true, "schema.sql executou sem erro");

// ---- Helpers
async function como(uid, papelDb, fn) {
  await db.exec(`set role ${papelDb}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
async function erro(fn) { try { await fn(); return null; } catch (e) { return e.message; } }
const q = async (sql, p) => (await db.query(sql, p)).rows;

// ---- Dados
const novo = async (email, nome, meta = {}) =>
  (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { nome, ...meta }]))[0].id;

const [r1] = await q(`insert into restaurantes (nome, slug, preco_kg, cor_destaque) values ('Garfo de Ouro','garfo-de-ouro',69.90,'#A16207') returning *`);
const [r2] = await q(`insert into restaurantes (nome, slug, preco_kg) values ('Sabor da Serra','sabor-da-serra',59.90) returning *`);
const [cafe] = await q(`insert into itens_avulsos (restaurante_id, nome, preco, emoji) values ($1,'Café',6.00,'☕') returning *`, [r1.id]);
const [sucoSerra] = await q(`insert into itens_avulsos (restaurante_id, nome, preco) values ($1,'Suco',8.50) returning *`, [r2.id]);

const cli = await novo("ana@x.com", "Ana", { aceitou_privacidade: true, papel: "gerente" });
const cli2 = await novo("bruno@x.com", "Bruno");
const atd = await novo("caixa@x.com", "Carlos");
const atd2 = await novo("caixa2@x.com", "Renato");
const port = await novo("port@x.com", "José");
const ger = await novo("ger@x.com", "Marta");
await q(`update usuarios set papel='atendente', restaurante_id=$1 where id=$2`, [r1.id, atd]);
await q(`update usuarios set papel='atendente', restaurante_id=$1 where id=$2`, [r2.id, atd2]);
await q(`update usuarios set papel='porteiro', restaurante_id=$1 where id=$2`, [r1.id, port]);
await q(`update usuarios set papel='gerente', restaurante_id=$1 where id=$2`, [r1.id, ger]);

const [pAna] = await q(`select * from usuarios where id=$1`, [cli]);
ok(pAna.papel === "cliente", "trigger cria perfil como CLIENTE mesmo com metadado papel=gerente");
ok(pAna.aceitou_privacidade_em !== null, "aceite de privacidade registrado");

// ---- Jornada
const comanda = await como(cli, "authenticated", async () => (await q(`select * from abrir_comanda('garfo-de-ouro')`))[0]);
ok(comanda.status === "ABERTA" && /^[A-Z2-9]{4}$/.test(comanda.codigo_curto), `cliente abre comanda (${comanda.codigo_curto})`);

const e1 = await como(cli, "authenticated", () => erro(() => q(`select * from abrir_comanda('sabor-da-serra')`)));
ok(e1?.includes("já tem uma comanda ativa"), "bloqueia 2ª comanda ativa (mesmo em outro restaurante)");

const e1b = await erro(() => q(`insert into comandas (restaurante_id, cliente_id, codigo_curto) values ($1,$2,'ZZZZ')`, [r2.id, cli]));
ok(e1b?.includes("comandas_uma_ativa_por_cliente"), "índice único parcial barra no banco também");

const e2 = await como(atd, "authenticated", () => erro(() => q(`select abrir_comanda('garfo-de-ouro')`)));
ok(e2?.includes("Só contas de cliente"), "funcionário não abre comanda");

const e3 = await como(cli, "authenticated", () => erro(() => q(`select lancar_pesagem($1, 450)`, [comanda.id])));
ok(e3?.includes("Só atendentes"), "cliente não lança item");

const e4 = await como(atd2, "authenticated", () => erro(() => q(`select lancar_pesagem($1, 450)`, [comanda.id])));
ok(e4?.includes("não encontrada"), "atendente de outro restaurante não lança");

const e4b = await como(atd, "authenticated", () => erro(() => q(`select lancar_avulso($1, $2)`, [comanda.id, sucoSerra.id])));
ok(e4b?.includes("não encontrado no cardápio"), "não lança item avulso de outro restaurante");

const [pes] = await como(atd, "authenticated", () => q(`select * from lancar_pesagem($1, 450)`, [comanda.id]));
ok(Number(pes.valor) === 31.46, `pesagem 450 g × 69,90 = ${pes.valor} (esperado 31.46)`);
await como(atd, "authenticated", () => q(`select lancar_avulso($1, $2, 1)`, [comanda.id, cafe.id]));
let [c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(c.status === "PENDENTE_PAGAMENTO" && Number(c.total) === 37.46, `status PENDENTE e total 37.46 (${c.status}, ${c.total})`);

// Corrigir e remover com auditoria
await como(atd, "authenticated", () => q(`select corrigir_item($1, 500, null)`, [pes.id]));
[c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(Number(c.total) === 40.95, `corrigir peso p/ 500 g recalcula total (${c.total})`);
const aud = await q(`select acao from auditoria where entidade_id=$1 order by id`, [pes.id]);
ok(aud.map((a) => a.acao).join(",") === "lancar_item,corrigir_item", "auditoria registra lançamento e correção");

// RLS de leitura
const vis = async (uid) => (await como(uid, "authenticated", () => q(`select id from comandas`))).length;
ok((await vis(cli)) === 1, "cliente vê a própria comanda");
ok((await vis(cli2)) === 0, "outro cliente NÃO vê");
ok((await vis(atd)) === 1, "atendente do restaurante vê");
ok((await vis(atd2)) === 0, "atendente de outro restaurante NÃO vê");
ok((await como(cli, "authenticated", () => q(`select id from itens_comanda`))).length === 2, "cliente vê os itens da própria comanda");
ok((await como(cli2, "authenticated", () => q(`select id from itens_comanda`))).length === 0, "outro cliente não vê itens");
ok((await como(atd, "authenticated", () => q(`select nome from usuarios where id=$1`, [cli])))[0]?.nome === "Ana", "atendente vê nome do cliente da comanda");
ok((await como(atd, "authenticated", () => q(`select nome from usuarios where id=$1`, [cli2]))).length === 0, "atendente não vê clientes sem comanda no restaurante");
ok((await como(null, "anon", () => q(`select nome from restaurantes`))).length === 2, "anônimo vê restaurantes ativos (tela de entrada)");

// Escritas diretas bloqueadas
const e5 = await como(cli, "authenticated", () => erro(() => q(`update comandas set total_pago = total where id=$1`, [comanda.id])));
[c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(Number(c.total_pago) === 0, `cliente não consegue se marcar como pago (${e5 ? "erro" : "0 linhas"})`);
const e6 = await como(cli, "authenticated", () => erro(() => q(`update usuarios set papel='gerente' where id=$1`, [cli])));
ok(e6?.includes("permission denied"), "cliente não muda o próprio papel");
await como(cli, "authenticated", () => q(`update usuarios set nome='Ana Souza' where id=$1`, [cli]));
ok((await q(`select nome from usuarios where id=$1`, [cli]))[0].nome === "Ana Souza", "cliente edita o próprio nome");
const e7 = await como(cli, "authenticated", () => erro(() => q(`select confirmar_pagamento(gen_random_uuid(), 'x')`)));
ok(e7?.includes("permission denied"), "cliente não chama confirmar_pagamento");

// Pagamento (servidor, service role)
const pagar = async (valor) => {
  const [p] = await q(`insert into pagamentos (comanda_id, restaurante_id, cliente_id, metodo, valor) values ($1,$2,$3,'pix',$4) returning id`, [comanda.id, r1.id, cli, valor]);
  return como(null, "service_role", async () => (await q(`select confirmar_pagamento($1, 'REF') as r`, [p.id]))[0].r);
};
let r = await pagar(40.95);
[c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(r.ok && c.status === "PAGA" && c.paga_em, "pagamento aprovado → PAGA");

// Novo item depois de pagar → volta a pendente, paga só a diferença
await como(atd, "authenticated", () => q(`select lancar_avulso($1, $2, 1)`, [comanda.id, cafe.id]));
[c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(c.status === "PENDENTE_PAGAMENTO" && Number(c.total) - Number(c.total_pago) === 6, "café depois de pagar → saldo pendente de R$ 6,00");
r = await pagar(10);
ok(!r.ok, "recusa cobrar mais que o saldo");
r = await pagar(6);
[c] = await q(`select * from comandas where id=$1`, [comanda.id]);
ok(r.ok && c.status === "PAGA", "paga a diferença → PAGA de novo");

// Saída + NPS
const e8 = await como(cli, "authenticated", () => erro(() => q(`select enviar_nps($1, 10)`, [comanda.id])));
ok(e8?.includes("depois da saída"), "NPS só depois da saída");
await q(`update comandas set status='FINALIZADA', saida_em=now() where id=$1 and status='PAGA'`, [comanda.id]);
await como(cli, "authenticated", () => q(`select enviar_nps($1, 9, 'Rápido!')`, [comanda.id]));
ok((await q(`select nota from nps`))[0].nota === 9, "NPS gravado");
const e9 = await como(cli, "authenticated", () => erro(() => q(`select enviar_nps($1, 10)`, [comanda.id])));
ok(e9?.includes("já avaliou"), "NPS não duplica");
const e10 = await como(atd, "authenticated", () => erro(() => q(`select lancar_pesagem($1, 100)`, [comanda.id])));
ok(e10?.includes("finalizada"), "comanda finalizada não aceita lançamento");

const nova = await como(cli, "authenticated", async () => (await q(`select * from abrir_comanda('sabor-da-serra')`))[0]);
ok(nova.status === "ABERTA", "após a saída, cliente pode abrir nova comanda");

// Cancelamento
const e11 = await como(atd, "authenticated", () => erro(() => q(`select cancelar_comanda($1, 'teste de cancelamento')`, [nova.id])));
ok(e11?.includes("Só o gerente"), "atendente não cancela");
const e12 = await como(ger, "authenticated", () => erro(() => q(`select cancelar_comanda($1, 'teste de cancelamento')`, [nova.id])));
ok(e12?.includes("Só o gerente"), "gerente de outro restaurante não cancela");
const c3 = await como(cli2, "authenticated", async () => (await q(`select * from abrir_comanda('garfo-de-ouro')`))[0]);
const e13 = await como(ger, "authenticated", () => erro(() => q(`select cancelar_comanda($1, 'ok')`, [c3.id])));
ok(e13?.includes("justificativa"), "exige justificativa");
await como(ger, "authenticated", () => q(`select cancelar_comanda($1, 'Cliente desistiu')`, [c3.id]));
ok((await q(`select status from comandas where id=$1`, [c3.id]))[0].status === "CANCELADA", "gerente cancela com justificativa");

// Expiração de comanda vazia de ontem
await q(`update comandas set criada_em = now() - interval '1 day' where id=$1`, [nova.id]);
const nova2 = await como(cli, "authenticated", async () => (await q(`select * from abrir_comanda('garfo-de-ouro')`))[0]);
ok((await q(`select status from comandas where id=$1`, [nova.id]))[0].status === "EXPIRADA" && nova2.status === "ABERTA",
  "comanda vazia de ontem expira e libera nova");

// Exclusões
await q(`delete from itens_avulsos where id=$1`, [cafe.id]);
const cafesAntigos = await q(`select item_avulso_id, valor from itens_comanda where descricao='Café'`);
ok(cafesAntigos.length === 2 && cafesAntigos.every((i) => i.item_avulso_id === null && Number(i.valor) === 6),
  "excluir item avulso mantém o histórico das comandas (descrição e valor)");
const e14 = await como(ger, "authenticated", () => erro(() => q(`select excluir_dados_restaurante($1)`, [r1.id])));
ok(e14?.includes("permission denied"), "gerente não chama excluir_dados_restaurante");
const equipe = await como(null, "service_role", async () => (await q(`select excluir_dados_restaurante($1) as e`, [r1.id]))[0].e);
await q(`delete from usuarios where id = any($1)`, [equipe]);
await q(`delete from restaurantes where id=$1`, [r1.id]);
ok(equipe.length === 3 && (await q(`select count(*)::int n from comandas where restaurante_id=$1`, [r1.id]))[0].n === 0,
  "restaurante excluído com comandas, itens e equipe");
ok((await q(`select count(*)::int n from comandas where restaurante_id=$1`, [r2.id]))[0].n > 0, "dados do outro restaurante continuam");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
