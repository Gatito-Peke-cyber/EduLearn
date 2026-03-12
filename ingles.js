/* =====================================================
   EduLearn — Inglés A1 — JS v1.4 — Cross-device sync fix
   CAMBIOS v1.4:
   - FIX 1: onAuthStateChanged para esperar sesión antes
     de sincronizar (evita getCurrentUID() = null al cargar)
   - FIX 2: syncXPToProfile ahora es async y secuencial:
     primero enrollCourse, luego updateExamResult (evita
     race condition que causaba error "document not found")
   - FIX 3: Firebase calls encadenados correctamente
   - FIX 4: Nota final siempre se registra en perfil
     e inscripciones (local + Firebase)
   ===================================================== */

/* ===== LOADER IIFE — se ejecuta INMEDIATAMENTE ===== */
(function () {
  function hideLoader() {
    var l = document.getElementById('pageLoader');
    if (l) l.style.display = 'none';
  }
  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 3000);
  }
})();

/* ===== FIREBASE — carga dinámica no-bloqueante ===== */
let _auth = null;
let _db   = null;
let _enrollCourseDB     = null;
let _updateExamResultDB = null;
let _updateUserProfileDB = null;

Promise.all([
  import('./firebase.js'),
  import('./database.js'),
]).then(([fbMod, dbMod]) => {
  _auth                = fbMod.auth                                          || null;
  _db                  = fbMod.db                                            || null;
  _enrollCourseDB      = dbMod.enrollCourse      || dbMod.enrollCourseDB     || null;
  _updateExamResultDB  = dbMod.updateExamResult  || dbMod.updateExamResultDB || null;
  _updateUserProfileDB = dbMod.updateUserProfile || dbMod.saveFullProfile    || null;

  /* ── FIX 1: Esperar a que Firebase confirme la sesión
     antes de intentar sincronizar el estado del curso.
     onAuthStateChanged se dispara inmediatamente con el
     estado actual, por lo que no hay delay perceptible. ── */
  if (_auth) {
    import('https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js')
      .then(function(authMod) {
        /* Suscribirse una sola vez al estado de autenticación */
        var unsub = authMod.onAuthStateChanged(_auth, function(user) {
          if (user) {
            _syncCourseStateFromFirebase();
          }
          /* Cancelar la suscripción — solo necesitamos el primer evento */
          unsub();
        });
      })
      .catch(function(err) {
        console.warn('[Ingles] Auth listener error:', err);
      });
  }
}).catch(function(err) {
  console.warn('[Ingles] Firebase no disponible, modo offline:', err);
});

function getCurrentUID() {
  return (_auth && _auth.currentUser) ? _auth.currentUser.uid : null;
}

/* =====================================================
   SINCRONIZACIÓN DEL ESTADO DEL CURSO (cross-device)
   Colección: "curso_estado/{uid}/cursos/{cursoId}"
   ===================================================== */

async function _saveCourseStateToFirebase(state) {
  var uid = getCurrentUID();
  if (!uid || !_db) return;
  try {
    var fsModule = await import(
      'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js'
    );
    await fsModule.setDoc(
      fsModule.doc(_db, 'curso_estado', uid, 'cursos', COURSE.id),
      Object.assign({}, state, { updatedAt: fsModule.serverTimestamp() }),
      { merge: true }
    );
  } catch (err) {
    console.warn('[Ingles] saveCourseState error:', err);
  }
}

async function _syncCourseStateFromFirebase() {
  var uid = getCurrentUID();
  if (!uid || !_db) return;
  try {
    var fsModule = await import(
      'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js'
    );
    var snap = await fsModule.getDoc(
      fsModule.doc(_db, 'curso_estado', uid, 'cursos', COURSE.id)
    );
    if (!snap.exists()) return;

    var remote = snap.data();
    var local  = getState();
    var merged = _mergeStates(local, remote);
    saveState(merged);

    if (typeof renderIndex === 'function') renderIndex();
  } catch (err) {
    console.warn('[Ingles] syncCourseState error:', err);
  }
}

function _mergeStates(local, remote) {
  var merged = {
    xp: Math.max(local.xp || 0, remote.xp || 0),
    completedLessons:   Object.assign({}, remote.completedLessons,  local.completedLessons),
    completedUnitExams: Object.assign({}, remote.completedUnitExams, local.completedUnitExams),
    finalExamDone:   (local.finalExamDone   || remote.finalExamDone   || false),
    finalApproved:   (local.finalApproved   || remote.finalApproved   || false),
    finalGrade: null,
  };

  var localGrade  = typeof local.finalGrade  === 'number' ? local.finalGrade  : -1;
  var remoteGrade = typeof remote.finalGrade === 'number' ? remote.finalGrade : -1;
  merged.finalGrade = Math.max(localGrade, remoteGrade);
  if (merged.finalGrade < 0) merged.finalGrade = null;

  return merged;
}

/* ===================================================
   ★ CONFIGURACIÓN ★
   =================================================== */
var FINAL_EXAM_COOLDOWN_DAYS = 3;

