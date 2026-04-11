export function createViewCubeFeature({
  scene,
  engine,
  mainCamera,
  onStandardViewRequested
}) {
  if (!scene || !engine || !mainCamera) {
    throw new Error("createViewCubeFeature requires scene, engine and mainCamera");
  }

  const viewCubeLayerMask = 0x20000000;
  const viewCubeSize = 1.2;
  const orthoBetaEpsilon = 0.001;
  mainCamera.layerMask = 0x0FFFFFFF;

  const viewCubeCamera = new BABYLON.ArcRotateCamera(
    "viewCubeCamera",
    mainCamera.alpha,
    mainCamera.beta,
    2.6,
    BABYLON.Vector3.Zero(),
    scene
  );
  viewCubeCamera.layerMask = viewCubeLayerMask;
  viewCubeCamera.minZ = 0.01;
  viewCubeCamera.maxZ = 10;
  viewCubeCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  viewCubeCamera.inputs.clear();

  function updateViewCubeOrthoFrustum() {
    const rw = Math.max(engine.getRenderWidth(), 1);
    const rh = Math.max(engine.getRenderHeight(), 1);
    const vp = viewCubeCamera.viewport;
    const viewportAspect = vp && vp.width > 0 && vp.height > 0
      ? (vp.width * rw) / (vp.height * rh)
      : 1;

    const halfHeight = 0.95;
    const halfWidth = halfHeight * viewportAspect;

    viewCubeCamera.orthoLeft = -halfWidth;
    viewCubeCamera.orthoRight = halfWidth;
    viewCubeCamera.orthoBottom = -halfHeight;
    viewCubeCamera.orthoTop = halfHeight;
  }

  function updateViewport() {
    const rw = Math.max(engine.getRenderWidth(), 1);
    const rh = Math.max(engine.getRenderHeight(), 1);
    const pixelSize = 112;
    const margin = 12;
    const vw = Math.min(pixelSize / rw, 0.25);
    const vh = Math.min(pixelSize / rh, 0.25);
    const vx = Math.max(1 - vw - (margin / rw), 0);
    const vy = Math.max(1 - vh - (margin / rh), 0);
    viewCubeCamera.viewport = new BABYLON.Viewport(vx, vy, vw, vh);
    updateViewCubeOrthoFrustum();
  }

  function markAsViewerHelper(node) {
    if (!node) return;
    node.metadata = { ...(node.metadata || {}), viewerHelper: true };
  }

  const viewCube = BABYLON.MeshBuilder.CreateBox("viewCube", { size: viewCubeSize }, scene);
  markAsViewerHelper(viewCube);
  viewCube.layerMask = viewCubeLayerMask;
  viewCube.isPickable = true;

  const viewCubeMat = new BABYLON.StandardMaterial("viewCubeMat", scene);
  viewCubeMat.diffuseColor = new BABYLON.Color3(0.86, 0.88, 0.92);
  viewCubeMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  viewCubeMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.1);
  viewCubeMat.alpha = 1;
  viewCubeMat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
  viewCube.material = viewCubeMat;

  viewCube.enableEdgesRendering();
  viewCube.edgesColor = new BABYLON.Color4(0.05, 0.05, 0.06, 1);
  viewCube.edgesWidth = 1.2;

  function createFaceLabel(text, position, rotation) {
    const plane = BABYLON.MeshBuilder.CreatePlane(`viewCubeFace_${text}`, { size: viewCubeSize * 0.66 }, scene);
    plane.parent = viewCube;
    plane.position.copyFrom(position);
    plane.rotation.copyFrom(rotation);
    plane.isPickable = false;
    markAsViewerHelper(plane);
    plane.layerMask = viewCubeLayerMask;
    const mat = new BABYLON.StandardMaterial(`viewCubeFaceMat_${text}`, scene);
    mat.diffuseColor = new BABYLON.Color3(0.96, 0.97, 0.99);
    mat.emissiveColor = new BABYLON.Color3(0.96, 0.97, 0.99);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.backFaceCulling = true;
    mat.disableLighting = true;
    plane.material = mat;

    const uiTexture = BABYLON.GUI?.AdvancedDynamicTexture?.CreateForMesh
      ? BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 512, 512, false)
      : null;

    if (uiTexture && BABYLON.GUI.TextBlock && BABYLON.GUI.Rectangle) {
      const badge = new BABYLON.GUI.Rectangle(`viewCubeFaceBadge_${text}`);
      badge.width = 0.98;
      badge.height = 0.66;
      badge.cornerRadius = 22;
      badge.thickness = 5;
      badge.color = "#4f5d70";
      badge.background = "#f6f8fb";

      const textBlock = new BABYLON.GUI.TextBlock(`viewCubeFaceText_${text}`, text);
      textBlock.color = "#1f2f44";
      textBlock.fontFamily = "Arial";
      textBlock.fontWeight = "700";
      textBlock.fontSize = text.length > 5 ? 96 : 120;
      textBlock.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      textBlock.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

      badge.addControl(textBlock);
      uiTexture.addControl(badge);
      return { plane, mat, uiTexture };
    }

    // Fallback when GUI module is unavailable.
    const fallbackTexture = new BABYLON.DynamicTexture(`viewCubeFaceTex_${text}`, { width: 256, height: 256 }, scene, true);
    fallbackTexture.hasAlpha = true;
    fallbackTexture.updateSamplingMode(BABYLON.Texture.BILINEAR_SAMPLINGMODE);
    fallbackTexture.drawText(text, null, 152, "bold 72px Arial", "#243140", "transparent", true, true);
    mat.diffuseTexture = fallbackTexture;

    return { plane, mat, texture: fallbackTexture };
  }

  const faceOffset = (viewCubeSize * 0.5) + 0.002;
  const faceLabels = [
    createFaceLabel("TOP", new BABYLON.Vector3(0, faceOffset, 0), new BABYLON.Vector3(Math.PI / 2, 0, 0)),
    createFaceLabel("BOTTOM", new BABYLON.Vector3(0, -faceOffset, 0), new BABYLON.Vector3(-Math.PI / 2, 0, 0)),
    createFaceLabel("FRONT", new BABYLON.Vector3(0, 0, faceOffset), new BABYLON.Vector3(0, Math.PI, 0)),
    createFaceLabel("BACK", new BABYLON.Vector3(0, 0, -faceOffset), new BABYLON.Vector3(0, 0, 0)),
    createFaceLabel("LEFT", new BABYLON.Vector3(faceOffset, 0, 0), new BABYLON.Vector3(0, -Math.PI / 2, 0)),
    createFaceLabel("RIGHT", new BABYLON.Vector3(-faceOffset, 0, 0), new BABYLON.Vector3(0, Math.PI / 2, 0))
  ];

  const viewCubeLight = new BABYLON.HemisphericLight("viewCubeLight", new BABYLON.Vector3(0, 1, 0), scene);
  markAsViewerHelper(viewCubeLight);
  viewCubeLight.layerMask = viewCubeLayerMask;
  viewCubeLight.intensity = 1.0;

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let value = angle % twoPi;
    if (value <= -Math.PI) value += twoPi;
    if (value > Math.PI) value -= twoPi;
    return value;
  }

  function animateMainCameraTo(alphaTarget, betaTarget, options = {}) {
    const { preserveAlpha = false } = options;
    const clampedBeta = BABYLON.Scalar.Clamp(betaTarget, orthoBetaEpsilon, Math.PI - orthoBetaEpsilon);

    const currentAlpha = mainCamera.alpha;
    const alphaDelta = Math.atan2(Math.sin(alphaTarget - currentAlpha), Math.cos(alphaTarget - currentAlpha));
    const adjustedTargetAlpha = normalizeAngle(currentAlpha + alphaDelta);

    const frameRate = 60;
    const frameCount = 14;
    const easing = new BABYLON.CubicEase();
    easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    if (!preserveAlpha && Math.abs(alphaDelta) > 0.0005) {
      BABYLON.Animation.CreateAndStartAnimation(
        "viewCubeAlpha",
        mainCamera,
        "alpha",
        frameRate,
        frameCount,
        currentAlpha,
        adjustedTargetAlpha,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        easing
      );
    }

    BABYLON.Animation.CreateAndStartAnimation(
      "viewCubeBeta",
      mainCamera,
      "beta",
      frameRate,
      frameCount,
      mainCamera.beta,
      clampedBeta,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      easing
    );
  }

  function resolveViewNameFromNormal(normal) {
    if (!normal) return null;
    const n = normal.normalize();
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);

    if (ax >= ay && ax >= az) {
      // +/-X -> right/left
      return n.x >= 0 ? "left" : "right";
    }

    if (ay >= ax && ay >= az) {
      // +/-Y -> top/bottom
      return n.y >= 0 ? "top" : "bottom";
    }

    // +/-Z -> front/back
    return n.z >= 0 ? "front" : "back";
  }

  function getOrientationForViewName(viewName) {
    const map = {
      top: { alpha: 0, beta: orthoBetaEpsilon, preserveAlpha: true },
      bottom: { alpha: 0, beta: Math.PI - orthoBetaEpsilon, preserveAlpha: true },
      front: { alpha: Math.PI / 2, beta: Math.PI / 2 },
      back: { alpha: -Math.PI / 2, beta: Math.PI / 2 },
      left: { alpha: Math.PI, beta: Math.PI / 2 },
      right: { alpha: 0, beta: Math.PI / 2 }
    };
    return map[viewName] || null;
  }

  function resolveViewNameFromPick(cubePick) {
    if (!cubePick || !cubePick.hit) return null;

    const normal = cubePick.getNormal?.(true, true);
    if (normal) {
      const byNormal = resolveViewNameFromNormal(normal);
      if (byNormal) return byNormal;
    }

    if (!cubePick.pickedPoint) return null;

    const local = BABYLON.Vector3.TransformCoordinates(
      cubePick.pickedPoint,
      viewCube.getWorldMatrix().clone().invert()
    );

    return resolveViewNameFromNormal(local);
  }

  function isPointerInsideViewCubeViewport(pointerX, pointerY) {
    const rw = Math.max(engine.getRenderWidth(), 1);
    const rh = Math.max(engine.getRenderHeight(), 1);
    const vp = viewCubeCamera.viewport;
    if (!vp) return false;

    const left = vp.x * rw;
    const width = vp.width * rw;
    const topFromBottomOrigin = (1 - vp.y - vp.height) * rh;
    const topFromTopOrigin = vp.y * rh;
    const height = vp.height * rh;

    const insideX = pointerX >= left && pointerX <= left + width;
    const insideYBottomOrigin = pointerY >= topFromBottomOrigin && pointerY <= topFromBottomOrigin + height;
    const insideYTopOrigin = pointerY >= topFromTopOrigin && pointerY <= topFromTopOrigin + height;

    return insideX && (insideYBottomOrigin || insideYTopOrigin);
  }

  function getFallbackOrientationFromViewportRay(pointerX, pointerY) {
    if (!isPointerInsideViewCubeViewport(pointerX, pointerY)) return null;

    const ray = scene.createPickingRay(pointerX, pointerY, BABYLON.Matrix.Identity(), viewCubeCamera, false);
    if (!ray) return null;

    const invWorld = viewCube.getWorldMatrix().clone().invert();
    const originLocal = BABYLON.Vector3.TransformCoordinates(ray.origin, invWorld);
    const dirLocal = BABYLON.Vector3.TransformNormal(ray.direction, invWorld);
    dirLocal.normalize();

    const half = (viewCubeSize * 0.5) * 1.08;
    const min = new BABYLON.Vector3(-half, -half, -half);
    const max = new BABYLON.Vector3(half, half, half);

    const eps = 1e-6;
    let tMin = Number.NEGATIVE_INFINITY;
    let tMax = Number.POSITIVE_INFINITY;

    const axes = ["x", "y", "z"];
    for (let i = 0; i < axes.length; i += 1) {
      const axis = axes[i];
      const o = originLocal[axis];
      const d = dirLocal[axis];
      const lo = min[axis];
      const hi = max[axis];

      if (Math.abs(d) < eps) {
        if (o < lo || o > hi) return null;
        continue;
      }

      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      const near = Math.min(t1, t2);
      const far = Math.max(t1, t2);

      tMin = Math.max(tMin, near);
      tMax = Math.min(tMax, far);
      if (tMin > tMax) return null;
    }

    const tHit = tMin >= 0 ? tMin : tMax;
    if (!Number.isFinite(tHit) || tHit < 0) return null;

    const hitLocal = originLocal.add(dirLocal.scale(tHit));
    return resolveViewNameFromNormal(hitLocal);
  }

  function getPointerRenderCoordinates(pointerEvent) {
    const canvasRect = engine.getRenderingCanvasClientRect();
    const renderWidth = Math.max(engine.getRenderWidth(), 1);
    const renderHeight = Math.max(engine.getRenderHeight(), 1);

    const clientX = Number.isFinite(pointerEvent.clientX) ? pointerEvent.clientX : 0;
    const clientY = Number.isFinite(pointerEvent.clientY) ? pointerEvent.clientY : 0;

    const localX = clientX - canvasRect.left;
    const localY = clientY - canvasRect.top;

    const safeWidth = Math.max(canvasRect.width, 1);
    const safeHeight = Math.max(canvasRect.height, 1);

    const pointerX = (localX / safeWidth) * renderWidth;
    const pointerY = (localY / safeHeight) * renderHeight;

    return { pointerX, pointerY };
  }

  const pointerObserver = scene.onPointerObservable.add(pointerInfo => {
    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
    const pointerEvent = pointerInfo.event;
    if (!pointerEvent || pointerEvent.button !== 0) return;

    const { pointerX, pointerY } = getPointerRenderCoordinates(pointerEvent);

    const cubePick = scene.pick(
      pointerX,
      pointerY,
      mesh => mesh === viewCube,
      false,
      viewCubeCamera
    );

    const resolvedViewName = resolveViewNameFromPick(cubePick);
    const fallbackViewName = resolvedViewName || (isPointerInsideViewCubeViewport(pointerX, pointerY)
      ? getFallbackOrientationFromViewportRay(pointerX, pointerY)
      : null);
    if (!fallbackViewName) return;

    if (typeof onStandardViewRequested === "function") {
      const handled = onStandardViewRequested(fallbackViewName);
      if (!handled) {
        const orientation = getOrientationForViewName(fallbackViewName);
        if (orientation) {
          animateMainCameraTo(
            orientation.alpha,
            orientation.beta,
            { preserveAlpha: !!orientation.preserveAlpha }
          );
        }
      }
    } else {
      const orientation = getOrientationForViewName(fallbackViewName);
      if (!orientation) return;
      animateMainCameraTo(
        orientation.alpha,
        orientation.beta,
        { preserveAlpha: !!orientation.preserveAlpha }
      );
    }

    pointerInfo.skipOnPointerObservable = true;
    if (pointerInfo.event?.preventDefault) pointerInfo.event.preventDefault();
  });

  updateViewport();

  return {
    camera: viewCubeCamera,
    layerMask: viewCubeLayerMask,
    updateViewport,
    syncOrientation() {
      viewCubeCamera.alpha = mainCamera.alpha;
      viewCubeCamera.beta = mainCamera.beta;
    },
    dispose() {
      try {
        scene.onPointerObservable.remove(pointerObserver);
      } catch (e) {}
      faceLabels.forEach(({ plane, mat, texture, uiTexture }) => {
        try { plane.dispose(false, true); } catch (e) {}
        try { mat.dispose(); } catch (e) {}
        try { texture.dispose(); } catch (e) {}
        try { uiTexture.dispose(); } catch (e) {}
      });
      try {
        viewCubeLight.dispose();
      } catch (e) {}
      try {
        viewCube.dispose();
      } catch (e) {}
      try {
        viewCubeMat.dispose();
      } catch (e) {}
      try {
        viewCubeCamera.dispose();
      } catch (e) {}
    }
  };
}
