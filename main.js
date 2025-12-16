// WebGPU Particle Simulation
// 1000 particles with physics simulation

const NUM_PARTICLES = 1000;
const PARTICLE_SIZE = 2.0;

// Vertex shader for particles
const PARTICLE_SIZE_FLOAT = PARTICLE_SIZE.toFixed(1);
const vertexShader = `
struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    color: vec3<f32>,
    life: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

struct Uniforms {
    time: f32,
    deltaTime: f32,
    resolution: vec2<f32>,
    gravity: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    
    let particle = particles[vertexIndex / 6u];
    
    // Create a quad for each particle (6 vertices = 2 triangles)
    let quadIndex = vertexIndex % 6u;
    let offset = vec2<f32>(
        select(-1.0, 1.0, quadIndex == 1u || quadIndex == 4u || quadIndex == 5u),
        select(-1.0, 1.0, quadIndex == 2u || quadIndex == 3u || quadIndex == 5u)
    ) * ${PARTICLE_SIZE_FLOAT};
    
    // Transform particle position to clip space
    let pos = particle.position + offset;
    output.position = vec4<f32>(
        (pos.x / uniforms.resolution.x) * 2.0 - 1.0,
        (pos.y / uniforms.resolution.y) * 2.0 - 1.0,
        0.0,
        1.0
    );
    
    // Use particle color with life-based alpha
    output.color = particle.color * particle.life;
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
`;

// Compute shader for particle physics
const computeShader = `
struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    color: vec3<f32>,
    life: f32,
};

struct Uniforms {
    time: f32,
    deltaTime: f32,
    resolution: vec2<f32>,
    gravity: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

fn hash21(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    if (index >= ${NUM_PARTICLES}u) {
        return;
    }
    
    var particle = particles[index];
    
    // Apply gravity
    particle.velocity += uniforms.gravity * uniforms.deltaTime;
    
    // Update position
    particle.position += particle.velocity * uniforms.deltaTime;
    
    // Boundary collision with damping
    let margin = 10.0;
    if (particle.position.x < margin || particle.position.x > uniforms.resolution.x - margin) {
        particle.velocity.x *= -0.8;
        particle.position.x = clamp(particle.position.x, margin, uniforms.resolution.x - margin);
    }
    if (particle.position.y < margin || particle.position.y > uniforms.resolution.y - margin) {
        particle.velocity.y *= -0.8;
        particle.position.y = clamp(particle.position.y, margin, uniforms.resolution.y - margin);
    }
    
    // Add some random force for interesting motion
    let noise = hash21(particle.position * 0.01 + uniforms.time * 0.1);
    particle.velocity += vec2<f32>(
        cos(noise * 6.28318) * 0.5,
        sin(noise * 6.28318) * 0.5
    ) * uniforms.deltaTime;
    
    // Damping
    particle.velocity *= 0.99;
    
    // Update life (fade in/out)
    particle.life = 0.5 + 0.5 * sin(uniforms.time * 2.0 + noise * 6.28318);
    
    // Update color based on velocity
    let speed = length(particle.velocity);
    particle.color = mix(
        vec3<f32>(0.2, 0.4, 1.0),
        vec3<f32>(1.0, 0.4, 0.2),
        clamp(speed / 200.0, 0.0, 1.0)
    );
    
    particles[index] = particle;
}
`;

async function initWebGPU() {
    // Check for WebGPU support
    if (!navigator.gpu) {
        throw new Error('WebGPU is not supported in this browser');
    }

    // Request adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('Failed to get GPU adapter');
    }

    const device = await adapter.requestDevice();
    if (!device) {
        throw new Error('Failed to get GPU device');
    }

    // Get canvas and context
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('webgpu');
    if (!context) {
        throw new Error('Failed to get WebGPU context');
    }

    // Configure canvas
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
    });

    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return { device, context, format, canvas };
}

