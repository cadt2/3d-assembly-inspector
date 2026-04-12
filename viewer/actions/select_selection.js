// select_selection.js
// Selection action for viewer meshes and tree-driven selection.

export const SELECT_SELECTION_CONFIG = {
  OVERLAY_COLOR: [0.31, 0.86, 0.45],
  OVERLAY_ALPHA_INSTANCE: 0.58,
  OVERLAY_ALPHA_MESH: 0.28
};

export function createSelectSelectionAction(deps) {
  const {
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
  } = deps;

  function clearSelectionVisuals() {
    const selectedMeshes = getSelectedMeshes();

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

  function clearSelection(options = {}) {
    const { preserveIsolation = false } = options;

    clearSelectionVisuals();
    setSelectedMeshes([]);

    if (!preserveIsolation) {
      setIsolationState(false, []);
      restoreVisibilities();
      restorePickability();
    }
  }

  function applySelectionToMesh(mesh) {
    if (!mesh) return;

    // Use overlay/outline only to preserve original material shading and reflections.
    mesh.overlayColor = BABYLON.Color3.FromArray(SELECT_SELECTION_CONFIG.OVERLAY_COLOR);
    mesh.overlayAlpha = isInstanceLike(mesh)
      ? SELECT_SELECTION_CONFIG.OVERLAY_ALPHA_INSTANCE
      : SELECT_SELECTION_CONFIG.OVERLAY_ALPHA_MESH;

    mesh.renderOverlay = true;
    selectedInstanceOverlays.add(mesh);

    mesh.renderOutline = false;
    mesh.outlineWidth = 0;
  }

  function selectNodeByUniqueId(uniqueId, options = {}) {
    const { suppressEvent = false } = options;
    const { isolationActive, isolatedScopeMeshes } = getIsolationState();
    const keepIsolation = isolationActive;

    clearSelection({ preserveIsolation: keepIsolation });

    if (typeof uniqueId === "string") {
      // ignore selection of assembly root from here; UI should not select root
      if (uniqueId.startsWith(`node_root_${assemblyName}`)) {
        return;
      }

      const idMatch = /^node_(\d+)$/.exec(uniqueId);
      if (idMatch) {
        uniqueId = Number(idMatch[1]);
      }
    }

    if (typeof uniqueId !== "number") {
      return;
    }

    const node = nodeMap.get(uniqueId);
    if (!node) return;

    const meshes = getRenderableMeshesFromNode(node);
    meshes.forEach(mesh => applySelectionToMesh(mesh));
    setSelectedMeshes(meshes);

    if (keepIsolation) {
      const scopeMeshes = isolatedScopeMeshes.length > 0 ? isolatedScopeMeshes : meshes;
      applyContextVisibility(scopeMeshes, "hidden");
    } else {
      applyContextVisibility(meshes, "dim", 0.55);
    }

    if (!suppressEvent && typeof onNodePicked === "function") {
      onNodePicked({
        uniqueId: node.uniqueId,
        nodeId: node.id,
        nodeName: node.name || `node_${node.uniqueId}`,
        treeNodeId: `node_${node.uniqueId}`
      });
    }
  }

  return {
    clearSelectionVisuals,
    clearSelection,
    selectNodeByUniqueId
  };
}
