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

/* ---------------- The mentor ---------------- */
// Augie Delmonte walks a new CEO through the checklist: talks over the lot that hold the clock,
// pointers at the top of the panel they are about, notes on the first album, a line in the ticker
// and a glow on the button that matters.

/** The panel a beat's button opens; "artist" means the first artist's panel. */
function mentorTab(go) {
  if (!go) return "";
  const [place, sec] = go.split("~");
  if (place !== "artist") return go;
  const a = state.artists[0];
  return a ? `artist:${a.id}${sec ? "~" + sec : ""}` : "desk~sec-scout";
}
function mentorFace() {
  return `<span class="mentor-face" aria-hidden="true">AD</span>`;
}
function mentorHead(beat) {
  return `<div class="mentor-head">${mentorFace()}<div><b>${esc(G.MENTOR.name)}</b><small>${esc(G.MENTOR.label)} · step ${beat.step} of ${beat.of}</small></div></div>`;
}
/** A talk not yet answered, as a card over the lot. */
function mentorTalk() {
  const beat = state.company && G.mentorBeat?.(state);
  mentorGlow(beat);
  if (!beat || beat.kind !== "talk" || beat.seen) return "";
  const go = beat.go
    ? `<button class="primary" data-action="mentor" data-beat="${beat.id}" data-go="${esc(mentorTab(beat.go))}">${esc(beat.goLabel)}</button><button data-action="mentor" data-beat="${beat.id}">Got it</button>`
    : `<button class="primary" data-action="mentor" data-beat="${beat.id}">${esc(beat.goLabel || "Got it")}</button>`;
  const leave =
    beat.id === "farewell"
      ? ""
      : `<button class="link" data-action="mentorOff">Let me play on my own</button>`;
  return `<div class="notice mentor-talk mentor-${beat.id}">${mentorHead(beat)}<h3>${esc(beat.title)}</h3>${beat.text.map((p) => `<p>${esc(p)}</p>`).join("")}<div class="actions">${go}${leave}</div></div>`;
}
/** The current step in the side ticker, with a way back to the panel it is about. */
function mentorLine() {
  const beat = state.company && G.mentorBeat?.(state);
  if (!beat || (beat.kind === "talk" && !beat.seen)) return "";
  const place = beat.place || beat.go?.split("~")[0],
    go = place && mentorTab(place === "artist" ? "artist~sec-record" : place);
  return `<div class="notice mentor-line" data-ticker>${mentorFace()}<span><b>${esc(G.MENTOR.name.split(" ")[0])}:</b> ${esc(beat.title)}</span>${go ? `<button class="link" data-tab="${esc(go)}">Show me</button>` : ""}</div>`;
}
/** Pointers at the top of the panel the current step is about. */
function mentorPointers(placeId) {
  const beat = state.company && G.mentorBeat?.(state);
  if (!beat || beat.kind !== "pointers") return "";
  const here = beat.place === "artist" ? String(placeId).startsWith("artist:") : placeId === beat.place;
  if (!here) return "";
  return `<aside class="mentor-note">${mentorHead(beat)}<b>${esc(beat.title)}</b><ul>${beat.here.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></aside>`;
}
/** A note on the first album while it is being made and reviewed. */
function mentorAlbumNote(p) {
  const beat = state.company && G.mentorBeat?.(state);
  if (!beat || beat.kind !== "note" || beat.seen) return "";
  const firstId = Math.min(...state.albums.map((x) => x.id));
  if (p.id !== firstId) return "";
  return `<aside class="mentor-note">${mentorHead(beat)}<b>${esc(beat.title)}</b>${beat.text.map((x) => `<p>${esc(x)}</p>`).join("")}<button class="link" data-action="mentor" data-beat="${beat.id}">Got it</button></aside>`;
}
/** Marks the page so the button that matters now glows (see styles/dynasty.css). */
function mentorGlow(beat) {
  if (typeof document === "undefined" || !document.body?.dataset) return;
  if (beat) document.body.dataset.mentor = beat.id;
  else delete document.body.dataset.mentor;
}

// After the game's own news: a phase card or a rank-up comes before the mentor's next talk.
GoatUI.banners.push({ render: mentorTalk, order: 90 }, { render: mentorLine, order: 90 });
GoatUI.sheetNotes.push({ render: mentorPointers });
GoatUI.productionNotes.push({ render: mentorAlbumNote });
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "mentorOff") {
    act(() => G.setMentor(state, false));
    return true;
  }
  if (d.action !== "mentor") return false;
  act(() => G.mentorSeen(state, d.beat));
  if (d.go) openPanel(d.go);
  return true;
});
