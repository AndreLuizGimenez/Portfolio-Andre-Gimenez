/* Projeta a silhueta real da base para formar a sombra de apoio, sem projetar todas as camadas explodidas. */
import * as THREE from 'three';

/** Project the base's actual silhouette without casting the exploded layers
 * onto the backdrop. The main scene keeps its own inter-layer shadows. */
export function createProjectedShadow(base: THREE.Mesh | undefined, key: THREE.DirectionalLight) {
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight(key.color, 0);
  light.position.copy(key.position);
  light.target.position.copy(key.target.position);
  light.castShadow = true;
  light.shadow = key.shadow.clone();
  scene.add(light, light.target);

  const receiver = new THREE.Mesh(
    // Bounds include both textile tiers, every pose and the largest cloth
    // residual, plus room for the VSM penumbra. A full-viewport transparent
    // receiver would shade pixels that cannot contain a projected shadow.
    new THREE.PlaneGeometry(4.5, 3.5),
    new THREE.ShadowMaterial({ color: 0x091520, opacity: .38, depthWrite: false }),
  );
  receiver.name = 'Pillow_projected_base_shadow';
  receiver.receiveShadow = true;
  receiver.matrixAutoUpdate = false;
  scene.add(receiver);

  // Invisible in the color pass; its geometry and live morphs still cast a
  // real shadow. Geometry is shared with the base and owned by the main scene.
  const casterMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false,
    side: THREE.DoubleSide, shadowSide: THREE.FrontSide,
  });
  const caster = base ? new THREE.Mesh(base.geometry, casterMaterial) : undefined;
  if (caster) {
    caster.castShadow = true;
    caster.matrixAutoUpdate = false;
    caster.frustumCulled = false;
    scene.add(caster);
  }
  const localPlane = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

  return {
    compile(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
      return renderer.compileAsync(scene, camera);
    },
    // Atualiza a silhueta de sombra usando as transformações atuais da base e desenha o passe separado.
    render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, model: THREE.Group, floorY: number) {
      if (!base || !caster) return;
      // Both use current world transforms, after the pillow is centered.
      // This keeps the projection attached during rotation, opening and resize.
      caster.matrix.copy(base.matrixWorld);
      caster.morphTargetInfluences = base.morphTargetInfluences;
      localPlane.setPosition(0, floorY, 0);
      receiver.matrix.multiplyMatrices(model.matrixWorld, localPlane);
      renderer.render(scene, camera);
    },
    // Cancela observadores/animações e libera os recursos pertencentes a este módulo; necessário ao desmontar ou recriar.
    dispose() {
      receiver.geometry.dispose();
      receiver.material.dispose();
      casterMaterial.dispose();
      light.shadow.dispose();
    },
  };
}
