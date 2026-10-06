import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelGate } from '../src/portfolio/wheel-gate.js';

const TRANSITION = 820;
const FRAME = 1000 / 60;

// Velocity in px/ms of a two-finger swipe: the fingers speed up, then macOS-like momentum decays.
function swipe({ start = 0, peak = 3, rise = 110, hold = 30, decay = .968, direction = 1 } = {}) {
  const tau = -FRAME / Math.log(decay);
  return t => {
    const u = t - start;
    if (u < 0) return 0;
    const v = u < rise ? peak * Math.sin(u / rise * Math.PI / 2) ** 2
      : u < rise + hold ? peak : peak * .7 * Math.exp(-(u - rise - hold) / tau);
    return v < .02 ? 0 : v * direction;
  };
}

// The hardware's own events: one every `rate` ms while the fingers or the momentum move.
function hardware(velocity, { from = 0, to = 6000, rate = 1000 / 120, jitter = 0, seed = 1 } = {}) {
  const events = [];
  let random = seed;
  for (let t = from; t < to; t += rate) {
    const at = jitter ? t + ((random = random * 16807 % 2147483647) / 2147483647 - .5) * jitter : t;
    const delta = velocity(at) * rate;
    if (Math.abs(delta) >= .05) events.push({ time: at, delta });
  }
  return events;
}

// Plays events the way a browser hands them to the page: once per rendered frame, summed, stamped with the
// newest one, then the frame's callback. A stall holds a frame back; `frame(t)` sets each frame's length.
// A step locks the gate for one transition, as the stack does.
function replay(events, { frame = () => FRAME, stalls = [], end = 7000 } = {}) {
  const gate = createWheelGate();
  const steps = [];
  let lockedUntil = -Infinity, moving = 0, index = 0;
  const queue = [...events].sort((a, b) => a.time - b.time);
  const deliver = (piece, now) => {
    const direction = gate.push(piece.delta, piece.time, { ready: now >= lockedUntil, moving: now < lockedUntil ? moving : 0, now });
    if (direction) { steps.push({ at: Math.round(now), direction }); lockedUntil = now + TRANSITION; moving = direction; }
  };
  for (let now = 0; now < end;) {
    const stall = stalls.find(([at]) => now >= at && now < at + frame(now));
    now += stall ? stall[1] : frame(now);
    let piece = null;
    while (index < queue.length && queue[index].time <= now) {
      const event = queue[index++];
      if (piece && Math.sign(piece.delta) === Math.sign(event.delta)) { piece.delta += event.delta; piece.time = event.time; continue; }
      if (piece) deliver(piece, now);
      piece = { ...event };
    }
    if (piece) deliver(piece, now);
    gate.beat(now);
  }
  return steps;
}

const directions = steps => steps.map(step => step.direction);

test('one swipe moves exactly one section, however long its momentum runs', () => {
  for (const peak of [.3, 1, 3, 8, 15]) {
    for (const rate of [1000 / 60, 1000 / 120]) assert.deepEqual(directions(replay(hardware(swipe({ peak }), { rate }))), [1], `peak ${peak}, ${Math.round(1000 / rate)} Hz`);
  }
  assert.deepEqual(directions(replay(hardware(swipe({ peak: 4, direction: -1 })))), [-1]);
});

test('momentum handed over in bigger pieces by slower frames is not a new swipe', () => {
  for (const peak of [1, 3, 8]) {
    // Slow frames while two sections draw at once, fast ones after.
    for (const slow of [33, 50]) assert.equal(replay(hardware(swipe({ peak })), { frame: t => (t < 900 ? slow : FRAME) }).length, 1, `${slow} ms frames during the move`);
    // A streak of slow frames once the move is over, the momentum still running.
    for (const at of [1000, 1300, 1700]) {
      for (const slow of [40, 66, 90]) assert.equal(replay(hardware(swipe({ peak })), { frame: t => (t >= at && t < at + slow * 6 ? slow : FRAME) }).length, 1, `peak ${peak}, ${slow} ms frames at ${at} ms`);
    }
  }
});

test('momentum delivered late in one piece after a stall is not a new swipe', () => {
  for (const peak of [1, 3, 8]) {
    for (const at of [900, 1200, 1600, 2200]) {
      for (const length of [120, 250, 500, 900]) assert.equal(replay(hardware(swipe({ peak })), { stalls: [[at, length]] }).length, 1, `peak ${peak}, ${length} ms stall at ${at} ms`);
    }
  }
});

test('a hesitant start, a slow wandering drag and a 120 Hz screen still move one section', () => {
  const fling = swipe({ start: 120, peak: 4 });
  assert.equal(replay(hardware(t => (t < 60 ? .35 : t < 120 ? .06 : fling(t)))).length, 1, 'hesitant start');
  assert.equal(replay(hardware(t => (t < 1600 ? .2 + .1 * Math.sin(t / 140) + .06 * Math.sin(t / 53) : 0))).length, 1, 'wandering drag');
  for (const peak of [3, 8]) {
    const momentum = hardware(swipe({ peak, decay: .984 }));
    assert.equal(replay(momentum, { frame: t => (Math.floor(t / 97) % 4 === 0 ? 25 : 1000 / 120) }).length, 1, `120 Hz, peak ${peak}`);
  }
});

