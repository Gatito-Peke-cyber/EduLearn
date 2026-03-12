/* =====================================================
   EduLearn — Secundaria JS v8.0 — Firebase Sync
   Fix: cola pendiente + re-sync completo al autenticar
   ===================================================== */
'use strict';

import { onAuthChange } from './auth.js';
import {
  enrollCourse     as dbEnrollCourse,
  updateExamResult as dbUpdateExamResult,
  addXP            as dbAddXP,
} from './database.js';

/* ── UID del usuario activo ── */
let currentUID = null;

/* ── Cola de syncs pendientes (auth aún no había cargado) ── */
const _pendingQueue = [];

function queueOrSync(asyncFn) {
  if (currentUID) {
    asyncFn().catch(e => console.warn('[FB]', e));
  } else {
    _pendingQueue.push(asyncFn);
  }
}

async function _flushQueue() {
  while (_pendingQueue.length) {
    try { await _pendingQueue.shift()(); } catch (e) { console.warn('[FB flush]', e); }
  }
}

/* Re-sube a Firestore todos los inscripciones guardados en localStorage */
async function _syncAllLocalEnrollments() {
  const list = getEnrolls();
  for (const e of list) {
    try {
      await dbEnrollCourse(currentUID, {
        id:         String(e.id),
        nombre:     e.nombre     || '',
        area:       e.area       || '',
        tipo:       e.tipo       || 'permanente',
        horas:      e.horas      || 0,
        img:        e.img        || '',
        link:       e.link       || '#',
        grado:      e.grado      || null,
        estado:     e.estado     || 'en_progreso',
        inscritoEl: e.inscritoEl || new Date().toISOString(),
      });
    } catch (err) { console.warn('[FB re-sync]', err); }
  }
}

/* ===== LOADER ===== */
window.addEventListener('load', () => {
  const ld = document.getElementById('ldFill');
  let pct = 0;
  const t = setInterval(() => {
    pct = Math.min(100, pct + 20);
    if (ld) ld.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(t);
      setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
      }, 200);
    }
  }, 80);
});

