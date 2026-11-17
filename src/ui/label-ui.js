// Headquarters, label rank and album theme screens. Uses the page globals set up in app.js
// (G, state, esc, money, disable, blocked) at render time.
"use strict";

const hqView = { selected: null, moving: null };

/** Renders a pixel map as a crisp SVG. Each character is one pixel; "." is transparent. */
function pixelSvg(map, accent, size = 40, label = "") {
  const colors = { ...G.PALETTE, a: accent };
  let rects = "";
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (row[x + run] === c) run++;
      if (c !== "." && colors[c])
        rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${colors[c]}"/>`;
      x += run;
    }
  });
  const w = map[0].length,
    h = map.length;
  return `<svg class="pixel" viewBox="0 0 ${w} ${h}" width="${size}" height="${Math.round((size * h) / w)}" shape-rendering="crispEdges" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${rects}</svg>`;
}
function artistSprite(a, i) {
  return `<span class="sprite" style="--delay:${(i % 5) * 0.37}s" title="${esc(a.name)}">${pixelSvg(G.ARTIST_SPRITE, G.GENRE_COLORS[a.genre] || "#ccc", 18)}</span>`;
}
function facilityDef(id) {
  return G.FACILITIES.find((f) => f.id === id);
}

/* ---------------- Rank ---------------- */

function rankChecklist(st) {
  if (!st.next) return '<p class="muted">Top rank reached. Your label is an empire.</p>';
  const fmt = (c) =>
    c.key === "cash"
      ? money(c.have) + " / " + money(c.need)
      : c.key === "chartPeak"
        ? (c.have ? "#" + c.have : "none") + " / Top " + c.need
        : `${c.have} / ${c.need}`;
  return `<ul class="rank-checks">${st.checks
    .map(
      (c) =>
        `<li class="${c.met ? "met" : ""}"><span>${c.met ? "✓" : "·"}</span>${esc(c.name)} <b>${fmt(c)}</b></li>`,
    )
    .join("")}</ul>`;
}
function rankUnlocks(n) {
  const r = G.RANKS[n - 1],
    prev = G.RANKS[n - 2],
    facilities = G.FACILITIES.filter((f) => f.rank === n).map((f) => f.name),
    rooms = G.BOOTHS.filter((b) => b.labelTier === r.tier && (!prev || prev.tier < r.tier)).map(
      (b) => b.name,
    ),
    out = [`Roster ${r.slots}`, `Lot ${r.lot[0]}×${r.lot[1]}`];
  if (r.themeSlots > (prev?.themeSlots || 1)) out.push("Two themes per album");
  if (r.grantThemes) out.push(`${r.grantThemes} new themes`);
  if (facilities.length) out.push(facilities.join(", "));
  if (rooms.length) out.push("Room: " + rooms.join(", "));
  return out;
}
function rankPanel() {
  const st = G.rankStatus(state);
  return `<article class="card rank-card"><div class="rank-badge" aria-hidden="true">${"★".repeat(st.rank)}<span>${"★".repeat(G.RANKS.length - st.rank)}</span></div><div><span class="tag">LABEL RANK ${st.rank} / ${G.RANKS.length}</span><h2>${esc(st.name)}</h2>${
    st.next
      ? `<p>Next: <b>${esc(st.next.name)}</b>. Promotion happens at the weekly settlement once every goal is met.</p>${rankChecklist(st)}<p class="muted">Unlocks: ${rankUnlocks(st.next.rank).map(esc).join(" · ")}</p>`
      : rankChecklist(st)
  }</div></article>`;
}
function rankBanner() {
  const r = state.rankUps.find((x) => !x.seen);
  if (!r) return "";
  return `<div class="chart-alert rank-alert" role="status"><div class="chart-award">★${r.rank}</div><div><span class="tag">WEEK ${r.week} · LABEL RANK UP</span><h2>${esc(G.RANKS[r.rank - 1].name)}</h2><p>${rankUnlocks(r.rank).map(esc).join(" · ")}${r.themes.length ? ". Themes found: " + r.themes.map(esc).join(", ") : ""}.</p></div><button data-action="ackRank">Continue</button></div>`;
}
function rankLine() {
  const st = G.rankStatus(state);
  if (!st.next) return "Top label rank reached.";
  const left = st.checks.filter((c) => !c.met).map((c) => c.name.toLowerCase());
  return `Next rank: ${st.next.name} (${left.length ? "needs " + left.join(", ") : "promotes at the next settlement"}).`;
}

