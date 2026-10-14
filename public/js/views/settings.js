import { html } from '../reactive.js';
import { state, currentGoal } from '../store.js';

export function SettingsView() {
  const { name, weekStart } = state.settings.value;
  const goal = currentGoal.value;

  return html`<section class="view" data-key="settings">
    <header class="page-head">
      <h1 class="display chrome">Your rules</h1>
      <p class="script tagline">set it & show up</p>
    </header>

    <article class="card goal-card">
      <p class="eyebrow">Weekly goal</p>
      <div class="stepper">
        <button class="stepper-btn" data-action="goalStep" data-step="-1" aria-label="Fewer days"
          ${goal <= 1 ? 'disabled' : ''}>−</button>
        <div class="stepper-val">
          <span class="stepper-num">${goal}</span>
          <span class="stepper-unit">day${goal === 1 ? '' : 's'} a week</span>
        </div>
        <button class="stepper-btn" data-action="goalStep" data-step="1" aria-label="More days"
          ${goal >= 7 ? 'disabled' : ''}>+</button>
      </div>
      <p class="muted small">
        Pick a number you can hit on a <i>bad</i> week. Changes count from this week on — past weeks keep the goal
        they had, so your streak history stays honest.
      </p>
    </article>

    <article class="card">
      <label class="field">
        <span class="label">What should we call you?</span>
        <input class="input" data-change="saveName" value="${name}" maxlength="40" placeholder="Gorgeous"
          autocomplete="off">
      </label>
    </article>

    <article class="card">
      <span class="label">My week starts on</span>
      <div class="seg">
        <button class="seg-btn ${weekStart === 1 ? 'is-on' : ''}" aria-pressed="${weekStart === 1}"
          data-action="weekStart" data-value="1">Monday</button>
        <button class="seg-btn ${weekStart === 0 ? 'is-on' : ''}" aria-pressed="${weekStart === 0}"
          data-action="weekStart" data-value="0">Sunday</button>
      </div>
    </article>

    <article class="card about">
      <p class="script about-script">no ego lifting</p>
      <p class="muted small">
        Show Up Club counts the days you show up, not how much you lift. All your data lives in
        <code>gym.db</code>, a SQLite file next to the app. No accounts, no cloud.
      </p>
    </article>
  </section>`;
}
