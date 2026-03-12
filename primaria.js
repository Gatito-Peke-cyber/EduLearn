/* =====================================================
   EduLearn — Primaria JS v3.3
   FIXES v3.3:
   - ELIMINADO await top-level (causa SyntaxError en algunos entornos)
   - Firebase se carga via Promise.all().then() de forma OPCIONAL
   - Loader, cursos y temporales funcionan SIEMPRE, con o sin Firebase
   ===================================================== */

/* ===== LOADER INMEDIATO — ejecuta sin esperar nada ===== */
(function () {
  function hideLoader() {
    var loader = document.getElementById('loader');
    if (!loader) return;
    var fill = document.getElementById('ldFill');
    var w = 0;
    var iv = setInterval(function () {
      w += Math.random() * 18 + 5;
      if (fill) fill.style.width = Math.min(w, 100) + '%';
      if (w >= 100) {
        clearInterval(iv);
        setTimeout(function () {
          loader.style.transition = 'opacity 0.4s';
          loader.style.opacity = '0';
          setTimeout(function () { loader.style.display = 'none'; }, 400);
        }, 300);
      }
    }, 80);
  }
  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
  }
  setTimeout(function () {
    var loader = document.getElementById('loader');
    if (loader && loader.style.display !== 'none') {
      loader.style.transition = 'opacity 0.3s';
      loader.style.opacity = '0';
      setTimeout(function () { loader.style.display = 'none'; }, 300);
    }
  }, 3000);
})();

/* ===== FIREBASE — carga opcional, NO bloquea nada ===== */
var _auth = null;
var _enrollCourseDB = null;

Promise.all([
  import('./firebase.js'),
  import('./database.js')
]).then(function (modules) {
  _auth = modules[0].auth;
  _enrollCourseDB = modules[1].enrollCourse;
}).catch(function (err) {
  console.warn('[Primaria] Firebase no disponible, modo offline:', err);
});

function getCurrentUID() {
  try { return _auth && _auth.currentUser ? _auth.currentUser.uid : null; }
  catch (_) { return null; }
}

/* ===== STORAGE KEYS ===== */
var PROFILE_KEY = 'perfil_usuario';
var ENROLL_KEY  = 'inscripciones';
var FAV_KEY_P   = 'primaria_favs';

/* ===== HELPERS ===== */
var PAGE_SIZE = 9;

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function getEnrolled() { return lsGet(ENROLL_KEY) || []; }
function isEnrolled(id) { return getEnrolled().some(function(e){return e.id===id;}); }
function getFavs() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY_P)) || []); } catch (e) { return new Set(); } }
function saveFavs(s) { localStorage.setItem(FAV_KEY_P, JSON.stringify(Array.from(s))); }

function toast(msg, color) {
  color = color || 'var(--green)';
  var t = qs('#toast'); if (!t) return;
  t.textContent = msg; t.style.borderColor = color; t.style.color = color;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function () { t.classList.remove('show'); }, 2800);
}

function genStars(n) {
  var out = '';
  for (var i = 0; i < 5; i++) {
    out += '<span class="' + (i < n ? 'star-filled' : 'star-empty') + '">★</span>';
  }
  return out;
}

