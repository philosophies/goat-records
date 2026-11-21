// The story engine (3.0, design 6): plays arcs of beats as decision cards in CEO runs, remembers the
// flags each choice sets, and keeps a story log for every character. Classic runs never see it.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { STORY_RULES } = D;
    // Packs add their arcs alongside the starter arcs.
    const ARCS = [...D.ARCS, ...(D.ARTIST_ARCS || []), ...(D.STAFF_ARCS || [])];
    const { clamp, log, roll } = core;
    const arcById = new Map(ARCS.map((a) => [a.id, a]));
    const beatOf = (arc, id) => arc.beats.find((b) => b.id === id);

    function book(s) {
      return (s.company.stories ??= { arcs: [], log: {}, lastWeek: -STORY_RULES.gap });
    }
    const personKey = (a) => `artist:${a.id}`;

    // ---- Conditions ----
    const within = (v, r) =>
      !r || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max));
    function released(s, a) {
      return s.albums.filter((p) => p.released && p.artist === a.id);
    }
    /** Whether every condition in `when` holds for this artist (and, for flags, this arc). */
    function holds(s, a, when = {}, flags = {}) {
      const api = core.api(),
        phase = s.company.phase,
        albums = released(s, a),
        last = albums.reduce((n, p) => Math.max(n, p.releaseWeek ?? -Infinity), -Infinity);
      if (when.phase && (phase < when.phase[0] || phase > (when.phase[1] ?? 6))) return false;
      if (when.tier) {
        const tiers = [].concat(when.tier);
        if (!tiers.includes(api.tierOf?.(a) || "rising")) return false;
      }
      if (!within(a.fame || 0, when.fame) || !within(a.morale ?? 0, when.morale)) return false;
      if (when.relation && !within(api.relationOf?.(a) ?? 0, when.relation)) return false;
      if (!within(albums.length, when.releases)) return false;
      if (when.hit && !albums.some((p) => (p.quality || 0) >= (api.TIER_RULES?.hitQuality ?? 75)))
        return false;
      if (when.sinceRelease && !within(s.week - last, when.sinceRelease)) return false;
      if (when.touring !== undefined && !!api.onTour(s, a.id) !== when.touring) return false;
      if (!within(s.cash, when.cash)) return false;
      if (when.flags && Object.entries(when.flags).some(([k, v]) => flags[k] !== v)) return false;
      return true;
    }

    // ---- Picking a beat ----
    function lastBeatFor(b, key) {
      return b.log[key]?.at(-1)?.week ?? -Infinity;
    }
    /** Every beat that could play this week: arcs under way first, then arcs that could start. */
    function dueBeats(s) {
      const b = book(s),
        out = [];
      for (const run of b.arcs.filter((r) => !r.done)) {
        const arc = arcById.get(run.arc),
          a = s.artists.find((x) => x.id === run.artist);
        if (!arc || !a) {
          run.done = true;
          continue;
        }
        const beat = beatOf(arc, run.next);
        if (!beat) {
          run.done = true;
          continue;
        }
        if (s.week < run.week + (beat.after || 0)) continue;
        if (beat.when?.flags && !holds(s, a, { flags: beat.when.flags }, run.flags)) {
          run.done = true; // the story went another way
          continue;
        }
        if (s.week - lastBeatFor(b, personKey(a)) < STORY_RULES.personGap) continue;
        if (holds(s, a, beat.when, run.flags))
          out.push({ run, arc, beat, a, weight: STORY_RULES.continueWeight });
      }
      const started = new Set(b.arcs.map((r) => `${r.arc}:${r.artist}`));
      for (const a of s.artists) {
        if (s.week - lastBeatFor(b, personKey(a)) < STORY_RULES.personGap) continue;
        if (b.arcs.some((r) => !r.done && r.artist === a.id)) continue;
        const cast = core.api().castEntry?.(a.castId);
        for (const arc of ARCS) {
          if (started.has(`${arc.id}:${a.id}`)) continue;
          if (arc.who === "cast" && cast?.arc.id !== arc.id) continue;
          if (!holds(s, a, { ...arc.start, ...arc.beats[0].when })) continue;
          out.push({ run: null, arc, beat: arc.beats[0], a, weight: 1 });
        }
      }
      return out;
    }
    const EFFECT_NAMES = [
      ["morale", "morale"],
      ["fans", "fans"],
      ["trust", "trust"],
      ["energy", "energy"],
      ["attention", "attention"],
      ["artistFame", "artist fame"],
      ["labelFame", "label fame"],
      ["reputation", "label reputation"],
    ];
    const signed = (n) => (n > 0 ? "+" + n : String(n));
    const dollars = (n) => "$" + Math.abs(n).toLocaleString("en-US");
    /** The choice's flavour line, then every effect in numbers, so the card never misstates them. */
    function choiceText(c) {
      const st = c.story || {},
        parts = [];
      if (c.cost) parts.push(`costs ${dollars(c.cost)}`);
      if (c.cash) parts.push(c.cash > 0 ? `earns ${dollars(c.cash)}` : `loses ${dollars(c.cash)}`);
      for (const [k, name] of EFFECT_NAMES) if (c[k]) parts.push(`${name} ${signed(c[k])}`);
      if (st.xp) parts.push(`${st.xp} career XP`);
      if (st.loyalty) parts.push(`loyalty ${signed(st.loyalty)}`);
      if (st.relation) parts.push(`relationship with you ${signed(st.relation)}`);
      if (c.trust <= -STORY_RULES.scandalTrust) parts.push("a public scandal");
      const effects = parts.length
        ? parts.join(", ").replace(/^./, (x) => x.toUpperCase()) + "."
        : "No change.";
      return c.note ? `${c.note} ${effects}` : effects;
    }
    function fill(text, s, a) {
      return text
        .replaceAll("{name}", a.name)
        .replaceAll("{label}", core.api().labelName?.(s) || "the label");
    }
    /** Queues a beat as a decision card. */
    function play(s, { run, arc, beat, a }) {
      const b = book(s);
      if (!run) {
        run = { arc: arc.id, artist: a.id, next: beat.id, flags: {}, week: s.week, done: false };
        b.arcs.push(run);
      }
      const options = beat.choices.map((c, i) => {
        const { label, note, cost, story, ...effects } = c;
        const opt = {
          ...effects,
          label: fill(label, s, a),
          hint: fill(choiceText(c), s, a),
          cost,
          storyChoice: i,
        };
        if (effects.trust < 0 && -effects.trust < STORY_RULES.scandalTrust) opt.privateTrust = true;
        return opt;
      });
      s.eventQueue.push({
        type: "story",
        arc: arc.id,
        beat: beat.id,
        artist: a.id,
        title: fill(beat.title, s, a),
        body: fill(beat.body, s, a),
        options,
      });
      b.lastWeek = s.week;
      run.pending = beat.id;
    }
    function weekly(s) {
      if (!s.company || s.finished) return 0;
      const b = book(s);
      // A queued beat whose artist has left the label is dropped, and its arc ends.
      s.eventQueue = s.eventQueue.filter((e) => {
        if (e.type !== "story" || s.artists.some((a) => a.id === e.artist)) return true;
        const r = b.arcs.find((x) => x.arc === e.arc && x.artist === e.artist);
        if (r) Object.assign(r, { done: true, pending: undefined });
        return false;
      });
      if (s.event?.type === "story" || s.eventQueue.some((e) => e.type === "story")) return 0;
      if (s.week - b.lastWeek < STORY_RULES.gap) return 0;
      const due = dueBeats(s);
      if (!due.length || roll(s, "stories") >= STORY_RULES.chance) return 0;
      const total = due.reduce((n, x) => n + x.weight, 0);
      let r = roll(s, "stories") * total;
      play(s, due.find((x) => (r -= x.weight) < 0) || due.at(-1));
      return 0;
    }

    // ---- Resolving a beat ----
    function eventChoice(s, e, o) {
      if (e.type !== "story") return;
      const b = book(s),
        run = b.arcs.find((r) => r.arc === e.arc && r.artist === e.artist && r.pending === e.beat),
        arc = arcById.get(e.arc),
        beat = arc && beatOf(arc, e.beat),
        choice = beat?.choices[o.storyChoice],
        a = s.artists.find((x) => x.id === e.artist);
      if (!run || !choice) return;
      const st = choice.story || {};
      Object.assign(run.flags, st.set || {});
      if (a && st.xp) a.xp = (a.xp || 0) + st.xp;
      if (a && st.relation) core.api().shiftRelation?.(s, a, st.relation);
      if (a && st.loyalty) {
        const p = core.api().artistMood?.(s, a) && a.persona;
        if (p) p.loyalty = clamp(p.loyalty + st.loyalty, 0, 100);
      }
      delete run.pending;
      run.week = s.week;
      run.next = st.next ?? null;
      if (!run.next) run.done = true;
      if (a) {
        const key = personKey(a);
        (b.log[key] ??= []).push({ week: s.week, arc: arc.id, title: e.title, choice: choice.label });
        b.log[key] = b.log[key].slice(-STORY_RULES.logSize);
      }
      log(s, `${e.title}: ${choice.label}.`);
    }
    /** A character's story log, oldest first. */
    function storyLog(s, a) {
      return s.company?.stories?.log[personKey(a)] || [];
    }

    function validSave(s) {
      const b = s.company?.stories;
      if (b === undefined) return true;
      const okRun = (r) =>
        r &&
        arcById.has(r.arc) &&
        Number.isInteger(r.artist) &&
        (r.next === null || !!beatOf(arcById.get(r.arc), r.next)) &&
        !!r.flags &&
        typeof r.flags === "object" &&
        Number.isInteger(r.week) &&
        typeof r.done === "boolean";
      const okLog = (l) =>
        Array.isArray(l) && l.every((x) => x && Number.isInteger(x.week) && typeof x.title === "string");
      return (
        !!b &&
        Number.isInteger(b.lastWeek) &&
        Array.isArray(b.arcs) &&
        b.arcs.every(okRun) &&
        !!b.log &&
        typeof b.log === "object" &&
        Object.values(b.log).every(okLog) &&
        [s.event, ...(s.eventQueue || [])].every(
          (e) =>
            e?.type !== "story" ||
            (arcById.has(e.arc) &&
              !!beatOf(arcById.get(e.arc), e.beat) &&
              e.options.every((o) => !!beatOf(arcById.get(e.arc), e.beat).choices[o.storyChoice])),
        )
      );
    }

    return {
      weekly,
      eventChoice,
      validSave,
      api: {
        ARCS,
        STORY_RULES,
        storyLog,
        storyDue: dueBeats,
        playStory: play,
        storyHolds: holds,
        storyChoiceText: choiceText,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { stories: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
