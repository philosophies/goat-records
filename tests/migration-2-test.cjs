const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const G = require("../src/engine");
const loadInterface = require("./load-interface.cjs");

// Synthetic labels authored with the engines at these release tags. The chart entries
// were omitted to keep these fixtures small and exercise chart reinitialization.
const cases = [
  ["0.9.0", 1, 0],
  ["1.0.0", 3, 3],
  ["1.1.0", 5, 7],
];
const readFixture = (version) =>
  fs.readFileSync(path.join(__dirname, "fixtures", `classic-${version}.json`), "utf8");

for (const [version, phase, seats] of cases) {
  const raw = readFixture(version);
  const classic = JSON.parse(raw);
  const converted = G.convertClassicSave(classic);
  assert.deepEqual(classic, JSON.parse(raw), "conversion leaves the original save intact");
  assert.equal(converted.company.phase, phase);
  assert.equal(converted.week, classic.week);
  assert.equal(converted.cash, classic.cash);
  assert.equal(converted.artists[0].id, classic.artists[0].id);
  assert.equal(converted.albums[0].title, classic.albums[0].title);
  assert.equal(converted.albums[0].quality, classic.albums[0].quality);
  assert.deepEqual(converted.booths, classic.booths);
  assert.equal(G.builtFacility(converted, "writers").level, classic.hq.facilities[0].level);
  assert.equal(G.seats(converted), seats);
  assert.equal(converted.company.board?.confidence, seats ? 60 : undefined);
  const heads = Object.values(converted.company.departments).flatMap(({ head }) => head ? [head] : []);
  assert.equal(heads.length, classic.staff.length);
  for (const { legacyRole, name, skill, salary } of heads) {
    const employee = classic.employees[legacyRole];
    assert.deepEqual([name, skill, salary], [employee.name, employee.skill, employee.wage]);
  }
  assert.deepEqual(converted.staff, []);
  assert.ok(G.validSystemsSave(converted));
  assert.ok(G.validManagementSave(converted));
  const reloaded = G.migrate(JSON.parse(JSON.stringify(converted)));
  for (let i = 0; i < 10; i++) {
    while (reloaded.event) G.choose(reloaded, reloaded.event.options.length - 1);
    G.advance(reloaded);
  }
  assert.equal(reloaded.week, classic.week + 10, version);
  assert.equal(reloaded.finished, false);
  console.log(`PASS ${version} converts and plays ten weeks`);
}

function browser(raw) {
  const storage = new Map([["side-a-save-v1", raw]]);
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      dataset: {}, classList: { toggle() {} },
      showModal() { this.open = true; },
      close() { this.open = false; this.onclose?.(); },
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    console,
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout, Blob, URL,
  });
  loadInterface(context);
  return { storage, element, context };
}

const before = readFixture("1.1.0");
const kept = browser(before);
assert.equal(kept.element("loadSaveDialog").open, true);
assert.equal(kept.storage.get("side-a-save-v1"), before);
kept.element("keepSaveMode").onclick();
assert.equal(JSON.parse(kept.storage.get("side-a-save-v1")).classicMode, true);
assert.equal(browser(kept.storage.get("side-a-save-v1")).element("loadSaveDialog").open, undefined);

const conversion = browser(before);
conversion.element("convertSaveMode").onclick();
assert.equal(conversion.storage.get("goat-records-classic-backup"), before);
assert.equal(JSON.parse(conversion.storage.get("side-a-save-v1")).company.phase, 5);
assert.equal(conversion.element("exportClassicBackup").hidden, false);

const s = G.create(730, { ceo: true });
s.company.phase = 2;
s.cash = 100000;
s.week = 12;
G.advance(s);
assert.equal(s.event.type, "companyEvent");
assert.equal(s.event.artist, undefined);
const saved = browser(JSON.stringify(s));
assert.equal(JSON.parse(saved.storage.get("side-a-save-v1")).event.eventId, s.event.eventId);
console.log("PASS conversion prompt, raw backup, and company event reload");
