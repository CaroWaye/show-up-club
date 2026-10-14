# Show Up Club 🎀

A gym tracker that cares about **showing up**, not lifting heavier. Set a weekly goal
(e.g. 3 days a week), log your sessions, keep the streak alive.

## Run it

Needs Node 22.13+ (uses the built-in `node:sqlite` — no npm install).

```bash
npm start        # → http://127.0.0.1:3456
npm run dev      # same, restarts on file changes
```

Your data lives in `gym.db` (SQLite) in this folder. Override with `DB_PATH=… PORT=…`.

## What's in it

- **Home** — this week as a weight plate (one segment per goal day), the week's days as hearts,
  week streak / best streak / goal hit rate, a 16-week heatmap, and which muscle groups you hit.
- **Log a sesh** — date, muscle groups, exercises (optional), duration, vibe, notes.
  "✓ I went" logs today in one tap.
- **Diary** — every session grouped by week, with each week's score against its goal.
- **Library** — 12 muscle groups and ~145 calisthenics, weights and cardio exercises. Add your own.
- **Settings** — weekly goal, your name, Monday/Sunday week start.

How weeks count: a week is "hit" when you train on at least *goal* different days. Changing
your goal applies from the current week on; past weeks keep the goal they had.

## How it's built

```
server.js          tiny HTTP server + JSON API (binds to 127.0.0.1)
db.js              schema, seeding, queries
seed.js            built-in muscle groups & exercises
public/js/
  reactive.js      signals / computed / effect + DOM morphing (~150 lines)
  store.js         app state, derived stats (weeks, streaks), actions
  views/*.js       render functions: state → html``
  app.js           mounts views, routes, delegates events
```

Views are plain functions that return `html\`…\`` strings. `mount()` wraps each one in an
effect, so whenever a signal it reads changes, it re-renders and the DOM is morphed in place
(focus, cursor and scroll position survive).
