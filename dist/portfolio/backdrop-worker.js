'use strict';

// Software render of one backdrop: every shape is a clear plate with a convex rim.
// Each plate bends, tints and lights the image of everything behind it.
const CELL = 4;            // spacing of the distance field, in output pixels
const BUDGET = 2e6;        // output pixels per bitmap
const STEPS = 320;         // straight pieces per curve segment
const LIGHT = [-.552, -.834]; // toward the light, as on the selector lens

const clamp = (value, low, high) => value < low ? low : value > high ? high : value;
const smooth = (from, to, value) => { const t = clamp((value - from) / (to - from), 0, 1); return t * t * (3 - 2 * t); };

const ALPHA = [.5, .46, .4]; // veil of each plate, back to front
const REST = .18;          // share of the rim optics left where text sits
const MARGIN = 36;         // CSS pixels over which they return around it

// Optical strengths differ between a pale and a deep page; geometry does not.
const TONES = {
  pale: { clear: .7, light: [255, 255, 255], shade: [38, 74, 98], hair: .72, face: .06, glow: .1, groove: .27, cast: .21 },
  deep: { clear: .75, light: [176, 214, 236], shade: [2, 8, 13], hair: .95, face: .1, glow: .3, groove: .34, cast: .62 },
};

// A render that fails leaves the flat shapes in place: the worker simply ends.
self.onmessage = ({ data }) => {
  try {
    const { pixels, ...frame } = render(data);
    Promise.all(pixels.map(buffer => createImageBitmap(new ImageData(buffer, frame.columns, frame.rows))))
      .then(bitmaps => self.postMessage({ key: data.key, ...frame, bitmaps }, bitmaps), () => self.close());
  } catch { self.close(); }
};

