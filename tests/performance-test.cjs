// Performance budget (T68): a late CEO run (phase 6, twenty years of albums, rival releases and
// history) must still settle a week quickly and fit in browser storage.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");

// Budgets. Browser storage allows about 5 MB per site; the save stays well inside it.
const BUDGET = { weekMs: 60, saveBytes: 2.5e6, stringifyMs: 120 };

function lateRun() {
  const s = G.create(68, { ceo: true });
  G.setStarter(s, false);
  Object.assign(s, { cash: 5e7, fame: 4000, week: 19 * 52 });
  s.company.phase = 6;
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.eras.seen = s.company.eras.announced = 3;
  while (s.candidates.length && s.artists.length < 5) G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  // 180 albums released over the years, past their sales runs.
  for (let i = 0; i < 180; i++)
    s.albums.push({
      id: 50000 + i,
      artist: a.id,
      artistName: a.name,
      title: "Old " + i,
      genre: a.genre,
      released: true,
      releaseWeek: 20 + i * 5,
      quality: 60 + (i % 35),
      hit: i % 3 === 0,
      gross: 40000 + i * 900,
      total: 40000 + i * 900,
      age: 12,
      salesWeeks: 12,
      boosts: [],
      chart: { best: 1 + (i % 120), weeks: 10, rank: null, milestones: [], history: [] },
    });
  // A thousand rival releases in the archive.
  for (let i = 0; i < 1000; i++)
    s.rivalArchive["x" + i] = {
      id: "x" + i,
      title: "R" + i,
      label: "Rival",
      genre: "Pop",
      year: 1 + (i % 19),
      best: 1 + (i % 300),
    };
  return s;
}

const s = lateRun();
const settle = () => {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
};
settle(); // warm up
const times = [];
for (let i = 0; i < 20; i++) {
  const t = process.hrtime.bigint();
  settle();
  times.push(Number(process.hrtime.bigint() - t) / 1e6);
}
times.sort((a, b) => a - b);
const median = times[10];
assert.ok(median < BUDGET.weekMs, `a late week takes ${median.toFixed(1)} ms (budget ${BUDGET.weekMs})`);
let t = process.hrtime.bigint();
const raw = JSON.stringify(s);
const stringifyMs = Number(process.hrtime.bigint() - t) / 1e6;
assert.ok(raw.length < BUDGET.saveBytes, `the save is ${raw.length} bytes (budget ${BUDGET.saveBytes})`);
assert.ok(
  stringifyMs < BUDGET.stringifyMs,
  `saving takes ${stringifyMs.toFixed(1)} ms (budget ${BUDGET.stringifyMs})`,
);
assert.ok(G.validSystemsSave(JSON.parse(raw)), "the late save still passes the load checks");
console.log(
  `Performance: late week ${median.toFixed(1)} ms, save ${(raw.length / 1e6).toFixed(2)} MB written in ${stringifyMs.toFixed(1)} ms.`,
);
