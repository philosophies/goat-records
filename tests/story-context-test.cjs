// Stories in context (3.0, T80): what an artist is doing decides which stories they walk into; stories
// run over several cards; choices can cut tour dates, call off a tour, dent album sales or lose the
// label the artist.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { CONTEXT_ARCS, STORY_CONTEXT } = require("../src/data/story-context.js");
const { GENRES } = require("../src/data/core.js");
const CONTEXTS = ["headlining", "sharing", "recording", "albumOut", "waiting"];
const EFFECTS = [
  "morale",
  "fans",
  "trust",
  "energy",
  "attention",
  "cash",
  "reputation",
  "artistFame",
  "labelFame",
  "mult",
  "boostWeeks",
  "tourMult",
  "tourWeeks",
  "tourCut",
  "tourEndChance",
  "tourEnd",
  "leaveChance",
  "leaves",
];
const STORY = ["set", "next", "relation", "xp", "loyalty", "rival"];
const WHEN = ["releases", "fame", "morale", "touring", "flags", "context", "genre", "tier", "hit"];
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

// A CEO label with one artist, choices played as written (chance is checked in its own test).
function label(genre = "Rap", seed = 80, tier = "star") {
  const s = G.create(seed, { ceo: true });
  G.setFixedOutcomes(s, true);
  s.company.phase = 3;
  s.cash = 1e7;
  s.company.stories = { arcs: [], log: {}, lastWeek: -10 };
  s.event = null;
  s.eventQueue = [];
  s.week = 40;
  G.sign(s, s.candidates[0].id, 3);
  const a = s.artists.at(-1);
  a.genre = genre;
  a.morale = 60;
  a.fame = 40;
  a.tier = tier;
  album(s, a, 30);
  return { s, a };
}
function album(s, a, weeksAgo, extra = {}) {
  const p = {
    id: s.nextId++,
    artist: a.id,
    title: "Record " + s.nextId,
    released: true,
    releaseWeek: s.week - weeksAgo,
    quality: 70,
    salesWeeks: 8,
    boosts: [],
    ...extra,
  };
  s.albums.push(p);
  return p;
}
function tour(s, a, mode = "solo", partner = null) {
  const t = {
    id: s.nextId++,
    album: s.albums.find((p) => p.artist === a.id).id,
    title: "Road",
    artist: a.id,
    artists: [a.id, ...(partner ? [partner.id] : [])],
    artistName: a.name,
    partnerName: partner?.name || null,
    rival: mode === "rival" ? { name: "Vale Ostrander" } : null,
    mode,
    status: "active",
    startWeek: s.week,
    elapsed: 1,
    day: 9,
    plannedDays: 28,
    baseDays: 28,
    quality: 70,
    effects: [],
    history: [],
    net: 0,
  };
  s.tours.push(t);
  return t;
}
const arcOf = (id) => G.ARCS.find((a) => a.id === id);
function due(s, a, arcId) {
  return G.storyDue(s).find((x) => x.arc.id === arcId && x.a?.id === a.id);
}
function play(s, a, arcId, choice) {
  const d = due(s, a, arcId);
  assert.ok(d, `${arcId} is due`);
  G.playStory(s, d);
  s.event = s.eventQueue.shift();
  const card = s.event;
  G.choose(s, choice);
  return card;
}

