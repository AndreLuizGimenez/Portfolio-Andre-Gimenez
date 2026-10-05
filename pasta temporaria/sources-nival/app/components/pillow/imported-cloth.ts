/* Carrega os arquivos GLB das capas, configura materiais/morphs e fornece atualização e descarte dos modelos. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillowConfig } from './config';
import { range, shellHeights, smooth, type PillowPose } from './timeline';
import { createTextileSeam } from './textile-seam';
import { edgeRelief } from './edge-relief';
import { addClosedPillowMorph } from './closed-shape';
import { createClothWind, sampleClothWind } from './cloth-wind';

/** Load the same two textured shells used by the approved closed pillow. */
// Seleciona os GLBs mobile/desktop e carrega as capas; o sinal permite cancelar a requisição.
export async function loadTextiles(compact: boolean, signal?: AbortSignal) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const tier = compact ? 'mobile' : 'desktop';
  const results = await Promise.allSettled(['upper', 'lower'].map(async side => {
    const response = await fetch(`/demos/nival/models/nival/${side}_textile-${tier}.glb`, { signal });
    if (!response.ok) throw new Error(`Textile ${side}: ${response.status}`);
    return (await loader.parseAsync(await response.arrayBuffer(), '/demos/nival/models/nival/')).scene;
  }));
  const roots = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (signal?.aborted || results.some(result => result.status === 'rejected')) {
    roots.forEach(disposeObject);
    throw new Error('The textile assets could not be loaded.');
  }
  return roots as [THREE.Group, THREE.Group];
}

// Percorre o objeto e libera geometrias, materiais e texturas alocados na GPU.
export function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => { texture.dispose(); const image = texture.source.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); });
}

// Prepara a capa importada, sua costura e estado de deformação usados pela cena.
export function createImportedCloth(root: THREE.Group, upper: boolean, anisotropy: number, weaveNormal?: THREE.Texture) {
  const group = new THREE.Group();
  group.name = upper ? 'upper_textile_from_user_scans' : 'lower_textile_from_user_scans';
  group.add(root);
  const meshes: THREE.Mesh[] = [], textures: THREE.Texture[] = [];
  const boundary = { matrix: group.matrix, relaxed: 0, lift: 0, closed: 1, windMargin: 0 };
  const windState = { weights: [0, 0, 0, 0], margin: 0 };
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    meshes.push(node); node.frustumCulled = false;
    node.castShadow = true;
    // The upper fabric is the highest surface. Disabling self-shadow reception
    // avoids shadow-map acne on its millimetric front/back shell.
    node.receiveShadow = !upper;
    const original = node.material as THREE.MeshStandardMaterial;
    const geometry = node.geometry, position = geometry.getAttribute('position');
    // The mating edge is gently gathered instead of ending on a perfectly flat plane.
    // Both halves share the exact relief, so they still meet in the closed pose.
    for (let i = 0; i < position.count; i++) {
      const relief = edgeRelief(position.getX(i), position.getZ(i));
      position.setY(i, position.getY(i) + relief);
      if (!geometry.morphTargetsRelative) {
        for (const morph of geometry.morphAttributes.position ?? []) morph.setY(i, morph.getY(i) + relief);
      }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    addClosedPillowMorph(node, upper);
    if (upper) {
      // A soft cool cast on the crown, fading to white at the sewn edge.
      // Vertex color follows the original cloth through both morph targets.
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      const height = Math.max(.001, bounds.max.y - bounds.min.y);
      const colors = new Float32Array(position.count * 3);
      const white = new THREE.Color(0xffffff), ice = new THREE.Color(pillowConfig.textile.upperTint), color = new THREE.Color();
      for (let i = 0; i < position.count; i++) {
        const crown = smooth(range((position.getY(i) - bounds.min.y) / height, .18, .72));
        color.copy(white).lerp(ice, crown * pillowConfig.textile.upperTintStrength);
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    // Preserve scan color, weave and normal maps; textile has no metallic response.
    const material = new THREE.MeshPhysicalMaterial({
      map: original.map, normalMap: original.normalMap ?? weaveNormal ?? null,
      normalScale: new THREE.Vector2(.18, .18),
      color: upper ? 0xf5f8fa : 0xebeef0, roughness: .82, metalness: 0,
      vertexColors: upper,
      sheen: upper ? .34 : .28, sheenColor: new THREE.Color(upper ? 0xc6e0ef : 0xcbd6df), sheenRoughness: .75,
      side: THREE.DoubleSide,
      shadowSide: THREE.FrontSide,
    });
    for (const value of Object.values(original)) if (value instanceof THREE.Texture) {
      value.anisotropy = anisotropy; textures.push(value);
    }
    node.material = material; original.dispose();
  });
  const seams = meshes.map(mesh => {
    const seam = createTextileSeam(mesh, upper, weaveNormal);
    mesh.add(seam.group);
    return seam;
  });
  // Keep the approved silhouette as the rest shape. Passing gusts add a small
  // reversible bend during transitions, never the old tray-like morphs.
  for (const mesh of meshes) {
    if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) continue;
    mesh.morphTargetInfluences.fill(0);
    mesh.morphTargetInfluences[mesh.morphTargetDictionary.ClosedPillow] = 1;
  }
  seams.forEach(seam => seam.update(0));
  // Measure the actual facing edge after applying the preserved closed shape.
  // Local origins are not equivalent to surface-to-surface spacing.
  let innerEdge = upper ? Infinity : -Infinity;
  let bottomEdge = Infinity;
  const vertex = new THREE.Vector3();
  group.updateMatrixWorld(true);
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
      innerEdge = upper ? Math.min(innerEdge, vertex.y) : Math.max(innerEdge, vertex.y);
      bottomEdge = Math.min(bottomEdge, vertex.y);
    }
  }
  if (!Number.isFinite(innerEdge)) innerEdge = 0;
  if (!Number.isFinite(bottomEdge)) bottomEdge = 0;
  const windSurfaces = meshes.map(createClothWind);
  for (const seam of seams) seam.group.traverse(node => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh)) windSurfaces.push(createClothWind(node));
  });
  return {
    group, textures, boundary, innerEdge, bottomEdge, wind: windState,
    // Atualiza a peça com os parâmetros da pose. Este caminho pode executar por frame: evite alocações e mantenha a mesma deformação ao otimizar.
    update(pose: PillowPose, residual: number, spacing: number) {
      const opening = pose.open;
      group.visible = true;
      boundary.relaxed = boundary.lift = 0;
      boundary.closed = 1;
      const wind = sampleClothWind(pose, residual, upper, windState);
      boundary.windMargin = wind.margin;
      windSurfaces.forEach(update => update(wind.weights));
      // The first expansion lowers the base; the final expansion moves the
      // two shells equally so the pillow remains centered under the heading.
      const heights = shellHeights(pose);
      const height = upper ? heights.upper : heights.lower;
      group.position.set(0, height * spacing * opening + residual * .003 * opening * (1 - smooth(pose.foam)), 0);
      group.rotation.set(0, 0, 0);
      group.updateMatrix();
    },
  };
}
