// viewer3d.js
// Viewer actualizado: root no seleccionable desde el tree, tree abierto por defecto,
// y soporte para selección desde el tree (sin loops) via handleTreeSelection.

import { createViewCubeFeature } from "./viewCubeFeature.js";
import { createAxisTriadFeature } from "./axisTriadFeature.js";
import { buildViewerEnvironment } from "./viewerEnvironment.js";
import { createIsolateSelectionAction } from "./actions/isolate_selection.js";
import { createSelectSelectionAction } from "./actions/select_selection.js";
import { createViewFitResetAction } from "./actions/view_fit_reset.js";

class ColorifyPluginMaterial extends BABYLON.MaterialPluginBase {
  color = new BABYLON.Color3(0.31, 0.86, 0.45);
  _isEnabled = false;

  get isEnabled() {
    return this._isEnabled;
  }

  set isEnabled(enabled) {
    if (this._isEnabled === enabled) return;
    this._isEnabled = enabled;
    this.markAllDefinesAsDirty();
    this._enable(this._isEnabled);
  }

  isCompatible(shaderLanguage) {
    return shaderLanguage === BABYLON.ShaderLanguage.GLSL || shaderLanguage === BABYLON.ShaderLanguage.WGSL;
  }

  constructor(material) {
    super(material, "Colorify", 200, { COLORIFY: false });
    this._varColorName = material instanceof BABYLON.PBRBaseMaterial ? "finalColor" : "color";
  }

  prepareDefines(defines) {
    defines.COLORIFY = this._isEnabled;
  }

  getUniforms(shaderLanguage) {
    if (shaderLanguage === BABYLON.ShaderLanguage.WGSL) {
      return {
        ubo: [{ name: "myColor", size: 3, type: "vec3" }]
      };
    }

    return {
      ubo: [{ name: "myColor", size: 3, type: "vec3" }],
      fragment: `#ifdef COLORIFY\nuniform vec3 myColor;\n#endif`
    };
  }

  bindForSubMesh(uniformBuffer) {
    if (this._isEnabled) {
      uniformBuffer.updateColor3("myColor", this.color);
    }
  }

  getClassName() {
    return "ColorifyPluginMaterial";
  }

