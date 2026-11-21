// The catalog (3.0): albums past their first 26 weeks earn small weekly royalties, classics more,
// and bring offers: deluxe editions, anniversary reissues, samples, syncs, greatest hits and fan
// mail. The Vault (trophy case) lists them. Classic runs have no catalog.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { CATALOG_STATUS: ST, ROYALTIES, OFFERS: O, SYNC_CLIENTS, SAMPLERS } = D;
    const { clamp, log, pay, roll, requireAction } = core;
    const KINDS = ["deluxe", "reissue", "sample", "sync", "fanMail", "hits"];
    const era = (s, k) => core.api().eraFactor?.(s, k) ?? 1;
    const dollars = (n) => "$" + Math.round(n).toLocaleString("en-US");
    const signed = (s, id) => s.artists.find((a) => a.id === id) || null;

    /** fresh, catalog or classic for a released album; null before release. */
    function albumStatus(s, p) {
      if (!p?.released) return null;
      const weeks = s.week - p.releaseWeek;
      if (weeks < ST.freshWeeks) return "fresh";
      return weeks >= ST.classicWeeks && p.quality >= ST.classicQuality && p.hit ? "classic" : "catalog";
    }
    /** An album's weekly catalog royalty now. */
    function royalty(s, p) {
      const st = albumStatus(s, p);
      if ((st !== "catalog" && st !== "classic") || (s.company?.phase || 0) < ROYALTIES.phase) return 0;
      return Math.round(
        (p.gross || 0) *
          ROYALTIES.perGross *
          era(s, "catalog") *
          (st === "classic" ? ROYALTIES.classicMult : 1),
      );
    }
    function init(s) {
      if (!s.company || s.company.catalog) return s;
      // Older saves: albums are classed by their age and quality as soon as the save loads.
      s.company.catalog = { offers: [], flows: [], done: { reissue: [], hits: [] }, earned: {} };
      return s;
    }
    const C = (s) => s.company.catalog;
    function earn(s, n) {
      if (!n) return 0;
      const y = String(core.operatingYear(s.week));
      C(s).earned[y] = (C(s).earned[y] || 0) + n;
      return n;
    }

    // ---- Offers ----
    function offer(s, kind, p, extra = {}) {
      const a = signed(s, extra.artist ?? p?.artist),
        o = {
          id: s.nextId++,
          kind,
          album: p?.id ?? null,
          artist: extra.artist ?? p?.artist ?? null,
          week: s.week,
          expires: s.week + O.expires,
          ...extra,
        };
      Object.assign(o, describe(s, o, p, a));
      C(s).offers.push(o);
      s.notifications.push({ id: s.nextId++, kind: "offer", title: o.title, body: o.body, week: s.week });
      return o;
    }
    /** The title, body and the accept hint, from the offer's numbers. */
    function describe(s, o, p, a) {
      const title = p ? `“${p.title}”` : "";
      if (o.kind === "deluxe") {
        o.cost = O.deluxe.costPerPhase * s.company.phase;
        return {
          title: `A deluxe edition of ${title}`,
          body: `${a.name} has a few new songs that would fit ${title}. Two weeks in the studio and it goes back on sale.`,
          hint: `Costs ${dollars(o.cost)}; ${a.name} energy −${O.deluxe.energy}. About ${dollars(flowFor(s, p, O.deluxe, "sales") * O.deluxe.weeks)} over ${O.deluxe.weeks} weeks.`,
        };
      }
      if (o.kind === "reissue") {
        o.cost = O.reissue.costPerPhase * s.company.phase;
        return {
          title: `${o.years}th anniversary of ${title}`,
          body: `${title} turns ${o.years}. A remastered reissue would bring it back to the shops.${a ? "" : " Its artist has left the label; how they talk about it decides the press."}`,
          hint: `Costs ${dollars(o.cost)}. About ${dollars(flowFor(s, p, O.reissue, "sales") * O.reissue.weeks)} over ${O.reissue.weeks} weeks.`,
        };
      }
      if (o.kind === "sample") {
        o.fee = Math.round(p.quality * O.sample.feePerQuality * era(s, "licensing"));
        return {
          title: `${o.by} wants to sample ${title}`,
          body: `${o.by}${o.rival ? ` (${o.rivalName})` : ""} wants a hook from ${title} for a new single.`,
          hint: `Clear it: ${dollars(o.fee)} now and ${dollars(o.fee * O.sample.royaltyShare)} a week for ${O.sample.royaltyWeeks} weeks.${o.rival ? ` Refusing costs ${-O.sample.refuseStanding} standing with ${o.rivalName}.` : ""}`,
        };
      }
      if (o.kind === "sync") {
        o.fee = Math.round(
          p.quality *
            O.sync.feePerQuality *
            era(s, "licensing") *
            (albumStatus(s, p) === "classic" ? O.sync.classicMult : 1),
        );
        return {
          title: `${o.client[0].toUpperCase() + o.client.slice(1)} wants ${title}`,
          body: `The makers of ${o.client} want a song from ${title}.`,
          hint: `A one-off fee of ${dollars(o.fee)}.`,
        };
      }
      if (o.kind === "fanMail") {
        const F = O.fanMail[o.ask];
        o.cost = F.cost || 0;
        return o.ask === "remix"
          ? {
              title: `Fans want a remix from ${title}`,
              body: `Letters keep arriving asking for a new mix of the best song on ${title}.`,
              hint: `Costs ${dollars(o.cost)}. Fame +${F.fame}${a ? `, ${a.name} fans +${F.fans}` : ""}.`,
            }
          : {
              title: `Fans ask for ${title} live`,
              body: `Fans want to hear ${title} played in full. ${a ? `${a.name} likes the idea.` : "Its artist has moved on, but the label can say thank you."}`,
              hint: `Free. Reputation +${F.reputation}${a ? `, ${a.name} morale +${F.morale}` : ""}.`,
            };
      }
      // Greatest hits.
      o.cost = O.hits.costPerPhase * s.company.phase;
      const albums = released(s, o.artist);
      return {
        title: `A greatest hits for ${a.name}`,
        body: `${a.name} has ${albums.length} albums out. A best-of would put them all back on the shelves.`,
        hint: `Costs ${dollars(o.cost)}. About ${dollars(hitsFlow(s, o.artist) * O.hits.weeks)} over ${O.hits.weeks} weeks.`,
      };
    }
    const released = (s, artistId) => s.albums.filter((p) => p.released && p.artist === artistId);
    function flowFor(s, p, rule, stream) {
      return Math.round((((p.gross || 0) * rule.share) / rule.weeks) * era(s, stream));
    }
    function hitsFlow(s, artistId) {
      const gross = released(s, artistId).reduce((n, p) => n + (p.gross || 0), 0);
      return Math.round(((gross * O.hits.share) / O.hits.weeks) * era(s, "sales"));
    }
    const open = (s, kind, key, value) => C(s).offers.some((o) => o.kind === kind && o[key] === value);
    function randomOffer(s) {
      const old = s.albums.filter((p) => ["catalog", "classic"].includes(albumStatus(s, p)));
      if (!old.length) return null;
      const pick = (list) => list[Math.floor(roll(s, "catalog") * list.length)];
      const deluxe = old.filter(
        (p) =>
          p.quality >= O.deluxe.minQuality &&
          s.week - p.releaseWeek < O.deluxe.maxAgeWeeks &&
          !p.deluxe &&
          signed(s, p.artist) &&
          !open(s, "deluxe", "album", p.id),
      );
      const kinds = [
        ["deluxe", deluxe.length ? O.deluxe.weight : 0],
        ["sample", O.sample.weight],
        ["sync", O.sync.weight],
        ["fanMail", O.fanMail.weight],
      ];
      let r = roll(s, "catalog") * kinds.reduce((n, [, w]) => n + w, 0);
      const kind = kinds.find(([, w]) => (r -= w) < 0)[0];
      if (kind === "deluxe") return offer(s, "deluxe", pick(deluxe));
      const p = pick(old);
      if (kind === "sync") return offer(s, "sync", p, { client: pick(SYNC_CLIENTS) });
      if (kind === "fanMail")
        return offer(s, "fanMail", p, { ask: roll(s, "catalog") < 0.5 ? "remix" : "tour" });
      // A sample request: half come from a rival label's roster.
      const rivals = core.api().rivalsInfo?.(s) || [];
      if (rivals.length && roll(s, "catalog") < 0.5) {
        const r = pick(rivals),
          who = r.roster.length ? pick(r.roster).name : r.ceo;
        return offer(s, "sample", p, { by: who, rival: r.id, rivalName: r.name });
      }
      return offer(s, "sample", p, { by: pick(SAMPLERS) });
    }

    function weekly(s) {
      if (!s.company?.catalog) return 0;
      const c = C(s);
      let total = 0;
      for (const p of s.albums) total += royalty(s, p);
      for (const f of c.flows) if (s.week >= f.from && s.week < f.until) total += f.perWeek;
      c.flows = c.flows.filter((f) => s.week + 1 < f.until);
      c.offers = c.offers.filter((o) => o.expires > s.week);
      // Anniversaries for classics, once each.
      for (const p of s.albums) {
        if (albumStatus(s, p) !== "classic") continue;
        for (const years of O.reissue.years) {
          const key = `${p.id}:${years}`;
          if (s.week - p.releaseWeek === years * 52 && !c.done.reissue.includes(key)) {
            c.done.reissue.push(key);
            offer(s, "reissue", p, { years });
          }
        }
      }
      // A greatest hits, once per signed artist.
      for (const a of s.artists)
        if (
          released(s, a.id).length >= O.hits.albums &&
          !c.done.hits.includes(a.id) &&
          !open(s, "hits", "artist", a.id)
        )
          offer(s, "hits", null, { artist: a.id });
      if (c.offers.length < O.max && roll(s, "catalog") < O.chance) randomOffer(s);
      s.cash += total;
      return earn(s, total);
    }

    /** Takes or turns down a Vault offer. */
    function answerOffer(s, offerId, accept) {
      requireAction(s);
      const c = C(s),
        o = c.offers.find((x) => x.id === Number(offerId));
      if (!o) throw Error("That offer is gone.");
      const p = s.albums.find((x) => x.id === o.album),
        a = signed(s, o.artist);
      if (!accept) {
        c.offers = c.offers.filter((x) => x !== o);
        if (o.kind === "hits") c.done.hits.push(o.artist);
        if (o.kind === "sample" && o.rival) {
          core.api().shiftRivalStanding?.(s, o.rival, O.sample.refuseStanding);
          log(s, `${o.rivalName} is not pleased: the sample of ${p.title} was refused.`);
        }
        return null;
      }
      const flow = (perWeek, weeks, from = s.week + 1) =>
        c.flows.push({ album: o.album, kind: o.kind, perWeek, from, until: from + weeks });
      if (o.kind === "deluxe") {
        if (!a) throw Error("The artist has left the label.");
        if (a.energy < O.deluxe.energy) throw Error(`${a.name} needs ${O.deluxe.energy} energy.`);
        pay(s, o.cost);
        a.energy = clamp(a.energy - O.deluxe.energy);
        p.deluxe = s.week;
        flow(flowFor(s, p, O.deluxe, "sales"), O.deluxe.weeks, s.week + O.deluxe.studioWeeks);
        log(s, `${a.name} heads back in to record a deluxe edition of ${p.title}.`);
      } else if (o.kind === "reissue") {
        pay(s, o.cost);
        flow(flowFor(s, p, O.reissue, "sales"), O.reissue.weeks);
        if (a) a.fans = clamp((a.fans || 0) + O.reissue.fans, 0, 1e9);
        else {
          const good = roll(s, "catalog") < O.reissue.goodPress;
          s.reputation = clamp(s.reputation + (good ? O.reissue.reputation : -O.reissue.reputation));
          log(
            s,
            good
              ? `The press loves the ${p.title} reissue; its former artist calls it a gift to the fans.`
              : `The ${p.title} reissue gets bad press: its former artist calls it a cash grab.`,
          );
        }
      } else if (o.kind === "sample") {
        s.cash += earn(s, o.fee);
        flow(Math.round(o.fee * O.sample.royaltyShare), O.sample.royaltyWeeks);
        log(s, `${o.by} clears a sample of ${p.title}.`);
      } else if (o.kind === "sync") {
        s.cash += earn(s, o.fee);
        log(s, `${p.title} is licensed to ${o.client}.`);
      } else if (o.kind === "fanMail") {
        const F = O.fanMail[o.ask];
        if (o.ask === "remix") {
          pay(s, o.cost);
          s.fame = (s.fame || 0) + F.fame;
          if (a) a.fans = clamp((a.fans || 0) + F.fans, 0, 1e9);
        } else {
          s.reputation = clamp(s.reputation + F.reputation);
          if (a) a.morale = clamp((a.morale ?? 50) + F.morale);
        }
      } else if (o.kind === "hits") {
        if (!a) throw Error("The artist has left the label.");
        pay(s, o.cost);
        c.done.hits.push(a.id);
        flow(hitsFlow(s, a.id), O.hits.weeks);
        log(s, `${a.name}'s greatest hits goes on sale.`);
      }
      c.offers = c.offers.filter((x) => x !== o);
      return o;
    }

    /** What the Vault shows. */
    function vaultInfo(s) {
      const c = s.company?.catalog;
      if (!c) return null;
      const rows = s.albums
        .filter((p) => p.released)
        .map((p) => ({ p, status: albumStatus(s, p), weekly: royalty(s, p) }));
      const count = (k) => rows.filter((r) => r.status === k).length;
      return {
        offers: c.offers,
        flows: c.flows.filter((f) => s.week < f.until),
        rows: rows.toSorted((x, y) => y.weekly - x.weekly || y.p.releaseWeek - x.p.releaseWeek),
        counts: { fresh: count("fresh"), catalog: count("catalog"), classic: count("classic") },
        weekly: rows.reduce((n, r) => n + r.weekly, 0),
        earned: c.earned,
      };
    }

    function validSave(s) {
      const c = s.company?.catalog;
      if (c === undefined) return true;
      return (
        !!c &&
        Array.isArray(c.offers) &&
        c.offers.every(
          (o) => o && KINDS.includes(o.kind) && Number.isInteger(o.id) && Number.isInteger(o.expires),
        ) &&
        Array.isArray(c.flows) &&
        c.flows.every(
          (f) => Number.isFinite(f.perWeek) && Number.isInteger(f.from) && Number.isInteger(f.until),
        ) &&
        Array.isArray(c.done?.reissue) &&
        Array.isArray(c.done?.hits) &&
        typeof c.earned === "object"
      );
    }

    return {
      init,
      weekly,
      validSave,
      api: {
        CATALOG_STATUS: ST,
        CATALOG_OFFERS: O,
        CATALOG_ROYALTIES: ROYALTIES,
        albumStatus,
        catalogRoyalty: royalty,
        answerOffer,
        vaultInfo,
        catalogOffer: (s, kind, albumId, extra) =>
          offer(
            s,
            kind,
            s.albums.find((p) => p.id === albumId),
            extra,
          ),
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { catalog: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
