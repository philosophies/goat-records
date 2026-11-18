# Goat Records 2.0: The CEO

Status: design for review. Nothing here is built yet. The work is split into tasks in `production/backlog.md`.

## 1. Overview

You are the CEO of Goat Records. The run starts in a spare bedroom with a laptop, a borrowed mic and no money, signing whoever plays the local open mic. It can end with a public company, offices on three continents and a share price the world watches, or with the board voting you out of the company you built.

Three loops sit on top of each other:

| Loop    | Length                          | What you do                                                                    |
| ------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Week    | ~4 s at 1×                      | Albums move a stage, tours play, money comes in, people react                  |
| Quarter | 13 weeks                        | Opportunities and crises land, staff politics move, releases chart             |
| Review  | 1 year (2 quarters once public) | The board grades you and sets next period's budget, perks and creative freedom |

The label grows through six company phases, each with its own buildings, scouting reach, money sources and board.

## 2. Player fantasy

Running a music dynasty from the top floor. You pick the talent, build the teams around them and decide what the label stands for. Everyone wants something from you: artists want control, executives want your chair, the board wants growth. Success is keeping the music great and the company strong without losing the job.

Tone: glossy, dramatic, a little soap opera. Marble lobbies, gold records, boardroom stand-offs, studio sessions at 3 a.m. Inspired by music-dynasty TV drama, Empire TV Tycoon, Game Dev Tycoon and Kairosoft's management games. Nothing is copied from them: all names, characters, logos, songs and art are original.

## 3. Detailed rules

### 3.1 The screen

- Landscape, 16:9 first, scaling down to 4.7" phones and up to 1440p monitors. One codebase for PC browsers and Android (installable web app; an Android wrapper can come later).
- **The street scrolls sideways.** The label owns buildings along one street. Drag or flick to scroll on touch; on PC use the mouse wheel, arrow keys or drag. A minimap strip at the bottom jumps to any building.
- **Buildings grow up, not out.** Each building adds floors one at a time (stacked rooms, Tiny Tower style). The lot no longer widens with rank.
- **Everything opens from the world.** People, rooms, buildings and street props open their panel, as in 1.1. There are no tabs.
- **The CEO phone** is the one menu: a phone button in the corner opens five apps:
  - Inbox: opportunities, crises and messages, with deadlines.
  - Calendar: the next review, releases, tours and contract ends.
  - Contacts: every artist and staff member, searchable.
  - Wallet: cash, budget left this period, debt and share price.
  - Settings: speed, sound, saves.

  The phone badge counts things that need you.

- Tap targets are at least 48 × 48 dp; text never below 12 px; every action works with mouse, touch and keyboard.
- Time: Pause, 1×, 2×, 4×. The clock stops for decisions, as now. No offline earnings and no timers that need waiting out: this is a premium game, not free-to-play.
- Sessions: a quarter takes about 5–8 minutes at 1×, so one sitting on a phone is one quarter, and a review lands about every 25 minutes.

### 3.2 Company phases

|   # | Phase          | Starts with                                      | Buildings                                                      | Scouting reach       | Money comes from                            | Board                                  |
| --: | -------------- | ------------------------------------------------ | -------------------------------------------------------------- | -------------------- | ------------------------------------------- | -------------------------------------- |
|   1 | Home studio    | $2,000, a bedroom booth, you                     | Your apartment                                                 | Local scene          | Gigs, local downloads, beats for hire       | None (you answer to your bank account) |
|   2 | Indie label    | First outside money: a loan or an angel investor | Rented studio storefront                                       | City                 | Streams, merch at shows                     | Optional: an angel takes one seat      |
|   3 | Regional label | Distribution deal                                | Studio building + small office                                 | Region               | Distribution, radio, regional tours         | 3 seats once you take venture money    |
|   4 | National label | A national hit                                   | Label HQ tower, live venue                                     | Country              | Sync licensing, national tours, brand deals | 5 seats                                |
|   5 | Global label   | Second territory office                          | HQ, venue, media center, warehouse                             | World                | Publishing, global tours, catalog           | 7 seats                                |
|   6 | Public company | IPO                                              | All, plus overseas offices (each a building on its own street) | World + acquisitions | All of the above + capital markets          | 9 seats, shareholders, analysts        |

