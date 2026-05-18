const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let teams = [];
let matches = [];
let settings = null;
let currentSection = null;
let adminUnlocked = false;

async function loadData() {
  const { data: s, error: se } = await client.from('settings').select('*').eq('id', 1).single();
  if (se) alert('Erreur settings: ' + se.message);
  settings = s;

  const { data: t, error: te } = await client.from('teams').select('*').order('id');
  if (te) alert('Erreur teams: ' + te.message);
  teams = t || [];

  const { data: m, error: me } = await client.from('matches').select('*').order('scheduled_time').order('court');
  if (me) alert('Erreur matches: ' + me.message);
  matches = m || [];

  renderAll();
}

function show(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  currentSection = id;
  renderAll();
}

function renderAll() {
  renderSubtitle();
  renderTeamSelect();
  renderTeamMatches();
  renderPlanning();
  renderStandings();
  renderAdmin();
  renderBrackets();
  if (currentSection === 'score') loadCourt(false);
}

function renderSubtitle() {
  if (!settings) return;
  document.getElementById('subtitle').innerText =
    `${settings.teams_count} équipes · ${settings.courts_count} terrains · départ ${settings.start_time} · ${settings.match_duration} min + ${settings.break_duration} min`;
}

function scoreText(m) {
  return m.score_a === null || m.score_b === null ? '-' : `${m.score_a} / ${m.score_b}`;
}

function statusText(m) {
  return m.status === 'done'
    ? '<span class="ok">Terminé</span>'
    : '<span class="warn">À jouer</span>';
}

function renderTeamSelect() {
  const sel = document.getElementById('teamSelect');
  if (!sel) return;
  const old = sel.value;
  sel.innerHTML = teams.map(t => `<option>${t.name}</option>`).join('');
  if (old) sel.value = old;
  sel.onchange = renderTeamMatches;
}

function renderTeamMatches() {
  const sel = document.getElementById('teamSelect');
  const div = document.getElementById('teamMatches');
  if (!sel || !div || !teams.length) return;
  const name = sel.value || teams[0].name;
  const list = matches.filter(m => m.team_a === name || m.team_b === name);
  div.innerHTML = list.map(m => `
    <div class="card">
      <b>${m.scheduled_time || ''} — Terrain ${m.court}</b><br>
      ${m.phase} · Poule ${m.pool || '-'}<br>
      ${m.team_a} vs ${m.team_b}<br>
      Score : ${scoreText(m)}<br>
      ${statusText(m)}
    </div>
  `).join('');
}

function renderPlanning() {
  const div = document.getElementById('planningView');
  if (!div) return;
  const court = document.getElementById('courtFilter')?.value || '';
  const phase = document.getElementById('phaseFilter')?.value || '';
  let list = [...matches];
  if (court) list = list.filter(m => String(m.court) === court);
  if (phase) list = list.filter(m => m.phase === phase);
  list.sort((a,b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '') || Number(a.court)-Number(b.court));
  div.innerHTML = `<table>
    <tr><th>Heure</th><th>Terrain</th><th>Phase</th><th>Poule</th><th>Match</th><th>Score</th><th>Statut</th></tr>
    ${list.map(m => `<tr>
      <td>${m.scheduled_time || ''}</td>
      <td>T${m.court}</td>
      <td>${m.phase}</td>
      <td>${m.pool || '-'}</td>
      <td>#${m.id} ${m.team_a} vs ${m.team_b}</td>
      <td>${scoreText(m)}</td>
      <td>${statusText(m)}</td>
    </tr>`).join('')}
  </table>`;
}