  getCustomCode(shaderType, shaderLanguage) {
    if (shaderType === "vertex") return null;

    if (shaderLanguage === BABYLON.ShaderLanguage.WGSL) {
      return {
        CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
          #ifdef COLORIFY
            ${this._varColorName} = vec4f(${this._varColorName}.rgb * uniforms.myColor, ${this._varColorName}.a);
          #endif
        `,
        "!diffuseBase\\+=info\\.diffuse\\*shadow;": `
          diffuseBase += info.diffuse*shadow;
          diffuseBase += vec3f(0.0, 0.25, 0.35);
        `
      };
    }

    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
        #ifdef COLORIFY
          ${this._varColorName}.rgb *= myColor;
        #endif
      `,
      "!diffuseBase\\+=info\\.diffuse\\*shadow;": `
        diffuseBase += info.diffuse*shadow;
        diffuseBase += vec3(0.0, 0.25, 0.35);
      `
    };
  }
}

function ensureColorifyPluginRegistration() {
  if (BABYLON.__colorifyPluginRegistered) return;

  BABYLON.RegisterMaterialPlugin("Colorify", material => {
    material.colorify = new ColorifyPluginMaterial(material);
    return material.colorify;
  });

  BABYLON.__colorifyPluginRegistered = true;
}

export function initViewer(containerId, options = {}) {
  const {
    modelPath = "./assets/models/",
    modelFile = "",
    autoLoad = false,
    // Environment variables isolated for future UI/backend-driven tuning.
    // Keep defaults stable for now; backend integration can override selectively later.
    // Example:
    // environment: { controls: { orbitSensitivity: 0.003 }, background: { clearColor: [0.92, 0.97, 1, 1] } }
    environment = {},
    onLoaded,
    onError,
    onNodePicked
  } = options;

  const env = buildViewerEnvironment(environment);

  const assemblyName = (modelFile || "").replace(/\.[^/.]+$/, "") || "assembly";

  function initializeReflectionEnvironment() {
    const reflectionConfig = env.reflections || {};
    if (!reflectionConfig.enabled) {
      return;
    }

    try {
      const textureUrl = reflectionConfig.environmentTextureUrl;
      if (!textureUrl) {
        return;
      }

      const environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(textureUrl, scene);
      scene.environmentTexture = environmentTexture;
      scene.environmentIntensity = reflectionConfig.sceneEnvironmentIntensity;

      if (scene.imageProcessingConfiguration) {
        scene.imageProcessingConfiguration.exposure = reflectionConfig.exposure;
        scene.imageProcessingConfiguration.contrast = reflectionConfig.contrast;
      }

      if (reflectionConfig.createSkybox) {
        const skybox = scene.createDefaultSkybox(
          environmentTexture,
          true,
          reflectionConfig.skyboxSize,
          reflectionConfig.skyboxBlur,
          false
        );

        if (skybox) {
          skybox.metadata = { ...(skybox.metadata || {}), viewerHelper: true };
          skybox.isPickable = false;
        }
      }
    } catch (error) {
      console.warn("Unable to initialize reflection environment:", error);
    }
  }

  function getMeshMaterials(meshes) {
    const materials = new Set();

    (meshes || []).forEach(mesh => {
      const meshMaterial = mesh?.material;
      if (!meshMaterial) return;

      if (meshMaterial instanceof BABYLON.MultiMaterial) {
        (meshMaterial.subMaterials || []).forEach(subMaterial => {
          if (subMaterial) {
            materials.add(subMaterial);
          }
        });
        return;
      }

      materials.add(meshMaterial);
    });

    return Array.from(materials);
  }

  function applyEnvironmentReflectionsToMaterials(meshes) {
    const reflectionConfig = env.reflections || {};
    if (!reflectionConfig.enabled || !scene.environmentTexture) {
      return;
    }

    const materials = getMeshMaterials(meshes);
    materials.forEach(material => {
      if (!material) return;

      if (material instanceof BABYLON.PBRBaseMaterial) {
        if (!material.reflectionTexture) {
          material.reflectionTexture = scene.environmentTexture;
        }

        if (typeof material.environmentIntensity === "number") {
          material.environmentIntensity = reflectionConfig.materialEnvironmentIntensity;
        }
        return;
      }

      if (reflectionConfig.applyToStandardMaterial && material instanceof BABYLON.StandardMaterial) {
        if (!material.reflectionTexture) {
          material.reflectionTexture = scene.environmentTexture;
        }

        if (material.reflectionTexture) {
          material.reflectionTexture.level = reflectionConfig.standardReflectionLevel;
        }
      }
    });
  }

  // -----------------------
  // Helpers
  // -----------------------
  function isHelperNode(node) {
    if (!node) return false;
    if (node.metadata && node.metadata.viewerHelper === true) return true;
    const name = (node.name || "").toLowerCase();
    const className = typeof node.getClassName === "function" ? node.getClassName() : "";
    if (!name) return true; // treat unnamed as helper for safety (optional)
    if (name.includes("viewcube") || name.includes("groundmarker")) return true;
    if (name.includes("ground")) return true;
    if (className === "Camera" || className === "FreeCamera" || className === "ArcRotateCamera" || className === "HemisphericLight" || className === "DirectionalLight") return true;
    return false;
  }

  function shouldIncludeSceneNode(node) {
    if (!node) return false;
    const name = (node.name || "").toLowerCase();
    // Exclude explicit wrappers like "__root__" and any helper node
    if (name.startsWith("__root")) return false;
    if (isHelperNode(node)) return false;
    const className = typeof node.getClassName === "function" ? node.getClassName() : "";
    return className === "TransformNode" || className === "Mesh" || className === "InstancedMesh";
  }

  function getEffectiveRootNodes(scene) {
    if (!scene || !Array.isArray(scene.rootNodes)) return [];

    let roots = scene.rootNodes.slice();
    // If single wrapper root flatten it
    if (roots.length === 1) {
      const single = roots[0];
      const name = (single.name || "").toLowerCase();
      if (name.startsWith("__root")) {
        const ch = typeof single.getChildren === "function" ? single.getChildren() : [];
        return ch.filter(n => !isHelperNode(n));
      }
    }

    const out = [];
    roots.forEach(r => {
      if (!r) return;
      const name = (r.name || "").toLowerCase();
      if (name.startsWith("__root")) {
        const children = typeof r.getChildren === "function" ? r.getChildren() : [];
        children.forEach(c => { if (!isHelperNode(c)) out.push(c); });
      } else {
        if (!isHelperNode(r)) out.push(r);
      }
    });

    return out;
  }

  function getIncludedSceneChildren(node) {
    if (!node || typeof node.getChildren !== "function") return [];
    return node.getChildren().filter(child => shouldIncludeSceneNode(child));
  }

  function hasRenderableGeometry(node) {
    return !!(node && typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0);
  }

  function normalizeNodeForTree(node) {
    if (!shouldIncludeSceneNode(node)) return [];

    return [buildTreeNode(node)];
  }

  function buildTreeItemsFromChildren(children) {
    const out = [];
    children.forEach(child => {
      out.push(...normalizeNodeForTree(child));
    });
    return out;
  }

  function shouldPromoteSingleChildLevel(node) {
    const children = getIncludedSceneChildren(node);
    if (children.length !== 1) return false;
    // Keep the parent as the visible semantic node and collapse the technical only-child level.
    return !hasRenderableGeometry(node);
  }

  // buildTreeNode marks only real branches as open; leaves stay as plain items.
  function buildTreeNode(node) {
    const children = getIncludedSceneChildren(node);
    let normalizedItems = buildTreeItemsFromChildren(children);

    // Promote children from a technical single-child level while preserving parent label.
    // Example: F_6/SolidX -> keep F_6 and show SolidX's children under F_6.
    if (shouldPromoteSingleChildLevel(node)) {
      const onlyChild = children[0];
      const promotedChildren = getIncludedSceneChildren(onlyChild);
      normalizedItems = buildTreeItemsFromChildren(promotedChildren);
    }

    const treeNode = {
      id: `node_${node.uniqueId}`,
      value: node.name && node.name.length ? node.name : `Unnamed_${node.uniqueId}`,
      data: {
        uniqueId: node.uniqueId,
        nodeId: node.id,
        nodeName: node.name || `node_${node.uniqueId}`,
        nodeType: typeof node.getClassName === "function" ? node.getClassName() : "Unknown",
        isPart: hasRenderableGeometry(node)
      }
    };

    // DHTMLX treats presence of "items" as a branch; omit it for true leaves.
    if (normalizedItems.length > 0) {
      treeNode.items = normalizedItems;
      treeNode.open = true;
    }

    return treeNode;
  }

  function buildSceneTreeDataForRootNodes(rootNodes) {
    const out = [];
    rootNodes.forEach(node => {
      out.push(...normalizeNodeForTree(node));
    });
    return out;
  }

  function getRenderableMeshesFromNode(node) {
    const meshes = [];
    if (!node) return meshes;
    if (typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0) meshes.push(node);
    const children = typeof node.getChildren === "function" ? node.getChildren() : [];
    children.forEach(child => meshes.push(...getRenderableMeshesFromNode(child)));
    return meshes;
  }

  function isInstanceLike(mesh) {
    try {
      if (!mesh) return false;
      if (typeof mesh.getClassName === "function") {
        const cn = mesh.getClassName();
        if (cn && cn.toLowerCase().includes("instanced")) return true;
      }
      if (mesh.hasThinInstances) return true;
      if (mesh.thinInstanceCount && mesh.thinInstanceCount > 0) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  // -----------------------
  // DOM, engine, scene init
  // -----------------------
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("Viewer container not found:", containerId);
    if (onError) onError(new Error(`Viewer container not found: ${containerId}`));
    return null;
  }
  container.innerHTML = "";

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  container.appendChild(canvas);

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
  const initialDPR = Math.max(1, window.devicePixelRatio || 1);
  engine.setHardwareScalingLevel(Math.min(1.5, initialDPR));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromArray(env.background.clearColor);
  // We handle clears per camera to keep overlay backgrounds transparent.
  scene.autoClear = false;

  initializeReflectionEnvironment();

  ensureColorifyPluginRegistration();

  // camera + lights + ground
  // Default startup orientation (before loading any model): Top view.
  const camera = new BABYLON.ArcRotateCamera("camera", Math.PI, 0.001, 6, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = env.camera.initialLowerRadiusLimit;
  camera.upperRadiusLimit = env.camera.initialUpperRadiusLimit;
  camera.wheelPrecision = env.camera.initialWheelPrecision;
  camera.minZ = env.camera.initialMinZ;
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

  let viewFitResetAction = null;

  function updateMainCameraOrthoFrustum() {
    if (!viewFitResetAction) return;
    viewFitResetAction.updateMainCameraOrthoFrustum();
  }

  function getProjectionMode() {
    if (!viewFitResetAction) {
      return camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA ? "orthographic" : "perspective";
    }
    return viewFitResetAction.getProjectionMode();
  }

  function setProjectionMode(mode) {
    if (!viewFitResetAction) return getProjectionMode();
    return viewFitResetAction.setProjectionMode(mode);
  }

  function toggleProjectionMode() {
    if (!viewFitResetAction) return getProjectionMode();
    return viewFitResetAction.toggleProjectionMode();
  }

  function setStandardView(viewName) {
    if (!viewFitResetAction) return false;
    return viewFitResetAction.setStandardView(viewName);
  }

  if (camera.inputs?.attached?.pointers) camera.inputs.attached.pointers.buttons = [];

  const viewCubeFeature = createViewCubeFeature({
    scene,
    engine,
    mainCamera: camera,
    onStandardViewRequested: viewName => setStandardView(viewName)
  });
  const axisTriadFeature = createAxisTriadFeature({
    scene,
    engine,
    mainCamera: camera
  });

  let overlayWidgetsVisible = false;
  function updateOverlayCameras() {
    if (overlayWidgetsVisible) {
      scene.activeCameras = [camera, viewCubeFeature.camera, axisTriadFeature.camera];
      viewCubeFeature.updateViewport();
      axisTriadFeature.updateViewport();
      return;
    }

    scene.activeCameras = [camera];
    viewCubeFeature.camera.viewport = new BABYLON.Viewport(0, 0, 0, 0);
    axisTriadFeature.camera.viewport = new BABYLON.Viewport(0, 0, 0, 0);
  }

  updateOverlayCameras();
  scene.cameraToUseForPointers = camera;

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);
  ground.metadata = { ...(ground.metadata || {}), viewerHelper: true };
  ground.isPickable = true;

  const gridMaterial = new BABYLON.GridMaterial("gridMaterial", scene);
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = env.grid.minorUnitVisibilityInitial;
  gridMaterial.backFaceCulling = false;
  gridMaterial.mainColor = new BABYLON.Color3(1, 1, 1);
  gridMaterial.lineColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  gridMaterial.opacity = 0.85;
  ground.material = gridMaterial;

  // Match startup behavior: no model loaded yet -> keep grid hidden.
  ground.setEnabled(overlayWidgetsVisible);
  ground.isPickable = overlayWidgetsVisible;

  BABYLON.SceneLoader.ShowLoadingScreen = false;

  // -----------------------
  // selection state
  // -----------------------
  const nodeMap = new Map();
  let effectiveRootIdSet = new Set();
  let selectedMeshes = [];
  let currentRadius = 1;
  let allModelMeshes = [];
  let cachedAssemblyBounds = null;
  const originalVisibility = new Map();
  const originalPickable = new Map();
  let activeModelAssets = null;
  const selectedMeshMaterials = new Map();
  const selectedInstanceOverlays = new Set();
  let isolationActive = false;
  let isolatedScopeMeshes = [];

  function restoreVisibilities() {
    originalVisibility.forEach((v, mesh) => {
      if (isInstanceLike(mesh)) return;
      try { mesh.visibility = v; } catch (e) {}
    });
    originalVisibility.clear();
  }

  function restorePickability() {
    originalPickable.forEach((v, mesh) => {
      try { mesh.isPickable = v; } catch (e) {}
    });
    originalPickable.clear();
  }

  function disposeModelAssets(modelAssets) {
    if (!modelAssets) return;

    const bucketNames = ["meshes", "transformNodes", "skeletons", "animationGroups", "particleSystems", "geometries", "lights"];
    const disposed = new Set();

    bucketNames.forEach(name => {
      const bucket = modelAssets[name];
      if (!Array.isArray(bucket)) return;
      bucket.forEach(item => {
        if (!item || typeof item.dispose !== "function") return;
        if (disposed.has(item)) return;
        disposed.add(item);
        try { item.dispose(); } catch (e) {}
      });
    });
  }

  function resetModelState() {
    clearSelection();
    nodeMap.clear();
    effectiveRootIdSet = new Set();
    allModelMeshes = [];
    cachedAssemblyBounds = null;

    if (activeModelAssets) {
      disposeModelAssets(activeModelAssets);
      activeModelAssets = null;
    }
  }

  function getIsolationState() {
    return {
      isolationActive,
      isolatedScopeMeshes
    };
  }

  function setIsolationState(nextIsolationActive, nextIsolatedScopeMeshes) {
    isolationActive = !!nextIsolationActive;
    isolatedScopeMeshes = Array.isArray(nextIsolatedScopeMeshes) ? nextIsolatedScopeMeshes : [];
  }

  function getSelectedMeshes() {
    return selectedMeshes;
  }

  function setSelectedMeshes(nextSelectedMeshes) {
    selectedMeshes = Array.isArray(nextSelectedMeshes) ? nextSelectedMeshes : [];
  }

  viewFitResetAction = createViewFitResetAction({
    env,
    scene,
    engine,
    camera,
    ground,
    gridMaterial,
    isHelperNode,
    getActiveModelAssets: () => activeModelAssets,
    getCurrentRadius: () => currentRadius,
    setCurrentRadius: nextCurrentRadius => { currentRadius = nextCurrentRadius; },
    getAllModelMeshes: () => allModelMeshes,
    setAllModelMeshes: nextAllModelMeshes => { allModelMeshes = Array.isArray(nextAllModelMeshes) ? nextAllModelMeshes : []; },
    getCachedAssemblyBounds: () => cachedAssemblyBounds,
    setCachedAssemblyBounds: nextCachedAssemblyBounds => { cachedAssemblyBounds = nextCachedAssemblyBounds || null; },
    getSelectedMeshes,
    getIsolationState,
    createOrUpdateGroundMarker,
    requestRender
  });

  const isolateSelectionAction = createIsolateSelectionAction({
    getAllModelMeshes: () => allModelMeshes,
    getGroundMesh: () => ground,
    isInstanceLike,
    originalVisibility,
    originalPickable,
    restorePickability,
    restoreVisibilities,
    getSelectedMeshes: () => selectedMeshes,
    getIsolationState,
    setIsolationState,
    resetView,
    requestRender
  });

  const { applyContextVisibility, setIsolationEnabled } = isolateSelectionAction;

  const selectSelectionAction = createSelectSelectionAction({
    assemblyName,
    nodeMap,
    getRenderableMeshesFromNode,
    isInstanceLike,
    selectedMeshMaterials,
    selectedInstanceOverlays,
    getSelectedMeshes,
    setSelectedMeshes,
    getIsolationState,
    setIsolationState,
    restoreVisibilities,
    restorePickability,
    applyContextVisibility,
    onNodePicked
  });

  const {
    clearSelectionVisuals,
    clearSelection,
    selectNodeByUniqueId
  } = selectSelectionAction;

  function buildViewerPayload(treeData) {
    return {
      treeData,
      engine,
      scene,
      camera,
      ground,
      loadModel,
      resetView,
      setStandardView,
      setProjectionMode,
      toggleProjectionMode,
      getProjectionMode,
      setIsolationEnabled,
      clearSelectionVisuals,
      selectNodeByUniqueId,
      clearSelection,
      handleTreeSelection
    };
  }


  // handle selection coming from the DHTMLX Tree.
  // If the clicked id is the assembly root (node_root_<assemblyName>) we ignore it.
  function handleTreeSelection(treeNodeId) {
    if (!treeNodeId) return;
    // do not allow selecting the assembly root
    if (treeNodeId.startsWith(`node_root_${assemblyName}`)) {
      // optionally, we could select all root nodes instead; spec says block selection
      return;
    }
    // call select but suppress event to avoid loops (UI already triggered this)
    selectNodeByUniqueId(treeNodeId, { suppressEvent: true });
    requestRender();
  }

  function getSelectableAncestor(node) {
    if (!node) return null;
    if (effectiveRootIdSet.has(node.uniqueId)) return node;

    let current = node;
    while (current && current.parent) {
      if (effectiveRootIdSet.has(current.parent.uniqueId)) return current.parent;
      current = current.parent;
    }

    current = node;
    while (current && current.parent) current = current.parent;
    return current || node;
  }

  // -----------------------
  // pan/orbit controls (unchanged)
  // -----------------------
  let middleMouseDown = false;
  let isOrbitMode = false;
  let panStartGroundPoint = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const baseOrbitSensitivity = env.controls.orbitSensitivity;

  function computeOrbitSensitivity() {
    const r = Math.max(currentRadius, 0.0001);
    return baseOrbitSensitivity / Math.cbrt(r);
  }

  function pickGround(clientX, clientY) {
    const pick = scene.pick(clientX, clientY, mesh => mesh === ground, false, camera);
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint.clone();
  }

  let groundMarker = null;
  function createOrUpdateGroundMarker(center, size) {
    const showGroundMarker = env?.ground?.showMarker !== false;
    if (!showGroundMarker) {
      if (groundMarker && !groundMarker.isDisposed?.()) {
        groundMarker.setEnabled(false);
      }
      return;
    }

    const markerDiameter = Math.max(size * 0.6, 0.1);
    if (!groundMarker || groundMarker.isDisposed()) {
      groundMarker = BABYLON.MeshBuilder.CreateCylinder("groundMarker", { diameter: markerDiameter, height: 0.002, tessellation: 64 }, scene);
      groundMarker.metadata = { ...(groundMarker.metadata || {}), viewerHelper: true };
      groundMarker.isPickable = false;
      const mat = new BABYLON.StandardMaterial("groundMarkerMat", scene);
      mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
      mat.alpha = 0.12;
      mat.disableLighting = true;
      groundMarker.material = mat;
    }

    if (!overlayWidgetsVisible) {
      groundMarker.setEnabled(false);
      return;
    }

    groundMarker.setEnabled(true);
    groundMarker.position.x = center.x;
    groundMarker.position.z = center.z;
    groundMarker.position.y = center.y - 0.001;
    groundMarker.rotation.x = Math.PI / 2;
    groundMarker.scaling.x = markerDiameter / 1;
    groundMarker.scaling.z = markerDiameter / 1;
  }

  // -----------------------
  // render loop throttle
  // -----------------------
  let renderRequested = true;
  let renderTimer = null;
  const IDLE_RENDER_TIMEOUT = 180;

  function requestRender() {
    renderRequested = true;
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { renderRequested = false; }, IDLE_RENDER_TIMEOUT);
  }

  requestRender();
  engine.runRenderLoop(() => {
    if (!renderRequested) return;

    // Keep the viewcube orientation synced with the main orbit camera.
    if (overlayWidgetsVisible) {
      viewCubeFeature.syncOrientation();
      axisTriadFeature.syncOrientation();
    }
    updateMainCameraOrthoFrustum();
    scene.render();
  });

  const listenerDisposers = [];

  // Camera clear policy:
  // - Main camera: clear color + depth (normal scene render).
  // - Overlay cameras: clear only depth so widgets render on top without a colored backdrop.
  const cameraClearObserver = scene.onBeforeCameraRenderObservable.add(activeCamera => {
    if (activeCamera === camera) {
      engine.clear(scene.clearColor, true, true, true);
      return;
    }

    if (activeCamera === viewCubeFeature.camera || activeCamera === axisTriadFeature.camera) {
      engine.clear(new BABYLON.Color4(0, 0, 0, 0), false, true, false);
    }
  });
  listenerDisposers.push(() => scene.onBeforeCameraRenderObservable.remove(cameraClearObserver));

  function addCanvasListener(type, handler, options) {
    canvas.addEventListener(type, handler, options);
    listenerDisposers.push(() => canvas.removeEventListener(type, handler, options));
  }

  // pointer events (middle mouse panning/orbit)
  function onPointerDown(event) {
    if (event.button !== 1) return;
    middleMouseDown = true;
    isOrbitMode = !!event.shiftKey;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    panStartGroundPoint = null;
    if (!isOrbitMode) panStartGroundPoint = pickGround(event.clientX, event.clientY);
    requestRender();
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!middleMouseDown) return;
    if (event.shiftKey !== isOrbitMode) {
      isOrbitMode = !!event.shiftKey;
      panStartGroundPoint = null;
      if (!isOrbitMode) panStartGroundPoint = pickGround(event.clientX, event.clientY);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    }

    if (isOrbitMode) {
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      const orbitSensitivity = computeOrbitSensitivity();
      camera.inertialAlphaOffset -= dx * orbitSensitivity;
      camera.inertialBetaOffset -= dy * orbitSensitivity;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      requestRender();
      event.preventDefault();
      return;
    }

    const currentGroundPoint = pickGround(event.clientX, event.clientY);
    if (!panStartGroundPoint || !currentGroundPoint) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      requestRender();
      event.preventDefault();
      return;
    }

