// Glass backdrops. The flat shapes of a backdrop become stacked sheets of clear liquid glass that swell and
// slide over each other, and a clear pane lies behind each block of text. One WebGL2 canvas per backdrop
// draws both, a frame at a time; the SVG underneath stays as the fallback.
import { fragment, vertex } from './backdrop-glsl.js?v=11';

const BUDGET = 3.6e6;          // canvas pixels per backdrop
const COLUMNS = 1024;          // samples of each edge across its span
const STEPS = 96;              // straight pieces per curve segment
const LIGHT = [-.552, -.834];  // toward the light, as on the selector lens
const ALPHA = [.4, .46, .5];     // veil of each plate, front to back; the rest as the last
const PACE = 1000 / 30;        // the drift is slow: half the frames show it just as well
const COST = 6;                // milliseconds of GPU a frame may take before the canvas gets coarser
const BEND = 3.4;              // how hard a rim bends its view: past 3 a stretch of it shows one line of the picture, drawn out
const PANE = .9;               // how far inside itself the rim of a pane looks, in rim widths: near 1 its whole band shows one strip
const BREATH = .24;            // share of its width a rim loses in a trough of the swell
const ROLL = [1.5, .0065, .007]; // the swell across a plate: lean of its crests, sway of the view (share of the shorter side), light
const REACH = [3, 6, 9, 12];   // pixels a plate yields to the pointer, back to front
const GROUNDS = { '.site-backdrop': '--paper', '.project-backdrop': '--stage' };

// Optical strengths differ between a pale and a deep page; geometry does not.
const TONES = {
  pale: { rim: [112, 156, 184, .2], light: [255, 255, 255], shade: [38, 74, 98], lobe: .22, sheen: .02, far: .12, dusk: .2, cast: .21, rest: .18,
    pane: { veil: .24, hair: .8, glow: .03, tint: .07, shade: .1, cast: .08, line: .3, split: .015 } },
  deep: { rim: [78, 124, 156, .3], light: [176, 214, 236], shade: [2, 8, 13], lobe: .4, sheen: .04, far: .15, dusk: .3, cast: .62, rest: .1,
    pane: { veil: .2, hair: .7, glow: .05, tint: .1, shade: .3, cast: .4, line: .5, split: .015 } },
};

// Two slow swells travel along each edge, a shorter one that is seen to move and a long one under it, and
// neighbouring plates send theirs opposite ways: amplitude (share of the shorter side), length (share of the
// width), period (s, its sign the direction), phase.
const SWELLS = [
  [[.019, .62, 23, .4], [.03, 1.45, -53, 2.1]],
  [[.021, .54, -29, 3.3], [.032, 1.3, 47, .9]],
  [[.018, .70, 21, 5.2], [.026, 1.6, -59, 4.0]],
  [[.017, .58, -26, 1.6], [.024, 1.4, 43, 2.9]],
];

// Each plate also slides sideways as a whole, against its neighbours: reach (share of the width), period (s), phase.
const SLIDES = [[.016, 37, 0], [.02, -41, 2.6], [.014, 31, 4.4], [.016, -34, 1.2]];

const clamp = (value, low, high) => value < low ? low : value > high ? high : value;
const lerp = (from, to, t) => from + (to - from) * t;

// CSS cubic-bezier timing as a function of progress.
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const slope = (a, b, t) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i += 1) t = clamp(t - (at(x1, x2, t) - x) / (slope(x1, x2, t) || 1e-6), 0, 1);
    return at(y1, y2, t);
  };
}
const EASE = bezier(.22, 1, .36, 1), SETTLE = bezier(.16, .9, .28, 1);

