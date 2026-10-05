/* Contrato compartilhado da rolagem: posições de leitura, tolerâncias, curvas de deslocamento e detecção de gesto de roda.
 * Esses valores conectam a navegação à timeline do travesseiro; mudanças precisam ser verificadas em ambas. */
/** Each phrase is a destination within the same continuous 3D timeline. */
export const storyReadingStops = [.30, .60, .90] as const;
export const storyEntryProgress = storyReadingStops[0];
export const storyOpeningMs = { mobile: 1100, desktop: 1350 } as const;
/** The automatic entrance owns the textile pose; scroll advances to foam and cooling. */
export const storyPageStops = storyReadingStops.slice(1).map(p => (p-storyEntryProgress)/(1-storyEntryProgress));
export const scrollNavigation = {
  sectionMs: 620,
  chapterMs: 600,
  gestureGapMs: 170,
  wheelThreshold: 6,
  touchThreshold: 14,
  tolerance: 3,
} as const;
export type ScrollGate = { id: string; y: number; kind: 'section' | 'reading' | 'content'; storyChapter?: number };
export type Direction = -1 | 1;

// Busca uma parada na direção pedida, ignorando diferenças menores que a tolerância.
export function nextScrollGate(points: ScrollGate[], y: number, direction: Direction) {
  return direction > 0
    ? points.find(point => point.y > y + scrollNavigation.tolerance)
    : points.findLast(point => point.y < y - scrollNavigation.tolerance);
}

/** One destination per physical burst; arrival never turns its remaining inertia into new input. */
export class WheelGesture {
  private lastAt = -Infinity;
  private lastSize = 0;
  private direction: Direction = 1;
  private accumulated = 0;
  private triggered = false;
  private peak = 0;
  private recent: { size: number; gap: number }[] = [];

  reset() { this.lastAt = -Infinity; this.lastSize = 0; this.triggered = false; this.accumulated = 0; this.peak = 0; this.recent = []; }

  // Reconhece um novo gesto de roda e filtra eventos pequenos ou pertencentes à mesma inércia.
  input(delta: number, now: number): Direction | undefined {
    const size = Math.abs(delta);
    if (size < .5) return;
    const direction: Direction = delta < 0 ? -1 : 1;
    const gap = now - this.lastAt;
    // Gesture recognition is independent of the animation: there is no arrival
    // cooldown. A fresh impulse can interrupt a quiet tail, even at the same
    // pointer position. Compare several samples so one momentum wobble is not
    // mistaken for a new gesture.
    const samples = this.recent.slice(-3);
    const cadence = samples.length ? [...samples].map(sample => sample.gap).sort((a, b) => a - b)[Math.floor(samples.length / 2)] : Infinity;
    const quietTail = samples.length === 3 && samples.every(sample => sample.size <= this.peak * .4);
    const renewed = this.triggered && (
      quietTail && size >= Math.max(6, ...samples.map(sample => sample.size * 1.8))
      || samples.length === 3 && gap >= Math.max(60, cadence * 3) && size >= Math.max(6, this.lastSize * .95)
    );
    if (gap > scrollNavigation.gestureGapMs || direction !== this.direction || renewed) {
      this.accumulated = 0; this.triggered = false; this.peak = 0; this.recent = [];
    }
    if (Number.isFinite(gap)) this.recent = [...this.recent.slice(-2), { size, gap }];
    this.peak = Math.max(this.peak, size);
    this.direction = direction; this.lastAt = now; this.lastSize = size;
    if (this.triggered) return;
    this.accumulated += size;
    if (this.accumulated < scrollNavigation.wheelThreshold) return;
    this.triggered = true;
    return direction;
  }
}

// Interpola a posição com suavização; manter a curva consistente entre controladores.
export function scrollFrame(start: number, end: number, fraction: number) {
  const t = Math.min(1, Math.max(0, fraction));
  return start + (end - start) * (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
}
