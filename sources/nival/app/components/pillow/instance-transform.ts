/** Write the same XYZ Euler → quaternion → matrix as Three.js directly to
 * an instance buffer, avoiding Object3D change callbacks and a second copy. */
export function writeInstanceTransform(target: Float32Array, offset: number,
  px: number, py: number, pz: number, rx: number, ry: number, rz: number,
  sx: number, sy: number, sz: number) {
  const c1 = Math.cos(rx / 2), c2 = Math.cos(ry / 2), c3 = Math.cos(rz / 2);
  const s1 = Math.sin(rx / 2), s2 = Math.sin(ry / 2), s3 = Math.sin(rz / 2);
  const x = s1 * c2 * c3 + c1 * s2 * s3, y = c1 * s2 * c3 - s1 * c2 * s3;
  const z = c1 * c2 * s3 + s1 * s2 * c3, w = c1 * c2 * c3 - s1 * s2 * s3;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  target[offset] = (1 - (yy + zz)) * sx;
  target[offset + 1] = (xy + wz) * sx;
  target[offset + 2] = (xz - wy) * sx;
  target[offset + 3] = 0;
  target[offset + 4] = (xy - wz) * sy;
  target[offset + 5] = (1 - (xx + zz)) * sy;
  target[offset + 6] = (yz + wx) * sy;
  target[offset + 7] = 0;
  target[offset + 8] = (xz + wy) * sz;
  target[offset + 9] = (yz - wx) * sz;
  target[offset + 10] = (1 - (xx + yy)) * sz;
  target[offset + 11] = 0;
  target[offset + 12] = px;
  target[offset + 13] = py;
  target[offset + 14] = pz;
  target[offset + 15] = 1;
}
