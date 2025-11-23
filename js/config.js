/**
 * Central Configuration File
 * 
 * Adjust these values to tweak the behavior and appearance of the 3D Brain Portfolio.
 */

export const config = {
    // ============================================================================
    // NEURAL NETWORK SIMULATION
    // ============================================================================
    simulation: {
        nodeCount: 100,            // Number of neurons
        minNodeDistance: 0.3,     // Minimum distance between nodes (prevents clustering)
        connectionDistance: 0.3,   // Max distance to form connections
        signalCount: 10,           // Number of active signals
        signalSpeed: 0.8,          // Speed of signals
        signalSize: 1.0,           // Size multiplier for signal particles
        networkOpacity: 0.1,       // Opacity of the connection lines
        signalOpacity: 1.0,        // Opacity of the signal particles
        brainOpacity: 0.15,        // Opacity of the brain shell
        brainSize: 2.5,            // Initial scale of the brain model
        rotationSpeedX: 0.0,       // Auto-rotation speed X (if enabled)
        rotationSpeedY: 0.1        // Auto-rotation speed Y (if enabled)
    },

    // ============================================================================
    // SCENE & CAMERA
    // ============================================================================
    scene: {
        cameraPosition: { x: 0, y: 0, z: 6 },

        // The Pivot Group handles the brain's position on screen while keeping rotation centered.
        // Adjust x/y to move the brain around the screen.
        brainPivotPosition: { x: 0.8, y: -1.2, z: -1.0 },

        initialRotationY: 0.4,     // Initial Y rotation in radians
    },

    // ============================================================================
    // MINI BRAIN TRANSFORMATION (Scroll Behavior)
    // ============================================================================
    miniBrain: {
        margin: 0,                 // Margin from top-right corner in mini mode
        minSize: 150,              // Minimum pixel size of the mini brain
        maxSize: 300,              // Maximum pixel size of the mini brain
        targetProgressThreshold: 0.95, // Scroll progress (0-1) to switch to mini mode
    },

    // ============================================================================
    // INTERACTION TIMING
    // ============================================================================
    interaction: {
        scrollDelay: 600,          // Delay (ms) before scrolling starts after click
    }
};
