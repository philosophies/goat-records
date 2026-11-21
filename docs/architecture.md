# Architecture

Plain browser JavaScript, no build step. `index.html` loads scripts in this order: data tables, systems, engine, interface registry, feature interfaces, `app.js`.

## Simulation

- `src/engine.js` — core rules (artists, albums, charts, tours, awards, saves). Exposes `LabelGame` in the browser and `module.exports` in Node.
- `src/data/<name>.js` — balance tables. Each file merges its tables into `GoatData`.
- `src/systems/<name>.js` — optional game systems. Each file exports `create(core, data)` (and registers that function as `GoatSystems[name]` in the browser). The engine loads the names listed in `SYSTEM_NAMES`. New runs use CEO systems by default. `G.create(seed, { ceo: false })` starts a classic run.

`core` gives a system `clamp`, `log`, `pay`, `requireAction`, `busy`, `artist`, `operatingYear`, `roll(s, key)` (a separate seeded random stream per key, so a new system never changes existing seeded outcomes), `uniqueName(s, r)`, `peopleNames(s)` and `reserveName(s, name)` (names already in use, and holding one for the week), and `api()` (the engine's public API, for calls at run time).

### System hooks

A system object may implement any of these. All are optional.

| Hook                                              | Called                                                       | Returns                                    |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `init(s)`                                         | New game and every load (migration)                          | —                                          |
| `validSave(s)`                                    | Save import and page load                                    | `false` to reject                          |
| `validatePlan(s, plan)`                           | Before an album is paid for                                  | throws to reject                           |
| `planCost(s, plan)`                               | Album quote and start                                        | extra cost                                 |
| `onRecord(s, album, plan)`                        | Album started                                                | —                                          |
| `stageParts(s, album, stage)`                     | Each production stage preview                                | calculation rows `{name, value}`           |
| `launchParts(s, album, i)`                        | Release ratings (0 Critics, 1 Fan response, 2 Market impact) | rows                                       |
| `onRelease(s, album)`                             | Album released                                               | —                                          |
| `salesMultiplier(s, album, artist)`               | Weekly album sales                                           | multiplier                                 |
| `upkeep(s)`                                       | Weekly overhead                                              | cost                                       |
| `weekly(s)`                                       | Weekly settlement, after charts                              | income paid this week                      |
| `trainingAdjust(s, artist)`                       | Development quote                                            | `{ceilingBonus, potentialBonus, discount}` |
| `afterTraining(s, artist)`                        | After a development session                                  | —                                          |
| `afterTour(s, tour, completed)`                   | Tour ends                                                    | —                                          |
| `yearEnd(s, year)`                                | After the annual awards at a year boundary                   | —                                          |
| `approveSigning(s, artist, quote)`                | Before a CEO-run signing is paid for                         | throws to refuse                           |
| `approvePlan(s, plan, artist)`                    | Before a CEO-run album is paid for                           | throws to refuse                           |
| `approveTour(s, quote)`                           | Before a CEO-run tour is paid for                            | throws to refuse                           |
| `beforeSpend(s, amount)`, `onSpend(s, amount)`    | Around every CEO-run payment                                 | throws to refuse / —                       |
| `beforeRenew(s, artist)`                          | Before a contract renewal                                    | throws to refuse                           |
| `eventChoice(s, event, option)`                   | After a non-company event choice is applied (CEO runs)       | —                                          |
| `onScandal(s, artist, effects)`                   | An event costs an artist trust (CEO runs)                    | —                                          |
| `trustLoss(s, artist)`                            | Share of an event's trust loss that reaches the artist       | multiplier                                 |
| `tourGate(s, tour)`, `tourDrain(s, tour, artist)` | Tour ticket revenue and energy drain                         | multipliers                                |
| `roleSkill(s, role)`                              | Skill behind a 1.x staff role effect                         | skill                                      |

Event types in a CEO run's queue: `companyEvent` (quarterly opportunities and crises, from the events system), `approval` (board approvals) and `story` (story beats, from the stories system). A `story` event carries `arc`, `beat` and `artist`; each option carries `storyChoice`, the index of the authored choice.

Add new public functions to the engine API through the system object; `LabelGame.systems` lists loaded systems.

## Interface

- `src/ui/registry.js` — `GoatUI`, the plug-in points listed in the file: full screens (`registerPanel`), album form fields, studio sections, artist and catalog card rows, production rows, status chips, banners (one with a button covers the lot and pauses the clock, unless marked `data-ticker`), click and change handlers.
- `src/ui/places.js` — where every panel lives. `GoatPlaces.resolve(id)` maps an older screen id (`scout`, `finance`, `studio`…) to its place and section; `GoatPlaces.sheet(id)` builds the panel for a place (`desk`, `office`, `billboard`, `bus`…) or a person or room (`artist:<id>`, `staffer:<role>`, `room:<id>`, `location:<id>`). A registered screen no place shows is still opened on its own. It also draws the roster and the street.
- `src/ui/<name>.js` — feature screens. They register with `GoatUI` and use the page helpers from `app.js` at render time (`G`, `state`, `$`, `esc`, `money`, `act`, `render`, `disable`, `blocked`).
- `src/app.js` — page shell, the built-in panel pieces (album form, tour form, room card, catalog list, team role), saving and loading.

Album form controls that should refresh the quote carry a `data-album-field` attribute.

Two more points serve the lot screen: `GoatUI.pauses` (`{ reason() }`; any non-empty text holds the live clock and is shown as the pause reason) and `GoatUI.lotDecor` (`{ render() }`; drawn on the street in front of the building). A banner with a button is shown as a card over the lot and holds the clock; one without a button sits in the side ticker.

Page globals for feature scripts: `GoatLot.say(text, key, facilityId)` shows a speech bubble over an artist (`"a" + id`) or staff member (`"s" + role`); `GoatClock` has `speed`, `setSpeed(n)` and `day()`; `openPanel(id)` and `closePanel()` open and close a place's panel (any id `GoatPlaces` knows, or a button's `data-tab`); `paintHTML(id, html)` rewrites a region only when it changed.

## Live clock

`src/ui/clock.js` decides each tick with `clockState(state, ui)`. Time holds for a finished run, an event, an album decision or result, a chart milestone, an unseen rank-up, an open panel or building popover, a banner with a button, and any `GoatUI.pauses` reason. Each tick runs one Next week step. A chosen speed resumes by itself once nothing is waiting; Pause stays paused.

## Checks

`node run-checks.cjs` runs every suite in `tests/`. Interface harnesses load scripts in `index.html` order through `tests/load-interface.cjs`, so new interface files are picked up automatically.
