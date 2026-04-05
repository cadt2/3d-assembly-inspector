export function createTree() {
    const tree = new dhx.Tree(null, {
        data: [
            {
                id: "assembly",
                value: "Assembly",
                open: true,
                items: [
                    { id: "part1", value: "Part_01 (x4)" },
                    { id: "part2", value: "Part_02 (x2)" }
                ]
            }
        ]
    });

    tree.events.on("ItemClick", (id) => {
        console.log("Tree selected:", id);
    });

    return tree;
}