import { html } from '../reactive.js';
import { state, weeks, groupsById, exercisesById, VIBES } from '../store.js';
import { fmt, fromKey, weekStartOf } from '../dates.js';

function SessionCard(s) {
  const groups = s.groupIds.map((id) => groupsById.value.get(id)).filter(Boolean);
  const exercises = s.exerciseIds.map((id) => exercisesById.value.get(id)?.name).filter(Boolean);
  const vibe = VIBES.find((v) => v.value === s.vibe);
  const meta = [
    exercises.length && `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`,
    s.durationMin && `${s.durationMin} min`,
    vibe?.label,
  ].filter(Boolean);

  return html`<button class="session" data-action="openEdit" data-id="${s.id}">
    <span class="session-date">
      <span class="dow">${fmt(s.date, { weekday: 'short' })}</span>
      <span class="dom">${fromKey(s.date).getDate()}</span>
    </span>
    <span class="session-body">
      <span class="chip-row">
        ${groups.length
          ? groups.map((g) => html`<span class="chip chip-sm is-on">${g.name}</span>`)
          : html`<span class="chip chip-sm">Showed up ✓</span>`}
      </span>
      ${exercises.length ? html`<span class="session-ex">${exercises.join(' · ')}</span>` : ''}
      ${s.notes ? html`<span class="session-notes">“${s.notes}”</span>` : ''}
      ${meta.length ? html`<span class="session-meta">${meta.join(' · ')}</span>` : ''}
    </span>
    <span class="session-vibe" aria-hidden="true">${vibe?.emoji ?? ''}</span>
  </button>`;
}

export function HistoryView() {
  const ws = state.settings.value.weekStart;
  const byWeek = new Map();
  for (const s of state.sessions.value) {
    const start = weekStartOf(s.date, ws);
    if (!byWeek.has(start)) byWeek.set(start, []);
    byWeek.get(start).push(s);
  }

  // Newest first; consecutive empty weeks collapse into one "rest" line.
  const blocks = [];
  let restRun = 0;
  const flushRest = () => {
    if (restRun) blocks.push(html`<p class="rest-run">${restRun === 1 ? 'A rest week' : `${restRun} rest weeks`} — it happens ♥</p>`);
    restRun = 0;
  };
  for (const w of [...weeks.value].reverse()) {
    const list = byWeek.get(w.start) ?? [];
    if (!list.length && !w.current) {
      restRun++;
      continue;
    }
    flushRest();
    blocks.push(html`<section class="week-block">
      <header class="week-head">
        <h3>${w.current ? 'This week' : `Week of ${fmt(w.start, { month: 'short', day: 'numeric' })}`}</h3>
        <span class="badge ${w.hit ? 'is-hit' : ''}">${w.count}/${w.target}${w.hit ? ' 🎀' : ''}</span>
      </header>
      ${list.length
        ? list.map(SessionCard)
        : html`<p class="rest-run">Nothing yet — your week is waiting.</p>`}
    </section>`);
  }
  flushRest();

  return html`<section class="view" data-key="history">
    <header class="page-head">
      <h1 class="display chrome">The diary</h1>
      <p class="script tagline">every sesh counts</p>
    </header>
    ${state.sessions.value.length
      ? blocks
      : html`<div class="card empty">
          <p class="empty-emoji">🎀</p>
          <p><b>No seshes yet.</b> Your first one is the hardest — and the best.</p>
          <button class="btn btn-primary" data-action="openNew">Log your first sesh</button>
        </div>`}
  </section>`;
}
