/* Funções de relevo da borda compartilhadas pela geometria do tecido. */
import { range, smooth } from './timeline';

/** An aligned seam with only fine fabric irregularity, shared by both halves. */
// Calcula a irregularidade suave da borda conforme ângulo e distância do centro.
export function edgeRelief(x: number, z: number) {
  const theta = Math.atan2(z, x / 1.5);
  const radius = (Math.abs(x / 1.5) ** 5.5 + Math.abs(z) ** 5.5) ** (1 / 5.5);
  const band = smooth(range(radius, .82, 1));
  return band * (.002 * Math.sin(theta * 3 + .55) + .001 * Math.sin(theta * 7 - .8) + .0006 * Math.sin(theta * 19));
}
