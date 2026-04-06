function shouldIncludeSceneNode(node) {
    if (!node) {
        return false;
    }

    const nodeName = node.name || "";
    const nodeType = typeof node.getClassName === "function" ? node.getClassName() : "";

    if (nodeName === "ground") {
        return false;
    }

    return nodeType === "TransformNode" || nodeType === "Mesh";
}

function buildTreeNode(node) {
    const children = typeof node.getChildren === "function" ? node.getChildren() : [];

    const items = children
        .filter((child) => shouldIncludeSceneNode(child))
        .map((child) => buildTreeNode(child));

    return {
        id: `node_${node.uniqueId}`,
        value: node.name || `node_${node.uniqueId}`,
        open: true,
        data: {
            nodeId: node.id,
            nodeName: node.name || `node_${node.uniqueId}`,
            nodeType: typeof node.getClassName === "function" ? node.getClassName() : "Unknown",
            isPart: typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0
        },
        items
    };
}

function buildSceneTreeData(scene) {
    return scene.rootNodes
        .filter((node) => shouldIncludeSceneNode(node))
        .map((node) => buildTreeNode(node));
}

export function initViewer(containerId, options = {}) {
    const { onLoaded, onError } = options;

    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Viewer container not found:", containerId);
        if (onError) onError(new Error(`Viewer container not found: ${containerId}`));
        return null;
    }

    container.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    scene.clearColor = new BABYLON.Color4(0.75, 0.85, 1, 1);

    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 2,
        Math.PI / 3,
        6,
        BABYLON.Vector3.Zero(),
        scene
    );

    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 50;
    camera.wheelPrecision = 50;

    new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(1, 1, 0),
        scene
    );

    const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 20, height: 20 },
        scene
    );

    const gridMaterial = new BABYLON.GridMaterial("gridMaterial", scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new BABYLON.Color3(1, 1, 1);
    gridMaterial.lineColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    gridMaterial.opacity = 0.85;
    ground.material = gridMaterial;

    BABYLON.SceneLoader.ShowLoadingScreen = false;

    BABYLON.SceneLoader.Append(
        "./assets/models/adanHead/",
        "adamHead.gltf",
        scene,
        function () {
            try {
                console.log("Model loaded: adamHead.gltf");

                const modelMeshes = scene.meshes.filter((mesh) => {
                    return mesh.name !== "ground" && mesh.getTotalVertices() > 0;
                });

                if (modelMeshes.length > 0) {
                    const min = new BABYLON.Vector3(
                        Number.POSITIVE_INFINITY,
                        Number.POSITIVE_INFINITY,
                        Number.POSITIVE_INFINITY
                    );

                    const max = new BABYLON.Vector3(
                        Number.NEGATIVE_INFINITY,
                        Number.NEGATIVE_INFINITY,
                        Number.NEGATIVE_INFINITY
                    );

                    modelMeshes.forEach((mesh) => {
                        const boundingBox = mesh.getBoundingInfo().boundingBox;
                        const meshMin = boundingBox.minimumWorld;
                        const meshMax = boundingBox.maximumWorld;

                        min.x = Math.min(min.x, meshMin.x);
                        min.y = Math.min(min.y, meshMin.y);
                        min.z = Math.min(min.z, meshMin.z);

                        max.x = Math.max(max.x, meshMax.x);
                        max.y = Math.max(max.y, meshMax.y);
                        max.z = Math.max(max.z, meshMax.z);
                    });

                    const center = new BABYLON.Vector3(
                        (min.x + max.x) * 0.5,
                        (min.y + max.y) * 0.5,
                        (min.z + max.z) * 0.5
                    );

                    const size = max.subtract(min);
                    const maxDimension = Math.max(size.x, size.y, size.z);

                    camera.setTarget(center);
                    camera.lowerRadiusLimit = Math.max(maxDimension * 0.8, 1);
                    camera.upperRadiusLimit = Math.max(maxDimension * 10, 20);
                    camera.radius = Math.max(maxDimension * 2.5, camera.lowerRadiusLimit + 1);

                    ground.position.x = center.x;
                    ground.position.z = center.z;
                    ground.position.y = min.y - 0.02;
                }

                const treeData = buildSceneTreeData(scene);
                console.log("GLTF tree data:", treeData);

                if (onLoaded) {
                    onLoaded({
                        treeData,
                        engine,
                        scene,
                        camera,
                        ground
                    });
                }
            } catch (error) {
                console.error("Error inside SceneLoader success callback:", error);
                if (onError) {
                    onError(error);
                }
            }
        },
        null,
        function (_scene, message, exception) {
            console.error("Error loading model:", message, exception);
            if (onError) {
                onError(exception || new Error(message));
            }
        }
    );

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });

    return {
        engine,
        scene,
        camera,
        ground
    };
}