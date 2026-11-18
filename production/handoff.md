# Goat Records handoff

<!-- STATUS -->
Epic: CEO update
Feature: Navigation and decision prompts
Task: Review the cumulative build
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-11-18
**Branch:** `codex/cleaner-game-ui`
**Current task:** The CEO backlog is complete (39/39). This branch includes T26–T38 and the navigation cleanup.
**Next step:** Review the cumulative diff against `main`, then play a CEO run through an album release. Record any issues before merge or release.
**Blocked on:** Owner review for merge and release.
**Files in progress:** None.
**Open questions:** Whether to schedule the later Android wrapper and physical device test.
<!-- /CHECKPOINT -->

## Resume here

1. Check out `codex/cleaner-game-ui` from `origin`. Read [the project rules](../AGENTS.md), [current status](status.md), and [validation](../VALIDATION.md). Run `node tools/next-task.cjs` to check the backlog before starting a new task.
2. Run `node run-checks.cjs` with Node 22 or newer. Open `index.html` directly or serve the repository root with `python -m http.server 8765 --bind 127.0.0.1`.
3. Start a named CEO label, use the Office's **Company** section to reach the Boardroom, take a loan, sign an artist and finish a release. Check the same flow at phone width. **Out of town → Studios** opens recording locations. The Office and artist panels each show one section at a time. The production card shows one decision with an expandable rating breakdown.
4. Before the next push, replace the checkpoint above and update `production/status.md`. Include the tests you ran and the first concrete action for the next session.

This tracked handoff follows the [Game Studios checkpoint format](https://github.com/philosophies/Claude-Code-Game-Studios/blob/main/.claude/docs/templates/session-state.md). If the studio hooks are in use, copy this checkpoint to the local `production/session-state/active.md` so the session-start hook can read it.

## Verification and limits

- The local simulation and interface suites passed. The compact production choices fit without scrolling at 390 × 800 and appeared in one row at 1280 px. The CEO build was played through release at desktop and phone widths.
- Synthetic saves from v0.9.0, v1.0.0 and v1.1.0 converted and played ten weeks each. Conversion can keep a copy of the original through **Export classic backup**. Use an exported copy or a separate browser profile in playtests.
- Chrome reported no installability or manifest errors. Offline reload, nested Back navigation, and launching the extracted ZIP were checked. The [Android guide](../docs/android.md) covers the later wrapper and physical device checks.
- [The balance sample](../CEO-BALANCE.json) is reproducible with `node tests/ceo-balance.cjs`. Across twelve careful runs, zero were fired, three folded, and four reached an IPO by year 12. Five of twelve reckless runs were fired.
- v1.1.0 remains the published version. The owner decides when to merge and release the CEO update.
