/* =====================================================
   EduLearn — Perfil — JS v6.3
   NUEVAS FUNCIONALIDADES:
   - Editar nombre de usuario (guardado en Firebase)
   - Buzón: fechas en formato DD-MM-YYYY
   - Buzón: mensajes con fecha de caducidad
   ===================================================== */
'use strict';

import { onAuthChange } from './auth.js';
import {
  syncAllToLocalStorage,
  updateUserProfile,
  saveMisionesEstado,
  saveBuzonEstado,
  addTimelineEventDB,
  getUserEnrollments,
} from './database.js';

/* ---- KEYS ---- */
const PROFILE_KEY    = 'perfil_usuario';
const ENROLL_KEY     = 'inscripciones';
const BADGE_SEEN     = 'insignias_celebradas_v4';
const MISSION_KEY    = 'misiones_estado_v4';
const EVENTS_KEY     = 'timeline_events';
const BUZON_KEY      = 'buzon_estado';
const LAST_VISIT_KEY = 'ultima_visita_fecha';
const RESET_KEY      = 'mission_resets_v2';
const SECTIONS_KEY   = 'sections_visited_today';
const BASELINE_KEY   = 'mission_baselines_v2';
const ACTIVE_DAYS_KEY= 'active_days_this_week';

/* ---- UID del usuario activo (se asigna tras auth) ---- */
let currentUID = null;

/* ---- LEVEL THRESHOLDS ---- */
const LEVEL_THR = [0,100,250,450,700,1000,1400,1850,2400,3000,3700,4500,5500,6800,8400,10200];

/* ---- BADGES ---- */
const BADGES = [
  { id:'b01', icon:'🌱', name:'PRIMER PASO',       desc:'Inscribirse al primer curso',              req:'cursos>=1',     xp:30,  cat:'progreso'  },
  { id:'b02', icon:'🎓', name:'ESTUDIOSO',          desc:'Inscribirse en 5 cursos',                 req:'cursos>=5',     xp:60,  cat:'cursos'    },
  { id:'b03', icon:'📚', name:'BIBLIÓFILO',         desc:'Inscribirse en 10 cursos',                req:'cursos>=10',    xp:100, cat:'cursos'    },
  { id:'b04', icon:'🏆', name:'COLECCIONISTA',      desc:'Inscribirse en 20 cursos',                req:'cursos>=20',    xp:200, cat:'cursos'    },
  { id:'b05', icon:'⚡', name:'RACHA x3',           desc:'3 días seguidos de actividad',            req:'racha>=3',      xp:40,  cat:'racha'     },
  { id:'b06', icon:'🔥', name:'RACHA x7',           desc:'7 días seguidos de actividad',            req:'racha>=7',      xp:80,  cat:'racha'     },
  { id:'b07', icon:'💎', name:'RACHA x30',          desc:'30 días seguidos de actividad',           req:'racha>=30',     xp:300, cat:'racha'     },
  { id:'b08', icon:'⏱', name:'HORA LIBRE',         desc:'Completar 10 horas de aprendizaje',       req:'horas>=10',     xp:50,  cat:'tiempo'    },
  { id:'b09', icon:'🕐', name:'DEDICADO',           desc:'Completar 50 horas de aprendizaje',       req:'horas>=50',     xp:120, cat:'tiempo'    },
  { id:'b10', icon:'🕰', name:'MAESTRO DEL TIEMPO', desc:'Completar 200 horas de aprendizaje',      req:'horas>=200',    xp:400, cat:'tiempo'    },
  { id:'b11', icon:'🌟', name:'NIVEL 5',            desc:'Alcanzar el nivel 5',                     req:'nivel>=5',      xp:75,  cat:'progreso'  },
  { id:'b12', icon:'💫', name:'NIVEL 10',           desc:'Alcanzar el nivel 10',                    req:'nivel>=10',     xp:150, cat:'progreso'  },
  { id:'b13', icon:'🚀', name:'NIVEL 15',           desc:'Alcanzar el nivel máximo',                req:'nivel>=15',     xp:500, cat:'legendaria'},
  { id:'b14', icon:'🎯', name:'PRECISO',            desc:'Aprobar 1 curso',                         req:'aprobados>=1',  xp:70,  cat:'cursos'    },
  { id:'b15', icon:'🏅', name:'CAMPEÓN',            desc:'Aprobar 3 cursos',                        req:'aprobados>=3',  xp:180, cat:'cursos'    },
  { id:'b16', icon:'👑', name:'LEYENDA',            desc:'Aprobar 10 cursos',                       req:'aprobados>=10', xp:600, cat:'legendaria'},
  { id:'b17', icon:'💰', name:'RICO EN XP',         desc:'Acumular 1000 XP',                        req:'xp>=1000',      xp:100, cat:'progreso'  },
  { id:'b18', icon:'🤑', name:'MAGNATE XP',         desc:'Acumular 5000 XP',                        req:'xp>=5000',      xp:250, cat:'legendaria'},
  { id:'b19', icon:'❓', name:'???',                desc:'Misterio por descubrir',                  req:'oculta_1',      xp:200, cat:'oculta'    },
  { id:'b20', icon:'🌈', name:'MULTITALENTO',       desc:'Cursos en 5 áreas distintas',             req:'areas>=5',      xp:150, cat:'progreso'  },
  { id:'b21', icon:'🎪', name:'EXPLORADOR',         desc:'Explorar todas las áreas disponibles',    req:'areas>=8',      xp:250, cat:'oculta'    },
  { id:'b22', icon:'⭐', name:'ESTRELLA',           desc:'Obtener 10 insignias',                    req:'badges>=10',    xp:120, cat:'progreso'  },
  { id:'b23', icon:'🌠', name:'SUPERNOVA',          desc:'Obtener 20 insignias',                    req:'badges>=20',    xp:350, cat:'legendaria'},
  { id:'b24', icon:'🎁', name:'ESPECIAL EVENTO',    desc:'Participar en un taller temporal',        req:'talleres>=1',   xp:80,  cat:'evento'    },
];

/* ---- MISSIONS ---- */
const MISSION_DEF = {
  daily: [
    { id:'d01', name:'PRIMER CLIC',     desc:'Visita tu perfil hoy',               icon:'👤', prog:1, max:1,  xp:10, tipo:'daily' },
    { id:'d02', name:'EXPLORADOR',      desc:'Visita 3 secciones distintas',        icon:'🗺️', prog:0, max:3,  xp:15, tipo:'daily' },
    { id:'d03', name:'ESTUDIOSO HOY',   desc:'Inscríbete en un curso hoy',          icon:'📚', prog:0, max:1,  xp:20, tipo:'daily' },
    { id:'d04', name:'RACHA ACTIVA',    desc:'Mantén tu racha de hoy',              icon:'🔥', prog:0, max:1,  xp:10, tipo:'daily' },
    { id:'d05', name:'REVISAR BUZÓN',   desc:'Lee un mensaje del buzón',            icon:'📬', prog:0, max:1,  xp:10, tipo:'daily' },
    { id:'d06', name:'5 MINUTOS',       desc:'Pasa 5 minutos en la plataforma',     icon:'⏱', prog:0, max:1,  xp:10, tipo:'daily' },
  ],
  weekly: [
    { id:'w01', name:'CURSOS x3',       desc:'Inscríbete en 3 cursos esta semana',  icon:'🎮', prog:0, max:3,  xp:60,  tipo:'weekly' },
    { id:'w02', name:'RACHA x5',        desc:'5 días activos esta semana',          icon:'🔥', prog:0, max:5,  xp:80,  tipo:'weekly' },
    { id:'w03', name:'ÁREA NUEVA',      desc:'Descubre una área de aprendizaje',    icon:'🌍', prog:0, max:1,  xp:50,  tipo:'weekly' },
    { id:'w04', name:'XP x100',         desc:'Gana 100 XP esta semana',             icon:'⚡', prog:0, max:100,xp:100, tipo:'weekly' },
    { id:'w05', name:'COLECCIÓN',       desc:'Llega a 5 cursos inscritos en total', icon:'📦', prog:0, max:5,  xp:90,  tipo:'weekly' },
    { id:'w06', name:'BUZÓN LIMPIO',    desc:'Lee todos los mensajes del buzón',    icon:'📭', prog:0, max:1,  xp:40,  tipo:'weekly' },
  ],
  monthly: [
    { id:'m01', name:'MARATÓN',         desc:'Inscríbete en 10 cursos este mes',    icon:'🏃', prog:0, max:10, xp:200, tipo:'monthly' },
    { id:'m02', name:'50 HORAS',        desc:'Completa 50 horas de aprendizaje',    icon:'📅', prog:0, max:50, xp:300, tipo:'monthly' },
    { id:'m03', name:'MULTITALENTO',    desc:'Cursos en al menos 4 áreas distintas',icon:'🎭', prog:0, max:4,  xp:250, tipo:'monthly' },
    { id:'m04', name:'XP x500',         desc:'Acumula 500 XP este mes',             icon:'💰', prog:0, max:500,xp:180, tipo:'monthly' },
    { id:'m05', name:'NIVEL UP',        desc:'Sube al menos un nivel este mes',     icon:'🆙', prog:0, max:1,  xp:150, tipo:'monthly' },
  ],
};