/* ===== COURSE DATA ===== */
var COURSE = {
  id: "ingles_a1",
  title: "Inglés A1",
  icon: "🇺🇸",
  totalXP: 900,
  passingScore: 60,
  finalPassingGrade: 17,

  units: [
    /* ══════════════════════ UNIDAD 1 ══════════════════════ */
    {
      id: "u1", title: "Greetings & Introductions", icon: "👋",
      lessons: [
        {
          id: "u1l1", title: "Basic Greetings", icon: "😊", xp: 20,
          content: {
            intro: "In English, greetings depend on the time of day and how well you know someone. Let's learn the most important ones!",
            sections: [
              { title: "FORMAL GREETINGS", type: "vocab", items: [
                { en: "Good morning", pron: "/gʊd ˈmɔːrnɪŋ/", es: "Buenos días" },
                { en: "Good afternoon", pron: "/gʊd ˌæftərˈnuːn/", es: "Buenas tardes" },
                { en: "Good evening", pron: "/gʊd ˈiːvnɪŋ/", es: "Buenas noches (saludo)" },
                { en: "Good night", pron: "/gʊd naɪt/", es: "Buenas noches (despedida)" },
              ]},
              { title: "INFORMAL GREETINGS", type: "vocab", items: [
                { en: "Hello / Hi", pron: "/həˈloʊ/ /haɪ/", es: "Hola" },
                { en: "Hey!", pron: "/heɪ/", es: "¡Ey! / ¡Hola!" },
                { en: "How are you?", pron: "/haʊ ɑːr juː/", es: "¿Cómo estás?" },
                { en: "I'm fine, thanks!", pron: "/aɪm faɪn θæŋks/", es: "¡Estoy bien, gracias!" },
              ]},
              { title: "EXAMPLE DIALOGUES", type: "examples", items: [
                { en: "A: Good morning! How are you?\nB: I'm fine, thanks! And you?", es: "A: ¡Buenos días! ¿Cómo estás?\nB: ¡Estoy bien, gracias! ¿Y tú?" },
                { en: "A: Hi! How are you doing?\nB: Pretty good, thanks!", es: "A: ¡Hola! ¿Cómo te va?\nB: ¡Bastante bien, gracias!" },
              ]},
              { title: "💡 TIP", type: "tip", text: "Use 'Hi' or 'Hey' with friends. Use 'Good morning/afternoon' with teachers, bosses or strangers." }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'Buenos días' en inglés?", opts: ["Good morning","Good night","Good evening","Hello"], ans: 0 },
            { q: "¿Qué significa 'How are you?'", opts: ["¿Quién eres?","¿Cómo te llamas?","¿Cómo estás?","¿Dónde estás?"], ans: 2 },
            { q: "¿Cuál es el saludo INFORMAL?", opts: ["Good morning","Good afternoon","Hey!","Good evening"], ans: 2 },
            { q: "A: 'Hello!' — B: ___", opts: ["Good night!","Hi! How are you?","My name is Ana","I am fine"], ans: 1 },
            { q: "'Good night' se usa para:", opts: ["Saludar de mañana","Saludar en la tarde","Despedirse al dormir","Saludar formalmente"], ans: 2 },
          ]
        },
        {
          id: "u1l2", title: "Introducing Yourself", icon: "🙋", xp: 25,
          content: {
            intro: "Now let's learn how to tell people who you are — your name, age, nationality and more!",
            sections: [
              { title: "MY INFORMATION", type: "vocab", items: [
                { en: "My name is ___", pron: "/maɪ neɪm ɪz/", es: "Mi nombre es ___" },
                { en: "I am ___ years old", pron: "/aɪ æm/", es: "Tengo ___ años" },
                { en: "I am from ___", pron: "/aɪ æm frɒm/", es: "Soy de ___" },
                { en: "I live in ___", pron: "/aɪ lɪv ɪn/", es: "Vivo en ___" },
                { en: "Nice to meet you!", pron: "/naɪs tə miːt juː/", es: "¡Mucho gusto!" },
              ]},
              { title: "ASKING QUESTIONS", type: "vocab", items: [
                { en: "What is your name?", pron: "/wɒt ɪz jɔːr neɪm/", es: "¿Cómo te llamas?" },
                { en: "How old are you?", pron: "/haʊ oʊld ɑːr juː/", es: "¿Cuántos años tienes?" },
                { en: "Where are you from?", pron: "/wer ɑːr juː frɒm/", es: "¿De dónde eres?" },
                { en: "Where do you live?", pron: "/wer duː juː lɪv/", es: "¿Dónde vives?" },
              ]},
              { title: "EXAMPLE DIALOGUES", type: "examples", items: [
                { en: "A: What is your name?\nB: My name is Carlos. Nice to meet you!\nA: Nice to meet you too!", es: "A: ¿Cómo te llamas?\nB: Me llamo Carlos. ¡Mucho gusto!\nA: ¡Igualmente!" },
                { en: "A: How old are you?\nB: I am 15 years old.\nA: Where are you from?\nB: I am from Peru.", es: "A: ¿Cuántos años tienes?\nB: Tengo 15 años.\nA: ¿De dónde eres?\nB: Soy de Perú." },
              ]},
              { title: "💡 TIP", type: "tip", text: "In English, 'I' is ALWAYS a capital letter. Always! I am, I live, I have..." }
            ]
          },
          exam: [
            { q: "¿Cómo preguntas el nombre de alguien?", opts: ["Where are you from?","What is your name?","How old are you?","Nice to meet you!"], ans: 1 },
            { q: "¿Cómo dices '¡Mucho gusto!' en inglés?", opts: ["See you later!","Good morning!","Nice to meet you!","Thank you!"], ans: 2 },
            { q: "Completa: 'My name ___ Carlos'", opts: ["are","am","is","be"], ans: 2 },
            { q: "¿Qué significa 'I am from Peru'?", opts: ["Vivo en Perú","Soy de Perú","Voy a Perú","Conozco Perú"], ans: 1 },
            { q: "'How old are you?' — You respond:", opts: ["I am from Lima","I am a student","I am 14 years old","My name is Ana"], ans: 2 },
          ]
        }
      ],
      exam: [
        { q: "Ana says to her teacher at 8am: '___'", opts: ["Good night!","Good evening!","Good morning!","See you!"], ans: 2 },
        { q: "¿Cuál oración presenta correctamente a alguien?", opts: ["My name are Pedro","Me name is Pedro","My name is Pedro","I name Pedro"], ans: 2 },
        { q: "'Nice to meet you' — La respuesta correcta es:", opts: ["Good morning!","Nice to meet you too!","I am fine!","See you later!"], ans: 1 },
        { q: "Para preguntar de dónde es alguien usas:", opts: ["How old are you?","What is your name?","Where are you from?","How are you?"], ans: 2 },
        { q: "'I ___ 16 years old'", opts: ["are","is","be","am"], ans: 3 },
        { q: "¿Qué saludo usa Tom con su jefe a las 3pm?", opts: ["Hey boss!","Good morning boss!","Good afternoon boss!","Hi boss!"], ans: 2 },
        { q: "¿Cuál es INFORMAL?", opts: ["Good morning","Good afternoon","Hey! How are you?","Good evening"], ans: 2 },
        { q: "'Where do you ___?' — pregunta dónde vives", opts: ["from","live","go","stay"], ans: 1 },
      ]
    },

    /* ══════════════════════ UNIDAD 2 ══════════════════════ */
    {
      id: "u2", title: "Numbers & Colors", icon: "🔢",
      lessons: [
        {
          id: "u2l1", title: "Numbers 1-20", icon: "🔢", xp: 20,
          content: {
            intro: "Numbers are essential in English! Let's learn to count from 1 to 20.",
            sections: [
              { title: "NUMBERS 1-10", type: "vocab", items: [
                { en: "One / Two / Three", pron: "/wʌn/ /tuː/ /θriː/", es: "1 / 2 / 3" },
                { en: "Four / Five / Six", pron: "/fɔːr/ /faɪv/ /sɪks/", es: "4 / 5 / 6" },
                { en: "Seven / Eight / Nine", pron: "/ˈsevən/ /eɪt/ /naɪn/", es: "7 / 8 / 9" },
                { en: "Ten", pron: "/ten/", es: "10" },
              ]},
              { title: "NUMBERS 11-20", type: "vocab", items: [
                { en: "Eleven / Twelve", pron: "/ɪˈlevən/ /twelv/", es: "11 / 12" },
                { en: "Thirteen / Fourteen / Fifteen", pron: "/-tiːn/", es: "13 / 14 / 15" },
                { en: "Sixteen / Seventeen / Eighteen", pron: "/-tiːn/", es: "16 / 17 / 18" },
                { en: "Nineteen / Twenty", pron: "/ˈnaɪntiːn/ /ˈtwenti/", es: "19 / 20" },
              ]},
              { title: "EXAMPLE USES", type: "examples", items: [
                { en: "I have two cats.", es: "Tengo dos gatos." },
                { en: "She is fifteen years old.", es: "Ella tiene quince años." },
                { en: "There are twenty students in my class.", es: "Hay veinte estudiantes en mi clase." },
              ]},
              { title: "💡 TIP", type: "tip", text: "Numbers 13-19 end in '-teen'. Twenty is special — memorize it! After 20: twenty-one, twenty-two, etc." }
            ]
          },
          exam: [
            { q: "¿Cómo se escribe el número 15?", opts: ["Fifty","Fifteen","Five","Fiveteen"], ans: 1 },
            { q: "¿Cuánto es 'twelve'?", opts: ["20","11","12","13"], ans: 2 },
            { q: "'I have ___ fingers.' (10)", opts: ["teen","twelve","ten","two"], ans: 2 },
            { q: "¿Cómo se dice 17?", opts: ["Seven","Seventy","Seventeen","Seventh"], ans: 2 },
            { q: "One, two, three, ___, five", opts: ["four","forty","fore","for"], ans: 0 },
          ]
        },
        {
          id: "u2l2", title: "Colors & Descriptions", icon: "🎨", xp: 20,
          content: {
            intro: "Colors help us describe the world around us! Let's paint our English vocabulary.",
            sections: [
              { title: "BASIC COLORS", type: "vocab", items: [
                { en: "Red / Blue / Yellow", pron: "/red/ /bluː/ /ˈjeloʊ/", es: "Rojo / Azul / Amarillo" },
                { en: "Green / Orange / Purple", pron: "/ɡriːn/ /ˈɒrɪndʒ/ /ˈpɜːrpl/", es: "Verde / Naranja / Morado" },
                { en: "Black / White / Brown", pron: "/blæk/ /waɪt/ /braʊn/", es: "Negro / Blanco / Marrón" },
                { en: "Pink / Grey / Gold", pron: "/pɪŋk/ /ɡreɪ/ /ɡoʊld/", es: "Rosa / Gris / Dorado" },
              ]},
              { title: "USING COLORS", type: "examples", items: [
                { en: "The sky is blue.", es: "El cielo es azul." },
                { en: "My car is red.", es: "Mi auto es rojo." },
                { en: "What color is it? — It's green!", es: "¿De qué color es? — ¡Es verde!" },
                { en: "I like purple and gold.", es: "Me gusta el morado y el dorado." },
              ]},
              { title: "💡 TIP", type: "tip", text: "In English, adjectives go BEFORE the noun: 'a red car' (NOT 'a car red'). Colors are adjectives!" }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'amarillo' en inglés?", opts: ["Orange","Green","Yellow","Blue"], ans: 2 },
            { q: "The sky is ___", opts: ["red","blue","green","black"], ans: 1 },
            { q: "¿Cuál es el orden correcto?", opts: ["a car red","red a car","a red car","car red a"], ans: 2 },
            { q: "'What color is it?' — respuesta correcta:", opts: ["It is blue!","Blue it is!","Is blue it!","It blue is!"], ans: 0 },
            { q: "¿Qué color es 'negro' en inglés?", opts: ["White","Brown","Grey","Black"], ans: 3 },
          ]
        }
      ],
      exam: [
        { q: "Count: one, ___, three, four", opts: ["eleven","two","twoo","twice"], ans: 1 },
        { q: "'The grass is ___'", opts: ["red","blue","green","orange"], ans: 2 },
        { q: "Dieciséis en inglés:", opts: ["Sixty","Six","Sixteen","Sixty-six"], ans: 2 },
        { q: "¿Cuál usa el color correctamente?", opts: ["A car blue","Blue a car","A blue car","Car a blue"], ans: 2 },
        { q: "One + one = ___", opts: ["Three","One","Two","Four"], ans: 2 },
        { q: "¿Qué color es el sol?", opts: ["Purple","Yellow","Red","Green"], ans: 1 },
        { q: "Veinte en inglés:", opts: ["Twelve","Tweny","Twenty","Twen"], ans: 2 },
        { q: "My favorite color ___ red.", opts: ["are","am","be","is"], ans: 3 },
      ]
    },

    /* ══════════════════════ UNIDAD 3 ══════════════════════ */
    {
      id: "u3", title: "My Family & Friends", icon: "👨‍👩‍👧‍👦",
      lessons: [
        {
          id: "u3l1", title: "Family Members", icon: "👨‍👩‍👧", xp: 25,
          content: {
            intro: "Family is very important. Let's learn the English words for family members!",
            sections: [
              { title: "IMMEDIATE FAMILY", type: "vocab", items: [
                { en: "Mother / Mom", pron: "/ˈmʌðər/ /mɒm/", es: "Madre / Mamá" },
                { en: "Father / Dad", pron: "/ˈfɑːðər/ /dæd/", es: "Padre / Papá" },
                { en: "Brother / Sister", pron: "/ˈbrʌðər/ /ˈsɪstər/", es: "Hermano / Hermana" },
                { en: "Son / Daughter", pron: "/sʌn/ /ˈdɔːtər/", es: "Hijo / Hija" },
              ]},
              { title: "EXTENDED FAMILY", type: "vocab", items: [
                { en: "Grandmother / Grandfather", pron: "/ˈɡrænmʌðər/ /ˈɡrænfɑːðər/", es: "Abuela / Abuelo" },
                { en: "Aunt / Uncle", pron: "/ænt/ /ˈʌŋkl/", es: "Tía / Tío" },
                { en: "Cousin", pron: "/ˈkʌzn/", es: "Primo/a" },
                { en: "Parents", pron: "/ˈperənts/", es: "Padres (mamá y papá)" },
              ]},
              { title: "TALKING ABOUT FAMILY", type: "examples", items: [
                { en: "I have one brother and two sisters.", es: "Tengo un hermano y dos hermanas." },
                { en: "My mother's name is María.", es: "El nombre de mi madre es María." },
                { en: "Do you have any brothers or sisters?", es: "¿Tienes hermanos o hermanas?" },
              ]},
              { title: "💡 TIP", type: "tip", text: "Use 'have/has' for family: 'I have a sister' / 'She has two brothers'. Plural: brothers, sisters, cousins." }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'hermana' en inglés?", opts: ["Brother","Cousin","Sister","Daughter"], ans: 2 },
            { q: "¿Qué significa 'parents'?", opts: ["Primos","Padres (mamá y papá)","Abuelos","Tíos"], ans: 1 },
            { q: "'I ___ two brothers.'", opts: ["is","has","have","are"], ans: 2 },
            { q: "¿Cómo se dice 'abuelo'?", opts: ["Uncle","Grandfather","Father","Dad"], ans: 1 },
            { q: "La hija de mis tíos es mi ___", opts: ["Sister","Daughter","Cousin","Aunt"], ans: 2 },
          ]
        },
        {
          id: "u3l2", title: "Describing People", icon: "🌟", xp: 25,
          content: {
            intro: "How do you describe yourself and others? Let's learn adjectives for people!",
            sections: [
              { title: "PHYSICAL DESCRIPTIONS", type: "vocab", items: [
                { en: "Tall / Short", pron: "/tɔːl/ /ʃɔːrt/", es: "Alto/a / Bajo/a" },
                { en: "Thin / Fat / Slim", pron: "/θɪn/ /fæt/ /slɪm/", es: "Delgado / Gordo / Esbelto" },
                { en: "Young / Old", pron: "/jʌŋ/ /oʊld/", es: "Joven / Viejo" },
                { en: "Beautiful / Handsome / Pretty", pron: "/ˈbjuːtɪfl/ /ˈhænsəm/ /ˈprɪti/", es: "Hermosa / Guapo / Bonita" },
              ]},
              { title: "PERSONALITY TRAITS", type: "vocab", items: [
                { en: "Kind / Nice / Friendly", pron: "/kaɪnd/ /naɪs/ /ˈfrendli/", es: "Amable / Agradable / Amistoso" },
                { en: "Smart / Intelligent", pron: "/smɑːrt/ /ɪnˈtelɪdʒənt/", es: "Listo / Inteligente" },
                { en: "Funny / Serious", pron: "/ˈfʌni/ /ˈsɪriəs/", es: "Gracioso / Serio" },
                { en: "Shy / Brave", pron: "/ʃaɪ/ /breɪv/", es: "Tímido / Valiente" },
              ]},
              { title: "DESCRIBING WITH 'TO BE'", type: "examples", items: [
                { en: "She is tall and beautiful.", es: "Ella es alta y hermosa." },
                { en: "My brother is funny and smart.", es: "Mi hermano es gracioso e inteligente." },
                { en: "He is not shy, he is brave!", es: "Él no es tímido, ¡es valiente!" },
              ]},
              { title: "💡 TIP", type: "tip", text: "To be NEGATIVE: I am NOT tall. She is NOT old. He is NOT shy. Use 'not' after 'am/is/are'!" }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'inteligente'?", opts: ["Funny","Smart","Kind","Brave"], ans: 1 },
            { q: "'She ___ tall and pretty.'", opts: ["are","have","am","is"], ans: 3 },
            { q: "¿Qué significa 'shy'?", opts: ["Valiente","Gracioso","Tímido","Amable"], ans: 2 },
            { q: "Forma NEGATIVA: 'He ___ old.'", opts: ["is not","not is","no is","isn't be"], ans: 0 },
            { q: "¿Cuál describe PERSONALIDAD?", opts: ["Tall","Blue eyes","Friendly","Short"], ans: 2 },
          ]
        }
      ],
      exam: [
        { q: "¿Cómo se dice 'tío'?", opts: ["Cousin","Brother","Uncle","Grandfather"], ans: 2 },
        { q: "She is ___ and kind.", opts: ["beautiful","beauty","beautifully","beautious"], ans: 0 },
        { q: "'I have ___ sister.' (1 hermana)", opts: ["a one","a","one a","the"], ans: 1 },
        { q: "¿Opuesto de 'tall'?", opts: ["Big","Fat","Short","Thin"], ans: 2 },
        { q: "'My ___ name is María.' (madre)", opts: ["father's","brother's","sister's","mother's"], ans: 3 },
        { q: "He is ___ shy. He is brave!", opts: ["no","not","don't","doesn't"], ans: 1 },
        { q: "Hermano en inglés:", opts: ["Sister","Cousin","Brother","Father"], ans: 2 },
        { q: "¿Cuál oración es CORRECTA?", opts: ["She funny is","She is funny","Is she funny be","Funny she is"], ans: 1 },
      ]
    },

    /* ══════════════════════ UNIDAD 4 ══════════════════════ */
    {
      id: "u4", title: "Daily Routines", icon: "📅",
      lessons: [
        {
          id: "u4l1", title: "Present Simple Tense", icon: "⏰", xp: 30,
          content: {
            intro: "The Present Simple is used for habits, routines and facts. It's the most important tense in English!",
            sections: [
              { title: "PRESENT SIMPLE STRUCTURE", type: "vocab", items: [
                { en: "I / You / We / They + verb", pron: "", es: "Yo / Tú / Nosotros / Ellos + verbo" },
                { en: "He / She / It + verb + S", pron: "", es: "Él / Ella / Eso + verbo + S" },
                { en: "I eat. / She eats.", pron: "/iːt/ /iːts/", es: "Yo como. / Ella come." },
                { en: "They work. / He works.", pron: "/wɜːrk/ /wɜːrks/", es: "Ellos trabajan. / Él trabaja." },
              ]},
              { title: "COMMON VERBS", type: "vocab", items: [
                { en: "Wake up / Sleep", pron: "/weɪk ʌp/ /sliːp/", es: "Despertar / Dormir" },
                { en: "Eat / Drink", pron: "/iːt/ /drɪŋk/", es: "Comer / Beber" },
                { en: "Go to school / Work", pron: "/ɡoʊ tə skuːl/ /wɜːrk/", es: "Ir al colegio / Trabajar" },
                { en: "Study / Play / Watch TV", pron: "/ˈstʌdi/ /pleɪ/ /wɒtʃ/", es: "Estudiar / Jugar / Ver TV" },
              ]},
              { title: "EXAMPLES", type: "examples", items: [
                { en: "I wake up at 7 o'clock every day.", es: "Me despierto a las 7 todos los días." },
                { en: "She studies English every night.", es: "Ella estudia inglés todas las noches." },
                { en: "We play football on Sundays.", es: "Jugamos fútbol los domingos." },
              ]},
              { title: "💡 TIP", type: "tip", text: "When the subject is he/she/it, add -S or -ES to the verb! Eat→eats, watch→watches, study→studies" }
            ]
          },
          exam: [
            { q: "'She ___ English every day.'", opts: ["study","studies","studys","studying"], ans: 1 },
            { q: "¿Cuándo usamos el Present Simple?", opts: ["Acciones pasadas","Hábitos y rutinas","Acciones del futuro","Acciones en progreso"], ans: 1 },
            { q: "'I ___ to school at 7am.'", opts: ["goes","going","go","went"], ans: 2 },
            { q: "¿Cuál es CORRECTA?", opts: ["He eat lunch","He eats lunch","He eating lunch","He eaten lunch"], ans: 1 },
            { q: "Verb: WATCH → He ___", opts: ["watchs","watchies","watches","watch"], ans: 2 },
          ]
        },
        {
          id: "u4l2", title: "Time & Daily Activities", icon: "🕐", xp: 30,
          content: {
            intro: "Let's talk about time and what we do each day! Schedules and routines in English.",
            sections: [
              { title: "TELLING TIME", type: "vocab", items: [
                { en: "It's one o'clock / 1:00", pron: "/wʌn əˈklɒk/", es: "Es la una en punto" },
                { en: "It's half past two / 2:30", pron: "/hɑːf pɑːst tuː/", es: "Son las dos y media" },
                { en: "It's quarter past three / 3:15", pron: "/ˈkwɔːrtər pɑːst/", es: "Son las tres y cuarto" },
                { en: "At 7 o'clock / In the morning", pron: "", es: "A las 7 / Por la mañana" },
              ]},
              { title: "DAILY ROUTINE PHRASES", type: "vocab", items: [
                { en: "I wake up at 6am", pron: "", es: "Me despierto a las 6am" },
                { en: "I have breakfast / lunch / dinner", pron: "", es: "Desayuno / almuerzo / ceno" },
                { en: "I go to bed at 10pm", pron: "", es: "Me voy a dormir a las 10pm" },
                { en: "Every day / On Mondays / At the weekend", pron: "", es: "Todos los días / Los lunes / El fin de semana" },
              ]},
              { title: "MY ROUTINE", type: "examples", items: [
                { en: "I wake up at 7:00. I have breakfast at 7:30.", es: "Me despierto a las 7:00. Desayuno a las 7:30." },
                { en: "I go to school at 8:00 every morning.", es: "Voy al colegio a las 8:00 cada mañana." },
                { en: "In the evening, I study and watch TV.", es: "Por la tarde, estudio y veo TV." },
              ]},
              { title: "💡 TIP", type: "tip", text: "Use 'at' for specific times (at 7am), 'in' for morning/afternoon/evening, 'on' for days (on Monday)!" }
            ]
          },
          exam: [
            { q: "¿Cómo se dice '2:30' en inglés?", opts: ["Half past three","Two thirty","Half past two","Quarter past two"], ans: 2 },
            { q: "'I go to school ___ 8 o'clock.'", opts: ["in","on","at","by"], ans: 2 },
            { q: "¿Qué hace 'have breakfast'?", opts: ["Comer almuerzo","Comer cena","Tomar desayuno","Tomar merienda"], ans: 2 },
            { q: "'___ the evening, I study.'", opts: ["At","On","In","By"], ans: 2 },
            { q: "I go to school ___ Mondays.", opts: ["at","in","on","by"], ans: 2 },
          ]
        }
      ],
      exam: [
        { q: "'She ___ TV every night.' (ver)", opts: ["watch","watchs","watches","watching"], ans: 2 },
        { q: "¿Cómo se dice 'en punto' en las horas?", opts: ["half past","o'clock","quarter past","past"], ans: 1 },
        { q: "'I have lunch ___ noon.'", opts: ["on","in","at","by"], ans: 2 },
        { q: "¿Cuál usa CORRECTLY el present simple?", opts: ["She gos","He go","They goes","He goes"], ans: 3 },
        { q: "My sister ___ up at 6am.", opts: ["wake","wakes","waking","woke"], ans: 1 },
        { q: "¿Cuándo usamos 'on'?", opts: ["Horas (at 7)","Mañana/tarde","Días (Monday)","Estaciones"], ans: 2 },
        { q: "It's ___ past three. (3:15)", opts: ["half","quarter","three","thirty"], ans: 1 },
        { q: "We ___ football on Sundays.", opts: ["plays","playing","play","played"], ans: 2 },
      ]
    },

    /* ══════════════════════ UNIDAD 5 ══════════════════════ */
    {
      id: "u5", title: "Food & Drinks", icon: "🍎",
      lessons: [
        {
          id: "u5l1", title: "Food Vocabulary", icon: "🍕", xp: 30,
          content: {
            intro: "Food is a universal language! Let's learn how to talk about what we eat and drink in English.",
            sections: [
              { title: "FRUITS & VEGETABLES", type: "vocab", items: [
                { en: "Apple / Banana / Orange", pron: "/ˈæpl/ /bəˈnɑːnə/ /ˈɒrɪndʒ/", es: "Manzana / Plátano / Naranja" },
                { en: "Tomato / Potato / Carrot", pron: "/təˈmeɪtoʊ/ /pəˈteɪtoʊ/ /ˈkærət/", es: "Tomate / Papa / Zanahoria" },
                { en: "Lettuce / Onion / Garlic", pron: "/ˈletɪs/ /ˈʌnjən/ /ˈɡɑːrlɪk/", es: "Lechuga / Cebolla / Ajo" },
              ]},
              { title: "MEALS & DRINKS", type: "vocab", items: [
                { en: "Bread / Rice / Pasta", pron: "/bred/ /raɪs/ /ˈpæstə/", es: "Pan / Arroz / Pasta" },
                { en: "Chicken / Fish / Beef", pron: "/ˈtʃɪkɪn/ /fɪʃ/ /biːf/", es: "Pollo / Pescado / Res/Carne" },
                { en: "Water / Juice / Milk / Coffee", pron: "/ˈwɔːtər/ /dʒuːs/ /mɪlk/ /ˈkɒfi/", es: "Agua / Jugo / Leche / Café" },
                { en: "Tea / Soda / Beer", pron: "/tiː/ /ˈsoʊdə/ /bɪər/", es: "Té / Gaseosa / Cerveza" },
              ]},
              { title: "TALKING ABOUT FOOD", type: "examples", items: [
                { en: "I like pizza but I don't like fish.", es: "Me gusta la pizza pero no me gusta el pescado." },
                { en: "What would you like to eat? — I'd like a sandwich.", es: "¿Qué te gustaría comer? — Me gustaría un sándwich." },
                { en: "Do you want some coffee? — Yes, please! / No, thank you.", es: "¿Quieres café? — ¡Sí, por favor! / No, gracias." },
              ]},
              { title: "💡 TIP", type: "tip", text: "'I like' = me gusta en general. 'I would like' (I'd like) = me gustaría ahora. 'Do you want...?' is more informal." }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'manzana' en inglés?", opts: ["Orange","Banana","Apple","Avocado"], ans: 2 },
            { q: "'Do you want some ___?' (agua)", opts: ["milk","water","juice","coffee"], ans: 1 },
            { q: "Para decir que NO te gusta algo:", opts: ["I like not fish","I no like fish","I don't like fish","I not fish"], ans: 2 },
            { q: "'I ___ like a sandwich.' (pedido educado)", opts: ["want","would","do","could"], ans: 1 },
            { q: "¿Cuál es una BEBIDA?", opts: ["Chicken","Bread","Juice","Carrot"], ans: 2 },
          ]
        },
        {
          id: "u5l2", title: "At the Restaurant", icon: "🍽️", xp: 35,
          content: {
            intro: "Ordering food in English is a very practical skill. Let's learn useful phrases for restaurants and cafes!",
            sections: [
              { title: "RESTAURANT PHRASES", type: "vocab", items: [
                { en: "A table for two, please.", pron: "/ə ˈteɪbl fər tuː/", es: "Una mesa para dos, por favor." },
                { en: "Can I see the menu?", pron: "/kæn aɪ siː ðə ˈmenjuː/", es: "¿Puedo ver el menú?" },
                { en: "I'd like to order...", pron: "/aɪd laɪk tə ˈɔːrdər/", es: "Quisiera ordenar..." },
                { en: "Can I have the bill, please?", pron: "/kæn aɪ hæv ðə bɪl/", es: "¿Me puede dar la cuenta, por favor?" },
              ]},
              { title: "DESCRIBING FOOD", type: "vocab", items: [
                { en: "Delicious / Tasty / Yummy", pron: "/dɪˈlɪʃəs/ /ˈteɪsti/ /ˈjʌmi/", es: "Delicioso / Sabroso / Rico" },
                { en: "Salty / Sweet / Spicy / Sour", pron: "/ˈsɔːlti/ /swiːt/ /ˈspaɪsi/ /saʊər/", es: "Salado / Dulce / Picante / Ácido" },
                { en: "Hot / Cold / Warm", pron: "/hɒt/ /koʊld/ /wɔːrm/", es: "Caliente / Frío / Tibio" },
              ]},
              { title: "DIALOGUE AT A RESTAURANT", type: "examples", items: [
                { en: "Waiter: Are you ready to order?\nCustomer: Yes! I'd like the pasta, please.\nWaiter: Anything to drink?\nCustomer: A glass of water, please.", es: "Mesero: ¿Listos para ordenar?\nCliente: ¡Sí! Quisiera la pasta, por favor.\nMesero: ¿Algo para tomar?\nCliente: Un vaso de agua, por favor." },
              ]},
              { title: "💡 TIP", type: "tip", text: "In English restaurants, say 'Excuse me!' to call the waiter — NOT 'Hey!' That's rude. Use 'Could I have...?' for polite requests." }
            ]
          },
          exam: [
            { q: "Para pedir la cuenta dices:", opts: ["I want money","Can I have the bill?","Give me the bill","Money please"], ans: 1 },
            { q: "¿Cómo describes algo muy sabroso?", opts: ["Spicy","Sour","Delicious","Cold"], ans: 2 },
            { q: "'A table ___ two, please.'", opts: ["of","to","for","from"], ans: 2 },
            { q: "El mesero pregunta '___?' para tomar la orden.", opts: ["Are you hungry?","Are you ready to order?","What do you want?","Do you like food?"], ans: 1 },
            { q: "'Could I ___ the menu, please?'", opts: ["see","want","like","have"], ans: 3 },
          ]
        }
      ],
      exam: [
        { q: "¿Cómo se dice 'pollo' en inglés?", opts: ["Fish","Beef","Chicken","Pork"], ans: 2 },
        { q: "'I ___ like some coffee.' (forma educada)", opts: ["want","would","do","could"], ans: 1 },
        { q: "Para llamar al mesero dices:", opts: ["Hey you!","Waiter waiter!","Excuse me!","Come here!"], ans: 2 },
        { q: "¿Cuál NO es una fruta?", opts: ["Apple","Orange","Carrot","Banana"], ans: 2 },
        { q: "The soup is ___. (caliente)", opts: ["cold","warm","hot","spicy"], ans: 2 },
        { q: "'I don't like ___.' (no me gusta el picante)", opts: ["spicy food","sweet food","hot food","cold food"], ans: 0 },
        { q: "Para pedir algo educadamente:", opts: ["Give me water","I want water","Could I have some water?","Water!"], ans: 2 },
        { q: "'The pizza is ___!' (deliciosa)", opts: ["sour","spicy","delicious","cold"], ans: 2 },
      ]
    },

    /* ══════════════════════ UNIDAD 6 ══════════════════════ */
    {
      id: "u6", title: "Places & Directions", icon: "🗺️",
      lessons: [
        {
          id: "u6l1", title: "Places in the City", icon: "🏙️", xp: 30,
          content: {
            intro: "Let's explore the city in English! Knowing the names of places will help you navigate and communicate.",
            sections: [
              { title: "PLACES IN TOWN", type: "vocab", items: [
                { en: "School / University", pron: "/skuːl/ /ˌjuːnɪˈvɜːrsɪti/", es: "Colegio / Universidad" },
                { en: "Hospital / Pharmacy", pron: "/ˈhɒspɪtl/ /ˈfɑːrməsi/", es: "Hospital / Farmacia" },
                { en: "Supermarket / Market", pron: "/ˈsuːpərmɑːrkɪt/ /ˈmɑːrkɪt/", es: "Supermercado / Mercado" },
                { en: "Bank / Post office", pron: "/bæŋk/ /poʊst ˈɒfɪs/", es: "Banco / Correos" },
                { en: "Park / Library / Museum", pron: "/pɑːrk/ /ˈlaɪbrəri/ /mjuːˈziːəm/", es: "Parque / Biblioteca / Museo" },
                { en: "Restaurant / Café / Hotel", pron: "/ˈrestrɒnt/ /kæˈfeɪ/ /hoʊˈtel/", es: "Restaurante / Café / Hotel" },
              ]},
              { title: "THERE IS / THERE ARE", type: "vocab", items: [
                { en: "There is a bank near here.", pron: "/ðer ɪz/", es: "Hay un banco cerca de aquí." },
                { en: "There are two parks in my city.", pron: "/ðer ɑːr/", es: "Hay dos parques en mi ciudad." },
                { en: "Is there a hospital?", pron: "/ɪz ðer ə/", es: "¿Hay un hospital?" },
              ]},
              { title: "EXAMPLES", type: "examples", items: [
                { en: "There is a supermarket on Main Street.", es: "Hay un supermercado en la calle principal." },
                { en: "Is there a pharmacy near here? Yes, there is!", es: "¿Hay una farmacia cerca? ¡Sí, hay una!" },
                { en: "There are many restaurants in the city center.", es: "Hay muchos restaurantes en el centro de la ciudad." },
              ]},
              { title: "💡 TIP", type: "tip", text: "There IS (singular): There is a school. There ARE (plural): There are two schools. ¡El verbo cambia con el número!" }
            ]
          },
          exam: [
            { q: "¿Cómo se dice 'biblioteca' en inglés?", opts: ["Museum","Park","Library","School"], ans: 2 },
            { q: "'___ is a hospital near here.'", opts: ["There are","There is","Is there","Are there"], ans: 1 },
            { q: "'There ___ three banks in my city.'", opts: ["is","are","be","has"], ans: 1 },
            { q: "Para preguntar si HAY algo:", opts: ["Where is...?","Is there a...?","There is a...?","Has there...?"], ans: 1 },
            { q: "¿Cuál es un lugar de la ciudad?", opts: ["Chicken","Library","Friendly","Tuesday"], ans: 1 },
          ]
        },
        {
          id: "u6l2", title: "Asking for Directions", icon: "🧭", xp: 35,
          content: {
            intro: "Getting lost? No problem! Learn how to ask for and give directions in English.",
            sections: [
              { title: "ASKING DIRECTIONS", type: "vocab", items: [
                { en: "Excuse me, where is the bank?", pron: "/ɪkˈskjuːz miː/", es: "Disculpe, ¿dónde está el banco?" },
                { en: "How do I get to...?", pron: "/haʊ duː aɪ ɡet tə/", es: "¿Cómo llego a...?" },
                { en: "Is it far from here?", pron: "/ɪz ɪt fɑːr/", es: "¿Está lejos de aquí?" },
                { en: "How long does it take?", pron: "/haʊ lɒŋ dʌz ɪt teɪk/", es: "¿Cuánto tiempo tarda?" },
              ]},
              { title: "GIVING DIRECTIONS", type: "vocab", items: [
                { en: "Turn left / Turn right", pron: "/tɜːrn left/ /tɜːrn raɪt/", es: "Gira a la izquierda / a la derecha" },
                { en: "Go straight ahead", pron: "/ɡoʊ streɪt əˈhed/", es: "Sigue recto / todo recto" },
                { en: "Cross the street / Take the bus", pron: "/krɒs ðə striːt/", es: "Cruza la calle / Toma el autobús" },
                { en: "It's next to / opposite / behind", pron: "/nekst tə/ /ˈɒpəzɪt/ /bɪˈhaɪnd/", es: "Está al lado de / enfrente de / detrás de" },
              ]},
              { title: "DIALOGUE: ASKING DIRECTIONS", type: "examples", items: [
                { en: "A: Excuse me! Where is the nearest supermarket?\nB: Go straight ahead, then turn right. It's next to the park.\nA: How far is it?\nB: About five minutes on foot.", es: "A: ¡Disculpe! ¿Dónde está el supermercado más cercano?\nB: Sigue recto, luego gira a la derecha. Está al lado del parque.\nA: ¿Qué tan lejos está?\nB: Unos cinco minutos a pie." },
              ]},
              { title: "💡 TIP", type: "tip", text: "Always start with 'Excuse me!' when asking a stranger for directions. It's polite and people will be more willing to help!" }
            ]
          },
          exam: [
            { q: "Para pedir indicaciones a un extraño dices:", opts: ["Hey!","Listen!","Excuse me!","Hello sir!"], ans: 2 },
            { q: "'Go ___ ahead.' (todo recto)", opts: ["left","right","straight","cross"], ans: 2 },
            { q: "¿Qué significa 'Turn left'?", opts: ["Sigue recto","Gira a la derecha","Para aquí","Gira a la izquierda"], ans: 3 },
            { q: "'It's ___ to the bank.' (al lado de)", opts: ["next","near","opposite","behind"], ans: 0 },
            { q: "'___ do I get to the museum?'", opts: ["Where","What","How","When"], ans: 2 },
          ]
        }
      ],
      exam: [
        { q: "¿Cómo se dice 'supermercado' en inglés?", opts: ["Market","Mall","Supermarket","Store"], ans: 2 },
        { q: "'___ are three banks in my city.'", opts: ["There is","There are","Is there","Are there"], ans: 1 },
        { q: "Para girar a la derecha:", opts: ["Turn left","Go straight","Turn right","Cross the street"], ans: 2 },
        { q: "'Excuse me, ___ is the hospital?'", opts: ["what","how","where","when"], ans: 2 },
        { q: "'It's ___ the park.' (enfrente del)", opts: ["next to","behind","opposite","near"], ans: 2 },
        { q: "¿Qué significa 'Is it far from here?'", opts: ["¿Dónde está?","¿Está lejos?","¿Cómo llego?","¿Cuánto cuesta?"], ans: 1 },
        { q: "'There ___ a museum on Park Street.'", opts: ["are","is","be","have"], ans: 1 },
        { q: "Sinónimo de 'Go straight ahead':", opts: ["Turn left","Continue forward","Turn right","Stop here"], ans: 1 },
      ]
    },
  ]
};

/* ===== FINAL EXAM ===== */
var FINAL_EXAM = [
  { q: "Complete: 'Good ___, Mr. Smith!' (9am)", opts: ["Night","Evening","Morning","Afternoon"], ans: 2 },
  { q: "'My name ___ Lucía. I am ___ Peru.'", opts: ["is / from","are / from","is / in","am / from"], ans: 0 },
  { q: "Count: fifteen, sixteen, ___, eighteen", opts: ["nineteen","seventy","seventeen","sixteen"], ans: 2 },
  { q: "The rose is ___", opts: ["blue","green","red","black"], ans: 2 },
  { q: "¿Cómo se dice 'abuela'?", opts: ["Aunt","Grandmother","Cousin","Mother"], ans: 1 },
  { q: "'She ___ tall and ___.'", opts: ["is / beautiful","are / beautiful","is / beauty","am / beautifully"], ans: 0 },
  { q: "She ___ English at school every day.", opts: ["study","studys","studying","studies"], ans: 3 },
  { q: "'I wake up ___ 6 o'clock ___ the morning.'", opts: ["at / in","in / at","on / in","at / at"], ans: 0 },
  { q: "¿Cuál es CORRECTA?", opts: ["My family are big","I has two brothers","I have a sister","She have blond hair"], ans: 2 },
  { q: "Nice to meet you! — La respuesta es:", opts: ["Good morning!","Nice to meet you too!","Yes, I am.","Thank you, bye!"], ans: 1 },
  { q: "The sky is ___ and the grass is ___.", opts: ["blue / green","green / blue","red / yellow","blue / red"], ans: 0 },
  { q: "'He ___ to bed at 10pm every night.'", opts: ["go","goes","going","went"], ans: 1 },
  { q: "¿Cuántos son 'thirteen'?", opts: ["30","3","13","31"], ans: 2 },
  { q: "'___ is a supermarket near here.' (hay)", opts: ["There are","There is","Is there","It is"], ans: 1 },
  { q: "Para pedir la cuenta en un restaurante:", opts: ["Give me money","Can I have the bill, please?","I want bill","Bill please!"], ans: 1 },
  { q: "¿Cómo das indicaciones para ir recto?", opts: ["Turn right","Turn left","Go straight ahead","Cross the street"], ans: 2 },
  { q: "My favorite subject ___ Science.", opts: ["are","have","is","am"], ans: 2 },
  { q: "'I ___ play sports.' (nunca)", opts: ["always","usually","sometimes","never"], ans: 3 },
  { q: "'I'd like to ___.' (pedir educadamente comida)", opts: ["order","want","need","eat"], ans: 0 },
  { q: "It's ___ past two. (2:15)", opts: ["half","quarter","three","fifteen"], ans: 1 },
];

/* ===== COOLDOWN HELPERS ===== */
var COOLDOWN_KEY = "ingles_a1_final_exam_last_attempt";

function getCooldownMs() { return FINAL_EXAM_COOLDOWN_DAYS * 24 * 60 * 60 * 1000; }
function getLastAttemptTime() { var val = localStorage.getItem(COOLDOWN_KEY); return val ? parseInt(val, 10) : null; }
function setLastAttemptTime() { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); }
function isFinalExamOnCooldown() {
  if (FINAL_EXAM_COOLDOWN_DAYS <= 0) return false;
  var state = getState();
  if (!state.finalExamDone) return false;
  var last = getLastAttemptTime();
  if (!last) return false;
  return (Date.now() - last) < getCooldownMs();
}
function getCooldownRemaining() {
  var last = getLastAttemptTime();
  if (!last) return 0;
  return Math.max(0, getCooldownMs() - (Date.now() - last));
}
function formatCooldownTime(ms) {
  var totalSec = Math.floor(ms / 1000);
  var days  = Math.floor(totalSec / 86400);
  var hours = Math.floor((totalSec % 86400) / 3600);
  var mins  = Math.floor((totalSec % 3600) / 60);
  var secs  = totalSec % 60;
  if (days > 0) return days + 'd ' + hours + 'h ' + mins + 'm ' + secs + 's';
  if (hours > 0) return hours + 'h ' + mins + 'm ' + secs + 's';
  return mins + 'm ' + secs + 's';
}
function getUnlockDate(ms) {
  return new Date(Date.now() + ms).toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/* ===== STATE ===== */
var STATE_KEY = "ingles_a1_state";
function getState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || defaultState(); }
  catch (e) { return defaultState(); }
}

function saveState(s) {
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
  /* Guardar en Firebase de forma no-bloqueante */
  _saveCourseStateToFirebase(s);
}

function defaultState() {
  return {
    xp: 0,
    completedLessons: {},
    completedUnitExams: {},
    finalExamDone: false,
    finalGrade: null,
    finalApproved: false,
  };
}

function isLessonUnlocked(unitIdx, lessonIdx) {
  var state = getState();
  if (unitIdx === 0 && lessonIdx === 0) return true;
  if (lessonIdx > 0) return !!state.completedLessons[COURSE.units[unitIdx].lessons[lessonIdx - 1].id];
  if (unitIdx > 0) return !!state.completedUnitExams[COURSE.units[unitIdx - 1].id];
  return false;
}
function isUnitExamUnlocked(unitIdx) {
  var s = getState();
  return COURSE.units[unitIdx].lessons.every(function(l) { return !!s.completedLessons[l.id]; });
}
function isFinalExamUnlocked() {
  var s = getState();
  return COURSE.units.every(function(u) { return !!s.completedUnitExams[u.id]; });
}
function getGlobalProgress() {
  var s = getState();
  var total = COURSE.units.reduce(function(a, u) { return a + u.lessons.length + 1; }, 0) + 1;
  var done  = Object.keys(s.completedLessons).length + Object.keys(s.completedUnitExams).length;
  if (s.finalExamDone) done++;
  return Math.floor((done / total) * 100);
}
function getTotalXP() { return getState().xp || 0; }

/* ===== UI STATE ===== */
var currentView = "welcome";
var examQueue = [], examIdx = 0, examScore = 0, examContext = null, cooldownInterval = null;

/* ===== RENDER INDEX ===== */
function renderIndex() {
  var state   = getState();
  var indexEl = document.getElementById("courseIndex");
  if (!indexEl) return;

  var html = "";
  COURSE.units.forEach(function(unit, ui) {
    var unitDone      = !!state.completedUnitExams[unit.id];
    var unitActive    = unit.lessons.some(function(l) { return currentView === 'lesson:' + l.id; }) || currentView === 'unit-exam:' + unit.id;
    var unitStatusCls  = unitDone ? "done" : unitActive ? "active" : "";
    var unitStatusChar = unitDone ? "✓" : unitActive ? "►" : "○";

    html += '<div class="unit-section">' +
      '<button class="unit-btn ' + (unitActive ? 'active' : '') + '" onclick="toggleUnit(\'u-list-' + ui + '\')">' +
        '<span class="unit-icon">' + unit.icon + '</span>' +
        '<span style="flex:1;text-align:left;">' + unit.title + '</span>' +
        '<span class="unit-status ' + unitStatusCls + '">' + unitStatusChar + '</span>' +
      '</button>' +
      '<div class="lesson-list" id="u-list-' + ui + '" style="' + (unitActive ? '' : 'display:none') + '">';

    unit.lessons.forEach(function(lesson, li) {
      var unlocked   = isLessonUnlocked(ui, li);
      var done       = !!state.completedLessons[lesson.id];
      var active     = currentView === 'lesson:' + lesson.id;
      var cls        = (active ? 'active ' : '') + (done ? 'done ' : '') + (!unlocked ? 'locked' : '');
      var statusChar = done ? '✓' : !unlocked ? '🔒' : active ? '►' : '○';
      var onclick    = unlocked
        ? 'showLesson(\'' + lesson.id + '\')'
        : 'showToast("🔒 Completa la lección anterior primero!","warn")';
      html += '<div class="lesson-item ' + cls + '" onclick="' + onclick + '">' +
        '<span class="li-icon">' + lesson.icon + '</span>' +
        '<span class="li-name">' + lesson.title + '</span>' +
        '<span class="li-status">' + statusChar + '</span>' +
      '</div>';
    });

    var ueUnlocked  = isUnitExamUnlocked(ui);
    var ueDone      = !!state.completedUnitExams[unit.id];
    var ueActive    = currentView === 'unit-exam:' + unit.id;
    var ueCls       = (ueActive ? 'active ' : '') + (ueDone ? 'done ' : '') + (!ueUnlocked ? 'locked' : '');
    var ueOnclick   = ueUnlocked
      ? 'showUnitExam(\'' + unit.id + '\')'
      : 'showToast("🔒 Completa todas las lecciones primero!","warn")';
    html += '<div class="lesson-item ' + ueCls + '" style="background:rgba(255,0,170,0.05);" onclick="' + ueOnclick + '">' +
      '<span class="li-icon">🏆</span>' +
      '<span class="li-name">Examen Unidad</span>' +
      '<span class="li-status">' + (ueDone ? '✓' : !ueUnlocked ? '🔒' : ueActive ? '►' : '○') + '</span>' +
    '</div></div></div>';
  });

  var feUnlocked   = isFinalExamUnlocked();
  var state2       = getState();
  var feDone       = state2.finalExamDone;
  var feApproved   = state2.finalApproved;
  var feOnCooldown = isFinalExamOnCooldown();
  var feOnclick    = feUnlocked
    ? 'showFinalExam()'
    : 'showToast("🔒 Completa todos los exámenes de unidad primero!","warn")';

  html += '<div class="unit-section">' +
    '<div class="lesson-item ' + (feDone ? 'done' : feUnlocked ? '' : 'locked') + ' ' + (currentView === 'final-exam' ? 'active' : '') + '"' +
    ' style="background:rgba(170,0,255,0.08); border-left:3px solid ' + (feUnlocked ? 'var(--px-purple)' : 'transparent') + ';"' +
    ' onclick="' + feOnclick + '">' +
    '<span class="li-icon">' + (feOnCooldown ? '⏳' : '🌟') + '</span>' +
    '<span class="li-name" style="color:' + (feUnlocked ? 'var(--px-purple)' : '') + ';">EXAMEN FINAL</span>' +
    '<span class="li-status">' + (feDone ? (feApproved ? '✓' : '✗') : !feUnlocked ? '🔒' : '►') + '</span>' +
    '</div></div>';

  indexEl.innerHTML = html;
  document.getElementById("globalFill").style.width = getGlobalProgress() + "%";
  document.getElementById("globalPct").textContent  = getGlobalProgress() + "%";
  document.getElementById("xpCount").textContent    = getTotalXP();
}

function toggleUnit(listId) {
  var el = document.getElementById(listId);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "" : "none";
}

/* ===== SHOW VIEWS ===== */
function showWelcome() {
  currentView = "welcome";
  var state       = getState();
  var totalLessons = COURSE.units.reduce(function(a, u) { return a + u.lessons.length; }, 0);
  var doneL       = Object.keys(state.completedLessons).length;
  var main        = document.getElementById("courseMain");
  main.innerHTML  =
    '<div class="welcome-screen fade-in">' +
    '<div class="ws-logo">🇺🇸</div>' +
    '<div class="ws-title">INGLÉS A1<br>PRINCIPIANTE</div>' +
    '<div class="ws-subtitle">Tu aventura con el inglés empieza aquí.<br>Aprende paso a paso, demuestra tu nivel.</div>' +
    '<div class="ws-stats">' +
      '<div class="ws-stat"><span class="ws-stat-val">' + COURSE.units.length + '</span><span class="ws-stat-label">UNIDADES</span></div>' +
      '<div class="ws-stat"><span class="ws-stat-val">' + totalLessons + '</span><span class="ws-stat-label">LECCIONES</span></div>' +
      '<div class="ws-stat"><span class="ws-stat-val">' + doneL + '/' + totalLessons + '</span><span class="ws-stat-label">COMPLETADAS</span></div>' +
    '</div>' +
    '<button class="ws-btn" onclick="showLesson(\'u1l1\')">▶ EMPEZAR CURSO</button>' +
    (doneL > 0 ? '<div style="margin-top:16px;font-family:var(--font-pixel);font-size:0.5rem;color:var(--px-muted);">XP ACUMULADO: <span style="color:var(--px-yellow)">' + getTotalXP() + '</span></div>' : '') +
    '</div>';
  renderIndex();
}

function showLesson(lessonId) {
  var lesson = null, unitTitle = "", unitIdx = 0, lessonIdx = 0;
  COURSE.units.forEach(function(u, ui) {
    u.lessons.forEach(function(l, li) {
      if (l.id === lessonId) { lesson = l; unitTitle = u.title; unitIdx = ui; lessonIdx = li; }
    });
  });
  if (!lesson) return;
  if (!isLessonUnlocked(unitIdx, lessonIdx)) { showToast("🔒 Completa la lección anterior primero!", "warn"); return; }

  currentView = 'lesson:' + lessonId;
  var listEl  = document.getElementById('u-list-' + unitIdx);
  if (listEl) listEl.style.display = "";

  var state = getState();
  var done  = !!state.completedLessons[lessonId];

  var sectionsHtml = "";
  lesson.content.sections.forEach(function(sec) {
    if (sec.type === "vocab") {
      sectionsHtml += '<div class="lc-section"><div class="lc-section-title">' + sec.title + '</div>' +
        '<table class="vocab-table"><thead><tr><th>ENGLISH</th><th>PRONUNCIATION</th><th>ESPAÑOL</th></tr></thead><tbody>' +
        sec.items.map(function(i) {
          return '<tr><td class="en">' + i.en + '</td><td class="pron">' + i.pron + '</td><td class="es">' + i.es + '</td></tr>';
        }).join("") +
        '</tbody></table></div>';
    } else if (sec.type === "examples") {
      sectionsHtml += '<div class="lc-section"><div class="lc-section-title">' + sec.title + '</div>' +
        sec.items.map(function(i) {
          return '<div class="example-box"><div class="ex-en">' + i.en.replace(/\n/g, "<br>") + '</div><div class="ex-es">' + i.es.replace(/\n/g, "<br>") + '</div></div>';
        }).join("") + '</div>';
    } else if (sec.type === "tip") {
      sectionsHtml += '<div class="lc-section"><div class="tip-box"><span class="tip-icon">⚡</span><span class="tip-text"><strong style="color:var(--px-yellow)">PIXEL TIP:</strong> ' + sec.text + '</span></div></div>';
    }
  });

  document.getElementById("courseMain").innerHTML =
    '<div class="lesson-view fade-in">' +
    '<div class="lesson-header">' +
      '<span class="lh-icon">' + lesson.icon + '</span>' +
      '<div class="lh-info"><div class="lh-unit">UNIDAD — ' + unitTitle.toUpperCase() + '</div><div class="lh-title">' + lesson.title + '</div></div>' +
      '<div class="lh-badge">+' + lesson.xp + ' XP</div>' +
    '</div>' +
    '<div class="lesson-content">' +
      '<div class="lc-section"><div class="lc-text">' + lesson.content.intro + '</div></div>' +
      sectionsHtml +
    '</div>' +
    '<div class="lesson-actions">' +
      (done ? '<span style="font-family:var(--font-pixel);font-size:0.5rem;color:var(--px-green)">✓ LECCIÓN COMPLETADA</span>' : '') +
      '<button class="btn-pixel btn-exam" onclick="startExam(\'lesson\',\'' + lessonId + '\')">' +
        (done ? "▶ REPETIR EXAMEN" : "▶ INICIAR MINI-EXAMEN") +
      '</button>' +
    '</div></div>';
  renderIndex();
}

function showUnitExam(unitId) {
  var unitIdx = COURSE.units.findIndex(function(u) { return u.id === unitId; });
  var unit    = COURSE.units[unitIdx];
  if (!unit) return;
  if (!isUnitExamUnlocked(unitIdx)) { showToast("🔒 Completa todas las lecciones primero!", "warn"); return; }
  currentView = 'unit-exam:' + unitId;
  var state  = getState();
  var ueData = state.completedUnitExams[unitId];
  var done   = !!ueData;

  document.getElementById("courseMain").innerHTML =
    '<div class="unit-exam-view fade-in">' +
    '<div class="uev-header"><div class="uev-icon">🏆</div><div class="uev-title">EXAMEN DE UNIDAD</div><div class="uev-sub">' + unit.title + '</div></div>' +
    '<div class="lesson-content" style="margin-bottom:20px;"><div class="lc-text">' +
      'Has completado todas las lecciones de esta unidad. <strong style="color:var(--px-yellow)">¡Es hora de demostrar lo que sabes!</strong><br><br>' +
      '📋 <em style="color:var(--px-cyan)">' + unit.exam.length + ' preguntas</em> · Necesitas al menos <strong>' + COURSE.passingScore + '%</strong> para aprobar.<br><br>' +
      (done ? '<div class="prev-grade-box"><div class="pgb-label">TU NOTA ANTERIOR</div><div class="pgb-grade">' + ueData.grade + '/20</div><div class="pgb-pct ' + (ueData.pct >= COURSE.passingScore ? 'pass' : 'fail') + '">' + (ueData.pct >= COURSE.passingScore ? '✓ APROBADO' : '✗ DESAPROBADO') + ' — ' + ueData.pct + '%</div></div>' : '') +
    '</div></div>' +
    '<div class="lesson-actions">' +
      '<button class="btn-pixel btn-unit-exam" onclick="startExam(\'unit\',\'' + unitId + '\')">' +
        (done ? "▶ REPETIR EXAMEN" : "▶ INICIAR EXAMEN DE UNIDAD") +
      '</button></div></div>';
  renderIndex();
}

function showFinalExam() {
  if (!isFinalExamUnlocked()) { showToast("🔒 Completa todos los exámenes de unidad primero!", "warn"); return; }
  currentView = "final-exam";
  var state    = getState();
  var done     = state.finalExamDone;
  var approved = state.finalApproved;
  var onCooldown = isFinalExamOnCooldown();

  var cooldownHtml = "";
  if (onCooldown) {
    var remaining = getCooldownRemaining();
    cooldownHtml =
      '<div class="cd-timer-box" style="margin:16px 0;">' +
        '<div class="cd-timer-label">⏳ DISPONIBLE EN</div>' +
        '<div class="cd-timer-value" id="inlineTimer">' + formatCooldownTime(remaining) + '</div>' +
        '<div class="cd-date-unlock">📅 ' + getUnlockDate(remaining) + '</div>' +
      '</div>' +
      '<div style="font-family:var(--font-vt);font-size:1rem;color:var(--px-muted);">Usa este tiempo para repasar. ¡Llegarás mejor preparado!</div>';
  }

  document.getElementById("courseMain").innerHTML =
    '<div class="final-exam-view fade-in">' +
    '<div class="fev-header"><div class="fev-icon">🌟</div><div class="fev-title">EXAMEN FINAL<br>INGLÉS A1</div><div class="fev-sub">Demuestra todo lo que aprendiste</div></div>' +
    '<div class="lesson-content" style="margin-bottom:20px;"><div class="lc-text">' +
      '¡Llegaste al <strong style="color:var(--px-yellow)">EXAMEN FINAL</strong>!<br><br>' +
      '📋 <em style="color:var(--px-cyan)">' + FINAL_EXAM.length + ' preguntas</em> de todos los temas del curso.<br>' +
      'Necesitas al menos <strong style="color:var(--px-yellow)">' + COURSE.finalPassingGrade + '/20</strong> para obtener tu certificado.<br>' +
      (FINAL_EXAM_COOLDOWN_DAYS > 0 ? '<em style="color:var(--px-muted);font-size:0.9em;">⏱ Tras cada intento debes esperar <strong style="color:var(--px-orange)">' + FINAL_EXAM_COOLDOWN_DAYS + ' día(s)</strong> para volver a intentarlo.</em>' : '') + '<br><br>' +
      (done ? '<div class="prev-grade-box ' + (approved ? 'approved' : 'disapproved') + '">' +
        '<div class="pgb-label">TU NOTA ANTERIOR</div>' +
        '<div class="pgb-grade">' + state.finalGrade + '/20</div>' +
        '<div class="pgb-pct ' + (approved ? 'pass' : 'fail') + '">' + (approved ? '✓ APROBADO' : '✗ DESAPROBADO') + ' — ' + Math.round(state.finalGrade / 20 * 100) + '%</div>' +
        (approved ? '<div class="pgb-cert">🎓 CERTIFICADO OBTENIDO</div>' : '<div class="pgb-retry">Necesitas ' + COURSE.finalPassingGrade + '/20. ¡Sigue practicando!</div>') +
      '</div>' : '') +
      cooldownHtml +
      '<br>⚠️ <em style="color:var(--px-muted);">Responde con calma. Recuerda todo lo que estudiaste.</em>' +
    '</div></div>' +
    '<div class="lesson-actions">' +
      '<button class="btn-pixel btn-final" ' + (onCooldown ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '') + ' onclick="startFinalExamWithCooldownCheck()">' +
        '🌟 ' + (done ? "REPETIR EXAMEN FINAL" : "INICIAR EXAMEN FINAL") +
      '</button></div></div>';

  if (onCooldown) startInlineCountdown();
  renderIndex();
}

function startInlineCountdown() {
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(function() {
    var el = document.getElementById("inlineTimer");
    if (!el) { clearInterval(cooldownInterval); return; }
    var remaining = getCooldownRemaining();
    if (remaining <= 0) { clearInterval(cooldownInterval); showFinalExam(); return; }
    el.textContent = formatCooldownTime(remaining);
  }, 1000);
}

function startFinalExamWithCooldownCheck() {
  if (isFinalExamOnCooldown()) { showCooldownModal(); return; }
  startExam('final', 'final');
}

function showCooldownModal() {
  var remaining = getCooldownRemaining();
  var modal = document.getElementById("cooldownModal");
  modal.innerHTML =
    '<span class="cd-icon">⏳</span>' +
    '<div class="cd-title">EXAMEN NO DISPONIBLE</div>' +
    '<div class="cd-subtitle">Debes esperar antes de volver a intentarlo</div>' +
    '<div class="cd-timer-box">' +
      '<div class="cd-timer-label">TIEMPO RESTANTE</div>' +
      '<div class="cd-timer-value" id="cooldownTimer">' + formatCooldownTime(remaining) + '</div>' +
      '<div class="cd-date-unlock">📅 Disponible: ' + getUnlockDate(remaining) + '</div>' +
    '</div>' +
    '<div class="cd-info">Cada intento del Examen Final requiere una espera de <strong style="color:var(--px-orange)">' + FINAL_EXAM_COOLDOWN_DAYS + ' día(s)</strong>.<br>Usa este tiempo para repasar. ¡Tú puedes!</div>' +
    '<button class="cd-close-btn" onclick="closeCooldownModal()">✓ ENTENDIDO</button>';
  document.getElementById("cooldownOverlay").classList.add("show");
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(function() {
    var timerEl = document.getElementById("cooldownTimer");
    if (!timerEl) { clearInterval(cooldownInterval); return; }
    var rem = getCooldownRemaining();
    if (rem <= 0) { clearInterval(cooldownInterval); closeCooldownModal(); showFinalExam(); return; }
    timerEl.textContent = formatCooldownTime(rem);
  }, 1000);
}

function closeCooldownModal() {
  document.getElementById("cooldownOverlay").classList.remove("show");
  if (cooldownInterval) clearInterval(cooldownInterval);
}

/* ===== EXAM ENGINE ===== */
function startExam(type, id) {
  examContext = { type: type, id: id };
  if (type === "lesson") {
    var lesson  = findLesson(id);
    examQueue   = lesson.exam.slice();
    document.getElementById("examTitle").textContent = "MINI-EXAMEN: " + lesson.title.toUpperCase();
  } else if (type === "unit") {
    var unit    = COURSE.units.find(function(u) { return u.id === id; });
    examQueue   = unit.exam.slice();
    document.getElementById("examTitle").textContent = "EXAMEN: " + unit.title.toUpperCase();
  } else if (type === "final") {
    examQueue   = FINAL_EXAM.slice();
    document.getElementById("examTitle").textContent = "🌟 EXAMEN FINAL — INGLÉS A1";
  }
  examIdx = 0; examScore = 0;
  showExamQuestion();
  document.getElementById("examOverlay").classList.add("show");
}

function showExamQuestion() {
  var q     = examQueue[examIdx];
  var total = examQueue.length;
  document.getElementById("examCounter").textContent  = (examIdx + 1) + ' / ' + total;
  document.getElementById("examProgFill").style.width = ((examIdx / total) * 100) + '%';
  document.getElementById("btnNext").disabled = true;

  var letters = ["A", "B", "C", "D"];
  document.getElementById("examBody").innerHTML =
    '<div class="exam-question">' + (examIdx + 1) + '. ' + q.q + '</div>' +
    '<div class="exam-options">' +
    q.opts.map(function(opt, i) {
      return '<button class="exam-option" data-idx="' + i + '" onclick="selectOption(' + i + ')">' +
        '<span class="opt-letter">' + letters[i] + '</span>' + opt + '</button>';
    }).join("") +
    '</div><div id="examFeedback"></div>';
}

function selectOption(idx) {
  var q       = examQueue[examIdx];
  var opts    = document.querySelectorAll(".exam-option");
  opts.forEach(function(o) { o.disabled = true; });
  var selected  = opts[idx];
  var correct   = q.ans;
  var isCorrect = idx === correct;
  selected.classList.add(isCorrect ? "correct" : "wrong");
  if (!isCorrect) opts[correct].classList.add("correct");
  if (isCorrect) examScore++;
  var fb = document.getElementById("examFeedback");
  if (fb) {
    fb.className   = "exam-feedback " + (isCorrect ? "correct" : "wrong");
    fb.textContent = isCorrect ? "✓ ¡Correcto!" : "✗ La respuesta correcta era: " + q.opts[correct];
  }
  document.getElementById("btnNext").disabled = false;
  document.getElementById("btnNext").textContent = examIdx < examQueue.length - 1 ? "SIGUIENTE ▶" : "VER RESULTADOS 🏆";
}

document.getElementById("btnNext").addEventListener("click", function() {
  examIdx++;
  if (examIdx < examQueue.length) showExamQuestion();
  else finishExam();
});

function finishExam() {
  document.getElementById("examOverlay").classList.remove("show");
  var total = examQueue.length;
  var pct   = Math.round((examScore / total) * 100);
  var grade = Math.round(examScore / total * 20);

  var passed = false, finalApproved = false;
  if (examContext.type === "final") {
    finalApproved = grade >= COURSE.finalPassingGrade;
    passed        = finalApproved;
    setLastAttemptTime();
  } else {
    passed = pct >= COURSE.passingScore;
  }

  var gradeLabel, gradeCls;
  if (examContext.type === "final") {
    if (grade >= 19)      { gradeLabel = "A — SOBRESALIENTE"; gradeCls = "grade-a"; }
    else if (grade >= 17) { gradeLabel = "B — APROBADO";      gradeCls = "grade-b"; }
    else if (grade >= 14) { gradeLabel = "C — REGULAR";       gradeCls = "grade-c"; }
    else                  { gradeLabel = "D — DESAPROBADO";   gradeCls = "grade-d"; }
  } else {
    if (pct >= 90)      { gradeLabel = "A — EXCELENTE";   gradeCls = "grade-a"; }
    else if (pct >= 75) { gradeLabel = "B — BUENO";       gradeCls = "grade-b"; }
    else if (pct >= 60) { gradeLabel = "C — APROBADO";    gradeCls = "grade-c"; }
    else                { gradeLabel = "D — NO APROBADO"; gradeCls = "grade-d"; }
  }

  var state  = getState();
  var xpGain = 0;

  if (examContext.type === "lesson") {
    var lesson = findLesson(examContext.id);
    if (passed && !state.completedLessons[examContext.id]) {
      xpGain    = lesson.xp;
      state.xp  = (state.xp || 0) + xpGain;
      state.completedLessons[examContext.id] = { grade: grade, pct: pct };
    }
  } else if (examContext.type === "unit") {
    if (passed && !state.completedUnitExams[examContext.id]) {
      xpGain   = 50;
      state.xp = (state.xp || 0) + xpGain;
    }
    var prev = state.completedUnitExams[examContext.id];
    if (!prev || grade > (prev.grade || 0)) {
      state.completedUnitExams[examContext.id] = { grade: grade, pct: pct };
    }
  } else if (examContext.type === "final") {
    var prevApproved = state.finalApproved || false;
    if (!state.finalExamDone) {
      xpGain   = 150;
      state.xp = (state.xp || 0) + xpGain;
    }
    state.finalExamDone = true;
    if (state.finalGrade === null || grade > state.finalGrade) state.finalGrade = grade;
    if (finalApproved || prevApproved) state.finalApproved = true;
  }

  /* saveState sincroniza a Firebase automáticamente */
  saveState(state);

  /* ── FIX 2: syncXPToProfile es async — llamar sin bloquear
     pero capturar errores con .catch() ── */
  syncXPToProfile(state.xp, state.finalApproved || false, state.finalGrade, examContext.type, grade)
    .catch(function(err) { console.warn('[Ingles] syncXPToProfile error:', err); });

  var approvedBadge = "";
  if (examContext.type === "final") {
    approvedBadge = finalApproved
      ? '<div class="rm-approval approved-badge">🎓 ¡CURSO APROBADO!</div>'
      : '<div class="rm-approval disapproved-badge">❌ CURSO DESAPROBADO<br><small>Necesitas ' + COURSE.finalPassingGrade + '/20 para aprobar</small></div>';
  }

  var cooldownNotice = "";
  if (examContext.type === "final" && FINAL_EXAM_COOLDOWN_DAYS > 0) {
    cooldownNotice = '<div style="font-family:var(--font-vt);font-size:1rem;color:var(--px-orange);margin:10px 0;border:2px solid rgba(255,140,0,0.3);padding:8px 12px;">⏳ Próximo intento disponible en <strong>' + FINAL_EXAM_COOLDOWN_DAYS + ' día(s)</strong></div>';
  }

  var rm = document.getElementById("resultModal");
  rm.innerHTML =
    '<div class="rm-scroll-content">' +
      '<span class="rm-icon">' + (passed ? "🏆" : "💔") + '</span>' +
      '<div class="rm-title ' + (passed ? "pass" : "fail") + '">' + (passed ? "¡APROBADO!" : "NO APROBADO") + '</div>' +
      '<div class="rm-score-wrap">' +
        '<span class="rm-score-num" style="color:' + (passed ? "var(--px-green)" : "var(--px-red)") + '">' + examScore + '/' + total + '</span>' +
        '<div class="rm-score-label">' + pct + '% de aciertos</div>' +
      '</div>' +
      '<div class="rm-grade-display ' + gradeCls + '">' + gradeLabel + '</div>' +
      '<div class="rm-grade-display ' + gradeCls + '" style="font-size:1.5rem;padding:10px 24px;">NOTA: ' + grade + '/20</div>' +
      approvedBadge + cooldownNotice +
      (xpGain > 0 ? '<div class="rm-xp">+' + xpGain + ' XP GANADOS ⭐</div>' : '') +
      (!passed && examContext.type === "final" ? '<div style="font-family:var(--font-vt);color:var(--px-muted);margin:10px 0;font-size:1.1rem;">Necesitas <strong style="color:var(--px-yellow)">' + COURSE.finalPassingGrade + '/20</strong> para aprobar el curso.</div>' : '') +
      (!passed && examContext.type !== "final" ? '<div style="font-family:var(--font-vt);color:var(--px-muted);margin:10px 0;font-size:1.1rem;">Necesitas al menos ' + COURSE.passingScore + '% para aprobar.</div>' : '') +
    '</div>' +
    '<div class="rm-footer-fixed">' +
      '<button class="btn-pixel btn-next-lesson" onclick="closeResultAndContinue()">✓ CONTINUAR</button>' +
    '</div>';

  document.getElementById("resultOverlay").classList.add("show");
  if (passed) celebrate();
  renderIndex();
}

function closeResult() { document.getElementById("resultOverlay").classList.remove("show"); }

function closeResultAndContinue() {
  document.getElementById("resultOverlay").classList.remove("show");
  if (examContext.type === "lesson") {
    var lessonId = examContext.id;
    var nextLesson = null, nextIsUnitExam = false, nextUnitId = null;
    COURSE.units.forEach(function(u, ui) {
      u.lessons.forEach(function(l, li) {
        if (l.id === lessonId) {
          if (li < u.lessons.length - 1) nextLesson = u.lessons[li + 1].id;
          else { nextIsUnitExam = true; nextUnitId = u.id; }
        }
      });
    });
    if (nextLesson) showLesson(nextLesson);
    else if (nextIsUnitExam) showUnitExam(nextUnitId);
  } else if (examContext.type === "unit") {
    var unitIdx = COURSE.units.findIndex(function(u) { return u.id === examContext.id; });
    if (unitIdx < COURSE.units.length - 1) showLesson(COURSE.units[unitIdx + 1].lessons[0].id);
    else if (isFinalExamUnlocked()) showFinalExam();
  } else if (examContext.type === "final") {
    showFinalExam();
  }
}

function findLesson(id) {
  for (var i = 0; i < COURSE.units.length; i++) {
    for (var j = 0; j < COURSE.units[i].lessons.length; j++) {
      if (COURSE.units[i].lessons[j].id === id) return COURSE.units[i].lessons[j];
    }
  }
  return null;
}

/* =====================================================
   FIX 2+3+4: syncXPToProfile — ahora es ASYNC y
   secuencial: primero crea/actualiza la inscripción
   en Firestore, luego actualiza la nota del examen.
   Esto evita el race condition que causaba el error
   "No document to update" cuando el documento aún
   no existía en la colección "inscripciones".
   ===================================================== */
async function syncXPToProfile(courseXP, finalApproved, finalGrade, examType, examGrade) {
  try {
    var profileKey    = 'perfil_usuario';
    var enrollKey     = 'inscripciones';
    var prevSyncedKey = 'ingles_a1_synced_xp';
    var uid           = getCurrentUID();

    /* ── 1. Actualizar XP en perfil local ── */
    var p = JSON.parse(localStorage.getItem(profileKey) || 'null');
    if (p) {
      var prevSynced = parseInt(localStorage.getItem(prevSyncedKey) || '0', 10);
      var delta      = courseXP - prevSynced;
      if (delta > 0) {
        p.xp = (p.xp || 0) + delta;
        localStorage.setItem(prevSyncedKey, String(courseXP));
      }
      if (finalApproved && examType === 'final') {
        var wasApproved = localStorage.getItem('ingles_a1_was_approved') === '1';
        if (!wasApproved) {
          p.completos = (p.completos || 0) + 1;
          localStorage.setItem('ingles_a1_was_approved', '1');
        }
      }
      localStorage.setItem(profileKey, JSON.stringify(p));
    }

    /* ── 2. Actualizar inscripción en localStorage ── */
    var enrollments = JSON.parse(localStorage.getItem(enrollKey) || '[]');
    var idx = enrollments.findIndex(function(e) {
      return e.id === COURSE.id || e.cursoId === COURSE.id;
    });
    if (idx === -1) {
      idx = enrollments.findIndex(function(e) {
        return e.nombre && e.nombre.toLowerCase().includes('inglés');
      });
    }

    if (idx === -1) {
      var newEntry = {
        tipo: 'permanente', id: COURSE.id, cursoId: COURSE.id,
        nombre: COURSE.title, area: 'idiomas', grado: '',
        horas: 10, img: '', link: 'ingles.html',
        inscritoEl: new Date().toISOString(),
        estado: 'en_progreso', nota_final: null, aprobado: null,
      };
      enrollments.push(newEntry);
      idx = enrollments.length - 1;
    }

    /* Actualizar nota final en la inscripción local */
    if (examType === 'final') {
      var gradeToSave = (typeof finalGrade === 'number') ? finalGrade : examGrade;
      if (typeof gradeToSave === 'number') {
        var prevNota = enrollments[idx].nota_final;
        /* Guardar siempre la nota más alta */
        if (typeof prevNota !== 'number' || gradeToSave > prevNota) {
          enrollments[idx].nota_final = gradeToSave;
        }
      }
      if (finalApproved) {
        enrollments[idx].aprobado = true;
        enrollments[idx].estado   = 'completado';
        enrollments[idx].horas    = Math.max(enrollments[idx].horas || 0, 10);
      } else if (enrollments[idx].aprobado !== true) {
        enrollments[idx].aprobado = false;
        enrollments[idx].estado   = 'en_progreso';
      }
    }
    localStorage.setItem(enrollKey, JSON.stringify(enrollments));

    /* ── 3. Sincronización con Firebase (si hay sesión) ── */
    if (!uid) return; /* Sin sesión: solo localStorage */

    try {
      var dbMod = await import('./database.js');

      /* PASO A: Crear/actualizar inscripción en Firestore PRIMERO
         Se usa setDoc con merge:true en database.js para no pisar datos */
      if (dbMod.enrollCourse) {
        await dbMod.enrollCourse(uid, Object.assign({}, enrollments[idx], { id: COURSE.id }));
      }

      /* PASO B: Actualizar nota del examen DESPUÉS de que el documento existe
         Esto evita el error "document not found" de updateDoc */
      if (dbMod.updateExamResult && examType === 'final') {
        var notaFinal     = enrollments[idx].nota_final;
        var aprobadoFinal = enrollments[idx].aprobado === true;
        if (typeof notaFinal === 'number') {
          await dbMod.updateExamResult(uid, COURSE.id, notaFinal, aprobadoFinal);
        }
      }

      /* PASO C: Actualizar XP y completos del perfil en Firestore */
      if (dbMod.updateUserProfile && p) {
        await dbMod.updateUserProfile(uid, {
          xp:        p.xp,
          completos: p.completos || 0,
        });
      }

    } catch (fbErr) {
      console.warn('[Ingles] Firebase sync error (datos guardados en localStorage):', fbErr);
    }

  } catch (e) {
    console.warn('[Ingles] syncXPToProfile error:', e);
  }
}

/* ===== TOAST ===== */
var toastTimer;
function showToast(msg, type) {
  type = type || "info";
  var el = document.getElementById("pixelToast");
  if (!el) return;
  el.textContent      = msg;
  el.style.borderColor = type === "warn" ? "var(--px-red)" : type === "ok" ? "var(--px-green)" : "var(--px-yellow)";
  el.style.color      = type === "warn" ? "var(--px-red)" : type === "ok" ? "var(--px-green)" : "var(--px-yellow)";
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove("show"); }, 2500);
}

/* ===== CONFETTI ===== */
function celebrate() {
  var canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  canvas.width = innerWidth; canvas.height = innerHeight;
  var colors    = ["#FFE000","#FF00AA","#00F8FF","#39FF14","#AA00FF","#FF8C00"];
  var particles = [];
  for (var i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: -10,
      vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.1
    });
  }
  var t = 0;
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    t++;
    if (t < 120) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  loop();
}

