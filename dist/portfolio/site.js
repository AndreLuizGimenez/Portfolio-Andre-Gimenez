'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const showcase = document.querySelector('#nival-showcase');
const frame = document.querySelector('#device-frame');
const screen = document.querySelector('#device-screen');
const demo = document.querySelector('#nival-demo');
const poster = document.querySelector('#demo-poster');
const viewButtons = [...document.querySelectorAll('[data-device]')];
const announcement = document.querySelector('#demo-announcement');
let view = 'mobile';
let frameAnimation;
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
  const logicalWidth = view === 'mobile' ? 393 : 1440;
  const logicalHeight = view === 'mobile' ? 852 : 900;
  const scale = screen.clientWidth / logicalWidth;
  screen.style.height = `${Math.round(logicalHeight * scale)}px`;
  demo.style.width = `${logicalWidth}px`;
  demo.style.height = `${logicalHeight}px`;
  demo.style.transform = `scale(${scale})`;
}

function changeView(nextView) {
  resetDemoToStart();
  if (view === nextView) return;
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
