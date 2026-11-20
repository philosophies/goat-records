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
require("./load-interface.cjs")(context, { classic: true });
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
assert.match(html("lotGround"), /id="streetJump"[\s\S]*value="apartment"/);
assert.match(html("lotGround"), /id="streetJump"[\s\S]*value="storefront"/);

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
listeners.change({ target: { id: "streetJump", value: "storefront" } });

// Panels: buy a plot, build floors, open and upgrade a facility floor, all by clicks.
click({ tab: "buy:studio" });
assert.equal(element("drawerTitle").textContent, "Studio building");
assert.match(html("content"), /FOR SALE[\s\S]*Up to 5 floors[\s\S]*Buy · \$60,000/);
click({ action: "buildingBuy", building: "studio" });
assert.ok(saved().company.buildings.some((b) => b.id === "studio"));
assert.equal(element("drawerTitle").textContent, "Studio building", "buying opens the building's panel");
assert.match(html("content"), /0 of 5 floors[\s\S]*Build a floor/);
click({ tab: "buildfloor:studio" });
assert.match(html("content"), /Floor 1 of 5/);
assert.match(
  html("content"),
  /Vocal Booth[\s\S]*data-action="floorBuild" data-building="studio" data-type="vocal"/,
);
assert.doesNotMatch(
  html("content"),
  /data-type="writers"/,
  "a facility built elsewhere is not offered again",
);
click({ action: "floorBuild", building: "studio", type: "vocal" });
assert.equal(saved().company.buildings.find((b) => b.id === "studio").floors[0].type, "vocal");
assert.match(html("content"), /Floor 1 · Vocal Booth · level 1/);
click({ tab: "floor:studio:0" });
assert.equal(element("drawerTitle").textContent, "Vocal Booth");
assert.match(html("content"), /FLOOR 1 · STUDIO BUILDING · LEVEL 1 \/ 3/);
click({ action: "floorUpgrade", building: "studio", index: "0" });
assert.equal(saved().company.buildings.find((b) => b.id === "studio").floors[0].level, 2);
click({ tab: "buy:hq" });
assert.match(html("content"), /OPENS AT PHASE 4[\s\S]*Reach phase 4, National label/);
assert.match(html("content"), /data-action="buildingBuy" data-building="hq" disabled/);
click({ tab: "floor:studio:9" });
assert.equal(element("drawer").hidden, true, "a missing floor opens nothing");

// Building art: grade from floor levels, the finish band, rooftop details, props, day and night.
run(`state = G.create(21, { ceo: true }); state.company.phase = 6; state.cash = 1e9;
  G.buyBuilding(state, "studio"); save(); render();`);
assert.equal(run(`GoatStreet.grade({ floors: [{ level: 1 }] })`), 1);
assert.equal(run(`GoatStreet.grade({ floors: [{ level: 3 }, { level: 2 }] })`), 5);
assert.equal(
  run(`GoatStreet.grade({ floors: Array.from({ length: 8 }, () => ({ level: 3 })) })`),
  10,
  "capped at 10",
);
assert.deepEqual(
  [1, 3, 4, 6, 7, 10].map((g) => run(`GoatStreet.band(${g})`)),
  ["plain", "plain", "neon", "neon", "gold", "gold"],
);
let street = element("lot").innerHTML;
assert.match(street, /class="street-building bldg-apartment band-plain" id="bldg-apartment" data-grade="1"/);
assert.match(street, /roof-prop roof-tank/);
assert.match(street, /street-prop lowrider/);
assert.match(street, /street-prop palm/);
run(
  `state.company.buildings[0].floors[0].level = 3; state.company.buildings[0].floors.push({ type: "writers", level: 3 }); state.company.buildings[0].floors.push({ type: "vocal", level: 2 }); render();`,
);
street = element("lot").innerHTML;
assert.match(street, /bldg-apartment band-gold" id="bldg-apartment" data-grade="8"/);
assert.match(street, /roof-billboard/);
assert.match(
  ["day", "night"].join(" "),
  new RegExp(element("scene").dataset.time),
  "the street is set to day or night",
);

console.log(
  "PASS street interface harness: building, floor, build and buy panels with their actions, buildings and floors replace the lot in CEO runs, plots, minimap, people on their floors, classic lot untouched",
);
