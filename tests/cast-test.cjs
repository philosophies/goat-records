// The authored cast (3.0, T53): authored people fill scouting, recruitment and board seats by reach,
// generated people fill the rest, and classic runs never see them.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const D = require("../src/data/cast.js");
const { REACH_ORDER, CAST_ARTISTS, CAST_EXECS, CAST_TEAM, CAST_DIRECTORS } = D;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
const all = [...CAST_ARTISTS, ...CAST_EXECS, ...CAST_TEAM, ...CAST_DIRECTORS];

test("the cast is about 30 artists and 20 others, all complete and unique", () => {
  assert.equal(CAST_ARTISTS.length, 30);
  assert.ok(CAST_EXECS.length + CAST_TEAM.length + CAST_DIRECTORS.length >= 20);
  assert.equal(new Set(all.map((x) => x.id)).size, all.length);
  assert.equal(new Set(all.map((x) => x.name)).size, all.length);
  for (const g of G.GENRES) assert.equal(CAST_ARTISTS.filter((a) => a.genre === g).length, 5, g);
  for (const a of CAST_ARTISTS) {
    assert.ok(REACH_ORDER.includes(a.reach), a.id);
    const lim = G.REACH_SCOUTING[a.reach];
    assert.ok(a.talent <= lim.talentMax && a.potential <= lim.potentialMax && a.potential >= a.talent, a.id);
    assert.ok(["Youth", "Teen", "Adult"].includes(a.age) && ["Youth", "Teen", "Adult"].includes(a.audience));
    for (const v of Object.values(a.traits)) assert.ok(v >= G.TRAITS.min && v <= G.TRAITS.max, a.id);
    assert.ok(Object.keys(G.WANTS).includes(a.want), a.id);
    assert.match(a.look.color, /^#[0-9a-f]{6}$/i);
    assert.ok(a.look.text && a.backstory && a.arc.id && a.arc.hook, a.id);
  }
  for (const e of CAST_EXECS) {
    const [lo, hi] = G.EXEC_POOL.skill[e.reach];
    assert.ok(e.skill >= lo && e.skill <= hi, e.id);
    assert.ok(
      G.DEPARTMENTS.some((d) => d.id === e.dept),
      e.id,
    );
  }
  for (const m of CAST_TEAM) {
    const [lo, hi] = G.TEAM_POOL.skill[m.reach];
    assert.ok(m.skill >= lo && m.skill <= hi, m.id);
    assert.ok(
      G.TEAM_ROLES.some((r) => r.id === m.role),
      m.id,
    );
    assert.ok(m.genres.every((g) => G.GENRES.includes(g)));
  }
  const types = new Set(G.DIRECTORS.map((d) => d.id));
  for (const d of CAST_DIRECTORS) assert.ok(types.has(d.type), d.id);
});

test("CEO scouting draws authored artists within one reach step, with generated ones as a fallback", () => {
  let cast = 0,
    generated = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = G.create(seed, { ceo: true });
    s.cash = 1e7;
    s.company.phase = 4;
    G.paidScout(s, 2);
    for (const a of s.candidates) {
      if (!a.castId) {
        generated++;
        continue;
      }
      cast++;
      const c = G.castEntry(a.castId),
        reach = G.scoutLimits(s).reach;
      assert.ok(REACH_ORDER.indexOf(c.reach) >= REACH_ORDER.indexOf(reach) - 1, `${c.id} at ${reach}`);
      assert.equal(a.name, c.name);
      assert.equal(a.genre, c.genre);
    }
    assert.equal(new Set(s.candidates.map((a) => a.name)).size, s.candidates.length);
  }
  assert.ok(cast > generated, `${cast} authored, ${generated} generated`);
  assert.ok(generated > 0);
});

test("an authored artist keeps their traits and want, and is never scouted twice", () => {
  const s = G.create(3, { ceo: true });
  s.cash = 1e7;
  let a;
  for (let i = 0; i < 30 && !a; i++) {
    G.paidScout(s, 0);
    a = s.candidates.find((x) => x.castId);
  }
  assert.ok(a, "found an authored artist");
  G.sign(s, a.id);
  const signed = s.artists.find((x) => x.castId === a.castId),
    c = G.castEntry(a.castId),
    mood = G.artistMood(s, signed);
  assert.equal(mood.traits?.ego ?? signed.persona.ego, c.traits.ego);
  assert.equal(signed.persona.want, c.want);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
  assert.ok(s.company.cast.used.includes(a.castId));
  for (let i = 0; i < 40; i++) {
    G.paidScout(s, 0);
    assert.ok(!s.candidates.some((x) => x.castId === a.castId && x.id !== signed.id));
  }
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.cast.used.push("nobody");
  assert.equal(G.validSystemsSave(bad), false);
});

test("executives, team members and directors come from the cast too", () => {
  let execs = 0,
    crew = 0,
    seats = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = G.create(seed, { ceo: true });
    s.cash = 1e8;
    s.company.phase = 4;
    for (const d of ["ar", "marketing", "creative"]) {
      const pool = G.recruitExecs(s, d);
      for (const c of pool.filter((x) => x.castId)) {
        execs++;
        assert.equal(G.castEntry(c.castId).dept, d);
        assert.equal(c.salary, G.EXEC_PAY.base + c.skill * G.EXEC_PAY.perSkill);
      }
    }
    for (const r of ["producer", "tour"]) crew += G.recruitTeam(s, r).filter((x) => x.castId).length;
    G.takeFunding(s, "venture", 1);
    seats += s.company.board.directors.filter((d) => d.castId).length;
  }
  assert.ok(execs > 0 && crew > 0 && seats > 0, `${execs} execs, ${crew} crew, ${seats} directors`);
});

test("classic runs never draw from the cast", () => {
  const c = G.create(3, { ceo: false });
  c.cash = 1e6;
  for (let i = 0; i < 10; i++) {
    G.paidScout(c, 0);
    assert.ok(c.candidates.every((a) => !a.castId));
  }
});

console.log(`\n${count} cast tests passed.`);
