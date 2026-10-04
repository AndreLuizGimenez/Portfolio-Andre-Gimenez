/* Define o volume arredondado do travesseiro fechado e adiciona esse formato como morph às capas. */
import * as THREE from 'three';
import { edgeRelief } from './edge-relief';
import { pillowConfig } from './config';

/** Plush closed silhouette matched to the user's hero image, with rounded shoulders. */
// Calcula a altura da capa fechada; preserve esta fórmula para não alterar a silhueta.
export function closedSurfaceHeight(x: number, z: number, upper: boolean) {
  // Match the exact asymmetric perimeter used by the source preparation.
  // Otherwise even a small contour variation leaves a gap between the halves.
  const theta = Math.atan2(-z, x / 1.5);
  const radius = (Math.abs(x / 1.5) ** 5.5 + Math.abs(z) ** 5.5) ** (1 / 5.5) / (1 + .004 * Math.sin(theta * 3 + .7));
  if (radius > .99995) return 0;
  const dome = Math.max(0, 1 - radius * radius) ** .46;
  // Filling tapers before the corners, leaving the characteristic fabric tips.
  const corner = THREE.MathUtils.smoothstep(Math.abs(x / 1.5), .65, .98) * THREE.MathUtils.smoothstep(Math.abs(z), .65, .98);
  return (upper ? pillowConfig.closed.upperLoft : -pillowConfig.closed.lowerLoft) * dome * (1 - .35 * corner);
}

/** Preserve the approved closed silhouette for both joined and separated shells. */
// Adiciona posições e normais do formato fechado aos morphs da malha.
export function addClosedPillowMorph(mesh: THREE.Mesh, upper: boolean) {
  const geometry = mesh.geometry, base = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const target = new THREE.Float32BufferAttribute(new Float32Array(base.count * 3), 3);
  for (let i = 0; i < base.count; i++) {
    const x = base.getX(i), z = base.getZ(i);
    const onSeam = uv.getX(i) < .0001 || uv.getX(i) > .9999 || uv.getY(i) < .0001 || uv.getY(i) > .9999;
    const height = onSeam ? 0 : closedSurfaceHeight(x, z, upper);
    const loft = upper ? pillowConfig.closed.upperLoft / .54 : pillowConfig.closed.lowerLoft / .34;
    const scanDetail = Math.abs(height) < .0001 ? 0 : THREE.MathUtils.clamp((base.getY(i) * loft - height) * .15, -.008, .008);
    // A fuller rounded rectangle keeps the ends aligned with the product photo.
    // The shared radial mapping preserves the exact join between both halves.
    const a = Math.abs(x / 1.5), b = Math.abs(z);
    const sourceRadius = (a ** 5.5 + b ** 5.5) ** (1 / 5.5);
    const rectangularRadius = (a ** 16 + b ** 16) ** (1 / 16);
    const fabricTip = .05 * THREE.MathUtils.smoothstep(a, .65, .95) * THREE.MathUtils.smoothstep(b, .65, .95) * THREE.MathUtils.smoothstep(sourceRadius, .82, 1);
    const footprintScale = rectangularRadius > .0001 ? sourceRadius / rectangularRadius + fabricTip : 1;
    const softX = x * footprintScale;
    const softZ = z * footprintScale;
    target.setXYZ(i, softX, height + scanDetail + edgeRelief(x, z), softZ);
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', target);
  if (geometry.index) surface.setIndex(geometry.index.clone());
  surface.computeVertexNormals();
  const normal = surface.getAttribute('normal'), baseNormal = geometry.getAttribute('normal');
  const joinedNormal = new THREE.Vector3(), currentNormal = new THREE.Vector3();
  for (let i = 0; i < base.count; i++) {
    const edge = Math.max(Math.abs(uv.getX(i) * 2 - 1), Math.abs(uv.getY(i) * 2 - 1));
    if (edge < .96) continue;
    const x = target.getX(i) / 1.5, z = target.getZ(i);
    joinedNormal.set(Math.sign(x) * Math.abs(x) ** 15 / 1.5, 0, Math.sign(z) * Math.abs(z) ** 15).normalize();
    currentNormal.fromBufferAttribute(normal, i).lerp(joinedNormal, THREE.MathUtils.smoothstep(edge, .96, 1)).normalize();
    normal.setXYZ(i, currentNormal.x, currentNormal.y, currentNormal.z);
  }
  const morphPosition = target.clone(), morphNormal = normal.clone();
  morphPosition.name = morphNormal.name = 'ClosedPillow';
  if (geometry.morphTargetsRelative) {
    for (let i = 0; i < base.count; i++) {
      morphPosition.setXYZ(i, target.getX(i) - base.getX(i), target.getY(i) - base.getY(i), target.getZ(i) - base.getZ(i));
      morphNormal.setXYZ(i, normal.getX(i) - baseNormal.getX(i), normal.getY(i) - baseNormal.getY(i), normal.getZ(i) - baseNormal.getZ(i));
    }
  }
  (geometry.morphAttributes.position ??= []).push(morphPosition);
  if (geometry.morphAttributes.normal) geometry.morphAttributes.normal.push(morphNormal);
  mesh.updateMorphTargets();
  surface.dispose();
}