/* ======================================================
   ★ BUZÓN — con fechas reales y caducidad
   expira: null = no caduca | ISO string = fecha límite
   ====================================================== */
const BUZON_MESSAGES = [
  {
    id:'bz01', cat:'novedad', icon:'🆕', title:'¡NUEVO CURSO DISPONIBLE!',
    text:'Se ha agregado "Inteligencia Artificial para Principiantes" a la plataforma. ¡Inscríbete ahora y recibe 50 XP extra de bienvenida!',
    fecha: new Date(Date.now() - 1*60*60*1000).toISOString(),
    expira: null,
  },
  {
    id:'bz02', cat:'recordatorio', icon:'⏰', title:'TALLER POR EXPIRAR',
    text:'El taller "Maratón de Mates" expira pronto. ¡No olvides completarlo para obtener tu insignia!',
    fecha: new Date(Date.now() - 3*60*60*1000).toISOString(),
    expira: new Date(Date.now() + 20*60*60*1000).toISOString(), // expira en ~20h
  },
  {
    id:'bz03', cat:'logro', icon:'🏆', title:'¡NUEVA INSIGNIA DESBLOQUEADA!',
    text:'Has ganado la insignia "Primer Paso" por inscribirte en tu primer curso. ¡Sigue así!',
    fecha: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
    expira: null,
  },
  {
    id:'bz04', cat:'sistema', icon:'🔧', title:'MANTENIMIENTO PROGRAMADO',
    text:'Este domingo de 2:00 a 4:00 AM realizaremos mantenimiento. La plataforma podría no estar disponible durante ese horario.',
    fecha: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
    expira: new Date(Date.now() - 12*60*60*1000).toISOString(), // ya caducó
  },
  {
    id:'bz05', cat:'novedad', icon:'🎉', title:'¡TEMPORADA DE PRIMAVERA!',
    text:'Comienza la temporada de primavera en EduLearn. ¡20 nuevos talleres y 3 insignias especiales de evento por tiempo limitado!',
    fecha: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
    expira: new Date(Date.now() + 25*24*60*60*1000).toISOString(), // expira en 25 días
  },
  {
    id:'bz06', cat:'recordatorio', icon:'⚡', title:'MISIONES DIARIAS PENDIENTES',
    text:'Tienes misiones diarias sin completar. ¡Completa tus misiones antes de medianoche para no perder la racha!',
    fecha: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
    expira: null,
  },
  {
    id:'bz07', cat:'logro', icon:'🌟', title:'¡RACHA DE 7 DÍAS!',
    text:'¡Felicitaciones! Has mantenido una racha de 7 días seguidos. Recibes la insignia "Racha x7" y 80 XP de bonificación.',
    fecha: new Date(Date.now() - 4*24*60*60*1000).toISOString(),
    expira: null,
  },
  {
    id:'bz08', cat:'novedad', icon:'📢', title:'ACTUALIZACIÓN DE PLATAFORMA v3.5',
    text:'Hemos lanzado la versión 3.5 con nuevo sistema de buzón, mejoras en el perfil y más de 30 cursos nuevos.',
    fecha: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
    expira: null,
  },
  {
    id:'bz09', cat:'sistema', icon:'🔒', title:'NUEVA POLÍTICA DE PRIVACIDAD',
    text:'Hemos actualizado nuestra política de privacidad. Los cambios entran en vigor en 30 días.',
    fecha: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
    expira: new Date(Date.now() + 23*24*60*60*1000).toISOString(), // expira en 23 días
  },
  {
    id:'bz10', cat:'recordatorio', icon:'🎯', title:'¡COMPLETA TU PERFIL!',
    text:'Tu perfil está al 60%. Agrega una foto de avatar y selecciona tus áreas de interés para obtener recomendaciones personalizadas.',
    fecha: new Date(Date.now() - 8*24*60*60*1000).toISOString(),
    expira: null,
  },
];

/* ---- AVATARS ---- */
const AVATARS = ['🎓','🦊','🐱','🐸','🦄','🐧','🦁','🐼','🤖','👾','🧙','🧑‍💻','🐉','🦅','🐢','🎮','⭐','🌈','🚀','💎','🔮','🎯','🌟','🏆','🐯'];

/* ---- AREA COLORS ---- */
const AREA_COLORS = {
  matematicas:'#00F8FF', lectura:'#39FF14', ciencias:'#AA00FF',
  ingles:'#FFE000', arte:'#FF80EE', musica:'#FF00AA',
  tecnologia:'#FF8C00', computacion:'#FF00AA', valores:'#66ff99',
  historia:'#FF8C00', ef:'#ffff66', fisica:'#00F8FF',
  quimica:'#FF00AA', biologia:'#39FF14', idiomas:'#FFE000',
  letras:'#39FF14', arte_musica:'#FF80EE'
};

/* ---- HELPERS ---- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function ls(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function lsSet(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

function getProfile(){
  return ls(PROFILE_KEY) || { nombre:'INVITADO', email:'', xp:0, racha:0, avatar:'🎓', nivel:1, horas:0, completos:0 };
}
function getEnrolled(){
  const data = ls(ENROLL_KEY);
  if(!data) return [];
  if(Array.isArray(data)) return data;
  if(typeof data === 'object') return Object.values(data);
  return [];
}
function getMissions(){ return ls(MISSION_KEY) || {}; }
function getEvents(){   return ls(EVENTS_KEY)  || []; }
function getBuzonState(){ return ls(BUZON_KEY) || {}; }
function getBaselines(){ return ls(BASELINE_KEY) || {}; }

function toast(msg, color='var(--cyan)'){
  const t = $('#toast'); if(!t) return;
  t.textContent = msg; t.style.borderColor = color; t.style.color = color;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(()=> t.classList.remove('show'), 2800);
}

/* ======================================================
   ★ NUEVO: formatBuzonDate — fechas en DD-MM-YYYY
   Para mensajes recientes (<24h) muestra tiempo relativo,
   para el resto muestra la fecha exacta.
   ====================================================== */
function formatBuzonDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);

  if (diffMin < 1)  return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffH < 24)   return `hace ${diffH}h`;

  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/* ======================================================
   ★ NUEVO: isBuzonExpired / getBuzonExpireInfo
   Devuelve info de caducidad de un mensaje de buzón
   ====================================================== */
function isBuzonExpired(msg) {
  if (!msg.expira) return false;
  return new Date() > new Date(msg.expira);
}

function getBuzonExpireInfo(msg) {
  if (!msg.expira) return null;
  const now = new Date();
  const exp = new Date(msg.expira);
  if (now > exp) return { expired: true, label: 'CADUCADO' };

  const diffMs = exp - now;
  const diffH  = Math.floor(diffMs / 3600000);
  const diffD  = Math.floor(diffH / 24);

  let label;
  if (diffD > 1)  label = `Caduca en ${diffD}d`;
  else if (diffH >= 1) label = `Caduca en ${diffH}h`;
  else {
    const diffM = Math.floor(diffMs / 60000);
    label = `Caduca en ${diffM}m`;
  }
  const urgent = diffH < 24;
  return { expired: false, label, urgent };
}

