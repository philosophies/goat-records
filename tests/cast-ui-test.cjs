// DOM harness for the authored cast (CEO runs): backstories on prospects, the story card, heads.
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
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (n, fn) => (listeners[n] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  matchMedia: () => ({ matches: true }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
const click = (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } });
const html = () => element("production").innerHTML;

run(`state = G.create(3, { ceo: true }); state.cash = 1e7; state.company.phase = 3;
  for (let i = 0; i < 30 && !state.candidates.some((a) => a.castId); i++) G.paidScout(state, 0);
  save(); render();`);
const cand = run("state.candidates.find((a) => a.castId)"),
  entry = run(`G.castEntry("${cand.castId}")`);
click({ tab: "desk" });
assert.ok(
  element("content").innerHTML.includes(
    `<p class="backstory">${entry.backstory.replace(/'/g, "&#39;")}</p>`,
  ) || element("content").innerHTML.includes(entry.backstory.slice(0, 30)),
  "the prospect card tells their story",
);
run(`G.sign(state, ${cand.id}); save(); render();`);
const id = run("state.artists.find((a) => a.castId).id");
click({ tab: "artist:" + id });
const page = element("content").innerHTML;
assert.match(page, /THEIR STORY/);
assert.ok(page.includes("Look:") && page.includes("Watch for:"));
// A story beat plays as a decision card with the artist's name, then lands in the story log.
run(`state.albums.push({ id: 990, artist: ${id}, released: true, quality: 82, releaseWeek: state.week, title: "Hit" });
  G.playStory(state, G.storyDue(state).find((x) => x.arc.id === "first-hit"));
  state.event = state.eventQueue.shift(); render();`);
click({ action: "showModal" });
assert.match(element("event").innerHTML, /S STORY · TIME IS PAUSED/);
assert.match(element("event").innerHTML, /hears the song everywhere/);
click({ action: "choose", id: "1" });
assert.equal(run("state.event"), null);
click({ tab: "artist:" + id });
assert.match(
  element("content").innerHTML,
  /Story so far[\s\S]*hears the song everywhere: Give them a week off to enjoy it[\s\S]*Signed with the label/,
);
// A generated artist has a timeline but no authored look or story hook.
run(`state.artists.forEach((a) => delete a.castId); render();`);
click({ tab: "artist:" + id });
assert.match(element("content").innerHTML, /THEIR STORY[\s\S]*Signed with the label/);
assert.doesNotMatch(element("content").innerHTML, /Look:|Watch for:/);
console.log("PASS cast harness");
