// The starter checklist (CEO runs): a card in the side ticker while it is on, and its click handlers.
"use strict";

function starterCard() {
  const goals = state.company ? G.starterGoals?.(state) : null;
  if (!goals) return "";
  const reward = (r) =>
    [r.cash && money(r.cash), r.fame && `${r.fame} fame`, r.reputation && `${r.reputation} reputation`]
      .filter(Boolean)
      .join(" + ");
  return `<div class="notice starter" data-ticker><b>Getting started</b><ul>${goals
    .map(
      (g) =>
        `<li class="${g.done ? "done" : ""}"><span>${g.done ? "✓" : "○"}</span> ${esc(g.text)} <small>${reward(g.reward)}</small></li>`,
    )
    .join(
      "",
    )}</ul>${freeLine()}<button class="link" data-action="starter" data-on="no">Skip the checklist</button></div>`;
}
/** What the checklist still pays for, so the goals can be done without a loan. */
function freeLine() {
  const f = G.starterFree(state);
  const parts = [
    f.signing && "your first signing",
    f.album && `your first album's budget (up to ${money(G.STARTER.freeAlbumBudget)})`,
  ].filter(Boolean);
  return parts.length
    ? `<p class="muted">On the house while you get started: ${parts.join(" and ")}.</p>`
    : "";
}

GoatUI.albumForm.push({
  quote: () =>
    state.company && G.starterFree(state).album
      ? `<p class="muted starter-free">The starter checklist pays this album's base budget (up to ${money(G.STARTER.freeAlbumBudget)}); add-ons and location rent are still paid.</p>`
      : "",
});

GoatUI.banners.push({ render: starterCard });
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action !== "starter") return false;
  act(() => G.setStarter(state, d.on === "yes"));
  return true;
});
