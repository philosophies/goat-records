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

### [x] T11 · Calendar, Contacts and Wallet apps

Depends on: T10
Files: `src/ui/phone.js`, `tests/phone-ui-test.cjs`
Do:

- Calendar: the next review, releases, tour dates and contract ends, sorted.
- Contacts: every artist and staff member with search, each opening their panel.
- Wallet: cash, budget left (after T21), debt and share price (after T31; show "—" before).
  Done when: each app renders from state in the harness; a Contacts entry opens an artist panel.

## M4 People

### [x] T12 · Departments and executives

Depends on: T01
Files: `src/data/staff.js` (new), `src/systems/staff.js` (new), `src/engine.js`, `index.html`, `tests/staff-test.cjs` (new)
Do:

- `DEPARTMENTS` table from design 3.6. Executives have skill, salary, ambition, loyalty and influence (generator by phase reach).
- Hiring a department head, adding department staff (capacity), and firing with severance.
- CEO runs only.
  Done when: tests cover hiring, capacity, salaries at settlement and firing costs.

### [x] T13 · Departments drive the existing role effects

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

### [x] T14 · Artist team pool and chemistry

Depends on: T12
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do:

- `TEAM_ROLES` from design 3.5, with phase unlocks and role weights. Hire team members into a pool and assign them to artists (an artist can share a member at `sharedEffect`).
- Chemistry is 0.6–1.4 from genre fit, personality and history, and is shown before assigning.
  Done when: tests cover the slot unlocks, sharing, the chemistry range and determinism for a seed.

### [x] T15 · Team effects on records and tours

Depends on: T14, T13
Files: `src/systems/staff.js`, `src/engine.js` (stage score and tour hooks), `tests/staff-test.cjs`
Do: apply `team effect = Σ skill × weight × chemistry` to the stage rows (the producer on Recording and Mix, the A&R rep on Songwriting), the publicist to fame and scandal defence, and the tour manager to tour profit and energy. Each shows as its own row in the stage calculation.
Done when: tests show each role changes only its results; the rows appear in the stage breakdown.

### [x] T16 · Artist traits, wants and morale

Depends on: T14
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do: traits (ego, discipline, loyalty, work rate) and one main want (money, control, fame, family). Morale moves with wants met or ignored; low morale raises demand events (T27) and walk-outs at contract end.
Done when: tests cover each want, morale bounds and the walk-out rule.

### [x] T17 · People panels

Depends on: T15, T16, T08
Files: `src/ui/places.js`, `src/ui/staff.js` (new), `styles/ceo.css`, `tests/staff-ui-test.cjs` (new)
Do: the artist panel gains a Team section (slots, assign with chemistry preview, traits, wants, morale). Department floors open their department panel (head, staff, capacity, hire).
Done when: the harness assigns a producer through clicks and shows the chemistry before confirming.

## M5 The board

### [x] T18 · Funding and the board's seats

Depends on: T02
Files: `src/data/board.js` (new), `src/systems/board.js` (new), `src/engine.js`, `index.html`, `tests/board-test.cjs` (new)
Do:

- Director archetypes from design 3.3 (agenda weights, patience). Funding offers: a bank loan, an angel, venture rounds and terms.
- Taking money adds seats and dilutes `s.company.ownership`. A board appears only once outside money is taken.
  Done when: tests cover each offer, dilution, the seat count and "no board without investors".

### [x] T19 · Board confidence

Depends on: T18
Files: `src/systems/board.js`, `tests/board-test.cjs`
Do: implement director satisfaction and board confidence from design 4, with targets set at the last review. Show the reasons (what moved each director).
Done when: tests check the formula on fixed inputs and that each agenda reacts to its metric.

### [x] T20 · The periodic review

Depends on: T19
Files: `src/systems/board.js`, `src/systems/company.js` (`boardApproved`), `tests/board-test.cjs`
Do:

