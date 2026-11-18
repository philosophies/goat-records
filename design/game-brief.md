# Goat Records — game brief

Renamed from Side A: Label Empire in 0.9. The name has not been checked for trademarks. A single-player record-label management game about turning talent into a lasting catalog while deciding what success costs. The requested balance is business management plus personal and industry drama. Artist age groups and target listener groups both include Youth, Teen and Adult.

## Identity and core decisions

Use the broad appeal of a creative-business management simulation: recruit, develop, produce, release, reinvest. Create original rules, dialogue, interface, characters, art, audio and progression from the beginning. Merely changing visuals and audio later would leave too much of the game's identity undecided. Our distinct systems are audience trust versus temporary attention, artist wellbeing, recording-room legacies, and delayed PR consequences.

Core loop: scout talent → reserve a limited roster slot → choose album sound, audience and production resources → manage staff and recording time → release → respond to the press and rivals → collect catalog income and award prestige → expand label capacity.

The interesting tension is between immediate cash, public attention, durable fan trust, artistic growth and label reputation. A player should be able to succeed as a careful boutique label or a high-volume hitmaker. Version 1.0 grades each 20-year run, so careful and high-volume labels can both reach five stars.

## Artists and audiences

Separate age group from primary audience. An Adult artist may write for Youth listeners; a Teen artist may reach Adult listeners. Do not infer personality, genre, talent or morality from age. Prototype ages are static categories; aging, birthdays, guardians, education schedules and transition into adulthood belong in a later pass. Youth artists get longer production time and a gentler energy drain in the prototype. Add explicit guardian approval and firm workload limits before deeper story content involving young artists.

Artist stats: craft, fans, trust, energy, temporary attention; preferred genre and core audience. Future additions: songwriting, performance, ambition, loyalty, creative autonomy, mentorship and burnout. Artist fame, reputation, potential, market value and album-count contracts are implemented in 0.3. Avoid adding stats without a decision they improve.

Six launch genres: Rap, R&B, Pop, Country, Sacred and Rock. Sacred covers devotional and spiritual music; keep its subgenres and audience representation thoughtful. Age does not restrict genre. Start with transparent artist/genre fit and ranked room stats; later use subgenres, crossovers, audience fatigue, trends and artist preferences.

## Label, employees and rooms

Roster capacity is fixed by label rank, not freely purchased: 2 / 3 / 4 / 6 / 7 / 8. Since 0.9 each rank needs fame plus releases, facilities, chart peaks, awards and cash, so a publicity spike cannot instantly create infrastructure. See design/gdd/label-ranks.md.

Staff roles implemented:

| Position | Management function |
| --- | --- |
| VP / operations | Reduces roster operating costs |
| Marketing | Improves album revenue |
| Artist Development | Improves training and album quality |
| Public Relations | Reduces immediate trust damage from publicity choices |
| Producer | Improves recording quality |
| A&R | Reduces recruitment fees |

Later roles: business affairs for contracts/rights; distribution lead for reach and release timing; finance controller for forecasts and debt; touring manager only when touring exists. Staff now have named candidate pools, skills, hiring fees, salaries, role-specific paid recruitment drives and replacement/severance decisions. Traits and promotion remain future work. Do not add all of those to the first economy.

Ranked recording rooms serve as production slots and reputational assets. Each hit adds room prestige; its history improves later recordings. Prototype ranks: The Living Room, Neon Vault, Voltage Chapel, Skyline Sound, Platinum Works and Legend Hall. Equipment, production-team strength, building cost and upkeep increase with rank; rooms have no genre affinity. Future rooms could gain a named signature sound, attract artists and compete for preservation versus modernization.

## Production and finance

Prototype 0.2 albums occupy one booth and one artist and spend $4k/$8k/$12k up front. Five interactive stages take five weeks, or six for Youth artists: Creative Direction, Songwriting, Recording, Mix & Master and Campaign Planning. Each decision scores an area using artist craft, the chosen approach, staff expertise, label and booth stats, fit and current trends. Animated contribution rows and rating counters reveal the result. The average of the five ratings determines album quality. Revenue lasts 12 weeks with exponential decay. Marketing, current fan trust and attention modify revenue. Genre trends are locked into an album's launch multiplier. Artist development costs energy and money; free time restores energy. Catalog income survives an artist leaving.

Production stages are implemented in the rules prototype. Final review supports renaming and 1–3 selected-area reshuffles based on artist level; reshuffles can lower ratings. Release-day strategies and animated Critics, Fan response and Market impact calculations set a persistent sales multiplier. Music video, press run and live-appearance packages are now implemented as up-front investments with added production time. Basic 1/3/5-album advances, salaries, royalties and paid renewals are implemented. Label income is after royalties; the catalog also shows gross revenue. Masters, recoupment and licensing rights remain future work. Prototype dollars are abstract balance units.

## Events, rivals and awards

