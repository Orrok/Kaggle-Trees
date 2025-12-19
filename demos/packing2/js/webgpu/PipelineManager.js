/**
 * WebGPU pipeline creation and management
 */
export class PipelineManager {
    constructor(deviceManager, treeGeometry) {
        this.deviceManager = deviceManager;
        this.device = deviceManager.getDevice();
        this.treeGeometry = treeGeometry;

        this.computePipeline = null;
        this.renderPipeline = null;
        this.computeBindGroupLayout = null;
        this.renderBindGroupLayout = null;
        this.computeBindGroup = null;
        this.renderBindGroup = null;
    }

    /**
     * Initialize compute and render pipelines
     */
    async initPipelines() {
        console.log('[PipelineManager] Initializing pipelines...');

        // Destroy any existing resources to avoid cached state issues
        console.log('[PipelineManager] Destroying existing resources...');
        this.destroy();

        console.log('[PipelineManager] Creating bind group layouts...');
        this.createBindGroupLayout();

        console.log('[PipelineManager] Creating compute pipeline...');
        await this.createComputePipeline();

        console.log('[PipelineManager] Creating render pipeline...');
        await this.createRenderPipeline();

        console.log('[PipelineManager] Creating bind groups...');
        this.createBindGroup();

        console.log('[PipelineManager] Pipeline initialization complete');
    }

