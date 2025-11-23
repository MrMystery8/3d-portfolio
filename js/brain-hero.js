import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer, controls;
let brainGroup;
let raycaster, mouse;
const container = document.getElementById('brain-hero-container');

// Simulation Data (Mutable)
let simulationParams = {
    nodeCount: 100,
    connectionDistance: 0.3,
    signalCount: 10,
    signalSpeed: 0.8,
    signalSize: 1.0,
    networkOpacity: 0.1,
    signalOpacity: 1.0,
    brainOpacity: 0.15,
    brainSize: 2.2,
    rotationSpeedX: 0.0,
    rotationSpeedY: 0.1
};

let labelObjects = []; // Store CSS2DObjects for occlusion logic

let nodes = []; // { position: Vector3, neighbors: [] }
let signals = []; // { currentPos: Vector3, targetNodeIdx: int, progress: float, pathStart: Vector3, pathEnd: Vector3 }

let nodeParticles; // THREE.Points
let connectionLines; // THREE.LineSegments
let signalParticles; // THREE.Points

// Current viewport state (DOM coordinates)
let currentViewport = {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight
};

// Mapping from Mesh Names to Section IDs (for navigation on the shell)
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
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setScissorTest(true);
    renderer.setScissorTest(true);
    container.appendChild(renderer.domElement);

    // 3b. Label Renderer
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none'; // Allow clicks to pass through to WebGL
    container.appendChild(labelRenderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.HemisphereLight(0x00ffff, 0x000033, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; // We handle rotation manually now
    controls.autoRotateSpeed = 0.5;

    // 6. Load Model & Generate Network
    const loader = new GLTFLoader();

    loader.load('assets/brain_areas.glb', (gltf) => {
        brainGroup = gltf.scene;

        // Center and Scale
        const box = new THREE.Box3().setFromObject(brainGroup);
        const center = box.getCenter(new THREE.Vector3());
        brainGroup.position.sub(center);
        // Initial scale based on params
        const initialScale = simulationParams.brainSize;
        brainGroup.scale.set(initialScale, initialScale, initialScale);

        // 6a. Setup Brain Shell (Glassy look)
        brainGroup.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0x00ffff,
                    metalness: 0.1,
                    roughness: 0.1,
                    transmission: 0.6, // Glass-like
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide,
                    depthWrite: false, // Allow seeing inside
                });
                child.renderOrder = 1; // Render after internal structure
            }
        });
        scene.add(brainGroup);

        // 6b. Generate Neural Network
        generateNeuralNetwork(brainGroup);

        // 6c. Create Section Labels
        createSectionLabels(brainGroup);

        animate();
    }, undefined, (error) => {
        console.error('An error happened loading the brain model:', error);
    });

    // 7. Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
}

function createOrbTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function generateNeuralNetwork(group) {
    // Clear existing geometry if any
    if (nodeParticles) {
        group.remove(nodeParticles);
        nodeParticles.geometry.dispose();
        nodeParticles.material.dispose();
        nodeParticles = null;
    }
    if (connectionLines) {
        group.remove(connectionLines);
        connectionLines.geometry.dispose();
        connectionLines.material.dispose();
        connectionLines = null;
    }
    if (signalParticles) {
        group.remove(signalParticles);
        signalParticles.geometry.dispose();
        signalParticles.material.dispose();
        signalParticles = null;
    }

    nodes = [];
    signals = [];

    // Find a suitable mesh to sample from
    const tempPosition = new THREE.Vector3();
    const samplerMeshes = [];

    group.traverse((child) => {
        if (child.isMesh) {
            samplerMeshes.push(child);
        }
    });

    if (samplerMeshes.length === 0) return;

    // 1. Generate Nodes (Neurons)
    const nodePositions = [];
    const samplesPerMesh = Math.floor(simulationParams.nodeCount / samplerMeshes.length);

    samplerMeshes.forEach(mesh => {
        const sampler = new MeshSurfaceSampler(mesh).build();
        for (let i = 0; i < samplesPerMesh; i++) {
            sampler.sample(tempPosition);

            nodes.push({
                position: tempPosition.clone(),
                neighbors: []
            });
            nodePositions.push(tempPosition.x, tempPosition.y, tempPosition.z);
        }
    });

    // 2. Create Visuals for Nodes
    const orbTexture = createOrbTexture();

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
    const nodeMaterial = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.12,
        map: orbTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    nodeParticles = new THREE.Points(nodeGeometry, nodeMaterial);
    brainGroup.add(nodeParticles);

    // 3. Generate Connections (Edges)
    const linePositions = [];

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dist = nodes[i].position.distanceTo(nodes[j].position);
            if (dist < simulationParams.connectionDistance) {
                nodes[i].neighbors.push(j);
                nodes[j].neighbors.push(i);

                // Add line segment
                linePositions.push(
                    nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
                    nodes[j].position.x, nodes[j].position.y, nodes[j].position.z
                );
            }
        }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending
    });
    connectionLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    brainGroup.add(connectionLines);

    // 4. Initialize Signals
    const signalPositions = new Float32Array(simulationParams.signalCount * 3);
    for (let i = 0; i < simulationParams.signalCount; i++) {
        spawnSignal(i);
        if (signals[i]) {
            signalPositions[i * 3] = signals[i].currentPos.x;
            signalPositions[i * 3 + 1] = signals[i].currentPos.y;
            signalPositions[i * 3 + 2] = signals[i].currentPos.z;
        }
    }

    const signalGeometry = new THREE.BufferGeometry();
    signalGeometry.setAttribute('position', new THREE.BufferAttribute(signalPositions, 3));
    const signalMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.25,
        map: orbTexture,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    signalParticles = new THREE.Points(signalGeometry, signalMaterial);
    brainGroup.add(signalParticles);
}

