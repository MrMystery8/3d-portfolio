/**
 * Central Configuration File
 * 
 * Adjust these values to tweak the behavior and appearance of the 3D Brain Portfolio.
 * Now includes GPU-aware performance optimization.
 */

// ============================================================================
// DEVICE DETECTION & PERFORMANCE TIERS
// ============================================================================

// Detect GPU information from WebGL
const detectGPU = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { vendor: 'unknown', renderer: 'unknown', isAppleSilicon: false, isIntegrated: true };

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return { vendor: 'unknown', renderer: 'unknown', isAppleSilicon: false, isIntegrated: true };

        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';

        // Detect Apple Silicon (M1, M2, M3, M4, etc.)
        const isAppleSilicon = /Apple M[0-9]/i.test(renderer) || /Apple GPU/i.test(renderer);

        // Detect Intel/AMD integrated graphics (typically weaker)
        const isIntegrated = /Intel|UHD|Iris|Radeon Graphics|Vega/i.test(renderer) &&
            !/RTX|GTX|Radeon RX|Arc A/i.test(renderer);

        // Detect discrete/dedicated GPUs
        const isDiscrete = /RTX|GTX|Radeon RX|Arc A|Quadro|FirePro/i.test(renderer);

        return { vendor, renderer, isAppleSilicon, isIntegrated, isDiscrete };
    } catch (e) {
        return { vendor: 'unknown', renderer: 'unknown', isAppleSilicon: false, isIntegrated: true };
    }
};

// Detect device capabilities
const detectDeviceCapabilities = () => {
    const ua = navigator.userAgent;
    const isWindows = /Windows/i.test(ua);
    const isMacOS = /Macintosh|Mac OS X/i.test(ua);
    const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);

    // STRICT mobile detection
    const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isDesktopOS = isWindows || isMacOS || isLinux;
    const isMobile = isMobileUA && !isDesktopOS;
    const isTablet = isIPad || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    const isSmallViewport = window.innerWidth < 768 && window.innerHeight < 600;
    const isTrulyMobile = isMobile || (isSmallViewport && !isDesktopOS);

    const cpuCores = navigator.hardwareConcurrency || 4;
    const hasWebGL2 = (() => {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl2'));
        } catch (e) { return false; }
    })();
    const deviceMemory = navigator.deviceMemory || 4;

    // GPU detection
    const gpu = detectGPU();

    // Calculate performance score based on multiple factors
    // Apple Silicon = excellent (score boost)
    // Discrete GPU = good (score boost)
    // Integrated Intel/AMD = penalty
    // Core count matters less than GPU type
    const calculateTier = () => {
        // Mobile/tablet always LOW
        if (isTrulyMobile) return 'LOW';
        if (isTablet) return 'LOW';

        // Very weak hardware = LOW
        if (cpuCores <= 2) return 'LOW';
        if (!hasWebGL2) return 'LOW';

        // Apple Silicon is always HIGH - it's extremely efficient
        if (gpu.isAppleSilicon) return 'HIGH';

        // Discrete GPU = HIGH
        if (gpu.isDiscrete) return 'HIGH';

        // Intel/AMD integrated graphics = MEDIUM (even with many cores)
        // This catches Zenbooks, Surface devices, etc.
        if (gpu.isIntegrated) return 'MEDIUM';

        // Unknown GPU but good specs = MEDIUM (safe fallback)
        if (cpuCores >= 8) return 'MEDIUM';

        // Default fallback
        return 'MEDIUM';
    };

    const tier = calculateTier();

    console.log(`[Config] GPU: ${gpu.renderer}`);
    console.log(`[Config] AppleSilicon: ${gpu.isAppleSilicon} | Integrated: ${gpu.isIntegrated} | Discrete: ${gpu.isDiscrete}`);

    return {
        isWindows,
        isMacOS,
        isMobile: isTrulyMobile,
        isTablet,
        cpuCores,
        hasWebGL2,
        deviceMemory,
        gpu,
        tier
    };
};

export const deviceInfo = detectDeviceCapabilities();

// ============================================================================
// PERFORMANCE PRESETS (Hero Mode - Full Brain)
// ============================================================================
const performancePresets = {
    HIGH: {
        nodeCount: 100,
        signalCount: 10,
        connectionDistance: 0.3,
        minNodeDistance: 0.3,
        usePhysicalMaterial: true,
        pixelRatioMax: 2,
        raycastThrottle: 16,
        antialias: true
    },
    MEDIUM: {
        // Balanced - minor visual reductions + functional throttling
        nodeCount: 70,           // -30% from HIGH (still looks full)
        signalCount: 7,          // -30% from HIGH (still active)
        connectionDistance: 0.25, // Slightly fewer connections
        minNodeDistance: 0.35,
        usePhysicalMaterial: true,  // Glass effect stays!
        pixelRatioMax: 1.5,      // Efficient render resolution
        raycastThrottle: 40,     // Responsive but efficient
        antialias: true
    },
    LOW: {
        nodeCount: 35,
        signalCount: 3,
        connectionDistance: 0.2,
        minNodeDistance: 0.45,
        usePhysicalMaterial: false,
        pixelRatioMax: 1,
        raycastThrottle: 50,
        antialias: false
    }
};

