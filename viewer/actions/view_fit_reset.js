// view_fit_reset.js
// Projection, fit and reset behavior for the 3D viewer.

import { computeAssemblyBounds } from "../modelBounds.js";

export const VIEW_FIT_RESET_CONFIG = {
  ORTHO_MIN_BASE_SIZE: 0.35,
  ORTHO_MIN_ZOOM_SIZE: 0.08,
  TARGET_SCALING_OFFSET: 0.5,
  TARGET_SCALING_MIN: 1,
  TARGET_SCALING_MAX: 2.5,
  STANDARD_VIEW_ORTHO_BETA_EPSILON: 0.001
};

export function createViewFitResetAction(deps) {
  const {
    env,
    scene,
    engine,
    camera,
    ground,
    gridMaterial,
    isHelperNode,
    getActiveModelAssets,
    getCurrentRadius,
    setCurrentRadius,
    getAllModelMeshes,
    setAllModelMeshes,
    getCachedAssemblyBounds,
    setCachedAssemblyBounds,
    getSelectedMeshes,
    getIsolationState,
    createOrUpdateGroundMarker,
    requestRender
  } = deps;

  function computeWheelPrecision() {
    const currentRadius = getCurrentRadius();
    const calc = Math.round(currentRadius * env.controls.wheelPrecisionFactor);
    return Math.min(Math.max(calc, env.controls.wheelPrecisionMin), env.controls.wheelPrecisionMax);
  }

  function updateMainCameraOrthoFrustum() {
    if (camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      return;
    }

    const currentRadius = getCurrentRadius();
    const renderWidth = Math.max(engine.getRenderWidth(), 1);
    const renderHeight = Math.max(engine.getRenderHeight(), 1);
    const aspect = renderWidth / renderHeight;

    // Tie ortho zoom to ArcRotate radius so existing wheel controls remain useful.
    const baseSize = Math.max(currentRadius, VIEW_FIT_RESET_CONFIG.ORTHO_MIN_BASE_SIZE);
    const zoomSize = Math.max(camera.radius * env.camera.orthoZoomFactor, VIEW_FIT_RESET_CONFIG.ORTHO_MIN_ZOOM_SIZE);
    const halfHeight = Math.max(
      Math.min(zoomSize, baseSize * env.camera.orthoMaxFitFactor),
      baseSize * env.camera.orthoMinFitFactor
    );
    const halfWidth = halfHeight * aspect;

    camera.orthoLeft = -halfWidth;
    camera.orthoRight = halfWidth;
    camera.orthoBottom = -halfHeight;
    camera.orthoTop = halfHeight;
  }

  function getProjectionMode() {
    return camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA ? "orthographic" : "perspective";
  }

  function setProjectionMode(mode) {
    const normalized = typeof mode === "string" ? mode.toLowerCase() : "";
    const nextMode = normalized === "perspective"
      ? BABYLON.Camera.PERSPECTIVE_CAMERA
      : BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

    if (camera.mode === nextMode) {
      requestRender();
      return getProjectionMode();
    }

    camera.mode = nextMode;

    if (nextMode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      updateMainCameraOrthoFrustum();
    } else {
      camera.orthoLeft = null;
      camera.orthoRight = null;
      camera.orthoBottom = null;
      camera.orthoTop = null;
    }

    requestRender();
    return getProjectionMode();
  }

  function toggleProjectionMode() {
    return setProjectionMode(getProjectionMode() === "orthographic" ? "perspective" : "orthographic");
  }

  function resetView() {
    const { isolationActive, isolatedScopeMeshes } = getIsolationState();
    const selectedMeshes = getSelectedMeshes();
    const allModelMeshes = getAllModelMeshes();

    const useIsolatedFit = isolationActive && (isolatedScopeMeshes.length > 0 || selectedMeshes.length > 0);

    let bounds = null;
    if (useIsolatedFit) {
      const fitMeshes = isolatedScopeMeshes.length > 0 ? isolatedScopeMeshes : selectedMeshes;
      bounds = computeAssemblyBounds(fitMeshes, { refreshBounds: true });
    } else {
      bounds = getCachedAssemblyBounds() || computeAssemblyBounds(allModelMeshes, { refreshBounds: true });
      if (bounds) {
        setCachedAssemblyBounds(bounds);
      }
    }

    if (!bounds) {
      return false;
    }

    const { min, center, diagonal, radius } = bounds;
    setCurrentRadius(radius);

    camera.setTarget(center);
    camera.lowerRadiusLimit = Math.max(radius * env.camera.lowerRadiusFactor, 0.05);
    camera.upperRadiusLimit = Math.max(radius * env.camera.upperRadiusFactor, env.camera.minUpperRadius);
    camera.radius = Math.max(radius * env.camera.fitRadiusFactor, camera.lowerRadiusLimit + radius * env.camera.fitRadiusPaddingFactor);
    camera.minZ = Math.max(radius * env.camera.minZFactor, env.camera.minMinZ);
    camera.wheelPrecision = computeWheelPrecision();

    const groundSize = Math.max(diagonal * env.ground.sizeFactor, env.ground.minSize);
    const computedGridRatio = Math.max(diagonal / env.grid.ratioDivisor, env.grid.minRatio);
    ground.position.x = center.x;
    ground.position.z = center.z;
    ground.position.y = min.y - Math.max(radius * env.ground.offsetFactor, env.ground.minOffset);
    ground.scaling.x = groundSize / 20;
    ground.scaling.z = groundSize / 20;
    gridMaterial.gridRatio = computedGridRatio;
    gridMaterial.majorUnitFrequency = env.grid.majorUnitFrequency;
    gridMaterial.minorUnitVisibility = env.grid.minorUnitVisibilityFitted;

    createOrUpdateGroundMarker(center, diagonal);
    updateMainCameraOrthoFrustum();
    requestRender();
    return true;
  }

  function setStandardView(viewName) {
    const key = typeof viewName === "string" ? viewName.toLowerCase() : "";
    const views = {
      top: { alpha: Math.PI, beta: VIEW_FIT_RESET_CONFIG.STANDARD_VIEW_ORTHO_BETA_EPSILON },
      bottom: { alpha: Math.PI, beta: Math.PI - VIEW_FIT_RESET_CONFIG.STANDARD_VIEW_ORTHO_BETA_EPSILON },
      front: { alpha: Math.PI / 2, beta: Math.PI / 2 },
      back: { alpha: -Math.PI / 2, beta: Math.PI / 2 },
      left: { alpha: 0, beta: Math.PI / 2 },
      right: { alpha: Math.PI, beta: Math.PI / 2 },
      isometric: { alpha: Math.PI / 4, beta: Math.PI / 3 }
    };

    const target = views[key];
    if (!target) return false;

    resetView();
    setProjectionMode(key === "isometric" ? "perspective" : "orthographic");
    camera.upVector = new BABYLON.Vector3(0, 1, 0);
    camera.alpha = target.alpha;
    camera.beta = target.beta;
    requestRender();
    return true;
  }

  function applyModelBoundsAndCamera() {
    const activeModelAssets = getActiveModelAssets();
    const importedModelMeshes = (activeModelAssets?.meshes || []).filter(mesh => {
      if (!mesh || typeof mesh.getTotalVertices !== "function") return false;
      if (mesh.getTotalVertices() <= 0) return false;
      if (isHelperNode(mesh)) return false;
      return true;
    });

    importedModelMeshes.forEach(mesh => {
      try { mesh.computeWorldMatrix(true); mesh.refreshBoundingInfo(true); mesh.freezeWorldMatrix(); } catch (e) {}
    });

    try { scene.createOrUpdateSelectionOctree(128); } catch (e) {}
    try { scene.freezeMaterials(); } catch (e) {}

    scene.render();

    setAllModelMeshes(importedModelMeshes);

    if (importedModelMeshes.length === 0) return;

    const bounds = computeAssemblyBounds(importedModelMeshes);
    if (!bounds) return;

    setCachedAssemblyBounds(bounds);

    const { min, center, diagonal, radius } = bounds;
    setCurrentRadius(radius);

    camera.setTarget(center);
    camera.lowerRadiusLimit = Math.max(radius * env.camera.lowerRadiusFactor, 0.05);
    camera.upperRadiusLimit = Math.max(radius * env.camera.upperRadiusFactor, env.camera.minUpperRadius);
    camera.radius = Math.max(radius * env.camera.fitRadiusFactor, camera.lowerRadiusLimit + radius * env.camera.fitRadiusPaddingFactor);
    camera.minZ = Math.max(radius * env.camera.minZFactor, env.camera.minMinZ);

    const targetScaling = Math.min(
      Math.max(VIEW_FIT_RESET_CONFIG.TARGET_SCALING_OFFSET + Math.log10(radius + 1), VIEW_FIT_RESET_CONFIG.TARGET_SCALING_MIN),
      VIEW_FIT_RESET_CONFIG.TARGET_SCALING_MAX
    );
    engine.setHardwareScalingLevel(targetScaling);

    camera.wheelPrecision = computeWheelPrecision();

    const groundSize = Math.max(diagonal * env.ground.sizeFactor, env.ground.minSize);
    const computedGridRatio = Math.max(diagonal / env.grid.ratioDivisor, env.grid.minRatio);

    ground.position.x = center.x;
    ground.position.z = center.z;
    ground.position.y = min.y - Math.max(radius * env.ground.offsetFactor, env.ground.minOffset);
    ground.scaling.x = groundSize / 20;
    ground.scaling.z = groundSize / 20;

    gridMaterial.gridRatio = computedGridRatio;
    gridMaterial.majorUnitFrequency = env.grid.majorUnitFrequency;
    gridMaterial.minorUnitVisibility = env.grid.minorUnitVisibilityFitted;

    createOrUpdateGroundMarker(center, diagonal);
    updateMainCameraOrthoFrustum();
  }

  return {
    updateMainCameraOrthoFrustum,
    getProjectionMode,
    setProjectionMode,
    toggleProjectionMode,
    setStandardView,
    applyModelBoundsAndCamera,
    resetView
  };
}