test("every arc is well formed, set in a context, and covers every context and genre", () => {
  const beats = CONTEXT_ARCS.reduce((n, a) => n + a.beats.length, 0);
  assert.ok(beats >= 30, `${beats} beats`);
  assert.ok(CONTEXT_ARCS.filter((a) => a.beats.length > 1).length >= 10, "multi-part stories");
  const byContext = Object.fromEntries(CONTEXTS.map((c) => [c, 0])),
    byGenre = Object.fromEntries(GENRES.map((g) => [g, 0]));
  for (const arc of CONTEXT_ARCS) {
    assert.equal(arc.who, "artist", arc.id);
    for (const c of [].concat(arc.start.context)) {
      assert.ok(CONTEXTS.includes(c), `${arc.id} context ${c}`);
      byContext[c]++;
    }
    for (const g of arc.start.genre ? [].concat(arc.start.genre) : GENRES) {
      assert.ok(GENRES.includes(g), `${arc.id} genre ${g}`);
      byGenre[g]++;
    }
    const ids = arc.beats.map((b) => b.id),
      setFlags = new Set();
    for (const k of Object.keys(arc.start)) assert.ok(WHEN.includes(k), `${arc.id} start ${k}`);
    for (const b of arc.beats) {
      assert.ok(b.title && b.body && b.choices.length >= 2, `${arc.id}/${b.id}`);
      assert.ok(
        b.choices.some((c) => !c.cost),
        `${arc.id}/${b.id} has a free choice`,
      );
      for (const t of [b.title, b.body, b.headline || ""])
        assert.ok(
          !/\{(?!name\}|label\}|partner\}|rival\}|rivalCeo\})/.test(t),
          `${arc.id}/${b.id} placeholder`,
        );
      if (/\{rival/.test(b.title + b.body + (b.headline || "")))
        assert.ok(arc.rival, `${arc.id} names a rival`);
      for (const k of Object.keys(b.when || {})) assert.ok(WHEN.includes(k), `${arc.id}/${b.id} when ${k}`);
      for (const c of [].concat(b.when?.context || [])) assert.ok(CONTEXTS.includes(c), `${arc.id}/${b.id}`);
      if (b.id !== ids[0]) assert.ok(b.lapse !== undefined || !b.when, `${arc.id}/${b.id} can lapse`);
      for (const c of b.choices) {
        for (const k of Object.keys(c))
          assert.ok(["label", "note", "cost", "story", ...EFFECTS].includes(k), `${arc.id} ${k}`);
        for (const k of Object.keys(c.story || {})) assert.ok(STORY.includes(k), `${arc.id} story ${k}`);
        if (c.story?.next) assert.ok(ids.includes(c.story.next), `${arc.id}/${b.id} → ${c.story.next}`);
        for (const f of Object.keys(c.story?.set || {})) setFlags.add(f);
        for (const k of ["leaveChance", "tourEndChance"]) if (c[k]) assert.ok(c[k] > 0 && c[k] < 1);
        // A tour can only be changed by a beat that plays on tour.
        if (c.tourCut || c.tourMult || c.tourEnd || c.tourEndChance) {
          const ctx = [].concat(b.id === ids[0] ? arc.start.context : b.when?.context || []);
          assert.ok(
            ctx.length && ctx.every((x) => x === "headlining" || x === "sharing"),
            `${arc.id}/${b.id}`,
          );
        }
      }
    }
    for (const b of arc.beats)
      for (const f of Object.keys(b.when?.flags || {})) assert.ok(setFlags.has(f), `${arc.id} reads ${f}`);
  }
  for (const c of CONTEXTS) assert.ok(byContext[c] >= 2, `${c}: ${byContext[c]} arcs`);
  for (const g of GENRES) assert.ok(byGenre[g] >= 5, `${g}: ${byGenre[g]} arcs`);
  const all = CONTEXT_ARCS.flatMap((a) => a.beats.flatMap((b) => b.choices));
  for (const k of ["leaves", "leaveChance", "mult", "tourCut", "tourEnd", "tourEndChance", "tourMult"])
    assert.ok(
      all.some((c) => c[k] && (k !== "mult" || c[k] < 1)),
      `some choice has ${k}`,
    );
});

test("what an artist is doing: headlining, sharing, recording, album out or waiting", () => {
  const { s, a } = label();
  assert.equal(G.storyContext(s, a), "waiting");
  const p = album(s, a, 2);
  assert.equal(G.storyContext(s, a), "albumOut");
  p.releaseWeek = s.week - STORY_CONTEXT.albumOut - 1;
  assert.equal(G.storyContext(s, a), "waiting");
  s.albums.push({ id: s.nextId++, artist: a.id, released: false, boosts: [] });
  assert.equal(G.storyContext(s, a), "recording");
  s.albums.pop();
  const t = tour(s, a);
  assert.equal(G.storyContext(s, a), "headlining");
  t.mode = "rival";
  assert.equal(G.storyContext(s, a), "sharing");
  t.status = "completed";
  assert.equal(G.storyContext(s, a), "waiting");
});

