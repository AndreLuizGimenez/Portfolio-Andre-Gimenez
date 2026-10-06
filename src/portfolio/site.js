'use strict';

import { createLoader } from './loader.js';
import { createStack } from './stack.js';
import { initShowcase } from './showcase.js';
import { initReel } from './reel.js';
import { initTypeset } from './typeset.js';
import { initBackdrops } from './backdrop.js';
import { initGlass } from './glass.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// First of all, the loading card: from here the opening is this script's. Until the card leaves, nothing moves.
const loader = createLoader({ reducedMotion });
let loading = loader.active;

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
  // The lens takes its first place directly: only a change of selection travels.
  group.classList.add('is-placing');
  positionLens();
  void group.offsetWidth;
  group.classList.remove('is-placing');
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
const game = document.querySelector('#jogo');
const stack = createStack(document.querySelector('.stack'), {
  reducedMotion,
  isCaptured: () => showcase.isActive(),
  isHeld: () => loading,
  onStart({ from, to, direction }) {
    typesetRest?.();
    if (stack.panels[from] === project) showcase.leave();
    if (stack.panels[to] === project) {
      showcase.enter(direction > 0);
      reel.warm();
    }
    if (stack.panels[to] === game) reel.show(direction > 0);
  },
  onEnd({ from, to }) {
    if (stack.panels[from] === game) reel.hide();
    // A section left below the current one will rise again, so it starts over.
    if (to < stack.panels.indexOf(project)) showcase.rest();
    if (to < stack.panels.indexOf(game)) reel.stage();
  },
});
// Paragraphs are set as blocks under the loading card, all of them. Without it, where the visit begins; the
// others when the page has a moment, or as soon as a move begins, still out of sight.
const paragraphs = [...document.querySelectorAll('.hero-description, .project-lead, .project-description')];
const opening = stack.panels[stack.index];
let typesetRest = null;
if (loading) initTypeset(paragraphs);
else {
  initTypeset(paragraphs.filter(paragraph => opening.contains(paragraph)));
  typesetRest = () => {
    typesetRest = null;
    initTypeset(paragraphs.filter(paragraph => !opening.contains(paragraph)));
  };
  (window.requestIdleCallback || (run => setTimeout(run, 200)))(() => typesetRest?.(), { timeout: 1000 });
}
// After the text is set: the panes of glass hug it.
const backdrops = initBackdrops({ reducedMotion });
const showcase = initShowcase(project, {
  reducedMotion,
  // The pane behind the text comes in just ahead of it, from the same side.
  onPose(pose) {
    const pane = backdrops.pane(project);
    if (pose === 'staged') pane.stage();
    else if (pose === 'entering') pane.arrive({ delay: 380, shift: [-.45 * parseFloat(getComputedStyle(project).getPropertyValue('--enter-text')) || -90, 0] });
    else pane.show();
  },
  onView: (view, animate) => viewSwitch.select(view, animate),
  onRelease: direction => stack.spend(direction),
});
const viewSwitch = createSwitch(project.querySelector('.view-switch'), 'viewChoice', view => showcase.setView(view));
const reel = initReel(game, {
  reducedMotion,
  // The pane behind the copy comes in just ahead of it, from the same side.
  onPose(pose) {
    const pane = backdrops.pane(game);
    if (pose === 'staged') pane.stage();
    else if (pose === 'entering') pane.arrive({ delay: 380, shift: [-.45 * parseFloat(getComputedStyle(game).getPropertyValue('--enter-text')) || 90, 0] });
    else pane.show();
  },
});
showcase.stageEntrance();
reel.stage();
// A visit that opens on a later section sees it enter once the card has left.
loader.done.then(() => {
  if (stack.panels[stack.index] === project) requestAnimationFrame(() => { showcase.enter(); reel.warm(); });
  if (stack.panels[stack.index] === game) requestAnimationFrame(() => reel.show(true));
});

async function initHeroSequence() {
  const hero = document.querySelector('.hero-section');
  const title = hero?.querySelector('.hero-title');
  const pieces = [...(title?.querySelectorAll('.hero-piece') || [])];
  if (!hero || !title) return;
  const pane = backdrops.pane(hero);
  const settleAll = () => {
    pane.show();
    hero.classList.add('hero-complete', 'hero-ready');
    title.classList.add('is-settled');
    document.querySelectorAll('.hero-secondary').forEach(element => element.classList.add('is-settled'));
  };
  // The page's head has already set the starting pose. A visit that opens on a later section finds the opening
  // built underneath, and so does one whose opening was shown as it stands while these scripts were late.
  const html = document.documentElement;
  if (reducedMotion.matches || stack.index > 0 || !html.classList.contains('hero-motion-ready')) { settleAll(); return; }
  pane.stage();
  // The opening begins once the loading card has left, with the final font metrics rather than a fallback
  // typeface. The card may instead have given up and shown the page as it stands, type or not.
  await loader.done;
  if (reducedMotion.matches || !html.classList.contains('hero-motion-ready')) { settleAll(); return; }
  await document.fonts.ready;
  if (reducedMotion.matches) { settleAll(); return; }
  html.dataset.opening = 'live';
  requestAnimationFrame(() => hero.classList.add('hero-building'));
  pieces.at(-1)?.addEventListener('animationend', event => {
    if (event.animationName !== 'title-build') return;
    hero.classList.add('hero-complete');
    title.classList.add('hero-impact');
    const onTitleSettled = event => {
      if (event.target !== title || event.animationName !== 'title-settle') return;
      title.classList.add('is-settled');
      hero.classList.add('hero-ready');
      pane.arrive();
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
// Once the selectors have placed their lenses.
const lenses = initGlass({ eager: loading });

// Under the card, everything the visit will need is fetched, decoded, drawn or built once: the type, every glass
// backdrop with its first frame, every picture, every lens, and the clip's element, still without its file.
if (loading) {
  const pictures = [...document.querySelectorAll('.demo-poster.poster-mobile, .game-poster img, .whatsapp-symbol img'), ...showcase.preload()];
  loader.track(document.fonts.ready, { weight: 3, required: true });
  // A backdrop drawn by a slow GPU, or in a tab out of sight, which draws nothing, joins in when it is ready.
  loader.track(backdrops.prepare(), { weight: 4, required: true, within: 3000 });
  pictures.forEach(picture => loader.track(picture.decode?.(), { weight: 2 }));
  loader.track(lenses);
  reel.warm('none');
}
loader.release();
loader.done.then(() => {
  loading = false;
  // Then the clip's file, in the background, unless the visitor is saving data: then it waits, as before,
  // until the visit reaches the section before it.
  const connection = navigator.connection;
  if (!connection?.saveData && !/2g$/.test(connection?.effectiveType || '')) reel.warm('auto');
});
