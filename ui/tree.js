export function createTree() {
    const tree = new dhx.Tree(null, {
        data: []
    });

    tree.events.on("ItemClick", (id) => {
        console.log("Tree selected:", id);
    });

    function setTreeData(data) {
        tree.data.removeAll();
        tree.data.parse(data);
    }

    return {
        tree,
        setTreeData
    };
}