# Validation

## Unreleased

### CEO balance sample

`node tests/ceo-balance.cjs` runs three policies with seeds 1–12. Each plays through year 20 or until dismissal or insolvency. [CEO-BALANCE.json](CEO-BALANCE.json) records each run's phase by year, ending, IPO year, score, and stars.

| Policy | Fired | Folded | Listed by year 12 |
| --- | ---: | ---: | ---: |
| Careful | 0/12 | 3/12 | 4/12 |
| Average | 1/12 | 1/12 | 2/12 |
| Reckless | 5/12 | 5/12 | 3/12 |

The careful policy builds board relationships, develops artists, and keeps a larger cash reserve. The reckless policy sells more equity and prioritizes risky decisions after losing its majority. Phase thresholds, early revenue, and board perk costs were tuned against these runs.

## v1.1.0 — November 17, 2026

170 simulation checks in 14 suites and eight interface harnesses pass (`node run-checks.cjs`). The main harness now checks that there is no menu bar, that every place is on the ground floor, roof and street, the roster, an artist's panel holding only that artist's album form, a room's panel, older screen links opening their new place, and that a panel for a released artist does not open. The locations harness opens a location's panel, finds it preselected in the album form and booked once recording starts.

### Browser check

Chrome at 1366 px and 420 px wide, with real clicks only: signing at the front desk, tapping the artist's sprite, recording at the Barn Loft from the street, every production decision through release, the artist's panel listing the album, a gig, and each place on the lot (front desk, trophy case, office, recording room, + Room, roof sign, billboard, newsstand, tour bus, Out of town, the goal chip). A year-20 save loads and shows its final review in the office, and its export imports. The cash warning still pauses the clock. No console errors. Screens are in `production/qa/evidence/v1.1-*.png`.

## v1.0.0 — November 17, 2026

170 simulation checks in 14 suites and eight interface harnesses pass (`node run-checks.cjs`). New suites cover the 20-year campaign (goals, rewards, scope, the debt grace period, capped score rows, stars, New Game+, 0.9 save migration), locations and gigs, promotion, the live clock, year-end ordering and save size.

### Balance sample

CAMPAIGN-BALANCE.json plays four scripted policies through full 20-year runs, 12 seeds each. Policies let their newest staff member go while in the red.

| Policy | Folded | Median score | Stars (1–5) | Goals met |
| --- | ---: | ---: | --- | ---: |
| One artist, no extras | 2 | 3,580 | 2 / 0 / 5 / 5 / 0 | 122 of 240 |
| One artist, promoted | 0 | 4,880 | 0 / 0 / 0 / 4 / 8 | 219 of 240 |
| Two artists, gigs and locations | 0 | 4,030 | 0 / 0 / 1 / 11 / 0 | 167 of 240 |
| Three artists, promoted | 0 | 4,790 | 0 / 0 / 0 / 7 / 5 | 216 of 240 |

Every yearly goal is met by at least one policy, and none is met before its year starts. Before this tuning every finished run scored 7,000–17,000 and earned five stars, the year-one goal was never met, and a label folded the first week it dropped below $0. Cash still reaches several million dollars by year 10 in the promoted policies; this is listed on the roadmap.

### Browser check

Chrome at 1366 px and 420 px wide: the lot with a running clock, menus, album decisions, a location and a gig, lead singles and ads, a yearly review, the final review and New Game+, a bankrupt run's New label button, and the cash warning card (the clock pauses as "cash warning"; the label folds after four weeks in the red and stays folded after a reload). A year-5 export imports, and a year-20 save loads and reloads. No console errors. Screens are in `production/qa/evidence/`.

## v0.9.1 — November 17, 2026

The interface harness now checks that a save with themed stage results passes the load check (it failed before the fix). In Chrome, a label with a Writers' Room and a themed album in production kept its week, album and facility after a page reload.

## v0.9.0 — November 17, 2026