    const delta = panStartGroundPoint.subtract(currentGroundPoint);
    camera.target.addInPlace(delta);

    panStartGroundPoint = pickGround(event.clientX, event.clientY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    requestRender();
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (event.button === 1) {
      middleMouseDown = false;
      isOrbitMode = false;
      panStartGroundPoint = null;
      requestRender();
      event.preventDefault();
    }
  }

  function onPointerLeave() {
    middleMouseDown = false;
    isOrbitMode = false;
    panStartGroundPoint = null;
  }

  addCanvasListener("pointerdown", onPointerDown);
  addCanvasListener("pointermove", onPointerMove);
  addCanvasListener("pointerup", onPointerUp);
  addCanvasListener("pointerleave", onPointerLeave);
  addCanvasListener("pointercancel", onPointerLeave);

  const onAuxClick = (e) => { if (e.button === 1) e.preventDefault(); };
  const onWheel = () => requestRender();
  addCanvasListener("auxclick", onAuxClick);
  addCanvasListener("wheel", onWheel);

  const viewMatrixObserver = camera.onViewMatrixChangedObservable.add(() => {
    updateMainCameraOrthoFrustum();
    requestRender();
  });
  listenerDisposers.push(() => camera.onViewMatrixChangedObservable.remove(viewMatrixObserver));

