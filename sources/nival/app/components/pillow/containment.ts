/* Amostra o envelope do tecido para limitar os flocos dentro das capas durante a animação.
 * Usa perfis pré-calculados e vizinhanças conservadoras para evitar atravessamentos nas bordas. */
import * as THREE from 'three';
import envelope from './cloth-envelope.json';
import { closedSurfaceHeight } from './closed-shape';

type Profile = typeof envelope.upper;
type Sample = { x: number; z: number; base: number; relaxed: number; lift: number; closed: number };
export type ClothBoundary = { matrix: THREE.Matrix4; relaxed: number; lift: number; closed: number; windMargin?: number };

// The same closed shell is sampled by thousands of flakes. Keep its original
// double-precision heights once, rather than reconstructing it per neighbor.
const cellGrids = new Map<Profile, Float64Array>();
const closedLimits = new WeakMap<Sample[], { min: number; max: number }>();
const sampleOffsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.71,-.71],[.71,-.71],[-.71,.71],[.71,.71]] as const;
// Reutiliza uma grade do formato fechado por perfil, evitando reconstruí-la nas consultas.
function closedGrid(profile: Profile, upper: boolean) {
  return Float64Array.from({ length: profile.columns * profile.rows }, (_, i) => closedSurfaceHeight(
    (i % profile.columns / (profile.columns - 1) * 2 - 1) * profile.halfWidth,
    (Math.floor(i / profile.columns) / (profile.rows - 1) * 2 - 1) * profile.halfDepth,
    upper,
  ));
}

// Cada consulta usa os mesmos quatro vizinhos de uma célula. Guarda suas
// alturas conservadoras uma vez, em precisão dupla, sem arrays temporários.
function cellGrid(profile: Profile, upper: boolean) {
  let cells = cellGrids.get(profile);
  if (cells) return cells;
  const grid = closedGrid(profile, upper);
  const reduce = upper ? Math.min : Math.max;
  cells = new Float64Array(profile.columns * profile.rows * 4);
  for (let z = 0; z < profile.rows; z++) for (let x = 0; x < profile.columns; x++) {
    const x1 = Math.min(x + 1, profile.columns - 1), z1 = Math.min(z + 1, profile.rows - 1);
    const a = z * profile.columns + x, b = z * profile.columns + x1;
    const c = z1 * profile.columns + x, d = z1 * profile.columns + x1;
    const offset = a * 4;
    for (let shape = 0; shape < 3; shape++) {
      const values = profile.shapes[shape];
      cells[offset + shape] = reduce(values[a], values[b], values[c], values[d]);
    }
    cells[offset + 3] = reduce(grid[a], grid[b], grid[c], grid[d]);
  }
  cellGrids.set(profile, cells);
  return cells;
}

// Detecta o caso simples de capa fechada apenas transladada, permitindo cálculo de limite mais direto.
export function isTranslatedClosedCloth(boundary: ClothBoundary) {
  const e = boundary.matrix.elements;
  return boundary.relaxed === 0 && boundary.lift === 0 && boundary.closed === 1
    && e[1] === 0 && e[5] === 1 && e[9] === 0;
}

// Consulta o perfil em uma vizinhança da grade para obter alturas conservadoras.
function sample(profile: Profile, x: number, z: number, upper: boolean): Sample {
  const u = THREE.MathUtils.clamp((x / profile.halfWidth + 1) * .5 * (profile.columns - 1), 0, profile.columns - 1);
  const v = THREE.MathUtils.clamp((z / profile.halfDepth + 1) * .5 * (profile.rows - 1), 0, profile.rows - 1);
  const offset = (Math.floor(v) * profile.columns + Math.floor(u)) * 4;
  const cells = cellGrid(profile, upper), base = cells[offset];
  return { x, z, base, relaxed: cells[offset + 1] - base, lift: cells[offset + 2] - base, closed: cells[offset + 3] - base };
}

/** Conservative neighborhoods include flake radius, lateral travel and cloth tilt.
 * The height fields are ray-cast from both sides of the actual imported shells.
 * This constrains the entire flake, not just its center, in both scroll directions.
 */
// Pré-calcula amostras ao redor do floco, incluindo margem para raio e movimento lateral.
export function createClothSamples(x: number, z: number, radius: number, upper: boolean) {
  const margin = radius + .15;
  const samples = sampleOffsets.map(([dx,dz]) => sample(upper ? envelope.upper : envelope.lower, x + dx * margin, z + dz * margin, upper));
  let min = Infinity, max = -Infinity;
  for (const point of samples) {
    const height = point.base + point.closed;
    min = Math.min(min, height); max = Math.max(max, height);
  }
  closedLimits.set(samples, { min, max });
  return samples;
}
// Agrupa os limites superior e inferior de um floco para reutilização durante a animação.
export function createFlakeBoundary(x: number, z: number, radius: number) {
  return {
    upper: createClothSamples(x, z, radius, true),
    lower: createClothSamples(x, z, radius, false),
  };
}
export type FlakeBoundary = ReturnType<typeof createFlakeBoundary>;

// Calcula a altura limite no estado deformado da capa; é usado para impedir atravessamento da espuma.
export function clothLimit(samples: Sample[], boundary: ClothBoundary, upper: boolean, translatedClosed = isTranslatedClosedCloth(boundary)) {
  let value = upper ? Infinity : -Infinity;
  const e = boundary.matrix.elements;
  const cached = closedLimits.get(samples);
  if (cached && translatedClosed) {
    const clearance = .055 + (boundary.windMargin ?? 0);
    return (upper ? cached.min : cached.max) + e[13] + (upper ? -clearance : clearance);
  }
  for (const point of samples) {
    const y = point.base + point.relaxed * boundary.relaxed + point.lift * boundary.lift + point.closed * boundary.closed;
    const height = e[1] * point.x + e[5] * y + e[9] * point.z + e[13];
    value = upper ? Math.min(value, height) : Math.max(value, height);
  }
  // Clearance for fabric detail, the inward hem and interpolation between scans.
  const clearance = .055 + (boundary.windMargin ?? 0);
  return value + (upper ? -clearance : clearance);
}
