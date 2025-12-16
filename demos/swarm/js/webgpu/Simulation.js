import { BufferManager } from './BufferManager.js';
import { PipelineManager } from './PipelineManager.js';
import { ShaderLoader } from './ShaderLoader.js';

export class Simulation {
    constructor(deviceManager, inputManager) {
        this.deviceManager = deviceManager;
        this.inputManager = inputManager;
        this.device = deviceManager.device;
        
        this.bufferManager = new BufferManager(this.device);
        this.pipelineManager = new PipelineManager(this.device, deviceManager.format);
        
        this.MAX_PARTICLE_COUNT = 1000000;
        this.activeParticleCount = 30000;
        
        this.particleBuffer = null;
        this.uniformBuffer = null;
        this.vertexBuffer = null;
        
        this.computePipeline = null;
        this.renderPipeline = null;
        
        this.computeBG = null;
        this.renderBG = null;
        
        this.uniformValues = new Float32Array(8);
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        
        this.onFPSUpdate = null;
    }

    async init() {
        // Load Shaders
        const shaders = await ShaderLoader.loadShaders();
        
        // Create Buffers
        this.initBuffers();
        
        // Create Pipelines
        this.initPipelines(shaders);
        
        // Create BindGroups
        this.initBindGroups();
    }

    initBuffers() {
        // Particles
        this.particleBuffer = this.bufferManager.createStorageBuffer(this.MAX_PARTICLE_COUNT * 32, true);
        const pData = new Float32Array(this.particleBuffer.getMappedRange());
        for (let i = 0; i < this.MAX_PARTICLE_COUNT; i++) {
            const off = i * 8;
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 0.8; 
            pData[off] = Math.cos(angle) * r;   
            pData[off+1] = Math.sin(angle) * r; 
            pData[off+2] = 0; pData[off+3] = 0; 
            pData[off+4] = 0; pData[off+5] = 0; pData[off+6] = 1; pData[off+7] = 1;
        }
        this.particleBuffer.unmap();

        // Uniforms
        this.uniformBuffer = this.bufferManager.createUniformBuffer(32);

        // Quad Vertex Buffer (for instanced rendering)
        const quadData = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        this.vertexBuffer = this.bufferManager.createVertexBuffer(quadData);
    }

    initPipelines(shaders) {
        // Bind Group Layouts
        const computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
            ]
        });

        const renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }
            ]
        });

        this.computePipeline = this.pipelineManager.createComputePipeline(shaders.compute, [computeBindGroupLayout]);
        
        this.renderPipeline = this.pipelineManager.createRenderPipeline(shaders.render, [renderBindGroupLayout], [{
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
        }]);

        this.computeBindGroupLayout = computeBindGroupLayout;
        this.renderBindGroupLayout = renderBindGroupLayout;
    }

    initBindGroups() {
        this.computeBG = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.particleBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuffer } }
            ]
        });

        this.renderBG = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.particleBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuffer } }
            ]
        });
    }

    setParticleCount(count) {
        this.activeParticleCount = count;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    }

    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        this.frameCount++;
        if (now - this.lastTime >= 1000) {
            if (this.onFPSUpdate) this.onFPSUpdate(this.frameCount);
            this.frameCount = 0;
            this.lastTime = now;
        }

        this.updateUniforms(now);
        this.render();

        requestAnimationFrame(() => this.loop());
    }

    updateUniforms(now) {
        this.uniformValues[0] = now / 1000;
        this.uniformValues[1] = this.deviceManager.canvas.width;
        this.uniformValues[2] = this.deviceManager.canvas.height;
        this.uniformValues[3] = this.inputManager.touchX;
        this.uniformValues[4] = this.inputManager.touchY;
        this.uniformValues[5] = this.inputManager.isTouching;
        this.uniformValues[6] = this.activeParticleCount;
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
    }

    render() {
        const encoder = this.device.createCommandEncoder();

        // 1. Compute
        const cPass = encoder.beginComputePass();
        cPass.setPipeline(this.computePipeline);
        cPass.setBindGroup(0, this.computeBG);
        cPass.dispatchWorkgroups(Math.ceil(this.activeParticleCount/64));
        cPass.end();

        // 2. Render
        const rPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.deviceManager.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.01, a: 1.0 }, 
                loadOp: 'clear', storeOp: 'store'
            }]
        });
        rPass.setPipeline(this.renderPipeline);
        rPass.setBindGroup(0, this.renderBG);
        rPass.setVertexBuffer(0, this.vertexBuffer);
        rPass.draw(6, this.activeParticleCount); 
        rPass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}
