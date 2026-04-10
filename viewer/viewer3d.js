// viewer3d.js
// Viewer actualizado: root no seleccionable desde el tree, tree abierto por defecto,
// y soporte para selección desde el tree (sin loops) via handleTreeSelection.

class ColorifyPluginMaterial extends BABYLON.MaterialPluginBase {
  color = new BABYLON.Color3(0.15, 0.85, 0.9);
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
    onLoaded,
    onError,
    onNodePicked
  } = options;

  const assemblyName = (modelFile || "").replace(/\.[^/.]+$/, "") || "assembly";

  // -----------------------
  // Helpers
  // -----------------------
  function isHelperNode(node) {
    if (!node) return false;
    const name = (node.name || "").toLowerCase();
    const className = typeof node.getClassName === "function" ? node.getClassName() : "";
    if (!name) return true; // treat unnamed as helper for safety (optional)
    if (name.includes("ground")) return true;
    if (className === "Camera" || className === "FreeCamera" || className === "HemisphericLight" || className === "DirectionalLight") return true;
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

  // buildTreeNode sets open:true for every node so tree arrives fully expanded
  function buildTreeNode(node) {
    const children = typeof node.getChildren === "function" ? node.getChildren() : [];
    const items = children
      .filter(child => shouldIncludeSceneNode(child))
      .map(child => buildTreeNode(child));
    return {
      id: `node_${node.uniqueId}`,
      value: node.name && node.name.length ? node.name : `Unnamed_${node.uniqueId}`,
      open: true,
      data: {
        uniqueId: node.uniqueId,
        nodeId: node.id,
        nodeName: node.name || `node_${node.uniqueId}`,
        nodeType: typeof node.getClassName === "function" ? node.getClassName() : "Unknown",
        isPart: typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0
      },
      items
    };
  }

  function buildSceneTreeDataForRootNodes(rootNodes) {
    return rootNodes
      .filter(node => shouldIncludeSceneNode(node))
      .map(node => buildTreeNode(node));
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
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 1, 1);
  scene.autoClear = true;

  ensureColorifyPluginRegistration();

  // camera + lights + ground
  const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 3, 6, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 1;
  camera.upperRadiusLimit = 500;
  camera.wheelPrecision = 150;
  camera.minZ = 0.001;

  if (camera.inputs?.attached?.pointers) camera.inputs.attached.pointers.buttons = [];

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);
  ground.isPickable = true;

  const gridMaterial = new BABYLON.GridMaterial("gridMaterial", scene);
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = 0.45;
  gridMaterial.backFaceCulling = false;
  gridMaterial.mainColor = new BABYLON.Color3(1, 1, 1);
  gridMaterial.lineColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  gridMaterial.opacity = 0.85;
  ground.material = gridMaterial;

  BABYLON.SceneLoader.ShowLoadingScreen = false;

  // -----------------------
  // selection state
  // -----------------------
  const nodeMap = new Map();
  let effectiveRootIdSet = new Set();
  let selectedMeshes = [];
  let currentRadius = 1;
  let allModelMeshes = [];
  const originalVisibility = new Map();
  const originalPickable = new Map();
  let activeModelAssets = null;
  const selectedMeshMaterials = new Map();
  const selectedInstanceOverlays = new Set();
  let isolationActive = false;

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

  function clearSelectionVisuals() {
    selectedMeshes.forEach(mesh => {
      try {
        const saved = selectedMeshMaterials.get(mesh);
        if (saved) {
          mesh.material = saved.original;
          if (saved.cloned && typeof saved.cloned.dispose === "function") {
            saved.cloned.dispose();
          }
        }

        if (selectedInstanceOverlays.has(mesh)) {
          mesh.renderOverlay = false;
        }

        mesh.renderOutline = false;
        mesh.outlineWidth = 0;
      } catch (e) {}
    });
    selectedMeshMaterials.clear();
    selectedInstanceOverlays.clear();
  }

  function clearSelection() {
    clearSelectionVisuals();
    selectedMeshes = [];
    isolationActive = false;
    restoreVisibilities();
    restorePickability();
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

    if (activeModelAssets) {
      disposeModelAssets(activeModelAssets);
      activeModelAssets = null;
    }
  }

  function buildViewerPayload(treeData) {
    return {
      treeData,
      engine,
      scene,
      camera,
      ground,
      loadModel,
      setIsolationEnabled,
      clearSelectionVisuals,
      selectNodeByUniqueId,
      clearSelection,
      handleTreeSelection
    };
  }

  function applySelectionToMesh(mesh) {
    if (!mesh) return;

    if (isInstanceLike(mesh)) {
      // InstancedMesh cannot receive a material assignment directly.
      mesh.overlayColor = new BABYLON.Color3(0.15, 0.85, 0.9);
      mesh.overlayAlpha = 0.6;
      mesh.renderOverlay = true;
      selectedInstanceOverlays.add(mesh);
      return;
    }

    if (!mesh.material || typeof mesh.material.clone !== "function") return;

    if (selectedMeshMaterials.has(mesh)) return;

    const originalMaterial = mesh.material;
    const cloned = originalMaterial.clone(`sel_${originalMaterial.name || "mat"}_${mesh.uniqueId}`);
    if (!cloned) return;

    // Some Babylon versions/cloned materials may not auto-attach registered plugins.
    if (!cloned.colorify) {
      cloned.colorify = new ColorifyPluginMaterial(cloned);
    }

    mesh.material = cloned;

    const plugin = cloned.pluginManager?.getPlugin?.("Colorify") || cloned.colorify;
    if (plugin) {
      // Autodesk Inventor-like cyan selection tint.
      plugin.color = new BABYLON.Color3(0.15, 0.85, 0.9);
      plugin.isEnabled = true;
    }

    mesh.renderOutline = true;
    mesh.outlineColor = new BABYLON.Color3(0.15, 0.95, 1.0);
    mesh.outlineWidth = Math.max((currentRadius || 1) * 0.0015, 0.008);

    selectedMeshMaterials.set(mesh, { original: originalMaterial, cloned });
  }

  function applyContextVisibility(selectedArray, mode = "dim", dimFactor = 0.55) {
    if (!allModelMeshes || allModelMeshes.length === 0) return;
    const selSet = new Set(selectedArray.map(m => m.uniqueId));
    allModelMeshes.forEach(mesh => {
      if (!mesh || mesh === ground) return;
      const supportsVisibility = !isInstanceLike(mesh);

      if (mode === "hidden" && !originalPickable.has(mesh)) {
        originalPickable.set(mesh, mesh.isPickable);
      }

      if (selSet.has(mesh.uniqueId)) {
        if (supportsVisibility) {
          if (!originalVisibility.has(mesh)) originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
          try { mesh.visibility = 1; } catch (e) {}
        }
        if (mode === "hidden") {
          try { mesh.isPickable = true; } catch (e) {}
        }
        return;
      }

      if (supportsVisibility) {
        if (!originalVisibility.has(mesh)) originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
        try { mesh.visibility = mode === "hidden" ? 0 : dimFactor; } catch (e) {}
      }
      if (mode === "hidden") {
        try { mesh.isPickable = false; } catch (e) {}
      }
    });

    if (mode !== "hidden") {
      restorePickability();
    }
  }

  function setIsolationEnabled(enabled) {
    const nextEnabled = !!enabled;

    if (nextEnabled === isolationActive) {
      return isolationActive;
    }

    if (nextEnabled) {
      if (!selectedMeshes.length) {
        return false;
      }

      isolationActive = true;
      applyContextVisibility(selectedMeshes, "hidden");
      requestRender();
      return true;
    }

    isolationActive = false;
    restorePickability();
    if (selectedMeshes.length) {
      applyContextVisibility(selectedMeshes, "dim", 0.55);
    } else {
      restoreVisibilities();
    }
    requestRender();
    return false;
  }

  // selectNodeByUniqueId supports numbers, "node_<id>" strings, and special root id.
  // second param options: { suppressEvent: boolean } to avoid calling onNodePicked (prevents loop)
  function selectNodeByUniqueId(uniqueId, options = {}) {
    const { suppressEvent = false } = options;
    clearSelection();

    if (typeof uniqueId === "string") {
      // ignore selection of assembly root from here; UI should not select root
      if (uniqueId.startsWith(`node_root_${assemblyName}`)) {
        // selecting root is not allowed via tree -> just return (or select all if desired)
        return;
      }
      const idMatch = /^node_(\d+)$/.exec(uniqueId);
      if (idMatch) {
        uniqueId = Number(idMatch[1]);
      }
    }

    if (typeof uniqueId === "number") {
      const node = nodeMap.get(uniqueId);
      if (!node) return;
      const meshes = getRenderableMeshesFromNode(node);
      meshes.forEach(mesh => applySelectionToMesh(mesh));
      selectedMeshes = meshes;
      applyContextVisibility(selectedMeshes, isolationActive ? "hidden" : "dim", 0.55);

      // if we should notify UI, include treeNodeId
      if (!suppressEvent && typeof onNodePicked === "function") {
        onNodePicked({
          uniqueId: node.uniqueId,
          nodeId: node.id,
          nodeName: node.name || `node_${node.uniqueId}`,
          treeNodeId: `node_${node.uniqueId}`
        });
      }
    }
  }

  // handle selection coming from the DHTMLX Tree.
  // If the clicked id is the assembly root (node_root_<assemblyName>) we ignore it.
  function handleTreeSelection(treeNodeId) {
    if (!treeNodeId) return;
    if (isolationActive) return;
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
  const baseOrbitSensitivity = 0.0025;

  function computeOrbitSensitivity() {
    const r = Math.max(currentRadius, 0.0001);
    return baseOrbitSensitivity / Math.cbrt(r);
  }

  function computeWheelPrecision() {
    const calc = Math.round(currentRadius * 40);
    return Math.min(Math.max(calc, 80), 500);
  }

  function pickGround(clientX, clientY) {
    const pick = scene.pick(clientX, clientY, mesh => mesh === ground, false, camera);
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint.clone();
  }

  let groundMarker = null;
  function createOrUpdateGroundMarker(center, size) {
    const markerDiameter = Math.max(size * 0.6, 0.1);
    if (!groundMarker || groundMarker.isDisposed()) {
      groundMarker = BABYLON.MeshBuilder.CreateCylinder("groundMarker", { diameter: markerDiameter, height: 0.002, tessellation: 64 }, scene);
      groundMarker.isPickable = false;
      const mat = new BABYLON.StandardMaterial("groundMarkerMat", scene);
      mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
      mat.alpha = 0.12;
      mat.disableLighting = true;
      groundMarker.material = mat;
    }
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
  engine.runRenderLoop(() => { if (renderRequested) scene.render(); });

  const listenerDisposers = [];

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

  const viewMatrixObserver = camera.onViewMatrixChangedObservable.add(() => requestRender());
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
      if (isolationActive) return;

      const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
      if (!pickedMesh) return;

      if (pickedMesh === ground || (pickedMesh.name && pickedMesh.name.toLowerCase().includes("ground"))) {
        clearSelection();
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
    scene.meshes.forEach(mesh => {
      if (mesh && mesh !== ground) {
        try { mesh.computeWorldMatrix(true); mesh.refreshBoundingInfo(true); mesh.freezeWorldMatrix(); } catch (e) {}
      }
    });

    try { scene.createOrUpdateSelectionOctree(128); } catch (e) {}
    try { scene.freezeMaterials(); } catch (e) {}

    scene.render();

    allModelMeshes = scene.meshes.filter(mesh => mesh !== ground && mesh.getTotalVertices && mesh.getTotalVertices() > 0);

    if (allModelMeshes.length === 0) return;

    const min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

    allModelMeshes.forEach(mesh => {
      try {
        const b = mesh.getBoundingInfo().boundingBox;
        const meshMin = b.minimumWorld;
        const meshMax = b.maximumWorld;
        min.x = Math.min(min.x, meshMin.x);
        min.y = Math.min(min.y, meshMin.y);
        min.z = Math.min(min.z, meshMin.z);
        max.x = Math.max(max.x, meshMax.x);
        max.y = Math.max(max.y, meshMax.y);
        max.z = Math.max(max.z, meshMax.z);
      } catch (e) {}
    });

    const center = new BABYLON.Vector3((min.x + max.x) * 0.5, (min.y + max.y) * 0.5, (min.z + max.z) * 0.5);
    const size = max.subtract(min);
    const diagonal = size.length();
    const radius = diagonal * 0.5;
    currentRadius = Math.max(radius, 0.0001);

    camera.setTarget(center);
    camera.lowerRadiusLimit = Math.max(radius * 1.2, 0.05);
    camera.upperRadiusLimit = Math.max(radius * 20, 50);
    camera.radius = Math.max(radius * 2.0, camera.lowerRadiusLimit + radius * 0.5);
    camera.minZ = Math.max(radius * 0.001, 0.001);

    const targetScaling = Math.min(Math.max(0.5 + Math.log10(currentRadius + 1), 1), 2.5);
    engine.setHardwareScalingLevel(targetScaling);

    camera.wheelPrecision = computeWheelPrecision();

    const groundFactor = 2.0;
    const groundSize = Math.max(diagonal * groundFactor, 20);
    const computedGridRatio = Math.max(diagonal / 40, 0.02);

    ground.position.x = center.x;
    ground.position.z = center.z;
    ground.position.y = min.y - Math.max(radius * 0.01, 0.001);
    ground.scaling.x = groundSize / 20;
    ground.scaling.z = groundSize / 20;

    gridMaterial.gridRatio = computedGridRatio;
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.35;

    createOrUpdateGroundMarker(center, diagonal);
  }

  function loadModel(nextModelFile = modelFile, nextModelPath = modelPath) {
    if (!nextModelFile) {
      const err = new Error("No model file provided");
      if (onError) onError(err);
      return;
    }

    resetModelState();

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

          applyModelBoundsAndCamera();
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
    setIsolationEnabled,
    clearSelectionVisuals,
    selectNodeByUniqueId,
    clearSelection,
    handleTreeSelection,
    dispose
  };
}