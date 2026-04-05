import { createToolbar } from "./toolbar.js";
import { createTree } from "./tree.js";
import { initViewer } from "../viewer/viewer3d.js";

export function createLayout() {
    const layout = new dhx.Layout("app", {
        rows: [
            { id: "topbar", height: 40 },
            {
                cols: [
                    { id: "tree", width: 260 },
                    {
                        rows: [
                            { id: "viewerToolbar", height: 44 },
                            { id: "viewer" }
                        ]
                    }
                ]
            },
            { id: "properties", height: 90, resizable: true }
        ]
    });

    const tree = createTree();
    const toolbar = createToolbar();

    layout.getCell("tree").attach(tree);
    layout.getCell("viewerToolbar").attach(toolbar);

    layout.getCell("topbar").attachHTML(`
        <div class="topbar-placeholder"></div>
    `);

    layout.getCell("viewer").attachHTML(`
        <div id="viewer-root" style="width:100%; height:100%;"></div>
    `);

    layout.getCell("properties").attachHTML(`
        <div class="properties-placeholder">
            Properties / Info Panel
        </div>
    `);

    dhx.awaitRedraw().then(() => {
        initViewer("viewer-root");
    });

    console.log("Layout + components ready");
}