test("stories start only in their context and genre", () => {
  const { s, a } = label("Rap");
  assert.ok(!due(s, a, "diss-on-stage"), "not on tour");
  assert.ok(due(s, a, "cryptic-posts"), "waiting, low morale");
  const t = tour(s, a);
  assert.ok(due(s, a, "diss-on-stage"), "headlining rapper");
  assert.ok(!due(s, a, "cryptic-posts"), "busy on tour");
  assert.ok(!due(s, a, "co-headline-chill"), "R&B and Pop only, and shared tours");
  a.genre = "Pop";
  assert.ok(!due(s, a, "diss-on-stage"), "rap only");
  t.mode = "labelmate";
  assert.ok(due(s, a, "co-headline-chill"), "shared Pop tour");
  assert.ok(!due(s, a, "opening-act-rant"), "headliners only");
  t.status = "completed";
  s.albums.push({ id: s.nextId++, artist: a.id, released: false, boosts: [] });
  assert.ok(due(s, a, "the-leak"), "recording");
  s.albums.pop();
  album(s, a, 1);
  assert.ok(due(s, a, "stream-farm"), "album out");
  assert.ok(!due(s, a, "the-leak"));
});

test("a feud on tour runs over three cards, cuts dates, and follows the artist home", () => {
  const { s, a } = label("Rap");
  const t = tour(s, a);
  let card = play(s, a, "diss-on-stage", 0); // let it ride
  assert.match(card.headline, new RegExp(a.name));
  assert.equal(t.effects.at(-1).mult, 1.3, "ticket demand up");
  // The next card follows on at once, without the usual wait between a person's stories.
  s.week += 1;
  const next = due(s, a, "diss-on-stage");
  assert.equal(next.beat.id, "venues-pull-out");
  assert.ok(next.soon);
  const days = t.plannedDays;
  card = play(s, a, "diss-on-stage", 2); // drop the cities that balked
  assert.equal(t.plannedDays, days - 5);
  assert.ok(card.storyNotes.includes("5 tour dates cut"));
  // The last card waits until the tour is over.
  s.week += 5;
  assert.ok(!due(s, a, "diss-on-stage"), "still on tour");
  t.status = "completed";
  s.week += 1;
  assert.ok(!due(s, a, "diss-on-stage"), "the usual wait between a person's stories");
  s.week += 2;
  card = play(s, a, "diss-on-stage", 2);
  assert.equal(card.beat, "it-follows-home");
  const run = s.company.stories.arcs.find((r) => r.arc === "diss-on-stage");
  assert.ok(run.done);
  assert.deepEqual(
    G.storyLog(s, a).map((x) => x.arc),
    ["diss-on-stage", "diss-on-stage", "diss-on-stage"],
  );
});

test("a story that misses its moment ends instead of waiting forever", () => {
  const { s, a } = label("Rap");
  const t = tour(s, a);
  play(s, a, "diss-on-stage", 0);
  t.status = "completed"; // the tour ended before the venues could pull out
  s.week += 1 + arcOf("diss-on-stage").beats[1].lapse + 1;
  assert.ok(!due(s, a, "diss-on-stage"));
  assert.ok(s.company.stories.arcs.find((r) => r.arc === "diss-on-stage").done);
  // The artist is free for other stories again.
  s.week += 4;
  assert.ok(G.storyDue(s).some((x) => x.a?.id === a.id && x.arc.id !== "diss-on-stage"));
});