function poolStats(phase, pool) {
  const teamNames = new Set();
  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
    teamNames.add(m.team_a); teamNames.add(m.team_b);
  });

  const stats = {};
  [...teamNames].forEach(name => stats[name] = { mj:0, v:0, d:0, diff:0, pm:0, pe:0, score:0 });

  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
    if (m.score_a === null || m.score_b === null) return;
    if (!stats[m.team_a] || !stats[m.team_b]) return;
    const da = m.score_a - m.score_b;
    const db = m.score_b - m.score_a;
    stats[m.team_a].mj++; stats[m.team_b].mj++;
    stats[m.team_a].pm += m.score_a; stats[m.team_a].pe += m.score_b; stats[m.team_a].diff += da;
    stats[m.team_b].pm += m.score_b; stats[m.team_b].pe += m.score_a; stats[m.team_b].diff += db;
    if (m.score_a > m.score_b) {
      stats[m.team_a].v++; stats[m.team_a].score += 10000 + da;
      stats[m.team_b].d++; stats[m.team_b].score += db;
    }
    if (m.score_b > m.score_a) {
      stats[m.team_b].v++; stats[m.team_b].score += 10000 + db;
      stats[m.team_a].d++; stats[m.team_a].score += da;
    }
  });

  return Object.entries(stats).sort((a,b) => b[1].score - a[1].score || b[1].diff - a[1].diff || b[1].pm - a[1].pm);
}

function renderStandings() {
  const div = document.getElementById('standingsView');
  if (!div) return;
  const phases = [...new Set(matches.map(m => m.phase))].filter(p => p.includes('Brassage'));
  let html = '';
  phases.forEach(phase => {
    html += `<h2>${phase}</h2>`;
    const pools = [...new Set(matches.filter(m => m.phase === phase).map(m => m.pool))].sort();
    pools.forEach(pool => {
      const rows = poolStats(phase, pool).map(([name,s],i) => `
        <tr>
          <td>${i+1}</td><td><b>${name}</b></td><td>${s.score}</td><td>${s.mj}</td>
          <td>${s.v}</td><td>${s.d}</td><td>${s.diff}</td><td>${s.pm}</td>
        </tr>
      `).join('');
      html += `<h3>Poule ${pool}</h3>
        <table><tr><th>#</th><th>Équipe</th><th>Score</th><th>MJ</th><th>V</th><th>D</th><th>Diff</th><th>PM</th></tr>${rows}</table>`;
    });
  });
  div.innerHTML = html || '<div class="card">Aucun classement disponible.</div>';
}

function courtFromCode() {
  const code = document.getElementById('courtCode').value.trim().toUpperCase();
  const m = code.match(/^T([1-6])$/);
  return m ? Number(m[1]) : null;
}

function loadCourt(showError = true) {
  const div = document.getElementById('courtView');
  const court = courtFromCode();
  if (!court) {
    if (showError) div.innerHTML = '<div class="card">Code incorrect. Utilise T1 à T6.</div>';
    return;
  }
  const courtMatches = matches
    .filter(m => m.court === court && m.status !== 'done' && m.team_a && m.team_b)
    .sort((a,b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '') || (a.match_order || 0) - (b.match_order || 0));
  const m = courtMatches[0] || matches.filter(m => m.court === court).slice(-1)[0];
  if (!m) {
    div.innerHTML = '<div class="card">Aucun match trouvé pour ce terrain.</div>';
    return;
  }

  if ((m.phase || '').includes('Tableau') || m.bracket) {
    div.innerHTML = `
      <div class="card">
        <b>Terrain ${court} — Match #${m.id}</b><br>
        ${m.scheduled_time || 'Horaire à définir'} · ${m.phase} · ${m.round || ''}
        <h2>${m.team_a || 'À définir'}</h2>
        <div class="score">VS</div>
        <h2>${m.team_b || 'À définir'}</h2>
        <button class="win" onclick="winnerButton(${m.id}, 'a')">${m.team_a} gagne</button>
        <button class="win" onclick="winnerButton(${m.id}, 'b')">${m.team_b} gagne</button>
      </div>
    `;
    return;
  }

  div.innerHTML = `
    <div class="card">
      <b>Terrain ${court} — Match #${m.id}</b><br>
      ${m.scheduled_time || ''} · ${m.phase} · Poule ${m.pool || '-'}<br>
      <h2>${m.team_a}</h2>
      <div class="score">${m.score_a ?? 0} - ${m.score_b ?? 0}</div>
      <h2>${m.team_b}</h2>
      <button onclick="addPoint(${m.id}, 'a')">+1 ${m.team_a}</button>
      <button onclick="addPoint(${m.id}, 'b')">+1 ${m.team_b}</button>
      <button class="secondary" onclick="undoPoint(${m.id})">Annuler dernier point</button>
      <button class="danger" onclick="finishMatch(${m.id})">Fin du match</button>
    </div>
  `;
}

