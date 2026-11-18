// People panels for CEO runs: the team and mood section on each artist, and the label's departments.
"use strict";

/** The artist and team role whose chooser is open, or null. */
let teamPick = null;

function chemTag(c) {
  const tip = c.parts.map((x) => `${x.name} ${x.value >= 0 ? "+" : ""}${x.value}`).join(", ");
  return `<span class="chem ${c.value >= 1.15 ? "good" : c.value < 0.9 ? "poor" : ""}" title="${esc(tip)}">Chemistry ×${c.value.toFixed(2)}</span>`;
}
function memberLine(m) {
  return `${esc(m.name)} · skill ${m.skill} · ${esc(m.genres.join(", "))} · ${esc(m.style)} · ${money(m.salary)}/week`;
}

/* ---------------- Artist: team and mood ---------------- */

const STATUS_TEXT = { met: "Met", ignored: "Ignored", neutral: "Not judged yet" };
function moodCard(a) {
  const m = G.artistMood(state, a),
    traits = Object.entries(m.traits)
      .map(
        ([k, v]) =>
          `<li><span>${k === "workRate" ? "Work rate" : k[0].toUpperCase() + k.slice(1)}</span><b>${v}</b></li>`,
      )
      .join(""),
    change = m.weekly > 0 ? `+${m.weekly}` : String(m.weekly);
  return `<article class="card mood-card ${m.unhappy ? "unhappy" : ""}"><span class="tag">WANTS ${esc(m.wantName.toUpperCase())} · ${STATUS_TEXT[m.status].toUpperCase()}</span><h3>Morale ${Math.round(a.morale ?? 75)}/100 <small>${change} a week</small></h3><ul class="traits">${traits}</ul>${m.unhappy ? `<p class="warn">Unhappy. With nothing left on the contract, below ${m.walkOutBelow} morale they walk out.</p>` : ""}<button data-action="payBonus" data-artist="${a.id}" ${disable(blocked() || state.cash < G.bonusCost(a))}>Pay a bonus · ${money(G.bonusCost(a))}</button></article>`;
}
function teamChooser(a, role) {
  const team = state.company.team,
    pool = team.pool.filter((m) => m.role === role.id && !m.artists.includes(a.id)),
    current = G.teamMember(state, a.id, role.id),
    candidates = team.candidates[role.id] || [],
    row = (m, button) =>
      `<li class="team-choice"><div><b>${esc(m.name)}</b><small>${memberLine(m)}${m.artists.length ? ` · also with ${esc(state.artists.find((x) => x.id === m.artists[0])?.name || "another artist")}, works at ${Math.round(G.TEAM_POOL.sharedEffect * 100)}% for both` : ""}</small></div>${chemTag(G.chemistry(state, a, m))}${button}</li>`;
  const poolRows = pool
      .map((m) =>
        row(
          m,
          `<button class="primary" data-action="teamAssign" data-member="${m.id}" data-artist="${a.id}" ${disable(blocked() || m.artists.length >= G.TEAM_POOL.maxArtists)}>Assign</button>`,
        ),
      )
      .join(""),
    candidateRows = candidates
      .map((m) =>
        row(
          m,
          `<button data-action="teamHire" data-role="${role.id}" data-candidate="${m.id}" data-artist="${a.id}" ${disable(blocked() || state.cash < m.salary * G.TEAM_POOL.signWeeks)}>Hire and assign · ${money(m.salary * G.TEAM_POOL.signWeeks)}</button>`,
        ),
      )
      .join(""),
    search = G.TEAM_POOL.recruitCost * state.company.phase;
  return `<div class="card team-chooser"><span class="tag">CHOOSE A ${esc(role.name.toUpperCase())}</span><h3>${current ? `Replace ${esc(current.name)}` : `${esc(a.name)} needs a ${esc(role.name.toLowerCase())}`}</h3><p class="muted">${esc(role.text)} Chemistry multiplies their skill and is shown before you confirm.</p><h4>On the label</h4><ul class="team-list">${poolRows || '<li class="empty">Nobody free in this role.</li>'}</ul><h4>Candidates</h4><ul class="team-list">${candidateRows || '<li class="empty">Run a search to see candidates.</li>'}</ul><div class="actions"><button data-action="teamRecruit" data-role="${role.id}" ${disable(blocked() || state.cash < search)}>Run a search · ${money(search)}</button><button data-action="teamCancel">Close</button></div></div>`;
}
function teamSection(a) {
  if (!state.company?.team) return "";
  const slots = G.artistTeam(state, a.id)
      .map(({ role, member: m, chemistry, share }) => {
        const body = m
          ? `<b>${esc(m.name)}</b><small>Skill ${m.skill} · chemistry ×${chemistry.toFixed(2)}${share < 1 ? ` · shared, ${Math.round(share * 100)}%` : ""}</small>`
          : '<small class="muted">Empty</small>';
        return `<li class="team-slot ${m ? "" : "open"}"><span class="tag">${esc(role.name.toUpperCase())}</span><div>${body}</div><div class="actions"><button data-action="teamPick" data-artist="${a.id}" data-role="${role.id}" ${disable(blocked())}>${m ? "Change" : "Assign"}</button>${m ? `<button data-action="teamUnassign" data-member="${m.id}" data-artist="${a.id}" ${disable(blocked())}>Remove</button>` : ""}</div></li>`;
      })
      .join(""),
    locked = G.TEAM_ROLES.filter((r) => r.phase > state.company.phase)
      .map((r) => `${esc(r.name)} (phase ${r.phase})`)
      .join(", "),
    picked = teamPick?.artist === a.id && G.TEAM_ROLES.find((r) => r.id === teamPick.role);
  return section(
    "sec-people",
    `<h2>Team and mood</h2>${moodCard(a)}<ul class="team-slots">${slots}</ul>${locked ? `<p class="muted">Later: ${locked}.</p>` : ""}${picked ? teamChooser(a, picked) : ""}`,
  );
}

