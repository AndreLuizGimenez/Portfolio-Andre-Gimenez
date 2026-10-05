/* Calcula separações verticais iguais entre as superfícies reais das camadas, não apenas entre suas origens. */
export type VerticalExtent = { min: number; max: number };

/** Three identical clear gaps, measured between surfaces rather than origins. */
// Resolve alturas para manter vãos iguais entre as superfícies das camadas.
export function equalLayerSpacing(upperEdge: number, lowerEdge: number, foam: VerticalExtent, thermal: VerticalExtent) {
  const gap = (upperEdge - lowerEdge - (foam.max - foam.min) - (thermal.max - thermal.min)) / 3;
  return {
    gap,
    foamY: lowerEdge + gap - foam.min,
    thermalY: upperEdge - gap - thermal.max,
  };
}
