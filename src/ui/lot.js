// The headquarters lot on the main screen: a cutaway building with rooms on each floor, a
// ground floor with the lobby and recording rooms, and staff and artists who walk between
// rooms. Uses the page globals from app.js and the headquarters helpers in label-ui.js.
"use strict";

const STAFF_SPRITE = ["..dd..", ".dssd.", ".kssk.", "..kk..", ".gwag.", "ggwagg", ".gaag.", ".k..k."];
const ROLE_COLORS = {
  VP: "#3c5a99",
  Marketing: "#e86a8f",
  "Artist Development": "#4caf7a",
  "Public Relations": "#f3a64b",
  Producer: "#7a5ad9",
  "A&R": "#d9534f",
};
/** Rooms a hired role likes to visit when it leaves the front desk. */
const ROLE_VISITS = {
  VP: ["archive", "bar", "merch"],
  Marketing: ["radio", "merch", "bar"],
  "Artist Development": ["academy", "rehearsal", "lounge"],
  "Public Relations": ["radio", "bar", "lounge"],
  Producer: ["mix", "vocal", "writers"],
  "A&R": ["lounge", "rehearsal", "writers"],
};
const TOUR_BUS = [
  "..kkkkkkkkkkkk..",
  ".kaaaaaaaaaaaak.",
  ".kawwkwwkwwkwak.",
  ".kawwkwwkwwkwak.",
  ".kaaaaaaaaaaaaak",
  ".kaaaaaaaaaaaaak",
  ".kkkkkkkkkkkkkkk",
  "...kgk.....kgk..",
];
const TROPHY = [
  "kyyyyyyk",
  "kyyyyyyk",
  ".kyyyyk.",
  "..kyyk..",
  "...yy...",
  "...yy...",
  "..kyyk..",
  ".kkkkkk.",
];

/* ---------------- Building ---------------- */

