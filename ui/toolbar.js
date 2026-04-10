export function createToolbar(options = {}) {
    const { onClick } = options;
    const toggleState = {
        isolate: false
    };

    function getIsolateButtonConfig() {
        const pressed = !!toggleState.isolate;

        return {
            icon: pressed ? "mdi mdi-cube-scan" : "mdi mdi-cube-outline",
            tooltip: pressed ? "Disable Isolation" : "Enable Isolation",
            view: "link",
            size: "medium",
            css: pressed ? "toolbar-icon-link toolbar-toggle-active" : "toolbar-icon-link"
        };
    }

    const toolbar = new dhx.Toolbar(null, {
        css: "viewer-toolbar",
        data: [
            {
                id: "load",
                type: "button",
                icon: "mdi mdi-folder-open-outline",
                tooltip: "Load Model",
                view: "link",
                size: "medium",
                css: "toolbar-icon-link"
            },
            {
                id: "isolate",
                type: "button",
                ...getIsolateButtonConfig()
            },
            {
                id: "reset",
                type: "button",
                icon: "mdi mdi-axis-arrow",
                tooltip: "Reset View",
                view: "link",
                size: "medium",
                css: "toolbar-icon-link"
            }
        ]
    });

    toolbar.disable("isolate");

    function syncToggleButton(id) {
        if (id !== "isolate") return;
        toolbar.data.update(id, getIsolateButtonConfig());
    }

    function setToggleState(id, pressed) {
        if (!(id in toggleState)) return;
        toggleState[id] = !!pressed;
        syncToggleButton(id);
    }

    function getToggleState(id) {
        return !!toggleState[id];
    }

    function setItemEnabled(id, enabled) {
        if (enabled) {
            toolbar.enable(id);
            return;
        }

        if (id in toggleState) {
            setToggleState(id, false);
        }
        toolbar.disable(id);
    }

    toolbar.events.on("click", (id) => {
        let pressed = null;

        if (id in toggleState) {
            toggleState[id] = !toggleState[id];
            pressed = toggleState[id];
            syncToggleButton(id);
        }

        console.log("Toolbar click:", id);
        if (typeof onClick === "function") {
            onClick(id, { pressed });
        }
    });

    return {
        toolbar,
        setToggleState,
        getToggleState,
        setItemEnabled
    };
}