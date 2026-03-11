/* =====================================================
   EduLearn — login.js  v3.0
   Login real con Firebase Auth
   IMPORTANTE: en login.html cambia el script tag a:
   <script type="module" src="login.js"></script>
   ===================================================== */

import { loginWithEmail, loginWithGoogle, resetPassword } from './auth.js';

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
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
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

function validateEmail(v) { return /^\S+@\S+\.\S+$/.test(v.trim()); }
function validatePassword(v) { return v.length >= 6; }

/* ── STARS ───────────────────────────────────────── */
function initStars() {
  const canvas = $('#stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  const COLORS = ['#FFE000','#00F8FF','#ffffff','#FF00AA','#39FF14'];
  const stars = Array.from({ length: 100 }, () => ({
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
    w += Math.random()*20+8;
    if (fill) fill.style.width = Math.min(w, 100)+'%';
    if (w >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        loader.style.transition = 'opacity 0.4s';
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);
      }, 250);
    }
  }, 60);
}

/* ── INIT ────────────────────────────────────────── */
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

  /* ── Restaurar email recordado ── */
  const remembered = localStorage.getItem('remember_email');
  if (remembered && emailInput) {
    emailInput.value = remembered;
    if (rememberCb) rememberCb.checked = true;
  }

  /* ── Toggle contraseña ── */
  togglePass?.addEventListener('click', () => {
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    const icon = togglePass.querySelector('i');
    if (icon) icon.className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  });

  /* ── Validación en vivo ── */
  emailInput?.addEventListener('blur', () => {
    if (!emailInput.value) return;
    const ok = validateEmail(emailInput.value);
    setFieldState('email-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (emailErr) emailErr.textContent = ok ? '' : 'CORREO INVÁLIDO';
  });
  emailInput?.addEventListener('input', () => {
    if (!emailErr?.textContent) return;
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
    if (!passErr?.textContent) return;
    const ok = validatePassword(passInput.value);
    setFieldState('pass-wrap', ok ? 'success' : 'error', ok ? '✓' : '✗');
    if (passErr) passErr.textContent = ok ? '' : 'MÍNIMO 6 CARACTERES';
  });

  /* ── Submit ── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Limpiar errores
    if (emailErr) emailErr.textContent = '';
    if (passErr)  passErr.textContent  = '';
    setFieldState('email-wrap', '');
    setFieldState('pass-wrap', '');

    let ok = true;
    if (!validateEmail(emailInput.value)) {
      if (emailErr) emailErr.textContent = 'CORREO INVÁLIDO';
      setFieldState('email-wrap', 'error', '✗');
      ok = false;
    }
    if (!validatePassword(passInput.value)) {
      if (passErr) passErr.textContent = 'MÍNIMO 6 CARACTERES';
      setFieldState('pass-wrap', 'error', '✗');
      ok = false;
    }
    if (!ok) { toast('⚠ CORRIGE LOS ERRORES', 'var(--red)'); return; }

    // Loading state
    submitBtn.disabled   = true;
    if (submitText) submitText.hidden = true;
    if (submitLoad) submitLoad.hidden = false;

    // Firebase login
    const { user, error } = await loginWithEmail(
      emailInput.value.trim(),
      passInput.value
    );

    if (error) {
      submitBtn.disabled   = false;
      if (submitText) submitText.hidden = false;
      if (submitLoad) submitLoad.hidden = true;
      setFieldState('email-wrap', 'error', '✗');
      setFieldState('pass-wrap',  'error', '✗');
      toast(`❌ ${error}`, 'var(--red)');
      return;
    }

    // Guardar email si "recordarme" activo
    if (rememberCb?.checked) {
      localStorage.setItem('remember_email', emailInput.value.trim());
    } else {
      localStorage.removeItem('remember_email');
    }

    setFieldState('email-wrap', 'success', '✓');
    setFieldState('pass-wrap',  'success', '✓');
    toast('✓ SESIÓN INICIADA — REDIRIGIENDO...', 'var(--green)');

    setTimeout(() => { window.location.href = 'perfil.html'; }, 700);
  });

  /* ── Google ── */
  document.querySelectorAll('.btn-social').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isGoogle = btn.querySelector('.fa-google') || btn.textContent.includes('GOOGLE');
      if (!isGoogle) { toast('⚡ PRÓXIMAMENTE DISPONIBLE', 'var(--yellow)'); return; }

      toast('⟳ CONECTANDO CON GOOGLE...', 'var(--cyan)');
      const { user, error } = await loginWithGoogle();
      if (error) { toast(`❌ ${error}`, 'var(--red)'); return; }
      toast('✓ SESIÓN INICIADA', 'var(--green)');
      setTimeout(() => { window.location.href = 'perfil.html'; }, 700);
    });
  });

  /* ── Olvidé mi contraseña ── */
  document.querySelector('.form-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!validateEmail(email)) {
      toast('⚠ ESCRIBE TU CORREO PRIMERO', 'var(--yellow)');
      emailInput.focus();
      return;
    }
    const { error } = await resetPassword(email);
    if (error) { toast(`❌ ${error}`, 'var(--red)'); return; }
    toast('📧 CORREO DE RECUPERACIÓN ENVIADO', 'var(--green)');
  });
});