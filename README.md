# Cybernetic Brain Portfolio

> **A futuristic, interactive 3D portfolio where navigation is driven by a living, intelligent brain interface.**

This project reimagines the traditional portfolio as a **Neural Interface**—a hybrid UX combining high-fidelity **Three.js** 3D visualization with a custom scroll engine and overlay system. The brain acts as both a visual centerpiece and the primary navigation tool, creating an immersive experience that keeps users engaged within a single interface.

---

## 📋 Table of Contents

- [Philosophy & Concept](#-philosophy--concept)
- [Complete File Structure](#-complete-file-structure)
- [Architecture Deep Dive](#-architecture-deep-dive)
- [Setup & Installation](#-setup--installation)
- [Configuration Guide](#-configuration-guide)
- [Usage & Interaction](#-usage--interaction)
- [Technical Implementation](#-technical-implementation)
- [Future Roadmap](#-future-roadmap)

---

## 🧠 Philosophy & Concept

### The "Neural Interface" Vision
This portfolio treats the website as a **functional interface** rather than a document. The core innovation is the **"Launcher + Overlay"** pattern:

1. **Launchers**: Main sections (Projects, Experience, Profile) act as dashboards presenting high-level summaries.
2. **Overlays**: Clicking items opens a full-screen "Neural Database" overlay that dynamically loads detailed content without navigation.

### The Living Brain
The brain is a persistent 3D element that **never leaves the viewport**:

- **Hero State (0vh scroll)**: A massive, glowing, rotatable 3D brain filling the screen. Click different lobes to navigate to sections.
- **Continuous Transformation**: As you scroll, the brain smoothly shrinks and glides to the top-right corner.
- **Mini State (100vh+ scroll)**: A docked "Back to Top" button in the corner, always visible.
- **Bidirectional**: The transformation works both ways—scroll up to expand the brain back to hero mode.

---

## 📂 Complete File Structure

```
3d-portfolio/
│
├── index.html                  # Single-page application entry point
│
├── css/
│   ├── style.css              # Core design system (3,185 lines)
│   │                          # • CSS variables & design tokens
│   │                          # • Layout systems (Launcher, Snake, Overlay)
│   │                          # • Animations (ping, pulse, fade)
│   │                          # • Component styles (cards, tabs, forms)
│   │
│   ├── brain-menu.css         # 3D-linked navigation menu (188 lines)
│   │                          # • Centered top menu positioning
│   │                          # • Hover effects & underline animations
│   │                          # • Responsive breakpoints
│   │
│   ├── style.css.bak          # Backup of previous CSS version
│   └── style_snippet.css      # Code snippet (development artifact)
│
├── js/
│   ├── main.js                # "The Cortex" (1,513 lines)
│   │                          # • Strict scroll engine (wheel hijacking)
│   │                          # • Brain transformation logic
│   │                          # • Unified overlay system
│   │                          # • Event orchestration (clicks, hovers)
│   │                          # • Data structures (projects, experience, profile)
│   │
│   ├── brain-hero.js          # "The Visual Cortex" (1,206 lines)
│   │                          # • Three.js scene setup
│   │                          # • Brain model loading (GLB)
│   │                          # • Procedural neural network generation
│   │                          # • Signal particle system
│   │                          # • Raycasting (hover/click detection)
│   │                          # • Viewport/scissor management
│   │
│   ├── config.js              # Central configuration (98 lines)
│   │                          # • Simulation parameters
│   │                          # • Brain mapping (colors, sections)
│   │                          # • Interaction timing
│   │
│   ├── background.js          # Ambient wave animation (91 lines)
│   │                          # • Canvas-based sine waves
│   │                          # • Multi-layer gradient overlays
│   │
│   ├── text-effects.js        # Text animations (125 lines)
│   │                          # • ScrambleText class (decoding effect)
│   │                          # • Intersection Observer (reveal on scroll)
│   │
│   └── brain-hero.js_snippet  # Code snippet (development artifact)
│
├── assets/
│   ├── brain_areas.glb        # Segmented 3D brain model (3.0 MB)
│   │                          # • Used in production
│   │                          # • Separated meshes for raycasting
│   │
│   ├── human-brain.glb        # Alternative brain model (4.1 MB)
│   ├── human_brain.glb        # Alternative brain model (3.9 MB)
│   │                          # (Unused variants for testing)
│   │
│   └── Resume.pdf             # Downloadable resume (354 KB)
│
├── .gitignore                 # Git ignore rules
├── .DS_Store                  # macOS metadata (ignore)
└── README.md                  # This file
```

### File Size Summary
- **Total CSS**: ~70 KB (3,373 lines)
- **Total JS**: ~63 KB (3,033 lines)
- **3D Assets**: ~11 MB (3 brain models)
- **Total Project**: ~11.2 MB

---

## ⚙️ Architecture Deep Dive

### 1. The 3D Brain Engine (`brain-hero.js`)

**Technology Stack**:
- **Three.js r160**: WebGL rendering library
- **GLTFLoader**: Loads the segmented brain model
- **MeshSurfaceSampler**: Distributes neural network nodes across the brain's surface

**Key Systems**:

#### a. Brain Shell (Glassy Material)
```javascript
// MeshPhysicalMaterial creates the cybernetic glass effect
material: new THREE.MeshPhysicalMaterial({
    color: 0x00ffff,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.6,     // Glass-like transparency
    transparent: true,
    opacity: 0.15,
    depthWrite: false
})
```

#### b. Procedural Neural Network
- **Nodes**: Particles distributed across the brain surface using `MeshSurfaceSampler`
- **Connections**: Lines drawn between nodes within a configurable distance
- **Signals**: Traveling particles that move along connections to simulate neural firing

**Performance Optimizations**:
- Uses `BufferGeometry` for efficient GPU memory usage
- Implements `viewport` and `scissor` rects to clip the brain's rendering area
- Scales particle size dynamically based on viewport to maintain visual clarity

#### c. Raycasting System
```javascript
// Detect clicks on specific brain regions
raycaster.setFromCamera(mouse, camera);
const intersects = raycaster.intersectObjects(brainMeshes, true);
```

**Drag vs. Click Detection**:
- Measures mouse movement distance between `mousedown` and `mouseup`
- If distance < 5px → **Click** (navigate)
- If distance >= 5px → **Drag** (rotate brain)

### 2. The "Strict Scroll" Engine (`main.js`)

Traditional smooth scroll breaks 100vh sections. We implemented a **custom wheel hijack**:

#### Momentum Filtering Algorithm
```javascript
const currentAbsDelta = Math.abs(e.deltaY);
const isAccelerating = currentAbsDelta > lastAbsDelta;

// Only register if:
// 1. Accelerating (new gesture)
// 2. Above threshold (ignore noise)
if (!isAccelerating || currentAbsDelta < sensitivity) return;
```

**Fast Scroll Detection**:
- If `deltaY > 40` → Jump to start/end
- Else → Step to next/previous section

**Locking Mechanism**:
- Sets `isAnimating = true` during scroll
- Locks input for 800ms
- Prevents rapid skipping

### 3. Unified Overlay System (`main.js`)

A single `#project-overlay` container dynamically adapts to show Projects, Experience, or Profile data.

**Data Structures**:
```javascript
// Projects: 6 items
const projectData = [
    { id, title, subtitle, description, bullets, tags, features }
];

// Experience: 5 items
const experienceData = [
    { id, role, org, date, location, tags, did, impact, tech }
];

// Profile: 3 categories (education, achievements, certs)
const profileData = [
    { id, title, subtitle, content[], stats[] }
];
```

**Dynamic Rendering**:
1. `openOverlay(id, type)` → Determines content type
2. `renderOverlayContent(id, type)` → Injects HTML based on type
3. `renderSidebar(activeId, type)` → Creates navigation list

**Type-Specific Layouts**:
- **Projects**: Shows `tags`, `bullets`, `features`
- **Experience**: Shows `date/location`, `did` (responsibilities), `impact`, `tech stack`
- **Profile**: Shows nested `content` items with `stats`

### 4. Layout Systems

#### Snake Layout (Desktop)
- Experience items positioned absolutely along an SVG path
- Cards alternate top/bottom of the path
- Creates a winding timeline visualization

```html
<svg class="snake-svg" viewBox="0 0 1000 400">
    <path d="M 0 200 A 100 100 0 0 0 200 200..." />
</svg>
```

#### Vertical Timeline (Mobile)
- CSS `@media (max-width: 768px)` hides snake, shows vertical
- Cards stack with alternating `.left` and `.right` classes

---

## 🚀 Setup & Installation

### Prerequisites
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+ (WebGL 2.0 support required)
- **Local Server**: Required for ES6 modules and CORS (browser file:// won't work)

### Quick Start

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/3d-portfolio.git
   cd 3d-portfolio
   ```

2. **Start a Local Server**:
   
   **Option A: Python 3**
   ```bash
   python3 -m http.server 8000
   ```
   
   **Option B: Node.js (http-server)**
   ```bash
   npx http-server . -p 8000
   ```
   
   **Option C: VS Code Live Server**
   - Install "Live Server" extension
   - Right-click `index.html` → "Open with Live Server"

3. **Open in Browser**:
   ```
   http://localhost:8000
   ```

### Troubleshooting

**White Screen / No Brain Visible**:
- Check browser console for errors
- Ensure `assets/brain_areas.glb` exists
- Verify you're using a local server (not `file://`)

**Performance Issues**:
- Open Settings (⚙️ bottom-right)
- Reduce "Node Count" to 50
- Reduce "Signal Count" to 5

---

## 🎛 Configuration Guide

### `js/config.js` Reference

#### Simulation Parameters
```javascript
simulation: {
    nodeCount: 100,            // Number of neural nodes (0-1000)
    minNodeDistance: 0.3,      // Prevents clustering
    connectionDistance: 0.3,   // Max distance to form connections
    signalCount: 10,           // Active signal particles (0-100)
    signalSpeed: 0.8,          // Speed multiplier (0-10)
    signalSize: 1.0,           // Size multiplier (0-5)
    networkOpacity: 0.1,       // Connection line opacity (0-1)
    signalOpacity: 1.0,        // Signal particle opacity (0-1)
    brainOpacity: 0.15,        // Brain shell opacity (0-1)
    brainSize: 2.5,            // Scale multiplier (0.5-3.0)
    rotationSpeedX: 0.0,       // Auto-rotation X (radians/sec)
    rotationSpeedY: 0.1        // Auto-rotation Y (radians/sec)
}
```

#### Brain Mapping (Colors & Regions)
```javascript
brainMapping: {
    colors: {
        projects: 0x4fc3f7,    // Light Blue
        experience: 0xffb74d,  // Light Orange
        skills: 0x81c784,      // Light Green
        profile: 0xba68c8      // Light Purple
    },
    sections: {
        'Brain_Part_06...': 'section-projects',
        'Brain_Part_04...': 'section-experience',
        'Brain_Part_02...': 'section-skills-labs',
        'Brain_Part_05...': 'section-profile'
    }
}
```

#### Mini Brain Positioning
```javascript
miniBrain: {
    position: {
        anchorX: 'right',      // 'left' or 'right'
        anchorY: 'top',        // 'top' or 'bottom'
        offsetX: 30,           // Horizontal offset (px)
        offsetY: -110          // Vertical offset (px)
    },
    minSize: 250,              // Min pixel size
    maxSize: 400,              // Max pixel size
    targetProgressThreshold: 0.85  // When to switch to mini (0-1)
}
```

### Runtime Configuration (Settings Panel)

Access the **Settings Panel** by clicking the ⚙️ button (bottom-right):
- All simulation parameters are adjustable in real-time
- Changes apply immediately without page reload
- "Node Count" and "Signal Count" trigger neural network rebuild

---

## 🎮 Usage & Interaction

### Navigation Methods

1. **Brain Clicking (Hero Mode)**:
   - Click brain lobes to navigate to sections
   - Each region maps to a section (color-coded)

2. **Menu Navigation**:
   - Horizontal menu appears at top in hero mode
   - Click numbered items (01-04)
   - Hover to see connector lines to brain

3. **Scrolling**:
   - Use trackpad/mouse wheel to scroll between sections
   - Fast scroll (aggressive swipe) jumps to start/end

4. **Mini Brain (Scrolled Mode)**:
   - Click the docked brain (top-right) to return to hero

### Content Interactions

**Project/Experience Cards**:
- Click any card to open the detail overlay
- Overlay shows full information with sidebar navigation
- Press `Esc` or click `X` to close

**Settings**:
- Click ⚙️ to open settings sidebar
- Adjust sliders to tweak simulation
- Click outside or × to close

**Contact**:
- Click "Ayaan Minhas | Portfolio" in hero title
- Opens contact overlay with form and social links

---

## 🔬 Technical Implementation

### CSS Architecture

**Design System** (`css/style.css`):
```css
:root {
    --bg-color: #050915;
    --text-color: #e0e6ed;
    --accent-color: #00ffff;
    --font-main: 'Rajdhani', sans-serif;
    --font-body: 'Outfit', sans-serif;
}
```

**Z-Index Layering**:
```
2000000  - Settings panel & overlays
1000001  - Hero title (clickable)
1000000  - Navigation menu & buttons
999999   - Brain container (always on top)
0        - Background canvas
```

**Key Animations**:
- `pingRing`: Ripple effect on menu click
- `linePulse`: Connector line pulse
- `fadeInDown`: Menu items on load
- `fadeOut`: Ping dot disappearance

### JavaScript Patterns

**Event-Driven Architecture**:
```javascript
// Custom events for cross-module communication
window.addEventListener('brain-section-clicked', (e) => {
    const { sectionId } = e.detail;
    // Trigger menu animation
});

window.addEventListener('brain-region-hover', (e) => {
    const { regionName, active } = e.detail;
    // Show/hide connector line
});
```

**State Management**:
```javascript
// Global state tracking
let currentProgress = 0;        // Brain transformation (0-1)
let targetProgress = 0;         // Target for smooth lerp
let isAnimating = false;        // Scroll lock
let currentActiveSection = null; // Active section ID
```

**Animation Loop**:
```javascript
function animateBrain() {
    requestAnimationFrame(animateBrain);
    
    // Lerp current to target
    currentProgress += (targetProgress - currentProgress) * 0.1;
    
    // Update brain transform, fade elements
    updateBrainViewport(...);
}
```

### Performance Considerations

**GPU Optimizations**:
- `transform: translate3d(0,0,0)` for GPU acceleration
- `will-change: clip-path` for transform hints
- `BufferGeometry` for minimal draw calls

**Memory Management**:
- Dispose geometries/materials on network rebuild
- Remove event listeners on cleanup
- Reuse overlay DOM instead of creating new

**Lazy Loading**:
- Brain model loads asynchronously
- Placeholder shown during load
- First frame triggers "ready" state

---

## 🔮 Future Roadmap

### Planned Features
- [ ] **Mobile 3D Viewer**: Touch-optimized brain controls
- [ ] **CMS Integration**: Fetch data from Sanity.io/Contentful
- [ ] **Audio Reactive**: Sync neural signals to background music
- [ ] **Analytics**: Track brain region clicks and section engagement
- [ ] **Dark/Light Mode**: Toggle color schemes
- [ ] **Accessibility**: Keyboard navigation, screen reader support

### Potential Enhancements
- **WebXR Support**: VR/AR brain visualization
- **Multiplayer**: See other visitors' cursors on the brain
- **AI Chatbot**: Neural assistant for portfolio Q&A
- **Code Playground**: Live Three.js examples in overlays

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Three.js**: For the incredible 3D engine
- **Google Fonts**: Rajdhani & Outfit typefaces
- **Brain Model**: Sourced from [specify source]

---

**Built with love using vanilla web technologies.**  
**No frameworks. Just pure HTML, CSS, JavaScript, and Three.js.**
