'use strict';

import { createDemoInteraction, maximumFrameWidth } from './demo-interaction.mjs';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
function applyTheme(theme, persist = true) {
  const nextTheme = theme === 'night' ? 'night' : 'day';
  document.documentElement.dataset.theme = nextTheme;
  themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === nextTheme)));
  if (persist) {
    try { window.localStorage.setItem('portfolio-theme', nextTheme); } catch {}
  }
}
let initialTheme = 'day';
try {
  const savedTheme = window.localStorage.getItem('portfolio-theme');
  if (savedTheme === 'night') initialTheme = 'night';
} catch {}
applyTheme(initialTheme, false);
themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));

function initRevealMotion() {
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  const textElements = [...document.querySelectorAll('[data-animate-text]')];
  textElements.forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const isTitle = element.classList.contains('project-name');
    const baseDelay = isTitle ? 0 : element.classList.contains('project-subtitle') ? 220 : 90;
    let index = 0;
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      (node.textContent.match(/\S+|\s+/g) || []).forEach(part => {
        if (/^\s+$/.test(part)) { fragment.append(document.createTextNode(part)); return; }
        const word = document.createElement('span');
        word.className = 'word-reveal';
        word.textContent = part;
        word.style.setProperty('--word-delay', `${baseDelay + Math.min(index++ * (isTitle ? 80 : 18), 320)}ms`);
        fragment.append(word);
      });
      node.replaceWith(fragment);
    });
  });
  const targets = [...document.querySelectorAll('.identity, .theme-toggle, .project-kind, .project-heading h2, .project-copy > p, .technology-list, .device-controls, .demo-instructions, .media-reveal, .demo-links, .project-details, .details-content > div, .contact-label, .contact-phone, .whatsapp-symbol, .footer-bottom')];
  targets.forEach(element => element.setAttribute('data-reveal', ''));
  document.querySelectorAll('.project-intro').forEach(intro => {
    intro.querySelector('h2').style.setProperty('--reveal-delay', '80ms');
    intro.querySelector('.project-copy > p').style.setProperty('--reveal-delay', '160ms');
    intro.querySelector('.technology-list').style.setProperty('--reveal-delay', '240ms');
  });
  document.querySelector('.theme-toggle').style.setProperty('--reveal-delay', '120ms');
  document.querySelectorAll('.technology-list li').forEach((element, index) => element.style.setProperty('--item-index', index % 4));
  document.querySelectorAll('.details-content > div').forEach((element, index) => element.style.setProperty('--reveal-delay', `${index * 100}ms`));
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: .01, rootMargin: '0px 0px -4% 0px' });
  targets.forEach(element => observer.observe(element));
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    targets.forEach(element => element.classList.add('is-revealed'));
    observer.disconnect();
  });
}
initRevealMotion();

// The heading recedes gently as its project takes over. Interactive frames
// stop moving after their entrance; the visitor always retains native scroll.
function initSceneMotion() {
  const intros = [...document.querySelectorAll('.project-intro')];
  const nav = document.querySelector('.site-nav');
  const links = [...nav.querySelectorAll('a')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  let pendingFrame = 0;
  let currentIndex = -1;
  function update() {
    pendingFrame = 0;
    const viewport = window.innerHeight;
    const marker = viewport * .48;
    let nextIndex = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= marker) nextIndex = index;
    });
    if (window.scrollY + viewport >= document.documentElement.scrollHeight - 8) nextIndex = links.length - 1;
    if (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      links.forEach((link, index) => {
        if (index === currentIndex) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }
    const activeLink = links[currentIndex];
    nav.style.setProperty('--nav-x', `${activeLink.offsetLeft}px`);
    nav.style.setProperty('--nav-width', `${activeLink.offsetWidth}px`);
    intros.forEach(intro => {
      const rect = intro.getBoundingClientRect();
      const progress = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, (106 - rect.top) / Math.max(rect.height, 1)));
      intro.style.setProperty('--chapter-lift', `${(-progress * 24).toFixed(2)}px`);
      intro.style.setProperty('--chapter-scale', (1 - progress * .035).toFixed(4));
    });
  }
  function schedule() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  reducedMotion.addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(nav);
  update();
}
initSceneMotion();