function getAreaLabel(a) {
  var map = { matematicas:'🔢 MATES', lectura:'📚 LECTURA', ciencias:'🔬 CIENCIAS', ingles:'🌍 INGLÉS', arte:'🎨 ARTE', musica:'🎵 MÚSICA', computacion:'💻 COMPU', valores:'💚 VALORES', historia:'🏛️ HISTORIA', ef:'⚽ EF' };
  return map[a] || a.toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

function getTempStatus(temp) {
  var now = Date.now();
  var inicio = new Date(temp.inicio).getTime();
  var fin = new Date(temp.fin).getTime();
  if (now < inicio) return 'not_started';
  if (now > fin) return 'expired';
  return 'active';
}

function buildCountdown(targetIso) {
  var diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00d 00h 00m 00s';
  var totalSec = Math.floor(diff / 1000);
  var days  = Math.floor(totalSec / 86400);
  var hours = Math.floor((totalSec % 86400) / 3600);
  var mins  = Math.floor((totalSec % 3600) / 60);
  var secs  = totalSec % 60;
  function pad(n) { return String(n).padStart(2,'0'); }
  return pad(days) + 'd ' + pad(hours) + 'h ' + pad(mins) + 'm ' + pad(secs) + 's';
}

function addXP(amount) {
  var p = lsGet(PROFILE_KEY) || {};
  p.xp = (p.xp || 0) + amount;
  lsSet(PROFILE_KEY, p);
}

/* ===== COURSES DATA ===== */
var CURSOS_P = [
  // MATEMATICAS
  { id:'p01', nombre:'Números del 1 al 100', area:'matematicas', grado:'1er Grado', horas:10, xp:80, desc:'Aprende a contar, leer y escribir números del 1 al 100 con juegos y canciones.', estrellas:5, temario:['Conteo del 1 al 20','Conteo del 21 al 50','Conteo del 51 al 100','Juegos de números'], img:'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80', link:'#' },
  { id:'p02', nombre:'Sumas y Restas Fáciles', area:'matematicas', grado:'2do Grado', horas:12, xp:90, desc:'Dominá las sumas y restas de una y dos cifras con ejemplos del día a día.', estrellas:5, temario:['Suma de una cifra','Suma de dos cifras','Resta básica','Problemas cotidianos'], img:'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80', link:'#' },
  { id:'p03', nombre:'Tablas de Multiplicar', area:'matematicas', grado:'3er Grado', horas:14, xp:100, desc:'Memoriza y practica las tablas del 1 al 10 con ejercicios dinámicos.', estrellas:4, temario:['Tabla del 1 al 3','Tabla del 4 al 6','Tabla del 7 al 10','Repaso general'], img:'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&q=80', link:'#' },
  { id:'p04', nombre:'Fracciones Básicas', area:'matematicas', grado:'4to Grado', horas:13, xp:95, desc:'Entiende qué es un medio, un tercio y otras fracciones con figuras coloridas.', estrellas:4, temario:['¿Qué es una fracción?','Mitad y cuarto','Fracciones equivalentes','Suma de fracciones'], img:'https://images.unsplash.com/photo-1564980172245-3c93f46e0e57?w=400&q=80', link:'#' },
  { id:'p05', nombre:'Geometría Divertida', area:'matematicas', grado:'5to Grado', horas:11, xp:85, desc:'Figuras geométricas, ángulos y perímetros explicados de forma visual.', estrellas:4, temario:['Figuras planas','Ángulos','Perímetro y área','Cuerpos geométricos'], img:'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=400&q=80', link:'#' },
  { id:'p06', nombre:'Decimales y Porcentajes', area:'matematicas', grado:'6to Grado', horas:15, xp:110, desc:'Aprende a trabajar con números decimales y porcentajes en problemas reales.', estrellas:5, temario:['Números decimales','Suma y resta decimal','¿Qué es el porcentaje?','Ejercicios prácticos'], img:'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=400&q=80', link:'#' },
  // LECTURA
  { id:'p07', nombre:'Aprendo a Leer', area:'lectura', grado:'1er Grado', horas:10, xp:80, desc:'Las vocales, consonantes y primeras palabras de forma lúdica y divertida.', estrellas:5, temario:['Vocales','Consonantes básicas','Sílabas','Primeras palabras'], img:'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80', link:'#' },
  { id:'p08', nombre:'Cuentos y Comprensión', area:'lectura', grado:'2do Grado', horas:12, xp:90, desc:'Lee cuentos cortos y responde preguntas sobre personajes y eventos.', estrellas:5, temario:['Cuento: El patito feo','Cuento: Caperucita','Personajes principales','Preguntas de comprensión'], img:'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', link:'#' },
  { id:'p09', nombre:'Ortografía Básica', area:'lectura', grado:'3er Grado', horas:11, xp:85, desc:'Reglas de uso de mayúsculas, puntos, comas y letras difíciles.', estrellas:4, temario:['Mayúsculas','Uso del punto','La coma','Letras b/v y c/s/z'], img:'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80', link:'#' },
  { id:'p10', nombre:'Redacción Creativa', area:'lectura', grado:'4to Grado', horas:13, xp:95, desc:'Escribe tus propios cuentos, poemas y cartas con guía paso a paso.', estrellas:4, temario:['Estructura de un cuento','El poema','La carta','Mi primer relato'], img:'https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=400&q=80', link:'#' },
  // CIENCIAS
  { id:'p11', nombre:'El Cuerpo Humano', area:'ciencias', grado:'3er Grado', horas:12, xp:90, desc:'Descubre los órganos, los sentidos y cómo funciona tu cuerpo.', estrellas:5, temario:['Los sentidos','El esqueleto','Órganos vitales','Hábitos saludables'], img:'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&q=80', link:'#' },
  { id:'p12', nombre:'Los Animales del Mundo', area:'ciencias', grado:'2do Grado', horas:10, xp:80, desc:'Mamíferos, reptiles, aves e insectos: sus características y hábitats.', estrellas:5, temario:['Mamíferos','Reptiles','Aves','Insectos y arácnidos'], img:'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=400&q=80', link:'#' },
  { id:'p13', nombre:'Las Plantas y el Ecosistema', area:'ciencias', grado:'4to Grado', horas:11, xp:85, desc:'Fotosíntesis, tipos de plantas y cómo cuidar el medio ambiente.', estrellas:4, temario:['Partes de la planta','Fotosíntesis','Ecosistemas','Cuidado del planeta'], img:'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80', link:'#' },
  { id:'p14', nombre:'El Sistema Solar', area:'ciencias', grado:'5to Grado', horas:13, xp:95, desc:'Viaja por los 8 planetas, el Sol, la Luna y las estrellas.', estrellas:5, temario:['El Sol y los planetas','La Tierra y la Luna','Estrellas y constelaciones','Exploración espacial'], img:'https://images.unsplash.com/photo-1446776858070-70c3d5ed6758?w=400&q=80', link:'#' },
  { id:'p15', nombre:'El Agua y los Estados', area:'ciencias', grado:'3er Grado', horas:10, xp:80, desc:'Sólido, líquido y gas: experimentos caseros para entender la materia.', estrellas:4, temario:['Estados del agua','El ciclo del agua','Experimentos caseros','Cuidado del agua'], img:'https://images.unsplash.com/photo-1504191904843-8e7e1ba0fe75?w=400&q=80', link:'#' },
  // INGLES
  { id:'p16', nombre:'English for Kids A0', area:'ingles', grado:'1er Grado', horas:10, xp:80, desc:'Colors, numbers, animals and greetings — your first steps in English!', estrellas:5, temario:['Colors & Shapes','Numbers 1-10','Animals','Hello & Goodbye'], img:'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=80', link:'ingles.html' },
  { id:'p17', nombre:'English Alphabet Fun', area:'ingles', grado:'2do Grado', horas:11, xp:85, desc:'Learn all 26 letters with songs, games and simple words.', estrellas:4, temario:['A to F','G to L','M to R','S to Z'], img:'https://images.unsplash.com/photo-1555431189-0fabf2667795?w=400&q=80', link:'#' },
  { id:'p18', nombre:'My Family in English', area:'ingles', grado:'3er Grado', horas:10, xp:80, desc:'Family members, classroom objects and simple sentences in English.', estrellas:4, temario:['Family members','My classroom','Simple sentences','Reading time'], img:'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=400&q=80', link:'#' },
  // ARTE
  { id:'p19', nombre:'Dibujo y Pintura Básica', area:'arte', grado:'1er Grado', horas:8, xp:70, desc:'Aprende a dibujar figuras simples y a mezclar colores primarios.', estrellas:5, temario:['Trazos básicos','Colores primarios','Mi primera pintura','Arte con texturas'], img:'https://images.unsplash.com/photo-1499892477393-f675706cbe6e?w=400&q=80', link:'#' },
  { id:'p20', nombre:'Manualidades Creativas', area:'arte', grado:'2do Grado', horas:9, xp:75, desc:'Origami, collages y figuras 3D con materiales reciclados.', estrellas:5, temario:['Origami básico','Collage','Figuras 3D','Arte reciclado'], img:'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80', link:'#' },
  { id:'p21', nombre:'Arte Digital para Niños', area:'arte', grado:'5to Grado', horas:12, xp:90, desc:'Crea tus primeros dibujos digitales con herramientas sencillas.', estrellas:4, temario:['Herramientas digitales','Coloreado digital','Mi personaje','Animación simple'], img:'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80', link:'#' },
  { id:'p22', nombre:'Historia del Arte Infantil', area:'arte', grado:'6to Grado', horas:11, xp:85, desc:'Conoce las obras más famosas del mundo de forma divertida.', estrellas:4, temario:['Arte prehistórico','Grandes pintores','Arte moderno','Crea tu estilo'], img:'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400&q=80', link:'#' },
  // MUSICA
  { id:'p23', nombre:'Ritmo y Compás', area:'musica', grado:'2do Grado', horas:9, xp:75, desc:'Palmas, canciones y ejercicios de ritmo para despertar el músico que hay en ti.', estrellas:5, temario:['¿Qué es el ritmo?','Canciones con palmas','Instrumentos de percusión','Mi canción favorita'], img:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80', link:'#' },
  { id:'p24', nombre:'Las Notas Musicales', area:'musica', grado:'3er Grado', horas:11, xp:85, desc:'Do, Re, Mi, Fa, Sol… aprende el pentagrama de forma divertida.', estrellas:4, temario:['El pentagrama','Las 7 notas','Melodías simples','Lectura musical básica'], img:'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80', link:'#' },
  { id:'p25', nombre:'Instrumentos del Mundo', area:'musica', grado:'4to Grado', horas:10, xp:80, desc:'Conoce los instrumentos de cuerda, viento y percusión de distintas culturas.', estrellas:4, temario:['Instrumentos de cuerda','Viento madera','Viento metal','Percusión mundial'], img:'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80', link:'#' },
  // COMPUTACION
  { id:'p26', nombre:'Intro a la Computadora', area:'computacion', grado:'2do Grado', horas:10, xp:80, desc:'Partes de la computadora, uso del ratón y teclado para niños.', estrellas:5, temario:['Partes del equipo','Uso del ratón','El teclado','Primeros programas'], img:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80', link:'#' },
  { id:'p27', nombre:'Scratch para Principiantes', area:'computacion', grado:'4to Grado', horas:14, xp:100, desc:'Crea tus primeras animaciones y juegos con Scratch sin escribir código.', estrellas:5, temario:['Interfaz de Scratch','Movimiento de sprites','Eventos y sonidos','Mi primer juego'], img:'https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=400&q=80', link:'#' },
  { id:'p28', nombre:'Pensamiento Computacional', area:'computacion', grado:'5to Grado', horas:12, xp:90, desc:'Algoritmos, secuencias y lógica con actividades desconectadas.', estrellas:4, temario:['¿Qué es un algoritmo?','Secuencias','Condicionales','Bucles simples'], img:'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&q=80', link:'#' },
  { id:'p29', nombre:'Internet Seguro', area:'computacion', grado:'6to Grado', horas:10, xp:80, desc:'Reglas de seguridad en línea, privacidad y uso responsable de redes.', estrellas:4, temario:['¿Qué es internet?','Contraseñas seguras','Privacidad en línea','Ciberacoso: ¿qué hago?'], img:'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=400&q=80', link:'#' },
  // VALORES
  { id:'p30', nombre:'Amistad y Respeto', area:'valores', grado:'1er Grado', horas:8, xp:70, desc:'Cuentos y actividades sobre el respeto, la empatía y la amistad.', estrellas:5, temario:['¿Qué es la amistad?','Respeto a los demás','La empatía','Resolución de conflictos'], img:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80', link:'#' },
  { id:'p31', nombre:'Ciudadanía Digital', area:'valores', grado:'5to Grado', horas:9, xp:75, desc:'Aprende a ser un buen ciudadano en el mundo digital y real.', estrellas:4, temario:['Derechos y deberes','Uso responsable','Noticias falsas','Participación ciudadana'], img:'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=400&q=80', link:'#' },
  { id:'p32', nombre:'Medio Ambiente y Yo', area:'valores', grado:'3er Grado', horas:9, xp:75, desc:'Acciones cotidianas para cuidar el planeta desde pequeños.', estrellas:5, temario:['Reciclaje','Ahorro de agua','Energías limpias','Mi huerta escolar'], img:'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=80', link:'#' },
  // HISTORIA
  { id:'p33', nombre:'Historia del Perú para Niños', area:'historia', grado:'4to Grado', horas:12, xp:90, desc:'Los Incas, la colonia y la independencia contados de forma sencilla.', estrellas:5, temario:['Los Incas','La conquista','Virreinato','Independencia'], img:'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=80', link:'#' },
  { id:'p34', nombre:'Las Maravillas del Mundo', area:'historia', grado:'5to Grado', horas:11, xp:85, desc:'Viaja virtualmente a las 7 maravillas del mundo antiguo y moderno.', estrellas:4, temario:['Maravillas antiguas','Maravillas modernas','Patrimonio de la humanidad','Curiosidades'], img:'https://images.unsplash.com/photo-1539650116574-75c0c6d42f94?w=400&q=80', link:'#' },
  { id:'p35', nombre:'Civilizaciones Antiguas', area:'historia', grado:'6to Grado', horas:13, xp:95, desc:'Egipto, Grecia, Roma y Mesopotamia: las bases de nuestra cultura.', estrellas:4, temario:['Mesopotamia','Egipto antiguo','Grecia clásica','El Imperio Romano'], img:'https://images.unsplash.com/photo-1565073624497-7144969b0b9f?w=400&q=80', link:'#' },
  // EF
  { id:'p36', nombre:'Juegos Tradicionales', area:'ef', grado:'1er Grado', horas:8, xp:70, desc:'Tingo-tango, rayuela, saltar la cuerda y más juegos clásicos.', estrellas:5, temario:['Rayuela','Saltar la cuerda','Tingo tango','El escondite'], img:'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&q=80', link:'#' },
  { id:'p37', nombre:'Deporte y Salud', area:'ef', grado:'3er Grado', horas:10, xp:80, desc:'Por qué hacer ejercicio, alimentación balanceada y rutinas diarias.', estrellas:4, temario:['Beneficios del ejercicio','Alimentación sana','Rutina matutina','Deportes en equipo'], img:'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80', link:'#' },
  { id:'p38', nombre:'Yoga para Niños', area:'ef', grado:'2do Grado', horas:9, xp:75, desc:'Posturas, respiración y relajación adaptadas para chicos y chicas.', estrellas:5, temario:['Respiración básica','Posturas de animales','Relajación guiada','Rutina completa'], img:'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80', link:'#' },
  { id:'p39', nombre:'Fútbol: Técnicas Básicas', area:'ef', grado:'4to Grado', horas:11, xp:85, desc:'Control de pelota, pases y posición en cancha para iniciantes.', estrellas:4, temario:['Control de pelota','El pase','El regate','Táctica básica'], img:'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400&q=80', link:'#' },
  { id:'p40', nombre:'Atletismo Escolar', area:'ef', grado:'5to Grado', horas:10, xp:80, desc:'Carreras, salto largo, lanzamiento de pelota y récords personales.', estrellas:4, temario:['Carrera de velocidad','Carrera de resistencia','Salto largo','Lanzamiento'], img:'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&q=80', link:'#' }
];

/* ===== TEMPORALES ===== */
var TEMPORALES_P = [
  { id:'tp01', nombre:'Taller de Cuentos Mágicos', area:'lectura', desc:'¡Escribe tu propio cuento ilustrado en este taller especial de vacaciones!', horas:6, img:'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&q=80', inicio:'2026-03-10T08:00:00', fin:'2026-03-22T23:59:59', link:'#' },
  { id:'tp02', nombre:'Maratón de Mates', area:'matematicas', desc:'Resuelve 50 retos matemáticos y gana la insignia del Genio de los Números.', horas:5, img:'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&q=80', inicio:'2026-03-09T00:00:00', fin:'2026-03-13T23:59:59', link:'#' },
  { id:'tp03', nombre:'Science Fair Virtual', area:'ciencias', desc:'Presenta un experimento casero y compite con estudiantes de todo el país.', horas:8, img:'https://images.unsplash.com/photo-1532094349884-543559059db2?w=400&q=80', inicio:'2026-02-20T00:00:00', fin:'2026-03-01T23:59:59', link:'#' }
];

var GRADO_MAP = { '1':'1er Grado','2':'2do Grado','3':'3er Grado','4':'4to Grado','5':'5to Grado','6':'6to Grado' };

/* ===== STATE ===== */
var state = { search:'', area:'', grado:'', sort:'relevancia', page:1, favoritosOnly:false };

function filteredCourses() {
  var favs = getFavs();
  var list = CURSOS_P.slice();
  if (state.favoritosOnly) list = list.filter(function(c){return favs.has(c.id);});
  if (state.search) {
    var sq = state.search.toLowerCase();
    list = list.filter(function(c){ return c.nombre.toLowerCase().indexOf(sq) >= 0 || c.desc.toLowerCase().indexOf(sq) >= 0; });
  }
  if (state.area)  list = list.filter(function(c){return c.area === state.area;});
  if (state.grado) list = list.filter(function(c){return c.grado === (GRADO_MAP[state.grado] || state.grado);});
  switch (state.sort) {
    case 'nombre-asc':  list.sort(function(a,b){return a.nombre.localeCompare(b.nombre);}); break;
    case 'nombre-desc': list.sort(function(a,b){return b.nombre.localeCompare(a.nombre);}); break;
    case 'populares':   list.sort(function(a,b){return b.estrellas - a.estrellas;}); break;
    case 'duracion':    list.sort(function(a,b){return a.horas - b.horas;}); break;
    default:            list.sort(function(a,b){return b.xp - a.xp;}); break;
  }
  return list;
}

/* ===== RENDER GRID ===== */
function renderGrid() {
  var list = filteredCourses();
  var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.page > pages) state.page = 1;
  var slice = list.slice((state.page-1)*PAGE_SIZE, state.page*PAGE_SIZE);
  var grid = qs('#coursesGrid');
  if (!grid) return;

  if (!slice.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;"><div style="font-size:2.5rem;margin-bottom:10px;">🔍</div><p style="font-family:var(--font-pixel);font-size:0.5rem;color:var(--muted)">NO SE ENCONTRARON CURSOS</p></div>';
    renderPagination(1, 1);
    return;
  }

  var favs = getFavs();
  grid.innerHTML = slice.map(function(c) {
    var enr = isEnrolled(c.id);
    var fav = favs.has(c.id);
    return (
      '<div class="card reveal" data-id="' + c.id + '">' +
      (c.nuevo ? '<div class="ribbon">✦ NUEVO</div>' : '') +
      '<button class="fav ' + (fav?'active':'') + '" data-fav-id="' + c.id + '" title="' + (fav?'Quitar favorito':'Añadir favorito') + '">♥</button>' +
      '<div class="card-img-wrap">' +
        '<img src="' + c.img + '" alt="' + c.nombre + '" loading="lazy" onerror="this.src=\'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=300&q=60\'">' +
        '<div class="card-img-overlay"></div>' +
        '<div class="card-area-badge area-' + c.area + '">' + getAreaLabel(c.area) + '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-grade">' + c.grado + '</div>' +
        '<div class="card-name">' + c.nombre + '</div>' +
        '<div class="card-stars">' + genStars(c.estrellas) + '</div>' +
        '<div class="card-desc">' + c.desc + '</div>' +
        '<div class="card-meta"><span>⏱ ' + c.horas + 'h</span><span>⚡ ' + c.xp + ' XP</span></div>' +
        '<div class="card-xp-bar"><div class="card-xp-fill" style="width:' + (enr?100:0) + '%"></div></div>' +
        '<div class="card-foot">' +
          '<div class="enroll-state ' + (enr?'enrolled':'not-enrolled') + '">' + (enr?'✓ INSCRITO':'') + '</div>' +
          '<div style="display:flex;gap:5px">' +
            '<button class="btn btn-view" data-view-id="' + c.id + '">VER</button>' +
            (enr
              ? '<button class="btn btn-enroll enrolled" disabled>✓ INSCRITO</button>'
              : '<button class="btn btn-enroll" data-enroll-id="' + c.id + '">INSCRIBIRSE</button>'
            ) +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>'
    );
  }).join('');

  renderPagination(state.page, pages);

  requestAnimationFrame(function() {
    qsa('#coursesGrid .reveal').forEach(function(el, i) {
      setTimeout(function() { el.classList.add('visible'); }, i * 55);
    });
  });

  qsa('[data-fav-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); toggleFavP(btn.dataset.favId); });
  });
  qsa('[data-view-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); openModal(btn.dataset.viewId); });
  });
  qsa('[data-enroll-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); enrollCourseP(btn.dataset.enrollId); });
  });
  qsa('.card').forEach(function(card) {
    card.addEventListener('click', function() { openModal(card.dataset.id); });
  });
}

