import { CURRENT_SCHEMA_VERSION } from '../model/defaults';

/**
 * Document migrations vN -> vN+1 (§4.5). Each step is a pure function on the raw JSON
 * documents. The same functions run for DB upgrades and for importing older backups.
 */
export interface Documents {
  loans: unknown[];
  settings: unknown | undefined;
}

type Migration = (docs: Documents) => Documents;

/** migrations[k] upgrades from version k+1 to k+2. Empty while the schema is v1. */
const migrations: Migration[] = [];

export function migrateDocuments(docs: Documents, fromVersion: number): Documents {
  if (fromVersion > CURRENT_SCHEMA_VERSION) throw new Error(`Unsupported schema version ${fromVersion}`);
  let out = docs;
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v - 1];
    if (!step) throw new Error(`Missing migration v${v} -> v${v + 1}`);
    out = step(out);
  }
  return out;
}
