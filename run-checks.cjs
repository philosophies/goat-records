// Runs every simulation and interface suite in tests/ (files named test.cjs or *-test.cjs).
const { spawnSync } = require("node:child_process"),
  fs = require("node:fs");
const first = ["test.cjs"],
  files = fs
    .readdirSync(__dirname + "/tests")
    .filter((f) => f === "test.cjs" || f.endsWith("-test.cjs"))
    .sort(
      (a, b) => Number(b.includes("ui-test")) * -1 - Number(a.includes("ui-test")) * -1 || a.localeCompare(b),
    );
for (const file of [...first, ...files.filter((f) => !first.includes(f))]) {
  const result = spawnSync(process.execPath, [file], {
    cwd: __dirname + "/tests",
    encoding: "utf8",
    windowsHide: true,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("All simulation and interface suites passed.");
