/* Regras puras de destino mobile: distingue partes internas da história e mudança entre seções ao soltar.
 * Não registra eventos nem altera o DOM; permite testar as decisões isoladamente. */
import { nextScrollGate, type Direction, type ScrollGate } from './scroll-gates';

export type MobileContentRange = { id: string; start: number; end: number };

/** Only the three poses inside the motion advance before finger release. */
// Retorna a parte interna vizinha quando o gesto permanece na seção de camadas.
export function internalStoryTarget(stops: ScrollGate[], source: ScrollGate, direction: Direction) {
  const target = nextScrollGate(stops, source.y, direction);
  return source.storyChapter !== undefined && target?.storyChapter !== undefined ? target : undefined;
}

/** A tall section is one page, with freely scrollable content between its edges. */
// Resolve o destino ao soltar, considerando direção, posição inicial e trechos de conteúdo longo.
export function mobileReleaseTarget(stops: ScrollGate[], source: ScrollGate, start: number, current: number, range?: MobileContentRange) {
  if (range) {
    if (current >= range.start - 2 && current <= range.end + 2) return undefined;
    const edge = current < range.start ? range.start : range.end;
    if (Math.abs(current - edge) < 14) return { id: `${range.id}-edge`, y: edge, kind: 'content' as const };
    return nextScrollGate(stops, edge, current < edge ? -1 : 1);
  }
  const delta = current - start;
  return Math.abs(delta) < 14 ? source : nextScrollGate(stops, source.y, delta < 0 ? -1 : 1) ?? source;
}
