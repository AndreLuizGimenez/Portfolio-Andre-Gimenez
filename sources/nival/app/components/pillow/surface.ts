/* Superfície da película térmica, com o contorno e a resolução aprovados. */
import * as THREE from 'three';

/** The thermal grid keeps the same Float32 buffers and distinct triangle indices.
 * Match Three.js's area-weighted normals, including accumulation order, without
 * per-triangle BufferAttribute/Vector3 calls on the mobile animation path. */
export function createSurfaceNormalUpdater(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position').array as Float32Array;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const normals = normal.array as Float32Array;
  const indices = geometry.index!.array;
  normal.setUsage(THREE.DynamicDrawUsage);
  return () => {
    normals.fill(0);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const cx = positions[c] - positions[b], cy = positions[c + 1] - positions[b + 1], cz = positions[c + 2] - positions[b + 2];
      const ax = positions[a] - positions[b], ay = positions[a + 1] - positions[b + 1], az = positions[a + 2] - positions[b + 2];
      const nx = cy * az - cz * ay, ny = cz * ax - cx * az, nz = cx * ay - cy * ax;
      normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
      normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
      normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
    }
    for (let i = 0; i < normals.length; i += 3) {
      const x = normals[i], y = normals[i + 1], z = normals[i + 2];
      const inverse = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      normals[i] = x * inverse; normals[i + 1] = y * inverse; normals[i + 2] = z * inverse;
    }
    normal.needsUpdate = true;
  };
}

export function thermalSurface() {
  const columns = 72, rows = 48, count = (columns + 1) * (rows + 1);
  const positions = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3).fill(1), indices = new Uint16Array(columns * rows * 6);
  for (let j = 0; j <= rows; j++) {
    const v = j / rows * 2 - 1;
    for (let i = 0; i <= columns; i++) {
      const u = i / columns * 2 - 1, index = j * (columns + 1) + i;
      const softX = 1 - v * v, softZ = 1 - u * u;
      const x = 1.5 * u * (1 + .062 * softX) + .018 * Math.sin(v * 4.2 + .8) * softX + .012 * v;
      const z = v * (1 + .075 * softZ) + .017 * Math.sin(u * 3.6 - .3) * softZ;
      const loft = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), .20);
      positions[index * 3] = x * .91;
      positions[index * 3 + 1] = .18 * loft + .018 * Math.sin(u * 8 + v * 6) * loft;
      positions[index * 3 + 2] = z * .91;
      uv[index * 2] = i / columns; uv[index * 2 + 1] = j / rows;
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + columns + 1, offset = (j * columns + i) * 6;
    indices[offset] = a; indices[offset + 1] = b; indices[offset + 2] = a + 1;
    indices[offset + 3] = a + 1; indices[offset + 4] = b; indices[offset + 5] = b + 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
