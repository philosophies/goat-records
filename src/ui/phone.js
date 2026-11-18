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
function phoneScreen(body) {
  return `<div class="phone"><button class="phone-back" data-tab="phone">‹ Home</button>${body}</div>`;
}
function weekLabel(week) {
  return `Y${1 + Math.floor((week - 1) / 52)} W${1 + ((week - 1) % 52)}`;
}

/** Dated and ongoing things, soonest first: [{ week | null, kind, text, tab }]. */
function calendarItems() {
  const out = [],
    nextYear = state.week + ((53 - (state.week % 52)) % 52 || 52);
  out.push({
    week: nextYear,
    kind: "Awards",
    text: "Annual awards and the year's goal are settled.",
    tab: "awards",
  });
  if (state.company?.board?.nextReview)
    out.push({ week: state.company.board.nextReview, kind: "Board", text: "Board review.", tab: "board" });
  for (const p of state.albums.filter((x) => !x.released))
    out.push({
      week: null,
      kind: "Recording",
      text: `${p.title} · ${p.artistName}${p.production ? ` · ${p.production.stage}/5 decisions` : ""}`,
      tab: "artist:" + p.artist,
    });
  for (const t of state.tours.filter((x) => x.status === "active"))
    out.push({
      week: null,
      kind: "On tour",
      text: `${t.artistName} · day ${t.day || 0} of ${t.plannedDays || t.duration || "?"}`,
      tab: "bus",
    });
  for (const ad of state.promotion?.ads || [])
    if (ad.until >= state.week) {
      const p = state.albums.find((x) => x.id === ad.albumId);
      out.push({ week: ad.until, kind: "Ad ends", text: p ? p.title : "Ad campaign", tab: "promotion" });
    }
  for (const a of state.artists)
    if (a.contract.remaining <= 1)
      out.push({
        week: null,
        kind: "Contract",
        text: `${a.name} · ${a.contract.remaining ? "last album on contract" : "contract complete"}`,
        tab: "artist:" + a.id,
      });
  return out.sort((x, y) => (x.week ?? 0) - (y.week ?? 0));
}
function phoneCalendar() {
  const items = calendarItems();
  return phoneScreen(
    `<ul class="inbox">${items
      .map(
        (x) =>
          `<li class="inbox-item"><span class="tag">${esc(x.kind.toUpperCase())}${x.week ? " · " + weekLabel(x.week) : " · NOW"}</span><button class="link" data-tab="${esc(x.tab)}">${esc(x.text)}</button></li>`,
      )
      .join("")}</ul>`,
  );
}

let contactQuery = "";
function phoneContacts() {
  const q = contactQuery.trim().toLowerCase(),
    people = [
      ...state.artists.map((a) => ({
        tab: "artist:" + a.id,
        name: a.name,
        role: `${a.genre} artist`,
        map: G.ARTIST_SPRITE,
        color: G.GENRE_COLORS[a.genre] || "#ccc",
      })),
      ...state.staff.map((r) => ({
        tab: "staffer:" + r,
        name: state.employees[r]?.name || r,
        role: r,
        map: STAFF_SPRITE,
        color: ROLE_COLORS[r] || "#7b7f8c",
      })),
    ].filter((p) => !q || (p.name + " " + p.role).toLowerCase().includes(q));
  return phoneScreen(
    `<label class="contact-search">Search<input id="contactSearch" data-contact-search value="${esc(contactQuery)}" placeholder="Name or role"></label><ul class="inbox">${
      people
        .map(
          (p) =>
            `<li><button class="roster-chip" data-tab="${p.tab}">${pixelSvg(p.map, p.color, 16)}<span><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span></button></li>`,
        )
        .join("") || '<li class="empty">Nobody matches.</li>'
    }</ul>`,
  );
}

function phoneWallet() {
  const last = state.financeHistory?.at(-1),
    valuation = G.companyValuation(state),
    shares = state.company?.shares,
    debt = (valuation?.debt || 0) + Math.max(0, -state.cash),
    rows = [
      ["Cash", money(state.cash)],
      ["Weekly costs", money(G.upkeep(state)) + "/week"],
      ["Last week", last ? (last.cashChange >= 0 ? "+" : "") + money(last.cashChange) : "—"],
      ["Revenue, last 52 weeks", money(G.yearRevenue(state))],
      [
        "Budget left this period",
        state.company?.board?.budgetLeft !== undefined
          ? money(state.company.board.budgetLeft)
          : "— (no board)",
      ],
      ["Debt", debt ? money(debt) : "None"],
    ];
  if (valuation && shares) {
    rows.push(
      ["Company value", money(valuation.value)],
      [state.company.public ? "Share price" : "Estimated share price", "$" + valuation.sharePrice.toFixed(2)],
      ["Your shares", shares.yours.toLocaleString("en-US") + " / " + shares.total.toLocaleString("en-US")],
      ["Investor shares", shares.investors.toLocaleString("en-US")],
    );
  }
  return phoneScreen(
    `<dl class="wallet">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl><button data-tab="finance">Full finances in the office</button>`,
  );
}

function phoneSettings() {
  const speeds = [
    [0, "Pause"],
    [1, "1×"],
    [2, "2×"],
    [4, "4×"],
  ];
  return phoneScreen(
    `<h3>Speed</h3><div class="actions">${speeds
      .map(
        ([n, label]) =>
          `<button data-action="phoneSpeed" data-speed="${n}" ${GoatClock.speed === n ? 'class="primary"' : ""}>${label}</button>`,
      )
      .join(
        "",
      )}</div><h3>Sound</h3><button data-action="phoneSound">${typeof sound !== "undefined" && sound ? "Sound on" : "Sound off"}</button><h3>Saves</h3><p class="muted">Progress saves itself in this browser. Keep a backup file too.</p><div class="actions"><button data-action="phoneExport">Export save</button></div>`,
  );
}

/** Sheets for phone ids: phone, phone:<app>. */
function phoneSheet(id) {
  if (!state.company) return null;
  if (id === "phone") return { title: () => "Phone", render: phoneHome };
  const app = PHONE_APPS.find((a) => "phone:" + a.id === id);
  if (!app) return null;
  const body = {
    inbox: phoneInbox,
    calendar: phoneCalendar,
    contacts: phoneContacts,
    wallet: phoneWallet,
    settings: phoneSettings,
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

GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "phoneSpeed") GoatClock.setSpeed(Number(d.speed));
  else if (d.action === "phoneSound") $("sound").onclick();
  else if (d.action === "phoneExport") $("export").onclick();
  else return false;
  render();
  return true;
});
GoatUI.change.push((e) => {
  if (!e.target?.dataset || !("contactSearch" in e.target.dataset)) return false;
  contactQuery = e.target.value;
  render();
  return true;
});

if (typeof document !== "undefined" && document.addEventListener)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "p" && e.key !== "P") return;
    if (!state?.company || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")) return;
    if (panelOpen && String(tab).startsWith("phone")) closePanel();
    else openPanel("phone");
  });

const GoatPhone = {
  sheet: phoneSheet,
  paint: paintPhoneButton,
  inbox: inboxItems,
  badge: phoneBadge,
  calendar: calendarItems,
};