/* ---------------- Headquarters ---------------- */

function occupantsByTile() {
  const out = new Map(),
    place = (fid, a) => {
      const f = G.builtFacility(state, fid);
      if (!f) return false;
      const k = f.x + "," + f.y;
      out.set(k, [...(out.get(k) || []), a]);
      return true;
    };
  for (const a of state.artists) {
    if (G.onTour(state, a.id)) continue;
    const recording = state.albums.some((p) => !p.released && p.artist === a.id);
    if (recording) place("vocal", a) || place("mix", a) || place("writers", a);
    else place("lounge", a) || place("rehearsal", a) || place("bar", a);
  }
  return out;
}
function synergyEdges() {
  return G.activeSynergies(state).map((syn) => {
    const a = G.builtFacility(state, syn.pair[0]),
      b = G.builtFacility(state, syn.pair[1]);
    return { name: syn.name, a, b };
  });
}
function lotGrid() {
  const [w, h] = G.lotSize(state),
    next = G.RANKS[G.rank(state)]?.lot || [w, h],
    gw = Math.max(w, next[0]),
    gh = Math.max(h, next[1]),
    people = occupantsByTile(),
    edges = synergyEdges();
  let cells = "";
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const inside = x < w && y < h,
        f = inside && G.facilityAt(state, x, y),
        key = x + "," + y,
        sel = hqView.selected === key,
        linked = f && edges.filter((e) => e.a === f || e.b === f);
      if (!inside) {
        cells += `<div class="tile locked" aria-label="Locked tile"><small>Next rank</small></div>`;
        continue;
      }
      if (!f) {
        cells += `<button class="tile empty ${sel ? "selected" : ""} ${hqView.moving ? "target" : ""}" data-action="hqTile" data-x="${x}" data-y="${y}" aria-label="Empty tile ${x + 1}, ${y + 1}"><span class="plus">${hqView.moving ? "Move here" : "+"}</span></button>`;
        continue;
      }
      const def = facilityDef(f.id),
        who = people.get(key) || [];
      cells += `<button class="tile built ${sel ? "selected" : ""} ${hqView.moving === f.id ? "moving" : ""} ${linked.length ? "linked" : ""}" style="--accent:${def.accent}" data-action="hqTile" data-x="${x}" data-y="${y}" aria-label="${esc(def.name)} level ${f.level}${linked.length ? ", paired: " + linked.map((e) => e.name).join(", ") : ""}"><span class="wall"></span>${pixelSvg(def.icon, def.accent, 44)}<span class="tile-name">${esc(def.name)}</span><span class="pips">${"●".repeat(f.level)}${"○".repeat(G.HQ.maxLevel - f.level)}</span>${who.length ? `<span class="crowd">${who.slice(0, 3).map(artistSprite).join("")}</span>` : ""}</button>`;
    }
  return `<div class="lot" style="--cols:${gw}">${cells}</div>`;
}
function buildMenu(x, y) {
  const r = G.rank(state);
  return `<h3>Build on tile ${x + 1}, ${y + 1}</h3><div class="build-list">${G.FACILITIES.map((def) => {
    const built = G.builtFacility(state, def.id),
      locked = r < def.rank;
    return `<div class="build-option ${built || locked ? "off" : ""}" style="--accent:${def.accent}">${pixelSvg(def.icon, def.accent, 30)}<div><b>${esc(def.name)}</b><small>${esc(def.text)}<br>${money(def.cost)} · ${money(def.upkeep)}/week per level${locked ? ` · rank ${def.rank} (${esc(G.RANKS[def.rank - 1].name)})` : ""}</small></div><button data-action="buildFacility" data-fac="${def.id}" data-x="${x}" data-y="${y}" ${disable(blocked() || built || locked || state.cash < def.cost)}>${built ? "Built" : "Build"}</button></div>`;
  }).join("")}</div>`;
}
function facilityPanel(f) {
  const def = facilityDef(f.id),
    pairs = G.SYNERGIES.filter((s) => s.pair.includes(f.id)),
    active = G.activeSynergies(state);
  return `<div class="facility-head" style="--accent:${def.accent}">${pixelSvg(def.icon, def.accent, 56, def.name)}<div><span class="tag">LEVEL ${f.level} / ${G.HQ.maxLevel} · ${money(def.upkeep * f.level)}/week</span><h3>${esc(def.name)}</h3><p>${esc(def.text)}</p></div></div><p class="muted">Pairings (share a wall): ${pairs
    .map((p) => {
      const other = facilityDef(p.pair.find((id) => id !== f.id));
      return `${active.includes(p) ? "✓" : "·"} ${esc(p.name)} with ${esc(other.name)}`;
    })
    .join(" · ")}</p><div class="actions">${
    f.level < G.HQ.maxLevel
      ? `<button data-action="upgradeFacility" data-fac="${f.id}" ${disable(blocked() || state.cash < G.upgradeCost(f))}>Upgrade to level ${f.level + 1} · ${money(G.upgradeCost(f))}</button>`
      : ""
  }<button data-action="hqMove" data-fac="${f.id}" ${disable(blocked())}>${hqView.moving === f.id ? "Cancel move" : "Move · " + money(G.HQ.moveCost)}</button><button data-action="closeFacility" data-fac="${f.id}" ${disable(blocked())}>Close (no refund)</button></div>${hqView.moving === f.id ? '<p class="move-hint">Choose a tile. Moving onto a built tile swaps the two.</p>' : ""}`;
}
function hqSummary() {
  const b = G.hqBonuses(state),
    inc = G.hqIncome(state),
    areas = ["Identity", "Songwriting", "Performance", "Sound", "Reach"],
    rows = [
      ...areas.map((n, i) => [n, b.stages[i].value ? "+" + b.stages[i].value : "—"]),
      ["Market impact", b.market ? "+" + b.market : "—"],
      ["Weekly takings", money(inc.total)],
      ["Weekly upkeep", money(G.hqUpkeep(state))],
    ];
  return `<div class="metrics hq-metrics">${rows.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join("")}</div>`;
}
function synergyText(p) {
  const areas = ["Identity", "Songwriting", "Performance", "Sound", "Reach"],
    out = Object.entries(p.stages || {}).map(([i, v]) => `${areas[i]} +${v}`);
  if (p.incomeBonus) out.push(`takings +${Math.round(p.incomeBonus * 100)}%`);
  if (p.discovery) out.push(`theme finds +${Math.round(p.discovery * 100)}%`);
  if (p.trainingDiscount) out.push(`development fees −${Math.round(p.trainingDiscount * 100)}%`);
  return out.join(", ");
}
function headquarters() {
  const [w, h] = G.lotSize(state),
    sel = hqView.selected?.split(",").map(Number),
    f = sel && G.facilityAt(state, sel[0], sel[1]);
  const pairs = G.SYNERGIES.map((p) => {
    const on = G.activeSynergies(state).includes(p);
    return `<li class="${on ? "met" : ""}"><span>${on ? "✓" : "·"}</span><b>${esc(p.name)}</b><small>${esc(facilityDef(p.pair[0]).name)} + ${esc(facilityDef(p.pair[1]).name)} · ${esc(synergyText(p))}</small></li>`;
  }).join("");
  return `${rankPanel()}<div class="sectionhead"><h2>Headquarters</h2><span class="muted">${state.hq.facilities.length} facilities · lot ${w}×${h}</span></div><p class="muted">Each facility fills one tile and can be upgraded twice. Facilities that share a wall can pair up for an extra bonus. Your artists hang out where they work: recording artists in the booth, idle ones in the lounge.</p><div class="hq-layout"><div>${lotGrid()}${hqSummary()}</div><aside class="card hq-panel" aria-live="polite">${
    f
      ? facilityPanel(f)
      : sel
        ? buildMenu(sel[0], sel[1])
        : "<h3>Pick a tile</h3><p>Choose an empty tile to build, or a facility to upgrade or move it.</p>"
  }</aside></div><h2>Pairings</h2><ul class="rank-checks pairings">${pairs}</ul>`;
}
function hqClick(b) {
  const action = b.dataset.action;
  if (action === "hqTile") {
    const x = Number(b.dataset.x),
      y = Number(b.dataset.y);
    if (hqView.moving) {
      const id = hqView.moving;
      hqView.moving = null;
      hqView.selected = x + "," + y;
      act(() => G.moveFacility(state, id, x, y));
      return true;
    }
    hqView.selected = hqView.selected === x + "," + y ? null : x + "," + y;
    render();
    return true;
  }
  if (action === "hqMove") {
    hqView.moving = hqView.moving === b.dataset.fac ? null : b.dataset.fac;
    render();
    return true;
  }
  if (action === "buildFacility") {
    act(() => G.buildFacility(state, b.dataset.fac, Number(b.dataset.x), Number(b.dataset.y)));
    return true;
  }
  if (action === "upgradeFacility") {
    act(() => G.upgradeFacility(state, b.dataset.fac));
    return true;
  }
  if (action === "closeFacility") {
    if (confirm(`Close the ${facilityDef(b.dataset.fac).name}? Build and upgrade costs are not refunded.`)) {
      hqView.selected = null;
      act(() => G.demolishFacility(state, b.dataset.fac));
    }
    return true;
  }
  if (action === "ackRank") {
    act(() => G.acknowledgeRankUp(state));
    return true;
  }
  return false;
}

