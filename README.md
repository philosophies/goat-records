# Goat Records

A record label management game. Start with $2,000 and a home studio. Sign artists, make records, and grow the label over a 20-year run. You decide when to take outside money and how much control to give up.

Double-click **Start Game.cmd**, or open **index.html** in Edge or Chrome. No install, account or internet connection needed.

## How to play

Tap people and places on the street to open their panels. The phone carries the Inbox, Calendar, Contacts, Wallet, and Settings.

1. Open the **front desk** and sign an artist. Use paid gigs to build a cash reserve, or open the **office** and visit the **boardroom** to apply for a bank loan.
2. Tap the artist, pick a room, genre, album theme and, if you like, a recording location. Work through five production stages, then release. A room or a location on the street can start an album too.
3. Start the clock with **1×**, **2×** or **4×**. Time stops by itself whenever a decision is waiting; **Next week** steps one week at a time while paused.
4. Build floors, hire executives, and assemble teams for your artists. Release singles, buy ads, tour, and enter the annual awards. Watch the Inbox for deals and crises with deadlines.
5. Grow from a home studio to a global label. Equity funding brings directors who set the budget and can remove you. Meet the profit, CFO, and confidence requirements for an IPO to take the company public.
6. At year 20, dismissal, or bankruptcy, the final review grades the label and your ownership stake, records, awards, and artist development. Earn legacy points for New Game+.

Stay below $0 for four weeks and the label closes.

Read the [full rules](docs/rules.md) and [version history](CHANGELOG.md).

## Saves

Progress autosaves in the browser. Use **Export save** for a backup and **Import save** to restore one. When loading a classic save, you can continue with its original rules or convert it to CEO mode. The conversion keeps your label's history and makes the original available through **Export classic backup**.

**New label** lets you name a CEO run or choose **Classic** to start a new run with the older rules.

For a local server instead of opening the file directly: `python -m http.server 8765 --bind 127.0.0.1`, then visit http://127.0.0.1:8765/. File and localhost saves are stored separately.

On localhost or an HTTPS host, you can install the game from Chrome or Edge and play offline after the first load. See [Android and offline play](docs/android.md).

## Project layout

| Path | Contents |
| --- | --- |
| `src/engine.js` | Core rules |
| `src/systems/` | Company, board, staff, events, campaign, locations, and promotion |
| `src/data/` | Balance tables |
| `src/app.js`, `src/ui/` | Interface: lot, places, clock, panels |
| `styles/` | Stylesheets |
| `tests/` | Simulation and interface checks, balance samples |
| `design/`, `docs/` | Design notes, rules and architecture |
| `production/` | Roadmap and test evidence |

Run `node run-checks.cjs` for every check (Node 22). `node tests/ceo-balance.cjs` reproduces the CEO balance sample.

No third-party art or music is used.
