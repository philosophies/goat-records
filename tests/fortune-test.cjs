// Choices with odds (T78): each option on a CEO decision card is rated safe, steady or bold by what
// it puts at stake, and its outcome is drawn when it is chosen.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const F = G.FORTUNE;
const card = (options, extra = {}) => ({ type: "ceo", title: "A choice", options, ...extra });

test("options are rated from safe to bold by what they put at stake", () => {
  const s = G.create(78, { ceo: true });
  const e = card([
    { label: "Walk away" },
    { label: "Small bet", cost: 500, morale: 3 },
    { label: "Big bet", cost: 5000, cash: 20000, trust: -6 },
  ]);
  assert.deepEqual(G.optionRisks(s, e), ["safe", "steady", "bold"]);
  assert.deepEqual(
    G.optionRisks(
      s,
      card([
        { label: "A", morale: 2 },
        { label: "B", morale: -2 },
      ]),
    ),
    ["steady", "steady"],
  );
  assert.deepEqual(G.optionRisks(s, card([{ label: "A" }, { label: "B", fans: 9 }])), ["safe", "bold"]);
  // A company gamble counts its failure and its chance; "decide next week" is not a call.
  const company = {
    type: "companyEvent",
    eventId: "trailer-sync",
    options: [{ choice: 0 }, { choice: 1 }, { choice: 2 }, { defer: true }],
  };
  assert.deepEqual(G.optionRisks(s, company), ["bold", "steady", "safe", null]);
  for (const type of F.exempt)
    assert.deepEqual(G.optionRisks(s, card([{ label: "A" }, { label: "B", cash: 1e5 }], { type })), [
      null,
      null,
    ]);
  assert.deepEqual(G.optionRisks(G.create(78, { ceo: false }), e), [null, null, null]);
});

test("each rating's outcomes, and what they are worth on average", () => {
  for (const [risk, table] of Object.entries(F.risks)) {
    assert.equal(
      table.reduce((n, t) => n + t.weight, 0),
      100,
      risk,
    );
    assert.ok(
      table.some((t) => t.id === "planned" && t.gain === 1 && t.loss === 1),
      risk,
    );
  }
  const ev = (risk, k) => F.risks[risk].reduce((n, t) => n + (t.weight / 100) * t[k], 0);
  assert.ok(
    ev("bold", "gain") > ev("steady", "gain") && ev("steady", "gain") >= ev("safe", "gain"),
    "bold pays more",
  );
  assert.ok(
    ev("bold", "loss") > ev("steady", "loss") && ev("steady", "loss") >= ev("safe", "loss"),
    "and risks more",
  );
  const spread = (risk) =>
    Math.max(...F.risks[risk].map((t) => t.gain)) - Math.min(...F.risks[risk].map((t) => t.gain));
  assert.ok(
    spread("bold") > spread("steady") && spread("steady") > spread("safe"),
    "wider swings the bolder it is",
  );
  assert.ok(
    F.risks.bold.some((t) => t.gain < 0),
    "a bold call can backfire",
  );
});

test("draws follow the weights", () => {
  const s = G.create(79, { ceo: true }),
    e = card([{ label: "Walk away" }, { label: "Bet", cash: 10000, trust: -5 }]),
    seen = {};
  for (let i = 0; i < 4000; i++) {
    const t = G.drawFortune(s, e, 1).tier;
    seen[t] = (seen[t] || 0) + 1;
  }
  for (const t of F.risks.bold)
    assert.ok(Math.abs(seen[t.id] / 4000 - t.weight / 100) < 0.03, `${t.id}: ${seen[t.id]}`);
  assert.equal(G.drawFortune(s, { ...e, options: [...e.options, { defer: true }] }, 2), null);
});

test("an outcome scales what an option gives and costs, never its price", () => {
  const triumph = F.risks.bold.find((t) => t.id === "triumph"),
    backfire = F.risks.bold.find((t) => t.id === "backfire");
  const o = {
    cash: 6000,
    morale: 4,
    trust: -6,
    mult: 1.2,
    delayAlbum: 2,
    extension: 2,
    lengthDelta: 3,
    cost: 1200,
    label: "x",
  };
  const up = G.scaleFortune(o, triumph);
  assert.equal(up.cash, Math.round(6000 * triumph.gain));
  assert.equal(up.morale, Math.round(4 * triumph.gain));
  assert.equal(up.trust, Math.round(-6 * triumph.loss));
  assert.equal(up.mult, Math.round((1 + 0.2 * triumph.gain) * 100) / 100);
  assert.equal(up.delayAlbum, 2 * triumph.loss);
  assert.equal(up.extension, Math.round(2 * triumph.gain));
  assert.equal(up.lengthDelta, 3, "lengths of time stay as written");
  assert.equal(up.cost, 1200, "the price is the price");
  const down = G.scaleFortune(o, backfire);
  assert.equal(down.cash, 0, "a cash gain never turns into a bill");
  assert.ok(down.morale < 0, "other gains turn into setbacks");
  assert.equal(down.trust, Math.round(-6 * backfire.loss));
  assert.ok(down.mult < 1, "a sales boost turns into a slump");
  assert.equal(down.extension, 0);
  const brand = G.scaleFortune({ brand: { mult: 1.1, weeks: 4 } }, triumph).brand;
  assert.equal(brand.weeks, 4);
  assert.ok(brand.mult > 1.1);
});

