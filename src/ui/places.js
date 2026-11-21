// Places and people on the lot. Every screen opens from something on the lot: an artist or a staff
// member, a room, a facility, a prop on the street or a recording location out of town. Uses the
// page helpers from app.js and the other src/ui scripts at render time.
"use strict";

const BILLBOARD = [
  "kkkkkkkkkkkkkk",
  "kyyyyyyyyyyyyk",
  "kyaaaaaayaaayk",
  "kyaaaaaayayayk",
  "kyyyyyyyyyyyyk",
  "kyaayaaaayaayk",
  "kyyyyyyyyyyyyk",
  "kkkkkkkkkkkkkk",
  ".....kgk......",
  ".....kgk......",
  ".....kgk......",
  "....kkkkk.....",
];
const NEWSSTAND = [
  "..kkkkkkkk..",
  ".kaaaaaaaak.",
  "kaawaawaawak",
  "kkkkkkkkkkkk",
  "kwwkwwkwwkwk",
  "kwkkwkkwkkwk",
  "kwwkwwkwwkwk",
  "kddddddddddk",
  "kddkkkkkkddk",
  "kddddddddddk",
  "kkkkkkkkkkkk",
];
const ROAD_SIGN = [
  "kkkkkkkkkk..",
  "kyyyyyyyyyk.",
  "kykkykkyyyyk",
  "kyyyyyyyyyk.",
  "kkkkkkkkkk..",
  "....kgk.....",
  "....kgk.....",
  "....kgk.....",
  "...kkkkk....",
];

/* ---------------- Where each sheet lives ---------------- */

/** Older screen names, still used by buttons in banners and cards, mapped to their place. */
const PLACE_ALIASES = {
  scout: ["desk", "sec-scout"],
  staff: ["desk", "sec-team"],
  catalog: ["office", "sec-catalog"],
  finance: ["office", "sec-finance"],
  campaign: ["office", "sec-campaign"],
  charts: ["billboard", "sec-charts"],
  promotion: ["billboard", "sec-promotion"],
  rivals: ["billboard", "sec-rivals"],
  market: ["billboard", "sec-market"],
  journal: ["newsstand", ""],
  awards: ["trophies", ""],
  road: ["bus", ""],
  hq: ["label", ""],
  locations: ["street", ""],
};
/** Resolves a sheet id or an older screen name: { id, section }. */
function resolvePlace(id) {
  if (id.includes("~")) {
    const [place, section] = id.split("~");
    return { id: place, section };
  }
  if (id === "studio") {
    // The album form now lives in each recording room: open the first free one.
    const free = state.booths.find((b) => !state.albums.some((p) => !p.released && p.booth === b.id));
    return { id: "room:" + (free || state.booths[0])?.id, section: "sec-record" };
  }
  const alias = PLACE_ALIASES[id];
  return alias ? { id: alias[0], section: alias[1] } : { id, section: "" };
}
function section(id, html) {
  return `<section id="${id}" class="sheet-section">${html}</section>`;
}
function sheetSections(items) {
  const selected = items.find(([id]) => id === sheetSection) || items[0];
  const links = items
    .map(
      ([id, label]) =>
        `<button data-tab="${esc(tab)}~${id}" aria-pressed="${id === selected[0]}">${label}</button>`,
    )
    .join("");
  return `<nav class="sheet-tabs" aria-label="Panel sections">${links}</nav>${section(selected[0], selected[2]())}`;
}
function panelHtml(id) {
  return GoatUI.panels.find((p) => p.id === id)?.render() || "";
}
const PLACES = {
  desk: {
    title: () => "Front desk",
    render: () =>
      sheetSections([
        ["sec-scout", "Scouting", scouting],
        ["sec-team", "Staff", () => (state.company?.departments ? GoatStaff.departmentList() : staff())],
      ]),
  },
  trophies: {
    title: () => "Trophy case",
    render: () =>
      `<p class="place-intro">${state.awards} award${state.awards === 1 ? "" : "s"} on the shelf. Enter each year's best albums here.</p>${annualAwards()}`,
  },
  office: {
    title: () => "Office",
    render: () =>
      sheetSections([
        ...(state.company
          ? [["sec-company", "Company", () => GoatBoard.summary() + panelHtml("company")]]
          : []),
        ["sec-campaign", "Goals", () => panelHtml("campaign")],
        ["sec-finance", "Finances", finance],
        ["sec-catalog", "Catalog", catalog],
        ["sec-name", "Label name", companyNameCard],
      ]),
  },
  billboard: {
    title: () => "Billboard",
    render: () =>
      sheetSections([
        ["sec-charts", "Charts", charts],
        ["sec-promotion", "Promotion", () => panelHtml("promotion")],
        ...(state.company?.rivals ? [["sec-rivals", "Rivals", () => panelHtml("rivals")]] : []),
        ...(state.company?.eras ? [["sec-market", "The market", () => panelHtml("market")]] : []),
      ]),
  },
  newsstand: { title: () => "Newsstand", render: () => journal() },
  bus: { title: () => "Tour bus", render: () => road() },
  label: {
    title: () => G.labelName(state),
    render: () =>
      sheetSections([
        ["sec-label", "Headquarters", () => panelHtml("hq")],
        ["sec-notebook", "Combo notebook", () => GoatUI.html("studioSections")],
      ]),
  },
  street: {
    title: () => "Out of town",
    render: () =>
      sheetSections([
        ["sec-locations", "Studios", locationsScreen],
        ["sec-gigs", "Paid gigs", gigsScreen],
      ]),
  },
  newroom: { title: () => "Build a recording room", render: () => newRoomSheet() },
};
/** The sheet for an id: { title, render } or null when the place no longer exists. */
function placeSheet(id) {
  if (PLACES[id]) return PLACES[id];
  const [kind, key] = String(id).split(/:(.*)/);
  if (kind === "artist") {
    const a = state.artists.find((x) => x.id === Number(key));
    return a && { title: () => a.name, render: () => artistSheet(a) };
  }
  if (kind === "staffer" && G.ROLES[key])
    return {
      title: () =>
        state.employees[key] ? `${state.employees[key].name} · ${key}` : `${key} · open position`,
      render: () => staffRole(key),
    };
  if (kind === "room") {
    const b = state.booths.find((x) => x.id === Number(key));
    return b && { title: () => G.BOOTHS[b.id].name, render: () => roomSheet(b) };
  }
  if (kind === "location") {
    const l = G.locationList(state).find((x) => x.id === key);
    return l && { title: () => l.name, render: () => locationSheet(l) };
  }
  const people = typeof GoatStaff !== "undefined" && GoatStaff.sheet(id);
  if (people) return people;
  const street = typeof GoatStreet !== "undefined" && GoatStreet.sheet(id);
  if (street) return street;
  const phone = typeof GoatPhone !== "undefined" && GoatPhone.sheet(id);
  if (phone) return phone;
  // A screen added by a feature script that no place shows yet.
  const panel = GoatUI.panels.find((p) => p.id === id);
  return panel && { title: () => panel.label, render: () => panel.render() };
}