test('a second swipe the same way during the move is part of it', () => {
  const first = swipe({ peak: 3 }), second = swipe({ start: 520, peak: 3 });
  assert.equal(replay(hardware(t => (t < 470 ? first(t) : t < 520 ? 0 : second(t)))).length, 1);
  // Even after the first one has died down and paused.
  const short = swipe({ peak: 1, decay: .9 }), late = swipe({ start: 600, peak: 3 });
  assert.equal(replay(hardware(t => (t < 600 ? short(t) : late(t)))).length, 1);
});

test('a swipe back during the move goes back once the move is over', () => {
  const first = swipe({ peak: 3 }), back = swipe({ start: 600, peak: 3, direction: -1 });
  const steps = replay(hardware(t => (t < 560 ? first(t) : back(t))));
  assert.deepEqual(directions(steps), [1, -1]);
  assert.ok(steps[1].at >= TRANSITION);
});

test('a second swipe after a pause moves one more section', () => {
  const events = [...hardware(swipe({ peak: 2 }), { to: 2600 }), ...hardware(swipe({ start: 3000, peak: 2 }), { from: 3000 })];
  assert.deepEqual(directions(replay(events)), [1, 1]);
});

test('a new swipe that interrupts the momentum once the move is over counts at once', () => {
  for (const [peak, at] of [[4, 1170], [8, 1500], [2, 1100]]) {
    const first = swipe({ peak }), second = swipe({ start: at + 80, peak: 4 });
    const steps = replay(hardware(t => (t < at ? first(t) : second(t))));
    assert.equal(steps.length, 2, `peak ${peak}, again at ${at} ms`);
    assert.ok(steps[1].at < at + 260, 'without waiting for the momentum to end');
  }
});

test('reversing direction goes back as soon as the move allows', () => {
  const down = swipe({ peak: 2 }), up = swipe({ start: 1100, peak: 2, direction: -1 });
  assert.deepEqual(directions(replay(hardware(t => (t < 1040 ? down(t) : up(t))))), [1, -1]);
});

test('a stray opposite delta when the fingers lift does not re-arm the momentum', () => {
  const events = hardware(swipe({ peak: 6 }));
  events.splice(40, 0, { time: events[39].time + 2, delta: -2 });
  assert.deepEqual(directions(replay(events)), [1]);
});

test('a spinning mouse wheel moves one section until it pauses, even at an uneven pace', () => {
  let time = 0;
  const spin = Array.from({ length: 30 }, (_, index) => ({ time: (time += [40, 70, 120, 55, 90][index % 5]), delta: 100 }));
  assert.equal(replay(spin).length, 1);
  assert.equal(replay([...spin, { time: time + 600, delta: 100 }]).length, 2);
});

test('a single slow notch of a macOS mouse is enough', () => {
  assert.deepEqual(directions(replay([{ time: 0, delta: 4.000244140625 }])), [1]);
  assert.deepEqual(directions(replay([{ time: 0, delta: -4.000244140625 }])), [-1]);
});

test('faint movement and zero deltas do nothing', () => {
  assert.equal(replay([{ time: 0, delta: 1 }, { time: 16, delta: 1 }, { time: 32, delta: 0 }]).length, 0);
  assert.equal(replay([{ time: 0, delta: 2 }, { time: 400, delta: 2 }, { time: 800, delta: 2 }]).length, 0);
});

test('a gesture handed over by embedded content stays spent until a new one begins', () => {
  const gate = createWheelGate();
  // The demo released the scroll at its last screen while the fingers were still moving.
  gate.spend(1, 1000);
  let now = 1000;
  for (const { time, delta } of hardware(swipe({ start: 900, peak: 3 }), { from: 1000, to: 3500, rate: FRAME })) {
    for (; now < time; now += FRAME) gate.beat(now);
    assert.equal(gate.push(delta, time, { now: time }), 0);
  }
  for (const end = now + 600; now < end; now += FRAME) gate.beat(now);
  assert.equal(gate.push(40, now, { now }), 1);
});

test('without frames to watch, only a long gap ends a gesture', () => {
  const gate = createWheelGate();
  assert.equal(gate.push(30, 0), 1);
  assert.equal(gate.push(30, 400), 0, 'no frames confirmed the pause');
  assert.equal(gate.push(30, 2000), 1);
});

test('random swipes under random frame timing never move more than one section', () => {
  let seed = 11;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const between = (low, high) => low + (high - low) * random();
  for (let run = 0; run < 400; run += 1) {
    const base = [FRAME, 1000 / 120, FRAME, 1000 / 30][Math.floor(random() * 4)];
    const streaks = Array.from({ length: Math.floor(between(0, 5)) }, () => [between(0, 3000), between(30, 120), between(1, 10)]);
    const stalls = Array.from({ length: Math.floor(between(0, 3)) }, () => [between(200, 3200), between(80, 600)]);
    const frame = t => streaks.find(([at, size, count]) => t >= at && t < at + size * count)?.[1] ?? base;
    const velocity = swipe({ peak: between(.3, 20), decay: between(.95, .985), rise: between(60, 200), hold: between(0, 80) });
    const steps = replay(hardware(velocity, { rate: random() < .5 ? FRAME : 1000 / 120, jitter: random() < .5 ? 3 : 0, seed: run + 1 }), { frame, stalls });
    assert.equal(steps.length, 1, `run ${run}: ${steps.map(step => step.at).join(', ')}`);
  }
});
