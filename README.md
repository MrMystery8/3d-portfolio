# Cybernetic Brain Portfolio

> **A futuristic, interactive 3D portfolio where navigation is driven by a living cybernetic brain.**

This project represents a radical departure from traditional portfolio design. It combines high-fidelity **Three.js** visualization with a unique **"Launcher + Overlay"** UX pattern to create an immersive "Neural Interface" experience.

---

## 🧠 The "Neural Interface" Concept

The core philosophy is to treat the website not as a document, but as a **functional interface**.

### 1. The Living Brain (Hero & Navigator)
The brain is not just a background element; it is the primary navigation engine.
*   **Continuous Existence**: The brain is a single 3D scene that **never leaves the viewport**. It morphs continuously between states.
*   **Hero State**: On load, it is a massive, rotatable 3D object. Users click specific lobes (Frontal, Occipital, etc.) to navigate to content.
*   **Mini State**: As you scroll, the brain shrinks and docks to the top-right corner, becoming a "Back to Top" button.
*   **Bidirectional Transformation**: The transition is smooth and synchronized with scroll position—no hard cuts.

### 2. Launcher + Overlay Architecture
To maintain immersion, the site avoids navigating away to separate pages.
*   **Launchers**: The main sections (Projects, Experience, Profile) act as dashboards. They provide a high-level summary.
*   **Overlays**: Clicking an item opens a **"Neural Database"**—a full-screen overlay that loads detailed content dynamically. This keeps the user "inside" the interface at all times.

---

## 🛠 Technical Architecture

The project is built with **Vanilla HTML/CSS/JavaScript** and **Three.js** (r160). It avoids heavy frameworks (React/Vue) to maximize performance and control over the render loop.

### 📂 File Structure
```
├── index.html          # Single-page application structure
├── css/
│   ├── style.css       # Global design system, variables, and layout
│   └── brain-menu.css  # Specific styles for the 3D-linked menu
├── js/
│   ├── main.js         # The "Cortex": Scroll engine, UI orchestration, Data
│   ├── brain-hero.js   # The "Visual Cortex": Three.js scene, Raycasting, Animation
│   ├── config.js       # Central configuration (Physics, Colors, Speeds)
│   ├── background.js   # Canvas-based ambient wave animation
│   └── text-effects.js # Scramble and reveal text effects
└── assets/
    └── brain_areas.glb # Segmented 3D brain model
```

---

## ⚙️ Core Systems Deep Dive

### 1. The 3D Brain Engine (`brain-hero.js`)
*   **Model**: Uses a GLB model with separated meshes for each brain region. This allows for individual **Raycasting** (hover/click detection).
*   **Visual Style**:
    *   **Glassy Shell**: Uses `MeshPhysicalMaterial` with transmission and roughness to create a cybernetic glass look.
    *   **Neural Network**: Procedurally generates thousands of **Particles (Nodes)** and **Lines (Connections)** inside the brain volume.
    *   **Signal Impulses**: Instead of heavy shaders, we use a custom particle system where "Signal" particles travel along the connection lines to simulate thought processes.
*   **Viewport Management**: The brain's position is controlled by modifying the WebGL `viewport` and `scissor` rects, allowing it to "shrink" without distorting its aspect ratio.

### 2. The "Strict Scroll" Engine (`main.js`)
Standard scrolling breaks the immersion of 100vh sections. We implemented a custom **Wheel Hijack** system:
*   **Momentum Filtering**: The engine analyzes `deltaY` to distinguish between trackpad momentum (ignored) and intentional swipes (registered).
*   **Locking**: Once a scroll is triggered, input is locked for ~800ms to ensure the transition completes smoothly.
*   **100vh Snap**: Sections are guaranteed to fill the viewport perfectly.

### 3. Unified Overlay System (`main.js`)
Rather than creating unique HTML for every project, we use a single **Unified Overlay Container** (`#project-overlay`).
*   **Data-Driven**: Content is stored in `projectData`, `experienceData`, and `profileData` arrays.
*   **Dynamic Rendering**: When an item is clicked, the overlay:
    1.  Determines the type (Project, Experience, Profile).
    2.  Injects the correct HTML structure (e.g., "Tech Stack" for projects vs "Key Stats" for profile).
    3.  Animates the entry.
*   **Sidebar Navigation**: The overlay includes a sidebar that allows users to switch between items *without* closing the overlay.

### 4. Layout Systems
*   **Snake Layout (Desktop)**: Experience items are positioned absolutely along an SVG path to create a winding "Snake" timeline.
*   **Vertical Timeline (Mobile)**: A CSS media query reflows the experience items into a standard vertical list for readability on small screens.

---

## 🎨 Design & Customization

### Configuration (`config.js`)
The entire simulation is tweakable via `js/config.js`. You can adjust:
*   **Simulation**: Node count, signal speed, connection distance.
*   **Colors**: Define which color corresponds to which section (Projects = Blue, Experience = Orange, etc.).
*   **Mini Brain**: Exact pixel offsets and size for the docked state.

### Visual Effects
*   **Text Scramble**: The Hero title decodes itself using `js/text-effects.js`.
*   **Ambient Waves**: `js/background.js` draws subtle sine waves on a background canvas.
*   **Blur**: Opening settings or overlays applies a `backdrop-filter: blur()` to the main content.

---

## 🚀 Setup & Usage

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/yourusername/3d-portfolio.git
    ```
2.  **Run Locally**:
    Since this uses ES6 modules and loads 3D assets, you **must** use a local server (to avoid CORS errors).
    ```bash
    # Python 3
    python -m http.server 8000
    
    # OR Node.js (http-server)
    npx http-server .
    ```
3.  **Open Browser**: Navigate to `http://localhost:8000`.

---

## 🔮 Future Roadmap

*   **Mobile 3D Viewer**: A simplified, touch-optimized 3D view for mobile devices.
*   **CMS Integration**: Fetching project data from a headless CMS (Sanity/Contentful) instead of hardcoded JS arrays.
*   **Audio Reactive**: Making the neural signals pulse to background music.