/* ===== STARS ===== */
function createStars() {
  const c = document.getElementById('pixelStars');
  if (!c) return;
  const colors = ['#FFE000','#00F8FF','#FF00AA','#39FF14','#AA00FF','#FF8C00','#ffffff'];
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('span');
    const size = 1 + Math.random() * 2;
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};opacity:${0.15+Math.random()*0.5};animation:blink ${1+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*4}s;`;
    c.appendChild(s);
  }
}
createStars();

/* ===== NAV BURGER ===== */
const burger = document.getElementById('burger');
const nav    = document.getElementById('mainNav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const e = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!e));
    nav.classList.toggle('open');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    burger.setAttribute('aria-expanded','false');
    nav.classList.remove('open');
  }));
}

/* ===== REVEAL ===== */
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
}), { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ===== BACK TO TOP ===== */
const back = document.getElementById('backToTop');
if (back) {
  window.addEventListener('scroll', () => back.classList.toggle('show', window.scrollY > 400));
  back.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ===== TOAST ===== */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = 'ok') {
  if (!toastEl) return;
  const colors = { ok: '#39FF14', warn: '#FFE000', bad: '#FF3030' };
  toastEl.textContent = msg;
  toastEl.style.borderColor = colors[type] || colors.ok;
  toastEl.style.color       = colors[type] || colors.ok;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

/* ===== FORMAT DATE ===== */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

/* ===== COUNTDOWN ===== */
function getTempStatus(temp) {
  const now = Date.now();
  if (now < new Date(temp.inicio).getTime()) return 'not_started';
  if (now > new Date(temp.fin).getTime())    return 'expired';
  return 'active';
}
function buildCountdown(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00d 00h 00m 00s';
  const s = Math.floor(diff / 1000);
  const pad = n => String(n).padStart(2,'0');
  return `${pad(Math.floor(s/86400))}d ${pad(Math.floor((s%86400)/3600))}h ${pad(Math.floor((s%3600)/60))}m ${pad(s%60)}s`;
}

/* ===== COURSES ===== */
const CURSOS = [
  {id:1,  nombre:"Matemáticas I: Aritmética y Fracciones",        area:"ciencias",   grado:1, duracionHoras:24, popularidad:96, img:"https://images.pexels.com/photos/414579/pexels-photo-414579.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"M. Sánchez", fecha:"2025-04-01", etiquetas:["números","fracciones","aritmética"],   descripcion:"Domina operaciones básicas, fracciones y problemas cotidianos.",          link:"matematica1.html"},
  {id:2,  nombre:"Comunicación I: Comprensión Lectora",           area:"letras",     grado:1, duracionHoras:18, popularidad:91, img:"https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"L. Pérez",   fecha:"2025-03-25", etiquetas:["lectura","comprensión","texto"],          descripcion:"Identifica ideas principales, inferencias y propósito del autor.",        link:"comunicacion1.html"},
  {id:3,  nombre:"Inglés I: Fundamentos A1",                      area:"idiomas",    grado:1, duracionHoras:22, popularidad:88, img:"https://images.pexels.com/photos/4145190/pexels-photo-4145190.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"J. Collins", fecha:"2025-02-18", etiquetas:["vocabulario","gramática","listening"],     descripcion:"Present simple, vocabulario esencial y frases del día a día.",             link:"ingles.html"},
  {id:4,  nombre:"Ciencias Naturales: Vida y Ecosistemas",        area:"ciencias",   grado:1, duracionHoras:20, popularidad:84, img:"https://images.pexels.com/photos/2280555/pexels-photo-2280555.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"R. Medina",  fecha:"2025-04-12", etiquetas:["biología","ecosistemas"],                  descripcion:"Explora ecosistemas, cadenas alimenticias y biodiversidad.",               link:"ciencias1.html"},
  {id:5,  nombre:"Matemáticas II: Álgebra Inicial",               area:"ciencias",   grado:2, duracionHoras:28, popularidad:94, img:"https://images.pexels.com/photos/1181359/pexels-photo-1181359.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"M. Sánchez", fecha:"2025-04-22", etiquetas:["álgebra","ecuaciones"],                    descripcion:"Expresiones algebraicas, ecuaciones lineales y resolución.",               link:"matematica2.html"},
  {id:6,  nombre:"Comunicación II: Redacción y Ortografía",       area:"letras",     grado:2, duracionHoras:20, popularidad:86, img:"https://images.pexels.com/photos/6324703/pexels-photo-6324703.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"L. Pérez",   fecha:"2025-04-10", etiquetas:["redacción","ortografía"],                  descripcion:"Puntuación, coherencia y cohesión en textos.",                             link:"comunicacion2.html"},
  {id:7,  nombre:"Inglés II: Gramática y Conversación",           area:"idiomas",    grado:2, duracionHoras:24, popularidad:90, img:"https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"J. Collins", fecha:"2025-03-20", etiquetas:["speaking","tenses"],                       descripcion:"Pasado simple, preguntas y conversaciones guiadas.",                       link:"ingles2.html"},
  {id:8,  nombre:"Historia: Culturas Antiguas",                   area:"letras",     grado:2, duracionHoras:18, popularidad:83, img:"https://images.pexels.com/photos/235985/pexels-photo-235985.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"C. Torres",  fecha:"2025-02-28", etiquetas:["historia","civilizaciones"],               descripcion:"Egipto, Mesopotamia y Grecia: sociedad, cultura y legado.",                link:"historia1.html"},
  {id:9,  nombre:"Química I: Materia y Mezclas",                  area:"ciencias",   grado:3, duracionHoras:26, popularidad:89, img:"https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"A. Huamán",  fecha:"2025-04-18", etiquetas:["química","experimentos"],                  descripcion:"Estados de la materia, propiedades y separación de mezclas.",              link:"quimica1.html"},
  {id:10, nombre:"Física I: Movimiento y Fuerzas",                area:"ciencias",   grado:3, duracionHoras:24, popularidad:92, img:"https://images.pexels.com/photos/256417/pexels-photo-256417.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"P. Salazar", fecha:"2025-04-15", etiquetas:["física","cinemática"],                     descripcion:"Velocidad, aceleración y leyes de Newton.",                                link:"fisica1.html"},
  {id:11, nombre:"Literatura: Narrativa y Poesía",                area:"letras",     grado:3, duracionHoras:22, popularidad:85, img:"https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"V. Lozano",  fecha:"2025-01-30", etiquetas:["literatura","poesía"],                     descripcion:"Géneros narrativos, figuras literarias y análisis.",                       link:"literatura1.html"},
  {id:12, nombre:"Inglés III: Proyectos y Presentaciones",        area:"idiomas",    grado:3, duracionHoras:25, popularidad:87, img:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"J. Collins", fecha:"2025-04-03", etiquetas:["presentations","listening"],               descripcion:"Organiza ideas y presenta con seguridad.",                                 link:"ingles3.html"},
  {id:13, nombre:"Matemáticas III: Geometría y Trigonometría",    area:"ciencias",   grado:4, duracionHoras:30, popularidad:95, img:"https://images.pexels.com/photos/159844/mathematics-blackboard-education-learn-159844.jpeg?auto=compress&cs=tinysrgb&w=800", profesor:"M. Sánchez", fecha:"2025-04-22", etiquetas:["geometría","trigonometría"],  descripcion:"Ángulos, triángulos y razones trigonométricas.",                           link:"matematicas3.html"},
  {id:14, nombre:"Química II: Estructura Atómica",                area:"ciencias",   grado:4, duracionHoras:28, popularidad:90, img:"https://images.pexels.com/photos/356040/pexels-photo-356040.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"A. Huamán",  fecha:"2025-04-05", etiquetas:["átomo","tabla periódica"],                descripcion:"Modelo atómico, configuración electrónica y tendencias.",                  link:"quimica2.html"},
  {id:15, nombre:"Historia Universal: Edad Media",                area:"letras",     grado:4, duracionHoras:20, popularidad:82, img:"https://images.pexels.com/photos/280586/pexels-photo-280586.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"C. Torres",  fecha:"2025-03-10", etiquetas:["historia","edad media"],                  descripcion:"Economía feudal, cultura y transformaciones sociales.",                    link:"historia2.html"},
  {id:16, nombre:"Inglés IV: B2 Skills",                          area:"idiomas",    grado:4, duracionHoras:26, popularidad:89, img:"https://images.pexels.com/photos/4145195/pexels-photo-4145195.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"J. Collins", fecha:"2025-04-20", etiquetas:["B2","speaking","writing"],                 descripcion:"Reading, writing, use of English y speaking.",                             link:"ingles4.html"},
  {id:17, nombre:"Tecnología: Fundamentos de Programación",       area:"tecnologia", grado:4, duracionHoras:24, popularidad:97, img:"https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"S. Flores",  fecha:"2025-04-24", etiquetas:["algoritmos","javascript"],                 descripcion:"Lógica, estructuras de control y retos prácticos.",                        link:"tecnologia1.html"},
  {id:18, nombre:"Arte: Dibujo y Composición",                    area:"arte",       grado:3, duracionHoras:18, popularidad:80, img:"https://images.pexels.com/photos/4144222/pexels-photo-4144222.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"N. Ramos",   fecha:"2025-02-12", etiquetas:["dibujo","colores"],                        descripcion:"Técnicas básicas, sombras y composición.",                                 link:"arte1.html"},
  {id:19, nombre:"Física II: Energía y Trabajo",                  area:"ciencias",   grado:4, duracionHoras:26, popularidad:90, img:"https://images.pexels.com/photos/1571178/pexels-photo-1571178.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"P. Salazar", fecha:"2025-04-02", etiquetas:["energía","trabajo","potencia"],            descripcion:"Energía cinética, potencial y conservación.",                              link:"fisica2.html"},
  {id:20, nombre:"Matemáticas V: Pre-Cálculo",                    area:"ciencias",   grado:5, duracionHoras:36, popularidad:98, img:"https://images.pexels.com/photos/256417/pexels-photo-256417.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"M. Sánchez", fecha:"2025-04-27", etiquetas:["funciones","límites"],                     descripcion:"Funciones, transformaciones, límites y pre-cálculo.",                      link:"matematica5.html"},
  {id:21, nombre:"Comunicación V: Ensayo y Argumentación",        area:"letras",     grado:5, duracionHoras:22, popularidad:88, img:"https://images.pexels.com/photos/261909/pexels-photo-261909.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"V. Lozano",  fecha:"2025-03-29", etiquetas:["ensayo","argumentación"],                  descripcion:"Tesis, argumentos sólidos y conclusiones.",                                link:"comunicacion5.html"},
  {id:22, nombre:"Química III: Reacciones y Estequiometría",      area:"ciencias",   grado:5, duracionHoras:32, popularidad:93, img:"https://images.pexels.com/photos/945134/pexels-photo-945134.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"A. Huamán",  fecha:"2025-04-17", etiquetas:["reacciones","moles"],                      descripcion:"Balanceo, tipos de reacciones y cálculos.",                                link:"quimica3.html"},
  {id:23, nombre:"Física III: Electricidad y Magnetismo",         area:"ciencias",   grado:5, duracionHoras:34, popularidad:94, img:"https://images.pexels.com/photos/356040/pexels-photo-356040.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"P. Salazar", fecha:"2025-04-19", etiquetas:["electricidad","magnetismo"],               descripcion:"Corriente, resistencia, circuitos y campo magnético.",                     link:"fisica3.html"},
  {id:24, nombre:"Inglés V: Preparación Examen Internacional",    area:"idiomas",    grado:5, duracionHoras:30, popularidad:92, img:"https://images.pexels.com/photos/3184296/pexels-photo-3184296.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"J. Collins", fecha:"2025-04-26", etiquetas:["examen","reading","listening"],             descripcion:"Simulacros y técnicas intensivas de examen.",                              link:"ingles5.html"},
  {id:25, nombre:"Tecnología II: Desarrollo Web",                 area:"tecnologia", grado:5, duracionHoras:28, popularidad:97, img:"https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"S. Flores",  fecha:"2025-04-21", etiquetas:["html","css","js"],                         descripcion:"Maquetación, estilos modernos y JS interactivo.",                          link:"tecnologia2.html"},
  {id:26, nombre:"Filosofía: Ética y Lógica",                     area:"letras",     grado:5, duracionHoras:20, popularidad:84, img:"https://images.pexels.com/photos/261577/pexels-photo-261577.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"C. Torres",  fecha:"2025-03-02", etiquetas:["ética","lógica"],                          descripcion:"Argumentación, falacias y pensamiento crítico.",                           link:"filosofia1.html"},
  {id:27, nombre:"Geografía: Planeta y Sociedad",                 area:"letras",     grado:4, duracionHoras:18, popularidad:83, img:"https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"C. Torres",  fecha:"2025-02-20", etiquetas:["geografía","mapas"],                       descripcion:"Relieve, clima y población con mapas y datos.",                            link:"geografia1.html"},
  {id:28, nombre:"Biología: Genética Básica",                     area:"ciencias",   grado:5, duracionHoras:24, popularidad:91, img:"https://images.pexels.com/photos/355948/pexels-photo-355948.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"R. Medina",  fecha:"2025-04-08", etiquetas:["genética","ADN"],                          descripcion:"Genes, alelos, herencia y cruces.",                                        link:"biologia1.html"},
  {id:29, nombre:"Arte II: Fotografía Creativa",                  area:"arte",       grado:4, duracionHoras:16, popularidad:82, img:"https://images.pexels.com/photos/164716/pexels-photo-164716.jpeg?auto=compress&cs=tinysrgb&w=800",           profesor:"N. Ramos",   fecha:"2025-03-18", etiquetas:["fotografía","composición"],               descripcion:"Encuadre, luz y edición básica.",                                          link:"arte2.html"},
  {id:30, nombre:"Tecnología III: Pensamiento Computacional",     area:"tecnologia", grado:3, duracionHoras:20, popularidad:90, img:"https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800",         profesor:"S. Flores",  fecha:"2025-03-26", etiquetas:["lógica","problemas"],                      descripcion:"Descomposición, patrones y algoritmos.",                                   link:"tecnologia3.html"},
];

const TEMPORALES = [
  { id:"T1", nombre:"Taller Intensivo: Álgebra para Exámenes", area:"ciencias",   img:"https://images.pexels.com/photos/159844/mathematics-blackboard-education-learn-159844.jpeg?auto=compress&cs=tinysrgb&w=800", inicio:"2026-03-10T00:00:00", fin:"2026-03-25T23:59:59", descripcion:"Refuerza ecuaciones, sistemas y problemas de examen en 2 semanas.", link:"ingles.html" },
  { id:"T2", nombre:"Writing Bootcamp (B1-B2)",                area:"idiomas",    img:"https://images.pexels.com/photos/261909/pexels-photo-261909.jpeg?auto=compress&cs=tinysrgb&w=800",                           inicio:"2026-03-09T08:00:00", fin:"2026-03-16T23:59:59", descripcion:"Ensayos, emails formales e informes. Feedback personalizado.",         link:"ingles.html" },
  { id:"T3", nombre:"Física Express: MRU y MRUV",              area:"ciencias",   img:"https://images.pexels.com/photos/256417/pexels-photo-256417.jpeg?auto=compress&cs=tinysrgb&w=800",                           inicio:"2026-03-09T00:00:00", fin:"2026-03-11T23:59:59", descripcion:"Repaso intensivo con ejercicios y simulaciones.",                      link:"ingles.html" },
  { id:"T4", nombre:"Taller de Debate y Oratoria",             area:"letras",     img:"https://images.pexels.com/photos/3184296/pexels-photo-3184296.jpeg?auto=compress&cs=tinysrgb&w=800",                         inicio:"2026-02-20T00:00:00", fin:"2026-03-01T23:59:59", descripcion:"Técnicas de argumentación y presentación oral.",                       link:"ingles.html" },
  { id:"T5", nombre:"Programación con Python — Básico",        area:"tecnologia", img:"https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800",                         inicio:"2026-02-28T00:00:00", fin:"2026-03-05T23:59:59", descripcion:"Intro a Python: variables, bucles y funciones.",                       link:"ingles.html" },
];

/* ===== STORAGE ===== */
const PROFILE_KEY = 'perfil_usuario';
const ENROLL_KEY  = 'inscripciones';
const FAV_KEY     = 'secundaria_favoritos';

function getProfile() {
  try {
    let p = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!p) { p = { name:'Estudiante', joinDate:new Date().toISOString(), xp:0, avatarUrl:'' }; localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
    return p;
  } catch { return {}; }
}
function getEnrolls()         { try { return JSON.parse(localStorage.getItem(ENROLL_KEY)) || []; } catch { return []; } }
function saveEnrolls(arr)     { localStorage.setItem(ENROLL_KEY, JSON.stringify(arr)); }
function getFavs()            { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } }
function saveFavs(arr)        { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }
function toggleFav(id)        { const f = getFavs(); saveFavs(f.includes(id) ? f.filter(x=>x!==id) : [...f,id]); }
function isEnrolledCourse(id) { return getEnrolls().some(c => c.id === id && c.tipo === 'permanente'); }
function isEnrolledTemp(id)   { return getEnrolls().some(c => c.id === id && c.tipo === 'temporal'); }

/* ===== ENROLL ===== */
function enrollCourse(course) {
  const list = getEnrolls();
  if (list.some(x => x.id === course.id && x.tipo === 'permanente')) return false;

  const inscritoEl = new Date().toISOString();
  const obj = { tipo:'permanente', id:course.id, nombre:course.nombre, area:course.area, grado:course.grado,
    horas:course.duracionHoras, img:course.img, inscritoEl, estado:'en_progreso', link:course.link };
  list.push(obj);
  saveEnrolls(list);

  const xpGain = Math.round((course.duracionHoras || 0) * 8);
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}'); p.xp=(p.xp||0)+xpGain; localStorage.setItem(PROFILE_KEY,JSON.stringify(p)); } catch(_){}

  queueOrSync(() => dbEnrollCourse(currentUID, {
    id:String(course.id), nombre:course.nombre, area:course.area||'', tipo:'permanente',
    horas:course.duracionHoras||0, img:course.img||'', link:course.link||'#',
    grado:course.grado||null, estado:'en_progreso', inscritoEl,
  }));
  queueOrSync(() => dbAddXP(currentUID, xpGain));
  return true;
}

function enrollTemporal(temp) {
  if (getTempStatus(temp) !== 'active') return false;
  const list = getEnrolls();
  if (list.some(x => x.id === temp.id && x.tipo === 'temporal')) return false;

  const inscritoEl = new Date().toISOString();
  const obj = { tipo:'temporal', id:temp.id, nombre:temp.nombre, area:temp.area, horas:0,
    img:temp.img, inscritoEl, estado:'en_progreso', inicio:temp.inicio, fin:temp.fin, link:temp.link };
  list.push(obj);
  saveEnrolls(list);

  queueOrSync(() => dbEnrollCourse(currentUID, {
    id:String(temp.id), nombre:temp.nombre, area:temp.area||'', tipo:'temporal',
    horas:0, img:temp.img||'', link:temp.link||'#', grado:null, estado:'en_progreso', inscritoEl,
  }));
  return true;
}

/* ===== STATE ===== */
let state = { page:1, perPage:12, search:'', area:'todas', grado:'todos', orden:'relevancia', favoritosOnly:false };

function applyFilters(data) {
  let res = [...data];
  if (state.favoritosOnly) { const f=getFavs(); res=res.filter(c=>f.includes(c.id)); }
  if (state.search.trim()) { const q=state.search.toLowerCase(); res=res.filter(c=>c.nombre.toLowerCase().includes(q)||c.profesor.toLowerCase().includes(q)||(c.etiquetas||[]).some(e=>e.toLowerCase().includes(q))); }
  if (state.area!=='todas')  res=res.filter(c=>c.area===state.area);
  if (state.grado!=='todos') res=res.filter(c=>String(c.grado)===state.grado);
  switch(state.orden){
    case 'nombre-asc':  res.sort((a,b)=>a.nombre.localeCompare(b.nombre)); break;
    case 'nombre-desc': res.sort((a,b)=>b.nombre.localeCompare(a.nombre)); break;
    case 'nuevos':      res.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); break;
    case 'populares':   res.sort((a,b)=>b.popularidad-a.popularidad); break;
    case 'duracion':    res.sort((a,b)=>a.duracionHoras-b.duracionHoras); break;
    default:            res.sort((a,b)=>(b.popularidad+b.duracionHoras/100)-(a.popularidad+a.duracionHoras/100));
  }
  return res;
}

const AREA_CLASSES = { ciencias:'area-ciencias', letras:'area-letras', idiomas:'area-idiomas', tecnologia:'area-tecnologia', arte:'area-arte' };
const AREA_ICONS   = { ciencias:'⚗', letras:'📖', idiomas:'🌍', tecnologia:'💻', arte:'🎨' };

function courseCard(c) {
  const favs=getFavs(), fav=favs.includes(c.id), enrolled=isEnrolledCourse(c.id);
  const ribbon=c.popularidad>=95?`<div class="ribbon">★ TOP</div>`:'';
  const xp=Math.round(c.duracionHoras*8);
  return `
  <article class="card reveal" data-id="${c.id}">
    ${ribbon}
    <button class="fav ${fav?'active':''}" data-fav="${c.id}" aria-label="Favorito">♥</button>
    <div class="card-img-wrap">
      <img src="${c.img}" alt="${c.nombre}" loading="lazy">
      <div class="card-img-overlay"></div>
      <div class="card-area-badge ${AREA_CLASSES[c.area]||''}">${AREA_ICONS[c.area]||'📚'} ${c.area.toUpperCase()}</div>
    </div>
    <div class="card-body">
      <div class="card-grade">GRADO ${c.grado}° · ${c.profesor.toUpperCase()}</div>
      <div class="card-name">${c.nombre}</div>
      <div class="card-desc">${c.descripcion}</div>
      <div class="card-meta">
        <span><i class="fa-regular fa-clock"></i>${c.duracionHoras}H</span>
        <span><i class="fa-solid fa-fire"></i>${c.popularidad}</span>
        <span><i class="fa-solid fa-star"></i>+${xp} XP</span>
      </div>
      <div class="card-xp-bar"><div class="card-xp-fill" style="width:${enrolled?100:0}%"></div></div>
      <div class="card-foot">
        <div class="enroll-state ${enrolled?'enrolled':'not-enrolled'}">${enrolled?'✓ INSCRITO':''}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-view" data-open="${c.id}">👁 VER</button>
          <button class="btn btn-enroll ${enrolled?'enrolled':''}" data-enroll="${c.id}" ${enrolled?'disabled':''}>
            ${enrolled?'✓ INSCRITO':'▶ EMPEZAR'}
          </button>
        </div>
      </div>
    </div>
  </article>`;
}

function renderCourses() {
  const filtered=applyFilters(CURSOS), totalPages=Math.max(1,Math.ceil(filtered.length/state.perPage));
  state.page=Math.min(state.page,totalPages);
  const slice=filtered.slice((state.page-1)*state.perPage, state.page*state.perPage);
  const grid=document.getElementById('coursesGrid'); if(!grid) return;

  grid.innerHTML = slice.length
    ? slice.map(courseCard).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:40px;font-family:var(--font-pixel);font-size:0.6rem;color:var(--px-muted);">[ SIN RESULTADOS ]<br><br><a href="#" onclick="resetFilters()" style="color:var(--px-cyan)">LIMPIAR FILTROS</a></div>`;

  const prevBtn=document.getElementById('prevPage'), nextBtn=document.getElementById('nextPage');
  if(prevBtn) prevBtn.disabled=state.page===1;
  if(nextBtn) nextBtn.disabled=state.page===totalPages;

  const pageList=document.getElementById('pageList');
  if(pageList){
    pageList.innerHTML='';
    for(let i=1;i<=totalPages;i++){
      const li=document.createElement('li'), btn=document.createElement('button');
      btn.textContent=String(i); if(i===state.page) btn.classList.add('active');
      btn.addEventListener('click',()=>{state.page=i;renderCourses();observeReveal();}); li.appendChild(btn); pageList.appendChild(li);
    }
  }
  grid.querySelectorAll('[data-fav]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();toggleFav(Number(btn.dataset.fav));btn.classList.toggle('active');}));
  grid.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openModal(CURSOS.find(c=>c.id===Number(btn.dataset.open)));}));
  grid.querySelectorAll('[data-enroll]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation(); if(btn.disabled) return;
    const course=CURSOS.find(c=>c.id===Number(btn.dataset.enroll));
    if(enrollCourse(course)){
      showToast('▶ ¡INSCRITO! Revisa tu perfil.','ok');
      btn.textContent='✓ INSCRITO'; btn.classList.add('enrolled'); btn.disabled=true;
      const card=btn.closest('.card');
      if(card){ const es=card.querySelector('.enroll-state'),fill=card.querySelector('.card-xp-fill');
        if(es){es.textContent='✓ INSCRITO';es.className='enroll-state enrolled';} if(fill) fill.style.width='100%'; }
    } else showToast('YA ESTABAS INSCRITO 😉','warn');
  }));
  observeReveal();
}

