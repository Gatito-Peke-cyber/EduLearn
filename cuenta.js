/* =====================================================
   EduLearn — cuenta.js  v3.0
   Registro real con Firebase Auth
   ===================================================== */

import { registerWithEmail, loginWithGoogle } from './auth.js';

/* ── KEYS ────────────────────────────────────────── */
const PROFILE_KEY = 'perfil_usuario';

/* ── AVATARS ─────────────────────────────────────── */
const AVATARS = [
  '🎓','🦊','🐱','🐸','🦄','🐧','🦁','🐼',
  '🤖','👾','🧙','🧑‍💻','🐉','🦅','🐢','🎮',
  '⭐','🌈','🚀','💎','🔮','🎯','🌟','🏆',
];

let selectedAvatar = '🎓';

/* ── HELPERS ─────────────────────────────────────── */
const $ = s => document.querySelector(s);

function toast(msg, color = 'var(--cyan)') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = color;
  t.style.color = color;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3200);
}

function setFieldState(wrapId, state, icon) {
  const wrap = $(`#${wrapId}`);
  if (!wrap) return;
  wrap.classList.remove('error-state', 'success-state');
  if (state === 'error')   wrap.classList.add('error-state');
  if (state === 'success') wrap.classList.add('success-state');
  const s = wrap.querySelector('.field-status');
  if (s) s.textContent = icon || '';
}

function clearError(errId, wrapId) {
  const el = $(`#${errId}`);
  if (el) el.textContent = '';
  if (wrapId) setFieldState(wrapId, '');
}

/* ── STARS ───────────────────────────────────────── */
function initStars() {
  const canvas = $('#stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  const COLORS = ['#FFE000','#FF00AA','#ffffff','#00F8FF','#39FF14'];
  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.6+0.4, o: Math.random()*0.5+0.1,
    speed: Math.random()*0.25+0.05,
    ci: Math.floor(Math.random()*COLORS.length),
  }));
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      ctx.globalAlpha = s.o;
      ctx.fillStyle = COLORS[s.ci];
      ctx.fillRect(s.x, s.y, s.r, s.r);
      s.y -= s.speed;
      if (s.y < 0) { s.y = H; s.x = Math.random()*W; }
    });
    requestAnimationFrame(draw);
  })();
  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
}

/* ── LOADER ──────────────────────────────────────── */
function hideLoader() {
  const loader = $('#loader');
  if (!loader) return;
  let w = 0;
  const fill = $('#ld-fill');
  const iv = setInterval(() => {
    w += Math.random()*22+8;
    if (fill) fill.style.width = Math.min(w, 100)+'%';
    if (w >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        loader.style.transition = 'opacity 0.4s';
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);
      }, 200);
    }
  }, 55);
}

/* ── STEPS ───────────────────────────────────────── */
function setStep(n) {
  [1, 2, 3].forEach(i => {
    const s   = $(`#step-${i}`);
    const p   = $(`#panel-step-${i}`);
    const dot = s?.querySelector('.step-dot');
    if (!s) return;
    s.classList.remove('active', 'done');
    if (i < n)       { s.classList.add('done');   if (dot) dot.textContent = '✓'; }
    else if (i === n){ s.classList.add('active'); if (dot) dot.textContent = i; }
    else             { if (dot) dot.textContent = i; }
    if (p) p.style.display = i === n ? '' : 'none';
  });
}

/* ── PASSWORD STRENGTH ───────────────────────────── */
const STRENGTH_LABELS  = ['MUY DÉBIL','DÉBIL','MEDIA','FUERTE','MUY FUERTE'];
const STRENGTH_CLASSES = ['s1','s1','s2','s3','s4'];
const STRENGTH_COLORS  = ['var(--red)','var(--red)','var(--orange)','var(--yellow)','var(--green)'];

function measureStrength(pass) {
  let s = 0;
  if (pass.length >= 6)  s++;
  if (pass.length >= 10) s++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) s++;
  if (/\d/.test(pass) && /[^A-Za-z0-9]/.test(pass)) s++;
  return s;
}