Every four weeks, pause for a three-choice industry event. Every eight weeks, a rival encounter replaces the generic event. Show the immediate numerical effect and delayed risk in the MVP so players can learn causality. Keep the delayed consequence in a visible queue. Later offer uncertainty ranges and artist-specific reactions.

Prototype rival: Marlowe, Goldline Records CEO, offers chart feuds or collaborative showcases. Future CEOs need strategies and memory: a prestige purist, aggressive commercial operator, regional community builder. Their rosters, release calendars and reactions should change the market, rather than only appearing in dialogue.

PR examples include leaked demos, endorsements conflicting with artistic identity, and overloaded promotional schedules. Durable trust and short-lived attention are different resources. Future recurring story chains should remember past promises and allow recovery, apology, boundary-setting and relationship repair.

Annual Silver Groove Awards accept one current-year released album per genre. Quality, critics, fan reception, chart achievement and jury variation decide competition against rival nominees. The Top 300 draws from 320 rival releases, refreshed with twenty new entries every four weeks. Release-day estimates remain separate from official weekly standings; seven milestone tiers reward chart progress.

## Optional expansion: The Velvet Circle

An entirely fictional secretive industry network offers adult artists unnatural promotional reach. This is an optional story mode about escalating pressure and creative autonomy, not a claim about actual musicians or organizations. Youth and Teen artists are excluded from these contracts.

Give each deal a visibility multiplier, obligation meter, public polarization, private artist trust, exit cost and possible career interruption. Initial boosts can be huge; repeated demands become harder and stranger: abandoning a signature sound, publicly insulting a mentor, staging a false rivalry, or accepting an exclusive performance that alienates fans. Refusal can trigger distribution sabotage or a temporary career hiatus. Studio revenue, recruitment reputation and staff loyalty can suffer. Include principled exits, protection of the artist and rebuilding paths; avoid a forced doom sequence or treating self-destruction as the only compelling outcome.

Build only after base systems support consequences, contracts and recovery. Prototype does not contain this expansion.

## Technical direction and milestones

**Current deliverable: browser rules prototype.** Plain JavaScript keeps the simulation independently testable and enables immediate Windows play without installing an engine. Responsive layout prepares touch interaction; Android device behavior still needs testing. It is not an APK or executable.

**M1 — Validate the loop.** Play at least three seasons. Record the first confusing decision, first cash crisis, dominant strategy, frequency of meaningful choices, and which artist stories the player remembers. Tune cash, production length, fame thresholds and event frequency. Exit criterion: a new player can sign, produce, release and interpret a PR consequence without help; several strategies remain viable.

**M2 — Choose native packaging after that test.** Recommended native engine: Godot, using a 2D UI and data-driven content. Godot documents Windows and Android exports. Windows first avoids Android signing and device setup during initial iteration. Android requires export tooling, touch/back navigation testing, suspend/resume persistence and release signing. Alternative: retain the web code and use an Android wrapper; evaluate actual mobile save behavior and packaging before committing. Porting the JavaScript simulation to GDScript would be real work, so lock this choice before building a large art/content pipeline.

**M3 — Native vertical slice.** One playable year, original studio presentation, six genres, roughly 12 crafted artists, two rival strategies, 20 authored PR events with follow-ups, clear financial forecast, settings, save slots, tutorial and an exportable Windows build. Test both loss and recovery. Choose portrait/landscape based on device playtest; the current prototype simply reflows.

**M4 — Android and release preparation.** Device testing, offline/resume tests, readable touch targets, packaging/signing, original art/music, sound controls, accessibility, store assets and pricing. A store release is separate from a playable local MVP. No dates or fees committed yet.

**M5 — Expanded careers.** Aging, contracts, staff depth, richer rivals, singles and tours only after the album loop holds up. Then consider The Velvet Circle.

## Mentoring and collaboration

Each iteration should explain one system, change one meaningful variable, and compare the observed result. Player feedback is most useful as a concrete moment: “I could not afford the third album,” “the viral choice felt automatic,” or “I wanted to keep that artist despite low sales.” Keep game balance in the simulation and all presentation replaceable. Don't commission final art or music before the core loop earns another playthrough.

Official export references: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html and https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html . Recommendations here are development judgments, not estimates of store approval or profitability.

## Version 0.3 management pass

Paid artist scouting has three budgets with distinct pool size, craft, potential and fan distributions. Every Team position has three candidates and role-specific budgeted refreshes. Skill scales expertise and passive business effects.

Albums now have four campaign-quarter events (earning weeks 3/6/9/12), plus calendar-quarter industry spotlights. Decisions change sales, artist reputation/fame/trust, label reputation and campaign length. Temporary sales boosts cap at 1.8x and album extensions at 18 earning weeks. Events queue and persist through reload.

Contracts consume album commitments at release. Expired artists require renewal for new projects and stop drawing salary. Existing album royalty rates survive renewal or departure. Artist valuation responds to stats and reputation, so success raises renewal costs.

