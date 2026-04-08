// viewer3d.js
// Viewer actualizado: root no seleccionable desde el tree, tree abierto por defecto,
// y soporte para selección desde el tree (sin loops) via handleTreeSelection.

export function initViewer(containerId, options = {}) {
  const {
    modelPath = "./assets/models/",
    modelFile = "Glider-Retract-Landing-Gear.glb",
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
  let selectedMeshes = [];
  let currentRadius = 1;
  let allModelMeshes = [];
  const originalVisibility = new Map();

  function restoreVisibilities() {
    originalVisibility.forEach((v, mesh) => {
      try { mesh.visibility = v; } catch (e) {}
    });
    originalVisibility.clear();
  }

  function clearSelection() {
    selectedMeshes.forEach(mesh => {
      try { mesh.renderOutline = false; mesh.outlineWidth = 0; } catch (e) {}
    });
    selectedMeshes = [];
    restoreVisibilities();
  }

  function applySelectionToMesh(mesh, outlineWidth) {
    mesh.outlineColor = new BABYLON.Color3(1, 0.55, 0);
    mesh.outlineWidth = outlineWidth;
    mesh.renderOutline = true;
  }

  function dimUnselected(selectedArray, dimFactor = 0.55) {
    if (!allModelMeshes || allModelMeshes.length === 0) return;
    const selSet = new Set(selectedArray.map(m => m.uniqueId));
    allModelMeshes.forEach(mesh => {
      if (!mesh || mesh === ground) return;
      if (isInstanceLike(mesh)) return;
      if (selSet.has(mesh.uniqueId)) {
        if (!originalVisibility.has(mesh)) originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
        try { mesh.visibility = 1; } catch (e) {}
        return;
      }
      if (!originalVisibility.has(mesh)) originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
      try { mesh.visibility = dimFactor; } catch (e) {}
    });
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
      if (uniqueId.startsWith("node_")) {
        const num = parseInt(uniqueId.replace("node_", ""), 10);
        if (!isNaN(num)) uniqueId = num;
      }
    }

    if (typeof uniqueId === "number") {
      const node = nodeMap.get(uniqueId);
      if (!node) return;
      const meshes = getRenderableMeshesFromNode(node);
      const outlineW = Math.max((currentRadius || 1) * 0.002, 0.01);
      meshes.forEach(mesh => applySelectionToMesh(mesh, outlineW));
      selectedMeshes = meshes;
      dimUnselected(selectedMeshes, 0.55);

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
    // do not allow selecting the assembly root
    if (treeNodeId.startsWith(`node_root_${assemblyName}`)) {
      // optionally, we could select all root nodes instead; spec says block selection
      return;
    }
    // call select but suppress event to avoid loops (UI already triggered this)
    selectNodeByUniqueId(treeNodeId, { suppressEvent: true });
    requestRender();
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

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerLeave);
  canvas.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener("wheel", () => requestRender());
  camera.onViewMatrixChangedObservable.add(() => requestRender());

  // -----------------------
  // load scene
  // -----------------------
  BABYLON.SceneLoader.Append(modelPath, modelFile, scene,
    function () {
      try {
        scene.meshes.forEach(mesh => {
          if (mesh && mesh !== ground) {
            try { mesh.computeWorldMatrix(true); mesh.refreshBoundingInfo(true); mesh.freezeWorldMatrix(); } catch (e) {}
          }
        });

        try { scene.createOrUpdateSelectionOctree(128); } catch (e) {}
        try { scene.freezeMaterials(); } catch (e) {}

        scene.render();

        allModelMeshes = scene.meshes.filter(mesh => mesh !== ground && mesh.getTotalVertices && mesh.getTotalVertices() > 0);

        if (allModelMeshes.length > 0) {
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

        // populate nodeMap using effective roots
        const effectiveRoots = getEffectiveRootNodes(scene);
        effectiveRoots.forEach(rootNode => {
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

        // pointer picking handler (select sub-assembly or root piece)
        scene.onPointerObservable.add(pointerInfo => {
          if (middleMouseDown) return;
          if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

          const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
          if (!pickedMesh) return;

          if (pickedMesh === ground || (pickedMesh.name && pickedMesh.name.toLowerCase().includes("ground"))) {
            clearSelection();
            requestRender();
            if (typeof onNodePicked === "function") onNodePicked(null);
            return;
          }

          // getSelectableAncestor based on effective roots
          const selectable = (function getSelectableAncestorInline(node) {
            if (!node) return null;
            const roots = getEffectiveRootNodes(scene);
            const rootIds = new Set(roots.map(r => r.uniqueId));
            if (rootIds.has(node.uniqueId)) return node;
            let current = node;
            while (current && current.parent) {
              if (rootIds.has(current.parent.uniqueId)) return current.parent;
              current = current.parent;
            }
            current = node;
            while (current && current.parent) current = current.parent;
            return current || node;
          })(pickedMesh);

          if (!selectable) return;

          // selection from model should notify UI (onNodePicked)
          selectNodeByUniqueId(selectable.uniqueId, { suppressEvent: false });
          requestRender();

          if (typeof onNodePicked === "function") {
            // onNodePicked is already called inside selectNodeByUniqueId (for model picks)
            // but we keep this as a defensive extra payload for compatibility.
            onNodePicked({
              uniqueId: selectable.uniqueId,
              nodeId: selectable.id,
              nodeName: selectable.name || `node_${selectable.uniqueId}`,
              treeNodeId: `node_${selectable.uniqueId}`
            });
          }
        });

        // build tree data with dynamic assembly root wrapper and flattened __root__
        const effectiveRootNodes = getEffectiveRootNodes(scene);
        const treeChildren = buildSceneTreeDataForRootNodes(effectiveRootNodes);
        const treeData = [
          {
            id: `node_root_${assemblyName}`,
            value: assemblyName,
            open: true,
            data: { isAssemblyRoot: true, assemblyName },
            items: treeChildren
          }
        ];

        if (onLoaded) {
          onLoaded({
            treeData,
            engine,
            scene,
            camera,
            ground,
            selectNodeByUniqueId,
            clearSelection,
            handleTreeSelection // <-- use this from your UI tree select handler
          });
        }

        requestRender();
      } catch (error) {
        console.error("Error inside SceneLoader success callback:", error);
        if (onError) onError(error);
      }
    },
    null,
    function (_scene, message, exception) {
      console.error("Error loading model:", message, exception);
      if (onError) onError(exception || new Error(message));
    }
  );

  // resize
  window.addEventListener("resize", () => {
    engine.resize();
    requestRender();
  });

  // public API
  return {
    engine,
    scene,
    camera,
    ground,
    selectNodeByUniqueId,
    clearSelection,
    handleTreeSelection
  };
}