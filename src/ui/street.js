// The street (CEO runs): the label's buildings side by side, each built up floor by floor.
// Drawn in place of the classic lot. The street scrolls sideways by drag, wheel, arrow keys or the
// minimap on the sidewalk. People stand on the floor where they are, and open their panel.
"use strict";

const BUILDING_LOOKS = {
  apartment: { wall: "#7a4a3a", trim: "#2a1a14", roof: "tank" },
  storefront: { wall: "#5a2a2e", trim: "#1c0f10", roof: "none" },
  studio: { wall: "#2c2a30", trim: "#0b0a0a", roof: "onair" },
  office: { wall: "#4a4f57", trim: "#16181c", roof: "antenna" },
  hq: { wall: "#1a1414", trim: "#e3b23c", roof: "spire" },
  venue: { wall: "#6e1a24", trim: "#2a0a0f", roof: "marquee" },
  media: { wall: "#26393d", trim: "#0e1719", roof: "dish" },
  warehouse: { wall: "#5b5246", trim: "#221f1a", roof: "none" },
  overseas: { wall: "#2e3442", trim: "#e3b23c", roof: "flags" },
};
/**
 * How built-up a building looks: the sum of its floor levels, up to 10. Grades 1–3 have a
 * painted sign, 4–6 a neon sign and lit windows, 7–10 gold trim, marquee bulbs and a rooftop billboard.
 */
/** A building's grade (1–10): the average level of its facility floors, so it grows with them. */
function buildingGrade(owned) {
  const levels = owned.floors.filter((f) => f.type !== "room").map((f) => f.level || 1);
  if (!levels.length) return 1;
  return Math.max(1, Math.min(10, Math.round(levels.reduce((n, x) => n + x, 0) / levels.length)));
}
function gradeBand(grade) {
  return grade >= 7 ? "gold" : grade >= 4 ? "neon" : "plain";
}
/** Rooftop details by building type, and the billboard on the grandest buildings. */
function roofArt(def, look, band) {
  const prop = look.roof === "none" ? "" : `<i class="roof-prop roof-${look.roof}" aria-hidden="true"></i>`,
    board =
      band === "gold"
        ? `<span class="roof-billboard" aria-hidden="true"><i class="emblem"></i>${esc(G.labelName(state))}</span>`
        : "";
  return prop || board ? `<div class="roof-art">${prop}${board}</div>` : "";
}

/** Where everyone stands: { "<building>:<floor>": [person] } plus the people with no floor. */
function streetCast() {
  const at = {},
    floors = G.allFloors(state),
    put = (place, person) => (at[place] ??= []).push(person),
    placeOf = (pred) => {
      const f = floors.find((x) => pred(x.floor));
      return f ? `${f.building}:${f.index}` : null;
    },
    home = floors.length ? `${floors[0].building}:${floors[0].index}` : null,
    hangout =
      placeOf((f) => f.type === "lounge") ||
      placeOf((f) => f.type === "rehearsal") ||
      placeOf((f) => f.type === "bar") ||
      home,
    officeFloor = state.company.buildings.find((b) => b.id === "office" && b.floors.length)
      ? "office:0"
      : home;
  for (const a of state.artists) {
    if (G.onTour(state, a.id)) continue;
    const p = recordingAlbum(a.id),
      place = p ? placeOf((f) => f.type === "room" && f.room === p.booth) : hangout;
    if (place)
      put(place, {
        tab: "artist:" + a.id,
        name: a.name,
        map: G.ARTIST_SPRITE,
        color: G.GENRE_COLORS[a.genre] || "#ccc",
        busy: !!p,
      });
  }
  for (const role of state.staff)
    if (officeFloor)
      put(officeFloor, {
        tab: "staffer:" + role,
        name: `${state.employees[role]?.name || role}, ${role}`,
        map: STAFF_SPRITE,
        color: ROLE_COLORS[role] || "#7b7f8c",
      });
  return at;
}

