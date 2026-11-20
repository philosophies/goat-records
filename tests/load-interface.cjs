// Runs the page scripts in index.html order. Some harnesses supply a Node engine fixture.
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
module.exports = function loadInterface(context, { classic = false } = {}) {
  const root = path.join(__dirname, ".."),
    html = fs.readFileSync(path.join(root, "index.html"), "utf8"),
    scripts = [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map((m) => m[1]);
  const useEngineFixture = !!context.LabelGame;
  for (const src of scripts) {
    if (useEngineFixture && src !== "src/app.js" && !src.startsWith("src/ui/")) continue;
    if (classic && src === "src/app.js")
      context.localStorage.setItem("side-a-save-v1", JSON.stringify(context.LabelGame.create(71, { ceo: false })));
    vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), context, { filename: src });
  }
};
