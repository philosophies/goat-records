// Interface for the promotion system: hot streaks, lead singles and ad campaigns.
// Registers with GoatUI (src/ui/registry.js) and uses the page helpers from app.js at render time.
"use strict";

const promoMult = (m) => "×" + (Math.round(m * 100) / 100).toFixed(2);
const promoWeeks = (n) => `${n} week${n === 1 ? "" : "s"}`;

/** One-line summary of what an artist's heat does right now. */
function promoHeatEffect(h) {
  return `+${G.heatStageBonus(h.level)} on every production stage · sales ${promoMult(G.heatSalesMult(h.level))} on every earning release`;
}
function promoArtistBadge(a) {
  const h = G.heat(state, a.id);
  if (!h.level) return "";
  return `<div class="promo-hot" role="status"><b>ON FIRE · LEVEL ${h.level}/${G.HEAT.maxLevel} · ${promoWeeks(h.weeksLeft)} left</b><small>${promoHeatEffect(h)}</small><small>${h.reasons.map(esc).join(" · ")}</small></div>`;
}

/* ---------------- Lead single ---------------- */

function promoSingleRow(p) {
  const q = G.singleQuote(state, p.id),
    x = q.released;
  if (x)
    return `<div class="promo-row done"><b>Lead single out · ${esc(x.reception)} reception</b><small>Released week ${x.week}. At launch: Fan response +${x.fanResponse + x.receptionValue}, Market impact +${x.market + x.receptionValue}, sales ${promoMult(G.SINGLE.launchMult)} for the first ${G.SINGLE.launchWeeks} earning weeks.</small></div>`;
  const effect = `Fans +${q.fans}, attention +${q.attention} now. At launch: Fan response +${q.fanResponse}, Market impact +${q.market} (±reception), sales ${promoMult(q.launchMult)} for the first ${q.launchWeeks} earning weeks.`;
  if (!p.production || p.production.stage < G.SINGLE.minStage)
    return `<div class="promo-row locked"><b>Lead single · unlocks after Recording</b><small>${q.tier} single ${money(q.cost)}. ${effect}</small></div>`;
  return `<div class="promo-row"><div><b>Lead single · ${q.tier} · ${money(q.cost)}</b><small>${effect} One per album, before release.</small></div><button data-action="promoSingle" data-album="${p.id}" ${disable(blocked() || !q.available)}>Release single · ${money(q.cost)}</button></div>`;
}
function promoProductionRows(p) {
  const h = G.heat(state, p.artist);
  const hot = h.level
    ? `<div class="promo-row hot"><b>On fire · ${promoWeeks(h.weeksLeft)} left · +${G.heatStageBonus(h.level)} on every stage</b><small>${esc(p.artistName)}: ${h.reasons.map(esc).join(" · ")}. Stages decided while the streak lasts get the bonus.</small></div>`
    : "";
  return `<div class="promo-rows">${hot}${promoSingleRow(p)}</div>`;
}

/* ---------------- Ads ---------------- */

