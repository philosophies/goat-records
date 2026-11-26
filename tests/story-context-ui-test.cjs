// DOM harness for stories in context (T80): the press line on a story card, the larger reveal for a
// major moment with a departure line, and the notice when an artist leaves the label.
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

run(`state = G.create(80, { ceo: true }); G.setStarter(state, false); G.setMentor(state, false);
  state.company.stories = { arcs: [], log: {}, lastWeek: -10 }; state.company.rivalCardWeek = 1e9;
  state.cash = 1e6; state.week = 30; G.sign(state, state.candidates[0].id, 3);
  const a = state.artists[0]; a.genre = "Sacred"; a.morale = 50;
  state.albums.push({ id: state.nextId++, artist: a.id, title: "Old", released: true, releaseWeek: 2, quality: 60, salesWeeks: 0, boosts: [] });
  state.event = null; state.eventQueue = [];
  G.playStory(state, G.storyDue(state).find((x) => x.arc.id === "rival-dinner"));
  state.eventQueue[0].options[2].storyChoice = 2; state.event = state.eventQueue.shift();
  save(); render();`);
const name = run("state.artists[0].name");
let card = html("event");
assert.match(card, /story-event/);
assert.doesNotMatch(card, /press-headline/, "a quiet first card has no press line");
// Say nothing and watch, then the offer arrives with a press line.
click({ action: "choose", id: "2" });
run("state.company.lastOutcome.seen = true; state.week += 9; state.event = null;");
run(
  `G.playStory(state, G.storyDue(state).find((x) => x.arc.id === "rival-dinner")); state.event = state.eventQueue.shift(); render();`,
);
card = html("event");
assert.match(
  card,
  new RegExp(
    `<div class="press-headline" role="note"><span>THE WIRE</span><b>[^<]+ moves to sign ${name}</b></div>`,
  ),
);
assert.match(card, /What it does shows once you choose\./);
assert.doesNotMatch(card, /leaves the label/, "the outcome is hidden");

// Wish them well: the artist leaves, and the reveal is the larger one.
click({ action: "choose", id: "2" });
card = html("event");
assert.match(card, /outcome-reveal tier-\w+ risk-bold major/);
assert.match(card, /<div class="outcome-breaking" aria-hidden="true">BREAKING<\/div>/);
assert.match(card, /press-headline/);
assert.match(card, new RegExp(`class="news exit">${name} left the label</li>`));
assert.equal(run("state.artists.length"), 0);
click({ action: "outcomeSeen" });
// Then the notice.
run("render();");
const all = [...elements.values()].map((x) => x.innerHTML).join("");
assert.match(all, new RegExp(`ARTIST LEFT THE LABEL</span><h2>${name} left the label</h2>`));
console.log("Story context harness passed.");
