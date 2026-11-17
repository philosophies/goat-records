const { spawnSync } = require("node:child_process");
for (const file of [
  "test.cjs",
  "management-test.cjs",
  "road-test.cjs",
  "industry-test.cjs",
  "inspiration-test.cjs",
  "tour-timing-test.cjs",
  "tour-cadence-test.cjs",
  "ui-test.cjs",
  "road-ui-test.cjs",
  "industry-ui-test.cjs",
]) {
  const result = spawnSync(process.execPath, [file], { cwd: __dirname + "/tests", encoding: "utf8", windowsHide: true });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("All simulation and interface suites passed.");
