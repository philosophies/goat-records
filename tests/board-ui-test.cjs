// DOM harness for the boardroom (CEO runs): funding, directors with their reasons, lobbying,
// and the review scene step by step, or all at once with reduced motion.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
let reduceMotion = false;
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
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  // Flipped by the test to check the reduced-motion path.
  matchMedia: () => ({ matches: reduceMotion }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
const saved = () => JSON.parse(stored);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
const html = (id) => element(id).innerHTML;
const select = (id, value) => (element(id).value = value);

// A CEO run with no board: the office card and the boardroom offer funding only.
run(
  `state = G.create(91, { ceo: true }); state.cash = 200000; state.company.phase = 2; G.sign(state, state.candidates[0].id); save(); render();`,
);
click({ tab: "office" });
assert.match(html("content"), /BOARDROOM[\s\S]*No board yet[\s\S]*data-tab="board"/);
click({ tab: "board" });
assert.equal(element("drawerTitle").textContent, "Boardroom");
let page = html("content");
assert.match(page, /No board yet/);
assert.match(page, /You own 100% of the company/);
assert.match(page, /Bank loan[\s\S]*data-action="fundTake" data-kind="loan" data-term="0"/);
assert.match(
  page,
  /Angel investor[\s\S]*10%[\s\S]*data-kind="angel" data-term="0"[\s\S]*20%[\s\S]*data-kind="angel" data-term="1"/,
);

// Take the angel's 20%: the board appears with one director, their satisfaction and reasons.
click({ action: "fundTake", kind: "angel", term: "1" });
let s = saved();
assert.equal(s.company.ownership, 0.8);
const dir = s.company.board.directors[0];
page = html("content");
assert.match(page, /Confidence 50\/100/);
assert.match(page, /Budget left[\s\S]*Creative freedom<\/span><b>Medium/);
assert.match(page, new RegExp(`${dir.name}[\\s\\S]*relationship 0[\\s\\S]*On target`));
assert.match(page, /<svg/, "directors have portraits");

// Lobby: meet once a week, make a promise, trade a favor.
click({ action: "boardMeet", director: String(dir.id) });
assert.equal(saved().company.board.directors[0].relationship, run("G.LOBBY.meet"));
assert.match(html("content"), /Met this week/);
assert.match(html("content"), /Your relationship<\/span><b>\+4/);
const metric = run(`G.promiseOptions(state, ${dir.id})[0].metric`);
select("promise-" + dir.id, metric);
click({ action: "boardPromise", director: String(dir.id) });
assert.equal(saved().company.board.directors[0].promise.metric, metric);
assert.match(html("content"), /Promised:/);
select(`favor-${dir.id}-candidate`, "ar");
click({ action: "boardFavor", director: String(dir.id), kind: "candidate" });
assert.equal(saved().company.departments.ar.head.favorOf, dir.id);

// The review arrives: the clock holds and the scene plays director by director, then the vote.
run(`state.company.board.nextReview = state.week + 1; state.event = null; save(); render();`);
run(
  `G.advance(state); while (state.event) G.choose(state, state.event.options.length - 1); save(); render();`,
);
s = saved();
assert.equal(s.company.board.reviews.length, 1);
assert.equal(s.company.board.scene, true);
let scene = html("milestones");
assert.match(scene, /BOARD REVIEW[\s\S]*data-action="boardSceneNext">Hear the board/);
assert.doesNotMatch(scene, /class="scene-score[ "]/, "no scores before the scene starts");
assert.doesNotMatch(scene, /Creative freedom/);
click({ action: "boardSceneNext" });
scene = html("milestones");
assert.match(
  scene,
  new RegExp(
    `scene-score fresh[\\s\\S]*${dir.name}[\\s\\S]*<b>${s.company.board.reviews[0].directors[0].satisfaction}</b>`,
  ),
);
assert.match(scene, /data-action="boardSceneNext">The vote/);
click({ action: "boardSceneNext" });
scene = html("milestones");
const r = s.company.board.reviews[0];
assert.match(
  scene,
  new RegExp(
    `Confidence ${r.confidence}/100[\\s\\S]*Budget</span><b>\\$[\\d,]+</b>[\\s\\S]*Creative freedom</span><b>${run(`G.REVIEW.freedom.find((f) => f.id === "${r.freedom}").name`)}`,
  ),
);
assert.match(scene, /[01] of 1 promises kept/);
assert.match(scene, /data-action="boardSceneDone"/);
click({ action: "boardSceneDone" });
assert.equal(saved().company.board.scene, false);
assert.equal(html("milestones").includes("BOARD REVIEW"), false);

// Reduced motion: the whole result shows at once.
reduceMotion = true;
run(`state.company.board.nextReview = state.week + 1; save(); render();`);
run(
  `G.advance(state); while (state.event) G.choose(state, state.event.options.length - 1); save(); render();`,
);
scene = html("milestones");
assert.match(scene, /class="scene-score[ "][\s\S]*Creative freedom[\s\S]*data-action="boardSceneDone"/);
assert.doesNotMatch(scene, /boardSceneNext/);
assert.doesNotMatch(scene, /fresh/, "nothing animates");
click({ action: "boardSceneDone" });

// A classic run has no boardroom card.
run(`state = G.create(5); save(); render();`);
click({ tab: "office" });
assert.doesNotMatch(html("content"), /BOARDROOM/);

console.log(
  "PASS board interface harness: funding without a board, the angel bringing a board, directors with portraits and reasons, meeting, promising and favors, the review scene step by step and at once with reduced motion, classic runs untouched",
);
