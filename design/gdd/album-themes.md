# Album themes and combos

## Overview

Every album pairs its genre with one theme (two from Rising Label). Each genre + theme combo has a fixed fit that the player discovers by recording it. Good combos are worth repeating, but repeating them too often tires the audience.

## Player fantasy

"I found the sound." The player experiments, keeps notes, and gets the satisfaction of a Country × Heartbreak record that everyone saw coming except the rivals.

## Rules

- 24 themes; six starter themes are known. The rest are found through development sessions (20%), completed tours (guaranteed), the Writers' Room (10% per level weekly, +5% with Deep crates) and rank-ups (2, or 3 at Label Empire).
- Fit is Poor, Fair, Good or Great per genre, defined in `src/data/label.js`.
- A combo's fit is hidden until it is recorded once. The combo notebook then shows it.
- Combo level = 1 + earlier releases of that exact combo, maximum 5.
- Albums with no theme record normally with no theme rows.

## Formulas

- Fit points: Poor −5, Fair 0, Good +4, Great +7. Two themes: round(0.75 × sum).
- Identity and Songwriting stages: + fit points. Fan response at launch: + fit points.
- Every stage: + (combo level − 1).
- Reach stage: − min(8, 4 × releases of the same combo in the 26 weeks before recording).

## Edge cases

- Discovery uses a separate random stream, so existing seeded outcomes do not shift.
- When every theme is known, discovery does nothing.
- Imported saves with unknown theme names are rejected.

## Tuning knobs

`FIT.points`, `FIT.pairScale`, `FIT.maxLevel`, `FIT.freshnessWindow`, `FIT.freshnessPenalty`, `FIT.freshnessCap`, `FIT.trainingDiscovery`, and the per-theme fit rows.

## Acceptance

Covered by `tests/label-test.cjs`: theme validation, hidden-then-revealed fit, stage targeting, pair scaling, level growth, freshness window, discovery stream and save validation.
