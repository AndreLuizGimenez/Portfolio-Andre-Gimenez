// A transparent rounded lens displaces the actual backdrop; text stays above it. Returns a promise that settles
// once every lens has been made; `eager` makes them all now, rather than waiting for the page to be idle.
export function initGlass({ eager = false } = {}) {
  const definitions = document.querySelector('#glass-lenses');
  if (!definitions || !('ResizeObserver' in window)) return Promise.resolve();
  const made = [];
  const supportsSvgBackdrop = /Chrome|Chromium|Edg\//.test(navigator.userAgent)
    && CSS.supports('backdrop-filter', 'url(#glass-lens)');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = (name, attributes) => {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  document.querySelectorAll('.selection-lens').forEach((element, index) => {
    const padding = 24;
    // Capture beyond the lens before clipping the output to its rounded body.
    // Otherwise displacement can sample an empty rectangle at the curved corners.
    const backdrop = document.createElement('span');
    backdrop.className = 'lens-backdrop';
    element.append(backdrop);
    const reflection = document.createElement('canvas');
    reflection.className = 'lens-reflection';
    reflection.setAttribute('aria-hidden', 'true');
    element.append(reflection);
    const filter = svg('filter', {
      id: `glass-lens-${index}`, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    const softBackdrop = svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '.25', result: 'soft-backdrop' });
    const map = svg('feImage', { result: 'lens-map', preserveAspectRatio: 'none', x: 0, y: 0 });
    const displacement = svg('feDisplacementMap', {
      in: 'soft-backdrop', in2: 'lens-map', xChannelSelector: 'R', yChannelSelector: 'G', scale: 24,
    });
    filter.append(softBackdrop, map, displacement);
    definitions.append(filter);
    let previousSize = '';
    let frame = 0;
    let drawn = 0;
    let mapUrl = '';
    let finish;
    made.push(new Promise(resolve => { finish = resolve; }));

    function update() {
      frame = 0;
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      if (!width || !height || `${width}/${height}` === previousSize) { finish(); return; }
      previousSize = `${width}/${height}`;
      const ratio = 2;
      const radius = Math.min(width, height) / 2;
      // The band occupies most of the curved side, while the centre stays optically neutral.
      const band = Math.min(36, radius * .83);
      const sampleWidth = width + padding * 2;
      const sampleHeight = height + padding * 2;
      // The map is only read where the backdrop can be refracted through SVG; elsewhere the rim's light is all.
      const displacementMap = supportsSvgBackdrop ? document.createElement('canvas') : null;
      const mapWidth = sampleWidth * ratio, mapHeight = sampleHeight * ratio;
      if (displacementMap) Object.assign(displacementMap, { width: mapWidth, height: mapHeight });
      reflection.width = width * ratio;
      reflection.height = height * ratio;
      const context = displacementMap?.getContext('2d');
      const reflectionContext = reflection.getContext('2d');
      if ((displacementMap && !context) || !reflectionContext) { finish(); return; }
      const pixels = context?.createImageData(mapWidth, mapHeight);
      const light = reflectionContext.createImageData(reflection.width, reflection.height);
      const edge = padding * ratio, innerX = width / 2 - radius, innerY = height / 2 - radius;
      function paint(x, y, nx, ny, distance, influence) {
        if (pixels) {
          const i = (y * mapWidth + x) * 4;
          pixels.data[i] = Math.round(127.5 + nx * influence * 127.5);
          pixels.data[i + 1] = Math.round(127.5 + ny * influence * 127.5);
          pixels.data[i + 2] = 128;
          pixels.data[i + 3] = 255;
        }
        const rx = x - edge;
        const ry = y - edge;
        if (distance < 0 || distance > band || rx < 0 || ry < 0 || rx >= reflection.width || ry >= reflection.height) return;
        // Fresnel/specular light on the curved rim, no painted fill in the centre.
        const facingLight = Math.max(0, -.55 * nx - .83 * ny);
        const edgeLight = Math.exp(-distance / 1.1) * (.13 + facingLight * .48);
        const wideLight = influence * influence * (.015 + facingLight * .045);
        const alpha = Math.min(.62, edgeLight + wideLight);
        const reflectionIndex = (ry * reflection.width + rx) * 4;
        light.data[reflectionIndex] = 245;
        light.data[reflectionIndex + 1] = 252;
        light.data[reflectionIndex + 2] = 255;
        light.data[reflectionIndex + 3] = Math.round(alpha * 255);
      }
      // The outline is symmetric: one quadrant of it serves all four, the normal only changing sign.
      for (let y = mapHeight / 2; y < mapHeight; y += 1) {
        for (let x = mapWidth / 2; x < mapWidth; x += 1) {
          const qx = (x + .5) / ratio - sampleWidth / 2 - innerX;
          const qy = (y + .5) / ratio - sampleHeight / 2 - innerY;
          const cx = qx > 0 ? qx : 0, cy = qy > 0 ? qy : 0;
          const corner = Math.sqrt(cx * cx + cy * cy);
          const distance = radius - corner - Math.min(Math.max(qx, qy), 0);
          let nx = 0, ny = 0;
          if (corner > 0) { nx = cx / corner; ny = cy / corner; }
          else if (qx > qy) nx = 1;
          else ny = 1;
          const influence = distance >= 0 && distance < band ? 1 - distance / band : 0;
          const mirrorX = mapWidth - 1 - x, mirrorY = mapHeight - 1 - y;
          paint(x, y, nx, ny, distance, influence);
          paint(mirrorX, y, -nx, ny, distance, influence);
          paint(x, mirrorY, nx, -ny, distance, influence);
          paint(mirrorX, mirrorY, -nx, -ny, distance, influence);
        }
      }
      reflectionContext.putImageData(light, 0, 0);
      if (!displacementMap) { finish(); return; }
      context.putImageData(pixels, 0, 0);
      // Encoded off the critical path; the lens refracts once its map is in place.
      const run = ++drawn;
      displacementMap.toBlob(blob => {
        if (!blob || run !== drawn) { finish(); return; }
        const previous = mapUrl;
        mapUrl = URL.createObjectURL(blob);
        filter.setAttribute('x', '-32');
        filter.setAttribute('y', '-32');
        filter.setAttribute('width', String(sampleWidth + 64));
        filter.setAttribute('height', String(sampleHeight + 64));
        map.setAttribute('width', String(sampleWidth));
        map.setAttribute('height', String(sampleHeight));
        map.setAttribute('href', mapUrl);
        displacement.setAttribute('scale', String(Math.min(26, band * 1.15)));
        element.style.setProperty('--lens-filter', `url(#${filter.id})`);
        element.classList.add('has-lens');
        if (previous) URL.revokeObjectURL(previous);
        finish();
      });
    }
    // A lens nobody can see yet, in a section further on or still waiting to enter, is made when the page is
    // idle, unless the page is preparing everything now. Until it is first made, changes of size have nothing
    // to redo.
    let started = false;
    const make = () => { started = true; update(); };
    new ResizeObserver(() => { if (started && !frame) frame = requestAnimationFrame(update); }).observe(element);
    const hidden = element.closest('.panel:not(.is-current)') || getComputedStyle(element.closest('.switch-stage') || element).opacity === '0';
    if (hidden && !eager) (window.requestIdleCallback || (run => setTimeout(run, 300)))(make, { timeout: 1500 });
    else make();
  });
  return Promise.all(made);
}
