import type { DataStore, Loan, Settings } from '@alp/core';
import * as SQLite from 'expo-sqlite';

/**
 * expo-sqlite adapter (§4.5). The database lives in the app's default SQLite
 * directory (Library/Application Support on iOS, the database domain on Android),
 * which OS backups include (§4.6).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta     (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS loans    (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
function db() {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync('annuity-loan-planner.db');
    await d.execAsync('PRAGMA journal_mode = WAL;' + SCHEMA);
    return d;
  })();
  return dbPromise;
}

type Row = { json: string };

function storeOn(get: () => Promise<SQLite.SQLiteDatabase>, inTx: boolean): DataStore {
  const store: DataStore = {
    loans: {
      async list() {
        const rows = await (await get()).getAllAsync<Row>('SELECT json FROM loans');
        return rows.map((r) => JSON.parse(r.json) as Loan);
      },
      async get(id) {
        const r = await (await get()).getFirstAsync<Row>('SELECT json FROM loans WHERE id = ?', id);
        return r ? (JSON.parse(r.json) as Loan) : undefined;
      },
      async save(loan) {
        await (await get()).runAsync(
          'INSERT OR REPLACE INTO loans (id, json, updated_at) VALUES (?, ?, ?)',
          loan.id,
          JSON.stringify(loan),
          loan.updatedAt,
        );
      },
      async delete(id) {
        await (await get()).runAsync('DELETE FROM loans WHERE id = ?', id);
      },
      async listChanges(since) {
        const rows = await (await get()).getAllAsync<Row>('SELECT json FROM loans WHERE updated_at > ?', since);
        return rows.map((r) => JSON.parse(r.json) as Loan);
      },
    },
    settings: {
      async get() {
        const r = await (await get()).getFirstAsync<Row>('SELECT json FROM settings WHERE id = 1');
        return r ? (JSON.parse(r.json) as Settings) : undefined;
      },
      async save(s) {
        await (await get()).runAsync('INSERT OR REPLACE INTO settings (id, json) VALUES (1, ?)', JSON.stringify(s));
      },
    },
    meta: {
      async get(key) {
        const r = await (await get()).getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
        return r?.value;
      },
      async set(key, value) {
        await (await get()).runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
      },
    },
    async transaction(fn) {
      if (inTx) return fn(store);
      const d = await get();
      let result: Awaited<ReturnType<typeof fn>> | undefined;
      await d.withExclusiveTransactionAsync(async (tx) => {
        result = await fn(storeOn(async () => tx, true));
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
  };
  return store;
}

export function createDataStore(): DataStore {
  return storeOn(db, false);
}
