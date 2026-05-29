
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// v18.0 - tri chronologique Voir mes matchs
// v17.3o - force resume section for running matches
// v17.3n - safety helpers loaded first
function getMatchStartedAt(m) {
  if (!m) return '';
  try {
    var key = m.id ? ('match_started_at_' + m.id) : '';
    return m.started_at || m.start_actual || m.startedAt || (key ? localStorage.getItem(key) : '') || '';
  } catch (e) {
    return (m && (m.started_at || m.start_actual || m.startedAt)) || '';
  }
}
window.getMatchStartedAt = getMatchStartedAt;

/* v17.3g scoreboard polish */

function minutesFromHHMM(value) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}


function formatTime(value) {
  if (!value) return '';
  const text = String(value);
  if (/^\d{1,2}:\d{2}$/.test(text)) return text;
  const d = new Date(value);
  if (isNaN(d.getTime())) return text;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function pauseStartStorageKey() {
  return 'volley_tournament_pause_started_at';
}

function getTournamentPauseStartMs() {
  try {
    const raw = localStorage.getItem(pauseStartStorageKey());
    const ms = Number(raw || 0);
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  } catch(e) {
    return 0;
  }
}

function setTournamentPauseStartMs(ms) {
  try {
    if (ms) localStorage.setItem(pauseStartStorageKey(), String(ms));
    else localStorage.removeItem(pauseStartStorageKey());
  } catch(e) {}
}

function getPauseCountdownLabel() {
  const minutes = getTournamentPauseMinutes();
  if (!minutes || minutes <= 0) return '';
  const started = getTournamentPauseStartMs();
  if (!started) return '+' + minutes + ' min';
  const end = started + minutes * 60000;
  const remaining = Math.max(0, end - Date.now());
  if (remaining <= 0) return 'terminée';
  const totalSec = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return 'reprise dans ' + mm + ':' + ss;
}

function isMatchLate(m) {
  if (!m || m.status === 'done' || m.status === 'live') return false;
  const scheduled = (typeof computedScheduledTime === 'function' ? computedScheduledTime(m) : '') || m.scheduled_time || '';
  const scheduledMin = minutesFromHHMM(scheduled);
  if (scheduledMin === null) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin > scheduledMin;
}

function normalizeMatchStatus(m) {
  return String((m && m.status) || '').toLowerCase().trim();
}

function isDoneMatch(m) {
  const status = normalizeMatchStatus(m);
  return ['done', 'finished', 'completed', 'closed', 'termine', 'terminé'].indexOf(status) >= 0;
}

function isLiveMatchStatus(m) {
  const status = normalizeMatchStatus(m);
  return ['live', 'active', 'in_progress', 'started', 'ongoing', 'running', 'en_cours', 'en cours', 'in progress', 'launched', 'lance', 'lancé', 'saisie'].indexOf(status) >= 0 || status.indexOf('cours') >= 0 || status.indexOf('progress') >= 0;
}

function activeMatchOnCourt(court, exceptId) {
  const courtNum = Number(court);
  if (!courtNum) return null;
  return matches.find(function(x) {
    return Number(x.court) === courtNum && String(x.id) !== String(exceptId || '') && x.team_a && x.team_b && isLiveMatchStatus(x);
  }) || null;
}

function hasScoreStarted(m) {
  return Number(m && m.score_a || 0) !== 0 || Number(m && m.score_b || 0) !== 0;
}

function isStartedForResume(m) {
  if (!m || !m.team_a || !m.team_b || isDoneMatch(m)) return false;
  return isLiveMatchStatus(m) || !!getMatchStartedAt(m) || hasScoreStarted(m) || hasLocalMatchSession(m.id) || String(activeScoreMatchId || '') === String(m.id);
}

function resumeMatchesForDisplay() {
  return matches
    .filter(isStartedForResume)
    .sort(function(a,b) {
      return Number(a.court || 0) - Number(b.court || 0) ||
        (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
        (a.match_order || 0) - (b.match_order || 0) ||
        (a.id || 0) - (b.id || 0);
    });
}

function renderResumeMatchesCard(list) {
  if (!list || !list.length) return '';
  return `<div class="card live-matches-card force-resume-card">
    <div class="section-title-row"><b>Matchs en cours — reprendre</b><span>${list.length}</span></div>
    <div class="resume-match-list">
      ${list.map(function(m) {
        const score = `${Number(m.score_a || 0)} - ${Number(m.score_b || 0)}`;
        return `<button class="small-btn resume-live-btn resume-match-btn" onclick="openLiveMatch(${m.id})">
          <span class="resume-court">Terrain ${m.court || '-'}</span>
          <span class="resume-teams">${m.team_a} vs ${m.team_b}</span>
          <span class="resume-score">${score}</span>
          <span class="resume-action">Reprendre</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

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


function pauseStorageKey() {
  return 'volley_tournament_pause_minutes';
}

function getTournamentPauseMinutes() {
  const fromSettings = settings && settings.pause_minutes != null ? Number(settings.pause_minutes) : NaN;
  if (!Number.isNaN(fromSettings) && fromSettings > 0) return fromSettings;
  try {
    const v = Number(localStorage.getItem(pauseStorageKey()) || 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch(e) {
    return 0;
  }
}

function setLocalTournamentPauseMinutes(minutes) {
  try { localStorage.setItem(pauseStorageKey(), String(Math.max(0, Number(minutes) || 0))); } catch(e) {}
}


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
    const dash = document.getElementById('homeDashboard');
    if (dash) dash.classList.remove('hidden');
  }
}

function show(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  const dash = document.getElementById('homeDashboard');
  if (dash && id === 'teams') dash.classList.remove('hidden');
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
    const dash = document.getElementById('homeDashboard');
    if (dash) dash.classList.remove('hidden');
  }
}

function renderAll() {
  renderDashboard();
  renderSubtitle();
  renderTeamSelect();
  renderTeamMatches();
  renderPlanning();
  renderStandings();
  renderAdmin();
  renderAdminAlwaysVisibleTools();
  renderBrackets();
  renderPublicView();
  renderHistory();
  if (currentSection === 'score') renderScoreSection();
}


function phaseMatches(phase) {
  return matches.filter(function(m) { return m.phase === phase && m.team_a && m.team_b; });
}

function currentPhaseName() {
  const live = matches.find(function(m) { return m.status === 'live' && m.team_a && m.team_b; });
  if (live) return live.phase || 'Phase en cours';
  const next = matches
    .filter(function(m) { return m.status !== 'done' && m.team_a && m.team_b; })
    .sort(function(a,b) { return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') || Number(a.court || 0) - Number(b.court || 0); })[0];
  return next ? (next.phase || 'Phase en cours') : 'Tournoi terminé';
}

function minutesOfDayFromTime(time) {
  if (!time || typeof time !== 'string') return null;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function timeFromMinutesOfDay(total) {
  total = Math.max(0, Math.round(Number(total) || 0));
  const day = 24 * 60;
  total = ((total % day) + day) % day;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function nowMinutesOfDay() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function plannedPhaseEndMinutes(phase) {
  if (!phase || phase === 'Tournoi terminé') return null;
  const list = phaseMatches(phase);
  if (!list.length) return null;
  const last = list.slice().sort(function(a,b) {
    return (computedScheduledTime(b) || '').localeCompare(computedScheduledTime(a) || '') || Number(b.id || 0) - Number(a.id || 0);
  })[0];
  const start = computedScheduledTime(last) || (settings && settings.start_time) || '09:30';
  const startMin = minutesOfDayFromTime(start);
  if (startMin == null) return null;
  return startMin + Number(settings && settings.match_duration ? settings.match_duration : 12) + getTournamentPauseMinutes();
}

function estimatedPhaseEndMinutes(phase) {
  if (!phase || phase === 'Tournoi terminé') return null;
  const list = phaseMatches(phase);
  if (!list.length) return null;

  const remaining = list.filter(function(m) { return m.status !== 'done'; });
  if (!remaining.length) return plannedPhaseEndMinutes(phase);

  const live = remaining.filter(function(m) { return m.status === 'live'; });
  const pending = remaining.filter(function(m) { return m.status !== 'live'; });
  const courts = Math.max(1, Number(settings && settings.courts_count ? settings.courts_count : 6));
  const slot = Number(settings && settings.match_duration ? settings.match_duration : 12) + Number(settings && settings.break_duration ? settings.break_duration : 0);

  // Estimation dynamique : on part de l'heure réelle actuelle, pas du planning théorique.
  // Les matchs en cours comptent comme une vague déjà lancée ; les matchs en attente sont répartis sur les terrains.
  const waves = (live.length ? 1 : 0) + Math.ceil(pending.length / courts);
  const dynamicEnd = nowMinutesOfDay() + Math.max(1, waves) * slot + getTournamentPauseMinutes();
  const plannedEnd = plannedPhaseEndMinutes(phase);

  // Avant le départ réel, on conserve l'heure prévue. Dès que le tournoi prend du retard, l'estimation glisse.
  return plannedEnd == null ? dynamicEnd : Math.max(plannedEnd, dynamicEnd);
}

function estimatedPhaseEnd(phase) {
  const end = estimatedPhaseEndMinutes(phase);
  return end == null ? '-' : timeFromMinutesOfDay(end);
}

function phaseDelayMinutes(phase) {
  const plannedEnd = plannedPhaseEndMinutes(phase);
  const estimatedEnd = estimatedPhaseEndMinutes(phase);
  if (plannedEnd == null || estimatedEnd == null) return 0;
  return Math.max(0, Math.round(estimatedEnd - plannedEnd));
}

function renderTimeline(phase) {
  const phases = ['Brassage 1', 'Brassage 2', 'Tableaux'];
  let activeIndex = phases.indexOf(phase);
  if (activeIndex < 0 && phase !== 'Tournoi terminé') activeIndex = 2;
  if (phase === 'Tournoi terminé') activeIndex = phases.length;
  return phases.map(function(p, index) {
    const active = index === activeIndex;
    const done = index < activeIndex;
    const cls = 'timeline-step timeline-premium-step ' + (active ? 'active' : '') + (done ? ' done' : '');
    const num = index + 1;
    return '<span class="' + cls + '"><span class="timeline-index">' + num + '</span><span class="timeline-label">' + p + '</span></span>';
  }).join('<span class="timeline-connector"></span>');
}

function renderDashboard() {
  if (!settings || !matches) return;
  const phase = currentPhaseName();
  const title = document.getElementById('dashPhaseTitle');
  const meta = document.getElementById('dashPhaseMeta');
  const timeline = document.getElementById('dashTimeline');
  const courts = document.getElementById('dashCourts');
  const callout = document.getElementById('dashCallout');
  if (!title || !meta || !timeline || !courts || !callout) return;

  const delay = phaseDelayMinutes(phase);
  title.textContent = phase;
  const pauseMinutes = getTournamentPauseMinutes();
  meta.innerHTML = '<span>Fin estimée phase : <b>' + estimatedPhaseEnd(phase) + '</b></span>' +
    '<span>Retard : <b>' + (delay > 0 ? '+' + delay + ' min' : '0 min') + '</b></span>' +
    (pauseMinutes > 0 ? '<span class="pause-pill">Pause tournoi : <b>' + getPauseCountdownLabel() + '</b></span>' : '');
  timeline.innerHTML = renderTimeline(phase);

  const maxCourts = Number(settings.courts_count || 6);
  const active = matches.filter(function(m) { return m.status === 'live' && m.team_a && m.team_b; });
  const pending = matches.filter(function(m) { return m.status !== 'done' && m.status !== 'live' && m.team_a && m.team_b; });
  let html = '';
  for (let c = 1; c <= maxCourts; c++) {
    const live = active.find(function(m) { return Number(m.court) === c; });
    const next = pending.filter(function(m) { return Number(m.court) === c; })
      .sort(function(a,b) { return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') || Number(a.id || 0) - Number(b.id || 0); })[0];
    html += '<div class="court-status-card ' + (live ? 'is-live' : 'is-free') + '">' +
      '<div class="court-status-title">Terrain ' + c + '</div>' +
      '<div class="court-status-badge">' + (live ? 'EN COURS' : 'LIBRE') + '</div>' +
      '<div class="court-status-match">' + (live ? live.team_a + ' vs ' + live.team_b : (next ? 'À suivre : ' + next.team_a + ' vs ' + next.team_b : 'Aucun match')) + '</div>' +
      '</div>';
  }
  courts.innerHTML = html;

  const nextCall = pending.slice().sort(function(a,b) { return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') || Number(a.court || 0) - Number(b.court || 0); })[0];
  if (nextCall) {
    callout.classList.remove('hidden');
    callout.innerHTML = '📢 <b>À appeler :</b> ' + nextCall.team_a + ' vs ' + nextCall.team_b + ' — Terrain ' + (nextCall.court || '?') + (nextCall.referee_team ? ' · Arbitre : ' + nextCall.referee_team : '');
  } else {
    callout.classList.add('hidden');
    callout.innerHTML = '';
  }
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
    endLabel: estimatedPhaseEnd(m.phase)
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

// getMatchStartedAt is defined at the top for Safari/cache safety.

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
  const total = (m.score_a == null ? 0 : Number(m.score_a)) + (m.score_b == null ? 0 : Number(m.score_b));
  if (total === 0) return '';
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

function matchSortTimeMinutes(m) {
  const label = computedScheduledTime(m) || m.scheduled_time || '';
  const minutes = minutesFromHHMM(label);
  return minutes === null ? 99999 : minutes;
}

function renderTeamMatches() {
  const sel = document.getElementById('teamSelect');
  const div = document.getElementById('teamMatches');
  if (!sel || !div || !teams.length) return;
  const name = sel.value || teams[0].name;
  const list = matches
    .filter(m => m.team_a === name || m.team_b === name)
    .sort((a, b) => {
      const ta = matchSortTimeMinutes(a);
      const tb = matchSortTimeMinutes(b);
      if (ta !== tb) return ta - tb;
      const ca = Number(a.court || 0);
      const cb = Number(b.court || 0);
      if (ca !== cb) return ca - cb;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  div.innerHTML = list.map(m => `
    <div class="card">
      <b>${computedScheduledTime(m) || '--:--'} — Terrain ${m.court || '-'}</b><br>
      ${m.phase || '-'} · Poule ${m.pool || '-'}<br>
      ${m.team_a || 'À définir'} vs ${m.team_b || 'À définir'}<br>
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
    const pools = [...new Set(matches.filter(m => m.phase === phase).map(m => m.pool))].sort();
    html += `<div class="ranking-phase"><div class="ranking-phase-title"><span>${phase}</span><small>Classement live par poule</small></div><div class="ranking-grid">`;
    pools.forEach(pool => {
      const statsRows = poolStats(phase, pool);
      const topThree = statsRows.slice(0,3).map(([name,s],i) => `
        <div class="ranking-podium-item rank-${i+1}">
          <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
          <strong>${name}</strong>
          <small>${s.score}</small>
        </div>
      `).join('');
      const rows = statsRows.map(([name,s],i) => `
        <tr class="rank-row ${i < 3 ? 'rank-highlight' : ''}">
          <td><span class="rank-badge">${i+1}</span></td>
          <td class="team-cell"><b>${name}</b></td>
          <td class="score-cell">${s.score}</td>
          <td>${s.mj}</td>
          <td>${s.v}</td>
          <td>${s.d}</td>
          <td class="diff-cell ${s.diff >= 0 ? 'positive' : 'negative'}">${s.diff}</td>
          <td>${s.pm}</td>
        </tr>
      `).join('');
      html += `<section class="ranking-card"><div class="ranking-card-head"><h3>Poule ${pool}</h3><span>${statsRows.length} équipes</span></div><div class="ranking-podium">${topThree}</div>
        <div class="table-scroll"><table class="ranking-table"><tr><th>#</th><th>Équipe</th><th>Score</th><th>MJ</th><th>V</th><th>D</th><th>Diff</th><th>PM</th></tr>${rows}</table></div></section>`;
    });
    html += `</div></div>`;
  });
  div.innerHTML = html || '<div class="card">Aucun classement disponible.</div>';
}


function normalizeCode(code) {
  return String(code || '').trim();
}

function isBracketMatch(m) {
  if (!m) return false;
  const phase = String(m.phase || '').toLowerCase();
  return Boolean(m.bracket) || phase.includes('tableau') || phase.includes('consolante');
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

function clearLocalCompletedTime(id) {
  try { localStorage.removeItem(completedTimeKey(id)); } catch(e) {}
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
  return `<div class="locked-box">🔒 Saisie verrouillée<br><span>Arbitre : <b>${m.referee_team || '-'}</b></span><br><span>Clique sur Reprendre et confirme le code arbitre pour modifier.</span></div>`;
}

function isPlayableMatch(m) {
  return m && m.team_a && m.team_b && !isDoneMatch(m) && !isLiveMatchStatus(m);
}

function nextPlayableMatches(limit = 6) {
  const playable = matches
    .filter(isPlayableMatch)
    .sort((a,b) =>
      Number(a.court || 0) - Number(b.court || 0) ||
      (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
      (a.match_order || 0) - (b.match_order || 0) ||
      (a.id || 0) - (b.id || 0)
    );

  // Affichage arbitres/terrains : on montre d'abord le prochain match de chaque terrain,
  // toujours dans l'ordre Terrain 1 -> Terrain 6.
  const courtsCount = Number(settings && settings.courts_count ? settings.courts_count : 6);
  const selected = [];
  for (let c = 1; c <= courtsCount && selected.length < limit; c++) {
    const m = playable.find(x => Number(x.court) === c && !selected.some(y => y.id === x.id));
    if (m) selected.push(m);
  }
  playable.forEach(m => {
    if (selected.length < limit && !selected.some(x => x.id === m.id)) selected.push(m);
  });
  return selected.slice(0, limit);
}

function renderScoreSection() {
  const div = document.getElementById('courtView');
  const listDiv = document.getElementById('matchLaunchList');
  if (!div || !listDiv) return;

  const active = activeScoreMatchId ? matches.find(m => m.id === activeScoreMatchId && m.status !== 'done') : null;
  const resumeList = resumeMatchesForDisplay();
  if (active) {
    const others = resumeList.filter(function(x) { return String(x.id) !== String(active.id); });
    div.innerHTML = renderMatchScoreboard(active) + renderResumeMatchesCard(others);
  } else {
    div.innerHTML = resumeList.length
      ? renderResumeMatchesCard(resumeList)
      : '<div class="card">Sélectionne un match à lancer ci-dessous.</div>';
  }

  const todo = nextPlayableMatches(6);
  if (!todo.length) {
    listDiv.innerHTML = '<div class="card">Aucun match à jouer pour le moment.</div>';
    return;
  }

  listDiv.innerHTML = todo.map(m => {
    const ref = isBracketMatch(m) ? 'Arbitrage libre' : (m.referee_team || '-');
    const isLate = isMatchLate(m);
    const statusLabel = isLate ? 'RETARD' : 'EN ATTENTE';
    const statusClass = isLate ? 'status-late' : 'status-next';
    return `
      <button type="button" class="public-court-card match-select-card premium-launch-card" onclick="launchMatch(${m.id})" aria-label="Lancer ${m.team_a} contre ${m.team_b} terrain ${m.court || '-'}">
        <div class="launch-card-header">
          <div>
            <div class="launch-court">Terrain ${m.court || '-'}</div>
            <div class="launch-meta">${m.phase || '-'}${m.pool ? ' · Poule ' + m.pool : ''}</div>
          </div>
          <div class="launch-time-box">
            <span>${computedScheduledTime(m) || '--:--'}</span>
            <small>départ</small>
          </div>
        </div>
        <div class="launch-card-status ${statusClass}">${statusLabel}</div>
        <div class="match-select-teams premium-teams">
          <span>${m.team_a}</span>
          <em>vs</em>
          <span>${m.team_b}</span>
        </div>
        <div class="launch-referee"><b>Arbitre</b><span>${ref}</span></div>
        <div class="launch-cta">Lancer la saisie</div>
      </button>
    `;
  }).join('');
}

async function launchMatch(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;

  if (isDoneMatch(m)) {
    alert('Ce match est déjà terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }
  if (isStartedForResume(m)) {
    alert('Ce match est déjà lancé. Clique sur Reprendre et confirme le code arbitre.');
    openLiveMatch(id);
    return;
  }
  const otherLive = activeMatchOnCourt(m.court, m.id);
  if (otherLive) {
    alert('Terrain ' + (m.court || '-') + ' déjà occupé par : ' + otherLive.team_a + ' vs ' + otherLive.team_b + '. Termine ou reset ce match avant d’en lancer un autre.');
    return;
  }

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
  if (code === 'keke' || code === settings.admin_code) {
    adminUnlocked = true;
    show('admin');
    const panel = document.getElementById('adminPanel');
    const msg = document.getElementById('adminMsg');
    if (panel) panel.classList.remove('hidden');
    ensureAdminPriorityTools();
    if (msg) msg.innerText = 'Admin déverrouillé ✅';
    renderAdminAlwaysVisibleTools();
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


function ensureAdminPriorityTools() {
  const panel = document.getElementById('adminPanel');
  if (!panel) return;
  if (document.getElementById('forfeitAdmin') && document.getElementById('resetMatchAdmin')) return;
  const toolsHtml = `
    <div class="admin-priority-tools admin-priority-tools-forced">
      <article class="admin-card admin-card-wide admin-tool-forfeit">
        <div class="admin-card-head">
          <div>
            <p class="eyebrow dark">Action rapide</p>
            <h3>Forfait avec score choisi</h3>
          </div>
          <span class="admin-action-badge danger-badge">Forfait</span>
        </div>
        <p class="small">Choisis le match, le vainqueur et le score à appliquer. Le match sera marqué comme terminé.</p>
        <div id="forfeitAdmin" class="admin-list-panel"></div>
      </article>
      <article class="admin-card admin-card-wide admin-tool-reset">
        <div class="admin-card-head">
          <div>
            <p class="eyebrow dark">Action rapide</p>
            <h3>Reset match admin</h3>
          </div>
          <span class="admin-action-badge reset-badge">Reset</span>
        </div>
        <p class="small">Remet un match à 0-0, le déverrouille et le replace dans les matchs à jouer.</p>
        <div id="resetMatchAdmin" class="admin-list-panel"></div>
      </article>
    </div>`;
  panel.insertAdjacentHTML('afterbegin', toolsHtml);
}


function poolLabelForTeamIndex(index, desiredCount) {
  const sizes = poolSizesForCount(Number(desiredCount || getTournamentTeamCount()), Number(settings && settings.courts_count) || 6);
  const poolNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let cursor = 0;
  for (let i = 0; i < sizes.length; i++) {
    cursor += sizes[i];
    if (index <= cursor) return poolNames[i] || '';
  }
  return '';
}
function defaultTeamNameByIndex(index) {
  return `Équipe ${String(index).padStart(2,'0')}`;
}
function teamRowForAdmin(index) {
  const existing = teams.find(t => Number(t.id) === Number(index));
  const desired = getTournamentTeamCount();
  return existing || { id:index, name:defaultTeamNameByIndex(index), level:'Loisir', initial_pool:poolLabelForTeamIndex(index, desired), __new:true };
}

function renderAdmin() {
  ensureAdminPriorityTools();
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
      `<table><tr><th>Équipe</th><th>Code arbitre</th><th>B1</th><th>B2</th></tr>` +
      teams.map(t => `<tr><td>${t.name}</td><td><input class="code-input" data-ref-code-team="${escapeAttr(t.name)}" value="${codeMap[t.name] || ''}" inputmode="numeric" maxlength="4" placeholder="auto" /></td><td>${refCountByPhase['Brassage 1'][t.name] || 0}</td><td>${refCountByPhase['Brassage 2'][t.name] || 0}</td></tr>`).join('') +
      `</table>` +
      `<button onclick="saveRefCodes()">Sauvegarder codes arbitres</button>` +
      `<button onclick="rebalanceRefereesForBrassages()">Rééquilibrer arbitres brassages</button>`;
  }
  renderAdminForfeit();
  renderAdminMatchReset();
  renderAdminScoreCorrections();
}


function renderAdminForfeit() {
  const div = document.getElementById('forfeitAdmin');
  if (!div || !adminUnlocked) return;

  const eligible = matches
    .filter(m => m.team_a && m.team_b && m.team_a !== 'À définir' && m.team_b !== 'À définir')
    .sort((a,b) =>
      String(a.phase || '').localeCompare(String(b.phase || '')) ||
      Number(a.court || 999) - Number(b.court || 999) ||
      Number(a.match_order || 0) - Number(b.match_order || 0) ||
      String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')) ||
      Number(a.id || 0) - Number(b.id || 0)
    );

  if (!eligible.length) {
    div.innerHTML = '<div class="card">Aucun match disponible pour forfait.</div>';
    return;
  }

  div.innerHTML = `
    <div class="forfeit-admin-grid">
      <label><span>Match</span>
        <select id="forfeitMatch" onchange="updateForfeitWinnerOptions()">
          ${eligible.map(m => `<option value="${m.id}">${m.phase || '-'} · T${m.court || '-'} · ${m.team_a} vs ${m.team_b} ${m.status === 'done' ? '(terminé)' : ''}</option>`).join('')}
        </select>
      </label>
      <label><span>Vainqueur</span>
        <select id="forfeitWinner"></select>
      </label>
      <label><span>Score vainqueur</span>
        <input id="forfeitWinnerScore" type="number" min="0" value="15" />
      </label>
      <label><span>Score perdant</span>
        <input id="forfeitLoserScore" type="number" min="0" value="0" />
      </label>
      <button class="danger" onclick="adminApplyForfeit()">Appliquer forfait</button>
    </div>
  `;
  updateForfeitWinnerOptions();
}

function updateForfeitWinnerOptions() {
  const matchSelect = document.getElementById('forfeitMatch');
  const winnerSelect = document.getElementById('forfeitWinner');
  if (!matchSelect || !winnerSelect) return;
  const m = matches.find(x => String(x.id) === String(matchSelect.value));
  if (!m) return;
  winnerSelect.innerHTML = `
    <option value="a">${m.team_a}</option>
    <option value="b">${m.team_b}</option>
  `;
}

async function adminApplyForfeit() {
  if (!adminUnlocked) return;
  const matchSelect = document.getElementById('forfeitMatch');
  const winnerSelect = document.getElementById('forfeitWinner');
  const winInput = document.getElementById('forfeitWinnerScore');
  const loseInput = document.getElementById('forfeitLoserScore');
  if (!matchSelect || !winnerSelect || !winInput || !loseInput) return;

  const m = matches.find(x => String(x.id) === String(matchSelect.value));
  if (!m) return;

  const winnerSide = winnerSelect.value;
  const winnerScore = Number(winInput.value || 0);
  const loserScore = Number(loseInput.value || 0);
  if (winnerScore === loserScore) {
    alert('Score forfait invalide : il faut un vainqueur.');
    return;
  }

  const scoreA = winnerSide === 'a' ? winnerScore : loserScore;
  const scoreB = winnerSide === 'b' ? winnerScore : loserScore;
  const winner = winnerSide === 'a' ? m.team_a : m.team_b;
  const completedAt = new Date().toISOString();

  if (!confirm(`Appliquer forfait ?\n${m.team_a} ${scoreA} - ${scoreB} ${m.team_b}\nVainqueur : ${winner}`)) return;

  let result = await client.from('matches').update({
    score_a: scoreA,
    score_b: scoreB,
    winner,
    status: 'done',
    completed_at: completedAt
  }).eq('id', m.id);

  if (result.error) {
    result = await client.from('matches').update({
      score_a: scoreA,
      score_b: scoreB,
      winner,
      status: 'done'
    }).eq('id', m.id);
  }

  if (result.error) {
    alert('Erreur forfait : ' + result.error.message);
    return;
  }

  saveLocalCompletedTime(m.id, completedAt);
  document.getElementById('adminMsg').innerText = 'Forfait appliqué ✅';
  await loadData();
}


function renderAdminMatchReset() {
  const div = document.getElementById('resetMatchAdmin');
  if (!div || !adminUnlocked) return;

  const eligible = matches
    .filter(m => m.team_a && m.team_b && m.team_a !== 'À définir' && m.team_b !== 'À définir')
    .sort((a,b) =>
      String(a.phase || '').localeCompare(String(b.phase || '')) ||
      Number(a.court || 999) - Number(b.court || 999) ||
      Number(a.match_order || 0) - Number(b.match_order || 0) ||
      String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')) ||
      Number(a.id || 0) - Number(b.id || 0)
    );

  if (!eligible.length) {
    div.innerHTML = '<div class="card">Aucun match disponible à réinitialiser.</div>';
    return;
  }

  div.innerHTML = `
    <div class="forfeit-admin-grid">
      <label><span>Match à reset</span>
        <select id="resetMatchSelect">
          ${eligible.map(m => `<option value="${m.id}">${m.phase || '-'} · T${m.court || '-'} · ${m.team_a} vs ${m.team_b} · ${m.status || 'pending'} ${m.score_a != null || m.score_b != null ? `(${m.score_a == null ? 0 : m.score_a}-${m.score_b == null ? 0 : m.score_b})` : ''}</option>`).join('')}
        </select>
      </label>
      <button class="danger" onclick="adminResetMatch()">Reset ce match</button>
    </div>
  `;
}

async function adminResetMatch() {
  if (!adminUnlocked) return;
  const select = document.getElementById('resetMatchSelect');
  if (!select) return;
  const m = matches.find(x => String(x.id) === String(select.value));
  if (!m) return;

  if (!confirm(`Reset match ?\n${m.phase || '-'} · Terrain ${m.court || '-'}\n${m.team_a} vs ${m.team_b}\n\nLe score sera remis à 0-0 et le match redeviendra à jouer.`)) return;

  const fullPayload = {
    score_a: 0,
    score_b: 0,
    winner: null,
    status: 'pending',
    started_at: null,
    completed_at: null
  };

  let result = await client.from('matches').update(fullPayload).eq('id', m.id);
  if (result.error) {
    result = await client.from('matches').update({
      score_a: 0,
      score_b: 0,
      winner: null,
      status: 'pending'
    }).eq('id', m.id);
  }

  if (result.error) {
    alert('Erreur reset match : ' + result.error.message);
    return;
  }

  clearLocalCompletedTime(m.id);
  if (activeScoreMatchId === m.id) activeScoreMatchId = null;
  delete matchEditCodes[m.id];
  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = 'Match réinitialisé ✅';
  await loadData();
}

function renderAdminScoreCorrections() {
  const div = document.getElementById('scoreCorrectionsAdmin');
  if (!div || !adminUnlocked) return;
  const done = matches
    .filter(m => m.status === 'done')
    .sort((a,b) => (Date.parse(getCompletionIso(b)) || 0) - (Date.parse(getCompletionIso(a)) || 0) || (b.id || 0) - (a.id || 0));
  if (!done.length) {
    div.innerHTML = '<div class="admin-empty-state">Aucun match terminé à corriger.</div>';
    return;
  }
  div.innerHTML = `<div class="admin-correction-list">` + done.map(m => {
    const completed = formatTime(getCompletionIso(m));
    const a = m.score_a == null ? 0 : m.score_a;
    const b = m.score_b == null ? 0 : m.score_b;
    return `<article class="admin-correction-card">
      <div class="admin-correction-main">
        <div class="admin-correction-meta">
          <span class="match-status-badge neutral">T${m.court || '-'}</span>
          <span>${m.phase || '-'}</span>
          <span>${completed ? 'Enregistré ' + completed : 'Heure inconnue'}</span>
        </div>
        <div class="admin-correction-title">${m.team_a || '-'} <strong>${a} - ${b}</strong> ${m.team_b || '-'}</div>
        <div class="admin-correction-sub">Arbitre : ${m.referee || m.referee_team || 'non renseigné'}</div>
      </div>
      <div class="admin-correction-edit">
        <label>${m.team_a || 'Équipe A'}<input id="fixA_${m.id}" type="number" min="0" value="${a}"></label>
        <label>${m.team_b || 'Équipe B'}<input id="fixB_${m.id}" type="number" min="0" value="${b}"></label>
        <button class="admin-primary" onclick="adminUpdateScore(${m.id})">Enregistrer</button>
      </div>
    </article>`;
  }).join('') + `</div>`;
}

async function adminUpdateScore(id) {
  if (!adminUnlocked) return;
  const m = matches.find(x => x.id === id);
  if (!m) return;
  const a = Number(document.getElementById(`fixA_${id}`).value || 0);
  const b = Number(document.getElementById(`fixB_${id}`).value || 0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) { alert('Score invalide.'); return; }
  if (a === b) { alert('Match nul impossible.'); return; }
  const winner = a > b ? m.team_a : m.team_b;
  const completedAt = getCompletionIso(m) || new Date().toISOString();
  if (!confirm(`Confirmer la correction ?
${m.team_a} ${a} - ${b} ${m.team_b}
Vainqueur : ${winner}`)) return;
  let result = await client.from('matches').update({ score_a: a, score_b: b, winner, status: 'done', completed_at: completedAt }).eq('id', id);
  if (result.error) {
    result = await client.from('matches').update({ score_a: a, score_b: b, winner, status: 'done' }).eq('id', id);
  }
  if (result.error) { alert('Erreur correction score : ' + result.error.message); return; }
  saveLocalCompletedTime(id, completedAt);
  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = 'Score corrigé ✅ Classements recalculés automatiquement.';
  await loadData();
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
  // Règle métier : l'arbitre doit appartenir à la même poule que le match,
  // ne doit pas jouer ce match, et la charge doit être lissée au maximum.
  const groups = {};
  rows.forEach((row, idx) => {
    const key = `${row.phase || ''}||${row.pool || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ row, idx });
  });

  const totalCounts = {};
  teams.forEach(t => totalCounts[t.name] = Number(initialCounts[t.name] || 0));

  Object.values(groups).forEach(group => {
    // Ordre déterministe des 6 matchs de la poule.
    group.sort((a,b) =>
      Number(a.row.match_order || 0) - Number(b.row.match_order || 0) ||
      String(a.row.scheduled_time || '').localeCompare(String(b.row.scheduled_time || '')) ||
      Number(a.row.id || 0) - Number(b.row.id || 0)
    );

    const poolTeamNames = [];
    group.forEach(({ row }) => {
      [row.team_a, row.team_b].forEach(name => {
        if (name && name !== 'À définir' && !poolTeamNames.includes(name)) poolTeamNames.push(name);
      });
    });

    const phasePoolCounts = {};
    poolTeamNames.forEach(name => phasePoolCounts[name] = 0);

    group.forEach(({ row }) => {
      // Important : uniquement une équipe de cette poule, jamais d'un autre terrain.
      const available = poolTeamNames.filter(name => name !== row.team_a && name !== row.team_b);
      const referee = available.sort((a,b) =>
        // 1) équilibrage dans cette poule/phase : évite les 0/3.
        (phasePoolCounts[a] || 0) - (phasePoolCounts[b] || 0) ||
        // 2) pour le Brassage 2, tient compte du cumul déjà arbitré en Brassage 1.
        (totalCounts[a] || 0) - (totalCounts[b] || 0) ||
        // 3) rotation stable.
        String(a).localeCompare(String(b))
      )[0] || null;

      row.referee_team = referee;
      if (referee) {
        phasePoolCounts[referee] = (phasePoolCounts[referee] || 0) + 1;
        totalCounts[referee] = (totalCounts[referee] || 0) + 1;
      }
    });
  });

  return rows;
}

function refCountsFromRows(rows) {
  const counts = {};
  teams.forEach(t => counts[t.name] = 0);
  rows.forEach(row => {
    if (row.referee_team) counts[row.referee_team] = (counts[row.referee_team] || 0) + 1;
  });
  return counts;
}

async function rebalanceRefereesForBrassages() {
  if (!adminUnlocked) return;
  if (!confirm('Rééquilibrer les arbitres des brassages existants ? Les scores ne seront pas modifiés.')) return;

  const codeMap = buildTeamRefCodeMap(true);
  const sortMatches = (list) => list.slice().sort((a,b) =>
    String(a.phase || '').localeCompare(String(b.phase || '')) ||
    String(a.pool || '').localeCompare(String(b.pool || '')) ||
    Number(a.match_order || 0) - Number(b.match_order || 0) ||
    String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')) ||
    Number(a.id || 0) - Number(b.id || 0)
  );

  const b1 = sortMatches(matches.filter(m => m.phase === 'Brassage 1')).map(m => ({ ...m }));
  const b2 = sortMatches(matches.filter(m => m.phase === 'Brassage 2')).map(m => ({ ...m }));
  const newB1 = assignBalancedRefsInPools(b1, {});
  const newB2 = assignBalancedRefsInPools(b2, refCountsFromRows(newB1));
  const rowsToUpdate = [...newB1, ...newB2].filter(r => r.id);

  for (const row of rowsToUpdate) {
    const referee = row.referee_team || null;
    await client.from('matches').update({
      referee_team: referee,
      access_code: referee ? (codeMap[referee] || defaultCodeForTeamName(referee)) : null
    }).eq('id', row.id);
  }

  document.getElementById('adminMsg').innerText = `Arbitres rééquilibrés ✅ (${rowsToUpdate.length} matchs mis à jour)`;
  await loadData();
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
        referee_team: null,
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

function teamNumberFromName(name) {
  const m = String(name || '').match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
}

function globalRanking() {
  // Classement tableaux demandé : B2 uniquement en priorité, puis B1 en tie-break.
  // Pas de total B1+B2, pas de Diff B2 comme critère visible.
  const b2 = aggregatePhaseStats('Brassage 2');
  const b1 = aggregatePhaseStats('Brassage 1');
  return teams.map(t => ({
    name: t.name,
    b2Score: (b2[t.name] && b2[t.name].score != null ? b2[t.name].score : 0),
    b1Score: (b1[t.name] && b1[t.name].score != null ? b1[t.name].score : 0)
  })).sort((a,b) =>
    b.b2Score - a.b2Score ||
    b.b1Score - a.b1Score ||
    teamNumberFromName(a.name) - teamNumberFromName(b.name) ||
    String(a.name).localeCompare(String(b.name))
  );
}

function renderBrackets() {
  const rankDiv = document.getElementById('globalRankingView');
  const bracketDiv = document.getElementById('bracketsView');
  if (!rankDiv || !bracketDiv) return;

  const ranking = globalRanking();
  const topSeeds = ranking.slice(0,3).map((r,i) => `
    <div class="global-top-card rank-${i+1}">
      <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
      <strong>${r.name}</strong>
      <small>B2 ${r.b2Score} · B1 ${r.b1Score}</small>
    </div>
  `).join('');
  rankDiv.innerHTML = `<section class="global-ranking-card">
    <div class="ranking-phase-title"><span>Classement tableaux</span><small>Tri : B2 prioritaire, puis B1 en cas d'égalité</small></div>
    <div class="global-top3">${topSeeds}</div>
    <div class="table-scroll"><table class="ranking-table global-ranking-table">
      <tr><th>Rang</th><th>Équipe</th><th>B1</th><th>B2</th></tr>
      ${ranking.map((r,i) => `<tr class="rank-row ${i < 3 ? 'rank-highlight' : ''}"><td><span class="rank-badge">${i+1}</span></td><td class="team-cell"><b>${r.name}</b></td><td>${r.b1Score}</td><td class="score-cell">${r.b2Score}</td></tr>`).join('')}
    </table></div>
  </section>`;

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
  // Génération tableaux fiabilisée : aucun match ne part sans terrain.
  // Classement utilisé : B2 en priorité, B1 en tie-break (fait dans globalRanking()).
  const rows = [];
  const courtsCount = Math.max(1, Number(settings && settings.courts_count ? settings.courts_count : 6));
  const courtFor = function(order) { return ((Number(order || 1) - 1) % courtsCount) + 1; };
  const seedName = function(seedIndex) {
    return ranking[seedIndex - 1] && ranking[seedIndex - 1].name ? ranking[seedIndex - 1].name : 'À définir';
  };
  const safeRow = function(row) {
    const order = Number(row.match_order || rows.length + 1);
    return Object.assign({
      court: courtFor(order),
      scheduled_time: null,
      status: 'pending',
      referee_team: null,
      access_code: null
    }, row, {
      court: Number(row.court || courtFor(order)) || 1
    });
  };

  const mainPairs = [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
  mainPairs.forEach(function(p, idx) {
    rows.push(safeRow({
      phase:'Tableau principal', bracket:'Principal', round:'1/8 finale', match_order: idx + 1,
      team_a: seedName(p[0]), team_b: seedName(p[1]),
      next_match_order: 9 + Math.floor(idx / 2), next_slot: idx % 2 === 0 ? 'A' : 'B'
    }));
  });

  for (let i = 0; i < 4; i++) rows.push(safeRow({
    phase:'Tableau principal', bracket:'Principal', round:'Quart', match_order: 9 + i,
    team_a:'À définir', team_b:'À définir',
    next_match_order: 13 + Math.floor(i / 2), next_slot: i % 2 === 0 ? 'A' : 'B'
  }));

  for (let i = 0; i < 2; i++) rows.push(safeRow({
    phase:'Tableau principal', bracket:'Principal', round:'Demi', match_order: 13 + i,
    team_a:'À définir', team_b:'À définir',
    next_match_order: 15, next_slot: i === 0 ? 'A' : 'B',
    loser_next_match_order: 16, loser_next_slot: i === 0 ? 'A' : 'B'
  }));

  rows.push(safeRow({
    phase:'Tableau principal', bracket:'Principal', round:'Finale', match_order: 15,
    team_a:'À définir', team_b:'À définir'
  }));

  rows.push(safeRow({
    phase:'Tableau principal', bracket:'Principal', round:'3e place', match_order: 16,
    team_a:'À définir', team_b:'À définir'
  }));

  const consPairs = [[17,24],[20,21],[19,22],[18,23]];
  consPairs.forEach(function(p, idx) {
    rows.push(safeRow({
      phase:'Consolante', bracket:'Consolante', round:'Quart', match_order: 101 + idx,
      team_a: seedName(p[0]), team_b: seedName(p[1]),
      next_match_order: 105 + Math.floor(idx / 2), next_slot: idx % 2 === 0 ? 'A' : 'B'
    }));
  });

  for (let i = 0; i < 2; i++) rows.push(safeRow({
    phase:'Consolante', bracket:'Consolante', round:'Demi', match_order: 105 + i,
    team_a:'À définir', team_b:'À définir',
    next_match_order: 107, next_slot: i === 0 ? 'A' : 'B'
  }));

  rows.push(safeRow({
    phase:'Consolante', bracket:'Consolante', round:'Finale', match_order: 107,
    team_a:'À définir', team_b:'À définir'
  }));

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
  const rows = bracketRowsFromRanking(ranking).map((r, idx) => ({
    ...r,
    court: r.court || ((idx % 6) + 1),
    referee_team: null,
    access_code: null
  }));

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
setInterval(function(){ if (currentSection === 'publicView') renderPublicView(); }, 10000);



function isPublicMatchLive(m) {
  if (!m) return false;
  const status = String(m.status || '').toLowerCase().trim();
  if (['done','finished','completed','closed','termine','terminé'].includes(status)) return false;

  // v17.3f : l'écran public ne doit plus déduire EN COURS depuis un score,
  // ni depuis un vieux started_at local. Seul le statut réellement lancé compte.
  if (['live','active','in_progress','started','ongoing','running','en_cours','in progress'].includes(status)) return true;

  // Exception utile : si l'arbitre a le match actuellement ouvert sur CE navigateur.
  if (activeScoreMatchId && String(activeScoreMatchId) === String(m.id)) return true;

  return false;
}

function renderPublicView() {
  const div = document.getElementById('publicViewContent');
  if (!div) return;

  const now = new Date();
  const clock = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const phase = currentPhaseName ? currentPhaseName() : (settings && settings.current_phase ? settings.current_phase : 'Tournoi');
  const phaseEta = estimatedPhaseEnd(phase);
  const phaseEtaLabel = phaseEta ? ('Fin phase estimée : ' + phaseEta) : 'Fin phase estimée : à confirmer';

  const maxCourts = settings && settings.courts_count ? Number(settings.courts_count) : 6;
  const courts = [];
  for (let i = 1; i <= maxCourts; i++) courts.push(i);

  const playable = matches
    .filter(function(m) { return m.team_a && m.team_b && String(m.team_a).indexOf('À définir') === -1 && String(m.team_b).indexOf('À définir') === -1 && m.status !== 'done'; })
    .sort(function(a, b) {
      return Number(a.court || 999) - Number(b.court || 999) ||
        (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
        (a.id || 0) - (b.id || 0);
    });

  const nextToLaunchByCourt = courts
    .map(function(c) {
      return playable.find(function(m) { return Number(m.court) === Number(c) && !isPublicMatchLive(m); });
    })
    .filter(Boolean);

  const firstCall = nextToLaunchByCourt[0];
  const freeCourts = courts.filter(function(c) {
    return !playable.some(function(m) { return Number(m.court) === Number(c) && isPublicMatchLive(m); });
  });

  const callout = firstCall
    ? '<div class="public-callout is-urgent"><span>📢 Appel terrain ' + (firstCall.court || '-') + '</span><b>' + firstCall.team_a + ' vs ' + firstCall.team_b + '</b><em>Arbitre attendu : ' + (firstCall.referee_team || 'équipe à confirmer') + ' · Merci de vous présenter</em></div>'
    : (freeCourts.length
      ? '<div class="public-callout is-calm"><span>✅ Terrains disponibles</span><b>' + freeCourts.map(function(c){ return 'T' + c; }).join(' · ') + '</b><em>En attente de la prochaine rotation</em></div>'
      : '<div class="public-callout is-calm"><span>✅ Tous les matchs sont lancés</span><b>Matchs en cours</b><em>Prochaine rotation à confirmer</em></div>');

  const cards = courts.map(function(c) {
    const courtMatches = playable.filter(function(m) { return Number(m.court) === Number(c); });
    const liveMatch = courtMatches.find(isPublicMatchLive);
    const current = liveMatch || courtMatches[0];
    const next = courtMatches.find(function(m) { return current && m.id !== current.id && !isPublicMatchLive(m); });
    const isLive = !!liveMatch;
    const isFree = !liveMatch && !current;
    const statusText = isLive ? 'EN COURS' : (current ? 'À LANCER' : 'TERRAIN LIBRE');
    const statusClass = isLive ? 'is-live' : (current ? 'is-next' : 'is-free');

    let body = '';
    if (current) {
      const hasScore = current.score_a != null || current.score_b != null;
      const scoreA = current.score_a == null ? 0 : current.score_a;
      const scoreB = current.score_b == null ? 0 : current.score_b;
      body += '<div class="public-main-match">' +
        '<div class="public-team public-team-a">' + current.team_a + '</div>' +
        '<div class="public-vs">vs</div>' +
        '<div class="public-team public-team-b">' + current.team_b + '</div>' +
      '</div>';
      body += hasScore || isLive
        ? '<div class="public-scoreline premium"><span>' + scoreA + '</span><b>-</b><span>' + scoreB + '</span></div>'
        : '<div class="public-waiting">Match à lancer</div>';
      body += '<div class="public-ref premium-ref">Arbitre : ' + (current.referee_team || 'libre') + '</div>';
    } else {
      body += '<div class="public-free-panel"><b>Terrain disponible</b><span>Aucun match en attente</span></div>';
    }

    const nextHtml = next
      ? '<div class="public-next premium-next"><span>À suivre</span><b>' + next.team_a + ' vs ' + next.team_b + '</b><em>' + (computedScheduledTime(next) || 'Horaire à confirmer') + (next.referee_team ? ' · Arbitre : ' + next.referee_team : '') + '</em></div>'
      : '<div class="public-next premium-next is-empty"><span>À suivre</span><b>—</b><em>Aucun match programmé</em></div>';

    return '<div class="public-court-card premium-tv-card ' + statusClass + '">' +
      '<div class="public-court-top premium-court-top"><div><div class="public-court-title">Terrain ' + c + '</div><div class="public-court-subtitle">' + (current && computedScheduledTime(current) ? computedScheduledTime(current) : 'Rotation suivante') + '</div></div><div class="status-pill ' + statusClass + '">' + statusText + '</div></div>' +
      body + nextHtml +
    '</div>';
  }).join('');

  div.innerHTML = '<div class="public-tv premium-tv-screen">' +
    '<div class="public-tv-header premium-tv-header">' +
      '<div class="public-brand-block"><img src="club-logo.png" alt="CSM" class="public-logo"><div><div class="public-tv-title">Tournoi CSM Volleyball 91</div><div class="public-tv-subtitle">' + phase + ' · ' + phaseEtaLabel + '</div></div></div>' +
      '<div class="public-clock premium-clock">' + clock + '</div>' +
    '</div>' +
    callout +
    '<div class="public-courts premium-public-courts">' + cards + '</div>' +
  '</div>';
}

// v17.2a.6 - Outils admin visibles et indépendants du layout
function renderAdminAlwaysVisibleTools() {
  if (!adminUnlocked) return;
  const admin = document.getElementById('admin');
  if (!admin) return;
  let box = document.getElementById('adminToolsAlwaysVisible');
  if (!box) {
    box = document.createElement('div');
    box.id = 'adminToolsAlwaysVisible';
    box.className = 'admin-tools-always-visible';
    const msg = document.getElementById('adminMsg');
    if (msg && msg.parentNode) msg.parentNode.insertBefore(box, msg.nextSibling);
    else admin.insertBefore(box, admin.firstChild);
  }
  box.innerHTML = `
    <div class="admin-tools-title">
      <div>
        <p class="eyebrow dark">Actions rapides admin</p>
        <h3>Forfait / Reset match</h3>
      </div>
      <span class="admin-lock-badge">Visible après code keke</span>
    </div>
    <div class="admin-tools-buttons">
      <button class="danger admin-big-action" onclick="adminForfeitPromptFlow()">Forfait avec score choisi</button>
      <button class="admin-big-action" onclick="adminResetPromptFlow()">Reset match sécurisé</button>
    </div>
    <p class="small">Ces deux actions sont volontairement affichées ici, en haut de l’admin, pour éviter qu’elles soient cachées dans les panneaux.</p>
  `;
}


async function adminPausePromptFlow() {
  if (!adminUnlocked) return requestAdminAccess();
  const current = getTournamentPauseMinutes();
  const raw = prompt('Durée de pause à appliquer à la fin estimée de phase ?\nValeurs conseillées : 5, 10, 15 ou 20 minutes.\nMettre 0 pour annuler la pause.', current ? String(current) : '10');
  if (raw === null) return;
  const minutes = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(minutes) || minutes < 0) {
    alert('Durée invalide. Mets 0, 5, 10, 15 ou 20.');
    return;
  }

  // Tentative de sauvegarde partagée via Supabase si la colonne existe.
  // Si la colonne n'existe pas, fallback local sans bloquer le tournoi.
  let savedShared = false;
  try {
    const result = await client.from('settings').update({ pause_minutes: minutes }).eq('id', 1);
    savedShared = !result.error;
  } catch(e) {
    savedShared = false;
  }
  setLocalTournamentPauseMinutes(minutes);
  setTournamentPauseStartMs(minutes > 0 ? Date.now() : 0);
  if (settings) settings.pause_minutes = minutes;

  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = minutes > 0
    ? ('Pause tournoi appliquée : +' + minutes + ' min' + (savedShared ? ' ✅' : ' ✅ (local)'))
    : ('Pause tournoi annulée' + (savedShared ? ' ✅' : ' ✅ (local)'));
  renderDashboard();
  renderSubtitle();
}

function adminChooseMatchPrompt(label) {
  const eligible = matches
    .filter(m => m.team_a && m.team_b && m.team_a !== 'À définir' && m.team_b !== 'À définir')
    .sort((a,b) =>
      String(a.phase || '').localeCompare(String(b.phase || '')) ||
      Number(a.court || 999) - Number(b.court || 999) ||
      Number(a.match_order || 0) - Number(b.match_order || 0) ||
      String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')) ||
      Number(a.id || 0) - Number(b.id || 0)
    );
  if (!eligible.length) {
    alert('Aucun match disponible.');
    return null;
  }
  const list = eligible.map((m, i) => `${i + 1}. ${m.phase || '-'} · T${m.court || '-'} · ${m.team_a} vs ${m.team_b} · ${m.status || 'pending'} (${m.score_a == null ? 0 : m.score_a}-${m.score_b == null ? 0 : m.score_b})`).join('\n');
  const raw = prompt(`${label}\n\nChoisis le numéro du match :\n\n${list}`);
  if (raw === null) return null;
  const idx = Number(raw) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= eligible.length) {
    alert('Numéro invalide.');
    return null;
  }
  return eligible[idx];
}

async function adminForfeitPromptFlow() {
  if (!adminUnlocked) return requestAdminAccess();
  const m = adminChooseMatchPrompt('FORFAIT ADMIN');
  if (!m) return;
  const winnerRaw = prompt(`Vainqueur ?\n1. ${m.team_a}\n2. ${m.team_b}`);
  if (winnerRaw === null) return;
  const winnerSide = String(winnerRaw).trim() === '2' ? 'b' : 'a';
  const scoreRaw = prompt('Score à appliquer ?\nExemple : 15-0', '15-0');
  if (scoreRaw === null) return;
  const mm = String(scoreRaw).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!mm) {
    alert('Format score invalide. Utilise par exemple 15-0.');
    return;
  }
  const winScore = Number(mm[1]);
  const loseScore = Number(mm[2]);
  if (winScore === loseScore) {
    alert('Score invalide : il faut un vainqueur.');
    return;
  }
  const scoreA = winnerSide === 'a' ? winScore : loseScore;
  const scoreB = winnerSide === 'b' ? winScore : loseScore;
  const winner = winnerSide === 'a' ? m.team_a : m.team_b;
  const completedAt = new Date().toISOString();
  if (!confirm(`Confirmer forfait ?\n${m.team_a} ${scoreA} - ${scoreB} ${m.team_b}\nVainqueur : ${winner}`)) return;
  let result = await client.from('matches').update({ score_a: scoreA, score_b: scoreB, winner, status: 'done', completed_at: completedAt }).eq('id', m.id);
  if (result.error) result = await client.from('matches').update({ score_a: scoreA, score_b: scoreB, winner, status: 'done' }).eq('id', m.id);
  if (result.error) return alert('Erreur forfait : ' + result.error.message);
  saveLocalCompletedTime(m.id, completedAt);
  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = 'Forfait appliqué ✅';
  await loadData();
}

async function adminResetPromptFlow() {
  if (!adminUnlocked) return requestAdminAccess();

  const eligible = matches
    .filter(m => m.team_a && m.team_b && m.team_a !== 'À définir' && m.team_b !== 'À définir')
    .sort((a,b) => {
      const weight = x => (String(x.status || '').toLowerCase() === 'done' || String(x.status || '').toLowerCase() === 'finished') ? 0 : 1;
      return weight(a) - weight(b) ||
        String(a.phase || '').localeCompare(String(b.phase || '')) ||
        Number(a.court || 999) - Number(b.court || 999) ||
        Number(a.match_order || 0) - Number(b.match_order || 0) ||
        Number(a.id || 0) - Number(b.id || 0);
    });

  if (!eligible.length) {
    alert('Aucun match disponible à réinitialiser.');
    return;
  }

  const list = eligible.map((m, i) => {
    const a = m.score_a == null ? 0 : m.score_a;
    const b = m.score_b == null ? 0 : m.score_b;
    return `${i + 1}. ${m.phase || '-'} · T${m.court || '-'} · ${m.team_a} ${a}-${b} ${m.team_b} · ${m.status || 'pending'}`;
  }).join('\n');

  const raw = prompt(`RESET MATCH ADMIN\n\nChoisis le numéro du match à remettre à zéro :\n\n${list}`);
  if (raw === null) return;
  const idx = Number(raw) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= eligible.length) {
    alert('Numéro invalide.');
    return;
  }
  const m = eligible[idx];

  const confirmText = prompt(`Sécurité reset\n\n${m.phase || '-'} · T${m.court || '-'}\n${m.team_a} ${m.score_a == null ? 0 : m.score_a} - ${m.score_b == null ? 0 : m.score_b} ${m.team_b}\n\nTape RESET pour confirmer.`, '');
  if (confirmText !== 'RESET') {
    alert('Reset annulé.');
    return;
  }

  const payload = {
    score_a: 0,
    score_b: 0,
    winner: null,
    status: 'pending',
    started_at: null,
    completed_at: null
  };

  let result = await client.from('matches').update(payload).eq('id', m.id);
  if (result.error) {
    result = await client.from('matches').update({ score_a: 0, score_b: 0, winner: null, status: 'pending' }).eq('id', m.id);
  }
  if (result.error) return alert('Erreur reset match : ' + result.error.message);

  clearLocalCompletedTime(m.id);
  if (activeScoreMatchId === m.id) activeScoreMatchId = null;
  delete matchEditCodes[m.id];
  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = 'Match réinitialisé ✅ Score 0-0, statut à lancer.';
  await loadData();
}


let pauseCountdownIntervalStarted = true;
setInterval(function() {
  if (getTournamentPauseMinutes && getTournamentPauseMinutes() > 0) {
    renderDashboard();
    if (currentSection === 'publicView') renderPublicView();
  }
}, 10000);

/* v17.3j reprise refresh + anti double arbitre + validation score */
function volleyDeviceId() {
  const key = 'volley_device_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(16).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  } catch(e) {
    return 'dev_session';
  }
}

function activeMatchStorageKey() { return 'volley_active_score_match_id'; }
function matchLockStorageKey(id) { return 'volley_match_lock_' + id; }
function matchCodeStorageKey(id) { return 'volley_match_code_' + id; }

function setLocalMatchSession(id, code) {
  try {
    localStorage.setItem(activeMatchStorageKey(), String(id));
    localStorage.setItem(matchLockStorageKey(id), volleyDeviceId());
    if (code) localStorage.setItem(matchCodeStorageKey(id), normalizeCode(code));
  } catch(e) {}
}

function clearLocalMatchSession(id) {
  try {
    localStorage.removeItem(activeMatchStorageKey());
    if (id != null) {
      localStorage.removeItem(matchLockStorageKey(id));
      localStorage.removeItem(matchCodeStorageKey(id));
    }
  } catch(e) {}
}

function hasLocalMatchSession(id) {
  try {
    return localStorage.getItem(matchLockStorageKey(id)) === volleyDeviceId();
  } catch(e) {
    return false;
  }
}

function restoreActiveScoreMatch() {
  try {
    if (activeScoreMatchId) return;
    const id = localStorage.getItem(activeMatchStorageKey());
    if (!id) return;
    const m = matches.find(function(x) { return String(x.id) === String(id); });
    if (m && isStartedForResume(m) && hasLocalMatchSession(m.id)) {
      activeScoreMatchId = m.id;
    }
  } catch(e) {}
}

function codeForMatch(m) {
  const memoryCode = normalizeCode(matchEditCodes[m.id]);
  if (memoryCode) return memoryCode;
  try { return normalizeCode(localStorage.getItem(matchCodeStorageKey(m.id))); } catch(e) { return ''; }
}

function canEditMatch(m) {
  return hasLocalMatchSession(m.id) && validateCodeForMatch(m, codeForMatch(m));
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
  try { localStorage.setItem(matchCodeStorageKey(m.id), clean); } catch(e) {}
  return clean;
}

function validateFinalScore(m) {
  const a = Number(m.score_a == null ? 0 : m.score_a);
  const b = Number(m.score_b == null ? 0 : m.score_b);
  if (a === 0 && b === 0) {
    return 'Score invalide : le match est à 0-0. Saisis au moins un point avant de terminer.';
  }
  if (a === b) {
    return 'Score invalide : un match doit avoir un vainqueur, avec au moins 1 point d’écart.';
  }
  return '';
}

async function launchMatch(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;

  if (isDoneMatch(m)) {
    alert('Ce match est déjà terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }

  // v17.3l : si le match est déjà lancé, on autorise une reprise depuis n’importe quel appareil
  // à condition de confirmer le code arbitre du match.
  if (isLiveMatchStatus(m)) {
    openLiveMatch(id);
    return;
  }

  const otherLive = activeMatchOnCourt(m.court, m.id);
  if (otherLive) {
    alert('Terrain ' + (m.court || '-') + ' déjà occupé par : ' + otherLive.team_a + ' vs ' + otherLive.team_b + '. Termine ou reset ce match avant d’en lancer un autre.');
    return;
  }

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
  setLocalMatchSession(id, code);
  activeScoreMatchId = id;
  await loadData();
}

function openLiveMatch(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;
  if (isDoneMatch(m)) {
    alert('Ce match est terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }

  // v17.3l : reprise de main autorisée depuis un autre appareil via le code arbitre.
  if (!canEditMatch(m)) {
    const code = askRefCodeForMatch(m);
    if (!code) return;
    if (isLiveMatchStatus(m) && !hasLocalMatchSession(m.id)) {
      const ok = confirm('Reprendre la saisie de ce match sur cet appareil ?\n\nSi un autre arbitre l’a encore ouvert, évitez de saisir à deux en même temps.');
      if (!ok) return;
    }
    setLocalMatchSession(m.id, code);
  }

  activeScoreMatchId = id;
  renderScoreSection();
}

async function finishMatch(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;
  const invalid = validateFinalScore(m);
  if (invalid) {
    alert(invalid);
    return;
  }
  const a = Number(m.score_a == null ? 0 : m.score_a);
  const b = Number(m.score_b == null ? 0 : m.score_b);
  if (!confirm(`Confirmer le score ?\n${m.team_a}: ${a}\n${m.team_b}: ${b}`)) return;
  const winner = a > b ? m.team_a : m.team_b;
  const completedAt = new Date().toISOString();
  let result = await client.from('matches').update({ status: 'done', winner: winner, completed_at: completedAt }).eq('id', id);
  if (result.error) {
    result = await client.from('matches').update({ status: 'done', winner: winner }).eq('id', id);
  }
  if (result.error) {
    alert('Erreur fin de match : ' + result.error.message);
    return;
  }
  saveLocalCompletedTime(id, completedAt);
  delete matchEditCodes[id];
  clearLocalMatchSession(id);
  if (String(activeScoreMatchId) === String(id)) activeScoreMatchId = null;
  await loadData();
}

const renderScoreSectionBase_v173j = renderScoreSection;
renderScoreSection = function() {
  restoreActiveScoreMatch();
  renderScoreSectionBase_v173j();
};

const loadDataBase_v173j = loadData;
loadData = async function() {
  await loadDataBase_v173j();
  restoreActiveScoreMatch();
  if (currentSection === 'score') renderScoreSection();
};

/* v17.3k chrono + prochain match */
function chronoDurationMinutes() {
  const n = Number(settings && settings.match_duration ? settings.match_duration : 12);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

function matchStartedMs(m) {
  const raw = getMatchStartedAt(m);
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function formatClockSeconds(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return mm + ':' + ss;
}

function chronoStateForMatch(m) {
  const start = matchStartedMs(m);
  const duration = chronoDurationMinutes() * 60000;
  if (!start || !duration) return { text: '--:--', ended: false, remainingMs: duration || 0 };
  const remaining = start + duration - Date.now();
  return { text: formatClockSeconds(remaining / 1000), ended: remaining <= 0, remainingMs: remaining };
}

function chronoHtml(m) {
  if (!m || !isLiveMatchStatus(m) || isDoneMatch(m)) return '';
  const start = matchStartedMs(m);
  const duration = chronoDurationMinutes();
  const state = chronoStateForMatch(m);
  const cls = state.ended ? ' match-chrono-ended' : '';
  return `<div class="match-chrono${cls}" data-match-id="${m.id}" data-start-ms="${start}" data-duration-min="${duration}">
    <span class="chrono-label">Chrono</span>
    <strong class="chrono-value">${state.ended ? 'Temps écoulé' : state.text}</strong>
  </div>`;
}

function updateChronoDisplays() {
  document.querySelectorAll('.match-chrono').forEach(function(el) {
    const start = Number(el.getAttribute('data-start-ms') || 0);
    const duration = Number(el.getAttribute('data-duration-min') || chronoDurationMinutes());
    const value = el.querySelector('.chrono-value');
    if (!start || !value) return;
    const remaining = start + duration * 60000 - Date.now();
    if (remaining <= 0) {
      el.classList.add('match-chrono-ended');
      value.textContent = 'Temps écoulé';
    } else {
      el.classList.remove('match-chrono-ended');
      value.textContent = formatClockSeconds(remaining / 1000);
    }
  });
}

function maybeWarnChronoEnded(m) {
  if (!m || !isLiveMatchStatus(m) || isDoneMatch(m)) return;
  const state = chronoStateForMatch(m);
  const key = 'volley_chrono_warned_' + m.id;
  if (state.ended) {
    try {
      if (localStorage.getItem(key) === '1') return;
      localStorage.setItem(key, '1');
    } catch(e) {}
    setTimeout(function() {
      if (activeScoreMatchId && String(activeScoreMatchId) === String(m.id)) {
        if (confirm('Temps écoulé pour ce match. Terminer le match maintenant ?')) {
          finishMatch(m.id);
        }
      }
    }, 100);
  }
}

function nextPendingMatchOnCourt(court) {
  const c = normalizeCourt ? normalizeCourt(court) : String(court || '');
  const list = matches.filter(function(x) {
    const xc = normalizeCourt ? normalizeCourt(x.court) : String(x.court || '');
    return xc === c && !isDoneMatch(x) && !isLiveMatchStatus(x);
  });
  list.sort(function(a, b) {
    const ta = scheduledSortValue ? scheduledSortValue(a) : (Number(a.match_order || a.order || a.id) || 0);
    const tb = scheduledSortValue ? scheduledSortValue(b) : (Number(b.match_order || b.order || b.id) || 0);
    return ta - tb;
  });
  return list[0] || null;
}

function proposeNextMatchAfterFinish(finishedMatch) {
  const next = nextPendingMatchOnCourt(finishedMatch && finishedMatch.court);
  if (!next) return;
  const ref = isBracketMatch(next) ? 'arbitrage libre' : (next.referee_team || 'à définir');
  const msg = 'Terrain ' + (next.court || '-') + ' libre.\n\nLancer le prochain match ?\n' +
    (next.team_a || 'À définir') + ' vs ' + (next.team_b || 'À définir') + '\n' +
    'Arbitre attendu : ' + ref;
  setTimeout(function() {
    if (confirm(msg)) launchMatch(next.id);
  }, 250);
}

const renderMatchScoreboardBase_v173k = renderMatchScoreboard;
renderMatchScoreboard = function(m) {
  if (!m || isBracketMatch(m)) return renderMatchScoreboardBase_v173k(m);
  const html = `
    <div class="scoreboard-full scoreboard-polish-k">
      <div class="score-half team-a">
        <div class="team-title">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'a', 1)"` : 'disabled'}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'a', -1)"` : 'disabled'}>−</button>
      </div>

      <div class="center-controls center-controls-k">
        <div class="mini-meta">T${m.court || '-'} · ${m.phase || ''}</div>
        ${chronoHtml(m)}
        ${canEditMatch(m) ? `<button class="danger finish-btn finish-btn-k" onclick="finishMatch(${m.id})">Terminer le match</button>` : lockedMatchHtml(m)}
      </div>

      <div class="score-half team-b">
        <div class="team-title">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'b', 1)"` : 'disabled'}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${canEditMatch(m) ? `onclick="changePoint(${m.id}, 'b', -1)"` : 'disabled'}>−</button>
      </div>
    </div>
  `;
  setTimeout(function() { maybeWarnChronoEnded(m); updateChronoDisplays(); }, 50);
  return html;
};

const finishMatchBase_v173k = finishMatch;
finishMatch = async function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  await finishMatchBase_v173k(id);
  const stillLive = matches.find(function(x) { return String(x.id) === String(id) && !isDoneMatch(x); });
  if (m && !stillLive) proposeNextMatchAfterFinish(m);
};

setInterval(updateChronoDisplays, 1000);

/* v17.3p - chrono persistant + buzzer + prochain match renforcé */
function playTournamentBuzzer() {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach(function(offset) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(720, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
    setTimeout(function(){ try { ctx.close(); } catch(e) {} }, 900);
  } catch(e) {}
}

function startedAtForPersistentChrono(m) {
  const raw = getMatchStartedAt(m);
  if (raw) return raw;
  const fallback = localStorage.getItem('volley_match_started_at_' + (m && m.id));
  return fallback || '';
}

// Renforce la persistance : si Supabase n'a pas encore started_at, on s'appuie sur le cache local.
const matchStartedMsBase_v173p = matchStartedMs;
matchStartedMs = function(m) {
  const raw = startedAtForPersistentChrono(m);
  const ms = raw ? new Date(raw).getTime() : 0;
  if (Number.isFinite(ms) && ms > 0) return ms;
  return matchStartedMsBase_v173p ? matchStartedMsBase_v173p(m) : 0;
};

const maybeWarnChronoEndedBase_v173p = maybeWarnChronoEnded;
maybeWarnChronoEnded = function(m) {
  if (!m || !isLiveMatchStatus(m) || isDoneMatch(m)) return;
  const state = chronoStateForMatch(m);
  const key = 'volley_chrono_warned_' + m.id;
  if (!state.ended) return;
  try {
    if (localStorage.getItem(key) === '1') return;
    localStorage.setItem(key, '1');
  } catch(e) {}
  setTimeout(function() {
    playTournamentBuzzer();
    if (activeScoreMatchId && String(activeScoreMatchId) === String(m.id)) {
      if (confirm('⏱ Temps écoulé pour ce match.\n\nTerminer le match maintenant ?')) {
        finishMatch(m.id);
      }
    } else {
      alert('⏱ Temps écoulé sur le terrain ' + (m.court || '-') + '.');
    }
  }, 120);
};

const proposeNextMatchAfterFinishBase_v173p = proposeNextMatchAfterFinish;
proposeNextMatchAfterFinish = function(finishedMatch) {
  const next = nextPendingMatchOnCourt(finishedMatch && finishedMatch.court);
  if (!next) return;
  const ref = isBracketMatch(next) ? 'arbitrage libre' : (next.referee_team || 'à définir');
  const msg = '✅ Terrain ' + (next.court || '-') + ' libre.\n\n' +
    'Lancer le prochain match ?\n\n' +
    (next.team_a || 'À définir') + ' vs ' + (next.team_b || 'À définir') + '\n' +
    'Arbitre attendu : ' + ref;
  setTimeout(function() {
    if (confirm(msg)) launchMatch(next.id);
  }, 350);
};

/* v17.3q - chrono démarre dès la saisie/reprise */
function ensureMatchChronoStarted(m) {
  if (!m || !m.id) return '';
  let raw = getMatchStartedAt(m);
  if (raw) {
    try { saveLocalStartedTime(m.id, raw); } catch(e) {}
    return raw;
  }
  raw = new Date().toISOString();
  try { saveLocalStartedTime(m.id, raw); } catch(e) {}
  try { localStorage.setItem('volley_match_started_at_' + m.id, raw); } catch(e) {}
  m.started_at = raw;
  return raw;
}

const launchMatchBase_v173q = launchMatch;
launchMatch = async function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (m && isLiveMatchStatus(m)) {
    ensureMatchChronoStarted(m);
  }
  await launchMatchBase_v173q(id);
  const refreshed = matches.find(function(x) { return String(x.id) === String(id); });
  if (refreshed && isLiveMatchStatus(refreshed)) {
    ensureMatchChronoStarted(refreshed);
    activeScoreMatchId = id;
    renderScoreSection();
  }
};

const openLiveMatchBase_v173q = openLiveMatch;
openLiveMatch = function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (m) ensureMatchChronoStarted(m);
  openLiveMatchBase_v173q(id);
  const active = matches.find(function(x) { return String(x.id) === String(id); });
  if (active) {
    ensureMatchChronoStarted(active);
    setTimeout(function(){ updateChronoDisplays(); maybeWarnChronoEnded(active); }, 50);
  }
};

const renderMatchScoreboardBase_v173q = renderMatchScoreboard;
renderMatchScoreboard = function(m) {
  if (m && isLiveMatchStatus(m) && !isDoneMatch(m)) ensureMatchChronoStarted(m);
  let html = renderMatchScoreboardBase_v173q(m);
  if (!m || isBracketMatch(m) || isDoneMatch(m)) return html;
  const chrono = chronoHtml(m);
  if (chrono && html.indexOf('match-chrono') === -1) {
    html = html.replace('<div class="mini-meta">', chrono + '<div class="mini-meta">');
  }
  setTimeout(function(){ updateChronoDisplays(); maybeWarnChronoEnded(m); }, 50);
  return html;
};

/* v17.3r - chrono stable : ne se réinitialise plus à chaque point */
function stableStartedAtKeys(id) {
  return [
    'match_started_at_' + id,
    'volley_match_started_at_' + id,
    (typeof matchStartStorageKey === 'function' ? matchStartStorageKey(id) : 'volley_match_start_' + id)
  ];
}

function getStableLocalStartedAt(id) {
  try {
    const keys = stableStartedAtKeys(id);
    for (let i = 0; i < keys.length; i++) {
      const v = localStorage.getItem(keys[i]);
      if (v) return v;
    }
  } catch(e) {}
  return '';
}

function setStableLocalStartedAt(id, value) {
  if (!id || !value) return;
  try {
    stableStartedAtKeys(id).forEach(function(k) {
      localStorage.setItem(k, value);
    });
  } catch(e) {}
}

const getMatchStartedAtBase_v173r = getMatchStartedAt;
getMatchStartedAt = function(m) {
  if (!m) return '';
  const id = m.id;
  const local = id ? getStableLocalStartedAt(id) : '';
  if (local) return local;
  const raw = m.started_at || m.start_actual || m.startedAt || '';
  if (raw && id) setStableLocalStartedAt(id, raw);
  return raw || (getMatchStartedAtBase_v173r ? getMatchStartedAtBase_v173r(m) : '');
};

ensureMatchChronoStarted = function(m) {
  if (!m || !m.id) return '';
  let raw = getStableLocalStartedAt(m.id);
  if (raw) {
    m.started_at = raw;
    return raw;
  }
  raw = m.started_at || m.start_actual || m.startedAt || '';
  if (!raw) raw = new Date().toISOString();
  setStableLocalStartedAt(m.id, raw);
  m.started_at = raw;
  return raw;
};

const saveLocalStartedTimeBase_v173r = saveLocalStartedTime;
saveLocalStartedTime = function(id, value) {
  setStableLocalStartedAt(id, value);
  if (saveLocalStartedTimeBase_v173r) saveLocalStartedTimeBase_v173r(id, value);
};

/* v17.3s - chrono ultra-stable par match actif, y compris nouveau match */
window.__volleyChronoStarts = window.__volleyChronoStarts || {};

function chronoMemoryKey(id) {
  return 'm_' + String(id);
}

function readAnyStartedAtForMatch(m) {
  if (!m || !m.id) return '';
  const id = m.id;
  const mem = window.__volleyChronoStarts[chronoMemoryKey(id)];
  if (mem) return mem;

  const candidates = [
    'volley_chrono_started_at_' + id,
    'match_started_at_' + id,
    'volley_match_started_at_' + id,
    'volley_match_start_' + id
  ];
  try {
    if (typeof matchStartStorageKey === 'function') candidates.push(matchStartStorageKey(id));
  } catch(e) {}

  try {
    for (let i = 0; i < candidates.length; i++) {
      const v = localStorage.getItem(candidates[i]);
      if (v) {
        window.__volleyChronoStarts[chronoMemoryKey(id)] = v;
        return v;
      }
    }
  } catch(e) {}

  const raw = m.started_at || m.start_actual || m.startedAt || '';
  if (raw) {
    writeStartedAtEverywhere(id, raw);
    return raw;
  }
  return '';
}

function writeStartedAtEverywhere(id, value) {
  if (!id || !value) return;
  window.__volleyChronoStarts[chronoMemoryKey(id)] = value;
  const keys = [
    'volley_chrono_started_at_' + id,
    'match_started_at_' + id,
    'volley_match_started_at_' + id,
    'volley_match_start_' + id
  ];
  try {
    if (typeof matchStartStorageKey === 'function') keys.push(matchStartStorageKey(id));
  } catch(e) {}
  try { keys.forEach(function(k) { localStorage.setItem(k, value); }); } catch(e) {}
}

function ensureStableChronoForMatch(m) {
  if (!m || !m.id) return '';
  let started = readAnyStartedAtForMatch(m);
  if (!started) started = new Date().toISOString();
  writeStartedAtEverywhere(m.id, started);
  m.started_at = started;
  return started;
}

getMatchStartedAt = function(m) {
  return readAnyStartedAtForMatch(m);
};

ensureMatchChronoStarted = function(m) {
  return ensureStableChronoForMatch(m);
};

saveLocalStartedTime = function(id, value) {
  writeStartedAtEverywhere(id, value);
};

matchStartedMs = function(m) {
  const raw = readAnyStartedAtForMatch(m);
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
};

const changePointBase_v173s = changePoint;
changePoint = async function(id, side, delta) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (m) ensureStableChronoForMatch(m);
  await changePointBase_v173s(id, side, delta);
  const refreshed = matches.find(function(x) { return String(x.id) === String(id); });
  if (refreshed) ensureStableChronoForMatch(refreshed);
  setTimeout(updateChronoDisplays, 30);
};

const addPointBase_v173s = typeof addPoint === 'function' ? addPoint : null;
if (addPointBase_v173s) {
  addPoint = async function(id, side) {
    const m = matches.find(function(x) { return String(x.id) === String(id); });
    if (m) ensureStableChronoForMatch(m);
    await addPointBase_v173s(id, side);
    const refreshed = matches.find(function(x) { return String(x.id) === String(id); });
    if (refreshed) ensureStableChronoForMatch(refreshed);
    setTimeout(updateChronoDisplays, 30);
  };
}

/* v17.3t - reset complet : purge reprise/chrono après reset */
function clearStartedAtEverywhere(id) {
  if (!id) return;
  try {
    if (window.__volleyChronoStarts) delete window.__volleyChronoStarts[chronoMemoryKey(id)];
  } catch(e) {}
  const keys = [
    'volley_chrono_started_at_' + id,
    'match_started_at_' + id,
    'volley_match_started_at_' + id,
    'volley_match_start_' + id,
    'volley_started_time_' + id
  ];
  try {
    if (typeof matchStartStorageKey === 'function') keys.push(matchStartStorageKey(id));
  } catch(e) {}
  try { keys.forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
}

function clearMatchRuntimeLocalState(id) {
  clearStartedAtEverywhere(id);
  try { clearLocalMatchSession(id); } catch(e) {}
  try { clearLocalCompletedTime(id); } catch(e) {}
  try { delete matchEditCodes[id]; } catch(e) {}
}

// Important : un ancien cache local ne doit plus suffire à faire apparaître un match en "Reprendre".
// La reprise est réservée aux matchs réellement live, ou à un score déjà saisi.
isStartedForResume = function(m) {
  if (!m || !m.team_a || !m.team_b || isDoneMatch(m)) return false;
  return isLiveMatchStatus(m) || hasScoreStarted(m);
};

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet de tous les scores ?\n\nLes scores, vainqueurs, statuts live et chronos de reprise seront remis à zéro.')) return;

  const fullPayload = {
    score_a: 0,
    score_b: 0,
    winner: null,
    status: 'pending',
    started_at: null,
    completed_at: null
  };

  let result = await client.from('matches').update(fullPayload).neq('id', 0);
  if (result.error) {
    result = await client.from('matches').update({
      score_a: 0,
      score_b: 0,
      winner: null,
      status: 'pending'
    }).neq('id', 0);
  }

  if (result.error) {
    document.getElementById('adminMsg').innerText = 'Erreur reset : ' + result.error.message;
    return;
  }

  matches.forEach(function(m) { clearMatchRuntimeLocalState(m.id); });
  try { localStorage.removeItem(activeMatchStorageKey()); } catch(e) {}
  activeScoreMatchId = null;

  document.getElementById('adminMsg').innerText = 'Reset complet effectué ✅ Scores 0-0, statuts à jouer, chronos/reprises purgés.';
  await loadData();
};

/* v17.3u - reset revient au Brassage 1 + scoring points aussi pour les tableaux */
function phasePlayOrderValue(m) {
  const p = String(m && m.phase ? m.phase : '').toLowerCase();
  if (p.includes('brassage 1')) return 1;
  if (p.includes('brassage 2')) return 2;
  if (p.includes('tableau principal')) return 3;
  if (p.includes('consolante')) return 4;
  if (p.includes('tableau')) return 3;
  return 9;
}

function tournamentPlaySort(a, b) {
  return phasePlayOrderValue(a) - phasePlayOrderValue(b) ||
    (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
    Number(a.court || 0) - Number(b.court || 0) ||
    (a.match_order || 0) - (b.match_order || 0) ||
    Number(a.id || 0) - Number(b.id || 0);
}

nextPlayableMatches = function(limit = 6) {
  return matches
    .filter(isPlayableMatch)
    .sort(tournamentPlaySort)
    .slice(0, limit);
};

function renderPointScoreboard_v173u(m) {
  const locked = !canEditMatch(m);
  return `
    <div class="scoreboard-full scoreboard-polish-k">
      <div class="score-half team-a">
        <div class="team-title">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', 1)"`}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', -1)"`}>−</button>
      </div>

      <div class="center-controls center-controls-k">
        ${chronoHtml(m)}
        <div class="mini-meta">T${m.court || '-'} · ${m.phase || ''}${m.round ? ' · ' + m.round : ''}</div>
        ${locked ? lockedMatchHtml(m) : `<button class="danger finish-btn finish-btn-k" onclick="finishMatch(${m.id})">Terminer le match</button>`}
      </div>

      <div class="score-half team-b">
        <div class="team-title">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', 1)"`}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', -1)"`}>−</button>
      </div>
    </div>
  `;
}

const renderMatchScoreboardBase_v173u = renderMatchScoreboard;
renderMatchScoreboard = function(m) {
  if (m && isBracketMatch(m) && !isDoneMatch(m)) {
    if (isLiveMatchStatus(m)) ensureMatchChronoStarted(m);
    const html = renderPointScoreboard_v173u(m);
    setTimeout(function(){ updateChronoDisplays(); maybeWarnChronoEnded(m); }, 50);
    return html;
  }
  return renderMatchScoreboardBase_v173u(m);
};

async function propagateBracketResult_v173u(m, winner, loser) {
  if (!m || !isBracketMatch(m)) return;

  if (m.next_match_order) {
    const next = matches.find(x => String(x.bracket) === String(m.bracket) && Number(x.match_order) === Number(m.next_match_order));
    if (next) {
      const payload = {};
      if (m.next_slot === 'A') payload.team_a = winner;
      if (m.next_slot === 'B') payload.team_b = winner;
      if (Object.keys(payload).length) await client.from('matches').update(payload).eq('id', next.id);
    }
  }

  if (m.loser_next_match_order) {
    const nextLoser = matches.find(x => String(x.bracket) === String(m.bracket) && Number(x.match_order) === Number(m.loser_next_match_order));
    if (nextLoser) {
      const payload = {};
      if (m.loser_next_slot === 'A') payload.team_a = loser;
      if (m.loser_next_slot === 'B') payload.team_b = loser;
      if (Object.keys(payload).length) await client.from('matches').update(payload).eq('id', nextLoser.id);
    }
  }
}

finishMatch = async function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;

  const invalid = validateFinalScore(m);
  if (invalid) {
    alert(invalid);
    return;
  }

  const a = Number(m.score_a == null ? 0 : m.score_a);
  const b = Number(m.score_b == null ? 0 : m.score_b);
  if (!confirm(`Confirmer le score ?\n${m.team_a}: ${a}\n${m.team_b}: ${b}`)) return;

  const winner = a > b ? m.team_a : m.team_b;
  const loser = a > b ? m.team_b : m.team_a;
  const completedAt = new Date().toISOString();
  const payloadDone = { status: 'done', winner: winner, completed_at: completedAt };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(codeForMatch(m));
    if (refTeam) payloadDone.referee_team = refTeam;
  }

  let result = await client.from('matches').update(payloadDone).eq('id', id);
  if (result.error) {
    const fallback = { status: 'done', winner: winner };
    if (payloadDone.referee_team) fallback.referee_team = payloadDone.referee_team;
    result = await client.from('matches').update(fallback).eq('id', id);
  }
  if (result.error) {
    alert('Erreur fin de match : ' + result.error.message);
    return;
  }

  await propagateBracketResult_v173u(m, winner, loser);
  saveLocalCompletedTime(id, completedAt);
  delete matchEditCodes[id];
  clearLocalMatchSession(id);
  clearStartedAtEverywhere(id);
  if (String(activeScoreMatchId) === String(id)) activeScoreMatchId = null;

  await loadData();
  proposeNextMatchAfterFinish(m);
};

/* v17.3v - reset tournoi propre : suppression des anciens tableaux + planning par ordre de phase */
const renderPlanningBase_v173v = typeof renderPlanning === 'function' ? renderPlanning : null;
renderPlanning = function() {
  const div = document.getElementById('planningView');
  if (!div) return;
  const courtEl = document.getElementById('courtFilter');
  const court = courtEl ? courtEl.value : '';
  const phaseEl = document.getElementById('phaseFilter');
  const phase = phaseEl ? phaseEl.value : '';
  let list = [...matches];
  if (court) list = list.filter(m => String(m.court) === court);
  if (phase) list = list.filter(m => m.phase === phase);
  list.sort(tournamentPlaySort);
  div.innerHTML = `<table>
    <tr><th>Heure</th><th>Terrain</th><th>Phase</th><th>Poule</th><th>Match</th><th>Arbitre</th><th>Score</th><th>Statut</th></tr>
    ${list.map(m => `<tr>
      <td>${computedScheduledTime(m) || ''}</td>
      <td>T${m.court || '-'}</td>
      <td>${m.phase || '-'}</td>
      <td>${m.pool || '-'}</td>
      <td>#${m.id} ${m.team_a || 'À définir'} vs ${m.team_b || 'À définir'}</td>
      <td>${m.referee_team || '-'}</td>
      <td>${scoreText(m)}</td>
      <td>${statusText(m)}</td>
    </tr>`).join('')}
  </table>`;
};

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet du tournoi ?\n\nLes scores/chronos seront remis à zéro et les anciens tableaux seront supprimés pour repartir sur Brassage 1.')) return;

  // 1) Supprimer les tableaux déjà générés, sinon ils restent en base et réapparaissent dans Planning.
  let deleteResult = await client.from('matches').delete().in('phase', ['Tableau principal','Consolante']);
  if (deleteResult.error) {
    document.getElementById('adminMsg').innerText = 'Erreur suppression anciens tableaux : ' + deleteResult.error.message;
    return;
  }

  // 2) Remettre les matchs de brassage à zéro.
  const fullPayload = {
    score_a: 0,
    score_b: 0,
    winner: null,
    status: 'pending',
    started_at: null,
    completed_at: null
  };

  let result = await client.from('matches').update(fullPayload).in('phase', ['Brassage 1','Brassage 2']);
  if (result.error) {
    result = await client.from('matches').update({
      score_a: 0,
      score_b: 0,
      winner: null,
      status: 'pending'
    }).in('phase', ['Brassage 1','Brassage 2']);
  }

  if (result.error) {
    document.getElementById('adminMsg').innerText = 'Erreur reset : ' + result.error.message;
    return;
  }

  matches.forEach(function(m) { clearMatchRuntimeLocalState(m.id); });
  try { localStorage.removeItem(activeMatchStorageKey()); } catch(e) {}
  activeScoreMatchId = null;

  document.getElementById('adminMsg').innerText = 'Reset complet effectué ✅ Anciens tableaux supprimés, Brassage 1/2 remis à 0-0.';
  await loadData();
};

/* v17.3x - reset tournoi dur renforcé : purge vérifiée + cache bust */
async function deleteAllMatchesHard_v173x(adminMsg) {
  // 1) Tentative la plus fiable : supprimer par identifiants déjà chargés à l'écran.
  const ids = [...new Set((matches || []).map(m => m.id).filter(id => id !== null && id !== undefined))];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (!chunk.length) continue;
    const byId = await client.from('matches').delete().in('id', chunk);
    if (byId.error) throw new Error('suppression par id : ' + byId.error.message);
  }

  // 2) Sécurité : supprimer aussi par phases connues, au cas où des lignes n'étaient pas chargées localement.
  const phases = ['Brassage 1', 'Brassage 2', 'Tableau principal', 'Consolante'];
  const byPhase = await client.from('matches').delete().in('phase', phases);
  if (byPhase.error) throw new Error('suppression par phase : ' + byPhase.error.message);

  // 3) Sécurité ultime : supprimer toute ligne restante avec un id non nul.
  // Certains navigateurs avaient encore l'ancien script en cache, d'où ce reset renforcé et vérifié.
  const byAnyId = await client.from('matches').delete().not('id', 'is', null);
  if (byAnyId.error) throw new Error('suppression globale : ' + byAnyId.error.message);

  // 4) Vérification réelle en base : si des lignes restent, on ne ment pas à l'utilisateur.
  const check = await client.from('matches').select('id, phase, team_a, team_b').limit(5);
  if (check.error) throw new Error('vérification après suppression : ' + check.error.message);
  if (check.data && check.data.length) {
    const sample = check.data.map(m => `#${m.id} ${m.phase || '-'} ${m.team_a || '?'} vs ${m.team_b || '?'}`).join(' / ');
    throw new Error('des matchs restent en base après suppression : ' + sample);
  }
}

function clearAllVolleyLocalStorage_v173x() {
  try {
    Object.keys(localStorage).forEach(function(k) {
      if (k.indexOf('volley_') === 0 || k.indexOf('match_started_at_') === 0) localStorage.removeItem(k);
    });
  } catch(e) {}
}

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet DUR du tournoi ?\n\nCela supprime TOUS les matchs en base, purge les chronos/reprises, puis recrée uniquement le Brassage 1.')) return;

  const adminMsg = document.getElementById('adminMsg');
  if (adminMsg) adminMsg.innerText = 'Reset dur en cours : suppression des anciens matchs...';

  try {
    (matches || []).forEach(function(m) { clearMatchRuntimeLocalState(m.id); });
    clearAllVolleyLocalStorage_v173x();
  } catch(e) {}
  activeScoreMatchId = null;

  try {
    await deleteAllMatchesHard_v173x(adminMsg);
  } catch (e) {
    if (adminMsg) adminMsg.innerText = 'Reset bloqué ❌ ' + e.message;
    alert('Reset bloqué : ' + e.message + '\n\nLes anciens matchs n’ont pas été supprimés, donc je ne recrée pas Brassage 1 par-dessus pour éviter les doublons.');
    return;
  }

  if (adminMsg) adminMsg.innerText = 'Anciens matchs supprimés ✅ Recréation Brassage 1...';

  const rows = generateBrassage1Rows();
  const ins = await client.from('matches').insert(rows);
  if (ins.error) {
    if (adminMsg) adminMsg.innerText = 'Erreur régénération Brassage 1 : ' + ins.error.message;
    return;
  }

  await loadData();
  try {
    const phaseFilter = document.getElementById('phaseFilter');
    if (phaseFilter) phaseFilter.value = 'Brassage 1';
    renderPlanning();
  } catch(e) {}
  if (adminMsg) adminMsg.innerText = 'Reset dur effectué ✅ Seul Brassage 1 existe maintenant.';
};

/* v17.3y - reset compatible RLS : archivage logique si le DELETE Supabase est bloqué */
function isArchivedMatch_v173y(m) {
  return !m || m.phase === 'Archive' || m.phase === '__ARCHIVE__' || m.status === 'archived' || m.status === 'reset_archived';
}

function activeMatchesOnly_v173y(list) {
  return (list || []).filter(function(m) { return !isArchivedMatch_v173y(m); });
}

// On surcharge le chargement pour ne jamais afficher les anciennes lignes archivées.
loadData = async function() {
  const { data: s, error: se } = await client.from('settings').select('*').eq('id', 1).single();
  if (se) alert('Erreur settings: ' + se.message);
  settings = s;

  const { data: t, error: te } = await client.from('teams').select('*').order('id');
  if (te) alert('Erreur teams: ' + te.message);
  teams = t || [];

  const { data: m, error: me } = await client.from('matches').select('*').order('scheduled_time').order('court');
  if (me) alert('Erreur matches: ' + me.message);
  matches = activeMatchesOnly_v173y(m || []);

  renderAll();
  if (typeof ensureVisibleSection === 'function') ensureVisibleSection();
};

async function archiveAllMatchesForReset_v173y() {
  // Le DELETE peut être silencieusement bloqué par les règles Supabase/RLS.
  // L'UPDATE est autorisé dans ton appli : on archive donc les anciennes lignes et l'UI les ignore.
  const upd = await client.from('matches').update({
    phase: 'Archive',
    status: 'done',
    score_a: null,
    score_b: null,
    winner: null,
    started_at: null,
    completed_at: null
  }).neq('id', 0);
  if (upd.error) throw new Error('archivage des anciens matchs : ' + upd.error.message);

  const check = await client.from('matches').select('id, phase, team_a, team_b').neq('phase', 'Archive').limit(5);
  if (check.error) throw new Error('vérification archivage : ' + check.error.message);
  if (check.data && check.data.length) {
    const sample = check.data.map(m => `#${m.id} ${m.phase || '-'} ${m.team_a || '?'} vs ${m.team_b || '?'}`).join(' / ');
    throw new Error('des matchs actifs restent visibles après archivage : ' + sample);
  }
}

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet du tournoi ?\n\nLes anciens matchs seront archivés, les chronos/reprises purgés, puis Brassage 1 sera recréé seul.')) return;

  const adminMsg = document.getElementById('adminMsg');
  if (adminMsg) adminMsg.innerText = 'Reset complet en cours : archivage des anciens matchs...';

  try {
    (matches || []).forEach(function(m) { if (typeof clearMatchRuntimeLocalState === 'function') clearMatchRuntimeLocalState(m.id); });
    if (typeof clearAllVolleyLocalStorage_v173x === 'function') clearAllVolleyLocalStorage_v173x();
  } catch(e) {}
  activeScoreMatchId = null;

  try {
    await archiveAllMatchesForReset_v173y();
  } catch (e) {
    if (adminMsg) adminMsg.innerText = 'Reset bloqué ❌ ' + e.message;
    alert('Reset bloqué : ' + e.message + '\n\nJe ne recrée pas Brassage 1 par-dessus pour éviter les doublons.');
    return;
  }

  if (adminMsg) adminMsg.innerText = 'Anciens matchs archivés ✅ Recréation Brassage 1...';
  const rows = generateBrassage1Rows();
  const ins = await client.from('matches').insert(rows);
  if (ins.error) {
    if (adminMsg) adminMsg.innerText = 'Erreur régénération Brassage 1 : ' + ins.error.message;
    alert('Erreur régénération Brassage 1 : ' + ins.error.message);
    return;
  }

  await loadData();
  try {
    const phaseFilter = document.getElementById('phaseFilter');
    if (phaseFilter) phaseFilter.value = 'Brassage 1';
    renderPlanning();
  } catch(e) {}
  if (adminMsg) adminMsg.innerText = 'Reset complet effectué ✅ Seul Brassage 1 est affiché.';
};

// Même logique pour le bouton de régénération Brassage 1 : on archive l'ancien B1 au lieu de dépendre d'un DELETE.
regenerateBrassage1 = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Régénérer Brassage 1 ? Les matchs Brassage 1 existants seront archivés.')) return;
  const upd = await client.from('matches').update({ phase: 'Archive', status: 'done', score_a: null, score_b: null, winner: null }).eq('phase', 'Brassage 1');
  if (upd.error) {
    document.getElementById('adminMsg').innerText = 'Erreur archivage Brassage 1 : ' + upd.error.message;
    return;
  }
  const rows = generateBrassage1Rows();
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Brassage 1 régénéré ✅';
  await loadData();
};

/* v17.3z - correction reset archive sans colonne completed_at */
async function archiveAllMatchesForReset_v173z() {
  // Supabase indique que completed_at n'existe pas dans la table matches.
  // On n'utilise donc que des colonnes déjà présentes dans l'app : phase/status/score/winner.
  const upd = await client.from('matches').update({
    phase: 'Archive',
    status: 'done',
    score_a: 0,
    score_b: 0,
    winner: null
  }).neq('id', 0);
  if (upd.error) throw new Error('archivage des anciens matchs : ' + upd.error.message);

  const check = await client.from('matches').select('id, phase, team_a, team_b').neq('phase', 'Archive').limit(5);
  if (check.error) throw new Error('vérification archivage : ' + check.error.message);
  if (check.data && check.data.length) {
    const sample = check.data.map(m => `#${m.id} ${m.phase || '-'} ${m.team_a || '?'} vs ${m.team_b || '?'}`).join(' / ');
    throw new Error('des matchs actifs restent visibles après archivage : ' + sample);
  }
}

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet du tournoi ?\n\nLes anciens matchs seront archivés, les chronos/reprises purgés, puis Brassage 1 sera recréé seul.')) return;

  const adminMsg = document.getElementById('adminMsg');
  if (adminMsg) adminMsg.innerText = 'Reset complet en cours : archivage des anciens matchs...';

  try {
    (matches || []).forEach(function(m) { if (typeof clearMatchRuntimeLocalState === 'function') clearMatchRuntimeLocalState(m.id); });
    if (typeof clearAllVolleyLocalStorage_v173x === 'function') clearAllVolleyLocalStorage_v173x();
  } catch(e) {}
  activeScoreMatchId = null;

  try {
    await archiveAllMatchesForReset_v173z();
  } catch (e) {
    if (adminMsg) adminMsg.innerText = 'Reset bloqué ❌ ' + e.message;
    alert('Reset bloqué : ' + e.message + '\n\nJe ne recrée pas Brassage 1 par-dessus pour éviter les doublons.');
    return;
  }

  if (adminMsg) adminMsg.innerText = 'Anciens matchs archivés ✅ Recréation Brassage 1...';
  const rows = generateBrassage1Rows();
  const ins = await client.from('matches').insert(rows);
  if (ins.error) {
    if (adminMsg) adminMsg.innerText = 'Erreur régénération Brassage 1 : ' + ins.error.message;
    alert('Erreur régénération Brassage 1 : ' + ins.error.message);
    return;
  }

  await loadData();
  try {
    const phaseFilter = document.getElementById('phaseFilter');
    if (phaseFilter) phaseFilter.value = 'Brassage 1';
    renderPlanning();
  } catch(e) {}
  if (adminMsg) adminMsg.innerText = 'Reset complet effectué ✅ Seul Brassage 1 est affiché.';
};

regenerateBrassage1 = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Régénérer Brassage 1 ? Les matchs Brassage 1 existants seront archivés.')) return;
  const upd = await client.from('matches').update({ phase: 'Archive', status: 'done', score_a: 0, score_b: 0, winner: null }).eq('phase', 'Brassage 1');
  if (upd.error) {
    document.getElementById('adminMsg').innerText = 'Erreur archivage Brassage 1 : ' + upd.error.message;
    return;
  }
  const rows = generateBrassage1Rows();
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Brassage 1 régénéré ✅';
  await loadData();
};

/* v18.1 - génération B2 après test B1 + timeline robuste */
function phaseDone_v181(phase) {
  const list = (matches || []).filter(m => m.phase === phase && m.team_a && m.team_b);
  return list.length > 0 && list.every(m => m.status === 'done' && m.score_a !== null && m.score_b !== null);
}

function activePhaseRows_v181(phase) {
  return (matches || []).filter(m => m.phase === phase && m.team_a && m.team_b);
}

currentPhaseName = function() {
  const live = (matches || []).find(m => m.status === 'live' && m.team_a && m.team_b);
  if (live) return live.phase || 'Phase en cours';

  const pending = (matches || [])
    .filter(m => m.status !== 'done' && m.team_a && m.team_b)
    .sort(tournamentPlaySort || function(a,b) { return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || ''); });
  if (pending.length) return pending[0].phase || 'Phase en cours';

  // Cas important après le bouton de test : B1 est terminé mais B2 n'existe pas encore.
  // On affiche alors l'étape suivante au lieu de "Tournoi terminé".
  if (phaseDone_v181('Brassage 1') && activePhaseRows_v181('Brassage 2').length === 0) return 'Brassage 2';
  if (phaseDone_v181('Brassage 2') && activePhaseRows_v181('Tableau principal').length === 0 && activePhaseRows_v181('Consolante').length === 0) return 'Tableaux';

  return 'Tournoi terminé';
};

renderTimeline = function(phase) {
  const phases = ['Brassage 1', 'Brassage 2', 'Tableaux'];
  let activeIndex = phases.indexOf(phase);
  if (phase === 'Tableau principal' || phase === 'Consolante') activeIndex = 2;
  if (activeIndex < 0 && phase !== 'Tournoi terminé') activeIndex = 2;
  if (phase === 'Tournoi terminé') activeIndex = phases.length;
  return phases.map(function(p, index) {
    const active = index === activeIndex;
    const done = index < activeIndex;
    const cls = 'timeline-step timeline-premium-step ' + (active ? 'active' : '') + (done ? ' done' : '');
    return '<span class="' + cls + '"><span class="timeline-index">' + (index + 1) + '</span><span class="timeline-label">' + p + '</span></span>';
  }).join('<span class="timeline-connector"></span>');
};

async function archivePhase_v181(phase) {
  const upd = await client.from('matches').update({
    phase: 'Archive',
    status: 'done',
    score_a: 0,
    score_b: 0,
    winner: null
  }).eq('phase', phase);
  if (upd.error) throw new Error('archivage ' + phase + ' : ' + upd.error.message);
}

async function generateBrassage2Silent_v181() {
  const b1Matches = (matches || []).filter(m => m.phase === 'Brassage 1' && m.team_a && m.team_b);
  if (b1Matches.length !== 36) throw new Error('il faut 36 matchs en Brassage 1, trouvés ' + b1Matches.length);
  const unfinished = b1Matches.filter(m => m.status !== 'done' || m.score_a === null || m.score_b === null);
  if (unfinished.length) throw new Error(unfinished.length + ' match(s) de Brassage 1 ne sont pas terminés');

  const rankings = {};
  ['A','B','C','D','E','F'].forEach(function(pool) {
    rankings[pool] = getPhasePoolRanking('Brassage 1', pool);
    if (rankings[pool].length !== 4) throw new Error('Poule ' + pool + ' invalide : ' + rankings[pool].length + ' équipes classées');
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
  b2Pools.forEach(function(p) {
    const poolTeams = p.source.map(function(src) { return rankings[src[0]][src[1]-1].name; });
    rows.push.apply(rows, generateRoundRobinRows('Brassage 2', p.name, p.court, poolTeams, startB2));
  });
  rows = withAccessCodes(assignBalancedRefsInPools(rows, previousRefCounts('Brassage 1')), 37);

  // DELETE peut être bloqué par RLS : on archive l'ancien B2 et l'UI ignore Archive.
  await archivePhase_v181('Brassage 2');
  const ins = await client.from('matches').insert(rows);
  if (ins.error) throw new Error('création Brassage 2 : ' + ins.error.message);
  return rows.length;
}

generateBrassage2 = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Générer le Brassage 2 ? Les matchs Brassage 2 existants seront archivés.')) return;
  const adminMsg = document.getElementById('adminMsg');
  try {
    const count = await generateBrassage2Silent_v181();
    if (adminMsg) adminMsg.innerText = 'Brassage 2 généré ✅ ' + count + ' matchs créés.';
    await loadData();
  } catch(e) {
    if (adminMsg) adminMsg.innerText = 'Impossible de générer Brassage 2 : ' + e.message;
    alert('Impossible de générer Brassage 2 : ' + e.message);
  }
};

const fillRandomMissingResults_base_v181 = fillRandomMissingResults;
fillRandomMissingResults = async function(phase) {
  await fillRandomMissingResults_base_v181(phase);

  // Après le bouton de test "Remplir B1", on enchaîne directement sur la génération B2
  // pour éviter un dashboard vide / tournoi terminé.
  if (phase === 'Brassage 1') {
    await loadData();
    const hasB2 = activePhaseRows_v181('Brassage 2').length > 0;
    if (!hasB2 && phaseDone_v181('Brassage 1')) {
      const adminMsg = document.getElementById('adminMsg');
      try {
        const count = await generateBrassage2Silent_v181();
        if (adminMsg) adminMsg.innerText += ' Brassage 2 généré automatiquement ✅ (' + count + ' matchs).';
        await loadData();
      } catch(e) {
        if (adminMsg) adminMsg.innerText += ' Génération B2 bloquée : ' + e.message;
      }
    }
  }
};

/* v19.1 FINAL - Reset propre sans archives, patch placé tout en bas pour écraser les anciennes surcharges */
window.CSM_BUILD = 'v19.1-reset-hard-clean-2026-05-27';

async function hardDeleteEveryMatch_v191() {
  // On ne se base pas sur la variable locale `matches`, car elle peut filtrer les archives côté navigateur.
  const sel = await client.from('matches').select('id');
  if (sel.error) throw new Error('lecture des matchs avant suppression : ' + sel.error.message);
  const ids = (sel.data || []).map(function(r){ return r.id; }).filter(function(id){ return id !== null && id !== undefined; });

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const del = await client.from('matches').delete().in('id', chunk);
    if (del.error) throw new Error('suppression matches : ' + del.error.message);
  }

  // Vérification réelle : si la base contient encore des lignes, on affiche les phases restantes.
  const check = await client.from('matches').select('phase', { count: 'exact', head: false });
  if (check.error) throw new Error('vérification après suppression : ' + check.error.message);
  if ((check.data || []).length > 0) {
    const phases = Array.from(new Set((check.data || []).map(function(m){ return m.phase || '-'; })));
    throw new Error('suppression bloquée : il reste encore ' + (check.data || []).length + ' match(s) en base pour ' + phases.join(', '));
  }
}

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet du tournoi ?\n\nTous les matchs seront supprimés de la base, puis le Brassage 1 sera recréé.')) return;

  const adminMsg = document.getElementById('adminMsg');
  if (adminMsg) adminMsg.innerText = 'Reset complet en cours... suppression totale des matchs en base.';

  try {
    try {
      (matches || []).forEach(function(m) { if (typeof clearMatchRuntimeLocalState === 'function') clearMatchRuntimeLocalState(m.id); });
      if (typeof clearAllVolleyLocalStorage_v173x === 'function') clearAllVolleyLocalStorage_v173x();
      localStorage.removeItem(activeMatchStorageKey());
    } catch(e) {}
    activeScoreMatchId = null;

    await hardDeleteEveryMatch_v191();

    if (adminMsg) adminMsg.innerText = 'Base vide ✅ vérification des équipes...';
    await ensureConfiguredTeamsInDb();
    if (adminMsg) adminMsg.innerText = 'Base vide ✅ création du Brassage 1...';
    const rows = generateBrassage1Rows();
    const ins = await client.from('matches').insert(rows);
    if (ins.error) throw new Error('création Brassage 1 : ' + ins.error.message);

    await loadData();
    try {
      const phaseFilter = document.getElementById('phaseFilter');
      if (phaseFilter) phaseFilter.value = 'Brassage 1';
      renderPlanning();
    } catch(e) {}
    if (adminMsg) adminMsg.innerText = 'Reset complet OK ✅ 36 matchs Brassage 1 créés. Build ' + window.CSM_BUILD;
  } catch(e) {
    if (adminMsg) adminMsg.innerText = 'Reset bloqué ❌ ' + e.message;
    alert('Reset bloqué : ' + e.message);
  }
};

async function cleanPhase_v191(phases) {
  const list = Array.isArray(phases) ? phases : [phases];
  const sel = await client.from('matches').select('id').in('phase', list);
  if (sel.error) throw new Error('lecture phase à nettoyer : ' + sel.error.message);
  const ids = (sel.data || []).map(function(r){ return r.id; });
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (!chunk.length) continue;
    const del = await client.from('matches').delete().in('id', chunk);
    if (del.error) throw new Error('suppression phase ' + list.join('/') + ' : ' + del.error.message);
  }
}

// Sécurise les doubles générations de Brassage 2 : on nettoie toujours l'ancien B2 avant insertion.
if (typeof generateBrassage2Silent_v181 === 'function') {
  const generateBrassage2Silent_before_v191 = generateBrassage2Silent_v181;
  generateBrassage2Silent_v181 = async function() {
    await cleanPhase_v191('Brassage 2');
    const result = await generateBrassage2Silent_before_v191();
    return result;
  };
}

// Bouton visible admin : idem, pas de double B2.
generateBrassage2 = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Générer le Brassage 2 ?\n\nLes éventuels anciens matchs Brassage 2 seront supprimés puis recréés.')) return;
  const adminMsg = document.getElementById('adminMsg');
  try {
    if (adminMsg) adminMsg.innerText = 'Nettoyage ancien Brassage 2...';
    await cleanPhase_v191('Brassage 2');
    if (typeof generateBrassage2Silent_v190 === 'function') {
      const count = await generateBrassage2Silent_v190();
      if (adminMsg) adminMsg.innerText = 'Brassage 2 généré ✅ ' + count + ' matchs créés.';
    } else if (typeof generateBrassage2Silent_v181 === 'function') {
      const count = await generateBrassage2Silent_v181();
      if (adminMsg) adminMsg.innerText = 'Brassage 2 généré ✅ ' + count + ' matchs créés.';
    } else {
      throw new Error('fonction de génération B2 introuvable');
    }
    await loadData();
  } catch(e) {
    if (adminMsg) adminMsg.innerText = 'Impossible de générer Brassage 2 : ' + e.message;
    alert('Impossible de générer Brassage 2 : ' + e.message);
  }
};

// Marque visuelle discrète pour vérifier que le bon build tourne.
setTimeout(function(){
  try {
    const adminMsg = document.getElementById('adminMsg');
    if (adminMsg && !adminMsg.innerText) adminMsg.innerText = 'Build ' + window.CSM_BUILD + ' chargé.';
  } catch(e) {}
}, 1500);

/* v19.2 - suppression via RPC Supabase (contourne les blocages RLS côté navigateur)
   IMPORTANT : créer d'abord la fonction SQL public.csm_delete_matches(p_phase text). */
window.CSM_BUILD = 'v19.2-rpc-delete-reset-2026-05-27';

async function rpcDeleteMatches_v192(phase) {
  const payload = (phase === undefined || phase === null) ? { p_phase: null } : { p_phase: phase };
  const res = await client.rpc('csm_delete_matches', payload);
  if (res.error) throw new Error('RPC csm_delete_matches : ' + res.error.message);
  return res.data || 0;
}

hardDeleteEveryMatch_v191 = async function() {
  await rpcDeleteMatches_v192(null);
  const check = await client.from('matches').select('id,phase', { count: 'exact', head: false });
  if (check.error) throw new Error('vérification après suppression : ' + check.error.message);
  if ((check.data || []).length > 0) {
    const phases = Array.from(new Set((check.data || []).map(function(m){ return m.phase || '-'; })));
    throw new Error('suppression bloquée : il reste encore ' + (check.data || []).length + ' match(s) en base pour ' + phases.join(', '));
  }
};

cleanPhase_v191 = async function(phases) {
  const list = Array.isArray(phases) ? phases : [phases];
  for (const ph of list) {
    await rpcDeleteMatches_v192(ph);
  }
  const check = await client.from('matches').select('id,phase').in('phase', list);
  if (check.error) throw new Error('vérification nettoyage phase : ' + check.error.message);
  if ((check.data || []).length > 0) {
    throw new Error('nettoyage incomplet : ' + (check.data || []).length + ' match(s) restent pour ' + list.join(', '));
  }
};

setTimeout(function(){
  try {
    const adminMsg = document.getElementById('adminMsg');
    if (adminMsg && (!adminMsg.innerText || adminMsg.innerText.indexOf('Build') === 0)) {
      adminMsg.innerText = 'Build ' + window.CSM_BUILD + ' chargé.';
    }
  } catch(e) {}
}, 1800);

/* v19.3 - reset via RPC reset_tournament_matches() créée dans Supabase */
window.CSM_BUILD = 'v19.3-rpc-reset-tournament-matches-2026-05-27';

async function rpcResetTournamentMatches_v193() {
  const res = await client.rpc('reset_tournament_matches');
  if (res.error) throw new Error('RPC reset_tournament_matches : ' + res.error.message);
  return res.data || 0;
}

hardDeleteEveryMatch_v191 = async function() {
  await rpcResetTournamentMatches_v193();
  const check = await client.from('matches').select('id,phase', { count: 'exact', head: false });
  if (check.error) throw new Error('vérification après suppression : ' + check.error.message);
  if ((check.data || []).length > 0) {
    const phases = Array.from(new Set((check.data || []).map(function(m){ return m.phase || '-'; })));
    throw new Error('suppression bloquée : il reste encore ' + (check.data || []).length + ' match(s) en base pour ' + phases.join(', '));
  }
};

// Nettoyage de phase : on garde un DELETE client simple pour éviter de dépendre d'une 2e fonction SQL.
// Le reset complet, lui, passe bien par la RPC SECURITY DEFINER ci-dessus.
cleanPhase_v191 = async function(phases) {
  const list = Array.isArray(phases) ? phases : [phases];
  const del = await client.from('matches').delete().in('phase', list);
  if (del.error) throw new Error('suppression phase ' + list.join('/') + ' : ' + del.error.message);
};

setTimeout(function(){
  try {
    const adminMsg = document.getElementById('adminMsg');
    if (adminMsg && (!adminMsg.innerText || adminMsg.innerText.indexOf('Build') === 0)) {
      adminMsg.innerText = 'Build ' + window.CSM_BUILD + ' chargé.';
    }
  } catch(e) {}
}, 2200);

/* v19.8 - compact responsive score UI */
window.CSM_BUILD = 'v19.8-compact-score-responsive-2026-05-27';

/* v19.10 - Service indicator with fixed reserved slot to prevent score/layout jumps */
const serviceBall_v1910_previous = serviceBall;
serviceBall = function(m, side) {
  const total = (m.score_a == null ? 0 : Number(m.score_a)) + (m.score_b == null ? 0 : Number(m.score_b));
  const isServing = total > 0 && servingSide(m) === side;
  return isServing
    ? '<span class="service-ball" title="Au service">🏐</span>'
    : '<span class="service-ball service-ball-placeholder" aria-hidden="true">🏐</span>';
};

window.CSM_BUILD = 'v19.10-mobile-score-clean';

/* v19.11 - no chrono on bracket/tableau matches: tableaux are played to 25 points */
const chronoHtml_base_v1911 = chronoHtml;
chronoHtml = function(m) {
  if (m && typeof isBracketMatch === 'function' && isBracketMatch(m)) return '';
  return chronoHtml_base_v1911(m);
};

const maybeWarnChronoEnded_base_v1911 = maybeWarnChronoEnded;
maybeWarnChronoEnded = function(m) {
  if (m && typeof isBracketMatch === 'function' && isBracketMatch(m)) return;
  return maybeWarnChronoEnded_base_v1911(m);
};

const ensureMatchChronoStarted_base_v1911 = ensureMatchChronoStarted;
ensureMatchChronoStarted = function(m) {
  if (m && typeof isBracketMatch === 'function' && isBracketMatch(m)) return;
  return ensureMatchChronoStarted_base_v1911(m);
};

window.CSM_BUILD = 'v19.11-no-chrono-tableaux';

/* v19.12 - tableaux: no chrono + mixed principal/consolante launch order */
function isTimedMatch_v1912(m) {
  if (!m) return false;
  return String(m.phase || '') === 'Brassage 1' || String(m.phase || '') === 'Brassage 2';
}

// Un match de tableau se joue aux points, sans chrono.
const chronoHtml_base_v1912 = chronoHtml;
chronoHtml = function(m) {
  if (!isTimedMatch_v1912(m)) return '';
  return chronoHtml_base_v1912(m);
};

const maybeWarnChronoEnded_base_v1912 = maybeWarnChronoEnded;
maybeWarnChronoEnded = function(m) {
  if (!isTimedMatch_v1912(m)) return;
  return maybeWarnChronoEnded_base_v1912(m);
};

const ensureMatchChronoStarted_base_v1912 = ensureMatchChronoStarted;
ensureMatchChronoStarted = function(m) {
  if (!isTimedMatch_v1912(m)) return '';
  return ensureMatchChronoStarted_base_v1912(m);
};

function renderPointScoreboardNoChrono_v1912(m) {
  const locked = !canEditMatch(m);
  return `
    <div class="scoreboard-full scoreboard-polish-k scoreboard-tableau-nochrono">
      <div class="score-half team-a">
        <div class="team-title">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', 1)"`}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', -1)"`}>−</button>
      </div>

      <div class="center-controls center-controls-k center-controls-nochrono">
        <div class="mini-meta">T${m.court || '-'} · ${m.phase || ''}${m.round ? ' · ' + m.round : ''}</div>
        <div class="mini-meta mini-meta-rule">Match en 25 points</div>
        ${locked ? lockedMatchHtml(m) : `<button class="danger finish-btn finish-btn-k" onclick="finishMatch(${m.id})">Terminer le match</button>`}
      </div>

      <div class="score-half team-b">
        <div class="team-title">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', 1)"`}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', -1)"`}>−</button>
      </div>
    </div>
  `;
}

const renderMatchScoreboard_base_v1912 = renderMatchScoreboard;
renderMatchScoreboard = function(m) {
  if (m && isBracketMatch(m) && !isDoneMatch(m)) {
    return renderPointScoreboardNoChrono_v1912(m);
  }
  return renderMatchScoreboard_base_v1912(m);
};

const validateFinalScore_base_v1912 = validateFinalScore;
validateFinalScore = function(m) {
  const base = validateFinalScore_base_v1912(m);
  if (base) return base;
  if (m && isBracketMatch(m)) {
    const a = Number(m.score_a == null ? 0 : m.score_a);
    const b = Number(m.score_b == null ? 0 : m.score_b);
    if (Math.max(a, b) < 25) return 'Match de tableau : le vainqueur doit atteindre 25 points.';
  }
  return '';
};

function bracketMixedSequence_v1912(m) {
  const bracket = String(m && m.bracket || '').toLowerCase();
  const phase = String(m && m.phase || '').toLowerCase();
  const round = String(m && m.round || '').toLowerCase();
  const order = Number(m && m.match_order || 0);
  const isCons = bracket.includes('consolante') || phase.includes('consolante');
  const isMain = bracket.includes('principal') || phase.includes('tableau principal');

  if (isMain && round.includes('1/8')) {
    if (order >= 1 && order <= 4) return 300 + (order - 1);       // P1 à P4
    if (order >= 5 && order <= 8) return 306 + (order - 5);       // P5 à P8
    return 399 + order;
  }
  if (isCons && round.includes('quart')) {
    if (order >= 101 && order <= 102) return 304 + (order - 101); // C101-C102 après P1-P4
    if (order >= 103 && order <= 104) return 310 + (order - 103); // C103-C104 après P5-P8
    return 399 + order;
  }
  if (isMain && round.includes('quart')) return 400 + (order - 9);
  if (isCons && round.includes('demi')) return 404 + (order - 105);
  if (isMain && round.includes('demi')) return 500 + (order - 13);
  if (isCons && round.includes('finale')) return 502;
  if (isMain && (round.includes('3e') || round.includes('place'))) return 600;
  if (isMain && round.includes('finale')) return 601;
  return 900 + order;
}

function tournamentPlaySort_v1912(a, b) {
  const pa = phasePlayOrderValue(a);
  const pb = phasePlayOrderValue(b);
  if (pa !== pb) return pa - pb;
  if (isBracketMatch(a) || isBracketMatch(b)) {
    return bracketMixedSequence_v1912(a) - bracketMixedSequence_v1912(b) ||
      Number(a.court || 0) - Number(b.court || 0) ||
      Number(a.id || 0) - Number(b.id || 0);
  }
  return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
    Number(a.court || 0) - Number(b.court || 0) ||
    Number(a.match_order || 0) - Number(b.match_order || 0) ||
    Number(a.id || 0) - Number(b.id || 0);
}

nextPlayableMatches = function(limit = 6) {
  return matches
    .filter(function(m) { return isPlayableMatch(m) && m.team_a !== 'À définir' && m.team_b !== 'À définir'; })
    .sort(tournamentPlaySort_v1912)
    .slice(0, limit);
};

window.CSM_BUILD = 'v19.12-no-chrono-tableaux-mix-principal-consolante';

/* v19.13 - équilibrage tableaux 16 principal + 8 consolante
   Objectif lancement initial sur 6 terrains : T1-T4 Principal 1-4, T5-T6 Consolante 1-2.
   Vague suivante : T1-T4 Principal 5-8, T5-T6 Consolante 3-4.
*/
function bracketBalancedSequence_v1913(m) {
  const bracket = String(m && m.bracket || '').toLowerCase();
  const phase = String(m && m.phase || '').toLowerCase();
  const round = String(m && m.round || '').toLowerCase();
  const order = Number(m && m.match_order || 0);
  const isCons = bracket.includes('consolante') || phase.includes('consolante');
  const isMain = bracket.includes('principal') || phase.includes('tableau principal');

  // Vague 1 : 4 principaux + 2 consolantes
  if (isMain && round.includes('1/8') && order >= 1 && order <= 4) return 300 + (order - 1);
  if (isCons && round.includes('quart') && order >= 101 && order <= 102) return 304 + (order - 101);

  // Vague 2 : 4 principaux + 2 consolantes
  if (isMain && round.includes('1/8') && order >= 5 && order <= 8) return 306 + (order - 5);
  if (isCons && round.includes('quart') && order >= 103 && order <= 104) return 310 + (order - 103);

  // Ensuite on alterne dès que les équipes sont connues
  if (isMain && round.includes('quart')) return 400 + (order - 9);
  if (isCons && round.includes('demi')) return 404 + (order - 105);
  if (isMain && round.includes('demi')) return 500 + (order - 13);
  if (isCons && round.includes('finale')) return 502;
  if (isMain && (round.includes('3e') || round.includes('place'))) return 600;
  if (isMain && round.includes('finale')) return 601;
  return 900 + order;
}

function balancedCourtForBracket_v1913(row) {
  const bracket = String(row && row.bracket || '').toLowerCase();
  const phase = String(row && row.phase || '').toLowerCase();
  const round = String(row && row.round || '').toLowerCase();
  const order = Number(row && row.match_order || 0);
  const isCons = bracket.includes('consolante') || phase.includes('consolante');
  const isMain = bracket.includes('principal') || phase.includes('tableau principal');

  // 1/8 principal : P1-P4 sur T1-T4, puis P5-P8 sur T1-T4 vague suivante
  if (isMain && round.includes('1/8')) {
    if (order >= 1 && order <= 4) return order;
    if (order >= 5 && order <= 8) return order - 4;
  }
  // Consolante quarts : C1-C2 sur T5-T6, puis C3-C4 sur T5-T6 vague suivante
  if (isCons && round.includes('quart')) {
    if (order === 101) return 5;
    if (order === 102) return 6;
    if (order === 103) return 5;
    if (order === 104) return 6;
  }
  // Tours suivants : on répartit proprement sans saturer un seul terrain
  if (isMain && round.includes('quart')) return ((order - 9) % 4) + 1;
  if (isCons && round.includes('demi')) return order === 105 ? 5 : 6;
  if (isMain && round.includes('demi')) return order === 13 ? 1 : 2;
  if (isCons && round.includes('finale')) return 5;
  if (isMain && (round.includes('3e') || round.includes('place'))) return 3;
  if (isMain && round.includes('finale')) return 1;
  return Number(row && row.court || 1) || 1;
}

const bracketRowsFromRanking_base_v1913 = bracketRowsFromRanking;
bracketRowsFromRanking = function(ranking) {
  return bracketRowsFromRanking_base_v1913(ranking).map(function(row) {
    return Object.assign({}, row, { court: balancedCourtForBracket_v1913(row) });
  });
};

function tournamentPlaySort_v1913(a, b) {
  const pa = phasePlayOrderValue(a);
  const pb = phasePlayOrderValue(b);
  if (pa !== pb) return pa - pb;
  if (isBracketMatch(a) || isBracketMatch(b)) {
    return bracketBalancedSequence_v1913(a) - bracketBalancedSequence_v1913(b) ||
      Number(a.court || 0) - Number(b.court || 0) ||
      Number(a.id || 0) - Number(b.id || 0);
  }
  return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
    Number(a.court || 0) - Number(b.court || 0) ||
    Number(a.match_order || 0) - Number(b.match_order || 0) ||
    Number(a.id || 0) - Number(b.id || 0);
}

nextPlayableMatches = function(limit = 6) {
  return matches
    .filter(function(m) { return isPlayableMatch(m) && m.team_a !== 'À définir' && m.team_b !== 'À définir'; })
    .sort(tournamentPlaySort_v1913)
    .slice(0, limit);
};

window.CSM_BUILD = 'v19.13-equilibrage-tableaux-principal-consolante';

/* v19.15 - vrai équilibrage affichage/lancement tableaux
   Correction : l'ancien tri classait Tableau principal avant Consolante via phasePlayOrderValue,
   donc les 6 cartes affichées étaient toutes en principal. Pour les matchs de tableau,
   on trie maintenant d'abord par séquence équilibrée : P1-P4, C1-C2, P5-P8, C3-C4.
*/
function isBracketMatch_v1914(m) {
  const phase = String(m && m.phase || '').toLowerCase();
  const bracket = String(m && m.bracket || '').toLowerCase();
  return phase.includes('tableau principal') || phase.includes('consolante') || bracket.includes('principal') || bracket.includes('consolante');
}

function tournamentPlaySort_v1914(a, b) {
  const ab = isBracketMatch_v1914(a);
  const bb = isBracketMatch_v1914(b);

  // Pendant les tableaux, Principal et Consolante doivent être mélangés selon la séquence terrain.
  if (ab && bb) {
    return bracketBalancedSequence_v1913(a) - bracketBalancedSequence_v1913(b) ||
      Number(a.court || 0) - Number(b.court || 0) ||
      Number(a.match_order || 0) - Number(b.match_order || 0) ||
      Number(a.id || 0) - Number(b.id || 0);
  }

  // Hors tableau, on garde la logique normale de phase.
  const pa = phasePlayOrderValue(a);
  const pb = phasePlayOrderValue(b);
  if (pa !== pb) return pa - pb;

  return (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
    Number(a.court || 0) - Number(b.court || 0) ||
    Number(a.match_order || 0) - Number(b.match_order || 0) ||
    Number(a.id || 0) - Number(b.id || 0);
}

nextPlayableMatches = function(limit = 6) {
  return matches
    .filter(function(m) { return isPlayableMatch(m) && m.team_a !== 'À définir' && m.team_b !== 'À définir'; })
    .sort(tournamentPlaySort_v1914)
    .slice(0, limit);
};

// Le tableau public utilise aussi l'ordre équilibré, pas l'ordre terrain brut.
if (typeof renderPublicView === 'function') {
  const renderPublicView_base_v1914 = renderPublicView;
  // On ne réécrit pas tout l'écran public ici pour éviter une régression visuelle.
  // Le point critique pour la saisie organisateur est nextPlayableMatches ci-dessus.
}

window.CSM_BUILD = 'v19.15-equilibrage-tableaux-reel';

/* v19.16 - correction uniquement header live : la fin estimée du bandeau doit utiliser l'estimation dynamique réelle, pas l'heure théorique du premier créneau. */
function headerEstimatedPhaseEndMinutes_v1916(phase) {
  if (!phase || phase === 'Tournoi terminé') return null;
  const list = matches.filter(function(m) { return m.phase === phase && m.team_a && m.team_b; });
  if (!list.length) return null;

  const remaining = list.filter(function(m) { return m.status !== 'done'; });
  if (!remaining.length) return (typeof plannedPhaseEndMinutes === 'function') ? plannedPhaseEndMinutes(phase) : null;

  const live = remaining.filter(function(m) { return m.status === 'live'; });
  const pending = remaining.filter(function(m) { return m.status !== 'live'; });
  const courts = Math.max(1, Number(settings && settings.courts_count ? settings.courts_count : 6));
  const slot = Number(settings && settings.match_duration ? settings.match_duration : 12) + Number(settings && settings.break_duration ? settings.break_duration : 0);
  const pause = (typeof getTournamentPauseMinutes === 'function') ? getTournamentPauseMinutes() : 0;
  const waves = (live.length ? 1 : 0) + Math.ceil(pending.length / courts);
  const dynamicEnd = nowMinutesOfDay() + Math.max(1, waves) * slot + pause;
  const plannedEnd = (typeof plannedPhaseEndMinutes === 'function') ? plannedPhaseEndMinutes(phase) : null;
  return plannedEnd == null ? dynamicEnd : Math.max(plannedEnd, dynamicEnd);
}

function headerEstimatedPhaseEnd_v1916(phase) {
  const end = headerEstimatedPhaseEndMinutes_v1916(phase);
  return end == null ? '-' : timeFromMinutesOfDay(end);
}

renderSubtitle = function() {
  if (!settings) return;
  const el = document.getElementById('subtitle');
  if (!el) return;
  const phase = currentPhaseName();
  if (!phase || phase === 'Tournoi terminé') {
    el.innerHTML = 'Phase en cours : aucun match à venir<br>' + settings.teams_count + ' équipes · ' + settings.courts_count + ' terrains';
    return;
  }
  const startLabel = (settings && settings.start_time) ? settings.start_time : '09:30';
  const endLabel = headerEstimatedPhaseEnd_v1916(phase);
  el.innerHTML = 'Phase en cours : ' + phase + ' · début ' + startLabel + ' théorique · fin estimée ' + endLabel + '<br>' +
    settings.teams_count + ' équipes · ' + settings.courts_count + ' terrains';
};

window.CSM_BUILD = 'v19.16-header-fin-estimee-dynamique';

/* v19.17 - FIX CIBLÉ HEADER : force le bandeau bleu à utiliser la même estimation dynamique que la carte dashboard.
   Objectif : supprimer définitivement l'ancien calcul théorique qui affichait 09:42. */
function renderSubtitle_v1917_forced() {
  if (!settings) return;
  const el = document.getElementById('subtitle');
  if (!el) return;
  const phase = (typeof currentPhaseName === 'function') ? currentPhaseName() : '';
  if (!phase || phase === 'Tournoi terminé') {
    el.innerHTML = 'Phase en cours : aucun match à venir<br>' +
      (settings.teams_count || '-') + ' équipes · ' + (settings.courts_count || '-') + ' terrains';
    return;
  }
  const startLabel = (settings && settings.start_time) ? settings.start_time : '09:30';
  // IMPORTANT : même source que la carte "Fin estimée phase".
  const endLabel = (typeof estimatedPhaseEnd === 'function') ? estimatedPhaseEnd(phase) : '-';
  el.innerHTML = 'Phase en cours : ' + phase + ' · début ' + startLabel + ' théorique · fin estimée ' + endLabel + '<br>' +
    (settings.teams_count || '-') + ' équipes · ' + (settings.courts_count || '-') + ' terrains';
}

renderSubtitle = renderSubtitle_v1917_forced;

if (typeof renderAll === 'function') {
  const renderAll_base_v1917 = renderAll;
  renderAll = function() {
    renderAll_base_v1917();
    renderSubtitle_v1917_forced();
  };
}

// Corrige aussi l'affichage déjà rendu sans attendre une action utilisateur.
setTimeout(renderSubtitle_v1917_forced, 100);
setTimeout(renderSubtitle_v1917_forced, 800);
setInterval(renderSubtitle_v1917_forced, 30000);
window.CSM_BUILD = 'v19.17-header-fin-estimee-forcee';

/* v19.18 - reset match recalcul classement + libellés sécurité
   Bug corrigé : un match reseté gardait parfois un score 0-0 compté dans le classement.
   Désormais, reset match = score_a/score_b à null + status pending ; le classement ne compte que les matchs terminés.
*/

poolStats = function(phase, pool) {
  const teamNames = new Set();
  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
    if (m.team_a && m.team_a !== 'À définir') teamNames.add(m.team_a);
    if (m.team_b && m.team_b !== 'À définir') teamNames.add(m.team_b);
  });

  const stats = {};
  [...teamNames].forEach(name => stats[name] = { mj:0, v:0, d:0, diff:0, pm:0, pe:0, score:0 });

  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
    // IMPORTANT : seuls les matchs vraiment terminés doivent impacter le classement.
    if (m.status !== 'done') return;
    if (m.score_a === null || m.score_a === undefined || m.score_b === null || m.score_b === undefined) return;
    if (!stats[m.team_a] || !stats[m.team_b]) return;

    const scoreA = Number(m.score_a);
    const scoreB = Number(m.score_b);
    const da = scoreA - scoreB;
    const db = scoreB - scoreA;

    stats[m.team_a].mj++; stats[m.team_b].mj++;
    stats[m.team_a].pm += scoreA; stats[m.team_a].pe += scoreB; stats[m.team_a].diff += da;
    stats[m.team_b].pm += scoreB; stats[m.team_b].pe += scoreA; stats[m.team_b].diff += db;

    if (scoreA > scoreB) {
      stats[m.team_a].v++; stats[m.team_a].score += 10000 + da;
      stats[m.team_b].d++; stats[m.team_b].score += db;
    } else if (scoreB > scoreA) {
      stats[m.team_b].v++; stats[m.team_b].score += 10000 + db;
      stats[m.team_a].d++; stats[m.team_a].score += da;
    }
  });

  return Object.entries(stats).sort((a,b) => b[1].score - a[1].score || b[1].diff - a[1].diff || b[1].pm - a[1].pm);
};

renderAdminMatchReset = function() {
  const div = document.getElementById('resetMatchAdmin');
  if (!div || !adminUnlocked) return;

  const eligible = matches
    .filter(m => m.team_a && m.team_b && m.team_a !== 'À définir' && m.team_b !== 'À définir')
    .sort((a,b) =>
      String(a.phase || '').localeCompare(String(b.phase || '')) ||
      Number(a.court || 999) - Number(b.court || 999) ||
      Number(a.match_order || 0) - Number(b.match_order || 0) ||
      String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')) ||
      Number(a.id || 0) - Number(b.id || 0)
    );

  if (!eligible.length) {
    div.innerHTML = '<div class="card">Aucun match disponible à réinitialiser.</div>';
    return;
  }

  div.innerHTML = `
    <div class="forfeit-admin-grid">
      <label><span>Réinitialiser un seul match</span>
        <select id="resetMatchSelect">
          ${eligible.map(m => `<option value="${m.id}">${m.phase || '-'} · T${m.court || '-'} · ${m.team_a} vs ${m.team_b} · ${m.status || 'pending'} ${m.score_a != null || m.score_b != null ? `(${m.score_a == null ? 0 : m.score_a}-${m.score_b == null ? 0 : m.score_b})` : ''}</option>`).join('')}
        </select>
      </label>
      <button class="danger" onclick="adminResetMatch()">Réinitialiser ce match uniquement</button>
    </div>
  `;
};

adminResetMatch = async function() {
  if (!adminUnlocked) return;
  const select = document.getElementById('resetMatchSelect');
  if (!select) return;
  const m = matches.find(x => String(x.id) === String(select.value));
  if (!m) return;

  if (!confirm(`Réinitialiser CE MATCH UNIQUEMENT ?\n\n${m.phase || '-'} · Terrain ${m.court || '-'}\n${m.team_a} vs ${m.team_b}\n\nSeul ce match repassera à jouer.\nLe classement sera recalculé sans ce résultat.`)) return;

  const fullPayload = {
    score_a: null,
    score_b: null,
    winner: null,
    status: 'pending',
    started_at: null,
    completed_at: null
  };

  let result = await client.from('matches').update(fullPayload).eq('id', m.id);
  if (result.error) {
    result = await client.from('matches').update({
      score_a: null,
      score_b: null,
      winner: null,
      status: 'pending'
    }).eq('id', m.id);
  }

  if (result.error) {
    alert('Erreur reset match : ' + result.error.message);
    return;
  }

  clearLocalCompletedTime(m.id);
  if (activeScoreMatchId === m.id) activeScoreMatchId = null;
  delete matchEditCodes[m.id];
  const msg = document.getElementById('adminMsg');
  if (msg) msg.innerText = 'Match réinitialisé ✅ Classement recalculé.';
  await loadData();
};

if (typeof resetScores === 'function') {
  const resetScores_base_v1918 = resetScores;
  resetScores = async function() {
    if (!confirm('⚠️ RÉINITIALISER TOUT LE TOURNOI ?\n\nCela efface TOUS les matchs, scores et phases générées, puis recrée uniquement le Brassage 1.\n\nLes noms des équipes sont conservés.')) return;
    return resetScores_base_v1918();
  };
}

window.CSM_BUILD = 'v19.18-reset-match-classement-fix';

/* v19.19 - corrections usage terrain : verrouillage match, onglet actif, chrono manuel, noms longs */
window.CSM_BUILD = 'v19.19-verrou-chrono-manuel-ui';

function setActiveNavButton_v1919(id) {
  try {
    document.querySelectorAll('.nav-grid button').forEach(function(btn) {
      btn.classList.remove('nav-active');
      const onclick = btn.getAttribute('onclick') || '';
      if (onclick.indexOf("show('" + id + "')") >= 0 || onclick.indexOf('show("' + id + '")') >= 0) {
        btn.classList.add('nav-active');
      }
      if (id === 'admin' && onclick.indexOf('requestAdminAccess') >= 0) btn.classList.add('nav-active');
    });
  } catch(e) {}
}

const show_base_v1919 = show;
show = function(id) {
  show_base_v1919(id);
  setActiveNavButton_v1919(id);
};

const requestAdminAccess_base_v1919 = requestAdminAccess;
requestAdminAccess = function() {
  requestAdminAccess_base_v1919();
  if (currentSection === 'admin') setActiveNavButton_v1919('admin');
};

function isTimedScoreMatch_v1919(m) {
  return !!m && (String(m.phase || '') === 'Brassage 1' || String(m.phase || '') === 'Brassage 2');
}

function hasChronoStarted_v1919(m) {
  return !!(m && getMatchStartedAt(m));
}

// Important : le chrono ne démarre plus automatiquement à l'ouverture de la saisie.
ensureMatchChronoStarted = function(m) {
  if (!m || !m.id) return '';
  const raw = getMatchStartedAt(m);
  if (raw) {
    try { saveLocalStartedTime(m.id, raw); } catch(e) {}
  }
  return raw || '';
};

async function startMatchChrono(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;
  if (!canEditMatch(m)) {
    alert('Saisie verrouillée : seul l’appareil qui a lancé le match peut démarrer le chrono.');
    return;
  }
  if (!isTimedScoreMatch_v1919(m)) return;
  if (hasChronoStarted_v1919(m)) return;

  const startedAt = new Date().toISOString();
  let result = await client.from('matches').update({ started_at: startedAt }).eq('id', id);
  if (result.error) {
    alert('Erreur démarrage chrono : ' + result.error.message);
    return;
  }
  saveLocalStartedTime(id, startedAt);
  try { localStorage.setItem('volley_match_started_at_' + id, startedAt); } catch(e) {}
  activeScoreMatchId = id;
  await loadData();
}

// Verrouillage strict : si un match est en cours sur un autre appareil, personne d'autre ne peut l'ouvrir.
launchMatch = async function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;

  if (isDoneMatch(m)) {
    alert('Ce match est déjà terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }

  if (isLiveMatchStatus(m)) {
    if (hasLocalMatchSession(m.id)) {
      activeScoreMatchId = m.id;
      renderScoreSection();
      return;
    }
    alert('Ce match est déjà en cours sur un autre appareil.\n\nPour le libérer, il faut passer par Admin > Reset match sécurisé.');
    return;
  }

  const otherLive = activeMatchOnCourt(m.court, m.id);
  if (otherLive) {
    alert('Terrain ' + (m.court || '-') + ' déjà occupé par : ' + otherLive.team_a + ' vs ' + otherLive.team_b + '.\n\nTermine ce match ou utilise Admin > Reset match sécurisé.');
    return;
  }

  const code = askRefCodeForMatch(m);
  if (!code) return;

  const update = { status: 'live' };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(code);
    if (refTeam) update.referee_team = refTeam;
  }

  let result = await client.from('matches').update(update).eq('id', id);
  if (result.error) {
    alert('Erreur lancement match : ' + result.error.message);
    return;
  }

  setLocalMatchSession(id, code);
  activeScoreMatchId = id;
  await loadData();
};

openLiveMatch = function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;
  if (isDoneMatch(m)) {
    alert('Ce match est terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }
  if (isLiveMatchStatus(m) && !hasLocalMatchSession(m.id)) {
    alert('Ce match est déjà en cours sur un autre appareil.\n\nPour le libérer, il faut passer par Admin > Reset match sécurisé.');
    return;
  }
  if (!canEditMatch(m)) {
    const code = askRefCodeForMatch(m);
    if (!code) return;
    setLocalMatchSession(m.id, code);
  }
  activeScoreMatchId = m.id;
  renderScoreSection();
};

renderResumeMatchesCard = function(list) {
  if (!list || !list.length) return '';
  return `<div class="card live-matches-card force-resume-card">
    <div class="section-title-row"><b>Matchs en cours</b><span>${list.length}</span></div>
    <div class="resume-match-list">
      ${list.map(function(m) {
        const score = `${Number(m.score_a || 0)} - ${Number(m.score_b || 0)}`;
        const local = hasLocalMatchSession(m.id);
        return `<button class="small-btn resume-live-btn resume-match-btn ${local ? '' : 'resume-locked'}" ${local ? `onclick="openLiveMatch(${m.id})"` : 'disabled'}>
          <span class="resume-court">Terrain ${m.court || '-'}</span>
          <span class="resume-teams team-name-fit">${m.team_a} vs ${m.team_b}</span>
          <span class="resume-score">${score}</span>
          <span class="resume-action">${local ? 'Reprendre' : 'Occupé'}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
};

function renderTimedScoreboard_v1919(m) {
  const locked = !canEditMatch(m);
  const chronoStarted = hasChronoStarted_v1919(m);
  const centerAction = locked
    ? lockedMatchHtml(m)
    : (chronoStarted
        ? `${chronoHtml(m)}<button class="danger finish-btn finish-btn-k" onclick="finishMatch(${m.id})">Terminer le match</button>`
        : `<button class="start-chrono-btn finish-btn-k" onclick="startMatchChrono(${m.id})">Démarrer le chrono</button>`);

  return `
    <div class="scoreboard-full scoreboard-polish-k scoreboard-v1919">
      <div class="score-half team-a">
        <div class="team-title team-name-fit">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', 1)"`}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', -1)"`}>−</button>
      </div>

      <div class="center-controls center-controls-k">
        <div class="mini-meta">T${m.court || '-'} · ${m.phase || ''}</div>
        ${centerAction}
      </div>

      <div class="score-half team-b">
        <div class="team-title team-name-fit">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', 1)"`}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', -1)"`}>−</button>
      </div>
    </div>
  `;
}

function renderBracketPointScoreboard_v1919(m) {
  const locked = !canEditMatch(m);
  return `
    <div class="scoreboard-full scoreboard-polish-k scoreboard-tableau-nochrono scoreboard-v1919">
      <div class="score-half team-a">
        <div class="team-title team-name-fit">${m.team_a}${serviceBall(m, 'a')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', 1)"`}>+</button>
        <div class="mega-score">${m.score_a == null ? 0 : m.score_a}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'a', -1)"`}>−</button>
      </div>

      <div class="center-controls center-controls-k center-controls-nochrono">
        <div class="mini-meta">T${m.court || '-'} · ${m.phase || ''}${m.round ? ' · ' + m.round : ''}</div>
        <div class="mini-meta mini-meta-rule">Match en 25 points</div>
        ${locked ? lockedMatchHtml(m) : `<button class="danger finish-btn finish-btn-k" onclick="finishMatch(${m.id})">Terminer le match</button>`}
      </div>

      <div class="score-half team-b">
        <div class="team-title team-name-fit">${m.team_b}${serviceBall(m, 'b')}</div>
        <button class="score-action top-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', 1)"`}>+</button>
        <div class="mega-score">${m.score_b == null ? 0 : m.score_b}</div>
        <button class="score-action bottom-action" ${locked ? 'disabled' : `onclick="changePoint(${m.id}, 'b', -1)"`}>−</button>
      </div>
    </div>
  `;
}

renderMatchScoreboard = function(m) {
  if (!m) return '';
  if (isBracketMatch(m) && !isDoneMatch(m)) {
    const html = renderBracketPointScoreboard_v1919(m);
    setTimeout(function(){ updateChronoDisplays(); }, 50);
    return html;
  }
  const html = renderTimedScoreboard_v1919(m);
  setTimeout(function(){ updateChronoDisplays(); if (hasChronoStarted_v1919(m)) maybeWarnChronoEnded(m); }, 50);
  return html;
};

setTimeout(function(){ setActiveNavButton_v1919(currentSection || 'teams'); }, 500);

/* v19.20 - verrouillage serveur réel + build marker */
const BUILD_VERSION_V1920 = 'v19.20-lock-server';

function showBuildMarker_v1920() {
  try {
    const el = document.querySelector('#buildVersion, .build-version, [data-build-version]');
    if (el) el.textContent = BUILD_VERSION_V1920;
  } catch(e) {}
}

async function fetchFreshMatch_v1920(id) {
  try {
    const res = await client.from('matches').select('*').eq('id', id).single();
    if (res && !res.error && res.data) return res.data;
  } catch(e) {}
  return matches.find(function(x) { return String(x.id) === String(id); }) || null;
}

// Verrouillage strict réellement multi-appareils :
// même si un autre téléphone a une liste non rafraîchie, l'UPDATE ne passe que si le match n'est pas déjà live/done en base.
launchMatch = async function(id) {
  let m = await fetchFreshMatch_v1920(id);
  if (!m) return;

  if (isDoneMatch(m)) {
    alert('Ce match est déjà terminé. Utilise l’admin si tu dois le corriger.');
    await loadData();
    return;
  }

  if (isLiveMatchStatus(m)) {
    if (hasLocalMatchSession(m.id)) {
      activeScoreMatchId = m.id;
      renderScoreSection();
      return;
    }
    alert('Ce match est déjà en cours sur un autre appareil.\n\nPour le libérer, il faut passer par Admin > Reset match sécurisé.');
    await loadData();
    return;
  }

  const freshOtherLive = matches.find(function(x) {
    return Number(x.court) === Number(m.court) && String(x.id) !== String(m.id) && x.team_a && x.team_b && isLiveMatchStatus(x);
  });
  if (freshOtherLive) {
    alert('Terrain ' + (m.court || '-') + ' déjà occupé par : ' + freshOtherLive.team_a + ' vs ' + freshOtherLive.team_b + '.\n\nTermine ce match ou utilise Admin > Reset match sécurisé.');
    await loadData();
    return;
  }

  const code = askRefCodeForMatch(m);
  if (!code) return;

  const update = { status: 'live' };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(code);
    if (refTeam) update.referee_team = refTeam;
  }

  const result = await client
    .from('matches')
    .update(update)
    .eq('id', id)
    .neq('status', 'live')
    .neq('status', 'done')
    .select('id,status')
    .maybeSingle();

  if (result.error) {
    alert('Erreur lancement match : ' + result.error.message);
    await loadData();
    return;
  }

  if (!result.data) {
    alert('Ce match vient d’être pris par un autre appareil.\n\nActualisation de la liste.');
    await loadData();
    return;
  }

  setLocalMatchSession(id, code);
  activeScoreMatchId = id;
  await loadData();
};

openLiveMatch = function(id) {
  const m = matches.find(function(x) { return String(x.id) === String(id); });
  if (!m) return;
  if (isDoneMatch(m)) {
    alert('Ce match est terminé. Utilise l’admin si tu dois le corriger.');
    return;
  }
  if (isLiveMatchStatus(m) && !hasLocalMatchSession(m.id)) {
    alert('Ce match est déjà en cours sur un autre appareil.\n\nPour le libérer, il faut passer par Admin > Reset match sécurisé.');
    loadData();
    return;
  }
  if (!canEditMatch(m)) {
    const code = askRefCodeForMatch(m);
    if (!code) return;
    setLocalMatchSession(m.id, code);
  }
  activeScoreMatchId = m.id;
  renderScoreSection();
};

setTimeout(showBuildMarker_v1920, 300);

/* v19.21 - verrou terrain réel côté base : impossible de lancer un match sur un terrain déjà en cours */
window.CSM_BUILD = 'v19.21-terrain-lock-db';

async function fetchLiveMatchOnCourt_v1921(court, exceptId) {
  if (!court) return null;
  try {
    const res = await client
      .from('matches')
      .select('id, phase, court, team_a, team_b, status')
      .eq('court', Number(court))
      .eq('status', 'live')
      .neq('id', exceptId)
      .limit(1);
    if (res && !res.error && res.data && res.data.length) return res.data[0];
  } catch(e) {}
  return null;
}

const launchMatch_before_v1921 = launchMatch;
launchMatch = async function(id) {
  let m = await fetchFreshMatch_v1920(id);
  if (!m) return;

  if (isDoneMatch(m)) {
    alert('Ce match est déjà terminé. Utilise l’admin si tu dois le corriger.');
    await loadData();
    return;
  }

  if (isLiveMatchStatus(m)) {
    if (hasLocalMatchSession(m.id)) {
      activeScoreMatchId = m.id;
      renderScoreSection();
      return;
    }
    alert('Ce match est déjà en cours sur un autre appareil.\n\nPour le libérer, il faut passer par Admin > Reset match sécurisé.');
    await loadData();
    return;
  }

  // Vérification serveur, pas seulement la liste locale : bloque vraiment un terrain déjà occupé.
  const courtBusy = await fetchLiveMatchOnCourt_v1921(m.court, m.id);
  if (courtBusy) {
    alert('Terrain ' + (m.court || '-') + ' déjà en cours : ' + courtBusy.team_a + ' vs ' + courtBusy.team_b + '.\n\nTermine ce match ou utilise Admin > Reset match sécurisé avant d’en lancer un autre sur ce terrain.');
    await loadData();
    return;
  }

  const code = askRefCodeForMatch(m);
  if (!code) return;

  // Re-vérification juste avant l’UPDATE pour éviter le double-clic ou 2 appareils simultanés.
  const courtBusyAfterCode = await fetchLiveMatchOnCourt_v1921(m.court, m.id);
  if (courtBusyAfterCode) {
    alert('Terrain ' + (m.court || '-') + ' vient d’être pris par : ' + courtBusyAfterCode.team_a + ' vs ' + courtBusyAfterCode.team_b + '.');
    await loadData();
    return;
  }

  const update = { status: 'live' };
  if (isBracketMatch(m)) {
    const refTeam = teamNameFromRefCode(code);
    if (refTeam) update.referee_team = refTeam;
  }

  const result = await client
    .from('matches')
    .update(update)
    .eq('id', id)
    .neq('status', 'live')
    .neq('status', 'done')
    .select('id,status')
    .maybeSingle();

  if (result.error) {
    alert('Erreur lancement match : ' + result.error.message);
    await loadData();
    return;
  }

  if (!result.data) {
    alert('Ce match vient d’être pris par un autre appareil.\n\nActualisation de la liste.');
    await loadData();
    return;
  }

  setLocalMatchSession(id, code);
  activeScoreMatchId = id;
  await loadData();
};

setTimeout(function(){
  try {
    const adminMsg = document.getElementById('adminMsg');
    if (adminMsg && (!adminMsg.innerText || adminMsg.innerText.indexOf('Build') === 0)) {
      adminMsg.innerText = 'Build ' + window.CSM_BUILD + ' chargé.';
    }
  } catch(e) {}
}, 500);


/* v20.0 - Poules adaptatives 22-26, niveaux équipes, classement ratio, B2 serpentin */
const BUILD_V20 = 'v20.0-adaptive-poules-levels-ratio-serpentin';
function teamLevel(name){
  const t = teams.find(x => String(x.name) === String(name));
  return (t && (t.level || t.team_level || t.niveau)) ? String(t.level || t.team_level || t.niveau) : '';
}
function levelShort(level){
  const l = String(level || '').toLowerCase();
  if (!l) return '';
  if (l.startsWith('reg') || l.includes('rég')) return 'REG';
  if (l.startsWith('dep') || l.includes('dép')) return 'DEP';
  if (l.startsWith('nat')) return 'NAT';
  if (l.startsWith('loi')) return 'LOISIR';
  return String(level).toUpperCase();
}
function teamDisplay(name){
  const lvl = levelShort(teamLevel(name));
  if (!name || name === 'À définir') return name || 'À définir';
  return `${escapeHtml(name)}${lvl ? ` <span class="team-level-badge">${escapeHtml(lvl)}</span>` : ''}`;
}
function teamText(name){
  const lvl = levelShort(teamLevel(name));
  return `${name || ''}${lvl ? ' ('+lvl+')' : ''}`;
}
function getTournamentTeamCount(){
  const n = Number(settings && settings.teams_count);
  return n && n > 0 ? n : teams.length;
}
function activeTeams(){
  const count = getTournamentTeamCount();
  return [...teams].sort((a,b)=>Number(a.id||0)-Number(b.id||0)).slice(0, count);
}
async function ensureConfiguredTeamsInDb(){
  const desired = getTournamentTeamCount();
  const existingIds = new Set((teams || []).map(t => Number(t.id)));
  const missing = [];
  for (let id = 1; id <= desired; id++) {
    if (!existingIds.has(id)) {
      missing.push({ id, name: defaultTeamNameByIndex(id), level: 'Loisir', initial_pool: poolLabelForTeamIndex(id, desired) });
    }
  }
  if (missing.length) {
    const ins = await client.from('teams').insert(missing);
    if (ins.error) throw new Error('création équipe(s) manquante(s) : ' + ins.error.message);
  }
  // On recharge toujours les équipes pour que la génération utilise exactement l'état base.
  const ref = await client.from('teams').select('*').order('id');
  if (ref.error) throw new Error('rechargement équipes : ' + ref.error.message);
  teams = ref.data || [];
  return activeTeams();
}
function poolSizesForCount(count, poolCount){
  poolCount = poolCount || Number(settings && settings.courts_count) || 6;
  const sizes = Array(poolCount).fill(4);
  let diff = count - 4*poolCount;
  if (diff > 0) {
    for (let i=0; i<poolCount && diff>0; i++) { sizes[i]++; diff--; }
  } else if (diff < 0) {
    for (let i=poolCount-1; i>=0 && diff<0; i--) { sizes[i]--; diff++; }
  }
  return sizes.filter(s => s > 0);
}
function expectedRoundRobinMatchesForSizes(sizes){
  return sizes.reduce((sum,s)=>sum + (s*(s-1))/2, 0);
}
function expectedBrassageMatches(){
  return expectedRoundRobinMatchesForSizes(poolSizesForCount(getTournamentTeamCount(), Number(settings && settings.courts_count) || 6));
}
function completedMatch(m){
  return m && m.status === 'done' && m.score_a !== null && m.score_b !== null;
}
function roundRobinPairs(n){
  if (n === 3) return [[0,1],[1,2],[0,2]];
  if (n === 4) return [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
  if (n === 5) return [[0,1],[2,3],[0,2],[1,4],[0,3],[2,4],[0,4],[1,2],[1,3],[3,4]];
  const pairs=[]; for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) pairs.push([i,j]); return pairs;
}
function generateRoundRobinRows(phase, poolName, court, poolTeams, startTime) {
  const pairs = roundRobinPairs(poolTeams.length);
  const slotStep = Number(settings.match_duration) + Number(settings.break_duration);
  return pairs.map((pair, slot) => ({
    phase,
    pool: poolName,
    court,
    scheduled_time: addMinutes(startTime, slot * slotStep),
    team_a: poolTeams[pair[0]],
    team_b: poolTeams[pair[1]],
    referee_team: null,
    score_a: null,
    score_b: null,
    winner: null,
    status: 'pending'
  }));
}
function statEmpty(){ return { mj:0, v:0, d:0, pm:0, pe:0, diff:0, winPct:0, ratio:0, score:0 }; }
function addMatchToStats(stats, m){
  if (!completedMatch(m)) return;
  if (!stats[m.team_a]) stats[m.team_a] = statEmpty();
  if (!stats[m.team_b]) stats[m.team_b] = statEmpty();
  const a=Number(m.score_a), b=Number(m.score_b);
  stats[m.team_a].mj++; stats[m.team_b].mj++;
  stats[m.team_a].pm += a; stats[m.team_a].pe += b; stats[m.team_a].diff += a-b;
  stats[m.team_b].pm += b; stats[m.team_b].pe += a; stats[m.team_b].diff += b-a;
  if (a>b) { stats[m.team_a].v++; stats[m.team_b].d++; }
  if (b>a) { stats[m.team_b].v++; stats[m.team_a].d++; }
}
function finalizeStats(s){
  s.winPct = s.mj ? s.v / s.mj : 0;
  s.ratio = s.pe > 0 ? s.pm / s.pe : (s.pm > 0 ? 999 : 0);
  s.score = Math.round(s.winPct * 1000000) + Math.round(s.ratio * 1000) + s.pm;
  return s;
}
function fmtRatio(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}
function compareStats(a,b){
  const sa=a[1], sb=b[1];
  return (sb.winPct - sa.winPct) || (sb.ratio - sa.ratio) || (sb.pm - sa.pm) || (sb.diff - sa.diff) || String(a[0]).localeCompare(String(b[0]));
}
function poolStats(phase, pool) {
  const teamNames = new Set();
  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => { teamNames.add(m.team_a); teamNames.add(m.team_b); });
  const stats = {}; [...teamNames].forEach(name => stats[name] = statEmpty());
  matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => addMatchToStats(stats,m));
  Object.values(stats).forEach(finalizeStats);
  return Object.entries(stats).sort(compareStats);
}
function aggregatePhaseStats(phase) {
  const stats = {}; activeTeams().forEach(t => stats[t.name] = statEmpty());
  matches.filter(m => m.phase === phase).forEach(m => addMatchToStats(stats,m));
  Object.values(stats).forEach(finalizeStats);
  return stats;
}
function phaseGlobalRanking(phase){
  const stats = aggregatePhaseStats(phase);
  return Object.entries(stats).map(([name,s]) => ({ name, ...s })).sort((a,b)=>
    (b.winPct-a.winPct) || (b.ratio-a.ratio) || (b.pm-a.pm) || (b.diff-a.diff) || teamNumberFromName(a.name)-teamNumberFromName(b.name) || String(a.name).localeCompare(String(b.name))
  );
}
function globalRanking() {
  const b2 = aggregatePhaseStats('Brassage 2');
  const b1 = aggregatePhaseStats('Brassage 1');
  return activeTeams().map(t => ({
    name: t.name,
    b2WinPct: b2[t.name]?.winPct || 0,
    b2Ratio: b2[t.name]?.ratio || 0,
    b2Pm: b2[t.name]?.pm || 0,
    b1WinPct: b1[t.name]?.winPct || 0,
    b1Ratio: b1[t.name]?.ratio || 0,
    b1Pm: b1[t.name]?.pm || 0
  })).sort((a,b) => {
    // Tri tableaux cohérent avec ce qui est affiché à l'écran :
    // 1) B2 %V affiché, 2) B2 ratio affiché à 2 décimales,
    // 3) B1 %V affiché, 4) B1 ratio affiché à 2 décimales,
    // puis points marqués. Cela évite qu'un écart invisible (ex: 1.494 vs 1.486,
    // tous deux affichés R1.49) empêche le départage B1.
    const pct = v => Math.round((Number(v) || 0) * 100);
    const rat = v => Math.round((Number(v) || 0) * 100); // 2 décimales
    return (pct(b.b2WinPct) - pct(a.b2WinPct)) ||
      (rat(b.b2Ratio) - rat(a.b2Ratio)) ||
      (pct(b.b1WinPct) - pct(a.b1WinPct)) ||
      (rat(b.b1Ratio) - rat(a.b1Ratio)) ||
      ((Number(b.b2Pm) || 0) - (Number(a.b2Pm) || 0)) ||
      ((Number(b.b1Pm) || 0) - (Number(a.b1Pm) || 0)) ||
      (teamNumberFromName(a.name) - teamNumberFromName(b.name)) ||
      String(a.name).localeCompare(String(b.name));
  }).map((r,idx)=>({ ...r, rank:idx+1, b2Score:`${Math.round(r.b2WinPct*100)}% · R${fmtRatio(r.b2Ratio)}`, b1Score:`${Math.round(r.b1WinPct*100)}% · R${fmtRatio(r.b1Ratio)}` }));
}
function renderStandings() {
  const div = document.getElementById('standingsView'); if (!div) return;
  const phases = [...new Set(matches.map(m => m.phase))].filter(p => String(p).includes('Brassage'));
  let html = '';
  phases.forEach(phase => {
    const pools = [...new Set(matches.filter(m => m.phase === phase).map(m => m.pool))].sort();
    html += `<div class="ranking-phase"><div class="ranking-phase-title"><span>${phase}</span><small>Classement : % victoires, ratio points marqués/encaissés, puis points marqués</small></div><div class="ranking-grid">`;
    pools.forEach(pool => {
      const statsRows = poolStats(phase, pool);
      const topThree = statsRows.slice(0,3).map(([name,s],i) => `<div class="ranking-podium-item rank-${i+1}"><span class="ranking-medal">${i===0?'🥇':i===1?'🥈':'🥉'}</span><strong>${teamDisplay(name)}</strong><small>${Math.round(s.winPct*100)}% · Ratio ${fmtRatio(s && s.ratio)}</small></div>`).join('');
      const rows = statsRows.map(([name,s],i) => `<tr class="rank-row ${i<3?'rank-highlight':''}"><td><span class="rank-badge">${i+1}</span></td><td class="team-cell"><b>${teamDisplay(name)}</b></td><td class="score-cell">${Math.round(s.winPct*100)}%</td><td>${fmtRatio(s && s.ratio)}</td><td>${s.mj}</td><td>${s.v}</td><td>${s.d}</td><td>${s.pm}</td></tr>`).join('');
      html += `<section class="ranking-card"><div class="ranking-card-head"><h3>Poule ${pool}</h3><span>${statsRows.length} équipes</span></div><div class="ranking-podium">${topThree}</div><div class="table-scroll"><table class="ranking-table"><tr><th>#</th><th>Équipe</th><th>%V</th><th>Ratio</th><th>MJ</th><th>V</th><th>D</th><th>PM</th></tr>${rows}</table></div></section>`;
    });
    html += `</div></div>`;
  });
  div.innerHTML = html || '<div class="card">Aucun classement disponible.</div>';
}
function levelWeightForB1(level){
  const l = levelShort(level);
  if (l === 'NAT') return 4;
  if (l === 'REG') return 3;
  if (l === 'DEP') return 2;
  return 1; // Loisir
}
function balancedPoolsByLevelForB1(list, sizes){
  const pools = sizes.map((size, idx) => ({ idx, size, teams: [] }));
  const teamsByLevel = [...list].sort((a,b) =>
    levelWeightForB1(b.level) - levelWeightForB1(a.level) || Number(a.id||0) - Number(b.id||0)
  );
  for (const team of teamsByLevel) {
    const lvl = levelShort(team.level) || 'LOISIR';
    const candidates = pools.filter(p => p.teams.length < p.size);
    candidates.sort((a,b) => {
      const aSame = a.teams.filter(t => (levelShort(t.level)||'LOISIR') === lvl).length;
      const bSame = b.teams.filter(t => (levelShort(t.level)||'LOISIR') === lvl).length;
      if (aSame !== bSame) return aSame - bSame;
      const aLoad = a.teams.length / a.size;
      const bLoad = b.teams.length / b.size;
      if (aLoad !== bLoad) return aLoad - bLoad;
      return a.idx - b.idx;
    });
    candidates[0].teams.push(team);
  }
  return pools.map(p => p.teams);
}
function generateBrassage1Rows() {
  const rows = [];
  const count = getTournamentTeamCount();
  const list = activeTeams();
  if (list.length < count) throw new Error(`Il manque ${count-list.length} équipe(s) dans la table teams. Clique sur Sauvegarder noms et niveaux ou vérifie les droits INSERT de la table teams.`);
  const sizes = poolSizesForCount(count, Number(settings && settings.courts_count) || 6);
  const poolNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const pools = balancedPoolsByLevelForB1(list, sizes);
  pools.forEach((poolTeamsObj, pIdx) => {
    const poolTeams = poolTeamsObj.map(t => t.name);
    rows.push(...generateRoundRobinRows('Brassage 1', poolNames[pIdx], pIdx+1, poolTeams, settings.start_time));
  });
  return withAccessCodes(assignBalancedRefsInPools(rows, {}), 1);
}
function serpentinePoolsFromRanking(ranking, sizes){
  const pools = sizes.map(()=>[]); let seed=0;
  const max = Math.max(...sizes);
  for(let row=0; row<max; row++){
    const order = row % 2 === 0 ? [...pools.keys()] : [...pools.keys()].reverse();
    for(const pi of order){
      if(seed >= ranking.length) break;
      if(pools[pi].length < sizes[pi]) pools[pi].push(ranking[seed++].name || ranking[seed-1]);
    }
  }
  return pools;
}
async function generateBrassage2() {
  if (!adminUnlocked) return;
  const expected = expectedBrassageMatches();
  const b1Matches = matches.filter(m => m.phase === 'Brassage 1');
  if (b1Matches.length !== expected) { document.getElementById('adminMsg').innerText = `Impossible : il faut ${expected} matchs en Brassage 1, trouvés ${b1Matches.length}.`; return; }
  const unfinished = b1Matches.filter(m => !completedMatch(m));
  if (unfinished.length) { document.getElementById('adminMsg').innerText = `Impossible : ${unfinished.length} match(s) de Brassage 1 ne sont pas terminés.`; return; }
  if (!confirm('Générer le Brassage 2 en serpentin ? Les matchs Brassage 2 existants seront supprimés.')) return;
  const ranking = phaseGlobalRanking('Brassage 1');
  const sizes = poolSizesForCount(getTournamentTeamCount(), Number(settings && settings.courts_count) || 6);
  const pools = serpentinePoolsFromRanking(ranking, sizes);
  const startB2 = getBrassage2StartTime();
  const poolNames = ['G','H','I','J','K','L','M','N'];
  let rows=[];
  pools.forEach((poolTeams, idx) => rows.push(...generateRoundRobinRows('Brassage 2', poolNames[idx], idx+1, poolTeams, startB2)));
  rows = withAccessCodes(assignBalancedRefsInPools(rows, previousRefCounts('Brassage 1')), matches.filter(m=>m.phase==='Brassage 1').length + 1);
  await client.from('matches').delete().eq('phase', 'Brassage 2');
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : `Brassage 2 généré ✅ Serpentin B1, ${rows.length} matchs créés.`;
  await loadData();
}
function safeSeed(ranking, idx){ return ranking[idx-1] && ranking[idx-1].name ? ranking[idx-1].name : 'À définir'; }
function bracketRowsFromRanking(ranking) {
  const rows=[]; const courtsCount=Math.max(1, Number(settings?.courts_count || 6));
  const courtFor = order => ((Number(order || 1)-1)%courtsCount)+1;
  const safeRow = row => Object.assign({ court:courtFor(row.match_order || rows.length+1), scheduled_time:null, status:'pending', referee_team:null, access_code:null, score_a:null, score_b:null, winner:null }, row);
  const mainPairs = [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
  mainPairs.forEach((p,idx)=>rows.push(safeRow({ phase:'Tableau principal', bracket:'Principal', round:'1/8 finale', match_order:idx+1, team_a:safeSeed(ranking,p[0]), team_b:safeSeed(ranking,p[1]), next_match_order:9+Math.floor(idx/2), next_slot:idx%2===0?'A':'B' })));
  for(let i=0;i<4;i++) rows.push(safeRow({ phase:'Tableau principal', bracket:'Principal', round:'Quart', match_order:9+i, team_a:'À définir', team_b:'À définir', next_match_order:13+Math.floor(i/2), next_slot:i%2===0?'A':'B' }));
  for(let i=0;i<2;i++) rows.push(safeRow({ phase:'Tableau principal', bracket:'Principal', round:'Demi', match_order:13+i, team_a:'À définir', team_b:'À définir', next_match_order:15, next_slot:i===0?'A':'B', loser_next_match_order:16, loser_next_slot:i===0?'A':'B' }));
  rows.push(safeRow({ phase:'Tableau principal', bracket:'Principal', round:'Finale', match_order:15, team_a:'À définir', team_b:'À définir' }));
  rows.push(safeRow({ phase:'Tableau principal', bracket:'Principal', round:'3e place', match_order:16, team_a:'À définir', team_b:'À définir' }));
  const cons = ranking.slice(16).map(r=>r.name);
  const seed = i => cons[i-1] || 'À définir';
  if (cons.length >= 9) {
    const extra = cons.length - 8;
    for(let e=0;e<extra;e++){
      const high = 8-extra+1+e; const low = cons.length-e;
      rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Barrage', match_order:100+e, team_a:seed(high), team_b:seed(low), next_match_order:101+e, next_slot: high===8?'B':'A' }));
    }
    const qPairs = [[1,8],[4,5],[3,6],[2,7]];
    qPairs.forEach((p,idx)=>rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:101+idx, team_a: p[0] <= 8-extra ? seed(p[0]) : 'À définir', team_b: p[1] <= 8-extra ? seed(p[1]) : 'À définir', next_match_order:105+Math.floor(idx/2), next_slot:idx%2===0?'A':'B' })));
  } else if (cons.length === 8) {
    [[1,8],[4,5],[3,6],[2,7]].forEach((p,idx)=>rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:101+idx, team_a:seed(p[0]), team_b:seed(p[1]), next_match_order:105+Math.floor(idx/2), next_slot:idx%2===0?'A':'B' })));
  } else if (cons.length === 7) {
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:101, team_a:seed(4), team_b:seed(5), next_match_order:105, next_slot:'B' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:102, team_a:seed(3), team_b:seed(6), next_match_order:106, next_slot:'A' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:103, team_a:seed(2), team_b:seed(7), next_match_order:106, next_slot:'B' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Demi', match_order:105, team_a:seed(1), team_b:'À définir', next_match_order:107, next_slot:'A' }));
  } else if (cons.length === 6) {
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:101, team_a:seed(4), team_b:seed(5), next_match_order:105, next_slot:'B' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Quart', match_order:102, team_a:seed(3), team_b:seed(6), next_match_order:106, next_slot:'B' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Demi', match_order:105, team_a:seed(1), team_b:'À définir', next_match_order:107, next_slot:'A' }));
    rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Demi', match_order:106, team_a:seed(2), team_b:'À définir', next_match_order:107, next_slot:'B' }));
  }
  if (cons.length >= 8) {
    for(let i=0;i<2;i++) rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Demi', match_order:105+i, team_a:'À définir', team_b:'À définir', next_match_order:107, next_slot:i===0?'A':'B' }));
  }
  if (cons.length >= 2) rows.push(safeRow({ phase:'Consolante', bracket:'Consolante', round:'Finale', match_order:107, team_a:'À définir', team_b:'À définir' }));
  return rows;
}
async function generateBrackets() {
  if (!adminUnlocked) return;
  const expected = expectedBrassageMatches();
  const b2Matches = matches.filter(m => m.phase === 'Brassage 2');
  if (b2Matches.length !== expected) { document.getElementById('adminMsg').innerText = `Impossible : il faut ${expected} matchs en Brassage 2, trouvés ${b2Matches.length}.`; return; }
  const unfinished = b2Matches.filter(m => !completedMatch(m));
  if (unfinished.length) { document.getElementById('adminMsg').innerText = `Impossible : ${unfinished.length} match(s) de Brassage 2 ne sont pas terminés.`; return; }
  if (!confirm('Générer les tableaux ? Les tableaux existants seront supprimés.')) return;
  const rows = bracketRowsFromRanking(globalRanking());
  await client.from('matches').delete().in('phase', ['Tableau principal','Consolante']);
  const { error } = await client.from('matches').insert(rows);
  document.getElementById('adminMsg').innerText = error ? error.message : `Tableaux générés ✅ ${rows.length} matchs créés.`;
  await loadData();
}
function renderAdmin() {
  ensureAdminPriorityTools(); if (!settings) return;
  document.getElementById('cfgStart').value = settings.start_time || '09:30';
  document.getElementById('cfgDuration').value = settings.match_duration || 12;
  document.getElementById('cfgBreak').value = settings.break_duration || 3;
  document.getElementById('cfgRoundBreak').value = settings.break_between_rounds || 15;
  document.getElementById('cfgCourts').value = settings.courts_count || 6;
  const cfgTeams = document.getElementById('cfgTeams'); if (cfgTeams) cfgTeams.value = getTournamentTeamCount();
  const div = document.getElementById('teamsAdmin');
  if (div) {
    const desired = getTournamentTeamCount();
    const rows = Array.from({ length: desired }, (_, i) => teamRowForAdmin(i + 1));
    const hiddenCount = Math.max(0, teams.length - desired);
    div.innerHTML = `${hiddenCount ? `<div class="admin-info">${hiddenCount} équipe(s) au-delà de la configuration sont masquées et ne seront pas utilisées.</div>` : ''}` +
      rows.map(t => {
        const poolLabel = poolLabelForTeamIndex(Number(t.id), desired);
        return `<div class="team-edit team-edit-level ${t.__new ? 'team-edit-new' : ''}"><span>${poolLabel}${String(t.id).padStart(2,'0')}</span><input data-team-id="${t.id}" data-team-new="${t.__new ? '1' : '0'}" data-team-pool="${poolLabel}" value="${escapeAttr(t.name)}" /><select data-team-level-id="${t.id}"><option value="Loisir" ${levelShort(t.level)==='LOISIR'?'selected':''}>Loisir</option><option value="Dép" ${levelShort(t.level)==='DEP'?'selected':''}>Dép</option><option value="Rég" ${levelShort(t.level)==='REG'?'selected':''}>Rég</option><option value="Nat" ${levelShort(t.level)==='NAT'?'selected':''}>Nat</option></select></div>`;
      }).join('');
  }
  renderAdminForfeit(); renderAdminMatchReset(); renderAdminScoreCorrections();
}
async function saveSettings() {
  if (!adminUnlocked) return;
  const payload = { start_time:document.getElementById('cfgStart').value, match_duration:Number(document.getElementById('cfgDuration').value), break_duration:Number(document.getElementById('cfgBreak').value), break_between_rounds:Number(document.getElementById('cfgRoundBreak').value), courts_count:Number(document.getElementById('cfgCourts').value), updated_at:new Date().toISOString() };
  const cfgTeams = document.getElementById('cfgTeams'); if (cfgTeams) payload.teams_count = Number(cfgTeams.value);
  const { error } = await client.from('settings').update(payload).eq('id', 1);
  document.getElementById('adminMsg').innerText = error ? error.message : 'Configuration sauvegardée ✅'; await loadData();
}
async function saveTeams() {
  if (!adminUnlocked) return;
  const inputs = [...document.querySelectorAll('[data-team-id]')];
  for (const input of inputs) {
    const id = Number(input.dataset.teamId);
    const sel = document.querySelector(`[data-team-level-id="${id}"]`);
    const poolLabel = input.dataset.teamPool || poolLabelForTeamIndex(id, getTournamentTeamCount());
    const payload = { id, name: input.value || defaultTeamNameByIndex(id), initial_pool: poolLabel };
    if (sel) payload.level = sel.value;
    const exists = teams.some(t => Number(t.id) === id);
    const result = exists
      ? await client.from('teams').update(payload).eq('id', id)
      : await client.from('teams').insert(payload);
    if (result.error) { document.getElementById('adminMsg').innerText = 'Erreur sauvegarde équipe : ' + result.error.message; return; }
  }
  document.getElementById('adminMsg').innerText = 'Noms et niveaux équipes sauvegardés ✅'; await loadData();
}
function renderPlanning() {
  const div = document.getElementById('planningView'); if (!div) return;
  const courtEl=document.getElementById('courtFilter'); const court=courtEl?courtEl.value:'';
  const phaseEl=document.getElementById('phaseFilter'); const phase=phaseEl?phaseEl.value:'';
  let list=[...matches]; if(court) list=list.filter(m=>String(m.court)===court); if(phase) list=list.filter(m=>m.phase===phase);
  list.sort((a,b)=>computedScheduledTime(a).localeCompare(computedScheduledTime(b)) || Number(a.court)-Number(b.court) || (a.id||0)-(b.id||0));
  div.innerHTML=`<table><tr><th>Heure</th><th>Terrain</th><th>Phase</th><th>Poule</th><th>Match</th><th>Arbitre</th><th>Score</th><th>Statut</th></tr>${list.map(m=>`<tr><td>${computedScheduledTime(m)}</td><td>T${m.court}</td><td>${m.phase}</td><td>${m.pool||'-'}</td><td>#${m.id} ${teamDisplay(m.team_a)} vs ${teamDisplay(m.team_b)}</td><td>${m.referee_team?teamPlainDisplay(m.referee_team):'-'}</td><td>${scoreText(m)}</td><td>${statusText(m)}</td></tr>`).join('')}</table>`;
}
console.log(BUILD_V20);

