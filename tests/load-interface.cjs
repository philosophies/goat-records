// Runs the interface scripts in the order index.html loads them (src/ui/*.js, then src/app.js).
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
module.exports = function loadInterface(context) {
  const root = path.join(__dirname, ".."),
    html = fs.readFileSync(path.join(root, "index.html"), "utf8"),
    scripts = [...html.matchAll(/<script src="(src\/(?:ui\/[^"]+|app)\.js)"/g)].map((m) => m[1]);
  for (const src of scripts) vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), context);
};
