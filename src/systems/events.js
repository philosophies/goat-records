(function (root) {
  "use strict";
  function create(core, { COMPANY_EVENTS, COMPANY_EVENT_INTERVAL }) {
    const { clamp, log, pay, roll } = core;
    const byId = new Map(COMPANY_EVENTS.map((event) => [event.id, event]));

    function matches(subject, rules) {
      return rules.every(({ field, equals, min, max }) => {
        const value = subject?.[field];
        return (
          (equals === undefined || value === equals) &&
          (min === undefined || (Number.isFinite(value) && value >= min)) &&
          (max === undefined || (Number.isFinite(value) && value <= max))
        );
      });
    }

    function eligible(s, event) {
      if (!s.company || !event.phases.includes(s.company.phase) || event.weight <= 0) return null;
      const { label = [], company = [], board, artist, album, executive } = event.when || {};
      if (!matches(s, label) || !matches(s.company, company)) return null;
      if (board && (!s.company.board || !matches(s.company.board, board))) return null;
      if (
        executive &&
        !Object.values(s.company.departments).some(({ head }) => head && matches(head, executive))
      )
        return null;
      const project =
        album &&
        s.albums.find(
          (p) =>
            !p.released &&
            p.production &&
            matches(p, album) &&
            (!artist || s.artists.some((a) => a.id === p.artist && matches(a, artist))),
        );
      if (album && !project) return null;
      const performer = project
        ? s.artists.find((a) => a.id === project.artist)
        : artist && s.artists.find((a) => matches(a, artist));
      if (artist && !performer) return null;
      return { artist: performer?.id, album: project?.id };
    }

    function select(s) {
      const entries = COMPANY_EVENTS.map((event) => ({ event, target: eligible(s, event) })).filter(
        ({ target }) => target,
      );
      if (!entries.length) return null;
      const total = entries.reduce((n, { event }) => n + event.weight, 0);
      let pick = roll(s, "company-events:draw") * total;
      const { event, target } = entries.find(({ event }) => (pick -= event.weight) < 0);
      return { ...target, eventId: event.id, dueWeek: s.week + event.deadlineWeeks };
    }

    function effect(s, entry, effects) {
      const {
        cash = 0,
        fame = 0,
        confidence = 0,
        morale = 0,
        artistFame = 0,
        delayAlbum = 0,
        loan,
      } = effects || {};
      const { reputation = 0, relation = 0, brand } = effects || {};
      if (reputation) s.reputation = clamp(s.reputation + reputation);
      s.cash += cash;
      s.fame = Math.max(0, s.fame + fame);
      const board = s.company.board;
      if (board && confidence) {
        board.eventConfidence = clamp((board.eventConfidence || 0) + confidence, -100, 100);
        if (Number.isFinite(board.confidence)) board.confidence = clamp(board.confidence + confidence);
      }
      const artist = s.artists.find((a) => a.id === entry.artist);
      if (artist) {
        artist.morale = clamp(artist.morale + morale);
        artist.fame = clamp(artist.fame + artistFame);
        if (relation) core.api?.()?.shiftRelation?.(s, artist, relation);
        if (brand) core.api?.()?.addShock?.(s, artist, brand.mult, brand.weeks, `${artist.name} in the news`);
      }
      const album = s.albums.find((p) => p.id === entry.album && !p.released && p.production);
      if (album && delayAlbum) {
        album.production.cooldown += delayAlbum;
        album.production.releaseReady = false;
        album.remaining += delayAlbum;
      }
      if (loan && !s.company.loan) {
        s.company.loan = { amount: loan.amount, balance: loan.amount, payment: loan.payment, week: s.week };
        s.cash += loan.amount;
      }
    }

    function enqueue(s, entry) {
      const event = byId.get(entry.eventId);
      const options = event.choices.map(({ label, hint, cost }, choice) => ({ label, hint, cost, choice }));
      options.push({
        label: entry.dueWeek === s.week + 1 ? "Let the deadline pass" : "Decide next week",
        hint: `If the deadline passes: ${event.choices[event.expiryChoice].label}.`,
        defer: true,
      });
      s.eventQueue.push({
        ...entry,
        type: "companyEvent",
        kind: event.kind,
        title: event.title,
        body: `${event.body} Deadline in ${entry.dueWeek - s.week} week(s).`,
        options,
      });
    }

    function available(s, option, entry) {
      const choice = byId.get(entry.eventId)?.choices[option.choice];
      if (!s.company) return false;
      if (option.defer) return true;
      return (
        !!choice &&
        (choice.cost || 0) <= Math.max(0, s.cash) &&
        (!s.company.loan || (!choice.effects?.loan && !choice.failure?.loan))
      );
    }

    function resolve(s, entry, option) {
      if (option.defer) {
        const { eventId, dueWeek, artist, album } = entry;
        (s.company.deferredEvents ??= []).push({ eventId, dueWeek, artist, album });
        return;
      }
      const event = byId.get(entry.eventId);
      const choice = event.choices[option.choice];
      if (choice.cost) pay(s, choice.cost);
      const succeeded = choice.chance === undefined || roll(s, "company-events:choice") < choice.chance;
      effect(s, entry, succeeded ? choice.effects : choice.failure);
      log(s, `${event.title}: ${choice.label}.${succeeded ? "" : " The plan fell through."}`);
    }

    function expire(s) {
      const deferred = s.company?.deferredEvents;
      if (!deferred?.length) return;
      s.company.deferredEvents = deferred.filter((entry) => entry.dueWeek > s.week);
      if (!s.company.deferredEvents.length) delete s.company.deferredEvents;
      for (const entry of deferred) {
        if (entry.dueWeek > s.week) continue;
        const event = byId.get(entry.eventId);
        const choice = event.choices[event.expiryChoice];
        effect(s, entry, choice.failure || choice.effects);
        log(s, `${event.title}: deadline missed. ${choice.label}.`);
      }
    }

    function queue(s) {
      if (!s.company || s.finished) return;
      const deferred = s.company.deferredEvents || [];
      for (const entry of deferred) enqueue(s, entry);
      if (deferred.length) delete s.company.deferredEvents;
      if (s.week % COMPANY_EVENT_INTERVAL !== 0) return;
      const entry = select(s);
      if (entry && !deferred.some(({ eventId }) => eventId === entry.eventId)) enqueue(s, entry);
    }

    function validSave(s) {
      if (!s.company) return true;
      const validEntry = (e) =>
        !!e &&
        byId.has(e.eventId) &&
        Number.isInteger(e.dueWeek) &&
        e.dueWeek > s.week &&
        [e.artist, e.album].every((id) => id == null || Number.isInteger(id));
      const deferred = s.company.deferredEvents;
      if (deferred !== undefined && (!Array.isArray(deferred) || !deferred.every(validEntry))) return false;
      if (!Array.isArray(s.eventQueue)) return false;
      return [s.event, ...s.eventQueue].every(
        (e) =>
          e?.type !== "companyEvent" ||
          (validEntry(e) &&
            Array.isArray(e.options) &&
            e.options.length > 0 &&
            e.options.every(
              (o) =>
                o &&
                (o.defer === true || (Number.isInteger(o.choice) && !!byId.get(e.eventId).choices[o.choice])),
            )),
      );
    }

    return { available, eligible, expire, queue, resolve, validSave };
  }
  root.GoatSystems = Object.assign(root.GoatSystems || {}, { events: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
