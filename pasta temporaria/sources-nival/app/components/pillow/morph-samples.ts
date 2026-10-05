/* Amostra vértices com morphs e reutiliza leituras estáticas para medir a forma sem percorrer toda a malha. */
import * as THREE from 'three';

/** Cache static attribute reads; preserve Mesh.getVertexPosition's morph math. */
export function createMorphSamples(mesh: THREE.Mesh, desired: number) {
  const geometry = mesh.geometry, attribute = geometry.getAttribute('position');
  const stride = Math.max(1, Math.floor(attribute.count / desired));
  const indices = Array.from({ length: Math.ceil(attribute.count / stride) }, (_, i) => i * stride);
  const base = new Float64Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    base[i * 3] = attribute.getX(index); base[i * 3 + 1] = attribute.getY(index); base[i * 3 + 2] = attribute.getZ(index);
  }
  const deltas = (geometry.morphAttributes.position ?? []).map(morph => {
    const delta = new Float64Array(base.length);
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i], offset = i * 3;
      delta[offset] = morph.getX(index); delta[offset + 1] = morph.getY(index); delta[offset + 2] = morph.getZ(index);
      if (!geometry.morphTargetsRelative) for (let axis = 0; axis < 3; axis++) delta[offset + axis] -= base[offset + axis];
    }
    return delta;
  });
  const weights = new Float64Array(deltas.length).fill(NaN);
  const positions = new Float64Array(base.length), accumulated = new Float64Array(base.length);
  let initialized = false;
  return {
    indices,
    // Recalcula as amostras somente quando os pesos dos morphs mudam; caso contrário devolve o buffer já pronto.
    read() {
      const influences = mesh.morphTargetInfluences;
      if (initialized && weights.every((value, i) => value === (influences?.[i] ?? 0))) return positions;
      initialized = true; accumulated.fill(0);
      for (let morph = 0; morph < deltas.length; morph++) {
        const weight = weights[morph] = influences?.[morph] ?? 0;
        if (!weight) continue;
        const delta = deltas[morph];
        for (let i = 0; i < accumulated.length; i++) accumulated[i] += delta[i] * weight;
      }
      for (let i = 0; i < positions.length; i++) positions[i] = base[i] + accumulated[i];
      return positions;
    },
  };
}
