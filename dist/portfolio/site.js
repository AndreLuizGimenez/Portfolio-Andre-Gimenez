'use strict';

import { createStack } from './stack.js?v=5';
import { initShowcase } from './showcase.js?v=5';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// A two-option rail whose clear lens travels to the pressed button.
function createSwitch(group, key, choose) {
  const buttons = [...group.querySelectorAll('button')];
  let switchTimer;

  function positionLens() {
    const selected = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
    if (!selected) return;
    // Equal optical margins, including the overhang that reveals the refracted rail edge.
    group.style.setProperty('--lens-x', `${selected.offsetLeft - 3}px`);
    group.style.setProperty('--lens-width', `${selected.offsetWidth + 6}px`);
  }

  function select(value, animate = false) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset[key] === value)));
    positionLens();
    if (!animate || reducedMotion.matches) return;
    clearTimeout(switchTimer);
    group.classList.remove('is-switching');
    // Start the travelling lens and its elastic expansion in the same frame.
    void group.offsetWidth;
    group.classList.add('is-switching');
    switchTimer = setTimeout(() => group.classList.remove('is-switching'), 480);
  }

  buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset[key])));
  if ('ResizeObserver' in window) new ResizeObserver(positionLens).observe(group);
  window.addEventListener('resize', positionLens, { passive: true });
  positionLens();
  return { select };
}

const themeSwitch = createSwitch(document.querySelector('.theme-toggle'), 'themeChoice', theme => applyTheme(theme));

function applyTheme(theme, persist = true) {
  const next = theme === 'night' ? 'night' : 'day';
  const changed = document.documentElement.dataset.theme !== next;
  document.documentElement.dataset.theme = next;
  themeSwitch.select(next, persist && changed);
  if (persist) {
    try { localStorage.setItem('portfolio-theme', next); } catch {}
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'night' ? '#0e1921' : '#f1f5f4');
}

let initialTheme = 'day';
try { if (localStorage.getItem('portfolio-theme') === 'night') initialTheme = 'night'; } catch {}
applyTheme(initialTheme, false);

// The stack comes first: everything after it measures the layout it puts in place.
const project = document.querySelector('#ecommerce');
const stack = createStack(document.querySelector('.stack'), {
  reducedMotion,
  isCaptured: () => showcase.isActive(),
  onStart({ from, to, direction }) {
    if (stack.panels[from] === project) showcase.leave();
    if (stack.panels[to] === project && direction > 0) showcase.enter();
  },
  onEnd({ from, to }) {
    if (stack.panels[from] === project && to < from) showcase.rest();
  },
});
const showcase = initShowcase(project, {
  reducedMotion,
  onView: (view, animate) => viewSwitch.select(view, animate),
  onRelease: direction => stack.spend(direction),
});
const viewSwitch = createSwitch(project.querySelector('.view-switch'), 'viewChoice', view => showcase.setView(view));
showcase.stageEntrance();
if (stack.panels[stack.index] === project) requestAnimationFrame(() => showcase.enter());

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
  // A visit that opens on a later section finds the opening already built underneath.
  if (reducedMotion.matches || stack.index > 0) { settleAll(); return; }
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
