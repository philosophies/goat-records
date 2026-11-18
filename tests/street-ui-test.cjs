// DOM harness for the street (CEO runs): buildings and floors in place of the classic lot,
// plots for sale and locked, the minimap, and people standing on their floors.
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
const saved = () => JSON.parse(stored);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}

const html = (id) => element(id).innerHTML;

// A classic run draws the classic lot.
assert.match(html("lot"), /class="building/);
assert.doesNotMatch(html("lot"), /street-row/);

run(
  `state = G.create(81, { ceo: true, labelName: "Street Kings" }); state.cash = 10 ** 7; save(); render();`,
);
assert.match(html("lot"), /class="street-row"/);
assert.match(html("lot"), /id="bldg-apartment"[\s\S]*Your apartment[\s\S]*1\/2 floors/);
assert.match(html("lot"), /data-tab="room:0"[^>]*>[\s\S]*The Living Room/);
assert.match(html("lot"), /data-tab="buildfloor:apartment"/, "the apartment has room for another floor");
assert.match(html("lot"), /id="bldg-storefront"[\s\S]*Phase 2/, "the next building shows as a locked plot");
assert.equal(
  (html("lot").match(/class="street-building/g) || []).length,
  2,
  "owned buildings plus one locked plot",
);
assert.equal(html("lotRoof"), "", "no classic roof sign on the street");
assert.match(html("lotGround"), /data-action="streetJump" data-id="apartment"/);
assert.match(html("lotGround"), /data-action="streetJump" data-id="storefront"/);

// Grow the label: plots for sale, bought buildings with floors, people on their floors.
run(`state.company.phase = 3; G.buildFloor(state, "apartment", "writers");
  G.buyBuilding(state, "storefront"); G.buildFloor(state, "storefront", "room", 1); G.buildFloor(state, "storefront", "lounge");
  G.sign(state, state.candidates[0].id); G.sign(state, state.candidates[0].id); G.hire(state, "Producer"); save(); render();`);
const s = saved();
assert.match(html("lot"), /id="bldg-studio"[\s\S]*For sale · \$60,000/);
assert.match(html("lot"), /id="bldg-office"[\s\S]*For sale/);
assert.match(html("lot"), /data-tab="floor:apartment:1"[^>]*aria-label="Writers&#39; Room, level 1"/);
assert.doesNotMatch(html("lot"), /data-tab="buildfloor:apartment"/, "a full building offers no more floors");
for (const a of s.artists)
  assert.match(
    html("lot"),
    new RegExp(`data-tab="floor:storefront:1"[\\s\\S]*?data-tab="artist:${a.id}"`),
    "idle artists hang out in the lounge",
  );
assert.match(html("lot"), /data-tab="staffer:Producer"/);

// Recording puts the artist in that room's floor.
run(`const a = state.artists[0]; Object.assign(a, { inspiration: 90, energy: 100 });
  G.record(state, { artistId: a.id, boothId: 1, genre: a.genre, audience: a.audience, budget: 4000, themes: [state.themes[0]] }); save(); render();`);
const rec = saved().artists[0];
assert.match(
  html("lot"),
  new RegExp(`data-tab="room:1"[^>]*aria-label="Neon Vault, recording[\\s\\S]*?data-tab="artist:${rec.id}"`),
);

// Tapping someone on the street opens their panel; the minimap jump is handled.
click({ tab: "artist:" + rec.id });
assert.equal(element("drawerTitle").textContent, rec.name);
click({ action: "streetJump", id: "storefront" });

console.log(
  "PASS street interface harness: buildings and floors replace the lot in CEO runs, plots for sale and locked, minimap, people on their floors, classic lot untouched",
);