/* ---------------- Departments ---------------- */

function departmentList() {
  const rows = G.DEPARTMENTS.map((d) => {
    const open = G.departmentOpen(state, d.id),
      x = state.company.departments[d.id];
    return `<li><button class="dept-row ${open ? "" : "locked"}" data-tab="dept:${d.id}"><b>${esc(d.name)}</b><small>${open ? (x.head ? `${esc(x.head.name)} · capacity ${G.capacity(state, d.id)}` : "No head yet") : `Opens at phase ${d.phase}`}</small></button></li>`;
  }).join("");
  return `<h2>Departments</h2><p class="muted">Each department's head carries its work. Staff add capacity. Weekly payroll ${money(G.departmentPay(state))}.</p><ul class="dept-list">${rows}</ul>`;
}
function departmentSheet(d) {
  const x = state.company.departments[d.id],
    open = G.departmentOpen(state, d.id);
  if (!open)
    return `<p class="place-intro">${esc(d.text)}</p><div class="empty">${esc(d.name)} opens at phase ${d.phase}, ${esc(G.PHASES[d.phase - 1].name)}.</div>`;
  const h = x.head,
    severance = h ? h.salary * G.EXEC_PAY.severanceWeeks : 0,
    head = h
      ? `<article class="card exec-card"><span class="tag">${esc(d.head.toUpperCase())}</span><h3>${esc(h.name)}</h3><ul class="traits"><li><span>Skill</span><b>${h.skill}</b></li><li><span>Ambition</span><b>${h.ambition}</b></li><li><span>Loyalty</span><b>${h.loyalty}</b></li><li><span>Influence</span><b>${h.influence}</b></li></ul><p class="muted">${money(h.salary)}/week · since week ${h.hiredWeek}</p><button data-action="deptFire" data-dept="${d.id}" ${disable(blocked())}>Let go · ${money(severance)} severance</button></article>`
      : `<div class="empty">No ${esc(d.head)} yet. Run a search to find one.</div>`,
    staffCard = h
      ? `<article class="card"><span class="tag">STAFF · CAPACITY ${G.capacity(state, d.id)}</span><h3>${x.staff} of ${G.maxStaff(state)} staff</h3><p class="muted">${money(G.DEPT_STAFF.salary)}/week each. Capacity is how many projects the department runs a quarter.</p><div class="actions"><button data-action="deptStaffAdd" data-dept="${d.id}" ${disable(blocked() || x.staff >= G.maxStaff(state) || state.cash < G.DEPT_STAFF.hireFee)}>Hire staff · ${money(G.DEPT_STAFF.hireFee)}</button><button data-action="deptStaffRemove" data-dept="${d.id}" ${disable(blocked() || !x.staff)}>Let one go</button></div></article>`
      : "",
    search = G.EXEC_POOL.recruitCost * state.company.phase,
    pool = x.pool
      .map(
        (c) =>
          `<article class="card"><span class="tag">SKILL ${c.skill}</span><h3>${esc(c.name)}</h3><p class="muted">Ambition ${c.ambition} · loyalty ${c.loyalty} · influence ${c.influence}<br>${money(c.salary)}/week</p><button class="primary" data-action="deptHire" data-dept="${d.id}" data-candidate="${c.id}" ${disable(blocked() || !!h || state.cash < c.salary * G.EXEC_PAY.signWeeks)}>Hire · ${money(c.salary * G.EXEC_PAY.signWeeks)}</button></article>`,
      )
      .join("");
  return `<p class="place-intro">${esc(d.text)}</p>${section("sec-head", head)}${staffCard ? section("sec-staff", staffCard) : ""}${section("sec-search", `<h2>Candidates</h2><div class="grid">${pool || '<div class="empty">No candidates on file.</div>'}</div><button data-action="deptRecruit" data-dept="${d.id}" ${disable(blocked() || state.cash < search)}>Run a search · ${money(search)}</button>${h ? '<p class="muted">Let the current head go before hiring another.</p>' : ""}`)}`;
}
function staffSheet(id) {
  if (!state.company?.departments) return null;
  const [kind, key] = String(id).split(/:(.*)/);
  if (kind !== "dept") return null;
  const d = G.DEPARTMENTS.find((x) => x.id === key);
  return d && { title: () => `${d.name} department`, render: () => departmentSheet(d) };
}