function spawnSignal(index) {
    if (nodes.length === 0) return;

    // Pick random start node that has neighbors
    let startNodeIdx = Math.floor(Math.random() * nodes.length);
    let attempts = 0;
    while (nodes[startNodeIdx].neighbors.length === 0 && attempts < 100) {
        startNodeIdx = Math.floor(Math.random() * nodes.length);
        attempts++;
    }

    const startNode = nodes[startNodeIdx];
    if (startNode.neighbors.length === 0) return; // Should not happen with attempts check

    const targetNodeIdx = startNode.neighbors[Math.floor(Math.random() * startNode.neighbors.length)];
    const targetNode = nodes[targetNodeIdx];

    signals[index] = {
        currentPos: startNode.position.clone(),
        targetNodeIdx: targetNodeIdx,
        pathStart: startNode.position,
        pathEnd: targetNode.position,
        progress: 0,
        speed: Math.random() * 0.5 + simulationParams.signalSpeed
    };
}

function createSectionLabels(group) {
    // Map section IDs to display names
    const sectionNames = {
        'section-projects': 'PROJECTS',
        'section-experience': 'EXPERIENCE',
        'section-skills': 'SKILLS',
        'section-awards': 'AWARDS'
    };

    const createdLabels = new Set();
    labelObjects = []; // Reset

    group.traverse((child) => {
        if (child.isMesh) {
            const sectionId = brainSectionMap[child.name];
            if (sectionId && !createdLabels.has(sectionId)) {
                // Determine position: Center of the mesh
                child.geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                child.geometry.boundingBox.getCenter(center);

                const div = document.createElement('div');
                div.className = 'brain-label';
                div.textContent = sectionNames[sectionId];
                div.dataset.section = sectionId; // For easy selection/styling

                const label = new CSS2DObject(div);
                label.position.copy(center);

                // Offset slightly outwards to float above
                const dir = center.clone().normalize();
                label.position.add(dir.multiplyScalar(0.5));

                child.add(label);
                createdLabels.add(sectionId);
                labelObjects.push(label);
            }
        }
    });
}