function promoAdLabel(ad) {
  const extras = [
    ad.fans && `fans +${ad.fans}`,
    ad.attention && `attention +${ad.attention}`,
    ad.reputation && `label reputation +${ad.reputation}`,
  ].filter(Boolean);
  return `sales ${promoMult(ad.mult)} for ${promoWeeks(ad.weeks)}${extras.length ? " · " + extras.join(", ") : ""}`;
}
function promoAdQuoteText(p, adId) {
  const q = G.adQuote(state, p.id, adId);
  if (!q.ad) return "";
  const est =
    q.estimate !== undefined
      ? ` Estimated extra label income about ${money(q.estimate)} from last week's sales.`
      : " An estimate appears after the first sales week.";
  return `${esc(q.ad.name)}: ${money(q.cost)} · ${promoAdLabel(q.ad)}${q.weeks < q.ad.weeks ? ` (only ${promoWeeks(q.weeks)} left in the run)` : ""}.${est}${q.available ? "" : " " + esc(q.reason)}`;
}
function promoActiveAdText(x) {
  const ad = G.ADS.find((a) => a.id === x.adId);
  return `${esc(ad.name)} · ${promoMult(x.mult)} · weeks ${x.start}–${x.until}${x.start > state.week ? " · starts next week" : ` · ${promoWeeks(x.until - state.week + 1)} left`}`;
}
const promoAdPicks = {};
function promoAdRow(p) {
  if (!p.released) return "";
  const active = G.activeAd(state, p.id),
    earning = p.age < p.salesWeeks;
  if (active)
    return `<div class="promo-row ad active"><b>Ad running</b><small>${promoActiveAdText(active)}</small></div>`;
  if (!earning) return "";
  // Default to the cheapest ad; a choice the player made stays selected across redraws.
  const rank = G.rank(state),
    open = G.ADS.filter((a) => a.rank <= rank),
    first = open.find((a) => a.id === promoAdPicks[p.id]) || open[0];
  return `<div class="promo-row ad"><label>Ad campaign<select id="promo-ad-${p.id}" data-promo-ad="${p.id}">${G.ADS.map(
    (a) =>
      `<option value="${a.id}" ${a.rank > rank ? "disabled" : ""} ${a === first ? "selected" : ""}>${esc(a.name)} · ${a.rank > rank ? "rank " + a.rank : money(G.adCost(state, a))}</option>`,
  ).join(
    "",
  )}</select></label><button data-action="promoAd" data-album="${p.id}" ${disable(blocked())}>Buy ad</button><small id="promo-ad-quote-${p.id}">${promoAdQuoteText(p, first.id)}</small></div>`;
}

/* ---------------- Promotion screen ---------------- */

