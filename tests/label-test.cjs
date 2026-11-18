// Label ranks, album themes and combos, and the headquarters floor plan.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function label(seed = 7) {
  const s = G.create(seed, { ceo: false });
  s.cash = 500000;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { genre: "Country", audience: "Adult", talent: 70, energy: 100, inspiration: 80 });
  return { s, a };
}
function album(s, a, themes, genre = "Country") {
  G.record(s, { artistId: a.id, boothId: 0, genre, audience: "Adult", budget: 4000, themes });
  return s.albums.at(-1);
}
function preview(s, p, stage) {
  p.production.stage = stage;
  return G.stagePreview(s, p, 0);
}
const part = (pv, prefix) => pv.parts.find((c) => c.name.startsWith(prefix));
function finish(s, p) {
  for (let i = 0; i < 40 && !p.released; i++) {
    while (s.event) G.choose(s, 2);
    if (p.launchReview) p.launchReview = false;
    const d = p.production;
    if (!d.cooldown) {
      if (d.releaseReady) {
        G.releaseAlbum(s, p.id, p.title);
        p.launchReview = false;
        break;
      }
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    G.advance(s);
  }
  assert.ok(p.released);
}

test("New labels start as a Bedroom Label with six starter themes and an empty lot", () => {
  const s = G.create(1, { ceo: false });
  assert.equal(G.rank(s), 1);
  assert.equal(G.rankInfo(s).name, "Bedroom Label");
  assert.deepEqual(G.lotSize(s), [3, 2]);
  assert.equal(s.themes.length, 6);
  assert.equal(s.hq.facilities.length, 0);
  assert.equal(G.themeSlots(s), 1);
});

test("Older saves keep the rank their fame had already earned", () => {
  const s = G.create(2, { ceo: false });
  for (const k of ["rank", "themes", "themeLog", "combos", "hq", "rankUps", "discoverySeed", "labelRevision"])
    delete s[k];
  s.fame = 120;
  assert.ok(G.validLabelSave(s));
  G.migrate(s);
  assert.equal(G.rank(s), 3);
  assert.equal(G.slots(s), 4);
  assert.equal(s.themes.length, 6);
});

test("Rank-ups need every requirement, happen at the weekly settlement and grant themes", () => {
  const { s } = label(3);
  s.fame = 500;
  G.advance(s);
  assert.equal(G.rank(s), 1, "fame alone is not enough");
  for (let i = 0; i < 2; i++) s.albums.push({ id: 900 + i, released: true, chart: { best: null } });
  G.buildFacility(s, "writers", 0, 0);
  const known = s.themes.length;
  while (s.event) G.choose(s, 2);
  G.advance(s);
  assert.equal(G.rank(s), 2);
  assert.equal(s.themes.length, known + 2);
  assert.equal(s.rankUps.at(-1).rank, 2);
  s.fame = 0;
  while (s.event) G.choose(s, 2);
  G.advance(s);
  assert.equal(G.rank(s), 2, "rank is never lost");
});

test("Rank status reports each requirement, including chart peak where lower is better", () => {
  const s = G.create(4, { ceo: false });
  s.rank = 2;
  s.albums.push({ id: 1, released: true, chart: { best: 55 } });
  let row = G.rankStatus(s).checks.find((c) => c.key === "chartPeak");
  assert.deepEqual([row.have, row.need, row.met], [55, 40, false]);
  s.albums[0].chart.best = 12;
  row = G.rankStatus(s).checks.find((c) => c.key === "chartPeak");
  assert.equal(row.met, true);
});

test("Albums accept only discovered themes, one at first and two from Rising Label", () => {
  const { s, a } = label(5);
  assert.throws(() => album(s, a, ["Storms"]), /not been discovered/);
  assert.throws(() => album(s, a, ["Heartbreak", "Hometown"]), /one theme/);
  const before = JSON.stringify(s);
  assert.throws(() => album(s, a, ["Heartbreak", "Heartbreak"]));
  assert.equal(JSON.stringify(s), before, "rejected plans change nothing");
  s.rank = 3;
  const p = album(s, a, ["Heartbreak", "Hometown"]);
  assert.deepEqual(p.themes, ["Heartbreak", "Hometown"]);
});

test("Albums without a theme still record, for older projects and scripted play", () => {
  const { s, a } = label(6);
  const p = album(s, a, []);
  assert.deepEqual(p.themes, []);
  assert.equal(part(preview(s, p, 0), "Theme fit"), undefined);
});

test("A combo's fit is hidden until it is recorded, then shown in the notebook", () => {
  const { s, a } = label(8);
  assert.equal(G.comboInfo(s, "Country", ["Heartbreak"]).known, false);
  assert.equal(G.comboInfo(s, "Country", ["Heartbreak"]).fit, null);
  album(s, a, ["Heartbreak"]);
  const info = G.comboInfo(s, "Country", ["Heartbreak"]);
  assert.equal(info.known, true);
  assert.equal(info.fit.name, "Great");
});

test("Theme fit scores Identity and Songwriting only, and a great fit beats a poor one", () => {
  const { s, a } = label(9);
  const great = album(s, a, ["Heartbreak"]);
  assert.equal(part(preview(s, great, 0), "Theme fit").value, 7);
  assert.equal(part(preview(s, great, 1), "Theme fit").value, 7);
  assert.equal(part(preview(s, great, 2), "Theme fit"), undefined);
  const g = preview(s, great, 1).expected;
  s.albums.pop();
  a.energy = 100;
  const poor = album(s, a, ["Late Night"]);
  assert.equal(part(preview(s, poor, 1), "Theme fit").value, -5);
  assert.ok(g > preview(s, poor, 1).expected);
});

test("Two themes combine at three quarters of their summed fit", () => {
  assert.equal(G.comboFit("Country", ["Heartbreak", "Hometown"]).points, Math.round(14 * 0.75));
  assert.equal(G.comboFit("Rap", ["Faith", "Late Night"]).points, Math.round(4 * 0.75));
  assert.equal(G.comboFit("Pop", ["Faith", "Grief"]).points, Math.round(-10 * 0.75));
});

test("Repeating a combo builds experience but recent repeats cost Reach", () => {
  const { s, a } = label(10);
  const first = album(s, a, ["Hometown"]);
  assert.equal(first.comboLevel, 1);
  finish(s, first);
  assert.equal(s.combos["Country · Hometown"].releases, 1);
  Object.assign(a, { energy: 100, inspiration: 90 });
  const second = album(s, a, ["Hometown"]);
  assert.equal(second.comboLevel, 2);
  assert.equal(part(preview(s, second, 3), "Combo experience").value, 1);
  assert.equal(part(preview(s, second, 4), "Familiar combo").value, -4);
  s.week += 30;
  second.recordWeek = s.week;
  assert.equal(part(preview(s, second, 4), "Familiar combo"), undefined, "the penalty fades after 26 weeks");
});

test("Facilities respect rank, lot bounds, occupied tiles and one of each", () => {
  const s = G.create(11, { ceo: false });
  s.cash = 500000;
  assert.throws(() => G.buildFacility(s, "mix", 0, 0), /rank 2/);
  assert.throws(() => G.buildFacility(s, "writers", 3, 0), /outside/);
  G.buildFacility(s, "writers", 0, 0);
  assert.equal(s.cash, 500000 - 4000);
  assert.throws(() => G.buildFacility(s, "vocal", 0, 0), /occupied/);
  assert.throws(() => G.buildFacility(s, "writers", 1, 0), /already built/);
  s.rank = 2;
  G.buildFacility(s, "mix", 3, 1);
  assert.ok(G.facilityAt(s, 3, 1));
});

test("Facility upkeep joins weekly overhead and scales with level", () => {
  const s = G.create(12, { ceo: false });
  s.cash = 500000;
  const base = G.upkeep(s);
  G.buildFacility(s, "writers", 0, 0);
  assert.equal(G.upkeep(s), base + 50);
  G.upgradeFacility(s, "writers");
  assert.equal(G.upkeep(s), base + 100);
});

test("Upgrades cost build price × current level and stop at level 3", () => {
  const s = G.create(13, { ceo: false });
  s.cash = 500000;
  G.buildFacility(s, "vocal", 1, 1);
  let cash = s.cash;
  G.upgradeFacility(s, "vocal");
  assert.equal(cash - s.cash, 5000);
  cash = s.cash;
  G.upgradeFacility(s, "vocal");
  assert.equal(cash - s.cash, 10000);
  assert.throws(() => G.upgradeFacility(s, "vocal"), /top level/);
});

test("Facilities add their stage bonus to the matching production stage", () => {
  const { s, a } = label(14);
  G.buildFacility(s, "writers", 0, 0);
  G.upgradeFacility(s, "writers");
  const p = album(s, a, ["Hometown"]);
  assert.equal(part(preview(s, p, 1), "Headquarters").value, 4);
  assert.equal(part(preview(s, p, 2), "Headquarters"), undefined);
});

test("Neighboring facilities unlock their pairing; diagonals do not", () => {
  const { s, a } = label(15);
  G.buildFacility(s, "writers", 0, 0);
  G.buildFacility(s, "lounge", 1, 1);
  assert.equal(G.activeSynergies(s).length, 0);
  G.moveFacility(s, "lounge", 1, 0);
  assert.deepEqual(
    G.activeSynergies(s).map((x) => x.name),
    ["Late-night sessions"],
  );
  const p = album(s, a, ["Hometown"]);
  const hq = part(preview(s, p, 1), "Headquarters");
  assert.equal(hq.value, 4);
  assert.match(hq.name, /Late-night sessions/);
});

test("Moving onto a built tile swaps the two facilities and costs the move fee", () => {
  const s = G.create(16, { ceo: false });
  s.cash = 500000;
  G.buildFacility(s, "writers", 0, 0);
  G.buildFacility(s, "vocal", 2, 1);
  const cash = s.cash;
  G.moveFacility(s, "writers", 2, 1);
  assert.equal(cash - s.cash, G.HQ.moveCost);
  assert.equal(G.facilityAt(s, 2, 1).id, "writers");
  assert.equal(G.facilityAt(s, 0, 0).id, "vocal");
});

test("Shops earn from label fame, the Fan district pairing adds 30%, and archives pay only after a run ends", () => {
  const s = G.create(17, { ceo: false });
  s.cash = 500000;
  s.rank = 3;
  s.fame = 100;
  G.buildFacility(s, "merch", 0, 0);
  assert.equal(G.hqIncome(s).shops, 60 + 120);
  G.buildFacility(s, "bar", 2, 2);
  assert.equal(G.hqIncome(s).shops, 180 + 250);
  G.moveFacility(s, "bar", 1, 0);
  assert.equal(G.hqIncome(s).shops, Math.round(430 * 1.3));
  s.rank = 4;
  G.buildFacility(s, "archive", 3, 2);
  s.albums.push({ id: 1, released: true, quality: 80, age: 6, salesWeeks: 12, chart: {} });
  assert.equal(G.hqIncome(s).residual, 0);
  s.albums[0].age = 12;
  assert.equal(G.hqIncome(s).residual, 40);
});

test("Shop takings stop rising past the fame cap and the archive pays on the best albums only", () => {
  const { s } = label(16);
  s.cash = 10 ** 7;
  s.rank = 4;
  G.buildFacility(s, "merch", 0, 0);
  s.fame = G.HQ.incomeFameCap;
  const atCap = G.hqIncome(s).shops;
  s.fame = G.HQ.incomeFameCap * 10;
  assert.equal(G.hqIncome(s).shops, atCap);
  G.buildFacility(s, "archive", 3, 2);
  for (let i = 0; i < G.HQ.residualAlbums + 10; i++)
    s.albums.push({
      id: 100 + i,
      released: true,
      quality: i < 10 ? 10 : 80,
      age: 20,
      salesWeeks: 12,
      chart: {},
    });
  const archive = G.FACILITIES.find((f) => f.id === "archive");
  assert.equal(G.hqIncome(s).residual, Math.round(archive.residual * 80 * G.HQ.residualAlbums));
});

test("The Artist Lounge restores morale and inspiration for idle artists only", () => {
  const { s, a } = label(18);
  G.sign(s, s.candidates[0].id);
  const b = s.artists[1];
  Object.assign(b, { genre: "Pop", inspiration: 80, energy: 100 });
  G.buildFacility(s, "lounge", 0, 0);
  album(s, b, []);
  Object.assign(a, { morale: 50, inspiration: 30 });
  b.morale = 50;
  while (s.event) G.choose(s, 2);
  for (const p of s.albums) if (!p.production.review) G.decideStage(s, p.id, 0);
  for (const p of s.albums) G.continueProduction(s, p.id);
  G.advance(s);
  assert.equal(a.morale, 54, "engine +2, lounge +2");
  assert.equal(a.inspiration, 42, "engine +10, lounge +2");
  assert.equal(b.morale, 50, "recording artist does not visit the lounge");
});

test("Theme discovery uses its own random stream and stops when every theme is known", () => {
  const s = G.create(19, { ceo: false }),
    seed = s.seed;
  const t = G.discoverTheme(s, "test");
  assert.ok(s.themes.includes(t));
  assert.equal(s.seed, seed, "core random sequence untouched");
  while (G.discoverTheme(s, "test"));
  assert.equal(s.themes.length, G.THEMES.length);
  assert.equal(G.discoverTheme(s, "test"), null);
});

test("A Writers' Room finds new themes over time", () => {
  const s = G.create(20, { ceo: false });
  s.cash = 500000;
  G.buildFacility(s, "writers", 0, 0);
  G.upgradeFacility(s, "writers");
  G.upgradeFacility(s, "writers");
  for (let i = 0; i < 30; i++) {
    while (s.event) G.choose(s, 2);
    G.advance(s);
  }
  assert.ok(s.themes.length > 6);
  assert.ok(s.themeLog.some((x) => x.source === "Writers' Room"));
});

test("The Talent Academy raises the development ceiling and lowers its fee", () => {
  const { s, a } = label(21);
  a.potential = 100;
  a.talent = 60;
  s.rank = 5;
  const before = G.trainingInfo(s, a);
  G.buildFacility(s, "academy", 0, 0);
  const after = G.trainingInfo(s, a);
  assert.equal(after.cost, Math.round(before.cost * 0.85));
  assert.equal(after.cap, before.cap + 3);
});

test("Imported saves with broken label data are rejected", () => {
  const s = G.create(22, { ceo: false });
  s.cash = 100000;
  G.buildFacility(s, "writers", 0, 0);
  assert.ok(G.validLabelSave(s));
  for (const bad of [
    (x) => (x.rank = 9),
    (x) => x.themes.push("Not a theme"),
    (x) => x.hq.facilities.push({ ...x.hq.facilities[0] }),
    (x) => (x.hq.facilities[0].level = 4),
    (x) => (x.hq.facilities[0].id = "spa"),
    (x) => x.albums.push({ themes: ["Nope"] }),
  ]) {
    const copy = JSON.parse(JSON.stringify(s));
    bad(copy);
    assert.equal(G.validLabelSave(copy), false);
  }
});

test("Older saves list the player's label as Goat Records in past award results", () => {
  const s = G.create(23, { ceo: false });
  s.awardPrograms[1] = {
    year: 1,
    entries: {},
    results: [
      {
        genre: "Pop",
        entries: [
          { id: 1, label: "Side A", owned: true },
          { id: 2, label: "Goldline" },
        ],
      },
    ],
  };
  s.labelRevision = 1;
  G.migrate(s);
  const [own, rival] = s.awardPrograms[1].results[0].entries;
  assert.equal(own.label, "Goat Records");
  assert.equal(rival.label, "Goldline");
});

console.log(`${count} label rank, theme and headquarters tests passed.`);
