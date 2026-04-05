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
