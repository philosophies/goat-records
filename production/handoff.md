# Goat Records handoff

<!-- STATUS -->

Epic: CEO update
Feature: Release
Task: v2.0.0 released
<!-- /STATUS -->

<!-- CHECKPOINT -->

**Updated:** 2026-11-21
**Branch:** `main`
**Current task:** T73 · Studio capacity and touring
**Next step:** Limit albums in production by phase, keep older saves' albums, and have the head of Live book tours for artists waiting on the studio
**Blocked on:** Nothing.
**Files in progress:** None.
**Open questions:** The four in production/qa/audit-3.0.md.
<!-- /CHECKPOINT -->

## Resume here

1. Read [the project rules](../AGENTS.md), [current status](status.md) and [validation](../VALIDATION.md). Run `node tools/next-task.cjs` to see the backlog.
2. Run `node run-checks.cjs` with Node 22 or newer. Open `index.html` directly, or serve the repository root with `python -m http.server 8765 --bind 127.0.0.1`.
3. To play the CEO mode: press **New label**, keep CEO and name the label. Take the bank loan from the boardroom (the phase chip in the top bar, the front desk's "Short by" note, or the phone's Wallet), sign a local artist on a one-album deal and record from their panel.
4. Before the next push, update this checkpoint and `production/status.md` with the tests you ran and the first action for the next session.

## Open items

- Balance: in the twelve-seed sample no careful or average run folds and 7 of 12 reckless runs are fired; delegated touring ends 25% below hand play ([CEO-BALANCE.json](../CEO-BALANCE.json), [audit](qa/audit-3.0.md)).
- Android: the wrapper is in `android-app/`; building it and a test on a real device remain ([Android guide](../docs/android.md)).

## Verification

- All simulation and interface suites pass.
- A new CEO label was played in Chrome at 1366 × 900 and 390 × 800: bank loan, a one-album signing, all five production stages, release, and six weeks after it, with no console errors. A funded phase-3 company was simulated for 60 weeks and every panel opened without errors.
- Saves from v0.9.0, v1.0.0 and v1.1.0 convert and play ten weeks each. Chrome reports no installability errors, and the game reloads offline.
