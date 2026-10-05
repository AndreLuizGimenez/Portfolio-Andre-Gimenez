'use strict';

// A transparent rounded lens displaces the actual backdrop; text stays above it.
(() => {
  const definitions = document.querySelector('#glass-lenses');
  if (!definitions || !('ResizeObserver' in window)) return;
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

    function update() {
      frame = 0;
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      if (!width || !height || `${width}/${height}` === previousSize) return;
      previousSize = `${width}/${height}`;
      const ratio = 2;
      const radius = Math.min(width, height) / 2;
      // The band occupies most of the curved side, while the centre stays optically neutral.
      const band = Math.min(36, radius * .83);
      const sampleWidth = width + padding * 2;
      const sampleHeight = height + padding * 2;
      const displacementMap = document.createElement('canvas');
      displacementMap.width = sampleWidth * ratio;
      displacementMap.height = sampleHeight * ratio;
      reflection.width = width * ratio;
      reflection.height = height * ratio;
      const context = displacementMap.getContext('2d');
      const reflectionContext = reflection.getContext('2d');
      if (!context || !reflectionContext) return;
      const pixels = context.createImageData(displacementMap.width, displacementMap.height);
      const light = reflectionContext.createImageData(reflection.width, reflection.height);
      for (let y = 0; y < displacementMap.height; y += 1) {
        for (let x = 0; x < displacementMap.width; x += 1) {
          const px = (x + .5) / ratio - sampleWidth / 2;
          const py = (y + .5) / ratio - sampleHeight / 2;
          const qx = Math.abs(px) - (width / 2 - radius);
          const qy = Math.abs(py) - (height / 2 - radius);
          const cx = Math.max(qx, 0), cy = Math.max(qy, 0);
          const corner = Math.hypot(cx, cy);
          const distance = radius - corner - Math.min(Math.max(qx, qy), 0);
          let nx = 0, ny = 0;
          if (corner > 0) { nx = cx / corner; ny = cy / corner; }
          else if (qx > qy) nx = 1;
          else ny = 1;
          nx *= Math.sign(px);
          ny *= Math.sign(py);
          const influence = distance >= 0 && distance < band ? 1 - distance / band : 0;
          const i = (y * displacementMap.width + x) * 4;
          pixels.data[i] = Math.round(127.5 + nx * influence * 127.5);
          pixels.data[i + 1] = Math.round(127.5 + ny * influence * 127.5);
          pixels.data[i + 2] = 128;
          pixels.data[i + 3] = 255;
          const rx = x - padding * ratio;
          const ry = y - padding * ratio;
          if (distance < 0 || distance > band || rx < 0 || ry < 0 || rx >= reflection.width || ry >= reflection.height) continue;
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
      }
      context.putImageData(pixels, 0, 0);
      reflectionContext.putImageData(light, 0, 0);
      filter.setAttribute('x', '-32');
      filter.setAttribute('y', '-32');
      filter.setAttribute('width', String(sampleWidth + 64));
      filter.setAttribute('height', String(sampleHeight + 64));
      map.setAttribute('width', String(sampleWidth));
      map.setAttribute('height', String(sampleHeight));
      map.setAttribute('href', displacementMap.toDataURL());
      displacement.setAttribute('scale', String(Math.min(26, band * 1.15)));
      if (supportsSvgBackdrop) {
        element.style.setProperty('--lens-filter', `url(#${filter.id})`);
        element.classList.add('has-lens');
      }
    }
    new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(update); }).observe(element);
    update();
  });
})();
