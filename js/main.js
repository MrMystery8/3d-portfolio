import { initBrain, onScrollToSection, resetToHero, updateBrainViewport, updateSimulationParams, highlightBrainRegion, updateActiveSectionHighlight, setBrainRegionHighlight, getBrainRegionScreenPosition } from './brain-hero.js';
import { config } from './config.js';

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
        // Make transition faster: completes at 70% of hero height
        targetProgress = Math.min(scrollY / (Math.max(heroHeight, 1) * 0.7), 1);
        targetProgress = Math.max(targetProgress, 0);
    }

    function animateBrain() {
        requestAnimationFrame(animateBrain);

        // Lerp currentProgress towards targetProgress
        // Increased factor from 0.05 to 0.1 for snappier, more fluid motion
        const diff = targetProgress - currentProgress;

        // Snap if close enough to save calc, but always keep loop running for responsiveness
        if (Math.abs(diff) < 0.0005) {
            currentProgress = targetProgress;
        } else {
            currentProgress += diff * 0.1;
        }

        // Use currentProgress for all calculations
        const t = currentProgress;

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // HERO STATE: Brain center should be at viewport center
        const startW = viewportWidth;
        const startH = viewportHeight;
        const startBrainCenterX = viewportWidth / 2;
        const startBrainCenterY = viewportHeight / 2;

        // MINI STATE: Brain center should be at top-right with margin
        const margin = config.miniBrain.margin;
        const minSize = config.miniBrain.minSize;
        const maxSize = config.miniBrain.maxSize;
        const endSize = Math.max(Math.min(maxSize, viewportWidth * 0.25), minSize);

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

        // Fade out settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            // Similar fade logic
            const opacity = Math.max(1 - (t * 2), 0);
            settingsBtn.style.opacity = opacity;

            // Disable interactions when invisible
            if (opacity < 0.1) {
                settingsBtn.style.pointerEvents = 'none';
            } else {
                settingsBtn.style.pointerEvents = 'auto';
            }
        }

        // Toggle brain behavior mode
        // Use targetProgress for mode switching to feel responsive to scroll intent
        const wasInMiniMode = document.body.classList.contains('brain-mode-mini');

        if (targetProgress >= config.miniBrain.targetProgressThreshold) {
            document.body.classList.add('brain-mode-mini');
        } else {
            document.body.classList.remove('brain-mode-mini');

            // If we just exited mini mode, reset highlights
            if (wasInMiniMode) {
                updateActiveSectionHighlight(null); // This will reset all highlights
            }
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

    // Intersection Observer for Active Sections
    const sections = document.querySelectorAll('.content-section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all
                sections.forEach(s => s.classList.remove('active'));
                // Add to current
                entry.target.classList.add('active');

                // Update mini-brain highlighting
                const sectionId = entry.target.id;
                updateActiveSectionHighlight(sectionId);
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(section => sectionObserver.observe(section));

    // Connector Line Logic
    const overlay = document.getElementById('interaction-overlay');
    const connectorLine = document.getElementById('connector-line');
    const connectorDot = document.getElementById('connector-dot');
    let activeConnectorRegion = null;
    let activeMenuItem = null;
    let connectorAnimationFrame;

    function updateConnectorLine() {
        // Stop if in mini mode
        if (document.body.classList.contains('brain-mode-mini')) {
            hideConnector();
            return;
        }

        if (!activeConnectorRegion || !activeMenuItem || !overlay.classList.contains('active')) {
            return;
        }

        const brainPos = getBrainRegionScreenPosition(activeConnectorRegion);

        if (!brainPos) {
            // If we can't find the brain pos, hide the line temporarily but keep loop running
            connectorLine.style.opacity = '0';
            connectorDot.style.opacity = '0';
            connectorAnimationFrame = requestAnimationFrame(updateConnectorLine);
            return;
        }

        // Restore opacity if it was hidden
        connectorLine.style.opacity = '1';
        connectorDot.style.opacity = '1';

        // Get menu item position (right side of text)
        const rect = activeMenuItem.getBoundingClientRect();
        // The menu item is wide (flex), but we want the line to start near the text end.
        // Since we don't have a wrapper around just the text, we can approximate or use the label width if needed.
        // But rect.right is fine if the item isn't too wide.
        // Let's add a small gap from the right edge.
        const menuX = rect.right + 15;
        const menuY = rect.top + rect.height / 2;

        // Draw line
        // Curve it slightly for a tech feel
        const midX = (brainPos.x + menuX) / 2;
        const d = `M${brainPos.x},${brainPos.y} C${midX},${brainPos.y} ${midX},${menuY} ${menuX},${menuY}`;

        connectorLine.setAttribute('d', d);
        connectorDot.setAttribute('cx', brainPos.x);
        connectorDot.setAttribute('cy', brainPos.y);

        connectorAnimationFrame = requestAnimationFrame(updateConnectorLine);
    }

    function showConnector(regionName, menuItem) {
        if (document.body.classList.contains('brain-mode-mini')) return;
        activeConnectorRegion = regionName;
        activeMenuItem = menuItem;
        overlay.classList.add('active');
        cancelAnimationFrame(connectorAnimationFrame);
        updateConnectorLine();
    }

    function hideConnector() {
        activeConnectorRegion = null;
        activeMenuItem = null;
        overlay.classList.remove('active');
        cancelAnimationFrame(connectorAnimationFrame);
        // Force opacity to 0 immediately to prevent ghosting
        connectorLine.style.opacity = '0';
        connectorDot.style.opacity = '0';
    }

    // Listen for brain hover events from brain-hero.js
    window.addEventListener('brain-region-hover', (e) => {
        if (document.body.classList.contains('brain-mode-mini')) {
            hideConnector();
            return;
        }

        const { regionName, menuItem, active } = e.detail;
        if (active && regionName && menuItem) {
            showConnector(regionName, menuItem);
        } else {
            hideConnector();
        }
    });

    // Listen for brain click events to trigger menu animation
    window.addEventListener('brain-section-clicked', (e) => {
        const sectionId = e.detail.sectionId;
        const menuItem = document.querySelector(`.brain-nav-item[data-section="${sectionId}"]`);

        if (menuItem) {
            // Trigger Ping Animation
            menuItem.classList.add('ping-effect');

            // Trigger Line Pulse if active
            if (overlay.classList.contains('active')) {
                connectorLine.classList.add('pulsing-line');
            }

            // Cleanup animations
            setTimeout(() => {
                menuItem.classList.remove('ping-effect');
                connectorLine.classList.remove('pulsing-line');
            }, 600); // Match animation duration
        }
    });

    // Menu Click Handlers
    const menuItems = document.querySelectorAll('.brain-nav-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent immediate scroll

            // 1. Trigger Ping Animation
            item.classList.add('ping-effect');

            // 2. Trigger Line Pulse
            if (overlay.classList.contains('active')) {
                connectorLine.classList.add('pulsing-line');
            }

            // 3. Wait for animation then scroll
            setTimeout(() => {
                const sectionId = item.dataset.section;
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Cleanup animations and hide connector
                setTimeout(() => {
                    item.classList.remove('ping-effect');
                    connectorLine.classList.remove('pulsing-line');
                    hideConnector(); // Ensure line disappears
                }, 100); // Short delay after scroll start
            }, config.interaction.scrollDelay);
        });

        // Menu hover -> highlight brain region
        item.addEventListener('mouseenter', () => {
            // Skip hover effects in mini mode
            if (document.body.classList.contains('brain-mode-mini')) return;

            // Clear all other menu highlights first
            document.querySelectorAll('.brain-nav-item.active').forEach(el => el.classList.remove('active'));

            // Add active class to this menu item
            item.classList.add('active');

            // Highlight the corresponding brain region
            const brainRegion = item.dataset.brainRegion;
            if (brainRegion) {
                setBrainRegionHighlight(brainRegion, true);
                showConnector(brainRegion, item);
            }
        });

        item.addEventListener('mouseleave', () => {
            // Skip hover effects in mini mode
            if (document.body.classList.contains('brain-mode-mini')) return;

            // Remove active class from this menu item
            item.classList.remove('active');

            // Reset brain region highlight
            const brainRegion = item.dataset.brainRegion;
            if (brainRegion) {
                setBrainRegionHighlight(brainRegion, false);
                hideConnector();
            }
        });
    });


    // Listen for brain click events to hide connector
    // Since brain clicks trigger scroll, we want to clean up immediately
    document.getElementById('brain-hero-container').addEventListener('click', () => {
        hideConnector();
    });
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
            settingsPanel.classList.toggle('hidden');
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
