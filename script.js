const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let teams = [];
let matches = [];
let currentSection = null;

async function loadData() {
  const { data: t, error: te } = await client.from('teams').select('*').order('name');
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
  renderTeamSelect();
  renderTeamMatches();
  renderPlanning();
  renderStandings();
  if (currentSection === 'score') loadCourt(false);
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

document.getElementById('courtFilter').onchange = renderPlanning;

function renderPlanning() {
  const div = document.getElementById('planningView');
  const filter = document.getElementById('courtFilter').value;
  let list = matches;
  if (filter) list = list.filter(m => String(m.court) === filter);
  div.innerHTML = `<table>
    <tr><th>Heure</th><th>Terrain</th><th>Poule</th><th>Match</th><th>Score</th><th>Statut</th></tr>
    ${list.map(m => `<tr>
      <td>${m.scheduled_time || ''}</td>
      <td>T${m.court}</td>
      <td>${m.pool || '-'}</td>
      <td>#${m.id} ${m.team_a} vs ${m.team_b}</td>
      <td>${scoreText(m)}</td>
      <td>${statusText(m)}</td>
    </tr>`).join('')}
  </table>`;
}

function poolStats(pool) {
  const poolTeams = teams.filter(t => t.initial_pool === pool).map(t => t.name);
  const stats = {};
  poolTeams.forEach(name => stats[name] = { mj:0, v:0, d:0, diff:0, pm:0, pe:0, score:0 });

  matches.filter(m => m.phase === 'Brassage 1' && m.pool === pool).forEach(m => {
    if (m.score_a === null || m.score_b === null) return;
    if (!stats[m.team_a] || !stats[m.team_b]) return;
    const da = m.score_a - m.score_b;
    const db = m.score_b - m.score_a;
    stats[m.team_a].mj++; stats[m.team_b].mj++;
    stats[m.team_a].pm += m.score_a; stats[m.team_a].pe += m.score_b; stats[m.team_a].diff += da;
    stats[m.team_b].pm += m.score_b; stats[m.team_b].pe += m.score_a; stats[m.team_b].diff += db;
    if (m.score_a > m.score_b) { stats[m.team_a].v++; stats[m.team_a].score += 10000 + da; stats[m.team_b].d++; stats[m.team_b].score += db; }
    if (m.score_b > m.score_a) { stats[m.team_b].v++; stats[m.team_b].score += 10000 + db; stats[m.team_a].d++; stats[m.team_a].score += da; }
  });

  return Object.entries(stats).sort((a,b) => b[1].score - a[1].score || b[1].diff - a[1].diff || b[1].pm - a[1].pm);
}

function renderStandings() {
  const div = document.getElementById('standingsView');
  const pools = ['A','B','C','D','E','F'];
  div.innerHTML = pools.map(pool => {
    const rows = poolStats(pool).map(([name,s],i) => `
      <tr>
        <td>${i+1}</td><td><b>${name}</b></td><td>${s.score}</td><td>${s.mj}</td>
        <td>${s.v}</td><td>${s.d}</td><td>${s.diff}</td><td>${s.pm}</td>
      </tr>
    `).join('');
    return `<h3>Poule ${pool}</h3>
      <table><tr><th>#</th><th>Équipe</th><th>Score</th><th>MJ</th><th>V</th><th>D</th><th>Diff</th><th>PM</th></tr>${rows}</table>`;
  }).join('');
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
  const courtMatches = matches.filter(m => m.court === court && m.status !== 'done');
  const m = courtMatches[0] || matches.filter(m => m.court === court).slice(-1)[0];
  if (!m) {
    div.innerHTML = '<div class="card">Aucun match trouvé pour ce terrain.</div>';
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
  const winner = (m.score_a ?? 0) > (m.score_b ?? 0) ? m.team_a : m.team_b;
  await client.from('matches').update({ status: 'done', winner }).eq('id', id);
  await loadData();
}

client.channel('matches-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
  .subscribe();

loadData();