/* ---------------- Artists ---------------- */

/** What an artist is doing right now, in a few words. */
function artistStatus(a) {
  const tour = G.onTour(state, a.id),
    p = recordingAlbum(a.id);
  if (tour) return "On tour";
  if (p) return "Recording";
  if (!a.contract.remaining) return "Contract done";
  return G.inspirationInfo(a).canRecord ? "Ready to record" : "Recharging";
}
function recordSection(a) {
  const p = recordingAlbum(a.id),
    tour = G.onTour(state, a.id),
    insp = G.inspirationInfo(a),
    freeRoom = state.booths.some((b) => !state.albums.some((x) => !x.released && x.booth === b.id));
  let body;
  if (p) {
    const d = p.production;
    body = `<div class="card"><span class="tag">IN THE STUDIO · ${esc(G.BOOTHS[p.booth]?.name || "")}</span><h3>${esc(p.title)}</h3><p>${d ? `${d.stage}/5 decisions · ${d.releaseReady ? "ready for the final review" : d.cooldown ? d.cooldown + " week(s) to the next step" : "a decision is waiting"}` : p.remaining + " weeks until release"}</p>${d && !d.cooldown ? `<button class="primary" data-action="showModal" data-project="${p.id}">Open album decisions</button>` : ""}${GoatUI.html("productionPanel", p)}</div>`;
  } else if (tour)
    body = `<div class="empty">On tour with ${esc(tour.title)}. Albums wait until the tour ends.</div>`;
  else if (!a.contract.remaining)
    body = `<div class="empty">The contract is complete. <button data-tab="artist:${a.id}~sec-artist">Review contract</button></div>`;
  else if (!insp.canRecord)
    body = `<div class="empty">Inspiration ${Math.round(insp.value)}/100. Recording needs 25; it recovers about 10 a week between albums.</div>`;
  else if (!freeRoom)
    body =
      '<div class="empty">Every recording room is busy. <button data-tab="newroom">Build another room</button></div>';
  else body = albumFormCard({ artistId: a.id });
  return section("sec-record", `<h2>Record an album</h2>${body}`);
}
function tourSection(a) {
  const active = tourCards("active", a.id),
    idle = !G.busy(state, a.id),
    eligible = state.albums.some((p) => p.artist === a.id && G.popularAlbum(state, p));
  return section(
    "sec-tour",
    `<h2>Touring</h2>${active || (idle && eligible ? tourFormCard(a.id) : `<div class="empty">${idle ? "No album of theirs qualifies yet: it needs a Top 10 peak, $10,000 gross, or two earning weeks with 250 weekly units." : "Busy right now."}</div>`)}`,
  );
}
function artistSheet(a) {
  const albums = state.albums.filter((p) => p.artist === a.id);
  return sheetSections([
    ["sec-artist", "Overview", () => artistCard(a)],
    ["sec-record", "Record", () => recordSection(a)],
    ["sec-tour", "Touring", () => tourSection(a)],
    ...(state.company ? [["sec-team", "Team", () => GoatStaff.teamSection(a)]] : []),
    [
      "sec-albums",
      "Albums",
      () => (albums.length ? catalogList(albums) : '<div class="empty">No albums yet.</div>'),
    ],
  ]);
}

