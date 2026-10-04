/* Produz texturas procedurais em memória: trama do tecido e máscara térmica.
 * As texturas criadas precisam ser descartadas junto da cena para liberar memória gráfica. */
import * as THREE from 'three';
import { smooth, seededRandom } from './timeline';
const clamp = THREE.MathUtils.clamp;

// Gera trama, normais e rugosidade do tecido com semente fixa para manter a aparência.
export function fabricTextures() {
  const size = 256, random = seededRandom(5271);
  const heights = new Float32Array(size * size);
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = Math.sin(x * Math.PI / 4 + .18 * Math.sin(y * .35));
    const weft = Math.sin(y * Math.PI / 4 + .12 * Math.sin(x * .28));
    heights[y * size + x] = (warp + weft) * .38 + warp * weft * .18 + random() * .10;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
    const dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
    normal[i] = 128 - dx * 53; normal[i + 1] = 128 - dy * 53;
    normal[i + 2] = 245; normal[i + 3] = 255;
  }
  const make = (data: Uint8Array) => {
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7.5, 5); texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true; return texture;
  };
  return { normal: make(normal) };
}
// Cria a máscara de transparência da película, suavizando sua presença visual.
export function thermalMask() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1) * 2 - 1, v = y / (size - 1) * 2 - 1;
    const edge = smooth((1 - Math.max(Math.abs(u), Math.abs(v))) * 28);
    const alpha = clamp(edge, 0, 1) * 255;
    const offset = (y * size + x) * 4;
    data[offset] = 255; data[offset + 1] = alpha;
    data[offset + 2] = 255; data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true; return texture;
}
