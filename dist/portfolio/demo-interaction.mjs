export const MOBILE_VIEWPORT = Object.freeze({ width: 414, height: 852, maxFrameWidth: 452 });

export function maximumFrameWidth({ height, navBottom, verticalChrome, horizontalChrome, ratio }) {
  const margin = Math.min(Math.max(24, navBottom + 12), height * .3);
  const available = Math.max(verticalChrome + 1, height - margin * 2);
  return (available - verticalChrome - 1) * ratio + horizontalChrome;
}

export function centeredScrollTop({ scrollTop, top, height, viewportHeight, offsetTop = 0 }) {
  return Math.max(0, scrollTop + top + height / 2 - offsetTop - viewportHeight / 2);
}

// The desktop FAQ has its own scroller. Reaching the document's last section
// is only the end after that scroller has also run out of content.
function demoIsTransitioning(win) {
  const doc = win.document;
  const html = doc.documentElement;
  return Boolean(doc.querySelector('.site-loader') || html.classList.contains('scroll-programmatic')
    || html.classList.contains('scroll-animating') || doc.querySelector('[data-spec-transition]'));
}

export function demoEndState(win) {
  const doc = win.document;
  const html = doc.documentElement;
  if (demoIsTransitioning(win)) return null;
  const root = doc.scrollingElement || html;
  const limit = root.scrollHeight - win.innerHeight;
  if (limit <= 2 || win.scrollY < limit - 2) return false;
  const specs = doc.querySelector('.specifications-scroll');
  if (html.classList.contains('scroll-managed') && specs && !specs.hidden && !specs.inert) {
    if (specs.scrollTop < specs.scrollHeight - specs.clientHeight - 2) return false;
  }
  return true;
}

export function demoBoundaryState(win, delta) {
  if (!Number.isFinite(delta) || !delta) return false;
  if (delta > 0) return demoEndState(win);
  if (demoIsTransitioning(win)) return null;
  return win.scrollY <= 2;
}

