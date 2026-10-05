/* Parâmetros de direção visual: qualidade, iluminação, separação das camadas e aparência dos materiais.
 * Alterar estes valores pode afetar tanto o custo de renderização quanto o visual aprovado. */
/** Art direction controls. Distances use a 3 × 2 unit pillow (60 × 40 cm). */
export const pillowConfig = {
  timing: {
    open: [0.04, 0.25],
    // Open the real cover, gather the filling, then reveal the thermal treatment.
    foam: [0.34, 0.57],
    // The final half of the opening, foam descent, and thermal reveal share
    // one scroll interval so no layer gets a head start.
    foamSettle: [0.64, 0.88],
    thermal: [0.64, 0.88],
  },
  separation: { upper: .95, lower: -.83, nearUpper: .40, nearLower: -.28, mobileFactor: .96, foamCenter: .06 },
  textile: { upperTint: 0xb8d8eb, upperTintStrength: 0.68 },
  closed: { upperLoft: .57, lowerLoft: .21, zoom: 1.04 },
  foam: { desktopCount: 3300, mobileCount: 2100 },
  thermal: { opacity: 0.72, wave: 0.025, color: 0xa3c7d9, roughness: 0.31 },
  quality: { desktopDpr: 1.7, mobileDpr: 1.4, shadowSize: 1024 },
  framing: { mobileEdgePx: 6 },
  light: { exposure: 1.04, environment: 0.23, key: 1.9, fill: 0.62, rim: 1.0 },
} as const;
