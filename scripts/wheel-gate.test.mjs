import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelGate } from '../dist/portfolio/wheel-gate.js';

const TRANSITION = 820;

// Replays a wheel stream the way the stack does: a step locks the gate for one transition.
function replay(events) {
  const gate = createWheelGate();
  const steps = [];
  let lockedUntil = -Infinity;
  for (const { time, delta, handled = time } of events) {
    const direction = gate.push(delta, time, { ready: handled >= lockedUntil, now: handled });
    if (direction) { steps.push({ time, direction }); lockedUntil = handled + TRANSITION; }
  }
  return steps;
}

// Two fingers accelerate, lift, and the system keeps emitting decaying inertia.
function swipe(start, { peak = 60, direction = 1, frame = 16, decay = .93 } = {}) {
  const events = [];
  let time = start;
  for (const share of [.05, .15, .35, .6, .85, 1, .95, .8]) {
    events.push({ time, delta: Math.max(1, Math.round(peak * share)) * direction });
    time += frame;
  }
  for (let size = peak * .7; size >= .5; size *= decay) {
    events.push({ time, delta: Math.max(1, Math.round(size)) * direction });
    time += frame;
  }
  return events;
}

const end = events => events.at(-1).time;

test('one trackpad swipe moves exactly one section, however long its inertia runs', () => {
  for (const peak of [8, 30, 60, 140, 320]) {
    const events = swipe(0, { peak });
    assert.equal(replay(events).length, 1, `peak ${peak}`);
    if (peak >= 140) assert.ok(end(events) > TRANSITION, 'inertia outlasts the transition');
  }
  assert.equal(replay(swipe(0, { peak: 320, frame: 8, decay: .97 })).length, 1, '120 Hz');
  assert.deepEqual(replay(swipe(0, { peak: 90, direction: -1 })).map(step => step.direction), [-1]);
});

test('a second swipe after a pause moves one more section', () => {
  const first = swipe(0, { peak: 40 });
  const second = swipe(end(first) + 400, { peak: 40 });
  assert.equal(replay([...first, ...second]).length, 2);
});

test('a fresh swipe that interrupts the inertia counts once the transition is over', () => {
  const first = swipe(0, { peak: 140 }).filter(event => event.time < 600);
  const second = swipe(640, { peak: 140 });
  const steps = replay([...first, ...second]);
  assert.equal(steps.length, 2);
  assert.ok(steps[1].time >= TRANSITION);
});

test('a stray opposite delta when the fingers lift does not re-arm the inertia', () => {
  const events = swipe(0, { peak: 200 });
  events.splice(9, 0, { time: events[8].time + 8, delta: -2 });
  assert.deepEqual(replay(events).map(step => step.direction), [1]);
});

test('reversing direction goes back as soon as the transition allows', () => {
  const down = swipe(0, { peak: 60 }).filter(event => event.time < 300);
  const up = swipe(900, { peak: 60, direction: -1 });
  assert.deepEqual(replay([...down, ...up]).map(step => step.direction), [1, -1]);
});

test('a spinning mouse wheel moves one section until it pauses', () => {
  const spin = Array.from({ length: 30 }, (_, index) => ({ time: index * 60, delta: 100 }));
  assert.equal(replay(spin).length, 1);
  const again = [...spin, { time: end(spin) + 500, delta: 100 }];
  assert.equal(replay(again).length, 2);
});

test('a single slow notch of a macOS mouse is enough', () => {
  assert.equal(replay([{ time: 0, delta: 4.000244140625 }]).length, 1);
  assert.equal(replay([{ time: 0, delta: -4.000244140625 }])[0].direction, -1);
});

test('faint movement and zero deltas do nothing', () => {
  assert.equal(replay([{ time: 0, delta: 1 }, { time: 16, delta: 1 }, { time: 32, delta: 0 }]).length, 0);
  assert.equal(replay([{ time: 0, delta: 2 }, { time: 400, delta: 2 }, { time: 800, delta: 2 }]).length, 0);
});

test('inertia delivered late by a busy main thread is not a new gesture', () => {
  const events = swipe(0, { peak: 320 });
  // Everything between 850 ms and 1150 ms arrives in one late batch.
  const stalled = events.filter(event => event.time < 850 || event.time > 1150)
    .map(event => (event.time > 1150 && event.time < 1170 ? { ...event, handled: event.time + 140 } : event));
  assert.equal(replay(stalled).length, 1);
});

test('a gesture handed over by embedded content stays spent until a new one begins', () => {
  const gate = createWheelGate();
  // The demo released the scroll at its last screen while the fingers were still moving.
  gate.spend(1, 1000);
  const inertia = swipe(1016, { peak: 120 }).slice(8);
  assert.ok(inertia.every(({ time, delta }) => gate.push(delta, time) === 0));
  assert.equal(gate.push(40, end(inertia) + 600), 1);
});
