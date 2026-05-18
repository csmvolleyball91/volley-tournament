window.onerror = function(message, source, lineno, colno) {
  var box = document.getElementById('appError');
  if (box) {
    box.style.display = 'block';
    box.innerText = 'Erreur navigateur : ' + message + ' (ligne ' + lineno + ')';
  }
};

if (!window.supabase) {
  var preloadError = document.getElementById('appError');
  if (preloadError) {
    preloadError.style.display = 'block';
    preloadError.innerText = 'Supabase ne s\'est pas chargé. Vérifie la connexion internet ou le blocage Safari.';
  }
}

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let teams = [];
let matches = [];
let settings = null;
let currentSection = null;
let adminUnlocked = false;
let activeScoreMatchId = null;
let matchEditCodes = {};

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
  ensureVisibleSection();
}

function ensureVisibleSection() {
  const loader = document.getElementById('startupLoading');
  if (loader) loader.style.display = 'none';
  if (!currentSection) {
    currentSection = 'teams';
    const first = document.getElementById('teams');
    if (first) first.classList.remove('hidden');
  }
}

function show(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  currentSection = id;
  renderAll();
  ensureVisibleSection();
}

function ensureVisibleSection() {
  const loader = document.getElementById('startupLoading');
  if (loader) loader.style.display = 'none';
  if (!currentSection) {
    currentSection = 'teams';
    const first = document.getElementById('teams');
    if (first) first.classList.remove('hidden');
  }
}

function renderAll() {
  renderSubtitle();
  renderTeamSelect();
  renderTeamMatches();
  renderPlanning();
  renderStandings();
  renderAdmin();
  renderBrackets();
  renderPublicView();
  renderHistory();
  if (currentSection === 'score') renderScoreSection();
}

function renderSubtitle() {
  if (!settings) return;
  const el = document.getElementById('subtitle');
  if (!el) return;
  const info = currentPhaseInfo();
  const phaseLine = info
    ? `Phase en cours : ${info.phase} · début ${info.startLabel} · fin estimée ${info.endLabel}`
    : 'Phase en cours : aucun match à venir';
  el.innerHTML = `${phaseLine}<br>${settings.teams_count} équipes · ${settings.courts_count} terrains`;
}