    /**
     * Create compute pipeline for physics simulation
     */
    async createComputePipeline() {
        console.log('[PipelineManager] Creating compute shader module...');
        const computeShaderCode = this.getComputeShaderCode();
        const computeShader = this.device.createShaderModule({
            code: computeShaderCode
        });
        console.log('[PipelineManager] Compute shader module created');

        console.log('[PipelineManager] Creating compute pipeline layout...');
        const computePipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.computeBindGroupLayout]
        });
        console.log('[PipelineManager] Compute pipeline layout created');

        console.log('[PipelineManager] Creating compute pipeline...');
        this.computePipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: computeShader,
                entryPoint: 'main'
            }
        });
        console.log('[PipelineManager] Compute pipeline created successfully');
    }

    /**
     * Create render pipeline for instanced drawing
     */
    async createRenderPipeline() {
        console.log('[PipelineManager] Creating render shader module...');
        const renderShaderCode = this.getRenderShaderCode();
        const renderShader = this.device.createShaderModule({
            code: renderShaderCode
        });
        console.log('[PipelineManager] Render shader module created');

        console.log('[PipelineManager] Creating render pipeline layout...');
        const renderPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.renderBindGroupLayout]
        });
        console.log('[PipelineManager] Render pipeline layout created');

        console.log('[PipelineManager] Creating render pipeline...');
        const preferredFormat = this.deviceManager.getPreferredFormat();
        console.log(`[PipelineManager] Using canvas format: ${preferredFormat}`);

        this.renderPipeline = this.device.createRenderPipeline({
            layout: renderPipelineLayout,
            vertex: {
                module: renderShader,
                entryPoint: 'vert'
                // No vertex buffers - using hardcoded geometry like original
            },
            fragment: {
                module: renderShader,
                entryPoint: 'frag',
                targets: [{
                    format: preferredFormat
                }]
            },
            primitive: {
                topology: 'line-strip'
            }
        });
        console.log('[PipelineManager] Render pipeline created successfully');
    }

    /**
     * Create bind group layouts
     */
    createBindGroupLayout() {
        // Compute bind group layout (read-write access to tree buffer)
        this.computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'uniform' }
                }
            ]
        });

        // Render bind group layout (read-only access to tree buffer)
        this.renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });
    }

    /**
     * Create bind groups for pipelines
     */
    createBindGroup() {
        // Clean up any existing bind groups
        if (this.computeBindGroup) {
            this.computeBindGroup = null;
        }
        if (this.renderBindGroup) {
            this.renderBindGroup = null;
        }

        // Create compute bind group (read-write tree buffer)
        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bufferManager?.getTreeBuffer() } },
                { binding: 1, resource: { buffer: this.bufferManager?.getUniformBuffer() } }
            ]
        });

        // Create render bind group (read-only tree buffer)
        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bufferManager?.getTreeBuffer() } },
                { binding: 1, resource: { buffer: this.bufferManager?.getUniformBuffer() } }
            ]
        });
    }

    /**
     * Update bind groups with new buffers (called after buffer creation)
     * @param {BufferManager} bufferManager - Buffer manager instance
     */
    updateBindGroup(bufferManager) {
        this.bufferManager = bufferManager;
        if (this.computeBindGroupLayout && this.renderBindGroupLayout) {
            this.computeBindGroup = this.device.createBindGroup({
                layout: this.computeBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: bufferManager.getTreeBuffer() } },
                    { binding: 1, resource: { buffer: bufferManager.getUniformBuffer() } }
                ]
            });

            this.renderBindGroup = this.device.createBindGroup({
                layout: this.renderBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: bufferManager.getTreeBuffer() } },
                    { binding: 1, resource: { buffer: bufferManager.getUniformBuffer() } }
                ]
            });
        }
    }

    /**
     * Get compute pipeline
     * @returns {GPUComputePipeline} Compute pipeline
     */
    getComputePipeline() {
        return this.computePipeline;
    }

    /**
     * Get render pipeline
     * @returns {GPURenderPipeline} Render pipeline
     */
    getRenderPipeline() {
        return this.renderPipeline;
    }

    /**
     * Get compute bind group
     * @returns {GPUBindGroup} Compute bind group
     */
    getBindGroup() {
        return this.computeBindGroup;
    }

    /**
     * Get render bind group
     * @returns {GPUBindGroup} Render bind group
     */
    getRenderBindGroup() {
        return this.renderBindGroup;
    }

    /**
     * Get compute shader code
     * @returns {string} WGSL compute shader code
     */
    getComputeShaderCode() {
        return `
// Compute shader v${Date.now()} - force cache invalidation
// Tree struct: 8 floats (pos:2, vel:2, rot:1, ang_vel:1, col:1, _pad:1)
            struct Tree {
                pos: vec2f,
                vel: vec2f,
                rot: f32,
                ang_vel: f32,
                col: f32,
                _pad: f32,
            };

            struct Params {
                zoom: f32,
                compression: f32,
                probX: f32,
                time: f32,
                aspect: f32,
                _pad1: f32,
                _pad2: f32,
                _pad3: f32,
            };

            @group(0) @binding(0) var<storage, read_write> trees: array<Tree>;
            @group(0) @binding(1) var<uniform> params: Params;

            var<private> tree_poly: array<vec2f, 16> = array<vec2f, 16>(
                vec2f(0.0, 0.8), vec2f(0.125, 0.5), vec2f(0.0625, 0.5), vec2f(0.2, 0.25),
                vec2f(0.1, 0.25), vec2f(0.35, 0.0), vec2f(0.075, 0.0), vec2f(0.075, -0.2),
                vec2f(-0.075, -0.2), vec2f(-0.075, 0.0), vec2f(-0.35, 0.0), vec2f(-0.1, 0.25),
                vec2f(-0.2, 0.25), vec2f(-0.0625, 0.5), vec2f(-0.125, 0.5), vec2f(0.0, 0.8)
            );

            fn hash(u: u32) -> f32 {
                var x = u * 747796405u + 2891336453u;
                x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
                return f32((x ^ (x >> 22u))) / 4294967295.0;
            }

            fn sdSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
                let pa = p - a; let ba = b - a;
                let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                return length(pa - ba * h);
            }

            fn isInside(p: vec2f) -> bool {
                var wn = 0;
                for (var i = 0u; i < 15u; i++) {
                    let a = tree_poly[i]; let b = tree_poly[i+1];
                    if (a.y <= p.y) {
                        if (b.y > p.y && (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) > 0.0) { wn++; }
                    } else {
                        if (b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0.0) { wn--; }
                    }
                }
                return wn != 0;
            }

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) id: vec3u) {
                let i = id.x;
                if (i >= arrayLength(&trees)) { return; }
                var t = trees[i];

                // 1. STABILIZED GRAVITY
                let rnd = hash(i + u32(params.time));

                // Limit the distance effect
                // REDUCED SCALE BY 10 (was 0.05) to compress slower
                let gravity_strength = clamp(params.compression * 0.005, 0.0, 0.2);
                let x_pull = clamp(t.pos.x, -20.0, 20.0) * gravity_strength;
                let y_pull = clamp(t.pos.y, -20.0, 20.0) * gravity_strength;

                if (rnd < params.probX) {
                    t.vel.x -= x_pull;
                    t.vel.y += (hash(i*2u + u32(params.time)) - 0.5) * gravity_strength * 0.5;
                } else {
                    t.vel.y -= y_pull;
                    t.vel.x += (hash(i*2u + u32(params.time)) - 0.5) * gravity_strength * 0.5;
                }

                // 2. Collision (Analytic)
                let search_rad = 2.5;
                let count = arrayLength(&trees);
                t.col = 0.0;

                if (length(t.pos) < 50.0) {
                    for (var j = 0u; j < count; j++) {
                        if (i == j) { continue; }
                        let other = trees[j];
                        if (distance(t.pos, other.pos) > search_rad) { continue; }

                        let c = cos(-other.rot); let s = sin(-other.rot);

                        for (var v = 0u; v < 15u; v++) {
                            let my_local_v = tree_poly[v];
                            let mc = cos(t.rot); let ms = sin(t.rot);
                            let my_world_v = t.pos + vec2f(my_local_v.x * mc - my_local_v.y * ms, my_local_v.x * ms + my_local_v.y * mc);
                            let diff = my_world_v - other.pos;
                            let other_local_p = vec2f(diff.x * c - diff.y * s, diff.x * s + diff.y * c);

                            var dist = 1000.0;
                            for (var k = 0u; k < 15u; k++) { dist = min(dist, sdSegment(other_local_p, tree_poly[k], tree_poly[k+1])); }
                            if (isInside(other_local_p)) { dist = -dist; }

                            if (dist < 0.02) {
                                t.col = 1.0;
                                let contact_vec = normalize(my_world_v - other.pos);

                                // Force Clamp
                                let force_mag = (0.02 - dist) * 30.0;
                                let safe_force = min(force_mag, 1.0);

                                t.vel += contact_vec * safe_force;

                                // Torque Damping
                                let arm = my_world_v - t.pos;
                                let torque = (arm.x * contact_vec.y - arm.y * contact_vec.x);
                                t.ang_vel += clamp(torque * safe_force * 3.0, -1.0, 1.0);
                            }
                        }
                    }
                }

                // 3. Integration
                let dt = 0.016;
                t.vel *= 0.90;
                if (length(t.vel) > 2.0) { t.vel = normalize(t.vel) * 2.0; }
                t.pos += t.vel * dt;

                t.ang_vel *= 0.80;
                t.ang_vel = clamp(t.ang_vel, -5.0, 5.0);
                t.rot += t.ang_vel * dt;

                if (abs(t.pos.x) > 100.0 || abs(t.pos.y) > 100.0) { t.pos = vec2f(0.0); t.vel = vec2f(0.0); }

                trees[i] = t;
            }
        `;
    }

    /**
     * Get render shader code
     * @returns {string} WGSL render shader code
     */
    getRenderShaderCode() {
        return `
// Render shader v${Date.now()} - force cache invalidation
// Tree struct: 8 floats (pos:2, vel:2, rot:1, ang_vel:1, col:1, _pad:1)
            struct Tree {
                pos: vec2f,
                vel: vec2f,
                rot: f32,
                ang_vel: f32,
                col: f32,
                _pad: f32,
            };

            struct Params {
                zoom: f32,
                compression: f32,
                probX: f32,
                time: f32,
                aspect: f32,
                _pad1: f32,
                _pad2: f32,
                _pad3: f32,
            };

            @group(0) @binding(0) var<storage, read> trees: array<Tree>;
            @group(0) @binding(1) var<uniform> params: Params;

            var<private> tree_poly: array<vec2f, 16> = array<vec2f, 16>(
                vec2f(0.0, 0.8), vec2f(0.125, 0.5), vec2f(0.0625, 0.5), vec2f(0.2, 0.25),
                vec2f(0.1, 0.25), vec2f(0.35, 0.0), vec2f(0.075, 0.0), vec2f(0.075, -0.2),
                vec2f(-0.075, -0.2), vec2f(-0.075, 0.0), vec2f(-0.35, 0.0), vec2f(-0.1, 0.25),
                vec2f(-0.2, 0.25), vec2f(-0.0625, 0.5), vec2f(-0.125, 0.5), vec2f(0.0, 0.8)
            );

            struct VertexOut {
                @builtin(position) pos: vec4f,
                @location(0) color: vec4f,
            };

            @vertex fn vert(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOut {
                let t = trees[iIdx];
                let local = tree_poly[vIdx % 16];
                let c = cos(t.rot); let s = sin(t.rot);
                let world = t.pos + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);

                let aspect_vec = vec2f(1.0 / params.aspect, 1.0);

                var out: VertexOut;
                out.pos = vec4f(world * params.zoom * 0.1 * aspect_vec, 0.0, 1.0);
                if (t.col > 0.5) { out.color = vec4f(1.0, 0.2, 0.2, 1.0); }
                else { let speed = length(t.vel); out.color = vec4f(0.2, 0.8 + speed, 0.3, 1.0); }
                return out;
            }
            @fragment fn frag(@location(0) color: vec4f) -> @location(0) vec4f { return color; }
        `;
    }

    /**
     * Destroy pipelines and bind groups
     */
    destroy() {
        // Properly destroy GPU resources
        if (this.computePipeline) {
            this.computePipeline = null;
        }
        if (this.renderPipeline) {
            this.renderPipeline = null;
        }
        if (this.computeBindGroup) {
            this.computeBindGroup = null;
        }
        if (this.renderBindGroup) {
            this.renderBindGroup = null;
        }
        if (this.computeBindGroupLayout) {
            this.computeBindGroupLayout = null;
        }
        if (this.renderBindGroupLayout) {
            this.renderBindGroupLayout = null;
        }
    }
}
