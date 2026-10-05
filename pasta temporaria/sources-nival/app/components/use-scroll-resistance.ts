'use client';
/* Controlador de navegação e hook de instalação: mede paradas, interpreta gestos e anima o deslocamento.
 * Coordena mouse, teclado, leitura de conteúdo longo e retorno das especificações; seleciona o controlador mobile quando aplicável. */

import { useEffect, type RefObject } from 'react';
import { nextScrollGate, scrollFrame, scrollNavigation, storyPageStops, WheelGesture, type Direction, type ScrollGate } from './scroll-gates';
import { createMobileScrollController } from './mobile-scroll-controller';
import { portfolioScrollHandoffEvent } from '../../portfolio-scroll-bridge';

/** Feed navigation: one gesture advances one section or one phrase of the 3D story. */
export function createScrollController(page: HTMLDivElement, onDestination?: (target: ScrollGate | undefined, settled: boolean) => void, canLeaveStoryEntrance?: () => boolean, closeSpecifications?: () => boolean, onFrame?: (y:number)=>void) {
  const html = document.documentElement, wheelGesture = new WheelGesture();
  const nativeArea = page.querySelector<HTMLElement>('.specifications-scroll');
  const storyStage = page.querySelector<HTMLElement>('.story-stage');
  let points: ScrollGate[] = [], layoutDirty = true, stopped = false;
  let freeRanges: { start: number; end: number }[] = [];
  let inertiaFrame = 0;
  let frame = 0, destination: ScrollGate | undefined, origin = 0, departure = 0, travel: Direction = 1;
  let nextGesture: Direction | undefined;
  let nativeStart = Infinity, nativeWheelReady = true;
  let lastWritten = window.scrollY, viewportWidth = window.innerWidth;
  let writtenViewportHeight = window.innerHeight;
  type TouchGesture = {
    x: number; y: number; lastY: number; start: number; lastAt: number; velocity: number;
    source: ScrollGate; lower: number; upper: number; free?: { start: number; end: number };
    nativeOutside: boolean; mode: 'pending' | 'horizontal' | 'managed' | 'browser' | 'native';
  };
  let touch: TouchGesture | null = null;
  let nativeRelease: TouchGesture | null = null, nativeReleaseTimer = 0;
  html.classList.add('scroll-managed');

  // Reconstrói paradas e trechos de rolagem livre somente quando a geometria foi invalidada.
  function measure() {
    if (!layoutDirty) return;
    layoutDirty = false;
    const limit = Math.max(0, html.scrollHeight - window.innerHeight);
    // The same stable svh measurement drives CSS and the reading destinations.
    // Browser chrome is not an extra content page.
    const pageHeight = storyStage?.clientHeight || window.innerHeight;
    points = [];
    freeRanges = [];
    nativeStart = Infinity;
    page.querySelectorAll<HTMLElement>('main > section:not([hidden]), main > .purchase-flow > .offer, main > .purchase-flow > .specifications-scroll:not([hidden])').forEach(section => {
      if (Number.isFinite(nativeStart)) return;
      const rect = section.getBoundingClientRect(), top = rect.top + window.scrollY;
      const start = Math.min(limit, top);
      if (section === nativeArea) nativeStart = start;
      points.push({ id: section === nativeArea ? 'duvidas' : section.id, y: start, kind: 'section', ...(section.classList.contains('is-ready') ? { storyChapter: 0 } : {}) });
      // Only the expanded specifications are native. The purchase remains a
      // complete feed page, including when specifications are closed.
      if (section === nativeArea) return;
      if (section.classList.contains('is-ready')) {
        const stage = section.querySelector<HTMLElement>('.story-stage');
        const span = Math.max(0, rect.height - (stage?.clientHeight || window.innerHeight));
        storyPageStops.forEach((p, i) => points.push({ id: `camadas-${i + 2}`, y: Math.min(limit, top + span * p), kind: 'reading', storyChapter: i + 1 }));
      } else {
        // Keep any tall narrative content reachable on short screens.
        const end = Math.min(limit, top + Math.max(0, rect.height - pageHeight));
        if (end > start + 3) freeRanges.push({ start, end });
        const pageSize = pageHeight * .8;
        for (let y = start + pageSize; y < end - 3; y += pageSize) points.push({ id: `${section.id}-content-${points.length}`, y, kind: 'content' });
        if (end > start + 3) points.push({ id: `${section.id}-end`, y: end, kind: 'content' });
      }
    });
    points.sort((a, b) => a.y - b.y);
    points = points.filter((point, i) => !i || point.y - points[i - 1].y > 3);
  }
  // Cancela animação, inércia e fila de gestos; opcionalmente notifica a história.
  function cancel(notify = true) {
    cancelAnimationFrame(frame); frame = 0; destination = undefined; nextGesture = undefined;
    cancelAnimationFrame(inertiaFrame); inertiaFrame = 0;
    window.clearTimeout(nativeReleaseTimer); nativeReleaseTimer = 0; nativeRelease = null;
    html.classList.remove('scroll-animating');
    if (notify) onDestination?.(undefined, false);
  }
  // Limpa o contato touch e sua classe de estado no documento.
  function clearTouch() { touch = null; html.classList.remove('touch-scrolling'); }
  // Devolve o controle à interação direta, descartando gestos e animações pendentes.
  function bypass() { cancel(); wheelGesture.reset(); clearTouch(); nativeWheelReady = true; }
  // Escreve a posição calculada e registra o último deslocamento para distinguir eventos próprios.
  function write(y: number) { window.scrollTo({ top: y, behavior: 'instant' }); lastWritten = window.scrollY; writtenViewportHeight = window.innerHeight; onFrame?.(lastWritten); }
  // Verifica se a leitura está dentro da área nativa das especificações.
  function atNativeArea() {
    measure();
    return !!nativeArea && !destination && window.scrollY >= nativeStart - scrollNavigation.tolerance;
  }
  // Permite rolar o painel enquanto há conteúdo na direção solicitada.
  function nativeScroll(delta: number) {
    return atNativeArea() && (nativeArea!.scrollTop > .5 || delta > 0);
  }
  // Consulta se o botão/painel de especificações já está coordenando uma transição.
  function specificationsMoving() {
    return !!nativeArea?.parentElement?.hasAttribute('data-spec-transition');
  }

  // Seleciona a próxima parada; trata inversão, entrada do travesseiro e fechamento das especificações.
  function advance(direction: Direction, from = window.scrollY) {
    measure();
    if (specificationsMoving()) return;
    // The disclosure owns the return animation, including the camera and
    // both buttons. Do not start a second scroll animation alongside it.
    if (direction < 0 && atNativeArea() && nativeArea!.scrollTop <= .5 && closeSpecifications?.()) {
      nextGesture = undefined;
      return;
    }
    // Arrival and automatic opening are one entrance. Consume early forward
    // gestures rather than queueing them to skip the textile reading pose.
    const storyEntrance = points.find(point => point.storyChapter === 0);
    if (direction > 0 && (
      destination?.storyChapter === 0 && travel > 0
      || !destination && storyEntrance && Math.abs(from - storyEntrance.y) <= scrollNavigation.tolerance && canLeaveStoryEntrance?.() === false
    )) { nextGesture = undefined; return; }
    // Only distinct gestures reach here. Remember one early new gesture so a
    // second swipe is not lost during travel; momentum never enters this queue.
    if (destination && direction === travel) { nextGesture = direction; return; }
    let target: ScrollGate | undefined;
    if (destination && direction !== travel) {
      // Reverse an in-flight transition back to where that gesture began.
      target = points.find(point => Math.abs(point.y - departure) <= scrollNavigation.tolerance)
        ?? { id: 'return', y: departure, kind: destination.kind };
    } else target = nextScrollGate(points, destination?.y ?? from, direction);
    if (!target) return;
    animateTo(target, direction, destination?.y ?? from);
  }

  // Anima um destino com a curva compartilhada e limita a fila a gestos distintos.
  function animateTo(target: ScrollGate, direction: Direction, leaving: number, release = false) {
    cancel(false);
    origin = window.scrollY; lastWritten = origin; departure = leaving; destination = target; travel = direction;
    html.classList.add('scroll-animating');
    onDestination?.(target, false);
    if (target.id === 'duvidas') nativeWheelReady = false;
    const started = performance.now();
    const internalStory = target.storyChapter !== undefined
      && points.some(point => point.storyChapter !== undefined && Math.abs(point.y - leaving) <= scrollNavigation.tolerance);
    const duration = release
      ? Math.max(180, Math.min(440, Math.abs(target.y - origin) * .65))
      : internalStory ? scrollNavigation.chapterMs : scrollNavigation.sectionMs;
    // Atualiza a interpolação de rolagem e encerra a transição ao atingir o destino.
    function animate(now: number) {
      if (stopped || !destination) return;
      if (layoutDirty) {
        measure();
        const updated = points.find(point => point.id === destination!.id);
        if (updated) destination = updated;
      }
      const fraction = Math.min(1, (now - started) / duration);
      write(release ? origin + (destination.y - origin) * (1 - (1 - fraction) ** 3) : scrollFrame(origin, destination.y, fraction));
      if (fraction < 1) frame = requestAnimationFrame(animate);
      else {
        const arrived = destination;
        frame = 0; destination = undefined;
        html.classList.remove('scroll-animating');
        onDestination?.(arrived, true);
        const next = nextGesture; nextGesture = undefined;
        if (next) advance(next);
      }
    }
    frame = requestAnimationFrame(animate);
  }

  // Preserva interações locais de formulários, diálogos e áreas com rolagem própria.
  function eligible(target: EventTarget | null, delta: number) {
    if (!(target instanceof Element) || !page.contains(target)) return false;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return false;
    if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return false;
    for (let el: Element | null = target; el && el !== page; el = el.parentElement) {
      // Observe gestures in this scroller even while it can move. This lets
      // their remaining momentum be recognized at its native top boundary.
      if (el === nativeArea) continue;
      if (el.scrollHeight <= el.clientHeight + 2 || !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      if (delta > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1) return false;
    }
    return true;
  }
  // Separa um novo gesto da inércia da roda/trackpad para evitar pular várias etapas.
  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) { bypass(); return; }
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (!eligible(event.target, delta)) { bypass(); return; }
    const direction = wheelGesture.input(delta, performance.now());
    if (specificationsMoving()) { if (event.cancelable) event.preventDefault(); return; }
    if (nativeScroll(delta)) {
      // The tail of the gesture that arrived here must not spill into a second
      // apparent step. A fresh gesture unlocks native scrolling immediately.
      if (!nativeWheelReady && !direction) { if (event.cancelable) event.preventDefault(); return; }
      nativeWheelReady = true;
      // The floating disclosure belongs to the animation layer; route gestures
      // over it into the same native viewport as the FAQ behind it.
      if (event.target instanceof Node && !nativeArea!.contains(event.target) && event.cancelable) {
        event.preventDefault(); nativeArea!.scrollBy({ top: delta, behavior: 'instant' });
      }
      return;
    }
    // Native overscroll containment owns the edge, including non-cancelable
    // momentum. Never pull the document back in an after-the-fact scroll event.
    if (!event.cancelable) { if (!atNativeArea()) bypass(); return; }
    event.preventDefault();
    if (direction) advance(direction);
  }
  // Captura as condições iniciais do contato e identifica quem deve controlar o gesto.
  function touchStart(event: TouchEvent) {
    if (specificationsMoving()) { clearTouch(); return; }
    if (event.touches.length !== 1 || !eligible(event.target, 1)) { bypass(); return; }
    // Taking hold stops a previous settle immediately. While the finger is
    // down there is no automatic transition, just one-to-one page movement.
    cancel(); wheelGesture.reset(); measure();
    const point = event.touches[0];
    const start = window.scrollY;
    const stops = points.filter(p => p.kind !== 'content');
    if (!stops.length) return;
    const source = stops.reduce((a, b) => Math.abs(a.y - start) < Math.abs(b.y - start) ? a : b);
    const free = freeRanges.find(range => start >= range.start - 3 && start <= range.end + 3);
    const lower = nextScrollGate(stops, free?.start ?? source.y, -1)?.y ?? free?.start ?? source.y;
    let upper = nextScrollGate(stops, free?.end ?? source.y, 1)?.y ?? free?.end ?? source.y;
    const entrance = stops.find(p => p.storyChapter === 0);
    if (entrance && start <= entrance.y + 3 && canLeaveStoryEntrance?.() === false) upper = Math.min(upper, entrance.y);
    nativeWheelReady = true;
    touch = { x: point.clientX, y: point.clientY, lastY: point.clientY, start, source, lower, upper, free,
      lastAt: performance.now(), velocity: 0,
      nativeOutside: !(event.target instanceof Node && nativeArea?.contains(event.target)), mode: 'pending' };
    html.classList.add('touch-scrolling');
  }
  // Processa direção e deslocamento do dedo conforme o modo de navegação.
  function touchMove(event: TouchEvent) {
    if (specificationsMoving() && eligible(event.target, 1)) { if (event.cancelable) event.preventDefault(); return; }
    if (!touch) return;
    if (event.touches.length !== 1) { bypass(); return; }
    const point = event.touches[0], dy = touch.y - point.clientY, dx = touch.x - point.clientX;
    if (touch.mode === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
      if (Math.abs(dx) > Math.abs(dy)) { touch.mode = 'horizontal'; return; }
      if (nativeScroll(dy)) touch.mode = 'native';
      else if (!event.cancelable) { touch.mode = 'browser'; return; }
      else touch.mode = 'managed';
    }
    if (touch.mode === 'horizontal' || touch.mode === 'browser') return;
    if (touch.mode === 'native') {
      // A native contact stays native until finger release, even at the top.
      // overscroll-behavior prevents both rubber-banding and scroll chaining.
      if (touch.nativeOutside && event.cancelable) {
        event.preventDefault();
        nativeArea!.scrollBy({ top: touch.lastY - point.clientY, behavior: 'instant' });
        touch.lastY = point.clientY;
      }
      return;
    }
    // Let a browser takeover finish naturally; settle only after release and
    // the end of its scroll. No correction competes with a held native gesture.
    if (!eligible(event.target, dy)) { bypass(); return; }
    if (!event.cancelable) { touch.mode = 'browser'; return; }
    event.preventDefault();
    const now = performance.now(), delta = touch.lastY - point.clientY;
    const elapsed = Math.max(8, now - touch.lastAt);
    touch.velocity = touch.velocity * .25 + delta / elapsed * .75;
    touch.lastAt = now; touch.lastY = point.clientY;
    write(Math.max(touch.lower, Math.min(touch.upper, touch.start + dy)));
  }
  // Resolve o gesto terminado ou cancelado e ajusta a página à parada correspondente.
  function touchEnd(cancelled = false) {
    const gesture = touch;
    clearTouch();
    if (!gesture || gesture.mode === 'native') return;
    measure();
    const current = window.scrollY, moved = current - gesture.start;
    if (gesture.mode === 'browser') { nativeRelease = gesture; settleNativeRelease(); return; }
    if (gesture.mode !== 'managed') {
      // A tap can interrupt a settle, too. On release it must finish at an
      // actual stage instead of leaving the document caught between two.
      if (!gesture.free && Math.abs(current - gesture.source.y) > 1)
        animateTo(gesture.source, gesture.source.y < current ? -1 : 1, gesture.start, true);
      return;
    }
    // Returning from FAQ uses the same disclosure transition, but only after
    // release. The disclosure's scroll observer ignores an active drag.
    if (gesture.start >= nativeStart - 3 && current < nativeStart - scrollNavigation.touchThreshold && closeSpecifications?.()) return;
    const free = freeRanges.find(range => current >= range.start && current <= range.end);
    if (free && gesture.free) {
      // Content within a tall section is free, including after release. A
      // fling decays inside its bounds and never changes section by itself.
      const velocity = performance.now() - gesture.lastAt < 90 && !cancelled ? Math.max(-2.5, Math.min(2.5, gesture.velocity)) : 0;
      if (Math.abs(velocity) < .08) return;
      const started = performance.now();
      const end = Math.max(free.start, Math.min(free.end, current + velocity * 180));
      const run = (now: number) => {
        const p = Math.min(1, (now - started) / 420);
        write(current + (end - current) * (1 - (1 - p) ** 3));
        if (p < 1) inertiaFrame = requestAnimationFrame(run); else inertiaFrame = 0;
      };
      inertiaFrame = requestAnimationFrame(run);
      return;
    }
    const stops = points.filter(p => p.kind !== 'content');
    let target = gesture.source;
    if (gesture.free) {
      const edge = current < gesture.free.start ? gesture.free.start : gesture.free.end;
      target = { id: 'content-edge', y: edge, kind: 'content' };
      if (!cancelled && Math.abs(current - edge) >= scrollNavigation.touchThreshold)
        target = nextScrollGate(stops, edge, current < edge ? -1 : 1) ?? target;
    } else if (cancelled) {
      target = stops.filter(p => p.y >= gesture.lower && p.y <= gesture.upper)
        .reduce((a, b) => Math.abs(a.y - current) < Math.abs(b.y - current) ? a : b, target);
    } else if (Math.abs(moved) >= scrollNavigation.touchThreshold) {
      target = nextScrollGate(stops, gesture.source.y, moved < 0 ? -1 : 1) ?? target;
    }
    if (target.y > gesture.upper || target.y < gesture.lower) target = gesture.source;
    if (Math.abs(target.y - current) < 1) {
      // The finger itself can reach the stop. Commit its title/description
      // even though no remaining scroll animation is necessary.
      onDestination?.(target, false); onDestination?.(target, true); return;
    }
    animateTo(target, target.y < current ? -1 : 1, gesture.start, true);
  }
  const releaseTouch = () => touchEnd();
  const touchCancel = () => { touchEnd(true); wheelGesture.reset(); };
  // Conclui o ajuste após o trecho de rolagem nativa.
  function settleNativeRelease() {
    window.clearTimeout(nativeReleaseTimer);
    nativeReleaseTimer = window.setTimeout(() => {
      if (!nativeRelease) return;
      touch = { ...nativeRelease, mode: 'managed', velocity: 0 };
      nativeRelease = null; nativeReleaseTimer = 0;
      touchEnd();
    }, 90);
  }
  // Traduz teclas de navegação em deslocamentos compatíveis com as paradas.
  function keyboard(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey && event.key !== ' ') { bypass(); return; }
    const target = event.target as Element | null;
    if (target?.closest('a, button, input, textarea, select, [contenteditable="true"], [role="dialog"]')) { bypass(); return; }
    const direction = event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ' && !event.shiftKey ? 1
      : event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === ' ' && event.shiftKey ? -1 : 0;
    if (!direction) { bypass(); return; }
    if (!eligible(target === document.body ? page : target, direction)) return;
    if (specificationsMoving()) { event.preventDefault(); return; }
    if (nativeScroll(direction)) {
      event.preventDefault();
      nativeWheelReady = true; wheelGesture.reset();
      const step = event.key.startsWith('Arrow') ? 40 : nativeArea!.clientHeight * .85;
      nativeArea!.scrollBy({ top: direction * step, behavior: 'instant' });
      return;
    }
    event.preventDefault();
    if (!event.repeat) advance(direction);
  }
  // Libera a rolagem controlada quando um controle clicável assume a interação.
  function click(event: MouseEvent) {
    const target=event.target as Element | null;
    if (target?.closest('[data-story-next]')) {
      event.preventDefault(); event.stopPropagation(); wheelGesture.reset(); advance(1); return;
    }
    if (target?.closest('a, button, [role="button"]')) bypass();
  }
  // Libera o controle ao iniciar uma interação direta com mouse.
  function pointer(event: PointerEvent) { if (event.pointerType === 'mouse' && !(event.target as Element | null)?.closest('[data-story-next]')) bypass(); }
  // Reconcilia eventos do navegador com deslocamentos escritos pelo próprio controlador.
  function onScroll() {
    if (nativeRelease) settleNativeRelease();
    if (inertiaFrame && Math.abs(window.scrollY - lastWritten) > 3) cancel();
    // A scrollbar/assistive/native movement takes over instead of being pulled back.
    if (frame && Math.abs(window.scrollY - lastWritten) > 3) {
      const chromeDelta=Math.abs(window.innerHeight-writtenViewportHeight);
      if(chromeDelta>1&&Math.abs(window.scrollY-lastWritten)<=chromeDelta+3){
        // WebKit can adjust scrollY along with its toolbar. Keep the already
        // selected destination; never leave the page stranded between sections.
        lastWritten=window.scrollY;writtenViewportHeight=window.innerHeight;layoutDirty=true;
      }else cancel();
    }
    else if (!frame && Math.abs(window.scrollY - lastWritten) > 3) {
      lastWritten = window.scrollY;
      onDestination?.(undefined, false);
    }
  }
  // Marca o layout para nova medição quando necessário.
  function resize() {
    layoutDirty = true;
    if (Math.abs(window.innerWidth - viewportWidth) > 2) bypass();
    viewportWidth = window.innerWidth;
  }
  const resizeObserver = new ResizeObserver(() => { layoutDirty = true; });
  resizeObserver.observe(page);
  const observer = new MutationObserver(() => { layoutDirty = true; });
  const story = page.querySelector('.story');
  if (story) observer.observe(story, { attributes: true, attributeFilter: ['class'] });
  if (nativeArea) observer.observe(nativeArea, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('touchstart', touchStart, { passive: true });
  window.addEventListener('touchmove', touchMove, { passive: false });
  window.addEventListener('touchend', releaseTouch, { passive: true });
  window.addEventListener('touchcancel', touchCancel, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('click', click, true);
  window.addEventListener('keydown', keyboard, true);
  window.addEventListener('pointerdown', pointer, true);
  window.addEventListener('hashchange', bypass);
  window.addEventListener(portfolioScrollHandoffEvent, bypass);
  return () => {
    stopped = true; bypass(); resizeObserver.disconnect(); observer.disconnect();
    html.classList.remove('scroll-managed');
    window.removeEventListener('wheel', wheel);
    window.removeEventListener('touchstart', touchStart);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', releaseTouch);
    window.removeEventListener('touchcancel', touchCancel);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', resize);
    window.removeEventListener('click', click, true);
    window.removeEventListener('keydown', keyboard, true);
    window.removeEventListener('pointerdown', pointer, true);
    window.removeEventListener('hashchange', bypass);
    window.removeEventListener(portfolioScrollHandoffEvent, bypass);
  };
}

export function useScrollResistance(root: RefObject<HTMLDivElement | null>, enabled: boolean, onDestination?: (target: ScrollGate | undefined, settled: boolean) => void, canLeaveStoryEntrance?: () => boolean, closeSpecifications?: () => boolean, onFrame?: (y:number)=>void) {
  useEffect(() => {
    if (!root.current || !enabled) return;
    const page = root.current;
    const mobile = window.matchMedia('(max-width: 1023px), (pointer: coarse)');
    let dispose: (() => void) | undefined;
    const setup = () => {
      dispose?.();
      dispose = (mobile.matches ? createMobileScrollController : createScrollController)(page, onDestination, canLeaveStoryEntrance, closeSpecifications,onFrame);
    };
    setup(); mobile.addEventListener('change', setup);
    return () => { mobile.removeEventListener('change', setup); dispose?.(); };
  }, [root, enabled, onDestination, canLeaveStoryEntrance, closeSpecifications,onFrame]);
}
