// Turns a raw wheel stream into at most one step per physical gesture.
//
// A page never sees the hardware's own events as they happen. A busy frame makes the browser hold them
// back: they arrive late, summed into bigger and rarer pieces, or as one piece stamped with the newest
// event after what looks like a pause, or still one by one with their old stamps, frames after the stall.
// Reading any of that as fresh input is what used to carry a gesture one section too far. So the gate
// judges a gesture by its speed, distance over the time a piece covers, and takes a gap as a pause only
// when the stamps show it and the frames watched meanwhile (`beat`, once per frame) confirm it.
const STALL = 100;      // a frame longer than this may have held input back: it confirms no silence
const LATENCY = 24;     // input this much older than a frame that came on time has reached the page
const WINDOW = 48;      // speed is read over this much of the most recent input, in ms

export function createWheelGate({ gap = 180, threshold = 4, rise = 2.5, lift = [.4, 4], fallback = 1200 } = {}) {
  let spent = 0;            // direction of the gesture under way, once it has had its step
  let pending = 0;          // distance gathered toward a step
  let lastTime = -Infinity; // stamp of the latest event
  let heard = -Infinity;    // up to here, frames that came on time saw no input arrive
  let previous = -Infinity; // the last frame
  let speed = 0;            // px/ms over the latest pieces
  let peakSpeed = 0, floorSpeed = 0, floorSize = 0, decaying = false;
  const recent = [];        // size and time span of the latest pieces, flat

  function spend(direction, time) {
    spent = direction;
    pending = 0;
    peakSpeed = floorSpeed = floorSize = 0;
    decaying = false;
    // A gesture handed over from elsewhere starts its own readings.
    if (time !== undefined) { lastTime = time; recent.length = 0; speed = 0; }
  }

  // Speed and typical size of the latest pieces.
  function read(size, span) {
    recent.push(size, span);
    let distance = 0, time = 0, kept = 0;
    for (let at = recent.length - 2; at >= 0 && time < WINDOW; at -= 2) {
      distance += recent[at];
      time += recent[at + 1];
      kept += 2;
    }
    recent.splice(0, recent.length - Math.max(kept, 6));
    speed = distance / time;
    return { full: time >= WINDOW && recent.length >= 6, typical: recent.reduce((sum, value, at) => (at % 2 ? sum : sum + value), 0) * 2 / recent.length };
  }

  // Whether the gesture under way is pushed again, as a new swipe interrupting its inertia does. That takes
  // both a clear rise in speed, which summed pieces never show, and a rise in the pieces themselves, which a
  // mouse wheel turned at an uneven pace never shows.
  function risesAgain({ full, typical }) {
    if (!decaying) {
      peakSpeed = Math.max(peakSpeed, speed);
      if (full && speed < peakSpeed * .6) { decaying = true; floorSpeed = speed; floorSize = typical; }
      return false;
    }
    floorSpeed = Math.min(floorSpeed, speed);
    floorSize = Math.min(floorSize, typical);
    return speed > floorSpeed * rise + lift[0] && typical > floorSize * rise + lift[1];
  }

  return {
    spend,
    // `time` is when the event happened and `now` when it was handled. `ready` is false while a move is under
    // way, `moving` its direction: whatever starts or swells that way then belongs to the move.
    push(delta, time, { ready = true, moving = 0, now = time } = {}) {
      const direction = Math.sign(delta);
      if (!direction) return 0;
      const quiet = time - lastTime;
      // Frames can only vouch for the silence up to the stamp of what has just arrived. Without frames to
      // watch, only a long gap can be told from a stall.
      if ((quiet >= gap && Math.min(heard, time) - lastTime >= gap) || quiet > fallback) spend(0, lastTime);
      // A piece covers the input since the one before it, or since the silence watched after it.
      const span = Math.min(fallback, Math.max(4, time - Math.max(lastTime, heard < time ? heard : -Infinity)));
      lastTime = Math.max(lastTime, time);
      const reading = read(Math.abs(delta), span);
      if (direction === spent) {
        if (!risesAgain(reading)) return 0;
        if (!ready) {
          // The swell joins the move under way: its own decay is what counts from here.
          decaying = false;
          peakSpeed = speed;
          return 0;
        }
        spend(0);
      } else if (!ready) {
        // A gesture that begins during a move the same way is part of it. One the other way asks to go
        // back: if it is still going once the move is over, it counts then.
        if (direction === moving) { spend(direction); risesAgain(reading); }
        else pending = 0;
        return 0;
      }
      if (Math.sign(pending) !== direction) pending = 0;
      pending += delta;
      if (Math.abs(pending) < threshold) return 0;
      spend(direction);
      return direction;
    },
    // One call per rendered frame while `push` or `spend` has left anything to watch; returns whether it
    // still has. A frame that came on time has been handed whatever input was ready before it.
    beat(now) {
      if (now - previous < STALL) heard = Math.max(heard, now - LATENCY);
      previous = now;
      return Boolean(spent || pending) && heard - lastTime < gap;
    },
  };
}
