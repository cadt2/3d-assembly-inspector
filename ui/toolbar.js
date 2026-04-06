export function createToolbar() {
    const toolbar = new dhx.Toolbar(null, {
        css: "viewer-toolbar",
        data: [
            {
                id: "load",
                type: "button",
                icon: "mdi mdi-folder-open-outline",
                tooltip: "Load Model"
            },
            {
                id: "isolate",
                type: "button",
                icon: "mdi mdi-cube-outline",
                tooltip: "Isolate"
            },
            {
                id: "reset",
                type: "button",
                icon: "mdi mdi-axis-arrow",
                tooltip: "Reset View"
            }
        ]
    });

    toolbar.events.on("click", (id) => {
        console.log("Toolbar click:", id);
    });

    return toolbar;
}