// Copies the game's files (the repository root's index.html, manifest, service worker, scripts,
// styles and icons) into www/, which the Android app bundles. Run before `npx cap sync android`.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.join(__dirname, ".."),
  out = path.join(__dirname, "www");
const ENTRIES = ["index.html", "manifest.webmanifest", "sw.js", "src", "styles", "icons"];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ENTRIES) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
const count = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`Copied ${count(out)} game files into www/.`);
