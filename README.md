# Cybernetic Brain Portfolio

A futuristic, interactive 3D portfolio website where navigation is driven by a cybernetic brain interface.

## 🧠 High-Level Concept

The core of this project is to replace traditional navigation menus with an immersive **3D Cybernetic Brain**. This brain acts as both a visual centerpiece (Hero) and a functional navigation tool.

**The brain NEVER leaves the viewport** - it is a single 3D element that **continuously transforms** between two states as you scroll:

-   **Hero State**: On load, the brain is a massive, glowing, rotatable 3D object filling the entire viewport. Users can click specific lobes (e.g., Frontal Lobe, Occipital Lobe) to navigate to different content sections (Projects, Experience, etc.). In this state, the brain acts as the **main navigator**.

-   **Scroll Transformation**: As the user scrolls down, the brain doesn't disappear or get replaced. **It progressively shrinks and glides** toward the top-right corner of the screen, smoothly transforming from hero to mini size. This transformation is continuous and synchronized with scroll position.

-   **Mini State**: When the navigation page is entirely scrolled out of view, the brain completes its transformation to a small 3D object docked in the top-right corner. It remains visible **above all content** at all times. In this state, the brain's **behavior changes** - it is no longer a navigator, but a **"back to nav" button**. Clicking it smoothly scrolls back to the top.

-   **Reverse Transformation**: Scrolling back up (or clicking the mini brain) triggers the **reverse process**. The brain progressively expands and glides from the top-right back to the center, transforming smoothly from mini to hero state. Once back in hero mode, clicking brain lobes navigates to sections again.

The transformation is **bidirectional**, **continuous**, and the brain is **always the same element** - always visible, always in the viewport.

## 🛠 Technical Architecture

This project is built with **Vanilla HTML/CSS/JavaScript** and **Three.js**, focusing on performance and visual fidelity without the overhead of heavy frameworks.

### 1. Three.js & WebGL
-   **Model**: Uses a GLB model (`brain_areas.glb`) with separated meshes for each brain region, allowing for individual interaction (raycasting).
-   **Procedural Texturing**: Instead of static image textures, the brain's surface is generated programmatically using an HTML5 Canvas texture. This creates a crisp, resolution-independent "cybernetic grid" look.
-   **Custom Shaders**: A custom `onBeforeCompile` shader injection is used to create the **Electric Impulse** effect. Glowing pulses travel along the brain's surface in real-time, simulating neural activity.

### 2. Scroll-Linked Animation
-   **Continuous Transformation**: The brain is a single element that **never leaves the viewport**. It continuously transforms between hero and mini states, always remaining visible.
-   **No CSS Transitions**: To achieve perfect synchronization with the scrollbar, the brain's position and size are **interpolated via JavaScript** on every scroll frame for smooth, real-time transformation.
-   **Math**: We calculate a `progress` value (0 to 1) based on the scroll position relative to the viewport height. This drives a linear interpolation (Lerp) for the container's `width`, `height`, `top`, and `left` properties.
-   **Bidirectional**: Works seamlessly in both directions - scroll down to shrink and glide to top-right, scroll up to expand and glide back to center.
-   **Jitter-Free**: A custom `brain-resize` event is dispatched during the scroll loop to force the Three.js renderer to update its aspect ratio and size instantly, preventing the "stretching" artifacts common in canvas resizing.

### 3. Interaction Logic
-   **Raycasting**: A `Raycaster` detects clicks on the 3D meshes.
-   **Drag vs. Click**: A heuristic distinguishes between a "drag to rotate" action and a "click to navigate" action by measuring mouse delta.
-   **Dual Behavior Modes**: The app tracks two behavior states based on scroll position:
    -   **HERO Mode** (nav page visible): Clicking brain lobes navigates to content sections. The brain acts as the main navigator.
    -   **MINI Mode** (nav page scrolled out): Clicking anywhere on the brain scrolls back to top, triggering the reverse transformation. The brain acts as a "back to nav" button.
-   **Always Visible**: The brain remains visible and above all content (z-index 99999) throughout the entire page, never leaving the viewport.

## 📂 Project Structure

```
├── index.html          # Main entry point, DOM structure
├── css/
│   └── style.css       # Global styles, typography, z-index layering
├── js/
│   ├── main.js         # Scroll logic, DOM events, state orchestration
│   └── brain-hero.js   # Three.js scene, shaders, raycasting logic
└── assets/
    └── brain_areas.glb # 3D Model
```

## 🚀 Key Features

-   **Continuous Transformation**: The brain never leaves the viewport - it continuously transforms between hero and mini states as you scroll, always remaining visible and above all content.
-   **Bidirectional Animation**: Smooth, synchronized transformation in both directions - scroll down to shrink and glide to top-right, scroll up (or click mini brain) to expand and glide back to center.
-   **Dual Behavior Modes**: Brain acts as main navigator in hero mode (click lobes to navigate sections) and as "back to nav" button in mini mode (click to return to top).
-   **Electric Shader**: Dynamic, time-based shader effects for a "living" machine look.
-   **Responsive Design**: Optimized for various desktop screen sizes with dynamic scaling for the header and navigation menu. The 3D scene and UI elements adjust fluidly to window resizing.
-   **Performance**: Uses `requestAnimationFrame` for smooth rendering and scroll handling.

## 🔮 Future Improvements

-   **Mobile Optimization**: Further refine the mobile experience, potentially implementing a lightweight mobile 3D viewer.
-   **Section Highlighting**: Two-way binding where scrolling to a section lights up the corresponding brain part.
