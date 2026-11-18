# Campaign

## Overview

A run lasts 20 operating years (weeks 1–1,040). Every year has a goal; meeting it by the year's awards pays a reward. After year 20 the run is scored, graded one to five stars, and the score buys legacy bonuses for a New Game+ run. A label that stays below $0 for more than four weekly settlements folds.

## Player fantasy

"Twenty years to build a legend." Each year has one clear target to chase, a review that shows how the year went, and a final grade that makes the next run worth starting.

## Rules

- Every year has one goal, and play continues whether it was met or missed. The ladder:

| Year | Goal                                                     | Reward   | Year | Goal                      | Reward    |
| ---: | -------------------------------------------------------- | -------- | ---: | ------------------------- | --------- |
|    1 | Reach Indie Imprint                                      | $8,000   |   11 | A #1 album                | +40 fame  |
|    2 | A Top 40 album                                           | 1 theme  |   12 | Win 4 awards in total     | 2 themes  |
|    3 | Breakout Label: 300 fame and 12 releases, cash remaining | $15,000  |   13 | $150,000 on hand          | +40 fame  |
|    4 | Release 10 albums                                        | +20 fame |   14 | Reach Powerhouse          | $60,000   |
|    5 | Win an annual award                                      | $15,000  |   15 | An award this year        | 2 themes  |
|    6 | Reach Rising Label                                       | 1 theme  |   16 | Release 35 albums         | $75,000   |
|    7 | A Top 10 album                                           | $20,000  |   17 | Three #1 albums           | +60 fame  |
|    8 | Two hit albums this year                                 | +30 fame |   18 | Win 8 awards in total     | 2 themes  |
|    9 | Build 6 facilities                                       | 2 themes |   19 | 900 label fame            | $100,000  |
|   10 | Reach Major Contender                                    | $40,000  |   20 | Greatest of All Time rank | +100 fame |

- A theme reward pays $5,000 per theme instead once every theme is known.
- Cash below $0 at a weekly settlement starts a four-week grace period. A warning card pauses the clock; get back above $0 before the fifth settlement or the label folds and the run ends. A run that reaches the end of year 20 while in the red still completes.
- Goals are checked at each year boundary, right after the annual awards. A met goal pays its reward once: cash, label fame, or new album themes. Each year is scored only once.
- Goal types: reach a label rank, an album that peaked at a chart position (or several), awards won, albums released, hit albums, facilities built, label fame, cash on hand. "Total" goals count the whole run; "this year" goals count only that operating year's releases or awards.
- Each year end queues a yearly review: the goal result and reward, the year's numbers (releases, hits, awards, best chart position, fame gained, cash change, rank) and the next goal. Continue dismisses it.
- The current goal shows as a status chip and in the goal line. The Campaign screen lists all 20 years with their goals, rewards and results, the score so far, legacy bonuses in use and earlier runs.
- The run ends once the year-20 awards ceremony is resolved. The final review shows the score breakdown, the star grade and highlights: best album, #1 albums, awards, top rank, peak cash, artists developed (career level 5+) and goals met.
- New Game+ opens when a run reaches the end of year 20, or folds after year one. The player picks legacy bonuses with legacy points; the new run starts at week 1 with a fresh roster and catalog, the run number raised and earlier runs listed.

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

Final score = rank × 100 + awards × 60 (up to 15 awards) + fame × 0.25 (up to 4,000 fame) + #1 albums × 80 (up to 10) + other Top 10 albums × 25 (up to 20) + hit albums × 10 (up to 40) + yearly goals met × 30 + 1 per $1,000 on hand (max 500). Each row stops counting at its cap, so no single source decides the grade. A run that folds loses 25% of that total.

Stars: 1 below 1,200, 2 from 1,200, 3 from 2,400, 4 from 3,600, 5 from 4,800.

Legacy points = floor(final score / 250) + points left unspent from the last New Game+. A strong run earns about 20, so buying every bonus takes two or three runs.

## Edge cases

- Saves from 0.9 that finished year one with cash remaining continue automatically; Continue career saves carry on as before. Neither gets rewards for years already played.
- Earlier years' goals are marked from history where it can tell: rank-up weeks, chart history, release weeks, award results and the cash ledger. Otherwise they show "Not tracked".
- A save already past year 20 plays on to the end of its current year, then ends.
- A save that ended in bankruptcy stays ended. Saves without the new bankrupt flag count a finished run below $0 as folded.
- Theme rewards when every theme is known pay $5,000 per theme instead (`CAMPAIGN.themeFallbackCash`).
- Year three's Breakout Label is read as "Not tracked" for 0.9 saves; only the year-one result was recorded then.

## Tuning knobs

`CAMPAIGN` (years, weeks per year, developed level, theme fallback cash), `DEBT.graceWeeks` in `src/data/core.js`, `CAMPAIGN_GOALS` (type, need, peak, count, scope, reward), `CAMPAIGN_SCORE`, `CAMPAIGN_STARS`, `LEGACY.scorePerPoint` and `LEGACY_BONUSES` in `src/data/campaign.js`.

## Acceptance

Covered by `tests/campaign-test.cjs` (no stop at week 53, goal evaluation and rewards, scope, year-20 end, bankruptcy, score formula, stars, highlights, New Game+ carry-over and limits, 0.9 save migration, save validation, seeded reproducibility) and `tests/campaign-ui-test.cjs` (goal chip, Campaign screen, yearly review, final review, legacy picker, New Game+). Goal difficulty is measured by `tests/campaign-balance.cjs`, which writes `CAMPAIGN-BALANCE.json`.