/* ---------------- Album themes ---------------- */

function themeFields() {
  const opts = (none) =>
    (none ? '<option value="">None</option>' : "") +
    [...state.themes]
      .sort()
      .map((t) => `<option>${esc(t)}</option>`)
      .join("");
  return `<label>Album theme<select id="theme1" data-album-field>${opts(false)}</select></label>${
    G.themeSlots(state) > 1
      ? `<label>Second theme (optional)<select id="theme2" data-album-field>${opts(true)}</select></label>`
      : ""
  }`;
}
function selectedThemes() {
  const t = [$("theme1")?.value, $("theme2")?.value].filter(Boolean);
  return [...new Set(t)];
}
function comboQuote(genre, themes) {
  if (!themes.length) return "";
  const c = G.comboInfo(state, genre, themes),
    name = `${esc(genre)} × ${themes.map(esc).join(" + ")}`;
  if (!c.known)
    return `<p class="combo-line"><b>New combo · ${name}</b><br>Its fit is revealed when recording starts. Fit adds to Identity, Songwriting and Fan response.</p>`;
  return `<p class="combo-line fit-${c.fit.name.toLowerCase()}"><b>${name} · ${c.fit.name} fit (${c.fit.points >= 0 ? "+" : ""}${c.fit.points})</b><br>Combo level ${c.level}/${G.FIT.maxLevel}: +${c.level - 1} to every stage.${c.recent ? ` Released ${c.recent} time(s) in the last ${G.FIT.freshnessWindow} weeks: Reach −${Math.min(G.FIT.freshnessCap, c.recent * G.FIT.freshnessPenalty)}.` : ""}</p>`;
}
function comboNotebook() {
  const themes = [...state.themes].sort(),
    pairs = Object.entries(state.combos).filter(([, c]) => c.themes.length > 1);
  const cell = (g, t) => {
    const c = state.combos[g + " · " + t];
    if (!c) return '<td class="unknown">?</td>';
    const f = G.comboFit(g, [t]);
    return `<td class="fit-${f.name.toLowerCase()}" title="${esc(g)} × ${esc(t)}: ${c.releases} release(s)">${f.name}${c.releases ? `<small> ×${c.releases}</small>` : ""}</td>`;
  };
  return `<h2>Combo notebook</h2><p class="muted">${themes.length} of ${G.THEMES.length} themes discovered. Record a genre and theme together to learn their fit. A question mark is a combo you have not tried yet. New themes come from development sessions, finished tours, the Writers' Room and rank-ups.</p><div class="notebook"><table><thead><tr><th>Theme</th>${G.GENRES.map((g) => `<th>${esc(g)}</th>`).join("")}</tr></thead><tbody>${themes
    .map((t) => `<tr><th>${esc(t)}</th>${G.GENRES.map((g) => cell(g, t)).join("")}</tr>`)
    .join("")}</tbody></table></div>${
    pairs.length
      ? `<p class="muted">Paired themes: ${pairs
          .map(
            ([k, c]) =>
              `${esc(k)} (${G.comboFit(c.genre, c.themes).name}, ${c.releases} release${c.releases === 1 ? "" : "s"})`,
          )
          .join(" · ")}</p>`
      : ""
  }`;
}

GoatUI.registerPanel({ id: "hq", label: "Headquarters", order: 15, render: headquarters });
GoatUI.albumForm.push({
  fields: themeFields,
  read: () => ({ themes: selectedThemes() }),
  quote: (plan) => comboQuote(plan.genre, plan.themes || []),
});
GoatUI.studioSections.push({ render: comboNotebook });
GoatUI.banners.push({ render: rankBanner });
GoatUI.click.push(hqClick);
