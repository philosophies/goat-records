#!/usr/bin/env node
// Prints what a contributor needs to start a session: the working rules from AGENTS.md, the
// current status and the next task from production/backlog.md (a task in progress comes first,
// otherwise the first open task whose dependencies are done).
//
//   node tools/next-task.cjs          brief + status + next task
//   node tools/next-task.cjs --list   one line per task with its status
//   node tools/next-task.cjs T12      brief + status + that task
"use strict";
const fs = require("node:fs"),
  path = require("node:path");

const root = path.join(__dirname, ".."),
  read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");

/** Tasks from the backlog: { id, title, mark, deps, text }. */
function tasks() {
  const parts = read("production/backlog.md").split(/^### /m).slice(1);
  return parts.map((p) => {
    const head = p.split("\n")[0],
      m = head.match(/^\[(.)\]\s+(T\d+)\s+·\s+(.*)$/);
    if (!m) return null;
    const deps = (p.match(/^Depends on:\s*(.*)$/m)?.[1] || "")
      .split(/[,\s]+/)
      .filter((d) => /^T\d+$/.test(d));
    return { mark: m[1], id: m[2], title: m[3].trim(), deps, text: "### " + p.split(/^## /m)[0].trim() };
  });
}
function section(md, heading) {
  const i = md.indexOf("## " + heading);
  if (i < 0) return "";
  const rest = md.slice(i);
  const j = rest.indexOf("\n## ", 3);
  return (j < 0 ? rest : rest.slice(0, j)).trim();
}

const all = tasks().filter(Boolean),
  done = new Set(all.filter((t) => t.mark === "x").map((t) => t.id)),
  arg = process.argv[2];

if (arg === "--list") {
  const label = { x: "done", "~": "in progress", " ": "open" };
  for (const t of all) {
    const blocked = t.mark === " " && t.deps.some((d) => !done.has(d));
    console.log(`${t.id}  ${(blocked ? "blocked" : label[t.mark] || t.mark).padEnd(11)}  ${t.title}`);
  }
  process.exit(0);
}

const chosen = arg
  ? all.find((t) => t.id === arg.toUpperCase())
  : all.find((t) => t.mark === "~") || all.find((t) => t.mark === " " && t.deps.every((d) => done.has(d)));

const agents = read("AGENTS.md");
console.log(section(agents, "Rules"));
console.log("\n" + section(agents, "Each session"));
console.log("\n## Status (production/status.md)\n");
console.log(
  read("production/status.md")
    .replace(/^# .*\n+/, "")
    .trim(),
);
console.log(`\n## Task (${done.size}/${all.length} done)\n`);
if (!chosen) {
  if (arg) console.log(`No task ${arg} in the backlog.`);
  else if (all.length && done.size === all.length) console.log("All backlog tasks are complete.");
  else console.log("No open task has all of its dependencies complete.");
} else {
  const open = chosen.deps.filter((d) => !done.has(d));
  if (open.length) console.log(`Warning: depends on ${open.join(", ")}, not done yet.\n`);
  console.log(chosen.text);
  console.log("\nDesign: design/gdd/ceo-2.0.md (read only the sections the task names).");
}
