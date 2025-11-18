import { appConfig } from './config.mjs';
import { appState } from './state/app-state.mjs';
import { dom } from './utils/dom-utils.mjs';
import { setLoading, showMessage, proceedFromModal } from './utils/ui-utils.mjs';
import { closeFeedbackModal } from './admin-dashboard/feedback-modal.mjs';
import { initializeWebSocket } from './services/websocket-service.mjs';
import { updateNavBar, navigateTo } from './ui/navigation.mjs';
import { setupHomeTabs, attachHomeCardListeners } from './ui/home.mjs';
import { templateConfig } from './ui/template-creation/template-config.mjs';
import { handleLogin, handleRegister, handleContactSubmit, handlePasswordResetRequest, handlePasswordUpdate } from './services/auth-service.mjs';
import { fetchAndDisplayStatistics } from './admin-dashboard/admin-dashboard.mjs';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize WebSocket connection
    initializeWebSocket();

    // --- Session Management ---
    appConfig.supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN") {
            appState.userLoggedIn = true;
            appState.currentUser = session.user;

            // Check if this SIGNED_IN event was from an email confirmation hash
            const hash = window.location.hash;
            if (hash.includes("type=signup") && hash.includes("access_token")) {
                // This was a new signup confirmation.
                // Clear the messy token from the URL bar
                window.history.replaceState(null, null, ' ');
                // Navigate to the home page (which will happen anyway)
                navigateTo("home");
            } else if (hash.includes("type=recovery") && hash.includes("access_token")) {
                // This was a password recovery.
                 // Clear the hash from the URL bar
                window.history.replaceState(null, null, ' ');
                // TODO: You could navigate to a "change password" page here
                // For now, we'll just send them to the home page, logged in.
                navigateTo("home");
            }

        } else if (event === "SIGNED_OUT") {
            appState.userLoggedIn = false;
            appState.currentUser = null;
        }
        updateNavBar();
    });

    // Global click handler to close modal when clicking outside
    document.addEventListener('click', (e) => {
        const modal = dom.$("feedbackDetailModal");
        if (modal && e.target === modal) {
            closeFeedbackModal();
        }
    });

    // Global escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = dom.$("feedbackDetailModal");
            if (modal && modal.style.display === 'flex') {
                closeFeedbackModal();
            }
        }
    });

    // --- Admin Dashboard Stats Logic ---
    const refreshStatsBtn = dom.$("refreshStatsBtn");
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener("click", fetchAndDisplayStatistics);
    }

    // --- Optimized Three.js Animation Logic ---
    let scene, camera, renderer, group;
    const particlesData = [];
    let particlesGeometry;
    let pointCloud;
    let particlePositions;
    let linesMesh;
    let animationFrameId;

    // Reduced particle count for better performance
    const NUM_PARTICLES = 500; // Reduced from 1000
    const AREA_SIZE = 3000;
    const AREA_HALF = AREA_SIZE / 2;
    const MIN_DISTANCE = 200;
    const MIN_DIST_SQ = MIN_DISTANCE * MIN_DISTANCE;
    const MAX_CONNECTIONS_PER_PARTICLE = 5; // Limit connections per particle

    // Spatial partitioning grid
    const GRID_SIZE = MIN_DISTANCE * 1.5;
    let spatialGrid = {};

    // Update connections every N frames for better performance
    const CONNECTION_UPDATE_INTERVAL = 2;
    let frameCounter = 0;

    let mouseX = 0, mouseY = 0;

    // Pre-allocate line buffers with reasonable size
    const MAX_LINES = NUM_PARTICLES * MAX_CONNECTIONS_PER_PARTICLE;
    let linePositions = new Float32Array(MAX_LINES * 6); // 2 vertices * 3 coords
    let lineColors = new Float32Array(MAX_LINES * 6); // 2 vertices * 3 colors

    function createCircleTexture(size, color) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.fill();
        return new THREE.CanvasTexture(canvas);
    }

    // Spatial grid functions for O(n) neighbor lookups
    function getGridKey(x, y, z) {
        const gx = Math.floor((x + AREA_HALF) / GRID_SIZE);
        const gy = Math.floor((y + AREA_HALF) / GRID_SIZE);
        const gz = Math.floor((z + AREA_HALF) / GRID_SIZE);
        return `${gx},${gy},${gz}`;
    }

    function updateSpatialGrid() {
        spatialGrid = {};
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const x = particlePositions[i * 3];
            const y = particlePositions[i * 3 + 1];
            const z = particlePositions[i * 3 + 2];
            const key = getGridKey(x, y, z);
            
            if (!spatialGrid[key]) {
                spatialGrid[key] = [];
            }
            spatialGrid[key].push(i);
        }
    }

    function getNearbyParticles(particleIndex) {
        const x = particlePositions[particleIndex * 3];
        const y = particlePositions[particleIndex * 3 + 1];
        const z = particlePositions[particleIndex * 3 + 2];
        
        const gx = Math.floor((x + AREA_HALF) / GRID_SIZE);
        const gy = Math.floor((y + AREA_HALF) / GRID_SIZE);
        const gz = Math.floor((z + AREA_HALF) / GRID_SIZE);
        
        const nearby = [];
        
        // Check neighboring grid cells (3x3x3 cube around particle)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const key = `${gx + dx},${gy + dy},${gz + dz}`;
                    if (spatialGrid[key]) {
                        nearby.push(...spatialGrid[key]);
                    }
                }
            }
        }
        
        return nearby;
    }

    function initThreeJS() {
        const canvas = dom.$("threeJsCanvas");
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
        camera.position.z = 3000;

        scene = new THREE.Scene();
        group = new THREE.Group();
        scene.add(group);

        const particleTexture = createCircleTexture(64, "rgba(173, 216, 230, 1)");

        const pMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 7,
            blending: THREE.AdditiveBlending,
            transparent: true,
            sizeAttenuation: false,
            map: particleTexture
        });

        particlesGeometry = new THREE.BufferGeometry();
        particlePositions = new Float32Array(NUM_PARTICLES * 3);

        // Initialize particles
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const x = Math.random() * AREA_SIZE - AREA_HALF;
            const y = Math.random() * AREA_SIZE - AREA_HALF;
            const z = Math.random() * AREA_SIZE - AREA_HALF;

            particlePositions[i * 3] = x;
            particlePositions[i * 3 + 1] = y;
            particlePositions[i * 3 + 2] = z;

            particlesData.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                numConnections: 0
            });
        }

        particlesGeometry.setDrawRange(0, NUM_PARTICLES);
        particlesGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage)
        );

        pointCloud = new THREE.Points(particlesGeometry, pMaterial);
        group.add(pointCloud);

        // Optimized line geometry with smaller buffers
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
        lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
        lineGeometry.computeBoundingSphere();
        lineGeometry.setDrawRange(0, 0);

        const lineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.4
        });

        linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        group.add(linesMesh);

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Build initial spatial grid
        updateSpatialGrid();
        
        startAnimationLoop();

        window.addEventListener("resize", onWindowResize);
        window.addEventListener("mousemove", onDocumentMouseMove);
    }

    function startAnimationLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        function loop() {
            animateThreeJS();
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }

    function onDocumentMouseMove(event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function animateThreeJS() {
        // Update particle positions
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const particleData = particlesData[i];
            particlePositions[i * 3] += particleData.velocity.x;
            particlePositions[i * 3 + 1] += particleData.velocity.y;
            particlePositions[i * 3 + 2] += particleData.velocity.z;

            // Boundary checking with velocity reversal
            if (particlePositions[i * 3 + 1] < -AREA_HALF || particlePositions[i * 3 + 1] > AREA_HALF)
                particleData.velocity.y = -particleData.velocity.y;
            if (particlePositions[i * 3] < -AREA_HALF || particlePositions[i * 3] > AREA_HALF)
                particleData.velocity.x = -particleData.velocity.x;
            if (particlePositions[i * 3 + 2] < -AREA_HALF || particlePositions[i * 3 + 2] > AREA_HALF)
                particleData.velocity.z = -particleData.velocity.z;
        }

        // Update connections only every N frames
        frameCounter++;
        if (frameCounter >= CONNECTION_UPDATE_INTERVAL) {
            frameCounter = 0;
            updateConnections();
        }

        // Always update particle positions for smooth movement
        pointCloud.geometry.attributes.position.needsUpdate = true;

        // Smooth rotation with mouse interaction
        const rotationSpeed = 0.03;
        group.rotation.y += (mouseX * 0.05 - group.rotation.y) * rotationSpeed;
        group.rotation.x += (mouseY * 0.05 - group.rotation.x) * rotationSpeed;
        group.rotation.y += 0.0001;
        group.rotation.x += 0.00005;

        renderer.render(scene, camera);
    }

    function updateConnections() {
        // Rebuild spatial grid
        updateSpatialGrid();
        
        let vertexpos = 0;
        let colorpos = 0;
        let numConnected = 0;
        
        // Reset connection counts
        for (let i = 0; i < NUM_PARTICLES; i++) {
            particlesData[i].numConnections = 0;
        }

        const processedPairs = new Set();
        
        // Use spatial partitioning for O(n) performance
        for (let i = 0; i < NUM_PARTICLES; i++) {
            if (particlesData[i].numConnections >= MAX_CONNECTIONS_PER_PARTICLE) continue;
            
            const nearbyIndices = getNearbyParticles(i);
            
            for (const j of nearbyIndices) {
                if (j <= i) continue; // Skip self and already processed pairs
                if (particlesData[j].numConnections >= MAX_CONNECTIONS_PER_PARTICLE) continue;
                
                // Create unique pair key
                const pairKey = `${i}-${j}`;
                if (processedPairs.has(pairKey)) continue;
                
                const dx = particlePositions[i * 3] - particlePositions[j * 3];
                const dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
                const dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
                
                // 1. Calculate squared distance (fast)
                const distSq = dx * dx + dy * dy + dz * dz;

                // 2. Check against the pre-calculated squared constant
                if (distSq < MIN_DIST_SQ) { 
                    // 3. Only call Math.sqrt() after we know we need it
                    const dist = Math.sqrt(distSq);
                    const alpha = 1.0 - dist / MIN_DISTANCE;
                    
                    linePositions[vertexpos++] = particlePositions[i * 3];
                    linePositions[vertexpos++] = particlePositions[i * 3 + 1];
                    linePositions[vertexpos++] = particlePositions[i * 3 + 2];
                    linePositions[vertexpos++] = particlePositions[j * 3];
                    linePositions[vertexpos++] = particlePositions[j * 3 + 1];
                    linePositions[vertexpos++] = particlePositions[j * 3 + 2];

                    const lineColor = new THREE.Color(0xadd8e6);
                    lineColors[colorpos++] = lineColor.r * alpha;
                    lineColors[colorpos++] = lineColor.g * alpha;
                    lineColors[colorpos++] = lineColor.b * alpha;
                    lineColors[colorpos++] = lineColor.r * alpha;
                    lineColors[colorpos++] = lineColor.g * alpha;
                    lineColors[colorpos++] = lineColor.b * alpha;
                    
                    numConnected++;
                    particlesData[i].numConnections++;
                    particlesData[j].numConnections++;
                    processedPairs.add(pairKey);
                    
                    // Stop if we've hit buffer limits
                    if (numConnected >= MAX_LINES) break;
                }
            }
            
            if (numConnected >= MAX_LINES) break;
        }

        linesMesh.geometry.setDrawRange(0, numConnected * 2);
        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --- AI Analysis Examples Carousel Logic ---
    let currentExampleIndex = 0;
    const analysisExamples = document.querySelectorAll(".analysis-example-item");
    const prevExampleBtn = dom.$("prevExampleBtn");
    const nextExampleBtn = dom.$("nextExampleBtn");
    const exampleCounter = dom.$("exampleCounter");

    function showAnalysisExample(index) {
        analysisExamples.forEach((item, i) => {
            item.classList.toggle("hidden", i !== index);
        });
        prevExampleBtn.disabled = index === 0;
        nextExampleBtn.disabled = index === analysisExamples.length - 1;
        exampleCounter.textContent = `${index + 1} of ${analysisExamples.length}`;
    }

    if (prevExampleBtn) {
        prevExampleBtn.addEventListener("click", () => {
            if (currentExampleIndex > 0) {
                currentExampleIndex--;
                showAnalysisExample(currentExampleIndex);
            }
        });
    }
    if (nextExampleBtn) {
        nextExampleBtn.addEventListener("click", () => {
            if (currentExampleIndex < analysisExamples.length - 1) {
                currentExampleIndex++;
                showAnalysisExample(currentExampleIndex);
            }
        });
    }
    if (analysisExamples.length > 0) {
        showAnalysisExample(currentExampleIndex);
    }

    // --- Initial Setup ---
    const versionModal = dom.$("versionChoiceModal");
    const selectFreeBtn = dom.$("selectFreeVersion");
    const selectPaidBtn = dom.$("selectPaidVersion");
    const closeModalBtn = dom.$("closeModalBtn");

    selectFreeBtn.addEventListener("click", () => {
        appState.currentSelectionLimit = 1;
        proceedFromModal();
    });

    selectPaidBtn.addEventListener("click", () => {
        appState.currentSelectionLimit = 3;
        proceedFromModal();
    });

    closeModalBtn.addEventListener("click", () => {
        versionModal.classList.remove('modal-open'); // Start fade-out
        setTimeout(() => versionModal.style.display = 'none', 300); // Hide after animation
    });


    // --- NEW FEEDBACK PAGE LOGIC (CALLING EDGE FUNCTION) ---

    // 1. Populate the tool dropdown
    const feedbackToolSelect = dom.$("feedbackToolName");
    if (feedbackToolSelect) {
        for (const templateId in templateConfig.templates) {
            if (templateConfig.templates.hasOwnProperty(templateId)) {
                const title = templateConfig.templates[templateId].title;
                feedbackToolSelect.add(new Option(title, templateId));
            }
        }
    }

    // 2. Add the submit button listener
    const submitFeedbackPageBtn = dom.$("submitFeedbackPageBtn");
    if (submitFeedbackPageBtn) {
        submitFeedbackPageBtn.addEventListener("click", async () => { 
            
            const tool_name = dom.$("feedbackToolName").value;
            const reason = dom.$("feedbackReason").value;
            const content = dom.$("feedbackTextPage").value.trim();
            const ratingInput = document.querySelector('input[name="feedbackRating"]:checked');
            
            const rating = ratingInput ? (ratingInput.value === "0" ? null : parseInt(ratingInput.value)) : null;

            if (!appState.currentUser) {
                showMessage("feedbackMessagePage", "You must be logged in to submit feedback.", "error");
                return;
            }
            if (!reason) {
                showMessage("feedbackMessagePage", "Please select a reason.", "error");
                return;
            }
            if (content.length <= 10) { 
                showMessage("feedbackMessagePage", "Please enter at least 10 characters in the details box.", "error");
                return;
            }

            setLoading("submitFeedbackPage", true);
            
            try {
                const feedbackObject = {
                    tool_name: tool_name,
                    reason: reason,
                    content: content,
                    rating: rating 
                };
                
                const { data, error: invokeError } = await appConfig.supabase.functions.invoke(
                    'insert-feedback', 
                     { body: feedbackObject }
                );

                if (invokeError) {
                    throw invokeError; 
                }

                // --- Success ---
                setLoading("submitFeedbackPage", false);
                showMessage("feedbackMessagePage", "Thank you! Your feedback has been received.", "success");
                
                // --- MODIFIED BLOCK: Always go to home ---
                setTimeout(() => {
                     console.log(`---> Feedback success. Navigating to "home".`);
                     navigateTo("home"); 
                }, 2000);

            } catch (error) {
                // --- Error Handling ---
                console.error("Feedback submission error:", error);
                setLoading("submitFeedbackPage", false);
                showMessage("feedbackMessagePage", `Error: ${error.message || 'An unknown error occurred.'}`, "error");
            }
        });
    }
    // --- END OF NEW FEEDBACK PAGE LOGIC ---


    dom.$("loginBtn").addEventListener("click", handleLogin);
    dom.$("registerBtn").addEventListener("click", handleRegister);

    // --- NEW Initial Page Load Logic (Updated for Password Reset) ---
    (async () => {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const isSuccess = urlParams.get('success') === 'true';
        const isAlready = urlParams.get('already') === 'true';
        
        // NEW: Check for password reset parameters
        const resetToken = urlParams.get('token');
        const resetEmail = urlParams.get('email');
        
        // --- HASH CHECK ---
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1)); // remove #
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        // Clear URL parameters or hash
        if (isSuccess || isAlready || accessToken || resetToken) {
            window.history.replaceState(null, null, window.location.pathname);
        }
        
        // --- NAVIGATION LOGIC ---
        if (resetToken && resetEmail) {
            // NEW: Handle password reset
            console.log('Password reset link detected, navigating to reset form');
            navigateTo("passwordResetUpdate");
            // Store token and email for the reset form to use
            window.resetToken = resetToken;
            window.resetEmail = decodeURIComponent(resetEmail);
            console.log('Stored reset token and email for form');
        } else if (isSuccess) {
            // From our custom email-verify function
            navigateTo("emailVerifiedSuccess");
        } else if (isAlready) {
            // From our custom email-verify function
            navigateTo("emailVerifiedAlready");
        } else if (accessToken && type === 'recovery') {
            // From Supabase password reset link (legacy)
            // The supabase client will auto-set the session from the token.
            navigateTo("passwordResetUpdate");
        } else if (accessToken) {
            // From any other Supabase magic link (like login or old verify)
            // The onAuthStateChange listener will catch this
            navigateTo("home");
        } else {
            // Default load for a new visitor
            navigateTo("home");
        }
        
        // Attach the Contact Submit Handler
        const contactSubmitBtn = dom.$("contactSubmitBtn");
        if (contactSubmitBtn) {
            contactSubmitBtn.addEventListener("click", handleContactSubmit);
        }
        
        // Hero Canvas Animation

        function initHeroAnimation() {
            const canvas = document.getElementById('heroCanvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const particles = [];
            const particleCount = 50;
        
            class Particle {
                constructor() {
                    this.x = Math.random() * canvas.width;
                    this.y = Math.random() * canvas.height;
                    this.vx = (Math.random() - 0.5) * 2;
                    this.vy = (Math.random() - 0.5) * 2;
                    this.radius = Math.random() * 3 + 1;
                    this.color = `hsl(${Math.random() * 60 + 240}, 70%, 60%)`;
                }

                update() {
                    this.x += this.vx;
                    this.y += this.vy;
                    
                    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
                }

                draw() {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.fill();
                
                    // Draw connections
                    particles.forEach(particle => {
                        const distance = Math.sqrt(
                            Math.pow(this.x - particle.x, 2) + 
                            Math.pow(this.y - particle.y, 2)
                        );
                        
                        if (distance < 100) {
                            ctx.beginPath();
                            ctx.moveTo(this.x, this.y);
                            ctx.lineTo(particle.x, particle.y);
                            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - distance / 100)})`;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    });
                }
            }

            // Create particles
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }

            // Animation loop
            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach(particle => {
                    particle.update();
                    particle.draw();
                });

                requestAnimationFrame(animate);
            }
            
            animate();
            
            // Resize handler
            window.addEventListener('resize', () => {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            });
        }

        // Live Stats Counter Animation
        function animateStats() {
            const stats = [
                { element: 'activeUsers', target: 127, suffix: '' },
                { element: 'analysesCompleted', target: 342, suffix: '' },
                { element: 'frameworksUsed', target: 28, suffix: '' },
                { element: 'satisfactionRate', target: 94, suffix: '%' }
            ];

            stats.forEach(stat => {
                const element = document.getElementById(stat.element);
                if (!element) return;

                let current = 0;
                const increment = stat.target / 60; // 60 frames for 1 second animation
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= stat.target) {
                        current = stat.target;
                        clearInterval(timer);
                    }

                    element.textContent = Math.floor(current) + stat.suffix;
                }, 16); // ~60fps
            });
        }

        // Smooth Scroll to Tools
        function scrollToTools() {
            const toolsSection = document.getElementById('homeTabsNav');
            if (toolsSection) {
                toolsSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }

        // Book Preview Modal
        function showBookPreview() {
            // Create modal for book preview
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-container max-w-4xl max-h-[80vh] overflow-y-auto m-4 p-8">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-bold">Book Preview</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-white/70 hover:text-white text-2xl">&times;</button>
                    </div>
                    <div class="space-y-4 text-white/80">
                        <h4 class="text-lg font-bold text-indigo-300">Table of Contents</h4>
                        <ul class="list-disc list-inside space-y-2">
                            <li>Part I: Science of Strategy - Fundamental frameworks</li>
                            <li>Part II: Art of Strategy - Creative and adaptive approaches</li>
                            <li>Part III: Execution - Implementation methodologies</li>
                        </ul>
                        <h4 class="text-lg font-bold text-indigo-300 mt-6">Sample Chapter</h4>
                        <p class="italic">"Strategy is not just about planning, but about creating adaptive systems that can thrive in uncertainty..."</p>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            initHeroAnimation();
            animateStats();
        // Enhanced WebSocket status indicator
        });

        function updateWebSocketStatus(connected) {
            const wsStatus = document.getElementById('wsStatus');
            if (wsStatus) {
                wsStatus.className = `ws-status ${connected ? 'connected' : 'disconnected'}`;
                wsStatus.textContent = connected ? 'Connected' : 'Disconnected';
                // Add pulse animation when connected
                if (connected) {
                    wsStatus.classList.add('animate-pulse');
                } else {
                    wsStatus.classList.remove('animate-pulse');
                }
            }
        }

        // Attach password button listeners
        const resetBtn = dom.$("passwordResetRequestBtn");
        if (resetBtn) resetBtn.addEventListener("click", handlePasswordResetRequest);
        
        const updateBtn = dom.$("passwordUpdateBtn");
        if (updateBtn) updateBtn.addEventListener("click", handlePasswordUpdate);
        
        // These should run regardless
        setupHomeTabs();
        attachHomeCardListeners();
        initThreeJS();
    })();
    // --- END of New Initial Page Load Logic ---         
   
    // --- Dashboard Widget ---
    (function initDashboardWidget() {
        const PRESENCE_PREFIX = "sage_presence_";
        const HEARTBEAT_MS = 10000;
        const STALE_MS = 30000;
        const TAB_ID = crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();

        function heartbeat() {
            try {
                localStorage.setItem(PRESENCE_PREFIX + TAB_ID, String(Date.now()));
            } catch (e) {}
        }

        function cleanupStale() {
            const now = Date.now();
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(PRESENCE_PREFIX)) {
                        const ts = Number(localStorage.getItem(k) || "0");
                        if (!ts || now - ts > STALE_MS) localStorage.removeItem(k);
                    }
                }
            } catch (e) {}
        }

        function countOnline() {
            const now = Date.now();
            let cnt = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(PRESENCE_PREFIX)) {
                        const ts = Number(localStorage.getItem(k) || "0");
                        if (ts && now - ts <= STALE_MS) cnt++;
                    }
                }
            } catch (e) {}
            return cnt;
        }

        heartbeat();
        const hb = setInterval(() => {
            heartbeat();
            cleanupStale();
        }, HEARTBEAT_MS);
        window.addEventListener("beforeunload", () => {
            try {
                localStorage.removeItem(PRESENCE_PREFIX + TAB_ID);
            } catch (e) {}
            clearInterval(hb);
        });

        function updateDashboard() {
            const usersEl = document.getElementById("dashUsersOnline");
            const serverDot = document.getElementById("dashServerDot");
            const serverText = document.getElementById("dashServerText");
            const wsStatusEl = document.getElementById("wsStatus");

            if (usersEl) usersEl.textContent = String(countOnline());

            let statusText = "Unknown",
                statusClass = "bg-yellow-400";
            if (wsStatusEl) {
                const t = wsStatusEl.textContent.trim().toLowerCase();
                if (t.includes("connected")) {
                    statusText = "Connected";
                    statusClass = "bg-green-400";
                } else if (t.includes("disconnected") || t.includes("failed") || t.includes("error")) {
                    statusText = "Disconnected";
                    statusClass = "bg-red-400";
                } else if (t.includes("connecting")) {
                    statusText = "Connecting";
                    statusClass = "bg-yellow-400";
                }
            }

            if (serverText) serverText.textContent = statusText;
            if (serverDot) serverDot.className = "inline-block w-3 h-3 rounded-full " + statusClass;
        }
        setInterval(updateDashboard, 2000);
        updateDashboard();
    })();
});
