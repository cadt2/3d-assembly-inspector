# Contributing

Thank you for your interest in 3D Assembly Inspector.

---

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Serve via any static file server (e.g. `python3 -m http.server 8080`)
4. Open `http://localhost:8080` in a browser

No build step or package installation is required — the project runs directly in the browser using CDN-hosted dependencies.

---

## Project Structure

```
ui/             UI layer — layout, toolbar, tree, modals
viewer/         Logic and rendering — viewer3d, environment, features
viewer/actions/ Isolated viewer action modules (one behavior per file)
styles/         Global CSS
assets/         Models and documentation assets
```

---

## Guidelines

- Keep changes minimal and focused — one concern per PR
- Match the existing code style (no linter enforced yet, use judgment)
- Do not commit binary assets (models, screenshots) unless strictly necessary
- Viewer actions must each live in their own file under `viewer/actions/`
- Keep code comments in English regardless of the communication language

---

## Reporting Issues

Open a GitHub Issue with:
- A clear description of the problem
- Steps to reproduce
- Browser and OS version
- Screenshot or recording if visual

---

## Questions

Open a Discussion on GitHub rather than an Issue for general questions or ideas.
