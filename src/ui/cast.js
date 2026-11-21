// Authored people (CEO runs): backstories on cards and the artist's look and story on their panel.
"use strict";

/** A person's backstory as a short paragraph, or "" for generated people. */
function castBlurb(x, tag = "p") {
  const c = x && G.castEntry?.(x.castId);
  return c ? `<${tag} class="backstory">${esc(c.backstory)}</${tag}>` : "";
}
/** The artist panel card: how they look, where they come from, the story they carry. */
function castCard(a) {
  const c = G.castEntry?.(a.castId);
  if (!c) return "";
  return `<article class="card cast-card" style="--cast:${c.look.color}"><span class="tag">THEIR STORY</span><p>${esc(c.backstory)}</p><p class="muted"><b>Look:</b> ${esc(c.look.text)}</p><p class="muted"><b>Watch for:</b> ${esc(c.arc.hook)}</p></article>`;
}

GoatUI.artistCard.push({ render: castCard });
