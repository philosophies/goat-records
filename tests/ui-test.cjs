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
const prefs = {};
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: {
    getItem: (k) => (k === "side-a-save-v1" ? stored : (prefs[k] ?? null)),
    setItem: (k, v) => (k === "side-a-save-v1" ? (stored = v) : (prefs[k] = v)),
  },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context, { classic: true });
// The lot is the main screen. There is no menu: every panel opens from a person or place on it.
assert.match(element("lot").innerHTML, /data-action="hqTile"/);
assert.match(element("lot").innerHTML, /Living Room/);
assert.match(element("lotRoof").innerHTML, /Bedroom Label/);
assert.equal(element("drawer").hidden, true);
assert.equal(element("content").innerHTML, "");
assert.equal(element("menu").innerHTML, "", "no menu bar");
for (const place of ["desk", "trophies", "office", "room:0", "newroom"])
  assert.match(
    element("lot").innerHTML,
    new RegExp(`data-tab="${place}"`),
    place + " is on the ground floor",
  );
assert.match(element("lotRoof").innerHTML, /data-tab="label"/);
for (const place of ["billboard", "newsstand", "bus", "street"])
  assert.match(element("lotTown").innerHTML, new RegExp(`data-tab="${place}"`), place + " is on the street");
click({ tab: "street" });
assert.match(
  element("content").innerHTML,
  /Hillside Mansion[\s\S]*Locked · rank 4/,
  "locked locations show their rank",
);
click({ action: "closePanel" });
assert.match(element("roster").innerHTML, /data-tab="desk"[\s\S]*Find artists/);
assert.match(
  element("clockReason").textContent,
  /Paused · press 1×/,
  "a new label starts paused with a hint",
);
assert.match(element("clock").innerHTML, /data-action="clockSpeed"/);
assert.match(element("date").innerHTML.replace(/<[^>]+>/g, ""), /^YEAR 01 · WEEK 1 · DAY 1$/);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
click({ tab: "desk" });
assert.equal(element("drawer").hidden, false);
assert.equal(element("drawerTitle").textContent, "Front desk");
assert.match(
  element("content").innerHTML,
  /desk~sec-team[\s\S]*id="sec-scout"[\s\S]*Available artists/,
  "scouting opens first and staffing has its own section",
);
assert.doesNotMatch(element("content").innerHTML, /id="sec-team"/);
click({ tab: "desk~sec-team" });
assert.match(element("content").innerHTML, /id="sec-team"[\s\S]*Recruitment budget/);
assert.doesNotMatch(element("content").innerHTML, /id="sec-scout"/);
assert.match(element("clockReason").textContent, /panel open/, "an open panel holds the clock");
click({ action: "closePanel" });
assert.equal(element("drawer").hidden, true);
click({ action: "clockSpeed", id: 2 });
assert.equal(vm.runInContext("GoatClock.speed", context), 2);
assert.equal(prefs["goat-records-clock-speed"], "2", "the chosen speed is remembered");
assert.match(element("clockReason").textContent, /2× · time is running/);
click({ tab: "scout" });
assert.match(element("content").innerHTML, /Available artists/);
assert.equal(vm.runInContext("GoatClock.current().held", context), true, "the chosen speed waits while held");
const original = JSON.parse(stored);
click({ action: "sign", id: original.candidates[0].id });
assert.equal(JSON.parse(stored).artists.length, 1);
const signed = JSON.parse(stored).artists[0];
assert.match(
  element("roster").innerHTML,
  new RegExp(`data-tab="artist:${signed.id}"[\\s\\S]*Ready to record`),
);
click({ tab: "artist:" + signed.id });
assert.equal(element("drawerTitle").textContent, signed.name);
assert.doesNotMatch(element("content").innerHTML, /id="albumForm"/);
click({ tab: "artist:" + signed.id + "~sec-record" });
assert.match(element("content").innerHTML, /Record an album[\s\S]*id="albumForm"/);
assert.equal(
  (
    element("content")
      .innerHTML.match(/<select id="artist">([\s\S]*?)<\/select>/)[1]
      .match(/<option/g) || []
  ).length,
  1,
  "an artist's sheet records that artist",
);
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
assert.match(element("content").innerHTML, /pick an empty tile on the lot/);
click({ action: "closePanel" });
// Building happens on the lot: a tile opens a popover that holds the clock.
assert.equal(element("lotPopover").hidden, true);
click({ action: "hqTile", x: "0", y: "0" });
assert.equal(element("lotPopover").hidden, false);
assert.match(element("lotPopover").innerHTML, /Build on tile 1, 1/);
assert.match(element("clockReason").textContent, /building/);
const cashBeforeBuild = JSON.parse(stored).cash;
click({ action: "buildFacility", fac: "writers", x: "0", y: "0" });
assert.equal(JSON.parse(stored).hq.facilities[0].id, "writers");
assert.equal(JSON.parse(stored).cash, cashBeforeBuild - 4000);
assert.match(element("lot").innerHTML, /Writers&#39; Room|Writers' Room/);
assert.match(element("lotPopover").innerHTML, /Upgrade to level 2/);
click({ action: "hqMove", fac: "writers" });
assert.match(element("lot").innerHTML, /Move here/);
click({ action: "hqTile", x: "2", y: "1" });
assert.deepEqual([JSON.parse(stored).hq.facilities[0].x, JSON.parse(stored).hq.facilities[0].y], [2, 1]);
click({ action: "hqClose" });
assert.equal(element("lotPopover").hidden, true);
click({ tab: "hq" });
assert.match(element("content").innerHTML, /Show on lot/);
click({ action: "hqFocus", x: "2", y: "1" });
assert.equal(element("drawer").hidden, true);
assert.match(element("lotPopover").innerHTML, /Upgrade to level 2/);
click({ action: "hqClose" });
click({ tab: "room:0" });
assert.equal(element("drawerTitle").textContent, "The Living Room");
assert.match(element("content").innerHTML, /Start an album here[\s\S]*Album theme/);
click({ tab: "studio" });
assert.equal(element("drawerTitle").textContent, "The Living Room", "the old studio link opens a free room");
click({ tab: "label~sec-notebook" });
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
click({ tab: "artist:99999" });
assert.equal(element("drawer").hidden, true, "a sheet for someone who left does not open");
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
  "PASS interface harness: lot main screen, places on the ground floor and street, roster, artist and room panels, clock controls and holds, old screen links, signing, album form, week progression, event resolution, escaping, building, moving and focusing facilities on the lot, themes and combo notebook, save round-trip and invalid-save rejection.",
);
