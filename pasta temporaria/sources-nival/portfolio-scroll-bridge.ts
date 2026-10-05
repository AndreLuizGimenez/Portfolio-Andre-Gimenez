/** Let the portfolio take over a gesture only after this embedded page runs out of content. */
export const portfolioScrollHandoffEvent = 'portfolio:scroll-handoff';

type ScrollMessage = {
  type: 'portfolio:scroll';
  input: 'wheel' | 'touch';
  phase: 'move' | 'end';
  delta: number;
  velocity?: number;
};

type Contact = {
  identifier: number;
  x: number;
  y: number;
  lastY: number;
  lastAt: number;
  velocity: number;
  outer: boolean;
  horizontal: boolean;
};

export function installPortfolioScrollBridge() {
  if (window.parent === window) return () => {};
  const parent = window.parent;
  try {
    if (parent.location.origin !== window.location.origin) return () => {};
  } catch {
    return () => {};
  }

  const doc = document;
  const html = doc.documentElement;
  const alreadyEmbedded = html.classList.contains('portfolio-embedded');
  const scrollRoots = [html, doc.body].filter((node): node is HTMLElement => Boolean(node));
  const previousOverscroll = scrollRoots.map(node => node.style.overscrollBehaviorY);
  html.classList.add('portfolio-embedded');
  // Keep native iframe chaining from duplicating the bridge's explicit transfer.
  scrollRoots.forEach(node => { node.style.overscrollBehaviorY = 'none'; });
  let contact: Contact | undefined;
  let suppressClickUntil = 0;

  const post = (message: Omit<ScrollMessage, 'type'>) => {
    parent.postMessage({ type: 'portfolio:scroll', ...message }, window.location.origin);
  };
  const available = () => {
    try { return !parent.document.fullscreenElement; }
    catch { return false; }
  };
  const eligible = (target: EventTarget | null) => target instanceof Element
    && !target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')
    && !doc.querySelector('[role="dialog"][data-state="open"]');

  function canScroll(element: Element, delta: number) {
    if (!/(auto|scroll)/.test(window.getComputedStyle(element).overflowY)) return false;
    const maximum = element.scrollHeight - element.clientHeight;
    return maximum > 2 && (delta > 0 ? element.scrollTop < maximum - 2 : element.scrollTop > 2);
  }

  function localContentCanScroll(target: EventTarget | null, delta: number) {
    for (let node = target instanceof Element ? target : null; node && node !== html; node = node.parentElement) {
      if (node !== doc.body && canScroll(node, delta)) return true;
    }
    return false;
  }

  function atBoundary(target: EventTarget | null, delta: number) {
    if (!delta || !available() || !eligible(target)) return false;
    // The loader locks this document completely, so it must not lock its parent too.
    if (doc.querySelector('.site-loader')) return true;
    if (html.classList.contains('scroll-programmatic') || html.classList.contains('scroll-animating')
      || doc.querySelector('[data-spec-transition]')) return false;
    if (localContentCanScroll(target, delta)) return false;

    const scrolling = doc.scrollingElement || html;
    const maximum = Math.max(0, scrolling.scrollHeight - window.innerHeight);
    const y = window.scrollY;
    // Desktop routes gestures over its floating button to this native FAQ viewport.
    const specs = doc.querySelector<HTMLElement>('.specifications-scroll');
    if (html.classList.contains('scroll-managed') && specs && !specs.hidden && !specs.inert) {
      const entrance = Math.min(maximum, specs.getBoundingClientRect().top + y);
      if (y >= entrance - 3 && canScroll(specs, delta)) return false;
    }
    return delta < 0 ? y <= 2 : y >= maximum - 2;
  }

  function claim(event: Event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function cancelInnerGesture() {
    window.dispatchEvent(new Event(portfolioScrollHandoffEvent));
  }

  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (!atBoundary(event.target, delta)) return;
    cancelInnerGesture();
    claim(event);
    post({ input: 'wheel', phase: 'move', delta });
  }

  function touchStart(event: TouchEvent) {
    if (contact?.outer) post({ input: 'touch', phase: 'end', delta: 0, velocity: 0 });
    contact = undefined;
    if (event.touches.length !== 1 || !available() || !eligible(event.target)) return;
    const point = event.touches[0];
    contact = {
      identifier: point.identifier, x: point.clientX, y: point.clientY,
      lastY: point.clientY, lastAt: performance.now(), velocity: 0, outer: false, horizontal: false,
    };
    // A new contact also stops any momentum left by a previous outer gesture.
    post({ input: 'touch', phase: 'move', delta: 0 });
  }

  function touchMove(event: TouchEvent) {
    if (!contact) return;
    if (event.touches.length !== 1 || !available()) {
      if (contact.outer) post({ input: 'touch', phase: 'end', delta: 0, velocity: 0 });
      contact = undefined;
      return;
    }
    const point = Array.from(event.touches).find(item => item.identifier === contact!.identifier);
    if (!point) return;
    const now = performance.now();
    const delta = contact.lastY - point.clientY;
    const elapsed = Math.max(8, now - contact.lastAt);
    const dx = contact.x - point.clientX, dy = contact.y - point.clientY;
    contact.lastY = point.clientY;
    contact.lastAt = now;
    if (!contact.outer) {
      if (Math.abs(dx) >= 6 && Math.abs(dx) > Math.abs(dy)) contact.horizontal = true;
      if (contact.horizontal || Math.abs(dy) < 4 || Math.abs(dx) > Math.abs(dy)) return;
      if (!atBoundary(event.target, delta)) return;
      contact.outer = true;
      contact.velocity = delta / elapsed;
      cancelInnerGesture();
    } else contact.velocity = delta * contact.velocity < 0
      ? delta / elapsed : contact.velocity * .35 + delta / elapsed * .65;
    claim(event);
    suppressClickUntil = now + 500;
    post({ input: 'touch', phase: 'move', delta });
  }

  function touchEnd(event: TouchEvent) {
    if (!contact || Array.from(event.touches).some(point => point.identifier === contact!.identifier)) return;
    if (contact.outer) {
      const velocity = performance.now() - contact.lastAt < 90
        ? Math.max(-2.5, Math.min(2.5, contact.velocity)) : 0;
      claim(event);
      suppressClickUntil = performance.now() + 450;
      post({ input: 'touch', phase: 'end', delta: 0, velocity });
    }
    contact = undefined;
  }

  function touchCancel(event: TouchEvent) {
    if (contact?.outer) {
      claim(event);
      post({ input: 'touch', phase: 'end', delta: 0, velocity: 0 });
    }
    contact = undefined;
  }

  function click(event: MouseEvent) {
    if (event.detail && performance.now() < suppressClickUntil) claim(event);
  }

  window.addEventListener('wheel', wheel, { capture: true, passive: false });
  window.addEventListener('touchstart', touchStart, { capture: true, passive: true });
  window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
  window.addEventListener('touchend', touchEnd, { capture: true, passive: false });
  window.addEventListener('touchcancel', touchCancel, { capture: true, passive: false });
  window.addEventListener('click', click, true);
  return () => {
    window.removeEventListener('wheel', wheel, true);
    window.removeEventListener('touchstart', touchStart, true);
    window.removeEventListener('touchmove', touchMove, true);
    window.removeEventListener('touchend', touchEnd, true);
    window.removeEventListener('touchcancel', touchCancel, true);
    window.removeEventListener('click', click, true);
    scrollRoots.forEach((node, index) => { node.style.overscrollBehaviorY = previousOverscroll[index]; });
    if (!alreadyEmbedded) html.classList.remove('portfolio-embedded');
    contact = undefined;
  };
}
