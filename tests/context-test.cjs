// Every interactive moment fits its context (3.0, T57). Plays CEO runs and checks each decision card,
// notice and news line as it appears: the people and albums it names exist and are in the right state,
// story conditions still hold, and no classic-only wording or unfilled placeholder slips through.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
// Words that belong to classic runs only.
const CLASSIC =
  /label rank|Bedroom Label|Indie Imprint|Rising Label|Major Contender|Powerhouse|Greatest of All Time|on the lot|lot tile|yearly goal|\bY\d+ goal/i;
const PLACEHOLDER = /\{[a-zA-Z]+\}|undefined|NaN|\[object/;

function checkCard(s, e, where) {
  const texts = [e.title, e.body, ...e.options.flatMap((o) => [o.label, o.hint])].filter(Boolean);
  for (const t of texts) {
    assert.doesNotMatch(t, CLASSIC, `${where}: classic wording in "${t}"`);
    assert.doesNotMatch(t, PLACEHOLDER, `${where}: placeholder in "${t}"`);
  }
  if (e.artist != null && e.type !== "approval")
    assert.ok(
      s.artists.some((a) => a.id === e.artist),
      `${where}: ${e.type} card names an artist who left`,
    );
  if (e.type === "album") {
    const p = s.albums.find((x) => x.id === e.album);
    assert.ok(p?.released, `${where}: album card for an unreleased album`);
    assert.ok(p.age <= p.salesWeeks, `${where}: album card after the earning run`);
  }
  if (e.type === "tourDay" || e.type === "tour")
    assert.ok(
      s.tours.some((t) => t.id === e.tour && t.status === "active"),
      `${where}: tour card without an active tour`,
    );
  if (e.type === "approval") assert.ok(s.company.board, `${where}: approval without a board`);
  if (e.type === "awards") assert.equal((s.week - 1) % 52, 0, `${where}: awards away from a year boundary`);
  if (e.type === "story") {
    const arc = G.ARCS.find((a) => a.id === e.arc),
      beat = arc.beats.find((b) => b.id === e.beat),
      run = s.company.stories.arcs.find((r) => r.arc === e.arc && r.pending === e.beat);
    assert.ok(run, `${where}: story card without its arc`);
    const who = e.subject
      ? G.storyDue(s) && { kind: e.subject.kind, ref: e.subject.ref }
      : s.artists.find((a) => a.id === e.artist);
    if (!e.subject)
      assert.ok(
        G.storyHolds(s, who, beat.when || {}, run.flags),
        `${where}: ${e.arc}/${e.beat} out of context`,
      );
  }
}
function checkNotes(s, where) {
  for (const n of s.notifications) {
    assert.doesNotMatch(`${n.title} ${n.body || ""}`, CLASSIC, `${where}: notice "${n.title}"`);
    assert.doesNotMatch(`${n.title} ${n.body || ""}`, PLACEHOLDER, `${where}: notice "${n.title}"`);
  }
  for (const line of s.news.slice(0, 5)) {
    assert.doesNotMatch(line, CLASSIC, `${where}: news "${line}"`);
    assert.doesNotMatch(line, PLACEHOLDER, `${where}: news "${line}"`);
  }
}
const tryIt = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};
/** A simple CEO player: loans, signings, albums, releases, a tour now and then, funding when offered. */
function play(seed, weeks) {
  const s = G.create(seed, { ceo: true });
  let cards = 0;
  const kinds = new Set();
  for (let w = 0; w < weeks && !s.finished; w++) {
    const where = `seed ${seed} week ${s.week}`;
    for (let i = 0; s.event && i < 20; i++) {
      checkCard(s, s.event, where);
      cards++;
      kinds.add(s.event.type || "classic");
      const free = s.event.options.findIndex((o) => !o.cost && !o.defer);
      tryIt(() => G.choose(s, free >= 0 ? free : 0)) ?? tryIt(() => G.choose(s, s.event.options.length - 1));
    }
    checkNotes(s, where);
    for (const n of [...s.notifications]) G.acknowledgeMilestone(s, n.id);
    for (const p of s.albums) p.launchReview = false;
    tryIt(() => G.acknowledgeCampaignReview(s));
    tryIt(() => G.ackReview(s));
    tryIt(() => G.ackGrab(s));
    tryIt(() => G.acknowledgeIPO(s));
    for (const x of [...(s.company.inbox || [])]) tryIt(() => G.decide(s, x.id, 0));
    if (s.week === 1) tryIt(() => G.takeFunding(s, "loan"));
    if (s.company.phase === 2 && !s.company.board) tryIt(() => G.takeFunding(s, "angel", 0));
    if (s.artists.length < Math.min(G.slots(s), 3)) tryIt(() => G.sign(s, s.candidates[0]?.id, 1));
    for (const a of s.artists) {
      if (!a.contract.remaining) tryIt(() => G.renew(s, a.id, 1));
      const booth = s.booths.find((b) => !s.albums.some((p) => !p.released && p.booth === b.id));
      if (booth && !G.busy(s, a.id) && a.contract.remaining && G.inspirationInfo(a).canRecord)
        tryIt(() =>
          G.record(s, {
            artistId: a.id,
            boothId: booth.id,
            genre: a.genre,
            audience: a.audience,
            budget: 4000,
          }),
        );
    }
    for (const p of s.albums.filter((x) => !x.released && x.production)) {
      if (p.launchReview) p.launchReview = false;
      const d = p.production;
      if (d.releaseReady) tryIt(() => G.releaseAlbum(s, p.id, p.title));
      else if (!d.cooldown) {
        if (!d.review) tryIt(() => G.decideStage(s, p.id, 0));
        tryIt(() => G.continueProduction(s, p.id));
      }
    }
    if (s.week % 40 === 0) {
      const p = s.albums.find((x) => x.released && s.week - x.releaseWeek < 20);
      if (p) tryIt(() => G.startTour(s, { albumId: p.id, scale: "regional", mode: "solo" }));
    }
    tryIt(() => G.advance(s));
  }
  return { s, cards, kinds };
}

test("every card, notice and news line in CEO runs fits its moment", () => {
  const kinds = new Set();
  let cards = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = play(seed, 160);
    cards += r.cards;
    r.kinds.forEach((k) => kinds.add(k));
  }
  assert.ok(cards > 40, `${cards} cards seen`);
  for (const k of ["story", "album", "companyEvent"])
    assert.ok(kinds.has(k), `saw ${k} cards (${[...kinds]})`);
});

test("the documented list names every kind of card the game can show", () => {
  const doc = require("fs").readFileSync(require("path").join(__dirname, "../docs/interactions.md"), "utf8");
  for (const type of ["companyEvent", "approval", "story", "album", "tourDay", "awards"])
    assert.ok(doc.includes("`" + type + "`"), `interactions.md lists ${type}`);
});

console.log(`\n${count} context tests passed.`);
