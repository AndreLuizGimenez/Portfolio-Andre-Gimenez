// Turns a raw wheel stream into at most one step per physical gesture.
// Trackpad inertia keeps emitting for a second or more after the fingers leave;
// it only ever decays, so a step is spent until the stream pauses or clearly rises again.
export function createWheelGate({ gap = 180, threshold = 4, lateness = 60 } = {}) {
  let lastTime = -Infinity;
  let spent = 0;
  let pending = 0;
  let peak = 0;
  let floor = 0;
  let decaying = false;
  const recent = [];

  function spend(direction, time) {
    spent = direction;
    pending = 0;
    peak = 0;
    floor = 0;
    decaying = false;
    recent.length = 0;
    if (time !== undefined) lastTime = time;
  }

  function risesAgain(size) {
    recent.push(size);
    if (recent.length > 3) recent.shift();
    const level = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    if (!decaying) {
      peak = Math.max(peak, level);
      if (recent.length === 3 && level < peak * .6) { decaying = true; floor = level; }
      return false;
    }
    floor = Math.min(floor, level);
    return level > floor * 2 + 4;
  }

  return {
    spend,
    // `time` is when the event happened and `now` when it was handled: a busy main
    // thread delivers inertia late, which must not read as a pause between gestures.
    push(delta, time, { ready = true, now = time } = {}) {
      const direction = Math.sign(delta);
      if (!direction) return 0;
      const late = now - time > lateness && now - time < 10000;
      const paused = time - lastTime;
      if (paused > gap && (!late || paused > 1200)) spend(0);
      lastTime = time;
      if (direction === spent) {
        // Judged only once the running transition is over, when leftover inertia
        // sits below anything seen earlier in the same gesture.
        if (!risesAgain(Math.abs(delta)) || !ready) return 0;
        spend(0);
      }
      if (!ready) { pending = 0; return 0; }
      if (Math.sign(pending) !== direction) pending = 0;
      pending += delta;
      if (Math.abs(pending) < threshold) return 0;
      spend(direction);
      return direction;
    },
  };
}