test("a tour can be called off by a story, with a note for the outcome card", () => {
  const { s, a } = label("Pop");
  const partner = s.artists.find((x) => x !== a) || a;
  const t = tour(s, a, "labelmate", partner === a ? null : partner);
  if (partner === a) t.mode = "rival";
  play(s, a, "co-headline-chill", 1);
  s.week += 1;
  const card = play(s, a, "co-headline-chill", 2); // call off the remaining dates
  assert.equal(t.status, "ended early");
  assert.ok(card.storyNotes.includes("The rest of the tour was called off"));
  assert.ok(card.major);
  assert.ok(!G.onTour(s, a.id));
});

test("a scandal in release week dents album sales", () => {
  const { s, a } = label("Country");
  const p = album(s, a, 1);
  const card = play(s, a, "old-posts", 2); // stand by them
  assert.equal(card.album, p.id, "the latest album");
  const hit = p.boosts.at(-1);
  assert.equal(hit.mult, 0.75);
  assert.equal(hit.until - hit.start, 4, "five weeks");
  assert.ok(card.storyNotes.includes("Album sales ×0.75 for 5 weeks"));
});

test("an artist can leave the label, ending their tour; one mid-record stays to finish it", () => {
  let { s, a } = label("Rock");
  const t = tour(s, a);
  play(s, a, "band-blows-up", 0);
  t.status = "completed";
  s.week += 8;
  const n = s.artists.length;
  play(s, a, "band-blows-up", 2); // let them go
  assert.equal(s.artists.length, n - 1);
  assert.ok(!s.artists.includes(a));
  assert.ok(s.notifications.some((x) => x.kind === "departure" && x.title === `${a.name} left the label`));
  assert.ok(s.company.why.some((x) => x.kind === "departure"));
  assert.ok(s.company.stories.arcs.find((r) => r.arc === "band-blows-up").done);

  ({ s, a } = label("Rap"));
  const t2 = tour(s, a);
  play(s, a, "diss-on-stage", 0);
  t2.status = "completed";
  s.week += 9;
  // Leaving partway through a tour ends it: play a leaving choice on that card while on tour.
  const t3 = tour(s, a);
  const card = {
    type: "story",
    arc: "diss-on-stage",
    beat: "it-follows-home",
    title: "x",
    body: "x",
    artist: a.id,
    options: [{ label: "Walk", leaves: true, storyChoice: 0 }],
  };
  s.company.stories.arcs.find((r) => r.arc === "diss-on-stage").pending = "it-follows-home";
  s.event = card;
  G.choose(s, 0);
  assert.equal(t3.status, "ended early");
  assert.ok(!s.artists.includes(a));

  ({ s, a } = label("R&B"));
  s.albums.push({ id: s.nextId++, artist: a.id, released: false, boosts: [] });
  s.company.stories.arcs.push({
    arc: "contract-fight",
    artist: a.id,
    next: "the-letter",
    flags: {},
    week: s.week,
    done: false,
    pending: "the-letter",
  });
  s.event = {
    type: "story",
    arc: "contract-fight",
    beat: "the-letter",
    title: "A letter",
    body: "x",
    artist: a.id,
    options: [{ label: "Let them buy their way out", leaves: true, cash: 25000, storyChoice: 2 }],
  };
  const morale = a.morale;
  G.choose(s, 0);
  assert.ok(s.artists.includes(a), "stays to finish the record");
  assert.equal(a.morale, morale + STORY_CONTEXT.leaveMorale);
});

test("leaving and cancelling are bold calls, and chance decides them", () => {
  const { s, a } = label("Sacred");
  G.setFixedOutcomes(s, false);
  s.company.stories.lastWeek = -10;
  let left = 0,
    stayed = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const x = roundTrip(s);
    x.seed = seed;
    const d = due(
      x,
      x.artists.find((y) => y.id === a.id),
      "cryptic-posts",
    );
    G.playStory(x, d);
    x.event = x.eventQueue.shift();
    x.week += 3;
    G.choose(x, 2); // let them vent
    x.company.lastOutcome.seen = true;
    if (!x.artists.some((y) => y.id === a.id)) {
      left++; // letting a star vent can lose them already
      continue;
    }
    x.week += 8;
    const d2 = due(
      x,
      x.artists.find((y) => y.id === a.id),
      "cryptic-posts",
    );
    assert.equal(d2.beat.id, "the-announcement");
    G.playStory(x, d2);
    x.event = x.eventQueue.shift();
    assert.deepEqual(G.optionRisks(x, x.event), ["safe", "steady", "bold"]);
    G.choose(x, 2); // call their bluff: 45% × 1.75 for a star, a 79% chance they go
    const gone = !x.artists.some((y) => y.id === a.id);
    if (gone) {
      left++;
      assert.ok(x.company.lastOutcome.effects.some((e) => e.name === `${a.name} left the label`));
      assert.ok(x.company.lastOutcome.major);
    } else stayed++;
    assert.match(x.company.lastOutcome.headline, /stepping away/);
  }
  assert.ok(left > 15 && stayed > 3, `${left} left, ${stayed} stayed`);
});