/** Ground floor widths: the lobby is twice a room; the build slot shows while rooms are left to build. */
const GROUND = { lobby: 2, office: 1, booth: 1, build: 0.7 };
function canBuildRoom() {
  return state.booths.length < G.BOOTHS.length;
}
/** Grid size drawn on the lot: the current lot plus the tiles the next rank unlocks. */
function lotFrame() {
  const [w, h] = G.lotSize(state),
    next = G.RANKS[G.rank(state)]?.lot || [w, h],
    gw = Math.max(w, next[0]),
    gh = Math.max(h, next[1]),
    segs =
      GROUND.lobby + GROUND.office + state.booths.length * GROUND.booth + (canBuildRoom() ? GROUND.build : 0);
  return { w, h, gw, gh, rows: gh + 1, segs };
}
function recordingAlbum(artistId) {
  return state.albums.find((p) => !p.released && p.artist === artistId);
}
function lotRoom(x, y, frame, edges) {
  const inside = x < frame.w && y < frame.h,
    place = `grid-column:${x + 2};grid-row:${y + 1}`;
  if (!inside) return `<div class="room locked" style="${place}"><small>Next rank</small></div>`;
  const f = G.facilityAt(state, x, y),
    key = x + "," + y,
    sel = hqView.selected === key ? "selected" : "";
  if (!f)
    return `<button class="room empty ${sel} ${hqView.moving ? "target" : ""}" style="${place}" data-action="hqTile" data-x="${x}" data-y="${y}" aria-label="Empty tile ${x + 1}, ${y + 1}"><span class="plus">${hqView.moving ? "Move here" : "+"}</span><small>${hqView.moving ? "" : "Build"}</small></button>`;
  const def = facilityDef(f.id),
    linked = edges.filter((e) => e.a === f || e.b === f);
  return `<button class="room built ${sel} ${hqView.moving === f.id ? "moving" : ""} ${linked.length ? "linked" : ""}" style="${place};--accent:${def.accent}" data-action="hqTile" data-x="${x}" data-y="${y}" aria-label="${esc(def.name)} level ${f.level}${linked.length ? ", paired: " + linked.map((e) => e.name).join(", ") : ""}"><span class="plate">${esc(def.name)}</span><span class="furniture">${pixelSvg(def.icon, def.accent, 40)}</span><span class="pips">${"●".repeat(f.level)}${"○".repeat(G.HQ.maxLevel - f.level)}</span></button>`;
}
function groundFloor(frame) {
  const rooms = state.booths.map((b) => {
    const def = G.BOOTHS[b.id],
      p = state.albums.find((x) => !x.released && x.booth === b.id);
    return `<button class="gf booth ${p ? "rec" : ""}" data-tab="room:${b.id}" aria-label="${esc(def.name)}${p ? ", recording " + esc(p.title) : ", free"}"><span class="plate">${esc(def.name)}</span>${p ? '<span class="on-air">REC</span>' : ""}<span class="desk mixing"></span></button>`;
  });
  const lobby = `<div class="gf lobby"><span class="plate">Lobby</span><span class="door"></span><button class="trophy-case" data-tab="trophies" aria-label="Trophy case, ${state.awards} award${state.awards === 1 ? "" : "s"}">${pixelSvg(TROPHY, "#f3d25b", 18)}<small>${state.awards}</small></button><button class="desk front-desk" data-tab="desk" aria-label="Front desk: scouting and hiring"><span>DESK</span></button></div>`,
    office = `<button class="gf office" data-tab="office" aria-label="Office: goals, finances and catalog"><span class="plate">Office</span><span class="cabinet"></span><span class="desk office-desk"></span></button>`,
    build = canBuildRoom()
      ? `<button class="gf build-room" data-tab="newroom" aria-label="Build a recording room"><span class="plus">+</span><small>Room</small></button>`
      : "";
  return `<div class="groundfloor" style="grid-column:2 / span ${frame.gw};grid-row:${frame.rows}">${lobby}${office}${rooms.join("")}${build}</div>`;
}
/** The building: floors of facility tiles above a ground floor, with a stairwell on the left. */
function lotBuilding() {
  const frame = lotFrame(),
    edges = synergyEdges();
  let rooms = "";
  for (let y = 0; y < frame.gh; y++) for (let x = 0; x < frame.gw; x++) rooms += lotRoom(x, y, frame, edges);
  return `<div class="building ${hqView.moving ? "moving-mode" : ""}" style="--cols:${frame.gw};--rows:${frame.rows}"><div class="shaft" style="grid-row:1 / span ${frame.rows}" aria-hidden="true"></div>${rooms}${groundFloor(frame)}</div>`;
}
function lotRoof() {
  const st = G.rankStatus(state);
  return `<button class="roof-sign" data-tab="label" aria-label="${esc(G.labelName(state))}: rank, headquarters and themes"><b>${esc(G.labelName(state).toUpperCase())}</b><span class="roof-stars" aria-label="Label rank ${st.rank} of ${G.RANKS.length}">${"★".repeat(st.rank)}<i>${"★".repeat(G.RANKS.length - st.rank)}</i></span><small>${esc(st.name)}</small></button>`;
}
function lotGround() {
  return `<div class="street">${GoatUI.html("lotDecor")}</div>`;
}
function lotPopover() {
  const sel = hqView.selected?.split(",").map(Number);
  if (!sel) return "";
  const f = G.facilityAt(state, sel[0], sel[1]);
  return `<button class="close" data-action="hqClose" aria-label="Close">✕</button>${f ? facilityPanel(f) : buildMenu(sel[0], sel[1])}`;
}

/* ---------------- People ---------------- */

