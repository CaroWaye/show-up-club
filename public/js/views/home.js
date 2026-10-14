import { html, raw } from '../reactive.js';
import { state, stats, weeks, sessionDays, currentWeekStart } from '../store.js';
import { addDays, fmt, fromKey } from '../dates.js';

const TAGLINES = [
  'consistency beats intensity',
  'progress is quiet, then sudden',
  'the hardest part is the front door',
  'motivation fades. habits stay.',
  "you don't have to feel like it",
  'a slow week still counts',
  'rest is part of the work',
  'you never regret showing up',
  'be kind to future you',
];

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late, legend';
  if (h < 12) return 'Rise & grind';
  if (h < 17) return 'Afternoon pump';
  return 'Evening sesh';
}

function tagline(today) {
  const d = fromKey(today);
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86_400_000);
  return TAGLINES[dayOfYear % TAGLINES.length];
}

function statusCopy(c) {
  const nextStart = fmt(c.nextWeekStart, { weekday: 'long' });
  switch (c.status) {
    case 'hit':
      return {
        title: 'Goal hit',
        script: 'you did that',
        sub:
          c.count > c.target
            ? `${plural(c.count - c.target, 'bonus sesh', 'bonus seshes')} on top. Overachiever energy.`
            : 'Anything else this week is a bonus, babe.',
      };
    case 'missed':
      return {
        title: 'Reset & rest',
        script: 'it happens',
        sub: `${c.target} isn't on the cards this week. Fresh start ${nextStart} — the streak can start again.`,
      };
    case 'all-in':
      return {
        title: 'No days off',
        script: 'all in',
        sub: `${plural(c.remaining, 'sesh', 'seshes')} to go and ${plural(c.daysLeft, 'day')} left. Every day counts now.`,
      };
    default:
      return c.count === 0
        ? {
            title: 'Fresh week',
            script: "let's go",
            sub: `${c.target} to hit, ${plural(c.daysLeft, 'day')} to do it. Get the first one in.`,
          }
        : {
            title: `${c.remaining} more to go`,
            script: 'on track',
            sub: `${plural(c.daysLeft, 'day')} left this week. Plenty of time.`,
          };
  }
}

function Plate({ count, target, hit }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(count / target, 1);
  const ticks =
    target > 1
      ? Array.from(
          { length: target },
          (_, i) =>
            html`<line class="plate-tick" x1="100" y1="${100 - r - 13}" x2="100" y2="${100 - r + 13}"
              transform="rotate(${(i / target) * 360} 100 100)"/>`,
        )
      : '';
  return html`<div class="plate-wrap ${hit ? 'is-hit' : ''}">
    <svg class="plate" viewBox="0 0 200 200" role="img" aria-label="${count} of ${target} sessions this week">
      <defs>
        <path id="plate-text" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/>
        <linearGradient id="plate-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffc2a1"/><stop offset=".5" stop-color="#ff9eb5"/><stop offset="1" stop-color="#b9a6f0"/>
        </linearGradient>
      </defs>
      <circle class="plate-rim" cx="100" cy="100" r="99"/>
      <text class="plate-emboss"><textPath href="#plate-text">SHOW UP CLUB ✦ CONSISTENCY IS THE PR ✦ SHOW UP CLUB ✦ NO EGO LIFTING ✦</textPath></text>
      <circle class="plate-track" cx="100" cy="100" r="${r}"/>
      <circle class="plate-fill" cx="100" cy="100" r="${r}" stroke="url(#plate-grad)"
        stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - progress)).toFixed(2)}"
        transform="rotate(-90 100 100)"/>
      ${ticks}
      <circle class="plate-hub" cx="100" cy="100" r="50"/>
      <text class="plate-num" x="100" y="108">${count}</text>
      <text class="plate-of" x="100" y="130">OF ${target}</text>
    </svg>
    ${hit ? html`<span class="plate-bow" aria-hidden="true">🎀</span>` : ''}
  </div>`;
}

function WeekStrip(strip) {
  return html`<ol class="week-strip" aria-label="This week">
    ${strip.map(
      (d) => html`<li>
        <button class="day ${d.trained ? 'is-trained' : ''} ${d.isToday ? 'is-today' : ''}"
          data-action="dayTap" data-date="${d.key}" ${d.isFuture ? raw('disabled') : ''}
          aria-label="${fmt(d.key, { weekday: 'long' })}${d.trained ? ', trained' : ''}">
          <span class="day-label">${fmt(d.key, { weekday: 'narrow' })}</span>
          <span class="day-dot">${d.trained ? '♥' : fromKey(d.key).getDate()}</span>
        </button>
      </li>`,
    )}
  </ol>`;
}

