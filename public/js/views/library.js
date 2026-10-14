import { html } from '../reactive.js';
import { state, ui, activeExercises, KINDS } from '../store.js';

export function LibraryView() {
  const query = ui.libraryQuery.value.trim().toLowerCase();
  const kind = ui.libraryKind.value;
  const groupFilter = ui.libraryGroup.value;

  const timesDone = new Map();
  for (const s of state.sessions.value) for (const id of s.exerciseIds) timesDone.set(id, (timesDone.get(id) ?? 0) + 1);

  const matches = activeExercises.value.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (groupFilter === 'all' || e.groupId === groupFilter) &&
      (!query || e.name.toLowerCase().includes(query)),
  );

  const sections = state.groups.value
    .map((g) => ({ group: g, list: matches.filter((e) => e.groupId === g.id) }))
    .filter((s) => s.list.length);

  return html`<section class="view" data-key="library">
    <header class="page-head">
      <h1 class="display chrome">The menu</h1>
      <p class="script tagline">pick your poison</p>
    </header>

    <div class="library-tools">
      <input type="search" class="input" placeholder="Search ${activeExercises.value.length} exercises…"
        data-bind="libraryQuery" value="${ui.libraryQuery.value}" aria-label="Search exercises">
      <div class="seg" role="group" aria-label="Filter by type">
        ${[['all', 'All'], ...Object.entries(KINDS)].map(
          ([k, label]) => html`<button class="seg-btn ${kind === k ? 'is-on' : ''}" aria-pressed="${kind === k}"
            data-action="libraryKind" data-kind="${k}">${label}</button>`,
        )}
      </div>
      <div class="chip-scroll" role="group" aria-label="Filter by muscle group">
        <button class="chip ${groupFilter === 'all' ? 'is-on' : ''}" data-action="libraryGroup" data-id="all">Everything</button>
        ${state.groups.value.map(
          (g) => html`<button class="chip ${groupFilter === g.id ? 'is-on' : ''}" data-action="libraryGroup"
            data-id="${g.id}">${g.name}</button>`,
        )}
      </div>
    </div>

    ${sections.length
      ? sections.map(
          ({ group, list }) => html`<section class="lib-group">
            <header class="lib-head"><h3>${group.name}</h3><span class="muted small">${list.length}</span></header>
            <ul class="lib-list">
              ${list.map(
                (e) => html`<li class="lib-item">
                  <span class="kind-dot kind-${e.kind}" title="${KINDS[e.kind]}"></span>
                  <span class="lib-name">${e.name}</span>
                  ${e.isCustom ? html`<span class="tag">yours</span>` : ''}
                  ${timesDone.get(e.id) ? html`<span class="muted small">${timesDone.get(e.id)}×</span>` : ''}
                  ${e.isCustom
                    ? html`<button class="icon-btn icon-btn-sm" data-action="removeExercise" data-id="${e.id}"
                        aria-label="Remove ${e.name}">✕</button>`
                    : ''}
                </li>`,
              )}
            </ul>
          </section>`,
        )
      : html`<p class="empty-line">Nothing matches. Add it yourself ↓</p>`}

    <form class="card add-form" data-submit="addExercise">
      <h3 class="card-title">Add your own</h3>
      <input class="input" name="name" required maxlength="60" placeholder="e.g. Cossack Squat" autocomplete="off"
        aria-label="Exercise name">
      <div class="row">
        <select class="input" name="groupId" aria-label="Muscle group">
          ${state.groups.value.map((g) => html`<option value="${g.id}">${g.name}</option>`)}
        </select>
        <select class="input" name="kind" aria-label="Type">
          ${Object.entries(KINDS).map(([k, label]) => html`<option value="${k}">${label}</option>`)}
        </select>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Add to library</button>
    </form>
  </section>`;
}
