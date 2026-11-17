# Presentation: the lot and the live clock

## Overview

The headquarters lot is the main screen. A cutaway building sits on a street under a sky: facility rooms fill the upper floors, and the ground floor holds the lobby and the label's recording rooms. Staff and artists walk between rooms. Time runs on a clock with Pause, 1×, 2× and 4×. Menu screens open as a panel beside the lot, and decisions appear as cards over it.

## Player fantasy

Watching the label work. Weeks roll by, artists head to the booth when an album starts, the team wanders between rooms, and the game stops only when it needs a decision.

## Rules

- Top bar: cash, fame, reputation, roster, awards, date (year, week, day), label rank, trend, status chips added by features, and the clock.
- One tick takes about 4 seconds at 1×, 2 seconds at 2× and 1 second at 4×. A tick does exactly what Next week does: the next tour activity while a tour is on the road, otherwise one week. A thin bar shows progress to the next tick; the day counts up with it.
- The clock holds, and the top bar names the reason, while any of these is present: the season is over, an industry or tour event, an album decision, stage results, a release review, release results, a chart milestone, an unseen rank-up, a notice with a button, an open menu panel, an open build popover, or a reason a feature adds.
- When the hold clears, time resumes only if the player had a speed selected. Pressing Pause always stays paused.
- A new label starts paused with a hint. The chosen speed is remembered between visits.
- Clicking a lot tile opens a popover to build, upgrade, move or close a facility. The Headquarters menu lists facilities, the rank ladder and pairings, and can point to a facility on the lot.
- Recording artists stand in the Vocal Booth, Mix Suite or Writers' Room, else their recording room on the ground floor. Idle artists stand in the Artist Lounge, Rehearsal Hall or Listening Bar, else the lobby. Touring artists are away; a tour bus waits at the curb. Hired staff work from the lobby and visit rooms that match their role.
- Speech bubbles mark album releases, chart milestones, new themes, new facilities and upgrades, rank-ups, new hires and signings.

## Edge cases

- Starting an album closes the studio panel so the first decision shows over the lot.
- A decision card can be set aside with View the lot; the clock stays held, and the pause reason in the top bar reopens it.
- If a tick fails, the clock pauses and the message is shown.
- With reduced motion, people stand still in their rooms and nothing drifts or bounces.
- When the browser tab is hidden, the clock does not advance.

## Acceptance

Covered by `tests/clock-test.cjs` (speeds, every hold reason, resume rules, agreement with the engine across a full album) and `tests/ui-test.cjs` (lot render, menu panels, clock holds, building and moving on the lot). Screens are in `production/qa/evidence/v1.0-lot-*.png`.
