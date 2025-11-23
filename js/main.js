import { initBrain, onScrollToSection, resetToHero, updateBrainViewport, updateSimulationParams } from './brain-hero.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check for mobile or reduced motion
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isMobile && !prefersReducedMotion) {    // Initialize Three.js scene
        initBrain();
    } else {
        // Fallback...
        const container = document.getElementById('brain-hero-container');
        container.innerHTML = '<img src="assets/brain_fallback.png" alt="3D Brain" style="width: 100%; height: 100%; object-fit: contain; opacity: 0.5;">';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
    }

    // ============================================================================
    // BRAIN TRANSFORMATION SYSTEM
    // ============================================================================
    // CORE CONCEPT: The brain NEVER leaves the viewport. It is a single 3D element
    // that continuously TRANSFORMS between two states as the user scrolls:
    //
    // 1. HERO STATE (scroll position 0vh):
    //    - Size: Full viewport (100vw x 100vh)
    //    - Position: Center of screen
    //    - Behavior: MAIN NAVIGATOR - clicking brain lobes navigates to sections
    //
    // 2. MINI STATE (scroll position >= ~100vh):
    //    - Size: Small (80-150px depending on viewport)
    //    - Position: Top-right corner with margin
    //    - Behavior: BACK TO NAV BUTTON - clicking returns to top
    //
    // The transformation is CONTINUOUS and BIDIRECTIONAL:
    // - Scroll down → brain smoothly shrinks and glides to top-right
    // - Scroll up → brain smoothly expands and glides back to center
    // - Click mini brain → smooth scroll to top, triggering reverse transformation
    //
    // The brain is ALWAYS VISIBLE and ALWAYS THE SAME ELEMENT throughout.
    // ============================================================================

    const brainContainer = document.getElementById('brain-hero-container');
    const heroText = document.getElementById('hero-text');
    const hero = document.getElementById('hero');
    // Ensure the brain overlay sits above everything in the DOM
    if (brainContainer && brainContainer.parentElement !== document.body) {
        document.body.appendChild(brainContainer);
    }

    // State for smooth animation
    let currentProgress = 0;
    let targetProgress = 0;

    function updateTargetProgress() {
        if (document.body.classList.contains('mobile-view')) return;

        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight;
        const heroHeight = hero ? hero.offsetHeight : viewportHeight;

        // Calculate target progress based on scroll
        // 1.0 * heroHeight means transition completes exactly when scrolling past hero
        targetProgress = Math.min(scrollY / Math.max(heroHeight, 1), 1);
        targetProgress = Math.max(targetProgress, 0);
    }

    function animateBrain() {
        requestAnimationFrame(animateBrain);

        // Lerp currentProgress towards targetProgress
        // Factor 0.05 gives a nice smooth inertia
        const diff = targetProgress - currentProgress;

        // Snap if close enough to save calc, but always keep loop running for responsiveness
        if (Math.abs(diff) < 0.0005) {
            currentProgress = targetProgress;
        } else {
            currentProgress += diff * 0.05;
        }

        // Use currentProgress for all calculations
        const t = currentProgress; // Linear interpolation for the state itself, ease handled by lerp physics

        // Apply easing for the visual transformation if desired, 
        // but the lerp itself provides an ease-out feel.
        // Let's stick to the lerp value 't' directly for the transformation factor
        // to keep it physically responsive.

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // HERO STATE: Brain center should be at viewport center
        const startW = viewportWidth;
        const startH = viewportHeight;
        const startBrainCenterX = viewportWidth / 2;
        const startBrainCenterY = viewportHeight / 2;

        // MINI STATE: Brain center should be at top-right with margin
        const margin = 5; // Tighter corner as requested
        const minSize = 180;
        const maxSize = 350;
        const endSize = Math.max(Math.min(maxSize, viewportWidth * 0.3), minSize);

        const desiredBrainX = viewportWidth - margin - endSize / 2;
        const desiredBrainY = margin + endSize / 2;

        // Interpolate dimensions
        const currentW = startW + (endSize - startW) * t;
        const currentH = startH + (endSize - startH) * t;

        // Interpolate brain center position
        const currentBrainCenterX = startBrainCenterX + (desiredBrainX - startBrainCenterX) * t;
        const currentBrainCenterY = startBrainCenterY + (desiredBrainY - startBrainCenterY) * t;

        // Calculate container top-left position
        const currentTop = currentBrainCenterY - currentH / 2;
        const currentLeft = currentBrainCenterX - currentW / 2;

        // Update Three.js Viewport/Scissor
        updateBrainViewport(currentLeft, currentTop, currentW, currentH);

        // Update DOM Clip Path
        const insetTop = currentTop;
        const insetRight = viewportWidth - (currentLeft + currentW);
        const insetBottom = viewportHeight - (currentTop + currentH);
        const insetLeft = currentLeft;

        brainContainer.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;

        // Fade out hero text
        if (heroText) {
            // Fade out faster than the brain moves
            heroText.style.opacity = Math.max(1 - (t * 2), 0);
        }

        // Toggle brain behavior mode
        // Use targetProgress for mode switching to feel responsive to scroll intent
        if (targetProgress >= 0.95) {
            document.body.classList.add('brain-mode-mini');
        } else {
            document.body.classList.remove('brain-mode-mini');
        }
    }

    // Listeners
    window.addEventListener('scroll', updateTargetProgress, { passive: true });
    window.addEventListener('resize', () => {
        updateTargetProgress();
        // Force update immediately on resize to prevent glitches
        currentProgress = targetProgress;
    });

    // Start loop
    updateTargetProgress();
    animateBrain();

    /* 
    // Intersection Observer for Hero State - REMOVED in favor of scroll logic
    const hero = document.getElementById('hero');
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                document.body.classList.remove('brain-mode-mini');
                resetToHero(); // Tell brain to expand/reset interaction
            } else if (!entry.isIntersecting || entry.intersectionRatio <= 0.1) {
                document.body.classList.add('brain-mode-mini');
            }
        });
    }, { threshold: [0.1, 0.5] });

    heroObserver.observe(hero);
    */

    // Intersection Observer for Active Sections
    const sections = document.querySelectorAll('.content-section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all
                sections.forEach(s => s.classList.remove('active'));
                // Add to current
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(section => sectionObserver.observe(section));


    // Mini Brain Click Handler
    // When in MINI mode (brain-mode-mini class active), the brain's behavior changes:
    // - It is no longer a navigator for clicking brain lobes
    // - Instead, it becomes a "BACK TO NAV" button
    // - Clicking anywhere on the mini brain smoothly scrolls to top
    // - This scroll triggers the reverse transformation (mini → hero state)
    // The distinction between drag and click is handled in brain-hero.js
    document.getElementById('brain-hero-container').addEventListener('click', (e) => {
        if (document.body.classList.contains('brain-mode-mini')) {
            // Return to hero section, triggering reverse transformation
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Settings UI Logic
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsBtn = document.getElementById('close-settings');

    if (settingsBtn && settingsPanel && closeSettingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
        });

        // Sliders
        const inputs = {
            nodeCount: document.getElementById('node-count'),
            connectionDistance: document.getElementById('conn-dist'),
            signalCount: document.getElementById('sig-count'),
            signalSpeed: document.getElementById('sig-speed'),
            signalSize: document.getElementById('sig-size'),
            networkOpacity: document.getElementById('net-opacity'),
            signalOpacity: document.getElementById('sig-opacity'),
            brainOpacity: document.getElementById('brain-opacity'),
            brainSize: document.getElementById('brain-size'),
            rotationSpeedX: document.getElementById('rot-x'),
            rotationSpeedY: document.getElementById('rot-y')
        };

        const displays = {
            nodeCount: document.getElementById('val-node-count'),
            connectionDistance: document.getElementById('val-conn-dist'),
            signalCount: document.getElementById('val-sig-count'),
            signalSpeed: document.getElementById('val-sig-speed'),
            signalSize: document.getElementById('val-sig-size'),
            networkOpacity: document.getElementById('val-net-opacity'),
            signalOpacity: document.getElementById('val-sig-opacity'),
            brainOpacity: document.getElementById('val-brain-opacity'),
            brainSize: document.getElementById('val-brain-size'),
            rotationSpeedX: document.getElementById('val-rot-x'),
            rotationSpeedY: document.getElementById('val-rot-y')
        };

        // Debounce helper
        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        };

        // Create debounced updaters for heavy params
        const debouncedUpdate = debounce((key, value) => {
            console.log(`Debounced update for ${key}: ${value}`);
            const params = {};
            params[key] = parseFloat(value);
            updateSimulationParams(params);
        }, 300); // 300ms delay

        // Attach listeners
        Object.keys(inputs).forEach(key => {
            const input = inputs[key];
            if (input) {
                const isHeavy = (key !== 'signalSpeed');

                input.addEventListener('input', (e) => {
                    const value = e.target.value;

                    // Update display immediately
                    displays[key].textContent = value;

                    if (isHeavy) {
                        debouncedUpdate(key, value);
                    } else {
                        // Speed updates are cheap, do immediately
                        const params = {};
                        params[key] = parseFloat(value);
                        updateSimulationParams(params);
                    }
                });
            }
        });
    }
});
