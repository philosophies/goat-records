# Promotion

## Overview

Three ways to push records: hot streaks that reward success, a lead single before an album comes out, and paid ad campaigns for albums still selling. A Promotion screen shows who is on fire, why, and what every ad costs.

## Player fantasy

Riding a hot streak: a hit lands, the artist glows, the next record comes out stronger, and a well-timed billboard turns a good run into a big one.

## Rules

- **Hot streaks.** An artist catches fire after a hit release (quality 75+), a Top 10 chart week or an award win. Each album can trigger Top 10 heat once; each award counts once.
- A trigger adds its levels (max 3) and resets the timer to at least its weeks (max 12). A shorter trigger never cuts the timer. The timer counts down at every weekly settlement, except in the week the heat was added. At zero the streak ends.
- While on fire, every production stage the artist records shows an "On fire · N weeks left" row, and all their albums still in an earning run sell more.
- **Lead single.** Once Recording is done (three of five stages), an album in production can release one lead single. Not before Recording, not twice, not after the album is out. It costs by budget tier and raises the artist's fans and attention at once. At launch it adds a row to Fan response and Market impact (Critics ignore it) and boosts sales for the first three earning weeks.
- A single's reception (Quiet −2, Steady 0, Strong +2, Breakout +4) is drawn when it is released and added to both launch rows.
- **Ads.** A released album still in its earning run can run one ad at a time. Types unlock by label rank. The cost is paid at once, any fan, attention or reputation effect applies at once, and the sales boost starts with the next weekly settlement. An ad is clipped to the earning weeks left.
- All promotion actions are refused during an industry event or after the season ends.

| Ad              | Rank | Base cost | Sales | Weeks | Also                                         |
| --------------- | ---: | --------: | ----: | ----: | -------------------------------------------- |
| Street posters  |    1 |      $450 | ×1.10 |     4 | —                                            |
| Radio spot      |    2 |      $900 | ×1.15 |     4 | attention +6                                 |
| Playlist push   |    3 |    $3,000 | ×1.22 |     5 | fans +4                                      |
| Billboard       |    4 |    $5,500 | ×1.30 |     5 | label reputation +1                          |
| TV spot         |    5 |   $13,000 | ×1.40 |     6 | fans +8, attention +8                        |
| Global campaign |    6 |   $22,000 | ×1.50 |     8 | fans +15, attention +10, label reputation +2 |

| Single tier | Album budget |   Cost | Fans | Attention | Fan response | Market impact |
| ----------- | -----------: | -----: | ---: | --------: | -----------: | ------------: |
| Lean        |       $4,000 | $1,000 |   +4 |       +10 |           +3 |            +4 |
| Standard    |       $8,000 | $1,800 |   +6 |       +14 |           +4 |            +5 |
| Premium     |      $12,000 | $2,600 |   +9 |       +18 |           +5 |            +6 |

## Formulas

- Heat triggers: hit +1 level for 6 weeks; Top 10 week +1 level for 4 weeks; award +2 levels for 8 weeks.
- Stage bonus = heat level (up to +3).
- Heat sales = 1 + 0.06 × heat level (up to ×1.18).
- Single sales = ×1.15 while the album's earning age is below 3.
- Ad cost = base × (1 + label fame ÷ 1,000), rounded to $50.
- Promotion multiplier = min(1.6, heat × single × ad). It multiplies with the engine's own sales factors and campaign event boosts.

## Edge cases

- Heat belongs to the artist. A released artist loses it; albums by artists no longer on the roster get no heat.
- An album released with heat gets the boost from its first sales week.
- A single released during the Recording review still counts as after Recording.
- Older saves load with no heat, ads or singles. Albums already released or in production keep their ratings; they can still get a single or an ad if the timing allows.
- Imported saves with heat outside 0–3 levels or 0–12 weeks, unknown trigger kinds, unknown ad types, ad multipliers outside 1–1.6, or singles filed under the wrong album are rejected.

## Tuning knobs

`HEAT` (triggers, hit quality, Top rank, caps, per-level stage and sales values), `SINGLE` (stage needed, tiers, reception odds, launch boost and weeks), `ADS`, `AD_RULES.fameScale`, `PROMOTION_CAP`. All in `src/data/promotion.js`.

## Balance notes

Scripted samples (16 seeds per profile, ad bought in the second earning week; "average" and "strong" are typical albums for that rank):

- Each ad type loses money on an average album at the rank that unlocks it and pays back on a strong seller: Street posters −$35 / +$125 at rank 1, Radio spot −$145 / +$198 at rank 2, Playlist push −$493 / +$784 at rank 3, Billboard −$2,013 / +$777 at rank 4, TV spot −$7,124 / +$1,190 at rank 5, Global campaign −$11,086 / +$7,777 at rank 6. Cheaper ads become safe buys for average albums a rank or two later.
- Lead singles roughly break even at ranks 1–2 (−$247 to +$121) and return $600–$9,500 from rank 3 on, plus the fans they leave behind.
- A two-artist label at rank 4 releasing a hit every album kept an artist on fire 47% of artist-weeks: level 1 for 37%, level 2 for 10%, level 3 never without an award. With a Playlist push and a single the cap did not bind; it binds once level 2–3 heat meets a TV spot or Global campaign.
- In the year-one policy samples, heat alone (no singles or ads) raises average year-end cash by up to 18% and label fame by up to 3 points, most for labels that sign a headliner.

## Acceptance

Covered by `tests/promotion-test.cjs` and `tests/promotion-ui-test.cjs`: each heat trigger, fading, caps, the stage row, sales multipliers, single timing and launch effects, ad rank locks, one ad per album, expiry, the promotion cap, refusals during events, older saves, rejected saves and the unchanged core random seed; plus the Promotion screen, the single row, the catalog ad row, the status chip and the artist badge. Screens are in `production/qa/evidence/`.
