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

    function updateBrainState() {
        if (document.body.classList.contains('mobile-view')) return; // Skip on mobile if needed

        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const heroHeight = hero ? hero.offsetHeight : viewportHeight;

        // Calculate progress: 0 at top, 1 at 100vh (start of second section)
        let progress = Math.min(scrollY / Math.max(heroHeight, 1), 1);
        progress = Math.max(progress, 0);

        // Smooth easing for natural feel
        const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
        const t = ease(progress);

        // HERO STATE: Brain center should be at viewport center
        const startW = viewportWidth;
        const startH = viewportHeight;
        // Brain is at the center of the canvas, so container top-left is at 0,0
        // and brain center is at viewportWidth/2, viewportHeight/2
        const startBrainCenterX = viewportWidth / 2;
        const startBrainCenterY = viewportHeight / 2;

        // MINI STATE: Brain center should be at top-right with margin
        const margin = 20;
        const minSize = 80;
        const maxSize = 150;
        const endSize = Math.max(Math.min(maxSize, viewportWidth * 0.15), minSize);

        // We want the brain CENTER to be at top-right corner with margin
        // So if brain is rendered at center of canvas, and we want brain at position (x, y),
        // then container top-left should be at (x - endSize/2, y - endSize/2)
        const desiredBrainX = viewportWidth - margin - endSize / 2; // Right side with margin, accounting for brain being at canvas center
        const desiredBrainY = margin + endSize / 2; // Top side with margin, accounting for brain being at canvas center

        // Now calculate container position to achieve desired brain center
        // Interpolate dimensions
        const currentW = startW + (endSize - startW) * t;
        const currentH = startH + (endSize - startH) * t;

        // Interpolate brain center position
        const currentBrainCenterX = startBrainCenterX + (desiredBrainX - startBrainCenterX) * t;
        const currentBrainCenterY = startBrainCenterY + (desiredBrainY - startBrainCenterY) * t;

        // Calculate container top-left position based on desired brain center
        const currentTop = currentBrainCenterY - currentH / 2;
        const currentLeft = currentBrainCenterX - currentW / 2;

        // NEW APPROACH: Fixed Canvas + Viewport Scissor + Clip Path
        // Instead of resizing the DOM element, we keep it full screen and use clip-path
        // to restrict interactions, and setViewport/setScissor to restrict rendering.

        // 1. Update Three.js Viewport/Scissor
        updateBrainViewport(currentLeft, currentTop, currentW, currentH);

        // 2. Update DOM Clip Path (inset: top right bottom left)
        const insetTop = currentTop;
        const insetRight = viewportWidth - (currentLeft + currentW);
        const insetBottom = viewportHeight - (currentTop + currentH);
        const insetLeft = currentLeft;

        brainContainer.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;

        // Ensure container is always full screen fixed
        brainContainer.style.width = '100vw';
        brainContainer.style.height = '100vh';
        brainContainer.style.top = '0';
        brainContainer.style.left = '0';
        brainContainer.style.position = 'fixed';
        brainContainer.style.zIndex = '999999';
        brainContainer.style.transform = 'translate3d(0, 0, 0)';

        // Fade out hero text smoothly
        if (heroText) {
            heroText.style.opacity = Math.max(1 - (scrollY / (viewportHeight * 0.6)), 0);
        }

        // Toggle brain behavior mode based on scroll progress
        // At 95% progress, the hero section is nearly scrolled out of view,
        // so we change the brain's BEHAVIOR (not appearance - that's continuous):
        // - In HERO mode: clicking brain lobes navigates to content sections
        // - In MINI mode: clicking anywhere on brain returns to top (scroll to 0)
        if (progress >= 0.95) {
            document.body.classList.add('brain-mode-mini');
        } else {
            document.body.classList.remove('brain-mode-mini');
        }
    }

    // Update immediately on scroll - no throttling for smooth transitions
    window.addEventListener('scroll', updateBrainState, { passive: true });
    window.addEventListener('resize', updateBrainState);

    // Initial call
    updateBrainState();

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
