# Goat Records — 1.1

A record label management game. Sign artists, make albums, chase the charts and turn a bedroom label into the greatest of all time over a 20-year run.

Double-click **Start Game.cmd**, or open **index.html** in Edge or Chrome. No install, account or internet connection needed.

## How to play

The label's building is the whole game. There are no menus: tap a person or place to open it. Artists and staff walk between rooms as they work, and recording locations line the street outside.

1. Tap the **front desk** in the lobby and sign an artist.
2. Tap the artist, pick a room, genre, album theme and, if you like, a recording location. Work through five production stages, then release. A room or a location on the street can start an album too.
3. Start the clock with **1×**, **2×** or **4×**. Time stops by itself whenever a decision is waiting; **Next week** steps one week at a time while paused.
4. Grow the label: build facilities, hire a team, play paid gigs between albums, release lead singles, buy ads, tour and enter the annual awards.
5. Meet each rank's goals to promote the label, and chase a new goal every year. After year 20 the run is scored out of five stars, and the score buys bonuses for a New Game+ run.

Stay below $0 for four weeks and the label closes.

## What's in 1.1

- **No menus.** Artists, staff, rooms, the office, the trophy case, the billboard, the newsstand, the tour bus and every recording location open their own panel.

## What's in 1.0

- **The lot is the game.** A pixel-art cutaway building with a live clock and decision cards that pause time.
- **A 20-year campaign.** Yearly goals with rewards, a final score and star grade, and New Game+ with legacy bonuses.
- **Recording locations and gigs.** Ten rented places that level up to 9 and hide signature themes; paid gigs that earn cash between albums.
- **Star artists and promotion.** Hot streaks after hits, Top 10 weeks and awards; lead singles; ad campaigns unlocked by rank.

Full rules: [docs/rules.md](docs/rules.md). Version history: [CHANGELOG.md](CHANGELOG.md).

## Saves

Progress autosaves in the browser. Use **Export save** for a backup and **Import save** to restore one. Saves from earlier versions, including Side A: Label Empire 0.8, load and carry on.

For a local server instead of opening the file directly: `python -m http.server 8765 --bind 127.0.0.1`, then visit http://127.0.0.1:8765/. File and localhost saves are stored separately.

## Project layout

| Path | Contents |
| --- | --- |
| `src/engine.js` | Core rules |
| `src/systems/` | Ranks and headquarters, campaign, locations and gigs, promotion |
| `src/data/` | Balance tables |
| `src/app.js`, `src/ui/` | Interface: lot, places, clock, panels |
| `styles/` | Stylesheets |
| `tests/` | Simulation and interface checks, balance samples |
| `design/`, `docs/` | Design notes, rules and architecture |
| `production/` | Roadmap and test evidence |

Run `node run-checks.cjs` for every check (Node 22). `node tests/balance.cjs` reproduces BALANCE.json.

No third-party art or music is used.
