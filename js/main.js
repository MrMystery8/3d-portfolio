import { initBrain, onScrollToSection, resetToHero, updateBrainViewport, updateSimulationParams, highlightBrainRegion, updateActiveSectionHighlight, setBrainRegionHighlight, getBrainRegionScreenPosition } from './brain-hero.js';
import { config } from './config.js';
import { initBackground } from './background.js';
import { initTextEffects } from './text-effects.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Background & Text Effects
    initBackground();
    initTextEffects();

    // Set CSS variables from config
    document.documentElement.style.setProperty('--ping-duration', `${config.interaction.pingAnimationDuration}ms`);
    document.documentElement.style.setProperty('--menu-top', `${config.ui.menuGap}vh`);

    // Settings UI Logic (Moved to top)
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
            rotationSpeedY: document.getElementById('rot-y'),
            menuGap: document.getElementById('menu-gap')
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
            rotationSpeedY: document.getElementById('val-rot-y'),
            menuGap: document.getElementById('val-menu-gap')
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

                    if (key === 'menuGap') {
                        document.documentElement.style.setProperty('--menu-top', value + 'vh');
                        return;
                    }

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
        const posConfig = config.miniBrain.position;
        const minSize = config.miniBrain.minSize;
        const maxSize = config.miniBrain.maxSize;
        const endSize = Math.max(Math.min(maxSize, viewportWidth * 0.25), minSize);

        // Calculate X Position based on Anchor
        let desiredBrainX;
        if (posConfig.anchorX === 'left') {
            desiredBrainX = (endSize / 2) + posConfig.offsetX;
        } else {
            // Default to right
            desiredBrainX = viewportWidth - (endSize / 2) + posConfig.offsetX;
        }

        // Calculate Y Position based on Anchor
        let desiredBrainY;
        if (posConfig.anchorY === 'bottom') {
            desiredBrainY = viewportHeight - (endSize / 2) + posConfig.offsetY;
        } else {
            // Default to top
            desiredBrainY = (endSize / 2) + posConfig.offsetY;
        }

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
        // Fade out hero elements
        const heroElements = [
            document.getElementById('hero-title'),
            document.getElementById('hero-instructions')
        ];

        heroElements.forEach(el => {
            if (el) {
                el.style.opacity = Math.max(1 - (t * 2), 0);
            }
        });



        // Animate Menu (Sync with scroll)
        const brainMenu = document.getElementById('brain-nav-menu');
        if (brainMenu) {
            // Fade out and slide up
            // We want it to be fully gone by t=0.5 (similar to hero text)
            const menuOpacity = Math.max(1 - (t * 2.5), 0);
            brainMenu.style.opacity = menuOpacity;

            // Slide up significantly (to top of page)
            const yOffset = -500 * t;
            brainMenu.style.transform = `translateX(-50%) translateY(${yOffset}px)`;

            // Disable interactions when invisible
            if (menuOpacity < 0.1) {
                brainMenu.style.pointerEvents = 'none';
            } else {
                brainMenu.style.pointerEvents = 'auto';
            }
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

            // If we just exited mini mode, reset highlights and clear active section
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

    // Start loop
    updateTargetProgress();
    animateBrain();

    // --- STRICT SECTION SCROLLING (Wheel Hijack) ---
    let isAnimating = false;
    let lastAbsDelta = 0;

    // Collect all scroll targets: Hero + Sections
    // We assume they appear in DOM order
    const getScrollTargets = () => {
        return [document.getElementById('hero'), ...document.querySelectorAll('.content-section')];
    };

    window.addEventListener('wheel', (e) => {
        // CRITICAL FIX: If overlay is open (no-scroll class), allow native scroll and ignore custom logic
        if (document.body.classList.contains('no-scroll')) {
            return;
        }

        e.preventDefault(); // STOP native scroll only if we are in main view

        // INTENT DETECTION (Smart Momentum Filter)
        // We track the absolute delta to detect acceleration (new gesture) vs deceleration (momentum)
        const currentAbsDelta = Math.abs(e.deltaY);
        const isAccelerating = currentAbsDelta > lastAbsDelta;

        // Always update history
        lastAbsDelta = currentAbsDelta;

        // If we are already animating, we ignore everything
        // But we still updated lastAbsDelta so we know the state when animation finishes
        if (isAnimating) return;

        // Filter:
        // 1. Must be accelerating (new swipe)
        // 2. Must be above sensitivity threshold (ignore noise)
        if (!isAccelerating) return;
        if (currentAbsDelta < config.interaction.scrollSensitivity) return;

        const direction = Math.sign(e.deltaY); // 1 for down, -1 for up
        if (direction === 0) return;

        const targets = getScrollTargets();

        // Find current section index
        // We define "current" as the one taking up the most screen space or closest to top
        const scrollY = window.scrollY;
        let currentIndex = 0;
        let minDistance = Infinity;

        targets.forEach((target, index) => {
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const distance = Math.abs(rect.top);
            if (distance < minDistance) {
                minDistance = distance;
                currentIndex = index;
            }
        });

        // Determine target index
        let targetIndex;

        // FAST SCROLL JUMP
        if (currentAbsDelta > config.interaction.fastScrollSensitivity) {
            if (direction > 0) {
                // Jump to END
                targetIndex = targets.length - 1;
            } else {
                // Jump to START
                targetIndex = 0;
            }
        } else {
            // Normal Step
            targetIndex = currentIndex + direction;
        }

        // Clamp index
        targetIndex = Math.max(0, Math.min(targetIndex, targets.length - 1));

        // If we are already at the target (e.g. trying to scroll up at top), do nothing
        if (targetIndex === currentIndex) return;

        // Animate
        isAnimating = true;
        const targetSection = targets[targetIndex];
        const targetTop = scrollY + targetSection.getBoundingClientRect().top;

        window.scrollTo({
            top: targetTop,
            behavior: 'smooth'
        });

        // Lock scroll for a duration to prevent rapid skipping
        // Native smooth scroll duration is variable, but ~800ms is usually safe
        setTimeout(() => {
            isAnimating = false;
            // Reset delta history to ensure next scroll is fresh?
            // Actually, we don't want to reset to 0 immediately, or a trailing momentum event might trigger?
            // No, trailing momentum will be SMALLER than the high value we just had.
            // So keeping lastAbsDelta high is good. It forces the user to really swipe again.

            // After scroll completes, check which section is active and update mini-brain highlight
            detectInitialActiveSection();
        }, 800);

    }, { passive: false }); // REQUIRED for preventDefault

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
                // Always call this - the function itself will check if we're in mini mode
                updateActiveSectionHighlight(sectionId);
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(section => sectionObserver.observe(section));

    // Detect initial active section on page load
    // This handles cases where the page is reloaded while already scrolled to a section
    function detectInitialActiveSection() {
        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight;

        let activeSection = null;
        let maxVisibility = 0;

        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const sectionTop = rect.top + scrollY;
            const sectionBottom = sectionTop + rect.height;
            const viewportTop = scrollY;
            const viewportBottom = scrollY + viewportHeight;

            // Calculate how much of the section is visible
            const visibleTop = Math.max(sectionTop, viewportTop);
            const visibleBottom = Math.min(sectionBottom, viewportBottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            const visibilityRatio = visibleHeight / rect.height;

            if (visibilityRatio > maxVisibility) {
                maxVisibility = visibilityRatio;
                activeSection = section;
            }
        });

        if (activeSection && maxVisibility > 0.5) {
            sections.forEach(s => s.classList.remove('active'));
            activeSection.classList.add('active');
            updateActiveSectionHighlight(activeSection.id);
        }
    }

    // Run initial detection after a short delay to ensure the brain is initialized
    setTimeout(detectInitialActiveSection, 100);


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

        // Get menu item position (Bottom Center)
        const rect = activeMenuItem.getBoundingClientRect();
        const menuX = rect.left + rect.width / 2;
        const menuY = rect.bottom + 10;

        // Draw line
        // Vertical S-curve for top menu
        const midY = (brainPos.y + menuY) / 2;
        const d = `M${brainPos.x},${brainPos.y} C${brainPos.x},${midY} ${menuX},${midY} ${menuX},${menuY}`;

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
            // Set ping color based on section
            let pingColor = '#00ffff'; // Default cyan
            if (sectionId === 'section-projects') pingColor = `#${config.brainMapping.colors.projects.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-experience') pingColor = `#${config.brainMapping.colors.experience.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-skills-labs') pingColor = `#${config.brainMapping.colors.skills.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-profile') pingColor = `#${config.brainMapping.colors.profile.toString(16).padStart(6, '0')}`;

            menuItem.style.setProperty('--ping-color', pingColor);

            // Trigger Ping Animation
            menuItem.classList.add('ping-effect');

            // Trigger Line Pulse if active
            if (overlay.classList.contains('active')) {
                connectorLine.classList.add('pulsing-line');
            }

            // Cleanup animations
            setTimeout(() => {
                menuItem.classList.remove('ping-effect');
                menuItem.style.removeProperty('--ping-color');
                connectorLine.classList.remove('pulsing-line');
            }, config.interaction.pingAnimationDuration);
        }
    });

    // Menu Click Handlers
    const menuItems = document.querySelectorAll('.brain-nav-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent immediate scroll

            // Set ping color based on section
            const sectionId = item.dataset.section;
            let pingColor = '#00ffff'; // Default cyan
            if (sectionId === 'section-projects') pingColor = `#${config.brainMapping.colors.projects.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-experience') pingColor = `#${config.brainMapping.colors.experience.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-skills-labs') pingColor = `#${config.brainMapping.colors.skills.toString(16).padStart(6, '0')}`;
            else if (sectionId === 'section-profile') pingColor = `#${config.brainMapping.colors.profile.toString(16).padStart(6, '0')}`;

            item.style.setProperty('--ping-color', pingColor);

            // 1. Trigger Ping Animation
            item.classList.add('ping-effect');

            // 2. Trigger Line Pulse
            if (overlay.classList.contains('active')) {
                connectorLine.classList.add('pulsing-line');
            }

            // 3. Wait for animation then scroll
            setTimeout(() => {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Cleanup animations and hide connector
                setTimeout(() => {
                    item.classList.remove('ping-effect');
                    item.style.removeProperty('--ping-color');
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

            // Look up the brain region from config based on section ID
            const sectionId = item.dataset.section;
            const brainRegion = Object.keys(config.brainMapping.sections).find(
                key => config.brainMapping.sections[key] === sectionId
            );

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

            // Look up the brain region from config based on section ID
            const sectionId = item.dataset.section;
            const brainRegion = Object.keys(config.brainMapping.sections).find(
                key => config.brainMapping.sections[key] === sectionId
            );

            if (brainRegion) {
                setBrainRegionHighlight(brainRegion, false);
                hideConnector();
            }
        });
    });

    // --- NEW UI COMPONENT LOGIC ---

    // 1. Expandable Cards (Projects & Experience)
    document.querySelectorAll('.details-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click if any
            const card = btn.closest('.card') || btn.closest('.timeline-item');
            const details = card.querySelector('.card-details') || card.querySelector('.timeline-details');

            if (card && details) {
                const isExpanded = card.classList.contains('expanded');

                // Toggle class
                card.classList.toggle('expanded');

                // Toggle button text
                btn.textContent = isExpanded ? 'View Details' : 'Close Details';

                // Animate height
                if (!isExpanded) {
                    details.style.maxHeight = details.scrollHeight + 'px';
                } else {
                    details.style.maxHeight = '0';
                }
            }
        });
    });

    // 2. Tabs (Skills & Labs)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const targetId = 'tab-' + btn.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 3. Accordion (Profile)
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = item.querySelector('.accordion-content');
            const isActive = item.classList.contains('active');

            // Close all others (optional - exclusive accordion)
            // document.querySelectorAll('.accordion-item').forEach(i => {
            //     i.classList.remove('active');
            //     i.querySelector('.accordion-content').style.maxHeight = '0';
            // });

            if (!isActive) {
                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                item.classList.remove('active');
                content.style.maxHeight = '0';
            }
        });
    });

    // --- PROJECT DATA & OVERLAY CONTROLLER ---
    const projectData = [
        {
            id: 0,
            title: "Minhas Rupsi Learning Platform",
            subtitle: "Full Stack Learning Platform + RAG AI Chatbot",
            description: "Built a full-stack learning platform for Computer Science students with a Flask backend and custom APIs. Implemented a retrieval-augmented generation (RAG) chatbot that indexes lecture PDFs and notes to answer student queries with context.",
            bullets: [
                "RAG chatbot reducing student response time by 60%+",
                "Integrated vector embeddings and optimised retrieval logic",
                "Supports both web and mobile interfaces",
                "Secure user authentication and progress tracking"
            ],
            tags: ["Flask", "Python", "RAG", "Vector DB", "LLM API", "HTML/CSS/JS", "Android"],
            features: [
                "Real-time chat interface",
                "Admin dashboard for content management",
                "Student progress analytics",
                "Automated PDF indexing pipeline"
            ]
        },
        {
            id: 1,
            title: "89th Parallel LMS",
            subtitle: "Multi-Subject AI Learning Management System",
            description: "Designed a multi-subject RAG architecture where each subject (Physics, Math, Chemistry) has its own knowledge base and embeddings. Backend dynamically routes queries to the correct subject-specific knowledge base based on user selection.",
            bullets: [
                "Multi-knowledge-base retrieval with subject-aware switching",
                "Accessible from both a web interface and a mobile app",
                "Helps students query exam-style questions and theory",
                "Scalable architecture for adding new subjects"
            ],
            tags: ["Python", "Flask", "RAG", "Vector Search", "A-Level Content", "Web", "Mobile"],
            features: [
                "Subject-specific knowledge silos",
                "Context-aware query routing",
                "Mobile-first design",
                "Exam question bank integration"
            ]
        },
        {
            id: 2,
            title: "Local LLM Ecosystem",
            subtitle: "Android & Web Front-Ends for Local Open-Source LLMs",
            description: "Runs quantised open-source LLM models locally on a Mac using LM Studio. Android app and web client send requests to the local inference server. Uses Cloudflare Tunnels to expose the local endpoint securely over the internet.",
            bullets: [
                "Secure remote access to local LLMs via Cloudflare tunnels",
                "Implements streaming responses and batched requests",
                "Optimised for low-latency on personal hardware",
                "Custom UI for model selection and parameter tuning"
            ],
            tags: ["Android", "Flask", "LM Studio", "Cloudflare Tunnels", "Local LLM", "Streaming"],
            features: [
                "Zero-cost inference",
                "Privacy-first architecture",
                "Customizable system prompts",
                "Low-latency streaming"
            ]
        },
        {
            id: 3,
            title: "Conversational Clone",
            subtitle: "Hybrid RAG + Gemini Personality Clone",
            description: "Ingests a user's chat logs and documents into a hybrid retrieval index. Uses vector search (FAISS/Annoy) and BM25 over the same corpus. Combines results using Reciprocal Rank Fusion to capture both semantic and lexical signals.",
            bullets: [
                "Hybrid retrieval combining vector search and BM25 with RRF",
                "Mimics user tone and style using Gemini fine-tuning",
                "Handles multi-turn conversations with context memory",
                "Scalable ingestion pipeline for new chat logs"
            ],
            tags: ["Flask", "Gemini", "FAISS/Annoy", "BM25", "RRF", "RAG"],
            features: [
                "Personality mimicry",
                "Context-aware memory",
                "Hybrid search ranking",
                "Chat log ingestion pipeline"
            ]
        },
        {
            id: 4,
            title: "Area-51",
            subtitle: "3D Survival Browser Game",
            description: "Built a browser-based 3D survival game using Three.js for rendering and CANNON.js for physics. Generated procedural terrain and obstacles for replayability. Implemented enemy AI that patrols and chases the player.",
            bullets: [
                "Three.js game with procedural terrain and enemy AI",
                "Full day/night cycle and dynamic lighting",
                "Resource gathering and health management systems",
                "Physics-based movement and collision detection"
            ],
            tags: ["Three.js", "Cannon.js", "WebGL", "Game Dev", "Procedural Generation"],
            features: [
                "Procedural terrain generation",
                "Day/night cycle",
                "Enemy AI state machine",
                "Inventory system"
            ]
        },
        {
            id: 5,
            title: "Zephyr-Odyssey",
            subtitle: "Physics Arcade Game",
            description: "Developed a 2D physics arcade game using Pygame. Implemented custom physics for gravity, collision, and momentum. Designed multiple levels with increasing difficulty and unique mechanics.",
            bullets: [
                "Custom 2D physics engine implementation",
                "Multiple levels with unique mechanics",
                "High-score tracking and persistence",
                "Smooth 60fps gameplay loop"
            ],
            tags: ["Python", "Pygame", "Physics", "Game Dev", "2D Arcade"],
            features: [
                "Custom physics engine",
                "Level editor tools",
                "Particle effects system",
                "Save/Load system"
            ]
        }
    ];

    // --- OVERLAY LOGIC ---
    const projectOverlay = document.getElementById('project-overlay');
    const overlayCloseBtn = document.getElementById('overlay-close-btn');
    const overlayList = document.getElementById('overlay-project-list');

    // DOM Elements to populate
    const domTitle = document.getElementById('overlay-project-title');
    const domType = document.getElementById('overlay-project-type');
    const domDesc = document.getElementById('overlay-description');
    const domBullets = document.getElementById('overlay-bullets');
    const domTags = document.getElementById('overlay-tags');
    const domFeatures = document.getElementById('overlay-features');

    let currentProjectId = 0;

    function openOverlay(projectId = 0) {
        currentProjectId = projectId;
        renderOverlayContent(projectId);
        renderSidebar(projectId);

        // Show Overlay
        projectOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');

        // Trap focus (simple version)
        overlayCloseBtn.focus();
    }

    function closeOverlay() {
        projectOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');

        // Return focus to launcher button
        const launcherBtn = document.getElementById('open-gallery-btn');
        if (launcherBtn) launcherBtn.focus();
    }

    function renderOverlayContent(id) {
        const project = projectData.find(p => p.id === parseInt(id)) || projectData[0];

        // Animate content change (simple fade)
        const contentWrapper = document.querySelector('.overlay-content');
        contentWrapper.style.opacity = '0';

        setTimeout(() => {
            domTitle.textContent = project.title;
            domType.textContent = project.subtitle;
            domDesc.textContent = project.description;

            // Bullets
            domBullets.innerHTML = project.bullets.map(b => `<li>${b}</li>`).join('');

            // Tags
            domTags.innerHTML = project.tags.map(t => `<span>${t}</span>`).join('');

            // Features (Optional)
            if (project.features && project.features.length > 0) {
                domFeatures.innerHTML = project.features.map(f => `<li>${f}</li>`).join('');
                domFeatures.parentElement.style.display = 'block';
            } else {
                domFeatures.parentElement.style.display = 'none';
            }

            // Scroll content to top
            contentWrapper.scrollTop = 0;
            contentWrapper.style.opacity = '1';

        }, 200);
    }

    function renderSidebar(activeId) {
        overlayList.innerHTML = projectData.map(p => {
            // Generate 1-2 badges (take first 2 tags)
            const badges = p.tags.slice(0, 2).map(t => `<span class="sidebar-badge">${t}</span>`).join('');

            return `
            <li class="sidebar-item ${p.id === parseInt(activeId) ? 'active' : ''}" data-id="${p.id}">
                <span class="sidebar-item-title">${p.title}</span>
                <div class="sidebar-badges">${badges}</div>
            </li>
            `;
        }).join('');

        // Re-attach listeners
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const newId = item.dataset.id;
                renderOverlayContent(newId);

                // Update active state in sidebar
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    // Event Listeners for Launcher
    document.querySelectorAll('.launcher-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const id = tile.dataset.projectId;
            openOverlay(id);
        });
    });

    const openGalleryBtn = document.getElementById('open-gallery-btn');
    if (openGalleryBtn) {
        openGalleryBtn.addEventListener('click', () => {
            openOverlay(0); // Default to first project
        });
    }

    // Event Listeners for Overlay
    if (overlayCloseBtn) {
        overlayCloseBtn.addEventListener('click', closeOverlay);
    }

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && projectOverlay.getAttribute('aria-hidden') === 'false') {
            closeOverlay();
        }
    });

    // --- MASTER-DETAIL CONTROLLER (Experience Section) ---
    const masterDetailContainer = document.querySelector('.master-detail-container');

    if (masterDetailContainer) {
        const timelineItems = Array.from(masterDetailContainer.querySelectorAll('.timeline-item'));
        const detailContents = Array.from(masterDetailContainer.querySelectorAll('.detail-content'));

        // Function to show specific detail
        function showDetail(index) {
            // Update timeline items
            timelineItems.forEach((item, i) => {
                item.classList.toggle('active', i === index);
            });

            // Update detail contents
            detailContents.forEach((content, i) => {
                content.classList.toggle('hidden', i !== index);
            });
        }

        // Click handlers for timeline items
        timelineItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                showDetail(index);
            });
        });

        // Initialize with first item selected
        showDetail(0);
    }


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
        // 1. Check if Overlay is open
        const projectOverlay = document.getElementById('project-overlay');
        if (projectOverlay && projectOverlay.getAttribute('aria-hidden') === 'false') {
            closeOverlay();
            return;
        }
    });

    // Listen for precise mini-brain clicks (dispatched from brain-hero.js via raycasting)
    window.addEventListener('mini-brain-clicked', () => {
        // Default Mini-Brain Behavior (Scroll to Top)
        if (document.body.classList.contains('brain-mode-mini')) {
            // Return to hero section, triggering reverse transformation
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });


});
