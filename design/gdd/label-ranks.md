# Label ranks

## Overview

Six ranks replace fame-only tiers. Each rank lists its goals in advance; meeting all of them promotes the label at the next weekly settlement.

## Player fantasy

A clear ladder with visible rungs: "two more releases and a Top 40 hit and we're a Rising Label."

## Rules

- Goals can include label fame, albums released, facilities built, best chart peak (lower is better), awards won and cash on hand.
- Promotion is checked every weekly settlement and can skip several ranks if everything is already met. A rank is never lost.
- Each rank sets roster slots, lot size, themes per album and a tier (1–4) used for room unlocks, the stage bonus and the development ceiling.
- Rank-ups grant new themes and show a banner listing what unlocked.

## Formulas

See the table in docs/rules.md or `RANKS` in `src/data/label.js`. Tier by rank: 1, 2, 3, 4, 4, 4.

## Edge cases

- Saves from 0.8 or earlier start at the rank their fame had earned (30 / 90 / 200 fame for ranks 2 / 3 / 4), so no one loses roster slots.
- Before 0.9, fame alone unlocked rooms and roster slots. Labels that skip headquarters now stay at rank 1.

## Tuning knobs

`RANKS[].req`, `slots`, `lot`, `themeSlots`, `grantThemes`, `tier`.

## Acceptance

Covered by `tests/label-test.cjs` (requirements, timing, theme grants, no demotion, chart peak direction, migration) and `tests/test.cjs` (roster capacity).
