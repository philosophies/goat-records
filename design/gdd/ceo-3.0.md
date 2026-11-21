# Goat Records 3.0: the dynasty update

CEO mode is the game. Classic mode is hidden: new labels are always CEO runs, old classic saves still load, and nothing new is built for them.

## 1. One ladder

The company phase replaces the classic label rank in CEO runs. Each phase carries what the rank used to set:

| Phase            | Roster (superstar / star / rising) | Theme slots | Room tier | Reward on reaching it |
| ---------------- | ---------------------------------- | ----------- | --------- | --------------------- |
| 1 Home studio    | 2 (0 / 0 / 2)                      | 1           | 1         | —                     |
| 2 Indie label    | 3 (0 / 1 / 2)                      | 1           | 1         | $6,000 and 2 themes   |
| 3 Regional label | 5 (1 / 1 / 3)                      | 2           | 2         | $15,000 and 2 themes  |
| 4 National label | 7 (1 / 2 / 4)                      | 2           | 3         | $30,000 and 2 themes  |
| 5 Global label   | 8 (2 / 2 / 4)                      | 2           | 4         | $60,000 and 2 themes  |
| 6 Public company | 10 (2 / 3 / 5)                     | 2           | 4         | $100,000 and 3 themes |

The room tier lags a phase behind so album quality does not jump with every promotion. The development ceiling is 64 + tier × 4. The tier split of the roster arrives with roster tiers (section 3).

The rank chip, rank requirements and the classic yearly goal disappear from CEO runs; their cash and theme rewards move to reaching a phase. The yearly review stays, without a goal.

## 2. Look: West Coast dynasty

A parody of a 1990s West Coast rap label: black, blood red, gold and off-white; heavy condensed type; chrome and gold trim; palm trees, sunsets, chain-link and lowriders on the street. Everything is original: our own goat emblem and slogans, no real label's name, logo or artwork.

Buildings and rooms get new pixel art that changes with level: signage, lighting, equipment and people. The street gets day and night.

## 3. Roster tiers

Artists sit in tiers: rising, star and superstar. A phase sets how many slots each tier has (table above); you start with no superstar slot. Moving up a tier needs fame and a hit; dropping a tier happens after a run of flops.

The tier caps what the company may spend on the artist: recording budget, marketing, tour scale and team size. Superstars:

- are the face of the company: their news moves company value, the share price and revenue, for better or worse (endorsements, scandals, feuds, a sold-out tour);
- have a relationship with the CEO that swings sharply on choices and results;
- can save the CEO: when you are fired or ousted, a superstar whose relationship and loyalty are high enough can follow you to a new company (a second act: phase 1 again, with the superstar and a legacy bonus). With no one willing, the run ends.

## 4. Album making: listening parties

After Mix & master, before release, you can hold a listening party (cost and size by tier). It reports fan sentiment by audience and by album area. You can then rework the weakest area (time and money, a smaller second gain), change the lead single, or release as is. A second party gives less. A leak risk grows with each party.

## 5. Long progression

Nothing should peak early. Artists, buildings, staff and executives level up in small steps with rising costs and soft caps, so a strong label still has room to grow in year 15:

- Artists: XP from sessions, releases, tours and events; levels 1–30, with level caps by tier and perks at milestones.
- Buildings and floors: up to level 10, gated by phase.
- Staff, executives and team members: XP from work, training at a cost, skill ceilings that rise with seniority.

The balance script reports the year each measure peaks.

## 6. Stories

Characters come from an authored cast instead of random generation where possible: each has a name, look, genre, backstory, traits and a story arc. Arcs are chains of beats (events) that unlock in order and depend on context: phase, relationship, recent release, tour, chart, rivals, money, other characters. Beats remember earlier choices through flags, so a short story holds together: a rapper's debut, the feud it starts, the reconciliation or the fallout.

Targets: about 30 authored artists and 20 authored staff, executives and directors; at least 120 new beats. Every interactive moment (event, decision, prompt, banner) is audited so it only appears when its context is true.

## 7. Long-term engagement

Tycoon games tend to lose players in two places: the first few minutes, when the loop is not yet clear, and the late game, when the best strategy is solved and every year plays the same. This section covers both. Every number below is a starting value for a table in `src/data/`, to be tuned by the balance script.

### 7.1 The first fifteen minutes

A new run opens with a short guided checklist on the HUD. Each goal pays a small reward and can be skipped; the whole list can be turned off in Settings.

| Goal                             | Reward            |
| -------------------------------- | ----------------- |
| Sign your first artist           | $500              |
| Finish the first recording stage | $500              |
| Release your first album         | $1,000 and 5 fame |
| Reach the chart                  | $1,500            |
| End a week in profit             | 5 reputation      |

- The first album of a run has no cooldown between stages, so the first release lands by about week 6.
- One-time tips appear the first time something matters (first listening party, first tier slot, first superstar, first board meeting), never before.
- The checklist does not appear in a second act.

