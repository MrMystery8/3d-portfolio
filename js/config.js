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
        cameraPosition: { x: 0, y: 0, z: 8 },

        // The Pivot Group handles the brain's position on screen while keeping rotation centered.
        // Adjust x/y to move the brain around the screen.
        brainPivotPosition: { x: 0.0, y: -1.5, z: 0 },

        initialRotationY: 0.4,     // Initial Y rotation in radians
    },

    // ============================================================================
    // MINI BRAIN TRANSFORMATION (Scroll Behavior)
    // ============================================================================
    miniBrain: {
        margin: -70,                 // Margin from top-right corner in mini mode
        minSize: 150,              // Minimum pixel size of the mini brain
        maxSize: 300,              // Maximum pixel size of the mini brain
        targetProgressThreshold: 0.85, // Scroll progress (0-1) to switch to mini mode
    },

    // ============================================================================
    // INTERACTION TIMING
    // ============================================================================
    interaction: {
        scrollDelay: 520,          // Delay (ms) before scrolling starts after click
        pingAnimationDuration: 350, // Duration (ms) of the ping/ripple animation
        scrollSensitivity: 5,     // Threshold for scroll intent detection (higher = harder to trigger)
        fastScrollSensitivity: 40, // Threshold for fast scroll jump (triggers jump to start/end)
    },

    // ============================================================================
    // BRAIN MAPPING & COLORS
    // ============================================================================
    brainMapping: {
        // Colors (Light accents/tones)
        colors: {
            projects: 0x4fc3f7,   // Light Blue
            experience: 0xffb74d, // Light Orange
            skills: 0x81c784,     // Light Green
            awards: 0xba68c8,     // Light Purple
            default: 0xffffff     // White (for whole brain / default)
        },

        // Mapping Mesh Names to Sections
        // part 6 - Projects
        // part 4 - Experience
        // part 2 - Skills
        // part 5 - Awards
        sections: {
            'Brain_Part_06_BRAIN_TEXTURE_blinn2_0': 'section-projects',
            'Brain_Part_04_BRAIN_TEXTURE_blinn2_0': 'section-experience',
            'Brain_Part_02_BRAIN_TEXTURE_blinn2_0': 'section-skills',
            'Brain_Part_05_BRAIN_TEXTURE_blinn2_0': 'section-awards'
        }
    }
};
