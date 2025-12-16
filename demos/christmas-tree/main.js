import { DeviceManager } from '../../js/webgpu/DeviceManager.js';
import { BufferManager } from '../../js/webgpu/BufferManager.js';
import { PipelineManager } from '../../js/webgpu/PipelineManager.js';
import { ShaderLoader } from '../../js/webgpu/ShaderLoader.js';

class ChristmasTreeDemo {
    constructor() {
        this.deviceManager = null;
        this.device = null;
        this.bufferManager = null;
        this.pipelineManager = null;
        
        this.vertexBuffer = null;
        this.renderPipeline = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        
        this.isRunning = false;
    }

    async init() {
        try {
            // Initialize device
            this.deviceManager = new DeviceManager();
            await this.deviceManager.init('gpuCanvas');
            this.device = this.deviceManager.device;
            
            this.bufferManager = new BufferManager(this.device);
            this.pipelineManager = new PipelineManager(this.device, this.deviceManager.format);
            
            // Create Christmas tree geometry (15 lines)
            this.createTreeGeometry();
            
            // Load and create shaders
            await this.createShaders();
            
            // Start rendering
            this.start();
            
        } catch (e) {
            console.error('Error initializing Christmas Tree demo:', e);
            alert("Error initializing WebGPU: " + e.message);
        }
    }

    createTreeGeometry() {
        // Create a 15-line Kaggle Christmas tree pattern
        // Each line is represented as triangles (for filled look)
        const vertices = [];
        const colors = []; // Store color indices for each vertex
        
        // Tree parameters
        const centerX = 0;
        const baseY = -0.7;
        const treeHeight = 1.2;
        const maxWidth = 0.7;
        const lineHeight = treeHeight / 15;
        
        // Generate 15 lines of the tree
        for (let line = 0; line < 15; line++) {
            const y = baseY + (line * lineHeight);
            const width = (maxWidth * (line + 1)) / 15;
            const halfWidth = width / 2;
            
            // Color: 0 = green tree, 1 = star, 2 = trunk
            let colorType = 0;
            
            // Add star at top (line 14)
            if (line === 14) {
                colorType = 1;
            }
            
            // Create a rectangle (two triangles) for each line
            // Top-left, top-right, bottom-left
            vertices.push(
                centerX - halfWidth, y + lineHeight,
                centerX + halfWidth, y + lineHeight,
                centerX - halfWidth, y
            );
            colors.push(colorType, colorType, colorType);
            
            // Top-right, bottom-right, bottom-left
            vertices.push(
                centerX + halfWidth, y + lineHeight,
                centerX + halfWidth, y,
                centerX - halfWidth, y
            );
            colors.push(colorType, colorType, colorType);
        }
        
        // Add trunk (centered at bottom)
        const trunkWidth = 0.06;
        const trunkHeight = 0.1;
        const trunkY = baseY - trunkHeight;
        
        vertices.push(
            centerX - trunkWidth/2, trunkY + trunkHeight,
            centerX + trunkWidth/2, trunkY + trunkHeight,
            centerX - trunkWidth/2, trunkY
        );
        colors.push(2, 2, 2);
        
        vertices.push(
            centerX + trunkWidth/2, trunkY + trunkHeight,
            centerX + trunkWidth/2, trunkY,
            centerX - trunkWidth/2, trunkY
        );
        colors.push(2, 2, 2);
        
        // Create vertex buffer with interleaved position and color type
        const vertexData = new Float32Array(vertices.length + colors.length);
        for (let i = 0; i < vertices.length / 2; i++) {
            vertexData[i * 3] = vertices[i * 2];
            vertexData[i * 3 + 1] = vertices[i * 2 + 1];
            vertexData[i * 3 + 2] = colors[i];
        }
        
        this.vertexBuffer = this.bufferManager.createVertexBuffer(vertexData);
        this.vertexCount = vertices.length / 2;
    }

    async createShaders() {
        // Load shaders
        const shaderCode = await this.loadShader();
        
        // Create uniform buffer for screen dimensions
        this.uniformBuffer = this.bufferManager.createUniformBuffer(16);
        
        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }
            ]
        });
        
        // Create render pipeline
        this.renderPipeline = this.pipelineManager.createRenderPipeline(
            shaderCode,
            [bindGroupLayout],
            [{
                arrayStride: 12, // 2 floats for position + 1 float for color type
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x2' },
                    { shaderLocation: 1, offset: 8, format: 'float32' }
                ]
            }]
        );
        
        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                }
            ]
        });
    }

    async loadShader() {
        // Try to load from relative path first, fallback to inline
        try {
            const response = await fetch('../../shaders/christmas-tree.wgsl');
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            console.log('Loading shader inline');
        }
        
        // Inline shader as fallback
        return `
@group(0) @binding(0) var<uniform> screenParams : vec2<f32>;

struct VertexInput {
    @location(0) position : vec2<f32>,
    @location(1) colorType : f32,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

@vertex
fn vertMain(input : VertexInput) -> VertexOutput {
    let aspect = screenParams.x / screenParams.y;
    
    var output : VertexOutput;
    // Transform to clip space
    output.position = vec4<f32>(
        input.position.x / aspect,
        input.position.y,
        0.0,
        1.0
    );
    
    // Color based on color type
    if (input.colorType < 0.5) {
        // Tree - green gradient
        let y = input.position.y;
        let greenIntensity = 0.2 + (y + 0.7) * 0.4;
        output.color = vec4<f32>(0.0, greenIntensity, 0.05, 1.0);
    } else if (input.colorType < 1.5) {
        // Star/ornament - gold/yellow
        output.color = vec4<f32>(1.0, 0.84, 0.0, 1.0);
    } else {
        // Trunk - brown
        output.color = vec4<f32>(0.4, 0.25, 0.1, 1.0);
    }
    
    return output;
}

@fragment
fn fragMain(@location(0) color : vec4<f32>) -> @location(0) vec4<f32> {
    return color;
}
`;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateUniforms();
        this.render();
    }

    updateUniforms() {
        const canvas = this.deviceManager.canvas;
        const uniformData = new Float32Array([
            canvas.width,
            canvas.height,
            0, // padding
            0  // padding
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    render() {
        if (!this.isRunning) return;
        
        const encoder = this.device.createCommandEncoder();
        
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.deviceManager.context.getCurrentTexture().createView(),
                clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        
        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.draw(this.vertexCount);
        renderPass.end();
        
        this.device.queue.submit([encoder.finish()]);
        
        // Only render once for static tree, but keep loop for potential future animations
        requestAnimationFrame(() => this.render());
    }
}

// Initialize demo
const demo = new ChristmasTreeDemo();
demo.init();
