/* Configura objetos que recebem sombra sem produzir uma contribuição própria no mapa de sombras. */
import type { InstancedMesh } from 'three';

/** VSM treats receivers as casters, even when castShadow is false. */
// Mantém a recepção de sombra sem renderizar os flocos como emissores no passe de sombras.
export function receiveShadowWithoutCasting(mesh: InstancedMesh) {
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  let visibleCount = mesh.count;
  // Exclude the instances only from the depth pass. The cover can still shade
  // the filling, and every flake is restored before its normal color pass.
  mesh.onBeforeShadow = () => { visibleCount = mesh.count; mesh.count = 0; };
  mesh.onAfterShadow = () => { mesh.count = visibleCount; };
}
