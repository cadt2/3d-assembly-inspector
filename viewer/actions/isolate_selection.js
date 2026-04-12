// isolate_selection.js
// Isolate-selection action for viewer visibility and pickability behavior.

export const ISOLATE_SELECTION_CONFIG = {
  MODES: {
    HIDDEN: "hidden",
    DIM: "dim"
  },
  DIM_FACTOR: 0.55
};

export function createIsolateSelectionAction(deps) {
  const {
    getAllModelMeshes,
    getGroundMesh,
    isInstanceLike,
    originalVisibility,
    originalPickable,
    restorePickability,
    restoreVisibilities,
    getSelectedMeshes,
    getIsolationState,
    setIsolationState,
    resetView,
    requestRender
  } = deps;

  function applyContextVisibility(selectedArray, mode = ISOLATE_SELECTION_CONFIG.MODES.DIM, dimFactor = ISOLATE_SELECTION_CONFIG.DIM_FACTOR) {
    const allModelMeshes = getAllModelMeshes();
    const ground = getGroundMesh();

    if (!allModelMeshes || allModelMeshes.length === 0) return;

    const selSet = new Set((selectedArray || []).map(mesh => mesh.uniqueId));

    allModelMeshes.forEach(mesh => {
      if (!mesh || mesh === ground) return;
      const supportsVisibility = !isInstanceLike(mesh);

      if (mode === ISOLATE_SELECTION_CONFIG.MODES.HIDDEN && !originalPickable.has(mesh)) {
        originalPickable.set(mesh, mesh.isPickable);
      }

      if (selSet.has(mesh.uniqueId)) {
        if (supportsVisibility) {
          if (!originalVisibility.has(mesh)) {
            originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
          }
          try { mesh.visibility = 1; } catch (e) {}
        }

        if (mode === ISOLATE_SELECTION_CONFIG.MODES.HIDDEN) {
          try { mesh.isPickable = true; } catch (e) {}
        }

        return;
      }

      if (supportsVisibility) {
        if (!originalVisibility.has(mesh)) {
          originalVisibility.set(mesh, mesh.visibility != null ? mesh.visibility : 1);
        }
        try { mesh.visibility = mode === ISOLATE_SELECTION_CONFIG.MODES.HIDDEN ? 0 : dimFactor; } catch (e) {}
      }

      if (mode === ISOLATE_SELECTION_CONFIG.MODES.HIDDEN) {
        try { mesh.isPickable = false; } catch (e) {}
      }
    });

    if (mode !== ISOLATE_SELECTION_CONFIG.MODES.HIDDEN) {
      restorePickability();
    }
  }

  function setIsolationEnabled(enabled) {
    const nextEnabled = !!enabled;
    const { isolationActive } = getIsolationState();

    if (nextEnabled === isolationActive) {
      return isolationActive;
    }

    if (nextEnabled) {
      const selectedMeshes = getSelectedMeshes();
      if (!selectedMeshes.length) {
        return false;
      }

      const nextScope = selectedMeshes.slice();
      setIsolationState(true, nextScope);
      applyContextVisibility(nextScope, ISOLATE_SELECTION_CONFIG.MODES.HIDDEN);

      // CAD-like behavior: when entering isolate, frame the isolated subset.
      resetView();
      requestRender();
      return true;
    }

    setIsolationState(false, []);
    restorePickability();

    const selectedMeshes = getSelectedMeshes();
    if (selectedMeshes.length) {
      applyContextVisibility(selectedMeshes, ISOLATE_SELECTION_CONFIG.MODES.DIM, ISOLATE_SELECTION_CONFIG.DIM_FACTOR);
    } else {
      restoreVisibilities();
    }

    // Return to full-assembly framing when isolate is turned off.
    resetView();
    requestRender();
    return false;
  }

  return {
    applyContextVisibility,
    setIsolationEnabled
  };
}
