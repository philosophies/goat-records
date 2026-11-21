// Story pack: staff, executives, board and rivals (3.0, T56). Structure, and plays of a head's, a team
// member's, a director's and the label's stories through the engine.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { STAFF_ARCS } = require("../src/data/story-staff.js");
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
const STORY = ["set", "next", "skill", "loyalty", "ambition", "influence", "director", "confidence", "rival"];
const WHEN = [
  "phase",
  "cash",
  "flags",
  "board",
  "confidence",
  "public",
  "ownership",
  "labelFame",
  "dept",
  "skill",
  "ambition",
  "loyalty",
  "influence",
  "plotting",
  "weeks",
  "role",
  "assigned",
  "type",
  "satisfaction",
  "relationship",
];
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

function label(phase = 3) {
  const s = G.create(91, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e7;
  s.company.stories = { arcs: [], log: {}, lastWeek: -10 };
  return s;
}
function play(s, pred, choice) {
  const due = G.storyDue(s).find(pred);
  assert.ok(due, "a beat is due");
  G.playStory(s, due);
  s.event = s.eventQueue.shift();
  const card = s.event;
  G.choose(s, choice);
  return { due, card };
}

test("at least 60 beats across heads, team members, directors and the label", () => {
  const beats = STAFF_ARCS.reduce((n, a) => n + a.beats.length, 0);
  assert.ok(beats >= 60, `${beats} beats`);
  for (const who of ["head", "member", "director", "company"])
    assert.ok(
      STAFF_ARCS.some((a) => a.who === who),
      who,
    );
  assert.ok(STAFF_ARCS.filter((a) => a.rival).length >= 3, "rival stories");
  const castIds = new Set(require("../src/data/cast.js").CAST_EXECS.map((x) => x.id));
  for (const a of STAFF_ARCS.filter((a) => a.castId)) assert.ok(castIds.has(a.castId), a.id);
});

test("every beat is well formed, reachable, has a free choice and reads only flags it sets", () => {
  for (const arc of STAFF_ARCS) {
    const ids = arc.beats.map((b) => b.id),
      reached = new Set([ids[0]]),
      flags = new Set();
    for (const k of Object.keys(arc.start || {})) assert.ok(WHEN.includes(k), `${arc.id} start ${k}`);
    for (const b of arc.beats) {
      assert.ok(b.title && b.body && b.choices.length >= 2, `${arc.id}/${b.id}`);
      assert.ok(
        b.choices.some((c) => !c.cost),
        `${arc.id}/${b.id} free choice`,
      );
      for (const k of Object.keys(b.when || {})) assert.ok(WHEN.includes(k), `${arc.id}/${b.id} when ${k}`);
      for (const c of b.choices) {
        for (const k of Object.keys(c))
          assert.ok(["label", "note", "cost", "story", ...EFFECTS].includes(k), `${arc.id} ${k}`);
        for (const k of Object.keys(c.story || {})) assert.ok(STORY.includes(k), `${arc.id} story ${k}`);
        if (c.story?.next) {
          assert.ok(ids.includes(c.story.next), `${arc.id} → ${c.story.next}`);
          reached.add(c.story.next);
        }
        Object.keys(c.story?.set || {}).forEach((f) => flags.add(f));
      }
      for (const t of [b.title, b.body, ...b.choices.map((c) => c.label)])
        assert.ok(
          !/\{(?!name\}|label\}|dept\}|role\}|rival\}|rivalCeo\})/.test(t),
          `${arc.id}/${b.id}: ${t}`,
        );
      if (/\{rival/.test(b.title + b.body)) assert.ok(arc.rival, `${arc.id} names a rival`);
    }
    for (const id of ids) assert.ok(reached.has(id), `${arc.id}/${id} reachable`);
    for (const b of arc.beats)
      for (const f of Object.keys(b.when?.flags || {})) assert.ok(flags.has(f), `${arc.id} ${f}`);
  }
});

test("a department head's story changes them and lands in their log", () => {
  const s = label();
  const head = G.hireHead(s, "ar", G.recruitExecs(s, "ar")[0].id);
  const before = { ...head },
    { card } = play(s, (x) => x.arc.id === "new-broom", 0);
  assert.match(card.title, new RegExp(head.name));
  assert.match(card.title, /A&R/);
  assert.match(card.body, /A&R/);
  assert.equal(G.storyCardName(s, card), head.name);
  assert.equal(head.skill, Math.min(100, before.skill + 3));
  assert.equal(head.loyalty, Math.min(100, before.loyalty + 6));
  assert.equal(G.storyLog(s, `head:${head.id}`).length, 1);
  assert.ok(G.validSystemsSave(roundTrip(s)));
});

test("an authored head's own story plays only for them", () => {
  const s = label(4);
  const head = G.hireHead(s, "ar", G.recruitExecs(s, "ar")[0].id);
  head.hiredWeek = s.week - 10;
  head.castId = undefined;
  assert.ok(!G.storyDue(s).some((x) => x.arc.id === "tuesday-night"));
  head.castId = "desmond-achebe";
  assert.ok(G.storyDue(s).some((x) => x.arc.id === "tuesday-night"));
});

test("a team member's story needs their role and work", () => {
  const s = label();
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0],
    m = G.hireTeam(s, "producer", G.recruitTeam(s, "producer")[0].id);
  assert.ok(!G.storyDue(s).some((x) => x.arc.id === "signature-sound"), "not while unassigned");
  G.assignTeam(s, m.id, a.id);
  const skill = m.skill,
    { card } = play(s, (x) => x.arc.id === "signature-sound", 0);
  assert.match(card.body, /producer/);
  assert.equal(m.skill, Math.min(100, skill + 2));
});

test("a director's story moves their regard for you and the board's confidence", () => {
  const s = label(2);
  G.takeFunding(s, "angel", 0);
  const d = s.company.board.directors[0];
  d.type = "accountant";
  const rel = d.relationship || 0,
    conf = s.company.board.confidence ?? 50;
  play(s, (x) => x.arc.id === "cost-cuts", 0);
  assert.equal(d.relationship, rel + 6);
  assert.equal(s.company.board.confidence, Math.min(100, conf + 3));
  assert.ok(G.storyLog(s, `director:${d.id}`).length === 1);
});

test("the label's rival stories name a rival and move the label's standing with it", () => {
  const s = label();
  s.fame = 60;
  const { card } = play(s, (x) => x.arc.id === "rival-diss", 2);
  const run = s.company.stories.arcs.find((r) => r.arc === "rival-diss"),
    rival = s.rivalCompanies.find((r) => r.id === run.rival);
  assert.ok(rival);
  assert.ok(card.title.includes(rival.ceo) && card.body.includes(rival.name));
  assert.equal(rival.relationship, -15);
  assert.equal(G.storyCardName(s, card), "The label");
  assert.ok(card.options[2].hint.includes(`standing with ${rival.name} -15`));
  assert.ok(G.storyLog(s, "company").length === 1);
  assert.equal(run.next, "round-two");
});

test("a card about someone who leaves is dropped", () => {
  const s = label();
  const head = G.hireHead(s, "ar", G.recruitExecs(s, "ar")[0].id);
  G.playStory(
    s,
    G.storyDue(s).find((x) => x.arc.id === "new-broom"),
  );
  G.fireHead(s, "ar");
  G.advance(s);
  assert.ok([s.event, ...s.eventQueue].every((e) => e?.type !== "story" || e.subject?.ref !== head.id));
  assert.equal(s.company.stories.arcs.find((r) => r.arc === "new-broom").done, true);
});

console.log(`\n${count} staff and rival story pack tests passed.`);