/* ===== SIDEBAR TOGGLE ===== */
document.getElementById("sidebarToggle").addEventListener("click", function() {
  var sidebar   = document.getElementById("sidebar");
  var btn       = document.getElementById("sidebarToggle");
  var collapsed = sidebar.classList.toggle("collapsed");
  btn.querySelector("span").textContent = collapsed ? "▶" : "◀";
});

/* ===== STARS ===== */
function createStars() {
  var container = document.getElementById("stars");
  if (!container) return;
  var colors = ["#FFE000","#00F8FF","#FF00AA","#39FF14","#AA00FF","#FF8C00"];
  for (var i = 0; i < 60; i++) {
    var star = document.createElement("div");
    star.style.cssText =
      'position:absolute;left:' + (Math.random()*100) + '%;top:' + (Math.random()*100) + '%;' +
      'width:' + (1+Math.random()*2) + 'px;height:' + (1+Math.random()*2) + 'px;' +
      'background:' + colors[Math.floor(Math.random()*colors.length)] + ';' +
      'opacity:' + (0.2+Math.random()*0.6) + ';' +
      'animation:blink ' + (1+Math.random()*3) + 's ease-in-out infinite;' +
      'animation-delay:' + (Math.random()*3) + 's;';
    container.appendChild(star);
  }
}

/* ===== EXPOSE GLOBALS ===== */
window.showLesson                      = showLesson;
window.showUnitExam                    = showUnitExam;
window.showFinalExam                   = showFinalExam;
window.showWelcome                     = showWelcome;
window.toggleUnit                      = toggleUnit;
window.startExam                       = startExam;
window.selectOption                    = selectOption;
window.startFinalExamWithCooldownCheck = startFinalExamWithCooldownCheck;
window.closeCooldownModal              = closeCooldownModal;
window.closeResult                     = closeResult;
window.closeResultAndContinue          = closeResultAndContinue;
window.showToast                       = showToast;
window.renderIndex                     = renderIndex;

/* ===== INIT ===== */
createStars();
showWelcome();