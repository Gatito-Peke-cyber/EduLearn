/* =====================================================
   EduLearn — Dashboard — JS v2.0
   ===================================================== */
'use strict';

/* ===== LOADER ===== */
window.addEventListener('load', () => {
  const fill  = document.getElementById('ldFill');
  const pct   = document.getElementById('ldPct');
  const msg   = document.getElementById('ldMsg');
  const msgs  = ['INICIANDO SISTEMA...','CARGANDO CURSOS...','CONECTANDO JUGADORES...','LISTO!'];
  let p = 0, mi = 0;
  const t = setInterval(() => {
    p = Math.min(100, p + Math.random() * 22 + 5);
    if (fill) fill.style.width = p + '%';
    if (pct)  pct.textContent  = Math.round(p) + '%';
    const idx = Math.floor((p / 100) * msgs.length);
    if (msg && msgs[idx] !== undefined && msgs[mi] !== msgs[idx]) { mi = idx; msg.textContent = msgs[mi]; }
    if (p >= 100) {
      clearInterval(t);
      setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) { loader.style.transition = 'opacity 0.5s'; loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 500); }
      }, 300);
    }
  }, 80);
});

/* ===== STARS ===== */
(function createStars() {
  const c = document.getElementById('pixelStars');
  if (!c) return;
  const colors = ['#FFE000','#00F8FF','#FF00AA','#39FF14','#AA00FF','#FF8C00','#ffffff'];
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('span');
    const size = 1 + Math.random() * 2;
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};opacity:${0.1+Math.random()*0.5};animation:blink ${1+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*5}s;`;
    c.appendChild(s);
  }
})();

/* ===== NAV BURGER ===== */
(function initNav() {
  const burger = document.getElementById('burger');
  const nav    = document.getElementById('mainNav');
  if (!burger || !nav) return;
  burger.addEventListener('click', () => {
    const e = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!e));
    nav.classList.toggle('open');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }));
})();

/* ===== REVEAL ON SCROLL ===== */
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ===== BACK TO TOP ===== */
const backBtn = document.getElementById('backToTop');
if (backBtn) {
  window.addEventListener('scroll', () => backBtn.classList.toggle('show', window.scrollY > 400));
  backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ===== TOAST ===== */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = 'ok') {
  if (!toastEl) return;
  const c = { ok: '#39FF14', warn: '#FFE000', bad: '#FF3030' };
  toastEl.textContent = msg;
  toastEl.style.borderColor = c[type] || c.ok;
  toastEl.style.color = c[type] || c.ok;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

/* ===== PROFILE HUD ===== */
(function loadHUD() {
  const PROFILE_KEY = 'perfil_usuario';
  const ENROLL_KEY  = 'inscripciones';
  const LEVEL_THR   = [0,100,250,450,700,1000,1400,1850,2400,3000,3700,4500,5500,6800,8400,10200];

  function getProfile() {
    try {
      let p = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (!p) { p = { nombre:'INVITADO', xp:0, racha:0, avatar:'🎓', nivel:1 }; }
      return p;
    } catch { return { nombre:'INVITADO', xp:0, racha:0, avatar:'🎓', nivel:1 }; }
  }
  function getEnrolled() {
    try { const d = JSON.parse(localStorage.getItem(ENROLL_KEY)); return Array.isArray(d) ? d : []; } catch { return []; }
  }
  function computeLevel(xp) {
    let lv = 1;
    for (let i = 0; i < LEVEL_THR.length; i++) if (xp >= LEVEL_THR[i]) lv = i + 1;
    return Math.min(lv, LEVEL_THR.length);
  }

  const p        = getProfile();
  const enrolled = getEnrolled();
  const lv       = computeLevel(p.xp || 0);
  const lvIdx    = lv;
  const xpBase   = LEVEL_THR[lv - 1] || 0;
  const xpNext   = LEVEL_THR[lvIdx]   || 9999;
  const xpPct    = xpNext > xpBase ? Math.min(100, ((p.xp - xpBase) / (xpNext - xpBase)) * 100) : 100;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };

  const name = (p.nombre || 'INVITADO').toUpperCase().slice(0, 14);
  setEl('hudName',    name);
  setEl('hudLv',      lv);
  setEl('hudXpVal',   p.xp || 0);
  setEl('hudXpNext',  xpNext);
  setEl('hsCursos',   enrolled.length);
  setEl('hsRacha',    p.racha || 0);
  setEl('hsXp',       p.xp || 0);
  setStyle('hudXpFill', 'width', Math.max(5, xpPct) + '%');

  const avatarEl = document.getElementById('hudAvatar');
  if (avatarEl && p.avatar) avatarEl.textContent = p.avatar;

  // Count earned badges
  const BADGES_COUNT = 24;
  const BADGE_SEEN   = 'insignias_celebradas_v4';
  try {
    const seen = JSON.parse(localStorage.getItem(BADGE_SEEN)) || [];
    setEl('hsInsig', seen.length);
  } catch { setEl('hsInsig', 0); }
})();

/* ===== COUNTERS ===== */
let countersDone = false;
function animateCounters(selector) {
  document.querySelectorAll(selector).forEach(el => {
    const target = Number(el.dataset.target) || 0;
    const duration = 2000;
    const start = performance.now();
    function step(ts) {
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(step);
  });
}

// Hero counters — fire immediately on load after loader disappears
window.addEventListener('load', () => {
  setTimeout(() => animateCounters('.counter-hero'), 800);
});

// Stats counters — fire on scroll
const statsSection = document.getElementById('stats');
if (statsSection) {
  const ioStats = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !countersDone) {
      countersDone = true;
      animateCounters('.counter-val');
      ioStats.disconnect();
    }
  }, { threshold: 0.2 });
  ioStats.observe(statsSection);
}

/* ===== CAROUSEL ===== */
(function initCarousel() {
  const track   = document.getElementById('carTrack');
  const prev    = document.getElementById('carPrev');
  const next    = document.getElementById('carNext');
  const dotsEl  = document.getElementById('carDots');
  if (!track) return;

  const cards   = track.querySelectorAll('.testi-card');
  const total   = Math.ceil(cards.length / 2);
  let current   = 0;
  let autoTimer;

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const b = document.createElement('button');
      b.setAttribute('aria-label', `Ir al testimonio ${i + 1}`);
      if (i === current) b.classList.add('active');
      b.addEventListener('click', () => { current = i; go(); restartAuto(); });
      dotsEl.appendChild(b);
    }
  }

  function go() {
    const cardWidth = cards[0].offsetWidth + 16;
    track.style.transform = `translateX(-${current * cardWidth * 2}px)`;
    if (dotsEl) {
      dotsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === current));
    }
  }

  function goNext() { current = (current + 1) % total; go(); }
  function goPrev() { current = (current - 1 + total) % total; go(); }
  function restartAuto() { clearInterval(autoTimer); autoTimer = setInterval(goNext, 5000); }

  buildDots();
  restartAuto();
  if (next) next.addEventListener('click', () => { goNext(); restartAuto(); });
  if (prev) prev.addEventListener('click', () => { goPrev(); restartAuto(); });
  window.addEventListener('resize', go);
})();

/* ===== FAQ ACCORDION ===== */
document.querySelectorAll('.faq-item').forEach(item => {
  const btn   = item.querySelector('.faq-btn');
  const panel = item.querySelector('.faq-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    // Close all
    document.querySelectorAll('.faq-item').forEach(it => {
      const b = it.querySelector('.faq-btn');
      const p = it.querySelector('.faq-panel');
      if (b) b.setAttribute('aria-expanded', 'false');
      if (p) p.style.display = 'none';
      it.classList.remove('open');
    });
    if (!open) {
      btn.setAttribute('aria-expanded', 'true');
      panel.style.display = 'block';
      item.classList.add('open');
    }
  });
});

/* ===== NEWSLETTER ===== */
const newsForm  = document.getElementById('newsForm');
const newsInput = document.getElementById('newsEmail');
const newsMsg   = document.getElementById('newsMsg');
if (newsForm) {
  newsForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = newsInput?.value.trim() || '';
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      if (newsMsg) { newsMsg.textContent = '⚠ CORREO INVÁLIDO'; newsMsg.style.color = 'var(--px-red)'; }
      return;
    }
    if (newsMsg) { newsMsg.textContent = '⚡ ¡INSCRITO! RECIBIRÁS NOVEDADES ÉPICAS'; newsMsg.style.color = 'var(--px-green)'; }
    newsForm.reset();
    showToast('✉ SUSCRIPCIÓN CONFIRMADA', 'ok');
  });
}

/* ===== SMOOTH ACTIVE NAV ===== */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav a:not(.nav-pill)');
  const ioNav = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => {
          l.style.color = l.getAttribute('href') === `#${id}` ? 'var(--px-yellow)' : '';
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => ioNav.observe(s));
})();

/* ===== HEADER SCROLL SHRINK ===== */
window.addEventListener('scroll', () => {
  const hdr = document.getElementById('mainHeader');
  if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 60);
});