test("choosing draws the outcome, scales the effects and records it", () => {
  const plain = G.create(80, { ceo: true }),
    fixed = G.create(80, { ceo: true });
  G.setFixedOutcomes(fixed, true);
  for (const s of [plain, fixed]) {
    s.cash = 50000;
    G.sign(s, s.candidates[0].id, 1);
    s.artists[0].morale = 60;
    s.event = card(
      [{ label: "Keep it quiet" }, { label: "Throw a party", cost: 2000, morale: 10, fans: 8, trust: -4 }],
      {
        artist: s.artists[0].id,
      },
    );
  }
  G.choose(plain, 1);
  G.choose(fixed, 1);
  const out = plain.company.lastOutcome;
  assert.equal(out.title, "A choice");
  assert.equal(out.label, "Throw a party");
  assert.equal(out.risk, "bold");
  assert.ok(F.outcomeNames[out.tier] === out.name);
  const tier = F.risks.bold.find((t) => t.id === out.tier);
  assert.equal(plain.artists[0].morale, Math.min(100, 60 + Math.round(10 * tier.gain)));
  assert.equal(fixed.artists[0].morale, 70, "fixed outcomes play as written");
  assert.equal(fixed.company.lastOutcome, undefined);
  // The record lists what changed.
  assert.ok(out.effects.some((x) => x.name === "Cash" && x.money && x.delta === -2000));
  assert.ok(out.effects.some((x) => /morale$/.test(x.name)));
  assert.equal(out.seen, false);
  assert.ok(G.validSystemsSave(JSON.parse(JSON.stringify(plain))));
});

test("company events scale with the outcome too", () => {
  // A company event: the trailer pitch, forced to succeed, with each outcome.
  const results = new Set();
  for (let seed = 81; seed < 100; seed++) {
    const s = G.create(seed, { ceo: true });
    s.cash = 50000;
    G.sign(s, s.candidates[0].id, 1);
    s.event = {
      type: "companyEvent",
      eventId: "trailer-sync",
      artist: s.artists[0].id,
      dueWeek: s.week + 2,
      title: "A song for the trailer",
      options: [
        { label: "License", choice: 1 },
        { label: "Pass", choice: 2 },
        { defer: true, label: "Later" },
      ],
    };
    const cash = s.cash;
    G.choose(s, 0);
    const tier = F.risks[s.company.lastOutcome.risk].find((t) => t.id === s.company.lastOutcome.tier);
    assert.equal(s.cash - cash, Math.round(2000 * Math.max(0, tier.gain)), `seed ${seed}`);
    results.add(s.company.lastOutcome.tier);
  }
  assert.ok(results.size >= 2, "outcomes vary");
});

test("album delays stay whole weeks, and a part-week wait from an older save finishes", () => {
  const out = (id) => G.FORTUNE.risks.bold.concat(G.FORTUNE.risks.safe).find((t) => t.id === id);
  for (const id of ["triumph", "backfire", "better", "worse"])
    for (const v of [1, 2, 3]) {
      const d = G.scaleFortune({ delayAlbum: v }, out(id)).delayAlbum;
      assert.ok(Number.isInteger(d) && d >= 1, `${id} ${v} → ${d}`);
    }
  // An album left with a part-week wait at its last stage comes out of the studio.
  const s = G.create(78, { ceo: true });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id, 3);
  const a = s.artists[0];
  s.albums.push({
    id: 990,
    artist: a.id,
    title: "Stuck",
    released: false,
    addOns: [],
    boosts: [],
    remaining: 0.8,
    production: { stage: 5, cooldown: 0.8, review: false, releaseReady: false, results: [] },
  });
  s.event = null;
  s.eventQueue = [];
  G.advance(s);
  assert.equal(s.albums.find((p) => p.id === 990).production.releaseReady, true);
});

console.log(`\n${count} fortune tests passed.`);
