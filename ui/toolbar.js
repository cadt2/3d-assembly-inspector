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
                    { id: "projectionOrtho", value: "Ortho" },
                    { id: "projectionIso", value: "Isometric" }
                ]
            },
            {
                id: "orthoFacesMenu",
                value: "View Orientation",
                items: [
                    { id: "viewTop", value: "Top" },
                    { id: "viewBottom", value: "Bottom" },
                    { id: "viewFront", value: "Front" },
                    { id: "viewBack", value: "Back" },
                    { id: "viewLeft", value: "Left" },
                    { id: "viewRight", value: "Right" }
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