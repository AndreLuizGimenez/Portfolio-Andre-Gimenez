import { createWheelGate } from './wheel-gate.js?v=10';

const DURATION = 820;
const EASING = 'cubic-bezier(.4, 0, .1, 1)';
const RELEASE = 'cubic-bezier(.2, .8, .2, 1)';
const SHADE = .24;

// Full-viewport sections stacked like cards: going forward, the next one rises
// over the current; going back, the current one slides down off the previous.
export function createStack(root, { reducedMotion, isCaptured = () => false, onStart, onEnd } = {}) {
  const panels = [...root.querySelectorAll('.panel')];
  const shades = panels.map(panel => {
    const shade = document.createElement('span');
    shade.className = 'panel-shade';
    shade.setAttribute('aria-hidden', 'true');
    panel.append(shade);
    return shade;
  });
  const gate = createWheelGate();
  const indexOfHash = hash => panels.findIndex(panel => panel.id && `#${panel.id}` === hash);
  let index = Math.max(0, indexOfHash(window.location.hash));
  let busy = false;
  let touch;

  function settle() {
    panels.forEach((panel, position) => {
      panel.classList.toggle('is-past', position < index);
      panel.classList.toggle('is-current', position === index);
      panel.classList.remove('is-moving');
      panel.inert = position !== index;
      panel.style.transform = '';
      shades[position].style.opacity = '';
    });
  }

  // `cover` runs from 0 (upper panel below the viewport) to 1 (it hides the lower one).
  function pairOf(from, to) {
    const lower = Math.min(from, to);
    return { lower: panels[lower], upper: panels[Math.max(from, to)], shade: shades[lower] };
  }
  function lift(pair) {
    pair.lower.classList.add('is-moving');
    pair.upper.classList.add('is-moving');
  }
  function place(pair, cover) {
    pair.upper.style.transform = `translate3d(0, ${(1 - cover) * 100}%, 0)`;
    pair.shade.style.opacity = String(cover * SHADE);
  }
  async function play(pair, from, to, duration, easing) {
    const animations = [
      pair.upper.animate({ transform: [`translate3d(0, ${(1 - from) * 100}%, 0)`, `translate3d(0, ${(1 - to) * 100}%, 0)`] },
        { duration, easing, fill: 'both' }),
      pair.shade.animate({ opacity: [from * SHADE, to * SHADE] }, { duration, easing, fill: 'both' }),
    ];
    try { await Promise.all(animations.map(animation => animation.finished)); } catch {}
    return animations;
  }

  async function go(target, { cover } = {}) {
    target = Math.max(0, Math.min(panels.length - 1, target));
    if (busy || target === index || (touch?.pair && cover === undefined)) return false;
    const from = index;
    const direction = Math.sign(target - from);
    const pair = pairOf(from, target);
    busy = true;
    lift(pair);
    onStart?.({ from, to: target, direction });
    let animations = [];
    if (!reducedMotion.matches) {
      const end = direction > 0 ? 1 : 0;
      // A dragged section only has the rest of the way to go.
      animations = cover === undefined
        ? await play(pair, 1 - end, end, DURATION, EASING)
        : await play(pair, cover, end, Math.max(240, DURATION * .7 * Math.abs(end - cover)), RELEASE);
    }
    index = target;
    settle();
    animations.forEach(animation => animation.cancel());
    busy = false;
    if (panels[index].id) window.history.replaceState(window.history.state, '', `#${panels[index].id}`);
    onEnd?.({ from, to: target, direction });
    return true;
  }

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || isCaptured()) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    const direction = gate.push(delta, event.timeStamp, { ready: !busy && !touch?.pair, now: performance.now() });
    if (direction) go(index + direction);
  }, { passive: false });

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isCaptured()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    let next;
    if (event.key === 'ArrowDown' || event.key === 'PageDown') next = index + 1;
    else if (event.key === 'ArrowUp' || event.key === 'PageUp') next = index - 1;
    else if (event.key === ' ' && !target?.closest('button, a, summary, [role="button"]')) next = index + (event.shiftKey ? -1 : 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = panels.length - 1;
    else return;
    event.preventDefault();
    go(next);
  });

  // On touch screens the section follows the finger and completes the move on release.
  root.addEventListener('touchstart', event => {
    if (touch?.pair) return;
    touch = undefined;
    if (busy || isCaptured() || event.touches.length !== 1) return;
    const point = event.touches[0];
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, lastY: point.clientY, lastTime: event.timeStamp, velocity: 0 };
  }, { passive: true });

  root.addEventListener('touchmove', event => {
    if (!touch) return;
    const point = [...event.touches].find(item => item.identifier === touch.id);
    if (!point) return;
    if (!touch.pair) {
      const dx = point.clientX - touch.x;
      const dy = point.clientY - touch.y;
      if (event.touches.length !== 1 || (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy))) { touch = undefined; return; }
      if (Math.abs(dy) < 8) return;
      const direction = dy < 0 ? 1 : -1;
      const target = index + direction;
      if (target < 0 || target >= panels.length) { touch = undefined; return; }
      Object.assign(touch, { direction, target, pair: pairOf(index, target), origin: point.clientY });
      lift(touch.pair);
    }
    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - touch.lastTime);
    touch.velocity = touch.velocity * .4 + (point.clientY - touch.lastY) / elapsed * .6;
    touch.lastY = point.clientY;
    touch.lastTime = event.timeStamp;
    const travel = Math.max(0, Math.min(1, (touch.origin - point.clientY) * touch.direction / root.clientHeight));
    touch.cover = touch.direction > 0 ? travel : 1 - travel;
    place(touch.pair, touch.cover);
  }, { passive: false });

  function release(event) {
    if (!touch || [...event.touches].some(item => item.identifier === touch.id)) return;
    const { pair, direction, target, cover, velocity, lastTime } = touch;
    touch = undefined;
    if (!pair) return;
    const travel = direction > 0 ? cover : 1 - cover;
    const flick = -velocity * direction > .45 && event.timeStamp - lastTime < 90;
    if (event.type === 'touchend' && (travel > .2 || (flick && travel > .03))) { go(target, { cover }); return; }
    // Not far enough: the section returns to where it was.
    busy = true;
    play(pair, cover, direction > 0 ? 0 : 1, 260, RELEASE).then(animations => {
      settle();
      animations.forEach(animation => animation.cancel());
      busy = false;
    });
  }
  root.addEventListener('touchend', release);
  root.addEventListener('touchcancel', release);

  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    const target = link ? indexOfHash(link.getAttribute('href')) : -1;
    if (target < 0) return;
    event.preventDefault();
    go(target);
  });
  window.addEventListener('hashchange', () => {
    const target = indexOfHash(window.location.hash);
    if (target >= 0) go(target);
  });
  // Focus or an anchor may still try to scroll the clipped layers.
  root.addEventListener('scroll', () => root.scrollTo(0, 0));

  document.documentElement.classList.add('has-stack');
  settle();

  return {
    panels,
    go,
    // A gesture handed over by embedded content is over: its inertia must not change section.
    spend: direction => gate.spend(direction, performance.now()),
    get index() { return index; },
  };
}
