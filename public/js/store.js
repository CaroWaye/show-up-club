import { signal, computed } from './reactive.js';
import * as api from './api.js';
import { todayKey, weekStartOf, addDays, daysBetween } from './dates.js';

export const ROUTES = ['home', 'history', 'library', 'settings'];
export const KINDS = { calisthenics: 'Calisthenics', weights: 'Weights', cardio: 'Cardio' };
export const VIBES = [
  { value: 1, emoji: '💀', label: 'Survived' },
  { value: 2, emoji: '😮‍💨', label: 'Meh' },
  { value: 3, emoji: '🙂', label: 'Solid' },
  { value: 4, emoji: '💪', label: 'Strong' },
  { value: 5, emoji: '✨', label: 'That girl' },
];
const BASELINE = '0000-01-01';

export function readRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(r) ? r : 'home';
}

// ---------- state ----------

export const state = {
  ready: signal(false),
  error: signal(null),
  settings: signal({ name: '', weekStart: 1 }),
  goals: signal([]),
  groups: signal([]),
  exercises: signal([]),
  sessions: signal([]),
  today: signal(todayKey()),
};

export const ui = {
  route: signal(readRoute()),
  draft: signal(null),
  toast: signal(null),
  celebrate: signal(0),
  libraryQuery: signal(''),
  libraryKind: signal('all'),
  libraryGroup: signal('all'),
};

// ---------- derived ----------

export const groupsById = computed(() => new Map(state.groups.value.map((g) => [g.id, g])));
export const exercisesById = computed(() => new Map(state.exercises.value.map((e) => [e.id, e])));
export const activeExercises = computed(() => state.exercises.value.filter((e) => !e.archived));
export const sessionDays = computed(() => new Set(state.sessions.value.map((s) => s.date)));
export const currentWeekStart = computed(() => weekStartOf(state.today.value, state.settings.value.weekStart));

/** The goal that applied to the week starting on `start` (goals are sorted by effectiveFrom). */
export function goalFor(start, goals = state.goals.value) {
  const end = addDays(start, 6);
  let target = goals[0]?.target ?? 3;
  for (const g of goals) if (g.effectiveFrom <= end) target = g.target;
  return target;
}

export const currentGoal = computed(() => goalFor(currentWeekStart.value));

/** Every week from your first session up to this one, with days trained vs goal. */
export const weeks = computed(() => {
  const ws = state.settings.value.weekStart;
  const current = currentWeekStart.value;
  const counts = new Map();
  let first = current;
  for (const day of sessionDays.value) {
    const start = weekStartOf(day, ws);
    counts.set(start, (counts.get(start) ?? 0) + 1);
    if (start < first) first = start;
  }
  const out = [];
  for (let start = first; start <= current; start = addDays(start, 7)) {
    const count = counts.get(start) ?? 0;
    const target = goalFor(start);
    out.push({ start, count, target, hit: count >= target, current: start === current });
  }
  return out;
});

export const stats = computed(() => {
  const list = weeks.value;
  const cur = list[list.length - 1];
  const today = state.today.value;
  const days = sessionDays.value;

  // This week's streak is still "alive" until the week is over.
  let streak = cur.hit ? 1 : 0;
  for (let i = list.length - 2; i >= 0 && list[i].hit; i--) streak++;

  let best = 0;
  let run = 0;
  for (const w of list) {
    run = w.hit ? run + 1 : 0;
    best = Math.max(best, run);
  }

  const recent = list.filter((w) => !w.current).slice(-12);
  const hitRate = recent.length ? Math.round((100 * recent.filter((w) => w.hit).length) / recent.length) : null;

  const trainedToday = days.has(today);
  const weekEnd = addDays(cur.start, 6);
  const daysLeft = daysBetween(today, weekEnd) + 1 - (trainedToday ? 1 : 0);
  const remaining = Math.max(0, cur.target - cur.count);
  const status = cur.hit ? 'hit' : remaining > daysLeft ? 'missed' : remaining === daysLeft ? 'all-in' : 'on-track';

  const strip = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(cur.start, i);
    return { key, trained: days.has(key), isToday: key === today, isFuture: key > today };
  });

  const groupsThisWeek = new Map();
  for (const s of state.sessions.value) {
    if (s.date < cur.start || s.date > weekEnd) continue;
    for (const id of s.groupIds) groupsThisWeek.set(id, (groupsThisWeek.get(id) ?? 0) + 1);
  }

  return {
    current: { ...cur, remaining, daysLeft, status, trainedToday, nextWeekStart: addDays(cur.start, 7) },
    streak,
    best,
    hitRate,
    totalDays: days.size,
    strip,
    groupsThisWeek,
  };
});

