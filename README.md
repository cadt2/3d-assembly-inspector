# 3D Assembly Inspector

Interactive web-based system for exploring, understanding, and documenting 3D assemblies through a CAD-inspired interface.

## Overview

**3D Assembly Inspector** is a portfolio and educational project focused on visualizing imported 3D assemblies in a clean, understandable way.

The system is designed to help users:

- inspect a 3D assembly visually
- navigate components through a tree structure
- identify parts or sub-assemblies inside a larger system
- isolate selected elements for easier understanding
- support future documentation and inventory workflows

This project is inspired by the experience of navigating assemblies in professional CAD tools, but adapted into a lightweight web-based environment.

## Interface Preview

Current UI screenshot:

![3D Assembly Inspector UI](assets/docs/ui-screenshot.png)

## Project Goal

The main goal of this project is to translate complex 3D assemblies into a more accessible visual learning experience.

A practical example would be identifying a specific component inside a larger mechanical system, similar to how a dealership or technical service environment may need to visually locate a part before handling documentation, replacement, or explanation.

## Current Scope

This public repository focuses on the **visual and interaction layer** of the system.

Current goals include:

- CAD-like UI/UX structure
- 3D viewer integration
- assembly tree visualization
- part and sub-assembly selection
- part isolation
- educational exploration of assembly structure

## Current Project Status (April 2026)

The repository currently includes a stable experimental baseline with recent UX and viewer improvements focused on CAD-like navigation consistency.

Recent decisions and why they were applied:

- **Tree hierarchy normalization is now structural (not name-based):**
        previous logic depended on specific wrapper names such as `Solid1`. This was replaced with a structural rule so imported assemblies from different exporters are handled more consistently.

- **Parent label is preserved when collapsing technical single-child levels:**
        when a technical intermediate node exists, the visible node keeps the parent semantic name to avoid losing meaningful assembly labels.

- **Orthographic framing was tightened while keeping bounding-box fit:**
        Ortho views now start closer to the model without breaking model centering logic based on computed bounds.

- **Mouse wheel zoom was softened:**
        wheel precision parameters were tuned to reduce aggressive zoom jumps and improve control during close inspection.

- **Selection highlight now preserves material appearance:**
        selection uses color overlay without outline/material replacement to keep reflections, shading, and relief details visible.

- **ViewCube readability and orientation were improved:**
        face labels were updated for clearer readability, FRONT/BACK mapping was corrected, and the cube size was increased for better usability.

## Planned Direction

The broader system is intended to evolve toward:

- internal JSON-based assembly structure
- technical information attached to parts and sub-assemblies
- optional product mapping such as part number or barcode
- future integration with cloud-based document storage
- optional NoSQL persistence
- educational and documentation workflows

At this stage, the focus remains intentionally simple in order to validate the UI, interaction flow, and internal data structure before moving into persistence or backend services.

## Tech Stack

- **JavaScript**
- **BabylonJS**
- **DHTMLX Suite 9.3**
- **GLTF / GLB**
- **HTML / CSS**

## Interface Concept

The application uses a CAD-inspired layout with four main areas:

- **Main Toolbar** for primary actions
- **Tree Panel** for assembly navigation
- **3D Viewer** for real-time model interaction
- **Properties / Info Panel** for contextual part information

## Navigation Controls

Current viewer navigation is optimized for CAD-style inspection:

- **Mouse wheel scroll**: zoom in/out
- **Middle mouse drag**: pan across the model on the ground plane
- **Shift + middle mouse drag**: orbit around the current target

Note: depending on device/browser behavior, some users may refer to orbit interaction as a Shift + wheel gesture. In this project, the primary orbit input is Shift + middle-drag.

## Architecture Summary

```text
User (authenticated externally)
        ↓
Load application
        ↓
Import GLTF / GLB assembly
        ↓
BabylonJS scene visualization
        ↓
Logical interpretation layer
        ↓
DHTMLX tree + properties UI
```

## Quick Start

This project is a lightweight frontend prototype and can be run as a static site.

1. Clone the repository.
2. Open the project folder in VS Code.
3. Run with a local web server (for example, Live Server extension) from the project root.
4. Open the app in your browser.
5. Click Load Model in the toolbar to import the default assembly.

## Interaction Guide

Use these controls once a model is loaded:

- Left click on a part: select part or sub-assembly
- Mouse wheel: zoom in and out
- Middle mouse drag: pan
- Shift + middle mouse drag: orbit camera around target

## Common Input Confusion

- If orbit is not working, verify you are holding Shift while dragging the middle mouse button.
- Some users describe orbit as Shift + wheel, but in this viewer the intended orbit action is Shift + middle-drag.
- On laptops or compact mice, middle-button behavior can vary by OS/browser settings.

## Current Model Asset Policy

The repository is configured to track only one assembly model file for consistency and repository size control:

- assets/models/Glider-Retract-Landing-Gear.glb
