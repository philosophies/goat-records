// Order of the year-end settlement: awards, then rank-ups, then yearly goals.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");

// A rank goal is met when the last requirement is reached at the year's final settlement.
const goal = G.CAMPAIGN_GOALS.find((g) => g.type === "rank" && g.need >= 3);
assert.ok(goal, "the goal ladder has a rank goal");
const s = G.create(5, { ceo: false });
s.week = goal.year * 52;
s.rank = goal.need - 1;
s.cash = 1e6;
G.migrate(s);
const req = G.RANKS[goal.need - 1].req;
s.fame = req.fame || 0;
for (let i = 0; i < (req.releases || 0); i++)
  s.albums.push({
    id: 9000 + i,
    artist: 0,
    booth: 0,
    title: "A" + i,
    artistName: "x",
    released: true,
    quality: 70,
    releaseWeek: s.week - 10,
    remaining: 0,
    total: 0,
    age: 99,
    salesWeeks: 12,
    chart: { best: req.chartPeak || 1, history: [] },
    boosts: [],
  });
const ids = G.FACILITIES.filter((f) => f.rank <= goal.need - 1).map((f) => f.id);
for (const id of ids.slice(0, req.facilities || 0)) {
  const [w] = G.lotSize(s),
    n = s.hq.facilities.length;
  s.hq.facilities.push({ id, x: n % w, y: Math.floor(n / w), level: 1, builtWeek: 1 });
}
s.awards = req.awards || 0;
assert.equal(G.rank(s), goal.need - 1);
G.advance(s);
assert.equal(G.rank(s), goal.need, "promoted at the year-end settlement");
assert.equal(
  s.campaign.goals.find((g) => g.year === goal.year).status,
  "met",
  "the same settlement counts the new rank",
);
console.log("PASS year-end order: a rank reached at the final settlement meets that year's rank goal.");
