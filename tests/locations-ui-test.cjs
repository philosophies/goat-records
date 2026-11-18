// Interface check for recording locations and paid gigs on a mock page.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      dataset: {},
    });
  return elements.get(id);
};
let stored = null;
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const saved = () => JSON.parse(stored),
  html = () => element("content").innerHTML;
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}

// Locations screen before any visit: every location, locks and hidden signature themes.
click({ tab: "locations" });
assert.equal(
  element("drawerTitle").textContent,
  "Out of town",
  "the old Locations link opens the street overview",
);
assert.match(element("lotTown").innerHTML, /data-tab="location:barn"[\s\S]*Barn Loft[\s\S]*Lv 1 · \$600/);
assert.match(html(), /Recording locations/);
for (const l of vm.runInContext("G.LOCATIONS", context)) assert.ok(html().includes(l.name), l.name);
assert.match(html(), /Locked · rank 2/);
assert.match(html(), /Signature theme: <b>\?<\/b>/);
assert.ok(!html().includes("Working Class"), "signature theme hidden before the first visit");
assert.match(html(), /<svg class="pixel"/);
assert.match(html(), /Level 1 of 9/);
assert.match(html(), /Paid gigs/);

// Sign an artist; their sheet shows the location field and the gig button.
click({ tab: "scout" });
click({ action: "sign", id: saved().candidates[0].id });
click({ tab: "artist:" + saved().artists[0].id });
assert.match(html(), /Recording location<select id="albumLocation" data-album-field>/);
assert.match(html(), /Barn Loft · \$600 rent · level 1/);
assert.match(html(), /<option value="rooftop" disabled[^>]*>Rooftop Loft · rank 2/);
assert.match(html(), /Paid gig<select id="gig-\d+" data-gig-artist/);
assert.match(html(), /Play gig · about \$[\d,]+/);

// A location's sheet preselects it in the album form.
click({ tab: "location:barn" });
assert.match(html(), /Record here/);
assert.match(html(), /<option value="barn"\s+selected>Barn Loft/);
click({ tab: "artist:" + saved().artists[0].id });

// Play a gig from the card.
const a = saved().artists[0],
  cash = saved().cash;
click({ action: "playGig", id: String(a.id), gig: "bar" });
assert.equal(saved().gigs.played, 1);
assert.equal(saved().cash, cash + saved().gigs.earned);
assert.match(html(), /Next gig available in 2 weeks/);
assert.match(html(), /Last gig, week 1: Bar set/);

// Switching the gig select re-renders that card's quote.
listeners.change({ target: { id: "gig-" + a.id, value: "wedding", dataset: { gigArtist: String(a.id) } } });
assert.match(html(), /<option value="wedding" selected>Wedding/);

// Record at the Barn Loft: the quote line, then the rent on the album cost.
element("artist").value = a.id;
element("booth").value = 0;
element("genre").value = "Country";
element("audience").value = a.audience;
element("budget").value = 4000;
element("albumLocation").value = "barn";
listeners.change({ target: { id: "albumLocation", value: "barn", dataset: { albumField: "" } } });
assert.match(element("albumQuote").innerHTML, /Barn Loft · level 1 · rent \$600/);
assert.match(element("albumQuote").innerHTML, /Country affinity Great: \+4 to every stage/);
assert.match(element("albumQuote").innerHTML, /\$4,600 upfront/);
const inspired = vm.runInContext(
  `state.artists[0].inspiration = 80; state.artists[0].energy = 100; state.artists[0].id`,
  context,
);
assert.equal(inspired, a.id);
listeners.submit({ target: { id: "albumForm" }, preventDefault() {} });
const p = saved().albums[0];
assert.equal(p.location, "barn");
assert.equal(p.budget, 4600);
assert.ok(saved().themes.includes("Working Class"));
// Starting an album returns to the lot; the artist's sheet shows the record and no gigs.
click({ tab: "artist:" + a.id });
assert.match(html(), /Gigs are not possible while recording or touring/);
assert.match(html(), /IN THE STUDIO/);
// The location's own sheet: booked while the album is in production.
click({ tab: "location:barn" });
assert.equal(element("drawerTitle").textContent, "Barn Loft");
assert.match(html(), /Booked by/);
assert.match(element("lotTown").innerHTML, /data-tab="location:barn"[\s\S]*?Booked/);

// The Locations screen now shows the visit and the signature theme.
click({ tab: "locations" });
assert.match(html(), /Working Class/);
assert.match(html(), /Booked · in production/);
assert.match(html(), /1 of 10 visited/);
assert.equal(vm.runInContext("validSave(JSON.parse(JSON.stringify(state)))", context), true);
assert.equal(
  vm.runInContext(
    "(() => { const c = JSON.parse(JSON.stringify(state)); c.locationStats.barn.level = 10; return validSave(c); })()",
    context,
  ),
  false,
);
console.log(
  "PASS locations interface: street of locations, location and artist panels, album location field and quote, gig button and cooldown, recording at a location and save checks.",
);
