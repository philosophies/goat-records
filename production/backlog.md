# Backlog: Goat Records 2.0 (the CEO)

Design: `design/gdd/ceo-2.0.md`. One task per session. Take the first open task whose dependencies are done (`node tools/next-task.cjs` finds it).

Status marks in each heading: `[ ]` open, `[~]` in progress, `[x]` done.

Ground rules for every task:

- 2.0 is built behind a flag. New code only runs for a run created with `G.create(seed, { ceo: true })`, which sets `s.company`. A run without `s.company` must play exactly as 1.1 until task T37. Keep every existing test passing.
- Numbers go in `src/data/*.js` tables, never inline in systems or UI.
- New systems follow `docs/architecture.md`: a data file `src/data/<name>.js`, a system `src/systems/<name>.js` exporting `create(core, D)`, the name added to `SYSTEM_NAMES` in `src/engine.js`, and both scripts added to `index.html` in order.
- Every task adds tests in `tests/<name>-test.cjs` (picked up by `node run-checks.cjs` automatically). UI tasks extend a harness that uses `tests/load-interface.cjs`.
- Save compatibility: new state lives under `s.company`. `validSave` hooks must accept saves without it.

---

## M1 Company phases

### [x] T01 · Company module and CEO flag

Depends on: none
Files: `src/data/company.js` (new), `src/systems/company.js` (new), `src/engine.js`, `index.html`, `tests/company-test.cjs` (new)
Do:

- Data: `PHASES` with the six phases from design 3.2: `id`, `name`, `startCash` (phase 1: 2000), `reach` (`local`, `city`, `region`, `country`, `world`), `boardSeats`, `buildings` (ids, filled in T05), and `goals` (fame, revenue last 52 weeks, releases, hits).
- In `create` (`src/engine.js`), set `s.ceoMode = true` when `options.ceo` is true, next to where `options.legacy` is copied onto the state.
- System `company`: `init` adds `s.company = { phase: 1, since: s.week, history: [] }` and sets the cash to `PHASES[0].startCash`, only when `s.ceoMode` is true and `s.company` is missing. `init` also runs from `migrate`, so an old save without `ceoMode` must stay untouched.
- `validSave` accepts saves without `s.company` and checks the shape when present. API: `companyPhase(s)` returns the phase row or `null`.
  Done when: tests show a default run has no `s.company`; a CEO run starts in phase 1 with $2,000; the save round-trips through `validSave`; `node run-checks.cjs` passes.

### [x] T02 · Phase goals and advancement

Depends on: T01
Files: `src/data/company.js`, `src/systems/company.js`, `tests/company-test.cjs`
Do:

- `phaseProgress(s)`: each goal with `have` and `need`.
- At the weekly settlement (the `weekly` hook), when every goal for the next phase is met, advance. Phases 3+ also need `boardApproved` (always true until T20), log a news line, and push a notification `{ kind: "phase" }`.
- Record `{ phase, week }` in `s.company.history`.
  Done when: tests cover not-yet-met, met, the history entry and the notification; phases never go down.

### [x] T03 · Broke start and local scouting

Depends on: T02
Files: `src/data/company.js`, `src/systems/company.js`, `src/engine.js` (candidate generation only), `tests/company-test.cjs`
Do:

- In a CEO run, scouting candidates carry a `reach` (`local`, `city`…) and only appear when the phase reach covers them.
- Phase 1 candidates have lower talent caps (`REACH_TALENT` table in data).
- Paid scouting tiers above the phase reach are locked with a reason.
  Done when: a phase 1 run never offers candidates above local reach in 200 seeded refreshes; a phase 3 run does; a 1.1 run is unchanged (compare candidates for the same seed before and after).

### [x] T04 · Phase in the top bar

Depends on: T02
Files: `src/ui/company.js` (new), `index.html`, `styles/ceo.css` (new), `tests/company-ui-test.cjs` (new)
Do: a top-bar chip "Phase 1 · Home studio · 2/4 goals" through `GoatUI.hud`, opening a panel with the goals checklist (`GoatUI.registerPanel`). The phase-up notification shows as a card. Only in CEO runs.
Done when: the harness shows the chip and panel in a CEO run, and nothing in a 1.1 run.

### [x] T39 · Name the company

Depends on: T01
Files: `src/data/company.js`, `src/systems/company.js`, `src/engine.js` (the three chart entries that use `LD.LABEL_NAME`), `src/ui/lot.js` (roof sign), `src/ui/company.js`, `src/app.js` (new label dialog), `tests/company-test.cjs`, `tests/company-ui-test.cjs`
Do:

