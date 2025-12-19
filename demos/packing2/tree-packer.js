// Advanced WebGPU Tree Packer - Single-file implementation
// Features: O(N²) physics simulation, instanced rendering, CPU optimization loop

class WebGPURenderer {
    constructor() {
        this.canvas = document.getElementById('gpuCanvas');
        this.overlay = document.getElementById('overlayCanvas');
        this.overlayCtx = this.overlay.getContext('2d');

        // Simulation parameters
        this.params = {
            treeCount: 500,
            compressionForce: 0.1,
            relaxationRate: 1.0,
            autoPack: true,
            aspect: 1.0
        };

        // Performance tracking
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.collisionCount = 0;
        this.packRatio = 0;

        // CPU feedback loop
        this.feedbackFrameCount = 0;
        this.lastReadbackTime = 0;
        this.currentBounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
        this.targetAspectRatio = 1.0;

        // WebGPU resources
        this.device = null;
        this.context = null;
        this.computePipeline = null;
        this.renderPipeline = null;
        this.bindGroup = null;

        // Buffers
        this.treeBuffer = null;
        this.uniformBuffer = null;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.readBuffer = null;
        this.geometryBuffer = null;

        // Tree geometry (Christmas tree shape) - shared between CPU and GPU
        this.treePoly = [
            -0.08, 0.0,   // bottom left branch
             0.08, 0.0,   // bottom right branch
             0.0, 0.15,   // bottom top
            -0.06, 0.15,  // middle left branch
             0.06, 0.15,  // middle right branch
             0.0, 0.25,   // middle top
            -0.04, 0.25,  // top left branch
             0.04, 0.25,  // top right branch
             0.0, 0.35,   // top
            -0.02, -0.1,  // trunk bottom left
             0.02, -0.1,  // trunk bottom right
             0.02, 0.0,   // trunk top right
            -0.02, 0.0    // trunk top left
        ];

        // Create triangles for rendering
        this.treeVertices = [];
        this.treeIndices = [];

        // Bottom triangle
        this.treeVertices.push(...this.treePoly.slice(0, 6)); // 0,1,2
        this.treeIndices.push(0, 1, 2);

        // Middle triangle
        this.treeVertices.push(...this.treePoly.slice(6, 12)); // 3,4,5
        this.treeIndices.push(3, 4, 5);

        // Top triangle
        this.treeVertices.push(...this.treePoly.slice(12, 18)); // 6,7,8
        this.treeIndices.push(6, 7, 8);

        // Trunk quad (two triangles)
        this.treeVertices.push(...this.treePoly.slice(18, 26)); // 9,10,11,12
        this.treeIndices.push(9, 10, 11, 11, 12, 9);

        // UI elements
        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        this.treeSlider = document.getElementById('tree-slider');
        this.treeValue = document.getElementById('tree-value');
        this.compressSlider = document.getElementById('compress-slider');
        this.compressValue = document.getElementById('compress-value');
        this.relaxSlider = document.getElementById('relax-slider');
        this.relaxValue = document.getElementById('relax-value');
        this.autoPackBtn = document.getElementById('auto-pack-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugPanel = document.getElementById('debug-panel');
        this.debugLog = document.getElementById('debug-log');
        this.closeDebug = document.getElementById('close-debug');

        // Stats
        this.treeCountEl = document.getElementById('tree-count');
        this.packRatioEl = document.getElementById('pack-ratio');
        this.fpsEl = document.getElementById('fps');
    }

    setupEventListeners() {
        // Sliders
        this.treeSlider.addEventListener('input', (e) => {
            this.params.treeCount = parseInt(e.target.value);
            this.treeValue.textContent = this.params.treeCount;
            this.needsReset = true;
        });

        this.compressSlider.addEventListener('input', (e) => {
            this.params.compressionForce = parseFloat(e.target.value);
            this.compressValue.textContent = this.params.compressionForce.toFixed(2);
        });

        this.relaxSlider.addEventListener('input', (e) => {
            this.params.relaxationRate = parseFloat(e.target.value);
            this.relaxValue.textContent = this.params.relaxationRate.toFixed(2);
        });

        // Buttons
        this.autoPackBtn.addEventListener('click', () => {
            this.params.autoPack = !this.params.autoPack;
            this.autoPackBtn.classList.toggle('active', this.params.autoPack);
        });

        this.resetBtn.addEventListener('click', () => {
            this.resetSimulation();
        });

        this.debugBtn.addEventListener('click', () => {
            this.debugPanel.style.display = 'block';
        });

        this.closeDebug.addEventListener('click', () => {
            this.debugPanel.style.display = 'none';
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    async init() {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }

        // Request adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        this.device = await adapter.requestDevice();

        // Setup canvas context
        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'opaque'
        });

        // Initialize buffers and pipelines
        await this.initBuffers();
        await this.initPipelines();

        // Resize canvas initially
        this.resizeCanvas();

        this.log('WebGPU initialized successfully');
    }

    async initBuffers() {
        // Tree data buffer (position, rotation, velocity)
        const LEGACY_FLOATS_PER_TREE = 8; // Legacy implementation: position:2, rotation:1, velocity:2, angular_velocity:1, radius:1, padding:1
        const BYTES_PER_FLOAT = 4;
        const treeDataSize = this.params.treeCount * LEGACY_FLOATS_PER_TREE * BYTES_PER_FLOAT;
        this.treeBuffer = this.device.createBuffer({
            size: treeDataSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        // Read buffer for CPU feedback loop
        this.readBuffer = this.device.createBuffer({
            size: treeDataSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        // Uniform buffer for simulation parameters
        const PARAMETERS_FLOAT_COUNT = 16;
        const BYTES_PER_FLOAT = 4;
        this.uniformBuffer = this.device.createBuffer({
            size: PARAMETERS_FLOAT_COUNT * BYTES_PER_FLOAT,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Vertex buffer for tree geometry
        this.vertexBuffer = this.device.createBuffer({
            size: this.treeVertices.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(this.treeVertices);
        this.vertexBuffer.unmap();

        // Index buffer
        this.indexBuffer = this.device.createBuffer({
            size: this.treeIndices.length * 4,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(this.treeIndices);
        this.indexBuffer.unmap();

        // Geometry buffer for collision detection (shared with GPU)
        this.geometryBuffer = this.device.createBuffer({
            size: this.treePoly.length * 4,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });
        new Float32Array(this.geometryBuffer.getMappedRange()).set(this.treePoly);
        this.geometryBuffer.unmap();

        this.log('Buffers initialized');
    }

    async initPipelines() {
        // Compute pipeline for physics simulation
        const computeShader = this.device.createShaderModule({
            code: `
                struct Tree {
                    position: vec2f,
                    rotation: f32,
                    velocity: vec2f,
                    angular_velocity: f32,
                    radius: f32,
                    padding: vec3f
                };

                struct Params {
                    tree_count: u32,
                    delta_time: f32,
                    compression_force: f32,
                    relaxation_rate: f32,
                    aspect: f32,
                    center_x: f32,
                    center_y: f32,
                    frame_count: u32,
                    prob_x: f32,
                    prob_y: f32
                };

                @group(0) @binding(0) var<storage, read_write> trees: array<Tree>;
                @group(0) @binding(1) var<uniform> params: Params;
                @group(0) @binding(2) var<storage, read> tree_geometry: array<vec2f>;

                fn rotate_point(point: vec2f, angle: f32) -> vec2f {
                    let cos_a = cos(angle);
                    let sin_a = sin(angle);
                    return vec2f(
                        point.x * cos_a - point.y * sin_a,
                        point.x * sin_a + point.y * cos_a
                    );
                }

                fn point_in_polygon(point: vec2f, poly: array<vec2f>, count: u32) -> bool {
                    var inside = false;
                    for (var i = 0u; i < count; i++) {
                        let j = (i + 1u) % count;
                        if ((poly[i].y > point.y) != (poly[j].y > point.y)) {
                            if (point.x < poly[i].x + (poly[j].x - poly[i].x) * (point.y - poly[i].y) / (poly[j].y - poly[i].y)) {
                                inside = !inside;
                            }
                        }
                    }
                    return inside;
                }

                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) global_id: vec3u) {
                    let idx = global_id.x;
                    if (idx >= params.tree_count) {
                        return;
                    }

                    var tree = trees[idx];

                    // Apply compression toward center with aspect ratio correction
                    let center = vec2f(params.center_x, params.center_y);
                    let to_center = center - tree.position;
                    let distance = length(to_center);

                    if (distance > 0.001) {
                        let compression_dir = normalize(to_center);
                        // Apply probability weights for aspect ratio control
                        let weighted_force = params.compression_force * params.delta_time;
                        compression_dir.x *= params.prob_x;
                        compression_dir.y *= params.prob_y;
                        tree.velocity += compression_dir * weighted_force;
                    }

                    // Collision detection with other trees (O(N²)) - optimized
                    for (var j = 0u; j < params.tree_count; j++) {
                        if (idx == j) { continue; }

                        let other = trees[j];
                        let delta = other.position - tree.position;
                        let dist = length(delta);

                        // Fast rejection with improved bounds
                        let search_rad = tree.radius + other.radius;
                        let max_reach = search_rad * 1.2; // Slightly more conservative

                        if (dist > max_reach) { continue; }

                        // Additional velocity-based prediction for moving objects
                        let relative_velocity = other.velocity - tree.velocity;
                        let closing_speed = dot(normalize(delta), relative_velocity);

                        // If moving away fast enough, skip
                        if (closing_speed < -0.01 && dist > search_rad * 0.8) { continue; }

                        // Check collision
                        if (dist < search_rad) {
                            let normal = normalize(delta);
                            let overlap = search_rad - dist;

                            // Apply separation with damping
                            let separation_force = min(overlap * 2.0, 0.1); // Cap maximum separation
                            tree.position -= normal * separation_force * 0.5;
                            tree.velocity -= normal * separation_force * params.relaxation_rate;

                            // Add some tangential friction to prevent sliding
                            let tangent = vec2f(-normal.y, normal.x);
                            let friction = dot(relative_velocity, tangent) * 0.1;
                            tree.velocity -= tangent * friction;
                        }
                    }

                    // Apply damping
                    tree.velocity *= 0.99;
                    tree.angular_velocity *= 0.98;

                    // Update position
                    tree.position += tree.velocity * params.delta_time;
                    tree.rotation += tree.angular_velocity * params.delta_time;

                    // Keep trees in bounds
                    tree.position = clamp(tree.position, vec2f(-2.0), vec2f(2.0));

                    trees[idx] = tree;
                }
            `
        });

        this.computePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: computeShader,
                entryPoint: 'main'
            }
        });

        // Render pipeline for instanced drawing
        const renderShader = this.device.createShaderModule({
            code: `
                struct Tree {
                    position: vec2f,
                    rotation: f32,
                    velocity: vec2f,
                    angular_velocity: f32,
                    radius: f32,
                    padding: vec3f
                };

                struct Params {
                    tree_count: u32,
                    delta_time: f32,
                    compression_force: f32,
                    relaxation_rate: f32,
                    aspect: f32,
                    center_x: f32,
                    center_y: f32,
                    frame_count: u32,
                    prob_x: f32,
                    prob_y: f32
                };

                @group(0) @binding(0) var<storage, read> trees: array<Tree>;
                @group(0) @binding(1) var<uniform> params: Params;

                struct VertexOut {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec3f,
                };

                @vertex
                fn vertex_main(
                    @location(0) position: vec2f,
                    @builtin(instance_index) instance_idx: u32
                ) -> VertexOut {
                    var out: VertexOut;

                    if (instance_idx >= params.tree_count) {
                        out.position = vec4f(0.0, 0.0, 0.0, 1.0);
                        out.color = vec3f(0.0);
                        return out;
                    }

                    let tree = trees[instance_idx];

                    // Rotate vertex
                    let cos_r = cos(tree.rotation);
                    let sin_r = sin(tree.rotation);
                    let rotated_pos = vec2f(
                        position.x * cos_r - position.y * sin_r,
                        position.x * sin_r + position.y * cos_r
                    );

                    // Scale and position
                    let world_pos = rotated_pos * 0.1 + tree.position;

                    // Convert to NDC (-1 to 1) - world space is (-2,2)
                    let final_pos = world_pos * 0.5; // Scale from (-2,2) to (-1,1)

                    // Apply aspect ratio correction
                    final_pos.x /= params.aspect;

                    out.position = vec4f(final_pos, 0.0, 1.0);

                    // Color based on velocity magnitude
                    let speed = length(tree.velocity);
                    out.color = mix(vec3f(0.2, 0.8, 0.3), vec3f(1.0, 0.5, 0.2), speed * 10.0);

                    return out;
                }

                @fragment
                fn fragment_main(in: VertexOut) -> @location(0) vec4f {
                    return vec4f(in.color, 1.0);
                }
            `
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: renderShader,
                entryPoint: 'vertex_main',
                buffers: [{
                    arrayStride: 8, // 2 floats per vertex
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x2'
                    }]
                }]
            },
            fragment: {
                module: renderShader,
                entryPoint: 'fragment_main',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        // Bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.treeBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuffer } },
                { binding: 2, resource: { buffer: this.geometryBuffer } }
            ]
        });

        this.log('Pipelines initialized');
    }

    resetSimulation() {
        // Initialize trees in a circle
        const treeData = new Float32Array(this.params.treeCount * 8);
        const radius = 1.0;

        for (let i = 0; i < this.params.treeCount; i++) {
            const angle = (i / this.params.treeCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
            const y = Math.sin(angle) * radius * (0.5 + Math.random() * 0.5);

            treeData[i * 8 + 0] = x; // position.x
            treeData[i * 8 + 1] = y; // position.y
            treeData[i * 8 + 2] = Math.random() * Math.PI * 2; // rotation
            treeData[i * 8 + 3] = 0; // velocity.x
            treeData[i * 8 + 4] = 0; // velocity.y
            treeData[i * 8 + 5] = 0; // angular_velocity
            treeData[i * 8 + 6] = 0.1; // radius
        }

        this.device.queue.writeBuffer(this.treeBuffer, 0, treeData);
        this.collisionCount = 0;
        this.packRatio = 0;
        this.needsReset = false;

        this.log('Simulation reset');
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.overlay.width = rect.width;
        this.overlay.height = rect.height;

        this.params.aspect = rect.width / rect.height;

        this.log(`Canvas resized: ${this.canvas.width}x${this.canvas.height}`);
    }

    updateUniforms(deltaTime) {
        // Calculate compression probabilities based on current bounds
        let probX = 1.0;
        let probY = 1.0;

        if (this.params.autoPack && this.currentBounds) {
            const width = this.currentBounds.maxX - this.currentBounds.minX;
            const height = this.currentBounds.maxY - this.currentBounds.minY;
            const currentAspect = width / height;
            const targetAspect = this.params.aspect;

            if (currentAspect > targetAspect) {
                // Too wide, compress more in X direction
                probX = 1.2;
                probY = 0.8;
            } else if (currentAspect < targetAspect) {
                // Too tall, compress more in Y direction
                probX = 0.8;
                probY = 1.2;
            }
        }

        const uniforms = new Float32Array([
            this.params.treeCount,
            deltaTime,
            this.params.compressionForce,
            this.params.relaxationRate,
            this.params.aspect,
            0.0, // center_x
            0.0, // center_y
            this.frameCount,
            probX,
            probY
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }

    async processFeedbackLoop() {
        try {
            // Map the read buffer
            await this.readBuffer.mapAsync(GPUMapMode.READ);
            const treeData = new Float32Array(this.readBuffer.getMappedRange());

            // Calculate bounding box
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            for (let i = 0; i < this.params.treeCount; i++) {
                const x = treeData[i * 8 + 0];
                const y = treeData[i * 8 + 1];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }

            this.readBuffer.unmap();

            // Update bounds
            this.currentBounds = { minX, maxX, minY, maxY };

            // Calculate current aspect ratio
            const width = maxX - minX;
            const height = maxY - minY;
            const currentAspect = width / height;

            // Update packing ratio
            this.packRatio = Math.min(width, height) / Math.max(width, height);

            // Adjust compression based on aspect ratio
            if (this.params.autoPack) {
                const targetAspect = this.params.aspect;
                const aspectError = targetAspect - currentAspect;

                // Compress more in the dimension that needs it
                if (Math.abs(aspectError) > 0.1) {
                    this.targetAspectRatio = targetAspect;
                    // This logic would be implemented in the shader
                }
            }

        } catch (error) {
            this.log(`Feedback loop error: ${error.message}`);
        }
    }

    async render() {
        const TARGET_FPS = 60;
        const deltaTime = 1.0 / TARGET_FPS; // Fixed timestep for stability

        // Update uniforms
        this.updateUniforms(deltaTime);

        // Reset if needed
        if (this.needsReset) {
            console.log('Resetting simulation...');
            this.resetSimulation();
        }

        // Compute pass (physics simulation)
        const computePass = this.device.createCommandEncoder();
        const computePassEncoder = computePass.beginComputePass();
        computePassEncoder.setPipeline(this.computePipeline);
        computePassEncoder.setBindGroup(0, this.bindGroup);
        computePassEncoder.dispatchWorkgroups(Math.ceil(this.params.treeCount / 64));
        computePassEncoder.end();

        // CPU feedback loop - read back positions every 10 frames
        if (this.feedbackFrameCount % 10 === 0 && this.params.autoPack) {
            computePass.copyBufferToBuffer(this.treeBuffer, 0, this.readBuffer, 0, this.treeBuffer.size);
        }

        // Render pass
        const renderPass = computePass.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        renderPass.drawIndexed(this.treeIndices.length, this.params.treeCount);
        renderPass.end();

        // Submit commands
        this.device.queue.submit([computePass.finish()]);

        // Process CPU feedback loop
        this.feedbackFrameCount++;
        if (this.feedbackFrameCount % 10 === 1 && this.params.autoPack) {
            this.processFeedbackLoop();
        }

        // Update UI
        this.updateUI();

        // Draw overlay
        this.drawOverlay();
    }

    updateUI() {
        this.treeCountEl.textContent = this.params.treeCount;
        this.packRatioEl.textContent = this.packRatio.toFixed(3);
        this.fpsEl.textContent = this.fps;

        // Update perf indicator (simulated)
        const perfFill = document.getElementById('perf-fill');
        const MAX_TREE_COUNT = 2000;
        const load = Math.min(100, (this.params.treeCount / MAX_TREE_COUNT) * 100);
        perfFill.style.width = load + '%';
    }

    drawOverlay() {
        const ctx = this.overlayCtx;
        const width = this.overlay.width;
        const height = this.overlay.height;

        ctx.clearRect(0, 0, width, height);

        // Draw center crosshair
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width/2 - 20, height/2);
        ctx.lineTo(width/2 + 20, height/2);
        ctx.moveTo(width/2, height/2 - 20);
        ctx.lineTo(width/2, height/2 + 20);
        ctx.stroke();

        // Draw bounding box
        if (this.currentBounds) {
            const bounds = this.currentBounds;

            // Convert world coordinates to screen coordinates
            const screenMinX = ((bounds.minX + 2) / 4) * width;
            const screenMaxX = ((bounds.maxX + 2) / 4) * width;
            const screenMinY = ((bounds.minY + 2) / 4) * height;
            const screenMaxY = ((bounds.maxY + 2) / 4) * height;

            // Draw bounding box
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenMinX, screenMinY, screenMaxX - screenMinX, screenMaxY - screenMinY);

            // Draw center of mass
            const centerX = (screenMinX + screenMaxX) / 2;
            const centerY = (screenMinY + screenMaxY) / 2;
            ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Draw compression vectors if auto-pack is active
            if (this.params.autoPack) {
                const width_ratio = (bounds.maxX - bounds.minX) / 4; // normalized
                const height_ratio = (bounds.maxY - bounds.minY) / 4; // normalized

                ctx.strokeStyle = 'rgba(100, 255, 100, 0.6)';
                ctx.lineWidth = 3;

                // Draw arrows showing compression direction
                const arrowLength = 30;
                if (width_ratio > height_ratio) {
                    // Compress horizontally
                    ctx.beginPath();
                    ctx.moveTo(width/2 - arrowLength, height/2);
                    ctx.lineTo(width/2 + arrowLength, height/2);
                    ctx.moveTo(width/2 - arrowLength, height/2);
                    ctx.lineTo(width/2 - arrowLength + 10, height/2 - 5);
                    ctx.moveTo(width/2 - arrowLength, height/2);
                    ctx.lineTo(width/2 - arrowLength + 10, height/2 + 5);
                    ctx.stroke();
                } else {
                    // Compress vertically
                    ctx.beginPath();
                    ctx.moveTo(width/2, height/2 - arrowLength);
                    ctx.lineTo(width/2, height/2 + arrowLength);
                    ctx.moveTo(width/2, height/2 - arrowLength);
                    ctx.lineTo(width/2 - 5, height/2 - arrowLength + 10);
                    ctx.moveTo(width/2, height/2 - arrowLength);
                    ctx.lineTo(width/2 + 5, height/2 - arrowLength + 10);
                    ctx.stroke();
                }
            }
        }
    }

    start() {
        this.resetSimulation();

        const renderLoop = async (timestamp) => {
            // Calculate FPS
            if (this.lastTime) {
                const delta = timestamp - this.lastTime;
                this.fps = Math.round(1000 / delta);
            }
            this.lastTime = timestamp;
            this.frameCount++;

            await this.render();
            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);
        console.log('Render loop started');
        this.log('Render loop started');
    }

    log(message) {
        console.log(`[Tree Packer] ${message}`);

        if (this.debugLog) {
            const line = document.createElement('div');
            line.className = 'log-line log-info';
            line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            this.debugLog.appendChild(line);
            this.debugLog.scrollTop = this.debugLog.scrollHeight;
        }
    }
}

// Make WebGPURenderer globally available
window.WebGPURenderer = WebGPURenderer;</contents>
