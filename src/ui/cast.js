// Authored people (CEO runs): backstories on cards and the artist's look and story on their panel.
"use strict";

/** A person's backstory as a short paragraph, or "" for generated people. */
function castBlurb(x, tag = "p") {
  const c = x && G.castEntry?.(x.castId);
  return c ? `<${tag} class="backstory">${esc(c.backstory)}</${tag}>` : "";
}
/** The last few story beats for a character key ("head:3", "director:1", "company"), or "". */
function storyLines(key, n = 3) {
  const log = state.company ? G.storyLog?.(state, key) || [] : [];
  if (!log.length) return "";
  return `<ul class="story-log">${log
    .slice(-n)
    .reverse()
    .map((x) => `<li><small>Week ${x.week}</small> ${esc(x.title)} · <i>${esc(x.choice)}</i></li>`)
    .join("")}</ul>`;
}
/** The artist panel card: how they look, where they come from, the story so far. */
function castCard(a) {
  if (!state.company) return "";
  const c = G.castEntry?.(a.castId),
    log = G.storyLog?.(state, a) || [];
  if (!c && !log.length) return "";
  const past = log.length
    ? `<h4>Story so far</h4><ul class="story-log">${log
        .slice(-5)
        .reverse()
        .map((x) => `<li><small>Week ${x.week}</small> ${esc(x.title)} · <i>${esc(x.choice)}</i></li>`)
        .join("")}</ul>`
    : "";
  const intro = c
    ? `<p>${esc(c.backstory)}</p><p class="muted"><b>Look:</b> ${esc(c.look.text)}</p><p class="muted"><b>Watch for:</b> ${esc(c.arc.hook)}</p>`
    : "";
  return `<article class="card cast-card" style="--cast:${c?.look.color || "var(--gold, #e3b23c)"}"><span class="tag">THEIR STORY</span>${intro}${past}</article>`;
}

GoatUI.artistCard.push({ render: castCard });