- `s.labelName` (1–32 printable characters, trimmed). Add `labelName(s)`, which returns `s.labelName || LABEL_NAME`, and use it everywhere the label's own name is shown. Past chart entries marked `owned` show the current name.
- In a CEO run, the New label flow asks for the name (default Goat Records). An office action renames the company; renaming costs `RENAME.fame` fame (data table) and is logged in the news.
- Classic runs keep "Goat Records" unless renamed, and their saves are unchanged.
- `validSave` checks the name's length and type when present.
  Done when: tests cover a default name, a custom name on the charts and in the news, rename with its cost, invalid names (empty, too long, not a string) rejected, and a classic run unchanged. The harness names a label in the new label flow.

## M2 The street and buildings

### [x] T05 · Buildings and floors data

Depends on: T01
Files: `src/data/company.js`, `src/systems/company.js`, `tests/company-test.cjs`
Do:

- `BUILDINGS` table: `apartment`, `storefront`, `studio`, `office`, `hq`, `venue`, `media`, `warehouse`, `overseas`. Each has a `phase` unlock, `cost`, `maxFloors` and `floorTypes` (which 1.x facility or recording room can go on its floors).
- State `s.company.buildings = [{ id, floors: [{ type, level }] }]`.
- API: `buyBuilding`, `buildFloor`, `upgradeFloor`, with clear errors for locked, cash and full.
  Done when: tests cover every error and a successful purchase and build; a CEO run starts with the apartment holding one bedroom booth.

### [x] T06 · Facilities live on floors

Depends on: T05
Files: `src/systems/label.js`, `src/systems/company.js`, `tests/company-test.cjs`
Do: in CEO runs, facility bonuses (stage bonuses, takings, care) are read from floors instead of lot tiles. Write one adapter, `facilitiesOf(s)`, that returns the same shape `label.js` uses today for both run types, and use it everywhere tiles were read.
Done when: a 1.1 run's facility numbers are identical before and after (snapshot test); a CEO run with a Vocal Booth floor gets the Vocal Booth bonus.

### [x] T07 · The side-scrolling street

Depends on: T05
Files: `src/ui/street.js` (new), `styles/street.css` (new), `index.html`, `src/ui/lot.js` (skip drawing the 1.1 lot in CEO runs), `tests/street-ui-test.cjs` (new)
Do:

- In CEO runs, draw the street: buildings side by side, each as stacked floors, with people from `lotCast` placed on their floor.
- The street scrolls horizontally: drag, wheel, arrow keys and a minimap of buttons that jump to each building. Keep the 1.1 street props (billboard, newsstand, bus, locations) on the street.
  Done when: the harness shows every owned building and its floors; minimap buttons exist for each; a 1.1 run still draws the old lot.

### [x] T08 · Floor and building panels

Depends on: T06, T07
Files: `src/ui/street.js`, `src/ui/places.js`, `tests/street-ui-test.cjs`
Do: tapping a floor opens its panel (reuse `facilityPanel` content for facility floors, `roomSheet` for recording floors). A "+ Floor" slot on top of each building opens the build list; an empty plot opens "buy building".
Done when: the harness opens a floor, builds a floor and buys a building through clicks.

### [x] T09 · Look and feel: the dynasty theme

Depends on: T07
Files: `styles/ceo.css`, `styles/street.css`, `src/ui/street.js` (pixel maps), `production/qa/evidence/` (screenshots)
Do:

- A CEO-run theme: black, gold and deep purple; a marble lobby; a night skyline that brightens as the company grows. Each building gets its own facade pixel map, with gold records in the lobby.
- Keep contrast at 4.5:1 for text.
- Original art only.
  Done when: desktop and phone screenshots for phases 1, 3 and 5 are saved in `production/qa/evidence/`; no text under 12 px.

## M3 The CEO phone

### [x] T10 · Phone shell and Inbox

Depends on: T04
Files: `src/ui/phone.js` (new), `styles/phone.css` (new), `index.html`, `tests/phone-ui-test.cjs` (new)
Do:

- A phone button (bottom-right, 56 px) with a badge of things that need you.
- It opens a phone panel with five app icons. Inbox lists events, notifications and decisions waiting, each opening its card.
- Keyboard: `P` opens the phone, `Esc` closes it.
  Done when: the badge count matches pending items in tests; Inbox opens an event card.

### [ ] T11 · Calendar, Contacts and Wallet apps

