# Goat Records handoff

<!-- STATUS -->

Epic: CEO update
Feature: Release
Task: v2.0.0 released
<!-- /STATUS -->

<!-- CHECKPOINT -->

**Updated:** 2026-11-26
**Branch:** `main`
**Current task:** main (T85 merged)
**Next step:** Owner review of T85. Backlog has no open tasks; propose new ones from design/gdd/ceo-3.0.md and the handoff before adding them.
**Blocked on:** Nothing.
**Files in progress:** None.
**Open questions:** Whether platform stakes should skip the board budget; whether two or three stars lost to stories in a 20-year run feels right.
<!-- /CHECKPOINT -->

## Resume here

1. Read [the project rules](../AGENTS.md), [current status](status.md) and [validation](../VALIDATION.md). Run `node tools/next-task.cjs` to see the backlog.
2. Run `node run-checks.cjs` with Node 22 or newer. Open `index.html` directly, or serve the repository root with `python -m http.server 8765 --bind 127.0.0.1`.
3. To play the CEO mode: press **New label**, keep CEO and name the label. Sign a local artist and record from their panel: with the starter checklist on, the first signing and the first album's base budget are free, so no loan is needed.
4. Before the next push, update this checkpoint and `production/status.md` with the tests you ran and the first action for the next session.

## Open items

- Balance (twelve seeds, after T81–T84): careful players never fold and all list by year 12; one average run folds and 5 of 12 reckless runs are fired; hand players win about 70% of chart battles; the delegated label ends 4% above hand play; careful players lose 1–2 stars to stories a run and take about $8M from tours ([CEO-BALANCE.json](../CEO-BALANCE.json), [audit](qa/audit-3.0.md)).
- Android: the wrapper is in `android-app/`; building it and a test on a real device remain ([Android guide](../docs/android.md)).

## Verification

- All simulation and interface suites pass.
- A new CEO label was played in Chrome at 1366 × 900 and 390 × 800: bank loan, a one-album signing, all five production stages, release, and six weeks after it, with no console errors. A funded phase-3 company was simulated for 60 weeks and every panel opened without errors.
- Saves from v0.9.0, v1.0.0 and v1.1.0 convert and play ten weeks each. Chrome reports no installability errors, and the game reloads offline.