// Export function to update simulation parameters
export function updateSimulationParams(newParams) {
    console.log('Updating simulation params:', newParams);
    // Merge new params
    simulationParams = { ...simulationParams, ...newParams };

    // Re-generate network if structural params changed
    if (newParams.nodeCount !== undefined || newParams.connectionDistance !== undefined || newParams.signalCount !== undefined) {
        if (brainGroup) {
            console.log('Rebuilding neural network...');
            generateNeuralNetwork(brainGroup);
        } else {
            console.warn('Brain group not ready yet.');
        }
    }

    // Update speed immediately for existing signals
    if (newParams.signalSpeed !== undefined) {
        signals.forEach(sig => {
            if (sig) {
                const variation = sig.speed - (simulationParams.signalSpeed - (newParams.signalSpeed - simulationParams.signalSpeed)); // approximate
                sig.speed = Math.random() * 0.5 + simulationParams.signalSpeed;
            }
        });
    }

    // Update Visuals
    if (newParams.signalSize !== undefined) {
        if (signalParticles) {
            // Base size is 0.15, scaled by signalSize param
            // We also need to account for current viewport scale if in mini mode, but for now just update base
            // The updateBrainViewport function will handle the dynamic scaling
            // Here we just trigger a refresh of the viewport to re-apply scale
            if (currentViewport) {
                updateBrainViewport(currentViewport.x, currentViewport.y, currentViewport.width, currentViewport.height);
            }
        }
    }

    if (newParams.networkOpacity !== undefined) {
        if (connectionLines) {
            connectionLines.material.opacity = simulationParams.networkOpacity;
        }
    }

    if (newParams.signalOpacity !== undefined) {
        if (signalParticles) {
            signalParticles.material.opacity = simulationParams.signalOpacity;
        }
    }

    if (newParams.brainOpacity !== undefined) {
        if (brainGroup) {
            brainGroup.traverse((child) => {
                if (child.isMesh && child !== nodeParticles && child !== signalParticles && child !== connectionLines) {
                    child.material.opacity = simulationParams.brainOpacity;
                }
            });
        }
    }

    if (newParams.brainSize !== undefined) {
        // Update viewport to reflect new size if we are in Hero mode
        // We trigger an update which will use the new brainSize param
        if (currentViewport) {
            updateBrainViewport(currentViewport.x, currentViewport.y, currentViewport.width, currentViewport.height);
        }
    }
}


