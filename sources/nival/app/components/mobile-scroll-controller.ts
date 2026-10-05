/* Navegação touch: acompanha início, movimento e fim do gesto, limitando os destinos e coordenando a abertura 3D.
 * O deslocamento vertical é controlado em todos os celulares, inclusive no Safari do iPhone.
 * Cancelamento, retomada da página e desmontagem precisam liberar animações e listeners. */
import { nextScrollGate, scrollNavigation, storyPageStops, WheelGesture, type Direction, type ScrollGate } from './scroll-gates';
import { sectionNavigationEvent, type SectionNavigationDetail } from './scroll-to-section';
import { internalStoryTarget, mobileReleaseTarget, type MobileContentRange } from './mobile-scroll-logic';
import { portfolioScrollHandoffEvent } from '../../portfolio-scroll-bridge';

/** Mobile feed navigation: one vertical contact can reach only an adjacent stop. */
export function createMobileScrollController(page: HTMLDivElement,
  onDestination?: (target: ScrollGate | undefined, settled: boolean) => void,
  canLeaveStoryEntrance?: () => boolean,
  closeSpecifications?: () => boolean,
  onFrame?: (y:number)=>void,
) {
  const html = document.documentElement;
  const story = page.querySelector<HTMLElement>('.story');
  const stage = story?.querySelector<HTMLElement>('.story-stage');
  const hero = page.querySelector<HTMLElement>('.hero');
  const specs = page.querySelector<HTMLElement>('.specifications-scroll');
  const wheel = new WheelGesture();
  const supportsStageTimeline = typeof CSS !== 'undefined' && CSS.supports('(animation-timeline: view()) and (animation-range: contain)');
  let stageRange: { start: number; span: number } | undefined;
  let stageShift: number | undefined;
  let entryProgress: number | undefined, heroProgress: number | undefined, heroHeight=1;
  let stops: ScrollGate[] = [], ranges: MobileContentRange[] = [], dirty = true;
  let frame = 0, panFrame = 0, passiveFrame = 0, openingFrame = 0, openingQueued = false, disposed = false, suppressClickUntil = 0;
  let passivePoint: { x: number; y: number; target: EventTarget | null } | undefined;
  let lastWidth = window.innerWidth;
  let animation: { target: ScrollGate; reading: boolean; origin: number } | undefined;
  let queuedReading: ScrollGate | undefined;
  type Contact = {
    x: number; y: number; start: number; current: number; lastY: number; lastAt: number; velocity: number;
    source: ScrollGate; range?: MobileContentRange; lower: number; upper: number;
    between?: { before: ScrollGate; after: ScrollGate };
    continuingReading?: boolean;
    mode: 'pending' | 'pan' | 'reading' | 'horizontal' | 'browser' | 'blocked';
  };
  let contact: Contact | undefined;
  html.classList.add('scroll-native-mobile');

  // Detecta navegação comandada por outra animação para evitar disputa pela rolagem.
  function programmatic() {
    return html.classList.contains('scroll-programmatic') || !!specs?.parentElement?.hasAttribute('data-spec-transition');
  }
  // Ignora gestos em controles e superfícies que devem tratar a interação por conta própria.
  function eligible(target: EventTarget | null) {
    return target instanceof Element && page.contains(target)
      && !target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
      && !document.querySelector('[role="dialog"][data-state="open"]');
  }
  // Mede as paradas e faixas de leitura; reutiliza o resultado até uma mudança de layout.
  function measure() {
    if (!dirty) return;
    dirty = false;
    const height = stage?.clientHeight || window.innerHeight;
    heroHeight=hero?.offsetHeight||height;
    const limit = Math.max(0, html.scrollHeight - window.innerHeight);
    stageRange = undefined;
    stops = []; ranges = [];
    page.querySelectorAll<HTMLElement>('main > section:not([hidden]), main > .purchase-flow > .offer, main > .purchase-flow > .specifications-scroll:not([hidden])').forEach(section => {
      const bounds = section.getBoundingClientRect();
      // The first page's exit transform is visual; its navigation stop stays 0.
      const top = section.id === 'inicio' ? 0 : bounds.top + window.scrollY;
      const id = section === specs ? 'duvidas' : section.id;
      const enhanced = section === story && section.classList.contains('is-ready');
      stops.push({ id, y: Math.min(limit, top), kind: 'section', ...(enhanced ? { storyChapter: 0 } : {}) });
      if (enhanced) {
        const span = Math.max(0, bounds.height - height);
        if (supportsStageTimeline && window.innerWidth <= 1023) stageRange = { start: top, span };
        storyPageStops.forEach((progress, index) => stops.push({ id: `camadas-${index + 2}`,
          y: Math.min(limit, top + span * progress), kind: 'reading', storyChapter: index + 1 }));
      } else {
        const end = Math.min(limit, top + Math.max(0, bounds.height - height));
        if (end > top + 3) ranges.push({ id, start: top, end });
      }
    });
    stops.sort((a, b) => a.y - b.y);
    stops = stops.filter((stop, i) => !i || stop.y - stops[i - 1].y > 3);
    syncStage();
  }
  // A scroll timeline is sampled before rAF. Managed scroll writes happen in
  // rAF, so pin the normal-flow stage in that same frame instead of presenting
  // its previous offset during reverse travel. Safari keeps real edge pixels.
  function syncStage() {
    if (!stage) return;
    if (!stageRange) {
      if (stageShift !== undefined) { stage.style.removeProperty('transform'); stage.classList.remove('is-scroll-synced'); stageShift = undefined; }
      if(entryProgress!==undefined){stage.style.removeProperty('--story-entry-progress');entryProgress=undefined;}
      if(heroProgress!==undefined){hero?.style.removeProperty('--hero-exit-progress');hero?.classList.remove('is-scroll-synced');heroProgress=undefined;}
      return;
    }
    const y=window.scrollY;
    const entry=Math.max(0,Math.min(1,1+(y-stageRange.start)/stage.clientHeight));
    const exit=Math.max(0,Math.min(1,y/heroHeight));
    // Compositor timelines are sampled before this rAF's scroll write.
    // Entrance, outgoing photo and stage use this frame's position together.
    if(entry!==entryProgress){entryProgress=entry;stage.style.setProperty('--story-entry-progress',String(entry));}
    if(exit!==heroProgress){heroProgress=exit;hero?.classList.add('is-scroll-synced');hero?.style.setProperty('--hero-exit-progress',String(exit));}
    const shift = Math.max(0, Math.min(stageRange.span, y - stageRange.start));
    if(shift!==stageShift){stageShift=shift;stage.classList.add('is-scroll-synced');stage.style.transform=`translate3d(0, ${shift}px, 0)`;}
  }
  function onScroll() { measure(); syncStage(); onFrame?.(window.scrollY); }
  // Encontra a parada mais próxima da posição atual.
  function nearest(y: number) {
    return stops.reduce((a, b) => Math.abs(a.y - y) <= Math.abs(b.y - y) ? a : b);
  }
  // Cancela o frame e o destino pendentes, inclusive a leitura enfileirada.
  function stopAnimation() { cancelAnimationFrame(frame); frame = 0; animation = undefined; queuedReading = undefined; html.classList.remove('scroll-animating'); }
  // Remove a espera pela abertura automática do travesseiro.
  function clearOpening() { openingQueued = false; cancelAnimationFrame(openingFrame); openingFrame = 0; }
  // Descarta o toque corrente e qualquer deslocamento ainda pendente.
  function clearContact() {
    cancelAnimationFrame(panFrame); panFrame = 0;
    cancelAnimationFrame(passiveFrame); passiveFrame = 0; passivePoint = undefined;
    contact = undefined; html.classList.remove('touch-scrolling');
  }
  // Interrompe a navegação controlada e informa a história que não existe destino ativo.
  function cancel() { stopAnimation(); clearOpening(); clearContact(); onDestination?.(undefined, false); }
  // Aplica a posição calculada ao documento sem iniciar uma segunda animação do navegador.
  function write(y: number) {
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });
    syncStage();
    onFrame?.(window.scrollY);
  }
  // Conduz o deslocamento até uma parada e notifica chegada/continuidade da leitura.
  function animate(target: ScrollGate, reading = false, inertia = false) {
    stopAnimation();
    const origin = window.scrollY, began = performance.now();
    const duration = reading ? scrollNavigation.chapterMs : inertia ? 380 : Math.max(160, Math.min(420, Math.abs(target.y - origin) * .55));
    animation = { target, reading, origin };
    html.classList.add('scroll-animating');
    if (!inertia) onDestination?.(target, false);
    // Calcula o frame da animação, aplica a posição e conclui ou agenda o próximo frame.
    function tick(now: number) {
      if (disposed || !animation) return;
      if (programmatic()) { stopAnimation(); return; }
      const p = Math.min(1, (now - began) / duration);
      // Section travel keeps more movement for the end of the same duration.
      // Avoid stacking the old cubic tail with the scene's entrance motion.
      const eased = reading || inertia ? 1 - (1 - p) ** 3 : p * (2 - p);
      write(origin + (target.y - origin) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else {
        const next = queuedReading;
        stopAnimation();
        if (!inertia) onDestination?.(target, true);
        if (next) animate(next, true);
      }
    }
    if (Math.abs(target.y - origin) < .5) { stopAnimation(); if (!inertia) onDestination?.(target, true); }
    else frame = requestAnimationFrame(tick);
  }
  // Solicita a próxima parte da história, tratando um novo gesto durante a transição.
  function requestReading(target: ScrollGate) {
    if (animation?.reading) {
      if (target.id === animation.target.id) return;
      if ((target.y - animation.target.y) * (animation.target.y - animation.origin) > 0) {
        // One distinct gesture can reserve one adjacent part. Never build an
        // unbounded queue or restart the easing of the part already in motion.
        queuedReading = target;
        return;
      }
    }
    // A deliberate reversal replaces both the active movement and its queue.
    animate(target, true);
  }
  // Aguarda a entrada automática ficar pronta antes de consumir a continuação da leitura.
  function afterOpening() {
    if (openingQueued) return;
    openingQueued = true;
    const check = () => {
      openingFrame = 0;
      if (disposed || !openingQueued) return;
      if (canLeaveStoryEntrance?.() === false) { openingFrame = requestAnimationFrame(check); return; }
      openingQueued = false;
      measure();
      const entrance = stops.find(stop => stop.storyChapter === 0);
      const next = entrance && internalStoryTarget(stops, entrance, 1);
      if (next && entrance && Math.abs(window.scrollY - entrance.y) <= 4) requestReading(next);
    };
    openingFrame = requestAnimationFrame(check);
  }
  // Registra origem, direção inicial e modo do novo contato touch.
  function onStart(event: TouchEvent) {
    // Pinch, dialogs and browser UI never inherit a previous vertical gesture.
    if (event.touches.length !== 1 || !eligible(event.target)) { cancel(); return; }
    if (programmatic()) return;
    const readingTarget = animation?.reading ? animation.target : undefined;
    if (!readingTarget) stopAnimation();
    clearContact(); wheel.reset(); measure();
    if (!stops.length) return;
    const point = event.touches[0], start = window.scrollY;
    const range = ranges.find(item => start >= item.start - 3 && start <= item.end + 3);
    const source = (readingTarget && stops.find(stop => stop.id === readingTarget.id)) || (range && stops.find(stop => stop.id === range.id)) || nearest(start);
    const before = nextScrollGate(stops, start, -1), after = nextScrollGate(stops, start, 1);
    const between = !readingTarget && !range && Math.abs(source.y - start) > 3 && before && after ? { before, after } : undefined;
    contact = { x: point.clientX, y: point.clientY, start, current: start, lastY: point.clientY,
      lastAt: performance.now(), velocity: 0, source, range, between, continuingReading: !!readingTarget,
      lower: between?.before.y ?? nextScrollGate(stops, range?.start ?? source.y, -1)?.y ?? range?.start ?? source.y,
      upper: between?.after.y ?? nextScrollGate(stops, range?.end ?? source.y, 1)?.y ?? range?.end ?? source.y, mode: 'pending' };
    if (!readingTarget) onDestination?.(undefined, false);
    html.classList.add('touch-scrolling');
  }
  // Aplica no próximo frame o deslocamento acumulado do dedo.
  function flushPan() {
    cancelAnimationFrame(panFrame); panFrame = 0;
    if (contact?.mode === 'pan') write(contact.current);
  }
  // Decide entre mudança interna da história e arraste limitado entre seções.
  function onMove(event: TouchEvent, checked = false) {
    if (!eligible(event.target)) return;
    if (event.touches.length !== 1) { cancel(); return; }
    if (programmatic()) { if (event.cancelable) event.preventDefault(); return; }
    if (!contact) return;
    if (contact.mode === 'browser' || contact.mode === 'horizontal') return;
    const point = event.touches[0], dy = contact.y - point.clientY, dx = contact.x - point.clientX;
    if (!event.cancelable && contact.mode === 'pending') {
      // Let WebKit commit a possible native pan before taking ownership. On
      // iPhone it can also send noncancelable moves *without* moving the page.
      if (!contact.continuingReading && Math.abs(window.scrollY - contact.start) > 4) {
        stopAnimation(); contact.mode = 'browser'; return;
      }
      if (!checked) {
        passivePoint = { x: point.clientX, y: point.clientY, target: event.target };
        if (!passiveFrame) passiveFrame = requestAnimationFrame(() => {
          passiveFrame = 0;
          const latest = passivePoint;
          if (latest && contact) onMove({ target: latest.target, touches: [{ clientX: latest.x, clientY: latest.y }], cancelable: false } as unknown as TouchEvent, true);
        });
        return;
      }
    }
    if (contact.mode === 'pending' && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 4) {
      contact.mode = 'horizontal'; return;
    }
    // Claim even the first small vertical move on iPhone. Handing it to Safari
    // starts native momentum that can outlive the release animation and skip
    // the next reading stop. Horizontal gestures and pinch remain independent.
    if (event.cancelable) event.preventDefault();
    if (contact.mode === 'reading') return;
    if (contact.mode === 'blocked') {
      // Recheck readiness AND direction: opening only blocks forward travel.
      // A held contact can recover or reverse without needing another touch.
      contact.mode = 'pending';
    }
    if (contact.mode === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) { contact.mode = 'horizontal'; return; }
      const direction: Direction = dy < 0 ? -1 : 1;
      if (direction < 0) clearOpening();
      const first = stops.find(stop => stop.storyChapter === 0);
      const last = stops.find(stop => stop.storyChapter === 2);
      const insideStory = first && last && contact.start >= first.y - 3 && contact.start <= last.y + 3;
      const internal = insideStory && (contact.between
        ? contact.between.before.storyChapter !== undefined && contact.between.after.storyChapter !== undefined
          ? direction > 0 ? contact.between.after : contact.between.before
          : undefined
        : internalStoryTarget(stops, contact.source, direction));
      const opening = insideStory && contact.source.storyChapter === 0 && direction > 0 && canLeaveStoryEntrance?.() === false;
      if (internal || opening) {
        if (event.cancelable) event.preventDefault();
        if (Math.abs(dy) < 14) return;
        contact.mode = opening ? 'blocked' : 'reading';
        suppressClickUntil = performance.now() + 500;
        if (opening) afterOpening();
        else if (internal) requestReading(internal);
        return;
      }
      if (event.cancelable) event.preventDefault();
      if (contact.continuingReading) {
        // Crossing a real section boundary still follows the finger and waits
        // for release. Take over at the current visual position without a jump.
        stopAnimation();
        contact.start = window.scrollY - dy;
        contact.current = window.scrollY;
        contact.continuingReading = false;
        onDestination?.(undefined, false);
      }
      contact.mode = 'pan';
    }
    const now = performance.now(), elapsed = Math.max(8, now - contact.lastAt);
    contact.velocity = contact.velocity * .25 + (contact.lastY - point.clientY) / elapsed * .75;
    contact.lastY = point.clientY; contact.lastAt = now;
    contact.current = Math.max(contact.lower, Math.min(contact.upper, contact.start + dy));
    suppressClickUntil = now + 500;
    if (!panFrame) panFrame = requestAnimationFrame(flushPan);
  }
  // Ao soltar, escolhe o destino permitido e resolve a posição intermediária.
  function onEnd(event: TouchEvent) {
    if (event.touches.length || !contact) return;
    flushPan();
    const gesture = contact, current = window.scrollY;
    clearContact();
    if (['pan', 'reading', 'blocked'].includes(gesture.mode)) suppressClickUntil = performance.now() + 400;
    if (['reading', 'blocked', 'horizontal'].includes(gesture.mode) || programmatic()) return;
    if ((gesture.mode === 'pending' || gesture.mode === 'browser') && Math.abs(current - gesture.start) > 4) return;
    // Some iOS Safari gestures deliver only touchstart/touchend, or a
    // noncancelable move without any native scroll. Recover exactly one step
    // from the released finger instead of silently dropping the swipe.
    if ((gesture.mode === 'pending' || gesture.mode === 'browser') && Math.abs(current - gesture.start) <= 4) {
      const point = event.changedTouches?.[0];
      const dy = point ? gesture.y - point.clientY : 0;
      const dx = point ? gesture.x - point.clientX : 0;
      if (Math.abs(dy) >= 14 && Math.abs(dy) > Math.abs(dx)) {
        const direction: Direction = dy > 0 ? 1 : -1;
        if (direction < 0) clearOpening();
        const internal = internalStoryTarget(stops, gesture.source, direction);
        if (gesture.source.storyChapter === 0 && direction > 0 && canLeaveStoryEntrance?.() === false) afterOpening();
        else if (internal) requestReading(internal);
        else if (gesture.range) {
          const end = Math.max(gesture.range.start, Math.min(gesture.range.end, current + dy));
          if (Math.abs(end - current) > 1) animate({ id: gesture.range.id, y: end, kind: 'content' }, false, true);
        } else {
          const next = nextScrollGate(stops, gesture.source.y, direction);
          if (next) animate(next);
        }
        suppressClickUntil = performance.now() + 400;
        return;
      }
    }
    if (gesture.mode === 'browser') return;
    if (gesture.continuingReading && gesture.mode === 'pending') return;
    if (gesture.source.id === 'duvidas' && current < (gesture.range?.start ?? gesture.source.y) - 14 && closeSpecifications?.()) return;
    const target = gesture.between
      ? Math.abs(current - gesture.start) < 14 ? gesture.source : current > gesture.start ? gesture.between.after : gesture.between.before
      : mobileReleaseTarget(stops, gesture.source, gesture.start, current, gesture.range);
    if (target) animate(target);
    else if (gesture.range && gesture.mode === 'pan') {
      // Momentum may read more of THIS section, never choose the next one.
      const velocity = performance.now() - gesture.lastAt < 90 ? Math.max(-2.4, Math.min(2.4, gesture.velocity)) : 0;
      const end = Math.max(gesture.range.start, Math.min(gesture.range.end, current + velocity * 160));
      if (Math.abs(end - current) > 1) animate({ id: gesture.range.id, y: end, kind: 'content' }, false, true);
    }
  }
  // Libera o gesto interrompido pelo navegador sem deixar o controlador preso.
  function onCancel() {
    // WebKit can cancel a contact after the automatic part has been accepted.
    // Finish that part; never strand the model between two explanations.
    if (animation?.reading || openingQueued) { queuedReading = undefined; clearContact(); return; }
    cancel();
  }
  // Avança ou retorna uma parada, respeitando os limites de leitura e especificações.
  function advance(direction: Direction) {
    measure(); if (!stops.length) return;
    const current = window.scrollY;
    const range = ranges.find(item => current >= item.start - 3 && current <= item.end + 3);
    const source = (animation?.reading && animation.target) || (range && stops.find(stop => stop.id === range.id)) || nearest(current);
    if (source.id === 'duvidas' && direction < 0 && current <= (range?.start ?? source.y) + 3 && closeSpecifications?.()) return;
    if (source.storyChapter === 0 && direction > 0 && canLeaveStoryEntrance?.() === false) { afterOpening(); return; }
    if (range && (direction > 0 ? current < range.end - 3 : current > range.start + 3)) {
      animate({ id: range.id, y: Math.max(range.start, Math.min(range.end, current + direction * (stage?.clientHeight || window.innerHeight) * .65)), kind: 'content' }, false, true);
      return;
    }
    const target = nextScrollGate(stops, direction > 0 ? range?.end ?? source.y : range?.start ?? source.y, direction);
    if (target) {
      if (source.storyChapter !== undefined && target.storyChapter !== undefined) requestReading(target);
      else animate(target);
    }
  }
  // Converte eventos de roda em gestos discretos, filtrando o impulso residual.
  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY || !eligible(event.target)) return;
    if (!event.cancelable) return;
    event.preventDefault();
    if (programmatic()) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    const direction = wheel.input(delta, performance.now());
    if (direction) advance(direction);
  }
  // Oferece navegação por teclado sem interceptar campos ou controles indevidamente.
  function onKey(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as Element | null)?.closest('a, button, input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
    const direction = ['ArrowDown', 'PageDown'].includes(event.key) || event.key === ' ' && !event.shiftKey ? 1
      : ['ArrowUp', 'PageUp'].includes(event.key) || event.key === ' ' && event.shiftKey ? -1 : 0;
    if (!direction || programmatic() || !eligible(event.target === document.body ? page : event.target)) return;
    event.preventDefault(); if (!event.repeat) advance(direction);
  }
  // Impede que o fim de um arraste também acione um link ou botão.
  function onClick(event: MouseEvent) {
    if (!eligible(event.target)) return;
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
    // O botão equivale a um gesto para baixo e usa as mesmas paradas e animações.
    if ((event.target as Element).closest('[data-story-next]')) {
      event.preventDefault(); event.stopPropagation(); clearContact(); wheel.reset(); advance(1); return;
    }
    // Capture runs before React's navigation capture; links/specs own their
    // animation after this cancellation, never alongside a pending settle.
    if ((event.target as Element).closest('a, button')) cancel();
  }
  // Recebe links internos pelo evento compartilhado e assume a navegação quando aplicável.
  function navigateSection(event: Event) {
    const { target, behavior } = (event as CustomEvent<SectionNavigationDetail>).detail;
    if (!page.contains(target)) return;
    event.preventDefault();
    if (programmatic()) return;
    cancel(); wheel.reset(); measure();
    const stop = stops.find(item => item.id === target.id)
      ?? { id: target.id, y: target.getBoundingClientRect().top + window.scrollY, kind: 'section' as const };
    if (behavior === 'instant') { write(stop.y); onDestination?.(stop, true); }
    else animate(stop);
  }
  // Invalida medidas quando o tamanho relevante muda, preservando a posição de leitura.
  function onResize() {
    dirty = true;
    // Safari's toolbar changes height only. It must not restart the scene,
    // reset a gesture or cause a programmatic re-snap.
    if (Math.abs(window.innerWidth - lastWidth) < 2) return;
    lastWidth = window.innerWidth;
    const target = animation?.target ?? (stops.length ? nearest(window.scrollY) : undefined);
    cancel(); measure();
    if (target && !programmatic()) {
      const updated = stops.find(stop => stop.id === target.id);
      if (updated) write(updated.y);
    }
  }
  const invalidate = () => {
    dirty = true;
    if (!story?.classList.contains('is-ready')) { stageRange = undefined; syncStage(); }
  };
  const suspend = () => { cancel(); wheel.reset(); dirty = true; };
  const portfolioHandoff = () => { cancel(); wheel.reset(); };
  const resume = () => { suspend(); measure(); };
  const visibility = () => { if (document.hidden) suspend(); else resume(); };
  const resize = new ResizeObserver(invalidate); resize.observe(page); if (stage) resize.observe(stage);
  page.addEventListener('herophotoboundarychange',invalidate);
  const mutation = new MutationObserver(invalidate);
  if (story) mutation.observe(story, { attributes: true, attributeFilter: ['class'] });
  if (specs) mutation.observe(specs, { attributes: true, attributeFilter: ['hidden'] });
  measure();
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onCancel, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('click', onClick, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('hashchange', cancel);
  window.addEventListener(portfolioScrollHandoffEvent, portfolioHandoff);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener(sectionNavigationEvent, navigateSection);
  return () => {
    disposed = true; cancel(); resize.disconnect(); mutation.disconnect(); html.classList.remove('scroll-native-mobile');
    page.removeEventListener('herophotoboundarychange',invalidate);
    stageRange = undefined; syncStage();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('touchstart', onStart); window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd); window.removeEventListener('touchcancel', onCancel);
    window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey);
    window.removeEventListener('click', onClick, true); window.removeEventListener('resize', onResize);
    window.removeEventListener('hashchange', cancel);
    window.removeEventListener(portfolioScrollHandoffEvent, portfolioHandoff);
    window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', resume);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener(sectionNavigationEvent, navigateSection);
  };
}