function Heatmap() {
  const today = state.today.value;
  const curStart = currentWeekStart.value;
  const days = sessionDays.value;
  const byStart = new Map(weeks.value.map((w) => [w.start, w]));
  let lastMonth = null;

  const starts = Array.from({ length: 16 }, (_, i) => addDays(curStart, (i - 15) * 7));
  const cols = starts.map((start, i) => {
    const w = byStart.get(start);
    const month = fmt(start, { month: 'short' });
    // Skip the first column's label if the next column starts a new month (avoids "JUN JUL" pile-ups).
    const crowded = i === 0 && fmt(starts[1], { month: 'short' }) !== month;
    const label = month !== lastMonth && !crowded ? month : '';
    lastMonth = month;
    return html`<div class="hm-col ${w?.hit ? 'is-hit' : ''} ${start === curStart ? 'is-current' : ''}"
      title="Week of ${fmt(start, { month: 'short', day: 'numeric' })}${w ? ` · ${w.count}/${w.target}` : ''}">
      <span class="hm-month">${label}</span>
      ${Array.from({ length: 7 }, (_, d) => {
        const k = addDays(start, d);
        return html`<span class="hm-cell ${days.has(k) ? 'on' : ''} ${k > today ? 'future' : ''}"></span>`;
      })}
      <span class="hm-mark">${w?.hit ? '♥' : ''}</span>
    </div>`;
  });

  return html`<div class="heatmap">${cols}</div>`;
}

export function HomeView() {
  const s = stats.value;
  const c = s.current;
  const name = state.settings.value.name;
  const copy = statusCopy(c);
  const groupCounts = s.groupsThisWeek;

  return html`<section class="view home" data-key="home">
    <header class="hello">
      <p class="eyebrow">${greeting()}</p>
      <h1 class="display chrome">Hey ${name || 'gorgeous'}</h1>
      <p class="script tagline">${tagline(state.today.value)}</p>
    </header>

    <article class="card hero status-${c.status}">
      <div class="hero-top">
        ${Plate(c)}
        <div class="hero-copy">
          <p class="eyebrow">This week</p>
          <h2 class="display status-title">${copy.title}</h2>
          <p class="script status-script">${copy.script}</p>
          <p class="muted">${copy.sub}</p>
        </div>
      </div>
      ${WeekStrip(s.strip)}
      <div class="cta-row">
        <button class="btn btn-primary" data-action="openNew">Log a sesh</button>
        ${c.trainedToday
          ? html`<span class="done-today">♥ Trained today</span>`
          : html`<button class="btn btn-ghost" data-action="quickLog" title="Log today with no details">✓ I went</button>`}
      </div>
    </article>

    <div class="tiles">
      <div class="tile tile-hot">
        <span class="tile-num">${s.streak}</span>
        <span class="tile-label">Week streak 🔥</span>
      </div>
      <div class="tile">
        <span class="tile-num">${s.best}</span>
        <span class="tile-label">Best streak</span>
      </div>
      <div class="tile">
        <span class="tile-num">${s.hitRate == null ? '—' : html`${s.hitRate}<small>%</small>`}</span>
        <span class="tile-label">Goal hit rate</span>
      </div>
    </div>

    <article class="card">
      <header class="card-head">
        <h3 class="card-title">The last 16 weeks</h3>
        <span class="muted small">${plural(s.totalDays, 'day')} trained, all time</span>
      </header>
      ${Heatmap()}
      <p class="legend"><span class="hm-cell on"></span> trained <span class="legend-heart">♥</span> weekly goal hit</p>
    </article>

    <article class="card">
      <header class="card-head">
        <h3 class="card-title">Hit this week</h3>
        <span class="muted small">${groupCounts.size ? `${groupCounts.size} of ${state.groups.value.length} groups` : 'nothing yet'}</span>
      </header>
      <div class="chip-cloud">
        ${state.groups.value.map((g) => {
          const n = groupCounts.get(g.id);
          return html`<span class="chip ${n ? 'is-on' : ''}">${g.name}${n > 1 ? html` <b>×${n}</b>` : ''}</span>`;
        })}
      </div>
    </article>
  </section>`;
}