const lotLife = {
  people: new Map(),
  timer: null,
  frame: null,
  watch: null,
  reduced: false,
};
function liveDom() {
  return typeof document.createElement === "function" && typeof window !== "undefined";
}
/** Where everyone should be right now: artists by their work, staff at the front desk. */
function lotCast(frame) {
  const groundY = frame.gh,
    spot = (fx, y, spread) => ({ fx, y, spread }),
    // Staff work behind the front desk; idle artists hang around the left of the lobby.
    lobby = spot(1.5 / frame.segs, groundY, 0.22 / frame.segs),
    hangout = spot(0.85 / frame.segs, groundY, 0.3 / frame.segs),
    room = (id) => {
      const f = G.builtFacility(state, id);
      return f && f.x < frame.w && f.y < frame.h ? spot((f.x + 0.38) / frame.gw, f.y, 0.24 / frame.gw) : null;
    },
    booth = (id) => {
      const i = state.booths.findIndex((b) => b.id === id);
      return i < 0
        ? null
        : spot((GROUND.lobby + GROUND.office + i + 0.5) / frame.segs, groundY, 0.28 / frame.segs);
    },
    out = [];
  for (const a of state.artists) {
    if (G.onTour(state, a.id)) continue;
    const p = recordingAlbum(a.id),
      home = p
        ? room("vocal") || room("mix") || room("writers") || booth(p.booth) || lobby
        : room("lounge") || room("rehearsal") || room("bar") || hangout;
    out.push({
      key: "a" + a.id,
      tab: "artist:" + a.id,
      kind: "artist",
      name: a.name,
      map: G.ARTIST_SPRITE,
      color: G.GENRE_COLORS[a.genre] || "#ccc",
      home,
      visits: [],
      hot: typeof G.isHot === "function" && !!G.isHot(state, a.id),
    });
  }
  state.staff.forEach((role, i) => {
    out.push({
      key: "s" + role,
      tab: "staffer:" + role,
      kind: "staff",
      name: state.employees[role]?.name || role,
      map: STAFF_SPRITE,
      color: ROLE_COLORS[role] || "#7b7f8c",
      home: spot(lobby.fx + ((i % 3) - 1) * 0.7 * lobby.spread, groundY, lobby.spread * 0.5),
      visits: (ROLE_VISITS[role] || []).map(room).filter(Boolean),
      hot: false,
    });
  });
  return out;
}
function placePerson(p, fx, y, secs) {
  const s = p.el.style;
  s.transitionDuration = secs > 0 ? secs + "s" : "0s";
  if (Math.abs(fx - p.fx) > 0.001) p.el.classList.toggle("flip", fx < p.fx);
  p.el.classList.toggle("walking", secs > 0);
  s.opacity = "1";
  s.left = fx * 100 + "%";
  s.top = `calc(${((y + 1) / lotLife.frame.rows) * 100}% - var(--person-h))`;
  p.fx = fx;
  p.y = y;
}
/** Steps to get from where a person stands to a spot: along the floor, via the stairwell between floors. */
function routeTo(p, fx, y) {
  if (y === p.y) return [{ walk: fx }];
  return [{ walk: 0.012 }, { hide: true }, { warp: 0.012, y }, { walk: fx }];
}
function wanderSpot(s) {
  return Math.max(0.02, Math.min(0.98, s.fx + (Math.random() * 2 - 1) * s.spread));
}
function stepPerson(p, now) {
  if (now < p.until) return;
  if (p.leaving && !p.path.length) {
    p.el.remove();
    lotLife.people.delete(p.key);
    return;
  }
  if (!p.path.length) {
    if (lotLife.reduced) return;
    const away = p.target !== p.home;
    if (p.visits.length && Math.random() < (away ? 0.5 : 0.18)) {
      p.target = away ? p.home : p.visits[Math.floor(Math.random() * p.visits.length)];
      p.path = routeTo(p, wanderSpot(p.target), p.target.y);
    } else p.path = [{ walk: wanderSpot(p.target) }];
  }
  const s = p.path.shift(),
    last = !p.path.length;
  if (s.hide) {
    p.el.style.transitionDuration = "0.3s";
    p.el.style.opacity = "0";
    p.until = now + 320;
  } else if (s.warp !== undefined) {
    placePerson(p, s.warp, s.y, 0);
    p.el.style.opacity = "1";
    p.until = now + 320;
  } else {
    const secs = Math.max(0.35, Math.abs(s.walk - p.fx) * lotLife.frame.gw * 1.1);
    placePerson(p, s.walk, p.y, secs);
    p.until = now + secs * 1000 + (last ? 1200 + Math.random() * (p.kind === "artist" ? 4200 : 2600) : 60);
  }
}
function newPerson(c, arrive) {
  // People are buttons that open their sheet; the roster in the side panel offers the same by keyboard.
  const el = document.createElement("button");
  el.className = "person " + c.kind;
  el.type = "button";
  el.tabIndex = -1;
  el.dataset.tab = c.tab;
  el.innerHTML = pixelSvg(c.map, c.color, 30);
  lotLife.layer.appendChild(el);
  const p = { ...c, el, fx: 0, y: 0, path: [], until: 0, target: c.home };
  if (arrive && !lotLife.reduced) {
    placePerson(p, 0.2 / lotLife.frame.segs, lotLife.frame.gh, 0);
    p.path = routeTo(p, wanderSpot(c.home), c.home.y);
  } else placePerson(p, wanderSpot(c.home), c.home.y, 0);
  return p;
}
/** Matches the sprites on the lot to the cast, walking newcomers in and leavers out. */
function syncPeople() {
  const layer = $("lotPeople");
  if (!layer || !liveDom()) return;
  lotLife.layer = layer;
  lotLife.reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = lotFrame(),
    resized = !lotLife.frame || lotLife.frame.rows !== frame.rows || lotLife.frame.gw !== frame.gw,
    first = !lotLife.frame;
  lotLife.frame = frame;
  const cast = lotCast(frame),
    keys = new Set(cast.map((c) => c.key));
  for (const c of cast) {
    let p = lotLife.people.get(c.key);
    if (!p || p.leaving) {
      p?.el.remove();
      lotLife.people.set(c.key, newPerson(c, !first));
      continue;
    }
    const moved = p.home.fx !== c.home.fx || p.home.y !== c.home.y;
    Object.assign(p, { name: c.name, color: c.color, visits: c.visits, hot: c.hot, home: c.home });
    if (resized) {
      p.target = c.home;
      p.path = [];
      placePerson(p, wanderSpot(c.home), c.home.y, 0);
    } else if (moved) {
      p.target = c.home;
      p.path = lotLife.reduced ? [] : routeTo(p, wanderSpot(c.home), c.home.y);
      if (lotLife.reduced) placePerson(p, wanderSpot(c.home), c.home.y, 0);
      p.until = 0;
    }
  }
  for (const p of lotLife.people.values()) {
    p.el.classList.toggle("hot", !!p.hot);
    p.el.title = p.name;
    p.el.setAttribute?.("aria-label", p.name);
    if (!keys.has(p.key) && !p.leaving) {
      p.leaving = true;
      p.path = lotLife.reduced ? [] : routeTo(p, 0.15 / frame.segs, frame.gh);
      p.until = 0;
    }
  }
  if (!lotLife.timer && typeof setInterval === "function")
    lotLife.timer = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      for (const p of [...lotLife.people.values()]) stepPerson(p, now);
    }, 250);
}

