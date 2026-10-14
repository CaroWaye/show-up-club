import { html, raw } from '../reactive.js';
import { state, ui, stats } from '../store.js';
import { fmt } from '../dates.js';

const ICONS = {
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  history: '<rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  library: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export const icon = (name) =>
  raw(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`);

export function TopBar() {
  const ready = state.ready.value;
  return html`<div class="topbar">
    <a class="brand" href="#/home" aria-label="Show Up Club home">
      <span class="brand-mark">♥</span>
      <span class="brand-word">Show Up <span>Club</span></span>
    </a>
    <div class="topbar-right">
      ${ready ? html`<span class="top-pill top-pill-fire" title="Weeks in a row you hit your goal">🔥 ${stats.value.streak}</span>` : ''}
      <span class="top-pill">${fmt(state.today.value, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </div>
  </div>`;
}

const TABS = [
  ['home', 'Home'],
  ['history', 'Diary'],
  null,
  ['library', 'Library'],
  ['settings', 'Settings'],
];

export function Nav() {
  const route = ui.route.value;
  return html`<div class="nav-inner">
    ${TABS.map((tab) =>
      tab
        ? html`<a class="nav-link ${route === tab[0] ? 'is-active' : ''}" href="#/${tab[0]}"
            ${route === tab[0] ? raw('aria-current="page"') : ''}>${icon(tab[0])}<span>${tab[1]}</span></a>`
        : html`<button class="nav-fab" data-action="openNew" aria-label="Log a session">${icon('plus')}</button>`,
    )}
  </div>`;
}

export function Toast() {
  const t = ui.toast.value;
  return t ? html`<div class="toast toast-${t.tone}" data-key="${t.id}">${t.message}</div>` : '';
}
