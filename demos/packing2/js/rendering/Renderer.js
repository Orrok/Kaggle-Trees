/**
 * WebGPU rendering operations
 */
export class Renderer {
    constructor(deviceManager, pipelineManager, bufferManager, treeGeometry) {
        this.deviceManager = deviceManager;
        this.pipelineManager = pipelineManager;
        this.bufferManager = bufferManager;
        this.treeGeometry = treeGeometry;
        this.context = deviceManager.getContext();
    }

    /**
     * Render a complete frame including compute and render passes
     * @param {number} deltaTime - Time since last frame
     * @param {number} frameCount - Current frame count
     * @param {Object} additionalParams - Additional parameters for uniforms
     * @param {boolean} shouldReadBack - Whether to copy data for CPU feedback
     * @param {boolean} shouldRunPhysics - Whether to run physics simulation
     * @returns {GPUCommandEncoder} The command encoder (for potential extensions)
     */
    render(deltaTime, frameCount, additionalParams = {}, shouldReadBack = false, shouldRunPhysics = true) {
        // Create command encoder for both compute and render passes
        const commandEncoder = this.deviceManager.getDevice().createCommandEncoder();

        // Compute pass (physics simulation) - only if requested
        if (shouldRunPhysics) {
            this.renderComputePass(commandEncoder, additionalParams);
        }

        // Optionally copy data back to CPU for feedback loop
        if (shouldReadBack) {
            this.copyDataForFeedback(commandEncoder);
        }

        // Render pass (visualization) - always run
        this.renderGraphicsPass(commandEncoder, additionalParams);

        return commandEncoder;
    }

    /**
     * Execute compute pass for physics simulation
     * @param {GPUCommandEncoder} commandEncoder - Command encoder
     * @param {Object} additionalParams - Additional uniform parameters
     */
    renderComputePass(commandEncoder, additionalParams) {
        console.log('[Renderer] Creating compute pass...');

        const computePassEncoder = commandEncoder.beginComputePass();
        computePassEncoder.setPipeline(this.pipelineManager.getComputePipeline());
        computePassEncoder.setBindGroup(0, this.pipelineManager.getBindGroup());

        // Dispatch compute workgroups (64 threads per workgroup)
        const treeCount = additionalParams.treeCount || 3;
        const workgroups = Math.ceil(treeCount / 64);
        console.log(`[Renderer] Dispatching ${workgroups} workgroups for ${treeCount} trees`);

        computePassEncoder.dispatchWorkgroups(workgroups);

        computePassEncoder.end();
        console.log('[Renderer] Compute pass ended');
    }

    /**
     * Copy tree buffer data back to CPU for feedback loop
     * @param {GPUCommandEncoder} commandEncoder - Command encoder
     */
    copyDataForFeedback(commandEncoder) {
        const treeBuffer = this.bufferManager.getTreeBuffer();
        const readBuffer = this.bufferManager.getReadBuffer();
        commandEncoder.copyBufferToBuffer(
            treeBuffer, 0,
            readBuffer, 0,
            treeBuffer.size
        );
    }

    /**
     * Execute render pass for visualization
     * @param {GPUCommandEncoder} commandEncoder - Command encoder
     * @param {Object} additionalParams - Additional parameters including tree count
     */
    renderGraphicsPass(commandEncoder, additionalParams = {}) {
        console.log('[Renderer] Creating render pass...');

        const currentTexture = this.context.getCurrentTexture();
        console.log(`[Renderer] Current texture format: ${currentTexture.format}, size: ${currentTexture.width}x${currentTexture.height}`);

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: currentTexture.createView(),
                clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 }, // Dark blue background
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        console.log('[Renderer] Setting up render pipeline...');
        // Set up render pipeline and resources
        renderPass.setPipeline(this.pipelineManager.getRenderPipeline());
        renderPass.setBindGroup(0, this.pipelineManager.getRenderBindGroup());
        // No vertex/index buffers - using hardcoded geometry like original

        // Instanced rendering - 16 vertices per tree instance (like original)
        const treeCount = additionalParams.treeCount || 3;
        console.log(`[Renderer] Drawing 16 vertices, ${treeCount} instances`);

        renderPass.draw(16, treeCount);

        renderPass.end();
        console.log('[Renderer] Render pass ended');
    }

    /**
     * Submit command buffer to GPU queue
     * @param {GPUCommandEncoder} commandEncoder - Command encoder to submit
     */
    submit(commandEncoder) {
        this.deviceManager.getDevice().queue.submit([commandEncoder.finish()]);
    }

    /**
     * Render a complete frame and submit immediately
     * @param {number} deltaTime - Time since last frame
     * @param {number} frameCount - Current frame count
     * @param {Object} additionalParams - Additional parameters for uniforms
     * @param {boolean} shouldReadBack - Whether to copy data for CPU feedback
     * @param {boolean} shouldRunPhysics - Whether to run physics simulation
     */
    renderFrame(deltaTime, frameCount, additionalParams = {}, shouldReadBack = false, shouldRunPhysics = true) {
        console.log(`[Renderer] Rendering frame ${frameCount} with ${additionalParams.treeCount} trees, physics: ${shouldRunPhysics}`);
        console.log(`[Renderer] Canvas size: ${this.getRenderTargetSize().width}x${this.getRenderTargetSize().height}`);

        const commandEncoder = this.render(deltaTime, frameCount, additionalParams, shouldReadBack, shouldRunPhysics);
        console.log('[Renderer] Command encoder created, submitting...');

        this.submit(commandEncoder);
        console.log('[Renderer] Frame submitted successfully');
    }

    /**
     * Get current render target size
     * @returns {Object} Size object with width and height
     */
    getRenderTargetSize() {
        if (!this.context) {
            throw new Error('Renderer context is not initialized');
        }
        const canvas = this.context.canvas;
        if (!canvas) {
            throw new Error('Renderer context canvas is not available');
        }
        return {
            width: canvas.width,
            height: canvas.height
        };
    }

    /**
     * Resize render target (handled by device manager, but provided here for convenience)
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        // This is typically handled by the device manager
        // but we provide access here for render-specific resize logic
        this.context.canvas.width = width;
        this.context.canvas.height = height;
    }
}
