/**
 * Aplica SQL no banco apontado por DATABASE_URL (.env.local).
 * Alternativa a colar o arquivo no SQL Editor do Supabase.
 *   npm run db:schema                                    → supabase/schema.sql (banco novo)
 *   npm run db:migrar -- supabase/migracoes/002_x.sql    → uma migração
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env.local (Supabase > Connect > Session pooler).");
  process.exit(1);
}

const arquivo = process.argv[2];
const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await cliente.connect();
  if (arquivo) {
    await cliente.query(readFileSync(arquivo, "utf8"));
    console.log(`✓ ${arquivo} aplicado.`);
  } else {
    const { rows } = await cliente.query("select to_regclass('public.comandas') as existe");
    if (rows[0].existe) {
      console.log("O schema já foi aplicado neste banco (tabela comandas existe). Para mudanças, use uma migração.");
    } else {
      await cliente.query(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
      console.log("✓ schema.sql aplicado.");
    }
  }
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}