function timeAgo(iso){
  const d = new Date(iso), now = new Date();
  const s = Math.floor((now - d) / 1000);
  if(s < 60)    return 'hace un momento';
  if(s < 3600)  return `hace ${Math.floor(s/60)}m`;
  if(s < 86400) return `hace ${Math.floor(s/3600)}h`;
  if(s < 604800)return `hace ${Math.floor(s/86400)}d`;
  return d.toLocaleDateString('es-PE', {day:'2-digit',month:'short'});
}

/* ---- FIX: HORAS solo cursos completados/aprobados ---- */
function getHorasAprendidas(enrolled) {
  return enrolled
    .filter(c => c.estado === 'completado' || c.aprobado === true)
    .reduce((a, c) => a + (c.horas || 0), 0);
}

/* ---- FIX: RACHA por fecha local ---- */
function updateRacha() {
  const p = getProfile();
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  if (lastVisit === today) return;
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (lastVisit === ayer.toDateString()) {
    p.racha = (p.racha || 0) + 1;
  } else {
    p.racha = 1;
  }
  localStorage.setItem(LAST_VISIT_KEY, today);
  lsSet(PROFILE_KEY, p);
  if (currentUID) {
    firebaseSaveProfile({ racha: p.racha }).catch(e => console.warn('[Sync] racha:', e));
  }
}

/* ---- Helpers de fechas para misiones ---- */
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function getWeekStr() {
  const ws = getWeekStart(new Date());
  return `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
}
function getMonthStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}

/* ---- FIX: Reset de misiones a hora local ---- */
function captureBaseline(period) {
  const enrolled = getEnrolled();
  const p = getProfile();
  const baselines = getBaselines();
  baselines[period] = {
    enrolledCount: enrolled.length,
    xp: p.xp || 0,
    nivel: computeLevel(p.xp || 0),
    areas: new Set(enrolled.map(c => c.area).filter(Boolean)).size,
    fecha: new Date().toISOString(),
  };
  lsSet(BASELINE_KEY, baselines);
}

function checkMissionResets() {
  const resets = ls(RESET_KEY) || {};
  const mState = getMissions();
  let changed = false;
  const todayStr = getTodayStr();
  const weekStr  = getWeekStr();
  const monthStr = getMonthStr();
  if (resets.daily !== todayStr) {
    captureBaseline('daily');
    MISSION_DEF.daily.forEach(m => { delete mState[m.id]; });
    resets.daily = todayStr;
    localStorage.removeItem(SECTIONS_KEY);
    changed = true;
  }
  if (resets.weekly !== weekStr) {
    captureBaseline('weekly');
    MISSION_DEF.weekly.forEach(m => { delete mState[m.id]; });
    resets.weekly = weekStr;
    localStorage.removeItem(ACTIVE_DAYS_KEY);
    changed = true;
  }
  if (resets.monthly !== monthStr) {
    captureBaseline('monthly');
    MISSION_DEF.monthly.forEach(m => { delete mState[m.id]; });
    resets.monthly = monthStr;
    changed = true;
  }
  if (changed) {
    lsSet(MISSION_KEY, mState);
    lsSet(RESET_KEY, resets);
    if (currentUID) {
      firebaseSaveMisiones(mState).catch(e => console.warn('[Sync] reset misiones:', e));
    }
  }
}

/* ---- Countdown ---- */
function formatCountdown(secs) {
  if (secs <= 0) return '00m 00s';
  const pad = n => String(n).padStart(2, '0');
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(m)}m ${pad(s)}s`;
}

function getSecsUntilReset() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dailySecs = Math.max(0, Math.floor((nextMidnight - now) / 1000));
  const nextWeekStart = getWeekStart(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const weeklySecs = Math.max(0, Math.floor((nextWeekStart - now) / 1000));
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthlySecs = Math.max(0, Math.floor((nextMonth - now) / 1000));
  return { dailySecs, weeklySecs, monthlySecs };
}

let countdownInterval = null;
function updateMissionCountdowns() {
  const { dailySecs, weeklySecs, monthlySecs } = getSecsUntilReset();
  const dEl = document.getElementById('cd-daily-val');
  const wEl = document.getElementById('cd-weekly-val');
  const mEl = document.getElementById('cd-monthly-val');
  if (dEl) dEl.textContent = formatCountdown(dailySecs);
  if (wEl) wEl.textContent = formatCountdown(weeklySecs);
  if (mEl) mEl.textContent = formatCountdown(monthlySecs);
}
function startCountdowns() {
  updateMissionCountdowns();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateMissionCountdowns, 1000);
}

/* ---- Secciones visitadas (d02) ---- */
function getSectionsToday() {
  const today = new Date().toDateString();
  try {
    const data = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '{}');
    if (data.date !== today) return { date: today, sections: [] };
    return data;
  } catch { return { date: today, sections: [] }; }
}

function recordSectionVisit(tabName) {
  const data = getSectionsToday();
  if (!data.sections.includes(tabName)) {
    data.sections.push(tabName);
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(data));
  }
  const count = data.sections.length;
  const mState = getMissions();
  if (!mState.d02?.done && count >= 3) {
    completeMissionSilent('d02');
    renderMissions();
    renderHeader();
    toast('🗺️ MISIÓN: EXPLORADOR COMPLETADA +15 XP', 'var(--yellow)');
  }
}

/* ---- Días activos esta semana (w02) ---- */
function recordActiveDay() {
  const today = getTodayStr();
  const weekStr = getWeekStr();
  let data;
  try { data = JSON.parse(localStorage.getItem(ACTIVE_DAYS_KEY) || '{}'); } catch { data = {}; }
  if (data.weekStr !== weekStr) data = { weekStr, days: [] };
  if (!data.days.includes(today)) data.days.push(today);
  localStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(data));
  return data.days.length;
}

function getActiveDaysThisWeek() {
  const weekStr = getWeekStr();
  let data;
  try { data = JSON.parse(localStorage.getItem(ACTIVE_DAYS_KEY) || '{}'); } catch { data = {}; }
  if (data.weekStr !== weekStr) return 0;
  return (data.days || []).length;
}

/* ---- Timer 5 minutos (d06) ---- */
function startPlatformTimer() {
  setTimeout(() => {
    const mState = getMissions();
    if (!mState.d06?.done) {
      completeMissionSilent('d06');
      renderMissions();
      renderHeader();
      toast('⏱ MISIÓN: 5 MINUTOS COMPLETADA +10 XP', 'var(--yellow)');
    }
  }, 5 * 60 * 1000);
}

/* ---- Firebase sync ---- */
async function firebaseSaveMisiones(mState) {
  if(!currentUID) return;
  try { await saveMisionesEstado(currentUID, mState); } catch(e) { console.warn('[Sync] misiones:', e); }
}
async function firebaseSaveBuzon(bState) {
  if(!currentUID) return;
  try { await saveBuzonEstado(currentUID, bState); } catch(e) { console.warn('[Sync] buzon:', e); }
}
async function firebaseSaveTimelineEvent(ev) {
  if(!currentUID) return;
  try { await addTimelineEventDB(currentUID, ev); } catch(e) { console.warn('[Sync] timeline:', e); }
}
async function firebaseSaveProfile(data) {
  if(!currentUID) return;
  try { await updateUserProfile(currentUID, data); } catch(e) { console.warn('[Sync] profile:', e); }
}
function showSyncIndicator(text = '⟳ SINCRONIZANDO...') {
  const xpBadge = $('#xp-display');
  if(xpBadge) xpBadge.style.opacity = '0.5';
  toast(text, 'var(--cyan)');
}
function hideSyncIndicator() {
  const xpBadge = $('#xp-display');
  if(xpBadge) xpBadge.style.opacity = '1';
}