/* ---------------- Speech bubbles ---------------- */

/**
 * Shows a short speech bubble over a person (by key), over a room (facility id), or over
 * anyone on the lot when neither is given.
 */
function lotSay(text, key, facilityId) {
  if (!lotLife.layer || !liveDom() || !lotLife.frame) return;
  const people = [...lotLife.people.values()].filter((p) => !p.leaving),
    f = facilityId && G.builtFacility(state, facilityId),
    p = f ? null : lotLife.people.get(key) || people[Math.floor(Math.random() * people.length)];
  const bubble = document.createElement("span");
  bubble.className = "bubble";
  bubble.textContent = text;
  if (p) {
    p.el.querySelector(".bubble")?.remove();
    p.el.appendChild(bubble);
  } else {
    bubble.classList.add("floating");
    bubble.style.left = (f ? ((f.x + 0.5) / lotLife.frame.gw) * 100 : 50) + "%";
    bubble.style.top = f ? `calc(${(f.y / lotLife.frame.rows) * 100}% + 26px)` : "8px";
    lotLife.layer.appendChild(bubble);
  }
  setTimeout(() => bubble.remove(), 3800);
}
function artistKeyForAlbum(title) {
  const p = [...state.albums].reverse().find((x) => x.title === title);
  return p ? "a" + p.artist : null;
}
/** Turns fresh news lines into bubbles: releases, chart milestones, new themes, rank-ups and arrivals. */
function watchNews() {
  const w = lotLife.watch,
    rankUps = (state.rankUps || []).length;
  if (!w || w.state !== state) {
    lotLife.watch = {
      state,
      seen: new Set(state.news.slice(0, 60)),
      rankUps,
      staff: new Set(state.staff),
      artists: new Set(state.artists.map((a) => a.id)),
    };
    return;
  }
  const fresh = [];
  for (const n of state.news.slice(0, 25)) {
    if (w.seen.has(n)) break;
    fresh.push(n);
  }
  fresh.forEach((n) => w.seen.add(n));
  const says = [];
  for (const line of fresh.reverse()) {
    const text = line.replace(/^W\d+: /, "");
    let m;
    if ((m = text.match(/^(.+) released: (\d+)\/100( · HIT)?/)))
      says.push([m[3] ? "A hit record!" : `“${m[1]}” is out!`, artistKeyForAlbum(m[1])]);
    else if ((m = text.match(/^(.+): (NUMBER ONE!|TOP (\d+) BREAKTHROUGH)/)))
      says.push([m[3] ? `Top ${m[3]}!` : "Number one!", artistKeyForAlbum(m[1])]);
    else if ((m = text.match(/^New album theme discovered \([^)]*\): (.+)\.$/)))
      says.push([`New theme: ${m[1]}!`, null, G.builtFacility(state, "writers") ? "writers" : null]);
    else if ((m = text.match(/^(.+) built at headquarters\.$/))) {
      const def = G.FACILITIES.find((f) => f.name === m[1]);
      if (def) says.push(["Grand opening!", null, def.id]);
    } else if ((m = text.match(/^(.+) upgraded to level (\d)\.$/))) {
      const def = G.FACILITIES.find((f) => f.name === m[1]);
      if (def) says.push([`Level ${m[2]}!`, null, def.id]);
    }
  }
  if (rankUps > w.rankUps) {
    const r = state.rankUps[state.rankUps.length - 1];
    says.push([`Rank up! ${G.RANKS[r.rank - 1]?.name || ""}!`, null]);
  }
  for (const r of state.staff) if (!w.staff.has(r)) says.push(["Reporting for work!", "s" + r]);
  for (const a of state.artists) if (!w.artists.has(a.id)) says.push(["Let’s make records!", "a" + a.id]);
  w.rankUps = rankUps;
  w.staff = new Set(state.staff);
  w.artists = new Set(state.artists.map((a) => a.id));
  says
    .slice(0, 4)
    .forEach(([text, key, room], i) =>
      i ? setTimeout(() => lotSay(text, key, room), i * 1100) : lotSay(text, key, room),
    );
}