Training has diminishing gains, rising fees, a three-week cooldown and a potential/artist-level/label-rank ceiling. Release XP increased to 3. A reproducible 60-season sample shows local discoveries improving roughly 21 craft points and national headliners roughly 9 in year one, with no artist reaching 100. Optimal scripted strategies remain forgiving; human playtests should examine business pressure, event repetition and dominant production choices before calling balance final.

## Version 0.4 production investment and touring

Six genre-neutral room ranks replace booth affinity, while preserving existing room ownership and hit prestige. Building and weekly operating costs increase with equipment and resident crew quality. Album packages include music video, press run, live appearances and a one-album Star Producer. Each adds one production week, fees are paid up front, and rating contributions are visible in the existing calculation flow.

Revenue expectations lock at recording start using market value, prior label album revenue to date and production investment. Final assessment waits until extended earning windows end, and applies morale plus artist/label reputation and fame penalties for shortfalls. Low morale influences later ratings; idle recovery and successful releases provide recovery paths. Legacy releases are not retroactively judged.

Tours turn album popularity into a separate risk/reward business: regional four-week, national eight-week and world twelve-week show schedules, with setup losses and growing ticket potential. Solo emphasizes individual artist growth and fatigue, labelmate emphasizes joint revenue and low fatigue while reserving two roster members, and rival partnerships introduce recruitment and poaching decisions. Every tour day has an interactive choice affecting quality and itinerary. Seven resolved days settle one label week. Checkpoints can invest in demand, insert paid recovery time, or risk an early ending. Tour accounting includes event fees and remains separate from album revenue, royalties and regular salaries. Daily animated cumulative net and a one-time break-even banner make the recovery of setup costs visible.

The first-year badge remains a checkpoint. Continue career allows late albums and tours to finish beyond week 52. Annual award timing continues. Native packaging, bespoke tour art/audio, deeper rival strategy and final economic balance remain future work.


## Prototype 0.5 career economy

Ten XP levels spread growth over a longer career. Emerging through Icon recognition, decaying momentum, annual awards and career revenue influence artist value and new contract costs. New recordings pay distribution fees; VP expertise lowers them. Expectations use 95% of the prior album revenue rather than demanding automatic growth. Existing album economics and signed rates remain intact. Eight rotating CEO scenarios affect actual company relationships, staffing, loyalty and distribution arrangements. See README.md for current operating rules and VALIDATION.md for verification limits.


## Inspiration

Version 0.6 adds a release-and-recovery cycle: inspiration resets to zero at release and recovers weekly between projects. Minimum recording requires 25, while 50/75/90 progressively improve outcome odds through deterministic stage modifiers before session variation. Inspiration locks at recording, with no retroactive changes to old projects. This encourages rotating artists and choosing between a rushed album and a longer creative break. See README.md for thresholds and rates.


## Tour timing and economy revision

Version 0.7 makes the interaction clock explicit: daily settlement precedes a choice about future days. Recovery, fatigue, ordinary shows and final days receive context-specific events rather than the same random prompt. Ticket boosts count upcoming shows, recovery energy is delivered on rest days, and itinerary limits appear in the choice text. A shared revenue function supports both booking and remaining-run forecasts. Balanced gate receipts and safe low-fee options make profitability within the original schedule attainable without requiring extensions or risky publicity. Low demand, paid upgrades, fatigue and early endings retain financial risk.


## Multi-day tour cadence

Version 0.8 treats choices as short operating plans rather than daily interruptions. One shared budget limits all tours to three reviews per label week. Ordinary plans last three days, recovery plans cover the recovery and next show, and promotions are reviewed only after their specified shows. The calendar still settles daily; a fast-forward action stops before another decision or weekly production boundary. Final dates close without adding a fourth review.

## Version 0.9 label growth

Three systems borrowed in spirit from studio-management sims give the label a visible shape and a reason to experiment:

- **Label ranks** replace fame-only tiers. Goals are listed up front, promotion happens at the weekly settlement, and each rank unlocks roster slots, a larger lot, facilities, room tiers and themes. See design/gdd/label-ranks.md.
- **Album themes** add a discovery loop. A genre + theme combo reveals its fit only after recording; combos level up with releases, and quick repeats lose Reach. See design/gdd/album-themes.md.
- **Headquarters** turns label investment into a floor plan. Facilities give stage bonuses, takings and artist care; neighbors pair up for extra effects; artists appear where they work. See design/gdd/headquarters.md.

Players who ignore headquarters stay at Bedroom Label and keep the lower development ceiling. The seeded sample in BALANCE.json compares both approaches. Next steps are in production/roadmap.md.

## Version 1.0 the lot

The label's building is now the game screen, as in studio-management sims of this kind: a pixel-art cutaway where staff and artists move between rooms, menus open over it, and a live clock runs until a decision needs the player. A 20-year campaign gives each year a goal and ends with a star grade and New Game+. Rented recording locations and paid gigs add Kairosoft-style leveling and training income; hot streaks, lead singles and ads make success visible and give money a second use. See design/gdd/presentation.md, campaign.md, locations.md and promotion.md.