// One edge as heights and slopes over its own span of x, in the units of the drawing.
function tabulate(values, close) {
  const xs = [], ys = [];
  for (let s = 2; s + 5 < values.length; s += 6) {
    for (let i = s > 2 ? 1 : 0; i <= STEPS; i += 1) {
      const t = i / STEPS, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      xs.push(a * values[s - 2] + b * values[s] + c * values[s + 2] + d * values[s + 4]);
      ys.push(a * values[s - 1] + b * values[s + 1] + c * values[s + 3] + d * values[s + 5]);
    }
  }
  const from = xs[0], to = xs[xs.length - 1], step = (to - from) / (COLUMNS - 1);
  const heights = new Float64Array(COLUMNS);
  for (let column = 0, segment = 0; column < COLUMNS; column += 1) {
    const x = from + step * column;
    while (segment < xs.length - 2 && xs[segment + 1] < x) segment += 1;
    heights[column] = ys[segment] + (ys[segment + 1] - ys[segment]) * (x - xs[segment]) / (xs[segment + 1] - xs[segment]);
  }
  const table = new Float32Array(COLUMNS * 2);
  for (let column = 0; column < COLUMNS; column += 1) {
    const before = Math.max(0, column - 1), after = Math.min(COLUMNS - 1, column + 1);
    table[column * 2] = heights[column];
    table[column * 2 + 1] = (heights[after] - heights[before]) / ((after - before) * step);
  }
  const height = x => {
    const u = clamp((x - from) / step, 0, COLUMNS - 1.001), i = u | 0;
    return lerp(heights[i], heights[i + 1], u - i);
  };
  // The plate lies on the side of the edge where the outline goes on to close: below it (1) or above it (-1).
  return { xs, ys, from, to, table, height, side: close[1] < height(close[0]) ? -1 : 1 };
}

// A plate keeps its original tone on average: its veil is solved against the mean of what it covers.
function veils(edges, box, { page, fills }, alpha) {
  const census = new Float64Array(1 << edges.length);
  for (let y = 4; y < box[1]; y += 8) {
    for (let x = 4; x < box[0]; x += 8) {
      let mask = 0;
      edges.forEach((edge, plate) => { if (x >= edge.from && x <= edge.to && (y - edge.height(x)) * edge.side > 0) mask |= 1 << plate; });
      census[mask] += 1;
    }
  }
  const solved = [];
  fills.forEach((fill, plate) => {
    const mean = [0, 0, 0];
    let total = 0;
    census.forEach((count, mask) => {
      if (!(mask >> plate & 1) || !count) return;
      const below = [...page];
      for (let under = 0; under < plate; under += 1) if (mask >> under & 1) for (let c = 0; c < 3; c += 1) below[c] += (solved[under][c] - below[c]) * alpha[under];
      for (let c = 0; c < 3; c += 1) mean[c] += below[c] * count;
      total += count;
    });
    solved.push(fill.map((value, c) => total ? clamp(mean[c] / total + (value - mean[c] / total) / alpha[plate], 0, 255) : value));
  });
  return solved;
}

// Normals to an edge cross at its centres of curvature: inside the plate under a crest, outside it over a
// trough. A rim reaching the first, or a view bent past the second, would fold the picture, so each plate's
// optics shrink to fit. On a wide screen none has to.
function optics({ xs, ys, side }, sx, sy, width, height, curl) {
  const widest = clamp(Math.min(width, height) * .071, 36, 80);
  let crest = Infinity, trough = Infinity;
  for (let i = 1; i < xs.length - 1; i += 1) {
    const x = xs[i] * sx;
    if (x < -widest || x > width + widest) continue;
    const ax = x - xs[i - 1] * sx, ay = (ys[i] - ys[i - 1]) * sy, bx = xs[i + 1] * sx - x, by = (ys[i + 1] - ys[i]) * sy;
    const cross = ax * by - ay * bx;
    if (Math.abs(cross) < 1e-9) continue;
    const radius = Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(ax + bx, ay + by) / (2 * Math.abs(cross));
    // A swell passing over a bend can tighten it by as much as its own curvature.
    const tight = radius / (1 + radius * curl);
    if (cross * side > 0) crest = Math.min(crest, tight); else trough = Math.min(trough, tight);
  }
  const band = Math.min(widest, crest * .85, trough * 1.4), unit = band / 64, reach = band * .56;
  return {
    lens: [band, BEND, unit, reach],                // band, bend of the view through it, unit, shadow reach
    cast: [reach * .3, 7 * unit, band * .3, 0],     // spread, drop, shelter
  };
}

