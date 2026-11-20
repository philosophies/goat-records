// Mock-page check of the Campaign screen, goal chip, yearly review, final review and New Game+ picker.
// Checks rendering and actions only; real-browser layout is checked separately.
const vm = require("node:vm"),
  assert = require("node:assert/strict"),
  G = require("../src/engine.js");

function page(save) {
  const elements = new Map(),
    listeners = {};
  let stored = save ? JSON.stringify(save) : null;
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        innerHTML: "",
        textContent: "",
        value: "",
        hidden: false,
        disabled: false,
        classList: { toggle() {}, add() {} },
        dataset: {},
      });
    return elements.get(id);
  };
  const context = vm.createContext({
    console,
    LabelGame: G,
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      addEventListener: (name, fn) => (listeners[name] = fn),
    },
    localStorage: { getItem: () => stored, setItem: (k, v) => k === "side-a-save-v1" && (stored = v) },
    confirm: () => true,
    setTimeout,
    Blob,
    URL,
  });
  require("./load-interface.cjs")(context);
  return {
    html: (id) => element(id).innerHTML,
    text: (id) => element(id).textContent,
    el: element,
    saved: () => JSON.parse(stored),
    click: (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } }),
    change: (target) => listeners.change({ target }),
  };
}
function clear(s) {
  while (s.event && !s.finished)
    G.choose(
      s,
      s.event.options.findIndex((o) => !o.cost),
    );
}

// A new label: goal chip, goal line and the Campaign screen with all 20 years.
let p = page();
assert.match(p.html("hud"), /campaign-chip[^>]*>Y1 goal · Reach Indie Imprint · now Bedroom Label/);
assert.match(p.text("goal"), /^Year 1\/20 goal: Reach Indie Imprint/);
assert.equal(p.el("continueCareer").hidden, true);
p.click({ tab: "campaign" });
assert.match(p.html("content"), /Campaign · run 1/);
assert.equal((p.html("content").match(/<tr class="goal-/g) || []).length, 20);
assert.match(p.html("content"), /goal-active[\s\S]*Reach Indie Imprint/);
assert.match(p.html("content"), /Score so far/);

// The yearly review banner appears after the year boundary and is dismissed with Continue.
const year = G.create(31, { ceo: false });
year.week = 52;
G.advance(year);
clear(year);
p = page(year);
assert.match(p.html("milestones"), /YEAR 1 REVIEW · GOAL MISSED/);
assert.match(p.html("milestones"), /Next goal: <b>A Top 40 album<\/b>/);
assert.match(p.html("milestones"), /class="component"[\s\S]*Albums released/);
p.click({ action: "campaignAck" });
assert.doesNotMatch(p.html("milestones"), /YEAR 1 REVIEW/);
assert.equal(p.saved().campaign.reviews[0].seen, true);
assert.match(p.html("hud"), /Y2 goal · A Top 40 album/);

// A finished run: final review, legacy picker and New Game+.
const done = G.create(32, { ceo: false });
done.awards = 40;
done.week = 20 * 52;
G.advance(done);
clear(done);
assert.equal(done.finished, true);
done.campaign.bank = 20; // points carried from earlier runs, so both bonuses below are affordable
p = page(done);
assert.match(p.html("milestones"), /CAMPAIGN COMPLETE/);
assert.equal(p.el("advance").textContent, "Run over");
p.click({ tab: "campaign" });
const points = G.legacyPoints(done);
assert.match(p.html("content"), /FINAL REVIEW · 20 YEARS/);
assert.match(p.html("content"), /Final score[\s\S]*Label rank[\s\S]*Cash on hand/);
assert.match(p.html("content"), /Best album[\s\S]*Peak cash[\s\S]*Artists developed/);
assert.match(p.html("content"), new RegExp(`<b>${points}</b> of ${points} legacy points left`));
p.change({ dataset: { legacy: "seed" }, checked: true });
p.change({ dataset: { legacy: "themes" }, checked: true });
assert.match(p.html("content"), new RegExp(`<b>${points - 8}</b> of ${points} legacy points left`));
p.click({ action: "campaignNewGamePlus" });
const next = p.saved();
assert.equal(next.campaign.run, 2);
assert.deepEqual(next.campaign.legacy, ["seed", "themes"]);
assert.equal(next.week, 1);
assert.equal(p.html("content"), "", "a new run starts on the lot with menus closed");
assert.match(p.html("hud"), /Y1 goal/);

// Dropping below $0 shows a warning card first; the run carries on during the grace period.
const red = G.create(34, { ceo: false });
red.cash = 0;
G.advance(red);
clear(red);
p = page(red);
assert.equal(red.finished, false);
assert.match(p.html("milestones"), /CASH WARNING[\s\S]*IN THE RED[\s\S]*within 4 weeks/);

// An early bankruptcy offers no New Game+.
const broke = G.create(33, { ceo: false });
broke.cash = 0;
broke.debtWeeks = G.DEBT.graceWeeks;
G.advance(broke);
p = page(broke);
p.click({ tab: "campaign" });
assert.match(p.html("content"), /OUT OF CASH IN YEAR 1/);
assert.match(p.html("content"), /New Game\+ opens when a run reaches the end of year 20/);
assert.doesNotMatch(p.html("content"), /campaignNewGamePlus/);

console.log("Campaign interface check passed.");
