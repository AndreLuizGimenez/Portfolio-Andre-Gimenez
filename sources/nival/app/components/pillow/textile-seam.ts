/* Constrói uma costura presa ao perímetro do modelo importado e acompanha seus morphs ao abrir o travesseiro. */
import * as THREE from 'three';

/** A folded fabric edge attached to the scan's actual perimeter and morphs. */
export function createTextileSeam(surface: THREE.Mesh, upper: boolean, normalMap?: THREE.Texture) {
  const group = new THREE.Group();
  group.name = 'soft_folded_seam';
  const source = surface.geometry, uv = source.getAttribute('uv'), positions = source.getAttribute('position');
  const edge: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < .0001 || u > .9999 || v < .0001 || v > .9999) edge.push(i);
  }
  edge.sort((a, b) => Math.atan2(positions.getZ(a), positions.getX(a)) - Math.atan2(positions.getZ(b), positions.getX(b)));
  const count = edge.length, sides = 10;
  const geometry = new THREE.BufferGeometry();
  const vertices = new THREE.BufferAttribute(new Float32Array((count + 1) * (sides + 1) * 3), 3);
  const textureUV = new Float32Array((count + 1) * (sides + 1) * 2), indices: number[] = [];
  vertices.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i <= count; i++) for (let j = 0; j <= sides; j++) {
    textureUV.set([i / count * 4, j / sides * .06], (i * (sides + 1) + j) * 2);
    if (i < count && j < sides) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  geometry.setAttribute('position', vertices);
  geometry.setAttribute('uv', new THREE.BufferAttribute(textureUV, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xe6edf0, roughness: .88, metalness: 0,
    sheen: .28, sheenColor: new THREE.Color(0xd2e2e9), sheenRoughness: .82,
    normalMap: normalMap ?? null, normalScale: new THREE.Vector2(.14, .14),
    side: THREE.DoubleSide,
  });
  const hem = new THREE.Mesh(geometry, material);
  hem.name = 'rounded_folded_fabric'; hem.frustumCulled = false;
  // Tiny folded details use studio shading without noisy self-shadow acne.
  const stitches = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(.0018, .012, 2, 4),
    new THREE.MeshStandardMaterial({ color: 0xcbd8de, roughness: .96 }),
    280,
  );
  stitches.name = 'individual_seam_stitches'; stitches.frustumCulled = false;
  stitches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(hem, stitches);
  const centers = edge.map(() => new THREE.Vector3()), outer = edge.map(() => new THREE.Vector3());
  const tangent = new THREE.Vector3(), point = new THREE.Vector3(), next = new THREE.Vector3();
  const dummy = new THREE.Object3D(), axis = new THREE.Vector3(0, 1, 0);
  const widths = new Float32Array(count), heights = new Float32Array(count);
  const closedColor = new THREE.Color(0xe5ebee), openColor = new THREE.Color(0xe6edf0);
  // Atualiza a peça com os parâmetros da pose. Este caminho pode executar por frame: evite alocações e mantenha a mesma deformação ao otimizar.
  function update(opening = 0) {
    const foldScale = .12 + opening * .88;
    // Closed: a single fine seam, with no doubled lip around the pillow.
    group.visible = upper || opening > .015;
    stitches.visible = opening > .08;
    material.color.lerpColors(closedColor, openColor, opening);
    for (let i = 0; i < count; i++) {
      surface.getVertexPosition(edge[i], point);
      surface.getVertexPosition(edge[(i + 1) % count], next);
      tangent.subVectors(next, point).normalize();
      outer[i].set(tangent.z, 0, -tangent.x).normalize();
      const theta = Math.atan2(point.z, point.x);
      // Small, shared gathers let the two halves meet naturally when closed.
      const gather = .0035 * Math.sin(theta * 17 + .4) + .002 * Math.sin(theta * 29 - .7);
      widths[i] = (.020 + .002 * Math.sin(theta * 13 + .3)) * foldScale;
      heights[i] = (.0115 + .0012 * Math.sin(theta * 19)) * foldScale;
      centers[i].copy(point).addScaledVector(outer[i], (.008 + gather * .5) * foldScale);
      centers[i].y += (upper ? 1 : -1) * .0125 * opening + gather * opening;
    }
    for (let i = 0; i <= count; i++) {
      const k = i % count;
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        point.copy(centers[k]).addScaledVector(outer[k], Math.cos(angle) * widths[k]);
        point.y += Math.sin(angle) * heights[k];
        vertices.setXYZ(i * (sides + 1) + j, point.x, point.y, point.z);
      }
    }
    vertices.needsUpdate = true; geometry.computeVertexNormals();
    for (let i = 0; i < stitches.count; i++) {
      const offset = i / stitches.count * count, a = Math.floor(offset), b = (a + 1) % count, mix = offset - a;
      dummy.position.copy(centers[a]).lerp(centers[b], mix);
      dummy.position.y += (heights[a] * (1 - mix) + heights[b] * mix) * .94;
      tangent.subVectors(centers[b], centers[a]).normalize();
      dummy.quaternion.setFromUnitVectors(axis, tangent);
      dummy.updateMatrix(); stitches.setMatrixAt(i, dummy.matrix);
    }
    stitches.instanceMatrix.needsUpdate = true;
  }
  // O chamador prepara ClosedPillow antes da primeira atualização da costura.
  return { group, update };
}
