// The picture of one backdrop, a pixel at a time: every shape is a sheet of clear liquid with a thick rounded
// rim that bends, tints and lights the image of everything behind it, and the pane over them is one more piece
// of glass. Lengths are CSS pixels; colours are 0…255, as the stylesheet writes them.

export const vertex = `#version 300 es
void main() { gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4. - 1., 0., 1.); }`;

// One plate over the stack below it. `blur` is the width the point stands for: a rim that squeezes its view
// passes a wider one down. `quiet` dims the light and shadow of rims that lie under text.
const level = plate => `
vec3 level${plate + 1}(vec2 p, float blur, float quiet) {
  vec4 lens = uLens[${plate}], fall = uCast[${plate}];
  vec4 at = field(${plate}, p);
  float d = at.x;
  if (d <= -lens.w - blur) return level${plate}(p, blur, quiet);
  vec2 n = at.yz;
  float lit = -dot(n, uLight);
  // The rim is a rounded shoulder, widest where the swell stands highest. It has no thickness at the outline,
  // so the view through it starts unbent, reaches furthest inside a third of the way in and settles again:
  // whatever passes behind is squeezed against the outline, then stretched, and never torn.
  float band = lens.x * (1. - uFlow.x * (.5 - .5 * at.w));
  float t = clamp(d / band, 0., 1.), u = 1. - t, body = 1. - u * u;
  vec4 swell = uSwell[${plate * 2}];
  float roll = cos(dot(p, uRoll[${plate}].xy) - uTime * swell.z + swell.w) * body;
  vec2 look = p + n * (lens.y * band * t * u * u) + uRoll[${plate}].zw * (roll * uFlow.y);
  vec3 colour = level${plate}(look, blur * (1. + lens.y * max(0., u * (1. - 3. * t))), quiet);
  float cover = clamp(d / blur + .5, 0., 1.);
  vec3 bare = cover < 1. ? shadow(colour, d, lit, lens, fall, quiet) : colour;
  if (cover <= 0.) return bare;
  // Over its own tint a plate deepens toward the outline, where the shoulder is seen at a slant, as the edge
  // of any thick glass does.
  vec4 veil = uVeil[${plate}];
  float tilt = u * u;
  colour = mix(colour, veil.rgb, veil.a);
  colour = mix(colour, uRim.rgb, uRim.a * tilt * u * quiet);
  // Light on the shoulder: a fine line in a soft lobe, lying where the slope sends the light back and so
  // sliding across the rim as the edge turns; a fainter one where the light leaves through the far side.
  float up = max(lit, 0.), down = max(-lit, 0.), up2 = up * up;
  float near = tilt - NEAR * max(up, .4), far = tilt - FAR * down;
  float lobe = SOFT * (DIM + up2) * exp(-near * near * 70.) + up2 * up2 * up2 * quiet * exp(-near * near * 700.);
  float glow = lobe * uTone.x + down * down * exp(-far * far * 60.) * uTone.z + tilt * up * uTone.y + roll * uFlow.z;
  colour = mix(colour, uShade, tilt * down * uTone.w * quiet);
  colour += uGlint * (glow * quiet);
  return cover < 1. ? mix(bare, colour, cover) : colour;
}`;

