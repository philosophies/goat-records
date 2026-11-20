# Project workflow

Goat Records is a record label management game in plain browser JavaScript. Open `index.html` directly, or serve it over HTTP or HTTPS to install the web app. Version 2.0 (the CEO update) is released.

## Rules

- Do one task from `production/backlog.md` per session. `node tools/next-task.cjs` prints the next one.
- Work on a branch named after the task (`t12-board-review`). Never commit to `main`, never create or move tags.
- Run `node run-checks.cjs` before every commit. Every suite must pass. Never delete, skip or weaken a test to make it pass; fix the code.
- 2.0 code runs only in CEO runs (`s.company` exists). Classic runs must keep playing exactly as 1.1.
- Gameplay numbers live in `src/data/*.js` tables, never inline. New systems follow `docs/architecture.md` (data file, system with `create(core, D)`, name in `SYSTEM_NAMES`, scripts in `index.html` in order).
- Keep save compatibility. New state goes under `s.company`; `validSave` hooks accept saves without it. Describe material migration changes.
- Use themes from music-business drama, Empire TV Tycoon, Game Dev Tycoon and Kairosoft games as inspiration only. No names, characters, logos, songs or art from them.
- Do not add a `## vX.Y.Z` heading to CHANGELOG.md; the owner decides releases. Pushing such a heading to main tags the version and publishes a release with the game ZIP. Never overwrite an existing version tag.
- Keep README, design documents, commit messages and release notes focused on game behavior, changes and validation. Keep development tooling and authorship commentary out of project notes, READMEs and release descriptions. Do not add coauthor trailers.
- Do not commit player saves, credentials, browser storage or local scratch files. When interacting with Cloudflare, use the cf CLI unless this project has a Wrangler configuration file.

## Each session

1. Read [the handoff](production/handoff.md), `production/status.md`, and the task. Read the relevant design sections in `design/gdd/ceo-2.0.md`.
2. Make the change and the tests the task lists.
3. `node run-checks.cjs` until it passes.
4. Mark the task `[x]` in `production/backlog.md` (`[~]` if unfinished, with a note). Add a row to the log in `production/status.md`: date, task, what changed, what is left, questions for the owner.
5. Before pushing, update `production/handoff.md` with the current branch, next action, verification, and any blockers. Replace the checkpoint and keep it short.
6. Commit with a Conventional Commit message ending in the task id when one exists, e.g. `feat: board review sets the yearly budget (T20)`, then push the branch.

## Map of the code

| Path                        | What it holds                                                  |
| --------------------------- | -------------------------------------------------------------- |
| `src/data/*.js`             | Balance tables, one file per system                            |
| `src/engine.js`             | Core simulation: artists, albums, charts, tours, events, saves |
| `src/systems/*.js`          | Feature systems plugged into the engine's hooks                |
| `src/ui/*.js`, `src/app.js` | Interface: the lot, places, panels, clock                      |
| `styles/*.css`              | Styles, one file per area                                      |
| `tests/*-test.cjs`          | Simulation suites; `*-ui-test.cjs` interface harnesses         |
| `docs/architecture.md`      | Hooks and interface plug-in points                             |
| `docs/rules.md`             | Player-facing rules with every number                          |
| `design/gdd/`               | Design notes; `ceo-2.0.md` is the 2.0 plan                     |
