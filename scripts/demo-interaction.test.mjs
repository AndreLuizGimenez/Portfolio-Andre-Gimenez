import test from 'node:test';
import assert from 'node:assert/strict';
import { maximumFrameWidth, centeredScrollTop, demoEndState } from '../dist/portfolio/demo-interaction.mjs';

test('phone including its bezel fits short, mobile and desktop viewports above the fixed navigation', () => {
  for (const [width, height, navBottom, verticalChrome, horizontalChrome] of [
    [320, 568, 69, 35, 18], [390, 844, 69, 35, 18], [844, 390, 80, 38, 22],
    [1440, 900, 86, 38, 22], [1920, 1080, 86, 38, 22], [320, 300, 69, 35, 18]
  ]) {
    const maxWidth = maximumFrameWidth({ height, navBottom, verticalChrome, horizontalChrome, ratio: 393 / 852 });
    const phoneWidth = Math.min(430, width - 36, maxWidth);
    const phoneHeight = (phoneWidth - horizontalChrome) * 852 / 393 + verticalChrome;
    const top = (height - phoneHeight) / 2;
    assert.ok(top > navBottom, `${width}×${height}: phone top ${top}, navigation ${navBottom}`);
    assert.ok(top + phoneHeight < height);
    const target = centeredScrollTop({ scrollTop: 500, top: 300, height: phoneHeight, viewportHeight: height });
    assert.ok(Math.abs((500 + 300 - target + phoneHeight / 2) - height / 2) < .01);
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
