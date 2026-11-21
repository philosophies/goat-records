// The listening party block on the final album review (CEO runs).
"use strict";

function partyReport(p, r) {
  const rows = (list, label) =>
    `<div class="party-col"><small>${label}</small>${list
      .map(
        (x) =>
          `<div class="party-row s-${x.score >= 65 ? "up" : x.score >= 50 ? "mid" : "down"}"><span>${esc(x.name || x.area)}</span><b>${esc(x.sentiment)}</b></div>`,
      )
      .join("")}</div>`;
  return `<div class="party-report">${rows(r.audiences, "By audience")}${rows(r.areas, "By area")}</div>${r.leaked ? `<p class="warn">Someone filmed the playback: the album leaked. The risk at this party was ${Math.round((r.leakRisk ?? 0) * 100)}%.</p>` : ""}`;
}
function partyBlock(p) {
  if (!state.company || p.released) return "";
  const q = G.partyQuote(state, p.id),
    last = p.party?.reports?.at(-1),
    locked = blocked();
  let body = `<p class="muted">Play the album to a room of fans before it goes out. ${q.count ? `${q.count} of ${G.PARTY.max} held.` : ""} Leak risk ${Math.round(q.leak * 100)}%.</p><button data-action="holdParty" data-id="${p.id}" ${disable(locked || !q.available)}>Hold a listening party · ${money(q.cost)}</button>${q.available || q.count >= G.PARTY.max || p.party?.pending ? "" : `<small class="muted">${esc(q.reason)}</small>`}`;
  if (last && p.party.pending) {
    const weak = p.production.results[last.weakest];
    body = `${partyReport(p, last)}<p>The room was coldest on <b>${esc(weak.area)}</b>.</p><div class="actions"><button class="primary" data-action="partyChoice" data-choice="rework" data-id="${p.id}" ${disable(locked || state.cash < G.reworkCost(state, p))}>Rework ${esc(weak.area)} · ${money(G.reworkCost(state, p))} · +${G.PARTY.rework.weeks} week</button><button data-action="partyChoice" data-choice="single" data-id="${p.id}" ${disable(locked || p.party.single)}>Change the lead single</button><button data-action="partyChoice" data-choice="release" data-id="${p.id}" ${disable(locked)}>Keep it as it is</button></div>`;
  } else if (last) body = `${partyReport(p, last)}${body}`;
  return `<section class="party"><h3>Pre-release listening party${p.party?.pending ? " · feedback waiting" : ""}</h3>${body}</section>`;
}

GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "holdParty") act(() => G.holdParty(state, d.id));
  else if (d.action === "partyChoice") act(() => G.partyChoice(state, d.id, d.choice));
  else return false;
  return true;
});

const GoatParty = { block: partyBlock, report: partyReport };
