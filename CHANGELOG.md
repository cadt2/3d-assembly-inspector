# Changelog

All notable changes to this project are documented here.

---

## [v0.5.1] — 2026-04-15

### Changed
- Added distinct CAD-style icons to all View Orientation menu items (Top, Bottom, Front, Back, Left, Right)
- Added icons to Ortho / Isometric projection selector items
- Added icon to View Orientation menu caption for improved visual identity

---

## [v0.5.0] — 2026-04-15

### Added
- Startup navigation modal (DHTMLX Window) with interaction guide for new users
- `ui/navigationInstructionsModal.js` extracted as standalone module

### Changed
- Default startup camera orientation changed from Top (orthographic) to Isometric (perspective)

---

## [v0.4.0] — 2026-04-11

### Added
- Sandbox-like IBL reflection environment applied to imported PBR materials
- Configurable environment system via `viewerEnvironment.js`
- Live demo published on GitHub Pages

### Changed
- Refactored viewer actions into dedicated modules (`isolate_selection`, `select_selection`, `view_fit_reset`)
- Aligned isolate and tree visual semantics for consistent selection feedback
- Improved ViewCube overlay usability and orientation readability
- Refined CAD navigation: smoother zoom, improved orthographic framing

### Fixed
- Tree selection sync with 3D picking no longer causes feedback loops

---

## [v0.2 — v0.3] — 2026-04-06/09

### Added
- GLTF/GLB hierarchy parsed and rendered into DHTMLX tree
- Tree and viewer interaction fully synchronized (click-to-select both ways)
- Hierarchical assembly navigation with root suppression
- Part isolation workflow
- Baseline orthographic and perspective camera modes

### Changed
- Removed bundled 3D models from repository (licensing compliance)
- Normalized structure-based hierarchy to collapse single-child technical nodes

---

## [v0.1] — 2026-04-05

### Added
- Initial project scaffold
- CAD-like layout with DHTMLX Suite and BabylonJS viewer integration
- Canvas-based 3D viewport with ArcRotate camera and grid ground plane
