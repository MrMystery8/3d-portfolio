import { initBrain, onScrollToSection, resetToHero } from './brain-hero.js';

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

        // Hero State (full bleed)
        const startW = viewportWidth;
        const startH = viewportHeight;
        const startTop = 0;
        const startLeft = 0;

        // Mini State - ensure it never goes off-screen
        const margin = 20;
        const minSize = 80; // Minimum size to ensure visibility
        const maxSize = 150; // Maximum size for mini brain
        const endSize = Math.max(Math.min(maxSize, viewportWidth * 0.15), minSize);
        const endTop = margin;
        // Calculate right-aligned position, ensuring it stays fully on-screen
        const endLeft = Math.max(viewportWidth - endSize - margin, margin);

        // Interpolate dimensions and position
        const currentW = startW + (endSize - startW) * t;
        const currentH = startH + (endSize - startH) * t;
        const currentTop = startTop + (endTop - startTop) * t;
        const currentLeft = startLeft + (endLeft - startLeft) * t;

        // Apply styles directly for smooth continuous updates
        brainContainer.style.width = `${currentW}px`;
        brainContainer.style.height = `${currentH}px`;
        brainContainer.style.top = `${currentTop}px`;
        brainContainer.style.left = `${currentLeft}px`;
        brainContainer.style.position = 'fixed';
        brainContainer.style.zIndex = '99999'; // Enforce z-index to stay above all content
        brainContainer.style.transform = 'translate3d(0, 0, 0)'; // GPU acceleration

        // Dispatch resize event for Three.js renderer
        window.dispatchEvent(new CustomEvent('brain-resize', {
            detail: { width: currentW, height: currentH }
        }));

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
});