/* ---- Stars ---- */
function initStars(){
  const canvas = $('#stars-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  const STAR_COLORS = ['#FFE000','#00F8FF','#ffffff','#FF00AA'];
  const stars = Array.from({length:120},()=>({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.5+0.5,
    o: Math.random()*0.5+0.1,
    speed: Math.random()*0.3+0.1,
    ci: Math.floor(Math.random()*STAR_COLORS.length)
  }));
  function draw(){
    ctx.clearRect(0,0,W,H);
    stars.forEach(s=>{
      ctx.globalAlpha = s.o;
      ctx.fillStyle = STAR_COLORS[s.ci];
      ctx.fillRect(s.x, s.y, s.r, s.r);
      s.y -= s.speed;
      if(s.y < 0){ s.y = H; s.x = Math.random()*W; }
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize',()=>{ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; });
}

/* ---- Loader ---- */
function hideLoader(){
  const loader = $('#loader');
  if(!loader) return;
  let w = 0;
  const fill = $('#ld-fill');
  const iv = setInterval(()=>{
    w += Math.random()*18+6;
    if(fill) fill.style.width = Math.min(w,100)+'%';
    if(w >= 100){
      clearInterval(iv);
      setTimeout(()=>{
        loader.style.transition = 'opacity 0.4s';
        loader.style.opacity = '0';
        setTimeout(()=>{ loader.style.display='none'; }, 400);
      }, 300);
    }
  }, 70);
}

/* ---- Level ---- */
function computeLevel(xp){
  let lv = 1;
  for(let i=0; i<LEVEL_THR.length; i++) if(xp >= LEVEL_THR[i]) lv = i+1;
  return Math.min(lv, LEVEL_THR.length);
}
function xpForNextLevel(lv, xp){
  const idx = lv;
  if(idx >= LEVEL_THR.length) return { pct:100, current:xp, needed:xp };
  const base = LEVEL_THR[lv-1];
  const next = LEVEL_THR[idx];
  const pct = Math.min(100, ((xp-base)/(next-base))*100);
  return { pct, current: xp-base, needed: next-base };
}

/* ---- Badges ---- */
function getEarnedBadgeIds(p, enrolled) {
  const xp        = p.xp || 0;
  const racha     = p.racha || 0;
  const horas     = getHorasAprendidas(enrolled);
  const aprobados = enrolled.filter(c => c.estado==='completado' || c.aprobado===true).length;
  const lv        = computeLevel(xp);
  const areas     = new Set(enrolled.map(c => c.area).filter(Boolean)).size;
  const talleres  = enrolled.filter(c => c.tipo==='temporal').length;
  const totalCursos = enrolled.length;
  const earned = new Set();
  for(const b of BADGES) {
    const r = b.req;
    if(r === 'oculta_1') {
      if(totalCursos >= 5 && racha >= 3) earned.add(b.id);
      continue;
    }
    if(r.startsWith('badges')) continue;
    const m = r.match(/^(\w+)>=([\d.]+)$/);
    if(!m) continue;
    const [,key,val] = m; const v = Number(val);
    let pass = false;
    switch(key){
      case 'cursos':    pass = totalCursos >= v; break;
      case 'racha':     pass = racha        >= v; break;
      case 'horas':     pass = horas        >= v; break;
      case 'aprobados': pass = aprobados    >= v; break;
      case 'completos': pass = aprobados    >= v; break;
      case 'nivel':     pass = lv           >= v; break;
      case 'xp':        pass = xp           >= v; break;
      case 'areas':     pass = areas        >= v; break;
      case 'talleres':  pass = talleres     >= v; break;
    }
    if(pass) earned.add(b.id);
  }
  const count = earned.size;
  for(const b of BADGES) {
    const m = b.req.match(/^badges>=(\d+)$/);
    if(m && count >= Number(m[1])) earned.add(b.id);
  }
  return earned;
}

/* ---- Render Header ---- */
function renderHeader(){
  const p       = getProfile();
  const enrolled= getEnrolled();
  const lv      = computeLevel(p.xp||0);
  const earnedIds = getEarnedBadgeIds(p, enrolled);

  const nameEl = $('#profile-name');  if(nameEl)  nameEl.textContent  = (p.nombre||'INVITADO').toUpperCase();
  const emailEl= $('#profile-email'); if(emailEl) emailEl.textContent = p.email||'';
  const tagEl  = $('#profile-tag');   if(tagEl)   tagEl.textContent   = `▸ NIVEL ${lv} JUGADOR`;
  const avEl   = $('#avatar-display');if(avEl)    avEl.textContent    = p.avatar||'🎓';
  const lvEl   = $('#level-num');     if(lvEl)    lvEl.textContent    = lv;
  const xpValEl= $('#xp-val');        if(xpValEl) xpValEl.textContent = p.xp||0;
  const lvInfo = xpForNextLevel(lv, p.xp||0);
  const xpNextEl=$('#xp-next');       if(xpNextEl)xpNextEl.textContent= (LEVEL_THR[lv]||'MAX');
  const barEl  = $('#xp-bar-fill');   if(barEl)   barEl.style.width   = lvInfo.pct+'%';
  const xpBadge= $('#xp-display');    if(xpBadge) xpBadge.textContent = `⚡ ${p.xp||0} XP`;

  const statCursos   = $('#stat-cursos');    if(statCursos)    statCursos.textContent    = enrolled.length;
  const statInsignias= $('#stat-insignias'); if(statInsignias) statInsignias.textContent = earnedIds.size;
  const statRacha    = $('#stat-racha');     if(statRacha)     statRacha.textContent     = p.racha||0;
  const statXp       = $('#stat-xp');        if(statXp)        statXp.textContent        = p.xp||0;
}

/* ======================================================
   ★ NUEVO: initNameEdit — Edición de nombre de usuario
   Permite cambiar el nombre, guarda en localStorage y
   sincroniza con Firebase en tiempo real.
   ====================================================== */
function initNameEdit() {
  const btnEdit  = $('#btn-edit-name');
  const modal    = $('#name-edit-modal');
  const btnClose = $('#name-edit-modal-close');
  const input    = $('#name-edit-input');
  const btnSave  = $('#name-edit-save');
  const btnCancel= $('#name-edit-cancel');
  const charCount= $('#name-char-count');

  if(!btnEdit || !modal || !input || !btnSave) return;

  /* Abrir modal */
  btnEdit.addEventListener('click', () => {
    const p = getProfile();
    input.value = p.nombre || '';
    updateCharCount();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 100);
  });

  /* Contador de caracteres */
  function updateCharCount() {
    const len = input.value.trim().length;
    if(charCount) charCount.textContent = `${len}/24`;
    if(btnSave) btnSave.disabled = len < 2 || len > 24;
  }
  input.addEventListener('input', updateCharCount);

  /* Limitar a 24 caracteres mientras escribe */
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSave.click();
    if (e.key === 'Escape') closeNameModal();
  });

  /* Guardar */
  btnSave.addEventListener('click', async () => {
    const newName = input.value.trim();
    if (!newName || newName.length < 2) {
      toast('⚠️ El nombre debe tener al menos 2 caracteres', 'var(--red)');
      return;
    }
    if (newName.length > 24) {
      toast('⚠️ Máximo 24 caracteres', 'var(--red)');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = '⟳ GUARDANDO...';

    const p = getProfile();
    const oldName = p.nombre;
    p.nombre = newName;
    lsSet(PROFILE_KEY, p);
    renderHeader();
    closeNameModal();

    /* Sincronizar con Firebase */
    try {
      if (currentUID) {
        await firebaseSaveProfile({ nombre: newName });
        toast(`✓ NOMBRE ACTUALIZADO: ${newName.toUpperCase()}`, 'var(--green)');
        addTimelineEvent({
          icon: '✏️',
          title: 'Nombre actualizado',
          detail: `${oldName} → ${newName}`,
        });
      } else {
        toast(`✓ NOMBRE GUARDADO: ${newName.toUpperCase()}`, 'var(--green)');
      }
    } catch(err) {
      console.warn('[Sync] nombre:', err);
      toast('⚠️ Guardado local, sin sync', 'var(--orange)');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = '✓ GUARDAR';
    }
  });

  function closeNameModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    btnSave.disabled = false;
    btnSave.textContent = '✓ GUARDAR';
  }

  btnClose?.addEventListener('click', closeNameModal);
  btnCancel?.addEventListener('click', closeNameModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeNameModal();
  });
}

