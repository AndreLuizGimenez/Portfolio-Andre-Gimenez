/* Orquestração Three.js: carrega modelos, monta câmera/luzes/materiais, enquadra o travesseiro e agenda os frames.
 * Geometria e deformações ficam em pillow/. Pausa fora de visibilidade e libera recursos ao desmontar. */
import * as THREE from 'three';
import { createMorphSamples } from './pillow/morph-samples';
import { isCompactStory } from './story-layout';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createImportedCloth, disposeObject, loadTextiles } from './pillow/imported-cloth';
import { pillowConfig } from './pillow/config';
import { createFoam } from './pillow/foam';
import { createThermalMembrane } from './pillow/thermal';
import { fabricTextures } from './pillow/textures';
import { createProjectedShadow } from './pillow/projected-shadow';
import { receiveShadowWithoutCasting } from './pillow/shadow-receivers';
import { clamp01, sampleTimeline, shellHeights, storyChapter } from './pillow/timeline';
import { createPillowAnchors, type ProjectedAnchor } from './pillow/anchors';
import { equalLayerSpacing } from './pillow/layer-spacing';
import { storyReadingStops } from './scroll-gates';

/** Renderer orchestration only. Geometry, materials and scroll choreography live in pillow/. */
export async function createPillowScene(host: HTMLElement, onFailure: () => void, signal?: AbortSignal, onAnchor?: (anchor: ProjectedAnchor, panelBottom?: number) => void) {
  const mobileQuality = window.matchMedia('(max-width: 1023px)').matches;
  const textiles = await loadTextiles(mobileQuality, signal);
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch (error) { textiles.forEach(disposeObject); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileQuality ? pillowConfig.quality.mobileDpr : pillowConfig.quality.desktopDpr));
  renderer.setClearColor(0x192b36, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = pillowConfig.light.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene(), model = new THREE.Group(); scene.add(model);
  model.name = 'Nival_reversible_material_study';
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .07);
  scene.environment = environment.texture; scene.environmentIntensity = pillowConfig.light.environment;
  room.dispose(); pmrem.dispose();
  // Lift the fabric with broad, cool ambient light so it stays clean against
  // the brighter sky-blue story palette without adding hard edge highlights.
  scene.add(new THREE.HemisphereLight(0xf1f7fa, 0x23313d, .30));
  const key = new THREE.DirectionalLight(0xf4f8ff, pillowConfig.light.key);
  key.position.set(-3.8, 5.4, 4.6); key.castShadow = true;
  const shadowSize=mobileQuality?512:pillowConfig.quality.shadowSize;
  key.shadow.mapSize.set(shadowSize,shadowSize);
  Object.assign(key.shadow.camera, { left: -3.1, right: 3.1, top: 3.1, bottom: -3.1, near: .5, far: 16 });
  key.shadow.bias = -.00015; key.shadow.normalBias = .025;
  key.shadow.radius = mobileQuality?5:10; key.shadow.blurSamples = mobileQuality?6:12; key.shadow.intensity = .48;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbedbef, pillowConfig.light.fill);
  fill.position.set(4, 1.6, 2.5); scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xe0ebf0, .24);
  bounce.position.set(-1, -3, 4); scene.add(bounce);
  const rim = new THREE.DirectionalLight(0xb8daef, pillowConfig.light.rim);
  rim.position.set(.5, 4, -4); scene.add(rim);

  const weave = fabricTextures();
  for (const texture of Object.values(weave)) texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const upper = createImportedCloth(textiles[0], true, anisotropy, weave.normal);
  const lower = createImportedCloth(textiles[1], false, anisotropy, weave.normal);
  const stage = host.closest<HTMLElement>('.story-stage');
  const section = host.closest<HTMLElement>('.story');
  const content = host.closest<HTMLElement>('.story-content');
  let lowerTextile: THREE.Mesh | undefined, upperTextile: THREE.Mesh | undefined;
  lower.group.traverse(node => { if (!lowerTextile && node instanceof THREE.Mesh && node.morphTargetInfluences) lowerTextile = node; });
  upper.group.traverse(node => { if (!upperTextile && node instanceof THREE.Mesh && node.morphTargetInfluences) upperTextile = node; });
  // Center the actual two fabric shells. Their seam details are decorative
  // child meshes and must not skew the measured product silhouette.
  const outerTextiles = [upperTextile, lowerTextile].filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
  const centerSamples = outerTextiles.map(mesh => ({ mesh, samples: createMorphSamples(mesh, 420) }));
  const worldToCamera = new THREE.Matrix4();
  const horizontalPoint = new THREE.Vector3(), cameraPoint = new THREE.Vector3(), cameraRight = new THREE.Vector3(), cameraUp = new THREE.Vector3();
  const projectedXs: number[] = [], projectedYs: number[] = [], projectedDepths: number[] = [];
  let mobileTargetNdcWidth = Infinity;
  let lastPanelBottom = -1, panelBase = 0;
  let lastWidth = 0, lastHeight = 0, hostTop = 0;
  let pillowBottom = .5, lastPillowBottom = -1;
  // Amostra as capas deformadas para centralizar a silhueta real e manter seu enquadramento.
  function centerPillowProjection() {
    model.position.set(0, .50, 0);
    model.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, depthTotal = 0, samples = 0;
    for (const { mesh, samples: sampler } of centerSamples) {
      const positions = sampler.read();
      worldToCamera.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
      for (let i = 0; i < positions.length; i += 3) {
        cameraPoint.fromArray(positions, i).applyMatrix4(worldToCamera);
        depthTotal += -cameraPoint.z;
        horizontalPoint.copy(cameraPoint).applyMatrix4(camera.projectionMatrix);
        projectedXs[samples] = horizontalPoint.x;
        projectedYs[samples] = horizontalPoint.y;
        projectedDepths[samples++] = -cameraPoint.z;
        left = Math.min(left, horizontalPoint.x); right = Math.max(right, horizontalPoint.x);
        bottom=Math.min(bottom,horizontalPoint.y);top=Math.max(top,horizontalPoint.y);
      }
    }
    if (!samples || !Number.isFinite(left + right)) return;
    const averageDepth = depthTotal / samples;
    const projectionX = camera.projectionMatrix.elements[0];
    const projectionY = camera.projectionMatrix.elements[5];
    let correction = 0, correctionY = 0;
    // Refine the silhouette center using the already sampled vertices. This
    // accounts for perspective depth without resampling the animated meshes.
    for (let pass = 0; pass < 5; pass++) {
      left = bottom = Infinity; right = top = -Infinity;
      for (let i = 0; i < samples; i++) {
        const x = projectedXs[i] + correction * projectionX / projectedDepths[i];
        const y = projectedYs[i] + correctionY * projectionY / projectedDepths[i];
        left = Math.min(left, x); right = Math.max(right, x);
        bottom = Math.min(bottom, y); top = Math.max(top, y);
      }
      const center = (left + right) * .5, centerY = (top + bottom) * .5;
      if (Math.max(Math.abs(center), Math.abs(centerY)) < .00001 || pass === 4) break;
      correction -= center * averageDepth / projectionX;
      correctionY -= centerY * averageDepth / projectionY;
    }
    // Compact screens frame the actual silhouette almost edge to edge.
    // Keep the open layers inside the canvas, including room for the shadow.
    if (compact) {
      const fit = Math.min(mobileTargetNdcWidth / (right - left), 1.76 / (top - bottom));
      camera.zoom *= fit;
      camera.updateProjectionMatrix();
      // Reuse the fitted silhouette already sampled for framing; captions
      // need its visible lower edge, without another mesh or DOM scan.
      pillowBottom = (1 - bottom * fit) * .5;
    }
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    model.position.addScaledVector(cameraRight, correction);
    cameraUp.setFromMatrixColumn(camera.matrixWorld,1).normalize();
    model.position.addScaledVector(cameraUp,correctionY);
    model.updateMatrixWorld(true);
  }
  const foam = createFoam(mobileQuality), thermal = createThermalMembrane(weave.normal);
  foam.group.traverse(node => {
    if (node instanceof THREE.InstancedMesh) receiveShadowWithoutCasting(node);
  });
  model.add(upper.group, lower.group, foam.group, thermal.mesh);
  const projectedShadow = createProjectedShadow(lowerTextile, key);
  const projectAnchor = createPillowAnchors(upper.group, lower.group, foam.group, thermal.mesh);
  let disposed = false, ready = false, visible = true, dirty = true, compact = isCompactStory();
  let progress = 0, entrance = 1, activeChapter = 0, frame = 0, previousTime = 0, previousDraw = performance.now();
  let residual = 0, velocity = 0, impulse = 0, frameZoom = 1;
  let exitTop = .2;
  // Calcula as distâncias entre camadas conforme o layout compacto ou largo.
  function layerLayout(isCompact: boolean) {
    const spacing = isCompact ? pillowConfig.separation.mobileFactor : 1;
    const finalShells = shellHeights(sampleTimeline(1));
    return equalLayerSpacing(
      finalShells.upper * spacing + upper.innerEdge,
      finalShells.lower * spacing + lower.innerEdge,
      foam.packedBounds, thermal.finalBounds,
    );
  }
  let layout = layerLayout(compact);
  // Solicita um frame apenas quando a cena pode renderizar e ainda não há outro pendente.
  function schedule() {
    if (!disposed && !frame && ready && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  // Atualiza pose, oscilação residual, peças, câmera e sombra antes de desenhar o frame.
  function render(now: number, preparing = false, driven = false) {
    frame = 0;
    if (disposed || (!preparing && (!visible || document.hidden))) return;
    // The active scroll/opening clock supplies the current pose below. A
    // residual callback queued earlier must not paint the previous pose first.
    const classes=document.documentElement.classList;
    if(!preparing&&!driven&&(classes.contains('scroll-animating')||classes.contains('touch-scrolling')||section?.classList.contains('is-opening'))){schedule();return;}
    const dt = Math.min(.033, Math.max(.001, (now - (previousTime || now - 16)) / 1000));
    previousTime = now;
    // A bounded, damped cloth mode responds to scroll changes. The main pose never integrates time.
    velocity = THREE.MathUtils.clamp(velocity + impulse, -4, 4); impulse = 0;
    velocity += (-65 * residual - 13 * velocity) * dt;
    residual = THREE.MathUtils.clamp(residual + velocity * dt, -.7, .7);
    const settling = Math.abs(residual) + Math.abs(velocity) > .002;
    if (!settling) residual = velocity = 0;
    if (dirty || settling) {
      const pose = sampleTimeline(progress), spacing = compact ? pillowConfig.separation.mobileFactor : 1;
      // Close from the first upward pixel, including the reading hold after
      // the opening animation has already reached its fully open pose.
      pose.open *= entrance;
      pose.pull = Math.sin(Math.PI * pose.open);
      const zoom = frameZoom * (1 + (pillowConfig.closed.zoom - 1) * (1 - pose.open));
      if (Math.abs(camera.zoom - zoom) > .0001) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
      upper.update(pose, residual, spacing); lower.update(pose, residual * .45, spacing);
      foam.update(pose, upper.boundary, lower.boundary, layout.foamY, spacing); thermal.update(pose, residual, spacing, layout.thermalY, upper.wind.weights);
      // Keep both shells still on screen while the final two inner layers settle.
      const orbit = Math.min(progress, .60);
      model.rotation.set(.015 + Math.sin(orbit * Math.PI) * .035, -.16 + Math.sin(orbit * Math.PI) * .22, -.035 + Math.sin(orbit * Math.PI) * .018);
      centerPillowProjection();
      if (compact && stage) {
        const visibleBottom = hostTop + pillowBottom * lastHeight;
        if (Math.abs(visibleBottom - lastPillowBottom) > .1) {
          stage.style.setProperty('--story-pillow-bottom', `${visibleBottom.toFixed(2)}px`);
          lastPillowBottom = visibleBottom;
        }
        if (Math.abs(panelBase - lastPanelBottom) > .25) {
          stage.style.setProperty('--story-panel-bottom', `${panelBase}px`);
          lastPanelBottom = panelBase;
        }
      }
      // Paint the base projection behind the pillow using the same current
      // transforms, so the shadow follows opening, rotation and centering.
      renderer.autoClear = false;
      renderer.clear();
      projectedShadow.render(renderer, camera, model, lower.group.position.y + lower.bottomEdge - .16);
      renderer.render(scene, camera);
      renderer.autoClear = true;
      dirty = false;
      if (!preparing) {
        const anchor = projectAnchor(activeChapter, camera);
        if (compact) anchor.pillowBottom = pillowBottom;
        onAnchor?.(anchor, compact ? lastPanelBottom : undefined);
      }
    }
    if (settling) schedule();
    else previousTime = 0;
  }
  // Recebe progresso da página e marca a cena para atualizar, sem usar estado React por frame.
  function draw(value: number, entry = 1, chapter = storyChapter(value), immediate = false) {
    if (disposed) return;
    // The final reading pose is also the exit pose. Reuse its pixels while
    // the page leaves instead of creating new cloth impulses and shadow passes.
    const next = Math.min(storyReadingStops[2], clamp01(value));
    // Entrance is a CSS translation of the canvas. A closed model has the
    // same pose throughout that trip, so reuse its already rendered pixels.
    const nextEntrance = next === 0 ? 1 : clamp01(entry);
    if (next === progress && nextEntrance === entrance && chapter === activeChapter) return;
    const now = performance.now();
    const elapsed = Math.max(.016, (now - previousDraw) / 1000);
    // Fast anchor jumps reset the residual rather than jolting the fabric.
    if (Math.abs(next - progress) < .13 && elapsed < .25) impulse += (next - progress) * 17;
    else residual = velocity = impulse = 0;
    progress = next; entrance = nextEntrance; activeChapter = chapter; previousDraw = now; dirty = true;
    // Scroll and GSAP already run in an animation frame. Paint their pose in
    // that frame, cancelling a pending cloth frame instead of drawing twice.
    if(immediate&&ready&&visible&&!document.hidden){cancelAnimationFrame(frame);frame=0;render(now,false,true);}
    else schedule();
  }
  // Atualiza dimensões, enquadramento e limites da cena quando o espaço disponível muda.
  function resize() {
    if (disposed) return;
    const width = host.clientWidth, height = host.clientHeight, top = host.offsetTop;
    if (!width || !height) return;
    const style=stage?getComputedStyle(stage):null;
    const nextBase=Number.parseFloat(style?.getPropertyValue('--story-panel-base')??'')||(stage?.clientHeight??height)*.5;
    if(width===lastWidth&&height===lastHeight&&top===hostTop&&nextBase===panelBase)return;
    const nextCompact=isCompactStory();
    const reframing=width!==lastWidth||height!==lastHeight||nextCompact!==compact;
    const resized=width!==lastWidth||height!==lastHeight;
    lastWidth=width;lastHeight=height;hostTop=top;
    panelBase=nextBase;
    // Caption reserves can change without changing the canvas. Do not resize
    // the GPU buffer or sample four model poses for a footer-only measurement.
    if(!reframing){lastPanelBottom=-1;dirty=true;schedule();return;}
    compact = nextCompact;
    layout = layerLayout(compact);
    if(resized)renderer.setSize(width,height);
    camera.aspect = width / height;
    mobileTargetNdcWidth = 2 * Math.max(1, (stage?.clientWidth ?? width) - 2 * pillowConfig.framing.mobileEdgePx) / width;
    // Keep the product large, then fit only if the shorter panel requires it.
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const framingHeight = compact ? Math.min(height, (content?.clientHeight??height) * .375) : height;
    frameZoom = compact ? framingHeight / height * 1.08 : Math.min(1.16, camera.aspect * .91);
    // Desktop retains its established scale. Compact layouts fit the measured
    // silhouette to the available width and height in centerPillowProjection.
    const distance = 1.65 / halfFov * (compact ? 1 : 1.06);
    camera.position.set(2.65, 2.65, 7.4).normalize().multiplyScalar(distance);
    camera.lookAt(0, .18, 0); camera.zoom = frameZoom; camera.updateProjectionMatrix();
    // Reserve enough visible space for the whole closing silhouette, measured
    // only on resize rather than scanning the mesh during each scroll frame.
    exitTop=1;
    const point=new THREE.Vector3(), spacing=compact?pillowConfig.separation.mobileFactor:1;
    for(const value of [0,.15,.30]){
      const pose=sampleTimeline(value);
      upper.update(pose,0,spacing);lower.update(pose,0,spacing);
      model.rotation.set(.015+Math.sin(value*Math.PI)*.035,-.16+Math.sin(value*Math.PI)*.22,-.035+Math.sin(value*Math.PI)*.018);
      model.position.y=.50;model.updateMatrixWorld(true);
      camera.zoom=frameZoom*(1+(pillowConfig.closed.zoom-1)*(1-pose.open));
      camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      centerPillowProjection();
      for(const shell of [upper.group,lower.group])shell.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        const positions=node.geometry.getAttribute('position');
        for(let i=0,stride=Math.max(1,Math.floor(positions.count/640));i<positions.count;i+=stride){
          node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld).project(camera);
          if(Math.abs(point.x)<=1)exitTop=Math.min(exitTop,(1-point.y)/2);
        }
      });
    }
    lastPanelBottom = -1;
    ready = dirty = true; schedule();
  }
  // Compile every layer while preparing the scene, including the thermal
  // material that only becomes visible in the third pose. Avoid a shader
  // compilation hitch on the user's first traversal.
  await renderer.compileAsync(scene, camera).catch(() => {});
  await projectedShadow.compile(renderer, camera).catch(() => {});
  const lost = (event: Event) => { event.preventDefault(); onFailure(); };
  // Cancela a atividade de renderização enquanto a cena não deve desenhar.
  function suspend() {
    if (frame) cancelAnimationFrame(frame);
    frame = previousTime = 0; residual = velocity = impulse = 0;
  }
  // Pausa em segundo plano e retoma a cena quando o documento volta a ficar visível.
  function visibilityChanged() {
    if (document.hidden) suspend();
    else { dirty = true; schedule(); }
  }
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
  document.addEventListener('visibilitychange', visibilityChanged);
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(host);
  stage?.addEventListener('storylayoutchange',resize);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) { dirty = true; schedule(); } else suspend();
  }, { rootMargin: '100px' });
  visibilityObserver.observe(host); resize();

  return {
    draw,
    // Run real color/shadow passes behind the loader after the host has its
    // final layout. compileAsync alone does not upload all buffers/textures
    // or prepare the shadow programs; doing that on entry stalls the scroll.
    prepare() {
      if (disposed) return;
      resize();
      if (!ready) return;
      cancelAnimationFrame(frame); frame = 0;
      const initialProgress = progress;
      for (const value of [storyReadingStops[2], initialProgress]) {
        progress = value; dirty = true;
        render(performance.now(), true);
      }
    },
    get exitTop() { return exitTop; },
    // Cancela observadores/animações e libera os recursos pertencentes a este módulo; necessário ao desmontar ou recriar.
    dispose() {
      disposed = true; suspend(); sizeObserver.disconnect(); visibilityObserver.disconnect();
      stage?.removeEventListener('storylayoutchange',resize);
      stage?.style.removeProperty('--story-panel-bottom');
      stage?.style.removeProperty('--story-pillow-bottom');
      document.removeEventListener('visibilitychange', visibilityChanged);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
      scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          geometries.add(node.geometry);
          if (Array.isArray(node.material)) node.material.forEach(material => materials.add(material));
          else materials.add(node.material);
          if (node instanceof THREE.InstancedMesh) node.dispose();
        }
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      const textures = new Set([...Object.values(weave), ...upper.textures, ...lower.textures, ...foam.textures, ...thermal.textures]);
      textures.forEach(texture => { texture.dispose(); const image = texture.source.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); }); key.shadow.dispose();
      projectedShadow.dispose();
      environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