const showcase = document.querySelector('#nival-showcase');
const frame = document.querySelector('#device-frame');
const screen = document.querySelector('#device-screen');
const demo = document.querySelector('#nival-demo');
const poster = document.querySelector('#demo-poster');
const viewButtons = [...document.querySelectorAll('[data-device]')];
const announcement = document.querySelector('#demo-announcement');
let interaction;
let outerMomentumFrame = 0;
function stopOuterMomentum() {
  cancelAnimationFrame(outerMomentumFrame);
  outerMomentumFrame = 0;
}
function continueOuterTouch(velocity) {
  let previous = performance.now();
  const started = previous;
  function tick(now) {
    const elapsed = Math.min(32, now - previous);
    previous = now;
    velocity *= Math.exp(-elapsed / 170);
    const before = window.scrollY;
    window.scrollBy({ top: velocity * elapsed, behavior: 'instant' });
    if (Math.abs(velocity) > .06 && now - started < 650 && Math.abs(window.scrollY - before) > .1) outerMomentumFrame = requestAnimationFrame(tick);
    else outerMomentumFrame = 0;
  }
  outerMomentumFrame = requestAnimationFrame(tick);
}
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== demo.contentWindow) return;
  const data = event.data;
  if (!data || data.type !== 'portfolio:scroll' || !['wheel', 'touch'].includes(data.input) || !['move', 'end'].includes(data.phase)) return;
  if (interaction?.isActive()) {
    // While selected, the demo owns the gesture. Its loader or upper edge
    // cannot move the centered portfolio; only the true end releases it.
    if (data.phase !== 'move' || !(data.delta > 0) || !interaction.releaseAtEnd()) return;
  }
  stopOuterMomentum();
  if (document.fullscreenElement) return;
  const scale = data.input === 'touch' ? screen.clientWidth / (view === 'mobile' ? 393 : 1440) : 1;
  if (data.phase === 'end') {
    if (!reducedMotion.matches && Number.isFinite(data.velocity)) {
      const velocity = Math.max(-2, Math.min(2, data.velocity * scale));
      if (Math.abs(velocity) > .12) continueOuterTouch(velocity);
    }
    return;
  }
  if (!Number.isFinite(data.delta)) return;
  const delta = Math.max(-window.innerHeight, Math.min(window.innerHeight, data.delta * scale));
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
});
['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => window.addEventListener(type, stopOuterMomentum, { passive: true }));
document.addEventListener('fullscreenchange', stopOuterMomentum);
document.addEventListener('visibilitychange', stopOuterMomentum);

let view = 'mobile';
let frameAnimation;
let switchBlurTimer;
let demoStarted = false;
let demoLoadTimeout;
let resetGeneration = 0;
let resetTimer;

function resetDemoToStart() {
  const generation = ++resetGeneration;
  clearTimeout(resetTimer);

  function resetPosition() {
    if (!screen.classList.contains('is-loaded')) return true;
    try {
      const win = demo.contentWindow;
      const doc = win.document;
      const hero = doc.getElementById('inicio');
      if (!hero) return false;
      // Cancel Nival's active gestures before asking its controller to navigate.
      win.dispatchEvent(new win.HashChangeEvent('hashchange'));
      win.history.replaceState(win.history.state, '', '#inicio');
      if (doc.documentElement.classList.contains('scroll-programmatic') || doc.querySelector('[data-spec-transition]')) return false;
      const navigation = new win.CustomEvent('nival:section-navigation', {
        cancelable: true,
        detail: { target: hero, behavior: 'instant' }
      });
      if (win.dispatchEvent(navigation)) win.scrollTo({ top: 0, behavior: 'instant' });
      return true;
    } catch {
      demo.src = `${demo.dataset.src}#inicio`;
      return true;
    }
  }

  resetPosition();
  // Reset again after the viewport resize, which otherwise preserves Nival's old section.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    let attempts = 0;
    function settle() {
      if (generation !== resetGeneration) return;
      if (resetPosition()) return;
      if (++attempts < 30) resetTimer = window.setTimeout(settle, 50);
      else demo.src = `${demo.dataset.src}#inicio`;
    }
    settle();
  }));
}

function fitDemo() {
  if (!document.fullscreenElement) {
    const styles = getComputedStyle(frame);
    const horizontalChrome = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
      + parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
    const verticalChrome = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)
      + parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth)
      + (view === 'desktop' ? frame.querySelector('.desktop-chrome').offsetHeight : 0);
    const nav = document.querySelector('.site-nav');
    const width = maximumFrameWidth({ height: window.visualViewport?.height || window.innerHeight,
      navBottom: parseFloat(getComputedStyle(nav).top) + nav.offsetHeight,
      verticalChrome, horizontalChrome, ratio: view === 'mobile' ? 393 / 852 : 1440 / 900 });
    frame.style.setProperty('--frame-max-width', `${width}px`);
  }
  const logicalWidth = view === 'mobile' ? 393 : 1440;
  const logicalHeight = view === 'mobile' ? 852 : 900;
  const scale = screen.clientWidth / logicalWidth;
  screen.style.height = `${Math.round(logicalHeight * scale)}px`;
  demo.style.width = `${logicalWidth}px`;
  demo.style.height = `${logicalHeight}px`;
  demo.style.transform = `scale(${scale})`;
  const space = frame.parentElement;
  space.style.setProperty('--halo-width', `${frame.offsetWidth}px`);
  space.style.setProperty('--halo-height', `${frame.offsetHeight}px`);
  space.style.setProperty('--halo-radius', getComputedStyle(frame).borderTopLeftRadius);
}

