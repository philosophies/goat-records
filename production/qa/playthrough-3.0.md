# 3.0 playthrough

Date: 2026-11-22. One CEO run (seed 1, the balance report's careful player) was played for twenty years. Its state was saved at every year boundary. Each of the 21 saves was then loaded in Chrome at 1280 × 860, and every fifth at 390 × 844. In each one every place and section opened (desk, trophy case with the Vault and Hall of fame, office with Delegation, billboard with Rivals and the Market, newsstand, tour bus, label sign, boardroom, company, phone), and six weeks were played through the interface, answering cards and finishing albums. The last save was played through the final review.

## Results

| Check                                | Result                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Saves loading in the browser         | All 21, after two fixes (below). Before them, every save from year 7 on was refused on reload and replaced by a new label. |
| Places and sections                  | Every one opened with content at every year, on desktop and phone.                                                         |
| Weeks played                         | Six a year, through the final review (6,650 points, five stars).                                                           |
| Console errors                       | None.                                                                                                                      |
| A week's settlement, late in the run | 3–6 ms in the browser; 2 ms in Node at year 20.                                                                            |
| Drawing the screen                   | About 3 ms at years 2, 10 and 20; 850 page elements.                                                                       |
| Save size                            | 0.40 MB at year 2, 0.75 MB at year 10, 1.21 MB at year 20; writing it takes 24 ms.                                         |

## Fixed

- **Saves with a level 11+ artist's album would not load.** The page's production check still capped career levels at 10, but CEO careers run to 30 since T49. A save with such an album was refused on the next visit and a new label replaced it (the old save was kept as a rejected copy). The check now allows level 30 in CEO runs and still 10 in classic ones.
- **Saves of public companies would not load once era multipliers applied.** Company revenue lines scaled by the music era had fractions of a dollar, which the analyst's record then refused. Revenue is now in whole dollars, and older saves with a fraction there still load.

## For the audit (T70)

- By year 10 the careful label's reputation had fallen to 20 and it kept two artists out of ten slots for the rest of the run: below 30 reputation a label with artists cannot sign anyone.
- The twelve-seed delegation comparison moved from −3% to −12% after T65 while the 36-seed one stayed at −3%; the sample is noisy.

## Evidence

`production/qa/evidence/t68-*.png`: the street in years 1 and 21, the company panel in year 10, the phone in years 5, 13 and 21, and the final review.

The performance budget is checked by `tests/performance-test.cjs` (a late phase-6 week under 60 ms, the save under 2.5 MB).
