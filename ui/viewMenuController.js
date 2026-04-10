export function createViewMenuController(options = {}) {
    const {
        getViewerApi,
        setProjectionControlValue
    } = options;

    function normalizeMode(mode) {
        return mode === "orthographic" ? "orthographic" : "perspective";
    }

    function syncProjectionFromViewer() {
        const viewerApi = typeof getViewerApi === "function" ? getViewerApi() : null;
        if (!viewerApi || typeof viewerApi.getProjectionMode !== "function") return;

        const mode = normalizeMode(viewerApi.getProjectionMode());
        if (typeof setProjectionControlValue === "function") {
            setProjectionControlValue(mode);
        }
    }

    function applyProjectionSelection(id, state) {
        const viewerApi = typeof getViewerApi === "function" ? getViewerApi() : null;
        if (!viewerApi || typeof viewerApi.setProjectionMode !== "function") {
            return false;
        }

        const modeValue = state?.stateSnapshot?.projectionMode;
        const wantsIsometric = modeValue === "Isometric" || id === "projectionIso";

        if (wantsIsometric && typeof viewerApi.setStandardView === "function") {
            const applied = viewerApi.setStandardView("isometric");
            if (applied && typeof setProjectionControlValue === "function") {
                setProjectionControlValue("perspective");
            }
            return !!applied;
        }

        const desiredMode = wantsIsometric ? "perspective" : "orthographic";

        const mode = normalizeMode(viewerApi.setProjectionMode(desiredMode));
        if (typeof setProjectionControlValue === "function") {
            setProjectionControlValue(mode);
        }
        return true;
    }

    function applyOrthoFaceSelection(id) {
        const viewerApi = typeof getViewerApi === "function" ? getViewerApi() : null;
        if (!viewerApi || typeof viewerApi.setStandardView !== "function") return false;

        const map = {
            viewTop: "top",
            viewBottom: "bottom",
            viewFront: "front",
            viewBack: "back",
            viewLeft: "left",
            viewRight: "right"
        };

        const viewName = map[id];
        if (!viewName) return false;

        const applied = viewerApi.setStandardView(viewName);
        if (applied && typeof setProjectionControlValue === "function") {
            setProjectionControlValue("orthographic");
        }
        return !!applied;
    }

    function handleToolbarClick(id, state = {}) {
        if (id === "projectionMode" || id === "projectionOrtho" || id === "projectionIso") {
            return applyProjectionSelection(id, state);
        }

        if (id === "viewTop" || id === "viewBottom" || id === "viewFront" || id === "viewBack" || id === "viewLeft" || id === "viewRight") {
            return applyOrthoFaceSelection(id);
        }

        return false;
    }

    return {
        handleToolbarClick,
        syncProjectionFromViewer
    };
}
