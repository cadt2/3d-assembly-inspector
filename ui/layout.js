import { createToolbar } from "./toolbar.js";
import { createTree } from "./tree.js";
import { initViewer } from "../viewer/viewer3d.js";

export function createLayout() {
    const layout = new dhx.Layout("app", {
        rows: [
            { id: "topbar", height: 40 },
            {
                cols: [
                    { id: "tree", width: 320 },
                    {
                        rows: [
                            { id: "viewerToolbar", height: 55 },
                            { id: "viewer" }
                        ]
                    }
                ]
            },
            { id: "properties", height: 90, resizable: true }
        ]
    });

    //dhx.setTheme("contrast-light"); 

    const { tree, setTreeData, onSelect, selectByUniqueId, clearSelection: clearTreeSelection, setInteractionEnabled: setTreeInteractionEnabled } = createTree();
    let viewerApi = null;
    let hasSelection = false;
    let isolateActive = false;

    function syncToolbarState() {
        setItemEnabled("load", !isolateActive);
        setItemEnabled("reset", !isolateActive);
        setItemEnabled("isolate", isolateActive ? true : hasSelection);
    }

    function setIsolationState(enabled) {
        isolateActive = !!enabled;
        setToggleState("isolate", isolateActive);
        setTreeInteractionEnabled(!isolateActive);
        syncToolbarState();
    }

    function setSelectionState(selected) {
        hasSelection = !!selected;
        if (!hasSelection) {
            setIsolationState(false);
            return;
        }

        syncToolbarState();
    }

    const { toolbar, setToggleState, setItemEnabled } = createToolbar({
        onClick: (id, state = {}) => {
            if (id === "load") {
                if (!viewerApi || typeof viewerApi.loadModel !== "function") {
                    console.warn("Viewer is not ready to load a model");
                    return;
                }

                const modelName = "Glider-Retract-Landing-Gear.glb";
                const modelPath = "./assets/models/";

                viewerCell.progressShow();
                setIsolationState(false);
                setSelectionState(false);
                viewerApi.loadModel(modelName, modelPath);
                return;
            }

            if (id === "isolate") {
                if (!viewerApi || typeof viewerApi.setIsolationEnabled !== "function") {
                    setIsolationState(false);
                    return;
                }

                const applied = viewerApi.setIsolationEnabled(!!state.pressed);
                setIsolationState(applied);

                if (applied && typeof viewerApi.clearSelectionVisuals === "function") {
                    viewerApi.clearSelectionVisuals();
                }

                console.log("Isolate toggled:", applied);
            }
        }
    });

    layout.getCell("tree").attach(tree);
    layout.getCell("viewerToolbar").attach(toolbar);

    layout.getCell("topbar").attachHTML(`
        <div class="topbar-placeholder"></div>
    `);

    layout.getCell("viewer").attachHTML(`
        <div id="viewer-root" style="width: 100%; height: 100%;"></div>
    `);

    layout.getCell("properties").attachHTML(`
        <div class="properties-placeholder">
            Properties / Info Panel
        </div>
    `);

    const viewerCell = layout.getCell("viewer");
    viewerCell.progressShow();

    let treeSelectionBound = false;

    dhx.awaitRedraw().then(() => {
        viewerApi = initViewer("viewer-root", {
            autoLoad: false,
            onLoaded: (payload) => {
                if (payload && Array.isArray(payload.treeData)) {
                    setTreeData(payload.treeData);
                }

                setIsolationState(false);
                setSelectionState(false);

// Adaptación segura: soporta viewer.handleTreeSelection (si existe) o cae a selectNodeByUniqueId.
// No modificamos el tree; resolvemos el treeId -> uniqueId si es necesario.
if (!treeSelectionBound && payload) {
    // Preferimos usar handleTreeSelection si el viewer lo expone (menos mapeo aquí).
    if (typeof payload.handleTreeSelection === "function") {
        onSelect((treeIdOrItem) => {
            // tree.onSelect entrega hoy un treeId (string). Pero por compatibilidad,
            // aceptamos también un objeto item con .data.uniqueId.
            if (typeof treeIdOrItem === "string") {
                // Pasamos directamente el treeId al viewer (viewer decide cómo interpretarlo)
                payload.handleTreeSelection(treeIdOrItem);
                if (!treeIdOrItem.startsWith("node_root_")) {
                    setSelectionState(true);
                }
                return;
            }
            // si es un objeto (legacy), resolvemos uniqueId y formateamos como node_<id>
            if (treeIdOrItem && treeIdOrItem.data && treeIdOrItem.data.uniqueId !== undefined) {
                const uid = treeIdOrItem.data.uniqueId;
                payload.handleTreeSelection(`node_${uid}`);
                setSelectionState(true);
            }
        });
    } else if (typeof payload.selectNodeByUniqueId === "function") {
        // Fallback: el viewer solo ofrece selectNodeByUniqueId -> resolvemos uniqueId aquí.
        onSelect((treeIdOrItem) => {
            let unique = null;
            if (typeof treeIdOrItem === "string") {
                // treeId es algo como "node_<num>" — obtener item del tree y extraer uniqueId
                const treeItem = (typeof tree !== "undefined" && tree && tree.data && typeof tree.data.getItem === "function")
                    ? tree.data.getItem(treeIdOrItem)
                    : null;
                unique = treeItem && treeItem.data ? treeItem.data.uniqueId : null;
            } else if (treeIdOrItem && treeIdOrItem.data) {
                unique = treeIdOrItem.data.uniqueId;
            }

            if (unique !== undefined && unique !== null) {
                payload.selectNodeByUniqueId(unique);
                setSelectionState(true);
            } else {
                // útil para depuración si algo viene inesperado
                console.warn("layout.js: could not resolve uniqueId from tree selection:", treeIdOrItem);
            }
        });
    }

    treeSelectionBound = true;
}

                viewerCell.progressHide();
            },
            onNodePicked: (picked) => {
                if (!picked) {
                    clearTreeSelection();
                    setSelectionState(false);
                    return;
                }

                selectByUniqueId(picked.uniqueId);
                setSelectionState(true);
            },
            onError: () => {
                setIsolationState(false);
                setSelectionState(false);
                viewerCell.progressHide();
            }
        });
    });

    return layout;
}