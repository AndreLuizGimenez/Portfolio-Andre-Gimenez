'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeToggle = document.querySelector('.theme-toggle');
let switchTimer;

function positionThemeLens() {
  const selected = themeButtons.find(button => button.getAttribute('aria-pressed') === 'true');
  if (!themeToggle || !selected) return;
  // Equal optical margins, including the overhang that reveals the refracted rail edge.
  themeToggle.style.setProperty('--theme-x', `${selected.offsetLeft - 3}px`);
  themeToggle.style.setProperty('--theme-width', `${selected.offsetWidth + 6}px`);
}

function applyTheme(theme, persist = true) {
  const next = theme === 'night' ? 'night' : 'day';
  const changed = document.documentElement.dataset.theme !== next;
  document.documentElement.dataset.theme = next;
  themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === next)));
  positionThemeLens();
  if (persist && changed && !reducedMotion.matches) {
    clearTimeout(switchTimer);
    themeToggle.classList.remove('is-switching');
    // Start the travelling lens and its elastic expansion in the same frame.
    void themeToggle.offsetWidth;
    themeToggle.classList.add('is-switching');
    switchTimer = setTimeout(() => themeToggle.classList.remove('is-switching'), 480);
  }
  if (persist) {
    try { localStorage.setItem('portfolio-theme', next); } catch {}
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'night' ? '#0e1921' : '#f1f5f4');
}

let initialTheme = 'day';
try { if (localStorage.getItem('portfolio-theme') === 'night') initialTheme = 'night'; } catch {}
applyTheme(initialTheme, false);
themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
if (themeToggle && 'ResizeObserver' in window) new ResizeObserver(positionThemeLens).observe(themeToggle);
window.addEventListener('resize', positionThemeLens, { passive: true });

async function initHeroSequence() {
  const hero = document.querySelector('.hero-section');
  const title = hero?.querySelector('.hero-title');
  const pieces = [...(title?.querySelectorAll('.hero-piece') || [])];
  if (!hero || !title) return;
  const settleAll = () => {
    hero.classList.add('hero-complete', 'hero-ready');
    title.classList.add('is-settled');
    document.querySelectorAll('.hero-secondary').forEach(element => element.classList.add('is-settled'));
  };
  if (reducedMotion.matches) { settleAll(); return; }
  document.documentElement.classList.add('hero-motion-ready');
  // Begin with the final font metrics rather than animating a fallback typeface.
  await document.fonts.ready;
  if (reducedMotion.matches) { settleAll(); return; }
  requestAnimationFrame(() => hero.classList.add('hero-building'));
  pieces.at(-1)?.addEventListener('animationend', event => {
    if (event.animationName !== 'title-build') return;
    hero.classList.add('hero-complete');
    title.classList.add('hero-impact');
    const onTitleSettled = event => {
      if (event.target !== title || event.animationName !== 'title-settle') return;
      title.classList.add('is-settled');
      hero.classList.add('hero-ready');
      title.removeEventListener('animationend', onTitleSettled);
    };
    title.addEventListener('animationend', onTitleSettled);
  }, { once: true });
  document.querySelectorAll('.hero-secondary').forEach(element => {
    element.addEventListener('animationend', event => {
      if (event.target === element && event.animationName === 'support-settle') element.classList.add('is-settled');
    });
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) settleAll(); });
}
initHeroSequence();