107 simulation checks and three interface harnesses pass (`node run-checks.cjs`). Twenty-two new checks in `tests/label-test.cjs` cover rank requirements and timing, theme grants, no demotion, chart-peak direction, migration of older saves, theme validation and atomic rejection, hidden-then-revealed combo fit, stage targeting, two-theme scaling, combo levels and the 26-week freshness window, facility rank locks, lot bounds, uniqueness, upkeep, upgrade pricing, stage bonuses, wall-sharing pairings, swaps, shop takings with Fan district, archive residuals, Lounge care for idle artists only, the separate discovery random stream, Writers' Room discovery, Talent Academy effects and rejection of malformed save data. The main interface harness now builds and moves a facility, records a themed album and checks the combo notebook.

The source reorganization and the move of balance tables into `src/data/core.js` were checked against the previous seeded samples: BALANCE.json and TOUR-BALANCE.json came out byte-for-byte identical before any rule changed. TOUR-BALANCE.json is unchanged in 0.9.

### Browser check

After the rename, a save exported with the old name loads and its earlier award results list the label as Goat Records. The page title, header, chart rows and export file name use the new name.


Chrome at 1366 px and 420 px wide: signing, building a Writers' Room and Artist Lounge (pairing lit), choosing a theme and starting an album, rank-up banner, a rank-4 lot with eight facilities and five active pairings, combo notebook, and the phone layout. No console errors. Screens are in `production/qa/evidence/`.

### Balance sample

BALANCE.json now has four seeded one-year policies (30 seeds each). Headquarters policies build one facility at a time with a $20,000 buffer and pick the best known Good-or-better theme, otherwise an untried one.

| Policy | Survived | Releases | Cash | Fame | Final craft | Rank | Themes known |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Local discovery | 30 | 6 | $13,416 | 84 | 78.8 | 1 | 8.1 |
| National headliner | 30 | 6 | $37,329 | 118 | 82.3 | 1 | 6.1 |
| Local + headquarters + themes | 30 | 6 | $11,942 | 107 | 78.9 | 2 | 16 |
| National + headquarters + themes | 30 | 6 | $23,529 | 133 | 85.2 | 2.8 | 14.5 |

Themed albums from the headquarters policy averaged 75.6 quality against 71.5 without. Plain policies now stay at rank 1, which lowers their development ceiling compared with 0.8 (local final craft 80.5 → 78.8, national 86.1 → 82.3). An earlier pass with higher facility costs bankrupted 1 to 3 of 30 local labels. Rank-1 facility costs and upkeep were lowered and the Merch Shop moved to rank 1 before these figures were taken. None of the policies tour or chase awards, so no Breakout wins are expected. Human playtesting is still needed for layout strategies and long careers.

## Earlier versions

### Prototype 0.5 validation — November 14, 2026

62 deterministic simulation checks pass: 17 core, 13 management, 11 rooms/packages/expectations and 21 industry/career/daily-tour checks. Three interface harnesses pass. 

Coverage includes exactly 300 sorted chart places, release-day estimates without fake revenue or rewards, outside-chart releases, milestone idempotence, synchronized rival company listings, eight nonrepeating CEO scenarios, ten career levels, distribution fees and legacy economics, genre/year entry rules, annual ceremony idempotence, year-end continuation, daily and concurrent tours, pending event save queues, seven-day weekly settlement, itinerary and quality changes, event fees and venue commissions, cancellation, partner reservations, recruitment and poaching, negative-cash free choices, lasting royalty promises and legacy rival career initialization.

### Browser verification

The main player save migrated at Year 3 Week 25 with $288,334, fame 294, reputation 100, three artists and six awards preserved. Main-label time was not advanced for testing. The browser keeps an automatic pre-upgrade backup.

A separate localhost test save completed and released a 93-quality album, displayed its provisional #76 debut, entered it in the current-year Sacred category and displayed six rival-company release feeds. A regional rival tour received daily decisions: cutting dates, paid marketing, a quality increase, an encore extension, recovery days and a rival recruitment offer. All seven days remained in one label week until the final decision settled it. Reload preserved pending choices and the annual submission. Screenshots are provided alongside the game package.

### Balance sample and limits

BALANCE.json contains 60 seeded one-year policies with manual annual submissions. Local-discovery labels survived 30/30, earned Breakout 1/30, averaged $48,408 ending cash, 187 fame and craft growth from 58.6 to 79.2. National-headliner labels survived 30/30, earned Breakout 13/30, averaged $99,342 cash, 237.6 fame and craft growth from 80.8 to 87.8. No sampled artist reached 100 craft. These policies do not buy promotion packages or book tours, so they do not establish final tour balance.

