/* Deformação suave do tecido: combina fases de vento com pesos da pose e oscilação residual.
 * Pré-cálculos por vértice evitam repetir a parte estática durante os frames. */
import * as THREE from 'three';
import { storyReadingStops } from '../scroll-gates';
import { clamp01, range, smooth, type PillowPose } from './timeline';

const broadAmplitude = .060, rippleAmplitude = .019;
const stops = [0, ...storyReadingStops];

// Combina ondas largas e pequenas com atenuação nas bordas para calcular o deslocamento.
function applyClothWind(edge: number, broadSin: number, broadCos: number, rippleSin: number, rippleCos: number,
  broadFalloff: number, rippleFalloff: number, weights: number[], target: THREE.Vector3) {
  const broad = broadSin * weights[0] + broadCos * weights[1];
  const ripple = rippleSin * weights[2] + rippleCos * weights[3];
  return target.set(broad * .004 * edge,
    broad * broadAmplitude * broadFalloff + ripple * rippleAmplitude * rippleFalloff,
    -broad * .003 * edge);
}

// Calcula o vento em um ponto específico, reaproveitando o vetor de saída.
export function clothWindOffset(x: number, z: number, weights: number[], target: THREE.Vector3) {
  const edge = Math.min(1, Math.max(Math.abs(x) / 1.5, Math.abs(z)));
  const broadPhase = x * 1.45 + z * 1.7, ripplePhase = x * 3.8 - z * 2.4 + .4;
  return applyClothWind(edge, Math.sin(broadPhase), Math.cos(broadPhase), Math.sin(ripplePhase), Math.cos(ripplePhase),
    .42 + .58 * edge ** 1.7, edge ** 2, weights, target);
}

/** Static vertex phases are shared by every animated weight sample. Float64
 * retains the same arithmetic as clothWindOffset without repeated trig/powers. */
// Pré-calcula fases por vértice; troca custo repetido de trigonometria por memória reutilizável.
export function createClothWindField(positions: ArrayLike<number>) {
  const field = new Float64Array(positions.length / 3 * 7);
  for (let i = 0, offset = 0; i < positions.length; i += 3, offset += 7) {
    const x = positions[i], z = positions[i + 2];
    const edge = Math.min(1, Math.max(Math.abs(x) / 1.5, Math.abs(z)));
    const broadPhase = x * 1.45 + z * 1.7, ripplePhase = x * 3.8 - z * 2.4 + .4;
    field[offset] = edge;
    field[offset + 1] = Math.sin(broadPhase); field[offset + 2] = Math.cos(broadPhase);
    field[offset + 3] = Math.sin(ripplePhase); field[offset + 4] = Math.cos(ripplePhase);
    field[offset + 5] = .42 + .58 * edge ** 1.7; field[offset + 6] = edge ** 2;
  }
  return field;
}

export function createClothWindSampler(positions: ArrayLike<number>) {
  const field = createClothWindField(positions);
  return (index: number, weights: number[], target: THREE.Vector3) => {
    const offset = index * 7;
    return applyClothWind(field[offset], field[offset + 1], field[offset + 2], field[offset + 3], field[offset + 4],
      field[offset + 5], field[offset + 6], weights, target);
  };
}

/** A passing gust during each scroll transition, followed by a small damped tail. */
// Obtém a intensidade e os pesos do vento a partir da transição e da oscilação residual.
export function sampleClothWind(pose: PillowPose, residual: number, upper: boolean, target = { weights: [0, 0, 0, 0], margin: 0 }) {
  let travel = 0;
  for (let i = 1; i < stops.length; i++) {
    if (pose.progress > stops[i - 1] && pose.progress < stops[i]) {
      travel = Math.sin(Math.PI * range(pose.progress, stops[i - 1], stops[i])) ** 2;
      break;
    }
  }
  const release = smooth(range(pose.open, .20, .85));
  const strength = release * clamp01(travel * .95 + Math.abs(residual) * 1.8) * (upper ? 1 : .78);
  const phase = pose.progress * 17 + residual * 2.5 + (upper ? 0 : 1.15);
  const weights = target.weights;
  weights[0] = Math.sin(phase) * strength; weights[1] = Math.cos(phase) * strength;
  weights[2] = Math.sin(phase * 1.35 + .7) * strength; weights[3] = Math.cos(phase * 1.35 + .7) * strength;
  // The broad and fine waves can never exceed this conservative displacement.
  target.margin = broadAmplitude * (Math.abs(weights[0]) + Math.abs(weights[1]))
    + rippleAmplitude * (Math.abs(weights[2]) + Math.abs(weights[3])) + strength * .012;
  return target;
}

