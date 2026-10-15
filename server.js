import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, NotFound, Conflict } from './db.js';
import {
  loadAuth, verifyPassword, sessionCookie, clearCookie, isSignedIn, clientId, isLockedOut, recordFailure,
  clearFailures, setPasswordCommand,
} from './auth.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3456;
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'gym.db');
const AUTH_PATH = process.env.AUTH_PATH || path.join(ROOT, 'auth.json');

if (process.argv[2] === 'set-password') {
  try {
    await setPasswordCommand(AUTH_PATH);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

// Re-read auth.json when it changes, so a new password applies without a restart.
let auth = null;
let authMtime = 0;
function currentAuth() {
  const mtime = statSync(AUTH_PATH, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  if (mtime !== authMtime) [auth, authMtime] = [loadAuth(AUTH_PATH), mtime];
  return auth;
}

if (!currentAuth()) {
  console.error('\n  No password set yet. Set one first, then start the app again:');
  console.error('    on your computer:  npm run set-password');
  console.error('    on the server:     ./start set-password\n');
  process.exit(1);
}

const repo = openDb(DB_PATH);

class BadRequest extends Error {}

class Created {
  constructor(body) {
    this.body = body;
  }
}

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
  ['GET', /^\/api\/bootstrap$/, () => repo.bootstrap()],
  ['POST', /^\/api\/sessions$/, (_, body) => new Created(repo.createSession(parseSession(body)))],
  ['PUT', /^\/api\/sessions\/(\d+)$/, (m, body) => repo.updateSession(Number(m[1]), parseSession(body))],
  ['DELETE', /^\/api\/sessions\/(\d+)$/, (m) => (repo.deleteSession(Number(m[1])), { ok: true })],
  [
    'POST',
    /^\/api\/exercises$/,
    (_, b) => {
      const name = text(b?.name ?? '', 60, 'name');
      if (!name) bad('Give it a name');
      if (!KINDS.includes(b.kind)) bad('kind must be calisthenics, weights or cardio');
      return new Created(repo.createExercise({ name, groupId: int(b.groupId, 1, Number.MAX_SAFE_INTEGER, 'groupId'), kind: b.kind }));
    },
  ],
  ['DELETE', /^\/api\/exercises\/(\d+)$/, (m) => (repo.archiveExercise(Number(m[1])), { ok: true })],
  [
    'PUT',
    /^\/api\/settings$/,
    (_, b) =>
      repo.updateSettings({
        name: b?.name === undefined ? undefined : text(b.name, 40, 'name'),
        weekStart: b?.weekStart === undefined ? undefined : int(b.weekStart, 0, 1, 'weekStart'),
      }),
  ],
  [
    'PUT',
    /^\/api\/goal$/,
    (_, b) => {
      if (!isDate(b?.effectiveFrom)) bad('effectiveFrom must be YYYY-MM-DD');
      return repo.setGoal({ target: int(b.target, 1, 7, 'target'), effectiveFrom: b.effectiveFrom });
    },
  ],
];

// ---------- plumbing ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) bad('Body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    bad('Invalid JSON');
  }
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

async function login(req, res) {
  const client = clientId(req);
  if (isLockedOut(client)) return send(res, 429, { error: 'Too many tries. Wait 15 minutes and try again.' });
  // Count the attempt before checking it, so a burst of parallel guesses can't slip past the limit.
  recordFailure(client);
  const password = (await readBody(req))?.password;
  if (typeof password !== 'string' || password.length > 200 || !(await verifyPassword(currentAuth(), password))) {
    return send(res, 401, { error: "That's not it. Try again." });
  }
  clearFailures(client);
  res.setHeader('Set-Cookie', sessionCookie(currentAuth(), req));
  send(res, 200, { ok: true });
}

// What the login page needs before you're signed in
const OPEN_PATHS = new Set(['/login', '/css/styles.css', '/js/login.js']);

async function serveStatic(pathname, res) {
  const rel =
    pathname === '/' ? 'index.html' : pathname === '/login' ? 'login.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden' });
  try {
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (pathname === '/api/login' && req.method === 'POST') return await login(req, res);
    if (pathname === '/api/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', clearCookie(req));
      return send(res, 200, { ok: true });
    }

    const signedIn = isSignedIn(currentAuth(), req);
    if (!signedIn && !OPEN_PATHS.has(pathname)) {
      if (pathname === '/' || pathname === '/index.html') return redirect(res, '/login');
      return send(res, 401, { error: 'Please log in' });
    }
    if (signedIn && pathname === '/login') return redirect(res, '/');

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      return await serveStatic(pathname, res);
    }

    // Opening the app renews the session, so you stay logged in while you keep using it.
    if (pathname === '/api/bootstrap') res.setHeader('Set-Cookie', sessionCookie(currentAuth(), req));

    for (const [method, pattern, handler] of routes) {
      const match = pathname.match(pattern);
      if (!match || method !== req.method) continue;
      const body = method === 'GET' || method === 'DELETE' ? null : await readBody(req);
      const result = handler(match, body);
      return result instanceof Created ? send(res, 201, result.body) : send(res, 200, result);
    }
    send(res, 404, { error: 'No such endpoint' });
  } catch (err) {
    if (err instanceof BadRequest) return send(res, 400, { error: err.message });
    if (err instanceof NotFound) return send(res, 404, { error: err.message });
    if (err instanceof Conflict) return send(res, 409, { error: err.message });
    if (/constraint failed/i.test(err.message)) return send(res, 400, { error: 'That references something that does not exist' });
    console.error(err);
    send(res, 500, { error: 'Something went wrong' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ♥ Show Up Club is open → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`    data: ${DB_PATH}\n`);
});