The economy remains a tunable prototype. Human playtesting is needed for long-career pacing, repetitive events and dominant strategies. Android, native packaging, aging, rights/recoupment accounting and the optional shadow-organization expansion are not implemented or verified.


### v0.5.1 interface update

All 62 simulation checks and three interface harnesses pass. Browser checks verified active tour and album activity cards, direct navigation to the album decision and active-tour ledger, compact catalog rows with expandable financial/rating details, and collapsed completed-tour history. The main save was reloaded and viewed without advancing time or spending funds; production was exercised on the separate localhost test label. No save migration or rule changes were needed.


### v0.6 inspiration verification

68 simulation checks and three interface harnesses pass. Six additional checks cover atomic rejection below 25, monotonic outcomes across 320 seeded album productions, snapshot/save persistence, release reset, weekly recovery/cap, seven-day touring recovery and legacy-project compatibility. The browser verified 60/100 meters, marked thresholds, tier labels, recording modifiers and distinct touring recovery estimates on the main label without spending or advancing time.

The updated BALANCE.json reports 30/30 survival for both minimum-ready strategies, six releases on average, and no Breakout wins. Local discoveries average $12,308 cash and 92 fame; national headliners average $33,100 and 123 fame. These policies start as soon as the minimum allows and do not wait for stronger inspiration or rotate a second artist. The results show the cost of rushing; they do not establish an optimal strategy. Earlier v0.5 balance figures above describe the previous rules.


### v0.7 tour review — November 15, 2026

78 simulation checks and three interface harnesses pass. Ten tour-specific regressions verify exact forecast accounting, twelve nonrepeating show scenarios, saved event bags, deferred recovery energy, nonrecursive rest prompts, boost expiry by actual shows, final-day choices, clipped itinerary/recovery caps, non-ticket tour receipts, profitability milestones, unchanged legacy cash/time and final-show boost clipping.

TOUR-BALANCE.json contains 640 simulations. With a cautious low-fee/no-extension policy, all 270 typical-profile tours completed and profited within their original 28/56/84 days. Typical solo average net: regional $2,640 (break-even around day 23), national $16,374 (day 40), world $64,486 (day 54). Labelmate and rival lineups also reached break-even before their original end. Lower-demand regional solo tours profited in only 2/30 runs, averaging a small loss, and correctly quoted a baseline loss. Of 100 random-choice national solo tours, 49 completed and 82 were profitable; an early ending can occur after break-even. Reported tour net includes setup, daily operations, venue commissions and event spending, and excludes regular label salaries/album revenue. Demand profiles are fixed controlled inputs; this is not a complete long-career economy validation.

Browser verification reloaded the main label at Year 3 Week 43 with $119,669 and the existing day-15 tour ledger preserved. The obsolete promoter prompt refreshed to an explicit settled-day/future-show prompt without advancing or spending. The active ledger showed an updated remaining-run projection and break-even day. The main pending decision was left unresolved for the player.


### v0.8 multi-day cadence — November 15, 2026

85 simulation checks and three interface harnesses pass. Seven cadence regressions cover the shared three-decision cap with concurrent tours, choice-specific actual review dates, uninterrupted multi-day recovery, daily settlement plus single weekly payroll, saved review/show holds and budget, automatic final-date closure when capped, and fast-forward stopping at album decisions. Existing timing checks now allow quiet days. The road interface harness also exercises choosing a plan and advancing multiple days to its review.

The 640-scenario TOUR-BALANCE.json was regenerated with the reduced decision frequency. All 270 typical tours still profited by their original end; 268 completed and two long solo tours ended early after break-even. Typical solo mean net/break-even day: regional $2,146/day 24, national $15,465/day 41, world $62,800/day 55. Random-choice national solo runs: 76/100 completed, 92/100 profitable. These controlled results do not guarantee player outcomes or include regular label salary costs.

The main browser label was reloaded at Year 3 Week 44, tour day 23, cash $128,567. Its pending promoter choices were preserved and now show different next-review dates (day 25 for two-show promotion versus day 26 for the three-show or steady plan). The advance button changed to Advance to next activity. No choice, time advancement or spending was performed on that label for verification.