/* ---------------- Render ---------------- */

const lotCache = {};
/** Sets innerHTML only when it changed, so hover states and focus survive clock ticks. */
function paintLot(id, html) {
  if (lotCache[id] === html && $(id).innerHTML) return;
  lotCache[id] = html;
  $(id).innerHTML = html;
}
/** CEO runs draw the street instead of the classic lot. */
function renderStreet() {
  const lot = $("lot"),
    left = lot.scrollLeft || 0;
  $("scene").classList?.toggle("street-scene", true);
  if ($("scene").dataset) $("scene").dataset.phase = String(state.company.phase);
  document.body?.classList.toggle("ceo-run", true);
  lot.classList?.toggle("street-mode", true);
  if (lot.setAttribute) {
    lot.setAttribute("tabindex", "0");
    lot.setAttribute("aria-label", "The street. Drag, scroll or use the arrow keys to look along it.");
  }
  if (lotLife.people.size) GoatLot.reset();
  paintLot("lotRoof", "");
  paintLot("lot", GoatStreet.html());
  lot.scrollLeft = left;
  paintLot("lotGround", `<div class="street">${GoatStreet.minimap()}${GoatUI.html("lotDecor")}</div>`);
  paintLot("lotTown", GoatPlaces.town());
  $("lotPopover").hidden = true;
  GoatStreet.input();
  GoatPhone.paint();
  if (liveDom()) watchNews();
}
const GoatLot = {
  render() {
    if (state.company) return renderStreet();
    $("scene").classList?.toggle("street-scene", false);
    document.body?.classList.toggle("ceo-run", false);
    GoatPhone.paint();
    $("lot").classList?.toggle("street-mode", false);
    paintLot("lotRoof", lotRoof());
    paintLot("lot", lotBuilding());
    paintLot("lotGround", lotGround());
    paintLot("lotTown", GoatPlaces.town());
    const pop = lotPopover();
    $("lotPopover").innerHTML = pop;
    $("lotPopover").hidden = !pop;
    syncPeople();
    if (liveDom()) watchNews();
  },
  say: lotSay,
  /** Forgets the people on the lot, for a new or loaded label. */
  reset() {
    for (const p of lotLife.people.values()) p.el.remove();
    lotLife.people.clear();
    lotLife.frame = null;
    lotLife.watch = null;
  },
};
