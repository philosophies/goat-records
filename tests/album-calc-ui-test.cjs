// DOM harness for the album form and the calculating step (T83): no genre choice in CEO runs, and a
// five-second calculation after each album decision that holds the clock and can be skipped.
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

const all = () => [...elements.values()].map((x) => x.innerHTML).join("");
run(`state = G.create(83, { ceo: true }); G.setStarter(state, false); G.setMentor(state, false);
  state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 }; state.company.rivalCardWeek = 1e9;
  state.cash = 1e6; G.sign(state, state.candidates[0].id, 3); state.artists[0].inspiration = 80;
  state.event = null; state.eventQueue = []; save(); render();`);
const genre = run("state.artists[0].genre");
// The form names the artist's genre and has no genre choice.
const form = run("albumFormCard()");
assert.doesNotMatch(form, /id="genre"/);
assert.match(
  form,
  new RegExp(
    `<p class="muted album-genre form-full" id="album-genre">Genre: ${genre}, the artist's own\\.</p>`,
  ),
);
// Even a plan naming another genre records in the artist's own.
run(
  `G.record(state, { artistId: state.artists[0].id, boothId: 0, genre: "${genre === "Rap" ? "Pop" : "Rap"}", audience: state.artists[0].audience, budget: 4000, title: "Calc", addOns: [] }); render();`,
);
assert.equal(run("state.albums[0].genre"), genre);
const id = run("state.albums[0].id");
assert.equal(run("GoatCalc.ms"), 5000, "five seconds");
assert.match(all(), /data-action="stage"/);
// Choosing a stage option calculates before the result shows.
click({ action: "stage", id: String(id), option: "0" });
let page = all();
assert.match(page, /STAGE 1 OF 5 · CALCULATING/);
assert.match(page, /<b id="calc-roll">··<\/b>/);
assert.match(page, /<ul class="calc-parts"><li style="--i:0;--n:\d+">/);
assert.doesNotMatch(page, /class="decision-score"/, "the score waits");
assert.ok(run("GoatClock.blockers").includes("calculating"), "the clock holds");
// When the time is up (or on Skip), the result shows.
run("GoatCalc.run.until = Date.now() - 1; render();");
assert.match(all(), /class="decision-score"><strong>\d+\/100/);
assert.doesNotMatch(all(), /CALCULATING/);
click({ action: "continue", id: String(id) });
run("state.albums[0].production.cooldown = 0; render();");
click({ action: "stage", id: String(id), option: "1" });
assert.match(all(), /CALCULATING/);
click({ action: "calcSkip" });
assert.match(all(), /class="decision-score"/);
assert.ok(!run("GoatClock.blockers").includes("calculating"));
run("stopCalculating(false)");

// Classic forms keep the genre choice and show results at once.
run(
  `state = G.create(83, { ceo: false }); state.cash = 1e6; G.sign(state, state.candidates[0].id, 3); render();`,
);
assert.match(run("albumFormCard()"), /<label>Genre<select id="genre">/);
console.log("Album form and calculating harness passed.");
