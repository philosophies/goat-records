// Screen audit (3.0, T57): every place in a developed CEO run, checked for classic-only wording.
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

const CLASSIC =
  /label rank|Bedroom Label|Indie Imprint|Rising Label|Major Contender|Powerhouse|Greatest of All Time|on the lot|lot tile|yearly goal|Show on lot|\bY\d+ goal/i;
run(`state = G.create(33, { ceo: true }); state.cash = 5e6; state.company.phase = 4; state.fame = 120;
  G.takeFunding(state, "loan");
  for (let i = 0; i < 3; i++) G.sign(state, state.candidates[0].id);
  G.buyBuilding(state, "storefront"); G.buildFloor(state, "storefront", "vocal");
  G.buyBuilding(state, "studio"); G.buildFloor(state, "studio", "mix");
  G.hireHead(state, "ar", G.recruitExecs(state, "ar")[0].id);
  const a = state.artists[0]; Object.assign(a, { energy: 100, inspiration: 80 });
  G.record(state, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  const p = state.albums.at(-1);
  for (let i = 0; i < 40 && !p.released; i++) {
    while (state.event) G.choose(state, state.event.options.length - 1);
    for (const x of [...(state.company.inbox || [])]) G.decide(state, x.id, 0);
    const d = p.production;
    if (d.releaseReady) { G.releaseAlbum(state, p.id, p.title); p.launchReview = false; break; }
    if (!d.cooldown) { if (!d.review) G.decideStage(state, p.id, 0); G.continueProduction(state, p.id); }
    G.advance(state);
  }
  for (let i = 0; i < 3; i++) { while (state.event) G.choose(state, state.event.options.length - 1); G.advance(state); }
  while (state.event) G.choose(state, state.event.options.length - 1);
  state.albums.forEach((x) => (x.launchReview = false));
  save(); render();`);
const tabs = [
  "label",
  "office",
  "desk",
  "billboard",
  "newsstand",
  "trophies",
  "bus",
  "street",
  "phone:inbox",
  "phone:calendar",
  "phone:contacts",
  "phone:wallet",
  "phone:settings",
  "board",
  "company",
  "dept:ar",
  ...run("state.artists.map((a) => 'artist:' + a.id)"),
  ...run(
    "G.allFloors(state).filter((f) => f.floor.type !== 'room').map((f) => 'floor:' + f.building + ':' + f.index)",
  ),
];
let checked = 0;
for (const tab of tabs) {
  click({ tab });
  const page = element("content").innerHTML + " " + element("drawerTitle").textContent;
  if (!page.trim()) continue;
  checked++;
  const hit = page.match(CLASSIC);
  assert.equal(hit, null, `${tab} shows classic wording: "${hit?.[0]}"`);
}
assert.ok(checked >= 15, `${checked} screens checked`);
for (const id of ["hud", "goal", "lot", "activities", "notices", "roster"]) {
  const html = element(id).innerHTML + element(id).textContent;
  assert.equal(html.match(CLASSIC), null, `${id} shows classic wording`);
}
// The street has a trophy case in CEO runs.
assert.match(element("lot").innerHTML + run("GoatPlaces.town()"), /data-tab="trophies"/);
console.log(`PASS screen audit: ${checked} CEO screens free of classic wording`);