function promoHowItWorks() {
  const t = G.HEAT.triggers;
  return `<article class="card promo-explainer"><span class="tag">HOW HEAT WORKS</span><h3>Artists on fire</h3><p>An artist catches fire after a hit release (quality ${G.HEAT.hitQuality}+), a Top ${G.HEAT.topRank} chart week or an award win. While on fire, each heat level adds <b>+${G.HEAT.stagePerLevel}</b> to every production stage they record and <b>${promoMult(1 + G.HEAT.salesPerLevel)}</b> to the weekly sales of all their earning albums.</p><ul class="promo-list"><li>${esc(t.hit.name)}: +${t.hit.levels} level, ${t.hit.weeks} weeks</li><li>${esc(t.top10.name)}: +${t.top10.levels} level, ${t.top10.weeks} weeks (once per album)</li><li>${esc(t.award.name)}: +${t.award.levels} levels, ${t.award.weeks} weeks</li></ul><p>A new spark adds its levels and resets the timer to at least its weeks, up to level ${G.HEAT.maxLevel} and ${G.HEAT.maxWeeks} weeks. The timer counts down at every weekly settlement; at zero the streak is over.</p><p>Heat, a lead single and an ad multiply together, but one album's promotion boost never goes above <b>${promoMult(G.PROMOTION_CAP)}</b>.</p></article>`;
}
function promoHotList() {
  const hot = G.hotArtists(state);
  if (!hot.length)
    return '<div class="empty">Nobody is on fire yet. Release a hit, crack the Top 10 or win an award.</div>';
  return `<div class="grid">${hot
    .map(
      (h) =>
        `<article class="card promo-hot-card" style="--heat:${h.level}"><span class="tag">ON FIRE · LEVEL ${h.level}/${G.HEAT.maxLevel}</span><h3>${esc(h.artist.name)}</h3><p><b>${promoWeeks(h.weeksLeft)} left</b><br>${promoHeatEffect(h)}</p><ul class="promo-list">${h.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><div class="promo-meter" aria-hidden="true"><span style="width:${(h.weeksLeft / G.HEAT.maxWeeks) * 100}%"></span></div></article>`,
    )
    .join("")}</div>`;
}
function promoSingleList() {
  const list = state.albums.filter((p) => !p.released && p.production);
  if (!list.length) return '<p class="muted">No albums in production.</p>';
  return list
    .map(
      (p) =>
        `<div class="card promo-album"><h3>${esc(p.title)}</h3><p>${esc(p.artistName)} · ${p.production.stage}/5 stages</p>${promoSingleRow(p)}</div>`,
    )
    .join("");
}
function promoAdList() {
  const list = state.albums.filter((p) => p.released && (p.age < p.salesWeeks || G.activeAd(state, p.id)));
  if (!list.length) return '<p class="muted">No albums in an earning run.</p>';
  return list
    .map(
      (p) =>
        `<div class="card promo-album"><h3>${esc(p.title)}</h3><p>${esc(p.artistName)} · ${Math.max(0, p.salesWeeks - p.age)} earning weeks left · last week ${money(p.lastNetIncome || 0)}${(() => {
          const m = G.promotionParts(state, p);
          return m.parts.length ? ` · promotion ${promoMult(m.total)}${m.capped ? " (capped)" : ""}` : "";
        })()}</p>${promoAdRow(p)}</div>`,
    )
    .join("");
}
function promoAdTable() {
  const rank = G.rank(state);
  return `<div class="promo-table"><table><thead><tr><th>Ad</th><th>Rank</th><th>Cost now</th><th>Effect</th></tr></thead><tbody>${G.ADS.map(
    (a) =>
      `<tr class="${a.rank > rank ? "locked" : ""}"><th>${esc(a.name)}</th><td>${a.rank > rank ? `Locked · rank ${a.rank} (${esc(G.RANKS[a.rank - 1].name)})` : `Rank ${a.rank} ✓`}</td><td>${money(G.adCost(state, a))}</td><td>${promoAdLabel(a)}</td></tr>`,
  ).join(
    "",
  )}</tbody></table></div><p class="muted">Ads are for released albums still in their earning run, one at a time per album. The boost starts with the next weekly settlement. Prices rise with label fame. An ad pays back when the album is already selling well; on a slow seller it mostly buys chart attention.</p>`;
}
function promotionScreen() {
  const ads = state.promotion.ads.filter((x) => x.until >= state.week).length;
  return `<div class="sectionhead"><h2>Promotion</h2><span class="muted">${G.hotArtists(state).length} on fire · ${ads} ad${ads === 1 ? "" : "s"} running</span></div>${promoHowItWorks()}<h2>Hot artists</h2>${promoHotList()}<h2>Lead singles</h2><p class="muted">Once Recording is done, an album can put out one lead single before release. It brings fans and attention now and a better launch later.</p>${promoSingleList()}<h2>Ad campaigns</h2>${promoAdList()}<h2>Ad types</h2>${promoAdTable()}`;
}

function promoHud() {
  const n = G.hotArtists(state).length;
  return n
    ? `<button class="promo-chip" data-tab="promotion" title="See the billboard for details">${n} artist${n === 1 ? "" : "s"} on fire</button>`
    : "";
}
function promoClick(b) {
  if (b.dataset.action === "promoSingle") {
    act(() => G.releaseSingle(state, Number(b.dataset.album)));
    return true;
  }
  if (b.dataset.action === "promoAd") {
    const id = Number(b.dataset.album);
    act(() => G.buyAd(state, id, $("promo-ad-" + id).value));
    return true;
  }
  return false;
}
function promoChange(e) {
  const id = e.target?.dataset?.promoAd;
  if (!id) return false;
  const p = state.albums.find((x) => x.id === Number(id)),
    out = $("promo-ad-quote-" + id);
  if (p) promoAdPicks[p.id] = e.target.value;
  if (p && out) out.innerHTML = promoAdQuoteText(p, e.target.value);
  return true;
}

GoatUI.registerPanel({ id: "promotion", label: "Promotion", order: 45, render: promotionScreen });
GoatUI.productionPanel.push({ render: promoProductionRows });
GoatUI.catalogCard.push({ render: promoAdRow });
GoatUI.artistCard.push({ render: promoArtistBadge });
GoatUI.hud.push({ render: promoHud });
GoatUI.click.push(promoClick);
GoatUI.change.push(promoChange);
