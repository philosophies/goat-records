// Runs the page scripts in index.html order. Some harnesses supply a Node engine fixture.
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
module.exports = function loadInterface(context, { classic = false } = {}) {
  const root = path.join(__dirname, ".."),
    html = fs.readFileSync(path.join(root, "index.html"), "utf8"),
    scripts = [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map((m) => m[1]);
  const useEngineFixture = !!context.LabelGame;
  // Most harness storage mocks hold one value, the save. The legacy profile, kept beside the save
  // in a browser, gets its own slot here so it never overwrites it.
  const real = context.localStorage;
  if (real && !real.keyed) {
    const PROFILE = "goat-records-legacy",
      other = new Map();
    context.localStorage = {
      keyed: true,
      getItem: (k) => (k === PROFILE ? (other.get(k) ?? null) : real.getItem(k)),
      setItem: (k, v) => (k === PROFILE ? other.set(k, String(v)) : real.setItem(k, v)),
      removeItem: (k) => (k === PROFILE ? other.delete(k) : real.removeItem?.(k)),
    };
  }
  for (const src of scripts) {
    if (useEngineFixture && src !== "src/app.js" && !src.startsWith("src/ui/")) continue;
    if (classic && src === "src/app.js")
      context.localStorage.setItem(
        "side-a-save-v1",
        JSON.stringify(context.LabelGame.create(71, { ceo: false })),
      );
    vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), context, { filename: src });
  }
};