/* ===== PAGINATION ===== */
function renderPagination(current, total) {
  var prev = qs('#prevPage');
  var next = qs('#nextPage');
  var list = qs('#pageList');
  if (!prev) return;
  prev.disabled = current <= 1;
  next.disabled = current >= total;
  list.innerHTML = '';
  for (var i = 1; i <= total; i++) {
    (function(pn) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.textContent = String(pn);
      if (pn === current) btn.className = 'active';
      btn.addEventListener('click', function() { state.page = pn; renderGrid(); });
      li.appendChild(btn); list.appendChild(li);
    })(i);
  }
}

/* ===== RENDER TEMPORALES ===== */
var tempIntervals = [];

function renderTemporales() {
  tempIntervals.forEach(function(id){clearInterval(id);});
  tempIntervals = [];
  var grid = qs('#tempGrid');
  if (!grid) return;

  grid.innerHTML = TEMPORALES_P.map(function(t) {
    var status = getTempStatus(t);
    var enr = isEnrolled(t.id);
    var inicioFmt = fmtDate(t.inicio);
    var finFmt = fmtDate(t.fin);
    var badgeTxt = status==='expired' ? '⛔ EXPIRADO' : status==='active' ? '⚡ ACTIVO' : '🔒 PRÓXIMO';
    var badgeCls = status==='expired' ? 'badge-expired' : status==='active' ? 'badge-active' : 'badge-soon';
    var actionBtn;
    if (status==='expired') actionBtn = '<span class="temp-status-badge badge-expired-txt">✗ EXPIRADO</span>';
    else if (status==='not_started') actionBtn = '<span class="temp-status-badge badge-soon-txt">🔒 AÚN NO ABRE</span>';
    else if (enr) actionBtn = '<span class="temp-enrolled-badge">✓ INSCRITO</span>';
    else actionBtn = '<button class="btn btn-enroll" data-enroll-temp="' + t.id + '" style="font-size:0.38rem;padding:6px 9px;">INSCRIBIRSE</button>';
    var countdownLabel = status==='not_started' ? 'ABRE EN:' : status==='active' ? 'CIERRA EN:' : '';
    var cdHtml = status !== 'expired'
      ? '<span class="countdown-label">' + countdownLabel + '</span><span class="countdown" id="cd-' + t.id + '">' + (status==='not_started' ? buildCountdown(t.inicio) : buildCountdown(t.fin)) + '</span>'
      : '<span class="countdown expired-text">VENCIÓ: ' + finFmt + '</span>';
    return (
      '<div class="temp-card ' + (status!=='active'?'expired':'') + '" data-tid="' + t.id + '">' +
      '<div class="temp-badge ' + badgeCls + '">' + badgeTxt + '</div>' +
      '<div class="temp-card-img"><img src="' + t.img + '" alt="' + t.nombre + '" loading="lazy" onerror="this.src=\'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=300&q=60\'"></div>' +
      '<div class="temp-body">' +
        '<div class="temp-name">' + t.nombre + '</div>' +
        '<div class="temp-desc">' + t.desc + '</div>' +
        '<div class="temp-dates">' +
          '<span class="temp-date-item">📅 INICIO: <strong>' + inicioFmt + '</strong></span>' +
          '<span class="temp-date-item">🏁 FIN: <strong>' + finFmt + '</strong></span>' +
        '</div>' +
        '<div class="temp-foot">' +
          '<div class="countdown-wrap">' + cdHtml + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' + actionBtn + '</div>' +
        '</div>' +
      '</div>' +
      '</div>'
    );
  }).join('');

  TEMPORALES_P.forEach(function(t) {
    var el = document.getElementById('cd-' + t.id);
    if (!el) return;
    var status = getTempStatus(t);
    if (status === 'expired') return;
    var targetIso = status === 'not_started' ? t.inicio : t.fin;
    var ivId = setInterval(function() {
      var ns = getTempStatus(t);
      if (ns==='expired' || (status==='not_started' && ns==='active')) { clearInterval(ivId); renderTemporales(); return; }
      var cdEl = document.getElementById('cd-' + t.id);
      if (cdEl) cdEl.textContent = buildCountdown(targetIso);
    }, 1000);
    tempIntervals.push(ivId);
  });

  qsa('[data-enroll-temp]').forEach(function(btn) {
    btn.addEventListener('click', function() { enrollTemporalP(btn.dataset.enrollTemp); });
  });
}

