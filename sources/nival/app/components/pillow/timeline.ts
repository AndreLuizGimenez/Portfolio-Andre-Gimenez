/* Converte progresso de rolagem em pose: abertura, reunião da espuma, película e alturas das capas.
 * Inclui interpolação, seleção da descrição e aleatoriedade determinística compartilhada. */
import { pillowConfig } from './config';
import { storyReadingStops } from '../scroll-gates';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Fallback for deep links and native scrolling: use the nearest reading pose.
// A resting pose must never sit on a text boundary (scroll pixels are rounded).
// Managed gestures blend their copy at the end of the actual layer movement.
export const storyChapter = (progress: number) => progress < (storyReadingStops[0] + storyReadingStops[1]) / 2 ? 0 : progress < (storyReadingStops[1] + storyReadingStops[2]) / 2 ? 1 : 2;
export function smooth(value: number) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}
export function range(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}
/** Copy completes on the same timeline boundary as the moving layers. */
// Calcula o peso da descrição de destino na mesma janela temporal da mudança das camadas.
export function storyCopyBlend(progress: number, origin: number, destination: number) {
  const forward = storyReadingStops[destination] > origin;
  const interval = destination === 2 || (destination === 1 && !forward)
    ? pillowConfig.timing.thermal : pillowConfig.timing.foam;
  const end = interval[forward ? 1 : 0];
  const start = forward ? Math.max(origin, interval[0]) : Math.min(origin, interval[1]);
  if (forward ? origin >= end : origin <= end) return 1;
  // Give the copy most of the layer movement to change. The former last-third
  // fade lasted only a few rendered frames on a phone and looked like a flash.
  return smooth(range(range(progress, start, end), .1, .95));
}
export function seededRandom(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
// Converte o progresso normalizado em todos os parâmetros da pose do travesseiro.
export function sampleTimeline(progress: number) {
  const p = clamp01(progress), timing = pillowConfig.timing;
  const open = smooth(range(p, ...timing.open));
  const foam = range(p, ...timing.foam);
  const thermal = smooth(range(p, ...timing.thermal));
  return {
    progress: p,
    open,
    // The lower shell opens halfway with the foam. The final half of the
    // opening is shared by both shells as the thermal layer appears.
    expansion: .5 * smooth(foam) + .5 * thermal,
    loosen: smooth(range(p, .10, .28)),
    foam,
    foamSettle: smooth(range(p, ...timing.foamSettle)),
    thermal,
    pull: Math.sin(Math.PI * open),
  };
}
export type PillowPose = ReturnType<typeof sampleTimeline>;

/** Shell offsets before the closed-to-open blend is applied. */
// Calcula a posição vertical das capas antes da mistura entre os estados fechado e aberto.
export function shellHeights(pose: PillowPose) {
  const { upper, lower, nearUpper, nearLower } = pillowConfig.separation;
  const originalFullLower = lower - (upper - nearUpper);
  const halfwayLower = (nearLower + originalFullLower) / 2;
  const finalShift = (halfwayLower - originalFullLower) / 2;
  return {
    upper: nearUpper + finalShift * pose.thermal,
    lower: nearLower + (halfwayLower - nearLower) * smooth(pose.foam) - finalShift * pose.thermal,
  };
}