function updateStrength(pass) {
  const wrap = $('#strength-wrap');
  if (!wrap) return;
  if (!pass) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const score = measureStrength(pass);
  [1,2,3,4].forEach(i => {
    const bar = $(`#sb${i}`);
    if (!bar) return;
    bar.className = 'strength-bar';
    if (i <= score) bar.classList.add(STRENGTH_CLASSES[score]);
  });
  const label = $('#strength-label');
  if (label) { label.textContent = STRENGTH_LABELS[score]; label.style.color = STRENGTH_COLORS[score]; }
}

/* ── AVATAR PICKER ───────────────────────────────── */
function initAvatarPicker() {
  const picker = $('#avatar-picker');
  if (!picker) return;
  picker.innerHTML = AVATARS.map(av => `
    <div class="av-opt${av === selectedAvatar ? ' selected' : ''}" data-av="${av}"
         role="button" tabindex="0">${av}</div>
  `).join('');
  picker.querySelectorAll('.av-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.av-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedAvatar = opt.dataset.av;
      const prev = $('#avatar-preview');
      if (prev) prev.textContent = selectedAvatar;
      toast(`🎨 AVATAR: ${selectedAvatar}`, 'var(--magenta)');
    });
    opt.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') opt.click(); });
  });
}

/* ── VALIDACIÓN ──────────────────────────────────── */
function validateEmail(v)    { return /^\S+@\S+\.\S+$/.test(v.trim()); }
function validatePassword(v) { return v.length >= 6; }
function validateName(v)     { return v.trim().length >= 2; }

function validateStep1() {
  let ok = true;
  const checks = [
    { id:'nombre',   wrap:'nombre-wrap',   err:'nombreErr',   fn:validateName,     msg:'MÍNIMO 2 CARACTERES'        },
    { id:'apellido', wrap:'apellido-wrap', err:'apellidoErr', fn:validateName,     msg:'MÍNIMO 2 CARACTERES'        },
    { id:'email',    wrap:'email-wrap',    err:'emailErr',    fn:validateEmail,    msg:'CORREO ELECTRÓNICO INVÁLIDO' },
    { id:'password', wrap:'pass-wrap',     err:'passErr',     fn:validatePassword, msg:'MÍNIMO 6 CARACTERES'        },
  ];
  checks.forEach(({ id, wrap, err, fn, msg }) => {
    const val = $(`#${id}`)?.value || '';
    if (!fn(val)) {
      const el = $(`#${err}`); if (el) el.textContent = msg;
      setFieldState(wrap, 'error', '✗');
      ok = false;
    } else {
      clearError(err, wrap);
      setFieldState(wrap, 'success', '✓');
    }
  });
  // Confirmar contraseña
  const pass    = $('#password')?.value || '';
  const confirm = $('#confirm')?.value  || '';
  if (confirm !== pass || !confirm) {
    const el = $('#confirmErr'); if (el) el.textContent = 'LAS CONTRASEÑAS NO COINCIDEN';
    setFieldState('confirm-wrap', 'error', '✗');
    ok = false;
  } else {
    clearError('confirmErr', 'confirm-wrap');
    setFieldState('confirm-wrap', 'success', '✓');
  }
  // Términos
  if (!$('#terms')?.checked) {
    const el = $('#termsErr'); if (el) el.textContent = 'DEBES ACEPTAR LOS TÉRMINOS';
    ok = false;
  } else {
    const el = $('#termsErr'); if (el) el.textContent = '';
  }
  return ok;
}

/* ── INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  hideLoader();
  initStars();
  setStep(1);

  const form = $('#registerForm');
  if (!form) return;

  /* Validación en vivo */
  const liveValidate = (inputId, wrapId, errId, fn, msg) => {
    const el = $(`#${inputId}`);
    if (!el) return;
    const run = () => {
      const ok = fn(el.value);
      setFieldState(wrapId, ok ? 'success' : 'error', ok ? '✓' : '✗');
      const errEl = $(`#${errId}`);
      if (errEl) errEl.textContent = ok ? '' : msg;
    };
    el.addEventListener('blur', run);
    el.addEventListener('input', () => { if ($(`#${errId}`)?.textContent) run(); });
  };
  liveValidate('nombre',   'nombre-wrap',   'nombreErr',   validateName,     'MÍNIMO 2 CARACTERES');
  liveValidate('apellido', 'apellido-wrap', 'apellidoErr', validateName,     'MÍNIMO 2 CARACTERES');
  liveValidate('email',    'email-wrap',    'emailErr',    validateEmail,    'CORREO INVÁLIDO');
  liveValidate('password', 'pass-wrap',     'passErr',     validatePassword, 'MÍNIMO 6 CARACTERES');

  /* Fortaleza de contraseña */
  $('#password')?.addEventListener('input', e => updateStrength(e.target.value));

  /* Confirmar contraseña */
  $('#confirm')?.addEventListener('input', () => {
    const pass = $('#password')?.value || '';
    const conf = $('#confirm')?.value  || '';
    const ok = conf === pass && conf.length > 0;
    setFieldState('confirm-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    const el = $('#confirmErr');
    if (el) el.textContent = ok ? '' : 'LAS CONTRASEÑAS NO COINCIDEN';
  });

  /* Toggle contraseñas */
  [['togglePass1','password'],['togglePass2','confirm']].forEach(([btnId, inputId]) => {
    $(`#${btnId}`)?.addEventListener('click', () => {
      const input = $(`#${inputId}`);
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      const icon = $(`#${btnId} i`);
      if (icon) icon.className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });

  /* ── STEP 1 → STEP 2 ── */
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateStep1()) { toast('⚠ CORRIGE LOS ERRORES', 'var(--red)'); return; }
    initAvatarPicker();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Volver ── */
  $('#btn-back')?.addEventListener('click', () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── STEP 2 → STEP 3: CREAR CUENTA EN FIREBASE ── */
  $('#btn-confirm-avatar')?.addEventListener('click', async () => {
    const btn = $('#btn-confirm-avatar');
    btn.disabled    = true;
    btn.textContent = '⟳ CREANDO CUENTA...';

    const nombre   = $('#nombre')?.value.trim()   || '';
    const apellido = $('#apellido')?.value.trim() || '';
    const email    = $('#email')?.value.trim()    || '';
    const password = $('#password')?.value        || '';
    const nickname = $('#nickname')?.value.trim() || '';

    // Nombre completo: si puso apodo lo usamos, sino nombre+apellido
    const displayName = nickname || `${nombre} ${apellido}`.trim();

    const { user, error } = await registerWithEmail(
      displayName, email, password, selectedAvatar
    );

    if (error) {
      btn.disabled    = false;
      btn.textContent = '▶ CREAR MI CUENTA';
      toast(`❌ ${error}`, 'var(--red)');
      return;
    }

    // ¡Éxito!
    toast('🎉 ¡CUENTA CREADA! BIENVENIDO/A', 'var(--green)');
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Redirigir en 4 segundos
    setTimeout(() => { window.location.href = 'perfil.html'; }, 4000);
  });

  /* ── Ir al perfil manual ── */
  $('#btn-go-profile')?.addEventListener('click', () => {
    window.location.href = 'perfil.html';
  });

  /* ── Google ── */
  $('#btn-google')?.addEventListener('click', async () => {
    toast('⟳ CONECTANDO CON GOOGLE...', 'var(--cyan)');
    const { user, isNew, error } = await loginWithGoogle();
    if (error) { toast(`❌ ${error}`, 'var(--red)'); return; }
    toast(`✓ ¡BIENVENIDO/A!${isNew ? ' +150 XP' : ''}`, 'var(--green)');
    setTimeout(() => { window.location.href = 'perfil.html'; }, 800);
  });

  /* ── Facebook (próximamente) ── */
  $('#btn-facebook')?.addEventListener('click', () => {
    toast('⚡ PRÓXIMAMENTE DISPONIBLE', 'var(--yellow)');
  });
});