/* ===== ENROLL ===== */
function enrollCourseP(id) {
  var c = CURSOS_P.filter(function(x){return x.id===id;})[0];
  if (!c || isEnrolled(id)) { if (isEnrolled(id)) toast('YA ESTABAS INSCRITO 😉','var(--yellow)'); return; }
  var entry = { tipo:'permanente', id:c.id, cursoId:c.id, nombre:c.nombre, area:c.area, grado:c.grado, horas:c.horas, img:c.img, inscritoEl:new Date().toISOString(), estado:'en_progreso', link:c.link };
  var list = getEnrolled();
  list.push(entry);
  lsSet(ENROLL_KEY, list);
  addXP(c.xp);
  toast('🎮 ¡INSCRITO EN: ' + c.nombre + '! +' + c.xp + ' XP');
  var uid = getCurrentUID();
  if (uid && _enrollCourseDB) { _enrollCourseDB(uid, entry).catch(function(err){ console.warn('[Prim] Firebase sync error:', err); }); }
  renderGrid();
  var mBtn = qs('#modal-enroll-btn');
  if (mBtn && mBtn.dataset.modalId === id) {
    mBtn.textContent = '✓ INSCRITO'; mBtn.disabled = true; mBtn.classList.add('enrolled');
    var ok = qs('#modal-insc-ok'); if (ok) ok.style.display = 'flex';
  }
}

