// Legacy (CEO runs): the hall of fame and achievements kept in this browser across runs, the
// challenge and perk choices when starting a new label, and the Hall of fame in the trophy case.
"use strict";

const GoatLegacy = (() => {
  const KEY = "goat-records-legacy";
  let cache = null;
  function profile() {
    if (cache) return cache;
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || "null");
      cache = {
        hall: Array.isArray(p?.hall) ? p.hall : [],
        achievements: Array.isArray(p?.achievements) ? p.achievements : [],
      };
    } catch {
      cache = { hall: [], achievements: [] };
    }
    return cache;
  }
  function store(p) {
    cache = p;
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  }
  /** Keeps this run's achievements and, once it ends, its hall of fame entry. */
  function sync() {
    if (!state?.company?.legacy) return;
    const p = profile(),
      ids = G.unlockedAchievements(p.achievements, state);
    let changed = ids.length !== p.achievements.length;
    let hall = p.hall;
    if (state.finished && !state.company.legacy.recorded) {
      hall = G.recordRun(p.hall, state, Date.now());
      changed = true;
      save();
    }
    if (changed) store({ hall, achievements: ids });
  }
  /** The choices for a new label, read from the dialog. */
  function setup() {
    const challenge = document.getElementById("newLabelChallenge")?.value || "";
    const perks = [...document.querySelectorAll("#newLabelPerks input:checked")].map((x) => x.value);
    if (!challenge && !perks.length) return {};
    const weekly = challenge === "weekly" ? G.weeklyChallenge(new Date()) : null;
    return { challenge: challenge || undefined, perks, ...(weekly ? { seed: weekly.seed } : {}) };
  }
  /** The challenge list and the perks this browser has opened, for the new label dialog. */
  function dialogHtml() {
    const count = profile().achievements.length,
      open = G.perksOpen(count),
      weekly = G.weeklyChallenge(new Date());
    const challenges = G.CHALLENGES.map(
      (c) =>
        `<option value="${c.id}">${esc(c.name)}${c.id === "weekly" ? ` (week ${weekly.week})` : ""}</option>`,
    ).join("");
    const perks = G.PERKS.map((p) => {
      const ok = open.includes(p.id);
      return `<label class="perk ${ok ? "" : "locked"}"><input type="checkbox" value="${p.id}" ${ok ? "" : "disabled"} /><span><b>${esc(p.name)}</b> <small>${esc(p.text)}${ok ? "" : ` Opens at ${p.unlock} achievements.`}</small></span></label>`;
    }).join("");
    return `<label for="newLabelChallenge">Start<select id="newLabelChallenge"><option value="">A normal start</option>${challenges}</select></label><p id="newLabelChallengeText" class="muted"></p><fieldset id="newLabelPerks"><legend>Hall of fame perks · ${count} of ${G.ACHIEVEMENTS.length} achievements · up to ${G.LEGACY_RULES.maxPerks}</legend><p class="muted">Achievements from every run in this browser open these. Prestige bonuses, bought with a finished run's score, are chosen at New Game+.</p>${perks}</fieldset>`;
  }
  /** Merges a hall of fame and achievements from an imported save file into this browser's. */
  function importProfile(incoming) {
    if (!incoming) return profile();
    const merged = G.mergeLegacy(profile(), incoming);
    store(merged);
    return merged;
  }
  return { profile, sync, setup, dialogHtml, importProfile, KEY, reset: () => (cache = null) };
})();

function hallPanel() {
  if (!state.company?.legacy) return '<div class="empty">The hall of fame keeps CEO runs.</div>';
  const p = GoatLegacy.profile(),
    unlocked = new Set(G.unlockedAchievements(p.achievements, state)),
    mine = new Set(state.company.legacy.achievements);
  const challenge = state.company.legacy.challenge
    ? `<p class="muted">This run: ${esc(G.CHALLENGES.find((c) => c.id === state.company.legacy.challenge.id).name)}${state.company.legacy.challenge.id === "weekly" ? ` (${esc(G.CHALLENGES.find((c) => c.id === state.company.legacy.challenge.twist)?.name || "")})` : ""}.</p>`
    : "";
  const perks = state.company.legacy.perks.length
    ? `<p class="muted">Hall of fame perks: ${state.company.legacy.perks.map((id) => esc(G.PERKS.find((x) => x.id === id).name)).join(", ")}.</p>`
    : "";
  const endings = { complete: "Twenty years", fired: "Removed as CEO", folded: "Folded" };
  const hall = p.hall.length
    ? `<table class="vault-table hall-table"><thead><tr><th>Label</th><th>Ending</th><th>Peak</th><th>Best album</th></tr></thead><tbody>${p.hall
        .slice(0, 20)
        .map(
          (e) =>
            `<tr><td>${esc(e.label)}${e.challenge ? ` <small>${esc(G.CHALLENGES.find((c) => c.id === e.challenge)?.name || "")}</small>` : ""}</td><td>${esc(endings[e.ending] || e.ending || "")} · ${e.years} yr</td><td>Phase ${e.peakPhase}</td><td>${e.bestAlbum ? `${esc(e.bestAlbum.title)} <small>${e.bestAlbum.quality}</small>` : "—"}${e.superstars.length ? `<br><small>${esc(e.superstars.join(", "))}</small>` : ""}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : '<div class="empty">Finished runs are listed here, in this browser.</div>';
  const grid = G.ACHIEVEMENTS.map(
    (a) =>
      `<li class="${unlocked.has(a.id) ? "got" : ""}${mine.has(a.id) ? " now" : ""}" title="${esc(a.text)}"><b>${esc(a.name)}</b><small>${esc(a.text)}</small></li>`,
  ).join("");
  return `${challenge}${perks}<h4>Runs</h4>${hall}<h4>Achievements · ${unlocked.size} of ${G.ACHIEVEMENTS.length}</h4><ul class="achievements">${grid}</ul>`;
}

GoatUI.registerPanel({ id: "hall", label: "Hall of fame", order: 63, render: hallPanel });
GoatUI.hud.push({
  render() {
    try {
      GoatLegacy.sync();
    } catch {}
    return "";
  },
});
GoatUI.change.push((e) => {
  if (e.target?.id !== "newLabelChallenge") return false;
  const c = G.CHALLENGES.find((x) => x.id === e.target.value);
  const box = document.getElementById("newLabelChallengeText");
  if (box) box.textContent = c ? c.text : "";
  return true;
});
