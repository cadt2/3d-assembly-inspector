# 3D Assembly Inspector

*Optimized for desktop interaction using mouse-based controls.*

Interactive web-based system for exploring, analyzing, and structuring 3D assemblies through a CAD-inspired interface.

---

## Interaction Guide

Use these controls once a model is loaded:

- **Left click on a part**: select part or sub-assembly  
- **Mouse wheel**: zoom in and out  
- **Middle mouse drag**: pan  
- **Shift + middle mouse drag**: orbit camera around target  

---

## Live Demo

https://cadt2.github.io/3d-assembly-inspector/  
(Runs directly in the browser — no installation required)

---

## Overview

**3D Assembly Inspector** is a browser-based application designed to bring CAD-style assembly interaction into modern web environments.

The system combines:

- structured assembly data  
- real-time 3D visualization  
- interaction-driven workflows  

into a unified platform capable of supporting engineering, inspection, and documentation use cases.

---

## Interface Preview

![3D Assembly Inspector UI](assets/docs/ui-screenshot.png)

---

## System Capabilities

- Hierarchical assembly navigation (tree-based structure)  
- Real-time 3D interaction using WebGL (BabylonJS)  
- Part and sub-assembly identification  
- Isolation and inspection workflows  
- Logical interpretation of imported GLTF / GLB assemblies  
- Foundation for integration with engineering data systems  

---

## Engineering Focus

This system is designed as a browser-based engineering tool, not just a viewer.

Key areas of focus:

- Mapping CAD interaction patterns into web applications  
- Separating visualization, logic, and data layers  
- Designing scalable structures for assembly interpretation  
- Enabling future integration with backend systems and metadata  

---

## Current State (April 2026)

The application provides a stable baseline focused on interaction consistency, system structure, and scalability.

Recent improvements include:

- Structure-based hierarchy normalization  
  Ensures consistent behavior across different GLTF / GLB sources  

- Semantic label preservation  
  Maintains meaningful assembly naming when collapsing technical nodes  

- Refined orthographic framing  
  Improves initial camera positioning while preserving bounding-box centering  

- Improved navigation control  
  Smoother zoom behavior for detailed inspection workflows  

- Non-destructive selection highlighting  
  Preserves material fidelity during interaction  

- Enhanced ViewCube usability  
  Improved orientation feedback and readability  

---

## Architecture Overview

---

## System Design Approach

The application follows a modular architecture separating:

- UI Layer — structured interface and interaction  
- Logic Layer — assembly interpretation and behavior  
- Rendering Layer — real-time 3D visualization  

This separation allows the system to scale toward:

- data-driven assemblies  
- backend integration  
- persistent storage  
- engineering workflows  

---

## Performance Direction (Next Phase)

The system is evolving toward a hybrid architecture where computation-heavy logic is decoupled from the browser interaction layer.

Planned direction includes:

- leveraging Rust for high-performance computation  
- exploring WebAssembly (WASM) for performance-critical workflows  
- enabling scalable handling of complex assemblies and geometry operations  

---

## Tech Stack

- JavaScript / TypeScript  
- BabylonJS (WebGL)  
- DHTMLX Suite  
- GLTF / GLB  
- HTML / CSS  

---

## Viewer Module Convention

To keep the viewer maintainable as behaviors grow, this repository follows a strict folder rule:

- `viewer/actions/` contains only isolated viewer actions  
- Each action file must be named after the action it implements  
- Example pattern: `isolate_selection`, `select_selection`, `view_fit_reset`  
- Non-action modules must stay outside `viewer/actions/`  
- Shared helpers and orchestration stay in the viewer root (or another non-actions technical folder if introduced later)  

---

## Execution

1. Clone repository  
2. Run via local web server  
3. Load a GLB model  
4. Interact with the assembly  

---

## Portfolio Context

This system demonstrates the development of a web-based CAD-inspired application, combining:

- real-time 3D rendering  
- structured UI systems  
- engineering-oriented interaction design  
- scalable architecture for future system expansion  

---

## Final Result

This README presents the system as a structured, scalable engineering application aligned with web-based CAD development.