Advancing needs goals (fame, revenue, hits, catalog, staff) and, from phase 3, a board vote. Phases 1–2 can stay board-free if you never raise money: you keep full creative freedom, but grow only on what you earn. Raising money is faster, and costs you control.

### 3.3 The board and the periodic review

- **Board seats** belong to directors with an agenda. Each director has a priority, a patience value and a relationship with you.
  - The Accountant: profit and cash.
  - The Visionary: growth and market share.
  - The Artist's Friend: artist welfare and creative reputation.
  - The Old Guard: stability and no scandals.
  - The Investor: valuation, and later share price.
- **Board confidence** (0–100) is the weighted average of each director's satisfaction. It moves with results, scandals, promises kept and politics.
- **The review** happens every year, and twice a year once public. You present the period. Each director scores it against their agenda, then the board votes on three settings for the next period:
  - **Budget:** how much you can spend before needing approval. Spending past it is possible but costs confidence.
  - **Perks:** company car, penthouse office, private jet. Mostly cosmetic. They raise your influence with staff and artists, and they cost money the Accountant hates.
  - **Creative freedom:**
    - Low: board approval for big signings, controversial releases or new genres.
    - Medium: approval needed only above the budget.
    - High: you decide everything.
- Before the review you can lobby: meet a director (costs a week of your time), promise a target (kept promises add trust; broken ones cost double), or trade a favor (hire their candidate, drop a project they hate).
- **Losing the job.**
  - Confidence below 35 at a review puts you on probation for the next period.
  - Below 20 on probation, or below 10 at any review, triggers a no-confidence vote.
  - A lost vote ends the run as "Fired", scored on everything you built.
  - You can survive the vote with allies on the board, or by holding more than half the voting shares yourself.

### 3.4 Executives and power grabs

- Label staff above the junior level are **executives**. Each has skill, salary, **ambition**, **loyalty** and **influence**.
- Influence grows with their department's wins, time at the company and board contacts.
- When an executive's ambition and influence pass a threshold and their loyalty is low, they start a **power grab**: courting directors, taking credit, leaking to the press. The first sign is office gossip in the Inbox, two quarters before it matters.
- Your answers:
  - **Promote:** a title and a raise; ambition is calmed for a while.
  - **Placate:** a perk or bonus; buys a quarter.
  - **Sideline:** move them to a smaller department; their influence falls, and so does their loyalty.
  - **Fire:** severance, and the board reacts by how much they liked them.
  - **Counter:** win their board contacts first.
- A successful grab installs them as co-CEO, which splits your creative freedom, or as CEO, which ends the run. A failed grab usually ends with them leaving for a rival and trying to take an artist with them.

### 3.5 Artist management: the team around each artist

- Every artist has team slots, unlocked by phase:
  - Manager (from phase 1)
  - Producer (phase 1)
  - A&R rep (phase 2)
  - Publicist (phase 3)
  - Stylist (phase 3)
  - Tour manager (phase 3)
  - Business manager (phase 4)
- Team members are people you hire into a shared pool and assign. One can serve two artists at reduced effect.
- Each role lifts specific results: the producer album quality, the publicist fame and scandal defence, the tour manager tour profit and artist energy, and so on. **Chemistry** between the artist and each team member (genre, personality, history) multiplies it.
- Artists have **traits** (ego, discipline, loyalty, work rate) and **wants**: money, creative control, fame or family time. Meeting wants keeps morale up. Ignoring them leads to demands, public complaints, then a walk-out at contract end.
- Contracts carry an advance, a royalty rate, the number of albums, and from phase 4 a 360 option that takes a share of touring and merch.

### 3.6 Label management: departments

| Department       | Head (executive)             | What it does                                   |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| A&R              | Head of A&R                  | Scouting reach and accuracy, signing pipeline  |
| Marketing        | CMO                          | Release campaigns, ads, brand deals            |
| Promotion        | Head of Promotion            | Radio, playlists, chart pushes                 |
| Live             | Head of Touring              | Tours, festivals, the venue                    |
| Business Affairs | General Counsel              | Contracts, lawsuits, sync and publishing deals |
| Finance          | CFO                          | Budgets, the IPO, board trust in your numbers  |
| Creative         | Creative Director (phase 4+) | Visual identity, videos, controversy handling  |

