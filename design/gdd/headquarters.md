# Headquarters

## Overview

A tile lot where the label builds facilities. Each facility fills one tile, can be upgraded to level 3, and may pair with a neighbor for an extra bonus. The lot grows with label rank.

## Player fantasy

Watching a cramped bedroom setup turn into a building full of busy rooms, and working out the layout that makes everything click.

## Rules

- One of each facility. Build requires the facility's rank, a free tile inside the lot and the build cost.
- Upgrade cost = build cost × current level. Upkeep = base upkeep × level, paid weekly with overhead.
- Move costs $500; moving onto a built tile swaps the two. Closing refunds nothing.
- Pairings need the two facilities to share a wall (not diagonal). Each pairing applies once.
- Recording artists appear in the Vocal Booth, Mix Suite or Writers' Room; idle artists in the Lounge, Rehearsal Hall or Listening Bar; touring artists are away.

## Formulas

- Stage bonus = Σ facility stage value × level + active pairing values, added when a stage decision is made.
- Shop takings = round((Σ (base + min(fame, 400) × rate) × level) × (1 + Fan district bonus)). Fame past 400 no longer raises takings.
- Archive residual = 0.5 × level × Σ quality of the best 30 albums whose earning run has ended.
- Idle artist care each week: morale and inspiration + Lounge × level; energy + Rehearsal × level.
- Development: ceiling + 3 × Academy level; fee × (1 − discounts), discounts capped at 60%.

## Edge cases

- Lot tiles outside the current rank are shown locked.
- Older saves start with an empty lot.
- Imported saves with duplicate facilities, unknown ids or levels outside 1–3 are rejected.

## Tuning knobs

`FACILITIES` costs, upkeep, ranks and effects; `SYNERGIES`; `HQ.maxLevel`; `HQ.moveCost`; `RANKS[].lot`.

## Acceptance

Covered by `tests/label-test.cjs` and `tests/ui-test.cjs`: rank locks, bounds, occupied tiles, uniqueness, upkeep, upgrade pricing, stage bonuses, adjacency, swaps, takings, residuals, artist care, academy effects, and building and moving through the interface. Screens are in `production/qa/evidence/`.
