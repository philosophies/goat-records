"use strict";
const G = LabelGame,
  $ = (id) => document.getElementById(id),
  money = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString(),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
let state,
  tab = "studio",
  audioContext,
  sound = false,
  saveOK = true;
try {
  state = JSON.parse(localStorage.getItem("side-a-save-v1"));
  if (state && !state.tourCadence && !localStorage.getItem("side-a-save-pre-v08"))
    localStorage.setItem("side-a-save-pre-v08", JSON.stringify(state));
  if (state && !state.tourTimingRevision && !localStorage.getItem("side-a-save-pre-v07"))
    localStorage.setItem("side-a-save-pre-v07", JSON.stringify(state));
  if (state && !state.industryRevision && !localStorage.getItem("side-a-save-pre-v05"))
    localStorage.setItem("side-a-save-pre-v05", JSON.stringify(state));
  if (state && !state.roadRevision && !localStorage.getItem("side-a-save-pre-v04"))
    localStorage.setItem("side-a-save-pre-v04", JSON.stringify(state));
  if (!state || state.version !== 1) state = G.create();
} catch {
  state = G.create();
  saveOK = false;
}
function save() {
  try {
    localStorage.setItem("side-a-save-v1", JSON.stringify(state));
    saveOK = true;
  } catch {
    saveOK = false;
  }
  $("saveStatus").textContent = saveOK
    ? "Progress saved in this browser. Export a backup before moving files or devices."
    : "Browser storage unavailable. Export your save before closing.";
}
function tone() {
  if (!sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    let o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.connect(g);
    g.connect(audioContext.destination);
    o.frequency.value = 330;
    g.gain.setValueAtTime(0.035, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    o.start();
    o.stop(audioContext.currentTime + 0.12);
  } catch {}
}
function act(fn) {
  try {
    fn();
    $("message").textContent = "";
    tone();
    save();
    render();
  } catch (e) {
    $("message").textContent = e.message;
  }
}
const disable = (condition) => (condition ? "disabled" : "");
const blocked = () => state.finished || !!state.event;
const clampRating = (n) => Math.max(0, Math.min(100, n));
function calculation(r, key) {
  return `<article class="calculation"><h3>${esc(r.area || r.name)}</h3>${r.choice ? `<p>${esc(r.choice)} · Trend when chosen: ${esc(r.trend)}</p>` : ""}<div class="formula">${r.parts.map((c, i) => `<div class="component" style="--delay:${i * 130}ms"><span>${esc(c.name)}</span><b>${c.value >= 0 ? "+" : ""}${c.value}</b></div>`).join("")}</div><div class="rating-total"><span>RATING <small>(clamped to 0–100)</small></span><strong data-count="${r.score}">${r.score}</strong><span>/100</span></div><div class="rating-track"><span style="--rating:${r.score}%;--delay:${r.parts.length * 130}ms"></span></div></article>`;
}
function productionPanels() {
  return state.albums
    .filter((p) => !p.released || p.launchReview)
    .map((p) => {
      const d = p.production;
      if (!d) return "";
      const a = state.artists.find((a) => a.id === p.artist),
        locked = blocked();
      let body = "",
        key = "";
      if (p.released) {
        key = `launch-${p.id}`;
        body = `<span class="tag">RELEASE-DAY RESULTS</span><h2>${esc(p.title)}</h2><p>Your five stage ratings averaged <strong>${p.quality}/100</strong>${p.hit ? " · HIT RECORD" : ""}. Release-day reception sets a <strong>×${p.launchMultiplier.toFixed(2)}</strong> sales multiplier. Catalog revenue starts when you advance the week. The artist’s inspiration has reset to 0; allow recovery before the next album.</p><div class="grid">${p.launchRatings.map((r) => calculation(r, key)).join("")}</div><button data-action="ackLaunch" data-id="${p.id}" data-reveal-lock class="primary" ${disable(locked)}>Continue to the label →</button>`;
      } else if (d.review) {
        const r = d.results[d.lastResult];
        key = `${p.id}-${d.stage}-${d.rerollsUsed}`;
        body = `<span class="tag">${d.reshuffleReview ? "RESHUFFLE RESULT" : "STAGE " + d.stage + " OF 5 · CALCULATING"}</span><h2>${esc(p.title)} / ${esc(r.name)}</h2>${d.reshuffleReview ? `<p>${esc(r.area)}: ${d.lastChange.before} → ${d.lastChange.after}. ${d.rerollLimit - d.rerollsUsed} reshuffles left.</p>` : ""}${calculation(r, key)}<button class="primary" data-action="${d.reshuffleReview ? "ackShuffle" : "continue"}" data-id="${p.id}" data-reveal-lock ${disable(locked)}>${d.reshuffleReview ? "Return to release review" : "Accept result & schedule next step"} →</button>`;
      } else if (d.releaseReady) {
        body = `<span class="tag">FINAL ALBUM REVIEW · LEVEL ${d.artistLevel} ARTIST</span><h2>Ready for the world?</h2><p>${esc(p.artistName)} · Five stages complete. Final quality is the rounded average of these ratings; it determines hit and award eligibility.</p><div class="area-ratings">${d.results.map((r) => `<div><small>${esc(r.area)}</small><b>${r.score}</b></div>`).join("")}<div class="overall"><small>ALBUM QUALITY</small><b>${G.albumQuality(p)}</b></div></div><label class="release-name">Final album title<input id="release-title-${p.id}" maxlength="45" value="${esc(p.title)}"></label><div class="reshuffle-controls"><label>Area to reshuffle<select id="reshuffle-${p.id}">${d.results.map((r, i) => `<option value="${i}">${esc(r.area)} · ${r.score}/100</option>`).join("")}</select></label><button data-action="reshuffle" data-id="${p.id}" ${disable(locked || d.rerollsUsed >= d.rerollLimit)}>Reshuffle area · ${d.rerollLimit - d.rerollsUsed}/${d.rerollLimit} left</button></div><label class="release-name">Release-day strategy<select id="release-plan-${p.id}">${G.RELEASE_PLANS.map((r) => `<option value="${r.id}" ${r.id === (p.releaseStrategy || "fans") ? "selected" : ""}>${r.name} · ${r.role}${state.staff.includes(r.role) ? " HIRED" : ""}</option>`).join("")}</select></label><p class="muted">Press targets Critics, fan parties target Fan response, and wide distribution targets Market impact. The targeted rating gains +6, plus a skill-based bonus with that plan’s specialist hired; the other ratings each lose 3.</p><p class="muted">Artist level ${d.artistLevel} locks in ${d.rerollLimit} attempt(s) for this album. Only the selected area’s random variation is rerolled (−12 to +12); its other contributions stay fixed. The result can be worse. Naming is saved before reshuffling.</p><button class="primary" data-action="release" data-id="${p.id}" ${disable(locked)}>Confirm title & release album →</button>`;
      } else if (d.cooldown > 0) {
        body = `<span class="tag">IN THE STUDIO · ${d.stage}/5 DECISIONS COMPLETE</span><h2>${esc(p.title)}</h2><p>${d.cooldown} week(s) until ${d.stage === 5 ? "final release review" : G.STAGES[d.stage].name}. Advance time when the rest of the label is ready.</p>`;
      } else {
        const stage = G.STAGES[d.stage];
        body = `<span class="tag">STAGE ${d.stage + 1} OF 5 · ${esc(stage.area)}</span><h2>${esc(p.title)} / ${stage.name}</h2><p>${stage.question}</p><p class="muted">${Number.isFinite(p.inspirationAtStart) ? `Inspiration locked ${p.inspirationAtStart}/100 · ` : ""}${p.duration} planned weeks · ${money(p.budget)} total production & push · expectation ${money(p.expectation.target)}${p.addOns.length ? " · " + p.addOns.map((id) => G.ALBUM_ADDONS.find((o) => o.id === id).name).join(" / ") : ""}</p><div class="production-context"><span>${esc(a.name)} · Level ${G.level(a)}</span><span>Craft ${a.talent} · Trust ${a.trust} · Morale ${Math.round(a.morale)} · Energy ${Math.round(a.energy)}</span><span>Label fame ${state.fame} · Reputation ${state.reputation} · Booth prestige ${state.booths.find((b) => b.id === p.booth).prestige}</span><span>Current trend: ${state.trend} · Album: ${p.genre} / ${p.audience}</span></div><div class="options">${stage.options
          .map((o, i) => {
            const preview = G.stagePreview(state, p, i),
              base = preview.parts.reduce((n, c) => n + c.value, 0);
            return `<button data-action="stage" data-id="${p.id}" data-option="${i}" ${disable(locked)}><strong>${o.name}</strong><small>${o.text}</small><span class="expert ${preview.hired ? "hired" : ""}">${o.role}: ${preview.hired ? "HIRED · +" + preview.bonus : "not hired · +0"}</span><div class="preview-parts">${preview.parts.map((c) => `<span>${esc(c.name)} <b>${c.value >= 0 ? "+" : ""}${c.value}</b></span>`).join("")}</div><small>Expected rating: ${clampRating(base - 8)}–${clampRating(base + 8)} /100<br>Session variation: −8 to +8. No extra fee.</small></button>`;
          })
          .join("")}</div>`;
      }
      return `<div id="project-${p.id}" class="production-panel" ${key ? `data-reveal="${key}"` : ""}><div class="stage-steps" aria-label="Production progress">${G.STAGES.map((t, i) => `<span class="${i < d.stage ? "done" : i === d.stage ? "current" : ""}">${i < d.stage ? "✓" : i + 1} ${t.name}</span>`).join("")}</div>${body}${key ? '<button class="skip-reveal" data-action="skipReveal">Skip animation</button>' : ""}</div>`;
    })
    .join("");
}
let revealFrame = 0,
  finishReveal = () => {};
const revealed = new Set();
function animateRatings() {
  const panels = [...document.querySelectorAll("[data-reveal]")];
  const pending = panels.filter((p) => !revealed.has(p.dataset.reveal));
  revealFrame++;
  for (const p of panels) if (revealed.has(p.dataset.reveal)) p.classList.add("reveal-complete");
  if (!pending.length) return;
  for (const p of pending) revealed.add(p.dataset.reveal);
  if (typeof requestAnimationFrame !== "function") return;
  const nodes = pending.flatMap((p) => [...p.querySelectorAll("[data-count]")]),
    locks = pending.flatMap((p) => [...p.querySelectorAll("[data-reveal-lock]")]),
    frame = revealFrame,
    start = performance.now(),
    reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let done = false;
  for (const b of locks) b.disabled = true;
  finishReveal = () => {
    done = true;
    for (const n of nodes) n.textContent = n.dataset.count;
    for (const b of locks) b.disabled = blocked();
    for (const p of pending) p.classList.add("reveal-complete");
  };
  if (reduced) {
    finishReveal();
    return;
  }
  function tick(now) {
    if (done || frame !== revealFrame) return;
    const t = Math.min(1, (now - start) / 1800);
    for (const n of nodes) n.textContent = Math.round(Number(n.dataset.count) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
    else finishReveal();
  }
  requestAnimationFrame(tick);
}
function validProductionSave(s) {
  return (
    s.artists.every((a) => Number.isInteger(a.xp) && a.xp >= 0) &&
    s.albums.every((p) => {
      if (p.released && !p.production) return true;
      const d = p.production;
      return (
        d &&
        Number.isInteger(d.stage) &&
        d.stage >= 0 &&
        d.stage <= 5 &&
        Number.isInteger(d.cooldown) &&
        d.cooldown >= 0 &&
        d.cooldown <= 5 &&
        typeof d.review === "boolean" &&
        typeof d.releaseReady === "boolean" &&
        Number.isInteger(d.artistLevel) &&
        d.artistLevel >= 1 &&
        d.artistLevel <= 10 &&
        Number.isInteger(d.rerollLimit) &&
        d.rerollLimit === Math.min(3, d.artistLevel) &&
        Number.isInteger(d.rerollsUsed) &&
        d.rerollsUsed >= 0 &&
        d.rerollsUsed <= d.rerollLimit &&
        Array.isArray(d.results) &&
        d.results.length === d.stage &&
        (!d.review || (Number.isInteger(d.lastResult) && !!d.results[d.lastResult])) &&
        (!d.releaseReady || d.stage === 5) &&
        d.results.every(
          (r, i) =>
            r &&
            r.area === G.STAGES[i].area &&
            typeof r.choice === "string" &&
            typeof r.trend === "string" &&
            Number.isFinite(r.score) &&
            r.score >= 0 &&
            r.score <= 100 &&
            Array.isArray(r.parts) &&
            (r.parts.length === 6 || r.parts.length === 7) &&
            r.parts.every((c) => typeof c.name === "string" && Number.isFinite(c.value)),
        ) &&
        (!p.launchReview ||
          (p.released &&
            Array.isArray(p.launchRatings) &&
            p.launchRatings.length === 3 &&
            Number.isFinite(p.launchMultiplier) &&
            p.launchRatings.every(
              (r) =>
                typeof r.name === "string" &&
                Number.isFinite(r.score) &&
                Array.isArray(r.parts) &&
                r.parts.every((c) => typeof c.name === "string" && Number.isFinite(c.value)),
            )))
      );
    })
  );
}
function roomCards() {
  return `<div class="grid">${G.BOOTHS.map((b, id) => {
    const owned = state.booths.find((x) => x.id === id),
      p = state.albums.find((x) => !x.released && x.booth === id);
    return `<article class="card"><span class="tag">${esc(b.theme)}</span><h3>${b.name}</h3><div class="metrics"><span>Equipment <b>${b.equipment}</b></span><span>Production team <b>${b.team}</b></span></div><p>${money(b.upkeep)}/week upkeep · requires label tier ${b.labelTier}</p>${owned ? `<p>${owned.hits} hits · ${owned.prestige} prestige<br>${p ? "Recording: " + esc(p.title) : "Room available"}</p>${p ? `<div class="progress"><span style="width:${Math.max(0, Math.min(100, ((p.duration - p.remaining) / p.duration) * 100))}%"></span></div><small>${p.production.stage}/5 decisions · ${p.production.cooldown ? p.production.cooldown + " week(s) to next step" : "Decision ready"}</small>` : ""}` : `<button data-action="build" data-id="${id}" ${disable(blocked() || state.cash < b.cost || G.tier(state) < b.labelTier)}>Build · ${money(b.cost)}</button>`}</article>`;
  }).join("")}</div>`;
}
function studio() {
  const free = state.artists.filter((a) => !G.busy(state, a.id) && a.contract.remaining > 0),
    booths = state.booths.filter((b) => !state.albums.some((p) => !p.released && p.booth === b.id));
  return `<div class="sectionhead"><h2>Your roster</h2><span class="muted">${state.artists.length} / ${G.slots(state)} signed</span></div>${state.artists.length ? `<div class="grid">${state.artists.map(artistCard).join("")}</div>` : '<div class="empty">Your first discovery is waiting. Open Scout artists to sign talent.</div>'}<h2>Start an album</h2><div class="card"><p>Five interactive stages take five weeks (six for Youth). Each selected package add-on adds one more week before release. Fees are paid up front. Room quality benefits every genre.</p><form id="albumForm" class="form"><label>Artist<select id="artist">${free.map((a) => `<option value="${a.id}">${esc(a.name)} · ${a.genre} · inspiration ${Math.round(G.inspirationInfo(a).value)}/100</option>`).join("")}</select></label><label>Recording room<select id="booth">${booths.map((b) => `<option value="${b.id}">${G.BOOTHS[b.id].name} · rank ${b.id + 1}</option>`).join("")}</select></label><label>Genre<select id="genre">${G.GENRES.map((g) => `<option ${free[0]?.genre === g ? "selected" : ""}>${g}</option>`).join("")}</select></label>${themeFields()}<label>Target audience<select id="audience">${["Youth", "Teen", "Adult"].map((g) => `<option ${free[0]?.audience === g ? "selected" : ""}>${g}</option>`).join("")}</select></label><label>Base production budget<select id="budget"><option value="4000">Lean · $4,000</option><option value="8000">Standard · $8,000</option><option value="12000">Premium · $12,000</option></select></label><label>Album title<input id="title" maxlength="45" placeholder="Name your next record"></label><fieldset class="album-addons"><legend>Album push & production add-ons · +1 week each</legend>${G.ALBUM_ADDONS.map((o) => `<label><input type="checkbox" name="albumAddon" value="${o.id}"><span><b>${o.name} · ${money(o.cost)}</b><small>${o.description}</small></span></label>`).join("")}</fieldset><div id="albumQuote" class="plan-quote form-full" aria-live="polite">Choose your album package.</div><button id="beginAlbum" class="primary" ${disable(blocked() || !free.length || !booths.length || state.cash < 4000 || !G.inspirationInfo(free[0] || {}).canRecord)}>Begin recording →</button></form></div>${comboNotebook()}<h2>Ranked recording rooms</h2><p class="muted">Stronger equipment and production teams raise ratings across all genres. Successful recordings still grow each room’s prestige. Extra rooms support simultaneous projects; higher ranks cost more to build and run.</p>${roomCards()}`;
}
function selectedAddons() {
  return [...document.querySelectorAll('input[name="albumAddon"]:checked')].map((e) => e.value);
}
function updateAlbumQuote() {
  if (tab !== "studio") return;
  const a = state.artists.find((a) => a.id === Number($("artist").value));
  if (!a) {
    $("albumQuote").textContent =
      "No idle contracted artist. Finish recording or touring, sign talent, or renew an expired deal.";
    return;
  }
  const inspiration = G.inspirationInfo(a);
  const selected = selectedAddons(),
    base = Number($("budget").value) || 4000,
    total = base + selected.reduce((n, id) => n + G.ALBUM_ADDONS.find((o) => o.id === id).cost, 0),
    e = G.albumExpectation(state, a, total);
  $("albumQuote").innerHTML =
    `<b>${money(total)} upfront · ${(a.age === "Youth" ? 6 : 5) + selected.length} production weeks</b>${comboQuote($("genre").value, selectedThemes())}<p>Expected label album revenue: <strong>${money(e.target)}</strong>. Artist value ${money(e.artistValue)}${e.previousTitle ? "; previous release " + esc(e.previousTitle) + " has earned " + money(e.previousRevenue) : "; no previous release"}. Target locks when recording starts. Tour revenue is assessed separately.</p>`;
  $("albumQuote").innerHTML +=
    inspirationMeter(a) +
    `<p class="muted">Locks at recording start: ${inspiration.bonus >= 0 ? "+" : ""}${inspiration.bonus} to every stage. Decent 60+, great 80+, classic 90+ final quality; inspiration improves the odds, while craft, team, choices and variation still determine the result.</p>`;
  $("beginAlbum").disabled = !inspiration.canRecord || blocked() || state.cash < total || !$("booth").value;
}
function expectationCard(p) {
  const e = p.expectation;
  if (!e || e.legacy) return '<p class="muted">Legacy release · no retroactive performance assessment.</p>';
  return `<div class="expectation ${e.status === "underperformed" ? "missed" : ""}"><b>${e.status === "met" ? "EXPECTATIONS MET" : e.status === "underperformed" ? "UNDERPERFORMED" : "ALBUM EXPECTATION"}</b><p>${money(p.total)} / ${money(e.target)} label revenue<br>Value at booking ${money(e.artistValue)}${e.previousTitle ? "<br>Prior album revenue " + money(e.previousRevenue) : ""}</p><div class="progress"><span style="width:${Math.min(100, (p.total / e.target) * 100)}%"></span></div><small>${e.status === "pending" ? "Assessed after all earning weeks, including extensions." : e.status === "met" ? "Artist morale +8; artist and label reputation +2." : `Morale −${e.penalties.morale}, artist & label reputation −${e.penalties.reputation}, fame −${e.penalties.fame}.`}</small></div>`;
}
function tourReviewText(t) {
  if (t.awaitingDayEvent) return "Current decision pending · your selection sets the next review.";
  const remaining = Math.max(0, 3 - G.tourInteractionBudget(state).count),
    target = Math.max(t.day + 1, t.nextInteractionDay ?? t.day + 1),
    earliest = remaining ? target : Math.max(target, t.day + 8 - state.tourDayInWeek);
  if (earliest > t.plannedDays)
    return `Tour completes on day ${t.plannedDays}; no additional review is scheduled before closing.`;
  return `Next review target: day ${earliest}${t.reviewAfterShow ? " / after show #" + t.reviewAfterShow : ""}${remaining ? "" : " (next label week)"}. ${remaining} more tour decision(s) available this week across all tours.`;
}
function tourCards(status) {
  return [...state.tours]
    .reverse()
    .filter((t) => (status === "active" ? t.status === "active" : t.status !== "active"))
    .map((t) => {
      const scale = G.TOUR_SCALES.find((r) => r.id === t.scale),
        mode = G.TOUR_MODES.find((m) => m.id === t.mode),
        last = t.history.filter((h) => !h.event && !h.rest).at(-1),
        prior = t.history.at(-2)?.net ?? -t.upfront,
        recovered = t.costs ? Math.min(100, (t.revenue / t.costs) * 100) : 0;
      const projection = G.tourRemainingForecast(t);
      const card = `<article id="tour-${t.id}" class="card tour-card"><div class="sectionhead"><div><span class="tag">${t.status.toUpperCase()} · ${scale.name} · ${mode.name}</span><h3>${esc(t.artistName)} / ${esc(t.title)}</h3><p>${t.partnerName ? "With " + esc(t.partnerName) : t.rival ? "With rival " + esc(t.rival.name) : "Solo headliner"} · day ${t.day}/${t.plannedDays} · quality ${Math.round(t.quality)}/100${t.restDays ? " · " + t.restDays + " recovery days scheduled" : ""}</p></div><div class="tour-net ${t.net >= 0 ? "positive" : "negative"}"><small>${t.net >= 0 ? "PROFITABLE" : "UPFRONT LOSS / RECOVERING"}</small><b data-tour-money="${t.net}" data-tour-from="${t.history.length ? prior : 0}" data-tour-key="${t.id}-${t.history.length}-${t.status}">${money(t.net)}</b></div></div><div class="metrics"><span>Tour receipts <b>${money(t.revenue)}</b></span><span>Tour costs & venue fees <b>${money(t.costs)}</b></span><span>Daily operating <b>${money(Math.ceil(t.weekly / 7))}</b></span><span>Last show receipts <b>${money(last?.revenue || 0)}</b></span></div>${t.status === "active" ? `<p class="tour-projection"><b>Projected finish: ${money(projection.net)} net on day ${t.plannedDays}</b><br>${t.net >= 0 ? "Currently profitable" : projection.breakEvenDay ? "Estimated break-even on day " + projection.breakEvenDay : "Current itinerary does not forecast break-even"}. ${t.restDays} recovery days pending · next show #${t.showDays + 1}.<br>${tourReviewText(t)}<br><small>Uses current quality, remaining dates and confirmed ticket boosts. Future choices and ticket variation can change this.</small></p>` : ""}<div class="tour-recovery"><span style="--recovered:${recovered}%"></span></div><small>${Math.round(recovered)}% of tour-specific costs recovered. Includes setup, daily operations, 15% venue fees and event costs. Regular label salaries and album revenue are outside this tour net.</small><div class="tour-week-history">${t.history
        .slice(-21)
        .map(
          (h) =>
            `<div class="${h.net >= 0 ? "positive" : "negative"}"><small>${h.day ? "D" + h.day : "W" + h.week}${h.rest ? " · REST" : h.event ? " · EVENT" : ""}</small><b>${money(h.net)}</b></div>`,
        )
        .join("")}</div><p>${t.artists
        .map((id) => {
          const a = state.artists.find((a) => a.id === id);
          return a ? `${esc(a.name)} · energy ${Math.round(a.energy)} · morale ${Math.round(a.morale)}` : "";
        })
        .filter(Boolean)
        .join(
          "<br>",
        )}</p>${t.status === "active" ? `<button data-action="cancelTour" data-id="${t.id}" ${disable(blocked())}>End remaining tour dates</button>` : `<p>${esc(t.reason)}</p>`}</article>`;
      return t.status === "active"
        ? card
        : `<details class="archive-item"><summary><span><b>${esc(t.title)}</b><small>${esc(t.artistName)} · ${scale.name} · ${esc(t.status)} · ${t.day} days</small></span><span class="archive-stat">${money(t.net)}<small>net · quality ${Math.round(t.quality)}</small></span></summary>${card}</details>`;
    })
    .join("");
}
function road() {
  const eligible = state.albums.filter(
    (p) => G.popularAlbum(state, p) && state.artists.some((a) => a.id === p.artist && !G.busy(state, a.id)),
  );
  return `<section id="active-tours"><div class="sectionhead"><h2>Active tours</h2><span class="tag">${state.tours.filter((t) => t.status === "active").length} ON THE ROAD</span></div>${tourCards("active") || '<div class="empty">No active tours. Book your next run below.</div>'}</section><h2>Book a new tour</h2><p class="muted">A recent album qualifies with a Top 10 peak, $10,000 gross revenue, or two earning weeks and 250 weekly units. Each album gets one tour. Touring label artists cannot record or train. Upfront costs make every tour start in the red; ticket demand ramps with completed show days. Daily receipts still settle, but choices cover several days. At most three tour decisions occur per label week across all active tours. Advancing skips quiet days and stops at a review, weekly settlement or required album decision.</p><div class="card"><form id="tourForm" class="form"><label>Popular album<select id="tour-album">${eligible.map((p) => `<option value="${p.id}">${esc(p.title)} · ${esc(p.artistName)}</option>`).join("")}</select></label><label>Tour territory<select id="tour-scale">${G.TOUR_SCALES.map((r) => `<option value="${r.id}">${r.name} · ${r.weeks * 7} days / ${r.weeks} weeks</option>`).join("")}</select></label><label>Tour lineup<select id="tour-mode">${G.TOUR_MODES.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label><label id="tour-partner-wrap" hidden>Labelmate<select id="tour-partner"></select></label><label id="tour-rival-wrap" hidden>Rival artist<select id="tour-rival">${state.rivalArtists.map((a) => `<option value="${a.id}">${esc(a.name)} · fame ${Math.round(a.fame)}</option>`).join("")}</select></label><div id="tourQuote" class="plan-quote form-full" aria-live="polite">Choose an eligible album to see tour costs and forecasts.</div><button id="bookTour" class="primary" ${disable(blocked() || !eligible.length)}>Book tour →</button></form></div><details class="archive-section"><summary>Completed & ended tours · ${state.tours.filter((t) => t.status !== "active").length}</summary>${state.tours.some((t) => t.status !== "active") ? tourCards("complete") : '<div class="empty">Book a popular artist’s first tour to watch its costs, ticket revenue, quality, itinerary length and net profit evolve day by day.</div>'}</details>`;
}
function readTourPlan() {
  return {
    albumId: $("tour-album").value,
    scale: $("tour-scale").value || "regional",
    mode: $("tour-mode").value || "solo",
    partnerId: $("tour-partner").value,
    rivalId: $("tour-rival").value,
  };
}
function updateTourQuote(refreshPartners = false) {
  if (tab !== "road") return;
  const plan = readTourPlan(),
    p = state.albums.find((p) => p.id === Number(plan.albumId));
  $("tour-partner-wrap").hidden = plan.mode !== "labelmate";
  $("tour-rival-wrap").hidden = plan.mode !== "rival";
  if (refreshPartners) {
    $("tour-partner").innerHTML = state.artists
      .filter((a) => a.id !== p?.artist && !G.busy(state, a.id))
      .map((a) => `<option value="${a.id}">${esc(a.name)} · energy ${Math.round(a.energy)}</option>`)
      .join("");
    plan.partnerId = $("tour-partner").value;
  }
  try {
    const q = G.tourQuote(state, plan);
    $("tourQuote").innerHTML =
      `<b>${money(q.upfront)} booking cost · ${money(Math.ceil(q.weekly / 7))}/show or recovery day, plus venue commission</b><p>${q.mode.description}<br>Energy required: ${q.mode.minEnergy} per label artist; drain roughly ${(q.mode.drain / 7).toFixed(1)} per show day. Planned ${q.scale.weeks * 7} days.<br>Forecast ticket revenue ${money(q.forecast)} against ${money(q.cost)} tour-specific costs: <strong>${money(q.expectedNet)} net</strong> before events and regular label salaries. ${q.breakEvenDay ? "Baseline break-even: day " + q.breakEvenDay + " of " + q.scale.weeks * 7 : "Baseline does not reach break-even in this itinerary; improve demand or change the lineup."}<br>Baseline uses current quality and the exact live daily ticket formula, without future event boosts, event fees, recovery days or extensions. Ticket variation ±10%; daily events can wildly change quality, add or remove dates, require recovery or end the tour. Forecast costs include 15% venue commission; event fees are additional.</p>`;
    $("bookTour").disabled =
      blocked() ||
      G.busy(state, q.artist.id) ||
      q.artist.energy < q.mode.minEnergy ||
      (!!q.partner && (G.busy(state, q.partner.id) || q.partner.energy < q.mode.minEnergy)) ||
      state.cash < q.upfront + q.weekly;
  } catch (e) {
    $("tourQuote").textContent = p
      ? e.message
      : "No eligible idle artist. Finish current projects or tours, or grow a recent album’s sales and chart standing.";
    $("bookTour").disabled = true;
  }
}
const seenTourMoney = new Set();
let tourAnimationFrame = 0;
function animateTourMoney() {
  tourAnimationFrame++;
  const frame = tourAnimationFrame,
    nodes = [...document.querySelectorAll("[data-tour-money]")].filter(
      (n) => !seenTourMoney.has(n.dataset.tourKey),
    );
  for (const n of nodes) seenTourMoney.add(n.dataset.tourKey);
  if (
    !nodes.length ||
    typeof requestAnimationFrame !== "function" ||
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  )
    return;
  const start = performance.now();
  function tick(now) {
    if (frame !== tourAnimationFrame) return;
    const t = Math.min(1, (now - start) / 1400);
    for (const n of nodes) {
      const from = Number(n.dataset.tourFrom),
        to = Number(n.dataset.tourMoney);
      n.textContent = money(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    }
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function roleKey(role) {
  return role.replace(/[^a-zA-Z]/g, "");
}
function termOptions(a) {
  return [1, 3, 5]
    .map((term) => {
      const q = G.contractQuote(state, a, term);
      return `<option value="${term}" ${term === 3 ? "selected" : ""}>${term} album${term > 1 ? "s" : ""} · ${money(q.fee)} advance · ${Math.round(q.royalty * 100)}% royalty</option>`;
    })
    .join("");
}
function inspirationMeter(a) {
  const i = G.inspirationInfo(a);
  return `<div class="inspiration-meter"><div class="sectionhead"><b>Inspiration ${Math.round(i.value)}/100</b><span class="tag">${i.name}</span></div><div class="inspiration-track" role="meter" aria-label="${esc(a.name)} inspiration" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${i.value}"><span style="width:${i.value}%"></span>${[25, 50, 75, 90].map((n) => `<i style="left:${n}%"></i>`).join("")}</div><div class="inspiration-thresholds"><span>25 · Start</span><span>50 · Decent</span><span>75 · Great</span><span>90 · Classic</span></div><small>Resets on release · +10/week between albums, +5/week on tour · ${i.next ? Math.ceil((i.next.min - i.value) / (G.onTour(state, a.id) ? 5 : 10)) + " recovery week(s) to " + i.next.min : "Maximum tier reached"}. No recovery while recording.</small></div>`;
}
function artistCard(a) {
  const t = G.trainingInfo(state, a),
    expired = !a.contract.remaining;
  return `<article class="card"><div class="avatar"><span class="monogram">${esc(a.name[0])}</span><div><span class="tag">${esc(a.genre)}</span><h3>${esc(a.name)}</h3></div></div><p>${a.age} artist · ${G.CAREER_NAMES[G.careerTier(a)]} · Level ${G.level(a)}/10 · ${a.audience} audience</p><div class="metrics"><span>Craft <b>${a.talent}</b></span><span>Potential <b>${a.potential}</b></span><span>Fans <b>${Math.round(a.fans)}</b></span><span>Trust <b>${a.trust}</b></span><span>Artist fame <b>${Math.round(a.fame)}</b></span><span>Reputation <b>${a.reputation}</b></span><span>Energy <b>${Math.round(a.energy)}</b></span><span>Morale <b>${Math.round(a.morale)}</b></span><span>Momentum <b>${Math.round(a.momentum)}</b></span><span>Career XP <b>${a.xp || 0}${G.level(a) < 10 ? " / " + G.CAREER_XP[G.level(a)] : " · MAX"}</b></span></div>${G.onTour(state, a.id) ? `<p class="touring-status">ON TOUR · ${esc(G.onTour(state, a.id).title)} · recording unavailable</p>` : ""}${inspirationMeter(a)}<div class="contract-summary"><b>Market value ${money(G.artistValue(a))}</b><p>${expired ? "CONTRACT COMPLETE · renew to make another album" : `${a.contract.remaining} / ${a.contract.term} albums remaining · ${Math.round(a.contract.royalty * 100)}% royalty`}<br>${expired && !G.onTour(state, a.id) ? "No roster salary until renewed" : money(a.wage) + "/week"} · development ceiling ${t.cap}</p></div>${expired ? `<label>New album commitment<select id="renew-${a.id}">${termOptions(a)}</select></label><button data-action="renew" data-id="${a.id}" ${disable(blocked() || G.busy(state, a.id))}>Renew contract</button>` : ""}<p class="muted">${t.wait ? `Development returns in ${t.wait} week(s).` : t.gain > 0 ? `Next development: craft +${t.gain}, XP +1. Three-week cooldown.` : a.talent >= a.potential ? "At lifetime potential. Focus on releases and fan growth." : "At the current development ceiling. Raise artist level or label rank to grow further."}</p><div class="actions"><button data-action="train" data-id="${a.id}" ${disable(blocked() || expired || G.busy(state, a.id) || a.energy < 30 || t.wait > 0 || t.gain <= 0 || state.cash < t.cost)}>Develop · ${money(t.cost)}</button><button data-action="leave" data-id="${a.id}" ${disable(blocked() || G.busy(state, a.id))}>${expired ? "Release completed contract" : "End contract (reputation −3)"}</button></div></article>`;
}
function scouting() {
  return `<h2>Tomorrow’s headline acts</h2><p class="muted">Pay for a new search whenever you need fresh prospects. Higher budgets improve the pool’s craft, potential and existing fan reach. Artist advances are paid separately. Lists stay until you scout again.</p><div class="grid search-budgets">${G.SCOUT_BUDGETS.map((b, i) => `<article class="card"><span class="tag">${b.count} PROSPECTS</span><h3>${b.name}</h3><p>Craft ${b.min}–${b.max} · potential roughly ${b.potential}–${Math.min(100, b.potential + 8)} · established fans ${b.fans}–${b.fans + b.fanRange - 1}</p><button data-action="scout" data-id="${i}" ${disable(blocked() || state.cash < b.cost)}>Scout · ${money(b.cost)}</button></article>`).join("")}</div>${state.scoutReport ? `<p class="muted">Last search: ${state.scoutReport.name}, week ${state.scoutReport.week}.</p>` : ""}<h2>Available artists</h2><p class="muted">Reputation below 30 blocks signing. Royalties are deducted from each album’s gross revenue. A completed contract keeps its roster slot until renewed or released.</p><div class="grid">${
    state.candidates
      .map((a) => {
        const q = G.contractQuote(state, a, 1);
        return `<article class="card"><span class="tag">${a.genre}</span><h3>${esc(a.name)}</h3><p>${a.age} artist · ${a.audience} audience</p><div class="metrics"><span>Craft <b>${a.talent}</b></span><span>Potential <b>${a.potential}</b></span><span>Fans <b>${Math.round(a.fans)}</b></span><span>Fame <b>${Math.round(a.fame)}</b></span><span>Reputation <b>${a.reputation}</b></span></div><p>Market value ${money(G.artistValue(a))}<br>Salary on signing ${money(q.wage)}/week</p><label>Album commitment<select id="sign-term-${a.id}">${termOptions(a)}</select></label><button data-action="sign" data-id="${a.id}" ${disable(blocked() || state.artists.length >= G.slots(state) || state.reputation < 30 || state.cash < q.fee)}>Sign selected terms</button></article>`;
      })
      .join("") || '<div class="empty">No prospects left. Choose a scouting budget above.</div>'
  }</div>`;
}
function staff() {
  return `<h2>The people behind the records</h2><p class="muted">Each role has a pool of named candidates. Skill affects production expertise and that role’s business benefit. Recruitment refreshes only the chosen role. Fees and weekly salaries are separate; replacing or dismissing an employee costs two weeks’ severance.</p>${Object.entries(
    G.ROLES,
  )
    .map(([r, x]) => {
      const key = roleKey(r),
        employee = state.employees[r],
        severance = employee ? employee.wage * 2 : 0;
      return `<section class="team-role"><div class="sectionhead"><div><h2>${r}</h2><p class="muted">${x.description}</p></div>${employee ? `<div class="employee-badge"><b>${esc(employee.name)}</b><small>Skill ${employee.skill} · stage bonus +${G.staffBonus(state, r)} · ${money(employee.wage)}/week</small><button data-action="fire" data-role="${r}" ${disable(blocked() || state.cash < severance)}>End employment · ${money(severance)}</button></div>` : '<span class="tag">OPEN POSITION</span>'}</div><div class="drive-controls"><label>Recruitment budget<select id="drive-${key}">${G.RECRUIT_BUDGETS.map((b, i) => `<option value="${i}">${b.name} · ${money(b.cost)} · skill ${b.min}–${b.max}</option>`).join("")}</select></label><button data-action="drive" data-role="${r}" ${disable(blocked() || state.cash < G.RECRUIT_BUDGETS[0].cost)}>Run recruitment drive</button></div><div class="grid">${state.staffCandidates[r].map((c) => `<article class="card"><span class="tag">SKILL ${c.skill} /100 · EXPERTISE +${Math.round(6 + c.skill / 10)}</span><h3>${esc(c.name)}</h3><p>${money(c.wage)}/week · hiring fee ${money(c.cost)}${employee ? "<br>Replacement severance " + money(severance) : ""}</p><button data-action="hire" data-role="${r}" data-id="${c.id}" ${disable(blocked() || state.cash < c.cost + severance)}>${employee ? "Replace with" : "Hire"} ${esc(c.name)} · ${money(c.cost + severance)}</button></article>`).join("") || '<div class="empty">Run a new recruitment drive to see more candidates.</div>'}</div></section>`;
    })
    .join("")}`;
}
let chartPage = 0,
  chartFilter = "all",
  chartGenre = "all",
  wireCompany = "all",
  awardViewYear = null;
function charts() {
  const c = state.charts,
    source = c.previewEntries || c.entries,
    rows = source.filter(
      (e) => (chartFilter !== "own" || e.owned) && (chartGenre === "all" || e.genre === chartGenre),
    ),
    pages = Math.max(1, Math.ceil(rows.length / 50));
  chartPage = Math.min(chartPage, pages - 1);
  const visible = rows.slice(chartPage * 50, chartPage * 50 + 50);
  return `<h2>Industry Top 300</h2><p class="muted">${c.rivals.length} rival albums compete for 300 published positions. Twenty rival releases enter every four weeks. Official ranks use settled weekly units; a new release gets a provisional debut estimate immediately, without sales or rewards being fabricated.</p>${c.previewEntries ? '<p class="plan-quote">Provisional release-day estimates are included. Official ranks, chart weeks and milestones settle when this label week closes.</p>' : ""}<div class="chart-controls"><label>Show<select id="chartFilter"><option value="all" ${chartFilter === "all" ? "selected" : ""}>All labels</option><option value="own" ${chartFilter === "own" ? "selected" : ""}>My albums</option></select></label><label>Genre<select id="chartGenre"><option value="all">All genres</option>${G.GENRES.map((g) => `<option ${g === chartGenre ? "selected" : ""}>${g}</option>`).join("")}</select></label><span>Week ${c.week} · ${rows.length} matches · page ${chartPage + 1}/${pages}</span><button data-action="chartPage" data-id="${chartPage - 1}" ${disable(chartPage === 0)}>Previous 50</button><button data-action="chartPage" data-id="${chartPage + 1}" ${disable(chartPage + 1 >= pages)}>Next 50</button></div><div class="chart-table"><div class="chart-row chart-heading"><span>RANK</span><span>ALBUM / ARTIST</span><span>LABEL</span><span>UNITS</span></div>${visible.map((e) => `<div class="chart-row ${e.owned ? "owned" : ""}"><b class="chart-rank">#${e.rank}</b><div><b>${esc(e.title)}</b>${e.projected ? '<span class="tag">PROVISIONAL</span>' : ""}<small>${esc(e.artistName)} · ${esc(e.genre)}</small></div><span>${e.owned ? "YOUR LABEL" : esc(e.label)}</span><b>${e.units.toLocaleString()}${e.projected ? " est." : ""}</b></div>`).join("")}</div><h2>Your chart records</h2><div class="grid">${
    state.albums
      .filter((p) => p.released)
      .map(
        (p) =>
          `<article class="card"><span class="tag">${p.chart.rank ? "OFFICIAL #" + p.chart.rank : "OUTSIDE TOP 300"}</span><h3>${esc(p.title)}</h3><p>${p.chart.projectedRank ? "Provisional debut #" + p.chart.projectedRank + "<br>" : ""}Peak ${p.chart.best ? "#" + p.chart.best : "—"} · ${p.chart.weeks} official chart weeks<br>Campaign ${p.age}/${p.salesWeeks} earning weeks</p><div class="chart-history">${p.chart.history
            .slice(-18)
            .map((h) => `<span title="Week ${h.week}: #${h.rank}, ${h.units} units">${h.rank}</span>`)
            .join("")}</div></article>`,
      )
      .join("") || '<div class="empty">Release your first album to compete.</div>'
  }</div>`;
}
function journal() {
  const listings = state.industryListings
    .filter((l) => wireCompany === "all" || l.companyId === wireCompany)
    .slice(0, 30);
  return `<h2>Industry wire</h2><p class="muted">Rival company listings are generated from the same releases competing on the Top 300. CEO relationships remember your decisions.</p><div class="grid">${state.rivalCompanies.map((c) => `<article class="card company-card"><span class="tag">RELATIONSHIP ${c.relationship >= 0 ? "+" : ""}${c.relationship}</span><h3>${esc(c.name)}</h3><p>${esc(c.ceo)}<br>${esc(c.strategy)}</p></article>`).join("")}</div><div class="sectionhead"><h2>Company release listings</h2><label>Company<select id="wireCompany"><option value="all">All companies</option>${state.rivalCompanies.map((c) => `<option value="${c.id}" ${wireCompany === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div><div class="grid">${listings.map((l) => `<article class="card"><span class="tag">${esc(l.company)} · Y${l.year} W${1 + ((l.week - 1) % 52)}</span><h3>${esc(l.title)}</h3><p>${esc(l.artist)} · ${esc(l.genre)}<br>Recording quality ${l.quality}/100 · launch demand ${l.units.toLocaleString()} units</p></article>`).join("")}</div><h2>Your label’s news</h2>${state.effects.length ? `<div class="card"><span class="tag">Consequences in motion</span>${state.effects.map((e) => `<p>Week ${e.week}: ${esc(e.text)}</p>`).join("")}</div>` : ""}${state.news.map((n) => `<div class="line">${esc(n)}</div>`).join("")}`;
}
function annualAwards() {
  const current = G.operatingYear(state.week),
    year =
      awardViewYear ??
      (state.event?.type === "awards"
        ? state.event.year
        : state.finished && state.awardPrograms[current - 1]?.results
          ? current - 1
          : current),
    program = state.awardPrograms[year] || { entries: {}, results: null },
    closed = !!program.results || year !== current;
  return `<h2>Annual Silver Groove Awards</h2><p class="muted">Enter at most one album per genre. The album must have been completed and released in that operating year. Change selections until that year closes. The ceremony runs at the transition into the next year; entries compete with rival nominees on quality, critics, fans, Top 300 achievement and jury variation.</p><label class="award-year">Operating year<select id="awardYear">${Object.keys(
    state.awardPrograms,
  )
    .map(
      (y) =>
        `<option value="${y}" ${Number(y) === year ? "selected" : ""}>Year ${y}${state.awardPrograms[y].results ? " · results" : ""}</option>`,
    )
    .join("")}</select></label>${
    program.results
      ? `<div class="award-results">${program.results.map((r) => `<section class="card"><span class="tag">${r.genre} · ALBUM OF THE YEAR</span><h3>${esc(r.entries.find((e) => e.id === r.winner)?.title || "No eligible release")}</h3>${r.entries.map((e, i) => `<details ${e.owned ? "open" : ""}><summary>#${i + 1} · ${esc(e.title)} · ${esc(e.label)} · ${e.score}/100 ${e.owned ? "— YOUR ENTRY" : ""}</summary>${calculation({ name: e.title, parts: e.parts, score: e.score }, "award")}</details>`).join("")}</section>`).join("")}</div>`
      : `<p class="plan-quote">Year ${year} entries close after week ${year * 52}. Winners receive $8,000 per genre plus label fame and artist career recognition. Attendance spending cannot buy a win.</p><div class="grid">${G.GENRES.map(
          (g) => {
            const eligible = G.awardEligible(state, year, g);
            return `<article class="card"><span class="tag">${g}</span><h3>${g} Album of the Year</h3><label>Eligible album<select id="award-${roleKey(g)}"><option value="">No entry</option>${eligible.map((p) => `<option value="${p.id}" ${program.entries[g] === p.id ? "selected" : ""}>${esc(p.title)} · ${p.quality}/100 · released W${p.releaseWeek}</option>`).join("")}</select></label><button data-action="awardEntry" data-genre="${g}" data-year="${year}" ${disable(blocked() || closed)}>Save genre entry</button><p>${program.entries[g] ? "Entered: " + esc(state.albums.find((p) => p.id === program.entries[g])?.title || "Unavailable") : "No entry submitted."}</p></article>`;
          },
        ).join("")}</div>`
  }`;
}
function finance() {
  return `<h2>Label finances & career economics</h2><p class="muted">New albums pay artist royalties and 4–8% distribution fees (VP skill reduces the baseline). CEO distribution concessions can add fees. Back-to-back releases by the same artist within eight weeks lose 10% launch demand. Momentum rises with successful releases and charts, then fades. Existing contracts and already-produced album models are preserved.</p><div class="grid">${state.artists.map((a) => `<article class="card"><span class="tag">${G.CAREER_NAMES[G.careerTier(a)]} · LEVEL ${G.level(a)}/10</span><h3>${esc(a.name)}</h3><p>Market value ${money(G.artistValue(a))}<br>${a.career.releases} releases · ${a.career.awards} annual wins · ${a.career.showDays} show days<br>Career label album revenue ${money(a.career.albumRevenue)}<br>Momentum ${Math.round(a.momentum)}/100 · next level ${G.level(a) < 10 ? G.CAREER_XP[G.level(a)] + " XP" : "maximum"}</p></article>`).join("")}</div><h2>Weekly settlement history</h2><p class="muted">Daily tour ledgers settle separately. These rows show cash immediately before and after weekly payroll, album receipts and awards. Cash changes during the week (including investments, events and test grants) are outside this weekly delta.</p><div class="finance-table">${state.financeHistory
    .slice(-16)
    .reverse()
    .map(
      (w) =>
        `<div class="line">Week ${w.week} · opening ${money(w.openingCash)} · overhead ${money(w.overhead)} · label album receipts ${money(w.albumIncome)}${w.hqIncome ? " · headquarters takings " + money(w.hqIncome) : ""} · closing ${money(w.closingCash)} · change ${money(w.cashChange)}</div>`,
    )
    .join("")}</div>`;
}

const seenMilestones = new Set();
function milestoneBanner() {
  const n = state.notifications[0];
  if (!n) return "";
  const seen = seenMilestones.has(n.id);
  seenMilestones.add(n.id);
  return `<div class="chart-alert ${seen ? "seen" : ""}" role="status"><div class="chart-award">${n.kind === "tour" ? "$" : "#" + n.rank}</div><div><span class="tag">WEEK ${n.week} · ${n.kind === "tour" ? "TOUR PROFITABILITY" : "CHART MILESTONE"}</span><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p></div><button data-action="ackMilestone" data-id="${n.id}">Continue${state.notifications.length > 1 ? " · " + state.notifications.length + " milestones" : ""}</button></div>`;
}

function catalog() {
  return `<h2>Your discography</h2><p class="muted">Albums earn for 12 weeks, extendable to 18 through campaign decisions. Revenue shown is after royalties and distribution. Expand a record for costs, expectations and ratings. Current campaigns appear first; finished runs are below.</p><div class="catalog-list">${
    [...state.albums]
      .sort(
        (a, b) =>
          Number(a.released && a.age >= a.salesWeeks) - Number(b.released && b.age >= b.salesWeeks) ||
          b.id - a.id,
      )
      .map(
        (p) =>
          `${p.released ? `<details class="archive-item"><summary><span><b>${esc(p.title)}</b><small>${esc(p.artistName)} · ${p.genre} · ${p.age < p.salesWeeks ? `${p.salesWeeks - p.age} earning weeks left` : "RUN COMPLETE"}</small></span><span class="archive-stat">${p.quality}/100<small>${money(p.total)} revenue · peak ${p.chart.best ? "#" + p.chart.best : "—"}</small></span></summary>` : ""}<article class="card"><span class="tag">${p.released ? (p.hit ? "HIT RECORD" : "RELEASED") : "IN PRODUCTION"}</span><h3>${esc(p.title)}</h3><p>${esc(p.artistName)} · ${p.genre} · ${p.audience} audience</p>${
            p.released
              ? `${expectationCard(p)}<div class="score">${p.quality}<small>/100</small></div><p>Catalog revenue <strong>${money(p.total)}</strong><br>Production & push ${money(p.budget)}${p.addOns.length ? "<br>" + p.addOns.map((id) => G.ALBUM_ADDONS.find((o) => o.id === id).name).join(" · ") : ""}<br>${Math.max(0, p.salesWeeks - p.age)} earning weeks left · ${Math.round(p.royalty * 100)}% artist royalty<br>Gross ${money(p.gross)} · royalties ${money(p.royalties)} · distribution ${money(p.distributionFees || 0)}<br>${p.boosts
                  .filter((b) => b.until >= state.week)
                  .map((b) => `Campaign ×${b.mult} · weeks ${b.start}–${b.until}<br>`)
                  .join(
                    "",
                  )}Chart ${p.chart.rank ? "#" + p.chart.rank : "off chart"} · peak ${p.chart.best ? "#" + p.chart.best : "—"}</p>${p.production ? `<details class="catalog-ratings"><summary>Production & release ratings</summary>${p.production.results.map((r) => `<p>${esc(r.area)} <b>${r.score}/100</b><br><small>${esc(r.choice)}</small></p>`).join("")}${(p.launchRatings || []).map((r) => `<p>${esc(r.name)} <b>${r.score}/100</b></p>`).join("")}<p>Release multiplier ×${p.launchMultiplier.toFixed(2)}</p></details>` : ""}`
              : `<p>${p.expectation && !p.expectation.legacy ? "Expected label revenue " + money(p.expectation.target) + " · " : ""}${p.production ? `${p.production.stage}/5 production decisions · ${p.production.releaseReady ? "Ready for final review" : p.production.cooldown ? `${p.production.cooldown} week(s) to next step` : "Decision ready above"}` : `${p.remaining} weeks until release`}</p>`
          }</article>${p.released ? "</details>" : ""}`,
      )
      .join("") ||
    '<div class="empty">A label is a collection of choices. Your first record starts in The studio.</div>'
  }</div>`;
}
function activityHub() {
  const projects = state.albums.filter((p) => !p.released || p.launchReview),
    tours = state.tours.filter((t) => t.status === "active");
  return `<div class="sectionhead"><div><span class="tag">LABEL CONTROL</span><h2>Active activities</h2></div><span class="muted">${projects.length} album project${projects.length === 1 ? "" : "s"} · ${tours.length} tour${tours.length === 1 ? "" : "s"}</span></div><div class="activity-grid">${state.event ? `<a class="activity-card urgent" href="#event"><span class="tag">DECISION REQUIRED · TIME PAUSED</span><b>${esc(state.event.title)}</b><small>Resolve this event to continue →</small></a>` : ""}${projects
    .map((p) => {
      const d = p.production,
        waiting = !p.released && !d.review && !d.releaseReady && d.cooldown > 0;
      return `<a class="activity-card ${waiting ? "" : "ready"}" href="#project-${p.id}"><span class="tag">ALBUM · ${waiting ? "IN PROGRESS" : "ACTION READY"}</span><b>${esc(p.title)}</b><small>${esc(p.artistName)} · ${p.launchReview ? "Release results" : d.review ? "Review stage results" : d.releaseReady ? "Final review & release" : waiting ? d.cooldown + " week(s) to next step" : G.STAGES[d.stage].name} →</small><div class="progress"><span style="width:${d.stage * 20}%"></span></div></a>`;
    })
    .join(
      "",
    )}${tours.map((t) => `<button class="activity-card ready" data-action="openRoad"><span class="tag">TOUR · DAY ${t.day}/${t.plannedDays}</span><b>${esc(t.artistName)} / ${esc(t.title)}</b><small>Quality ${Math.round(t.quality)}/100 · net ${money(t.net)}<br>${state.event ? "Resolve current event first" : G.productionBlock(state) ? "Complete the album decision before advancing" : "Advance to the next scheduled activity"} · Open tour →</small><div class="progress"><span style="width:${Math.min(100, (t.day / t.plannedDays) * 100)}%"></span></div></button>`).join("")}${!projects.length && !tours.length && !state.event ? '<div class="empty">No active projects. Start an album in The studio or book a tour in The road.</div>' : ""}</div>`;
}
function render() {
  const s = state;
  $("stats").innerHTML = [
    ["Cash", money(s.cash)],
    ["Fame", s.fame],
    ["Reputation", s.reputation + "/100"],
    ["Roster", s.artists.length + " / " + G.slots(s)],
    ["Awards", s.awards],
  ]
    .map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`)
    .join("");
  $("date").textContent =
    `YEAR ${String(1 + Math.floor((s.week - 1) / 52)).padStart(2, "0")} / WEEK ${1 + ((s.week - 1) % 52)}${s.tours.some((t) => t.status === "active") ? " / DAY " + Math.min(7, s.event?.type === "tourDay" ? s.tourDayInWeek : s.tourDayInWeek + 1) : ""} · ${G.rankInfo(s).name}`;
  $("trend").textContent = `Trending: ${s.trend} · Weekly overhead: ${money(G.upkeep(s))}`;
  $("continueCareer").hidden = !(s.finished && s.cash >= 0 && s.week >= 53);
  $("advance").disabled = blocked() || G.productionBlock(s);
  $("advance").textContent = G.productionBlock(s)
    ? "Album decision required ↑"
    : state.tours.some((t) => t.status === "active")
      ? "Advance to next activity →"
      : "Advance one week →";
  $("goal").textContent = s.finished
    ? s.outcome
    : s.careerMode
      ? "Career mode · grow the label, protect artists, and finish the tours you book. " + rankLine()
      : `Breakout Label goal: survive year one · Fame ${s.fame}/180 · Awards ${s.awards}/1 · Releases ${s.albums.filter((p) => p.released).length}/6. ${rankLine()}`;
  $("event").innerHTML = s.event
    ? `<div class="event"><span class="tag">INDUSTRY MOMENT · TIME IS PAUSED</span><h2>${esc(s.event.title)}</h2><p>${esc(s.event.body)}</p><div class="options">${s.event.options.map((o, i) => `<button data-action="choose" data-id="${i}" ${disable(!G.eventOptionAvailable(s, o))}>${esc(o.label)}<small>${esc(o.hint)}${o.extension && s.albums.find((p) => p.id === s.event.album)?.salesWeeks >= 18 ? " Extension cap reached." : ""}${s.staff.includes("Public Relations") && o.trust < 0 ? " PR staff reduces the immediate trust loss." : ""}</small></button>`).join("")}</div></div>`
    : "";
  $("content").innerHTML = {
    studio,
    hq: headquarters,
    scout: scouting,
    staff,
    catalog,
    charts,
    road,
    journal,
    awards: annualAwards,
    finance,
  }[tab]();
  $("milestones").innerHTML = rankBanner() + milestoneBanner();
  $("activities").innerHTML = activityHub();
  $("production").innerHTML = productionPanels();
  animateRatings();
  updateAlbumQuote();
  updateTourQuote(true);
  animateTourMoney();
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.action === "openRoad") {
    tab = "road";
    render();
    $("active-tours").scrollIntoView?.({ behavior: "smooth", block: "start" });
    return;
  }
  if (b.dataset.action === "chartPage") {
    chartPage = Number(b.dataset.id);
    render();
    return;
  }
  if (b.dataset.action === "skipReveal") {
    finishReveal();
    return;
  }
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    render();
    return;
  }
  if (b.dataset.action && hqClick(b)) return;
  let id = Number(b.dataset.id);
  if (b.dataset.action)
    act(() => {
      switch (b.dataset.action) {
        case "awardEntry":
          G.enterAwards(
            state,
            Number(b.dataset.year),
            b.dataset.genre,
            $("award-" + roleKey(b.dataset.genre)).value,
          );
          break;
        case "stage":
          G.decideStage(state, id, Number(b.dataset.option));
          break;
        case "continue":
          G.continueProduction(state, id);
          break;
        case "reshuffle":
          state.albums.find((p) => p.id === id).title =
            $("release-title-" + id)
              .value.trim()
              .slice(0, 45) || state.albums.find((p) => p.id === id).title;
          G.reshuffle(state, id, Number($("reshuffle-" + id).value));
          break;
        case "ackShuffle":
          G.acknowledgeReshuffle(state, id);
          break;
        case "release":
          G.releaseAlbum(state, id, $("release-title-" + id).value, $("release-plan-" + id).value || "fans");
          break;
        case "ackLaunch":
          state.albums.find((p) => p.id === id).launchReview = false;
          break;
        case "cancelTour":
          G.cancelTour(state, id);
          break;
        case "scout":
          G.paidScout(state, id);
          break;
        case "drive":
          G.recruitmentDrive(state, b.dataset.role, Number($("drive-" + roleKey(b.dataset.role)).value));
          break;
        case "hire":
          G.hire(state, b.dataset.role, id);
          break;
        case "fire":
          G.fire(state, b.dataset.role);
          break;
        case "ackMilestone":
          G.acknowledgeMilestone(state, id);
          break;
        case "renew":
          G.renew(state, id, Number($("renew-" + id).value));
          break;
        case "sign":
          G.sign(state, id, Number($("sign-term-" + id).value) || 3);
          break;
        case "build":
          G.build(state, id);
          break;
        case "train":
          G.train(state, id);
          break;
        case "choose":
          G.choose(state, id);
          break;
        case "leave":
          if (
            confirm(
              "Release this artist? An unfinished contract costs 3 label reputation; completed contracts have no penalty.",
            )
          )
            G.releaseArtist(state, id);
          break;
      }
    });
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "tourForm") {
    e.preventDefault();
    act(() => G.startTour(state, readTourPlan()));
    return;
  }
  if (e.target.id !== "albumForm") return;
  e.preventDefault();
  act(() =>
    G.record(state, {
      artistId: $("artist").value,
      boothId: $("booth").value,
      genre: $("genre").value,
      audience: $("audience").value,
      budget: $("budget").value,
      title: $("title").value,
      addOns: selectedAddons(),
      themes: selectedThemes(),
    }),
  );
});
document.addEventListener("change", (e) => {
  if (e.target.id === "chartFilter") {
    chartFilter = e.target.value;
    chartPage = 0;
    render();
    return;
  }
  if (e.target.id === "chartGenre") {
    chartGenre = e.target.value;
    chartPage = 0;
    render();
    return;
  }
  if (e.target.id === "wireCompany") {
    wireCompany = e.target.value;
    render();
    return;
  }
  if (e.target.id === "awardYear") {
    awardViewYear = Number(e.target.value);
    render();
    return;
  }
  if (e.target.id === "artist") {
    let a = state.artists.find((a) => a.id === Number(e.target.value));
    if (a) {
      $("genre").value = a.genre;
      $("audience").value = a.audience;
    }
  }
  if (
    e.target.name === "albumAddon" ||
    ["artist", "budget", "genre", "theme1", "theme2"].includes(e.target.id)
  )
    updateAlbumQuote();
  if (e.target.id.startsWith("tour-"))
    updateTourQuote(e.target.id === "tour-album" || e.target.id === "tour-mode");
  if (e.target.id.startsWith("release-plan-")) {
    const p = state.albums.find((p) => "release-plan-" + p.id === e.target.id);
    if (p && !p.released) {
      p.releaseStrategy = e.target.value;
      save();
    }
  }
  if (e.target.id.startsWith("release-title-")) {
    const p = state.albums.find((p) => "release-title-" + p.id === e.target.id);
    if (p && !p.released) {
      p.title = e.target.value.trim().slice(0, 45) || p.title;
      save();
    }
  }
});
$("continueCareer").onclick = () => act(() => G.continueCareer(state));
$("advance").onclick = () =>
  act(() =>
    state.tours.some((t) => t.status === "active") ? G.advanceTourToNextActivity(state) : G.advance(state),
  );
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  tone();
};
$("reset").onclick = () => {
  if (confirm("Start a new label? Export your save first if you want to keep this season."))
    act(() => {
      state = G.create();
      tab = "studio";
    });
};
$("testFunds").onclick = () =>
  act(() => {
    const revive = state.finished && state.cash < 0;
    state.cash += 100000;
    if (revive) {
      state.finished = false;
      state.outcome = null;
    }
    state.news.unshift(`W${state.week}: Testing grant +$100,000.`);
  });
