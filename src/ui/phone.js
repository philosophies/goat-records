// The CEO phone (CEO runs): the one menu. A corner button with a badge of things that need you
// opens five apps: Inbox, Calendar, Contacts, Wallet and Settings. P opens it; Esc closes it.
"use strict";

const PHONE_APPS = [
  {
    id: "inbox",
    name: "Inbox",
    icon: ["kkkkkkkk", "kwwwwwwk", "kkwwwwkk", "kwkwwkwk", "kwwkkwwk", "kwwwwwwk", "kkkkkkkk"],
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: ["kaakkaak", "kkkkkkkk", "kwwwwwwk", "kwkwkwwk", "kwwwkwkk", "kwwwwwwk", "kkkkkkkk"],
  },
  {
    id: "contacts",
    name: "Contacts",
    icon: ["..kkkk..", ".kwwwwk.", ".kwwwwk.", "..kkkk..", ".kaaaak.", "kaaaaaak", "kkkkkkkk"],
  },
  {
    id: "wallet",
    name: "Wallet",
    icon: ["kkkkkkkk", "kyyyyyyk", "kyyyykkk", "kyyyykyk", "kyyyykkk", "kyyyyyyk", "kkkkkkkk"],
  },
  {
    id: "settings",
    name: "Settings",
    icon: ["...kk...", ".kkwwkk.", ".kwkkwk.", "kwk..kwk", ".kwkkwk.", ".kkwwkk.", "...kk..."],
  },
];

/** Everything waiting for the CEO, newest worries first: [{ kind, title, text, button }]. */
function inboxItems() {
  const items = [];
  if (state.event)
    items.push({
      kind: "Decision",
      title: state.event.title,
      text: state.event.body,
      button: '<button data-action="showModal">Decide</button>',
    });
  for (const e of state.eventQueue || [])
    items.push({ kind: "Up next", title: e.title, text: e.body, button: "" });
  for (const p of state.albums) {
    const d = p.production;
    let why = "";
    if (p.launchReview) why = "Release results are in";
    else if (!p.released && d?.review) why = "Stage results are ready";
    else if (!p.released && d?.releaseReady) why = "Ready to release";
    else if (!p.released && d && d.cooldown === 0) why = "A production decision is waiting";
    if (why)
      items.push({
        kind: "Album",
        title: p.title,
        text: `${p.artistName} · ${why}.`,
        button: '<button data-action="showModal">Open</button>',
      });
  }
  for (const n of state.notifications || [])
    items.push({
      kind: "News",
      title: n.title,
      text: n.body,
      button: '<button data-action="closePanel">See it</button>',
    });
  if ((state.rankUps || []).some((r) => !r.seen))
    items.push({
      kind: "Milestone",
      title: "The label moved up",
      text: "A new rank is waiting to be seen.",
      button: '<button data-action="closePanel">See it</button>',
    });
  return items;
}
function phoneBadge() {
  return inboxItems().filter((x) => x.kind !== "Up next").length;
}

function phoneHome() {
  return `<div class="phone"><div class="phone-apps">${PHONE_APPS.map(
    (a) =>
      `<button class="phone-app" data-tab="phone:${a.id}">${pixelSvg(a.icon, "#f3d25b", 40)}<span>${a.name}</span>${a.id === "inbox" && phoneBadge() ? `<b class="phone-badge">${phoneBadge()}</b>` : ""}</button>`,
  ).join("")}</div></div>`;
}
function phoneInbox() {
  const items = inboxItems();
  return `<div class="phone"><button class="phone-back" data-tab="phone">‹ Home</button>${
    items.length
      ? `<ul class="inbox">${items
          .map(
            (x) =>
              `<li class="inbox-item"><span class="tag">${esc(x.kind.toUpperCase())}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p>${x.button}</li>`,
          )
          .join("")}</ul>`
      : '<div class="empty">Nothing needs you right now.</div>'
  }</div>`;
}
/** Apps the next update fills in say so, with the place that already holds the information. */
function phoneLater(name, where) {
  return `<div class="phone"><button class="phone-back" data-tab="phone">‹ Home</button><div class="empty">${esc(name)} arrives in a later build. For now, ${where}</div></div>`;
}

/** Sheets for phone ids: phone, phone:<app>. */
function phoneSheet(id) {
  if (!state.company) return null;
  if (id === "phone") return { title: () => "Phone", render: phoneHome };
  const app = PHONE_APPS.find((a) => "phone:" + a.id === id);
  if (!app) return null;
  const body = {
    inbox: phoneInbox,
    calendar: () => phoneLater("The calendar", "upcoming dates are in the side panel and on each artist."),
    contacts: () => phoneLater("Contacts", "everyone is in the roster in the side panel."),
    wallet: () => phoneLater("The wallet", 'money is in the <button data-tab="finance">office</button>.'),
    settings: () => phoneLater("Settings", "speed is in the top bar and saves are in the footer."),
  }[app.id];
  return { title: () => app.name, render: body };
}

/** The corner button: only in CEO runs, with the badge count. */
function paintPhoneButton() {
  const b = $("phoneButton");
  if (!b) return;
  b.hidden = !state.company;
  if (!state.company) return;
  const n = phoneBadge();
  const html = `${pixelSvg(["kkkkkk", "kyyyyk", "kyyyyk", "kyyyyk", "kyyyyk", "kkwwkk", "kkkkkk"], "#f3d25b", 26)}${n ? `<b class="phone-badge">${n}</b>` : ""}`;
  if (b.innerHTML !== html) b.innerHTML = html;
  b.setAttribute?.("aria-label", n ? `Phone, ${n} waiting` : "Phone");
}

if (typeof document !== "undefined" && document.addEventListener)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "p" && e.key !== "P") return;
    if (!state?.company || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")) return;
    if (panelOpen && String(tab).startsWith("phone")) closePanel();
    else openPanel("phone");
  });

const GoatPhone = { sheet: phoneSheet, paint: paintPhoneButton, inbox: inboxItems, badge: phoneBadge };
