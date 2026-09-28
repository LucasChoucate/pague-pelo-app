/**
 * Limpa o banco (usa DATABASE_URL e as chaves do .env.local).
 *
 *   npm run db:limpar                     → só mostra o que seria apagado
 *   npm run db:limpar -- --confirmar      → apaga o MOVIMENTO: comandas, pagamentos,
 *                                           saídas, NPS, auditoria e métricas.
 *                                           Mantém restaurantes, itens e contas.
 *   npm run db:limpar -- --tudo --confirmar
 *                                         → apaga TUDO: movimento, restaurantes, itens,
 *                                           logos e todas as contas, menos as de
 *                                           admin da plataforma.
 */
import { config } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const tudo = process.argv.includes("--tudo");
const confirmar = process.argv.includes("--confirmar");

const MOVIMENTO = ["nps", "validacoes_saida", "pagamentos", "itens_comanda", "comandas", "auditoria", "movimento_diario"];

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const contar = async (sql) => Number((await db.query(sql)).rows[0].n);
const resumo = {};
for (const t of MOVIMENTO) resumo[t] = await contar(`select count(*) n from public.${t}`);
if (tudo) {
  resumo.itens_avulsos = await contar("select count(*) n from public.itens_avulsos");
  resumo.restaurantes = await contar("select count(*) n from public.restaurantes");
  resumo["contas (exceto admin)"] = await contar("select count(*) n from public.usuarios where papel <> 'admin_plataforma'");
}

console.log(tudo ? "\nLimpeza TOTAL — seria apagado:" : "\nLimpeza do MOVIMENTO — seria apagado:");
console.table(resumo);

if (!confirmar) {
  console.log("Nada foi apagado. Para apagar de verdade, rode de novo com --confirmar.\n");
  await db.end();
  process.exit(0);
}

try {
  await db.query("begin");
  await db.query(`truncate ${MOVIMENTO.map((t) => `public.${t}`).join(", ")} restart identity`);
  if (tudo) {
    await db.query("delete from public.itens_avulsos");
    // Contas: apagar do Auth leva o perfil junto (cascade).
    await db.query(`delete from auth.users where id in (select id from public.usuarios where papel <> 'admin_plataforma')`);
    await db.query("delete from public.restaurantes");
  }
  await db.query("commit");
} catch (e) {
  await db.query("rollback");
  console.error("✗ Nada foi apagado:", e.message);
  process.exit(1);
} finally {
  await db.end();
}

if (tudo) {
  // Logos no Storage (a API do Storage exige apagar pelos arquivos).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: pastas } = await sb.storage.from("logos").list("", { limit: 1000 });
  for (const p of pastas ?? []) {
    const { data: arquivos } = await sb.storage.from("logos").list(p.name, { limit: 1000 });
    if (arquivos?.length) await sb.storage.from("logos").remove(arquivos.map((a) => `${p.name}/${a.name}`));
  }
}

console.log(tudo ? "✓ Banco zerado. Só as contas de admin da plataforma continuam." : "✓ Movimento apagado. Restaurantes, itens e contas continuam.");