export function createDemoInteraction({ frame, demo, activation, announcement, reducedMotion, startDemo, fitDemo }) {
  let active = false;
  let childTouch = false;
  let previousEnd = false;
  let endFrame = 0;
  let removeChildListeners = () => {};
  let outerTouch;
  const media = frame.closest('.device-space');

  function center(behavior = reducedMotion.matches ? 'instant' : 'smooth') {
    if (!active || document.fullscreenElement) return;
    const rect = frame.getBoundingClientRect();
    const viewport = window.visualViewport;
    window.scrollTo({ top: centeredScrollTop({ scrollTop: window.scrollY, top: rect.top,
      height: rect.height, viewportHeight: viewport?.height || window.innerHeight,
      offsetTop: viewport?.offsetTop || 0 }), behavior });
  }

  function setActive(next) {
    active = next;
    frame.classList.toggle('is-interactive', active);
    document.body.classList.toggle('is-demo-active', active && !document.fullscreenElement);
    frame.dataset.interactive = String(active);
    activation.hidden = active;
    demo.inert = !active;
    demo.tabIndex = active ? 0 : -1;
  }

  function cancelChildGesture() {
    try {
      const win = demo.contentWindow;
      win.dispatchEvent(new win.Event('portfolio:scroll-handoff'));
      win.dispatchEvent(new win.Event('touchcancel'));
    } catch {}
  }

  function deactivate(reason = 'outside') {
    if (!active) return;
    setActive(false);
    cancelAnimationFrame(endFrame);
    endFrame = 0;
    outerTouch = undefined;
    // A transferred touch must finish in the existing bridge after deactivation.
    if (reason !== 'end' && reason !== 'start') cancelChildGesture();
    childTouch = false;
    if (document.activeElement === demo) activation.focus({ preventScroll: true });
    announcement.textContent = reason === 'end'
      ? 'Fim da demonstração. A rolagem voltou à página principal.'
      : reason === 'start'
      ? 'Início da demonstração. A rolagem voltou à página principal.'
      : 'Demonstração desativada. A rolagem controla a página principal.';
  }

  function activate({ fullscreen = false } = {}) {
    if (active) return;
    startDemo();
    fitDemo();
    media.classList.add('is-engaged', 'is-revealed');
    setActive(true);
    try { previousEnd = demoEndState(demo.contentWindow) === true; } catch { previousEnd = false; }
    announcement.textContent = 'Demonstração ativa. Role para explorar. Clique fora da moldura para sair.';
    if (!fullscreen) center();
    demo.focus({ preventScroll: true });
  }

  function checkEnd() {
    endFrame = 0;
    if (!active || childTouch || document.fullscreenElement) return;
    try {
      const end = demoEndState(demo.contentWindow);
      if (end === null) return;
      if (end && !previousEnd) deactivate('end');
      previousEnd = end;
    } catch {}
  }
  function scheduleEnd() {
    if (active && !endFrame) endFrame = requestAnimationFrame(checkEnd);
  }

  function observeDemo() {
    removeChildListeners();
    try {
      const win = demo.contentWindow;
      const doc = win.document;
      previousEnd = demoEndState(win) === true;
      const touchStart = () => { childTouch = true; };
      const touchEnd = event => { if (!event.touches?.length) { childTouch = false; scheduleEnd(); } };
      const escape = event => {
        if (event.key === 'Escape' && active && !document.fullscreenElement) {
          event.preventDefault(); event.stopImmediatePropagation(); deactivate('outside');
        }
      };
      doc.addEventListener('scroll', scheduleEnd, true);
      win.addEventListener('scroll', scheduleEnd, { passive: true });
      win.addEventListener('touchstart', touchStart, { capture: true, passive: true });
      win.addEventListener('touchend', touchEnd, { capture: true, passive: true });
      win.addEventListener('touchcancel', touchEnd, { capture: true, passive: true });
      win.addEventListener('keydown', escape, true);
      const changes = new MutationObserver(scheduleEnd);
      changes.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
      if (doc.body) changes.observe(doc.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['hidden', 'inert', 'data-spec-transition'] });
      const size = new ResizeObserver(scheduleEnd);
      if (doc.body) size.observe(doc.body);
      removeChildListeners = () => {
        doc.removeEventListener('scroll', scheduleEnd, true);
        win.removeEventListener('scroll', scheduleEnd);
        win.removeEventListener('touchstart', touchStart, true);
        win.removeEventListener('touchend', touchEnd, true);
        win.removeEventListener('touchcancel', touchEnd, true);
        win.removeEventListener('keydown', escape, true);
        changes.disconnect(); size.disconnect();
      };
    } catch {}
  }

  // Scroll over the surrounding canvas still belongs to the selected demo.
  // Its own controllers receive the wheel first; native FAQ scroll is the fallback.
  function routeWheel(delta, original) {
    try {
      const win = demo.contentWindow;
      const doc = win.document;
      const target = doc.elementFromPoint(win.innerWidth / 2, win.innerHeight / 2) || doc.body;
      const wheel = new win.WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true,
        clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 });
      target.dispatchEvent(wheel);
      if (!wheel.defaultPrevented) {
        const specs = doc.querySelector('.specifications-scroll');
        const candidates = [];
        for (let node = target; node && node !== doc.documentElement; node = node.parentElement) candidates.push(node);
        if (doc.documentElement.classList.contains('scroll-managed') && specs && !specs.hidden && !specs.inert) candidates.push(specs);
        const scroller = candidates.find(node => /(auto|scroll)/.test(win.getComputedStyle(node).overflowY)
          && node.scrollHeight > node.clientHeight + 2
          && (delta > 0 ? node.scrollTop < node.scrollHeight - node.clientHeight - 2 : node.scrollTop > 2));
        if (scroller) scroller.scrollTop += delta;
        else win.scrollBy({ top: delta, behavior: 'instant' });
      }
      original.preventDefault();
      scheduleEnd();
    } catch { deactivate('outside'); }
  }

  frame.addEventListener('click', event => {
    if (!event.target.closest('.fullscreen-exit')) activate();
  });
  document.addEventListener('click', event => {
    if (active && !frame.contains(event.target)) deactivate('outside');
  }, true);
  document.addEventListener('focusin', event => {
    if (active && !frame.contains(event.target)) deactivate('outside');
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active && !document.fullscreenElement) deactivate('outside');
  });
  window.addEventListener('wheel', event => {
    if (!active || document.fullscreenElement || event.ctrlKey || event.metaKey
      || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    routeWheel(delta, event);
  }, { passive: false });
  window.addEventListener('touchstart', event => {
    outerTouch = active && event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY, lastY: event.touches[0].clientY } : undefined;
  }, { passive: true });
  window.addEventListener('touchmove', event => {
    if (!active || !outerTouch || event.touches.length !== 1 || document.fullscreenElement) return;
    const point = event.touches[0];
    const delta = outerTouch.lastY - point.clientY;
    outerTouch.lastY = point.clientY;
    if (Math.abs(point.clientX - outerTouch.x) > Math.abs(point.clientY - outerTouch.y)) return;
    routeWheel(delta, event);
  }, { passive: false });
  window.addEventListener('touchend', () => { outerTouch = undefined; scheduleEnd(); }, { passive: true });
  window.addEventListener('touchcancel', () => { outerTouch = undefined; }, { passive: true });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === frame) activate({ fullscreen: true });
    else deactivate('outside');
  });
  demo.addEventListener('load', observeDemo);
  setActive(false);
  return { activate, deactivate, isActive: () => active, recenter: () => center('instant'), releaseAtBoundary(delta) {
    try {
      if (demoBoundaryState(demo.contentWindow, delta) === true) {
        deactivate(delta < 0 ? 'start' : 'end');
        return true;
      }
    } catch {}
    return false;
  } };
}
