import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { config } from './config.js';

let scene, camera, renderer, controls;
let brainGroup, brainPivot;
let raycaster, mouse;
const container = document.getElementById('brain-hero-container');

// Current active section for mini-brain highlighting
let currentActiveSection = null;

// Simulation Data (Mutable, initialized from config)
let simulationParams = { ...config.simulation };

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
// Mapping from Mesh Names to Section IDs (for navigation on the shell)
const brainSectionMap = config.brainMapping.sections;

// Track mouse down for drag detection
let mouseDownPos = new THREE.Vector2();

export function initBrain() {
    // 1. Scene Setup
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(config.scene.cameraPosition.x, config.scene.cameraPosition.y, config.scene.cameraPosition.z);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setScissorTest(true);
    renderer.setScissorTest(true);
    container.appendChild(renderer.domElement);



    // 4. Lights
    const ambientLight = new THREE.HemisphereLight(0x00ffff, 0x000033, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    // 5. Controls (Manual Rotation)
    // We removed OrbitControls to allow off-center positioning without "swinging"
    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.05;
    // controls.enableZoom = false;
    // controls.enablePan = false;
    // controls.autoRotate = false; // We handle rotation manually now
    // controls.autoRotateSpeed = 0.5;

    // 6. Load Model & Generate Network
    const loader = new GLTFLoader();

    loader.load('assets/brain_areas.glb', (gltf) => {
        brainGroup = gltf.scene;

        // Create a Pivot Group to handle rotation and positioning cleanly
        // This ensures the brain always rotates around its visual center
        brainPivot = new THREE.Group();
        scene.add(brainPivot);
        brainPivot.add(brainGroup);

        // Center BrainGroup relative to Pivot
        const box = new THREE.Box3().setFromObject(brainGroup);
        const center = box.getCenter(new THREE.Vector3());
        brainGroup.position.sub(center); // Visual center is now at Pivot (0,0,0)

        // Initial scale based on params
        const initialScale = simulationParams.brainSize;
        brainGroup.scale.set(initialScale, initialScale, initialScale);

        // Position the Pivot (From Config)
        brainPivot.position.set(config.scene.brainPivotPosition.x, config.scene.brainPivotPosition.y, config.scene.brainPivotPosition.z);

        // Set initial rotation on the Pivot
        brainPivot.rotation.y = config.scene.initialRotationY;

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
        // scene.add(brainGroup); // Removed, added to pivot instead

        // 6b. Generate Neural Network
        generateNeuralNetwork(brainGroup);

        animate();
    }, undefined, (error) => {
        console.error('An error happened loading the brain model:', error);
    });

    // 7. Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Event Listeners
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mouseup', onMouseUp, false);

    // Clear hover when mouse leaves the window/document
    document.addEventListener('mouseleave', () => {
        if (hoveredObject) {
            hoveredObject.material.opacity = simulationParams.brainOpacity;
            hoveredObject.material.emissive = new THREE.Color(0x000000);
            hoveredObject.material.emissiveIntensity = 0;

            const event = new CustomEvent('brain-region-hover', {
                detail: { regionName: hoveredObject.name, active: false }
            });
            window.dispatchEvent(event);

            hoveredObject = null;
            document.body.style.cursor = 'default';
        }
        isDragging = false; // Also stop dragging
    });

    window.addEventListener('resize', onWindowResize, false);
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

    // Calculate total surface area to distribute nodes evenly
    let totalArea = 0;
    const meshAreas = [];

    // Helper variables for area calculation
    const _p1 = new THREE.Vector3();
    const _p2 = new THREE.Vector3();
    const _p3 = new THREE.Vector3();
    const _edge1 = new THREE.Vector3();
    const _edge2 = new THREE.Vector3();
    const _cross = new THREE.Vector3();

    samplerMeshes.forEach(mesh => {
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        const index = geometry.index;
        let area = 0;

        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                _p1.fromBufferAttribute(position, index.getX(i));
                _p2.fromBufferAttribute(position, index.getX(i + 1));
                _p3.fromBufferAttribute(position, index.getX(i + 2));
                _edge1.subVectors(_p2, _p1);
                _edge2.subVectors(_p3, _p1);
                _cross.crossVectors(_edge1, _edge2);
                area += 0.5 * _cross.length();
            }
        } else {
            for (let i = 0; i < position.count; i += 3) {
                _p1.fromBufferAttribute(position, i);
                _p2.fromBufferAttribute(position, i + 1);
                _p3.fromBufferAttribute(position, i + 2);
                _edge1.subVectors(_p2, _p1);
                _edge2.subVectors(_p3, _p1);
                _cross.crossVectors(_edge1, _edge2);
                area += 0.5 * _cross.length();
            }
        }

        // Account for scale if necessary (assuming uniform scale for now as they are parts of same GLB)
        // area *= mesh.scale.x * mesh.scale.y; 

        meshAreas.push(area);
        totalArea += area;
    });

    const minDistance = simulationParams.minNodeDistance !== undefined ? simulationParams.minNodeDistance : 0.15; // Minimum distance between nodes to prevent clustering
    const maxAttempts = 30;   // Max attempts to find a valid position

    samplerMeshes.forEach((mesh, index) => {
        const sampler = new MeshSurfaceSampler(mesh).build();

        // Calculate weighted count based on area
        // Use Math.max(1, ...) to ensure at least one node if it's a tiny part, 
        // or just let it be 0 if it's really small. Let's stick to proportional.
        let countForMesh = Math.round(simulationParams.nodeCount * (meshAreas[index] / totalArea));

        for (let i = 0; i < countForMesh; i++) {
            let validPosition = false;
            let attempts = 0;

            // Try to find a position that isn't too close to existing nodes
            while (!validPosition && attempts < maxAttempts) {
                sampler.sample(tempPosition);
                validPosition = true;

                // Check distance to all previously generated nodes
                for (const node of nodes) {
                    if (tempPosition.distanceTo(node.position) < minDistance) {
                        validPosition = false;
                        break;
                    }
                }
                attempts++;
            }

            // If we couldn't find a valid position after maxAttempts, 
            // we accept the last sampled one (in tempPosition) to ensure we meet the node count.

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

// Update mini-brain highlighting based on active section
export function updateActiveSectionHighlight(sectionId) {
    if (!brainGroup) return;
    currentActiveSection = sectionId;

    // Only apply highlighting in mini mode
    if (!document.body.classList.contains('brain-mode-mini')) {
        // Reset all highlights when not in mini mode
        resetAllBrainHighlights();
        return;
    }

    // Clear all highlights first to ensure only one region is highlighted
    brainGroup.traverse((child) => {
        if (child.isMesh && child !== nodeParticles && child !== signalParticles && child !== connectionLines) {
            child.material.opacity = simulationParams.brainOpacity;
            child.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
        }
    });

    // Only highlight if we have a valid sectionId
    if (!sectionId) return;

    // Now highlight only the active section
    brainGroup.traverse((child) => {
        if (child.isMesh && child !== nodeParticles && child !== signalParticles && child !== connectionLines) {
            const meshSectionId = brainSectionMap[child.name];

            if (meshSectionId === sectionId) {
                // Highlight the active section with its specific color
                let highlightColor = config.brainMapping.colors.default;

                // Determine color based on section ID
                if (sectionId === 'section-projects') highlightColor = config.brainMapping.colors.projects;
                else if (sectionId === 'section-experience') highlightColor = config.brainMapping.colors.experience;
                else if (sectionId === 'section-skills-labs') highlightColor = config.brainMapping.colors.skills;
                else if (sectionId === 'section-profile') highlightColor = config.brainMapping.colors.profile;

                child.material.opacity = Math.min(simulationParams.brainOpacity + 0.35, 0.8);
                child.material.color = new THREE.Color(highlightColor); // Set base color
                child.material.emissive = new THREE.Color(highlightColor);
                child.material.emissiveIntensity = 0.4; // Increased intensity
            }
        }
    });
}

// Reset all brain region highlights to base state
function resetAllBrainHighlights() {
    if (!brainGroup) return;

    brainGroup.traverse((child) => {
        if (child.isMesh && child !== nodeParticles && child !== signalParticles && child !== connectionLines) {
            child.material.opacity = simulationParams.brainOpacity;
            child.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
        }
    });
}

// Highlight ALL brain regions (for mini-brain hover)
function highlightAllBrainRegions(enable) {
    if (!brainGroup) return;

    if (enable) {
        brainGroup.traverse((child) => {
            if (child.isMesh && child !== nodeParticles && child !== signalParticles && child !== connectionLines) {
                child.material.opacity = Math.min(simulationParams.brainOpacity + 0.35, 0.8);
                // Use default white color for whole brain highlight
                child.material.color = new THREE.Color(config.brainMapping.colors.default);
                child.material.emissive = new THREE.Color(config.brainMapping.colors.default);
                child.material.emissiveIntensity = 0.3;
            }
        });
    } else {
        // Revert to active section state
        updateActiveSectionHighlight(currentActiveSection);
    }
}

// Highlight brain region based on menu hover
export function highlightBrainRegion(brainRegionName, highlighted) {
    if (!brainGroup) return;
    if (document.body.classList.contains('brain-mode-mini')) return; // Don't allow hover in mini mode

    brainGroup.traverse((child) => {
        if (child.isMesh && child.name === brainRegionName) {
            // Only highlight if mapped
            if (!brainSectionMap[child.name]) return;

            if (highlighted) {
                // Smart Hover Logic
                let hoverOpacity;
                if (simulationParams.brainOpacity < 0.5) {
                    hoverOpacity = Math.min(simulationParams.brainOpacity + 0.3, 1.0);
                } else {
                    hoverOpacity = Math.max(simulationParams.brainOpacity - 0.3, 0.1);
                }
                child.material.opacity = hoverOpacity;

                // Set emissive color based on section
                const sectionId = brainSectionMap[child.name];
                let highlightColor = config.brainMapping.colors.default;
                if (sectionId === 'section-projects') highlightColor = config.brainMapping.colors.projects;
                else if (sectionId === 'section-experience') highlightColor = config.brainMapping.colors.experience;
                else if (sectionId === 'section-skills-labs') highlightColor = config.brainMapping.colors.skills;
                else if (sectionId === 'section-profile') highlightColor = config.brainMapping.colors.profile;

                child.material.color = new THREE.Color(highlightColor); // Set base color
                child.material.emissive = new THREE.Color(highlightColor);
                child.material.emissiveIntensity = 0.4; // Increased intensity

            } else {
                // Reset to base state
                child.material.opacity = simulationParams.brainOpacity;
                child.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
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
    if (newParams.nodeCount !== undefined || newParams.minNodeDistance !== undefined || newParams.connectionDistance !== undefined || newParams.signalCount !== undefined) {
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
}

// Manual Rotation State
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
const friction = 0.95;

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    mouseDownPos.set(event.clientX, event.clientY);
}

function onMouseUp(event) {
    isDragging = false;
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
            // Dispatch event for main.js to handle UI effects (menu ping)
            const event = new CustomEvent('brain-section-clicked', {
                detail: { sectionId: sectionId }
            });
            window.dispatchEvent(event);

            // Delay scroll to allow animation to complete
            setTimeout(() => {
                scrollToSection(sectionId);
            }, config.interaction.scrollDelay);
        }
    }
}

let hoveredObject = null;
let isHoveringMiniBrain = false;

function onMouseMove(event) {
    if (document.body.classList.contains('brain-mode-mini')) {
        // Check if mouse is over the mini brain viewport
        if (event.clientX >= currentViewport.x &&
            event.clientX <= currentViewport.x + currentViewport.width &&
            event.clientY >= currentViewport.y &&
            event.clientY <= currentViewport.y + currentViewport.height) {

            if (!isHoveringMiniBrain) {
                isHoveringMiniBrain = true;
                document.body.style.cursor = 'pointer';
                highlightAllBrainRegions(true);
            }
        } else {
            if (isHoveringMiniBrain) {
                isHoveringMiniBrain = false;
                document.body.style.cursor = 'default';
                highlightAllBrainRegions(false);
            }
        }
        return;
    }

    // Handle Drag Rotation
    if (isDragging && brainPivot) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        // Rotate the pivot
        const rotationSpeed = 0.005;
        brainPivot.rotation.y += deltaMove.x * rotationSpeed;
        brainPivot.rotation.x += deltaMove.y * rotationSpeed;

        // Update velocity for inertia
        rotationVelocity = {
            x: deltaMove.x * rotationSpeed,
            y: deltaMove.y * rotationSpeed
        };

        previousMousePosition = { x: event.clientX, y: event.clientY };

        // Don't do hover effects while dragging
        return;
    }

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
            if (hoveredObject) {
                hoveredObject.material.opacity = simulationParams.brainOpacity;
                hoveredObject.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
                hoveredObject.material.emissive = new THREE.Color(0x000000);
                hoveredObject.material.emissiveIntensity = 0;
            }
            hoveredObject = object;

            // Smart Hover Logic - MATCHING setBrainRegionHighlight
            // Use the same visual style as menu hover

            // Determine color based on section ID
            const sectionId = brainSectionMap[hoveredObject.name];
            let highlightColor = config.brainMapping.colors.default;
            if (sectionId === 'section-projects') highlightColor = config.brainMapping.colors.projects;
            else if (sectionId === 'section-experience') highlightColor = config.brainMapping.colors.experience;
            else if (sectionId === 'section-skills-labs') highlightColor = config.brainMapping.colors.skills;
            else if (sectionId === 'section-profile') highlightColor = config.brainMapping.colors.profile;

            hoveredObject.material.opacity = Math.min(simulationParams.brainOpacity + 0.3, 0.8);
            hoveredObject.material.color = new THREE.Color(highlightColor);
            hoveredObject.material.emissive = new THREE.Color(highlightColor);
            hoveredObject.material.emissiveIntensity = 0.4;

            document.body.style.cursor = 'pointer';

            // Clear all menu highlights first, then highlight the current one
            document.querySelectorAll('.brain-nav-item.active').forEach(el => el.classList.remove('active'));

            const mappedSectionId = brainSectionMap[hoveredObject.name];
            if (mappedSectionId) {
                const menuItem = document.querySelector(`.brain-nav-item[data-section="${mappedSectionId}"]`);
                if (menuItem) {
                    menuItem.classList.add('active');
                    // Trigger connector line from main.js logic?
                    // We need a way to call showConnector from here, OR expose a callback.
                    // Since main.js imports brain-hero.js, we can't easily circular dependency call back.
                    // Better to dispatch a custom event that main.js listens to.
                    const event = new CustomEvent('brain-region-hover', {
                        detail: { regionName: hoveredObject.name, menuItem: menuItem, active: true }
                    });
                    window.dispatchEvent(event);
                }
            }
        }
    } else {
        if (hoveredObject) {
            // Reset to base state
            hoveredObject.material.opacity = simulationParams.brainOpacity;
            hoveredObject.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
            hoveredObject.material.emissive = new THREE.Color(0x000000);
            hoveredObject.material.emissiveIntensity = 0;

            // Dispatch event to hide connector
            const event = new CustomEvent('brain-region-hover', {
                detail: { regionName: hoveredObject.name, active: false }
            });
            window.dispatchEvent(event);

            hoveredObject = null;
            document.body.style.cursor = 'default';
        }

        // Clear all menu highlights when not hovering any brain region
        // ONLY if we are not hovering the menu itself (which is handled by CSS/JS elsewhere)
        // Actually, for simplicity, let's clear active state if it was set by brain hover
        // But we need to distinguish between "hovered by mouse on menu" and "hovered by mouse on brain"
        // For now, let's just clear it. The menu hover listeners will re-apply if needed.
        document.querySelectorAll('.brain-nav-item.active').forEach(el => el.classList.remove('active'));
    }
}

export function setBrainRegionHighlight(regionName, active) {
    if (!brainGroup) return;
    if (document.body.classList.contains('brain-mode-mini')) return;

    brainGroup.traverse((child) => {
        if (child.isMesh && child.name === regionName) {
            // Only highlight if this region is mapped in our config
            if (!brainSectionMap[child.name]) return;

            if (active) {
                // Determine color based on section ID
                const sectionId = brainSectionMap[child.name];
                let highlightColor = config.brainMapping.colors.default;
                if (sectionId === 'section-projects') highlightColor = config.brainMapping.colors.projects;
                else if (sectionId === 'section-experience') highlightColor = config.brainMapping.colors.experience;
                else if (sectionId === 'section-skills-labs') highlightColor = config.brainMapping.colors.skills;
                else if (sectionId === 'section-profile') highlightColor = config.brainMapping.colors.profile;

                // Glow effect
                child.material.opacity = Math.min(simulationParams.brainOpacity + 0.3, 0.8);
                child.material.color = new THREE.Color(highlightColor);
                child.material.emissive = new THREE.Color(highlightColor);
                child.material.emissiveIntensity = 0.4;
            } else {
                // Reset
                child.material.opacity = simulationParams.brainOpacity;
                child.material.color = new THREE.Color(0x00ffff); // Reset to default cyan
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        }
    });
}

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function resetToHero() { }
export function onScrollToSection() { }

// Get 2D screen coordinates for a brain region
export function getBrainRegionScreenPosition(regionName) {
    if (!brainGroup || !camera || !renderer) return null;

    let targetMesh = null;
    brainGroup.traverse((child) => {
        if (child.isMesh && child.name === regionName) {
            targetMesh = child;
        }
    });

    if (!targetMesh) return null;

    // Get center of the mesh in world coordinates
    // We can use the bounding box center
    if (!targetMesh.geometry.boundingBox) targetMesh.geometry.computeBoundingBox();

    const center = new THREE.Vector3();
    targetMesh.geometry.boundingBox.getCenter(center);

    // Apply object transformations to get world position
    targetMesh.localToWorld(center);

    // Project to screen coordinates
    center.project(camera);

    // Convert to CSS coordinates
    // Note: We need to account for the viewport offset if using setViewport/setScissor
    // But project() gives us NDC (-1 to +1) relative to the camera's view.
    // Since we use setViewport, the camera sees the "whole" canvas as its frustum?
    // No, setViewport maps NDC to window coordinates.
    // So we need to map NDC to the CURRENT VIEWPORT rect.

    const x = (center.x * 0.5 + 0.5) * currentViewport.width + currentViewport.x;
    const y = (-(center.y * 0.5) + 0.5) * currentViewport.height + currentViewport.y; // Flip Y for CSS

    return { x, y };
}

function animate() {
    requestAnimationFrame(animate);

    const delta = 0.016; // Approx 60fps

    // 1. Rotate Brain (Rotate the Pivot to keep axis centered)
    if (brainPivot) {
        brainPivot.rotation.y += simulationParams.rotationSpeedY * delta;
        brainPivot.rotation.x += simulationParams.rotationSpeedX * delta;

        // Apply inertia when not dragging
        if (!isDragging) {
            brainPivot.rotation.y += rotationVelocity.x;
            brainPivot.rotation.x += rotationVelocity.y;

            // Apply friction
            rotationVelocity.x *= friction;
            rotationVelocity.y *= friction;
        }
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

    // controls.update();

    // controls.update(); // Removed manual controls

    renderer.render(scene, camera);
}