function currentPhaseInfo() {
  const active = matches
    .filter(m => m.status === 'live' && m.team_a && m.team_b)
    .sort((a,b) => Number(a.court || 0) - Number(b.court || 0) || (a.id || 0) - (b.id || 0))[0];
  const next = matches
    .filter(m => m.status !== 'done' && m.team_a && m.team_b)
    .sort((a,b) => (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') || Number(a.court || 0) - Number(b.court || 0) || (a.id || 0) - (b.id || 0))[0];
  const m = active || next;
  if (!m) return null;
  const start = matchStartLabel(m);
  return {
    phase: m.phase || '-',
    startLabel: start.label,
    endLabel: addMinutes(start.time, Number(settings.match_duration || 12))
  };
}

function matchStartStorageKey(id) {
  return `volley_started_time_${id}`;
}

function saveLocalStartedTime(id, value) {
  try { localStorage.setItem(matchStartStorageKey(id), value); } catch(e) {}
}

function getMatchStartedValue(m) {
  return m.started_at || m.start_actual || localStorage.getItem(matchStartStorageKey(m.id)) || '';
}

function timeFromIsoOrTime(value) {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(String(value))) return String(value);
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function matchStartLabel(m) {
  const real = getMatchStartedValue(m);
  const realTime = timeFromIsoOrTime(real);
  if (realTime) return { time: realTime, label: `${realTime} réel` };
  const theoretical = computedScheduledTime(m) || (settings.start_time || '09:30');
  return { time: theoretical, label: `${theoretical} théorique` };
}


function slotStepMinutes() {
  return Number(settings && settings.match_duration ? settings.match_duration : 12) + Number(settings && settings.break_duration ? settings.break_duration : 3);
}

function phaseStartTime(phase) {
  if (phase === 'Brassage 2') return getBrassage2StartTime();
  return settings && settings.start_time ? settings.start_time : '09:30';
}

function computedScheduledTime(m) {
  // Pour les phases de brassage, l'affichage planning doit respecter la config actuelle :
  // durée match + pause entre matchs. Cela évite les anciens horaires restés en base à 12 min.
  if (!settings || !(m.phase === 'Brassage 1' || m.phase === 'Brassage 2') || !m.court) {
    return m.scheduled_time || '';
  }
  const sameCourt = matches
    .filter(x => x.phase === m.phase && Number(x.court) === Number(m.court))
    .sort((a, b) => (a.id || 0) - (b.id || 0));
  const idx = sameCourt.findIndex(x => x.id === m.id);
  if (idx < 0) return m.scheduled_time || '';
  return addMinutes(phaseStartTime(m.phase), idx * slotStepMinutes());
}

function scoreText(m) {
  return m.score_a === null || m.score_b === null ? '-' : `${m.score_a} / ${m.score_b}`;
}

function serviceKey(matchId) {
  return `volley_service_history_${matchId}`;
}

function getServiceHistory(matchId) {
  try {
    return JSON.parse(localStorage.getItem(serviceKey(matchId)) || '[]').filter(x => x === 'a' || x === 'b');
  } catch (e) {
    return [];
  }
}

function saveServiceHistory(matchId, history) {
  localStorage.setItem(serviceKey(matchId), JSON.stringify(history));
}

function servingSide(m) {
  // Service type volley : le service ne change de camp que si l'équipe en réception marque.
  // Pas besoin de colonne Supabase : on garde l'historique des clics sur le téléphone de l'arbitre.
  let server = 'a';
  const history = getServiceHistory(m.id);
  for (const scorer of history) {
    if (scorer !== server) server = scorer;
  }
  return server;
}

function serviceBall(m, side) {
  return servingSide(m) === side ? '<span class="service-ball" title="Au service">🏐</span>' : '';
}

function servingText(m) {
  return servingSide(m) === 'b' ? m.team_b : m.team_a;
}

function syncServiceHistoryAfterPoint(m, side, delta, newA, newB) {
  let history = getServiceHistory(m.id);
  const targetTotal = ((newA == null ? 0 : newA) + (newB == null ? 0 : newB));
  if (delta > 0) {
    history.push(side);
  } else if (delta < 0) {
    // On retire le dernier point connu de cette équipe.
    const idx = history.lastIndexOf(side);
    if (idx >= 0) history.splice(idx, 1);
  }
  // Sécurité : si historique trop long ou scores remis à zéro, on recale.
  if (history.length > targetTotal) history = history.slice(0, targetTotal);
  if (targetTotal === 0) history = [];
  saveServiceHistory(m.id, history);
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
      <b>${computedScheduledTime(m)} — Terrain ${m.court}</b><br>
      ${m.phase} · Poule ${m.pool || '-'}<br>
      ${m.team_a} vs ${m.team_b}<br>
      Arbitre : <b>${m.referee_team || '-'}</b><br>
      Score : ${scoreText(m)}<br>
      ${statusText(m)}
    </div>
  `).join('');
}


function renderHistory() {
  const div = document.getElementById('historyView');
  if (!div) return;
  const done = matches
    .filter(m => m.status === 'done')
    .sort((a,b) => {
      const tb = Date.parse(getCompletionIso(b)) || 0;
      const ta = Date.parse(getCompletionIso(a)) || 0;
      if (tb !== ta) return tb - ta;
      return (b.id || 0) - (a.id || 0);
    });

  if (!done.length) {
    div.innerHTML = '<div class="card">Aucun match terminé pour le moment.</div>';
    return;
  }

  div.innerHTML = `<table>
    <tr><th>Enregistré</th><th>Heure match</th><th>Terrain</th><th>Phase</th><th>Match</th><th>Score</th><th>Gagnant</th><th>Arbitre</th></tr>
    ${done.map(m => `<tr>
      <td><b>${formatDateTimeFr(getCompletionIso(m))}</b></td>
      <td>${computedScheduledTime(m) || '-'}</td>
      <td>T${m.court || '-'}</td>
      <td>${m.phase || '-'}</td>
      <td>${m.team_a || '-'} vs ${m.team_b || '-'}</td>
      <td><b>${scoreText(m)}</b></td>
      <td>${m.winner || '-'}</td>
      <td>${m.referee_team || (isBracketMatch(m) ? 'Libre / non renseigné' : '-')}</td>
    </tr>`).join('')}
  </table>`;
}

function teamNameFromRefCode(code) {
  const codeMap = buildTeamRefCodeMap(false);
  const found = Object.entries(codeMap).find(([team, refCode]) => String(refCode) === String(code || '').trim());
  return found ? found[0] : null;
}

function renderPlanning() {
  const div = document.getElementById('planningView');
  if (!div) return;
  const courtEl = document.getElementById('courtFilter');
  const court = courtEl ? courtEl.value : '';
  const phaseEl = document.getElementById('phaseFilter');
  const phase = phaseEl ? phaseEl.value : '';
  let list = [...matches];
  if (court) list = list.filter(m => String(m.court) === court);
  if (phase) list = list.filter(m => m.phase === phase);
  list.sort((a,b) => computedScheduledTime(a).localeCompare(computedScheduledTime(b)) || Number(a.court)-Number(b.court) || (a.id||0)-(b.id||0));
  div.innerHTML = `<table>
    <tr><th>Heure</th><th>Terrain</th><th>Phase</th><th>Poule</th><th>Match</th><th>Arbitre</th><th>Score</th><th>Statut</th></tr>
    ${list.map(m => `<tr>
      <td>${computedScheduledTime(m)}</td>
      <td>T${m.court}</td>
      <td>${m.phase}</td>
      <td>${m.pool || '-'}</td>
      <td>#${m.id} ${m.team_a} vs ${m.team_b}</td>
      <td>${m.referee_team || '-'}</td>
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


function normalizeCode(code) {
  return String(code || '').trim();
}

function codeForMatch(m) {
  return normalizeCode(matchEditCodes[m.id]);
}

function completedTimeKey(id) {
  return `volley_completed_time_${id}`;
}

function saveLocalCompletedTime(id, iso) {
  try { localStorage.setItem(completedTimeKey(id), iso); } catch(e) {}
}

function getCompletionIso(m) {
  return m.completed_at || m.finished_at || m.done_at || m.completed_time || m.updated_at || localStorage.getItem(completedTimeKey(m.id)) || '';
}

function formatDateTimeFr(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function validateCodeForMatch(m, code) {
  const entered = normalizeCode(code);
  const codeMap = buildTeamRefCodeMap(false);

  if (isBracketMatch(m)) {
    return entered && Object.values(codeMap).some(c => String(c) === entered);
  }

  const expected = m.referee_team ? (codeMap[m.referee_team] || m.access_code) : m.access_code;
  return expected && entered === String(expected);
}

function canEditMatch(m) {
  return validateCodeForMatch(m, codeForMatch(m));
}

function askRefCodeForMatch(m) {
  const label = isBracketMatch(m)
    ? 'Code arbitre de l’équipe qui arbitre ce match'
    : `Code arbitre de ${m.referee_team || 'l’équipe arbitre'}`;
  const code = prompt(`${label} :`);
  if (code === null) return null;
  const clean = normalizeCode(code);
  if (!validateCodeForMatch(m, clean)) {
    alert(isBracketMatch(m) ? 'Code arbitre inconnu.' : 'Code arbitre incorrect pour ce match.');
    return null;
  }
  matchEditCodes[m.id] = clean;
  return clean;
}

function lockedMatchHtml(m) {
  return `<div class="locked-box">🔒 Saisie verrouillée<br><span>Arbitre : <b>${m.referee_team || '-'}</b></span><br><span>Entrer le code arbitre à 4 chiffres pour modifier.</span></div>`;
}

function isPlayableMatch(m) {
  return m.team_a && m.team_b && m.status !== 'done' && m.status !== 'live';
}

function nextPlayableMatches(limit = 6) {
  return matches
    .filter(isPlayableMatch)
    .sort((a,b) =>
      (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
      Number(a.court || 0) - Number(b.court || 0) ||
      (a.match_order || 0) - (b.match_order || 0) ||
      (a.id || 0) - (b.id || 0)
    )
    .slice(0, limit);
}

function renderScoreSection() {
  const div = document.getElementById('courtView');
  const listDiv = document.getElementById('matchLaunchList');
  if (!div || !listDiv) return;

  const active = activeScoreMatchId ? matches.find(m => m.id === activeScoreMatchId && m.status !== 'done') : null;
  if (active) {
    div.innerHTML = renderMatchScoreboard(active);
  } else {
    const live = matches
      .filter(m => m.status === 'live' && m.team_a && m.team_b)
      .sort((a,b) => Number(a.court || 0) - Number(b.court || 0) || (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || ''));
    div.innerHTML = live.length
      ? `<div class="card"><b>Matchs lancés</b><br>${live.map(m => `<button class="small-btn" onclick="openLiveMatch(${m.id})">T${m.court} · ${m.team_a} vs ${m.team_b}</button>`).join('')}</div>`
      : '<div class="card">Sélectionne un match à lancer ci-dessous.</div>';
  }

  const todo = nextPlayableMatches(6);
  if (!todo.length) {
    listDiv.innerHTML = '<div class="card">Aucun match à jouer pour le moment.</div>';
    return;
  }

  listDiv.innerHTML = todo.map(m => {
    const scoreA = m.score_a != null ? m.score_a : 0;
    const scoreB = m.score_b != null ? m.score_b : 0;
    const ref = isBracketMatch(m) ? 'Arbitrage libre' : (m.referee_team || '-');
    const statusLabel = m.status === 'live' ? 'EN COURS' : 'À LANCER';
    return `
      <button type="button" class="public-court-card match-select-card" onclick="launchMatch(${m.id})">
        <div class="public-court-top">
          <div class="public-court-title">Terrain ${m.court || '-'}</div>
          <div class="status-pill status-next">${statusLabel}</div>
        </div>
        <div class="public-match-label">${m.phase || '-'}${m.pool ? ' · Poule ' + m.pool : ''} · ${computedScheduledTime(m) || '-'}</div>
        <div class="public-current-match match-select-teams">
          <span>${m.team_a}</span>
          <em>vs</em>
          <span>${m.team_b}</span>
        </div>
        <div class="public-scoreline mini-scoreline"><span>${scoreA}</span><b>-</b><span>${scoreB}</span></div>
        <div class="public-ref">Arbitre : ${ref}</div>
        <div class="launch-cta">Cliquer pour lancer le match</div>
      </button>
    `;
  }).join('');
}

async function launchMatch(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;
  const code = askRefCodeForMatch(m);
  if (!code) return;

  const startedAt = new Date().toISOString();
  const update = { status: 'live', started_at: startedAt };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(code);
    if (refTeam) update.referee_team = refTeam;
  }

  let result = await client.from('matches').update(update).eq('id', id);
  if (result.error) {
    const fallback = { status: 'live' };
    if (update.referee_team) fallback.referee_team = update.referee_team;
    result = await client.from('matches').update(fallback).eq('id', id);
  }
  if (result.error) {
    alert('Erreur lancement match : ' + result.error.message);
    return;
  }
  saveLocalStartedTime(id, startedAt);
  activeScoreMatchId = id;
  await loadData();
}

function openLiveMatch(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;
  if (!canEditMatch(m)) {
    const code = askRefCodeForMatch(m);
    if (!code) return;
  }
  activeScoreMatchId = id;
  renderScoreSection();
}

function renderMatchScoreboard(m) {
  if (isBracketMatch(m)) {
    return `
      <div class="card">
        <b>Terrain ${m.court || '-'} — Match #${m.id}</b><br>
        ${computedScheduledTime(m) || 'Horaire à définir'} · ${m.phase} · ${m.round || ''}<br>Arbitre : <b>${m.referee_team || 'libre'}</b>
        <h2>${m.team_a || 'À définir'}</h2>
        <div class="score">VS</div>
        <h2>${m.team_b || 'À définir'}</h2>
        ${canEditMatch(m) ? `
          <button class="win" onclick="winnerButton(${m.id}, 'a')">${m.team_a} gagne</button>
          <button class="win" onclick="winnerButton(${m.id}, 'b')">${m.team_b} gagne</button>
        ` : lockedMatchHtml(m)}
      </div>
    `;
  }

  return `
    <div class="scoreboard-full">
      <div class="score-half team-a">
        <div class="team-title">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'a', 1)"` : 'disabled'}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'a', -1)"` : 'disabled'}>−</button>
      </div>

      <div class="center-controls">
        <div class="mini-meta">T${m.court || '-'} · ${m.phase}</div>
        ${canEditMatch(m) ? `<button class="danger finish-btn" onclick="finishMatch(${m.id})">Terminer</button>` : lockedMatchHtml(m)}
      </div>

      <div class="score-half team-b">
        <div class="team-title">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'b', 1)"` : 'disabled'}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'b', -1)"` : 'disabled'}>−</button>
      </div>
    </div>
  `;
}

// Compatibilité ancienne URL/bouton : on affiche maintenant la sélection visuelle des matchs.
function loadCourt(showError = true) {
  renderScoreSection();
}


async function changePoint(id, side, delta) {
  const m = matches.find(x => x.id === id);
  if (!m) return;
  const currentA = m.score_a == null ? 0 : m.score_a;
  const currentB = m.score_b == null ? 0 : m.score_b;
  const newA = side === 'a' ? Math.max(0, currentA + delta) : currentA;
  const newB = side === 'b' ? Math.max(0, currentB + delta) : currentB;
  const { error } = await client.from('matches').update({ score_a: newA, score_b: newB }).eq('id', id);
  if (error) {
    alert('Erreur mise à jour score : ' + error.message);
    return;
  }
  syncServiceHistoryAfterPoint(m, side, delta, newA, newB);
  await loadData();
}

async function addPoint(id, side) {
  const m = matches.find(x => x.id === id);
  const newA = (m.score_a == null ? 0 : m.score_a) + (side === 'a' ? 1 : 0);
  const newB = (m.score_b == null ? 0 : m.score_b) + (side === 'b' ? 1 : 0);
  const { error } = await client.from('matches').update({ score_a: newA, score_b: newB }).eq('id', id);
  if (error) {
    alert('Erreur mise à jour score : ' + error.message);
    return;
  }
  await loadData();
}

async function undoPoint(id) {
  const m = matches.find(x => x.id === id);
  if ((m.score_a == null ? 0 : m.score_a) >= (m.score_b == null ? 0 : m.score_b) && (m.score_a == null ? 0 : m.score_a) > 0) {
    await client.from('matches').update({ score_a: (m.score_a == null ? 0 : m.score_a) - 1 }).eq('id', id);
  } else if ((m.score_b == null ? 0 : m.score_b) > 0) {
    await client.from('matches').update({ score_b: (m.score_b == null ? 0 : m.score_b) - 1 }).eq('id', id);
  }
  await loadData();
}

async function finishMatch(id) {
  const m = matches.find(x => x.id === id);
  if ((m.score_a == null ? 0 : m.score_a) === (m.score_b == null ? 0 : m.score_b)) {
    alert('Match nul impossible : ajoute un point avant de terminer.');
    return;
  }
  if (!confirm(`Confirmer le score ?\n${m.team_a}: ${m.score_a == null ? 0 : m.score_a}\n${m.team_b}: ${m.score_b == null ? 0 : m.score_b}`)) return;
  const winner = (m.score_a == null ? 0 : m.score_a) > (m.score_b == null ? 0 : m.score_b) ? m.team_a : m.team_b;
  const completedAt = new Date().toISOString();
  let result = await client.from('matches').update({ status: 'done', winner, completed_at: completedAt }).eq('id', id);
  if (result.error) {
    result = await client.from('matches').update({ status: 'done', winner }).eq('id', id);
  }
  if (result.error) {
    alert('Erreur fin de match : ' + result.error.message);
    return;
  }
  saveLocalCompletedTime(id, completedAt);
  delete matchEditCodes[id];
  await loadData();
}

function requestAdminAccess() {
  if (adminUnlocked) {
    show('admin');
    return;
  }
  const code = prompt('Code admin :');
  if (code === null) return;
  unlockAdminCode(code);
}

function unlockAdminCode(code) {
  if (code === settings.admin_code) {
    adminUnlocked = true;
    show('admin');
    const panel = document.getElementById('adminPanel');
    const msg = document.getElementById('adminMsg');
    if (panel) panel.classList.remove('hidden');
    if (msg) msg.innerText = 'Admin déverrouillé ✅';
    renderAdmin();
    renderBrackets();
  } else {
    alert('Code admin incorrect.');
  }
}

// Compatibilité ancien bouton éventuel
function unlockAdmin() {
  requestAdminAccess();
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

  const codesDiv = document.getElementById('codesAdmin');
  if (codesDiv && adminUnlocked) {
    const codeMap = buildTeamRefCodeMap(false);
    const refCountByPhase = {};
    ['Brassage 1', 'Brassage 2'].forEach(phase => {
      refCountByPhase[phase] = {};
      teams.forEach(t => refCountByPhase[phase][t.name] = 0);
      matches.filter(m => m.phase === phase && m.referee_team).forEach(m => {
        refCountByPhase[phase][m.referee_team] = (refCountByPhase[phase][m.referee_team] || 0) + 1;
      });
    });

    function phaseBalanceMsg(phase) {
      const counts = teams.map(t => refCountByPhase[phase][t.name] || 0);
      const active = counts.filter(c => c > 0);
      const base = active.length ? active : counts;
      const min = base.length ? Math.min(...base) : 0;
      const max = base.length ? Math.max(...base) : 0;
      return max - min <= 1
        ? `<span class="ok">${phase} équilibré (${min} à ${max})</span>`
        : `<span class="warn">${phase} à corriger (${min} à ${max})</span>`;
    }

    codesDiv.innerHTML = `<h3>Codes arbitres par équipe</h3>` +
      `<p class="small">Codes fixes : modification uniquement ici puis bouton sauvegarder. En tableau, arbitrage libre : n'importe quelle équipe saisit son code.</p>` +
      `<p>${phaseBalanceMsg('Brassage 1')}<br>${phaseBalanceMsg('Brassage 2')}</p>` +
      `<table><tr><th>Équipe</th><th>Code arbitre</th><th>B1</th><th>B2</th></tr>` +
      teams.map(t => `<tr><td>${t.name}</td><td><input class="code-input" data-ref-code-team="${escapeAttr(t.name)}" value="${codeMap[t.name] || ''}" inputmode="numeric" maxlength="4" placeholder="auto" /></td><td>${refCountByPhase['Brassage 1'][t.name] || 0}</td><td>${refCountByPhase['Brassage 2'][t.name] || 0}</td></tr>`).join('') +
      `</table>` +
      `<button onclick="saveRefCodes()">Sauvegarder codes arbitres</button>`;
  }
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



function defaultTeamCode(team) {
  const idx = teams.findIndex(t => t.name === team.name || t.id === team.id);
  const n = Number(team.id || (idx + 1) || 1);
  return String(n).padStart(4, '0').slice(-4);
}

function defaultCodeForTeamName(teamName) {
  const t = teams.find(x => x.name === teamName);
  if (!t) return '';
  return defaultTeamCode(t);
}

function isValidRefCode(code) {
  return /^\d{4}$/.test(String(code || ''));
}

function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildTeamRefCodeMap(allowGenerate = false) {
  const map = {};

  // 1 code fixe par équipe : par défaut 0001, 0002, 0003...
  // Les codes sauvegardés en admin restent prioritaires, mais on ne génère plus jamais d'aléatoire.
  teams.forEach(t => {
    map[t.name] = defaultTeamCode(t);
  });

  matches.forEach(m => {
    const referee = m.referee_team;
    const code = String(m.access_code || '').trim();
    if (!referee || !isValidRefCode(code)) return;
    map[referee] = code;
  });

  return map;
}

async function saveRefCodes() {
  if (!adminUnlocked) return;
  const inputs = [...document.querySelectorAll('[data-ref-code-team]')];
  const used = new Set();
  const codeMap = {};

  for (const input of inputs) {
    const teamName = input.dataset.refCodeTeam;
    const code = String(input.value || '').trim();
    if (!isValidRefCode(code)) {
      document.getElementById('adminMsg').innerText = `Code invalide pour ${teamName} : il faut exactement 4 chiffres.`;
      return;
    }
    if (used.has(code)) {
      document.getElementById('adminMsg').innerText = `Code en doublon : ${code}. Chaque équipe doit avoir un code différent.`;
      return;
    }
    used.add(code);
    codeMap[teamName] = code;
  }

  for (const [teamName, code] of Object.entries(codeMap)) {
    await client.from('matches').update({ access_code: code }).eq('referee_team', teamName);
  }

  document.getElementById('adminMsg').innerText = 'Codes arbitres sauvegardés ✅';
  await loadData();
}

function withTeamAccessCodes(rows) {
  const codeMap = buildTeamRefCodeMap(true);
  return rows.map(r => ({
    ...r,
    access_code: r.referee_team ? codeMap[r.referee_team] : null
  }));
}

function pickReferee(poolTeams, teamA, teamB, slot) {
  const available = poolTeams.filter(t => t !== teamA && t !== teamB);
  if (!available.length) return null;
  return available[slot % available.length];
}

function withAccessCodes(rows, start = 1) {
  // Compatibilité ancien nom : maintenant le code dépend de l'équipe arbitre, pas du match.
  return withTeamAccessCodes(rows);
}

function previousRefCounts(phase) {
  const counts = {};
  teams.forEach(t => counts[t.name] = 0);
  matches.filter(m => m.phase === phase && m.referee_team).forEach(m => {
    counts[m.referee_team] = (counts[m.referee_team] || 0) + 1;
  });
  return counts;
}

function assignBalancedRefsInPools(rows, initialCounts = {}) {
  const groups = {};
  rows.forEach((row, idx) => {
    const key = `${row.phase || ''}||${row.pool || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ row, idx });
  });

  const globalCounts = {};
  teams.forEach(t => globalCounts[t.name] = Number(initialCounts[t.name] || 0));

  Object.values(groups).forEach(group => {
    const localCounts = {};
    group.forEach(({ row }) => {
      [row.team_a, row.team_b].forEach(name => {
        if (name && name !== 'À définir' && localCounts[name] === undefined) localCounts[name] = 0;
      });
    });

    group.forEach(({ row }) => {
      const available = Object.keys(localCounts).filter(t => t !== row.team_a && t !== row.team_b);
      const referee = available.sort((a,b) =>
        (globalCounts[a] || 0) - (globalCounts[b] || 0) ||
        (localCounts[a] || 0) - (localCounts[b] || 0) ||
        String(a).localeCompare(String(b))
      )[0] || null;
      row.referee_team = referee;
      if (referee) {
        localCounts[referee] = (localCounts[referee] || 0) + 1;
        globalCounts[referee] = (globalCounts[referee] || 0) + 1;
      }
    });
  });

  return rows;
}


function generateBrassage1Rows() {
  const pairIdx = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
  const rows = [];
  const pools = ['A','B','C','D','E','F'];
  const slotStep = Number(settings.match_duration) + Number(settings.break_duration);

  pools.forEach((pool, poolIndex) => {
    const poolTeams = teams.filter(t => t.initial_pool === pool).sort((a,b) => a.id-b.id).map(t => t.name);
    pairIdx.forEach((pair, slot) => {
      const teamA = poolTeams[pair[0]];
      const teamB = poolTeams[pair[1]];
      rows.push({
        phase: 'Brassage 1',
        pool,
        court: poolIndex + 1,
        scheduled_time: addMinutes(settings.start_time, slot * slotStep),
        team_a: teamA,
        team_b: teamB,
        referee_team: pickReferee(poolTeams, teamA, teamB, slot),
        score_a: null,
        score_b: null,
        winner: null,
        status: 'pending'
      });
    });
  });
  return withAccessCodes(assignBalancedRefsInPools(rows), 1);
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


function randomMatchScore() {
  const winnerScore = 15;
  const loserScore = 6 + Math.floor(Math.random() * 8); // 6 à 13
  if (Math.random() < 0.5) return { score_a: winnerScore, score_b: loserScore };
  return { score_a: loserScore, score_b: winnerScore };
}

async function fillRandomMissingResults(phase) {
  if (!adminUnlocked) return;
  const label = phase === 'all' ? 'tous les brassages' : phase;
  if (!confirm(`Remplir aléatoirement les résultats manquants pour ${label} ?\nLes matchs déjà terminés ne seront pas modifiés.`)) return;

  const target = matches.filter(m => {
    const isTargetPhase = phase === 'all' ? (m.phase === 'Brassage 1' || m.phase === 'Brassage 2') : m.phase === phase;
    return isTargetPhase && m.team_a && m.team_b && (m.status !== 'done' || m.score_a === null || m.score_b === null);
  });

  if (!target.length) {
    document.getElementById('adminMsg').innerText = `Aucun résultat manquant pour ${label}.`;
    return;
  }

  for (const m of target) {
    const score = randomMatchScore();
    const winner = score.score_a > score.score_b ? m.team_a : m.team_b;
    const completedAt = new Date(Date.now() + Math.floor(Math.random() * 1000)).toISOString();
    let result = await client.from('matches').update({
      score_a: score.score_a,
      score_b: score.score_b,
      winner,
      status: 'done',
      completed_at: completedAt
    }).eq('id', m.id);
    if (result.error) {
      result = await client.from('matches').update({
        score_a: score.score_a,
        score_b: score.score_b,
        winner,
        status: 'done'
      }).eq('id', m.id);
    }
    if (!result.error) saveLocalCompletedTime(m.id, completedAt);
  }

  document.getElementById('adminMsg').innerText = `${target.length} résultat(s) rempli(s) aléatoirement pour ${label} ✅`;
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
  return pairIdx.map((pair, slot) => {
    const teamA = poolTeams[pair[0]];
    const teamB = poolTeams[pair[1]];
    return {
      phase,
      pool: poolName,
      court,
      scheduled_time: addMinutes(startTime, slot * slotStep),
      team_a: teamA,
      team_b: teamB,
      referee_team: null,
      score_a: null,
      score_b: null,
      winner: null,
      status: 'pending'
    };
  });
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
  rows = withAccessCodes(assignBalancedRefsInPools(rows, previousRefCounts('Brassage 1')), 37);

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
    b2Score: (b2[t.name] && b2[t.name].score != null ? b2[t.name].score : 0),
    b1Score: (b1[t.name] && b1[t.name].score != null ? b1[t.name].score : 0),
    b2Diff: (b2[t.name] && b2[t.name].diff != null ? b2[t.name].diff : 0),
    b2Pm: (b2[t.name] && b2[t.name].pm != null ? b2[t.name].pm : 0)
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
      <span class="seed">Match ${m.match_order} · Terrain ${m.court || '-'} · ${computedScheduledTime(m) || 'Horaire à définir'}</span><br>
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
  const rows = bracketRowsFromRanking(ranking).map(r => ({ ...r, referee_team: null, access_code: null }));

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

  const payloadDone = { winner, status:'done' };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(enteredMatchCode());
    if (refTeam) payloadDone.referee_team = refTeam;
  }

  await client.from('matches').update(payloadDone).eq('id', id);

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


function teamsFromMatchPool(phase, pool) {
  const set = new Set();
  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
    if (m.team_a && m.team_a !== 'À définir') set.add(m.team_a);
    if (m.team_b && m.team_b !== 'À définir') set.add(m.team_b);
  });
  return [...set];
}


function matchSortForRefs(a, b) {
  return (a.scheduled_time || '').localeCompare(b.scheduled_time || '') ||
    Number(a.court || 0) - Number(b.court || 0) ||
    (a.phase || '').localeCompare(b.phase || '') ||
    (a.pool || '').localeCompare(b.pool || '') ||
    (a.match_order || 0) - (b.match_order || 0) ||
    a.id - b.id;
}

function pickBalancedReferee(available, refCounts) {
  return [...available].sort((a,b) =>
    (refCounts[a] || 0) - (refCounts[b] || 0) || String(a).localeCompare(String(b))
  )[0] || null;
}

async function assignRefsAndCodes() {
  if (!adminUnlocked) return;
  if (!confirm('Rééquilibrer les arbitres des phases de brassage ? Les tableaux resteront en arbitrage libre. Les codes équipes existants seront conservés.')) return;

  const teamCodeMap = buildTeamRefCodeMap(true);
  const phaseCounts = {};
  ['Brassage 1', 'Brassage 2'].forEach(phase => {
    phaseCounts[phase] = {};
    teams.forEach(t => phaseCounts[phase][t.name] = 0);
  });

  // 1) Rééquilibrage des phases de brassage.
  // Brassage 1 : équilibrage par poule.
  // Brassage 2 : on tient compte des arbitrages déjà faits en Brassage 1 pour lisser le total.
  let cumulativeCounts = {};
  teams.forEach(t => cumulativeCounts[t.name] = 0);

  for (const phase of ['Brassage 1', 'Brassage 2']) {
    const phaseRows = matches
      .filter(m => m.phase === phase)
      .sort(matchSortForRefs);

    const pools = [...new Set(phaseRows.map(m => m.pool).filter(Boolean))].sort();
    for (const pool of pools) {
      const poolRows = phaseRows.filter(m => m.pool === pool);
      const poolTeams = teamsFromMatchPool(phase, pool);
      const localCounts = {};
      poolTeams.forEach(t => localCounts[t] = 0);

      for (const m of poolRows) {
        const available = poolTeams.filter(t => t !== m.team_a && t !== m.team_b);
        const referee = available.sort((a,b) =>
          (cumulativeCounts[a] || 0) - (cumulativeCounts[b] || 0) ||
          (localCounts[a] || 0) - (localCounts[b] || 0) ||
          String(a).localeCompare(String(b))
        )[0] || null;
        if (referee) {
          localCounts[referee] = (localCounts[referee] || 0) + 1;
          cumulativeCounts[referee] = (cumulativeCounts[referee] || 0) + 1;
          phaseCounts[phase][referee] = (phaseCounts[phase][referee] || 0) + 1;
        }
        await client.from('matches').update({
          referee_team: referee,
          access_code: referee ? teamCodeMap[referee] : null
        }).eq('id', m.id);
      }
    }
  }

  // 2) Tableaux : arbitrage libre. Pas d'équipe arbitre imposée, pas de code match.
  for (const m of matches.filter(isBracketMatch)) {
    await client.from('matches').update({ referee_team: null, access_code: null }).eq('id', m.id);
  }

  const msg = ['Brassage 1', 'Brassage 2'].map(phase => {
    const counts = teams.map(t => phaseCounts[phase][t.name] || 0);
    const active = counts.filter(c => c > 0);
    const base = active.length ? active : counts;
    const min = base.length ? Math.min(...base) : 0;
    const max = base.length ? Math.max(...base) : 0;
    return `${phase}: ${min} à ${max}`;
  }).join(' · ');

  document.getElementById('adminMsg').innerText = `Arbitres rééquilibrés ✅ ${msg}. Tableaux en arbitrage libre.`;
  await loadData();
}


client.channel('matches-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
  .subscribe();

loadData();
setInterval(function(){ if (currentSection === 'publicView') renderPublicView(); }, 30000);


function renderPublicView() {
  const div = document.getElementById('publicViewContent');
  if (!div) return;

  const now = new Date();
  const clock = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const activeMatches = matches
    .filter(function(m) { return m.team_a && m.team_b && m.status !== 'done'; })
    .sort(function(a, b) {
      return Number(a.court) - Number(b.court) || computedScheduledTime(a).localeCompare(computedScheduledTime(b)) || (a.id || 0) - (b.id || 0);
    });

  const courts = [];
  const maxCourts = settings && settings.courts_count ? Number(settings.courts_count) : 0;
  if (maxCourts > 0) {
    for (let i = 1; i <= maxCourts; i++) courts.push(i);
  } else {
    activeMatches.forEach(function(m) {
      if (courts.indexOf(Number(m.court)) === -1) courts.push(Number(m.court));
    });
  }

  if (!courts.length) {
    div.innerHTML = '<div class="public-tv"><div class="public-tv-header"><div class="public-tv-title">Tournoi CSM Volleyball 91</div><div class="public-clock">' + clock + '</div></div><div class="public-empty">Aucun match à afficher pour le moment</div></div>';
    return;
  }

  div.innerHTML = '<div class="public-tv">' +
    '<div class="public-tv-header"><div><div class="public-tv-title">Tournoi CSM Volleyball 91</div><div style="opacity:.86;font-weight:800">Matchs en cours et à suivre</div></div><div class="public-clock">' + clock + '</div></div>' +
    '<div class="public-courts">' + courts.map(function(c) {
      const courtMatches = activeMatches.filter(function(m) { return Number(m.court) === Number(c); });
      const current = courtMatches[0];
      const next = courtMatches[1];
      const scoreA = current && current.score_a != null ? current.score_a : 0;
      const scoreB = current && current.score_b != null ? current.score_b : 0;
      const currentHtml = current ?
        '<div class="public-current-match">' + current.team_a + '<br><span style="opacity:.55">vs</span><br>' + current.team_b + '</div>' +
        '<div class="public-scoreline"><span>' + scoreA + '</span><b>-</b><span>' + scoreB + '</span></div>' +
        '<div class="public-ref">Arbitre : ' + (current.referee_team || 'libre') + '</div>' :
        '<div class="public-empty">Terrain libre</div>';
      const nextHtml = next ?
        '<div class="public-next"><div class="public-match-label">À suivre</div>' + next.team_a + ' vs ' + next.team_b + '<br><span class="public-ref">Arbitre : ' + (next.referee_team || 'libre') + '</span></div>' :
        '<div class="public-next"><div class="public-match-label">À suivre</div>—</div>';
      return '<div class="public-court-card">' +
        '<div class="public-court-top"><div class="public-court-title">Terrain ' + c + '</div><div class="status-pill">EN COURS</div></div>' +
        '<div class="public-match-label">Match actuel</div>' + currentHtml + nextHtml +
      '</div>';
    }).join('') + '</div></div>';
}