/* ===== TEMPORALES ===== */
let tempIntervals=[];
function renderTemporales(){
  tempIntervals.forEach(id=>clearInterval(id)); tempIntervals=[];
  const grid=document.getElementById('tempGrid'); if(!grid) return;
  grid.innerHTML=TEMPORALES.map(t=>{
    const status=getTempStatus(t), enrolled=isEnrolledTemp(t.id);
    const badgeTxt=status==='expired'?'CADUCADO':status==='active'?'⚡ ACTIVO':'🔒 PRÓXIMO';
    const badgeCls=status==='expired'?'badge-expired':status==='active'?'badge-active':'badge-soon';
    let actionBtn;
    if(status==='expired')     actionBtn=`<span class="temp-status-badge badge-expired-txt">✗ CADUCÓ</span>`;
    else if(status==='not_started') actionBtn=`<span class="temp-status-badge badge-soon-txt">🔒 AÚN NO ABRE</span>`;
    else if(enrolled)          actionBtn=`<span class="temp-enrolled-badge">✓ INSCRITO</span>`;
    else                       actionBtn=`<button class="btn btn-enroll" data-enroll-temp="${t.id}" style="font-size:0.4rem;padding:7px 10px;">▶ INSCRIBIRSE</button>`;
    const label=status==='not_started'?'ABRE EN:':status==='active'?'CIERRA EN:':'';
    return `
    <article class="temp-card ${status!=='active'?'expired':''}" data-temp="${t.id}">
      <div class="temp-badge ${badgeCls}">${badgeTxt}</div>
      <div class="temp-card-img"><img src="${t.img}" alt="${t.nombre}" loading="lazy"></div>
      <div class="temp-body">
        <div class="temp-name">${t.nombre}</div>
        <div class="temp-desc">${t.descripcion}</div>
        <div class="temp-dates">
          <span class="temp-date-item">📅 INICIO: <strong>${fmtDate(t.inicio)}</strong></span>
          <span class="temp-date-item">🏁 FIN: <strong>${fmtDate(t.fin)}</strong></span>
        </div>
        <div class="temp-foot">
          <div class="countdown-wrap">
            ${status!=='expired'
              ?`<span class="countdown-label">${label}</span><span class="countdown" id="cd-${t.id}">${status==='not_started'?buildCountdown(t.inicio):buildCountdown(t.fin)}</span>`
              :`<span class="countdown expired-text">VENCIÓ: ${fmtDate(t.fin)}</span>`}
          </div>
          <div class="temp-enroll-wrap">${actionBtn}</div>
        </div>
      </div>
    </article>`;
  }).join('');
  TEMPORALES.forEach(t=>{
    const el=document.getElementById(`cd-${t.id}`); if(!el) return;
    const status=getTempStatus(t); if(status==='expired') return;
    const targetIso=status==='not_started'?t.inicio:t.fin;
    const ivId=setInterval(()=>{
      const ns=getTempStatus(t);
      if(ns==='expired'||(status==='not_started'&&ns==='active')){clearInterval(ivId);renderTemporales();return;}
      const cdEl=document.getElementById(`cd-${t.id}`); if(cdEl) cdEl.textContent=buildCountdown(targetIso);
    },1000);
    tempIntervals.push(ivId);
  });
  grid.querySelectorAll('[data-enroll-temp]').forEach(btn=>btn.addEventListener('click',()=>{
    const temp=TEMPORALES.find(t=>t.id===btn.dataset.enrollTemp), st=getTempStatus(temp);
    if(st==='expired'){showToast('⚠ ESTE CURSO YA CADUCÓ','bad');return;}
    if(st==='not_started'){showToast('⚠ ESTE CURSO AÚN NO HA ABIERTO','warn');return;}
    if(enrollTemporal(temp)){showToast('⚡ ¡INSCRITO EN TALLER!','ok');btn.parentElement.innerHTML=`<span class="temp-enrolled-badge">✓ INSCRITO</span>`;}
    else showToast('YA ESTABAS INSCRITO 😉','warn');
  }));
}

