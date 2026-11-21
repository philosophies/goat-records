// Story pack: artists (3.0, T55). Structure, reachability and a play of every cast artist's arc.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { ARTIST_ARCS } = require("../src/data/story-artists.js");
const { CAST_ARTISTS } = require("../src/data/cast.js");
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
];
const STORY = ["set", "next", "relation", "xp", "loyalty"];
const WHEN = [
  "phase",
  "tier",
  "fame",
  "morale",
  "relation",
  "releases",
  "hit",
  "sinceRelease",
  "touring",
  "cash",
  "flags",
];

test("at least 60 beats, an arc for every cast artist, and the five themes covered", () => {
  const beats = ARTIST_ARCS.reduce((n, a) => n + a.beats.length, 0);
  assert.ok(beats >= 60, `${beats} beats`);
  const arcs = new Map(G.ARCS.map((a) => [a.id, a]));
  for (const c of CAST_ARTISTS) {
    assert.ok(arcs.has(c.arc.id), `${c.id} has an arc`);
    assert.equal(arcs.get(c.arc.id).who, "cast");
  }
  for (const id of [
    "debut-nerves",
    "legal-trouble",
    "collab-offer",
    "comeback-trail",
    "superstar-ego",
    "tour-burnout",
  ])
    assert.equal(arcs.get(id)?.who, "artist", id);
  assert.equal(new Set(G.ARCS.map((a) => a.id)).size, G.ARCS.length, "arc ids are unique");
});

test("every beat is well formed and reachable, and every flag it reads is set somewhere", () => {
  for (const arc of ARTIST_ARCS) {
    const ids = arc.beats.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, arc.id);
    for (const k of Object.keys(arc.start || {})) assert.ok(WHEN.includes(k), `${arc.id} start ${k}`);
    const reached = new Set([ids[0]]),
      setFlags = new Set();
    for (const b of arc.beats) {
      assert.ok(b.title && b.body && b.choices.length >= 2, `${arc.id}/${b.id}`);
      assert.ok(
        b.choices.some((c) => !c.cost),
        `${arc.id}/${b.id} has a free choice`,
      );
      for (const t of [b.title, b.body])
        assert.ok(!/\{(?!name\}|label\})/.test(t), `${arc.id}/${b.id} placeholder`);
      for (const k of Object.keys(b.when || {})) assert.ok(WHEN.includes(k), `${arc.id}/${b.id} when ${k}`);
      for (const c of b.choices) {
        assert.ok(c.label, `${arc.id}/${b.id}`);
        for (const k of Object.keys(c))
          assert.ok(["label", "note", "cost", "story", ...EFFECTS].includes(k), `${arc.id} ${k}`);
        for (const k of Object.keys(c.story || {})) assert.ok(STORY.includes(k), `${arc.id} story ${k}`);
        if (c.story?.next) {
          assert.ok(ids.includes(c.story.next), `${arc.id}/${b.id} → ${c.story.next}`);
          reached.add(c.story.next);
        }
        Object.keys(c.story?.set || {}).forEach((f) => setFlags.add(f));
      }
    }
    for (const id of ids) assert.ok(reached.has(id), `${arc.id}/${id} is reachable`);
    for (const b of arc.beats)
      for (const f of Object.keys(b.when?.flags || {})) assert.ok(setFlags.has(f), `${arc.id} reads ${f}`);
  }
});

test("choice cards state every effect in numbers", () => {
  const c = {
    label: "x",
    note: "A line.",
    cost: 2000,
    cash: 4000,
    morale: 8,
    fans: -3,
    story: { xp: 2, relation: -4 },
  };
  assert.equal(
    G.storyChoiceText(c),
    "A line. Costs $2,000, earns $4,000, morale +8, fans -3, 2 career XP, relationship with you -4.",
  );
  assert.equal(G.storyChoiceText({ label: "x", story: {} }), "No change.");
  assert.equal(G.storyChoiceText({ label: "x", trust: -6 }), "Trust -6, a public scandal.");
  assert.equal(G.storyChoiceText({ label: "x", trust: -4 }), "Trust -4.");
});

test("only a story trust loss of 6 or more is a scandal for the board", () => {
  const s = G.create(81, { ceo: true });
  s.cash = 1e7;
  s.company.phase = 2;
  G.takeFunding(s, "angel", 0);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  s.albums.push({ id: 900, artist: a.id, released: true, quality: 82, releaseWeek: s.week, title: "Hit" });
  const before = s.company.board.scandals || 0;
  // first-hit's "Let them build their own team" costs 4 trust: private.
  G.playStory(
    s,
    G.storyDue(s).find((x) => x.arc.id === "first-hit"),
  );
  s.event = s.eventQueue.shift();
  G.choose(s, 1);
  s.week += 20;
  a.fame = 50;
  G.playStory(
    s,
    G.storyDue(s).find((x) => x.beat.id === "crowd"),
  );
  s.event = s.eventQueue.shift();
  assert.ok(s.event.options[1].privateTrust);
  G.choose(s, 1);
  assert.equal(s.company.board.scandals || 0, before);
  // A 6-point trust loss is public.
  s.event = {
    type: "story",
    arc: "first-hit",
    beat: "glow",
    artist: a.id,
    title: "A public row",
    body: "",
    options: [{ label: "x", trust: -6, hint: "", storyChoice: 0 }],
  };
  G.choose(s, 0);
  assert.equal(s.company.board.scandals, before + 1);
});

test("every cast artist's story starts for them and plays through a first choice", () => {
  for (const c of CAST_ARTISTS) {
    const s = G.create(71, { ceo: true });
    s.cash = 1e6;
    G.sign(s, s.candidates[0].id);
    const a = s.artists[0];
    Object.assign(a, { castId: c.id, name: c.name, fame: 50, morale: 50 });
    s.albums.push({ id: 900, artist: a.id, released: true, quality: 82, releaseWeek: s.week, title: "Hit" });
    const due = G.storyDue(s).find((x) => x.arc.id === c.arc.id);
    assert.ok(due, `${c.id}: ${c.arc.id} can start`);
    G.playStory(s, due);
    s.event = s.eventQueue.shift();
    assert.ok(!s.event.title.includes("{") && !s.event.options.some((o) => o.label.includes("{")), c.id);
    G.choose(s, 0);
    const run = s.company.stories.arcs.find((r) => r.arc === c.arc.id);
    assert.ok(run.done || run.next, c.id);
    assert.equal(G.storyLog(s, a).length, 1);
  }
});

console.log(`\n${count} artist story pack tests passed.`);