function enrollTemporalP(tid) {
  var t = TEMPORALES_P.filter(function(x){return x.id===tid;})[0];
  if (!t) return;
  var st = getTempStatus(t);
  if (st==='expired') { toast('⛔ ESTE TALLER YA EXPIRÓ','var(--red)'); return; }
  if (st==='not_started') { toast('🔒 ESTE TALLER AÚN NO HA ABIERTO','var(--purple)'); return; }
  if (isEnrolled(tid)) { toast('YA ESTABAS INSCRITO 😉','var(--yellow)'); return; }
  var entry = { tipo:'temporal', id:t.id, cursoId:t.id, nombre:t.nombre, area:t.area, horas:t.horas, img:t.img, inscritoEl:new Date().toISOString(), estado:'en_progreso', inicio:t.inicio, fin:t.fin, link:t.link };
  var list = getEnrolled();
  list.push(entry);
  lsSet(ENROLL_KEY, list);
  addXP(50);
  toast('🌟 ¡INSCRITO EN TALLER: ' + t.nombre + '! +50 XP');
  var uid = getCurrentUID();
  if (uid && _enrollCourseDB) { _enrollCourseDB(uid, entry).catch(function(err){ console.warn('[Prim] Firebase sync temp error:', err); }); }
  renderTemporales();
}

