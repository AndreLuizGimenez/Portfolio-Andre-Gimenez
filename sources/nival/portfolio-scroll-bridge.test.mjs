import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installPortfolioScrollBridge, portfolioScrollHandoffEvent } from './portfolio-scroll-bridge.ts';

class ElementStub {
  constructor(options = {}) {
    Object.assign(this, { parentElement: null, overflowY: 'visible', scrollHeight: 100,
      clientHeight: 100, scrollTop: 0, hidden: false, inert: false, editable: false, top: 0,
      style: { overscrollBehaviorY: '' } }, options);
    const classes = new Set(options.classes || []);
    this.classList = { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) };
  }
  closest() { return this.editable ? this : this.parentElement?.closest() || null; }
  getBoundingClientRect() { return { top: this.top }; }
}

function environment({ y = 0, maximum = 4000, managed = false, htmlOverscroll = '', bodyOverscroll = '', embedded = false } = {}) {
  const listeners = new Map(), messages = [], dispatched = [];
  const html = new ElementStub({ scrollHeight: maximum + 900,
    classes: [...(managed ? ['scroll-managed'] : []), ...(embedded ? ['portfolio-embedded'] : [])],
    style: { overscrollBehaviorY: htmlOverscroll } });
  const body = new ElementStub({ parentElement: html, style: { overscrollBehaviorY: bodyOverscroll } });
  const target = new ElementStub({ parentElement: body });
  const selectors = new Map();
  const parent = { location: { origin: 'https://example.test' }, document: { fullscreenElement: null },
    postMessage: (message, origin) => messages.push({ message, origin }) };
  const win = {
    parent, location: { origin: parent.location.origin }, innerHeight: 900, scrollY: y,
    getComputedStyle: element => ({ overflowY: element.overflowY }),
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
    removeEventListener(type, listener) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== listener)); },
    dispatchEvent(event) { dispatched.push(event.type); for (const listener of listeners.get(event.type) || []) listener(event); return true; },
  };
  const doc = { documentElement: html, body, scrollingElement: html, querySelector: selector => selectors.get(selector) || null };
  globalThis.Element = ElementStub;
  globalThis.window = win;
  globalThis.document = doc;
  const dispose = installPortfolioScrollBridge();
  function emit(type, values = {}) {
    const event = { type, target, cancelable: true, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...values };
    for (const listener of listeners.get(type) || []) { listener(event); if (event.stopped) break; }
    return event;
  }
  return { win, html, body, target, selectors, parent, messages, dispatched, emit, dispose };
}

const wheel = (env, deltaY, extra = {}) => env.emit('wheel', { deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, metaKey: false, ...extra });
const point = (x, y, identifier = 1) => ({ identifier, clientX: x, clientY: y });

test('wheel only chains at the requested document edge, normalizing all delta modes', () => {
  const env = environment({ y: 500 });
  assert.equal(wheel(env, 120).defaultPrevented, false);
  assert.equal(env.messages.length, 0);
  env.win.scrollY = 0;
  assert.equal(wheel(env, 120).defaultPrevented, false);
  assert.equal(wheel(env, -120).defaultPrevented, true);
  assert.equal(env.messages.at(-1).message.delta, -120);
  env.win.scrollY = 4000;
  wheel(env, 3, { deltaMode: 1 });
  assert.equal(env.messages.at(-1).message.delta, 48);
  wheel(env, 1, { deltaMode: 2 });
  assert.equal(env.messages.at(-1).message.delta, 900);
  assert.equal(env.dispatched.filter(type => type === portfolioScrollHandoffEvent).length, 3);
  assert.equal(env.messages.at(-1).origin, env.win.location.origin);
  env.dispose();
});

