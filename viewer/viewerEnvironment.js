// viewerEnvironment.js
// Centralized viewer environment configuration.
// Today this uses static defaults; later it can be hydrated from a persisted profile (e.g. NoSQL).

export const DEFAULT_VIEWER_ENV = {
  background: {
    // RGBA background color for the main scene clear pass.
    // [R, G, B, A] with values in the 0..1 range.
    clearColor: [0.9, 0.96, 1, 1]
  },
  controls: {
    // Base orbit rotation sensitivity used by middle-mouse orbit.
    // Higher values make camera rotation faster.
    orbitSensitivity: 0.0025,
    // Multiplier applied to current model radius to compute wheel precision.
    // Lower resulting precision means faster zoom response.
    wheelPrecisionFactor: 70,
    // Lower clamp for computed wheel precision.
    // Prevents overly aggressive zoom on tiny models.
    wheelPrecisionMin: 140,
    // Upper clamp for computed wheel precision.
    // Prevents overly slow zoom on very large models.
    wheelPrecisionMax: 800
  },
  camera: {
    // Initial lower zoom limit before any model is loaded/fitted.
    initialLowerRadiusLimit: 1,
    // Initial upper zoom limit before any model is loaded/fitted.
    initialUpperRadiusLimit: 500,
    // Initial wheel precision before dynamic model-based precision is computed.
    initialWheelPrecision: 150,
    // Initial near clipping distance before model fit.
    initialMinZ: 0.001,
    // Multiplier used to compute lower radius limit after fitting a model.
    lowerRadiusFactor: 1.2,
    // Multiplier used to compute upper radius limit after fitting a model.
    upperRadiusFactor: 20,
    // Absolute minimum for upper radius limit.
    minUpperRadius: 50,
    // Multiplier used to set camera radius after fitting a model.
    fitRadiusFactor: 1.55,
    // Extra padding used to keep radius above lowerRadiusLimit after fit.
    fitRadiusPaddingFactor: 0.35,
    // Multiplier used to compute near clipping distance from model radius.
    minZFactor: 0.001,
    // Absolute minimum near clipping distance.
    minMinZ: 0.001,
    // Orthographic fit multiplier relative to computed camera radius.
    // Lower values frame the model closer in Ortho while keeping bbox-based centering.
    orthoZoomFactor: 0.48,
    // Ortho minimum framing clamp based on current model radius.
    orthoMinFitFactor: 0.08,
    // Ortho maximum framing clamp based on current model radius.
    orthoMaxFitFactor: 6
  },
  ground: {
    // Ground plane size = max(modelDiagonal * sizeFactor, minSize).
    sizeFactor: 2.0,
    // Minimum ground size to keep a visible floor for small models.
    minSize: 20,
    // Ground vertical offset from model min Y = radius * offsetFactor.
    offsetFactor: 0.01,
    // Absolute minimum vertical offset for the ground plane.
    minOffset: 0.001
  },
  grid: {
    // Grid ratio = max(modelDiagonal / ratioDivisor, minRatio).
    ratioDivisor: 40,
    // Minimum grid ratio to avoid excessively dense lines.
    minRatio: 0.02,
    // Number of minor cells between major grid lines.
    majorUnitFrequency: 5,
    // Grid minor line visibility before model fit.
    minorUnitVisibilityInitial: 0.45,
    // Grid minor line visibility after model fit/reset.
    minorUnitVisibilityFitted: 0.35
  },
  reflections: {
    // Enables scene-level image-based lighting via an HDR prefiltered .env texture.
    enabled: true,
    // Similar setup to Babylon Sandbox default environment.
    environmentTextureUrl: "https://assets.babylonjs.com/environments/environmentSpecular.env",
    // Scene-level environment lighting strength.
    sceneEnvironmentIntensity: 1,
    // PBR material environment contribution strength.
    materialEnvironmentIntensity: 1,
    // Optionally apply reflection texture to StandardMaterial.
    applyToStandardMaterial: true,
    // Reflection intensity level for StandardMaterial reflectionTexture.
    standardReflectionLevel: 0.35,
    // Optional skybox using the same environment texture.
    createSkybox: false,
    skyboxSize: 1000,
    skyboxBlur: 0.15,
    // Basic image processing tuning used by Sandbox-style environments.
    exposure: 1,
    contrast: 1
  }
};

function mergeSection(defaultSection, overrideSection = {}) {
  return { ...defaultSection, ...(overrideSection || {}) };
}

export function buildViewerEnvironment(overrides = {}) {
  return {
    background: mergeSection(DEFAULT_VIEWER_ENV.background, overrides.background),
    controls: mergeSection(DEFAULT_VIEWER_ENV.controls, overrides.controls),
    camera: mergeSection(DEFAULT_VIEWER_ENV.camera, overrides.camera),
    ground: mergeSection(DEFAULT_VIEWER_ENV.ground, overrides.ground),
    grid: mergeSection(DEFAULT_VIEWER_ENV.grid, overrides.grid),
    reflections: mergeSection(DEFAULT_VIEWER_ENV.reflections, overrides.reflections)
  };
}