/* ===== FILTER CONTROLS ===== */
function resetFilters(){
  state={page:1,perPage:12,search:'',area:'todas',grado:'todos',orden:'relevancia',favoritosOnly:false};
  const s=document.getElementById('searchInput'),a=document.getElementById('areaFilter'),
        g=document.getElementById('gradoFilter'),o=document.getElementById('ordenSelect'),bf=document.getElementById('btnFavoritos');
  if(s)s.value='';if(a)a.value='todas';if(g)g.value='todos';if(o)o.value='relevancia';if(bf)bf.classList.remove('active');
  renderCourses();
}
document.getElementById('searchInput')?.addEventListener('input', e=>{state.search=e.target.value;state.page=1;renderCourses();});
document.getElementById('areaFilter')?.addEventListener('change', e=>{state.area=e.target.value;state.page=1;renderCourses();});
document.getElementById('gradoFilter')?.addEventListener('change',e=>{state.grado=e.target.value;state.page=1;renderCourses();});
document.getElementById('ordenSelect')?.addEventListener('change',e=>{state.orden=e.target.value;renderCourses();});
document.getElementById('btnReset')?.addEventListener('click',resetFilters);
document.getElementById('btnFavoritos')?.addEventListener('click',()=>{
  state.favoritosOnly=!state.favoritosOnly;
  document.getElementById('btnFavoritos').classList.toggle('active',state.favoritosOnly);
  state.page=1;renderCourses();
});
document.getElementById('prevPage')?.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderCourses();});
document.getElementById('nextPage')?.addEventListener('click',()=>{
  const f=applyFilters(CURSOS); state.page=Math.min(Math.max(1,Math.ceil(f.length/state.perPage)),state.page+1); renderCourses();
});

