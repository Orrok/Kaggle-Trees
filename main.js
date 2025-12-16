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

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
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
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
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

function createRenderBindGroup(device, particleBuffer, uniformBuffer, renderPipeline) {
    const bindGroupLayout = renderPipeline.getBindGroupLayout(0);
    
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
        
        // Add error listener for WebGPU validation errors
        device.addEventListener('uncapturederror', (event) => {
            console.error('WebGPU uncaptured error:', event.error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = `
                <h2>WebGPU Validation Error</h2>
                <p>${event.error.message}</p>
            `;
            document.body.appendChild(errorDiv);
        });
        
        // Create buffers
        const particleBuffer = createParticleBuffer(device, canvas.width, canvas.height);
        const uniformBuffer = createUniformBuffer(device);
        
        // Create pipelines
        const renderPipeline = createRenderPipeline(device, format);
        const computePipeline = createComputePipeline(device);
        
        // Create bind groups
        const computeBindGroup = createBindGroup(device, particleBuffer, uniformBuffer, computePipeline, renderPipeline);
        const renderBindGroup = createRenderBindGroup(device, particleBuffer, uniformBuffer, renderPipeline);
        
        // Animation loop
        let lastTime = performance.now();
        
        function animate() {
            try {
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
                computePass.setBindGroup(0, computeBindGroup);
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
                renderEncoder.setBindGroup(0, renderBindGroup);
                renderEncoder.draw(6 * NUM_PARTICLES); // 6 vertices per particle
                renderEncoder.end();
                
                device.queue.submit([computeEncoder.finish()]);
                
                requestAnimationFrame(animate);
            } catch (error) {
                console.error('Animation error:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `
                    <h2>Animation Error</h2>
                    <p>${error.message}</p>
                `;
                document.body.appendChild(errorDiv);
            }
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

// WebGPU Validation Functions
let validationOutput = null;
let webGPUContext = null;

function logValidation(message, type = 'info') {
    if (!validationOutput) {
        validationOutput = document.getElementById('validation-output');
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    const className = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    
    validationOutput.className = `validation-output ${className}`;
    validationOutput.textContent += `[${timestamp}] ${prefix} ${message}\n`;
    validationOutput.scrollTop = validationOutput.scrollHeight;
}

function clearValidationOutput() {
    if (!validationOutput) {
        validationOutput = document.getElementById('validation-output');
    }
    validationOutput.textContent = '';
    validationOutput.className = 'validation-output info';
}

async function testWebGPUAPI() {
    clearValidationOutput();
    logValidation('Testing WebGPU API availability...', 'info');
    
    try {
        if (!navigator.gpu) {
            throw new Error('navigator.gpu is not available');
        }
        logValidation('✓ navigator.gpu is available', 'success');
        
        const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
        logValidation(`✓ Preferred canvas format: ${preferredFormat}`, 'success');
        
        return { success: true, format: preferredFormat };
    } catch (error) {
        logValidation(`✗ WebGPU API test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testAdapter() {
    clearValidationOutput();
    logValidation('Testing GPU Adapter...', 'info');
    
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU not available');
        }
        
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('Failed to get adapter');
        }
        
        logValidation('✓ Adapter obtained successfully', 'success');
        
        const features = Array.from(adapter.features);
        logValidation(`✓ Adapter features (${features.length}): ${features.slice(0, 5).join(', ')}${features.length > 5 ? '...' : ''}`, 'success');
        
        const limits = adapter.limits;
        logValidation(`✓ Max compute workgroup storage size: ${limits.maxComputeWorkgroupStorageSize}`, 'success');
        logValidation(`✓ Max buffer size: ${(limits.maxBufferSize / 1024 / 1024).toFixed(2)} MB`, 'success');
        logValidation(`✓ Max compute workgroup size X: ${limits.maxComputeWorkgroupSizeX}`, 'success');
        
        return { success: true, adapter };
    } catch (error) {
        logValidation(`✗ Adapter test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testDevice() {
    clearValidationOutput();
    logValidation('Testing GPU Device...', 'info');
    
    try {
        const adapterResult = await testAdapter();
        if (!adapterResult.success) {
            throw new Error('Adapter not available');
        }
        
        const adapter = adapterResult.adapter;
        const device = await adapter.requestDevice();
        if (!device) {
            throw new Error('Failed to get device');
        }
        
        logValidation('✓ Device obtained successfully', 'success');
        
        device.addEventListener('uncapturederror', (event) => {
            logValidation(`⚠ Device error: ${event.error.message}`, 'error');
        });
        
        const features = Array.from(device.features);
        logValidation(`✓ Device features (${features.length}): ${features.slice(0, 5).join(', ')}${features.length > 5 ? '...' : ''}`, 'success');
        
        const limits = device.limits;
        logValidation(`✓ Max buffer size: ${(limits.maxBufferSize / 1024 / 1024).toFixed(2)} MB`, 'success');
        logValidation(`✓ Max compute workgroup size X: ${limits.maxComputeWorkgroupSizeX}`, 'success');
        
        webGPUContext = { adapter, device };
        return { success: true, device, adapter };
    } catch (error) {
        logValidation(`✗ Device test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testBuffer() {
    clearValidationOutput();
    logValidation('Testing Buffer Creation and Readback...', 'info');
    
    try {
        const deviceResult = await testDevice();
        if (!deviceResult.success) {
            throw new Error('Device not available');
        }
        
        const device = deviceResult.device;
        
        // Create a buffer with test data
        const testData = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0]);
        const buffer = device.createBuffer({
            size: testData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        
        logValidation('✓ Buffer created successfully', 'success');
        logValidation(`✓ Buffer size: ${buffer.size} bytes`, 'success');
        
        // Write data to buffer
        device.queue.writeBuffer(buffer, 0, testData);
        logValidation('✓ Data written to buffer', 'success');
        
        // Read data back
        const readBuffer = device.createBuffer({
            size: testData.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, testData.byteLength);
        device.queue.submit([encoder.finish()]);
        
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedData = new Float32Array(readBuffer.getMappedRange());
        readBuffer.unmap();
        
        const matches = Array.from(mappedData).every((val, i) => Math.abs(val - testData[i]) < 0.001);
        
        if (matches) {
            logValidation(`✓ Buffer readback successful: [${Array.from(mappedData).join(', ')}]`, 'success');
        } else {
            throw new Error(`Data mismatch: expected [${Array.from(testData).join(', ')}], got [${Array.from(mappedData).join(', ')}]`);
        }
        
        return { success: true };
    } catch (error) {
        logValidation(`✗ Buffer test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testComputeShader() {
    clearValidationOutput();
    logValidation('Testing Compute Shader...', 'info');
    
    try {
        const deviceResult = await testDevice();
        if (!deviceResult.success) {
            throw new Error('Device not available');
        }
        
        const device = deviceResult.device;
        
        // Simple compute shader that doubles values
        const computeShaderCode = `
            @group(0) @binding(0) var<storage, read_write> data: array<f32>;
            
            @compute @workgroup_size(64)
            fn cs_main(@builtin(global_invocation_id) id: vec3<u32>) {
                let index = id.x;
                if (index >= 10u) { return; }
                data[index] = data[index] * 2.0;
            }
        `;
        
        const module = device.createShaderModule({ code: computeShaderCode });
        logValidation('✓ Compute shader module created', 'success');
        
        const pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module,
                entryPoint: 'cs_main',
            },
        });
        logValidation('✓ Compute pipeline created', 'success');
        
        // Create test buffer
        const testData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const buffer = device.createBuffer({
            size: testData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, testData);
        
        // Create bind group
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer } }],
        });
        logValidation('✓ Bind group created', 'success');
        
        // Dispatch compute shader
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(10 / 64));
        pass.end();
        device.queue.submit([encoder.finish()]);
        logValidation('✓ Compute shader executed', 'success');
        
        // Read back results
        const readBuffer = device.createBuffer({
            size: testData.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        
        const readEncoder = device.createCommandEncoder();
        readEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, testData.byteLength);
        device.queue.submit([readEncoder.finish()]);
        
        await readBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readBuffer.getMappedRange());
        readBuffer.unmap();
        
        const expected = testData.map(x => x * 2);
        const correct = Array.from(result).every((val, i) => Math.abs(val - expected[i]) < 0.001);
        
        if (correct) {
            logValidation(`✓ Compute shader result correct: [${Array.from(result).slice(0, 5).join(', ')}...]`, 'success');
        } else {
            throw new Error(`Result mismatch: expected [${Array.from(expected).join(', ')}], got [${Array.from(result).join(', ')}]`);
        }
        
        return { success: true };
    } catch (error) {
        logValidation(`✗ Compute shader test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testRenderPipeline() {
    clearValidationOutput();
    logValidation('Testing Render Pipeline...', 'info');
    
    try {
        const deviceResult = await testDevice();
        if (!deviceResult.success) {
            throw new Error('Device not available');
        }
        
        const device = deviceResult.device;
        const canvas = document.getElementById('canvas');
        const context = canvas.getContext('webgpu');
        
        if (!context) {
            throw new Error('Failed to get WebGPU context');
        }
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device,
            format,
        });
        
        logValidation('✓ Canvas context configured', 'success');
        
        // Simple render shaders
        const vertexShader = `
            @vertex
            fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
                let positions = array<vec2<f32>, 3>(
                    vec2<f32>(0.0, 0.5),
                    vec2<f32>(-0.5, -0.5),
                    vec2<f32>(0.5, -0.5)
                );
                return vec4<f32>(positions[index], 0.0, 1.0);
            }
        `;
        
        const fragmentShader = `
            @fragment
            fn fs_main() -> @location(0) vec4<f32> {
                return vec4<f32>(1.0, 0.0, 1.0, 1.0);
            }
        `;
        
        const module = device.createShaderModule({ code: vertexShader + fragmentShader });
        logValidation('✓ Shader module created', 'success');
        
        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module,
                entryPoint: 'vs_main',
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
        logValidation('✓ Render pipeline created', 'success');
        
        // Render a frame
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.2, g: 0.2, b: 0.3, a: 1.0 },
                storeOp: 'store',
            }],
        });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
        
        logValidation('✓ Render pass executed successfully', 'success');
        logValidation('✓ A magenta triangle should be visible on the canvas', 'success');
        
        return { success: true };
    } catch (error) {
        logValidation(`✗ Render pipeline test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function testTexture() {
    clearValidationOutput();
    logValidation('Testing Texture Operations...', 'info');
    
    try {
        const deviceResult = await testDevice();
        if (!deviceResult.success) {
            throw new Error('Device not available');
        }
        
        const device = deviceResult.device;
        
        // Create a 2x2 texture
        const texture = device.createTexture({
            size: { width: 2, height: 2 },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        logValidation('✓ Texture created (2x2 rgba8unorm)', 'success');
        
        // Write test data (red, green, blue, white)
        const testData = new Uint8Array([
            255, 0, 0, 255,  // Red
            0, 255, 0, 255,  // Green
            0, 0, 255, 255,  // Blue
            255, 255, 255, 255 // White
        ]);
        
        device.queue.writeTexture(
            { texture },
            testData,
            { bytesPerRow: 8, rowsPerImage: 2 },
            { width: 2, height: 2 }
        );
        logValidation('✓ Texture data written', 'success');
        
        // Create a sampler
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        logValidation('✓ Sampler created', 'success');
        
        logValidation('✓ Texture operations successful', 'success');
        
        return { success: true };
    } catch (error) {
        logValidation(`✗ Texture test failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    clearValidationOutput();
    logValidation('Running all WebGPU validation tests...', 'info');
    logValidation('', 'info');
    
    const tests = [
        { name: 'WebGPU API', fn: testWebGPUAPI },
        { name: 'Adapter', fn: testAdapter },
        { name: 'Device', fn: testDevice },
        { name: 'Buffer', fn: testBuffer },
        { name: 'Compute Shader', fn: testComputeShader },
        { name: 'Render Pipeline', fn: testRenderPipeline },
        { name: 'Texture', fn: testTexture },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        logValidation(`\n--- ${test.name} Test ---`, 'info');
        const result = await test.fn();
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logValidation(`\n=== Test Summary ===`, 'info');
    logValidation(`✓ Passed: ${passed}`, 'success');
    if (failed > 0) {
        logValidation(`✗ Failed: ${failed}`, 'error');
    }
    logValidation(`Total: ${tests.length}`, 'info');
}

// Setup validation button handlers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hello-world').addEventListener('click', () => {
        alert('Hello World! WebGPU Simulation Ready.');
    });
    document.getElementById('test-all').addEventListener('click', runAllTests);
    document.getElementById('test-api').addEventListener('click', testWebGPUAPI);
    document.getElementById('test-adapter').addEventListener('click', testAdapter);
    document.getElementById('test-device').addEventListener('click', testDevice);
    document.getElementById('test-buffer').addEventListener('click', testBuffer);
    document.getElementById('test-compute').addEventListener('click', testComputeShader);
    document.getElementById('test-render').addEventListener('click', testRenderPipeline);
    document.getElementById('test-texture').addEventListener('click', testTexture);
});

main();