/* ===== FAVORITES ===== */
function toggleFavP(id) {
  var favs = getFavs();
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  saveFavs(favs);
  var btn = qs('[data-fav-id="' + id + '"]');
  if (btn) btn.classList.toggle('active', favs.has(id));
  if (state.favoritosOnly) renderGrid();
}

/* ===== MODAL ===== */
function openModal(id) {
  var c = CURSOS_P.filter(function(x){return x.id===id;})[0];
  if (!c) return;
  var enrolled = isEnrolled(id);
  var modal = qs('#courseModal');
  var mb = modal && modal.querySelector('.modal-body');
  if (!modal || !mb) return;

  mb.innerHTML =
    '<div class="modal-head">' +
      '<img src="' + c.img + '" alt="' + c.nombre + '" onerror="this.src=\'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=300&q=60\'">' +
      '<div class="modal-info" style="flex:1">' +
        '<h3>' + c.nombre + '</h3>' +
        '<div class="modal-tags">' +
          '<span class="modal-tag area-' + c.area + '">' + getAreaLabel(c.area) + '</span>' +
          '<span class="modal-tag">📚 ' + c.grado + '</span>' +
          '<span class="modal-tag">⚡ ' + c.xp + ' XP</span>' +
        '</div>' +
        '<div class="card-stars" style="margin-bottom:8px">' + genStars(c.estrellas) + '</div>' +
        '<div class="modal-desc">' + c.desc + '</div>' +
        '<div class="modal-meta"><span>⏱ ' + c.horas + ' horas</span><span>🎯 ' + c.temario.length + ' unidades</span></div>' +
        '<div class="modal-actions">' +
          (enrolled
            ? '<button class="btn btn-enroll enrolled" disabled>✓ YA INSCRITO</button>'
            : '<button class="btn btn-enroll" id="modal-enroll-btn" data-modal-id="' + id + '">🎮 INSCRIBIRSE</button>'
          ) +
          (c.link && c.link !== '#' ? '<a href="' + c.link + '" class="btn btn-view">▶ IR AL CURSO</a>' : '') +
        '</div>' +
        (enrolled
          ? '<div class="insc-ok" id="modal-insc-ok" style="display:flex"><span>✓ ¡Ya estás inscrito!</span></div>'
          : '<div class="insc-ok" id="modal-insc-ok" style="display:none"><span>✓ ¡Inscripción exitosa! <a href="perfil.html">Ver mis cursos</a></span></div>'
        ) +
      '</div>' +
    '</div>' +
    '<div class="modal-temario"><h4>📋 CONTENIDO DEL CURSO</h4><ul>' +
      c.temario.map(function(t){return '<li>' + t + '</li>';}).join('') +
    '</ul></div>';

  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';

  var enrollBtn = modal.querySelector('#modal-enroll-btn');
  if (enrollBtn) enrollBtn.addEventListener('click', function() { enrollCourseP(enrollBtn.dataset.modalId); });
}

