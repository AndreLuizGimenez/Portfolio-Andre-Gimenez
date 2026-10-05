/* Monta os flocos de espuma em instâncias e atualiza suas transformações conforme a pose.
 * A distribuição determinística mantém o aspecto consistente; limites das capas evitam que flocos atravessem o tecido. */
import * as THREE from 'three';
import { pillowConfig } from './config';
import { range, seededRandom, smooth, type PillowPose } from './timeline';
import { clothLimit, createClothSamples, isTranslatedClosedCloth, type ClothBoundary, type FlakeBoundary } from './containment';
import { foamChipGeometry, foamPacking, foamTextures, softenFoamLight } from './foam-material';
import { writeInstanceTransform } from './instance-transform';

type Flake = {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
  delay: number; spin: number;
  looseX: number; looseZ: number; looseHeight: number; curl: number;
  path: FlakeBoundary['lower'][];
  radius: number; boundary: Pick<FlakeBoundary, 'upper'>;
};

export function createFoam(compact: boolean) {
  const group = new THREE.Group(); group.name = 'loose_to_gathered_memory_foam';
  const count = compact ? pillowConfig.foam.mobileCount : pillowConfig.foam.desktopCount;
  const sizeFactor = Math.cbrt(pillowConfig.foam.desktopCount / count);
  const lowerEnd = pillowConfig.separation.lower - (pillowConfig.separation.upper - pillowConfig.separation.nearUpper);
  const midpoint = THREE.MathUtils.lerp(pillowConfig.separation.nearLower, lowerEnd, .5);
  const random = seededRandom(807), looseRandom = seededRandom(913), textures = foamTextures(), packing = foamPacking(count);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const material = new THREE.MeshPhysicalMaterial({ color: 0xd5d2c8, roughness: 1, metalness: 0,
    map: textures.albedo, specularIntensity: 0, envMapIntensity: .35,
    sheen: 0, emissive: 0x000000 });
  const assemblyLight = softenFoamLight(material);
  const batches: { mesh: THREE.InstancedMesh; flakes: Flake[] }[] = [];
  const variants = 8;
  for (let variant = 0; variant < variants; variant++) {
    const geometry = foamChipGeometry(variant);
    const mesh = new THREE.InstancedMesh(geometry, material, Math.floor(count / variants) + (variant < count % variants ? 1 : 0));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // No self-shadow: only a strongly softened shadow from the upper textile.
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const flakes: Flake[] = [];
    for (let i = 0; i < mesh.count; i++) {
      const point = packing[i * variants + variant], level = point.level;
      const size = (.045 + random() ** 1.5 * .026) * sizeFactor;
      const sx = size * (.82 + random() * .30), sy = size * (.62 + random() * .40), sz = size * (.82 + random() * .32);
      const radius = geometry.boundingSphere!.radius * Math.max(sx, sy, sz) * 1.08;
      // Keep the approved packing and its random sequence intact. The loose
      // filling expands continuously across the cloth, with no separated piles
      // or empty channels. Only the flakes have an irregular fluffy envelope.
      const looseX = THREE.MathUtils.clamp(point.x * 1.12 + .035 * Math.sin(point.z * 6 + point.x * 2) + (looseRandom() - .5) * .06, -1.38, 1.38);
      const looseZ = THREE.MathUtils.clamp(point.z * 1.12 + .035 * Math.sin(point.x * 5) + (looseRandom() - .5) * .05, -.88, .88);
      const curl = (looseRandom() - .5) * .09;
      const fluff = .032 * Math.sin(looseX * 4.7 + looseZ * 3.1) + .021 * Math.cos(looseZ * 7.3 - looseX * 2.8);
      const looseHeight = pillowConfig.separation.foamCenter + (point.y - pillowConfig.separation.foamCenter) * 1.20 + fluff;
      const path = Array.from({ length: 5 }, (_, step) => {
        const t = step / 4, bend = Math.sin(Math.PI * t) * curl;
        return createClothSamples(THREE.MathUtils.lerp(looseX, point.x, t) + bend, THREE.MathUtils.lerp(looseZ, point.z, t) - bend * .65, radius, false);
      });
      const rx = (random() - .5) * 2.7, ry = random() * Math.PI * 2, rz = (random() - .5) * 2.7;
      const delay = (level + 1) * .11 + random() * .18;
      // The retired scatter fields used three random draws. Consume them to
      // preserve every following chip, without retaining unused properties.
      random(); random(); random();
      flakes.push({
        x: point.x, y: point.y, z: point.z,
        rx, ry, rz, sx, sy, sz, delay,
        spin: (random() - .5) * 1.9,
        radius, looseX, looseZ, looseHeight, curl, path,
        // The final lower boundary already exists at path[4].
        boundary: { upper: createClothSamples(point.x, point.z, radius, true) },
      });
      // Preserve the random sequence but keep adjacent chips visually continuous.
      const brightness = .99 + random() * .01;
      color.setRGB(brightness * .985, brightness * .995, brightness);
      mesh.setColorAt(i, color);
    }
    group.add(mesh); batches.push({ mesh, flakes });
  }
  const neutral = new THREE.Color(0xd5d2c8), cool = new THREE.Color(0xcfd4d3);
  const packedBounds = { min: Infinity, max: -Infinity };
  const restBoundary: ClothBoundary = { matrix: new THREE.Matrix4(), relaxed: 0, lift: 0, closed: 1 };
  let upperRequired = -Infinity, lowerAllowed = Infinity, matricesPacked = false;
  const lastUpper = new Float64Array(16).fill(NaN), lastLower = new Float64Array(16).fill(NaN);
  const lastShapes = new Float64Array(6).fill(NaN);
  let lastFoam = NaN, lastLoosen = NaN, lastOffsetY = NaN, lastUpperWind = NaN, lastLowerWind = NaN;
  const vertex = new THREE.Vector3();
  for (const { mesh, flakes } of batches) {
    const positions = mesh.geometry.getAttribute('position');
    // UV seams duplicate positions. Bounds need each identical Float32 vertex
    // only once; rendering keeps the original mesh and all its normals/UVs.
    const unique = new Map<string, number>();
    for (let i = 0; i < positions.count; i++) {
      const key = `${positions.getX(i)},${positions.getY(i)},${positions.getZ(i)}`;
      if (!unique.has(key)) unique.set(key, i);
    }
    for (const flake of flakes) {
      upperRequired = Math.max(upperRequired, flake.y + flake.radius - clothLimit(flake.boundary.upper, restBoundary, true));
      lowerAllowed = Math.min(lowerAllowed, flake.y - flake.radius - clothLimit(flake.path[4], restBoundary, false));
      dummy.position.set(flake.x, flake.y, flake.z);
      dummy.rotation.set(flake.rx, flake.ry, flake.rz);
      dummy.scale.set(flake.sx, flake.sy, flake.sz); dummy.updateMatrix();
      for (const i of unique.values()) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(dummy.matrix);
        packedBounds.min = Math.min(packedBounds.min, vertex.y);
        packedBounds.max = Math.max(packedBounds.max, vertex.y);
      }
    }
  }
  return {
    group, packedBounds,
    textures: [textures.albedo],
    // Atualiza a peça com os parâmetros da pose. Este caminho pode executar por frame: evite alocações e mantenha a mesma deformação ao otimizar.
    update(pose: PillowPose, upper: ClothBoundary, lower: ClothBoundary, finalOffsetY: number, spacing: number) {
      // Follow the cavity center while the lower shell reaches half-open. In
      // the final chapter, travel from that midpoint to the settled layout on
      // the same scroll curve as the lower shell and thermal layer.
      const lowerAnchor = pillowConfig.separation.nearLower * spacing * pose.open;
      const cavityCenterDrop = (lower.matrix.elements[13] - lowerAnchor) * .5;
      const midpointDrop = (midpoint - pillowConfig.separation.nearLower) * spacing * pose.open * .5;
      const offsetY = pose.thermal > 0
        ? THREE.MathUtils.lerp(midpointDrop, finalOffsetY, pose.thermal)
        : cavityCenterDrop;
      group.position.y = offsetY;
      group.updateMatrix();
      assemblyLight.value = 1 - pose.loosen * (1 - pose.foam);
      group.visible = pose.open > .035;
      material.color.copy(neutral).lerp(cool, pose.thermal * .22);
      if (!group.visible) return;
      // Once gathered, the final chapter moves the filling as one object.
      // Reuse matrices only while every flake remains clear of both covers.
      // Reverse scroll or a tighter boundary immediately restores full fitting.
      const upperTranslated = isTranslatedClosedCloth(upper), lowerTranslated = isTranslatedClosedCloth(lower);
      const packedFits = pose.foam === 1 && upperTranslated && lowerTranslated
        && upper.matrix.elements[13] - (upper.windMargin ?? 0) - offsetY > upperRequired + 1e-9
        && lower.matrix.elements[13] + (lower.windMargin ?? 0) - offsetY < lowerAllowed - 1e-9;
      if (packedFits && matricesPacked) return;
      // Resize, câmera e legenda podem solicitar a mesma pose novamente.
      // Só reutiliza o encaixe quando todas as entradas das matrizes coincidem.
      const upperWind = upper.windMargin ?? 0, lowerWind = lower.windMargin ?? 0;
      let unchanged = pose.foam === lastFoam && pose.loosen === lastLoosen && offsetY === lastOffsetY
        && upperWind === lastUpperWind && lowerWind === lastLowerWind
        && upper.relaxed === lastShapes[0] && upper.lift === lastShapes[1] && upper.closed === lastShapes[2]
        && lower.relaxed === lastShapes[3] && lower.lift === lastShapes[4] && lower.closed === lastShapes[5];
      for (let i = 0; unchanged && i < 16; i++) {
        unchanged = upper.matrix.elements[i] === lastUpper[i] && lower.matrix.elements[i] === lastLower[i];
      }
      if (unchanged) return;
      for (const { mesh, flakes } of batches) {
        const matrices = mesh.instanceMatrix.array as Float32Array;
        for (let i = 0; i < flakes.length; i++) {
          const flake = flakes[i];
          // Offset individual starts, but every flake reaches its exact existing
          // destination by the end of the second chapter. No time simulation.
          const gather = 1 - pose.loosen * (1 - smooth(range(pose.foam, flake.delay * .6, 1)));
          const gatherWave = Math.sin(Math.PI * gather);
          const bend = gatherWave * flake.curl;
          const ceiling = clothLimit(flake.boundary.upper, upper, true, upperTranslated) - offsetY;
          const pathStep = gather * 4, left = Math.min(3, Math.floor(pathStep));
          const floor = THREE.MathUtils.lerp(clothLimit(flake.path[left], lower, false, lowerTranslated), clothLimit(flake.path[left + 1], lower, false, lowerTranslated), pathStep - left) - offsetY;
          const fit = Math.min(1, Math.max(.001, (ceiling - floor) / (2 * flake.radius)));
          const radius = flake.radius * fit;
          const looseY = flake.looseHeight;
          const intendedHeight = THREE.MathUtils.lerp(looseY, flake.y, gather) + gatherWave * .035;
          const containedHeight = Math.max(floor + radius, Math.min(ceiling - radius, intendedHeight));
          const turn = gatherWave * flake.spin * .12;
          writeInstanceTransform(matrices, i * 16,
            THREE.MathUtils.lerp(flake.looseX, flake.x, gather) + bend,
            containedHeight,
            THREE.MathUtils.lerp(flake.looseZ, flake.z, gather) - bend * .65,
            flake.rx * (.3 + .7 * gather) + turn, flake.ry + turn * .4, flake.rz * (.3 + .7 * gather) - turn * .6,
            flake.sx * fit, flake.sy * fit, flake.sz * fit,
          );
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      matricesPacked = packedFits;
      lastFoam = pose.foam; lastLoosen = pose.loosen; lastOffsetY = offsetY;
      lastUpperWind = upperWind; lastLowerWind = lowerWind;
      lastUpper.set(upper.matrix.elements); lastLower.set(lower.matrix.elements);
      lastShapes[0] = upper.relaxed; lastShapes[1] = upper.lift; lastShapes[2] = upper.closed;
      lastShapes[3] = lower.relaxed; lastShapes[4] = lower.lift; lastShapes[5] = lower.closed;
    },
  };
}
