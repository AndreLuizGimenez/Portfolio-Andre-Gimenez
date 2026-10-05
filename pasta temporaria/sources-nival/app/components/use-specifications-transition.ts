'use client';
/* Move o mesmo botão entre compra e especificações, interpolando posição, tamanho e cor.
 * Separa estado aberto de conteúdo montado para completar a animação de saída antes de ocultar o painel. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

type Box = { x: number; y: number; width: number; height: number };
type ButtonColors = { background: string; border: string; text: string };
type ColorChannels = [number, number, number, number];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const expandedButtonColors: ButtonColors = {
  background: 'rgb(27, 53, 69)',
  border: 'rgb(27, 53, 69)',
  text: 'rgb(255, 255, 255)',
};
const collapsedButtonColors: ButtonColors = {
  background: 'rgba(0, 0, 0, 0)',
  border: 'rgb(215, 223, 227)',
  text: 'rgb(27, 53, 69)',
};

// Converte a cor CSS em canais numéricos para interpolação.
function colorChannels(color: string): ColorChannels {
  const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
}

// Interpola fundo, borda e texto durante o deslocamento do botão.
function mixColor(a: ColorChannels, b: ColorChannels, progress: number) {
  return `rgba(${mix(a[0], b[0], progress)}, ${mix(a[1], b[1], progress)}, ${mix(a[2], b[2], progress)}, ${mix(a[3], b[3], progress)})`;
}

// Mede uma caixa em coordenadas relativas ao contêiner de compra.
function box(element: HTMLElement, flow: HTMLElement): Box {
  const r = element.getBoundingClientRect(), parent = flow.getBoundingClientRect();
  return { x: r.left - parent.left + flow.scrollLeft, y: r.top - parent.top + flow.scrollTop, width: r.width, height: r.height };
}

// Resolve os elementos envolvidos na transição; retorna null enquanto a estrutura não existe.
function elements(root: RefObject<HTMLDivElement | null>, button: RefObject<HTMLButtonElement | null>) {
  const page = root.current;
  const flow = page?.querySelector<HTMLElement>('.purchase-flow');
  const origin = page?.querySelector<HTMLElement>('.spec-origin');
  const destination = page?.querySelector<HTMLElement>('.spec-destination');
  const faq = page?.querySelector<HTMLElement>('#duvidas');
  const scroller = page?.querySelector<HTMLElement>('.specifications-scroll');
  const inside = page?.querySelector<HTMLAnchorElement>('.offer-inside-link');
  return flow && origin && destination && faq && scroller && inside && button.current
    ? { flow, origin, destination, faq, scroller, inside, control: button.current } : null;
}

/** One persistent disclosure moves between two layout slots, including on reverse. */
export function useSpecificationsTransition(root: RefObject<HTMLDivElement | null>, motion: boolean) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const targetOpen = useRef(false);
  const pending = useRef<{ from: Box; insideWidth: number; insideFont: number; colors: ButtonColors } | null>(null);
  const frame = useRef(0);
  const manualScroll = useRef(false);

  // Aplica a caixa do botão móvel e sinaliza que ele já foi posicionado.
  function place(control: HTMLButtonElement, bounds: Box) {
    const { style } = control;
    const left = `${bounds.x}px`, top = `${bounds.y}px`, width = `${bounds.width}px`, height = `${bounds.height}px`;
    if (style.left !== left) style.left = left;
    if (style.top !== top) style.top = top;
    if (style.width !== width) style.width = width;
    if (style.height !== height) style.height = height;
    if (control.dataset.positioned !== 'true') control.dataset.positioned = 'true';
  }
  // Recorta apenas a parte do botão que está fora da área visível do painel.
  function clipToScroller(control: HTMLButtonElement, scroller: HTMLElement) {
    const buttonRect = control.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
    const top = Math.max(0, Math.min(buttonRect.height, viewport.top - buttonRect.top));
    const bottom = Math.max(0, Math.min(buttonRect.height, buttonRect.bottom - viewport.bottom));
    // Only clip at the viewport edge; CSS owns the button's rounded corners.
    const clip = `inset(${top}px 0 ${bottom}px 0)`;
    if (control.style.clipPath !== clip) control.style.clipPath = clip;
  }
  const toggle = useCallback(() => {
    const nodes = elements(root, button);
    if (!nodes) return;
    cancelAnimationFrame(frame.current); frame.current = 0;
    const buttonStyle = getComputedStyle(nodes.control);
    pending.current = {
      from: box(nodes.control, nodes.flow),
      insideWidth: nodes.inside.offsetWidth,
      insideFont: parseFloat(getComputedStyle(nodes.inside).fontSize),
      colors: { background: buttonStyle.backgroundColor, border: buttonStyle.borderTopColor, text: buttonStyle.color },
    };
    manualScroll.current = false;
    targetOpen.current = !targetOpen.current;
    nodes.flow.dataset.specTransition = 'true';
    document.documentElement.classList.add('scroll-programmatic');
    setMounted(true);
    setOpen(targetOpen.current);
  }, [root]);

  const close = useCallback(() => {
    if (!targetOpen.current) return false;
    toggle();
    return true;
  }, [toggle]);

  useLayoutEffect(() => {
    const nodes = elements(root, button);
    if (!nodes) return;
    const { flow, origin, destination, faq, scroller, inside, control } = nodes;
    const to = box(open ? destination : origin, flow);
    const transition = pending.current;
    pending.current = null;
    if (!transition) {
      place(control, to); faq.style.opacity = open ? '1' : '0';
      control.style.removeProperty('transform');
      if (open) clipToScroller(control, scroller); else control.style.removeProperty('clip-path');
      inside.style.removeProperty('width'); inside.style.removeProperty('font-size'); inside.style.removeProperty('transform');
      if (!open && mounted) {
        frame.current = requestAnimationFrame(() => { frame.current = 0; setMounted(false); });
        return () => { cancelAnimationFrame(frame.current); frame.current = 0; };
      }
      return;
    }
    const from = transition.from;
    const colorsTo = open ? expandedButtonColors : collapsedButtonColors;
    const colorStops = {
      background: [colorChannels(transition.colors.background), colorChannels(colorsTo.background)],
      border: [colorChannels(transition.colors.border), colorChannels(colorsTo.border)],
      text: [colorChannels(transition.colors.text), colorChannels(colorsTo.text)],
    };
    const scrollFrom = window.scrollY;
    const scrollTarget = open ? scroller : flow;
    // The FAQ owns a separate native viewport. Land exactly on its top edge;
    // purchase remains a full feed destination rather than part of that scroller.
    const scrollTo = scrollTarget.getBoundingClientRect().top + window.scrollY;
    control.style.removeProperty('clip-path');
    const opacityFrom = Number.parseFloat(getComputedStyle(faq).opacity) || 0;
    const opacityTo = open ? 1 : 0;
    const insideTo = open ? origin.parentElement!.clientWidth : origin.offsetWidth;
    const insideFontTo = open ? 15 : parseFloat(getComputedStyle(origin).fontSize);
    const resizeWidth = from.width !== to.width, resizeHeight = from.height !== to.height;
    const resizeInside = transition.insideWidth !== insideTo;
    const resizeInsideFont = transition.insideFont !== insideFontTo;
    const translateX = from.x - to.x, translateY = from.y - to.y;
    const reposition = Math.abs(scrollTo - scrollFrom) > 80;
    const start = performance.now(), duration = motion ? (reposition ? 680 : 480) : 0;
    flow.dataset.specTransition = 'true';
    window.history.replaceState(window.history.state, '', open ? '#duvidas' : '#escolha');
    // Interpola a transição no tempo e sincroniza botão, painel e rolagem.
    function render(now: number) {
      const p = duration ? Math.min(1, (now - start) / duration) : 1;
      // Camera, disclosure and companion button share the same progress in
      // both directions; keep the section mounted until all three arrive.
      const t = ease(p);
      control.style.transform = `translate3d(${translateX * (1 - t)}px, ${translateY * (1 - t)}px, 0)`;
      if (resizeWidth) control.style.width = `${mix(from.width, to.width, t)}px`;
      if (resizeHeight) control.style.height = `${mix(from.height, to.height, t)}px`;
      control.style.backgroundColor = mixColor(colorStops.background[0], colorStops.background[1], t);
      control.style.borderColor = mixColor(colorStops.border[0], colorStops.border[1], t);
      control.style.color = mixColor(colorStops.text[0], colorStops.text[1], t);
      if (resizeInside) inside.style.width = `${mix(transition!.insideWidth, insideTo, t)}px`;
      if (resizeInsideFont) inside.style.fontSize = `${mix(transition!.insideFont, insideFontTo, t)}px`;
      faq.style.opacity = String(mix(opacityFrom, opacityTo, t));
      if (!manualScroll.current) {
        const top = mix(scrollFrom, scrollTo, t);
        window.scrollTo({ top, behavior: 'instant' });
      }
      if (p < 1) frame.current = requestAnimationFrame(render);
      else {
        frame.current = 0; delete flow.dataset.specTransition; control.style.removeProperty('transform');
        document.documentElement.classList.remove('scroll-programmatic');
        if (open) {
          control.style.backgroundColor = colorsTo.background;
          control.style.borderColor = colorsTo.border;
          control.style.color = colorsTo.text;
        } else {
          control.style.removeProperty('background-color');
          control.style.removeProperty('border-color');
          control.style.removeProperty('color');
        }
        inside.style.removeProperty('width'); inside.style.removeProperty('font-size'); inside.style.removeProperty('transform');
        place(control, box(open ? destination : origin, flow));
        if (open) clipToScroller(control, scroller);
        if (!open) setMounted(false);
        control.focus({ preventScroll: true });
      }
    }
    // Fix the layout at its destination; only the visual position moves each
    // frame. Width/font interpolation retains the existing label treatment.
    place(control, to);
    control.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    if (resizeWidth) control.style.width = `${from.width}px`;
    if (resizeHeight) control.style.height = `${from.height}px`;
    inside.style.width = `${transition.insideWidth}px`; inside.style.fontSize = `${transition.insideFont}px`;
    frame.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame.current); frame.current = 0; delete flow.dataset.specTransition; document.documentElement.classList.remove('scroll-programmatic'); };
  // Refs are the stable animation state; render state only changes at endpoints.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, motion]);

  useEffect(() => {
    const nodes = elements(root, button);
    if (!nodes) return;
    const { flow, origin, destination, control, faq, scroller } = nodes;
    const interrupted = () => {
      if (!flow.hasAttribute('data-spec-transition')) manualScroll.current = true;
    };
    let previousScroll = window.scrollY;
    const returnToPurchase = () => {
      const movingUp = window.scrollY < previousScroll;
      previousScroll = window.scrollY;
      if (document.documentElement.classList.contains('touch-scrolling') || document.documentElement.classList.contains('scroll-native-mobile')) return;
      // Covers native scrolling, scrollbar dragging and reduced motion.
      // Managed gestures delegate to close before starting their own movement.
      if (movingUp && targetOpen.current && !frame.current && !pending.current && scroller.getBoundingClientRect().top > 2) close();
    };
    const layout = () => {
      if (frame.current) return;
      place(control, box(targetOpen.current ? destination : origin, flow));
      if (targetOpen.current) clipToScroller(control, scroller);
      else control.style.removeProperty('clip-path');
    };
    const resize = new ResizeObserver(layout);
    resize.observe(flow); resize.observe(origin); resize.observe(destination);
    if (origin.closest('.offer-details')) resize.observe(origin.closest('.offer-details')!);
    if (destination.parentElement) resize.observe(destination.parentElement);
    resize.observe(faq); resize.observe(scroller);
    scroller.addEventListener('scroll', layout, { passive: true });
    flow.addEventListener('wheel', interrupted, { passive: true });
    flow.addEventListener('touchstart', interrupted, { passive: true });
    window.addEventListener('scroll', returnToPurchase, { passive: true });
    return () => { resize.disconnect(); scroller.removeEventListener('scroll', layout); flow.removeEventListener('wheel', interrupted); flow.removeEventListener('touchstart', interrupted); window.removeEventListener('scroll', returnToPurchase); };
  // The root and disclosure node are persistent for the entire page lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { open, mounted, toggle, close, button };
}