// Update the viewport and scissor based on the calculated rect from main.js
// Update the viewport and scissor based on the calculated rect from main.js
export function updateBrainViewport(x, y, width, height) {
    if (!renderer || !camera) return;

    currentViewport = { x, y, width, height };

    // Convert DOM coordinates (Top-Left) to WebGL coordinates (Bottom-Left)
    const glY = window.innerHeight - y - height;

    renderer.setViewport(x, glY, width, height);
    renderer.setScissor(x, glY, width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // --- MINI BRAIN SCALING ---
    // Calculate a scale factor based on viewport width relative to full screen width
    // When full screen (hero), scale is 1.0
    // When mini, width is small. We clamp it to a higher value to ensure it looks "decent sized" in the mini viewport.
    const scaleFactor = Math.max(width / window.innerWidth, 0.65); // Don't shrink below 65% of original size

    // Apply Brain Size Setting
    // We apply the user setting consistently to avoid stutter.
    // The base scale in initBrain is set to simulationParams.brainSize.
    // Here we just need to ensure we are scaling relative to the viewport factor.

    // Wait, if we set scale in initBrain, we shouldn't overwrite it blindly here unless we want to dynamic update.
    // The logic here was: finalScale = baseScale * userScale.
    // Let's simplify:
    // 1. Base scale is simulationParams.brainSize.
    // 2. We don't need to scale the object itself based on viewport width, because the camera/viewport handles the "shrinking" visual?
    // NO. If we shrink the viewport, the object looks BIGGER because the window into the world is smaller.
    // So we MUST scale the object down as the viewport shrinks to keep it "contained".

    // Scale factor is 1.0 at full screen, and ~0.15 at mini.
    // So we should multiply the User's Preferred Size by this Scale Factor.

    if (brainGroup) {
        const userSize = simulationParams.brainSize;
        // We want the brain to be 'userSize' when scaleFactor is 1.0.
        // And proportionally smaller when scaleFactor is small.

        const finalScale = userSize * scaleFactor;
        brainGroup.scale.set(finalScale, finalScale, finalScale);
    }

    if (nodeParticles) {
        // Base size 0.12 * scaleFactor
        // Use power to scale down more aggressively in mini mode to avoid clutter
        nodeParticles.material.size = 0.12 * Math.pow(scaleFactor, 1.5);
    }

    if (signalParticles) {
        // Base size 0.15 * userSetting * scaleFactor
        signalParticles.material.size = 0.15 * simulationParams.signalSize * Math.pow(scaleFactor, 1.5);
    }

    if (connectionLines) {
        // Line width is not easily scalable in WebGL without custom shaders or Line2
        // But we can adjust opacity to make it less intrusive when small if needed
        // Scale opacity with size to reduce visual density
        const baseOpacity = simulationParams.networkOpacity;
        // Fade out lines more in mini mode
        connectionLines.material.opacity = baseOpacity * Math.pow(scaleFactor, 2.0);
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
}

function onMouseDown(event) {
    mouseDownPos.set(event.clientX, event.clientY);
}

function onMouseUp(event) {
    const mouseUpPos = new THREE.Vector2(event.clientX, event.clientY);
    const distance = mouseDownPos.distanceTo(mouseUpPos);
    if (distance < 5) onClick(event);
}

function getNormalizedMouseCoordinates(clientX, clientY) {
    const x = ((clientX - currentViewport.x) / currentViewport.width) * 2 - 1;
    const y = -((clientY - currentViewport.y) / currentViewport.height) * 2 + 1;
    return { x, y };
}

function onClick(event) {
    if (document.body.classList.contains('brain-mode-mini')) return;
    if (event.clientX < currentViewport.x ||
        event.clientX > currentViewport.x + currentViewport.width ||
        event.clientY < currentViewport.y ||
        event.clientY > currentViewport.y + currentViewport.height) return;

    const coords = getNormalizedMouseCoordinates(event.clientX, event.clientY);
    mouse.x = coords.x;
    mouse.y = coords.y;

    raycaster.setFromCamera(mouse, camera);

    if (!brainGroup) return;

    // Recursively find all meshes in the brain group
    const candidates = [];
    brainGroup.traverse((object) => {
        if (object.isMesh && object !== nodeParticles && object !== signalParticles) {
            candidates.push(object);
        }
    });

    // Raycast against the found meshes
    const intersects = raycaster.intersectObjects(candidates, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        // console.log('Clicked Object:', object.name);
        const sectionId = brainSectionMap[object.name];

        if (sectionId) {
            scrollToSection(sectionId);
        }
    }
}

let hoveredObject = null;

function onMouseMove(event) {
    if (document.body.classList.contains('brain-mode-mini')) return;
    if (!brainGroup) return;

    if (event.clientX < currentViewport.x ||
        event.clientX > currentViewport.x + currentViewport.width ||
        event.clientY < currentViewport.y ||
        event.clientY > currentViewport.y + currentViewport.height) {
        if (hoveredObject) {
            hoveredObject.material.opacity = simulationParams.brainOpacity; // Reset to current setting
            hoveredObject = null;
            document.body.style.cursor = 'default';
        }
        return;
    }

    const coords = getNormalizedMouseCoordinates(event.clientX, event.clientY);
    mouse.x = coords.x;
    mouse.y = coords.y;

    raycaster.setFromCamera(mouse, camera);

    // Recursively find all meshes in the brain group
    const candidates = [];
    brainGroup.traverse((object) => {
        if (object.isMesh && object !== nodeParticles && object !== signalParticles && object !== connectionLines) {
            candidates.push(object);
        }
    });

    const intersects = raycaster.intersectObjects(candidates, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (hoveredObject !== object) {
            if (hoveredObject) hoveredObject.material.opacity = simulationParams.brainOpacity;
            hoveredObject = object;

            // Smart Hover Logic
            let hoverOpacity;
            if (simulationParams.brainOpacity < 0.5) {
                hoverOpacity = Math.min(simulationParams.brainOpacity + 0.3, 1.0);
            } else {
                hoverOpacity = Math.max(simulationParams.brainOpacity - 0.3, 0.1);
            }

            hoveredObject.material.opacity = hoverOpacity;
            document.body.style.cursor = 'pointer';

            // Highlight Label
            const sectionId = brainSectionMap[hoveredObject.name];
            if (sectionId) {
                const label = document.querySelector(`.brain-label[data-section="${sectionId}"]`);
                if (label) label.classList.add('active');
            }
        }
    } else {
        if (hoveredObject) {
            // Remove Highlight from Label
            const sectionId = brainSectionMap[hoveredObject.name];
            if (sectionId) {
                const label = document.querySelector(`.brain-label[data-section="${sectionId}"]`);
                if (label) label.classList.remove('active');
            }

            hoveredObject.material.opacity = simulationParams.brainOpacity;
            hoveredObject = null;
            document.body.style.cursor = 'default';
        }

        // EXTRA SAFETY: Ensure no labels are stuck in active state if we are not hovering anything
        document.querySelectorAll('.brain-label.active').forEach(el => el.classList.remove('active'));
    }
}

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function resetToHero() { }
export function onScrollToSection() { }

function animate() {
    requestAnimationFrame(animate);

    const delta = 0.016; // Approx 60fps

    // 1. Rotate Brain
    if (brainGroup) {
        brainGroup.rotation.y += simulationParams.rotationSpeedY * delta;
        brainGroup.rotation.x += simulationParams.rotationSpeedX * delta;
    }

    // 2. Update Signals
    if (signalParticles && nodes.length > 0) {
        const positions = signalParticles.geometry.attributes.position.array;
        let needsUpdate = false;

        // If signal count changed, we might have fewer signals than array size or vice versa
        // But we rebuild geometry on signal count change, so array size should match simulationParams.signalCount

        for (let i = 0; i < simulationParams.signalCount; i++) {
            const sig = signals[i];
            if (!sig) continue;

            // Move signal
            sig.progress += sig.speed * delta;

            if (sig.progress >= 1.0) {
                // Reached target node
                // Pick new target from neighbors
                const currentNodeIdx = sig.targetNodeIdx;
                const currentNode = nodes[currentNodeIdx];

                if (currentNode.neighbors.length > 0) {
                    // Continue journey
                    const nextNodeIdx = currentNode.neighbors[Math.floor(Math.random() * currentNode.neighbors.length)];
                    const nextNode = nodes[nextNodeIdx];

                    sig.pathStart = currentNode.position;
                    sig.pathEnd = nextNode.position;
                    sig.targetNodeIdx = nextNodeIdx;
                    sig.progress = 0;
                } else {
                    // Dead end, respawn
                    spawnSignal(i);
                }
            }

            // Interpolate position
            sig.currentPos.lerpVectors(sig.pathStart, sig.pathEnd, sig.progress);

            // Update visual attribute
            positions[i * 3] = sig.currentPos.x;
            positions[i * 3 + 1] = sig.currentPos.y;
            positions[i * 3 + 2] = sig.currentPos.z;

            needsUpdate = true;
        }

        if (needsUpdate) {
            signalParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    controls.update();
    controls.update();

    // Occlusion Logic for Labels
    if (brainGroup && labelObjects.length > 0) {
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir); // Vector pointing FROM camera TO target

        labelObjects.forEach(label => {
            // Get world position of the label
            const worldPos = new THREE.Vector3();
            label.getWorldPosition(worldPos);

            // Vector from Brain Center to Label
            // Brain center is at brainGroup.position (which is 0,0,0 in world usually, but let's be safe)
            const brainCenter = new THREE.Vector3();
            brainGroup.getWorldPosition(brainCenter);

            const labelDir = new THREE.Vector3().subVectors(worldPos, brainCenter).normalize();

            // Dot product with camera direction
            // Camera looks at 0,0,0. 
            // If label is on front, its normal points towards camera.
            // Camera direction points INTO the scene.
            // So if dot(labelDir, cameraDir) < 0, it's facing the camera.
            // Wait, let's use the vector from Camera to Label.

            // Simpler: Dot product of (Label Position - Brain Center) and (Camera Position - Brain Center)
            // Actually, just check if the label is closer to camera than the center? No.

            // Standard "Backface Culling" logic:
            // View Vector = CameraPos - LabelPos
            // Normal Vector = LabelPos - BrainCenter
            // if dot(View, Normal) > 0, it's visible.

            const viewVector = new THREE.Vector3().subVectors(camera.position, worldPos).normalize();
            const normalVector = new THREE.Vector3().subVectors(worldPos, brainCenter).normalize();

            const dot = viewVector.dot(normalVector);

            // If dot > 0.2, it's clearly visible.
            // If dot < 0, it's behind.
            // Let's fade it out smoothly.

            const div = label.element;
            if (dot > 0.2) {
                div.style.opacity = 0.5; // Default visible opacity
                div.style.transform = `scale(1)`;
                div.style.pointerEvents = 'auto'; // Enable hover
            } else if (dot > -0.1) {
                // Fade out zone
                const t = (dot + 0.1) / 0.3; // Map -0.1..0.2 to 0..1
                div.style.opacity = 0.5 * t;
                div.style.transform = `scale(${0.8 + 0.2 * t})`;
                div.style.pointerEvents = 'none'; // Disable hover when fading
            } else {
                div.style.opacity = 0;
                div.style.pointerEvents = 'none';
            }

            // If active (hovered), force full opacity if it's not completely hidden
            if (div.classList.contains('active') && dot > -0.1) {
                div.style.opacity = 1;
                div.style.transform = `scale(1.1)`;
            }
        });
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