  let pointerObserver = null;
  listenerDisposers.push(() => {
    if (pointerObserver) {
      scene.onPointerObservable.remove(pointerObserver);
      pointerObserver = null;
    }
  });

  function rebuildTreeAndInteractions() {
    // populate nodeMap and cache effective roots once for picking/tree usage
    const effectiveRootNodes = getEffectiveRootNodes(scene);
    effectiveRootIdSet = new Set(effectiveRootNodes.map(n => n.uniqueId));

    effectiveRootNodes.forEach(rootNode => {
      if (shouldIncludeSceneNode(rootNode)) {
        const stack = [rootNode];
        while (stack.length > 0) {
          const cur = stack.pop();
          nodeMap.set(cur.uniqueId, cur);
          const children = typeof cur.getChildren === "function" ? cur.getChildren() : [];
          children.forEach(child => { if (shouldIncludeSceneNode(child)) stack.push(child); });
        }
      }
    });

    if (pointerObserver) {
      scene.onPointerObservable.remove(pointerObserver);
      pointerObserver = null;
    }

    // pointer picking handler (select sub-assembly or root piece)
    pointerObserver = scene.onPointerObservable.add(pointerInfo => {
      if (middleMouseDown) return;
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

      const explicitPick = scene.pick(scene.pointerX, scene.pointerY, undefined, false, camera);
      const pickedMesh = explicitPick?.pickedMesh || pointerInfo.pickInfo?.pickedMesh;
      if (!pickedMesh) return;

      if (pickedMesh === ground || (pickedMesh.name && pickedMesh.name.toLowerCase().includes("ground"))) {
        if (isolationActive) {
          requestRender();
          return;
        }

        clearSelection({ preserveIsolation: isolationActive });
        requestRender();
        if (typeof onNodePicked === "function") onNodePicked(null);
        return;
      }

      const selectable = getSelectableAncestor(pickedMesh);

      if (!selectable) return;

      // selection from model should notify UI (onNodePicked)
      selectNodeByUniqueId(selectable.uniqueId, { suppressEvent: false });
      requestRender();
    });

    const treeChildren = buildSceneTreeDataForRootNodes(effectiveRootNodes);
    return [
      {
        id: `node_root_${assemblyName}`,
        value: assemblyName,
        open: true,
        data: { isAssemblyRoot: true, assemblyName },
        items: treeChildren
      }
    ];
  }