Depends on: T10
Files: `src/ui/phone.js`, `tests/phone-ui-test.cjs`
Do:

- Calendar: the next review, releases, tour dates and contract ends, sorted.
- Contacts: every artist and staff member with search, each opening their panel.
- Wallet: cash, budget left (after T21), debt and share price (after T31; show "—" before).
  Done when: each app renders from state in the harness; a Contacts entry opens an artist panel.

## M4 People

### [ ] T12 · Departments and executives

Depends on: T01
Files: `src/data/staff.js` (new), `src/systems/staff.js` (new), `src/engine.js`, `index.html`, `tests/staff-test.cjs` (new)
Do:

- `DEPARTMENTS` table from design 3.6. Executives have skill, salary, ambition, loyalty and influence (generator by phase reach).
- Hiring a department head, adding department staff (capacity), and firing with severance.
- CEO runs only.
  Done when: tests cover hiring, capacity, salaries at settlement and firing costs.

### [ ] T13 · Departments drive the existing role effects

Depends on: T12
Files: `src/systems/staff.js`, `src/engine.js` (only where the six 1.x roles are read), `tests/staff-test.cjs`
Do:

- Map each 1.x role effect to a department head:
  - Producer → A&R or the artist team producer
  - Marketing → Marketing
  - Public Relations → Marketing
  - VP → Finance
  - Artist Development → Creative
  - A&R → A&R
- Read effects through one function, `roleSkill(s, role)`, that works for both run types.
  Done when: a 1.1 run's stage scores are identical (snapshot test over a seeded album); a CEO run with a Head of A&R gets the A&R bonus.

### [ ] T14 · Artist team pool and chemistry

Depends on: T12
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do:

- `TEAM_ROLES` from design 3.5, with phase unlocks and role weights. Hire team members into a pool and assign them to artists (an artist can share a member at `sharedEffect`).
- Chemistry is 0.6–1.4 from genre fit, personality and history, and is shown before assigning.
  Done when: tests cover the slot unlocks, sharing, the chemistry range and determinism for a seed.

### [ ] T15 · Team effects on records and tours

Depends on: T14, T13
Files: `src/systems/staff.js`, `src/engine.js` (stage score and tour hooks), `tests/staff-test.cjs`
Do: apply `team effect = Σ skill × weight × chemistry` to the stage rows (the producer on Recording and Mix, the A&R rep on Songwriting), the publicist to fame and scandal defence, and the tour manager to tour profit and energy. Each shows as its own row in the stage calculation.
Done when: tests show each role changes only its results; the rows appear in the stage breakdown.

### [ ] T16 · Artist traits, wants and morale

Depends on: T14
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do: traits (ego, discipline, loyalty, work rate) and one main want (money, control, fame, family). Morale moves with wants met or ignored; low morale raises demand events (T27) and walk-outs at contract end.
Done when: tests cover each want, morale bounds and the walk-out rule.

### [ ] T17 · People panels

Depends on: T15, T16, T08
Files: `src/ui/places.js`, `src/ui/staff.js` (new), `styles/ceo.css`, `tests/staff-ui-test.cjs` (new)
Do: the artist panel gains a Team section (slots, assign with chemistry preview, traits, wants, morale). Department floors open their department panel (head, staff, capacity, hire).
Done when: the harness assigns a producer through clicks and shows the chemistry before confirming.

## M5 The board

### [ ] T18 · Funding and the board's seats

Depends on: T02
Files: `src/data/board.js` (new), `src/systems/board.js` (new), `src/engine.js`, `index.html`, `tests/board-test.cjs` (new)
Do:

- Director archetypes from design 3.3 (agenda weights, patience). Funding offers: a bank loan, an angel, venture rounds and terms.
- Taking money adds seats and dilutes `s.company.ownership`. A board appears only once outside money is taken.
  Done when: tests cover each offer, dilution, the seat count and "no board without investors".

### [ ] T19 · Board confidence

Depends on: T18
Files: `src/systems/board.js`, `tests/board-test.cjs`
Do: implement director satisfaction and board confidence from design 4, with targets set at the last review. Show the reasons (what moved each director).
Done when: tests check the formula on fixed inputs and that each agenda reacts to its metric.

### [ ] T20 · The periodic review

Depends on: T19
Files: `src/systems/board.js`, `src/systems/company.js` (`boardApproved`), `tests/board-test.cjs`
Do:

- Reviews happen only while a board exists, which needs outside money (T18). A label with no board has no reviews and cannot be fired.
- A yearly review (twice yearly after the IPO) sets budget, perks and creative freedom using design 4.
- Probation and the no-confidence vote follow design 3.3. A lost vote is game over: the run ends with outcome "Fired" (`s.finished`, a `fired` flag) and goes to the final review.
- With a board, phase advancement needs its vote.
  Done when: tests cover each confidence band, probation, both vote results, the >50% ownership protection, the fired ending (no further weeks can be played) and that a label without a board never gets a review.

### [ ] T21 · Budget and creative freedom in play

Depends on: T20
Files: `src/systems/board.js`, `src/engine.js` (spending entry points), `tests/board-test.cjs`
Do: track spending against the period budget. Over budget: the action still works but costs confidence, scaled by the overage. Low freedom: big signings, risky themes and new genres raise an approval request (an Inbox decision) before they happen.
Done when: tests cover under, at and over budget, and each approval case for each freedom level.

### [ ] T22 · Lobbying and promises

Depends on: T20
Files: `src/systems/board.js`, `tests/board-test.cjs`
Do: meet a director (a week of your time), promise a target (kept +trust, broken −2×) or trade a favor. Promises are checked at the next review.
Done when: tests cover each action and the promise check.

### [ ] T23 · The boardroom

Depends on: T20, T09
Files: `src/ui/board.js` (new), `styles/ceo.css`, `tests/board-ui-test.cjs` (new)
Do:

- A boardroom floor in the HQ opens the board panel: directors with portraits, their satisfaction and the reasons.
- The review plays as a scene: each director's score, then the vote on budget, perks and freedom. The clock is stopped.
  Done when: the harness plays a review through to its settings; reduced motion skips the animation.

## M6 Politics

### [ ] T24 · Power grabs

Depends on: T12, T20
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do: the power grab chance from design 4, gossip two quarters ahead in the Inbox, and the five responses (promote, placate, sideline, fire, counter) with their effects.
Done when: tests force a grab by seed and cover each response.

### [ ] T25 · How a grab ends