function createParticleBuffer(device, width, height) {
    // Particle structure: position (vec2), velocity (vec2), color (vec3), life (f32)
    // Total: 2 + 2 + 3 + 1 = 8 floats = 32 bytes
    const particleSize = 8 * 4; // 8 floats * 4 bytes each
    
    const buffer = device.createBuffer({
        size: NUM_PARTICLES * particleSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Initialize particles with random positions and velocities
    const particleData = new Float32Array(NUM_PARTICLES * 8);
    for (let i = 0; i < NUM_PARTICLES; i++) {
        const baseIndex = i * 8;
        const angle = (Math.random() * Math.PI * 2);
        const speed = 50 + Math.random() * 100;
        
        // Position (random on screen)
        particleData[baseIndex + 0] = Math.random() * width;
        particleData[baseIndex + 1] = Math.random() * height;
        
        // Velocity (circular motion)
        particleData[baseIndex + 2] = Math.cos(angle) * speed;
        particleData[baseIndex + 3] = Math.sin(angle) * speed;
        
        // Color (blue to red gradient)
        const hue = Math.random();
        particleData[baseIndex + 4] = 0.2 + hue * 0.8; // R
        particleData[baseIndex + 5] = 0.4; // G
        particleData[baseIndex + 6] = 1.0 - hue * 0.8; // B
        
        // Life
        particleData[baseIndex + 7] = 1.0;
    }

    device.queue.writeBuffer(buffer, 0, particleData);
    return buffer;
}

function createUniformBuffer(device) {
    const buffer = device.createBuffer({
        size: 8 * 4, // time, deltaTime, resolution (vec2), gravity (vec2) = 8 floats
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return buffer;
}

function createRenderPipeline(device, format) {
    const module = device.createShaderModule({ code: vertexShader });
    
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module,
            entryPoint: 'vs_main',
            buffers: [], // We're using storage buffers, not vertex buffers
        },
        fragment: {
            module,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });
    
    return pipeline;
}

function createComputePipeline(device) {
    const module = device.createShaderModule({ code: computeShader });
    
    const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module,
            entryPoint: 'cs_main',
        },
    });
    
    return pipeline;
}

function createBindGroup(device, particleBuffer, uniformBuffer, computePipeline, renderPipeline) {
    const bindGroupLayout = computePipeline.getBindGroupLayout(0);
    
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: particleBuffer },
            },
            {
                binding: 1,
                resource: { buffer: uniformBuffer },
            },
        ],
    });
    
    return bindGroup;
}

async function main() {
    try {
        const { device, context, format, canvas } = await initWebGPU();
        
        // Create buffers
        const particleBuffer = createParticleBuffer(device, canvas.width, canvas.height);
        const uniformBuffer = createUniformBuffer(device);
        
        // Create pipelines
        const renderPipeline = createRenderPipeline(device, format);
        const computePipeline = createComputePipeline(device);
        
        // Create bind group
        const bindGroup = createBindGroup(device, particleBuffer, uniformBuffer, computePipeline, renderPipeline);
        
        // Animation loop
        let lastTime = performance.now();
        
        function animate() {
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastTime) / 1000.0;
            lastTime = currentTime;
            
            // Update uniforms
            const uniformData = new Float32Array([
                currentTime / 1000.0, // time
                deltaTime, // deltaTime
                canvas.width, // resolution.x
                canvas.height, // resolution.y
                0.0, // gravity.x
                50.0, // gravity.y
                0.0, // padding
                0.0, // padding
            ]);
            device.queue.writeBuffer(uniformBuffer, 0, uniformData);
            
            // Compute pass
            const computeEncoder = device.createCommandEncoder();
            const computePass = computeEncoder.beginComputePass();
            computePass.setPipeline(computePipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(Math.ceil(NUM_PARTICLES / 64));
            computePass.end();
            
            // Render pass
            const renderEncoder = computeEncoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                    storeOp: 'store',
                }],
            });
            
            renderEncoder.setPipeline(renderPipeline);
            renderEncoder.setBindGroup(0, bindGroup);
            renderEncoder.draw(6 * NUM_PARTICLES); // 6 vertices per particle
            renderEncoder.end();
            
            device.queue.submit([computeEncoder.finish()]);
            
            requestAnimationFrame(animate);
        }
        
        animate();
    } catch (error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `
            <h2>WebGPU Error</h2>
            <p>${error.message}</p>
            <p style="margin-top: 10px; font-size: 12px;">
                Make sure you're using a browser that supports WebGPU (Chrome 113+, Edge 113+, or Chrome Canary with flags enabled).
            </p>
        `;
        document.body.appendChild(errorDiv);
        console.error(error);
    }
}

main();
