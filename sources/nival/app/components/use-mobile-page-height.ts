'use client';
/* Ajusta a altura física das seções em celulares de tela inteira.
 * Atualiza por largura/orientação; evita recalcular o palco a cada mudança da barra do Safari. */
import { useEffect, type RefObject } from 'react';

/** Safari's large viewport can still exclude both translucent browser edges.
 * On a full-width phone, use the screen's CSS-pixel extent for the page only.
 * Text and controls keep their separate, smaller accessible viewport. */
export function useMobilePageHeight(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const mobile = matchMedia('(max-width: 1023px) and (pointer: coarse)');
    const landscape = matchMedia('(orientation: landscape)');
    let previousWidth = 0, previousOrientation: boolean | undefined;
    const update = () => {
      const width = document.documentElement.clientWidth;
      const isLandscape = screen.orientation?.type.startsWith('landscape') ?? landscape.matches;
      if (width === previousWidth && isLandscape === previousOrientation) return;
      previousWidth = width; previousOrientation = isLandscape;
      const short = Math.min(screen.width, screen.height), long = Math.max(screen.width, screen.height);
      const screenWidth = isLandscape ? long : short;
      const screenHeight = isLandscape ? short : long;
      // A tablet split view or resized browser owns only part of the screen.
      // Leave that case to CSS rather than sizing it like a full-screen phone.
      if (mobile.matches && Math.abs(width - screenWidth) <= 2) {
        page.style.setProperty('--mobile-page-height', `${screenHeight}px`);
      } else page.style.removeProperty('--mobile-page-height');
    };
    const reset = () => { previousWidth = 0; update(); };
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('pageshow', reset);
    mobile.addEventListener('change', reset);
    landscape.addEventListener('change', reset);
    return () => {
      window.removeEventListener('resize', update); window.removeEventListener('pageshow', reset);
      mobile.removeEventListener('change', reset); landscape.removeEventListener('change', reset);
      page.style.removeProperty('--mobile-page-height');
    };
  }, [root]);
}