/* ---- Render Resumen ---- */
function renderResumen(){
  const p       = getProfile();
  const enrolled= getEnrolled();
  const horas   = getHorasAprendidas(enrolled);
  const aprobados= enrolled.filter(c => c.estado==='completado' || c.aprobado===true).length;

  const rcCursos  = $('#rc-cursos');   if(rcCursos)   rcCursos.textContent   = enrolled.length;
  const rcComp    = $('#rc-completos');if(rcComp)     rcComp.textContent     = aprobados;
  const rcHoras   = $('#rc-horas');    if(rcHoras)    rcHoras.textContent    = horas+'h';
  const rcRacha   = $('#rc-racha');    if(rcRacha)    rcRacha.textContent    = p.racha||0;

  const safe = (n,m) => Math.min(100,(n/m)*100).toFixed(0)+'%';
  const bCursos= $('#rc-bar-cursos'); if(bCursos) bCursos.style.width = safe(enrolled.length,30);
  const bComp  = $('#rc-bar-comp');   if(bComp)   bComp.style.width   = safe(aprobados,10);
  const bHoras = $('#rc-bar-horas');  if(bHoras)  bHoras.style.width  = safe(horas,200);
  const bRacha = $('#rc-bar-racha');  if(bRacha)  bRacha.style.width  = safe(p.racha||0,30);

  const areaMap = {};
  enrolled.forEach(c=>{ areaMap[c.area]=(areaMap[c.area]||0)+1; });
  const sorted = Object.entries(areaMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxA = sorted[0]?.[1] || 1;
  const aList = $('#areas-list');
  if(aList){
    if(!sorted.length){
      aList.innerHTML='<p style="font-family:var(--font-pixel);font-size:0.38rem;color:var(--muted)">SIN DATOS AÚN</p>';
    } else {
      aList.innerHTML = sorted.map(([area,count])=>`
        <div class="area-row">
          <span class="area-name">${area.toUpperCase().slice(0,10)}</span>
          <div class="area-bar-wrap"><div class="area-bar-fill" style="width:${(count/maxA*100).toFixed(0)}%;background:${AREA_COLORS[area]||'var(--cyan)'}"></div></div>
          <span class="area-count">${count}</span>
        </div>`).join('');
    }
  }

  const events = getEvents().slice(0,5);
  const rTl = $('#resumen-timeline');
  if(rTl){
    if(!events.length){
      rTl.innerHTML='<p style="font-family:var(--font-pixel);font-size:0.35rem;color:var(--muted)">SIN ACTIVIDAD</p>';
    } else {
      rTl.innerHTML = events.map(e=>`
        <div class="mini-event">
          <span class="me-icon">${e.icon||'📌'}</span>
          <div><div class="me-text">${e.title}</div><div class="me-time">${timeAgo(e.fecha)}</div></div>
        </div>`).join('');
    }
  }
}

/* ---- Render Inventory ---- */
function renderInventory(){
  const enrolled = getEnrolled();
  const search   = ($('#curso-search')?.value||'').toLowerCase();
  const estado   = $('#curso-filter-estado')?.value||'';
  const tipo     = $('#curso-filter-tipo')?.value||'';

  let list = [...enrolled];
  if(search) list = list.filter(c => c.nombre.toLowerCase().includes(search));
  if(estado === 'temporal') list = list.filter(c => c.tipo === 'temporal');
  else if(estado) list = list.filter(c => c.estado === estado);
  if(tipo)   list = list.filter(c => c.tipo === tipo);

  const grid = $('#inventory-grid');
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="inv-empty-state"><div style="font-size:3rem">📦</div><p>${enrolled.length?'SIN RESULTADOS':'¡AÚN NO TIENES CURSOS!'}</p></div>`;
    return;
  }

  const color = c => AREA_COLORS[c.area] || 'var(--cyan)';

  const getSlotStatus = (c) => {
    if(c.tipo === 'temporal') return { label:'TALLER', cls:'temporal' };
    const tieneNota     = typeof c.nota_final === 'number';
    const tieneAprobado = typeof c.aprobado   === 'boolean';
    const examenRendido = tieneNota || tieneAprobado || c.estado === 'completado';
    if(examenRendido) {
      const aprobado = c.aprobado === true || c.estado === 'completado';
      return aprobado
        ? { label:'APROBADO', cls:'aprobado' }
        : { label:'DESAPROB.', cls:'desaprobado' };
    }
    return { label:'ACTIVO', cls:'progress' };
  };

  const getNota = (c) => {
    if(typeof c.nota_final === 'number') return `${c.nota_final}/20`;
    return `+${c.horas||0}h`;
  };

  grid.innerHTML = list.map(c=>{
    const slot   = getSlotStatus(c);
    const nota   = getNota(c);
    const tieneNota = typeof c.nota_final === 'number';
    const aprobado  = c.aprobado === true || c.estado === 'completado';
    return `
    <div class="inv-slot" data-id="${c.id}" title="${c.nombre}">
      <div class="inv-corner tl"></div><div class="inv-corner tr"></div>
      <div class="inv-corner bl"></div><div class="inv-corner br"></div>
      <img class="inv-img" src="${c.img||''}" alt="${c.nombre}" loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=200&q=60'">
      <div class="inv-area-dot" style="background:${color(c)};width:8px;height:8px;box-shadow:0 0 6px ${color(c)}"></div>
      <div class="inv-xp">${nota}</div>
      <div class="inv-name">${c.nombre}</div>
      <div class="inv-status ${slot.cls}">${slot.label}</div>
      <div class="inv-tooltip">
        <div class="tt-name">${c.nombre}</div>
        <div class="tt-meta">${(c.area||'').toUpperCase()} • ${c.horas||0}h</div>
        ${tieneNota
          ? `<div class="tt-meta" style="color:${aprobado ? 'var(--green)' : 'var(--red)'}">
               NOTA: ${c.nota_final}/20 — ${aprobado ? '✓ APROBADO' : '✗ DESAPROBADO'}
             </div>`
          : ''
        }
        ${c.link && c.link!=='#'
          ? `<a href="${c.link}" class="tt-action" onclick="event.stopPropagation()">▶ IR AL CURSO</a>`
          : `<span class="tt-action">📌 EN PROGRESO</span>`}
      </div>
    </div>`;
  }).join('');
}

/* ---- Render Calificaciones ---- */
let califFilter = '';

function getCursoEstado(c) {
  if(c.tipo === 'temporal') return 'taller';
  const nota = parseFloat(c.nota_final);
  const tieneNota = !isNaN(nota);
  const aprobadoVal = c.aprobado;
  const aprobadoBool = aprobadoVal === true || aprobadoVal === 'true' || String(aprobadoVal) === 'true';
  const examenRendido = tieneNota || (aprobadoVal != null && aprobadoVal !== '') || c.estado === 'completado';
  if(!examenRendido) return 'pendiente';
  const esAprobado = aprobadoBool || nota >= 11 || c.estado === 'completado';
  return esAprobado ? 'aprobado' : 'desaprobado';
}

function renderCalificaciones() {
  const enrolled = getEnrolled();
  let nAprobados = 0, nDesaprobados = 0, nPendientes = 0;
  let sumaNotas = 0, countNotas = 0;
  enrolled.forEach(c => {
    const est = getCursoEstado(c);
    if(est === 'aprobado')         nAprobados++;
    else if(est === 'desaprobado') nDesaprobados++;
    else if(est === 'pendiente')   nPendientes++;
    const n = parseFloat(c.nota_final);
    if(!isNaN(n)) { sumaNotas += n; countNotas++; }
  });
  const promedio = countNotas > 0 ? (sumaNotas / countNotas).toFixed(1) : '—';
  const total    = enrolled.length || 1;

  const elAprobados    = $('#calif-aprobados');
  const elDesaprobados = $('#calif-desaprobados');
  const elPendientes   = $('#calif-pendientes');
  const elPromedio     = $('#calif-promedio');
  if(elAprobados)    elAprobados.textContent    = nAprobados;
  if(elDesaprobados) elDesaprobados.textContent = nDesaprobados;
  if(elPendientes)   elPendientes.textContent   = nPendientes;
  if(elPromedio)     elPromedio.textContent      = promedio !== '—' ? `${promedio}/20` : '—';

  requestAnimationFrame(() => {
    const barA = $('#chs-bar-aprobados');
    const barD = $('#chs-bar-desaprobados');
    const barP = $('#chs-bar-promedio');
    if(barA) barA.style.width = `${Math.round(nAprobados / total * 100)}%`;
    if(barD) barD.style.width = `${Math.round(nDesaprobados / total * 100)}%`;
    if(barP && promedio !== '—') barP.style.width = `${Math.round(parseFloat(promedio) / 20 * 100)}%`;
  });

  let list = [...enrolled];
  if(califFilter === 'aprobado')         list = list.filter(c => getCursoEstado(c) === 'aprobado');
  else if(califFilter === 'desaprobado') list = list.filter(c => getCursoEstado(c) === 'desaprobado');
  else if(califFilter === 'pendiente')   list = list.filter(c => getCursoEstado(c) === 'pendiente');

  const listEl  = $('#calif-list');
  const emptyEl = $('#calif-empty');
  if(!listEl) return;

  if(!enrolled.length) {
    listEl.innerHTML = '';
    if(emptyEl) { emptyEl.style.display = 'block'; emptyEl.innerHTML = `<div class="ce-icon">📋</div><p>AÚN NO TIENES CURSOS INSCRITOS</p>`; }
    return;
  }
  if(!list.length) {
    listEl.innerHTML = '';
    if(emptyEl) { emptyEl.style.display = 'block'; emptyEl.innerHTML = `<div class="ce-icon">🔍</div><p>NO HAY CURSOS EN ESTA CATEGORÍA</p>`; }
    return;
  }
  if(emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = list.map(c => {
    const estado     = getCursoEstado(c);
    const nota       = !isNaN(parseFloat(c.nota_final)) ? parseFloat(c.nota_final) : null;
    const tieneNota  = nota !== null;
    const pct        = tieneNota ? Math.round(nota / 20 * 100) : 0;
    const areaColor  = AREA_COLORS[c.area] || 'var(--cyan)';
    let estadoBadge, notaDisplay, fillClass;
    if(estado === 'aprobado') {
      estadoBadge = '✓ MISIÓN COMPLETA'; notaDisplay = nota !== null ? nota : '—'; fillClass = 'fill-aprobado';
    } else if(estado === 'desaprobado') {
      estadoBadge = '✗ MISIÓN FALLIDA'; notaDisplay = nota !== null ? nota : '—'; fillClass = 'fill-desaprobado';
    } else if(estado === 'taller') {
      estadoBadge = '🎪 TALLER'; notaDisplay = '—'; fillClass = 'fill-pendiente';
    } else {
      estadoBadge = '⏳ PENDIENTE'; notaDisplay = '?'; fillClass = 'fill-pendiente';
    }
    const cardCls = estado === 'aprobado' ? 'calif-aprobado' : estado === 'desaprobado' ? 'calif-desaprobado' : 'calif-pendiente';
    const xpLabel = tieneNota ? `${pct}%` : estado === 'pendiente' ? 'SIN EXAMEN' : '—';
    return `
    <div class="calif-card ${cardCls}">
      <div class="calif-ribbon"></div>
      <div class="calif-img-wrap">
        <img class="calif-img" src="${c.img||''}" alt="${c.nombre}" loading="lazy" onerror="this.style.display='none'">
        <div class="calif-img-overlay"></div>
        <div class="ca-area-dot" style="color:${areaColor};border-color:${areaColor}">${(c.area||'CURSO').toUpperCase()}</div>
      </div>
      <div class="calif-body">
        <div class="calif-nombre">${c.nombre}</div>
        <div class="calif-meta">
          ${c.tipo==='temporal' ? `<span class="calif-tipo-tag">TALLER</span>` : ''}
          <span class="calif-horas">⏱ ${c.horas||0}h</span>
        </div>
        <div class="calif-xp-row">
          <span class="calif-xp-label">${xpLabel}</span>
          <div class="calif-barra-track"><div class="calif-barra-fill ${fillClass}" style="width:${pct}%"></div></div>
        </div>
      </div>
      <div class="calif-grade-panel">
        <div class="calif-grade-orb"><span class="calif-nota-num">${notaDisplay}</span></div>
        ${tieneNota ? `<div class="calif-nota-denom">/20</div>` : ''}
        <div class="calif-estado-badge">${estadoBadge}</div>
      </div>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    $$('#calif-list .calif-card').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(14px)';
      setTimeout(() => { el.style.transition = 'opacity 0.3s, transform 0.3s'; el.style.opacity = '1'; el.style.transform = 'none'; }, i * 55);
    });
  });
}