test('nested scrollable content consumes movement before the parent', () => {
  const env = environment({ y: 4000 });
  const nested = new ElementStub({ parentElement: env.body, overflowY: 'auto', clientHeight: 100, scrollHeight: 500, scrollTop: 200 });
  env.target.parentElement = nested;
  assert.equal(wheel(env, 90).defaultPrevented, false);
  nested.scrollTop = 400;
  assert.equal(wheel(env, 90).defaultPrevented, true);
  env.win.scrollY = 0;
  nested.scrollTop = 20;
  assert.equal(wheel(env, -90).defaultPrevented, false);
  nested.scrollTop = 0;
  assert.equal(wheel(env, -90).defaultPrevented, true);
  env.dispose();
});

test('desktop FAQ owns remaining scroll even when the pointer is over its floating control', () => {
  const env = environment({ y: 4000, managed: true });
  const specs = new ElementStub({ parentElement: env.body, overflowY: 'auto', scrollHeight: 1500, clientHeight: 900, scrollTop: 200, top: 0 });
  env.selectors.set('.specifications-scroll', specs);
  assert.equal(wheel(env, 100).defaultPrevented, false);
  specs.scrollTop = 600;
  assert.equal(wheel(env, 100).defaultPrevented, true);
  specs.scrollTop = 0;
  specs.hidden = true;
  assert.equal(wheel(env, 100).defaultPrevented, true);
  specs.hidden = false;
  specs.inert = true;
  assert.equal(wheel(env, 100).defaultPrevented, true);
  env.dispose();
});

test('mobile FAQ in document flow does not invent an inner scroll viewport', () => {
  const env = environment({ y: 4000 });
  env.selectors.set('.specifications-scroll', new ElementStub({ overflowY: 'visible', scrollHeight: 2000, clientHeight: 900 }));
  assert.equal(wheel(env, 90).defaultPrevented, true);
  env.dispose();
});

test('transitions retain their gesture ownership; loader releases it to the portfolio', () => {
  const env = environment({ y: 4000 });
  for (const name of ['scroll-animating', 'scroll-programmatic']) {
    env.html.classList.add(name);
    assert.equal(wheel(env, 90).defaultPrevented, false);
    env.html.classList.remove(name);
  }
  env.selectors.set('[data-spec-transition]', {});
  assert.equal(wheel(env, 90).defaultPrevented, false);
  env.selectors.delete('[data-spec-transition]');
  env.win.scrollY = 500;
  env.selectors.set('.site-loader', {});
  assert.equal(wheel(env, 90).defaultPrevented, true);
  env.dispose();
});

test('pinch, horizontal wheel, editable controls, dialogs and fullscreen remain independent', () => {
  const env = environment({ y: 4000 });
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { deltaX: 150 }]) assert.equal(wheel(env, 90, extra).defaultPrevented, false);
  env.target.editable = true;
  assert.equal(wheel(env, 90).defaultPrevented, false);
  env.target.editable = false;
  env.selectors.set('[role="dialog"][data-state="open"]', {});
  assert.equal(wheel(env, 90).defaultPrevented, false);
  env.selectors.delete('[role="dialog"][data-state="open"]');
  env.parent.document.fullscreenElement = {};
  assert.equal(wheel(env, 90).defaultPrevented, false);
  assert.equal(env.messages.length, 0);
  env.dispose();
});

test('touch chains mid-contact, stays on the parent after reversal and ends without an inner snap/click', () => {
  const env = environment({ y: 3900 });
  env.emit('touchstart', { touches: [point(100, 500)] });
  assert.equal(env.messages.at(-1).message.delta, 0);
  assert.equal(env.emit('touchmove', { touches: [point(100, 480)] }).defaultPrevented, false);
  env.win.scrollY = 4000;
  assert.equal(env.emit('touchmove', { touches: [point(100, 450)] }).defaultPrevented, true);
  assert.equal(env.messages.at(-1).message.delta, 30);
  assert.equal(env.dispatched.filter(type => type === portfolioScrollHandoffEvent).length, 1);
  assert.equal(env.emit('touchmove', { touches: [point(100, 460)] }).defaultPrevented, true);
  assert.equal(env.messages.at(-1).message.delta, -10);
  const release = env.emit('touchend', { touches: [] });
  assert.equal(release.stopped, true);
  assert.equal(env.messages.at(-1).message.phase, 'end');
  assert.ok(Math.abs(env.messages.at(-1).message.velocity) <= 2.5);
  assert.ok(env.messages.at(-1).message.velocity < 0);
  assert.equal(env.emit('click', { detail: 1 }).defaultPrevented, true);
  env.dispose();
});