Each department has a size (staff count) that sets its capacity: how many projects it can run each quarter. Its head's skill sets the quality of each project.

### 3.7 Scouting and growing talent

- Scouting reach follows the phase:
  - Phase 1: local open mics and uploads.
  - Phase 2: city clubs.
  - Phase 3: regional showcases.
  - Phase 4: national competitions.
  - Phase 5–6: world, plus buying contracts from other labels.
- Scouting reports show estimated talent with error bars that shrink as A&R improves.
- Artists grow through releases, tours, training and their team, and they peak, plateau and decline. A label that stops signing new talent shrinks; the review checks the pipeline.

### 3.8 Opportunities and crises

Events arrive through the Inbox with a deadline and two to four choices. They are weighted by phase, the current state of the label and staff traits. The table shows examples; the full list lives in data.

| Kind        | Example                                   | Typical choices                                                    |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Opportunity | Film studio wants a song for a trailer    | Write one (time, fee, fame) · license catalog (smaller fee) · pass |
| Opportunity | Rival label in trouble offers its catalog | Buy (cash, debt) · buy half · pass                                 |
| Opportunity | Clip from a show goes viral               | Rush a single · tour the moment · let it ride                      |
| Opportunity | Sportswear brand wants your star          | Big deal (artist morale ±) · small deal · decline                  |
| Crisis      | Unreleased album leaks                    | Release early · rework (delay) · go after the leaker (legal cost)  |
| Crisis      | Artist arrested before a tour             | Bail and support (board −) · suspend · cut ties (morale −)         |
| Crisis      | Sample clearance lawsuit                  | Settle · fight (chance) · pull the track                           |
| Crisis      | Executive poached by a rival              | Counter-offer · let go · enforce the non-compete                   |
| Crisis      | Streaming payout cut                      | Absorb · renegotiate (Business Affairs) · pull catalog (risky)     |
| Crisis      | Studio flood or fire                      | Insure-and-rebuild (if insured) · rent space                       |
| Politics    | Director demands a sure-thing signing     | Comply · refuse (trust −) · trade                                  |
| Politics    | Two artists in a public feud              | Mediate · exploit it (sales +, scandal risk) · ignore              |

### 3.9 Records

Kept from 1.x: the five-stage album with decisions, themes and combos, the ratings reveal, release strategies, singles, the charts and awards. Changed: the producer, A&R rep and team chemistry feed the stage scores; the board's creative freedom limits budgets and risky themes; streaming and singles grow as the decades pass.

### 3.10 Money

- Revenue streams open by phase (table in 3.2). Costs: salaries, team fees, advances, building rent or mortgages, and from phase 3 interest and investor returns.
- **No runaway cash.** Every phase adds bigger things to buy, and the board turns spare cash into expectations:
  - more floors and buildings
  - acquisitions
  - star advances
  - overseas offices
  - share buybacks after the IPO

  Profit raises the next budget, but also the bar.

- Raising money: a bank loan (interest, no seats), an angel (phase 2, 10–20% for a seat), venture rounds (phases 3–5, 15–30% each for seats) or the IPO. Your share falls with each round; below 50% you lose the protection from a no-confidence vote.

### 3.11 The IPO and the end of a run

- **IPO requirements:** phase 5, three profitable years in a row, CFO skill 60+, board confidence 60+. The IPO sells 25% of the company at a price set by revenue growth, hit rate and scandal history.
- After the IPO, analysts publish expectations for every half-year. Beating them lifts the share price and board confidence; missing them drops both.
- **A run ends** after 20 years, when the board fires you, or when the label folds. The grade combines:
  - company value
  - your share of it
  - hits and awards
  - artists developed
  - whether you kept the chair

  New Game+ carries legacy bonuses, as in 1.x.

## 4. Formulas

All weights and thresholds live in `src/data/` tables, never in code.

```
director satisfaction = clamp(0, 100, 50 + Σ (metric change vs target × agenda weight) + relationship + promises)
board confidence      = Σ (director satisfaction × seat weight) ÷ Σ seat weight
review budget         = last budget × (0.8 + 0.4 × confidence ÷ 100) × (1 + revenue growth)
creative freedom      = Low if confidence < 40, Medium if < 70, else High (one step lower while on probation)
power grab chance/qtr = max(0, (ambition + influence − loyalty − 90) ÷ 200) × (1 − your influence ÷ 200)
team effect           = Σ role skill × role weight × chemistry   (chemistry 0.6–1.4)
company value         = revenue × multiple(phase, growth, hit rate) + catalog value + cash − debt
share price           = company value ÷ shares outstanding × market mood (0.8–1.2)
```