function initCalifFilters() {
  $$('.cf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.cf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      califFilter = btn.dataset.cf || '';
      renderCalificaciones();
    });
  });
}

/* ---- Render Badges ---- */
let badgeCatFilter = '';
function renderBadges(){
  const p       = getProfile();
  const enrolled= getEnrolled();
  const earnedIds = getEarnedBadgeIds(p, enrolled);
  const filtered  = badgeCatFilter ? BADGES.filter(b=>b.cat===badgeCatFilter) : BADGES;
  const earnedCount = earnedIds.size;
  const beEl = $('#badges-earned'); if(beEl) beEl.textContent = earnedCount;
  const btEl = $('#badges-total');  if(btEl) btEl.textContent = BADGES.length;
  const bbEl = $('#badges-bar-fill');
  if(bbEl) bbEl.style.width = (earnedCount/BADGES.length*100).toFixed(0)+'%';
  const seen  = ls(BADGE_SEEN) || [];
  const grid  = $('#badges-grid');
  if(!grid) return;
  grid.innerHTML = filtered.map(b=>{
    const isEarned = earnedIds.has(b.id);
    const isNew    = isEarned && !seen.includes(b.id);
    return `
    <div class="badge-card ${isEarned?'earned':'locked'} ${isNew?'badge-new-glow':''} reveal" data-bid="${b.id}">
      ${!isEarned ? '<span class="badge-locked-label">🔒</span>' : ''}
      <span class="badge-icon">${b.icon}</span>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${isEarned ? `<div class="badge-date">+${b.xp} XP ✓</div>` : `<div class="badge-date" style="color:var(--muted)">+${b.xp} XP (bloq.)</div>`}
    </div>`;
  }).join('');
  requestAnimationFrame(()=>{
    $$('#badges-grid .reveal').forEach((el,i)=>{ setTimeout(()=> el.classList.add('visible'), i*30); });
  });
  const newBadges = [...earnedIds].filter(id => !seen.includes(id));
  if(newBadges.length > 0){
    const updated = [...seen, ...newBadges];
    lsSet(BADGE_SEEN, updated);
    setTimeout(()=> celebrateBadge(BADGES.find(b=>b.id===newBadges[0])), 800);
  }
}

function celebrateBadge(badge){
  if(!badge) return;
  const modal = $('#badge-modal');
  const body  = $('#badge-modal-body');
  if(!modal||!body) return;
  body.innerHTML = `
    <div class="badge-celebrate">
      <div class="bc-icon">${badge.icon}</div>
      <div class="bc-title">✦ INSIGNIA DESBLOQUEADA ✦</div>
      <div class="bc-name">${badge.name}</div>
      <div class="bc-desc">${badge.desc}</div>
      <div class="bc-xp">+${badge.xp} XP GANADOS</div>
    </div>`;
  modal.classList.add('show');
  document.body.style.overflow='hidden';
}

/* ======================================================
   RENDER MISSIONS
   ====================================================== */