test('top touch handoff uses signed logical pixels and cancel ends without inertia', () => {
  const env = environment({ y: 0 });
  env.emit('touchstart', { touches: [point(100, 400)] });
  env.emit('touchmove', { touches: [point(100, 440)] });
  assert.equal(env.messages.at(-1).message.delta, -40);
  assert.equal(env.emit('touchcancel', { touches: [] }).stopped, true);
  assert.equal(env.messages.at(-1).message.velocity, 0);
  env.dispose();
});

test('horizontal gestures and pinch never become a transferred vertical touch', () => {
  const env = environment({ y: 4000 });
  env.emit('touchstart', { touches: [point(100, 500)] });
  assert.equal(env.emit('touchmove', { touches: [point(130, 499)] }).defaultPrevented, false);
  assert.equal(env.emit('touchmove', { touches: [point(130, 450)] }).defaultPrevented, false);
  env.emit('touchend', { touches: [] });
  env.emit('touchstart', { touches: [point(100, 500), point(200, 500, 2)] });
  assert.equal(env.emit('touchmove', { touches: [point(100, 450), point(200, 450, 2)] }).defaultPrevented, false);
  assert.equal(env.messages.filter(({ message }) => message.delta !== 0).length, 0);
  assert.equal(env.dispatched.length, 0);
  env.dispose();
});

test('noncancelable edge events still forward movement and bypass managed listeners', () => {
  const env = environment({ y: 4000 });
  const wheeled = wheel(env, 80, { cancelable: false });
  assert.equal(wheeled.defaultPrevented, false);
  assert.equal(wheeled.stopped, true);
  assert.equal(env.messages.at(-1).message.delta, 80);
  env.emit('touchstart', { touches: [point(100, 500)] });
  const moved = env.emit('touchmove', { touches: [point(100, 460)], cancelable: false });
  assert.equal(moved.defaultPrevented, false);
  assert.equal(moved.stopped, true);
  assert.equal(env.messages.at(-1).message.delta, 40);
  env.dispose();
});

test('standalone and cross-origin pages do not install a bridge; cleanup removes all capture handlers', () => {
  const env = environment({ y: 4000 });
  env.dispose();
  assert.equal(wheel(env, 90).defaultPrevented, false);
  env.win.parent = env.win;
  installPortfolioScrollBridge();
  assert.equal(wheel(env, 90).defaultPrevented, false);
  env.win.parent = { location: { origin: 'https://other.test' } };
  installPortfolioScrollBridge();
  assert.equal(wheel(env, 90).defaultPrevented, false);
});

test('embedded native chaining is disabled on both roots and cleanup restores prior styles/classes', () => {
  const env = environment({ htmlOverscroll: 'contain', bodyOverscroll: 'auto' });
  assert.equal(env.html.classList.contains('portfolio-embedded'), true);
  assert.equal(env.html.style.overscrollBehaviorY, 'none');
  assert.equal(env.body.style.overscrollBehaviorY, 'none');
  env.dispose();
  assert.equal(env.html.classList.contains('portfolio-embedded'), false);
  assert.equal(env.html.style.overscrollBehaviorY, 'contain');
  assert.equal(env.body.style.overscrollBehaviorY, 'auto');
  const existing = environment({ embedded: true });
  existing.dispose();
  assert.equal(existing.html.classList.contains('portfolio-embedded'), true);
});
