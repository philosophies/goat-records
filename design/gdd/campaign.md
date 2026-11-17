# Campaign

## Overview

A run lasts 20 operating years (weeks 1–1,040). Every year has a goal; meeting it by the year's awards pays a reward. After year 20 the run is scored, graded one to five stars, and the score buys legacy bonuses for a New Game+ run. Running out of cash still ends a run at once.

## Player fantasy

"Twenty years to build a legend." Each year has one clear target to chase, a review that shows how the year went, and a final grade that makes the next run worth starting.

## Rules

- Year one's Breakout Label target (180 fame, one award, six releases, cash remaining) is the first yearly goal. Play continues into year two whether it was met or missed.
- Goals are checked at each year boundary, right after the annual awards. A met goal pays its reward once: cash, label fame, or new album themes. Each year is scored only once.
- Goal types: reach a label rank, an album that peaked at a chart position (or several), awards won, albums released, hit albums, facilities built, label fame, cash on hand. "Total" goals count the whole run; "this year" goals count only that operating year's releases or awards.
- Each year end queues a yearly review: the goal result and reward, the year's numbers (releases, hits, awards, best chart position, fame gained, cash change, rank) and the next goal. Continue dismisses it.
- The current goal shows as a status chip and in the goal line. The Campaign screen lists all 20 years with their goals, rewards and results, the score so far, legacy bonuses in use and earlier runs.
- The run ends once the year-20 awards ceremony is resolved. The final review shows the score breakdown, the star grade and highlights: best album, #1 albums, awards, top rank, peak cash, artists developed (career level 5+) and goals met.
- New Game+ opens when a run reaches the end of year 20, or runs out of cash after year one. The player picks legacy bonuses with legacy points; the new run starts at week 1 with a fresh roster and catalog, the run number raised and earlier runs listed.

| Bonus            | Points | Effect                                                  |
| ---------------- | -----: | ------------------------------------------------------- |
| Seed money       |      3 | +$15,000 starting cash                                  |
| Trust fund       |      7 | +$40,000 starting cash                                  |
| Theme library    |      5 | Keep every theme discovered                             |
| Combo notebook   |      4 | Keep each recorded combo's fit; combo levels start over |
| Founding room    |      4 | Writers' Room already built                             |
| Second studio    |      4 | Neon Vault already built                                |
| Indie start      |      8 | Start at Indie Imprint                                  |
| Scouting network |      3 | A free National talent search at the start              |
| Veteran team     |      6 | Keep the last run's staff with no hiring fees           |

## Formulas

Final score = rank × 100 + awards × 60 + fame × 0.5 + #1 albums × 80 + other Top 10 albums × 25 + hit albums × 10 + yearly goals met × 30 + 1 per $1,000 on hand (max 500). A run that ends out of cash loses 25% of that total.

Stars: 1 below 800, 2 from 800, 3 from 1,600, 4 from 2,600, 5 from 3,600.

Legacy points = floor(final score / 100) + points left unspent from the last New Game+.

## Edge cases

- Saves from 0.9 that finished year one with cash remaining continue automatically; Continue career saves carry on as before. Neither gets rewards for years already played.
- Earlier years' goals are marked from history where it can tell: the year-one result message, rank-up weeks, chart history, release weeks, award results and the cash ledger. Otherwise they show "Not tracked".
- A save already past year 20 plays on to the end of its current year, then ends.
- A save that ended in bankruptcy stays ended.
- Theme rewards when every theme is known pay nothing extra.

## Tuning knobs

`CAMPAIGN` (years, weeks per year, developed level), `CAMPAIGN_GOALS` (type, need, peak, count, scope, reward), `CAMPAIGN_SCORE`, `CAMPAIGN_STARS`, `LEGACY.scorePerPoint` and `LEGACY_BONUSES` in `src/data/campaign.js`.

## Acceptance

Covered by `tests/campaign-test.cjs` (no stop at week 53, goal evaluation and rewards, scope, year-20 end, bankruptcy, score formula, stars, highlights, New Game+ carry-over and limits, 0.9 save migration, save validation, seeded reproducibility) and `tests/campaign-ui-test.cjs` (goal chip, Campaign screen, yearly review, final review, legacy picker, New Game+). Goal difficulty across 20 years still needs playtesting.