function changeView(nextView) {
  interaction?.deactivate('format');
  resetDemoToStart();
  if (view === nextView) return;
  clearTimeout(switchBlurTimer);
  showcase.classList.add('is-switching');
  switchBlurTimer = window.setTimeout(() => showcase.classList.remove('is-switching'), reducedMotion.matches ? 0 : 820);
  frameAnimation?.cancel();
  const before = frame.getBoundingClientRect();
  view = nextView;
  showcase.dataset.view = view;
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.device === view)));
  poster.src = view === 'mobile' ? '/portfolio/nival-mobile.png' : '/portfolio/nival-desktop.png';
  fitDemo();
  const after = frame.getBoundingClientRect();
  if (!reducedMotion.matches) {
    frameAnimation = frame.animate([
      { transformOrigin: 'top left', transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})` },
      { transformOrigin: 'top left', transform: 'translate(0, 0) scale(1, 1)' }
    ], { duration: 760, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  announcement.textContent = view === 'mobile' ? 'Visualização de celular selecionada. Demonstração no início.' : 'Visualização de computador selecionada. Demonstração no início.';
}

function startDemo() {
  if (demoStarted) return;
  demoStarted = true;
  fitDemo();
  demo.src = demo.dataset.src;
  demoLoadTimeout = window.setTimeout(() => {
    if (!screen.classList.contains('is-loaded')) screen.querySelector('.demo-error').hidden = false;
  }, 30000);
}

interaction = createDemoInteraction({ frame, demo, activation: document.querySelector('#activate-demo'),
  announcement, reducedMotion, startDemo, fitDemo });
function resizeDemo() { fitDemo(); interaction.recenter(); }
window.addEventListener('resize', resizeDemo, { passive: true });
window.visualViewport?.addEventListener('resize', resizeDemo, { passive: true });

demo.addEventListener('load', () => {
  if (!demoStarted) return;
  clearTimeout(demoLoadTimeout);
  screen.classList.add('is-loaded');
  screen.querySelector('.demo-error').hidden = true;
  resetDemoToStart();
});
viewButtons.forEach(button => button.addEventListener('click', () => { startDemo(); changeView(button.dataset.device); }));
document.querySelector('#restart-demo').addEventListener('click', () => {
  if (!demoStarted) startDemo();
  else resetDemoToStart();
});
new ResizeObserver(fitDemo).observe(screen);
fitDemo();
document.querySelector('#expand-demo').addEventListener('click', async () => {
  startDemo();
  if (frame.requestFullscreen) {
    try { await frame.requestFullscreen(); fitDemo(); }
    catch { window.open(demo.dataset.src, '_blank', 'noopener'); }
  } else window.open(demo.dataset.src, '_blank', 'noopener');
});
document.querySelector('#exit-fullscreen').addEventListener('click', () => document.exitFullscreen?.());
document.addEventListener('fullscreenchange', fitDemo);
if ('IntersectionObserver' in window) {
  const demoObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { startDemo(); demoObserver.disconnect(); }
  }, { rootMargin: '250px' });
  demoObserver.observe(showcase);
} else startDemo();

const video = document.querySelector('#game-video');
const videoButton = document.querySelector('#video-toggle');
const videoLabel = videoButton.querySelector('span');
let videoStarted = false;
let userPaused = false;
let videoVisible = false;
function loadVideo() {
  if (videoStarted) return;
  videoStarted = true;
  const source = video.querySelector('source');
  source.src = source.dataset.src;
  video.load();
}
function syncVideoButton() {
  const playing = !video.paused;
  videoButton.classList.toggle('is-playing', playing);
  videoButton.setAttribute('aria-label', playing ? 'Pausar demonstração' : 'Reproduzir demonstração');
  videoLabel.textContent = playing ? 'Pausar' : 'Reproduzir';
}
function updateVideoPlayback() {
  if (!videoVisible || document.hidden) { video.pause(); return; }
  if (!reducedMotion.matches && !userPaused) {
    loadVideo();
    video.play().catch(syncVideoButton);
  }
}
videoButton.addEventListener('click', () => {
  if (video.paused) { userPaused = false; loadVideo(); video.play().catch(() => { video.controls = true; }); }
  else { userPaused = true; video.pause(); }
});
video.addEventListener('play', syncVideoButton);
video.addEventListener('pause', syncVideoButton);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    videoVisible = entries[0].isIntersecting;
    updateVideoPlayback();
  }, { threshold: .3 }).observe(video);
}
document.addEventListener('visibilitychange', updateVideoPlayback);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) video.pause(); else updateVideoPlayback(); });