export const fragment = (plates, columns) => `#version 300 es
precision highp float;
precision highp sampler2D;

uniform vec2 uView;               // size of the backdrop
uniform float uRatio;             // canvas pixels per CSS pixel
uniform vec2 uScale;              // CSS pixels per unit of the drawing
uniform sampler2D uEdges;         // height and slope of each edge, a row per plate
uniform vec3 uSpan[${plates}];    // where a row starts, its columns per unit, and the side of the edge its plate lies on
uniform vec4 uLens[${plates}];    // rim width, how hard it bends, unit of detail, shadow reach
uniform vec4 uCast[${plates}];    // shadow spread, drop and shelter
uniform vec4 uVeil[${plates}];    // tint of a plate and how much of it shows
uniform vec4 uSwell[${plates * 2}]; // amplitude, wavenumber, angular speed, phase
uniform vec4 uDrift[${plates}];   // the whole plate: sideways shift, lift; minus one over the height of its swell
uniform vec4 uRoll[${plates}];    // the swell across the body of a plate: its wave vector, and the way it bends the view
uniform vec3 uFlow;               // breathing of a rim, sway of the view through a body, light on its swell
uniform float uTime;
uniform vec2 uLight;              // toward the light
uniform vec3 uPage, uGlint, uShade;
uniform vec4 uTone;               // lobe, fall of light, far lobe, fall of shade
uniform vec4 uRim;                // colour a plate deepens to at its outline, and how far
uniform float uDepth;             // weight of a plate's shadow
uniform vec4 uPane;               // centre and half size
uniform vec4 uPaneLens;           // corner radius, rim width, bend, presence
uniform vec2 uPaneVeil;           // how far the pane draws what is behind it toward the page; light in its rim
uniform vec4 uPaneTone;           // hairline, tint of the rim, shade, shadow
uniform vec2 uPaneLine;           // dark thread along the outline; spread of colours in the rim
uniform float uRest;              // share of the rim optics left under a pane's text
out vec4 result;

const float LEE = .4;             // share of a plate's shadow left on the side that faces the light
const float NEAR = .46, FAR = .3; // slopes of a rim (1 at its outline) that send the light back, and let it through
const float SOFT = .4;            // the soft body of a lobe, against the fine line in it
const float DIM = .25;            // share of that body left on a rim that faces away from the light

// Height and slope of an edge at x, with its swell; then where the swell stands, from trough (-1) to crest (1).
vec3 edge(int plate, float x) {
  vec4 drift = uDrift[plate];
  float u = ((x - drift.x) / uScale.x - uSpan[plate].x) * uSpan[plate].y;
  float c = clamp(u, 0., ${columns - 1}. - .001);
  int i = int(c);
  vec2 v = mix(texelFetch(uEdges, ivec2(i, plate), 0).rg, texelFetch(uEdges, ivec2(i + 1, plate), 0).rg, c - float(i));
  v.x += v.y * (u - c) / uSpan[plate].y;   // straight on beyond both ends
  v *= vec2(uScale.y, uScale.y / uScale.x);
  float rise = 0.;
  for (int s = 0; s < 2; s += 1) {
    vec4 swell = uSwell[plate * 2 + s];
    float a = x * swell.y - uTime * swell.z + swell.w;
    float lift = swell.x * sin(a);
    v += vec2(lift, swell.x * swell.y * cos(a));
    rise += lift;
  }
  v.x += drift.y;
  return vec3(v, rise * drift.w);
}

// Signed distance to an edge (positive inside the plate, which lies below it or, for a side of -1, above it),
// the inward normal, the swell.
vec4 field(int plate, vec2 p) {
  vec3 e = edge(plate, p.x);
  float slant = inversesqrt(1. + e.y * e.y);
  vec2 n = vec2(-e.y, 1.) * slant;
  float d = (p.y - e.x) * slant;
  // Far from the edge only the side matters. Near it, the closest point lies along the normal rather than
  // straight above: two steps toward it, none longer than the rim is wide.
  float near = uLens[plate].x * 1.6;
  float side = uSpan[plate].z;
  if (abs(d) > near) return vec4(d * side, n * side, e.z * side);
  float x = p.x;
  for (int step = 0; step < 2; step += 1) {
    x += clamp(((p.x - x) + (p.y - e.x) * e.y) * slant * slant, -near, near);
    e = edge(plate, x);
    slant = inversesqrt(1. + e.y * e.y);
  }
  n = vec2(-e.y, 1.) * slant;
  return vec4(dot(p - vec2(x, e.x), n) * side, n * side, e.z * side);
}

// A plate's shadow falls away from the light, on whatever lies behind it.
vec3 shadow(vec3 colour, float d, float lit, vec4 lens, vec4 fall, float quiet) {
  if (d <= -lens.w || d >= fall.z) return colour;
  float offset = min(0., d - lit * fall.y) / fall.x;
  float amount = exp(-.5 * offset * offset) * smoothstep(-lens.w, -lens.w * .55, d) * (1. - smoothstep(0., fall.z, d)) * quiet;
  // Clear glass keeps little of the light from what it lies on: a full shadow only on the side away from it.
  return mix(colour, uShade, amount * uDepth * (LEE + (1. - LEE) * smoothstep(.35, -.45, lit)));
}

vec3 level0(vec2 p, float blur, float quiet) { return uPage; }
${Array.from({ length: plates }, (_, plate) => level(plate)).join('\n')}

// Signed distance to the pane's outline (positive inside) and the inward normal.
vec3 outline(vec2 p) {
  vec2 c = p - uPane.xy, q = abs(c) - (uPane.zw - uPaneLens.x), m = max(q, 0.);
  float corner = length(m);
  vec2 n = corner > 0. ? m / corner : q.x > q.y ? vec2(1., 0.) : vec2(0., 1.);
  return vec3(uPaneLens.x - corner - min(max(q.x, q.y), 0.), -n * sign(c));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uRatio - gl_FragCoord.y) / uRatio;
  float blur = 1. / uRatio, on = uPaneLens.w;
  vec3 colour;
  if (on <= 0.) colour = level${plates}(p, blur, 1.);
  else {
    vec3 at = outline(p);
    float d = at.x, band = uPaneLens.y, reach = band * 1.6;
    vec2 n = at.yz;
    float cover = clamp(d / blur + .5, 0., 1.);
    float lit = -dot(n, uLight), up = max(lit, 0.), down = max(-lit, 0.);
    float glare = min(1., .16 + .84 * up * up + .5 * down * down * down);
    vec3 outer = vec3(0.);
    if (cover < 1.) {
      outer = level${plates}(p, blur, 1.);
      if (d > -reach) {
        // The pane's own shadow, heavier on the side away from the light, and a dark thread along its outline.
        float fall = smoothstep(-reach, 0., d);
        outer = mix(outer, uShade, fall * fall * (.35 + .65 * down) * uPaneTone.w * on);
        outer = mix(outer, uShade, exp(-d * d / (blur * blur * 1.4)) * uPaneLine.x * .5 * on);
      }
    }
    if (cover > 0.) {
      // Text sits past the rim: from its inner border on, the plates behind keep their step of tone and little else.
      float quiet = mix(1., uRest, smoothstep(band * .4, band, d) * on);
      float t = clamp(d / band, 0., 1.), bent = 1. - t;
      if (bent > 0.) {
        // A thick convex rim magnifies: the whole band looks at a thin strip along its inner border and draws
        // it out across itself, each colour a little differently. The view is as wide as the colours are apart,
        // so an edge behind the rim opens into one soft fringe.
        vec2 inward = n * (band * uPaneLens.z * bent * on);
        float split = uPaneLine.y, wide = max(blur, 2. * split * band * uPaneLens.z * bent);
        colour = vec3(level${plates}(p + inward * (1. - split), wide, quiet).r, level${plates}(p + inward, wide, quiet).g, level${plates}(p + inward * (1. + split), wide, quiet).b);
      } else colour = level${plates}(p, blur, quiet);
      bent *= bent;
      // The pane is clear: it only draws what lies behind a little toward the page, which keeps the text on
      // it readable and leaves the bare page untouched. Its thickness shows as a breath of tint in the rim.
      float fine = max(.75, blur * 1.2), inside = max(d, 0.);
      float hair = exp(-inside * inside / (fine * fine)) * (.3 + .7 * glare);
      colour = mix(colour, uPage, uPaneVeil.x * on * (1. - .6 * bent));
      colour = mix(colour, uRim.rgb, bent * uPaneTone.y * on);
      colour = mix(colour, uShade, bent * down * down * uPaneTone.z * on);
      colour += uGlint * ((hair * uPaneTone.x + bent * bent * glare * uPaneVeil.y) * on);
      if (cover < 1.) colour = mix(outer, colour, cover);
    } else colour = outer;
  }
  // Ordered noise hides the banding of slow ramps between near-identical tones.
  float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(.06711056, .00583715)))) - .5;
  result = vec4((colour + grain) / 255., 1.);
}`;
