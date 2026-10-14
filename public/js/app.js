import { html, mount, effect } from './reactive.js';
import {
  state, ui, readRoute, load, toast, openNew, openEdit, closeSheet, setDraft, toggleGroup, toggleExercise,
  saveDraft, deleteDraft, quickLog, addExercise, removeExercise, saveSettings, setGoal, currentGoal,
} from './store.js';
import { todayKey } from './dates.js';
import { TopBar, Nav, Toast } from './views/chrome.js';
import { HomeView } from './views/home.js';
import { HistoryView } from './views/history.js';
import { LibraryView } from './views/library.js';
import { SettingsView } from './views/settings.js';
import { Sheet } from './views/sheet.js';

const VIEWS = { home: HomeView, history: HistoryView, library: LibraryView, settings: SettingsView };
const $ = (sel) => document.querySelector(sel);

function Main() {
  if (state.error.value && !state.ready.value) {
    return html`<div class="card empty" data-key="error">
      <p class="empty-emoji">💔</p>
      <p><b>Can't reach the gym.</b> Is the server running? (<code>npm start</code>)</p>
      <button class="btn btn-primary" data-action="retry">Try again</button>
    </div>`;
  }
  if (!state.ready.value) return html`<p class="loading" data-key="loading">Chalking up…</p>`;
  return VIEWS[ui.route.value]();
}

mount($('#top'), TopBar);
mount($('#view'), Main);
mount($('#nav'), Nav);
mount($('#sheet'), Sheet);
mount($('#toast'), Toast);

effect(() => document.body.classList.toggle('sheet-open', Boolean(ui.draft.value)));

// ---------- goal-hit celebration ----------

let celebrated = 0;
effect(() => {
  const n = ui.celebrate.value;
  if (n <= celebrated) return;
  celebrated = n;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.setAttribute('aria-hidden', 'true');
  const glyphs = ['♥', '✨', '●', '🌈', '✦', '●', '🌸', '♥'];
  for (let i = 0; i < 42; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.setProperty('--x', `${(Math.random() * 2 - 1) * 46}vw`);
    s.style.setProperty('--y', `${-(35 + Math.random() * 55)}vh`);
    s.style.setProperty('--r', `${(Math.random() * 2 - 1) * 400}deg`);
    s.style.setProperty('--d', `${0.9 + Math.random() * 0.9}s`);
    s.style.setProperty('--s', `${0.8 + Math.random() * 1.2}`);
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2200);
});

// ---------- events (delegated) ----------

const num = (el, key = 'id') => Number(el.dataset[key]);

const actions = {
  retry: () => load(),
  openNew: () => openNew(),
  openEdit: (el) => openEdit(num(el)),
  closeSheet,
  quickLog,
  saveDraft,
  deleteDraft,
  toggleGroup: (el) => toggleGroup(num(el)),
  toggleExercise: (el) => toggleExercise(num(el)),
  draftDate: (el) => setDraft({ date: el.dataset.date }),
  draftDuration: (el) =>
    setDraft({ durationMin: String(ui.draft.peek()?.durationMin) === el.dataset.min ? '' : num(el, 'min') }),
  draftVibe: (el) => setDraft({ vibe: ui.draft.peek()?.vibe === num(el, 'value') ? null : num(el, 'value') }),
  dayTap: (el) => {
    const session = state.sessions.value.find((s) => s.date === el.dataset.date);
    session ? openEdit(session.id) : openNew(el.dataset.date);
  },
  libraryKind: (el) => (ui.libraryKind.value = el.dataset.kind),
  libraryGroup: (el) => (ui.libraryGroup.value = el.dataset.id === 'all' ? 'all' : num(el)),
  removeExercise: (el) => removeExercise(num(el)),
  goalStep: (el) => setGoal(currentGoal.value + num(el, 'step')),
  weekStart: (el) => saveSettings({ weekStart: num(el, 'value') }),
  saveName: (el) => {
    const name = el.value.trim();
    if (name !== state.settings.value.name) saveSettings({ name }).then(() => toast(name ? `Hey ${name} ♥` : 'Name cleared'));
  },
  addExercise: async (form) => {
    const data = new FormData(form);
    try {
      const created = await addExercise({
        name: String(data.get('name')).trim(),
        groupId: Number(data.get('groupId')),
        kind: data.get('kind'),
      });
      form.querySelector('[name="name"]').value = '';
      toast(`${created.name} added ✦`);
    } catch (err) {
      toast(err.message, 'error');
    }
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || !actions[el.dataset.action]) return;
  e.preventDefault();
  actions[el.dataset.action](el, e);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.draft) setDraft({ [el.dataset.draft]: el.value });
  else if (el.dataset.bind) ui[el.dataset.bind].value = el.value;
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) actions[el.dataset.change]?.(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  actions[form.dataset.submit]?.(form, e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.draft.peek()) closeSheet();
  if (e.key === 'Enter' && e.target.matches('[data-change]')) e.target.blur();
});

// ---------- routing & clock ----------

window.addEventListener('hashchange', () => {
  ui.route.value = readRoute();
  window.scrollTo({ top: 0 });
});

// Keep "today" fresh so the week rolls over at midnight without a reload.
const tick = () => (state.today.value = todayKey());
setInterval(tick, 60_000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());

load();
