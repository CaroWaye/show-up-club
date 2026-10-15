# Show Up Club 🎀

A gym tracker that cares about **showing up**, not lifting heavier. Set a weekly goal
(e.g. 3 days a week), log your sessions, keep the streak alive.

## Run it

It's an installable web app: everything runs in the browser, and your data is stored on your
phone (SQLite via [sql.js](https://sql.js.org), saved in the browser's IndexedDB). There's no
server-side code and nothing to install on the host.

**On your phone:** run `./deploy` (settings in `.env`) to copy `public/` into a folder of its own on
your web host (e.g. `public_html/show-up-club`; it refuses the site root, and any existing folder it
didn't create). Open that address in Chrome over HTTPS, then ⋮ → **Install app**. It works offline
after the first visit.

**Preview on your computer** (Node 18+, no npm install):

```bash
npm start        # → http://127.0.0.1:3456
npm run dev      # same, restarts on file changes
```

Data lives in whichever browser you use, per site. **Settings → Download backup** saves the whole
database as a `.db` file; **Restore from backup** loads one (also how you move to a new phone).

## What's in it

- **Home** — this week as a weight plate (one segment per goal day), the week's days as hearts,
  week streak / best streak / goal hit rate, a 16-week heatmap, and which muscle groups you hit.
- **Log a sesh** — date, muscle groups, exercises (optional), duration, vibe, notes.
  "✓ I went" logs today in one tap.
- **Diary** — every session grouped by week, with each week's score against its goal.
- **Library** — 12 muscle groups and ~145 calisthenics, weights and cardio exercises. Add your own.
- **Settings** — weekly goal, your name, Monday/Sunday week start, backup & restore.

How weeks count: a week is "hit" when you train on at least *goal* different days. Changing
your goal applies from the current week on; past weeks keep the goal they had.

## How it's built

```
server.js          local preview server (static files only)
deploy             copies public/ to the web host
public/
  sw.js            offline copy of the app (APP_FILES lists every file)
  manifest.webmanifest, icons/   installable-app name and icons
  vendor/          sql.js (SQLite as WebAssembly)
  fonts/           self-hosted Fraunces + DM Sans
  js/
    sqlite.js      sql.js connection + saving the database file to IndexedDB
    backend.js     the "API": routes and validation, answering api.js on-device
    db.js          schema, seeding, queries
    seed.js        built-in muscle groups & exercises
    reactive.js    signals / computed / effect + DOM morphing (~150 lines)
    store.js       app state, derived stats (weeks, streaks), actions
    views/*.js     render functions: state → html``
    app.js         mounts views, routes, delegates events
```

Views are plain functions that return `html\`…\`` strings. `mount()` wraps each one in an
effect, so whenever a signal it reads changes, it re-renders and the DOM is morphed in place
(focus, cursor and scroll position survive).
