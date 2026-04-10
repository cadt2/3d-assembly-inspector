export function createAxisTriadFeature({
	scene,
	engine,
	mainCamera
}) {
	if (!scene || !engine || !mainCamera) {
		throw new Error("createAxisTriadFeature requires scene, engine and mainCamera");
	}

	const axisLayerMask = 0x10000000;
	const axisCamera = new BABYLON.ArcRotateCamera(
		"axisTriadCamera",
		mainCamera.alpha + Math.PI,
		mainCamera.beta,
		3,
		BABYLON.Vector3.Zero(),
		scene
	);

	axisCamera.layerMask = axisLayerMask;
	axisCamera.minZ = 0.01;
	axisCamera.maxZ = 10;
	axisCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
	axisCamera.inputs.clear();

	function markAsViewerHelper(node) {
		if (!node) return;
		node.metadata = { ...(node.metadata || {}), viewerHelper: true };
		node.isPickable = false;
		node.layerMask = axisLayerMask;
	}

	const axes = new BABYLON.AxesViewer(scene, 0.84);
	[axes.xAxis, axes.yAxis, axes.zAxis].forEach(axis => {
		markAsViewerHelper(axis);
		if (axis.getChildMeshes) {
			axis.getChildMeshes().forEach(markAsViewerHelper);
		}
	});

	function createAxisLabel(text, color, position) {
		const texture = new BABYLON.DynamicTexture(`axisLabelTex_${text}`, { width: 256, height: 256 }, scene, true);
		texture.hasAlpha = true;
		texture.updateSamplingMode(BABYLON.Texture.BILINEAR_SAMPLINGMODE);
		texture.drawText(text, 58, 188, "bold 172px Arial", color, "transparent", true);

		const plane = BABYLON.MeshBuilder.CreatePlane(`axisLabel_${text}`, { size: 0.27 }, scene);
		const mat = new BABYLON.StandardMaterial(`axisLabelMat_${text}`, scene);
		mat.diffuseTexture = texture;
		mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
		mat.specularColor = new BABYLON.Color3(0, 0, 0);
		mat.backFaceCulling = false;
		mat.disableLighting = true;
		plane.material = mat;
		plane.position.copyFrom(position);
		plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

		markAsViewerHelper(plane);
		return plane;
	}

	const labelDistance = 1.38;
	const axisLabels = [
		createAxisLabel("X", "#ff4a4a", new BABYLON.Vector3(labelDistance, 0, 0)),
		// Inventor export convention: Z is shown as vertical axis.
		createAxisLabel("Z", "#4f8bff", new BABYLON.Vector3(0, labelDistance, 0)),
		createAxisLabel("Y", "#59d959", new BABYLON.Vector3(0, 0, labelDistance))
	];

	function updateAxisOrthoFrustum() {
		const rw = Math.max(engine.getRenderWidth(), 1);
		const rh = Math.max(engine.getRenderHeight(), 1);
		const vp = axisCamera.viewport;
		const viewportAspect = vp && vp.width > 0 && vp.height > 0
			? (vp.width * rw) / (vp.height * rh)
			: 1;

		// Keep margin for rotation clipping, but avoid making the triad too small.
		const halfHeight = 1.45;
		const halfWidth = halfHeight * viewportAspect;
		axisCamera.orthoLeft = -halfWidth;
		axisCamera.orthoRight = halfWidth;
		axisCamera.orthoBottom = -halfHeight;
		axisCamera.orthoTop = halfHeight;
	}

	function updateViewport() {
		const rw = Math.max(engine.getRenderWidth(), 1);
		const rh = Math.max(engine.getRenderHeight(), 1);
		// Local quality control: larger overlay viewport gives the triad more pixels
		// without increasing render resolution for the full scene.
		const pixelSize = 140;
		const margin = 12;
		const vw = Math.min(pixelSize / rw, 0.22);
		const vh = Math.min(pixelSize / rh, 0.22);
		const vx = Math.max(margin / rw, 0);
		const vy = Math.max(margin / rh, 0);

		axisCamera.viewport = new BABYLON.Viewport(vx, vy, vw, vh);
		updateAxisOrthoFrustum();
	}

	updateViewport();

	return {
		camera: axisCamera,
		updateViewport,
		syncOrientation() {
			axisCamera.alpha = mainCamera.alpha + Math.PI;
			axisCamera.beta = mainCamera.beta;
		},
		dispose() {
			axisLabels.forEach(label => {
				try { label.dispose(false, true); } catch (e) {}
			});
			try { axes.dispose(); } catch (e) {}
			try { axisCamera.dispose(); } catch (e) {}
		}
	};
}