- Reviews happen only while a board exists, which needs outside money (T18). A label with no board has no reviews and cannot be fired.
- A yearly review (twice yearly after the IPO) sets budget, perks and creative freedom using design 4.
- Probation and the no-confidence vote follow design 3.3. A lost vote is game over: the run ends with outcome "Fired" (`s.finished`, a `fired` flag) and goes to the final review.
- With a board, phase advancement needs its vote.
  Done when: tests cover each confidence band, probation, both vote results, the >50% ownership protection, the fired ending (no further weeks can be played) and that a label without a board never gets a review.

### [x] T21 · Budget and creative freedom in play

Depends on: T20
Files: `src/systems/board.js`, `src/engine.js` (spending entry points), `tests/board-test.cjs`
Do: track spending against the period budget. Over budget: the action still works but costs confidence, scaled by the overage. Low freedom: big signings, risky themes and new genres raise an approval request (an Inbox decision) before they happen.
Done when: tests cover under, at and over budget, and each approval case for each freedom level.

### [x] T22 · Lobbying and promises

Depends on: T20
Files: `src/systems/board.js`, `tests/board-test.cjs`
Do: meet a director (a week of your time), promise a target (kept +trust, broken −2×) or trade a favor. Promises are checked at the next review.
Done when: tests cover each action and the promise check.

### [x] T23 · The boardroom

Depends on: T20, T09
Files: `src/ui/board.js` (new), `styles/ceo.css`, `tests/board-ui-test.cjs` (new)
Do:

- A boardroom floor in the HQ opens the board panel: directors with portraits, their satisfaction and the reasons.
- The review plays as a scene: each director's score, then the vote on budget, perks and freedom. The clock is stopped.
  Done when: the harness plays a review through to its settings; reduced motion skips the animation.

## M6 Politics

### [x] T24 · Power grabs

Depends on: T12, T20
Files: `src/data/staff.js`, `src/systems/staff.js`, `tests/staff-test.cjs`
Do: the power grab chance from design 4, gossip two quarters ahead in the Inbox, and the five responses (promote, placate, sideline, fire, counter) with their effects.
Done when: tests force a grab by seed and cover each response.

### [x] T25 · How a grab ends

