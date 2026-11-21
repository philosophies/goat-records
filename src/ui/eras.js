// The market (CEO runs): the music era now, what it does to each stream, and the next change once announced.
"use strict";

function marketPanel() {
  const info = G.eraInfo?.(state);
  if (!info) return '<div class="empty">No market eras in this run.</div>';
  const R = G.ERA_RULES,
    rows = [
      ["sales", "Album sales"],
      ["singles", "Lead single lift"],
      ["touring", "Tour tickets"],
      ["licensing", "Sync and publishing"],
      ["catalog", "Streaming and catalog"],
      ["marketing", "Ad prices"],
    ];
  const table = (era, live) =>
    `<table class="era-table"><tbody>${rows
      .map(([k, name]) => {
        const f = live ? info.factor(k) : era[k];
        return `<tr><td>${name}</td><td class="${k === "marketing" ? (f > 1 ? "down" : f < 1 ? "up" : "") : f > 1 ? "up" : f < 1 ? "down" : ""}">×${(Math.round(f * 100) / 100).toFixed(2)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  const years = (w) => `year ${G.operatingYear(w)}`;
  const next = info.next
    ? `<article class="card"><span class="tag">COMING IN WEEK ${info.next.week} · ${years(info.next.week).toUpperCase()}</span><h3>${esc(info.next.era.name)}</h3><p class="muted">${esc(info.next.era.text)}</p>${table(info.next.era, false)}</article>`
    : info.index + 1 < G.ERAS.length
      ? `<p class="muted">The next change is announced ${R.announce} weeks before it comes.</p>`
      : "";
  return `<article class="card"><span class="tag">THE ERA NOW · SINCE ${years(info.since).toUpperCase()}</span><h3>${esc(info.era.name)}</h3><p class="muted">${esc(info.era.text)}</p>${info.invested ? `<p class="ok">Invested early: ${esc(info.era.strongest)} +${Math.round(R.invest.bonus * 100)}% until week ${info.since + R.invest.weeks}.</p>` : ""}${table(info.era, true)}</article>${next}`;
}

GoatUI.registerPanel({ id: "market", label: "The market", order: 61, render: marketPanel });
