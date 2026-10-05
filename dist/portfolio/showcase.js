const PHONE = Object.freeze({ width: 414, height: 852, status: 54 });
const DESKTOP = Object.freeze({ width: 1440, height: 900 });
const WINDOW_BAR = 38;
const WINDOW_EDGE = 5;
const MORPH = 780;

// Outer size of the device for the room the layout leaves, with its screen on whole pixels.
export function deviceSize(view, room) {
  if (view === 'desktop') {
    const ratio = DESKTOP.width / DESKTOP.height;
    const screen = Math.floor(Math.max(200, Math.min(room.width - WINDOW_EDGE * 2, (room.height - WINDOW_BAR - WINDOW_EDGE) * ratio)));
    return { width: screen + WINDOW_EDGE * 2, height: Math.round(screen / ratio) + WINDOW_BAR + WINDOW_EDGE, screen, chrome: WINDOW_EDGE };
  }
  const ratio = PHONE.width / (PHONE.height + PHONE.status);
  const tall = Math.min(room.height, 780);
  const chrome = Math.round(Math.max(7, Math.min(13, tall * .017)));
  const screen = Math.floor(Math.max(120, Math.min(room.width - chrome * 2, (tall - chrome * 2) * ratio)));
  return { width: screen + chrome * 2, height: Math.round(screen / ratio) + chrome * 2, screen, chrome };
}

// The demo's desktop FAQ has its own scroller. Reaching the document's last section
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

