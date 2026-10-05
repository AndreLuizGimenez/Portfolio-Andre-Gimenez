'use client';
import { useEffect, type RefObject } from 'react';

/** Align the following section with the photo edge, without measuring on scroll. */
export function useHeroPhotoBoundary(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const page = root.current;
    const hero = page?.querySelector<HTMLElement>('.hero-sleep');
    const image = hero?.querySelector<HTMLImageElement>('.hero-visual img');
    if (!page || !hero || !image) return;
    let frame = 0, previousGap = -1;
    const measure = () => {
      frame = 0;
      const gap = Math.max(0, Math.ceil(hero.getBoundingClientRect().bottom - image.getBoundingClientRect().bottom));
      if (gap === previousGap) return;
      previousGap = gap;
      page.style.setProperty('--hero-photo-gap', `${gap}px`);
      page.dispatchEvent(new Event('herophotoboundarychange'));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    observer.observe(image);
    const space = hero.querySelector<HTMLElement>('.hero-product-space');
    if (space) observer.observe(space);
    image.addEventListener('load', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      image.removeEventListener('load', schedule);
      page.style.removeProperty('--hero-photo-gap');
    };
  }, [root]);
}
