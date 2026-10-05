/* Liga a peça 3D ativa à descrição por uma linha SVG.
 * Mede a geometria do layout em mudanças de tamanho e recebe a âncora projetada da cena a cada atualização. */
import { isCompactStory } from './story-layout';
import type { ProjectedAnchor } from './pillow/anchors';

/** One decorative leader line; no React updates or independent animation loop. */
export function createStoryCallout(section: HTMLElement, host: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('.story-content')!;
  const steps = section.querySelector<HTMLElement>('.story-steps')!;
  const chapters = Array.from(steps.querySelectorAll<HTMLElement>('.story-chapter'));
  const svg = section.querySelector<SVGSVGElement>('.story-callout')!;
  const paths = Array.from(svg.querySelectorAll('path'));
  const target = svg.querySelector<SVGGElement>('.story-callout-target')!;
  const number = target.querySelector<SVGTextElement>('.story-callout-number')!;
  let layout: { width: number; height: number; hostX: number; hostY: number; hostW: number; hostH: number; x: number; y: number; textRight: number; indexOffset: number; backgroundBottom: number; descriptionHeight: number; captionLift: number; compact: boolean; chapter: number };
  let last: ProjectedAnchor | undefined, prior = -1, disposed = false;
  function measure(chapterIndex = last?.chapter ?? 0) {
    const bounds = stage.getBoundingClientRect(), scene = host.getBoundingClientRect(), text = steps.getBoundingClientRect();
    const description = chapters[chapterIndex]?.querySelector<HTMLElement>('.chapter-description');
    const descriptionBounds = description?.getBoundingClientRect();
    const label = chapters[chapterIndex]?.querySelector<HTMLElement>('.layer-number');
    const labelBounds = label?.getBoundingClientRect();
    // Cache the resting geometry, even if the scene loads during its entrance.
    const entryY = Number.parseFloat(getComputedStyle(host).translate.split(' ')[1] ?? '0') || 0;
    const textEntryY = Number.parseFloat(getComputedStyle(steps).translate.split(' ')[1] ?? '0') || 0;
    const compact = isCompactStory();
    layout = {
      width: bounds.width, height: bounds.height,
      hostX: scene.left - bounds.left, hostY: scene.top - bounds.top - entryY, hostW: scene.width, hostH: scene.height,
      // Join the material name to the matching numbered pin on the product.
      x: (compact ? (labelBounds?.left ?? text.left) - 10 : (labelBounds?.right ?? text.right) + 12) - bounds.left,
      y: (labelBounds ? labelBounds.top + labelBounds.height / 2 : text.top) - bounds.top - textEntryY,
      textRight: text.right - bounds.left + 22,
      indexOffset: (descriptionBounds?.top ?? text.top) - (labelBounds ? labelBounds.top + labelBounds.height / 2 : text.top),
      backgroundBottom: text.bottom - bounds.top - textEntryY,
      descriptionHeight: descriptionBounds?.height ?? 0,
      captionLift: Number.parseFloat(getComputedStyle(steps).getPropertyValue('--story-caption-lift')) || 0,
      compact, chapter: chapterIndex,
    };
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  }
  function update(anchor: ProjectedAnchor) {
    if (disposed) return;
    last = anchor;
    if (!layout) measure();
    if (!layout || layout.chapter !== anchor.chapter) measure(anchor.chapter);
    const { x, compact, hostX, hostY, hostW, hostH, width, height } = layout;
    // Follow the same caption midpoint with cached dimensions. No layout
    // reads are needed while the product opens or closes.
    const y = compact && anchor.pillowBottom !== undefined
      ? (hostY + anchor.pillowBottom * hostH + layout.backgroundBottom - layout.descriptionHeight) / 2 - layout.captionLift - layout.indexOffset
      : layout.y;
    const tx = hostX + anchor.x * hostW, ty = hostY + anchor.y * hostH;
    const visible = anchor.visible && tx > 16 && tx < width - 16 && ty > 16 && ty < height - 16;
    svg.classList.toggle('has-target', visible);
    if (!visible) return;
    const f = (v: number) => v.toFixed(2);
    // A single soft curve replaces the long bracket along the screen edge.
    // End under the pin so the connector never reads as a second target.
    const d = compact
      ? `M ${f(x)} ${f(y)} C ${f(Math.max(18, x - 36))} ${f(y)}, ${f(Math.max(18, tx - 28))} ${f(ty + 36)}, ${f(tx)} ${f(ty)}`
      : `M ${f(x)} ${f(y)} L ${f(layout.textRight)} ${f(y)} C ${f(layout.textRight + 40)} ${f(y)}, ${f(tx - 48)} ${f(ty)}, ${f(tx)} ${f(ty)}`;
    paths.forEach(path => { if (path.getAttribute('d') !== d) path.setAttribute('d', d); });
    const transform = `translate(${f(tx)} ${f(ty)})`;
    if (target.getAttribute('transform') !== transform) target.setAttribute('transform', transform);
    if (anchor.chapter !== prior) {
      svg.dataset.chapter = String(anchor.chapter);
      number.textContent = String(anchor.chapter + 1).padStart(2, '0');
      for (const path of paths) {
        path.getAnimations().forEach(animation => animation.cancel());
        path.animate([{ strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 420, easing: 'ease-out' });
      }
      target.getAnimations().forEach(animation => animation.cancel());
      target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 100, fill: 'backwards' });
      prior = anchor.chapter;
    }
  }
  const observer = new ResizeObserver(() => { measure(); if (last) update(last); });
  [stage, host, steps, ...chapters.flatMap(chapter => Array.from(chapter.querySelectorAll<HTMLElement>('.chapter-description')))].forEach(element => observer.observe(element));
  return {
    update,
    // Cancela observadores/animações e libera os recursos pertencentes a este módulo; necessário ao desmontar ou recriar.
    dispose() {
      disposed = true; observer.disconnect();
      svg.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      svg.classList.remove('has-target');
    },
  };
}
