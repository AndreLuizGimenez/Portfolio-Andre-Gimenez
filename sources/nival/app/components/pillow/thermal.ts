/* Representação visual ampliada do revestimento térmico: malha flexível, transparência, cor e ondulação.
 * Atualiza a deformação a partir da pose; não representa uma placa física separada do produto. */
import * as THREE from 'three';
import { pillowConfig } from './config';
import { createSurfaceNormalUpdater, thermalSurface } from './surface';
import { thermalMask } from './textures';
import { range, shellHeights, smooth, type PillowPose } from './timeline';
import { closedSurfaceHeight } from './closed-shape';
import { createClothWindField } from './cloth-wind';

/** An optical enlargement of applied coating, not a claim of a separate product slab. */
export function createThermalMembrane(normalMap: THREE.Texture) {
  const config = pillowConfig.thermal, mask = thermalMask();
  const material = new THREE.MeshPhysicalMaterial({
    color: config.color, transparent: true, opacity: 0, alphaMap: mask,
    roughness: config.roughness, metalness: 0, clearcoat: .5, clearcoatRoughness: .32,
    iridescence: .10, iridescenceIOR: 1.28, iridescenceThicknessRange: [90, 160],
    normalMap, normalScale: new THREE.Vector2(.015, .015),
    sheen: .18, sheenColor: new THREE.Color(0xd5f0f3), sheenRoughness: .6,
    side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true, vertexColors: true,
  });
  const geometry = thermalSurface(), mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'flexible_thermal_coating_optical_enlargement';
  mesh.renderOrder = 2; mesh.frustumCulled = false;
  const base = new Float32Array(geometry.getAttribute('position').array);
  const insideCover = Float64Array.from({ length: base.length / 3 }, (_, i) => closedSurfaceHeight(base[i * 3], base[i * 3 + 2], true));
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const positions = position.array as Float32Array, vertexColors = colors.array as Float32Array;
  const updateNormals = createSurfaceNormalUpdater(geometry);
  const windField = createClothWindField(base);
  const phases = new Float64Array(position.count * 4);
  const heights = new Float64Array(position.count), waves = new Float64Array(position.count);
  const lastWind = new Float64Array(4);
  let lastThermal = NaN, lastResidual = NaN, hadWind = false;
  position.setUsage(THREE.DynamicDrawUsage); colors.setUsage(THREE.DynamicDrawUsage);
  const finalBounds = { min: Infinity, max: -Infinity };
  for (let i = 0; i < position.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const offset = i * 4;
    phases[offset] = x * 3.8 + z * 2.4;
    phases[offset + 1] = z * 5;
    phases[offset + 2] = Math.sin(x * 3 - z * 2);
    phases[offset + 3] = x + z * .5;
    const wave = Math.sin(phases[offset] + 9) * .68 + Math.cos(phases[offset + 1] - 6.3) * .32;
    const finalY = Math.sin(-.012) * x + Math.cos(-.012) * (y + config.wave * wave);
    finalBounds.min = Math.min(finalBounds.min, finalY);
    finalBounds.max = Math.max(finalBounds.max, finalY);
  }
  return {
    mesh, finalBounds,
    textures: [mask],
    // Atualiza a peça com os parâmetros da pose. Este caminho pode executar por frame: evite alocações e mantenha a mesma deformação ao otimizar.
    update(pose: PillowPose, residual: number, spacing: number, destination: number, coverWind?: number[]) {
      mesh.visible = pose.thermal > 0;
      if (!mesh.visible) return;
      const surfaceProgress = .54 + .46 * pose.thermal;
      const phase = surfaceProgress * 9;
      const thermalChanged = pose.thermal !== lastThermal;
      const windChanged = pose.thermal < 1 && (hadWind !== Boolean(coverWind)
        || (coverWind !== undefined && lastWind.some((weight, i) => weight !== coverWind[i])));
      // Camera-only frames and changes to the group destination do not deform
      // this surface. Residual settling changes positions, but never its color.
      if (thermalChanged || residual !== lastResidual || windChanged) {
        const windScale = 1 - pose.thermal, ripplePhase = phase * .7;
        const w0 = coverWind?.[0] ?? 0, w1 = coverWind?.[1] ?? 0, w2 = coverWind?.[2] ?? 0, w3 = coverWind?.[3] ?? 0;
        const frontTranslation = (surfaceProgress - .64) * 11;
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2], offset = i * 4;
          // Start against the inside of the actual raised cover. The coating
          // progressively detaches and relaxes into its final open shape.
          if (thermalChanged) {
            const wave = Math.sin(phases[offset] + phase) * .68 + Math.cos(phases[offset + 1] - ripplePhase) * .32;
            heights[i] = THREE.MathUtils.lerp(insideCover[i], y, pose.thermal);
            waves[i] = config.wave * wave * pose.thermal;
          }
          // Combine the cached field directly into the existing buffers. This
          // retains the same arithmetic without thousands of vector calls.
          let windX = 0, windY = 0, windZ = 0;
          if (coverWind && windScale !== 0) {
            const field = i * 7, edge = windField[field];
            const broad = windField[field + 1] * w0 + windField[field + 2] * w1;
            const ripple = windField[field + 3] * w2 + windField[field + 4] * w3;
            windX = broad * .004 * edge * windScale;
            windY = (broad * .060 * windField[field + 5] + ripple * .019 * windField[field + 6]) * windScale;
            windZ = -broad * .003 * edge * windScale;
          }
          const vertex = i * 3;
          positions[vertex] = x + windX;
          positions[vertex + 1] = heights[i] + windY + waves[i] + residual * .01 * phases[offset + 2];
          positions[vertex + 2] = z + windZ;
          if (thermalChanged) {
            const front = Math.exp(-((phases[offset + 3] - frontTranslation + 1.5) ** 2) * 2.5);
            vertexColors[vertex] = .91 + front * .06;
            vertexColors[vertex + 1] = .95 + front * .04;
            vertexColors[vertex + 2] = .98 + front * .02;
          }
        }
        position.needsUpdate = true; updateNormals();
        if (thermalChanged) colors.needsUpdate = true;
        lastThermal = pose.thermal; lastResidual = residual; hadWind = Boolean(coverWind);
        for (let i = 0; i < 4; i++) lastWind[i] = coverWind?.[i] ?? 0;
      }
      const origin = shellHeights(pose).upper * spacing - .06;
      mesh.position.set(.015 * pose.thermal, THREE.MathUtils.lerp(origin, destination, pose.thermal), .025 * pose.thermal);
      mesh.rotation.z = -.012 * pose.thermal;
      material.opacity = smooth(range(pose.thermal, 0, .2)) * config.opacity;
    },
  };
}
