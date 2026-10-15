// SQLite in the browser: sql.js (SQLite compiled to WebAssembly) runs the database in memory,
// and the whole database file is saved to IndexedDB after every change. The file is small
// (tens of KB), so saving all of it each time is simpler and safer than tracking edits.

const IDB_NAME = 'show-up-club';
const IDB_STORE = 'files';
const IDB_KEY = 'gym.db';

let sqlJs;

/** Loads the sql.js engine once (vendor/sql-wasm.js is loaded by index.html). */
function engine() {
  sqlJs ??= globalThis.initSqlJs({ locateFile: (file) => new URL(`../vendor/${file}`, import.meta.url).href });
  return sqlJs;
}

// ---------- IndexedDB: one key holding the database file ----------

function idb(mode, use) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(IDB_STORE, mode);
      const req = use(tx.objectStore(IDB_STORE));
      tx.oncomplete = () => (open.result.close(), resolve(req.result));
      tx.onerror = tx.onabort = () => (open.result.close(), reject(tx.error));
    };
  });
}

const readFile = () => idb('readonly', (store) => store.get(IDB_KEY));
const writeFile = (bytes) => idb('readwrite', (store) => store.put(bytes, IDB_KEY));

// ---------- a node:sqlite-style connection over sql.js, so db.js runs unchanged ----------

const params = (list) => list.map((v) => (v === undefined ? null : v));

class Statement {
  constructor(raw, sql) {
    this.raw = raw;
    this.sql = sql;
  }

  // sql.js frees prepared statements whenever the database is exported (saved), so each call
  // prepares its own instead of keeping one around.
  #each(values, onRow) {
    const stmt = this.raw.prepare(this.sql);
    try {
      stmt.bind(params(values));
      while (stmt.step()) if (onRow(stmt.getAsObject()) === false) break;
    } finally {
      stmt.free();
    }
  }

  get(...values) {
    let row;
    this.#each(values, (r) => ((row = r), false));
    return row;
  }

  all(...values) {
    const rows = [];
    this.#each(values, (r) => rows.push(r));
    return rows;
  }

  run(...values) {
    this.raw.run(this.sql, params(values));
    return {
      changes: this.raw.getRowsModified(),
      lastInsertRowid: this.raw.exec('SELECT last_insert_rowid()')[0].values[0][0],
    };
  }
}

export class Connection {
  constructor(raw) {
    this.raw = raw;
  }

  prepare(sql) {
    return new Statement(this.raw, sql);
  }

  exec(sql) {
    this.raw.exec(sql);
  }

  /** The database as a standard SQLite file. */
  export() {
    const bytes = this.raw.export();
    // Exporting reopens the database, which switches foreign keys (and cascade deletes) back off.
    this.raw.exec('PRAGMA foreign_keys = ON;');
    return bytes;
  }

  close() {
    this.raw.close();
  }
}

/** Opens the database saved on this device, or a new empty one. */
export async function openSaved() {
  const [SQL, saved] = await Promise.all([engine(), readFile()]);
  return new Connection(new SQL.Database(saved ?? undefined));
}

/** Opens a SQLite file the user picked (a backup), checking it really is one of ours. */
export async function openFile(bytes) {
  const SQL = await engine();
  const copy = new Uint8Array(bytes);
  // A file copied out of the old server may be in WAL mode, which sql.js can't open. With no
  // WAL file alongside, switching the header back to the classic journal is lossless.
  if (copy[18] === 2 && copy[19] === 2) copy[18] = copy[19] = 1;

  let raw;
  try {
    raw = new SQL.Database(copy);
    const ok = raw.exec('PRAGMA integrity_check')[0]?.values[0][0] === 'ok';
    const tables = raw.exec(
      "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'goals', 'sessions', 'exercises', 'muscle_groups')",
    )[0].values[0][0];
    if (!ok || tables !== 5) throw new Error('not ours');
  } catch {
    raw?.close();
    throw new Error("That file isn't a Show Up Club backup.");
  }
  return new Connection(raw);
}

/** Saves the database to this device. */
export const save = (conn) => writeFile(conn.export());
