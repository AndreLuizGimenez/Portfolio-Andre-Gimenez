/* Extrai pontos das peças deformadas e os projeta para coordenadas de tela usadas pela linha explicativa. */
import * as THREE from 'three';
import { product } from '../../content/product';

export type ProjectedAnchor = { x: number; y: number; chapter: number; visible: boolean; pillowBottom?: number };

/** Read the rendered geometry, including textile morphs and individual foam motion. */
export function createPillowAnchors(upper: THREE.Group, lower: THREE.Group, foam: THREE.Group, thermal: THREE.Mesh) {
  let textile: THREE.Mesh | undefined;
  lower.traverse(node => { if (!textile && node instanceof THREE.Mesh && node.morphTargetInfluences) textile = node; });
  let topTextile: THREE.Mesh | undefined;
  upper.traverse(node => { if (!topTextile && node instanceof THREE.Mesh && node.morphTargetInfluences) topTextile = node; });
  // Localiza o vértice mais próximo da coordenada desejada para fixar a âncora na superfície.
  function surface(mesh: THREE.Mesh, x: number, z: number) {
    const positions = mesh.geometry.getAttribute('position');
    let index = 0, nearest = Infinity;
    for (let i = 0; i < positions.count; i++) {
      const distance = (positions.getX(i) - x) ** 2 + (positions.getZ(i) - z) ** 2;
      if (distance < nearest) { nearest = distance; index = i; }
    }
    return { mesh, index };
  }
  const fabric = textile ? surface(textile, -1.12, .66) : undefined;
  const top = topTextile ? surface(topTextile, -1.12, .66) : undefined;
  const coating = surface(thermal, -1.1, .63);
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  let flake: { mesh: THREE.InstancedMesh; index: number } | undefined;
  return (chapter: number, camera: THREE.Camera): ProjectedAnchor => {
    // Keep the pointer attached to the described material when copy is reordered.
    const part = product.layers[chapter]?.part;
    if (part === 'foam') {
      if (!flake) {
        let nearest = Infinity;
        for (const child of foam.children) {
          if (!(child instanceof THREE.InstancedMesh)) continue;
          for (let i = 0; i < child.count; i++) {
            child.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
            const distance = (point.x + 1.08) ** 2 + (point.y - .16) ** 2 + (point.z - .74) ** 2;
            if (distance < nearest) { nearest = distance; flake = { mesh: child, index: i }; }
          }
        }
      }
      if (!flake) return { x: 0, y: 0, chapter, visible: false };
      flake.mesh.getMatrixAt(flake.index, matrix);
      point.setFromMatrixPosition(matrix).applyMatrix4(flake.mesh.matrixWorld);
    } else {
      const anchor = part === 'thermal' ? coating : part === 'upper' ? top : fabric;
      if (!anchor || !anchor.mesh.visible || part === 'thermal' && !thermal.visible) return { x: 0, y: 0, chapter, visible: false };
      anchor.mesh.getVertexPosition(anchor.index, point).applyMatrix4(anchor.mesh.matrixWorld);
    }
    point.project(camera);
    return { x: (point.x + 1) / 2, y: (1 - point.y) / 2, chapter, visible: Math.abs(point.z) < 1 };
  };
}