function render({ width, height, ratio, box, curves, palettes, zones = [] }) {
  const sx = width / box[0], sy = height / box[1];
  const plates = curves.length;

  // Curves as dense polylines in CSS pixels, continued straight beyond both ends.
  const edges = curves.map(values => {
    const xs = [], ys = [];
    for (let s = 2; s + 5 < values.length; s += 6) {
      for (let i = s > 2 ? 1 : 0; i <= STEPS; i += 1) {
        const t = i / STEPS, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        xs.push((a * values[s - 2] + b * values[s] + c * values[s + 2] + d * values[s + 4]) * sx);
        ys.push((a * values[s - 1] + b * values[s + 1] + c * values[s + 3] + d * values[s + 5]) * sy);
      }
    }
    const last = xs.length - 1;
    const lead = (ys[1] - ys[0]) / (xs[1] - xs[0]), tail = (ys[last] - ys[last - 1]) / (xs[last] - xs[last - 1]);
    xs.unshift(xs[0] - 1e5); ys.unshift(ys[0] - 1e5 * lead);
    xs.push(xs[last + 1] + 1e5); ys.push(ys[last + 1] + 1e5 * tail);
    return { xs: Float64Array.from(xs), ys: Float64Array.from(ys) };
  });

  // Normals to an edge cross at its centres of curvature: inside the plate under a crest,
  // outside it over a trough. A rim reaching the first, or a view bent past the second,
  // would fold the picture, so each plate's optics shrink to fit. On a wide screen none has to.
  const widest = clamp(Math.min(width, height) * .071, 36, 80);
  const optics = edges.map(({ xs, ys }) => {
    let crest = Infinity, trough = Infinity;
    for (let i = 2; i < xs.length - 2; i += 1) {
      if (xs[i] < -widest || xs[i] > width + widest) continue;
      const ax = xs[i] - xs[i - 1], ay = ys[i] - ys[i - 1], bx = xs[i + 1] - xs[i], by = ys[i + 1] - ys[i];
      const cross = ax * by - ay * bx;
      if (Math.abs(cross) < 1e-9) continue;
      const radius = Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(ax + bx, ay + by) / (2 * Math.abs(cross));
      if (cross > 0) crest = Math.min(crest, radius); else trough = Math.min(trough, radius);
    }
    const band = Math.min(widest, crest * .85, trough * 1.4), unit = band / 64, reach = band * .56;
    return { band, unit, reach,
      bend: Math.min(band * 2.2, trough * .85), // how far past its rim a plate looks, at the rim
      spread: reach * .3, drop: 7 * unit, shelter: band * .3,
      wall: 7 * unit };                         // visible thickness of the plate
  });
  const band = Math.max(...optics.map(o => o.band)), bend = Math.max(...optics.map(o => o.bend)), reach = band * .56;

  // Only the box that the plates and their shadows touch is rendered.
  let left = width, right = 0, top = height;
  edges.forEach(({ xs, ys }) => {
    for (let i = 1; i < xs.length - 1; i += 1) {
      if (ys[i] > height + reach || xs[i] < -reach || xs[i] > width + reach) continue;
      left = Math.min(left, xs[i]); right = Math.max(right, xs[i]); top = Math.min(top, ys[i]);
    }
  });
  left = Math.max(0, Math.floor(left - reach));
  right = Math.min(width, Math.ceil(right + reach));
  top = Math.max(0, Math.floor(top - reach));
  if (right <= left || top >= height) return { columns: 0, rows: 0, pixels: [] };
  ratio = Math.min(ratio, Math.sqrt(BUDGET / ((right - left) * (height - top))));
  const columns = Math.ceil((right - left) * ratio), rows = Math.ceil((height - top) * ratio);

  // Signed distance (positive inside) and inward normal on a coarse grid.
  const cell = CELL / ratio;
  const far = band + reach * .25 + cell * 2;
  const pad = Math.ceil((bend + cell) / cell);
  const gridX = left - pad * cell, gridY = top - pad * cell;
  const gridColumns = Math.ceil(columns / CELL) + pad * 2 + 1, gridRows = Math.ceil(rows / CELL) + pad * 2 + 1;
  const nodes = gridColumns * gridRows;
  const distance = new Float32Array(nodes * plates), normalX = new Float32Array(nodes * plates), normalY = new Float32Array(nodes * plates);
  edges.forEach(({ xs, ys }, plate) => {
    const last = xs.length - 2;
    let segment = 0, x = 0, y = 0, best = 0, nearX = 0, nearY = 0;
    const visit = s => {
      const ax = xs[s], ay = ys[s], bx = xs[s + 1] - ax, by = ys[s + 1] - ay;
      const t = clamp(((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by), 0, 1);
      const px = ax + bx * t - x, py = ay + by * t - y, square = px * px + py * py;
      if (square < best) { best = square; nearX = px; nearY = py; }
    };
    for (let i = 0; i < gridColumns; i += 1) {
      x = gridX + i * cell;
      while (segment < last && xs[segment + 1] < x) segment += 1;
      let low = Infinity, high = -Infinity;
      for (let s = segment; s >= 0 && xs[s + 1] > x - far; s -= 1) { low = Math.min(low, ys[s], ys[s + 1]); high = Math.max(high, ys[s], ys[s + 1]); }
      for (let s = segment; s <= last && xs[s] < x + far; s += 1) { low = Math.min(low, ys[s], ys[s + 1]); high = Math.max(high, ys[s], ys[s + 1]); }
      const curveY = ys[segment] + (ys[segment + 1] - ys[segment]) * (x - xs[segment]) / (xs[segment + 1] - xs[segment]);
      for (let j = 0; j < gridRows; j += 1) {
        y = gridY + j * cell;
        const index = plate * nodes + j * gridColumns + i;
        if (y > high + far) { distance[index] = far; continue; }
        if (y < low - far) { distance[index] = -far; continue; }
        // The point straight above or below bounds the search: nothing nearer lies further sideways.
        best = (y - curveY) * (y - curveY); nearX = 0; nearY = curveY - y;
        for (let s = segment; s >= 0 && (x - xs[s + 1]) * Math.abs(x - xs[s + 1]) < best; s -= 1) visit(s);
        for (let s = segment + 1; s <= last && (xs[s] - x) * Math.abs(xs[s] - x) < best; s += 1) visit(s);
        const length = Math.sqrt(best), sign = y > curveY ? 1 : -1;
        if (length >= far) { distance[index] = sign * far; continue; }
        distance[index] = sign * length;
        if (length > 1e-6) { normalX[index] = -sign * nearX / length; normalY[index] = -sign * nearY / length; }
        else normalY[index] = 1;
      }
    }
  });

  // A plate keeps its original tone on average: its veil is solved against the mean of what it covers.
  const census = new Float64Array(1 << plates);
  for (let j = 0; j < gridRows; j += 1) {
    const y = gridY + j * cell;
    if (y < 0 || y > height) continue;
    for (let i = 0; i < gridColumns; i += 1) {
      const x = gridX + i * cell;
      if (x < 0 || x > width) continue;
      let mask = 0;
      for (let plate = 0; plate < plates; plate += 1) if (distance[plate * nodes + j * gridColumns + i] > 0) mask |= 1 << plate;
      census[mask] += 1;
    }
  }
  const themes = palettes.map(({ page, fills }) => {
    const tone = (page[0] * .2126 + page[1] * .7152 + page[2] * .0722) > 128 ? TONES.pale : TONES.deep;
    const veils = [];
    const flat = (mask, upTo) => {
      const colour = [...page];
      for (let plate = 0; plate < upTo; plate += 1) if (mask >> plate & 1) for (let c = 0; c < 3; c += 1) colour[c] += (veils[plate][c] - colour[c]) * ALPHA[plate];
      return colour;
    };
    fills.forEach((fill, plate) => {
      const mean = [0, 0, 0];
      let total = 0;
      census.forEach((count, mask) => {
        if (!(mask >> plate & 1) || !count) return;
        const below = flat(mask, plate);
        for (let c = 0; c < 3; c += 1) mean[c] += below[c] * count;
        total += count;
      });
      veils.push(fill.map((value, c) => total ? clamp(mean[c] / total + (value - mean[c] / total) / ALPHA[plate], 0, 255) : value));
    });
    return { page, tone, veils, flats: Array.from(census, (count, mask) => flat(mask, plates)) };
  });

  const count = themes.length;
  const slots = count * 3;
  const pageColour = Float64Array.from(themes.flatMap(theme => theme.page));
  const veil = Float64Array.from(themes.flatMap(theme => theme.veils.flat()));
  const result = new Float64Array(slots * (plates + 1));
  const inverse = 1 / cell;
  let fieldDistance = 0, fieldX = 0, fieldY = 0;
  function field(plate, x, y) {
    const u = clamp((x - gridX) * inverse, 0, gridColumns - 1.001), v = clamp((y - gridY) * inverse, 0, gridRows - 1.001);
    const i = u | 0, j = v | 0, a = u - i, b = v - j;
    const o = plate * nodes + j * gridColumns + i, p = o + gridColumns;
    const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
    fieldDistance = distance[o] * w00 + distance[o + 1] * w10 + distance[p] * w01 + distance[p + 1] * w11;
    const nx = normalX[o] * w00 + normalX[o + 1] * w10 + normalX[p] * w01 + normalX[p + 1] * w11;
    const ny = normalY[o] * w00 + normalY[o + 1] * w10 + normalY[p] * w01 + normalY[p + 1] * w11;
    const length = Math.sqrt(nx * nx + ny * ny) || 1;
    fieldX = nx / length; fieldY = ny / length;
  }

  // Where text sits, rims keep their tint step but lose most of their light and shadow.
  let quiet = 1;
  function hush(x, y) {
    let near = MARGIN;
    for (const [x0, y0, x1, y1] of zones) near = Math.min(near, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)));
    quiet = REST + (1 - REST) * smooth(0, MARGIN, near);
  }

  // A plate's shadow falls away from the light, on whatever lies behind it.
  function shadow(at, d, lit, gain, { reach, shelter, drop, spread }) {
    if (d <= -reach || d >= shelter) return;
    const offset = Math.min(0, d - lit * drop) / spread;
    const amount = Math.exp(-.5 * offset * offset) * smooth(-reach, -reach * .55, d) * (1 - smooth(0, shelter, d)) * quiet;
    for (let k = 0; k < count; k += 1) {
      const { tone } = themes[k], cast = amount * gain * tone.cast;
      for (let c = 0; c < 3; c += 1) result[at + k * 3 + c] += (tone.shade[c] - result[at + k * 3 + c]) * cast;
    }
  }

  // Colour of the stack up to `level` plates at one point, written to result[at…] for every theme.
  // `blur` is the width the point stands for: a rim that squeezes its view passes a wider one down.
  function shade(level, x, y, at, blur) {
    if (!level) { for (let c = 0; c < slots; c += 1) result[at + c] = pageColour[c]; return; }
    const plate = level - 1, lens0 = optics[plate], { band, bend, unit, wall } = lens0;
    field(plate, x, y);
    const d = fieldDistance, nx = fieldX, ny = fieldY;
    if (d <= -lens0.reach - blur) { shade(plate, x, y, at, blur); return; }
    const lit = -(nx * LIGHT[0] + ny * LIGHT[1]);
    const cover = clamp(d / blur + .5, 0, 1);
    if (cover < 1) {
      shade(plate, x, y, at, blur);
      shadow(at, d, lit, 1, lens0);
      if (!cover) return;
    }
    const inner = cover < 1 ? at + slots : at;
    const t = d / band;
    let lens = 0;
    if (t < 1) {
      lens = Math.min(1, 1 - t);
      shade(plate, x - nx * bend * lens, y - ny * bend * lens, inner, blur * (1 + bend / band));
      shadow(inner, d - bend * lens, lit, .6, lens0);
    } else shade(plate, x, y, inner, blur);
    const up = lit > 0 ? lit : 0, down = lit < 0 ? -lit : 0, inside = d > 0 ? d : 0;
    const fine = Math.max(.8 * unit, blur * 1.2), soft = Math.max(.9 * unit, blur * .8);
    const up2 = up * up, up8 = up2 * up2 * up2 * up2, side = Math.max(0, LIGHT[1] * nx - LIGHT[0] * ny);
    const glare = Math.min(1, .2 + .45 * up2 + .6 * up8 + .3 * down * down + .25 * side * side);
    const hair = Math.exp(-inside * inside / (fine * fine)) * Math.sqrt(.8 * unit / fine) * glare;
    const face = d < wall + soft * 2 ? (1 - smooth(wall - soft, wall + soft, d)) * (.3 + .7 * glare) : 0;
    const notch = (d - wall) / soft, groove = Math.exp(-notch * notch) * .9 * unit / soft;
    const open = 1 - smooth(-20 * unit, 20 * unit, d - bend * lens), glow = lens * lens * lens * (.25 + .75 * glare);
    for (let k = 0; k < count; k += 1) {
      const { tone } = themes[k], base = inner + k * 3;
      const alpha = ALPHA[plate] * (1 - tone.clear * open);
      const dark = groove * tone.groove * quiet;
      const light = (hair * tone.hair + face * tone.face + glow * tone.glow) * quiet;
      for (let c = 0; c < 3; c += 1) {
        let value = result[base + c];
        value += (veil[(k * plates + plate) * 3 + c] - value) * alpha;
        value += (tone.shade[c] - value) * dark;
        result[base + c] = value + tone.light[c] * light;
      }
    }
    if (cover < 1) for (let c = 0; c < slots; c += 1) result[at + c] += (result[inner + c] - result[at + c]) * cover;
  }

  // Ordered noise hides the banding of slow ramps between near-identical tones.
  const noise = new Float32Array(4096);
  for (let i = 0; i < 4096; i += 1) {
    const value = 52.9829189 * ((.06711056 * (i & 63) + .00583715 * (i >> 6)) % 1);
    noise[i] = value - Math.floor(value) - .5;
  }
  const pixels = themes.map(() => new Uint8ClampedArray(columns * rows * 4));
  pixels.forEach(buffer => new Uint32Array(buffer.buffer).fill(0xff000000));
  for (let cj = 0; cj * CELL < rows; cj += 1) {
    for (let ci = 0; ci * CELL < columns; ci += 1) {
      let mask = 0, settled = true;
      for (let plate = 0; plate < plates && settled; plate += 1) {
        const o = plate * nodes + (cj + pad) * gridColumns + ci + pad, calm = optics[plate].band + cell, clear = -(optics[plate].reach + cell);
        const a = distance[o], b = distance[o + 1], c = distance[o + gridColumns], d = distance[o + gridColumns + 1];
        if (a >= calm && b >= calm && c >= calm && d >= calm) mask |= 1 << plate;
        else if (!(a <= clear && b <= clear && c <= clear && d <= clear)) settled = false;
      }
      const endX = Math.min(columns, ci * CELL + CELL), endY = Math.min(rows, cj * CELL + CELL);
      for (let py = cj * CELL; py < endY; py += 1) {
        for (let px = ci * CELL; px < endX; px += 1) {
          const grain = noise[(py & 63) << 6 | px & 63], index = (py * columns + px) * 4;
          if (!settled) {
            const x = left + (px + .5) / ratio, y = top + (py + .5) / ratio;
            hush(x, y);
            shade(plates, x, y, 0, 1 / ratio);
          }
          for (let k = 0; k < count; k += 1) {
            const buffer = pixels[k];
            if (settled) { const colour = themes[k].flats[mask]; buffer[index] = colour[0] + grain; buffer[index + 1] = colour[1] + grain; buffer[index + 2] = colour[2] + grain; }
            else { buffer[index] = result[k * 3] + grain; buffer[index + 1] = result[k * 3 + 1] + grain; buffer[index + 2] = result[k * 3 + 2] + grain; }
          }
        }
      }
    }
  }
  return { columns, rows, pixels, left: left / width, top: top / height, width: columns / ratio / width, height: rows / ratio / height };
}