  function applyModelBoundsAndCamera() {
    if (!viewFitResetAction) return;
    viewFitResetAction.applyModelBoundsAndCamera();
  }

  function resetView() {
    if (!viewFitResetAction) return false;
    return viewFitResetAction.resetView();
  }

  function loadModel(nextModelFile = modelFile, nextModelPath = modelPath) {
    if (!nextModelFile) {
      const err = new Error("No model file provided");
      if (onError) onError(err);
      return;
    }

    resetModelState();
    overlayWidgetsVisible = false;
    ground.setEnabled(false);
    ground.isPickable = false;
    if (groundMarker && !groundMarker.isDisposed?.()) {
      groundMarker.setEnabled(false);
    }
    updateOverlayCameras();

    BABYLON.SceneLoader.ImportMesh(
      "",
      nextModelPath,
      nextModelFile,
      scene,
      function (meshes, particleSystems, skeletons, animationGroups, transformNodes, geometries, lights) {
        try {
          activeModelAssets = {
            meshes: meshes || [],
            particleSystems: particleSystems || [],
            skeletons: skeletons || [],
            animationGroups: animationGroups || [],
            transformNodes: transformNodes || [],
            geometries: geometries || [],
            lights: lights || []
          };

          applyEnvironmentReflectionsToMaterials(activeModelAssets.meshes);

          applyModelBoundsAndCamera();
          overlayWidgetsVisible = true;
          ground.setEnabled(true);
          ground.isPickable = true;
          if (groundMarker && !groundMarker.isDisposed?.()) {
            groundMarker.setEnabled(true);
          }
          updateOverlayCameras();
          const treeData = rebuildTreeAndInteractions();

          if (onLoaded) {
            onLoaded(buildViewerPayload(treeData));
          }

          requestRender();
        } catch (error) {
          console.error("Error inside model load callback:", error);
          if (onError) onError(error);
        }
      },
      null,
      function (_scene, message, exception) {
        console.error("Error loading model:", message, exception);
        overlayWidgetsVisible = false;
        ground.setEnabled(false);
        ground.isPickable = false;
        if (groundMarker && !groundMarker.isDisposed?.()) {
          groundMarker.setEnabled(false);
        }
        updateOverlayCameras();
        if (onError) onError(exception || new Error(message));
      }
    );
  }

