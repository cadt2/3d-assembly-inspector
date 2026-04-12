// modelBounds.js
// Reusable assembly/world bounds helpers for model fitting and camera framing.

function createEmptyBounds() {
  return {
    min: new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    max: new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
  };
}

function expandBoundsWithMesh(bounds, mesh) {
  try {
    const box = mesh.getBoundingInfo().boundingBox;
    const meshMin = box.minimumWorld;
    const meshMax = box.maximumWorld;

    bounds.min.x = Math.min(bounds.min.x, meshMin.x);
    bounds.min.y = Math.min(bounds.min.y, meshMin.y);
    bounds.min.z = Math.min(bounds.min.z, meshMin.z);

    bounds.max.x = Math.max(bounds.max.x, meshMax.x);
    bounds.max.y = Math.max(bounds.max.y, meshMax.y);
    bounds.max.z = Math.max(bounds.max.z, meshMax.z);
  } catch (e) {
    // Skip invalid mesh bounds and continue combining the rest.
  }
}

export function computeAssemblyBounds(meshes, options = {}) {
  const { refreshBounds = false } = options;
  const bounds = createEmptyBounds();

  (meshes || []).forEach(mesh => {
    if (!mesh || mesh.isDisposed?.()) return;

    if (refreshBounds) {
      try {
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo(true);
      } catch (e) {
        // Continue with currently available bounds when refresh fails.
      }
    }

    expandBoundsWithMesh(bounds, mesh);
  });

  if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) {
    return null;
  }

  const center = new BABYLON.Vector3(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5
  );

  const size = bounds.max.subtract(bounds.min);
  const diagonal = size.length();
  const radius = Math.max(diagonal * 0.5, 0.0001);

  return {
    min: bounds.min,
    max: bounds.max,
    center,
    size,
    diagonal,
    radius
  };
}
