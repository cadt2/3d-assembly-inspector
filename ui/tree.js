// tree.js (updated)
// - ItemClick -> passes treeId (string) to select handler
// - adds selectByTreeId(treeId) for programmatic selection
// - keeps selectByUniqueId(uniqueId) mapping

const treeHoverClass = dhx.cssManager.add({
    backgroundColor: "#3b82f6",
    color: "#ffffff",
}, "tree-hover-blue");

const treeSelectedClass = dhx.cssManager.add({
    backgroundColor: "#f97316",
    color: "#ffffff",
}, "tree-selected-orange");

const treeRowClass = dhx.cssManager.add({
    display: "block",
    width: "100%",
    padding: "2px 6px",
    boxSizing: "border-box",
}, "tree-row-base");

const treeDisabledClass = dhx.cssManager.add({
    opacity: "0.55",
    pointerEvents: "none",
}, "tree-disabled-state");

function buildParentMap(items, parentId = null, parentMapRef = new Map(), itemMap = new Map()) {
    items.forEach((item) => {
        parentMapRef.set(item.id, parentId);
        itemMap.set(item.id, item);

        if (Array.isArray(item.items) && item.items.length > 0) {
            buildParentMap(item.items, item.id, parentMapRef, itemMap);
        }
    });

    return { parentMap: parentMapRef, itemMap };
}

export function createTree() {
    let selectedTreeId = null;
    let hoveredTreeId = null;
    let interactionEnabled = true;

    const tree = new dhx.Tree(null, {
        css: "parts-tree",
        data: [],
        template: (item) => {
            const classes = [treeRowClass];

            if (item.id === hoveredTreeId) {
                classes.push(treeHoverClass);
            }

            if (item.id === selectedTreeId) {
                classes.push(treeSelectedClass);
            }

            if (!interactionEnabled) {
                classes.push(treeDisabledClass);
            }

            // preserve original value (may be empty) - do not normalize
            const display = (item.value !== undefined && item.value !== null) ? item.value : "";
            return `<div class="${classes.join(" ")}">${display}</div>`;
        }
    });

    let selectHandler = null;
    let uniqueIdToTreeId = new Map();
    let parentMap = new Map();
    let itemMap = new Map();

    // NOTE: now passes the tree node id (string) to the select handler.
    tree.events.on("ItemClick", (id) => {
        if (!interactionEnabled) return;

        const item = tree.data.getItem(id);
        selectedTreeId = id;

        // keep dhtmlx selection state consistent
        tree.selection.remove();
        tree.selection.add(id);
        tree.focusItem(id);

        tree.paint();

        if (selectHandler && item && item.data) {
            // pass the tree id string (e.g. "node_<mesh.id>") so the viewer can handle it directly
            selectHandler(id);
        }
    });

    tree.events.on("MouseOver", (id) => {
        if (!interactionEnabled) return;
        hoveredTreeId = id;
        tree.paint();
    });

    tree.events.on("MouseOut", () => {
        if (!interactionEnabled) return;
        hoveredTreeId = null;
        tree.paint();
    });

    function setTreeData(data) {
        tree.data.removeAll();
        tree.data.parse(data);

        // Auto-expand top-level containers so the user sees model contents immediately.
        if (Array.isArray(data)) {
            data.forEach((item) => {
                if (item && item.id && Array.isArray(item.items) && item.items.length > 0) {
                    tree.expand(item.id);
                }
            });
        }

        uniqueIdToTreeId = new Map();
        parentMap = new Map();
        itemMap = new Map();

        const maps = buildParentMap(data);
        parentMap = maps.parentMap;
        itemMap = maps.itemMap;

        maps.itemMap.forEach((item, treeId) => {
            if (item.data && item.data.uniqueId !== undefined) {
                uniqueIdToTreeId.set(item.data.uniqueId, treeId);
            }
        });

        selectedTreeId = null;
        hoveredTreeId = null;
        tree.paint();
    }

    function onSelect(callback) {
        // callback will receive the treeId string (e.g. "node_<mesh.id>")
        selectHandler = callback;
    }

    function expandParentChain(treeId) {
        let currentParentId = parentMap.get(treeId);

        while (currentParentId) {
            tree.expand(currentParentId);
            currentParentId = parentMap.get(currentParentId);
        }
    }

    function selectByUniqueId(uniqueId) {
        const treeId = uniqueIdToTreeId.get(uniqueId);
        if (!treeId) {
            return;
        }

        expandParentChain(treeId);

        selectedTreeId = treeId;
        tree.selection.remove();
        tree.selection.add(treeId);
        tree.focusItem(treeId);
        tree.paint();
    }

    function selectByTreeId(treeId) {
        if (!treeId) return;
        // guard if user clicked the assembly root and you don't want it selectable:
        // if (treeId.startsWith("node_root_")) return;

        if (!itemMap.has(treeId)) return;

        expandParentChain(treeId);

        selectedTreeId = treeId;
        tree.selection.remove();
        tree.selection.add(treeId);
        tree.focusItem(treeId);
        tree.paint();
    }

    function clearSelection() {
        selectedTreeId = null;
        tree.selection.remove();
        tree.paint();
    }

    function setInteractionEnabled(enabled) {
        interactionEnabled = !!enabled;
        if (interactionEnabled) {
            tree.paint();
            return;
        }

        hoveredTreeId = null;
        tree.paint();
    }

    // helper to get item data by treeId (useful for UI panels)
    function getItemData(treeId) {
        return itemMap.get(treeId) || null;
    }

    return {
        tree,
        setTreeData,
        onSelect,
        selectByUniqueId,
        selectByTreeId,
        clearSelection,
        setInteractionEnabled,
        getItemData
    };
}