function streetPeople(list = []) {
  return list
    .map(
      (p, i) =>
        `<button class="street-person ${p.busy ? "busy" : ""}" data-tab="${p.tab}" title="${esc(p.name)}" aria-label="${esc(p.name)}" style="--i:${i}">${pixelSvg(p.map, p.color, 24)}</button>`,
    )
    .join("");
}

/**
 * How a room is fitted out, from its level as a share of the top level: "basic" (bare walls and one
 * bulb), "pro" (treated walls, wood floor, track lights, more kit) or "luxe" (gold records, warm
 * light, carpet). Works for today's three levels and for longer ladders.
 */
function floorFinish(level, max = G.FLOOR_LEVELS.max) {
  const share = level / Math.max(1, max);
  return share > 2 / 3 ? "luxe" : share > 1 / 3 ? "pro" : "basic";
}
function streetFloor(b, floor, index, cast) {
  const room = floor.type === "room",
    name = room ? G.BOOTHS[floor.room].name : G.FACILITIES.find((f) => f.id === floor.type).name,
    def = room ? null : G.FACILITIES.find((f) => f.id === floor.type),
    album = room ? state.albums.find((p) => !p.released && p.booth === floor.room) : null,
    tab = room ? `room:${floor.room}` : `floor:${b.id}:${index}`,
    accent = def?.accent || "#c9a227";
  const finish = floorFinish(floor.level || 1);
  return `<div class="street-floor ${room ? "room" : "facility"} ft-${floor.type} fin-${finish} ${album ? "rec" : ""}" style="--accent:${accent}"><button class="floor-hit" data-tab="${tab}" aria-label="${esc(name)}${room ? (album ? ", recording " + esc(album.title) : ", free") : ", level " + floor.level}"><span class="interior" aria-hidden="true"><i class="kit"></i><i class="light"></i></span><span class="plate">${esc(name)}${floor.renovating ? " · RENOVATING" : ""}</span>${def ? `<span class="floor-art">${pixelSvg(def.icon, accent, 28)}</span><span class="pips" title="Level ${floor.level} of ${G.floorLevelCap(state)} at this phase">${"●".repeat(floor.level)}${"○".repeat(Math.max(0, G.floorLevelCap(state) - floor.level))}</span>` : `<span class="desk mixing"></span>${album ? '<span class="on-air">REC</span>' : ""}`}</button><span class="floor-people">${streetPeople(cast[`${b.id}:${index}`])}</span></div>`;
}

function streetBuilding(def) {
  const owned = state.company.buildings.find((b) => b.id === def.id),
    look = BUILDING_LOOKS[def.id] || BUILDING_LOOKS.office,
    style = `--wall:${look.wall};--trim:${look.trim}`;
  if (!owned) {
    const open = state.company.phase >= def.phase;
    return `<section class="street-building plot ${open ? "for-sale" : "locked"}" id="bldg-${def.id}" style="${style}"><button class="plot-hit" data-tab="buy:${def.id}" aria-label="${esc(def.name)}: ${open ? "for sale, " + money(def.cost) : "opens at phase " + def.phase}"><b>${esc(def.name)}</b><small>${open ? "For sale · " + money(def.cost) : `Phase ${def.phase}`}</small></button></section>`;
  }
  const cast = streetCast(),
    floors = owned.floors
      .map((f, i) => streetFloor(owned, f, i, cast))
      .reverse()
      .join(""),
    room = owned.floors.length < def.maxFloors;
  const grade = buildingGrade(owned),
    band = gradeBand(grade);
  const first = state.company.buildings[0]?.id === def.id,
    hits = first ? Math.min(6, state.albums.filter((p) => p.released && (p.quality || 0) >= 75).length) : 0,
    records = hits
      ? `<span class="gold-records" aria-label="${hits} hit album${hits === 1 ? "" : "s"}">${"<i></i>".repeat(hits)}</span>`
      : "";
  return `<section class="street-building bldg-${def.id} band-${band}" id="bldg-${def.id}" data-grade="${grade}" style="${style}">${roofArt(def, look, band)}<button class="building-sign" data-tab="building:${def.id}">${esc(def.name)}<small>${owned.floors.length}/${def.maxFloors} floors · grade ${grade}</small>${records}</button>${room ? `<button class="floor-add" data-tab="buildfloor:${def.id}" aria-label="Build a floor on the ${esc(def.name)}">+ Floor</button>` : ""}${floors}<div class="building-door door-${def.id}" aria-hidden="true"></div></section>`;
}