function closeModal() {
  var modal = qs('#courseModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

/* ===== CONTROLS ===== */
function initControls() {
  var search   = qs('#searchInput');
  var selArea  = qs('#areaFilter');
  var selGrado = qs('#gradoFilter');
  var selSort  = qs('#ordenSelect');
  var btnReset = qs('#btnReset');
  var btnFavs  = qs('#btnFavoritos');

  if (search)   search.addEventListener('input',  function(){state.search=search.value; state.page=1; renderGrid();});
  if (selArea)  selArea.addEventListener('change', function(){state.area=selArea.value; state.page=1; renderGrid();});
  if (selGrado) selGrado.addEventListener('change',function(){state.grado=selGrado.value; state.page=1; renderGrid();});
  if (selSort)  selSort.addEventListener('change', function(){state.sort=selSort.value; state.page=1; renderGrid();});

  if (btnFavs) btnFavs.addEventListener('click', function() {
    state.favoritosOnly = !state.favoritosOnly;
    btnFavs.classList.toggle('active', state.favoritosOnly);
    state.page = 1; renderGrid();
  });

  if (btnReset) btnReset.addEventListener('click', function() {
    state.search=''; state.area=''; state.grado=''; state.sort='relevancia';
    state.page=1; state.favoritosOnly=false;
    if (search)   search.value   = '';
    if (selArea)  selArea.value  = '';
    if (selGrado) selGrado.value = '';
    if (selSort)  selSort.value  = 'relevancia';
    if (btnFavs)  btnFavs.classList.remove('active');
    renderGrid();
    toast('🔄 FILTROS REINICIADOS');
  });

  var pp = qs('#prevPage');
  var np = qs('#nextPage');
  if (pp) pp.addEventListener('click', function(){ if(state.page>1){state.page--; renderGrid();} });
  if (np) np.addEventListener('click', function(){
    var p = Math.ceil(filteredCourses().length/PAGE_SIZE);
    if(state.page<p){state.page++; renderGrid();}
  });
}

/* ===== NAV ===== */
function initNav() {
  var ham = qs('.hamburger');
  var nav = qs('.nav');
  if (ham && nav) ham.addEventListener('click', function(){ nav.classList.toggle('open'); });
  var modal = qs('#courseModal');
  var closeBtn = modal && modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', function(e){ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });
  qsa('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth'}); if(nav) nav.classList.remove('open'); }
    });
  });
}