  // Notify UI at startup with an empty tree so external controls can trigger loading later.
  if (onLoaded) {
    onLoaded(buildViewerPayload([]));
  }

  if (autoLoad && modelFile) {
    loadModel(modelFile, modelPath);
  }

  // resize
  const onResize = () => {
    engine.resize();
    if (overlayWidgetsVisible) {
      viewCubeFeature.updateViewport();
      axisTriadFeature.updateViewport();
    } else {
      viewCubeFeature.camera.viewport = new BABYLON.Viewport(0, 0, 0, 0);
      axisTriadFeature.camera.viewport = new BABYLON.Viewport(0, 0, 0, 0);
    }
    updateMainCameraOrthoFrustum();
    requestRender();
  };
  window.addEventListener("resize", onResize);
  listenerDisposers.push(() => window.removeEventListener("resize", onResize));

  let isDisposed = false;

  function dispose() {
    if (isDisposed) return;
    isDisposed = true;

    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }

    listenerDisposers.forEach(disposeListener => {
      try { disposeListener(); } catch (e) {}
    });

    resetModelState();

    clearSelection();

    try { viewCubeFeature.dispose(); } catch (e) {}
    try { axisTriadFeature.dispose(); } catch (e) {}

    try { scene.dispose(); } catch (e) {}
    try { engine.dispose(); } catch (e) {}
  }

  // public API
  return {
    engine,
    scene,
    camera,
    ground,
    loadModel,
    resetView,
    setStandardView,
    setProjectionMode,
    toggleProjectionMode,
    getProjectionMode,
    setIsolationEnabled,
    clearSelectionVisuals,
    selectNodeByUniqueId,
    clearSelection,
    handleTreeSelection,
    dispose
  };
}