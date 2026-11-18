// The street (CEO runs): the label's buildings side by side, each built up floor by floor.
// Drawn in place of the classic lot. The street scrolls sideways by drag, wheel, arrow keys or the
// minimap on the sidewalk. People stand on the floor where they are, and open their panel.
"use strict";

const BUILDING_LOOKS = {
  apartment: { wall: "#7a5c4a", trim: "#3a2a22" },
  storefront: { wall: "#5d4a6e", trim: "#2b2133" },
  studio: { wall: "#3f4f6e", trim: "#1d2536" },
  office: { wall: "#56606e", trim: "#262b33" },
  hq: { wall: "#2b2733", trim: "#b08d3c" },
  venue: { wall: "#6e2f45", trim: "#2e1320" },
  media: { wall: "#2f5f63", trim: "#13292b" },
  warehouse: { wall: "#6b6152", trim: "#2d2922" },
  overseas: { wall: "#38465c", trim: "#b08d3c" },
};

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

function streetFloor(b, floor, index, cast) {
  const room = floor.type === "room",
    name = room ? G.BOOTHS[floor.room].name : G.FACILITIES.find((f) => f.id === floor.type).name,
    def = room ? null : G.FACILITIES.find((f) => f.id === floor.type),
    album = room ? state.albums.find((p) => !p.released && p.booth === floor.room) : null,
    tab = room ? `room:${floor.room}` : `floor:${b.id}:${index}`,
    accent = def?.accent || "#c9a227";
  return `<div class="street-floor ${room ? "room" : "facility"} ${album ? "rec" : ""}" style="--accent:${accent}"><button class="floor-hit" data-tab="${tab}" aria-label="${esc(name)}${room ? (album ? ", recording " + esc(album.title) : ", free") : ", level " + floor.level}"><span class="plate">${esc(name)}</span>${def ? `<span class="floor-art">${pixelSvg(def.icon, accent, 28)}</span><span class="pips">${"●".repeat(floor.level)}${"○".repeat(G.HQ.maxLevel - floor.level)}</span>` : `<span class="desk mixing"></span>${album ? '<span class="on-air">REC</span>' : ""}`}</button><span class="floor-people">${streetPeople(cast[`${b.id}:${index}`])}</span></div>`;
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
  return `<section class="street-building" id="bldg-${def.id}" style="${style}"><button class="building-sign" data-tab="building:${def.id}">${esc(def.name)}<small>${owned.floors.length}/${def.maxFloors} floors</small></button>${room ? `<button class="floor-add" data-tab="buildfloor:${def.id}" aria-label="Build a floor on the ${esc(def.name)}">+ Floor</button>` : ""}${floors}<div class="building-door" aria-hidden="true"></div></section>`;
}

/** The buildings in street order: everything owned, then the next one for sale, then one locked plot. */
function streetLineup() {
  const owned = G.BUILDINGS.filter((d) => state.company.buildings.some((b) => b.id === d.id)),
    rest = G.BUILDINGS.filter((d) => !owned.includes(d)),
    forSale = rest.filter((d) => state.company.phase >= d.phase),
    locked = rest.filter((d) => state.company.phase < d.phase).slice(0, 1);
  return [...owned, ...forSale, ...locked];
}

function streetHtml() {
  return `<div class="street-row">${streetLineup().map(streetBuilding).join("")}</div>`;
}
function streetMinimap() {
  return `<nav class="street-map" aria-label="Jump to a building">${streetLineup()
    .map((d) => {
      const owned = state.company.buildings.some((b) => b.id === d.id);
      return `<button class="map-chip ${owned ? "owned" : ""}" data-action="streetJump" data-id="${d.id}">${esc(d.name)}</button>`;
    })
    .join("")}</nav>`;
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
    cost = def.cost * floor.level;
  return `<div class="facility-head" style="--accent:${def.accent}">${pixelSvg(def.icon, def.accent, 56, def.name)}<div><span class="tag">FLOOR ${index + 1} · ${esc(buildingDef(buildingId).name.toUpperCase())} · LEVEL ${floor.level} / ${G.HQ.maxLevel} · ${money(def.upkeep * floor.level)}/week</span><h3>${esc(def.name)}</h3><p>${esc(def.text)}</p></div></div><p class="muted">Pairings (a floor directly above or below, or the same floor next door): ${pairs
    .map((p) => {
      const other = facilityDef(p.pair.find((id) => id !== floor.type));
      return `${active.includes(p) ? "✓" : "·"} ${esc(p.name)} with ${esc(other.name)}`;
    })
    .join(" · ")}</p><div class="actions">${
    floor.level < G.HQ.maxLevel
      ? `<button data-action="floorUpgrade" data-building="${buildingId}" data-index="${index}" ${disable(blocked() || state.cash < cost)}>Upgrade to level ${floor.level + 1} · ${money(cost)}</button>`
      : '<span class="muted">Top level.</span>'
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
  if (d.action === "streetJump") streetJump(d.id);
  else if (d.action === "floorUpgrade") act(() => G.upgradeFloor(state, d.building, Number(d.index)));
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

const GoatStreet = {
  html: streetHtml,
  minimap: streetMinimap,
  input: streetInput,
  cast: streetCast,
  sheet: streetSheet,
};
