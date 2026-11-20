// Recording locations and paid gigs: the album form field, the gig controls on artist cards
// and the Locations screen. Uses the page helpers from app.js (G, state, $, esc, money, act,
// render, disable, blocked) at render time.
"use strict";

const locView = { location: "", gig: {} };
const LOC_STAGES = ["Identity", "Songwriting", "Performance", "Sound", "Reach"];

/** Renders a location's pixel map as a crisp SVG. "." is transparent, "a" the accent color. */
function locPixels(map, accent, size = 44, label = "") {
  const colors = { ...G.PALETTE, a: accent };
  let rects = "";
  map.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
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
function locSigned(n) {
  return (n >= 0 ? "+" : "−") + Math.abs(n);
}
function locLevelPips(level) {
  const max = G.LOCATION_LEVELS.max;
  return `<span class="location-pips" role="img" aria-label="Level ${level} of ${max}">${"●".repeat(level)}<span>${"○".repeat(max - level)}</span></span>`;
}
/** Stage boosts at a level, as text: "Identity +3, Songwriting +2". */
function locBoostText(loc, level) {
  const bonus = G.LOCATION_LEVELS.stageBonus[level - 1] + (loc.rank - 1) * (G.LOCATION_LEVELS.rankBonus || 0);
  return Object.entries(loc.stages)
    .map(([i, v]) => `${LOC_STAGES[i]} ${locSigned(v + bonus)}`)
    .join(", ");
}
function locGenreText(loc) {
  const listed = Object.entries(loc.genres)
    .sort((a, b) => b[1] - a[1])
    .map(([g, r]) => `${g} ${G.LOCATION_AFFINITY.names[r]}`);
  return listed.join(" · ") + (listed.length < G.GENRES.length ? " · others Fair" : "");
}

/* ---------------- Album form ---------------- */

function locationFields() {
  const list = G.locationList(state);
  // A location stays selected between renders until an album books it.
  if (!list.some((l) => l.id === locView.location && !l.locked && !l.booked)) locView.location = "";
  const opts = list
    .map((l) => {
      const off = l.locked || l.booked,
        note = l.locked
          ? `rank ${l.rank}`
          : l.booked
            ? "booked"
            : `${money(l.rentNow)} rent · level ${l.level}`;
      return `<option value="${l.id}" ${off ? "disabled" : ""} ${!off && locView.location === l.id ? "selected" : ""}>${esc(l.name)} · ${note}</option>`;
    })
    .join("");
  return `<label>Recording location<select id="albumLocation" data-album-field><option value="">None · own room only</option>${opts}</select></label>`;
}
function locationQuoteLine(plan) {
  if (!plan.location) return "";
  const q = G.locationQuote(state, plan.location, plan.genre);
  if (!q) return "";
  const boosts = q.stages
      .map((x, i) => ({ name: x.name, value: x.value - q.affinity.points, i }))
      .filter((x) => x.value)
      .map((x) => `${x.name} ${locSigned(x.value)}`)
      .join(", "),
    fit = q.affinity;
  return `<p class="location-line fit-${fit.name.toLowerCase()}"><b>${esc(q.name)} · level ${q.level} · rent ${money(q.rent)}</b><br>${esc(plan.genre)} affinity ${fit.name}: ${locSigned(fit.points)} to every stage. Location boosts: ${boosts}. Total ${locSigned(q.total)} stage points (about ${locSigned(Math.round(q.total / 5))} quality).${q.signature ? " The first album here reveals its signature theme." : ""}${q.locked ? " Locked at your rank." : q.booked ? " Booked by another album." : ""}</p>`;
}

/* ---------------- Gigs on the artist card ---------------- */

function gigChoices() {
  return G.GIGS.filter((g) => G.rank(state) >= g.rank);
}
function gigRow(a) {
  if (!a.contract?.remaining) return "";
  const gigs = gigChoices(),
    id = gigs.some((g) => g.id === locView.gig[a.id]) ? locView.gig[a.id] : gigs[0].id,
    q = G.gigQuote(state, a.id, id),
    last = state.gigs.history.find((h) => h.artist === a.id),
    extras = [
      q.fans ? `fans +${q.fans}` : "",
      q.xp ? `XP +${q.xp}` : "",
      `morale ${locSigned(q.morale[0])} to ${locSigned(q.morale[1])}`,
    ].filter(Boolean);
  return `<div class="gig-row"><label>Paid gig<select id="gig-${a.id}" data-gig-artist="${a.id}">${gigs
    .map((g) => `<option value="${g.id}" ${g.id === id ? "selected" : ""}>${esc(g.name)}</option>`)
    .join(
      "",
    )}</select></label><p class="muted">Pay ${money(q.pay.min)}–${money(q.pay.max)} · energy −${q.energy} · ${q.cooldown}-week cooldown · ${extras.join(" · ")}${q.reason ? `<br><span class="gig-wait">${esc(q.reason)}</span>` : ""}${last ? `<br>Last gig, week ${last.week}: ${esc(G.GIGS.find((g) => g.id === last.gig)?.name || "")} paid ${money(last.pay)}.` : ""}</p><button data-action="playGig" data-id="${a.id}" data-gig="${q.id}" ${disable(blocked() || !q.ready)}>Play gig · about ${money(q.pay.expected)}</button></div>`;
}

/* ---------------- Locations screen ---------------- */

function locationCard(l) {
  const st = l.stats,
    progress = l.nextXp
      ? Math.round(
          ((l.xp - G.LOCATION_LEVELS.xp[l.level - 1]) / (l.nextXp - G.LOCATION_LEVELS.xp[l.level - 1])) * 100,
        )
      : 100;
  return `<article class="card location-card ${l.locked ? "locked" : ""}" style="--accent:${l.accent}"><div class="location-head">${locPixels(l.icon, l.accent, 48, l.name)}<div><span class="tag">${l.locked ? `Locked · ${state.company ? "phase" : "rank"} ${l.rank} ${esc(l.rankName)}` : l.booked ? "Booked · in production" : `Level ${l.level} / ${G.LOCATION_LEVELS.max}`}</span><h3>${esc(l.name)}</h3>${locLevelPips(l.level)}</div></div><p>${esc(l.text)}</p><div class="progress" title="${l.nextXp ? `${l.xp} / ${l.nextXp} experience` : "Top level"}"><span style="width:${progress}%"></span></div><div class="metrics"><span>Rent <b>${money(l.rentNow)}</b></span><span>${state.company ? "Phase" : "Rank"} <b>${l.rank}</b></span><span>Albums <b>${st?.albums || 0}</b></span><span>Best quality <b>${st?.bestQuality || "—"}</b></span><span>Experience <b>${l.xp}${l.nextXp ? " / " + l.nextXp : " · MAX"}</b></span><span>Releases <b>${st?.releases || 0}</b></span></div><p>Boosts: ${esc(locBoostText(l, l.level))}<br>Genres: ${esc(locGenreText(l))}<br>Signature theme: <b>${l.themeKnown ? esc(l.theme) : "?"}</b></p></article>`;
}
function gigTable() {
  const r = G.rank(state);
  return `<div class="notebook"><table class="gig-table"><thead><tr><th>Gig</th><th>Rank</th><th>Energy</th><th>Cooldown</th><th>Fans</th><th>Theme chance</th></tr></thead><tbody>${G.GIGS.map(
    (g) =>
      `<tr class="${r < g.rank ? "locked" : ""}"><th>${esc(g.name)}<small>${esc(g.text)}</small></th><td>${g.rank}${r < g.rank ? " · locked" : ""}</td><td>−${g.energy}</td><td>${g.cooldown} wk</td><td>${g.fans ? "+" + g.fans : "—"}</td><td>${Math.round(g.theme * 100)}%</td></tr>`,
  ).join("")}</tbody></table></div>`;
}
function locationsScreen() {
  const list = G.locationList(state);
  const visited = list.filter((l) => l.stats).length;
  const buttons = (locations) =>
    locations
      .map(
        (l) =>
          `<button data-tab="location:${l.id}">${esc(l.name)} <small>${l.locked ? "Locked · rank " + l.rank : l.booked ? "Booked" : money(l.rentNow) + " rent"}</small></button>`,
      )
      .join("");
  return `<div class="sectionhead"><h2>Recording locations</h2><span class="muted">${visited} of ${list.length} visited</span></div><div class="destination-list">${buttons(list.filter((l) => !l.locked))}</div><details class="decision-details"><summary>Locked studios</summary><div class="destination-list">${buttons(list.filter((l) => l.locked))}</div></details>`;
}
function gigsScreen() {
  const recent = state.gigs.history.slice(0, 5);
  return `<h2>Paid gigs</h2><p class="muted">Book gigs from an idle artist’s Overview. ${state.gigs.played} played · ${money(state.gigs.earned)} earned.</p>${gigTable()}${
    recent.length
      ? `<ul class="gig-history">${recent.map((h) => `<li>Week ${h.week} · ${esc(h.artistName)} · ${esc(G.GIGS.find((g) => g.id === h.gig)?.name || "")} · ${money(h.pay)}${h.theme ? " · found " + esc(h.theme) : ""}</li>`).join("")}</ul>`
      : ""
  }`;
}

/* ---------------- Handlers ---------------- */

function locationsClick(b) {
  if (b.dataset.action !== "playGig") return false;
  act(() => G.playGig(state, Number(b.dataset.id), b.dataset.gig));
  return true;
}
function locationsChange(e) {
  const t = e.target;
  if (t.dataset?.gigArtist !== undefined) {
    locView.gig[Number(t.dataset.gigArtist)] = t.value;
    render();
    return true;
  }
  // Remember the chosen location; the page still refreshes the album quote.
  if (t.id === "albumLocation") locView.location = t.value;
  return false;
}

GoatUI.registerPanel({ id: "locations", label: "Locations", order: 25, render: locationsScreen });
GoatUI.albumForm.push({
  fields: locationFields,
  read: () => ({ location: $("albumLocation")?.value || "" }),
  quote: locationQuoteLine,
});
GoatUI.artistCard.push({ render: gigRow });
GoatUI.click.push(locationsClick);
GoatUI.change.push(locationsChange);
