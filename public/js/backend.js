// The app's "server", running in the browser: the same routes and validation the Node server
// had, answering api.js directly. Every change is saved to this device before it reports success.

import { openDb, NotFound, Conflict } from './db.js';
import { openSaved, openFile, save } from './sqlite.js';

class BadRequest extends Error {}

// ---------- validation ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['calisthenics', 'weights', 'cardio'];

function bad(msg) {
  throw new BadRequest(msg);
}

function isDate(v) {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));
}

function int(v, min, max, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`${field} must be a whole number from ${min} to ${max}`);
  return n;
}

function text(v, max, field) {
  if (typeof v !== 'string') bad(`${field} must be text`);
  const s = v.trim();
  if (s.length > max) bad(`${field} is too long`);
  return s;
}

function idList(v, field) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 200) bad(`${field} must be a list of ids`);
  return [...new Set(v.map((id) => int(id, 1, Number.MAX_SAFE_INTEGER, field)))];
}

function parseSession(b) {
  if (!b || typeof b !== 'object') bad('Missing body');
  if (!isDate(b.date)) bad('date must be YYYY-MM-DD');
  return {
    date: b.date,
    durationMin: b.durationMin == null || b.durationMin === '' ? null : int(b.durationMin, 1, 600, 'durationMin'),
    vibe: b.vibe == null ? null : int(b.vibe, 1, 5, 'vibe'),
    notes: b.notes == null ? null : text(b.notes, 2000, 'notes') || null,
    exerciseIds: idList(b.exerciseIds, 'exerciseIds'),
    groupIds: idList(b.groupIds, 'groupIds'),
  };
}

// ---------- routes ----------

const routes = [
  ['GET', /^\/api\/bootstrap$/, (repo) => repo.bootstrap()],
  ['POST', /^\/api\/sessions$/, (repo, _, body) => repo.createSession(parseSession(body))],
  ['PUT', /^\/api\/sessions\/(\d+)$/, (repo, m, body) => repo.updateSession(Number(m[1]), parseSession(body))],
  ['DELETE', /^\/api\/sessions\/(\d+)$/, (repo, m) => (repo.deleteSession(Number(m[1])), { ok: true })],
  [
    'POST',
    /^\/api\/exercises$/,
    (repo, _, b) => {
      const name = text(b?.name ?? '', 60, 'name');
      if (!name) bad('Give it a name');
      if (!KINDS.includes(b.kind)) bad('kind must be calisthenics, weights or cardio');
      return repo.createExercise({ name, groupId: int(b.groupId, 1, Number.MAX_SAFE_INTEGER, 'groupId'), kind: b.kind });
    },
  ],
  ['DELETE', /^\/api\/exercises\/(\d+)$/, (repo, m) => (repo.archiveExercise(Number(m[1])), { ok: true })],
  [
    'PUT',
    /^\/api\/settings$/,
    (repo, _, b) =>
      repo.updateSettings({
        name: b?.name === undefined ? undefined : text(b.name, 40, 'name'),
        weekStart: b?.weekStart === undefined ? undefined : int(b.weekStart, 0, 1, 'weekStart'),
      }),
  ],
  [
    'PUT',
    /^\/api\/goal$/,
    (repo, _, b) => {
      if (!isDate(b?.effectiveFrom)) bad('effectiveFrom must be YYYY-MM-DD');
      return repo.setGoal({ target: int(b.target, 1, 7, 'target'), effectiveFrom: b.effectiveFrom });
    },
  ],
];

// ---------- the open database ----------

let current; // Promise<{ conn, repo }>
let queue = Promise.resolve(); // requests run one at a time, so saves land in order

function open() {
  current ??= openSaved().then(async (conn) => {
    const repo = openDb(conn);
    await save(conn); // keep the built-in exercise list and any schema updates
    // Ask Chrome not to clear this site's data when the phone is low on space.
    navigator.storage?.persist?.().catch(() => {});
    return { conn, repo };
  });
  current.catch(() => (current = null)); // let "Try again" retry from scratch
  return current;
}

function message(err) {
  if (err instanceof BadRequest || err instanceof NotFound || err instanceof Conflict) return err.message;
  if (/constraint failed/i.test(err.message)) return 'That references something that does not exist';
  console.error(err);
  return 'Something went wrong';
}

function run(job) {
  const result = queue.then(job);
  queue = result.catch(() => {});
  return result;
}

export function request(method, url, body) {
  return run(async () => {
    const { conn, repo } = await open();
    const { pathname } = new URL(url, location.href);
    for (const [m, pattern, handler] of routes) {
      const match = pathname.match(pattern);
      if (!match || m !== method) continue;
      let result;
      try {
        result = handler(repo, match, body === undefined ? null : structuredClone(body));
      } catch (err) {
        throw new Error(message(err));
      }
      if (method !== 'GET') {
        try {
          await save(conn);
        } catch (err) {
          console.error(err);
          throw new Error("Couldn't save on this phone. Is storage full?");
        }
      }
      return result;
    }
    throw new Error('No such endpoint');
  });
}

// ---------- backups ----------

/** The whole database as a SQLite file, for downloading. */
export const exportBackup = () => run(async () => (await open()).conn.export());

/** Replaces everything on this device with a backup file. */
export function restoreBackup(bytes) {
  return run(async () => {
    const conn = await openFile(bytes);
    let repo;
    try {
      repo = openDb(conn); // brings older backups up to the current schema
      await save(conn);
    } catch (err) {
      conn.close();
      throw err;
    }
    const old = await current?.catch(() => null);
    old?.conn.close();
    current = Promise.resolve({ conn, repo });
  });
}
