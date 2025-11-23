import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let brainGroup;
let raycaster, mouse;
const container = document.getElementById('brain-hero-container');

// Uniforms for shader (Module Scope)
const uniforms = {
    time: { value: 0 },
    baseColor: { value: new THREE.Color(0x050915) },
    emissiveColor: { value: new THREE.Color(0x00ffff) }
};

// Mapping from Mesh Names to Section IDs
const brainSectionMap = {
    'Brain_Part_01_BRAIN_TEXTURE_blinn2_0': 'section-projects',
    'Brain_Part_02_BRAIN_TEXTURE_blinn2_0': 'section-experience',
    'Brain_Part_03_BRAIN_TEXTURE_blinn2_0': 'section-skills',
    'Brain_Part_04_BRAIN_TEXTURE_blinn2_0': 'section-awards',
    // Aliases
    'Brain_Part_05_BRAIN_TEXTURE_blinn2_0': 'section-projects',
    'Brain_Part_06_BRAIN_TEXTURE_blinn2_0': 'section-experience',
};

// Track mouse down for drag detection
let mouseDownPos = new THREE.Vector2();

export function initBrain() {
    // 1. Scene Setup
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.HemisphereLight(0x00ffff, 0x000033, 1);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;

    // 6. Load Model
    const loader = new GLTFLoader();

    // Procedural Texture Generation (since image gen failed)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#0a1125';
    ctx.fillRect(0, 0, 512, 512);

    // Cybernetic grid/circuitry
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
        // Horizontal lines
        ctx.moveTo(0, Math.random() * 512);
        ctx.lineTo(512, Math.random() * 512);
        // Vertical lines
        ctx.moveTo(Math.random() * 512, 0);
        ctx.lineTo(Math.random() * 512, 512);
    }
    ctx.stroke();

    // Glowing nodes
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    const brainTexture = new THREE.CanvasTexture(canvas);
    brainTexture.wrapS = THREE.RepeatWrapping;
    brainTexture.wrapT = THREE.RepeatWrapping;
    brainTexture.repeat.set(4, 4);

    // Uniforms defined in module scope now

    loader.load('assets/brain_areas.glb', (gltf) => {
        brainGroup = gltf.scene;

        // Center and Scale
        const box = new THREE.Box3().setFromObject(brainGroup);
        const center = box.getCenter(new THREE.Vector3());
        brainGroup.position.sub(center); // Center at 0,0,0
        brainGroup.scale.set(1.5, 1.5, 1.5);

        console.log('Brain Model Loaded. Mesh Names:');
        // Material Setup
        brainGroup.traverse((child) => {
            if (child.isMesh) {
                console.log('-', child.name); // Debug log
                child.material = new THREE.MeshStandardMaterial({
                    map: brainTexture, // Apply texture
                    color: 0xaaaaaa, // Lighter base to show texture
                    emissive: 0x00ffff,
                    emissiveIntensity: 0.2,
                    metalness: 0.6,
                    roughness: 0.4,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });

                child.material.onBeforeCompile = (shader) => {
                    shader.uniforms.time = uniforms.time;

                    // Add time uniform and varying
                    shader.fragmentShader = `
                        uniform float time;
                        varying vec3 vPosition;
                    ` + shader.fragmentShader;

                    // Add electric pulse logic to emissive calculation
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <emissivemap_fragment>',
                        `
                        #include <emissivemap_fragment>
                        
                        // Electric pulse moving along Y axis (or UVs)
                        float pulse = sin(vPosition.y * 10.0 - time * 5.0);
                        float pulse2 = sin(vPosition.x * 10.0 + time * 3.0);
                        
                        // Combine pulses for irregular "electric" look
                        float electric = max(0.0, pulse * pulse2);
                        
                        // Add sharp bursts
                        if (electric > 0.9) {
                            totalEmissiveRadiance += vec3(0.0, 1.0, 1.0) * 2.0;
                        } else {
                            totalEmissiveRadiance += vec3(0.0, 0.5, 0.5) * electric * 0.5;
                        }
                        `
                    );

                    // We need vPosition in fragment shader
                    shader.vertexShader = `
                        varying vec3 vPosition;
                    ` + shader.vertexShader;

                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `
                        #include <begin_vertex>
                        vPosition = position;
                        `
                    );
                };

                child.userData.originalEmissive = 0.2; // Store for hover reset
            }
        });

        scene.add(brainGroup);
        animate();
    }, undefined, (error) => {
        console.error('An error happened loading the brain model:', error);
    });

    // 7. Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Event Listeners
    // Custom resize event from main.js for smooth sync
    window.addEventListener('brain-resize', (e) => {
        if (!camera || !renderer) return;
        const { width, height } = e.detail;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    });

    // Window resize fallback to keep it pinned correctly
    window.addEventListener('resize', onWindowResize);

    // Use mousedown/up to distinguish drag from click
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
}

function onWindowResize() {
    if (!camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); // false prevents setting style.width/height which conflicts with CSS
}

function onMouseDown(event) {
    mouseDownPos.set(event.clientX, event.clientY);
}

function onMouseUp(event) {
    const mouseUpPos = new THREE.Vector2(event.clientX, event.clientY);
    const distance = mouseDownPos.distanceTo(mouseUpPos);

    // If moved less than 5 pixels, treat as click
    if (distance < 5) {
        onClick(event);
    }
}

function onClick(event) {
    // BEHAVIOR MODE CHECK:
    // In MINI mode, the brain is a "back to nav" button, NOT a navigator.
    // Raycasting for brain lobes clicks is only active in HERO mode.
    // The main.js click handler takes over in MINI mode to scroll to top.
    if (document.body.classList.contains('brain-mode-mini')) return;

    // Calculate mouse position in normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (!brainGroup) return;

    const intersects = raycaster.intersectObjects(brainGroup.children, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        console.log('Clicked Object:', object.name); // Debug log
        const sectionId = brainSectionMap[object.name];

        if (sectionId) {
            console.log('Navigating to:', sectionId);
            scrollToSection(sectionId);
        } else {
            console.warn('No section mapped for:', object.name);
        }
    }
}

let hoveredObject = null;

function onMouseMove(event) {
    if (document.body.classList.contains('brain-mode-mini')) return;
    if (!brainGroup) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(brainGroup.children, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (hoveredObject !== object) {
            // Reset previous
            if (hoveredObject) {
                hoveredObject.material.emissiveIntensity = hoveredObject.userData.originalEmissive;
            }
            // Highlight new
            hoveredObject = object;
            hoveredObject.material.emissiveIntensity = 0.8;
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (hoveredObject) {
            hoveredObject.material.emissiveIntensity = hoveredObject.userData.originalEmissive;
            hoveredObject = null;
            document.body.style.cursor = 'default';
        }
    }
}

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function resetToHero() {
    // Optional: Reset camera or brain rotation if desired
    // controls.reset(); 
}

export function onScrollToSection() {
    // External trigger if needed
}

function animate() {
    requestAnimationFrame(animate);

    // Idle rotation
    if (brainGroup) {
        brainGroup.rotation.y += 0.001;
        // Update uniforms
        uniforms.time.value = performance.now() / 1000;
    }

    controls.update();
    renderer.render(scene, camera);
}
