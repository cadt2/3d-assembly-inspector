export function createToolbar() {
    const toolbar = new dhx.Toolbar(null, {
        css: "dhx_widget--border_bottom",
        data: [
            { id: "load", type: "button", value: "Load Model" },
            { id: "isolate", type: "button", value: "Isolate" },
            { id: "reset", type: "button", value: "Reset View" }
        ]
    });

    toolbar.events.on("click", (id) => {
        console.log("Toolbar click:", id);
    });

    return toolbar;
}