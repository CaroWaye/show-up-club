import { html } from '../reactive.js';
import { state, ui, activeExercises, exercisesById, KINDS, VIBES } from '../store.js';
import { addDays } from '../dates.js';

function ExercisePill(e, selected) {
  const on = selected.includes(e.id);
  return html`<button class="pill ${on ? 'is-on' : ''}" aria-pressed="${on}" data-action="toggleExercise" data-id="${e.id}">
    <span class="kind-dot kind-${e.kind}" title="${KINDS[e.kind]}"></span>${e.name}
  </button>`;
}

function Picker(d) {
  const query = d.search.trim().toLowerCase();
  if (query) {
    const hits = activeExercises.value.filter((e) => e.name.toLowerCase().includes(query)).slice(0, 40);
    return hits.length
      ? html`<div class="pill-cloud">${hits.map((e) => ExercisePill(e, d.exerciseIds))}</div>`
      : html`<p class="hint">No match — add it in the Library tab.</p>`;
  }
  if (!d.groupIds.length) return html`<p class="hint">Pick a muscle group above or search to add exercises.</p>`;

  return state.groups.value
    .filter((g) => d.groupIds.includes(g.id))
    .map((g) => {
      const list = activeExercises.value.filter((e) => e.groupId === g.id);
      return html`<div class="picker-group">
        <p class="picker-title">${g.name}</p>
        <div class="pill-cloud">${list.map((e) => ExercisePill(e, d.exerciseIds))}</div>
      </div>`;
    });
}

export function Sheet() {
  const d = ui.draft.value;
  if (!d) return '';
  const today = state.today.value;
  const yesterday = addDays(today, -1);
  const byId = exercisesById.value;
  const picked = d.exerciseIds.map((id) => byId.get(id)).filter(Boolean);

  return html`<div class="sheet-backdrop" data-action="closeSheet"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="sheet-head">
      <h2 id="sheet-title" class="display">${d.id ? 'Edit sesh' : 'Log a sesh'}</h2>
      <button class="icon-btn" data-action="closeSheet" aria-label="Close">✕</button>
    </header>

    <div class="sheet-body">
      <section class="field">
        <span class="label">When</span>
        <div class="row">
          <input class="input input-date" type="date" data-draft="date" value="${d.date}" max="${today}" aria-label="Date">
          <button class="chip ${d.date === today ? 'is-on' : ''}" data-action="draftDate" data-date="${today}">Today</button>
          <button class="chip ${d.date === yesterday ? 'is-on' : ''}" data-action="draftDate" data-date="${yesterday}">Yesterday</button>
        </div>
      </section>

      <section class="field">
        <span class="label">What'd you hit?</span>
        <div class="chip-cloud">
          ${state.groups.value.map((g) => {
            const on = d.groupIds.includes(g.id);
            return html`<button class="chip ${on ? 'is-on' : ''}" aria-pressed="${on}" data-action="toggleGroup"
              data-id="${g.id}">${g.name}</button>`;
          })}
        </div>
      </section>

      <section class="field">
        <div class="label-row">
          <span class="label">Exercises <em>optional</em></span>
          ${picked.length ? html`<span class="count">${picked.length} picked</span>` : ''}
        </div>
        ${picked.length
          ? html`<div class="picked">${picked.map(
              (e) => html`<button class="pill is-on pill-removable" data-action="toggleExercise" data-id="${e.id}"
                aria-label="Remove ${e.name}">${e.name} <span aria-hidden="true">✕</span></button>`,
            )}</div>`
          : ''}
        <input class="input" type="search" data-draft="search" value="${d.search}" placeholder="Search all exercises…"
          aria-label="Search exercises">
        <div class="picker">${Picker(d)}</div>
      </section>

      <section class="field">
        <span class="label">How long? <em>optional</em></span>
        <div class="row">
          ${[30, 45, 60, 90].map(
            (m) => html`<button class="chip ${String(d.durationMin) === String(m) ? 'is-on' : ''}"
              data-action="draftDuration" data-min="${m}">${m}</button>`,
          )}
          <input class="input input-num" type="number" inputmode="numeric" min="1" max="600" placeholder="min"
            data-draft="durationMin" value="${d.durationMin}" aria-label="Minutes">
        </div>
      </section>

      <section class="field">
        <span class="label">Vibe check</span>
        <div class="vibes">
          ${VIBES.map(
            (v) => html`<button class="vibe ${d.vibe === v.value ? 'is-on' : ''}" aria-pressed="${d.vibe === v.value}"
              data-action="draftVibe" data-value="${v.value}">
              <span class="vibe-emoji">${v.emoji}</span><span class="vibe-label">${v.label}</span>
            </button>`,
          )}
        </div>
      </section>

      <section class="field">
        <span class="label">Notes</span>
        <textarea class="input" data-draft="notes" rows="3" maxlength="2000"
          placeholder="New playlist? Gym crush? Felt amazing? Write it down.">${d.notes}</textarea>
      </section>
    </div>

    <footer class="sheet-foot">
      ${d.id
        ? html`<button class="btn btn-danger ${d.confirmDelete ? 'is-armed' : ''}" data-action="deleteDraft">
            ${d.confirmDelete ? 'Tap again to delete' : 'Delete'}</button>`
        : ''}
      <button class="btn btn-primary" data-action="saveDraft" ${d.saving ? 'disabled' : ''}>
        ${d.saving ? 'Saving…' : d.id ? 'Save changes' : 'Lock it in ♥'}
      </button>
    </footer>
  </div>`;
}
