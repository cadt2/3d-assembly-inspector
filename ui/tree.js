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

            return `<div class="${classes.join(" ")}">${item.value}</div>`;
        }
    });

    let selectHandler = null;
    let uniqueIdToTreeId = new Map();
    let parentMap = new Map();

    tree.events.on("ItemClick", (id) => {
        const item = tree.data.getItem(id);
        selectedTreeId = id;
        tree.paint();

        if (selectHandler && item && item.data) {
            selectHandler(item);
        }
    });

    tree.events.on("MouseOver", (id) => {
        hoveredTreeId = id;
        tree.paint();
    });

    tree.events.on("MouseOut", () => {
        hoveredTreeId = null;
        tree.paint();
    });

    function setTreeData(data) {
        tree.data.removeAll();
        tree.data.parse(data);

        uniqueIdToTreeId = new Map();
        parentMap = new Map();

        const maps = buildParentMap(data);
        parentMap = maps.parentMap;

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

    return {
        tree,
        setTreeData,
        onSelect,
        selectByUniqueId
    };
}