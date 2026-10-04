/* Aparência e distribuição da espuma: textura porosa, geometrias de floco, ajuste de iluminação e posições iniciais. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './timeline';

/** Fine open-cell texture. Pores are shallow and matte, never rock-like craters. */
// Gera poros e mapas de material uma vez na criação; não deve ser chamado em cada frame.
export function foamTextures() {
  const size = 256, cells = 24, random = seededRandom(455);
  const sites = Array.from({ length: cells * cells }, () => ({ x: .2 + random() * .6, y: .2 + random() * .6, radius: .17 + random() * .2 }));
  const color = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * cells, v = y / size * cells;
    const a = Math.floor(u), b = Math.floor(v);
    let pore = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const site = sites[((b + dz + cells) % cells) * cells + (a + dx + cells) % cells];
      const distance = Math.hypot(u - a - dx - site.x, v - b - dz - site.y);
      const cavity = Math.max(0, 1 - distance / site.radius);
      pore = Math.max(pore, cavity * cavity);
    }
    const grain = random();
    const c = 248 - pore * 58 - grain * 7;
    const offset = (y * size + x) * 4;
    color[offset] = c; color[offset + 1] = c + 1;
    color[offset + 2] = c + 1; color[offset + 3] = 255;
  }
  const make = (pixels: Uint8Array) => {
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
    return texture;
  };
  const albedo = make(color); albedo.colorSpace = THREE.SRGBColorSpace;
  return { albedo };
}

