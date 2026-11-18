const assert = require("node:assert/strict");
const G = require("../src/engine");
const { COMPANY_EVENTS, COMPANY_EVENT_INTERVAL } = require("../src/data/events");
const { create } = require("../src/systems/events");

const events = G.systems.find(({ name }) => name === "events");
const roundTrip = (s) => G.migrate(JSON.parse(JSON.stringify(s)));

function label(seed = 7, ceo = true) {
  const s = G.create(seed, ceo ? { ceo: true } : {});
  s.cash = 100000;
  G.sign(s, s.candidates[0].id);
  s.artists[0].morale = 60;
  s.week = COMPANY_EVENT_INTERVAL - 1;
  return s;
}

const template = {
  id: "fixture",
  kind: "crisis",
  phases: [2],
  weight: 1,
  deadlineWeeks: 3,
  expiryChoice: 1,
  choices: [
    {
      label: "Respond",
      cost: 100,
      chance: 0.5,
      effects: {
        cash: 75, fame: 5, confidence: -5, morale: -8, artistFame: 12, delayAlbum: 2,
        loan: { amount: 400, payment: 100 },
      },
      failure: { cash: -20 },
    },
    { label: "Let it pass", effects: { cash: -40 } },
  ],
  when: {
    label: [{ field: "cash", min: 500 }],
    company: [{ field: "ownership", max: 0.9 }],
    board: [{ field: "freedom", equals: "medium" }],
    artist: [{ field: "morale", min: 50 }],
    album: [{ field: "genre", equals: "Pop" }],
    executive: [{ field: "ambition", min: 50 }],
  },
};

function fixture() {
  const s = label();
  s.company.phase = 2;
  G.takeFunding(s, "angel", 0);
  s.company.ownership = 0.8;
  Object.values(s.company.departments)[0].head = { ambition: 75 };
  s.albums.push({
    id: 90, artist: s.artists[0].id, genre: "Pop",
    production: { cooldown: 0, releaseReady: true }, remaining: 0,
  });
  s.week = COMPANY_EVENT_INTERVAL;
  return s;
}

assert.ok(events.eligible(label(), COMPANY_EVENTS[0]));
assert.ok(!events.eligible(label(7, false), COMPANY_EVENTS[0]));
const eligible = fixture();
assert.deepEqual(events.eligible(eligible, template), { artist: eligible.artists[0].id, album: 90 });
for (const invalidate of [
  (s) => { s.cash = 499; },
  (s) => { s.company.phase = 1; },
  (s) => { s.company.ownership = 1; },
  (s) => { delete s.company.board; },
  (s) => { s.company.board.freedom = "high"; },
  (s) => { s.artists[0].morale = 49; },
  (s) => { s.albums[0].artist = 999; },
  (s) => { s.albums[0].released = true; },
  (s) => { Object.values(s.company.departments)[0].head.ambition = 49; },
]) {
  const s = fixture();
  invalidate(s);
  assert.equal(events.eligible(s, template), null);
}

function system(draw, outcome, table = [template]) {
  return create({
    clamp: (n, min = 0, max = 100) => Math.max(min, Math.min(max, n)),
    log: () => {},
    pay: (s, cost) => { s.cash -= cost; },
    roll: (_, key) => key.endsWith(":draw") ? draw : outcome,
  }, { COMPANY_EVENTS: table, COMPANY_EVENT_INTERVAL });
}

const weighted = { ...template, id: "weighted", weight: 3 };
for (const [draw, id] of [[0.249, "fixture"], [0.25, "weighted"], [0.99, "weighted"]]) {
  const s = fixture();
  system(draw, 0, [template, weighted]).queue(s);
  assert.equal(s.eventQueue.at(-1).eventId, id);
}

for (const succeeds of [true, false]) {
  const s = fixture();
  const sys = system(0, succeeds ? 0.49 : 0.5);
  const { cash, fame } = s;
  const artist = s.artists[0];
  const artistFame = artist.fame;
  const confidence = s.company.board.confidence;
  sys.queue(s);
  const entry = s.eventQueue.at(-1);
  const option = entry.options[0];
  assert.equal(sys.available({ ...s, cash: 99 }, option, entry), false);
  assert.equal(sys.available(s, option, entry), true);
  sys.resolve(s, entry, option);
  assert.equal(s.cash, cash - 100 + (succeeds ? 475 : -20));
  assert.equal(s.fame, fame + (succeeds ? 5 : 0));
  assert.equal(s.company.board.confidence, confidence - (succeeds ? 5 : 0));
  assert.equal(artist.morale, succeeds ? 52 : 60);
  assert.equal(artist.fame, artistFame + (succeeds ? 12 : 0));
  assert.equal(s.albums[0].production.cooldown, succeeds ? 2 : 0);
  assert.equal(s.albums[0].production.releaseReady, !succeeds);
  assert.equal(s.albums[0].remaining, succeeds ? 2 : 0);
  assert.deepEqual(s.company.loan, succeeds ? { amount: 400, balance: 400, payment: 100, week: s.week } : null);
  assert.equal(sys.available(s, option, entry), !succeeds);
  if (succeeds)
    assert.ok(G.boardReport(s).directors.some((director) =>
      director.reasons.some(({ key, points }) => key === "events" && points === -5)));
}

const first = label();
const second = label();
for (const s of [first, second]) {
  G.advance(s);
  assert.equal(s.event.type, "companyEvent");
  assert.ok(G.validSystemsSave(s));
  G.choose(s, 0);
}
assert.deepEqual(first, second);
assert.ok(first.streams["company-events:draw"]);
assert.ok(first.streams["company-events:choice"]);

const approval = label();
approval.company.phase = 2;
G.takeFunding(approval, "angel", 0);
G.advance(approval);
approval.company.board.confidence = 70;
approval.company.board.budget = 1;
const offer = approval.event;
const cash = approval.cash;
G.choose(approval, 1);
assert.equal(approval.event.type, "approval");
assert.equal(approval.cash, cash);
G.choose(approval, 0);
assert.equal(approval.event, offer);
G.choose(approval, 1);
assert.equal(approval.cash, cash - 100);
assert.equal(approval.event, null);

let deferred = label();
G.advance(deferred);
G.choose(deferred, deferred.event.options.length - 1);
assert.equal(deferred.event, null);
deferred = roundTrip(deferred);
assert.ok(G.validSystemsSave(deferred));
G.advance(deferred);
assert.equal(deferred.event.eventId, "studio-cancellation");
const comparison = roundTrip(deferred);
G.choose(deferred, deferred.event.options.length - 1);
G.choose(comparison, 2);
G.advance(deferred);
G.advance(comparison);
assert.equal(deferred.event, null);
assert.equal(deferred.company.deferredEvents, undefined);
assert.equal(deferred.artists[0].morale, comparison.artists[0].morale);
assert.equal(deferred.cash, comparison.cash);

const classic = label(7, false);
classic.week = 3;
G.advance(classic);
assert.ok(classic.event);
assert.notEqual(classic.event.type, "companyEvent");
assert.equal(classic.streams?.["company-events:draw"], undefined);
console.log("Company event conditions, effects, deadlines, saves, and seeded draws passed.");