function renderMissions(){
  const p       = getProfile();
  const enrolled= getEnrolled();
  const mState  = getMissions();
  const baselines = getBaselines();
  const horasAprendidas = getHorasAprendidas(enrolled);
  const currentXP      = p.xp || 0;
  const currentCursos  = enrolled.length;
  const currentAreas   = new Set(enrolled.map(c => c.area).filter(Boolean)).size;
  const currentLevel   = computeLevel(currentXP);
  const bDay   = baselines.daily   || { enrolledCount:0, xp:0, nivel:1, areas:0 };
  const bWeek  = baselines.weekly  || { enrolledCount:0, xp:0, nivel:1, areas:0 };
  const bMonth = baselines.monthly || { enrolledCount:0, xp:0, nivel:1, areas:0 };
  const secData = getSectionsToday();
  const sectionsCount = secData.sections.length;
  const activeDaysThisWeek = getActiveDaysThisWeek();
  const { dailySecs, weeklySecs, monthlySecs } = getSecsUntilReset();

  function computeProg(m, st) {
    if (st?.done) return m.max;
    let prog = st?.prog || 0;
    switch(m.id) {
      case 'd01': prog = 1; break;
      case 'd02': prog = Math.min(sectionsCount, m.max); break;
      case 'd03': prog = Math.min(Math.max(0, currentCursos - bDay.enrolledCount), m.max); break;
      case 'd04': prog = (p.racha || 0) >= 1 ? 1 : 0; break;
      case 'd05': prog = st?.prog || 0; break;
      case 'd06': prog = st?.prog || 0; break;
      case 'w01': prog = Math.min(Math.max(0, currentCursos - bWeek.enrolledCount), m.max); break;
      case 'w02': prog = Math.min(activeDaysThisWeek, m.max); break;
      case 'w03': prog = currentAreas >= 1 ? 1 : 0; break;
      case 'w04': prog = Math.min(Math.max(0, currentXP - bWeek.xp), m.max); break;
      case 'w05': prog = Math.min(currentCursos, m.max); break;
      case 'w06': prog = st?.prog || 0; break;
      case 'm01': prog = Math.min(Math.max(0, currentCursos - bMonth.enrolledCount), m.max); break;
      case 'm02': prog = Math.min(horasAprendidas, m.max); break;
      case 'm03': prog = Math.min(currentAreas, m.max); break;
      case 'm04': prog = Math.min(Math.max(0, currentXP - bMonth.xp), m.max); break;
      case 'm05': prog = Math.min(Math.max(0, currentLevel - bMonth.nivel), m.max); break;
    }
    return prog;
  }

  function renderGroup(defs, containerId, countdownId, countdownSecs, cdClass) {
    const el = $(containerId);
    if (!el) return;
    let cdWrap = document.getElementById(countdownId);
    if (!cdWrap) {
      const col = el.closest('.missions-col');
      if (col) {
        cdWrap = document.createElement('div');
        cdWrap.className = `mission-countdown ${cdClass}`;
        cdWrap.id = countdownId;
        col.insertBefore(cdWrap, el);
      }
    }
    if (cdWrap) {
      cdWrap.innerHTML = `<span class="cd-icon">⟳</span><span class="cd-label">RESET EN:</span><span class="cd-val" id="${countdownId}-val">${formatCountdown(countdownSecs)}</span>`;
    }
    el.innerHTML = defs.map(m => {
      const st   = mState[m.id];
      const prog = computeProg(m, st);
      const done = (st?.done) || prog >= m.max;
      const pct  = Math.min(100, (prog / m.max) * 100).toFixed(0);
      const canClaim = !st?.done && prog >= m.max;
      return `
      <div class="mission-item ${done ? 'done' : ''}" data-mid="${m.id}">
        <div class="mi-header">
          <span class="mi-name">${m.icon} ${m.name}</span>
          <span class="mi-xp">+${m.xp} XP</span>
        </div>
        <div class="mi-desc">${m.desc}</div>
        <div class="mi-progress">
          <div class="mi-progress-fill" style="width:${done ? 100 : pct}%"></div>
        </div>
        <div class="mi-foot">
          <span class="mi-count">${done ? m.max : prog}/${m.max}</span>
          ${done
            ? `<span class="mi-done-label">✓ COMPLETADA</span>`
            : canClaim
              ? `<button class="btn btn-complete" data-mid="${m.id}">⚡ RECLAMAR</button>`
              : prog > 0
                ? `<span class="mi-prog-label">${pct}% EN PROGRESO</span>`
                : ``
          }
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('.btn-complete').forEach(btn => {
      btn.addEventListener('click', () => completeMission(btn.dataset.mid));
    });
  }

  renderGroup(MISSION_DEF.daily,   '#mission-daily',   'cd-daily',   dailySecs,   'daily');
  renderGroup(MISSION_DEF.weekly,  '#mission-weekly',  'cd-weekly',  weeklySecs,  'weekly');
  renderGroup(MISSION_DEF.monthly, '#mission-monthly', 'cd-monthly', monthlySecs, 'monthly');
  startCountdowns();
}

function completeMission(mid){
  const all = [...MISSION_DEF.daily,...MISSION_DEF.weekly,...MISSION_DEF.monthly];
  const m = all.find(x=>x.id===mid); if(!m) return;
  const mState = getMissions();
  if(mState[mid]?.done) return;
  mState[mid] = { prog: m.max, done: true };
  lsSet(MISSION_KEY, mState);
  const p = getProfile();
  p.xp = (p.xp||0) + m.xp;
  lsSet(PROFILE_KEY, p);
  addTimelineEvent({ icon:'⚔️', title:`Misión completada: ${m.name}`, detail:`+${m.xp} XP ganados` });
  toast(`⚔️ MISIÓN COMPLETADA: +${m.xp} XP`, 'var(--yellow)');
  firebaseSaveMisiones(mState);
  firebaseSaveProfile({ xp: p.xp });
  renderMissions(); renderHeader(); renderResumen();
}

function completeMissionSilent(mid){
  const all = [...MISSION_DEF.daily,...MISSION_DEF.weekly,...MISSION_DEF.monthly];
  const m = all.find(x=>x.id===mid); if(!m) return;
  const mState = getMissions();
  if(mState[mid]?.done) return;
  mState[mid] = { prog: m.max, done: true };
  lsSet(MISSION_KEY, mState);
  const p = getProfile();
  p.xp = (p.xp||0) + m.xp;
  lsSet(PROFILE_KEY, p);
  addTimelineEvent({ icon: m.icon, title:`Misión: ${m.name}`, detail:`+${m.xp} XP` });
  firebaseSaveMisiones(mState).catch(()=>{});
  firebaseSaveProfile({ xp: p.xp }).catch(()=>{});
}

/* ---- Timeline ---- */
function addTimelineEvent(ev){
  const event = { ...ev, fecha: new Date().toISOString() };
  const events = getEvents();
  events.unshift(event);
  if(events.length > 50) events.pop();
  lsSet(EVENTS_KEY, events);
  firebaseSaveTimelineEvent(event);
}

function renderTimeline(){
  const events = getEvents();
  const tl     = $('#timeline');
  const empty  = $('#timeline-empty');
  if(!tl) return;
  if(!events.length){
    tl.style.display='none'; if(empty) empty.style.display='block'; return;
  }
  tl.style.display=''; if(empty) empty.style.display='none';
  tl.innerHTML = events.map((e,i)=>`
    <div class="tl-event">
      <div class="tl-icon-wrap">
        <div class="tl-icon">${e.icon||'📌'}</div>
        ${i < events.length-1 ? '<div class="tl-line"></div>' : ''}
      </div>
      <div class="tl-body">
        <div class="tl-title">${e.title}</div>
        ${e.detail?`<div class="tl-detail">${e.detail}</div>`:''}
        <div class="tl-time">${timeAgo(e.fecha)}</div>
      </div>
    </div>`).join('');
}

/* ======================================================
   ★ BUZÓN — renderBuzon con fechas DD-MM-YYYY y caducidad
   ====================================================== */
let buzonFilter = '';
function renderBuzon(){
  const state   = getBuzonState();
  let msgs = [...BUZON_MESSAGES];
  if(buzonFilter) msgs = msgs.filter(m => m.cat === buzonFilter);

  const unread = BUZON_MESSAGES.filter(m => !state[m.id] && !isBuzonExpired(m)).length;
  const countEl= $('#buzon-unread-count');
  if(countEl){
    countEl.textContent = unread || '';
    countEl.style.display = unread ? '' : 'none';
  }

  const tabBuzon = $('[data-tab="buzon"]');
  if(tabBuzon && unread > 0){
    tabBuzon.textContent = `📬 BUZÓN (${unread})`;
  } else if(tabBuzon){
    tabBuzon.textContent = `📬 BUZÓN`;
  }

  const list  = $('#buzon-list');
  const empty = $('#buzon-empty');
  if(!list) return;

  if(!msgs.length){
    list.innerHTML=''; if(empty) empty.style.display='block'; return;
  }
  if(empty) empty.style.display='none';

  list.innerHTML = msgs.map(m=>{
    const read    = !!state[m.id];
    const expired = isBuzonExpired(m);
    const expInfo = getBuzonExpireInfo(m);

    let expireBadge = '';
    if (expInfo) {
      if (expInfo.expired) {
        expireBadge = `<span class="bm-expire expired">💀 CADUCADO</span>`;
      } else if (expInfo.urgent) {
        expireBadge = `<span class="bm-expire urgent">⚡ ${expInfo.label}</span>`;
      } else {
        expireBadge = `<span class="bm-expire normal">⏳ ${expInfo.label}</span>`;
      }
    }

    return `
    <div class="buzon-msg ${read?'read':'unread'} ${expired?'buzon-expired':''}" data-bid="${m.id}">
      <span class="bm-icon">${m.icon}</span>
      <div class="bm-body">
        <div class="bm-header">
          <span class="bm-title">${m.title}</span>
          <span class="bm-cat ${m.cat}">${m.cat.toUpperCase()}</span>
          ${expireBadge}
        </div>
        <div class="bm-text">${m.text}</div>
        <div class="bm-footer">
          <div class="bm-time">📅 ${formatBuzonDate(m.fecha)}</div>
          ${expired ? '<div class="bm-expired-notice">Este mensaje ha caducado</div>' : ''}
        </div>
      </div>
      ${!read && !expired ? '<div class="bm-unread-dot"></div>' : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.buzon-msg:not(.buzon-expired)').forEach(el=>{
    el.addEventListener('click',()=> markBuzonRead(el.dataset.bid));
  });
}

function markBuzonRead(id){
  const state = getBuzonState();
  if(state[id]) return;
  state[id] = true;
  lsSet(BUZON_KEY, state);
  completeMissionSilent('d05');
  firebaseSaveBuzon(state);
  firebaseSaveMisiones(getMissions());
  renderBuzon(); renderMissions(); renderHeader();
  toast('📬 MENSAJE LEÍDO', 'var(--yellow)');
}

function markAllBuzonRead(){
  const state = getBuzonState();
  BUZON_MESSAGES.filter(m => !isBuzonExpired(m)).forEach(m=>{ state[m.id]=true; });
  lsSet(BUZON_KEY, state);
  completeMissionSilent('d05');
  completeMissionSilent('w06');
  firebaseSaveBuzon(state);
  firebaseSaveMisiones(getMissions());
  renderBuzon(); renderMissions(); renderHeader();
  toast('📭 TODOS LOS MENSAJES LEÍDOS', 'var(--green)');
}

/* ---- Tabs ---- */
function initTabs(){
  $$('.tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      $$('.tab').forEach(t=>t.classList.remove('active'));
      $$('.tab-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      const panel = $(`#tab-${tab.dataset.tab}`);
      if(panel) panel.classList.add('active');
      recordSectionVisit(tab.dataset.tab);
      switch(tab.dataset.tab){
        case 'insignias':       renderBadges();           break;
        case 'misiones':        renderMissions();         break;
        case 'actividad':       renderTimeline();         break;
        case 'cursos':          renderInventory();        break;
        case 'buzon':           renderBuzon();            break;
        case 'resumen':         renderResumen();          break;
        case 'calificaciones':  renderCalificaciones();   break;
      }
    });
  });
}