$("export").onclick = () => {
  let url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })),
    a = document.createElement("a");
  a.href = url;
  a.download = "goat-records-week-" + state.week + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
function validSave(s) {
  return (
    s &&
    s.version === 1 &&
    Number.isFinite(s.cash) &&
    Number.isFinite(s.fame) &&
    Number.isInteger(s.week) &&
    s.week >= 1 &&
    s.week <= 100000 &&
    Number.isFinite(s.reputation) &&
    Number.isInteger(s.seed) &&
    Number.isInteger(s.nextId) &&
    Number.isInteger(s.awards) &&
    typeof s.finished === "boolean" &&
    G.GENRES.includes(s.trend) &&
    ["artists", "staff", "booths", "albums", "candidates", "effects", "news"].every((k) =>
      Array.isArray(s[k]),
    ) &&
    [...s.artists, ...s.candidates].every(
      (a) =>
        (a.inspiration === undefined ||
          (Number.isFinite(a.inspiration) && a.inspiration >= 0 && a.inspiration <= 100)) &&
        Number.isInteger(a.id) &&
        typeof a.name === "string" &&
        ["Youth", "Teen", "Adult"].includes(a.age) &&
        ["Youth", "Teen", "Adult"].includes(a.audience) &&
        G.GENRES.includes(a.genre) &&
        ["talent", "fans", "trust", "energy", "attention", "fee", "wage"].every((k) => Number.isFinite(a[k])),
    ) &&
    s.staff.every((r) => Object.hasOwn(G.ROLES, r)) &&
    s.booths.every((b) => G.BOOTHS[b.id] && Number.isFinite(b.hits) && Number.isFinite(b.prestige)) &&
    s.albums.every(
      (p) =>
        Number.isInteger(p.id) &&
        Number.isInteger(p.artist) &&
        G.BOOTHS[p.booth] &&
        typeof p.title === "string" &&
        typeof p.artistName === "string" &&
        Number.isFinite(p.remaining) &&
        Number.isFinite(p.total) &&
        (!p.released || Number.isFinite(p.quality)),
    ) &&
    s.news.every((n) => typeof n === "string") &&
    G.validLabelSave(s) &&
    (!s.event ||
      (typeof s.event.title === "string" &&
        typeof s.event.body === "string" &&
        (s.artists.some((a) => a.id === s.event.artist) ||
          (s.event.type === "album" && s.albums.some((p) => p.id === s.event.album)) ||
          s.event.type === "awards") &&
        Array.isArray(s.event.options) &&
        s.event.options.every((o) => typeof o.label === "string" && typeof o.hint === "string")))
  );
}
$("import").onchange = async (e) => {
  let f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 2e6) throw Error("Save file too large.");
    let parsed = JSON.parse(await f.text());
    if (!validSave(parsed)) throw Error("This is not a supported Goat Records save.");
    G.migrate(parsed);
    if (!validProductionSave(parsed) || !G.validManagementSave(parsed) || !G.validRoadSave(parsed))
      throw Error("Album production data is invalid.");
    if (confirm("Replace your current label with this save?"))
      act(() => {
        state = parsed;
      });
  } catch (err) {
    $("message").textContent = err.message;
  }
  e.target.value = "";
};
if (!validSave(state)) state = G.create();
G.migrate(state);
if (!validProductionSave(state) || !G.validManagementSave(state) || !G.validRoadSave(state))
  state = G.migrate(G.create());
save();
render();