## 5. Edge cases

- A review falls while the clock is stopped for a crisis: the crisis resolves first.
- All directors are allies: confidence still drops for missed targets; allies only soften it.
- You own over 50% of the shares: a no-confidence vote cannot pass, but directors can resign, which drops the share price.
- An executive's power grab and a review land in the same week: the grab resolves at the review.
- An artist's team member quits mid-album: the stage uses the next best person in the pool, or none.
- Leaving phase 1 without investors: the board never appears until you take outside money, then it starts at 3 seats.
- Loading a 1.x save: see Migration.

## 6. Dependencies and reevaluation of 1.x systems

| 1.x system                     | 2.0 decision                                                                 | Why                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Lot with tiles and facilities  | **Change:** buildings along a street, each built up by floors                | Matches the side-scrolling layout; no border expansion  |
| Label ranks                    | **Replace** with company phases                                              | Phases carry buildings, reach, money and the board      |
| 20-year campaign goals         | **Keep**, reworded as company milestones; the review is the main yearly beat | Goals stay useful; the board gives them stakes          |
| Album production (five stages) | **Keep**                                                                     | It is the heart of the game                             |
| Themes and combos              | **Keep**                                                                     | Proven discovery loop                                   |
| Staff roles (six)              | **Replace** with departments, executives and artist teams                    | The CEO fantasy is about people                         |
| Recording locations            | **Keep** in phases 2+                                                        | Good leveling loop; shows as trips away from the street |
| Gigs                           | **Keep**; the main income in phase 1                                         | Fits the broke start                                    |
| Hot streaks, singles, ads      | **Keep**; ads move under Marketing                                           | Already working                                         |
| Tours                          | **Keep**; the tour manager and the Live department feed them                 |                                                         |
| Charts and awards              | **Keep**                                                                     |                                                         |
| Events                         | **Expand** into opportunities, crises and politics                           | Game Dev Tycoon-style variety                           |
| Debt grace period              | **Keep**; loans become a deliberate choice                                   |                                                         |
| Score and New Game+            | **Change:** company value replaces fame as the main score                    |                                                         |

## 7. Tuning knobs

- Phase thresholds.
- Director agendas and patience.
- Review budget factors.
- Confidence thresholds for probation and votes.
- Power grab threshold.
- Team role weights and chemistry range.
- Event weights by phase.
- Funding round sizes and dilution.
- IPO requirements and analyst targets.
- Revenue streams per phase.

## 8. Acceptance criteria

- A new run starts in phase 1 with no board, $2,000 and only local talent.
- Phase changes unlock the listed buildings, reach and revenue, and are covered by tests.
- A review sets budget, perks and creative freedom from the confidence formula; probation and the no-confidence vote work; being fired ends the run with a grade.
- Power grabs warn two quarters ahead and can be met five ways.
- Each artist team role measurably changes its result, and chemistry is shown before you assign someone.
- At least 40 opportunities, crises and politics events, each with tests for every choice's effects.
- The street scrolls by touch, wheel, drag and keys; every building and floor opens its panel; the CEO phone works with keyboard.
- An IPO is possible by year 12 with strong play; a scripted balance sample (like `CAMPAIGN-BALANCE.json`) shows how often careful, average and reckless policies get fired, go public or fold.
- 1.x saves load (see Migration).

## Migration

1.x saves convert at load. Rank sets the starting phase (Bedroom → 1, Indie Imprint → 2, Rising Label → 3, Major Contender → 4, Powerhouse and Greatest of All Time → 5). Facilities become floors in the matching buildings. The six 1.x staff become department heads. The board starts at its seat count with confidence 60. The converted run keeps its year, artists, catalog and history.

## Open questions for the owner

1. Is "Fired" a final game over, or can you found a new label straight away (a fresh run with legacy bonuses)?
2. Should the board appear only if you take outside money (recommended), or always from phase 3?
3. Is the label still called Goat Records, or does the player name it?
4. Android: is an installable web app enough, or should the plan include a Play Store build?
