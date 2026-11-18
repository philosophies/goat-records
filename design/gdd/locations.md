# Recording locations and paid gigs

## Overview

Ten rented places where an album can be recorded on top of the label's own room, and paid gigs that let an idle artist earn cash between albums. Locations level up with every release there (to level 9) and each hides a signature album theme. Gigs unlock by label rank.

## Player fantasy

Taking a country singer out to the barn, a choir into a stone chapel, a rapper up to the rooftop, and coming back with a better record and a new idea. Between albums, keeping the lights on with bar sets and weddings until the label is big enough for festival stages.

## Rules

### Locations

- An album may pick one location, or none. A location needs its label rank and hosts one album in production at a time.
- Rent is paid with the album budget when recording starts. It counts toward the album's total investment.
- A location adds its stage boosts to the stages it lists and its genre affinity to every stage. Bonuses lock at the level the location had when recording started.
- Each release there adds 1 experience, 2 for a hit (quality 75+). Levels raise the stage boosts and the rent.
- The first album recorded at a location reveals its signature theme and adds it to the label's themes if it is new. Later albums never add it again. The theme cannot be used on the album that found it.
- Each location records albums started, releases, experience, level and best quality.

| Location         | Rank |   Rent | Stage boosts                | Great         | Good                       | Poor    | Signature     |
| ---------------- | ---: | -----: | --------------------------- | ------------- | -------------------------- | ------- | ------------- |
| Barn Loft        |    1 |   $600 | Identity +2, Songwriting +1 | Country       | Rock, Sacred               | Rap     | Working Class |
| Old Chapel       |    1 |   $800 | Performance +2, Sound +1    | Sacred        | R&B, Country               | Rap     | Healing       |
| Rooftop Loft     |    2 | $1,200 | Songwriting +2, Reach +1    | Rap           | R&B, Pop                   | Country | City Lights   |
| Beach House      |    2 | $1,400 | Identity +2, Performance +1 | Pop           | R&B, Rock                  | Sacred  | First Love    |
| Lake Cabin       |    2 | $1,000 | Songwriting +3              | —             | Country, Rock, Sacred, R&B | —       | Nostalgia     |
| Warehouse Floor  |    3 | $1,800 | Performance +3, Sound +1    | Rock          | Rap                        | Pop     | Rebellion     |
| Desert Ranch     |    3 | $2,000 | Identity +2, Performance +2 | Country, Rock | —                          | R&B     | Road Trip     |
| Concert Hall     |    4 | $3,200 | Performance +3, Sound +3    | Sacred, R&B   | Pop                        | Rap     | Legacy        |
| Hillside Mansion |    4 | $3,500 | Songwriting +2, Reach +3    | Rap, Pop      | R&B                        | Country | Money         |
| Island Studio    |    5 | $6,000 | Every stage +2              | Pop, R&B      | Rap, Rock                  | —       | Party         |

### Gigs

- An artist under contract who is not recording or touring can play one gig, then waits out that gig's cooldown before the next. Gigs are refused during an industry event.
- A gig costs energy, pays cash at once, changes morale within its range and may add fans, artist fame and career XP. It has a small chance to find a new album theme.

| Gig               | Rank | Energy | Cooldown |         Fans |  XP | Morale   | Theme chance |
| ----------------- | ---: | -----: | -------: | -----------: | --: | -------- | -----------: |
| Bar set           |    1 |     15 |  2 weeks |           +1 |   — | −2 to +3 |           3% |
| Wedding           |    1 |     20 |  3 weeks |            — |   — | −4 to +2 |           5% |
| College tour stop |    2 |     25 |  3 weeks |           +1 |  +1 | 0 to +4  |           8% |
| Festival slot     |    3 |     35 |  5 weeks | +2 (fame +1) |  +1 | +1 to +6 |          12% |
| Corporate show    |    4 |     25 |  4 weeks |            — |   — | −6 to −1 |           2% |

## Formulas

- Affinity points per stage: Great +4, Good +2, Fair 0, Poor −3.
- Stage boost = listed value + level bonus + (location rank − 1). Level bonus by level 1–9: 0, 1, 1, 2, 2, 3, 3, 4, 5. The rank term lets a new, better location start ahead of a fully leveled early one.
- Experience for levels 2–9: 2, 4, 7, 10, 14, 19, 25, 32.
- Rent = base rent × (1 + 0.05 × (level − 1)), rounded to $50.
- Gig pay = (base + min(fans, venue cap) × per fan + artist fame × per fame + craft × per craft) × (1 − spread + 2 × spread × roll), rounded to $10.

| Gig               |   Base | Per fan | Venue cap | Per fame | Per craft | Spread |
| ----------------- | -----: | ------: | --------: | -------: | --------: | -----: |
| Bar set           |   $150 |      $3 |       120 |       $4 |        $2 |   ±15% |
| Wedding           |   $400 |       — |         — |       $4 |        $4 |   ±10% |
| College tour stop |   $300 |      $5 |       250 |       $6 |        $3 |   ±20% |
| Festival slot     |   $500 |      $5 |       400 |       $8 |        $5 |   ±25% |
| Corporate show    | $1,500 |       — |         — |      $15 |       $10 |   ±10% |

## Edge cases

- Albums without a location record exactly as before, with no location rows.
- A rank-locked, booked or unknown location rejects the plan before anything is paid.
- A signature theme already known before the first visit is not added again; the location still counts as visited and shows its theme.
- Gig rolls use their own random streams, so playing gigs never changes other seeded outcomes.
- Older saves load with no location stats and no gig history.
- Imported saves with unknown locations, levels outside 1–9, negative counts or malformed gig records are rejected.

## Tuning knobs

`LOCATIONS` (rank, rent, genres, stages, theme), `LOCATION_AFFINITY.points`, `LOCATION_LEVELS` (xp, stageBonus, releaseXp, hitXp, rentStep, rankBonus), and every field in `GIGS`.

## Balance sample

Thirty seeds per policy, one artist, headquarters and themes on. Renting the best-matching location when affordable raised average quality by about 3 points and added about one hit a year for $3,300–4,800 of rent; cash at year end was unchanged to slightly higher. Always renting the cheapest location regardless of genre was roughly break-even. Playing a gig whenever an artist was idle added about 7 gigs and $6,700 (local discovery) to $9,700 (national headliner) a year, about 10% of album income.

## Acceptance

Covered by `tests/locations-test.cjs` and `tests/locations-ui-test.cjs`: rank locks, booking, rent, stage and affinity rows, levels, signature themes, untouched state on rejected plans, gig pay bounds, cooldown, energy, refusals, separate random streams, older saves and save validation; the Locations screen, album location field and gig button on the page. Screens are in `production/qa/evidence/`.
