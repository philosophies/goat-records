# Side A: Label Empire — prototype 0.9

A record label management game. Sign artists, make albums, chase the charts and grow a bedroom label into an empire.

Double-click **Start Game.cmd**, or open **index.html** in Edge or Chrome. No install, account or internet connection needed.

## How to play

1. **Scout** and sign an artist.
2. In **The studio**, pick an artist, room, genre and album theme, then work through five production stages.
3. **Release** the album, pick a launch strategy and advance weeks to earn sales and climb the Top 300.
4. Build up your **Headquarters**, hire a team, tour and enter the annual awards.
5. Meet each rank's goals to promote the label: more roster slots, a bigger lot, new facilities and two-theme albums.

Year one goal: reach Breakout Label with 180 fame, an award, six releases and cash in the bank. Run out of cash and the label closes.

## New in 0.9

- **Label ranks.** Six ranks from Bedroom Label to Label Empire. Promotion needs fame, releases, facilities, chart peaks, awards and cash, not fame alone.
- **Album themes.** Pair a genre with themes like Heartbreak, Hometown or Late Night. A combo's fit stays hidden until you record it, then goes in your combo notebook. Repeated combos level up but feel stale if released too close together.
- **Headquarters.** A pixel-art lot of facilities, from a Writers' Room to a Master Archive. Upgrade them, rearrange them, and place the right pairs side by side for extra bonuses. Your artists show up where they work.

Full rules: [docs/rules.md](docs/rules.md). Version history: [CHANGELOG.md](CHANGELOG.md).

## Saves

Progress autosaves in the browser. Use **Export save** for a backup and **Import save** to restore one. Saves from 0.8 load with the rank their fame had earned.

For a local server instead of opening the file directly: `python -m http.server 8765 --bind 127.0.0.1`, then visit http://127.0.0.1:8765/. File and localhost saves are stored separately.

## Project layout

| Path | Contents |
| --- | --- |
| `src/engine.js` | Simulation rules |
| `src/systems/label.js` | Ranks, themes and headquarters |
| `src/data/` | Balance tables |
| `src/app.js`, `src/ui/` | Interface |
| `styles/` | Stylesheets |
| `tests/` | Simulation and interface checks, balance samples |
| `design/` | Game brief and system designs |
| `production/` | Roadmap and test evidence |

Run `node run-checks.cjs` for every check (Node 22). `node tests/balance.cjs` reproduces BALANCE.json.

No third-party art or music is used.