/** Precompute four bend modes once. Positions, lighting and shadows then deform
 * together on the GPU; no per-frame vertex upload or normal recalculation. */
// Prepara os modos de deformação do tecido que serão combinados durante a animação.
export function createClothWind(mesh: THREE.Mesh) {
  const geometry = mesh.geometry, base = geometry.getAttribute('position'), baseNormal = geometry.getAttribute('normal');
  const rest = new THREE.Float32BufferAttribute(new Float32Array(base.count * 3), 3);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < base.count; i++) {
    mesh.getVertexPosition(i, vertex);
    rest.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  const reference = new THREE.BufferGeometry();
  reference.setAttribute('position', rest);
  if (geometry.index) reference.setIndex(geometry.index.clone());
  reference.computeVertexNormals();
  const restNormal = reference.getAttribute('normal').clone();
  const originalWeights = [...(mesh.morphTargetInfluences ?? [])];
  const targets = geometry.morphAttributes.position ??= [];
  const normals = geometry.morphAttributes.normal ??= [];
  while (normals.length < targets.length) {
    normals.push(geometry.morphTargetsRelative
      ? new THREE.Float32BufferAttribute(new Float32Array(base.count * 3), 3)
      : baseNormal.clone());
  }
  const first = targets.length;
  const sampleWind = createClothWindSampler(rest.array);
  for (let mode = 0; mode < 4; mode++) {
    const deformed = rest.clone(), delta = new Float32Array(base.count * 3);
    const weights = [0, 0, 0, 0]; weights[mode] = 1;
    for (let i = 0; i < base.count; i++) {
      const x = rest.getX(i), z = rest.getZ(i);
      sampleWind(i, weights, vertex);
      delta[i * 3] = vertex.x; delta[i * 3 + 1] = vertex.y; delta[i * 3 + 2] = vertex.z;
      deformed.setXYZ(i, x + vertex.x, rest.getY(i) + vertex.y, z + vertex.z);
    }
    reference.setAttribute('position', deformed); reference.computeVertexNormals();
    const bentNormal = reference.getAttribute('normal');
    const positionTarget = new THREE.Float32BufferAttribute(new Float32Array(base.count * 3), 3);
    const normalTarget = new THREE.Float32BufferAttribute(new Float32Array(base.count * 3), 3);
    positionTarget.name = normalTarget.name = `ClothBreeze${mode}`;
    for (let i = 0; i < base.count; i++) {
      positionTarget.setXYZ(i,
        delta[i * 3] + (geometry.morphTargetsRelative ? 0 : base.getX(i)),
        delta[i * 3 + 1] + (geometry.morphTargetsRelative ? 0 : base.getY(i)),
        delta[i * 3 + 2] + (geometry.morphTargetsRelative ? 0 : base.getZ(i)));
      normalTarget.setXYZ(i,
        bentNormal.getX(i) - restNormal.getX(i) + (geometry.morphTargetsRelative ? 0 : baseNormal.getX(i)),
        bentNormal.getY(i) - restNormal.getY(i) + (geometry.morphTargetsRelative ? 0 : baseNormal.getY(i)),
        bentNormal.getZ(i) - restNormal.getZ(i) + (geometry.morphTargetsRelative ? 0 : baseNormal.getZ(i)));
    }
    targets.push(positionTarget); normals.push(normalTarget);
  }
  reference.dispose();
  mesh.updateMorphTargets();
  originalWeights.forEach((weight, i) => { mesh.morphTargetInfluences![i] = weight; });
  return (weights: number[]) => {
    for (let i = 0; i < 4; i++) mesh.morphTargetInfluences![first + i] = weights[i];
  };
}
