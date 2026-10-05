/* Calcula se a chegada à seção 3D está em aproximação, abertura automática ou pronta para navegar.
 * Compartilha a tolerância em pixels do controlador para não bloquear em posições fracionárias. */
import { scrollNavigation } from './scroll-gates';

export type StoryEntranceState = 'approaching' | 'opening' | 'ready';

/** Reset at the closed pose even when the photo overlaps the entrance range. */
export function shouldResetStoryOpening(entry:number,closingTravel:number){
  return entry<=1-closingTravel;
}

/** Match the navigator's pixel tolerance, including Safari's fractional stops. */
export function storyEntranceState(progress: number, travelPixels: number, opening: number): StoryEntranceState {
  const remaining = (1 - progress) * Math.max(1, travelPixels);
  if (progress <= 0 || remaining > scrollNavigation.tolerance + 1e-7) return 'approaching';
  // The easing tail is already visually still; it must not add an input delay.
  return opening >= .965 ? 'ready' : 'opening';
}
