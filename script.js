
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

function requestAdminAccess() {
  const panel = document.getElementById('adminPanel');
  const msg = document.getElementById('adminMsg');
  if (adminUnlocked) {
    if (panel) panel.classList.remove('hidden');
    if (msg) msg.innerHTML = 'Admin déverrouillé ✅';
    if (typeof renderAdmin === 'function') renderAdmin();
    return;
  }
  const code = prompt('Code admin');
  if (code === 'keke') {
    adminUnlocked = true;
    try { localStorage.setItem('volley_admin_unlocked', '1'); } catch(e) {}
    if (panel) panel.classList.remove('hidden');
    if (msg) msg.innerHTML = 'Admin déverrouillé ✅';
    if (typeof renderAll === 'function') renderAll();
  } else if (code !== null) {
    if (msg) msg.innerHTML = 'Code admin incorrect ❌';
    alert('Code admin incorrect');
  }
}
window.requestAdminAccess = requestAdminAccess;

function restoreAdminAccessIfNeeded() {
  try {
    if (localStorage.getItem('volley_admin_unlocked') === '1') {
      adminUnlocked = true;
      const panel = document.getElementById('adminPanel');
      const msg = document.getElementById('adminMsg');
      if (panel) panel.classList.remove('hidden');
      if (msg) msg.innerHTML = 'Admin déverrouillé ✅';
    }
  } catch(e) {}
}

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
  if (id === 'admin') {
    restoreAdminAccessIfNeeded();
    if (!adminUnlocked) {
      const panel = document.getElementById('adminPanel');
      const msg = document.getElementById('adminMsg');
      if (panel) panel.classList.add('hidden');
      if (msg) msg.innerHTML = '<button onclick="requestAdminAccess()">Déverrouiller admin</button>';
    }
  }
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
    callout.innerHTML = '📢 <b>À appeler :</b> ' + nextCall.team_a + ' vs ' + nextCall.team_b + ' — Terrain ' + (nextCall.court || '?') + (nextCall.referee_team ? ' · Arbitre : ' + teamPlainDisplay(nextCall.referee_team) : '');
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
      Arbitre : <b>${m.referee_team ? teamPlainDisplay(m.referee_team) : '-'}</b><br>
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
      <td>${m.referee_team ? teamPlainDisplay(m.referee_team) : (isBracketMatch(m) ? 'Libre / non renseigné' : '-')}</td>
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
      <td>${m.referee_team ? teamPlainDisplay(m.referee_team) : '-'}</td>
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