/** The buildings in street order: everything owned, then the next one for sale, then one locked plot. */
function streetLineup() {
  const owned = G.BUILDINGS.filter((d) => state.company.buildings.some((b) => b.id === d.id)),
    rest = G.BUILDINGS.filter((d) => !owned.includes(d)),
    forSale = rest.filter((d) => state.company.phase >= d.phase),
    locked = rest.filter((d) => state.company.phase < d.phase).slice(0, 1);
  return [...owned, ...forSale, ...locked];
}

/** Street furniture between buildings: palms, a lowrider out front, chain-link by empty plots. */
function streetProp(def, i, lineup) {
  const owned = state.company.buildings.some((b) => b.id === def.id),
    next = lineup[i + 1];
  if (!next) return '<i class="street-prop palm tall" aria-hidden="true"></i>';
  if (i === 0) return '<i class="street-prop lowrider" aria-hidden="true"></i>';
  if (!state.company.buildings.some((b) => b.id === next.id))
    return '<i class="street-prop fence" aria-hidden="true"></i>';
  return `<i class="street-prop palm ${owned && i % 2 ? "tall" : ""}" aria-hidden="true"></i>`;
}
function streetHtml() {
  const lineup = streetLineup();
  return `<div class="street-row"><i class="street-prop palm tall" aria-hidden="true"></i>${lineup
    .map((d, i) => streetBuilding(d) + streetProp(d, i, lineup))
    .join("")}</div>`;
}
function streetMinimap() {
  return `<div class="street-map"><select aria-label="Jump to a building" id="streetJump"><option value="">Jump to a building</option>${streetLineup()
    .map((d) => `<option value="${d.id}">${esc(d.name)}</option>`)
    .join("")}</select></div>`;
}

/** Scrolls the street so a building is in view. */
function streetJump(id) {
  document
    .getElementById("bldg-" + id)
    ?.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
}

