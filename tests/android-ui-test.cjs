// The Android app (T69): exported saves go through the app's file and share plugins, and the copy step
// Checks rendering and actions, not real-browser layout.
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
  matchMedia: () => ({ matches: true }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
// bundles every file the page and the offline cache load.
const run = (code) => vm.runInContext(code, context);
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");

(async () => {
  // A native platform with the two plugins: export writes the file and opens the share sheet.
  const calls = [];
  context.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Filesystem: { writeFile: async (o) => (calls.push(["write", o]), { uri: "file:///cache/" + o.path }) },
      Share: { share: async (o) => calls.push(["share", o]) },
    },
  };
  run(`state = G.create(69, { ceo: true }); save(); render();`);
  element("export").onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls[0][0], "write");
  assert.equal(calls[0][1].path, `goat-records-week-${run("state.week")}.json`);
  assert.equal(calls[0][1].directory, "CACHE");
  assert.equal(JSON.parse(calls[0][1].data).week, run("state.week"));
  assert.equal(calls[1][0], "share");
  assert.equal(
    JSON.stringify(calls[1][1]),
    JSON.stringify({ title: calls[0][1].path, files: ["file:///cache/" + calls[0][1].path] }),
  );
  // A failure is shown, not thrown.
  context.Capacitor.Plugins.Share.share = async () => {
    throw Error("cancelled");
  };
  element("export").onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(element("message").textContent, /Export failed: cancelled/);

  // The copy step bundles every script, stylesheet, icon and cached file the page names.
  const root = path.join(__dirname, ".."),
    www = path.join(root, "android-app", "www");
  // The game ZIP leaves the Android project out.
  if (!fs.existsSync(path.join(root, "android-app", "copy-web.cjs"))) {
    console.log("Android interface harness passed (no Android project in this copy).");
    return;
  }
  execFileSync(process.execPath, [path.join(root, "android-app", "copy-web.cjs")], { stdio: "ignore" });
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8"),
    sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const named = [
    ...[...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|png|webmanifest))"/g)].map((m) => m[1]),
    ...[...sw.matchAll(/"((?:src|styles|icons)\/[^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(named.length > 60);
  for (const f of named) assert.ok(fs.existsSync(path.join(www, f)), `www/${f}`);
  const config = JSON.parse(fs.readFileSync(path.join(root, "android-app", "capacitor.config.json"), "utf8"));
  assert.equal(config.webDir, "www");
  const manifest = fs.readFileSync(
    path.join(root, "android-app/android/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  assert.match(manifest, /android:screenOrientation="sensorLandscape"/);
  console.log("Android interface harness passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
