// The Vault (CEO runs): the catalog by status, its weekly royalties, money still coming in, and offers.
"use strict";

function vaultPanel() {
  const v = G.vaultInfo?.(state);
  if (!v) return '<div class="empty">No vault in this run.</div>';
  const locked = blocked(),
    R = G.CATALOG_ROYALTIES,
    year = String(G.operatingYear(state.week));
  const offers = v.offers.length
    ? v.offers
        .map(
          (o) =>
            `<article class="card vault-offer"><span class="tag">${esc(OFFER_TAGS[o.kind])} · LAPSES WEEK ${o.expires}</span><h3>${esc(o.title)}</h3><p class="muted">${esc(o.body)}</p><p>${esc(o.hint)}</p><div class="row"><button class="primary" data-action="vaultAccept" data-id="${o.id}" ${disable(locked || state.cash < (o.cost || 0))}>${o.kind === "sample" ? "Clear it" : o.cost ? "Go ahead" : "Accept"}</button><button data-action="vaultDecline" data-id="${o.id}" ${disable(locked)}>${o.kind === "sample" ? "Refuse" : "Pass"}</button></div></article>`,
        )
        .join("")
    : '<div class="empty">No offers right now. They arrive as albums age into the catalog.</div>';
  const flows = v.flows.length
    ? `<h4>Still paying</h4><ul class="vault-flows">${v.flows
        .map((f) => {
          const p = state.albums.find((x) => x.id === f.album);
          return `<li><span>${esc(FLOW_NAMES[f.kind])}${p ? ` · ${esc(p.title)}` : ""}</span><span>${money(f.perWeek)}/week until week ${f.until}</span></li>`;
        })
        .join("")}</ul>`
    : "";
  const shelf = v.rows.length
    ? `<table class="vault-table"><thead><tr><th>Album</th><th>Status</th><th>Royalty</th></tr></thead><tbody>${v.rows
        .slice(0, 12)
        .map(
          (r) =>
            `<tr><td>${esc(r.p.title)} <small>${esc(r.p.artistName || "")}</small></td><td><span class="status-${r.status}">${r.status}</span></td><td>${r.weekly ? money(r.weekly) + "/wk" : "—"}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table>${v.rows.length > 12 ? `<small class="muted">And ${v.rows.length - 12} more.</small>` : ""}`
    : '<div class="empty">Released albums will line these shelves.</div>';
  return `<p class="place-intro">${v.counts.fresh} fresh · ${v.counts.catalog} catalog · ${v.counts.classic} classic. ${state.company.phase >= R.phase ? `Royalties ${money(v.weekly)} a week.` : `Royalties start at phase ${R.phase}.`} ${money(v.earned[year] || 0)} earned this year.</p><h4>Offers</h4>${offers}${flows}<h4>The shelves</h4>${shelf}`;
}
const OFFER_TAGS = {
  deluxe: "DELUXE EDITION",
  reissue: "ANNIVERSARY",
  sample: "SAMPLE REQUEST",
  sync: "SYNC LICENSE",
  fanMail: "FAN MAIL",
  hits: "GREATEST HITS",
};
const FLOW_NAMES = {
  deluxe: "Deluxe edition",
  reissue: "Reissue",
  sample: "Sample royalty",
  hits: "Greatest hits",
};

GoatUI.registerPanel({ id: "vault", label: "The vault", order: 62, render: vaultPanel });
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "vaultAccept") act(() => G.answerOffer(state, d.id, true));
  else if (d.action === "vaultDecline") act(() => G.answerOffer(state, d.id, false));
  else return false;
  return true;
});
