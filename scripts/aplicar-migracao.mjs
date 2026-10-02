// Aplica um arquivo de migração SQL usando a conexão direta do .env, numa única transação.
// Uso: node aplicar-migracao.mjs ../supabase/migrations/002_reformulacao.sql
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const arquivo = process.argv[2];
if (!arquivo) {
    console.error('Informe o arquivo .sql da migração.');
    process.exit(1);
}

const cliente = new pg.Client({
    connectionString: process.env.DATABASE_DIRECT_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
});
await cliente.connect();
try {
    await cliente.query('begin');
    await cliente.query(readFileSync(arquivo, 'utf8'));
    await cliente.query('commit');
    console.log('Migração aplicada.');
} catch (erro) {
    await cliente.query('rollback');
    console.error('ERRO (nada foi aplicado):', erro.message);
    process.exitCode = 1;
} finally {
    await cliente.end();
}
