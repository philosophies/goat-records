// DOM harness for automatic award entries (T84): the trophy case names each genre's entry and its
// strength, ranks the others, and has no entry buttons in a CEO run; classic keeps them.
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

run(`state = G.create(84, { ceo: true }); G.setStarter(state, false); G.setMentor(state, false);
  state.cash = 1e6; G.sign(state, state.candidates[0].id, 3);
  const a = state.artists[0];
  const mk = (id, q, best) => ({ id, artist: a.id, artistName: a.name, title: "Record " + id, genre: a.genre, released: true,
    releaseWeek: state.week, quality: q, salesWeeks: 12, boosts: [], chart: { best },
    launchRatings: [{ name: "Critics", score: q }, { name: "Fan response", score: q }] });
  state.albums.push(mk(801, 70, null), mk(802, 88, 3));
  G.autoEnterAwards(state); render();`);
const genre = run("state.artists[0].genre");
const page = run("annualAwards()");
assert.match(page, /Entries are made for you/);
assert.match(
  page,
  new RegExp(
    `<span class="tag">${genre}</span><h3>${genre} Album of the Year</h3><p class="auto-entry"><b>Entered: Record 802</b> · strength [\\d.]+ · 88/100 quality · peak #3</p><p class="muted">Also eligible</p><ol class="auto-others"><li>Record 801 · strength [\\d.]+</li></ol>`,
  ),
);
assert.doesNotMatch(page, /data-action="awardEntry"/);
assert.match(page, /No \w+ album released this year yet\./);
run(`state = G.create(84, { ceo: false }); render();`);
assert.match(run("annualAwards()"), /data-action="awardEntry"/);
console.log("Automatic awards harness passed.");