export function initBackdrops({ reducedMotion } = {}) {
  const panes = new Map();
  const inert = { stage() {}, show() {}, arrive() {} };
  const api = { pane: section => panes.get(section) || inert };
  const probe = document.createElement('canvas');
  if (!window.ResizeObserver || !probe.getContext) return api;

  // Both palettes are read from the stylesheet, so a theme change never waits for the page to restyle.
  const declared = { ':root': {}, ':root[data-theme="night"]': {} };
  for (const sheet of document.styleSheets) {
    let rules = [];
    try { rules = sheet.cssRules; } catch {}
    for (const rule of rules) {
      const target = declared[rule.selectorText];
      if (target) for (const name of rule.style) if (name.startsWith('--')) target[name] = rule.style.getPropertyValue(name);
    }
  }
  const variables = [declared[':root'], { ...declared[':root'], ...declared[':root[data-theme="night"]'] }];
  const ink = probe.getContext('2d');
  // A value the canvas cannot read as an opaque colour leaves the marker in place.
  const rgb = value => {
    ink.fillStyle = '#010203';
    ink.fillStyle = (value || '').trim();
    const hex = ink.fillStyle;
    return hex === '#010203' || hex[0] !== '#' ? null : [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  };
  const night = () => document.documentElement.dataset.theme === 'night' ? 1 : 0;
  const still = () => Boolean(reducedMotion?.matches);

  // Where a mouse points, from -1 to 1 across the window: the plates lean a few pixels after it.
  const pointer = [0, 0];
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    pointer[0] = clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1);
    pointer[1] = clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1);
  }, { passive: true });

  let frame = 0;
  const wake = () => { frame ||= requestAnimationFrame(tick); };
  function tick(now) {
    frame = 0;
    let again = false;
    for (const backdrop of backdrops) again = backdrop.draw(now) || again;
    if (again) wake();
  }

  const backdrops = Object.entries(GROUNDS).map(([selector, ground]) => {
    const element = document.querySelector(selector);
    const svg = element?.querySelector('svg');
    if (!svg) return null;
    const section = element.parentElement;
    const paths = [...svg.querySelectorAll('path')];
    const palettes = variables.map(set => ({ page: rgb(set[ground]), fills: paths.map(path => rgb(set[`--${path.classList[0]}`])) }));
    // Without every colour the flat shapes are the honest picture.
    if (palettes.some(({ page, fills }) => !page || fills.includes(null))) return null;
    const box = [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height];
    // Each shape is the area on one side of its curve, under it or over it: the closing lines lie outside the view.
    const edges = paths.map(path => {
      const [curve, close] = path.getAttribute('d').split('L').map(part => part.match(/-?[\d.]+/g).map(Number));
      return tabulate(curve, close);
    });
    const plates = edges.length;
    const alpha = edges.map((edge, plate) => ALPHA[Math.min(ALPHA.length - 1, plates - 1 - plate)]);
    const themes = palettes.map(palette => {
      const pale = palette.page[0] * .2126 + palette.page[1] * .7152 + palette.page[2] * .0722 > 128;
      return { page: palette.page, veils: veils(edges, box, palette, alpha), tone: pale ? TONES.pale : TONES.deep };
    });

    const canvas = document.createElement('canvas');
    canvas.className = 'backdrop-glass';
    element.append(canvas);
    // The flat shapes stop painting once the glass covers them.
    canvas.addEventListener('transitionend', () => element.classList.add('has-glass'));

    const host = section.querySelector('[data-pane]');
    const pane = { on: host ? 1 : 0, rect: null, from: null, start: 0, delay: 0, duration: 0, shift: [0, 0] };
    const theme = { at: night(), from: night(), to: night(), start: 0 };
    let gl, program, uniform, compiling, parallel, plain, lost = false;
    let width = 0, height = 0, ratio = 1, thrift = 1, ceiling = 0, clock = 0, last = 0, drawn = 0, frames = 0, dirty = true, shown = false;
    let heights = [], check = 75, slow = 0;
    const lean = [0, 0];

    function build() {
      gl = window.WebGL2RenderingContext ? canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }) : null;
      if (!gl) return false;
      parallel = gl.getExtension('KHR_parallel_shader_compile');
      const shader = (type, source) => {
        const made = gl.createShader(type);
        gl.shaderSource(made, source);
        gl.compileShader(made);
        return made;
      };
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment(plates, COLUMNS)));
      gl.linkProgram(program);
      compiling = true;
      const table = new Float32Array(COLUMNS * 2 * plates);
      edges.forEach((edge, plate) => table.set(edge.table, plate * COLUMNS * 2));
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, COLUMNS, plates, 0, gl.RG, gl.FLOAT, table);
      for (const name of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, name, gl.NEAREST);
      for (const name of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, name, gl.CLAMP_TO_EDGE);
      return true;
    }

    // Linking runs off the main thread where the browser allows; the flat shapes show meanwhile.
    function ready() {
      if (!compiling) return Boolean(uniform);
      if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) return false;
      compiling = false;
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { fail(); return false; }
      gl.useProgram(program);
      const cache = new Map();
      uniform = name => cache.get(name) ?? cache.set(name, gl.getUniformLocation(program, name)).get(name);
      gl.uniform1i(uniform('uEdges'), 0);
      gl.uniform3fv(uniform('uSpan'), edges.flatMap(edge => [edge.from, (COLUMNS - 1) / (edge.to - edge.from), edge.side]));
      gl.uniform2fv(uniform('uLight'), LIGHT);
      return true;
    }

    // Anything that goes wrong leaves the flat shapes, and a plain sheet where the pane would be.
    function fail() {
      uniform = null;
      lost = true;
      canvas.remove();
      element.classList.remove('has-glass');
      if (!host) return;
      // An entrance may already be under way: the sheet is simply there.
      pane.on = 1;
      pane.from = null;
      plain = document.createElement('span');
      plain.className = 'pane-plain';
      element.append(plain);
      lay();
    }
    function lay() {
      if (!plain) return;
      const rect = pane.rect;
      plain.hidden = !rect;
      if (rect) Object.assign(plain.style, { left: `${rect[0]}px`, top: `${rect[1]}px`, width: `${rect[2] - rect[0]}px`, height: `${rect[3] - rect[1]}px`, borderRadius: `${rect[4]}px`, opacity: pane.on });
    }

    function measure() {
      const wide = element.clientWidth, tall = element.clientHeight;
      const dense = window.devicePixelRatio || 1;
      const next = Math.max(Math.min(1, dense), Math.min(dense, 2, Math.sqrt(BUDGET / Math.max(1, wide * tall))) * thrift);
      if (wide !== width || tall !== height || next !== ratio) {
        width = wide; height = tall; ratio = next;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        dirty = true;
      }
      if (host) {
        // The pane hugs the text it lies behind, from layout alone: entrance transforms do not count.
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const node of host.querySelectorAll('h1, h2, p, ul, .glass-switch')) {
          if (node.offsetWidth < 9) continue;
          let x = 0, y = 0;
          for (let at = node; at && at !== section; at = at.offsetParent) { x += at.offsetLeft; y += at.offsetTop; }
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x + node.offsetWidth); bottom = Math.max(bottom, y + node.offsetHeight);
        }
        const style = getComputedStyle(host);
        const pad = (style.getPropertyValue('--pane-pad').match(/[\d.]+/g) || []).map(Number);
        const radius = parseFloat(style.getPropertyValue('--pane-radius')) || 0;
        const [above = 0, beside = above, below = above, before = beside] = pad;
        // The last number is the room between text and outline: the rim's optics stay inside it.
        const rect = pad.length && right > left ? [left - before, top - above, right + beside, bottom + below, radius, Math.min(above, beside, below, before)] : null;
        if (String(rect) !== String(pane.rect)) { pane.rect = rect; dirty = true; lay(); }
      }
    }

    function size() {
      const sx = width / box[0], sy = height / box[1];
      const short = Math.min(width, height);
      const swells = edges.map((edge, plate) => SWELLS[plate % SWELLS.length].map(([amplitude, length, period, phase]) =>
        [still() ? 0 : amplitude * short, 2 * Math.PI / (length * width), 2 * Math.PI / period, phase]));
      const each = edges.map((edge, plate) => optics(edge, sx, sy, width, height, swells[plate].reduce((sum, [a, k]) => sum + a * k * k, 0)));
      heights = swells.map(pair => pair.reduce((sum, [a]) => sum + a, 0));
      // Above the highest crest, its shadow and its swell, and above the pane, the page is bare: nothing is drawn there.
      ceiling = height;
      edges.forEach(({ xs, ys, side }, plate) => {
        // A plate that hangs from the top leaves no bare page above it.
        if (side < 0) { ceiling = 0; return; }
        const [band, , , reach] = each[plate].lens;
        let crest = Infinity;
        for (let i = 0; i < xs.length; i += 1) if (xs[i] * sx > -band - width * .05 && xs[i] * sx < width * 1.05 + band) crest = Math.min(crest, ys[i] * sy);
        ceiling = Math.min(ceiling, crest - reach - heights[plate] - REACH[REACH.length - 1] - 4);
      });
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniform('uView'), width, height);
      gl.uniform1f(uniform('uRatio'), canvas.width / width);
      gl.uniform2f(uniform('uScale'), sx, sy);
      gl.uniform4fv(uniform('uLens'), each.flatMap(o => o.lens));
      gl.uniform4fv(uniform('uCast'), each.flatMap(o => o.cast));
      gl.uniform4fv(uniform('uSwell'), swells.flat(2));
      // The first swell of a plate also runs across its body, its crests leaning one way on one plate and the
      // other way on the next; the view through it sways along the slope of those crests.
      gl.uniform4fv(uniform('uRoll'), swells.flatMap(([[, k]], plate) => {
        const slope = plate % 2 ? -ROLL[0] : ROLL[0], long = Math.hypot(1, slope);
        return [k, k * slope, 1 / long, slope / long];
      }));
      gl.uniform3f(uniform('uFlow'), BREATH, still() ? 0 : ROLL[1] * short, still() ? 0 : ROLL[2]);
    }

    function tint(mix) {
      const [day, dusk] = themes;
      const blend = (a, b) => a.map((value, index) => lerp(value, b[index], mix));
      const tone = key => lerp(day.tone[key], dusk.tone[key], mix), glass = key => lerp(day.tone.pane[key], dusk.tone.pane[key], mix);
      const page = blend(day.page, dusk.page);
      gl.uniform3fv(uniform('uPage'), page);
      gl.clearColor(page[0] / 255, page[1] / 255, page[2] / 255, 1);
      gl.uniform4fv(uniform('uVeil'), day.veils.flatMap((veil, plate) => [...blend(veil, dusk.veils[plate]), alpha[plate]]));
      gl.uniform3fv(uniform('uGlint'), blend(day.tone.light, dusk.tone.light));
      gl.uniform3fv(uniform('uShade'), blend(day.tone.shade, dusk.tone.shade));
      gl.uniform4f(uniform('uTone'), tone('lobe'), tone('sheen'), tone('far'), tone('dusk'));
      gl.uniform4fv(uniform('uRim'), blend(day.tone.rim, dusk.tone.rim));
      gl.uniform1f(uniform('uDepth'), tone('cast'));
      gl.uniform1f(uniform('uRest'), tone('rest'));
      gl.uniform2f(uniform('uPaneVeil'), glass('veil'), glass('glow'));
      gl.uniform4f(uniform('uPaneTone'), glass('hair'), glass('tint'), glass('shade'), glass('cast'));
      gl.uniform2f(uniform('uPaneLine'), glass('line'), glass('split'));
    }

    const visible = () => !document.hidden && (!document.documentElement.classList.contains('has-stack')
      || section.classList.contains('is-current') || section.classList.contains('is-moving'));

    // Returns whether another frame is wanted.
    function draw(now) {
      if (lost || !gl) return false;
      // Linking is followed to its end even out of view, so a failure shows before the section does.
      if (!ready()) return !lost;
      // Out of view a backdrop is drawn once, so that it is there when its section first shows.
      const seen = visible();
      if (!seen && shown) { last = 0; return false; }
      let moving = false;
      if (theme.at !== theme.to) {
        const t = still() ? 1 : clamp((now - theme.start) / 500, 0, 1);
        theme.at = lerp(theme.from, theme.to, EASE(t));
        if (t >= 1) theme.at = theme.to;
        moving = true;
        dirty = true;
      }
      let on = pane.on, shift = [0, 0];
      if (pane.from !== null) {
        const t = still() ? 1 : clamp((now - pane.start - pane.delay) / pane.duration, 0, 1);
        const eased = SETTLE(t);
        on = lerp(pane.from, 1, eased);
        shift = pane.shift.map(value => value * (1 - eased));
        if (t >= 1) { pane.from = null; pane.on = 1; }
        moving = true;
        dirty = true;
      }
      const drifting = !still() && !section.classList.contains('is-demo-active');
      if (!dirty && (!drifting || now - drawn < PACE - 4)) return drifting;
      const passed = drifting && last ? Math.min(100, now - last) / 1000 : 0;
      clock += passed;
      last = now;
      drawn = now;
      if (dirty) { size(); tint(theme.at); }
      dirty = false;
      gl.uniform1f(uniform('uTime'), clock);
      // The plates slide sideways on their own clocks and lean after the pointer, the front ones furthest.
      // A pause holds them where they are; without motion they rest where they were drawn.
      const calm = still(), ease = 1 - Math.exp(-passed / .45);
      for (let axis = 0; axis < 2; axis += 1) lean[axis] = calm ? 0 : lean[axis] + (pointer[axis] - lean[axis]) * ease;
      gl.uniform4fv(uniform('uDrift'), edges.flatMap((edge, plate) => {
        const [reach, period, phase] = SLIDES[plate % SLIDES.length], turn = 2 * Math.PI * clock / period;
        const slide = calm ? 0 : reach * width * (Math.sin(turn + phase) + .35 * Math.sin(turn * .618 + phase * 2));
        const give = REACH[Math.min(REACH.length - 1, plate + REACH.length - plates)];
        return [slide - lean[0] * give, -lean[1] * give * .6, 0, heights[plate] ? -1 / heights[plate] : 0];
      }));
      const rect = pane.rect;
      if (rect && on > 0) {
        const grow = lerp(.955, 1, on);
        const hx = (rect[2] - rect[0]) / 2, hy = (rect[3] - rect[1]) / 2;
        gl.uniform4f(uniform('uPane'), rect[0] + hx + shift[0], rect[1] + hy + shift[1], hx * grow, hy * grow);
        gl.uniform4f(uniform('uPaneLens'), Math.min(rect[4], hx, hy) * grow, Math.min(clamp(Math.min(hx, hy) * .3, 14, 40), rect[5] - 2), PANE, clamp(on, 0, 1));
      } else gl.uniform4f(uniform('uPaneLens'), 0, 1, 1, 0);
      const top = Math.max(0, Math.min(ceiling, rect && on > 0 ? rect[1] - 64 : height));
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, canvas.width, Math.ceil((height - top) * canvas.height / height));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.classList.add('is-drawn'); }
      frames += 1;
      // Once things have settled, one frame is timed to its end, and another a second later if that one was
      // slow: a GPU that is slow both times, not just busy for a moment, gets a coarser canvas.
      if (frames === check && !moving) {
        const started = performance.now();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        const cost = performance.now() - started;
        if (cost > COST && !slow) { slow = cost; check += 30; }
        else if (cost > COST) { thrift = Math.sqrt(COST / Math.min(slow, cost)); measure(); return draw(now); }
      } else if (frames === check) frames -= 1;
      return seen && (drifting || moving);
    }

    // A lost context shows nothing: the flat shapes return until it is restored and has drawn again.
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      uniform = null; compiling = false; gl = null; shown = false;
      canvas.classList.remove('is-drawn');
      element.classList.remove('has-glass');
    });
    canvas.addEventListener('webglcontextrestored', () => { if (build()) { dirty = true; wake(); } else fail(); });
    new ResizeObserver(() => { measure(); if (dirty) draw(performance.now()); wake(); }).observe(element);
    if (host) {
      const watch = new ResizeObserver(() => { measure(); wake(); });
      watch.observe(host);
      for (const node of host.children) watch.observe(node);
      panes.set(section, {
        stage() { if (!still()) { pane.on = 0; pane.from = null; dirty = true; lay(); wake(); } },
        show() { pane.on = 1; pane.from = null; dirty = true; lay(); wake(); },
        arrive({ delay = 0, duration = 720, shift = [0, 0] } = {}) {
          if (plain) { this.show(); return; }
          Object.assign(pane, { from: pane.on, start: performance.now(), delay, duration, shift });
          wake();
        },
      });
    }
    new MutationObserver(wake).observe(section, { attributes: true, attributeFilter: ['class'] });

    measure();
    return {
      draw,
      start() { if (!gl && !lost) { if (build()) wake(); else fail(); } },
      retheme() { Object.assign(theme, { from: theme.at, to: night(), start: performance.now() }); wake(); },
      redo() { measure(); dirty = true; wake(); },
      visible,
    };
  }).filter(Boolean);
  if (!backdrops.length) return api;

  // The backdrop on screen starts now; the others when the page has a moment to spare.
  backdrops.forEach(backdrop => { if (backdrop.visible()) backdrop.start(); });
  const later = window.requestIdleCallback || (run => setTimeout(run, 400));
  later(() => backdrops.forEach(backdrop => backdrop.start()));

  new MutationObserver(() => backdrops.forEach(backdrop => backdrop.retheme())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', wake);
  reducedMotion?.addEventListener('change', () => backdrops.forEach(backdrop => backdrop.redo()));
  // Moving to a screen of another density changes no size, so nothing else would notice.
  const density = () => matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => { density(); backdrops.forEach(backdrop => backdrop.redo()); }, { once: true });
  density();
  return api;
}