export function initShowcase(section, { reducedMotion, onView, onRelease } = {}) {
  const zone = section.querySelector('.device-zone');
  const stage = section.querySelector('.device-stage');
  const frame = section.querySelector('.device-frame');
  const viewport = section.querySelector('.demo-viewport');
  const canvas = section.querySelector('.demo-canvas');
  const activation = section.querySelector('.demo-activation');
  const announcement = section.querySelector('.demo-announcement');
  const failure = section.querySelector('.demo-error');
  const compact = window.matchMedia('(max-width: 760px)');
  let view = 'mobile';
  // The live demo is a whole application. It exists only while someone explores it;
  // the rest of the time the device shows a picture of its first screen.
  let demo = null;
  let ready = false;
  let active = false;
  let mounted = 0;
  let entrance = 0;
  let morph = 0;
  let failTimer;

  const announce = text => { announcement.textContent = text; };
  const isMoving = () => section.classList.contains('is-staged') || section.classList.contains('is-entering');

  function reflect() {
    section.classList.toggle('is-veiled', !ready);
    section.classList.toggle('is-demo-active', active);
    section.classList.toggle('is-demo-loading', active && !ready);
    document.body.classList.toggle('is-demo-active', active);
    activation.hidden = active;
  }

  function fit() {
    const size = deviceSize(view, { width: zone.clientWidth, height: zone.clientHeight });
    stage.style.setProperty('--device-w', `${size.width}px`);
    stage.style.setProperty('--device-h', `${size.height}px`);
    if (view === 'mobile') {
      stage.style.setProperty('--chrome', `${size.chrome}px`);
      stage.style.setProperty('--phone-screen', `${size.screen}px`);
    }
  }

  function scale() {
    if (demo) demo.style.transform = `scale(${viewport.clientWidth / parseFloat(demo.style.width)})`;
  }

  // The second picture is only needed once the section has been seen.
  function prime() {
    section.querySelectorAll('.demo-poster[data-src]').forEach(poster => {
      poster.src = poster.dataset.src;
      poster.removeAttribute('data-src');
    });
  }

  // The phone starts on the right, over the place its text will take.
  function aim() {
    const bounds = section.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const center = box.left + box.width / 2 - bounds.left;
    section.style.setProperty('--enter-x', `${Math.round(Math.max(bounds.width * .42, bounds.width * .8 - center))}px`);
  }

  // The demo shows its own loader first; the picture stays until that has left.
  function settled(element) {
    return new Promise(resolve => {
      const deadline = performance.now() + 12000;
      (function check() {
        let waiting = false;
        try {
          const doc = element.contentDocument;
          waiting = !doc.getElementById('root')?.firstElementChild || Boolean(doc.querySelector('.site-loader'));
        } catch {}
        if (waiting && element.isConnected && performance.now() < deadline) setTimeout(check, 100);
        else resolve();
      })();
    });
  }

  function mount() {
    const run = ++mounted;
    const logical = view === 'mobile' ? PHONE : DESKTOP;
    const element = document.createElement('iframe');
    element.className = 'demo-frame';
    element.title = canvas.dataset.title;
    element.referrerPolicy = 'same-origin';
    element.style.width = `${logical.width}px`;
    element.style.height = `${logical.height}px`;
    element.addEventListener('load', async () => {
      try {
        // Focus sits inside the demo while it is active, so Escape has to be heard there.
        element.contentWindow.addEventListener('keydown', event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          deactivate();
        }, true);
      } catch {}
      await settled(element);
      if (run !== mounted) return;
      clearTimeout(failTimer);
      failure.hidden = true;
      ready = true;
      reflect();
      announce('Demonstração ativa. Role para explorar. Pressione Esc ou clique fora para sair.');
    });
    failTimer = setTimeout(() => { if (run === mounted && !ready) failure.hidden = false; }, 30000);
    element.src = canvas.dataset.src;
    canvas.prepend(element);
    demo = element;
    scale();
  }

  function unmount() {
    ++mounted;
    clearTimeout(failTimer);
    failure.hidden = true;
    const element = demo;
    demo = null;
    ready = false;
    // The picture fades back in before the application goes away.
    if (element) setTimeout(() => element.remove(), 340);
  }

  function activate() {
    if (active || isMoving() || section.classList.contains('is-morphing')) return;
    active = true;
    mount();
    reflect();
    announce('Carregando a demonstração.');
    demo.focus({ preventScroll: true });
  }

  function deactivate(reason = 'outside') {
    if (!active) return;
    const focused = document.activeElement === demo;
    active = false;
    unmount();
    reflect();
    if (focused) activation.focus({ preventScroll: true });
    announce(reason === 'end' ? 'Fim da demonstração. A rolagem voltou ao portfólio.'
      : reason === 'start' ? 'Início da demonstração. A rolagem voltou ao portfólio.'
      : 'Demonstração encerrada. A rolagem voltou ao portfólio.');
  }

  // While the demo is active, scroll over the surrounding page still belongs to it.
  // Its own controllers receive the wheel first; native scrolling is the fallback.
  function routeWheel(delta, original) {
    original.preventDefault();
    if (!ready) return;
    try {
      const win = demo.contentWindow;
      const doc = win.document;
      const target = doc.elementFromPoint(win.innerWidth / 2, win.innerHeight / 2) || doc.body;
      const wheel = new win.WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true,
        clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 });
      target.dispatchEvent(wheel);
      if (wheel.defaultPrevented) return;
      const specs = doc.querySelector('.specifications-scroll');
      const candidates = [];
      for (let node = target; node && node !== doc.documentElement; node = node.parentElement) candidates.push(node);
      if (doc.documentElement.classList.contains('scroll-managed') && specs && !specs.hidden && !specs.inert) candidates.push(specs);
      const scroller = candidates.find(node => /(auto|scroll)/.test(win.getComputedStyle(node).overflowY)
        && node.scrollHeight > node.clientHeight + 2
        && (delta > 0 ? node.scrollTop < node.scrollHeight - node.clientHeight - 2 : node.scrollTop > 2));
      if (scroller) scroller.scrollTop += delta;
      else win.scrollBy({ top: delta, behavior: 'instant' });
    } catch { deactivate(); }
  }

  activation.addEventListener('click', activate);
  document.addEventListener('click', event => {
    if (active && !frame.contains(event.target)) deactivate();
  }, true);
  document.addEventListener('focusin', event => {
    if (active && !frame.contains(event.target)) deactivate();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) deactivate();
  });
  window.addEventListener('wheel', event => {
    if (!active || event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    routeWheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1), event);
  }, { passive: false });
  // The demo reports a gesture that ran past its first or last screen.
  window.addEventListener('message', event => {
    if (!active || !ready || event.origin !== window.location.origin || event.source !== demo.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'portfolio:scroll' || data.phase !== 'move' || !Number.isFinite(data.delta) || !data.delta) return;
    let boundary = false;
    try { boundary = demoBoundaryState(demo.contentWindow, data.delta) === true; } catch {}
    if (!boundary) return;
    deactivate(data.delta < 0 ? 'start' : 'end');
    onRelease?.(Math.sign(data.delta));
  });

  function setView(next, { animate = true } = {}) {
    if (next === view || (next === 'desktop' && compact.matches)) return;
    deactivate();
    prime();
    view = next;
    const run = ++morph;
    section.dataset.view = view;
    onView?.(view, animate);
    announce(view === 'mobile' ? 'Visualização de celular selecionada.' : 'Visualização de computador selecionada.');
    if (!animate || reducedMotion.matches) {
      section.classList.remove('is-morphing', 'is-blurred');
      fit();
      return;
    }
    // The picture of the new format reshapes under a blur that clears as the body settles.
    section.classList.add('is-morphing', 'is-blurred');
    fit();
    setTimeout(() => { if (run === morph) section.classList.remove('is-blurred'); }, 500);
    setTimeout(() => { if (run === morph) section.classList.remove('is-morphing'); }, MORPH + 40);
  }

  // Pose held below the viewport, so the entrance has somewhere to come from.
  function stageEntrance() {
    ++entrance;
    section.classList.remove('is-entering');
    section.classList.toggle('is-staged', !reducedMotion.matches);
    if (!reducedMotion.matches) aim();
  }

  function enter() {
    if (!section.classList.contains('is-staged')) { prime(); return; }
    const run = ++entrance;
    section.classList.replace('is-staged', 'is-entering');
    const animations = section.getAnimations({ subtree: true }).filter(animation => 'animationName' in animation);
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (run !== entrance) return;
      section.classList.remove('is-entering');
      prime();
    });
  }

  // The section starts to move away.
  function leave() {
    deactivate();
    if (!isMoving()) return;
    ++entrance;
    section.classList.remove('is-staged', 'is-entering');
  }

  // The section is out of view below: its next entry starts over, on the phone.
  function rest() {
    setView('mobile', { animate: false });
    stageEntrance();
  }

  function resize() {
    if (compact.matches && view === 'desktop') setView('mobile', { animate: false });
    fit();
    if (section.classList.contains('is-staged')) aim();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(scale).observe(viewport);
    new ResizeObserver(resize).observe(zone);
  }
  window.addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) leave(); });
  fit();
  reflect();

  return { setView, stageEntrance, enter, leave, rest, isActive: () => active };
}