Depends on: T24
Files: `src/systems/staff.js`, `src/systems/board.js`, `src/ui/staff.js`, `tests/staff-test.cjs`
Do: success means co-CEO (your freedom splits) or the CEO chair (run ends). Failure means the executive leaves for a rival and tries to take an artist (that artist's loyalty is checked).
Done when: tests cover each ending; the UI shows the outcome card.

## M7 Opportunities and crises

### [ ] T26 · Event framework 2.0

Depends on: T01
Files: `src/data/events.js` (new), `src/systems/events.js` (new), `src/engine.js`, `index.html`, `tests/events-test.cjs` (new)
Do:

- Data-driven events: `id`, `kind` (opportunity, crisis or politics), `phases`, `weight`, `when` (conditions as data), `deadlineWeeks`, and `choices` with `cost`, `effects` and `chance`.
- One interpreter applies effects (`cash`, `fame`, `confidence`, `morale`, `artistFame`, `delayAlbum`, `loan`, …).
- In CEO runs it feeds the existing event queue; 1.1 events stay for 1.1 runs.
  Done when: tests cover the condition checks, the deadline expiry (worst choice applied), every effect type and determinism for a seed.

### [ ] T27 · Opportunities pack

Depends on: T26, T16
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 14 opportunities across phases (sync licensing, brand deals, festival slots, viral moments, catalog buys, distribution deals, a streaming exclusive, a remix contest, a documentary, a feature request from a star). Each choice has a tested effect.
Done when: every event fires in a test that sets up its conditions, and every choice is checked.

### [ ] T28 · Crises pack

Depends on: T26
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 16 crises (leak, arrest, lawsuit, sample clearance, poaching, payout cut, studio damage, artist walk-out, tax audit, bad review storm, tour cancellation, a manager stealing, a rival diss track, a contract dispute, burnout, a market slump).
Done when: as T27.

### [ ] T29 · Politics pack

Depends on: T26, T22
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 10 politics events (a director's pet signing, an exec feud, an artist feud, a board leak, a takeover rumor, a director resigning, an activist investor, staff asking for a raise, a union push, credit-taking).
Done when: as T27.

## M8 Money and the IPO

### [ ] T30 · Revenue streams by phase

Depends on: T02, T26
Files: `src/data/company.js`, `src/systems/company.js`, `tests/company-test.cjs`
Do:

- Phase-gated income: beats for hire and local downloads (1), streams and merch (2), distribution and radio (3), sync and brand deals (4), publishing and catalog (5).
- Each shows in the weekly finance history. Add bigger costs that grow with phase (rent, insurance, interest).
  Done when: tests cover each stream's unlock and the finance history lines.

### [ ] T31 · Company value and shares

Depends on: T30, T18
Files: `src/systems/company.js`, `tests/company-test.cjs`
Do: company value and share price from design 4; `s.company.shares` (total, yours, investors). Show them in the Wallet.
Done when: tests check the formula on fixed inputs and that rounds dilute correctly.

### [ ] T32 · The IPO and analysts

Depends on: T31, T20
Files: `src/systems/company.js`, `src/systems/board.js`, `src/ui/company.js`, `tests/company-test.cjs`
Do:

- IPO requirements from design 3.11. The IPO raises cash for 25% of the company.
- Half-yearly analyst targets; beating or missing them moves the share price and confidence. Reviews become twice-yearly. An IPO scene (bell ringing) on the street.
  Done when: tests cover the requirements, the price, the targets and the review cadence.

### [ ] T33 · Acquisitions

Depends on: T31
Files: `src/systems/company.js`, `src/data/company.js`, `tests/company-test.cjs`
Do: buy a rival's catalog or a small label (artists join, the catalog earns, debt possible). The board votes on deals above budget.
Done when: tests cover a cash purchase, a debt purchase and a board veto.

## M9 Finish

### [ ] T34 · Run ending and grade

Depends on: T32, T25
Files: `src/systems/campaign.js`, `src/data/campaign.js`, `tests/campaign-test.cjs`
Do: CEO runs score company value, ownership share, hits, awards, artists developed and kept-the-chair (design 3.11). "Fired" and "Folded" endings each have their own final review text. Being fired is game over: the final review, then a new label, with legacy points as after any ended run. Legacy points and New Game+ work for CEO runs.
Done when: tests cover each ending's score and New Game+ carry-over.

### [ ] T35 · CEO balance sample

Depends on: T34, T27, T28, T29
Files: `tests/ceo-balance.cjs` (new), `CEO-BALANCE.json` (generated)
Do: script three policies (careful, average, reckless) through 20-year CEO runs, 12 seeds each. Record phase reached by year, fired, folded, IPO year, final grade. Tune data until careful rarely gets fired, reckless often does, and strong play can go public by year 12.
Done when: the JSON is committed and the numbers are listed in `VALIDATION.md` under "Unreleased".

### [ ] T36 · 1.x saves convert to CEO runs

Depends on: T06, T13, T20
Files: `src/systems/company.js`, `src/systems/staff.js`, `src/systems/board.js`, `tests/migration-2-test.cjs` (new)
Do: the Migration section of the design: rank → phase, facilities → floors, 1.x staff → department heads, the board at confidence 60. Offer it on load as a choice: "Continue in classic mode" or "Convert to CEO mode". Keep the original as a backup.
Done when: tests convert saves from 0.9, 1.0 and 1.1 fixtures and play 10 weeks without errors.

### [ ] T37 · Cutover: CEO mode by default

Depends on: T35, T36, T17, T23, T11
Files: `src/engine.js`, `src/app.js`, all affected tests, `README.md`, `docs/rules.md`
Do: new runs default to CEO mode (classic stays available from the New label dialog). Update tests that assumed 1.1 defaults. Rewrite README and rules for 2.0.
Done when: all checks pass and a full browser play-test (desktop and phone) is noted in `VALIDATION.md` under "Unreleased". Do not add a version heading; the owner releases 2.0.

### [ ] T38 · Installable now, Play Store ready later

Depends on: T07
Files: `manifest.webmanifest` (new), `sw.js` (new), `icons/` (new), `index.html`, `src/app.js`, `docs/android.md` (new)
Do:

- A web app manifest (landscape, standalone, theme colors) and a service worker that caches the game files for offline play. Original icons at 192 and 512 px, plus a 512 px Play Store icon and a 1024 × 500 feature graphic.
- Opening a panel pushes a history entry, so the Android back button (and the browser back button) closes the top panel instead of leaving the game.
- Check for anything that would break inside a wrapper: absolute paths, network calls during play, features only available from `file://`. `docs/android.md` lists the steps a later Play Store build takes (a Trusted Web Activity or Capacitor) and what is already in place.
  Done when: Chrome's Lighthouse "installable" check passes when served locally; back closes the top panel in the harness; the game still opens from the ZIP via `index.html` (the service worker only registers over http/https).