function statDisplay(s){
  s = s || {};
  const mj = Number(s.mj || 0);
  const v = Number(s.v || 0);
  const pm = Number(s.pm || 0);
  const pe = Number(s.pe || 0);
  const winPct = mj > 0 ? v / mj : 0;
  const ratio = pe > 0 ? pm / pe : (pm > 0 ? 999 : 0);
  return {
    ...s,
    mj,
    v,
    d: Number(s.d || 0),
    pm,
    pe,
    diff: Number(s.diff || 0),
    winPct,
    ratio,
    winPctText: `${Math.round(winPct * 100)}%`,
    ratioText: Number.isFinite(ratio) ? ratio.toFixed(2) : '0.00'
  };
}
function renderStandings() {
  const div = document.getElementById('standingsView'); if (!div) return;
  const phases = [...new Set(matches.map(m => m.phase))].filter(p => String(p).includes('Brassage'));
  let html = '';
  phases.forEach(phase => {
    const pools = [...new Set(matches.filter(m => m.phase === phase).map(m => m.pool))].sort();
    html += `<div class="ranking-phase"><div class="ranking-phase-title"><span>${phase}</span><small>Classement : % victoires, ratio points marqués/encaissés, puis points marqués</small></div><div class="ranking-grid">`;
    pools.forEach(pool => {
      const statsRows = poolStats(phase, pool)
        .map(([name,s]) => [name, statDisplay(s)])
        .sort(([nameA,a],[nameB,b]) =>
          (b.winPct-a.winPct) || (b.ratio-a.ratio) || (b.pm-a.pm) || (b.diff-a.diff) || teamNumberFromName(nameA)-teamNumberFromName(nameB) || String(nameA).localeCompare(String(nameB))
        );
      const topThree = statsRows.slice(0,3).map(([name,s],i) => `<div class="ranking-podium-item rank-${i+1}"><span class="ranking-medal">${i===0?'🥇':i===1?'🥈':'🥉'}</span><strong>${teamDisplay(name)}</strong><small>${s.winPctText} · Ratio ${s.ratioText}</small></div>`).join('');
      const rows = statsRows.map(([name,s],i) => `<tr class="rank-row ${i<3?'rank-highlight':''}"><td><span class="rank-badge">${i+1}</span></td><td class="team-cell"><b>${teamDisplay(name)}</b></td><td class="score-cell">${s.winPctText}</td><td>${s.ratioText}</td><td>${s.mj}</td><td>${s.v}</td><td>${s.d}</td><td>${s.pm}</td></tr>`).join('');
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
window.CSM_BUILD = window.CSM_BUILD || 'v20.13-reference-fix';
console.log(window.CSM_BUILD);

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


/* v20.8 - Admin cleanup + referee codes restored */
(function(){
  window.CSM_BUILD = 'v20.8-admin-clean-codes-2026-05-29';

  // Remove the duplicated quick-action block at the top of Admin.
  renderAdminAlwaysVisibleTools = function() {
    const box = document.getElementById('adminToolsAlwaysVisible');
    if (box) box.remove();
  };

  function adminTeamRowsForConfiguredCount_v208() {
    const desired = Number(getTournamentTeamCount && getTournamentTeamCount()) || (teams || []).length || 24;
    if (typeof teamRowForAdmin === 'function') {
      return Array.from({ length: desired }, (_, i) => teamRowForAdmin(i + 1));
    }
    const sorted = [...(teams || [])].sort((a,b) => Number(a.id||0) - Number(b.id||0));
    return Array.from({ length: desired }, (_, i) => sorted[i] || { id:i+1, name:`Équipe ${String(i+1).padStart(2,'0')}`, level:'Loisir', __new:true });
  }

  function safeHtml_v208(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeAttr_v208(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);
    return safeHtml_v208(value);
  }

  function codeForTeamRow_v208(t, index, codeMap) {
    const name = String(t && t.name || `Équipe ${String(index).padStart(2,'0')}`);
    const existing = codeMap && codeMap[name];
    if (existing) return existing;
    try {
      return defaultTeamCode({ id: t && t.id ? t.id : index, name });
    } catch(e) {
      return String(index).padStart(4,'0').slice(-4);
    }
  }

  function renderCodesAdmin_v208() {
    const codesDiv = document.getElementById('codesAdmin');
    if (!codesDiv) return;
    if (!adminUnlocked) {
      codesDiv.innerHTML = '<p class="small">Déverrouille l\'admin pour afficher les codes arbitres.</p>';
      return;
    }

    const rows = adminTeamRowsForConfiguredCount_v208();
    const codeMap = (typeof buildTeamRefCodeMap === 'function') ? buildTeamRefCodeMap(false) : {};
    const phases = ['Brassage 1', 'Brassage 2'];
    const refCountByPhase = {};
    phases.forEach(phase => {
      refCountByPhase[phase] = {};
      rows.forEach(t => { refCountByPhase[phase][String(t.name)] = 0; });
      (matches || []).filter(m => m.phase === phase && m.referee_team).forEach(m => {
        refCountByPhase[phase][m.referee_team] = (refCountByPhase[phase][m.referee_team] || 0) + 1;
      });
    });

    codesDiv.innerHTML =
      '<h3>Codes arbitres par équipe</h3>' +
      '<p class="small">Codes fixes par équipe, visibles seulement en admin. Tu peux les modifier ici.</p>' +
      '<div class="table-scroll"><table><tr><th>Équipe</th><th>Code arbitre</th><th>B1</th><th>B2</th></tr>' +
      rows.map((t, i) => {
        const idx = Number(t.__index || t.id || (i+1));
        const name = String(t.name || `Équipe ${String(idx).padStart(2,'0')}`);
        const code = codeForTeamRow_v208(t, idx, codeMap);
        return '<tr>' +
          '<td>' + safeHtml_v208(name) + (t.__new ? ' <span class="team-level-badge">à créer</span>' : '') + '</td>' +
          '<td><input class="code-input" data-ref-code-team="' + safeAttr_v208(name) + '" value="' + safeAttr_v208(code) + '" inputmode="numeric" maxlength="4" placeholder="auto" /></td>' +
          '<td>' + (refCountByPhase['Brassage 1'][name] || 0) + '</td>' +
          '<td>' + (refCountByPhase['Brassage 2'][name] || 0) + '</td>' +
        '</tr>';
      }).join('') +
      '</table></div>' +
      '<button onclick="saveRefCodes()">Sauvegarder codes arbitres</button>' +
      '<button onclick="rebalanceRefereesForBrassages()">Rééquilibrer arbitres brassages</button>';
  }

  const previousRenderAdmin_v208 = renderAdmin;
  renderAdmin = function() {
    previousRenderAdmin_v208();
    renderAdminAlwaysVisibleTools();
    renderCodesAdmin_v208();
  };

  // Also make renderAll safe in case it calls the old quick-actions function after renderAdmin.
  try { renderAdminAlwaysVisibleTools(); } catch(e) {}
  console.log(window.CSM_BUILD);
})();


/* v20.9 - no level tags for referees / codes */
(function(){
  window.CSM_BUILD = 'v20.9-no-referee-level-tags-2026-05-29';
  // Keep the team level badges on teams/matches/tableaux, but never on referee labels.
  window.teamPlainDisplay = typeof teamPlainDisplay === 'function' ? teamPlainDisplay : function(name){
    if (typeof escapeHtml === 'function') return escapeHtml(name || '');
    return String(name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };
  console.log(window.CSM_BUILD);
})();


/* v20.10 - remove level badges from every referee display */
(function(){
  window.CSM_BUILD = 'v20.10-no-referee-badges-public-2026-05-29';
  // Global helper for text-only referee labels. Team/player labels keep their level badges via teamDisplay().
  window.refereeDisplay = function(name){
    if (!name) return '';
    if (typeof teamPlainDisplay === 'function') return teamPlainDisplay(name);
    if (typeof escapeHtml === 'function') return escapeHtml(name);
    return String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };
  console.log(window.CSM_BUILD);
})();


/* v20.11 - correction définitive badges niveaux sur arbitres */
(function(){
  window.CSM_BUILD = 'v20.11-no-referee-badges-hard-2026-05-29';

  window.stripTeamLevelBadgeFromHtml = function(value){
    let s = String(value || '');
    // Supprime les badges HTML éventuellement stockés/concaténés par erreur.
    s = s.replace(/\s*<span[^>]*class=["'][^"']*team-level-badge[^"']*["'][^>]*>.*?<\/span>/gi, '');
    // Supprime d'autres spans simples de niveau si jamais ils existent.
    s = s.replace(/\s*<span[^>]*>\s*(REG|RÉG|DEP|DÉP|LOISIR|NAT)\s*<\/span>/gi, '');
    // Nettoie un suffixe texte accidentel uniquement s'il est vraiment à la fin.
    s = s.replace(/\s*[\[(]?\s*(REG|RÉG|DEP|DÉP|LOISIR|NAT)\s*[\])]?\s*$/i, '');
    return s.trim();
  };

  // Redéfinition volontaire : utilisé pour tout affichage arbitre/codes.
  window.teamPlainDisplay = function(name){
    const clean = window.stripTeamLevelBadgeFromHtml(name);
    if (typeof escapeHtml === 'function') return escapeHtml(clean);
    return String(clean || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };

  window.refereeDisplay = window.teamPlainDisplay;

  // Filet de sécurité visuel : si un ancien rendu injecte encore un badge dans une zone arbitre, on le masque.
  const css = document.createElement('style');
  css.textContent = `
    .public-callout em .team-level-badge,
    .launch-referee .team-level-badge,
    .public-ref .team-level-badge,
    .locked-box .team-level-badge,
    .admin-correction-sub .team-level-badge,
    td:nth-child(6) .team-level-badge {
      display: none !important;
    }
  `;
  document.head.appendChild(css);

  console.log(window.CSM_BUILD);
})();


function teamPlainDisplay(name){
  const clean = (window.stripTeamLevelBadgeFromHtml ? window.stripTeamLevelBadgeFromHtml(name) : String(name || ''));
  if (typeof escapeHtml === 'function') return escapeHtml(clean);
  return String(clean || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}


/* v20.13 - reference fixes */
window.CSM_BUILD = 'v20.13-reference-fixes-2026-05-29';
console.log(window.CSM_BUILD);