/* v20.4 - niveaux visibles dans Tableaux + Écran public */
function renderBrackets() {
  const rankDiv = document.getElementById('globalRankingView');
  const bracketDiv = document.getElementById('bracketsView');
  if (!rankDiv || !bracketDiv) return;

  const ranking = globalRanking();
  const topSeeds = ranking.slice(0,3).map((r,i) => `
    <div class="global-top-card rank-${i+1}">
      <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
      <strong>${teamDisplay(r.name)}</strong>
      <small>B2 ${r.b2Score} · B1 ${r.b1Score}</small>
    </div>
  `).join('');
  rankDiv.innerHTML = `<section class="global-ranking-card">
    <div class="ranking-phase-title"><span>Classement tableaux</span><small>Tri : B2 prioritaire, puis B1 en cas d'égalité</small></div>
    <div class="global-top3">${topSeeds}</div>
    <div class="table-scroll"><table class="ranking-table global-ranking-table">
      <tr><th>Rang</th><th>Équipe</th><th>B1</th><th>B2</th></tr>
      ${ranking.map((r,i) => `<tr class="rank-row ${i < 3 ? 'rank-highlight' : ''}"><td><span class="rank-badge">${i+1}</span></td><td class="team-cell"><b>${teamDisplay(r.name)}</b></td><td>${r.b1Score}</td><td class="score-cell">${r.b2Score}</td></tr>`).join('')}
    </table></div>
  </section>`;

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
    <div class="bracket-title">${escapeHtml(title)}</div>
    ${list.map(m => `<div class="card">
      <span class="seed">Match ${m.match_order} · Terrain ${m.court || '-'} · ${computedScheduledTime(m) || 'Horaire à définir'}</span><br>
      <b>${teamDisplay(m.team_a || 'À définir')}</b> vs <b>${teamDisplay(m.team_b || 'À définir')}</b><br>
      Gagnant : ${m.winner ? teamDisplay(m.winner) : '-'} · ${statusText(m)}
    </div>`).join('')}
  `).join('');
}

function renderPublicView() {
  const div = document.getElementById('publicViewContent');
  if (!div) return;

  const now = new Date();
  const clock = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const phase = currentPhaseName ? currentPhaseName() : (settings && settings.current_phase ? settings.current_phase : 'Tournoi');
  const phaseEta = estimatedPhaseEnd(phase);
  const phaseEtaLabel = phaseEta ? ('Fin phase estimée : ' + phaseEta) : 'Fin phase estimée : à confirmer';

  const maxCourts = settings && settings.courts_count ? Number(settings.courts_count) : 6;
  const courts = [];
  for (let i = 1; i <= maxCourts; i++) courts.push(i);

  const playable = matches
    .filter(function(m) { return m.team_a && m.team_b && String(m.team_a).indexOf('À définir') === -1 && String(m.team_b).indexOf('À définir') === -1 && m.status !== 'done'; })
    .sort(function(a, b) {
      return Number(a.court || 999) - Number(b.court || 999) ||
        (computedScheduledTime(a) || '').localeCompare(computedScheduledTime(b) || '') ||
        (a.id || 0) - (b.id || 0);
    });

  const nextToLaunchByCourt = courts
    .map(function(c) {
      return playable.find(function(m) { return Number(m.court) === Number(c) && !isPublicMatchLive(m); });
    })
    .filter(Boolean);

  const firstCall = nextToLaunchByCourt[0];
  const freeCourts = courts.filter(function(c) {
    return !playable.some(function(m) { return Number(m.court) === Number(c) && isPublicMatchLive(m); });
  });

  const callout = firstCall
    ? '<div class="public-callout is-urgent"><span>📢 Appel terrain ' + (firstCall.court || '-') + '</span><b>' + teamDisplay(firstCall.team_a) + ' vs ' + teamDisplay(firstCall.team_b) + '</b><em>Arbitre attendu : ' + (firstCall.referee_team ? teamPlainDisplay(firstCall.referee_team) : 'équipe à confirmer') + ' · Merci de vous présenter</em></div>'
    : (freeCourts.length
      ? '<div class="public-callout is-calm"><span>✅ Terrains disponibles</span><b>' + freeCourts.map(function(c){ return 'T' + c; }).join(' · ') + '</b><em>En attente de la prochaine rotation</em></div>'
      : '<div class="public-callout is-calm"><span>✅ Tous les matchs sont lancés</span><b>Matchs en cours</b><em>Prochaine rotation à confirmer</em></div>');

  const cards = courts.map(function(c) {
    const courtMatches = playable.filter(function(m) { return Number(m.court) === Number(c); });
    const liveMatch = courtMatches.find(isPublicMatchLive);
    const current = liveMatch || courtMatches[0];
    const next = courtMatches.find(function(m) { return current && m.id !== current.id && !isPublicMatchLive(m); });
    const isLive = !!liveMatch;
    const statusTextPublic = isLive ? 'EN COURS' : (current ? 'À LANCER' : 'TERRAIN LIBRE');
    const statusClass = isLive ? 'is-live' : (current ? 'is-next' : 'is-free');

    let body = '';
    if (current) {
      const hasScore = current.score_a != null || current.score_b != null;
      const scoreA = current.score_a == null ? 0 : current.score_a;
      const scoreB = current.score_b == null ? 0 : current.score_b;
      body += '<div class="public-main-match">' +
        '<div class="public-team public-team-a">' + teamDisplay(current.team_a) + '</div>' +
        '<div class="public-vs">vs</div>' +
        '<div class="public-team public-team-b">' + teamDisplay(current.team_b) + '</div>' +
      '</div>';
      body += hasScore || isLive
        ? '<div class="public-scoreline premium"><span>' + scoreA + '</span><b>-</b><span>' + scoreB + '</span></div>'
        : '<div class="public-waiting">Match à lancer</div>';
      body += '<div class="public-ref premium-ref">Arbitre : ' + (current.referee_team ? teamPlainDisplay(current.referee_team) : 'libre') + '</div>';
    } else {
      body += '<div class="public-free-panel"><b>Terrain disponible</b><span>Aucun match en attente</span></div>';
    }

    const nextHtml = next
      ? '<div class="public-next premium-next"><span>À suivre</span><b>' + teamDisplay(next.team_a) + ' vs ' + teamDisplay(next.team_b) + '</b><em>' + (computedScheduledTime(next) || 'Horaire à confirmer') + (next.referee_team ? ' · Arbitre : ' + teamPlainDisplay(next.referee_team) : '') + '</em></div>'
      : '<div class="public-next premium-next is-empty"><span>À suivre</span><b>—</b><em>Aucun match programmé</em></div>';

    return '<div class="public-court-card premium-tv-card ' + statusClass + '">' +
      '<div class="public-court-top premium-court-top"><div><div class="public-court-title">Terrain ' + c + '</div><div class="public-court-subtitle">' + (current && computedScheduledTime(current) ? computedScheduledTime(current) : 'Rotation suivante') + '</div></div><div class="status-pill ' + statusClass + '">' + statusTextPublic + '</div></div>' +
      body + nextHtml +
    '</div>';
  }).join('');

  div.innerHTML = '<div class="public-tv premium-tv-screen">' +
    '<div class="public-tv-header premium-tv-header">' +
      '<div class="public-brand-block"><img src="club-logo.png" alt="CSM" class="public-logo"><div><div class="public-tv-title">Tournoi CSM Volleyball 91</div><div class="public-tv-subtitle">' + escapeHtml(phase) + ' · ' + escapeHtml(phaseEtaLabel) + '</div></div></div>' +
      '<div class="public-clock premium-clock">' + escapeHtml(clock) + '</div>' +
    '</div>' +
    callout +
    '<div class="public-courts premium-public-courts">' + cards + '</div>' +
  '</div>';
}
window.CSM_BUILD = 'v20.6-b1-equilibre-niveaux';
console.log(window.CSM_BUILD);

/* v20.7 - fix création équipe sans id + reset sans double popup */
window.CSM_BUILD = 'v20.7-teams-auto-reset-single-popup';

function sortedTeams_v207(){
  return [...(teams || [])].sort((a,b)=>Number(a.id||0)-Number(b.id||0));
}

activeTeams = function(){
  const count = getTournamentTeamCount();
  return sortedTeams_v207().slice(0, count);
};

teamRowForAdmin = function(index){
  const sorted = sortedTeams_v207();
  const existing = sorted[index - 1];
  const desired = getTournamentTeamCount();
  if (existing) return { ...existing, __index:index, __new:false };
  return { id:null, __index:index, name:defaultTeamNameByIndex(index), level:'Loisir', initial_pool:poolLabelForTeamIndex(index, desired), __new:true };
};

ensureConfiguredTeamsInDb = async function(){
  const desired = getTournamentTeamCount();
  let sorted = sortedTeams_v207();
  const missingCount = Math.max(0, desired - sorted.length);
  if (missingCount > 0) {
    const rows = [];
    for (let i = 0; i < missingCount; i++) {
      const idx = sorted.length + i + 1;
      rows.push({ name: defaultTeamNameByIndex(idx), level: 'Loisir', initial_pool: poolLabelForTeamIndex(idx, desired) });
    }
    const ins = await client.from('teams').insert(rows);
    if (ins.error) throw new Error('création équipe(s) manquante(s) : ' + ins.error.message);
  }
  const ref = await client.from('teams').select('*').order('id');
  if (ref.error) throw new Error('rechargement équipes : ' + ref.error.message);
  teams = ref.data || [];
  return activeTeams();
};

renderAdmin = function() {
  ensureAdminPriorityTools(); if (!settings) return;
  document.getElementById('cfgStart').value = settings.start_time || '09:30';
  document.getElementById('cfgDuration').value = settings.match_duration || 12;
  document.getElementById('cfgBreak').value = settings.break_duration || 3;
  document.getElementById('cfgRoundBreak').value = settings.break_between_rounds || 15;
  document.getElementById('cfgCourts').value = settings.courts_count || 6;
  const cfgTeams = document.getElementById('cfgTeams'); if (cfgTeams) cfgTeams.value = getTournamentTeamCount();
  const div = document.getElementById('teamsAdmin');
  if (div) {
    const desired = getTournamentTeamCount();
    const sorted = sortedTeams_v207();
    const rows = Array.from({ length: desired }, (_, i) => teamRowForAdmin(i + 1));
    const hiddenCount = Math.max(0, sorted.length - desired);
    div.innerHTML = `${hiddenCount ? `<div class="admin-info">${hiddenCount} équipe(s) au-delà de la configuration sont masquées et ne seront pas utilisées.</div>` : ''}` +
      rows.map(t => {
        const idx = Number(t.__index || t.id);
        const poolLabel = poolLabelForTeamIndex(idx, desired);
        const realId = t.id == null ? '' : String(t.id);
        return `<div class="team-edit team-edit-level ${t.__new ? 'team-edit-new' : ''}"><span>${poolLabel}${String(idx).padStart(2,'0')}</span><input data-team-index="${idx}" data-team-real-id="${escapeAttr(realId)}" data-team-new="${t.__new ? '1' : '0'}" data-team-pool="${poolLabel}" value="${escapeAttr(t.name)}" /><select data-team-level-index="${idx}"><option value="Loisir" ${levelShort(t.level)==='LOISIR'?'selected':''}>Loisir</option><option value="Dép" ${levelShort(t.level)==='DEP'?'selected':''}>Dép</option><option value="Rég" ${levelShort(t.level)==='REG'?'selected':''}>Rég</option><option value="Nat" ${levelShort(t.level)==='NAT'?'selected':''}>Nat</option></select></div>`;
      }).join('');
  }
  renderAdminForfeit(); renderAdminMatchReset(); renderAdminScoreCorrections();
};

saveTeams = async function() {
  if (!adminUnlocked) return;
  const inputs = [...document.querySelectorAll('[data-team-index]')];
  for (const input of inputs) {
    const idx = Number(input.dataset.teamIndex);
    const realId = input.dataset.teamRealId ? Number(input.dataset.teamRealId) : null;
    const sel = document.querySelector(`[data-team-level-index="${idx}"]`);
    const poolLabel = input.dataset.teamPool || poolLabelForTeamIndex(idx, getTournamentTeamCount());
    const payload = { name: input.value || defaultTeamNameByIndex(idx), initial_pool: poolLabel };
    if (sel) payload.level = sel.value;
    const result = realId
      ? await client.from('teams').update(payload).eq('id', realId)
      : await client.from('teams').insert(payload);
    if (result.error) { document.getElementById('adminMsg').innerText = 'Erreur sauvegarde équipe : ' + result.error.message; return; }
  }
  document.getElementById('adminMsg').innerText = 'Noms et niveaux équipes sauvegardés ✅'; await loadData();
};

resetScores = async function() {
  if (!adminUnlocked) return;
  if (!confirm('Reset complet du tournoi ?\n\nTous les matchs seront supprimés de la base, puis le Brassage 1 sera recréé.\n\nLes noms et niveaux des équipes sont conservés.')) return;
  const adminMsg = document.getElementById('adminMsg');
  try {
    if (adminMsg) adminMsg.innerText = 'Reset complet en cours...';
    try {
      (matches || []).forEach(function(m) { if (typeof clearMatchRuntimeLocalState === 'function') clearMatchRuntimeLocalState(m.id); });
      if (typeof clearAllVolleyLocalStorage_v173x === 'function') clearAllVolleyLocalStorage_v173x();
      localStorage.removeItem(activeMatchStorageKey());
    } catch(e) {}
    activeScoreMatchId = null;

    const rpc = await client.rpc('reset_tournament_matches');
    if (rpc.error) throw new Error('suppression matchs : ' + rpc.error.message);

    await ensureConfiguredTeamsInDb();
    const rows = generateBrassage1Rows();
    const ins = await client.from('matches').insert(rows);
    if (ins.error) throw new Error('création Brassage 1 : ' + ins.error.message);

    await loadData();
    try { const phaseFilter = document.getElementById('phaseFilter'); if (phaseFilter) phaseFilter.value = 'Brassage 1'; renderPlanning(); } catch(e) {}
    if (adminMsg) adminMsg.innerText = `Reset complet OK ✅ ${rows.length} matchs Brassage 1 créés. Build ${window.CSM_BUILD}`;
  } catch(e) {
    if (adminMsg) adminMsg.innerText = 'Reset bloqué ❌ ' + e.message;
    alert('Reset bloqué : ' + e.message);
  }
};

console.log(window.CSM_BUILD);


/* v20.16 - stabilisation complète après v20: fonctions intactes + admin clean + codes arbitres + badges arbitres retirés */
(function(){
  window.CSM_BUILD = 'v20.16-stable-admin-codes-2026-05-29';
  if (typeof BUILD_V20 === 'undefined') window.BUILD_V20 = window.CSM_BUILD;

  // Le bloc Actions rapides Admin était doublonné : on le neutralise définitivement.
  window.ensureAdminPriorityTools = function(){ return; };
  try { if (typeof ensureAdminPriorityTools !== 'undefined') ensureAdminPriorityTools = window.ensureAdminPriorityTools; } catch(e) {}

  // Affichage texte seul pour les arbitres : jamais de badge REG/DEP/LOISIR/NAT.
  window.stripTeamLevelBadgeFromHtml = function(value){
    let v = String(value || '');
    v = v.replace(/\s*<span[^>]*class=["'][^"']*team-level-badge[^"']*["'][^>]*>.*?<\/span>/gi, '');
    v = v.replace(/\s*<span[^>]*>\s*(REG|RÉG|DEP|DÉP|LOISIR|NAT)\s*<\/span>/gi, '');
    v = v.replace(/\s*[\[(]?\s*(REG|RÉG|DEP|DÉP|LOISIR|NAT)\s*[\])]\s*$/i, '');
    return v.trim();
  };
  window.teamPlainDisplay = function(name){
    const clean = window.stripTeamLevelBadgeFromHtml(name);
    if (typeof escapeHtml === 'function') return escapeHtml(clean);
    return String(clean || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };
  try { if (typeof teamPlainDisplay !== 'undefined') teamPlainDisplay = window.teamPlainDisplay; } catch(e) {}

  function renderCodesAdminStable(){
    const codesDiv = document.getElementById('codesAdmin');
    if (!codesDiv) return;
    if (!adminUnlocked) { codesDiv.innerHTML = '<div class="card">Déverrouille l’admin pour voir les codes arbitres.</div>'; return; }
    const list = (typeof activeTeams === 'function' ? activeTeams() : (teams || [])).slice();
    const codeMap = typeof buildTeamRefCodeMap === 'function' ? buildTeamRefCodeMap(false) : {};
    const refCountByPhase = { 'Brassage 1': {}, 'Brassage 2': {} };
    ['Brassage 1','Brassage 2'].forEach(function(phase){
      list.forEach(function(t){ refCountByPhase[phase][t.name] = 0; });
      (matches || []).filter(function(m){ return m.phase === phase && m.referee_team; }).forEach(function(m){
        refCountByPhase[phase][m.referee_team] = (refCountByPhase[phase][m.referee_team] || 0) + 1;
      });
    });
    codesDiv.innerHTML = '<h3>Codes arbitres par équipe</h3>' +
      '<p class="small">Codes fixes par équipe. Les niveaux ne sont pas affichés ici volontairement.</p>' +
      '<table><tr><th>Équipe</th><th>Code arbitre</th><th>B1</th><th>B2</th></tr>' +
      list.map(function(t){
        const name = t.name || '';
        const code = codeMap[name] || (typeof defaultTeamCode === 'function' ? defaultTeamCode(t) : String(t.id || '').padStart(4,'0'));
        return '<tr><td>' + window.teamPlainDisplay(name) + '</td><td><input class="code-input" data-ref-code-team="' + escapeAttr(name) + '" value="' + escapeAttr(code) + '" inputmode="numeric" maxlength="4" placeholder="auto" /></td><td>' + (refCountByPhase['Brassage 1'][name] || 0) + '</td><td>' + (refCountByPhase['Brassage 2'][name] || 0) + '</td></tr>';
      }).join('') + '</table>' +
      '<button onclick="saveRefCodes()">Sauvegarder codes arbitres</button>' +
      '<button onclick="rebalanceRefereesForBrassages()">Rééquilibrer arbitres brassages</button>';
  }
  window.renderCodesAdminStable = renderCodesAdminStable;

  // Patch renderAdmin : on conserve la version v20.7 complète, on ajoute juste les codes et on enlève le doublon Actions rapides.
  const previousRenderAdmin = (typeof renderAdmin === 'function') ? renderAdmin : null;
  window.renderAdmin = renderAdmin = function(){
    if (previousRenderAdmin) previousRenderAdmin();
    try { renderCodesAdminStable(); } catch(e) { console.error('codes arbitres render', e); }
    try { document.querySelectorAll('.admin-priority-tools,.admin-quick-tools,.quick-admin-tools').forEach(function(el){ el.remove(); }); } catch(e) {}
  };

  // Patch léger pour les rendus publics restants : retire visuellement les badges qui seraient dans une zone arbitre.
  const css = document.createElement('style');
  css.textContent = '.public-callout em .team-level-badge,.launch-referee .team-level-badge,.public-ref .team-level-badge,.locked-box .team-level-badge,.admin-correction-sub .team-level-badge,td:nth-child(6) .team-level-badge{display:none!important;}';
  document.head.appendChild(css);

  console.log(window.CSM_BUILD);
})();

/* v20.17 - Fix définitif classement %V / ratio
   Le patch v19.18 avait réassigné poolStats avec l'ancien système score/diff.
   On force ici la version ratio en fin de fichier pour écraser tous les anciens overrides.
*/
(function(){
  function statEmptyV2017(){
    return { mj:0, v:0, d:0, pm:0, pe:0, diff:0, winPct:0, ratio:0, score:0 };
  }
  function finalizeStatsV2017(s){
    s.winPct = s.mj ? s.v / s.mj : 0;
    s.ratio = s.pe > 0 ? s.pm / s.pe : (s.pm > 0 ? 999 : 0);
    s.score = Math.round(s.winPct * 1000000) + Math.round(s.ratio * 1000) + s.pm;
    return s;
  }
  function completedMatchV2017(m){
    return m && m.status === 'done' && m.score_a !== null && m.score_a !== undefined && m.score_b !== null && m.score_b !== undefined;
  }
  window.fmtRatio = function(v){
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };
  window.poolStats = poolStats = function(phase, pool) {
    const teamNames = new Set();
    matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
      if (m.team_a && m.team_a !== 'À définir') teamNames.add(m.team_a);
      if (m.team_b && m.team_b !== 'À définir') teamNames.add(m.team_b);
    });
    const stats = {};
    [...teamNames].forEach(name => stats[name] = statEmptyV2017());
    matches.filter(m => m.phase === phase && m.pool === pool).forEach(m => {
      if (!completedMatchV2017(m)) return;
      if (!stats[m.team_a] || !stats[m.team_b]) return;
      const a = Number(m.score_a);
      const b = Number(m.score_b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      stats[m.team_a].mj++; stats[m.team_b].mj++;
      stats[m.team_a].pm += a; stats[m.team_a].pe += b; stats[m.team_a].diff += a - b;
      stats[m.team_b].pm += b; stats[m.team_b].pe += a; stats[m.team_b].diff += b - a;
      if (a > b) { stats[m.team_a].v++; stats[m.team_b].d++; }
      else if (b > a) { stats[m.team_b].v++; stats[m.team_a].d++; }
    });
    Object.values(stats).forEach(finalizeStatsV2017);
    return Object.entries(stats).sort((a,b) => {
      const sa = a[1] || statEmptyV2017();
      const sb = b[1] || statEmptyV2017();
      return (sb.winPct - sa.winPct) || (sb.ratio - sa.ratio) || (sb.pm - sa.pm) || (sb.diff - sa.diff) || String(a[0]).localeCompare(String(b[0]));
    });
  };
  window.aggregatePhaseStats = aggregatePhaseStats = function(phase) {
    const stats = {};
    activeTeams().forEach(t => stats[t.name] = statEmptyV2017());
    matches.filter(m => m.phase === phase).forEach(m => {
      if (!completedMatchV2017(m)) return;
      if (!stats[m.team_a]) stats[m.team_a] = statEmptyV2017();
      if (!stats[m.team_b]) stats[m.team_b] = statEmptyV2017();
      const a = Number(m.score_a);
      const b = Number(m.score_b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      stats[m.team_a].mj++; stats[m.team_b].mj++;
      stats[m.team_a].pm += a; stats[m.team_a].pe += b; stats[m.team_a].diff += a - b;
      stats[m.team_b].pm += b; stats[m.team_b].pe += a; stats[m.team_b].diff += b - a;
      if (a > b) { stats[m.team_a].v++; stats[m.team_b].d++; }
      else if (b > a) { stats[m.team_b].v++; stats[m.team_a].d++; }
    });
    Object.values(stats).forEach(finalizeStatsV2017);
    return stats;
  };
  window.CSM_BUILD = 'v20.17-classement-ratio-fix';
})();

/* v20.19 - Fix génération Brassage 2 adaptative 22-26 équipes
   Un ancien handler B2 attendait encore 36 matchs. On force ici le handler final.
*/
(function(){
  window.CSM_BUILD = 'v20.20-fix-tri-tableaux-arrondi';

  function expectedB1MatchCount_v2018(){
    const teamCount = (typeof getTournamentTeamCount === 'function') ? getTournamentTeamCount() : (teams || []).length;
    const courtCount = Number(settings && settings.courts_count) || 6;
    const sizes = (typeof poolSizesForCount === 'function') ? poolSizesForCount(teamCount, courtCount) : [4,4,4,4,4,4];
    return (typeof expectedRoundRobinMatchesForSizes === 'function')
      ? expectedRoundRobinMatchesForSizes(sizes)
      : sizes.reduce((sum, s) => sum + (s * (s - 1)) / 2, 0);
  }

  function completedMatch_v2018(m){
    return m && m.status === 'done' && m.score_a !== null && m.score_a !== undefined && m.score_b !== null && m.score_b !== undefined;
  }

  window.generateBrassage2 = generateBrassage2 = async function(){
    if (!adminUnlocked) return;
    const adminMsg = document.getElementById('adminMsg');
    try {
      const expected = expectedB1MatchCount_v2018();
      const b1Matches = (matches || []).filter(m => m.phase === 'Brassage 1');
      if (b1Matches.length !== expected) {
        if (adminMsg) adminMsg.innerText = `Impossible : il faut ${expected} matchs en Brassage 1, trouvés ${b1Matches.length}.`;
        return;
      }
      const unfinished = b1Matches.filter(m => !completedMatch_v2018(m));
      if (unfinished.length) {
        if (adminMsg) adminMsg.innerText = `Impossible : ${unfinished.length} match(s) de Brassage 1 ne sont pas terminés.`;
        return;
      }
      if (!confirm('Générer le Brassage 2 en serpentin ?\n\nLes matchs Brassage 2 existants seront supprimés puis recréés.')) return;

      const ranking = (typeof phaseGlobalRanking === 'function') ? phaseGlobalRanking('Brassage 1') : [];
      const teamCount = (typeof getTournamentTeamCount === 'function') ? getTournamentTeamCount() : ranking.length;
      const courtCount = Number(settings && settings.courts_count) || 6;
      const sizes = (typeof poolSizesForCount === 'function') ? poolSizesForCount(teamCount, courtCount) : [4,4,4,4,4,4];
      const pools = (typeof serpentinePoolsFromRanking === 'function')
        ? serpentinePoolsFromRanking(ranking, sizes)
        : [];
      const startB2 = (typeof getBrassage2StartTime === 'function') ? getBrassage2StartTime() : (settings && settings.start_time) || '09:30';
      const poolNames = 'GHIJKLMNOPQRSTUVWXYZ'.split('');
      let rows = [];
      pools.forEach((poolTeams, idx) => {
        rows.push(...generateRoundRobinRows('Brassage 2', poolNames[idx] || String(idx + 1), idx + 1, poolTeams, startB2));
      });
      if (typeof assignBalancedRefsInPools === 'function' && typeof previousRefCounts === 'function') {
        rows = assignBalancedRefsInPools(rows, previousRefCounts('Brassage 1'));
      }
      if (typeof withAccessCodes === 'function') {
        rows = withAccessCodes(rows, ((matches || []).filter(m => m.phase === 'Brassage 1').length || 0) + 1);
      }

      if (adminMsg) adminMsg.innerText = 'Nettoyage ancien Brassage 2...';
      const del = await client.from('matches').delete().eq('phase', 'Brassage 2');
      if (del.error) throw new Error('suppression ancien Brassage 2 : ' + del.error.message);

      const ins = await client.from('matches').insert(rows);
      if (ins.error) throw new Error('création Brassage 2 : ' + ins.error.message);
      if (adminMsg) adminMsg.innerText = `Brassage 2 généré ✅ Serpentin B1, ${rows.length} matchs créés.`;
      await loadData();
    } catch(e) {
      if (adminMsg) adminMsg.innerText = 'Impossible de générer Brassage 2 : ' + e.message;
      alert('Impossible de générer Brassage 2 : ' + e.message);
    }
  };

  // Sécurise aussi le bouton tableaux : il attend le nombre de matchs B2 réel, pas 36.
  const previousGenerateBrackets_v2018 = (typeof generateBrackets === 'function') ? generateBrackets : null;
  window.generateBrackets = generateBrackets = async function(){
    if (!adminUnlocked) return;
    const adminMsg = document.getElementById('adminMsg');
    const expected = expectedB1MatchCount_v2018();
    const b2Matches = (matches || []).filter(m => m.phase === 'Brassage 2');
    if (b2Matches.length !== expected) {
      if (adminMsg) adminMsg.innerText = `Impossible : il faut ${expected} matchs en Brassage 2, trouvés ${b2Matches.length}.`;
      return;
    }
    const unfinished = b2Matches.filter(m => !completedMatch_v2018(m));
    if (unfinished.length) {
      if (adminMsg) adminMsg.innerText = `Impossible : ${unfinished.length} match(s) de Brassage 2 ne sont pas terminés.`;
      return;
    }
    // On garde la génération v20 existante si elle existe : elle sait créer principal + consolante adaptatifs.
    if (previousGenerateBrackets_v2018) return previousGenerateBrackets_v2018();
  };

  console.log(window.CSM_BUILD);
})();

/* v20.21 - Fix doublons Brassage 2 / génération tableaux adaptative
   - Ne bloque plus si B2 a été généré deux fois : on déduplique les matchs par poule + ordre.
   - Le classement B1/B2 ignore les doublons.
   - La génération des tableaux utilise directement le classement global dédupliqué, sans repasser par un ancien handler qui attendait 36 matchs.
*/
(function(){
  window.CSM_BUILD = 'v20.21-b2-dedup-tableaux-adaptatifs';

  function expectedAdaptiveMatchCount_v2021(){
    const teamCount = (typeof getTournamentTeamCount === 'function') ? getTournamentTeamCount() : ((teams || []).length || 24);
    const courtCount = Number(settings && settings.courts_count) || 6;
    const sizes = (typeof poolSizesForCount === 'function') ? poolSizesForCount(teamCount, courtCount) : [4,4,4,4,4,4];
    return sizes.reduce((sum, s) => sum + (Number(s) * (Number(s) - 1)) / 2, 0);
  }

  function isCompleted_v2021(m){
    return !!m && m.status === 'done' && m.score_a !== null && m.score_a !== undefined && m.score_b !== null && m.score_b !== undefined;
  }

  function matchKey_v2021(m){
    const a = String(m.team_a || '').trim();
    const b = String(m.team_b || '').trim();
    const pair = [a,b].sort().join('||');
    return [m.phase || '', m.pool || '', m.round || '', m.match_order || '', pair].join('##');
  }

  function betterDuplicate_v2021(current, candidate){
    if (!current) return candidate;
    const cDone = isCompleted_v2021(current);
    const nDone = isCompleted_v2021(candidate);
    if (nDone && !cDone) return candidate;
    if (!nDone && cDone) return current;
    return (Number(candidate.id || 0) > Number(current.id || 0)) ? candidate : current;
  }

  window.uniquePhaseMatches = function uniquePhaseMatches(phase){
    const map = new Map();
    (matches || []).filter(m => m.phase === phase).forEach(m => {
      const key = matchKey_v2021(m);
      map.set(key, betterDuplicate_v2021(map.get(key), m));
    });
    return Array.from(map.values()).sort((a,b) =>
      String(a.pool || '').localeCompare(String(b.pool || '')) ||
      (Number(a.match_order || 0) - Number(b.match_order || 0)) ||
      (Number(a.id || 0) - Number(b.id || 0))
    );
  };

  window.aggregatePhaseStats = aggregatePhaseStats = function(phase){
    const empty = (typeof statEmptyV2017 === 'function') ? statEmptyV2017 : (typeof statEmpty === 'function' ? statEmpty : () => ({ mj:0,v:0,d:0,pm:0,pe:0,diff:0,winPct:0,ratio:0 }));
    const finalize = (typeof finalizeStatsV2017 === 'function') ? finalizeStatsV2017 : (typeof finalizeStats === 'function' ? finalizeStats : (s => { s.winPct = s.mj ? s.v / s.mj : 0; s.ratio = s.pe ? s.pm / s.pe : (s.pm ? 999 : 0); }));
    const stats = {};
    (typeof activeTeams === 'function' ? activeTeams() : (teams || [])).forEach(t => stats[t.name] = empty());
    (window.uniquePhaseMatches ? window.uniquePhaseMatches(phase) : (matches || []).filter(m => m.phase === phase)).forEach(m => {
      if (!isCompleted_v2021(m)) return;
      if (!stats[m.team_a]) stats[m.team_a] = empty();
      if (!stats[m.team_b]) stats[m.team_b] = empty();
      const a = Number(m.score_a), b = Number(m.score_b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      stats[m.team_a].mj++; stats[m.team_b].mj++;
      stats[m.team_a].pm += a; stats[m.team_a].pe += b; stats[m.team_a].diff += a - b;
      stats[m.team_b].pm += b; stats[m.team_b].pe += a; stats[m.team_b].diff += b - a;
      if (a > b) { stats[m.team_a].v++; stats[m.team_b].d++; }
      else if (b > a) { stats[m.team_b].v++; stats[m.team_a].d++; }
    });
    Object.values(stats).forEach(finalize);
    return stats;
  };

  window.phaseGlobalRanking = phaseGlobalRanking = function(phase){
    const stats = aggregatePhaseStats(phase);
    return Object.entries(stats).map(([name,s]) => ({ name, ...s })).sort((a,b)=>
      (Number(b.winPct || 0)-Number(a.winPct || 0)) ||
      (Number(b.ratio || 0)-Number(a.ratio || 0)) ||
      (Number(b.pm || 0)-Number(a.pm || 0)) ||
      (Number(b.diff || 0)-Number(a.diff || 0)) ||
      ((typeof teamNumberFromName === 'function' ? teamNumberFromName(a.name) : 0) - (typeof teamNumberFromName === 'function' ? teamNumberFromName(b.name) : 0)) ||
      String(a.name).localeCompare(String(b.name))
    );
  };

  window.globalRanking = globalRanking = function(){
    const b2 = aggregatePhaseStats('Brassage 2');
    const b1 = aggregatePhaseStats('Brassage 1');
    const active = (typeof activeTeams === 'function' ? activeTeams() : (teams || []));
    const pct = v => Math.round((Number(v) || 0) * 100);
    const rat = v => Math.round((Number(v) || 0) * 100);
    return active.map(t => ({
      name: t.name,
      b2WinPct: b2[t.name]?.winPct || 0,
      b2Ratio: b2[t.name]?.ratio || 0,
      b2Pm: b2[t.name]?.pm || 0,
      b1WinPct: b1[t.name]?.winPct || 0,
      b1Ratio: b1[t.name]?.ratio || 0,
      b1Pm: b1[t.name]?.pm || 0
    })).sort((a,b) =>
      (pct(b.b2WinPct) - pct(a.b2WinPct)) ||
      (rat(b.b2Ratio) - rat(a.b2Ratio)) ||
      (pct(b.b1WinPct) - pct(a.b1WinPct)) ||
      (rat(b.b1Ratio) - rat(a.b1Ratio)) ||
      ((Number(b.b2Pm)||0) - (Number(a.b2Pm)||0)) ||
      ((Number(b.b1Pm)||0) - (Number(a.b1Pm)||0)) ||
      ((typeof teamNumberFromName === 'function' ? teamNumberFromName(a.name) : 0) - (typeof teamNumberFromName === 'function' ? teamNumberFromName(b.name) : 0)) ||
      String(a.name).localeCompare(String(b.name))
    );
  };

  window.generateBrackets = generateBrackets = async function(){
    if (!adminUnlocked) return;
    const adminMsg = document.getElementById('adminMsg');
    try {
      const expected = expectedAdaptiveMatchCount_v2021();
      const rawB2 = (matches || []).filter(m => m.phase === 'Brassage 2');
      const uniqueB2 = window.uniquePhaseMatches('Brassage 2');
      if (uniqueB2.length !== expected) {
        if (adminMsg) adminMsg.innerText = `Impossible : il faut ${expected} matchs uniques en Brassage 2, trouvés ${uniqueB2.length} (${rawB2.length} lignes en base).`;
        return;
      }
      const unfinished = uniqueB2.filter(m => !isCompleted_v2021(m));
      if (unfinished.length) {
        if (adminMsg) adminMsg.innerText = `Impossible : ${unfinished.length} match(s) de Brassage 2 ne sont pas terminés.`;
        return;
      }
      if (!confirm('Générer les tableaux ? Les tableaux existants seront supprimés.')) return;
      const rows = (typeof bracketRowsFromRanking === 'function') ? bracketRowsFromRanking(globalRanking()) : [];
      const del = await client.from('matches').delete().in('phase', ['Tableau principal','Consolante','Tableaux']);
      if (del.error) throw new Error('suppression anciens tableaux : ' + del.error.message);
      const ins = await client.from('matches').insert(rows);
      if (ins.error) throw new Error('création tableaux : ' + ins.error.message);
      if (adminMsg) adminMsg.innerText = `Tableaux générés ✅ ${rows.length} matchs créés.`;
      await loadData();
    } catch(e) {
      if (adminMsg) adminMsg.innerText = 'Impossible de générer les tableaux : ' + e.message;
      alert('Impossible de générer les tableaux : ' + e.message);
    }
  };

  console.log(window.CSM_BUILD);
})();
