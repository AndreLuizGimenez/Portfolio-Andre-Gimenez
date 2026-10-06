'use strict';

// The flat backdrop shapes are redrawn as stacked glass plates. A worker renders
// one bitmap per theme for each backdrop; the SVG underneath stays as the fallback.
(() => {
  if (!window.Worker || !window.createImageBitmap || !window.ImageBitmapRenderingContext || !window.ResizeObserver) return;
  const source = new URL('backdrop-worker.js?v=5', document.currentScript.src);
  const names = ['day', 'night'];
  const grounds = { '.site-backdrop': '--paper', '.project-backdrop': '--stage' };

  // Both palettes are read from the stylesheet, so a theme change never waits for a render.
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
  const ink = document.createElement('canvas').getContext('2d');
  // A value the canvas cannot read as an opaque colour leaves the marker in place.
  const rgb = value => {
    ink.fillStyle = '#010203';
    ink.fillStyle = (value || '').trim();
    const hex = ink.fillStyle;
    return hex === '#010203' || hex[0] !== '#' ? null : [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  };

  const backdrops = Object.entries(grounds).map(([selector, ground]) => {
    const element = document.querySelector(selector);
    const svg = element?.querySelector('svg');
    if (!svg) return null;
    const paths = [...svg.querySelectorAll('path')];
    const palettes = variables.map(set => ({ page: rgb(set[ground]), fills: paths.map(path => rgb(set[`--${path.classList[0]}`])) }));
    // Without every colour the flat shapes are the honest picture.
    if (palettes.some(({ page, fills }) => !page || fills.includes(null))) return null;
    const glass = document.createElement('div');
    glass.className = 'backdrop-glass';
    const canvases = names.map(name => {
      const canvas = document.createElement('canvas');
      canvas.className = `glass-${name}`;
      glass.append(canvas);
      return canvas;
    });
    element.append(glass);
    // The flat shapes stop painting once the glass covers them.
    glass.addEventListener('transitionend', event => { if (event.target === glass) element.classList.add('has-glass'); });
    return {
      element, glass, canvases, palettes,
      section: element.parentElement,
      box: [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height],
      // Each shape is the area under its curve: the closing lines lie outside the view.
      curves: paths.map(path => path.getAttribute('d').split('L')[0].match(/-?[\d.]+/g).map(Number)),
    };
  }).filter(Boolean);
  if (!backdrops.length) return;

  // Where each line of text lies over its backdrop, from layout alone: entrance transforms do not count.
  const zones = ({ section }) => [...section.querySelectorAll('h1, h2, p, li')].filter(node => node.offsetWidth > 8).map(node => {
    let x = 0, y = 0;
    for (let at = node; at && at !== section; at = at.offsetParent) { x += at.offsetLeft; y += at.offsetTop; }
    return [x, y, x + node.offsetWidth, y + node.offsetHeight];
  });

  let worker, drawn = '';
  function render() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const sizes = backdrops.map(({ element }) => [element.clientWidth, element.clientHeight]);
    const texts = backdrops.map(zones);
    const state = `${sizes}/${ratio}/${texts}`;
    if (state === drawn) return;
    drawn = state;
    // A result for the previous size is no longer wanted.
    worker?.terminate();
    let current;
    try { current = worker = new Worker(source); } catch { return; }
    current.onerror = () => current.terminate();
    let pending = 0;
    backdrops.forEach(({ box, curves, palettes }, key) => {
      const [width, height] = sizes[key];
      if (!width || !height) return;
      pending += 1;
      current.postMessage({ key, width, height, ratio, box, curves, palettes, zones: texts[key] });
    });
    if (!pending) current.terminate();
    current.onmessage = ({ data }) => {
      const { glass, canvases } = backdrops[data.key];
      data.bitmaps.forEach((bitmap, index) => {
        canvases[index].width = data.columns;
        canvases[index].height = data.rows;
        canvases[index].getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
      });
      Object.assign(glass.style, { left: `${data.left * 100}%`, top: `${data.top * 100}%`, width: `${data.width * 100}%`, height: `${data.height * 100}%` });
      glass.classList.add('is-drawn');
      pending -= 1;
      if (!pending) current.terminate();
    };
  }

  // A window being dragged reports a new size every frame, and a worker cannot be stopped
  // mid-render: only the size it comes to rest on is drawn. The old bitmap stretches meanwhile.
  let timer;
  const settle = () => { clearTimeout(timer); timer = setTimeout(render, 160); };
  const observer = new ResizeObserver(() => drawn ? settle() : render());
  backdrops.forEach(({ element }) => observer.observe(element));
  // Moving to a screen of another density changes no size, so nothing else would notice.
  const density = () => matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => { density(); settle(); }, { once: true });
  density();
})();