async function addPoint(id, side) {
  const m = matches.find(x => x.id === id);
  const newA = (m.score_a ?? 0) + (side === 'a' ? 1 : 0);
  const newB = (m.score_b ?? 0) + (side === 'b' ? 1 : 0);
  await client.from('matches').update({ score_a: newA, score_b: newB }).eq('id', id);
  await loadData();
}

async function undoPoint(id) {
  const m = matches.find(x => x.id === id);
  if ((m.score_a ?? 0) >= (m.score_b ?? 0) && (m.score_a ?? 0) > 0) {
    await client.from('matches').update({ score_a: (m.score_a ?? 0) - 1 }).eq('id', id);
  } else if ((m.score_b ?? 0) > 0) {
    await client.from('matches').update({ score_b: (m.score_b ?? 0) - 1 }).eq('id', id);
  }
  await loadData();
}

async function finishMatch(id) {
  const m = matches.find(x => x.id === id);
  if ((m.score_a ?? 0) === (m.score_b ?? 0)) {
    alert('Match nul impossible : ajoute un point avant de terminer.');
    return;
  }
  const winner = (m.score_a ?? 0) > (m.score_b ?? 0) ? m.team_a : m.team_b;
  await client.from('matches').update({ status: 'done', winner }).eq('id', id);
  await loadData();
}

function unlockAdmin() {
  const code = document.getElementById('adminCode').value;
  if (code === settings.admin_code) {
    adminUnlocked = true;
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('adminMsg').innerText = 'Admin déverrouillé ✅';
    renderAdmin();
  renderBrackets();
  } else {
    document.getElementById('adminMsg').innerText = 'Code admin incorrect.';
  }
}

function renderAdmin() {
  if (!settings) return;
  document.getElementById('cfgStart').value = settings.start_time || '09:30';
  document.getElementById('cfgDuration').value = settings.match_duration || 12;
  document.getElementById('cfgBreak').value = settings.break_duration || 3;
  document.getElementById('cfgRoundBreak').value = settings.break_between_rounds || 15;
  document.getElementById('cfgCourts').value = settings.courts_count || 6;

  const div = document.getElementById('teamsAdmin');
  if (!div) return;
  div.innerHTML = teams.map(t => `
    <div class="team-edit">
      <span>${t.initial_pool}${String(t.id).padStart(2,'0')}</span>
      <input data-team-id="${t.id}" value="${t.name}" />
    </div>
  `).join('');
}

async function saveSettings() {
  if (!adminUnlocked) return;
  const payload = {
    start_time: document.getElementById('cfgStart').value,
    match_duration: Number(document.getElementById('cfgDuration').value),
    break_duration: Number(document.getElementById('cfgBreak').value),
    break_between_rounds: Number(document.getElementById('cfgRoundBreak').value),
    courts_count: Number(document.getElementById('cfgCourts').value),
    updated_at: new Date().toISOString()
  };
  const { error } = await client.from('settings').update(payload).eq('id', 1);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Configuration sauvegardée ✅';
  await loadData();
}

async function saveTeams() {
  if (!adminUnlocked) return;
  const inputs = [...document.querySelectorAll('[data-team-id]')];
  for (const input of inputs) {
    await client.from('teams').update({ name: input.value }).eq('id', Number(input.dataset.teamId));
  }
  document.getElementById('adminMsg').innerText = 'Noms équipes sauvegardés ✅';
  await loadData();
}