// ============================================================================
// MINI BRAIN PRESETS (Reduced complexity when brain is small)
// These only affect costly operations: signal animation count & raycast frequency
// ============================================================================
export const miniBrainPresets = {
    HIGH: {
        signalCount: 6,
        raycastThrottle: 50
    },
    MEDIUM: {
        signalCount: 2,          // Minimal signals (can't see detail anyway)
        raycastThrottle: 100     // Very light polling
    },
    LOW: {
        signalCount: 1,          // Just 1 signal for movement indication
        raycastThrottle: 200     // Minimal polling
    }
};

// Get preset for current device
const preset = performancePresets[deviceInfo.tier];

export const config = {
    // ============================================================================
    // DEVICE INFO (EXPORTED FOR USE IN OTHER MODULES)
    // ============================================================================
    device: deviceInfo,
    performancePreset: preset,

    // ============================================================================
    // NEURAL NETWORK SIMULATION
    // ============================================================================
    simulation: {
        nodeCount: preset.nodeCount,
        minNodeDistance: preset.minNodeDistance,
        connectionDistance: preset.connectionDistance,
        signalCount: preset.signalCount,
        signalSpeed: 0.8,
        signalSize: 1.0,
        networkOpacity: 0.1,
        signalOpacity: 1.0,
        brainOpacity: 0.15,
        brainSize: 2.5,
        rotationSpeedX: 0.0,
        rotationSpeedY: deviceInfo.isMobile ? 0.05 : 0.1 // Slower rotation on mobile
    },

    // ============================================================================
    // SCENE & CAMERA
    // ============================================================================
    scene: {
        cameraPosition: { x: 0, y: 0, z: 8 },
        brainPivotPosition: { x: 0.0, y: -1.7, z: 0 },
        initialRotationY: 0.4,
    },

    // ============================================================================
    // RENDERER SETTINGS (NEW)
    // ============================================================================
    renderer: {
        pixelRatioMax: preset.pixelRatioMax,
        antialias: preset.antialias,
        usePhysicalMaterial: preset.usePhysicalMaterial,
        raycastThrottle: preset.raycastThrottle
    },

    // ============================================================================
    // MINI BRAIN TRANSFORMATION (Scroll Behavior)
    // ============================================================================
    miniBrain: {
        position: {
            anchorX: 'right',
            anchorY: 'top',
            // Mobile: smaller offset to fit in viewport
            offsetX: deviceInfo.isMobile ? 15 : 30,
            offsetY: deviceInfo.isMobile ? -80 : -110
        },
        // Mobile: smaller sizes to not overwhelm the screen
        minSize: deviceInfo.isMobile ? 120 : 250,
        maxSize: deviceInfo.isMobile ? 180 : 400,
        targetProgressThreshold: 0.85,
    },

    // ============================================================================
    // INTERACTION TIMING & SCROLL DETECTION
    // ============================================================================
    interaction: {
        scrollDelay: 520,
        pingAnimationDuration: 350,
        // Base scroll sensitivity (will be adjusted dynamically)
        scrollSensitivity: 5,
        fastScrollSensitivity: 270,
        // Mouse-specific overrides (detected at runtime)
        mouseScrollSensitivity: 80,
        mouseFastScrollSensitivity: 200,
        // Accumulated delta thresholds
        accumulatedDeltaThreshold: 100,
        wheelTimeout: 150, // ms before resetting accumulated delta
        // Animation lock duration
        scrollLockDuration: deviceInfo.isMobile ? 600 : 800
    },

    // ============================================================================
    // UI SETTINGS
    // ============================================================================
    ui: {
        menuGap: 23,
    },

    // ============================================================================
    // BRAIN MAPPING & COLORS
    // ============================================================================
    brainMapping: {
        colors: {
            projects: 0x4fc3f7,
            experience: 0xffb74d,
            skills: 0x81c784,
            profile: 0xba68c8,
            default: 0xffffff
        },
        sections: {
            'Brain_Part_06_BRAIN_TEXTURE_blinn2_0': 'section-projects',
            'Brain_Part_04_BRAIN_TEXTURE_blinn2_0': 'section-experience',
            'Brain_Part_02_BRAIN_TEXTURE_blinn2_0': 'section-skills-labs',
            'Brain_Part_05_BRAIN_TEXTURE_blinn2_0': 'section-profile'
        }
    }
};

// Log device info for debugging
console.log(`[Config] Device: ${deviceInfo.tier} tier | Cores: ${deviceInfo.cpuCores} | Mobile: ${deviceInfo.isMobile} | WebGL2: ${deviceInfo.hasWebGL2}`);