GoatUI.click.push((b) => {
  const d = b.dataset;
  switch (d.action) {
    case "teamPick":
      teamPick = { artist: Number(d.artist), role: d.role };
      render();
      return true;
    case "teamCancel":
      teamPick = null;
      render();
      return true;
    case "teamRecruit":
      act(() => G.recruitTeam(state, d.role));
      return true;
    case "teamAssign":
      act(() => {
        G.assignTeam(state, d.member, d.artist);
        teamPick = null;
      });
      return true;
    case "teamHire":
      act(() => {
        const m = G.hireTeam(state, d.role, d.candidate);
        G.assignTeam(state, m.id, d.artist);
        teamPick = null;
      });
      return true;
    case "teamUnassign":
      act(() => G.unassignTeam(state, d.member, d.artist));
      return true;
    case "payBonus":
      act(() => G.payBonus(state, d.artist));
      return true;
    case "deptRecruit":
      act(() => G.recruitExecs(state, d.dept));
      return true;
    case "deptHire":
      act(() => G.hireHead(state, d.dept, d.candidate));
      return true;
    case "deptFire":
      act(() => G.fireHead(state, d.dept));
      return true;
    case "deptStaffAdd":
      act(() => G.addStaff(state, d.dept));
      return true;
    case "deptStaffRemove":
      act(() => G.removeStaff(state, d.dept));
      return true;
  }
  return false;
});

const GoatStaff = { teamSection, departmentList, sheet: staffSheet };