### 7.2 Show why

Players forgive bad luck they can see. Every big change gets a cause the player can read:

- Each character's panel has a story log: beats, choices and results as a short timeline.
- Tier changes, relationship swings, board votes, valuation moves and leaks carry a "Why?" breakdown in the same form as the album score breakdown.
- The Wallet gains a monthly ledger: money in and out by source (sales, tours, endorsements, catalog, wages, upkeep, loans).

### 7.3 Rival labels

Each run has three rival labels drawn from an authored list of eight (original names and CEOs). A rival has a CEO personality, a genre focus and a strength that grows with your phase so they stay a threat.

| Personality  | Plays like                                         |
| ------------ | -------------------------------------------------- |
| Shark        | Poaches often, overpays, starts feuds              |
| Purist       | Few releases, high quality, wins awards            |
| Hype machine | Floods the charts with singles, buys attention     |
| Old guard    | Big catalog, slow, buys smaller labels at phase 5+ |

- Rivals release into the same charts. When your release lands within two weeks of a rival's, the release report shows a chart battle and its winner.
- Poaching: in an artist's last contract year, or when morale is below 40, a rival may bid. Match, counter (loyalty and relationship help) or let them go. From phase 3 you can bid for theirs.
- Feuds: each rival has a standing from −100 to 100. Diss records, award snubs and public call-outs move it; a feud lifts both sides' sales a little and raises scandal risk. Superstars can start feuds you then back or calm.
- From phase 5 a weak rival can be bought: its catalog joins yours.

### 7.4 Music eras

The industry changes across a run, so a strategy that won in year 3 is not the best in year 12. The table gives the usual years. Each run moves every change of era one or two years earlier or later, at random (fixed when the run starts, so a seed always plays the same), and no era lasts less than two years. Each change is announced 13 weeks ahead.

| Era              | Years | Album sales | Singles | Touring | Licensing | Catalog |
| ---------------- | ----- | ----------- | ------- | ------- | --------- | ------- |
| Tapes and CDs    | 1–4   | 1.2×        | 0.8×    | 1.0×    | 0.8×      | 0.8×    |
| The piracy years | 5–8   | 0.7×        | 1.0×    | 1.3×    | 1.1×      | 0.9×    |
| Download stores  | 9–12  | 0.9×        | 1.3×    | 1.1×    | 1.2×      | 1.0×    |
| Streaming        | 13+   | 0.8×        | 1.1×    | 1.2×    | 1.2×      | 1.4×    |

- Each era also reweights the event pool (bootleg raids in the piracy years, playlist placements in streaming) and the cost of marketing channels.
- When an era is announced you can invest early: pay now for a head start (+15% on that era's strongest stream for its first year).

### 7.5 Catalog: a second life for old albums

An album keeps earning and creating moments after its release window.

| Status  | When                                                      |
| ------- | --------------------------------------------------------- |
| Fresh   | First 26 weeks after release                              |
| Catalog | After 26 weeks                                            |
| Classic | Three years old, quality 80 or more, and at least one hit |

Catalog opportunities, offered through the inbox and the new Vault panel:

- **Deluxe edition:** the artist records a few new tracks (two weeks, artist still signed); a smaller second release window.
- **Anniversary reissue:** classics at 5 and 10 years; works even after the artist has left, but a former artist's relationship affects the press.
- **Sample requests:** another artist wants to sample a track. Clear it for a fee and a small royalty, or refuse, which may start a feud.
- **Sync licensing:** a film, game or advert wants a track; one-off fee by album quality and era.
- **Greatest hits:** once an artist has three released albums.
- **Fan mail:** requests (a tour of an old album, a remix) that turn into small events.

Catalog income is weekly and small per album, so a deep catalog matters by year 10 without replacing new releases. Eras scale it.

### 7.6 Legacy and challenges

- **Hall of fame:** every finished run (folded, fired, sold or retired) is recorded outside the save: label name, peak phase, years, best album, superstars and how it ended.
- **Achievements:** about 30, from first hit to a ten-year classic, a second act that outgrows the first company, or winning three feuds.
- **Challenge runs:** seeded starts with a twist, the same for everyone who picks them: start in debt, one superstar and nothing else, a hostile board from day one, the piracy years from week one, no loans, and a weekly seed.
- **Legacy perks:** small and mostly about choice (an extra candidate at the start, a second starting theme). Nothing raises income or quality by more than 5%.

### 7.7 Late-game delegation

A large label should be about decisions, not chores. Delegation unlocks by phase and every automated action is logged in a monthly summary the player can review and undo where possible.

| Phase | Unlocks                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 3     | Contract renewals by rule (renew when average quality and wage meet your limits) |
| 4     | Tour booking by the head of touring, within a budget cap                         |
| 5     | Department autopilot with a policy: safe, balanced or aggressive                 |
| 6     | A chief operating officer settles small inbox decisions under a cash limit       |

Delegation never makes story choices, superstar decisions or board decisions.
