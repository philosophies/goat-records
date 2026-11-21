// Rival labels (CEO runs): who they are, how strong, where you stand, bids for their artists and buyouts.
"use strict";

function rivalsPanel() {
  const rivals = G.rivalsInfo?.(state) || [],
    R = G.RIVAL_RULES,
    locked = blocked();
  if (!rivals.length) return '<div class="empty">No rival labels this run.</div>';
  const standing = (n) => (n <= R.feudAt ? "in a feud" : n < -10 ? "cold" : n > 10 ? "friendly" : "neutral");
  return rivals
    .map((r) => {
      const roster = r.roster
        .map((x, i) => {
          const q = x.quote;
          return `<li><span>${esc(x.name)}${x.from ? " <small>(left you)</small>" : ""}</span>${
            q.open
              ? `<button data-action="rivalBid" data-rival="${r.id}" data-index="${i}" ${disable(locked || state.cash < q.cost)}>Bid · ${money(q.cost)} · ${Math.round(q.chance * 100)}%</button>`
              : ""
          }</li>`;
        })
        .join("");
      const buy = r.buy.open
        ? r.buy.weak
          ? `<button data-action="rivalBuy" data-rival="${r.id}" ${disable(locked || state.cash < r.buy.price)}>Buy ${esc(r.name)} · ${money(r.buy.price)}</button>`
          : `<small class="muted">Too strong to buy (needs strength under ${R.buy.below}).</small>`
        : "";
      const last = r.releases.at(-1);
      return `<article class="card rival-card${r.feud ? " feud" : ""}"><span class="tag">${esc(r.personality.toUpperCase())} · ${esc(r.genre.toUpperCase())}</span><h3>${esc(r.name)}</h3><p class="muted">${esc(r.ceo)} · ${esc(r.text)}</p><div class="metrics"><span>Strength <b>${r.strength}</b></span><span>Your standing <b>${r.standing > 0 ? "+" : ""}${r.standing}</b> <small>${standing(r.standing)}</small></span></div>${last ? `<p class="muted">Latest: ${esc(last.title)}, week ${last.week}.</p>` : ""}${r.feud ? `<p class="warn">In a feud: both labels sell ${Math.round(R.feudSales * 100)}% more, and rows can spill over.</p>` : ""}<h4>Their artists</h4><ul class="rival-roster">${roster || "<li>None left.</li>"}</ul>${r.roster.length && !r.roster[0].quote.open ? `<small class="muted">Bidding for their artists opens at phase ${R.bid.phase}.</small>` : ""}${buy}</article>`;
    })
    .join("");
}

GoatUI.registerPanel({ id: "rivals", label: "Rivals", order: 60, render: rivalsPanel });
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "rivalBid") act(() => G.bidForRival(state, d.rival, Number(d.index)));
  else if (d.action === "rivalBuy") act(() => G.buyRival(state, d.rival));
  else return false;
  return true;
});
