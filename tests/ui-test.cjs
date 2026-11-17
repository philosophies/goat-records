// DOM harness checks rendering/actions without claiming real-browser layout verification.
const vm = require("node:vm"),
  fs = require("node:fs"),
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
assert.match(element("content").innerHTML, /Your first discovery/);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
click({ tab: "scout" });
assert.match(element("content").innerHTML, /Tomorrow/);
const original = JSON.parse(stored);
click({ action: "sign", id: original.candidates[0].id });
assert.equal(JSON.parse(stored).artists.length, 1);
click({ tab: "studio" });
assert.match(element("content").innerHTML, /Start an album/);
element("artist").value = JSON.parse(stored).artists[0].id;
element("booth").value = 0;
element("genre").value = "Pop";
element("audience").value = "Adult";
element("budget").value = 4000;
element("title").value = "<script>alert(1)</script>";
element("theme1").value = "Summer";
listeners.submit({ target: { id: "albumForm" }, preventDefault() {} });
assert.equal(JSON.parse(stored).albums.length, 1);
for (let i = 0; i < 20 && !JSON.parse(stored).albums[0].released; i++) {
  let s = JSON.parse(stored);
  if (s.event) click({ action: "choose", id: 2 });
  s = JSON.parse(stored);
  let p = s.albums[0],
    d = p.production;
  if (d.releaseReady) {
    element("release-title-" + p.id).value = p.title;
    click({ action: "release", id: p.id });
    click({ action: "ackLaunch", id: p.id });
    break;
  }
  if (!d.cooldown) {
    click({ action: "stage", id: p.id, option: 1 });
    assert.match(element("production").innerHTML, /RATING/);
    click({ action: "continue", id: p.id });
  }
  element("advance").onclick();
}
assert.ok(JSON.parse(stored).albums[0].released);
click({ tab: "catalog" });
assert.match(element("content").innerHTML, /Production & release ratings/);
assert.match(element("content").innerHTML, /&lt;script&gt;/);
assert.ok(!element("content").innerHTML.includes("<script>"));
click({ tab: "staff" });
assert.match(element("content").innerHTML, /Public Relations/);
click({ tab: "journal" });
assert.match(element("content").innerHTML, /Industry wire/);
click({ tab: "hq" });
assert.match(element("content").innerHTML, /Bedroom Label/);
assert.match(element("content").innerHTML, /Pick a tile/);
click({ action: "hqTile", x: "0", y: "0" });
assert.match(element("content").innerHTML, /Build on tile 1, 1/);
const cashBeforeBuild = JSON.parse(stored).cash;
click({ action: "buildFacility", fac: "writers", x: "0", y: "0" });
assert.equal(JSON.parse(stored).hq.facilities[0].id, "writers");
assert.equal(JSON.parse(stored).cash, cashBeforeBuild - 4000);
assert.match(element("content").innerHTML, /Upgrade to level 2/);
click({ action: "hqMove", fac: "writers" });
assert.match(element("content").innerHTML, /Move here/);
click({ action: "hqTile", x: "2", y: "1" });
assert.deepEqual([JSON.parse(stored).hq.facilities[0].x, JSON.parse(stored).hq.facilities[0].y], [2, 1]);
click({ tab: "studio" });
assert.match(element("content").innerHTML, /Album theme/);
assert.match(element("content").innerHTML, /Combo notebook/);
assert.match(
  element("content").innerHTML,
  /<td class="fit-/,
  "a recorded combo shows its fit in the notebook",
);
assert.equal(
  vm.runInContext("state.albums.some((p) => p.production?.results.some((r) => r.parts.length > 7))", context),
  true,
  "a themed album has extra calculation rows",
);
assert.equal(
  vm.runInContext("validProductionSave(JSON.parse(JSON.stringify(state)))", context),
  true,
  "a save with themed albums survives a page reload",
);
assert.equal(vm.runInContext("validSave(JSON.parse(JSON.stringify(state)))", context), true);
assert.equal(vm.runInContext("validSave({version:1})", context), false);
assert.equal(
  vm.runInContext(
    "(() => { const c = JSON.parse(JSON.stringify(state)); c.hq.facilities[0].level = 9; return validSave(c); })()",
    context,
  ),
  false,
);
console.log(
  "PASS interface harness: initial render, tabs, signing, album form, week progression, event resolution, escaping, headquarters build and move, themes and combo notebook, save round-trip and invalid-save rejection.",
);