// Drag, wheel and keys scroll the street. Set up once on the persistent #lot element.
let streetInputReady = false;
function streetInput() {
  const el = $("lot");
  if (streetInputReady || !el?.addEventListener) return;
  streetInputReady = true;
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    if (!state.company || e.button !== 0) return;
    drag = { x: e.clientX, left: el.scrollLeft, moved: false };
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) el.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (drag?.moved) {
      // A drag is not a tap: swallow the click that follows it.
      el.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
    }
    drag = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => (drag = null));
  el.addEventListener(
    "wheel",
    (e) => {
      if (!state.company || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
  el.addEventListener("keydown", (e) => {
    if (!state.company) return;
    if (e.key === "ArrowRight") el.scrollLeft += 240;
    else if (e.key === "ArrowLeft") el.scrollLeft -= 240;
    else return;
    e.preventDefault();
  });
}

/* ---------------- Panels for buildings and floors ---------------- */

function buildingDef(id) {
  return G.BUILDINGS.find((b) => b.id === id);
}
function ownedBuilding(id) {
  return state.company?.buildings.find((b) => b.id === id) || null;
}
function floorName(floor) {
  return floor.type === "room" ? G.BOOTHS[floor.room].name : facilityDef(floor.type).name;
}

/** A facility floor: what it does, its pairings and its upgrade. */
function floorSheet(buildingId, index) {
  const owned = ownedBuilding(buildingId),
    floor = owned.floors[index],
    def = facilityDef(floor.type),
    pairs = G.SYNERGIES.filter((s) => s.pair.includes(floor.type)),
    active = G.activeSynergies(state),
    cost = G.floorUpgradeCost(floor),
    cap = G.floorLevelCap(state),
    opens = G.FLOOR_LEVELS.byPhase.findIndex((n) => n > floor.level) + 1;
  return `<div class="facility-head" style="--accent:${def.accent}">${pixelSvg(def.icon, def.accent, 56, def.name)}<div><span class="tag">FLOOR ${index + 1} · ${esc(buildingDef(buildingId).name.toUpperCase())} · LEVEL ${floor.level} / ${G.FLOOR_LEVELS.max} · ${money(def.upkeep * floor.level)}/week</span><h3>${esc(def.name)}</h3><p>${esc(def.text)}${floor.level > 3 ? ` At level ${floor.level} it counts as ${G.floorEffect(floor.level)} levels.` : ""}</p></div></div><p class="muted">Pairings (a floor directly above or below, or the same floor next door): ${pairs
    .map((p) => {
      const other = facilityDef(p.pair.find((id) => id !== floor.type));
      return `${active.includes(p) ? "✓" : "·"} ${esc(p.name)} with ${esc(other.name)}`;
    })
    .join(" · ")}</p><div class="actions">${
    floor.renovating
      ? `<span class="muted">Renovating to level ${floor.renovating.to} · ${Math.max(0, floor.renovating.done - state.week)} week(s) left. It works at level ${floor.level} until then.</span>`
      : floor.level >= G.FLOOR_LEVELS.max
        ? '<span class="muted">Top level.</span>'
        : ownedBuilding(buildingId)?.floors.some((f) => f.renovating)
          ? '<span class="muted">Another floor in this building is being renovated. One at a time.</span>'
          : floor.level >= cap
            ? `<span class="muted">Level ${floor.level + 1} opens at phase ${opens}.</span>`
            : `<button data-action="floorUpgrade" data-building="${buildingId}" data-index="${index}" ${disable(blocked() || state.cash < cost)}>Upgrade to level ${floor.level + 1} · ${money(cost)}${G.FLOOR_LEVELS.weeks[floor.level] ? ` · ${G.FLOOR_LEVELS.weeks[floor.level]} weeks of work` : ""} · then ${money(def.upkeep * (floor.level + 1))}/week</button>`
  }</div>`;
}

/** What can go on the next floor of a building, with prices. */
function buildFloorSheet(buildingId) {
  const def = buildingDef(buildingId),
    owned = ownedBuilding(buildingId),
    built = new Set(G.allFloors(state).map((f) => f.floor.type)),
    options = [];
  if (owned.floors.length >= def.maxFloors)
    return `<div class="empty">The ${esc(def.name)} is full: ${def.maxFloors} floors.</div>`;
  for (const type of def.floors) {
    if (type === "room") {
      G.BOOTHS.forEach((r, id) => {
        if (state.booths.some((b) => b.id === id)) return;
        const locked = state.company.phase < r.labelTier,
          price = G.floorQuote(state, buildingId, "room", id);
        options.push(
          `<article class="card"><span class="tag">RECORDING ROOM</span><h3>${esc(r.name)}</h3><p>${money(r.upkeep)}/week upkeep</p>${locked ? `<p class="muted">Opens at phase ${r.labelTier}.</p>` : ""}<button data-action="floorBuild" data-building="${buildingId}" data-type="room" data-room="${id}" ${disable(blocked() || locked || state.cash < price)}>Build · ${money(price)}</button></article>`,
        );
      });
    } else if (!built.has(type)) {
      const f = facilityDef(type),
        price = G.floorQuote(state, buildingId, type);
      options.push(
        `<article class="card" style="--accent:${f.accent}"><span class="tag">FACILITY</span><h3>${esc(f.name)}</h3><p>${esc(f.text)}</p><p class="muted">${money(f.upkeep)}/week upkeep</p><button data-action="floorBuild" data-building="${buildingId}" data-type="${type}" ${disable(blocked() || state.cash < price)}>Build · ${money(price)}</button></article>`,
      );
    }
  }
  return `<p class="place-intro">Floor ${owned.floors.length + 1} of ${def.maxFloors}. Each floor up costs ${money(def.floorCost)} more to build.</p>${options.length ? `<div class="grid">${options.join("")}</div>` : '<div class="empty">Everything this building can hold is already built somewhere on the street.</div>'}`;
}

/** A building: its floors from the top, and room to grow. */
function buildingSheet(buildingId) {
  const def = buildingDef(buildingId),
    owned = ownedBuilding(buildingId);
  const floors = owned.floors
    .map(
      (f, i) =>
        `<li><button data-tab="${f.type === "room" ? "room:" + f.room : `floor:${buildingId}:${i}`}">Floor ${i + 1} · ${esc(floorName(f))}${f.type === "room" ? "" : ` · level ${f.level}`}</button></li>`,
    )
    .reverse()
    .join("");
  return `<p class="place-intro">${owned.floors.length} of ${def.maxFloors} floors. Holds ${def.floors.map((t) => (t === "room" ? "recording rooms" : facilityDef(t).name)).join(", ")}.</p><ul class="floor-list">${floors || "<li class=muted>No floors yet.</li>"}</ul>${owned.floors.length < def.maxFloors ? `<button class="primary" data-tab="buildfloor:${buildingId}">Build a floor</button>` : ""}`;
}

/** A plot on the street: buy the building, or see when it opens. */
function buySheet(buildingId) {
  const def = buildingDef(buildingId),
    open = state.company.phase >= def.phase,
    phase = G.PHASES[def.phase - 1];
  return `<article class="card"><span class="tag">${open ? "FOR SALE" : "OPENS AT PHASE " + def.phase}</span><h3>${esc(def.name)}</h3><p>Up to ${def.maxFloors} floors for ${def.floors.map((t) => (t === "room" ? "recording rooms" : facilityDef(t).name)).join(", ")}.</p><p class="muted">${open ? `Price ${money(def.cost)}. Each floor costs ${money(def.floorCost)} more than the one below.` : `Reach phase ${def.phase}, ${esc(phase.name)}, to buy it.`}</p><button class="primary" data-action="buildingBuy" data-building="${buildingId}" ${disable(blocked() || !open || state.cash < def.cost)}>Buy · ${money(def.cost)}</button></article>`;
}

/** Sheets for street ids (floor:, building:, buildfloor:, buy:), or null. */
function streetSheet(id) {
  if (!state.company) return null;
  const [kind, a, b] = String(id).split(":");
  const def = buildingDef(a);
  if (!def) return null;
  const owned = ownedBuilding(a);
  if (kind === "buy") return owned ? null : { title: () => def.name, render: () => buySheet(a) };
  if (!owned) return null;
  if (kind === "building") return { title: () => def.name, render: () => buildingSheet(a) };
  if (kind === "buildfloor")
    return { title: () => `Build on the ${def.name}`, render: () => buildFloorSheet(a) };
  if (kind === "floor") {
    const floor = owned.floors[Number(b)];
    if (!floor || floor.type === "room") return null;
    return { title: () => floorName(floor), render: () => floorSheet(a, Number(b)) };
  }
  return null;
}

GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "floorUpgrade") act(() => G.upgradeFloor(state, d.building, Number(d.index)));
  else if (d.action === "floorBuild")
    act(() => {
      G.buildFloor(state, d.building, d.type, d.room === undefined ? undefined : Number(d.room));
      openPanel("building:" + d.building);
    });
  else if (d.action === "buildingBuy")
    act(() => {
      G.buyBuilding(state, d.building);
      openPanel("building:" + d.building);
    });
  else return false;
  return true;
});
GoatUI.change.push(({ target }) => {
  if (target.id !== "streetJump") return false;
  if (target.value) streetJump(target.value);
  target.value = "";
  return true;
});

const GoatStreet = {
  grade: buildingGrade,
  finish: floorFinish,
  band: gradeBand,
  html: streetHtml,
  minimap: streetMinimap,
  input: streetInput,
  cast: streetCast,
  sheet: streetSheet,
};
