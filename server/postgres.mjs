import pg from 'pg';
import { readFile } from 'node:fs/promises';
export async function openDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const pool = new pg.Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  return { prepare(sql) {
    let i = 0; const query = sql.replace(/\?/g, () => '$' + (++i));
    return {
      get: async (...values) => (await pool.query(query, values)).rows[0],
      all: async (...values) => (await pool.query(query, values)).rows,
      run: async (...values) => pool.query(query, values),
    };
  }, close: () => pool.end() };
}