function addMinutes(time, minutes) {
  const [h,m] = time.split(':').map(Number);
  const total = h*60 + m + minutes;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function generateBrassage1Rows() {
  const pairIdx = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
  const rows = [];
  const pools = ['A','B','C','D','E','F'];
  const slotStep = Number(settings.match_duration) + Number(settings.break_duration);

  pools.forEach((pool, poolIndex) => {
    const poolTeams = teams.filter(t => t.initial_pool === pool).sort((a,b) => a.id-b.id).map(t => t.name);
    pairIdx.forEach((pair, slot) => {
      rows.push({
        phase: 'Brassage 1',
        pool,
        court: poolIndex + 1,
        scheduled_time: addMinutes(settings.start_time, slot * slotStep),
        team_a: poolTeams[pair[0]],
        team_b: poolTeams[pair[1]],
        score_a: null,
        score_b: null,
        winner: null,
        status: 'pending'
      });
    });
  });
  return rows;
}

async function regenerateBrassage1() {
  if (!adminUnlocked) return;
  if (!confirm('Régénérer brassage 1 ? Les matchs Brassage 1 existants seront supprimés.')) return;
  await client.from('matches').delete().eq('phase', 'Brassage 1');
  const rows = generateBrassage1Rows();
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Brassage 1 régénéré ✅';
  await loadData();
}

async function resetScores() {
  if (!adminUnlocked) return;
  if (!confirm('Reset tous les scores ?')) return;
  const { error } = await client.from('matches').update({
    score_a: null, score_b: null, winner: null, status: 'pending'
  }).neq('id', 0);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Scores reset ✅';
  await loadData();
}


function getPhasePoolRanking(phase, pool) {
  return poolStats(phase, pool).map(([name, s], index) => ({
    name,
    rank: index + 1,
    score: s.score,
    diff: s.diff,
    pm: s.pm
  }));
}

function getBrassage2StartTime() {
  const slotStep = Number(settings.match_duration) + Number(settings.break_duration);
  const brassage1Duration = 6 * slotStep;
  return addMinutes(settings.start_time, brassage1Duration + Number(settings.break_between_rounds));
}

function generateRoundRobinRows(phase, poolName, court, poolTeams, startTime) {
  const pairIdx = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
  const slotStep = Number(settings.match_duration) + Number(settings.break_duration);
  return pairIdx.map((pair, slot) => ({
    phase,
    pool: poolName,
    court,
    scheduled_time: addMinutes(startTime, slot * slotStep),
    team_a: poolTeams[pair[0]],
    team_b: poolTeams[pair[1]],
    score_a: null,
    score_b: null,
    winner: null,
    status: 'pending'
  }));
}

async function generateBrassage2() {
  if (!adminUnlocked) return;

  const b1Matches = matches.filter(m => m.phase === 'Brassage 1');
  if (b1Matches.length !== 36) {
    document.getElementById('adminMsg').innerText = `Impossible : il faut 36 matchs en Brassage 1, trouvés ${b1Matches.length}.`;
    return;
  }

  const unfinished = b1Matches.filter(m => m.status !== 'done' || m.score_a === null || m.score_b === null);
  if (unfinished.length > 0) {
    document.getElementById('adminMsg').innerText = `Impossible : ${unfinished.length} match(s) de Brassage 1 ne sont pas terminés.`;
    return;
  }

  if (!confirm('Générer le Brassage 2 ? Les matchs Brassage 2 existants seront supprimés.')) return;

  const rankings = {};
  ['A','B','C','D','E','F'].forEach(pool => {
    rankings[pool] = getPhasePoolRanking('Brassage 1', pool);
    if (rankings[pool].length !== 4) {
      throw new Error(`Poule ${pool} invalide : ${rankings[pool].length} équipes classées.`);
    }
  });

  const b2Pools = [
    { name:'G', court:1, source:[['A',1],['B',2],['C',3],['D',4]] },
    { name:'H', court:2, source:[['B',1],['C',2],['D',3],['E',4]] },
    { name:'I', court:3, source:[['C',1],['D',2],['E',3],['F',4]] },
    { name:'J', court:4, source:[['D',1],['E',2],['F',3],['A',4]] },
    { name:'K', court:5, source:[['E',1],['F',2],['A',3],['B',4]] },
    { name:'L', court:6, source:[['F',1],['A',2],['B',3],['C',4]] }
  ];

  const startB2 = getBrassage2StartTime();
  let rows = [];
  b2Pools.forEach(p => {
    const poolTeams = p.source.map(([pool, rank]) => rankings[pool][rank-1].name);
    rows.push(...generateRoundRobinRows('Brassage 2', p.name, p.court, poolTeams, startB2));
  });

  await client.from('matches').delete().eq('phase', 'Brassage 2');
  const { error } = await client.from('matches').insert(rows);

  document.getElementById('adminMsg').innerText = error
    ? error.message
    : `Brassage 2 généré ✅ Départ ${startB2}, ${rows.length} matchs créés.`;
  await loadData();
}



function aggregatePhaseStats(phase) {
  const stats = {};
  teams.forEach(t => stats[t.name] = { score:0, diff:0, pm:0, v:0, d:0, mj:0 });
  matches.filter(m => m.phase === phase).forEach(m => {
    if (m.score_a === null || m.score_b === null) return;
    if (!stats[m.team_a]) stats[m.team_a] = { score:0, diff:0, pm:0, v:0, d:0, mj:0 };
    if (!stats[m.team_b]) stats[m.team_b] = { score:0, diff:0, pm:0, v:0, d:0, mj:0 };
    const da = m.score_a - m.score_b;
    const db = m.score_b - m.score_a;
    stats[m.team_a].mj++; stats[m.team_b].mj++;
    stats[m.team_a].pm += m.score_a; stats[m.team_b].pm += m.score_b;
    stats[m.team_a].diff += da; stats[m.team_b].diff += db;
    if (m.score_a > m.score_b) { stats[m.team_a].v++; stats[m.team_b].d++; stats[m.team_a].score += 10000 + da; stats[m.team_b].score += db; }
    if (m.score_b > m.score_a) { stats[m.team_b].v++; stats[m.team_a].d++; stats[m.team_b].score += 10000 + db; stats[m.team_a].score += da; }
  });
  return stats;
}

function globalRanking() {
  const b2 = aggregatePhaseStats('Brassage 2');
  const b1 = aggregatePhaseStats('Brassage 1');
  return teams.map(t => ({
    name: t.name,
    b2Score: b2[t.name]?.score ?? 0,
    b1Score: b1[t.name]?.score ?? 0,
    b2Diff: b2[t.name]?.diff ?? 0,
    b2Pm: b2[t.name]?.pm ?? 0
  })).sort((a,b) =>
    b.b2Score - a.b2Score ||
    b.b1Score - a.b1Score ||
    b.b2Diff - a.b2Diff ||
    b.b2Pm - a.b2Pm
  );
}

function renderBrackets() {
  const rankDiv = document.getElementById('globalRankingView');
  const bracketDiv = document.getElementById('bracketsView');
  if (!rankDiv || !bracketDiv) return;

  const ranking = globalRanking();
  rankDiv.innerHTML = `<h3>Classement général provisoire</h3><table>
    <tr><th>#</th><th>Équipe</th><th>B2</th><th>B1</th><th>Diff B2</th></tr>
    ${ranking.map((r,i) => `<tr><td>${i+1}</td><td><b>${r.name}</b></td><td>${r.b2Score}</td><td>${r.b1Score}</td><td>${r.b2Diff}</td></tr>`).join('')}
  </table>`;

  const bracketMatches = matches.filter(m => m.bracket).sort((a,b) =>
    (a.bracket || '').localeCompare(b.bracket || '') ||
    (a.match_order || 0) - (b.match_order || 0)
  );

  if (!bracketMatches.length) {
    bracketDiv.innerHTML = '<div class="card">Aucun tableau généré pour le moment.</div>';
    return;
  }

  const groups = {};
  bracketMatches.forEach(m => {
    const key = `${m.bracket} — ${m.round}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  bracketDiv.innerHTML = Object.entries(groups).map(([title, list]) => `
    <div class="bracket-title">${title}</div>
    ${list.map(m => `<div class="card">
      <span class="seed">Match ${m.match_order} · Terrain ${m.court || '-'} · ${m.scheduled_time || 'Horaire à définir'}</span><br>
      <b>${m.team_a || 'À définir'}</b> vs <b>${m.team_b || 'À définir'}</b><br>
      Gagnant : ${m.winner || '-'} · ${statusText(m)}
    </div>`).join('')}
  `).join('');
}

function bracketRowsFromRanking(ranking) {
  const mainSeeds = ranking.slice(0,16).map(x => x.name);
  const consSeeds = ranking.slice(16,24).map(x => x.name);
  const rows = [];

  const mainPairs = [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
  mainPairs.forEach((p, idx) => {
    rows.push({
      phase:'Tableau principal', bracket:'Principal', round:'1/8 finale', match_order: idx+1,
      court: (idx % 6) + 1, scheduled_time: null,
      team_a: mainSeeds[p[0]-1], team_b: mainSeeds[p[1]-1],
      status:'pending', next_match_order: 9 + Math.floor(idx/2), next_slot: idx % 2 === 0 ? 'A' : 'B'
    });
  });

  // Quarts 9-12
  for (let i=0;i<4;i++) rows.push({
    phase:'Tableau principal', bracket:'Principal', round:'Quart', match_order: 9+i,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending', next_match_order: 13 + Math.floor(i/2), next_slot: i % 2 === 0 ? 'A' : 'B'
  });

  // Demis 13-14, losers to 16
  for (let i=0;i<2;i++) rows.push({
    phase:'Tableau principal', bracket:'Principal', round:'Demi', match_order: 13+i,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending', next_match_order: 15, next_slot: i === 0 ? 'A' : 'B',
    loser_next_match_order: 16, loser_next_slot: i === 0 ? 'A' : 'B'
  });

  rows.push({
    phase:'Tableau principal', bracket:'Principal', round:'Finale', match_order: 15,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending'
  });
  rows.push({
    phase:'Tableau principal', bracket:'Principal', round:'3e place', match_order: 16,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending'
  });

  const consPairs = [[17,24],[20,21],[19,22],[18,23]];
  consPairs.forEach((p, idx) => {
    rows.push({
      phase:'Consolante', bracket:'Consolante', round:'Quart', match_order: 101+idx,
      court: ((idx+2) % 6) + 1, scheduled_time: null,
      team_a: ranking[p[0]-1].name, team_b: ranking[p[1]-1].name,
      status:'pending', next_match_order: 105 + Math.floor(idx/2), next_slot: idx % 2 === 0 ? 'A' : 'B'
    });
  });
  for (let i=0;i<2;i++) rows.push({
    phase:'Consolante', bracket:'Consolante', round:'Demi', match_order: 105+i,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending', next_match_order: 107, next_slot: i === 0 ? 'A' : 'B'
  });
  rows.push({
    phase:'Consolante', bracket:'Consolante', round:'Finale', match_order: 107,
    court: null, scheduled_time: null, team_a:'À définir', team_b:'À définir',
    status:'pending'
  });

  return rows;
}

async function generateBrackets() {
  if (!adminUnlocked) return;

  const b2Matches = matches.filter(m => m.phase === 'Brassage 2');
  if (b2Matches.length !== 36) {
    document.getElementById('adminMsg').innerText = `Impossible : il faut 36 matchs en Brassage 2, trouvés ${b2Matches.length}.`;
    return;
  }
  const unfinished = b2Matches.filter(m => m.status !== 'done' || m.score_a === null || m.score_b === null);
  if (unfinished.length > 0) {
    document.getElementById('adminMsg').innerText = `Impossible : ${unfinished.length} match(s) de Brassage 2 ne sont pas terminés.`;
    return;
  }

  if (!confirm('Générer les tableaux ? Les tableaux existants seront supprimés.')) return;

  const ranking = globalRanking();
  const rows = bracketRowsFromRanking(ranking);

  await client.from('matches').delete().in('phase', ['Tableau principal','Consolante']);
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : `Tableaux générés ✅ ${rows.length} matchs créés.`;
  await loadData();
}

async function winnerButton(id, side) {
  const m = matches.find(x => x.id === id);
  if (!m || !m.bracket) return;

  const winner = side === 'a' ? m.team_a : m.team_b;
  const loser = side === 'a' ? m.team_b : m.team_a;

  await client.from('matches').update({ winner, status:'done' }).eq('id', id);

  if (m.next_match_order) {
    const next = matches.find(x => x.match_order === m.next_match_order && x.bracket === m.bracket);
    if (next) {
      const payload = {};
      if (m.next_slot === 'A') payload.team_a = winner;
      if (m.next_slot === 'B') payload.team_b = winner;
      await client.from('matches').update(payload).eq('id', next.id);
    }
  }

  if (m.loser_next_match_order) {
    const nextLoser = matches.find(x => x.match_order === m.loser_next_match_order && x.bracket === m.bracket);
    if (nextLoser) {
      const payload = {};
      if (m.loser_next_slot === 'A') payload.team_a = loser;
      if (m.loser_next_slot === 'B') payload.team_b = loser;
      await client.from('matches').update(payload).eq('id', nextLoser.id);
    }
  }

  await loadData();
}

client.channel('matches-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
  .subscribe();

loadData();