/* ---------------- Rooms ---------------- */

function roomSheet(b) {
  const p = state.albums.find((x) => !x.released && x.booth === b.id);
  return `${roomCard(b.id)}${section(
    "sec-record",
    p
      ? `<h2>Recording now</h2><div class="card"><h3>${esc(p.title)}</h3><p>${esc(p.artistName)} · ${p.production ? p.production.stage + "/5 decisions" : p.remaining + " weeks left"}</p><button data-tab="artist:${p.artist}">See ${esc(p.artistName)}</button></div>`
      : `<h2>Start an album here</h2>${albumFormCard({ boothId: b.id })}`,
  )}`;
}
function newRoomSheet() {
  const unbuilt = G.BOOTHS.map((_, id) => id).filter((id) => !state.booths.some((b) => b.id === id));
  return `<p class="place-intro">Each room records one album at a time. Better rooms raise ratings in every genre and cost more to run.</p>${unbuilt.length ? `<div class="grid">${unbuilt.map((id) => roomCard(id)).join("")}</div>` : '<div class="empty">Every recording room is built.</div>'}`;
}

/* ---------------- Recording locations ---------------- */

function locationSheet(l) {
  let body;
  if (l.locked)
    body = `<div class="empty">Opens at ${state.company ? "phase" : "rank"} ${l.rank}, ${esc(l.rankName)}.</div>`;
  else if (l.booked)
    body = `<div class="empty">Booked by ${esc(l.booked.title)} until it is released. <button data-tab="artist:${l.booked.artist}">See ${esc(l.booked.artistName)}</button></div>`;
  else {
    locView.location = l.id;
    body = albumFormCard({});
  }
  return `${locationCard(l)}${section("sec-record", `<h2>Record here</h2>${body}`)}`;
}

/* ---------------- Roster in the side panel ---------------- */

function rosterStrip() {
  const artists = state.artists.map(
      (a) =>
        `<button class="roster-chip ${G.isHot?.(state, a.id) ? "hot" : ""}" data-tab="artist:${a.id}">${pixelSvg(G.ARTIST_SPRITE, G.GENRE_COLORS[a.genre] || "#ccc", 16)}<span><b>${esc(a.name)}</b><small>${esc(artistStatus(a))}</small></span></button>`,
    ),
    staffChips = state.staff.map(
      (r) =>
        `<button class="roster-chip staff" data-tab="staffer:${esc(r)}">${pixelSvg(STAFF_SPRITE, ROLE_COLORS[r] || "#7b7f8c", 16)}<span><b>${esc(state.employees[r]?.name || r)}</b><small>${esc(r)}</small></span></button>`,
    ),
    open = state.artists.length < G.slots(state);
  return `<div class="sectionhead"><span class="tag">ROSTER</span><span class="muted">${state.artists.length} / ${G.slots(state)} artists</span></div><div class="roster">${artists.join("")}${open ? '<button class="roster-chip add" data-tab="desk"><span><b>+ Find artists</b><small>Front desk</small></span></button>' : ""}${staffChips.join("")}</div>`;
}

/* ---------------- The street and out of town ---------------- */

function townProp(tab, map, accent, size, name, note = "") {
  return `<button class="town-spot prop" data-tab="${tab}" aria-label="${esc(name)}${note ? ", " + esc(note) : ""}">${pixelSvg(map, accent, size)}<span class="town-plate">${esc(name)}</span>${note ? `<small>${esc(note)}</small>` : ""}</button>`;
}
function lotTown() {
  const tours = state.tours.filter((t) => t.status === "active"),
    ads = state.promotion?.ads?.filter((x) => x.until >= state.week).length || 0;
  const props = [
    townProp(
      "billboard",
      BILLBOARD,
      "#d9534f",
      46,
      "Billboard",
      ads ? `${ads} ad${ads === 1 ? "" : "s"} up` : "Charts",
    ),
    townProp("newsstand", NEWSSTAND, "#4caf7a", 36, "Newsstand", "Industry wire"),
    `<button class="town-spot prop bus-spot ${tours.length ? "away" : ""}" data-tab="bus" aria-label="Tour bus${tours.length ? ", on tour" : ""}">${pixelSvg(TOUR_BUS, "#f3a64b", 56)}<span class="town-plate">Tour bus</span><small>${tours.length ? "On tour · " + esc(tours.map((t) => t.artistName).join(", ")) : "Parked"}</small></button>`,
    townProp("street", ROAD_SIGN, "#f3d25b", 32, "Out of town", "All locations"),
  ];
  // CEO runs have no lobby, so the trophy case stands on the street.
  if (state.company)
    props.splice(
      2,
      0,
      townProp(
        "trophies",
        TROPHY,
        "#f3d25b",
        30,
        "Trophy case",
        `${state.awards} award${state.awards === 1 ? "" : "s"}`,
      ),
    );
  return `<div class="town" role="group" aria-label="Street destinations">${props.join("")}</div>`;
}

const GoatPlaces = { resolve: resolvePlace, sheet: placeSheet, roster: rosterStrip, town: lotTown };
