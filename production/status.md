# Status

Updated at the end of every session. Newest entry first; keep the last ten.

## Now

- Released: v1.1.0 (no menus; people and places on the lot).
- Next: T39 (name the company) in `production/backlog.md`.
- Owner decisions (2026-11-18): being fired is game over for now; the board exists only after outside money; the player names and can rename the company (new task T39); a web app now, built for a later Play Store release (T38). Recorded in the design's Decisions table.

## Log

| Date       | Task      | What changed                                                                                                                                                                                                                             | Left / questions                                          |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2026-11-18 | T04       | Phase chip in the top bar; Company panel (goals with progress, phase ladder) shown alone and at the top of the office in CEO runs; `styles/ceo.css`; harness `tests/company-ui-test.cjs`                                                 | Visual check in Chrome still to do (T09 covers the theme) |
| 2026-11-18 | T03       | Scouting capped by phase reach (`REACH_SCOUTING`): budget, craft and potential limits, `reach` tag on prospects; locked paid searches name the phase that opens them; classic prospects verified identical to 1.1 over 30 seeds; 5 tests | None                                                      |
| 2026-11-18 | T02       | `phaseProgress`, `yearRevenue`, weekly advancement one phase at a time, phase notification card, `boardApproved` stub; 7 tests                                                                                                           | News line says Goat Records until T39 adds the label name |
| 2026-11-18 | Decisions | Owner answers written into the design; T39 added; T20, T34, T38 updated                                                                                                                                                                  | None                                                      |
| 2026-11-18 | T01       | `company` data and system; `G.create(seed, { ceo: true })` starts a CEO run in phase 1 with $2,000; `companyPhase`, `PHASES`, `REACHES` on the API; 6 tests in `tests/company-test.cjs`                                                  | Phase goal numbers are first guesses; T35 tunes them      |
| 2026-11-18 | Planning  | 2.0 design (`design/gdd/ceo-2.0.md`), backlog T01–T38, this file, `tools/next-task.cjs`                                                                                                                                                  | Owner to review the design and answer its open questions  |
