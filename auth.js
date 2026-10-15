import { scrypt, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import readline from 'node:readline';

// One password, stored as a scrypt hash in auth.json. Sessions are signed cookies
// ("<expires>.<hmac>"), so they survive restarts; changing the password rotates the
// signing secret, which logs out every device.

const COOKIE = 'suc_session';
const SESSION_DAYS = 180;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MIN_LENGTH = 8;

const hashPassword = (password, salt) =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );

export function loadAuth(file) {
  try {
    const a = JSON.parse(readFileSync(file, 'utf8'));
    return { hash: Buffer.from(a.hash, 'base64'), salt: Buffer.from(a.salt, 'base64'), secret: Buffer.from(a.secret, 'base64') };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
}

export async function verifyPassword(auth, password) {
  if (typeof password !== 'string' || !password) return false;
  return timingSafeEqual(await hashPassword(password, auth.salt), auth.hash);
}

// ---------- session cookie ----------

const sign = (auth, expires) => createHmac('sha256', auth.secret).update(String(expires)).digest('base64url');

function isHttps(req) {
  return Boolean(req.socket.encrypted) || req.headers['x-forwarded-proto'] === 'https';
}

export function sessionCookie(auth, req) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return [
    `${COOKIE}=${expires}.${sign(auth, expires)}`,
    'Path=/',
    `Max-Age=${SESSION_DAYS * 86_400}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(isHttps(req) ? ['Secure'] : []),
  ].join('; ');
}

export function clearCookie(req) {
  return [`${COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', ...(isHttps(req) ? ['Secure'] : [])].join('; ');
}

export function isSignedIn(auth, req) {
  const match = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`));
  if (!match || Number(match[1]) < Date.now()) return false;
  const expected = Buffer.from(sign(auth, match[1]));
  const given = Buffer.from(match[2]);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- brute-force limit ----------

const WINDOW_MS = 15 * 60_000;
const PER_CLIENT = 5;
const OVERALL = 50;
const failures = new Map(); // client -> timestamps of recent failed logins

// Behind a reverse proxy (connection from this machine), the real client is the address
// the proxy appended last to X-Forwarded-For; earlier entries can be faked by the client.
export function clientId(req) {
  const remote = req.socket.remoteAddress ?? '';
  const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  return local && forwarded ? forwarded.split(',').at(-1).trim() : remote;
}

function recent(client) {
  const cutoff = Date.now() - WINDOW_MS;
  const list = (failures.get(client) ?? []).filter((t) => t > cutoff);
  list.length ? failures.set(client, list) : failures.delete(client);
  return list;
}

export function isLockedOut(client) {
  let total = 0;
  for (const key of [...failures.keys()]) total += recent(key).length;
  return recent(client).length >= PER_CLIENT || total >= OVERALL;
}

export function recordFailure(client) {
  failures.set(client, [...recent(client), Date.now()]);
}

export const clearFailures = (client) => failures.delete(client);

// ---------- `set-password` command ----------

function askHidden(question) {
  const { stdin, stdout } = process;
  stdout.write(question);
  return new Promise((resolve) => {
    let value = '';
    const done = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(), resolve(value);
        if (ch === '\u0003') return done(), process.exit(130); // Ctrl-C
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.resume();
  });
}

export async function setPasswordCommand(file) {
  // Typed at a terminal, the password is hidden; piped in, it's read line by line.
  let ask = askHidden;
  if (!process.stdin.isTTY) {
    const lines = readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();
    ask = async (q) => (process.stdout.write(`${q}\n`), (await lines.next()).value ?? '');
  }

  const password = await ask('New password: ');
  if (password.length < MIN_LENGTH) throw new Error(`Use at least ${MIN_LENGTH} characters.`);
  if ((await ask('Type it again: ')) !== password) throw new Error("Those didn't match, nothing was changed.");

  const salt = randomBytes(16);
  const auth = { hash: await hashPassword(password, salt), salt, secret: randomBytes(32) };
  const json = Object.fromEntries(Object.entries(auth).map(([k, v]) => [k, v.toString('base64')]));
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600); // only you can read it, even if the file already existed
  console.log(`Password saved to ${file}. Every device has been logged out.`);
}
