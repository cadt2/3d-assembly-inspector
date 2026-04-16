export function createToolbar(options = {}) {
    const { onClick } = options;
    const toggleState = {
        isolate: false
    };

    function getIsolateButtonConfig() {
        const pressed = !!toggleState.isolate;

        return {
            icon: pressed ? "mdi mdi-cube-scan" : "mdi mdi-cube-outline",
            tooltip: pressed ? "Exit Isolate" : "Isolate Selection",
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
                tooltip: "Open Assembly",
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
                tooltip: "Fit View",
                view: "link",
                size: "medium",
                css: "toolbar-icon-link"
            },
            {
                id: "projectionMode",
                type: "selectButton",
                value: "Ortho",
                css: "toolbar-ortho-list",
                items: [
                    { id: "projectionOrtho", value: "Ortho", icon: "mdi mdi-vector-square" },
                    { id: "projectionIso", value: "Isometric", icon: "mdi mdi-cube" }
                ]
            },
            {
                id: "orthoFacesMenu",
                value: "View Orientation",
                icon: "mdi mdi-axis-arrow-info",
                items: [
                    { id: "viewTop", value: "Top", icon: "mdi mdi-axis-z-arrow" },
                    { id: "viewBottom", value: "Bottom", icon: "mdi mdi-axis-z-arrow mdi-rotate-180" },
                    { id: "viewFront", value: "Front", icon: "mdi mdi-axis-y-arrow" },
                    { id: "viewBack", value: "Back", icon: "mdi mdi-axis-y-arrow mdi-rotate-180" },
                    { id: "viewLeft", value: "Left", icon: "mdi mdi-axis-x-arrow mdi-rotate-180" },
                    { id: "viewRight", value: "Right", icon: "mdi mdi-axis-x-arrow" }
                ]
            }
        ]
    });

    toolbar.disable("isolate");

    function syncToggleButton(id) {
        if (id === "isolate") {
            toolbar.data.update(id, getIsolateButtonConfig());
        }
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

    function setControlValue(id, value) {
        if (!id) return;
        try {
            if (typeof toolbar.setState === "function") {
                toolbar.setState({ [id]: value });
                return;
            }
        } catch (e) {}

        try {
            toolbar.data.update(id, { value });
        } catch (e) {}
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
            const stateSnapshot = typeof toolbar.getState === "function" ? toolbar.getState() : null;
            onClick(id, { pressed, stateSnapshot });
        }
    });

    return {
        toolbar,
        setToggleState,
        getToggleState,
        setItemEnabled,
        setControlValue
    };
}