/* ===== BACK TO TOP ===== */
function initBackToTop() {
  var btn = qs('#backToTop');
  if (!btn) return;
  window.addEventListener('scroll', function(){ btn.classList.toggle('show', window.scrollY > 400); });
  btn.addEventListener('click', function(){ window.scrollTo({top:0,behavior:'smooth'}); });
}

/* ===== FLOATING EMOJIS ===== */
function generateEmojis() {
  var container = qs('#floatingEmojis');
  if (!container) return;
  var emojis = ['🌟','🎮','🔢','📚','🎨','🎵','🔬','⚽','🌍','💻','🏆','❤️','🎯','🌈'];
  for (var i = 0; i < 18; i++) {
    var el = document.createElement('span');
    el.className = 'float-emoji';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + '%';
    el.style.animationDuration = (Math.random()*15+10) + 's';
    el.style.animationDelay    = (Math.random()*10) + 's';
    container.appendChild(el);
  }
}

/* ===== PIXEL STARS ===== */
function generateStars() {
  var container = qs('#floatingEmojis');
  if (!container) return;
  var colors = ['#FFE000','#39FF14','#00F8FF','#FF80EE','#ffffff'];
  for (var i = 0; i < 60; i++) {
    var s = document.createElement('span');
    var size = Math.random()*2+1;
    s.style.cssText = 'position:absolute;left:' + (Math.random()*100) + '%;top:' + (Math.random()*100) + '%;width:' + size + 'px;height:' + size + 'px;background:' + colors[Math.floor(Math.random()*colors.length)] + ';opacity:' + (Math.random()*0.35+0.05) + ';animation:blink ' + (Math.random()*3+2) + 's step-end infinite;animation-delay:' + (Math.random()*3) + 's;pointer-events:none;';
    container.appendChild(s);
  }
}

/* ===== REVEAL ===== */
function initReveal() {
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  qsa('.reveal').forEach(function(el){ obs.observe(el); });
}

/* ===== INIT ===== */
function initAll() {
  generateStars();
  generateEmojis();
  initNav();
  initControls();
  renderGrid();
  renderTemporales();
  initBackToTop();
  initReveal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}