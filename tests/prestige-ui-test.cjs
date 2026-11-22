// CEO runs call New Game+ points prestige and the achievement perks hall of fame perks, so the two
// are never confused; classic runs keep their legacy wording.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const G = require("../src/engine");

const src = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const campaignUi = src("src/ui/campaign.js"),
  legacyUi = src("src/ui/legacy.js");

// The CEO wording in the interface sources.
for (const [name, text] of [
  ["campaign", campaignUi],
  ["legacy", legacyUi],
]) {
  const lines = text.split("\n").filter((l) => /legacy (points|perks)/i.test(l));
  for (const l of lines)
    assert.match(
      l,
      /state\.company \?|: `Every|legacy points"|pointsWord|bonusesWord/,
      `${name}: unguarded "${l.trim().slice(0, 80)}"`,
    );
}
assert.match(legacyUi, /Hall of fame perks ·/);
assert.match(legacyUi, /Prestige bonuses, bought with a finished run's score, are chosen at New Game\+\./);
assert.match(campaignUi, /prestige point, spent here on a head start for the next run/);
assert.match(campaignUi, /Hall of fame perks are separate: achievements open them/);

// The functions, run in a small sandbox with a CEO state and a classic state.
function words(company) {
  const ctx = vm.createContext({ state: company ? { company: {} } : {} });
  vm.runInContext(
    campaignUi.match(/function pointsWord\(\) \{[\s\S]*?\n\}\nfunction bonusesWord\(\) \{[\s\S]*?\n\}/)[0],
    ctx,
  );
  return [vm.runInContext("pointsWord()", ctx), vm.runInContext("bonusesWord()", ctx)];
}
assert.deepEqual(words(true), ["prestige points", "prestige bonuses"]);
assert.deepEqual(words(false), ["legacy points", "legacy bonuses"]);

// The engine's refusals use the same words.
const ceo = G.create(7, { ceo: true });
ceo.finished = true;
ceo.campaign.bank = 1;
{
  assert.throws(() => G.newGamePlus(ceo, ["nope"]), /Unknown prestige bonus/);
  assert.throws(() => G.newGamePlus(ceo, ["indie", "fund", "team"]), /prestige points/);
}
console.log("Prestige and hall of fame perks harness passed.");
