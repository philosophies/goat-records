// DOM harness for tour pay (T82): the ticket rate and its parts on the tour form and on a tour on the road.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      dataset: {},
    });
  return elements.get(id);
};
let stored = null;
const body = { dataset: {}, classList: { toggle() {} } };
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    body,
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
const html = (id) => element(id).innerHTML;

run(`state = G.create(82, { ceo: true }); G.setStarter(state, false); G.setMentor(state, false);
  state.cash = 1e6; state.reputation = 80; G.sign(state, state.candidates[0].id, 3);
  const a = state.artists[0]; Object.assign(a, { fame: 90, energy: 100 });
  state.albums.push({ id: 700, artist: a.id, artistName: a.name, title: "Road Record", released: true, releaseWeek: state.week,
    quality: 80, salesWeeks: 8, boosts: [], chart: { best: 5 }, gross: 50000 });
  save(); render();`);
const line = run(`tourRateLine(G.tourQuote(state, { albumId: 700 }).rate)`);
assert.match(
  line,
  /^<p class="tour-rate"><b>Ticket rate ×1\.\d\d<\/b> · Fame 90 \+8% · Tour quality \d+ [+−]\d+% · Label reputation 80 \+4%<\/p>$/,
);
const shared = run(
  `tourRateLine(G.tourQuote(state, { albumId: 700, mode: "rival", rivalId: state.rivalArtists[0].id }).rate)`,
);
assert.match(shared, /Shared with [^(]+ \([^)]+\) \+\d+%/);
// A tour on the road shows today's rate.
run(`G.startTour(state, { albumId: 700 }); openPanel("bus"); render();`);
const all = [...elements.values()].map((x) => x.innerHTML).join("");
assert.match(all, /<p class="tour-rate"><b>Ticket rate this week ×\d\.\d\d<\/b>/);
// Classic quotes carry no rate, so no line.
assert.equal(run(`tourRateLine(undefined)`), "");
console.log("Tour pay harness passed.");
