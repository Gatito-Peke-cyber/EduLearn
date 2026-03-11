/* =====================================================
   EduLearn — Login — JS
   Stars background, loader, form validation & profile
   ===================================================== */
'use strict';

const PROFILE_KEY = 'perfil_usuario';

/* ---- HELPERS ---- */
const $ = s => document.querySelector(s);

function getProfile() {
  try {
    let p = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!p) {
      p = {
        nombre:   'Estudiante',
        email:    '',
        xp:       0,
        racha:    0,
        avatar:   '🎓',
        nivel:    1,
        horas:    0,
        completos: 0,
        joinDate: new Date().toISOString(),
        lastVisit: null,
        streak:   0,
        perfects: 0,
        approved: 0,
        failed:   0,
        temporalesCompletados: 0,
        permanentesCompletados: 0,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    }
    return p;
  } catch { return null; }
}

function toast(msg, color = 'var(--cyan)') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = color;
  t.style.color = color;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---- STARS BACKGROUND ---- */
function initStars() {
  const canvas = $('#stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  const STAR_COLORS = ['#FFE000', '#00F8FF', '#ffffff', '#FF00AA', '#39FF14'];
  const stars = Array.from({ length: 100 }, () => ({
    x:     Math.random() * W,
    y:     Math.random() * H,
    r:     Math.random() * 1.6 + 0.4,
    o:     Math.random() * 0.5 + 0.1,
    speed: Math.random() * 0.25 + 0.05,
    ci:    Math.floor(Math.random() * STAR_COLORS.length),
  }));
  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      ctx.globalAlpha = s.o;
      ctx.fillStyle = STAR_COLORS[s.ci];
      ctx.fillRect(s.x, s.y, s.r, s.r);
      s.y -= s.speed;
      if (s.y < 0) { s.y = H; s.x = Math.random() * W; }
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
}

/* ---- LOADER ---- */
function hideLoader() {
  const loader = $('#loader');
  if (!loader) return;
  let w = 0;
  const fill = $('#ld-fill');
  const iv = setInterval(() => {
    w += Math.random() * 20 + 8;
    if (fill) fill.style.width = Math.min(w, 100) + '%';
    if (w >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        loader.style.transition = 'opacity 0.4s';
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 400);
      }, 250);
    }
  }, 60);
}

/* ---- FORM VALIDATION ---- */
function validateEmail(val) {
  return /^\S+@\S+\.\S+$/.test(val.trim());
}
function validatePassword(val) {
  return val.length >= 6;
}

function setFieldState(wrapId, state, statusIcon) {
  const wrap = $('#' + wrapId);
  if (!wrap) return;
  wrap.classList.remove('error-state', 'success-state');
  if (state === 'error')   wrap.classList.add('error-state');
  if (state === 'success') wrap.classList.add('success-state');
  const status = wrap.querySelector('.field-status');
  if (status) status.textContent = statusIcon || '';
}

/* ---- MAIN INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  hideLoader();
  initStars();

  const form       = $('#loginForm');
  const emailInput = $('#email');
  const passInput  = $('#password');
  const emailErr   = $('#emailErr');
  const passErr    = $('#passErr');
  const togglePass = $('#togglePass');
  const rememberCb = $('#remember');
  const submitBtn  = $('#submitBtn');
  const submitText = $('#submit-text');
  const submitLoad = $('#submit-loading');

  if (!form) return;

  /* --- Restore remembered email --- */
  const remembered = localStorage.getItem('remember_email');
  if (remembered && emailInput) {
    emailInput.value = remembered;
    if (rememberCb) rememberCb.checked = true;
  }

  /* --- Password toggle --- */
  togglePass?.addEventListener('click', () => {
    const isPass = passInput.getAttribute('type') === 'password';
    passInput.setAttribute('type', isPass ? 'text' : 'password');
    const icon = togglePass.querySelector('i');
    if (icon) {
      icon.className = isPass
        ? 'fa-regular fa-eye-slash'
        : 'fa-regular fa-eye';
    }
  });

  /* --- Live validation --- */
  emailInput?.addEventListener('blur', () => {
    if (!emailInput.value) return;
    const ok = validateEmail(emailInput.value);
    setFieldState('email-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (emailErr) emailErr.textContent = ok ? '' : 'CORREO INVÁLIDO';
  });
  emailInput?.addEventListener('input', () => {
    if (!emailErr.textContent) return;
    const ok = validateEmail(emailInput.value);
    setFieldState('email-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (emailErr) emailErr.textContent = ok ? '' : 'CORREO INVÁLIDO';
  });

  passInput?.addEventListener('blur', () => {
    if (!passInput.value) return;
    const ok = validatePassword(passInput.value);
    setFieldState('pass-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (passErr) passErr.textContent = ok ? '' : 'MÍNIMO 6 CARACTERES';
  });
  passInput?.addEventListener('input', () => {
    if (!passErr.textContent) return;
    const ok = validatePassword(passInput.value);
    setFieldState('pass-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (passErr) passErr.textContent = ok ? '' : 'MÍNIMO 6 CARACTERES';
  });

  /* --- Form submit --- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    /* Clear previous errors */
    if (emailErr) emailErr.textContent = '';
    if (passErr)  passErr.textContent  = '';
    setFieldState('email-wrap', '');
    setFieldState('pass-wrap', '');

    let ok = true;

    if (!emailInput.value || !validateEmail(emailInput.value)) {
      if (emailErr) emailErr.textContent = 'CORREO INVÁLIDO';
      setFieldState('email-wrap', 'error', '✗');
      ok = false;
    } else {
      setFieldState('email-wrap', 'success', '✓');
    }

    if (!passInput.value || !validatePassword(passInput.value)) {
      if (passErr) passErr.textContent = 'MÍNIMO 6 CARACTERES';
      setFieldState('pass-wrap', 'error', '✗');
      ok = false;
    } else {
      setFieldState('pass-wrap', 'success', '✓');
    }

    if (!ok) {
      toast('⚠ CORRIGE LOS ERRORES', 'var(--red)');
      return;
    }

    /* Show loading state */
    if (submitBtn)  submitBtn.disabled = true;
    if (submitText) submitText.hidden  = true;
    if (submitLoad) submitLoad.hidden  = false;

    /* Simulate async login (500ms) */
    setTimeout(() => {
      /* Save/update profile */
      const p = getProfile();
      if (!p.nombre || p.nombre === 'Estudiante') {
        const base = emailInput.value.split('@')[0];
        p.nombre = base.charAt(0).toUpperCase() + base.slice(1);
      }
      p.email = emailInput.value.trim();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));

      /* Remember email */
      if (rememberCb?.checked) {
        localStorage.setItem('remember_email', emailInput.value);
      } else {
        localStorage.removeItem('remember_email');
      }

      toast('✓ SESIÓN INICIADA — REDIRIGIENDO...', 'var(--green)');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    }, 500);
  });

  /* --- Social buttons (demo) --- */
  document.querySelectorAll('.btn-social').forEach(btn => {
    btn.addEventListener('click', () => {
      toast('⚡ PRÓXIMAMENTE DISPONIBLE', 'var(--yellow)');
    });
  });
});