// ---------- actions ----------

export async function load() {
  try {
    const data = await api.get('/api/bootstrap');
    state.settings.value = data.settings;
    state.goals.value = data.goals;
    state.groups.value = data.groups;
    state.exercises.value = data.exercises;
    state.sessions.value = data.sessions;
    state.error.value = null;
    state.ready.value = true;
  } catch (err) {
    state.error.value = err.message;
  }
}

export function toast(message, tone = 'info') {
  const id = `${Date.now()}${Math.random()}`;
  ui.toast.value = { id, message, tone };
  setTimeout(() => {
    if (ui.toast.peek()?.id === id) ui.toast.value = null;
  }, 2800);
}

const sortSessions = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

/** Runs a change and reports whether it just tipped this week over the goal. */
async function watchGoal(fn) {
  const before = stats.value.current.hit;
  await fn();
  const hitNow = !before && stats.value.current.hit;
  if (hitNow) ui.celebrate.value++;
  return hitNow;
}

async function persistSession(id, payload) {
  const saved = id ? await api.put(`/api/sessions/${id}`, payload) : await api.post('/api/sessions', payload);
  state.sessions.value = sortSessions([...state.sessions.value.filter((s) => s.id !== saved.id), saved]);
  return saved;
}

// ----- the log sheet -----

const blankDraft = (date) => ({
  id: null,
  date,
  groupIds: [],
  exerciseIds: [],
  durationMin: '',
  vibe: null,
  notes: '',
  search: '',
  saving: false,
  confirmDelete: false,
});

export function openNew(date = state.today.value) {
  ui.draft.value = blankDraft(date);
}

export function openEdit(id) {
  const s = state.sessions.value.find((x) => x.id === id);
  if (!s) return;
  ui.draft.value = {
    ...blankDraft(s.date),
    id: s.id,
    groupIds: [...s.groupIds],
    exerciseIds: [...s.exerciseIds],
    durationMin: s.durationMin ?? '',
    vibe: s.vibe,
    notes: s.notes ?? '',
  };
}

export function closeSheet() {
  ui.draft.value = null;
}

export function setDraft(patch) {
  const d = ui.draft.peek();
  if (d) ui.draft.value = { ...d, ...patch };
}

export function toggleGroup(groupId) {
  const d = ui.draft.peek();
  if (!d) return;
  if (d.groupIds.includes(groupId)) {
    const byId = exercisesById.value;
    setDraft({
      groupIds: d.groupIds.filter((id) => id !== groupId),
      exerciseIds: d.exerciseIds.filter((id) => byId.get(id)?.groupId !== groupId),
    });
  } else {
    setDraft({ groupIds: [...d.groupIds, groupId] });
  }
}

export function toggleExercise(exerciseId) {
  const d = ui.draft.peek();
  if (!d) return;
  if (d.exerciseIds.includes(exerciseId)) {
    setDraft({ exerciseIds: d.exerciseIds.filter((id) => id !== exerciseId) });
    return;
  }
  const groupId = exercisesById.value.get(exerciseId)?.groupId;
  setDraft({
    exerciseIds: [...d.exerciseIds, exerciseId],
    groupIds: groupId && !d.groupIds.includes(groupId) ? [...d.groupIds, groupId] : d.groupIds,
  });
}