Depends on: T24
Files: `src/systems/staff.js`, `src/systems/board.js`, `src/ui/staff.js`, `tests/staff-test.cjs`
Do: success means co-CEO (your freedom splits) or the CEO chair (run ends). Failure means the executive leaves for a rival and tries to take an artist (that artist's loyalty is checked).
Done when: tests cover each ending; the UI shows the outcome card.

## M7 Opportunities and crises

### [x] T26 · Event framework 2.0

Depends on: T01
Files: `src/data/events.js` (new), `src/systems/events.js` (new), `src/engine.js`, `index.html`, `tests/events-test.cjs` (new)
Do:

- Data-driven events: `id`, `kind` (opportunity, crisis or politics), `phases`, `weight`, `when` (conditions as data), `deadlineWeeks`, and `choices` with `cost`, `effects` and `chance`.
- One interpreter applies effects (`cash`, `fame`, `confidence`, `morale`, `artistFame`, `delayAlbum`, `loan`, …).
- In CEO runs it feeds the existing event queue; 1.1 events stay for 1.1 runs.
  Done when: tests cover the condition checks, the deadline expiry (worst choice applied), every effect type and determinism for a seed.

### [x] T27 · Opportunities pack

Depends on: T26, T16
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 14 opportunities across phases (sync licensing, brand deals, festival slots, viral moments, catalog buys, distribution deals, a streaming exclusive, a remix contest, a documentary, a feature request from a star). Each choice has a tested effect.
Done when: every event fires in a test that sets up its conditions, and every choice is checked.

### [x] T28 · Crises pack

Depends on: T26
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 16 crises (leak, arrest, lawsuit, sample clearance, poaching, payout cut, studio damage, artist walk-out, tax audit, bad review storm, tour cancellation, a manager stealing, a rival diss track, a contract dispute, burnout, a market slump).
Done when: as T27.

### [x] T29 · Politics pack

Depends on: T26, T22
Files: `src/data/events.js`, `tests/events-test.cjs`
Do: at least 10 politics events (a director's pet signing, an exec feud, an artist feud, a board leak, a takeover rumor, a director resigning, an activist investor, staff asking for a raise, a union push, credit-taking).
Done when: as T27.

## M8 Money and the IPO

### [x] T30 · Revenue streams by phase

Depends on: T02, T26
Files: `src/data/company.js`, `src/systems/company.js`, `tests/company-test.cjs`
Do:

- Phase-gated income: beats for hire and local downloads (1), streams and merch (2), distribution and radio (3), sync and brand deals (4), publishing and catalog (5).
- Each shows in the weekly finance history. Add bigger costs that grow with phase (rent, insurance, interest).
  Done when: tests cover each stream's unlock and the finance history lines.

### [x] T31 · Company value and shares

Depends on: T30, T18
Files: `src/systems/company.js`, `tests/company-test.cjs`
Do: company value and share price from design 4; `s.company.shares` (total, yours, investors). Show them in the Wallet.
Done when: tests check the formula on fixed inputs and that rounds dilute correctly.

### [x] T32 · The IPO and analysts

Depends on: T31, T20
Files: `src/systems/company.js`, `src/systems/board.js`, `src/ui/company.js`, `tests/company-test.cjs`
Do:

- IPO requirements from design 3.11. The IPO raises cash for 25% of the company.
- Half-yearly analyst targets; beating or missing them moves the share price and confidence. Reviews become twice-yearly. An IPO scene (bell ringing) on the street.
  Done when: tests cover the requirements, the price, the targets and the review cadence.

### [x] T33 · Acquisitions

Depends on: T31
Files: `src/systems/company.js`, `src/data/company.js`, `tests/company-test.cjs`
Do: buy a rival's catalog or a small label (artists join, the catalog earns, debt possible). The board votes on deals above budget.
Done when: tests cover a cash purchase, a debt purchase and a board veto.

## M9 Finish

### [x] T34 · Run ending and grade

Depends on: T32, T25
Files: `src/systems/campaign.js`, `src/data/campaign.js`, `tests/campaign-test.cjs`
Do: CEO runs score company value, ownership share, hits, awards, artists developed and kept-the-chair (design 3.11). "Fired" and "Folded" endings each have their own final review text. Being fired is game over: the final review, then a new label, with legacy points as after any ended run. Legacy points and New Game+ work for CEO runs.
Done when: tests cover each ending's score and New Game+ carry-over.

### [x] T35 · CEO balance sample

Depends on: T34, T27, T28, T29
Files: `tests/ceo-balance.cjs` (new), `CEO-BALANCE.json` (generated)
Do: script three policies (careful, average, reckless) through 20-year CEO runs, 12 seeds each. Record phase reached by year, fired, folded, IPO year, final grade. Tune data until careful rarely gets fired, reckless often does, and strong play can go public by year 12.
Done when: the JSON is committed and the numbers are listed in `VALIDATION.md` under "Unreleased".

### [x] T36 · 1.x saves convert to CEO runs

Depends on: T06, T13, T20
Files: `src/systems/company.js`, `src/systems/staff.js`, `src/systems/board.js`, `tests/migration-2-test.cjs` (new)
Do: the Migration section of the design: rank → phase, facilities → floors, 1.x staff → department heads, the board at confidence 60. Offer it on load as a choice: "Continue in classic mode" or "Convert to CEO mode". Keep the original as a backup.
Done when: tests convert saves from 0.9, 1.0 and 1.1 fixtures and play 10 weeks without errors.

### [x] T37 · Cutover: CEO mode by default

Depends on: T35, T36, T17, T23, T11
Files: `src/engine.js`, `src/app.js`, all affected tests, `README.md`, `docs/rules.md`
Do: new runs default to CEO mode (classic stays available from the New label dialog). Update tests that assumed 1.1 defaults. Rewrite README and rules for 2.0.
Done when: all checks pass and a full browser play-test (desktop and phone) is noted in `VALIDATION.md` under "Unreleased". Do not add a version heading; the owner releases 2.0.

### [x] T38 · Installable now, Play Store ready later

Depends on: T07
Files: `manifest.webmanifest` (new), `sw.js` (new), `icons/` (new), `index.html`, `src/app.js`, `docs/android.md` (new)
Do:

- A web app manifest (landscape, standalone, theme colors) and a service worker that caches the game files for offline play. Original icons at 192 and 512 px, plus a 512 px Play Store icon and a 1024 × 500 feature graphic.
- Opening a panel pushes a history entry, so the Android back button (and the browser back button) closes the top panel instead of leaving the game.
- Check for anything that would break inside a wrapper: absolute paths, network calls during play, features only available from `file://`. `docs/android.md` lists the steps a later Play Store build takes (a Trusted Web Activity or Capacitor) and what is already in place.
  Done when: Chrome's Lighthouse "installable" check passes when served locally; back closes the top panel in the harness; the game still opens from the ZIP via `index.html` (the service worker only registers over http/https).

# 3.0: the dynasty update

Design: `design/gdd/ceo-3.0.md`. CEO mode only; classic mode is hidden and gets no new features.

## M10 One ladder

### [x] T40 · The phase replaces the label rank

Depends on: T37
Files: `src/data/company.js`, `src/systems/label.js`, `src/systems/campaign.js`, `src/app.js`, `src/ui/*.js`, tests
Do: add slots, theme slots, room tier and development ceiling to each phase (design 1). In CEO runs `tier`, `slots`, theme slots and the ceiling read the phase. Hide the rank chip, rank requirements and the classic yearly goal in CEO runs; move their rewards into phase goals. The year review reports the phase.
Done when: a CEO run shows one ladder in every panel (harness), phase changes unlock rooms and slots (tests), and the classic fingerprint is unchanged.

### [x] T41 · Hide classic mode

Depends on: T40
Files: `index.html`, `src/app.js`, `src/engine.js`, `README.md`, `docs/rules.md`, tests
Do: the New label dialog only starts CEO runs. A classic save still loads and plays, with an offer to convert. Remove classic from player-facing docs.
Done when: no route in the interface starts a classic run (harness); classic saves load.

## M11 West Coast dynasty look

### [x] T42 · Theme: black, red and gold

Depends on: T41
Files: `styles/*.css`, `src/ui/*.js`, `icons/`, `index.html`
Do: design 2. Palette, type, buttons, cards, HUD and dialogs; an original goat emblem; original slogans. No real label's name, logo or art.
Done when: screenshots at desktop and phone width in `production/qa/evidence/`; text contrast at least 4.5:1.

### [x] T43 · Building art

Depends on: T42
Files: `src/ui/street.js`, `styles/street.css`
Do: new pixel art for each building that changes with level (signage, lights, trim); palms, lowriders and chain-link on the street; day and night.
Done when: evidence for every building at levels 1, 5 and 10, day and night.

### [x] T44 · Room art

Depends on: T42
Files: `src/ui/lot.js`, `src/ui/street.js`, `styles/*.css`
Do: interiors for each room type that change with level (equipment, lighting, people working).
Done when: evidence for every room type at three levels.

## M12 Roster tiers and superstars

### [x] T45 · Roster tiers

Depends on: T40
Files: `src/data/roster.js` (new), `src/systems/roster.js` (new), tests
Do: rising, star and superstar slots by phase (design 1); moving up needs fame and a hit, dropping follows a run of flops; tier caps on recording budget, marketing, tour scale and team size.
Done when: tests for slots per phase, promotion, demotion and every cap.

### [x] T46 · The face of the company

Depends on: T45
Files: `src/systems/roster.js`, `src/data/events.js`, tests
Do: superstar news moves company value, share price and revenue; superstar-only events (endorsements, scandals, feuds); a CEO relationship that swings sharply.
Done when: tests show each effect and the swing size.

### [x] T47 · Second act

Depends on: T46
Files: `src/systems/roster.js`, `src/systems/board.js`, `src/systems/campaign.js`, `src/ui/*.js`, tests
Do: on being fired or ousted, a superstar with enough relationship and loyalty may follow you to a new company: phase 1 again, keeping that superstar and a legacy bonus. With nobody willing, the run ends.
Done when: tests for both outcomes; the ending screen offers the second act.

## M13 Album making

### [x] T48 · Listening parties

Depends on: T45
Files: `src/data/label.js`, `src/engine.js`, `src/ui/*.js`, tests
Do: design 4. After Mix & master: a party reports sentiment by audience and area; rework the weakest area, change the lead single, or release. Diminishing returns and a growing leak risk.
Done when: tests for the report, each choice and the diminishing return; harness plays one party.

## M14 Long progression

### [x] T49 · Artist levels

Depends on: T45
Files: `src/data/roster.js`, `src/systems/roster.js`, tests
Do: XP from sessions, releases, tours and events; levels 1–30 with tier caps and milestone perks.

### [x] T50 · Building and floor levels to 10

Depends on: T40
Files: `src/data/company.js`, `src/systems/company.js`, tests
Do: up to level 10 with rising costs, gated by phase; each level shows on the art (T43, T44).

### [x] T51 · Staff, executive and team growth

Depends on: T49
Files: `src/data/staff.js`, `src/systems/staff.js`, tests
Do: XP from work, paid training, skill ceilings that rise with seniority, promotions.

### [x] T52 · Pacing pass

Depends on: T49, T50, T51
Files: `tests/ceo-balance.cjs`, `CEO-BALANCE.json`, data tables
Do: report the year each measure peaks; tune so the strongest labels still grow after year 15.

## M15 Stories

### [x] T53 · Authored cast

Depends on: T45
Files: `src/data/cast.js` (new), `src/engine.js`, `src/systems/staff.js`, tests
Do: about 30 authored artists and 20 authored staff, executives and directors (name, look, genre, backstory, traits, arc); scouting draws from the cast by reach, with generated people only as a fallback.

### [x] T54 · Story engine

Depends on: T53
Files: `src/systems/stories.js` (new), `src/data/stories.js` (new), tests
Do: arcs as chains of beats with flags, context conditions, cooldowns and follow-ups; a story log per character.

### [x] T55 · Story pack: artists

Depends on: T54
Do: at least 60 beats across the cast: debuts, rivalries, family, legal trouble, comebacks, collaborations.

### [x] T56 · Story pack: staff, executives, board and rivals

Depends on: T54
Do: at least 60 beats.

### [x] T57 · Every interactive moment fits its context

Depends on: T55, T56
Files: `docs/interactions.md` (new), event data, tests
Do: list every event, decision, prompt and banner with when it may appear; fix any that can appear out of context; tests assert the conditions.

### [x] T58 · Story so far and why

Depends on: T54
Files: `src/engine.js`, `src/systems/*.js`, `src/ui/*.js`, tests
Do: design 7.2. Each character's panel shows their story log as a short timeline. Tier changes, relationship swings, board votes, valuation moves and leaks store a cause breakdown and show it behind a "Why?" toggle. The Wallet gets a monthly ledger by source.
Done when: tests that each listed change records its causes and the ledger sums to the cash change; harness opens a story log and a "Why?" breakdown.

## M16 Long-term play

### [x] T59 · The first fifteen minutes

Depends on: T41
Files: `src/data/onboarding.js`, `src/systems/onboarding.js`, `src/ui/*.js`, tests
Do: design 7.1. A skippable checklist of five goals with rewards from a table, a Settings toggle, no stage cooldown on a run's first album, and one-time tips the first time each feature matters. Not shown in a second act.
Done when: tests for each goal's reward, skipping, the toggle and the second act; a test that a default run releases its first album by week 6; harness plays the checklist to the end.

### [x] T60 · Rival labels and feuds

Depends on: T54
Files: `src/data/rivals.js`, `src/systems/rivals.js`, `src/ui/*.js`, tests
Do: design 7.3. Three rivals per run from eight authored labels, four CEO personalities, strength scaled by your phase. Rival releases in the charts with chart battles, poaching bids (match, counter, let go) and your own bids from phase 3, feud standing with diss and award events, and buying a weak rival from phase 5.
Done when: tests for rival setup, chart battles, each poaching answer, feud standing, and an acquisition moving the catalog; balance report shows rivals poach without emptying a careful label's roster; harness answers a bid.

### [x] T61 · Music eras

Depends on: T40
Files: `src/data/eras.js`, `src/systems/eras.js`, `src/engine.js`, `src/ui/*.js`, tests
Do: design 7.4. Four eras with revenue multipliers, event pool weights and marketing costs. Each change of era moves one or two years earlier or later at random when the run starts (never less than two years per era). An announcement 13 weeks ahead with the invest-early choice.
Done when: tests for each era's multipliers, the random shift (always 1–2 years, same for the same seed, every era at least two years), the announcement timing and the invest-early bonus; balance report shows the best-earning release plan differs between at least two eras.

### [x] T64 · Catalog: a second life for old albums

Depends on: T61
Files: `src/data/catalog.js`, `src/systems/catalog.js`, `src/ui/vault.js`, `src/ui/*.js`, tests
Do: design 7.5. Fresh, catalog and classic status; weekly catalog income scaled by era; deluxe editions, anniversary reissues, sample requests, sync licensing, greatest hits and fan mail through the inbox; a Vault panel listing the catalog and its offers.
Done when: tests for each status, each offer and its conditions, income by era, and old saves loading with their albums classed; balance report shows catalog income share by year 10 between 10% and 25%; harness takes one offer from the Vault.

### [x] T62 · Legacy and challenges

Depends on: T47
Files: `src/data/legacy.js`, `src/systems/legacy.js`, `src/ui/*.js`, tests
Do: design 7.6. A hall of fame stored outside the save, about 30 achievements, six challenge starts plus a weekly seed, and small legacy perks capped at 5%.
Done when: tests that each run ending records a hall of fame entry, achievements unlock once, challenge starts are identical for the same seed, and perks stay within their cap; harness starts a challenge run.

### [x] T63 · Late-game delegation

Depends on: T51
Files: `src/data/delegation.js`, `src/systems/delegation.js`, `src/ui/*.js`, tests
Do: design 7.7. Renewal rules at phase 3, tour booking within a cap at phase 4, department autopilot policies at phase 5, and a chief operating officer for small inbox decisions at phase 6. A monthly summary of every automated action. Never touches story, superstar or board choices.
Done when: tests for each unlock, its limits, the summary, and that story, superstar and board decisions are never automated; balance report shows a delegated phase-6 label within 10% of the hand-played result; harness sets a policy.

## After 3.0: owner answers and release readiness

### [x] T65 · Owner answers: empty roster, board floor, renewal limits

Depends on: T63
Files: `src/engine.js`, `src/data/board.js`, `src/systems/board.js`, `src/data/delegation.js`, `src/systems/delegation.js`, `src/ui/*.js`, tests
Do: Owner decisions of 2026-11-22. (1) The piracy years keep album sales at 0.7×. (2) A CEO label with no artists may sign one up-and-comer even with reputation under 30. (3) A board that refuses spending still allows a minimum album budget each period; at a review with high confidence the CEO can negotiate a bigger minimum as a perk. (4) The default delegated renewal wage limit rises with the phase.
Done when: tests for the empty-roster signing (only one, only up-and-comers, only while empty), the album floor under a refusing board, the review negotiation and its limits, and the renewal limit by phase; rules updated; balance report rerun.

### [x] T66 · A compact top bar on phones

Files: `styles/*.css`, `src/app.js`, tests
Do: The handoff's open item: the top bar takes about a third of the phone screen. Fold the stats into one row and the controls into another at phone width, keeping every value reachable.
Done when: at 390 × 844 the top bar takes at most a fifth of the screen in a CEO run; harness and screenshots at phone and desktop width.

### [x] T67 · Carry the hall of fame with saves

Depends on: T62
Files: `src/ui/legacy.js`, `src/app.js`, tests
Do: Exported saves carry the browser's hall of fame and achievements; importing merges them (no duplicates, newest first, the hall cap kept). Old exports without them still import.
Done when: a harness exports, clears storage, imports and finds the same hall and achievements; a merge test with overlapping runs.

### [x] T68 · A full playthrough, performance and 3.0 notes

Depends on: T65
Files: `production/qa/`, `CHANGELOG.md`, tests
Do: Play a 20-year CEO run in the browser end to end with every 3.0 system; measure week times late in a run; draft 3.0 notes under Unreleased (no version heading).
Done when: a playthrough report with screenshots, a performance budget test, and the Unreleased notes.

### [x] T69 · Android wrapper

Files: `android/` or `twa/`, `docs/android.md`
Do: Build the wrapper the Android guide describes and check it in an emulator if one can run here. A test on a physical device stays with the owner.
Done when: the wrapper builds, the guide lists the steps, and what was and was not tested is written down.

### [x] T70 · Balance, continuity and playability audit

Depends on: T65, T68
Files: any, tests
Do: Analyse the game for imbalances, continuity breaks (wording, dates, names, states that contradict each other) and anything that can stall or soft-lock a run. Fix what is found and record the rest.
Done when: an audit report in `production/qa/`, every fix with a test, and the balance report rerun.

## After the audit: owner answers of 2026-11-22

### [x] T71 · Prestige points and hall of fame perks

Depends on: T62
Files: `src/ui/*.js`, `docs/rules.md`, tests
Do: Owner decision: the two "legacy" ideas get clearly different names. In CEO runs, New Game+ points become prestige points (earned from a run's score, spent on starting bonuses) and the achievement perks become hall of fame perks (opened by achievements, kept in the browser). The new-label dialog explains each in one line. Save keys stay the same.
Done when: no CEO screen says "legacy points" or "legacy perks"; a harness checks both names and their explanations; classic text unchanged.

### [x] T72 · Rivals that keep pace

Depends on: T60
Files: `src/data/rivals.js`, `src/systems/rivals.js`, `src/ui/*.js`, tests
Do: Owner decision: rivals stay a threat at every phase. Rival records are benchmarked on the label's own recent releases, not a fixed table; rival strength climbs faster from phase 4; a weak rival can be taken over by a stronger one; a rival that leaves the charts is replaced by a new label.
Done when: tests for the benchmark, faster growth, takeovers and replacements; the balance report shows hand players winning well under 90% of chart battles; rules updated.

### [x] T73 · Studio capacity and touring

Depends on: T63
Files: `src/data/company.js`, `src/engine.js` or a system, `src/systems/delegation.js`, tests
Do: Owner decision: the label can only make so many albums at once (by phase), so touring is how idle artists earn while the studio is full. Albums already in production when a save loads are kept. The head of Live books tours for artists waiting on the studio.
Done when: tests for the limit, old saves over the limit, and the delegated booking; the balance report's delegated label within 10% of hand play; rules updated.

### [ ] T74 · Investing in a streaming platform

Depends on: T61
Files: `src/data/company.js` or a new data file, a system, `src/ui/*.js`, tests
Do: Owner decision: late-game cash can buy into a streaming platform that inflates the label's sales numbers. Stakes rise in steps with rising prices; each lifts album sales and chart units. Shown in the Company panel.
Done when: tests for buying each stake, the sales lift and save round trips; balance report shows late cash being spent; rules updated.
