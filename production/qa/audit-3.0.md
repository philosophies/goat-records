# 3.0 audit: balance, continuity and playability

Date: 2026-11-22. Build: main after T69, plus the fixes below.

## How it was checked

- **Random play.** A new suite, `tests/fuzz-test.cjs`, plays CEO runs with a random player: about 45 actions (signing, scouting, recording, releases, singles, ads, tours, funding, buildings, departments, rivals, Vault offers, delegation, the IPO, acquisitions, awards) and random answers to every card. Starting phase and challenges vary by seed. It flags any error that is not a normal refusal, any non-finite number, a save that fails to reload (checked every 13 weeks) and a run that stops moving. `run-checks` plays 4 runs of 5 years; the audit ran 40 runs of 20 years (`FUZZ_SEEDS=40 FUZZ_WEEKS=1045`).
- **Scripted play.** The 12-seed balance report (`tests/ceo-balance.cjs`) for the careful, average, reckless and delegated players, plus single-delegation runs (`DELEGATE=renew|tours|autopilot|coo`).
- **Browser.** The twenty-year playthrough in `playthrough-3.0.md`.

## Breaks found and fixed

| Problem                                                                                         | Effect                                                 | Fix                                                                      | Test                                |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------- |
| A rival whose artists were all bid away still tried to release a record                         | Every weekly advance threw; the run could not continue | The rival signs a newcomer before releasing                              | `rivals-test`                       |
| Late saves with a level 11+ album, or a fractional analyst revenue figure, were refused on load | Year-15+ saves would not reload                        | Load checks accept them; revenue is whole dollars (T68)                  | `late-save-ui-test`, `company-test` |
| Label reputation could fall to single figures with no way back                                  | Below 30 the label could never sign again              | Reputation below 40 recovers 1 point every 4 weeks, up to 40             | `company-test`                      |
| An empty roster below 30 reputation could not sign anyone                                       | Dead run                                               | One up-and-comer can be signed (T65)                                     | `owner-answers-test`                |
| The street trophy case line was cut off ("20 awards · 2 off…")                                  | Unreadable                                             | Shows waiting Vault offers when there are any, otherwise the award count | `vault-ui-test`                     |

After the fixes, 40 random twenty-year runs finished with no errors, broken saves or stalls (33 five-star, 2 four-star, 1 two-star; the rest ended early by their own choices). Classic mode is unchanged.

## Balance

Median final company value over 12 seeds: careful $993M, average $696M, reckless $22M. Careful and average players reach phase 6 in every run and none fold. Reckless players are fired in 7 of 12 runs. That spread looks right.

Things that look off:

1. **Late-game cash has nowhere to go.** Careful players hold $140M–$490M by year 20; random players $7M–$52M. After the IPO and acquisitions there is little to spend on.
2. **Delegated touring costs a quarter of the company's value** (−25% vs. hand play; renewals −1%, autopilot −2%, the COO 0%). Tours themselves pay (about $40k each, rarely a loss), but each one takes the artist out of the studio for roughly an album. Over twenty years that is about 110 fewer releases, and the catalog is what the company is worth. Raising the head of Live's budget cap or limiting them to one tour at a time made no difference.
3. **Rivals stop being a threat.** Careful and average players win 95–96% of chart battles; reckless players win 31%.
4. **Release plans.** Over the first 26 weeks, touring after a release beats rushing the next record in every era except tapes. Over a whole run the next record wins because of the catalog. Touring is the best move right now but the wrong one long term, which is fine. The head of Live just doesn't know that.

## Continuity

- New Game+ "legacy points" and the hall of fame's "legacy perks" are two different things with almost the same name.
- Every place, card and notice checked in the playthrough uses phase language in CEO runs; no classic-only text showed up.

## Questions for the owner

1. Late cash: add sinks (vanity projects, a foundation, buying back shares, a bigger acquisitions list), or let it pile up as the score?
2. Delegated tours: should the head of Live only book a tour when it is expected to earn more than the artist's next album, or should late-game tours pay more?
3. Rivals: should their strength grow faster after phase 4, or should rivals merge or buy each other to stay competitive?
4. Rename one of the two "legacy" ideas (for example, New Game+ "prestige points")?