export async function saveDraft() {
  const d = ui.draft.peek();
  if (!d || d.saving) return;
  if (!d.date) return toast('Pick a date first, babe', 'error');
  if (d.date > state.today.value) return toast("Can't log the future (yet) ✦", 'error');

  const rawDur = String(d.durationMin).trim();
  const durationMin = rawDur === '' ? null : Math.round(Number(rawDur));
  if (durationMin !== null && !(durationMin >= 1 && durationMin <= 600)) {
    return toast('Duration should be 1–600 minutes', 'error');
  }

  setDraft({ saving: true });
  try {
    const hit = await watchGoal(() =>
      persistSession(d.id, {
        date: d.date,
        durationMin,
        vibe: d.vibe,
        notes: d.notes.trim() || null,
        exerciseIds: d.exerciseIds,
        groupIds: d.groupIds,
      }),
    );
    ui.draft.value = null;
    toast(hit ? 'GOAL HIT 🎀 You did that.' : d.id ? 'Sesh updated ✦' : 'Sesh logged. Proud of you ♥');
  } catch (err) {
    setDraft({ saving: false });
    toast(err.message, 'error');
  }
}

export async function deleteDraft() {
  const d = ui.draft.peek();
  if (!d?.id) return;
  if (!d.confirmDelete) return setDraft({ confirmDelete: true });

  const before = state.sessions.value;
  state.sessions.value = before.filter((s) => s.id !== d.id);
  ui.draft.value = null;
  try {
    await api.del(`/api/sessions/${d.id}`);
    toast('Sesh deleted');
  } catch (err) {
    state.sessions.value = before;
    toast(err.message, 'error');
  }
}

export async function quickLog() {
  if (stats.value.current.trainedToday) return toast('Already logged today ♥');
  try {
    const hit = await watchGoal(() =>
      persistSession(null, { date: state.today.value, exerciseIds: [], groupIds: [] }),
    );
    toast(hit ? 'GOAL HIT 🎀 You did that.' : 'Showed up ✓ That’s the whole workout.');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ----- library -----

export async function addExercise({ name, groupId, kind }) {
  const created = await api.post('/api/exercises', { name, groupId, kind });
  state.exercises.value = [...state.exercises.value.filter((e) => e.id !== created.id), created].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  return created;
}

export async function removeExercise(id) {
  const before = state.exercises.value;
  state.exercises.value = before.map((e) => (e.id === id ? { ...e, archived: true } : e));
  try {
    await api.del(`/api/exercises/${id}`);
    toast('Removed from your library');
  } catch (err) {
    state.exercises.value = before;
    toast(err.message, 'error');
  }
}

// ----- settings -----

export async function saveSettings(patch) {
  const before = state.settings.value;
  state.settings.value = { ...before, ...patch };
  try {
    state.settings.value = await api.put('/api/settings', patch);
  } catch (err) {
    state.settings.value = before;
    toast(err.message, 'error');
  }
}

let goalQueue = Promise.resolve();
let goalSeq = 0;

export function setGoal(target) {
  const seq = ++goalSeq;
  target = Math.min(7, Math.max(1, target));
  const effectiveFrom = currentWeekStart.value;

  // Optimistic: mirror the server's rule so the UI responds instantly.
  const hasHistory = state.sessions.value.some((s) => s.date < effectiveFrom);
  state.goals.value = hasHistory
    ? [...state.goals.value.filter((g) => g.effectiveFrom < effectiveFrom), { target, effectiveFrom }]
    : [{ target, effectiveFrom: BASELINE }];

  goalQueue = goalQueue
    .then(() => api.put('/api/goal', { target, effectiveFrom }))
    .then((goals) => {
      // Rapid taps queue up; only the last response should land.
      if (seq === goalSeq) state.goals.value = goals;
    })
    .catch((err) => {
      toast(err.message, 'error');
      return load();
    });
}
