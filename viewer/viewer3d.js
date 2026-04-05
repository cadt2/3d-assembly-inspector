export function initViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Viewer container not found:", containerId);
        return null;
    }

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 2,
        Math.PI / 3,
        5,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(1, 1, 0),
        scene
    );

    BABYLON.MeshBuilder.CreateBox("box", {}, scene);

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });

    return { engine, scene, canvas };
}