import test from 'node:test';
import assert from 'node:assert/strict';
import { maximumFrameWidth, centeredScrollTop, demoEndState, demoBoundaryState, createDemoInteraction, MOBILE_VIEWPORT } from '../dist/portfolio/demo-interaction.mjs';

test('phone including its bezel fits short, mobile and desktop viewports above the fixed navigation', () => {
  for (const [width, height, navBottom, verticalChrome, horizontalChrome] of [
    [320, 568, 69, 35, 18], [390, 844, 69, 35, 18], [844, 390, 80, 38, 22],
    [1440, 900, 86, 38, 22], [1920, 1080, 86, 38, 22], [320, 300, 69, 35, 18]
  ]) {
    const maxWidth = maximumFrameWidth({ height, navBottom, verticalChrome, horizontalChrome, ratio: MOBILE_VIEWPORT.width / MOBILE_VIEWPORT.height });
    const phoneWidth = Math.min(MOBILE_VIEWPORT.maxFrameWidth, width - 36, maxWidth);
    const phoneHeight = (phoneWidth - horizontalChrome) * MOBILE_VIEWPORT.height / MOBILE_VIEWPORT.width + verticalChrome;
    const top = (height - phoneHeight) / 2;
    assert.ok(top > navBottom, `${width}×${height}: phone top ${top}, navigation ${navBottom}`);
    assert.ok(top + phoneHeight < height);
    const target = centeredScrollTop({ scrollTop: 500, top: 300, height: phoneHeight, viewportHeight: height });
    assert.ok(Math.abs((500 + 300 - target + phoneHeight / 2) - height / 2) < .01);
  }
});

test('the wider phone preserves its height where horizontal space is available', () => {
  for (const height of [568, 720, 900, 1080, 1600]) {
    const dimensions = { height, navBottom: 86, verticalChrome: 38, horizontalChrome: 22 };
    const oldWidth = Math.min(430, maximumFrameWidth({ ...dimensions, ratio: 393 / 852 }));
    const newWidth = Math.min(MOBILE_VIEWPORT.maxFrameWidth, maximumFrameWidth({ ...dimensions, ratio: MOBILE_VIEWPORT.width / MOBILE_VIEWPORT.height }));
    const oldHeight = (oldWidth - 22) * 852 / 393 + 38;
    const newHeight = (newWidth - 22) * MOBILE_VIEWPORT.height / MOBILE_VIEWPORT.width + 38;
    assert.ok(newWidth > oldWidth * 1.04 && newWidth < oldWidth * 1.06);
    assert.ok(Math.abs(newHeight - oldHeight) < 1);
  }
});

test('centering accounts for a shifted visual viewport and never requests negative page scroll', () => {
  assert.equal(centeredScrollTop({ scrollTop: 700, top: 120, height: 450, viewportHeight: 600, offsetTop: 30 }), 715);
  assert.equal(centeredScrollTop({ scrollTop: 0, top: 0, height: 300, viewportHeight: 800 }), 0);
});

function endFixture({ y = 4000, classes = [], loader = false, transition = false, specs } = {}) {
  const selectors = new Map();
  if (loader) selectors.set('.site-loader', {});
  if (transition) selectors.set('[data-spec-transition]', {});
  if (specs) selectors.set('.specifications-scroll', specs);
  const html = { scrollHeight: 5000, classList: { contains: name => classes.includes(name) } };
  return { innerHeight: 1000, scrollY: y,
    document: { documentElement: html, scrollingElement: html, querySelector: key => selectors.get(key) } };
}

test('the desktop document ending does not release scrolling while its FAQ still has content', () => {
  const specs = { scrollTop: 0, scrollHeight: 1600, clientHeight: 900, hidden: false, inert: false };
  const win = endFixture({ classes: ['scroll-managed'], specs });
  assert.equal(demoEndState(win), false);
  specs.scrollTop = 699;
  assert.equal(demoEndState(win), true);
  specs.scrollTop = 0;
  specs.inert = true;
  assert.equal(demoEndState(win), true);
});