/** Torn, slightly compressed chips with broad cut faces and soft narrow edges. */
// Cria uma variante determinística do floco; compartilhar variantes evita uma geometria por instância.
export function foamChipGeometry(variant: number) {
  const random = seededRandom(1401 + variant * 311);
  const sides = 20, outline: THREE.Vector2[] = [];
  const offset = random() * Math.PI * 2;
  const notch = random() * Math.PI * 2;
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    const cut = Math.max(0, Math.cos(angle - notch)) ** 12;
    const radius = .94 + .11 * Math.sin(angle * 3 + offset)
      + .065 * Math.sin(angle * 7 - offset) + .04 * (random() - .5) - .22 * cut;
    outline.push(new THREE.Vector2(Math.sign(c) * Math.abs(c) ** .72 * radius, Math.sign(s) * Math.abs(s) ** .80 * radius * .78));
  }
  // Broad, gently bent faces and fine torn edges keep the flakes soft and thin.
  const rings = [{ y: -.35, inset: .82 }, { y: -.25, inset: 1 }, { y: .19, inset: 1 }, { y: .32, inset: .80 }];
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const ring of rings) for (const p of outline) {
    const bend = .11 * Math.sin(p.x * 2 + variant) + .13 * p.x * p.y;
    const taper = 1 + .12 * p.x * Math.sin(variant + .5);
    vertices.push(p.x * ring.inset + ring.y * .10 * Math.sin(variant), ring.y * taper + bend, p.y * ring.inset);
    uv.push(p.x * .46 + .5, p.y * .58 + .5);
  }
  const lowerCenter = vertices.length / 3;
  vertices.push(0, -.35 + .11 * Math.sin(variant), 0, 0, .32 + .11 * Math.sin(variant), 0);
  uv.push(.5, .5, .5, .5);
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    for (let ring = 0; ring < rings.length - 1; ring++) {
      const a = ring * sides + i, b = ring * sides + next, c = (ring + 1) * sides + i, d = (ring + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
    indices.push(lowerCenter, i, next, lowerCenter + 1, (rings.length - 1) * sides + next, (rings.length - 1) * sides + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // Project each cut face independently so the narrow sides also have pores.
  // Preserve the shared smooth normals across UV seams.
  const mapped = geometry.toNonIndexed();
  const positions = mapped.getAttribute('position'), mappedUV = mapped.getAttribute('uv');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    b.sub(a); c.sub(a); b.cross(c).normalize();
    const axis = Math.abs(b.y) > Math.max(Math.abs(b.x), Math.abs(b.z)) ? 'y' : Math.abs(b.x) > Math.abs(b.z) ? 'x' : 'z';
    for (let j = i; j < i + 3; j++) {
      a.fromBufferAttribute(positions, j);
      mappedUV.setXY(j, (axis === 'x' ? a.z : a.x) * .46 + .5, (axis === 'y' ? a.z : a.y) * .58 + .5);
    }
  }
  // Containment is measured around the instance origin, not the bounding-box center.
  let radius = 0;
  for (let i = 0; i < vertices.length; i += 3) radius = Math.max(radius, Math.hypot(vertices[i], vertices[i + 1], vertices[i + 2]));
  mapped.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
  // Reuse identical vertex attributes after UV projection. UV seams and
  // normals stay intact, but 2,100 instances no longer repeat every triangle
  // vertex through the lighting shader on each mobile frame.
  const indexed = mergeVertices(mapped, 1e-7);
  indexed.boundingSphere = mapped.boundingSphere.clone();
  geometry.dispose(); mapped.dispose();
  return indexed;
}

/** Preserve the approved envelope lighting once gathered; softly define loose pieces. */
// Ajusta o shader do material para transitar entre espuma solta e agrupada sem mudar a geometria.
export function softenFoamLight(material: THREE.MeshPhysicalMaterial) {
  const assembly = { value: 1 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uFoamAssembly = assembly;
    // Position in the shared foam volume keeps the gradient continuous across
    // every flake, including while the instances move during opening.
    const varyings = 'varying vec3 vFoamVolumePosition;\nvarying vec3 vFoamVolumeNormal;\n';
    shader.vertexShader = `${varyings}${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#ifdef USE_INSTANCING
        vFoamVolumePosition = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vFoamVolumePosition = transformed;
      #endif
      vec3 foamExtent = vec3(1.32, 0.32, 0.86);
      vec3 foamShape = (vFoamVolumePosition - vec3(0.0, 0.06, 0.0)) / foamExtent;
      vec3 foamEnvelopeNormal = sign(foamShape) * pow(abs(foamShape), vec3(3.0, 1.0, 3.0)) / foamExtent;
      foamEnvelopeNormal = normalize(foamEnvelopeNormal + vec3(0.0, 0.0001, 0.0));
      // A broad upward diffuse lobe also prevents a dark serrated underside.
      foamEnvelopeNormal = normalize(mix(vec3(0.0, 1.0, 0.0), foamEnvelopeNormal, 0.40));
      vFoamVolumeNormal = normalize(normalMatrix * foamEnvelopeNormal);
      #include <project_vertex>`,
    );
    shader.fragmentShader = `uniform float uFoamAssembly;\n${varyings}${shader.fragmentShader}`.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        // Continuous pores on the shared volume, rather than a repeated material per chip.
        vec3 foamTopTexture = texture2D(map, vFoamVolumePosition.xz * 2.4).rgb;
        vec3 foamFrontTexture = texture2D(map, vFoamVolumePosition.xy * 2.4).rgb;
        float foamTopBlend = smoothstep(0.02, 0.28, vFoamVolumePosition.y);
        diffuseColor.rgb *= mix(foamFrontTexture, foamTopTexture, foamTopBlend);
      #endif`,
    ).replace('#include <normal_fragment_maps>', `
      // A small diffuse definition makes the loose pieces readable. It resolves
      // to the exact shared-volume shading as the filling gathers; no self-shadow.
      normal = normalize(mix(vFoamVolumeNormal, normal, (1.0 - uFoamAssembly) * 0.28));
      nonPerturbedNormal = normal;
    `);
    // Keep the actual studio-light direction. Only the broad shadow cast by the
    // cover reaches the foam, at a fraction of the scene's shadow intensity.
    const foamLighting = THREE.ShaderChunk.lights_fragment_begin.replaceAll(
      'directionalLightShadow.shadowIntensity',
      '(directionalLightShadow.shadowIntensity * 0.28)',
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', foamLighting);
  };
  material.customProgramCacheKey = () => 'nival-foam-matte-construction-v5';
  return assembly;
}

/** Jittered packing avoids the previous top/middle/bottom bands and large clumps. */
// Distribui os flocos em posições com variação controlada, evitando fileiras visualmente regulares.
export function foamPacking(count: number) {
  const random = seededRandom(802), columns = Math.ceil(Math.cbrt(count * 9));
  const rows = Math.ceil(columns * 2 / 3), levels = Math.ceil(count / (columns * rows) * 1.18);
  const points: { x: number; y: number; z: number; level: number }[] = [];
  for (let iy = 0; iy < levels; iy++) for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < columns; ix++) {
    const u = ((ix + .10 + random() * .80) / columns * 2 - 1);
    const v = ((iz + .10 + random() * .80) / rows * 2 - 1);
    const edge = Math.abs(u) ** 6 + Math.abs(v) ** 6;
    if (edge > .985) continue;
    const level = (iy + .05 + random() * .9) / levels * 2 - 1;
    const fullness = Math.max(0, 1 - edge) ** .28;
    points.push({ x: u * 1.23, z: v * .79, y: level * .255 * fullness + .06 + .012 * Math.sin(u * 4 + v * 3), level });
  }
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  if (points.length < count) throw new Error('Insufficient foam packing samples');
  return points.slice(0, count);
}