test("only stars and superstars leave after a story, and at higher odds", () => {
  const S = STORY_CONTEXT;
  const bluff = arcOf("cryptic-posts").beats[1].choices[2],
    letGo = arcOf("band-blows-up").beats[1].choices[2];
  const tiered = (tier) => ({ tier });
  // Up-and-comers: no chance of leaving; told to go, they lose morale instead.
  const rookieBluff = G.storyDepartureOdds(tiered("rising"), bluff);
  assert.equal(rookieBluff.leaveChance, undefined);
  assert.equal(rookieBluff.morale, bluff.morale);
  const rookieGo = G.storyDepartureOdds(tiered("rising"), letGo);
  assert.equal(rookieGo.leaves, undefined);
  assert.equal(rookieGo.morale, S.leaveMorale);
  assert.doesNotMatch(G.storyChoiceText(rookieGo), /leaves the label/);
  // Stars and superstars: the card's chance raised, up to the cap.
  assert.equal(
    G.storyDepartureOdds(tiered("star"), bluff).leaveChance,
    Math.round(bluff.leaveChance * S.leaveScale.star * 100) / 100,
  );
  assert.equal(
    G.storyDepartureOdds(tiered("superstar"), bluff).leaveChance,
    Math.min(S.leaveMax, bluff.leaveChance * S.leaveScale.superstar),
  );
  assert.equal(G.storyDepartureOdds(tiered("superstar"), letGo).leaves, true);
  // Played through the engine: an up-and-comer told to go stays.
  const { s, a } = label("Rock", 80, "rising");
  const t = tour(s, a);
  play(s, a, "band-blows-up", 0);
  t.status = "completed";
  s.week += 8;
  const card = play(s, a, "band-blows-up", 2);
  assert.ok(s.artists.includes(a), "an up-and-comer stays");
  assert.ok(!card.options[2].leaves);
});

test("the card text names every consequence when outcomes are shown", () => {
  const text = G.storyChoiceText(arcOf("soft-tickets").beats[0].choices[2]);
  assert.match(text, /Trust -2, energy \+25, a 70% chance the rest of the tour is called off\./);
  assert.match(G.storyChoiceText(arcOf("old-posts").beats[0].choices[2]), /album sales ×0\.75 for 5 weeks/);
  assert.match(G.storyChoiceText(arcOf("band-blows-up").beats[1].choices[2]), /\{name\} leaves the label/);
  assert.match(G.storyChoiceText(arcOf("wrecked-suite").beats[0].choices[1]), /2 tour dates cut/);
});

test("a shared-tour card names the other act, and saves with context stories load", () => {
  const { s, a } = label("R&B");
  tour(s, a, "rival");
  const d = due(s, a, "co-headline-chill");
  G.playStory(s, d);
  const card = s.eventQueue.at(-1);
  assert.match(card.title, /Vale Ostrander/);
  assert.match(card.headline, new RegExp(`${a.name} and Vale Ostrander`));
  const loaded = roundTrip(s);
  assert.ok(G.validSystemsSave(loaded));
  // Saves from before this pack load as they are.
  delete loaded.company.stories;
  assert.ok(G.validSystemsSave(loaded));
});

console.log(`${count} story context tests passed`);