/* ===== MODAL ===== */
const modal=document.getElementById('courseModal'), modalBody=modal?.querySelector('.modal-body'), modalClose=modal?.querySelector('.modal-close');

function openModal(course){
  if(!modal||!modalBody||!course) return;
  const enrolled=isEnrolledCourse(course.id), areaCls=AREA_CLASSES[course.area]||'';
  modalBody.innerHTML=`
    <div class="modal-head">
      <img src="${course.img}" alt="${course.nombre}">
      <div class="modal-info" style="flex:1">
        <h3>${course.nombre}</h3>
        <div class="modal-tags">
          <span class="modal-tag ${areaCls}" style="border:1px solid">${AREA_ICONS[course.area]||'📚'} ${course.area.toUpperCase()}</span>
          <span class="modal-tag">GRADO ${course.grado}°</span>
          <span class="modal-tag">${course.profesor}</span>
          ${(course.etiquetas||[]).map(e=>`<span class="modal-tag">${e}</span>`).join('')}
        </div>
        <p class="modal-desc">${course.descripcion}</p>
        <div class="modal-meta">
          <span><i class="fa-regular fa-clock"></i> ${course.duracionHoras}H</span>
          <span><i class="fa-solid fa-fire"></i> POPULARIDAD ${course.popularidad}</span>
          <span><i class="fa-solid fa-star"></i> +${Math.round(course.duracionHoras*8)} XP</span>
          <span><i class="fa-regular fa-calendar"></i> ${new Date(course.fecha).toLocaleDateString('es-PE')}</span>
        </div>
        <div class="modal-actions">
          <button id="inscribirBtn" class="btn btn-enroll ${enrolled?'enrolled':''}" ${enrolled?'disabled':''}>
            ${enrolled?'✓ INSCRITO':'▶ INSCRIBIRME'}
          </button>
          <button class="btn btn-fav" data-modal-fav="${course.id}" style="font-size:0.45rem;">♥ FAVORITO</button>
        </div>
        <div id="inscOk" class="insc-ok" hidden>
          <i class="fa-solid fa-circle-check"></i>
          <span>¡Inscrito en <strong>${course.nombre}</strong>! Revisa tu <a href="perfil.html">Perfil</a>.</span>
        </div>
      </div>
    </div>
    <div class="modal-temario">
      <h4>TEMARIO</h4>
      <ul>
        <li>Unidad 1: Fundamentos y conceptos base</li>
        <li>Unidad 2: Prácticas y ejercicios guiados</li>
        <li>Unidad 3: Proyecto y aplicación real</li>
        <li>Evaluación final y certificado</li>
      </ul>
    </div>`;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  modal.querySelector('[data-modal-fav]')?.addEventListener('click',()=>{toggleFav(course.id);showToast('♥ FAVORITO ACTUALIZADO','ok');renderCourses();});
  const inscBtn=modal.querySelector('#inscribirBtn');
  inscBtn?.addEventListener('click',()=>{
    if(isEnrolledCourse(course.id)){showToast('YA INSCRITO 😉','warn');return;}
    enrollCourse(course); inscBtn.textContent='✓ INSCRITO'; inscBtn.classList.add('enrolled'); inscBtn.disabled=true;
    modal.querySelector('#inscOk').hidden=false; showToast('▶ ¡INSCRITO CON ÉXITO!','ok'); renderCourses();
  });
}
function closeModal(){modal?.classList.remove('show');modal?.setAttribute('aria-hidden','true');}
modalClose?.addEventListener('click',closeModal);
modal?.addEventListener('click',e=>{if(e.target===modal)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

function observeReveal(){ document.querySelectorAll('.reveal:not(.visible)').forEach(el=>io.observe(el)); }

/* ===== INIT ===== */
getProfile();
renderCourses();
renderTemporales();
observeReveal();

/* ===== AUTH LISTENER ===== */
onAuthChange(async (user) => {
  currentUID = user ? user.uid : null;
  if (currentUID) {
    await _flushQueue();            // vacía syncs que esperaban auth
    await _syncAllLocalEnrollments(); // re-sube todo lo que había en localStorage
  }
});