/* ---- Avatar ---- */
function initAvatar(){
  const btn   = $('#btn-change-avatar');
  const modal = $('#avatar-modal');
  const close = $('#avatar-modal-close');
  const picker= $('#avatar-picker');
  if(!btn||!modal||!picker) return;
  btn.addEventListener('click',()=>{
    const p2 = getProfile();
    picker.innerHTML = AVATARS.map(av=>`
      <div class="av-opt ${av===p2.avatar?'selected':''}" data-av="${av}">${av}</div>`).join('');
    picker.querySelectorAll('.av-opt').forEach(opt=>{
      opt.addEventListener('click',()=>{
        const p3 = getProfile();
        p3.avatar = opt.dataset.av;
        lsSet(PROFILE_KEY, p3);
        firebaseSaveProfile({ avatar: opt.dataset.av });
        modal.classList.remove('show');
        document.body.style.overflow='';
        renderHeader();
        toast(`🎨 AVATAR ACTUALIZADO: ${opt.dataset.av}`);
      });
    });
    modal.classList.add('show');
    document.body.style.overflow='hidden';
  });
  close?.addEventListener('click',()=>{ modal.classList.remove('show'); document.body.style.overflow=''; });
  modal.addEventListener('click', e=>{ if(e.target===modal){ modal.classList.remove('show'); document.body.style.overflow=''; }});
}

/* ---- Badge Modal ---- */
function initBadgeModal(){
  $('#badge-modal-close')?.addEventListener('click',()=>{
    $('#badge-modal')?.classList.remove('show');
    document.body.style.overflow='';
  });
  $('#badge-modal')?.addEventListener('click', e=>{
    if(e.target===$('#badge-modal')){ $('#badge-modal').classList.remove('show'); document.body.style.overflow=''; }
  });
}

function initBadgeFilter(){
  $$('.bf-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      $$('.bf-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      badgeCatFilter = btn.dataset.cat||'';
      renderBadges();
    });
  });
}

function initCourseFilters(){
  $('#curso-search')?.addEventListener('input',  ()=> renderInventory());
  $('#curso-filter-estado')?.addEventListener('change', ()=> renderInventory());
  $('#curso-filter-tipo')?.addEventListener('change',   ()=> renderInventory());
}

function initBuzonControls(){
  $('#btn-mark-all')?.addEventListener('click', markAllBuzonRead);
  $('#buzon-filter')?.addEventListener('change', e=>{
    buzonFilter = e.target.value;
    renderBuzon();
  });
}

function initTimelineClear(){
  $('#btn-clear-timeline')?.addEventListener('click',()=>{
    if(!confirm('¿Borrar todo el historial de actividad?')) return;
    lsSet(EVENTS_KEY, []);
    renderTimeline();
    toast('🗑 HISTORIAL BORRADO', 'var(--red)');
  });
}

function initNav(){
  const ham = $('#hamburger');
  const nav = $('#main-nav');
  if(ham&&nav) ham.addEventListener('click',()=> nav.classList.toggle('open'));
}

function initLogout(){
  $('#btn-logout')?.addEventListener('click',()=>{
    if(confirm('¿Cerrar sesión?')){
      localStorage.removeItem(PROFILE_KEY);
      window.location.href = 'index.html';
    }
  });
}

function initBackToTop(){
  const btn = $('#back-top');
  if(!btn) return;
  window.addEventListener('scroll',()=> btn.classList.toggle('show', window.scrollY>400));
  btn.addEventListener('click',()=> window.scrollTo({top:0,behavior:'smooth'}));
}

/* ---- Record Visit ---- */
function recordVisit(){
  updateRacha();
  recordActiveDay();
  const mState = getMissions();
  if (!mState.d01?.done) completeMissionSilent('d01');
  const p = getProfile();
  if (!mState.d04?.done && (p.racha || 0) >= 1) completeMissionSilent('d04');
  const events = getEvents();
  const today  = new Date().toDateString();
  if(!events.some(e => new Date(e.fecha).toDateString()===today && e.id==='visit')){
    addTimelineEvent({ id:'visit', icon:'👤', title:'Visitaste tu perfil', detail:'Hoy' });
  }
  recordSectionVisit('resumen');
}

/* ======================================================
   INIT PRINCIPAL CON FIREBASE AUTH
   ====================================================== */
document.addEventListener('DOMContentLoaded', ()=>{
  hideLoader();
  initStars();
  initNav();
  initTabs();
  initAvatar();
  initBadgeModal();
  initBadgeFilter();
  initCourseFilters();
  initBuzonControls();
  initTimelineClear();
  initLogout();
  initBackToTop();
  initCalifFilters();
  /* ★ NUEVO: Inicializar edición de nombre */
  initNameEdit();

  checkMissionResets();
  startPlatformTimer();

  let firstLoad = true;

  onAuthChange(async (user) => {
    if(!user) { window.location.href = 'index.html'; return; }
    currentUID = user.uid;
    if(firstLoad) {
      firstLoad = false;
      showSyncIndicator('⟳ CARGANDO TU PROGRESO...');
      try {
        await syncAllToLocalStorage(user.uid);
        hideSyncIndicator();
        toast('✓ PROGRESO SINCRONIZADO', 'var(--green)');
      } catch(err) {
        hideSyncIndicator();
        console.warn('[Perfil] Error de sincronización:', err);
      }
      checkMissionResets();
      renderHeader();
      renderResumen();
      renderBuzon();
      recordVisit();
      const activeTab = document.querySelector('.tab.active');
      if(activeTab) {
        switch(activeTab.dataset.tab){
          case 'insignias':       renderBadges();          break;
          case 'misiones':        renderMissions();        break;
          case 'actividad':       renderTimeline();        break;
          case 'cursos':          renderInventory();       break;
          case 'calificaciones':  renderCalificaciones();  break;
        }
      }
    }
  });
});