import { DatabaseSync } from 'node:sqlite';
import { MUSCLE_GROUPS } from './seed.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Each row is "from this date on, the weekly target is N".
  -- Past weeks are judged by the goal that applied to them.
  CREATE TABLE IF NOT EXISTS goals (
    id             INTEGER PRIMARY KEY,
    weekly_target  INTEGER NOT NULL CHECK (weekly_target BETWEEN 1 AND 7),
    effective_from TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS muscle_groups (
    id   INTEGER PRIMARY KEY,
    slug TEXT    NOT NULL UNIQUE,
    name TEXT    NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id              INTEGER PRIMARY KEY,
    name            TEXT    NOT NULL,
    muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id),
    kind            TEXT    NOT NULL CHECK (kind IN ('calisthenics', 'weights', 'cardio')),
    is_custom       INTEGER NOT NULL DEFAULT 0,
    archived        INTEGER NOT NULL DEFAULT 0,
    UNIQUE (name, muscle_group_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY,
    date         TEXT    NOT NULL,
    duration_min INTEGER CHECK (duration_min BETWEEN 1 AND 600),
    vibe         INTEGER CHECK (vibe BETWEEN 1 AND 5),
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

  CREATE TABLE IF NOT EXISTS session_exercises (
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    PRIMARY KEY (session_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS session_muscle_groups (
    session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id),
    PRIMARY KEY (session_id, muscle_group_id)
  );
`;

const BASELINE = '0000-01-01';

export class NotFound extends Error {}
export class Conflict extends Error {}

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  seed(db);
  return createRepo(db);
}

function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seed(db) {
  const upsertGroup = db.prepare(`
    INSERT INTO muscle_groups (slug, name, sort) VALUES (?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET name = excluded.name, sort = excluded.sort
    RETURNING id
  `);
  const insertExercise = db.prepare(
    'INSERT OR IGNORE INTO exercises (name, muscle_group_id, kind) VALUES (?, ?, ?)',
  );

  tx(db, () => {
    MUSCLE_GROUPS.forEach((group, i) => {
      const { id } = upsertGroup.get(group.slug, group.name, i);
      for (const [kind, names] of Object.entries(group.exercises)) {
        for (const name of names) insertExercise.run(name, id, kind);
      }
    });
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('name', ''), ('week_start', '1')").run();
    if (!db.prepare('SELECT 1 FROM goals LIMIT 1').get()) {
      db.prepare('INSERT INTO goals (weekly_target, effective_from) VALUES (3, ?)').run(BASELINE);
    }
  });
}

const SESSION_SELECT = `
  SELECT s.id, s.date, s.duration_min AS durationMin, s.vibe, s.notes,
    (SELECT json_group_array(exercise_id) FROM session_exercises WHERE session_id = s.id) AS exerciseIds,
    (SELECT json_group_array(muscle_group_id) FROM session_muscle_groups WHERE session_id = s.id) AS groupIds
  FROM sessions s
`;

const toSession = (row) => ({
  id: row.id,
  date: row.date,
  durationMin: row.durationMin,
  vibe: row.vibe,
  notes: row.notes,
  exerciseIds: JSON.parse(row.exerciseIds),
  groupIds: JSON.parse(row.groupIds),
});

const toExercise = (row) => ({
  id: row.id,
  name: row.name,
  groupId: row.groupId,
  kind: row.kind,
  isCustom: Boolean(row.isCustom),
  archived: Boolean(row.archived),
});

function createRepo(db) {
  const q = {
    settings: db.prepare('SELECT key, value FROM settings'),
    setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),
    goals: db.prepare('SELECT weekly_target AS target, effective_from AS effectiveFrom FROM goals ORDER BY effective_from'),
    groups: db.prepare('SELECT id, slug, name FROM muscle_groups ORDER BY sort'),
    exercises: db.prepare(`
      SELECT id, name, muscle_group_id AS groupId, kind, is_custom AS isCustom, archived
      FROM exercises ORDER BY name COLLATE NOCASE
    `),
    exercise: db.prepare(`
      SELECT id, name, muscle_group_id AS groupId, kind, is_custom AS isCustom, archived
      FROM exercises WHERE id = ?
    `),
    exerciseByName: db.prepare('SELECT id, archived FROM exercises WHERE name = ? COLLATE NOCASE AND muscle_group_id = ?'),
    sessions: db.prepare(`${SESSION_SELECT} ORDER BY s.date DESC, s.id DESC`),
    session: db.prepare(`${SESSION_SELECT} WHERE s.id = ?`),
    insertSession: db.prepare('INSERT INTO sessions (date, duration_min, vibe, notes) VALUES (?, ?, ?, ?)'),
    updateSession: db.prepare('UPDATE sessions SET date = ?, duration_min = ?, vibe = ?, notes = ? WHERE id = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    clearSessionExercises: db.prepare('DELETE FROM session_exercises WHERE session_id = ?'),
    clearSessionGroups: db.prepare('DELETE FROM session_muscle_groups WHERE session_id = ?'),
    linkExercise: db.prepare('INSERT OR IGNORE INTO session_exercises (session_id, exercise_id) VALUES (?, ?)'),
    linkGroup: db.prepare('INSERT OR IGNORE INTO session_muscle_groups (session_id, muscle_group_id) VALUES (?, ?)'),
  };

  function getSettings() {
    const map = Object.fromEntries(q.settings.all().map((r) => [r.key, r.value]));
    return { name: map.name ?? '', weekStart: Number(map.week_start ?? 1) };
  }

  function getSession(id) {
    const row = q.session.get(id);
    if (!row) throw new NotFound('Session not found');
    return toSession(row);
  }

  function linkSession(id, { exerciseIds, groupIds }) {
    for (const exId of exerciseIds) q.linkExercise.run(id, exId);
    for (const groupId of groupIds) q.linkGroup.run(id, groupId);
  }

  return {
    bootstrap() {
      return {
        settings: getSettings(),
        goals: q.goals.all(),
        groups: q.groups.all(),
        exercises: q.exercises.all().map(toExercise),
        sessions: q.sessions.all().map(toSession),
      };
    },

    createSession(input) {
      return tx(db, () => {
        const { lastInsertRowid } = q.insertSession.run(input.date, input.durationMin, input.vibe, input.notes);
        linkSession(lastInsertRowid, input);
        return getSession(lastInsertRowid);
      });
    },

    updateSession(id, input) {
      return tx(db, () => {
        const { changes } = q.updateSession.run(input.date, input.durationMin, input.vibe, input.notes, id);
        if (!changes) throw new NotFound('Session not found');
        q.clearSessionExercises.run(id);
        q.clearSessionGroups.run(id);
        linkSession(id, input);
        return getSession(id);
      });
    },

    deleteSession(id) {
      if (!q.deleteSession.run(id).changes) throw new NotFound('Session not found');
    },

    createExercise({ name, groupId, kind }) {
      const existing = q.exerciseByName.get(name, groupId);
      if (existing && !existing.archived) throw new Conflict('That exercise is already in this group');
      if (existing) {
        db.prepare('UPDATE exercises SET archived = 0, kind = ? WHERE id = ?').run(kind, existing.id);
        return toExercise(q.exercise.get(existing.id));
      }
      const { lastInsertRowid } = db
        .prepare('INSERT INTO exercises (name, muscle_group_id, kind, is_custom) VALUES (?, ?, ?, 1)')
        .run(name, groupId, kind);
      return toExercise(q.exercise.get(lastInsertRowid));
    },

    // Soft delete, so old sessions still show the exercise name.
    archiveExercise(id) {
      const { changes } = db.prepare('UPDATE exercises SET archived = 1 WHERE id = ? AND is_custom = 1').run(id);
      if (!changes) throw new NotFound('Only custom exercises can be removed');
    },

    updateSettings({ name, weekStart }) {
      tx(db, () => {
        if (name !== undefined) q.setSetting.run('name', name);
        if (weekStart !== undefined) q.setSetting.run('week_start', String(weekStart));
      });
      return getSettings();
    },

    // A new goal applies from `effectiveFrom` (the current week) onwards. If
    // there's no history before that week yet, it simply becomes the goal.
    setGoal({ target, effectiveFrom }) {
      return tx(db, () => {
        const hasHistory = db.prepare('SELECT 1 FROM sessions WHERE date < ? LIMIT 1').get(effectiveFrom);
        if (hasHistory) {
          db.prepare('DELETE FROM goals WHERE effective_from >= ?').run(effectiveFrom);
          db.prepare('INSERT INTO goals (weekly_target, effective_from) VALUES (?, ?)').run(target, effectiveFrom);
        } else {
          db.prepare('DELETE FROM goals').run();
          db.prepare('INSERT INTO goals (weekly_target, effective_from) VALUES (?, ?)').run(target, BASELINE);
        }
        return q.goals.all();
      });
    },
  };
}
