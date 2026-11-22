// DOM harness for carrying the hall of fame with saves (T67): export a CEO save, clear this browser's
// legacy profile, import the file and find the same hall and achievements; old files still import.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      id,
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      hidden: false,
      classList: { toggle() {} },
      dataset: {},
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
        this.onclose?.();
      },
    });
  return elements.get(id);
};
const storage = new Map();
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] ??= []).push(fn),
  },
  localStorage: {
    keyed: true,
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  confirm: () => true,
  matchMedia: () => ({ matches: true }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
let exported = null;
context.__capture = (raw) => (exported = raw);
run("downloadSave = (raw) => __capture(raw);");
const importFile = (raw) =>
  element("import").onchange({ target: { files: [{ size: raw.length, text: async () => raw }], value: "" } });

(async () => {
  // A finished run in the hall and some achievements.
  run(`state = G.create(67, { ceo: true }); G.setStarter(state, false); state.awards = 1; state.cash = 2e6;
    G.advance(state); while (state.event) G.choose(state, state.event.options.length - 1);
    state.finished = true; state.bankrupt = true; save(); render();`);
  const before = JSON.parse(storage.get("goat-records-legacy"));
  assert.equal(before.hall.length, 1);
  assert.ok(before.achievements.includes("award"));

  element("export").onclick();
  const file = JSON.parse(exported);
  assert.deepEqual(file.legacyProfile, before, "the file carries the hall and achievements");
  assert.equal(
    JSON.parse(storage.get("side-a-save-v1")).legacyProfile,
    undefined,
    "never inside the stored save",
  );

  // A fresh browser: nothing in the hall.
  storage.delete("goat-records-legacy");
  run("GoatLegacy.reset();");
  assert.equal(run("GoatLegacy.profile().hall.length"), 0);
  await importFile(exported);
  assert.equal(element("loadSaveDialog").open, true);
  element("keepSaveMode").onclick();
  const after = JSON.parse(storage.get("goat-records-legacy"));
  assert.deepEqual(after.hall, before.hall);
  assert.deepEqual(after.achievements, before.achievements);
  assert.equal(run("state.legacyProfile"), undefined, "the loaded run does not keep the profile");

  // Importing the same file again adds nothing.
  await importFile(exported);
  element("keepSaveMode").onclick();
  assert.equal(JSON.parse(storage.get("goat-records-legacy")).hall.length, 1);

  // A file from before this change (no profile) still imports and leaves the hall alone.
  const old = { ...file };
  delete old.legacyProfile;
  await importFile(JSON.stringify(old));
  element("keepSaveMode").onclick();
  assert.equal(JSON.parse(storage.get("goat-records-legacy")).hall.length, 1);
  assert.equal(run("state.week"), file.week);

  // Cancelling an import does not merge anything.
  const other = {
    ...file,
    legacyProfile: {
      hall: [{ ...file.legacyProfile.hall[0], label: "Someone Else", when: 99 }],
      achievements: [],
    },
  };
  await importFile(JSON.stringify(other));
  element("cancelLoadSave").onclick();
  assert.equal(JSON.parse(storage.get("goat-records-legacy")).hall.length, 1);
  console.log("Legacy carry interface harness passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
