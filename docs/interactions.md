# Interactions in a CEO run

Every moment that asks the player for something, or tells them something they did not ask for, with when it may appear. `tests/context-test.cjs` plays CEO runs and checks each card, notice and news line as it appears; the other tests named below check the conditions in detail.

## Decision cards

A decision card stops the clock until it is answered. One shows at a time; the rest wait in the queue.

| Card                                                       | Type           | When it can appear                                                                                                                                                   | It needs                                                                                               | Tests                                                 |
| ---------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Company event: an opportunity, a crisis or office politics | `companyEvent` | Once every 13 weeks, drawn from the 45 events whose phase and conditions fit; a deferred one returns before its deadline                                             | The artist or album it names, when it names one                                                        | `events-test`, `phone-ui-test`                        |
| Board approval                                             | `approval`     | A payment past the period's budget under medium or low freedom; under low freedom also a big signing, a risky theme or a genre the label has never released          | A board                                                                                                | `board-test`, `stories-test`                          |
| Story beat                                                 | `story`        | A due beat, at most one queued at a time, three weeks after the last beat and eight after the same person's last                                                     | The person still at the label (artist, head, team member or director), and every condition of the beat | `stories-test`, `story-pack-test`, `story-staff-test` |
| A rival bids for your artist                               | `rivalBid`     | From phase 3, by the rival's appetite (1–5% a week), for a star or superstar who is not busy and has one album left or morale under 40; 26 weeks between rival cards | The artist still signed                                                                                | `rivals-test`                                         |
| A superstar starts a feud                                  | `rivalFeud`    | By the rival's temper (0.5–2% a week) when you have a superstar; 26 weeks between rival cards                                                                        | The superstar still signed                                                                             | `rivals-test`                                         |
| Album checkpoint                                           | `album`        | Earning weeks 3, 6, 9 and 12 of a release                                                                                                                            | The album's artist still signed                                                                        | `context-test`                                        |
| Quarterly industry spotlight                               | `album`        | Weeks 13, 26, 39 and 52, for one album still in its earning run                                                                                                      | As above                                                                                               | `context-test`                                        |
| Tour review                                                | `tourDay`      | A tour's scheduled review day, at most three a week across all tours                                                                                                 | An active tour                                                                                         | `road-test`, `tour-cadence-test`, `tour-timing-test`  |
| Awards night                                               | `awards`       | The first week of a year, after the ceremony                                                                                                                         | —                                                                                                      | `industry-test`, `year-end-test`, `context-test`      |

A paid choice that needs the board's approval opens the approval card first; the original card waits behind it.

Classic runs also have classic industry events and the rotating rival-CEO scenarios (`ceo`). CEO runs never show them.

## Cards over the street

These cover the screen and wait for a button, without blocking the week.

| Card               | When it appears                                                       |
| ------------------ | --------------------------------------------------------------------- |
| Release results    | Right after an album is released                                      |
| Chart milestone    | The first time an album reaches the Top 300, 100, 40, 20, 10, 5 or #1 |
| Board review scene | At each review week once the label has a board                        |
| Power grab outcome | When a plot comes to a head                                           |
| Second act offer   | When the CEO is fired or ousted and a superstar is willing to follow  |
| IPO bell           | On listing                                                            |
| Yearly review      | At each year end (no yearly goal in CEO runs)                         |
| Final review       | When the run ends                                                     |

## Notices

Notices sit in the side ticker and the phone's inbox.

| Notice                  | When                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Phase reached           | The company moves up a phase                                                                   |
| Tier change             | An artist moves up a tier                                                                      |
| A superstar in the news | A superstar's good or bad news week                                                            |
| Walked out              | An unhappy artist leaves at the end of their contract                                          |
| Office gossip           | A department head starts a power grab                                                          |
| Listening party leak    | A party leaks the album                                                                        |
| Chart battle            | Three weeks after your album and a rival's both chart, released within two weeks of each other |
| A feud spills over      | 3% a week while feuding with a rival                                                           |
| Tour break-even         | A tour's takings cover its costs                                                               |
| Cash below $0           | The first week in the red                                                                      |

## Where it happens

The street holds every place in a CEO run: buildings and floors, the front desk (from the roster), the billboard, newsstand, trophy case, tour bus and the road out of town. The label's sign opens the phase card, its facility floors and the combo notebook. No CEO screen mentions the classic lot, label ranks or yearly goals.