test('loading and section animations cannot accidentally end the selected demo', () => {
  for (const options of [{ loader: true }, { transition: true }, { classes: ['scroll-programmatic'] }, { classes: ['scroll-animating'] }]) {
    assert.equal(demoEndState(endFixture(options)), null);
  }
  assert.equal(demoEndState(endFixture({ y: 3990 })), false);
  assert.equal(demoEndState(endFixture({ y: 3999 })), true);
  const empty = endFixture({ y: 0 });
  empty.document.documentElement.scrollHeight = 1000;
  assert.equal(demoEndState(empty), false);
});

test('the upper edge releases only upward gestures, leaving the initial selection active', () => {
  const win = endFixture({ y: 0 });
  assert.equal(demoBoundaryState(win, -80), true);
  assert.equal(demoBoundaryState(win, 80), false);
  for (const delta of [0, undefined, NaN, Infinity, -Infinity]) {
    assert.equal(demoBoundaryState(win, delta), false);
  }
  win.scrollY = 2;
  assert.equal(demoBoundaryState(win, -20), true);
  win.scrollY = 3;
  assert.equal(demoBoundaryState(win, -20), false);
  win.scrollY = 4000;
  assert.equal(demoBoundaryState(win, 80), true);
  assert.equal(demoBoundaryState(win, -80), false);
});

test('the upper edge cannot release during loading or an internal section transition', () => {
  for (const options of [{ loader: true }, { transition: true }, { classes: ['scroll-programmatic'] }, { classes: ['scroll-animating'] }]) {
    assert.equal(demoBoundaryState(endFixture({ ...options, y: 0 }), -80), null);
  }
});

test('selection releases both edges without cancelling transferred touch, and clears the outside click cursor', () => {
  const originals = new Map(['document', 'window', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const classes = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(name => values.add(name)),
      toggle: (name, enabled) => enabled ? values.add(name) : values.delete(name),
      contains: name => values.has(name) };
  };
  const bodyClasses = classes();
  const outerDoc = Object.assign(new EventTarget(), { body: { classList: bodyClasses }, fullscreenElement: null });
  const outerWindow = new EventTarget();
  const childEvents = [];
  const child = Object.assign(endFixture({ y: 0 }), { Event, dispatchEvent: event => { childEvents.push(event.type); } });
  const frame = Object.assign(new EventTarget(), { classList: classes(), dataset: {},
    closest: () => ({ classList: classes() }) });
  const demo = Object.assign(new EventTarget(), { contentWindow: child, focus() {} });
  const activation = { hidden: false };
  const announcement = { textContent: '' };
  try {
    globalThis.document = outerDoc;
    globalThis.window = outerWindow;
    globalThis.cancelAnimationFrame = () => {};
    const interaction = createDemoInteraction({ frame, demo, activation, announcement,
      reducedMotion: { matches: true }, startDemo() {}, fitDemo() {} });
    interaction.activate({ fullscreen: true });
    assert.equal(interaction.isActive(), true);
    assert.equal(bodyClasses.contains('is-demo-active'), true);
    assert.equal(demo.inert, false);
    assert.equal(interaction.releaseAtBoundary(80), false);
    assert.equal(interaction.releaseAtBoundary(-80), true);
    assert.equal(interaction.isActive(), false);
    assert.equal(bodyClasses.contains('is-demo-active'), false);
    assert.equal(demo.inert, true);
    assert.match(announcement.textContent, /Início/);
    assert.deepEqual(childEvents, []);

    child.scrollY = 100;
    interaction.activate({ fullscreen: true });
    assert.equal(interaction.releaseAtBoundary(-80), false);
    child.scrollY = 4000;
    assert.equal(interaction.releaseAtBoundary(80), true);
    assert.match(announcement.textContent, /Fim/);
    assert.deepEqual(childEvents, []);

    interaction.activate({ fullscreen: true });
    interaction.deactivate('outside');
    assert.deepEqual(childEvents, ['portfolio:scroll-handoff', 'touchcancel']);
    assert.equal(bodyClasses.contains('is-demo-active'), false);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
