'use strict';

// Rounded lens maps bend the backdrop at the rim; foreground content stays sharp.
(() => {
  // Other engines retain the CSS glass treatment until SVG backdrop lenses work there.
  if (!/Chrome|Chromium|Edg\//.test(navigator.userAgent) || !('ResizeObserver' in window)
    || !CSS.supports('backdrop-filter', 'url(#lens)')) return;
  const definitions = document.querySelector('#glass-lenses');
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const surfaces = new Map();
  const pending = new Set();
  let nextFrame = 0;

  function svgElement(name, attributes) {
    const node = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function updateLens(element) {
    const lens = surfaces.get(element);
    const width = Math.round(element.offsetWidth), height = Math.round(element.offsetHeight);
    if (!width || !height || (width === lens.width && height === lens.height)) return;
    lens.width = width; lens.height = height;
    const ratio = Math.min(1, 768 / width, 768 / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    const bitmap = context.createImageData(canvas.width, canvas.height);
    const style = getComputedStyle(element);
    const radiusValue = style.borderTopLeftRadius;
    const radius = Math.min(width / 2, height / 2, parseFloat(radiusValue) * (radiusValue.includes('%') ? Math.min(width, height) / 100 : 1));
    const rim = Math.min(20, Math.max(9, height * .23));
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const px = (x + .5) / ratio - width / 2;
        const py = (y + .5) / ratio - height / 2;
        const qx = Math.abs(px) - (width / 2 - radius);
        const qy = Math.abs(py) - (height / 2 - radius);
        const cx = Math.max(qx, 0), cy = Math.max(qy, 0);
        const cornerDistance = Math.hypot(cx, cy);
        const distance = radius - cornerDistance - Math.min(Math.max(qx, qy), 0);
        let nx = 0, ny = 0;
        if (cornerDistance) { nx = cx / cornerDistance; ny = cy / cornerDistance; }
        else if (qx > qy) nx = 1;
        else ny = 1;
        const bend = distance > 0 && distance < rim ? Math.sin(Math.PI * distance / rim) : 0;
        const offset = (y * canvas.width + x) * 4;
        bitmap.data[offset] = Math.round(127.5 - Math.sign(px) * nx * bend * 127.5);
        bitmap.data[offset + 1] = Math.round(127.5 - Math.sign(py) * ny * bend * 127.5);
        bitmap.data[offset + 2] = 128;
        bitmap.data[offset + 3] = 255;
      }
    }
    context.putImageData(bitmap, 0, 0);
    lens.filter.setAttribute('width', width);
    lens.filter.setAttribute('height', height);
    lens.map.setAttribute('width', width);
    lens.map.setAttribute('height', height);
    lens.map.setAttribute('href', canvas.toDataURL());
    lens.displacement.setAttribute('scale', Math.min(16, rim * .8));
    lens.layer.style.setProperty('--lens-filter', `url(#${lens.filter.id})`);
    element.classList.add('has-lens');
  }

  const observer = new ResizeObserver(entries => {
    entries.forEach(entry => pending.add(entry.target));
    if (nextFrame) return;
    nextFrame = requestAnimationFrame(() => {
      nextFrame = 0;
      pending.forEach(updateLens);
      pending.clear();
    });
  });
  document.querySelectorAll('.glass-surface').forEach((element, index) => {
    const filter = svgElement('filter', {
      id: `glass-lens-${index}`, x: 0, y: 0, filterUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    const map = svgElement('feImage', { result: 'lens', preserveAspectRatio: 'none' });
    const displacement = svgElement('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'lens', xChannelSelector: 'R', yChannelSelector: 'G', scale: 12,
    });
    filter.append(map, displacement);
    definitions.append(filter);
    const layer = document.createElement('span');
    layer.className = 'glass-optics';
    layer.setAttribute('aria-hidden', 'true');
    element.prepend(layer);
    surfaces.set(element, { filter, map, displacement, layer, width: 0, height: 0 });
    observer.observe(element);
  });
})();
