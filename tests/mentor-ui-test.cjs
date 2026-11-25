// DOM harness for the mentor (T76): Augie's talks over the lot, "Show me" opening the right panel,
// pointers at the top of that panel, notes on the first album, the ticker line, the glow, and
// letting him go.
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

run(`state = G.create(76, { ceo: true }); state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  state.company.rivalCardWeek = 1e9; save(); render();`);

// The first talk: over the lot, holding the clock.
let card = html("milestones");
assert.match(card, /mentor-talk mentor-intro/);
assert.match(card, /Augie Delmonte[\s\S]*Delmonte Sound · step 1 of 11[\s\S]*Welcome to the business/);
assert.match(card, /Forty-one years I ran Delmonte Sound/);
assert.match(card, /Pause, 1×, 2× and 4× run time; Next week jumps ahead/);
assert.match(card, /data-go="desk~sec-scout">Show me the front desk<\/button>/);
assert.match(card, /Let me play on my own/);
assert.equal(body.dataset.mentor, "intro");
assert.ok(run("GoatClock").update, "clock present");

// "Show me" reads the talk and opens the front desk, with Augie's pointers on top.
click({ action: "mentor", beat: "intro", go: "desk~sec-scout" });
assert.doesNotMatch(html("milestones"), /mentor-talk/);
assert.equal(run("tab"), "desk");
assert.match(
  html("content"),
  /^<aside class="mentor-note">[\s\S]*The front desk[\s\S]*Craft is how good they are today/,
);
assert.match(html("notices"), /mentor-line[\s\S]*Augie:<\/b> The front desk[\s\S]*data-tab="desk"/);
assert.equal(body.dataset.mentor, "desk");
// The pointers belong to the desk only.
click({ tab: "billboard" });
assert.doesNotMatch(html("content"), /mentor-note/);
click({ tab: "desk" });

// Signing brings the next talk; its button opens the artist's Record section.
run(`G.sign(state, state.candidates[0].id, 1); save(); render();`);
card = html("milestones");
assert.match(card, /mentor-artist[\s\S]*Now make a record/);
const artistId = run("state.artists[0].id");
assert.match(card, new RegExp(`data-go="artist:${artistId}~sec-record"`));
click({ action: "mentor", beat: "artist", go: `artist:${artistId}~sec-record` });
assert.equal(run("tab"), `artist:${artistId}`);
assert.match(html("content"), /mentor-note[\s\S]*Planning the album[\s\S]*Press Begin recording/);
assert.equal(body.dataset.mentor, "record");

// Recording: the first album's card carries Augie's note on the five decisions.
run(`const a = state.artists[0]; Object.assign(a, { energy: 100, inspiration: 90 });
  G.record(state, { artistId: a.id, boothId: state.booths[0].id, genre: a.genre, audience: a.audience, budget: 4000 });
  closePanel(); save(); render();`);
assert.match(html("production"), /mentor-note[\s\S]*Five decisions[\s\S]*creative direction, songwriting/);
assert.equal(body.dataset.mentor, "stages");
click({ action: "mentor", beat: "stages" });
assert.doesNotMatch(html("production"), /mentor-note/, "read notes leave the card");

// Letting him go: no talks, no line, no glow; the checklist stays.
click({ action: "mentorOff" });
assert.doesNotMatch(html("milestones") + html("notices") + html("production"), /mentor/);
assert.equal(body.dataset.mentor, undefined);
assert.match(html("notices"), /Getting started/);

// A classic run has no mentor.
run(`state = G.create(76, { ceo: false }); save(); render();`);
assert.doesNotMatch(html("milestones") + html("notices"), /mentor/);
console.log("Mentor interface harness passed.");
