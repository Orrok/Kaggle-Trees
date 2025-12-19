import { DELTA_TIME, LOG_FRAME_INTERVAL } from './constants.js';

/**
 * Main application orchestrator for the Tree Packer
 * Coordinates all components and manages application lifecycle
 */
export class TreePackerApp {
    constructor() {
        // Core components
        this.logger = null;
        this.treeGeometry = null;
        this.parameters = null;
        this.performanceMonitor = null;

        // WebGPU components
        this.deviceManager = null;
        this.bufferManager = null;
        this.pipelineManager = null;

        // Simulation components
        this.physicsSimulator = null;

        // Rendering components
        this.renderer = null;
        this.overlayRenderer = null;

        // UI components
        this.uiManager = null;

        // Canvas elements
        this.gpuCanvas = null;
        this.overlayCanvas = null;

        // Animation
        this.animationId = null;
        this.isRunning = false;
        this.frameCount = 0;

        // Score and feedback data
        this.currentProbX = 0.5; // Default compression probability
        this.currentScoreData = null;
        this.scoreHistory = [];

        // Wind data
        this.windMagnitude = 0;
        this.windDirection = 0;
    }

    /**
     * Initialize the application
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('Initializing Tree Packer application...');

            // Get canvas elements
            this.gpuCanvas = document.getElementById('gpuCanvas');
            this.overlayCanvas = document.getElementById('overlayCanvas');

            if (!this.gpuCanvas) {
                throw new Error('Required canvas element "gpuCanvas" not found');
            }
            if (!this.overlayCanvas) {
                throw new Error('Required canvas element "overlayCanvas" not found');
            }

            console.log('Canvas elements found:', !!this.gpuCanvas, !!this.overlayCanvas);

            // Initialize core components
            console.log('Initializing core components...');
            this.logger = new (await import('./utils/Logger.js')).Logger();
            this.treeGeometry = new (await import('./geometry/TreeGeometry.js')).TreeGeometry();
            this.parameters = new (await import('./simulation/SimulationParameters.js')).SimulationParameters();
            this.performanceMonitor = new (await import('./monitoring/PerformanceMonitor.js')).PerformanceMonitor();

            // Initialize WebGPU components
            console.log('Initializing WebGPU components...');
            this.deviceManager = new (await import('./webgpu/DeviceManager.js')).WebGPUDeviceManager(this.gpuCanvas);
            await this.deviceManager.init();
            console.log('WebGPU device initialized');

            this.bufferManager = new (await import('./webgpu/BufferManager.js')).BufferManager(this.deviceManager);
            this.pipelineManager = new (await import('./webgpu/PipelineManager.js')).PipelineManager(this.deviceManager, this.treeGeometry);

            // Initialize simulation components
            console.log('Initializing simulation components...');
            this.physicsSimulator = new (await import('./simulation/PhysicsSimulator.js')).PhysicsSimulator(
                this.bufferManager,
                this.parameters,
                this.treeGeometry,
                this.logger
            );

            // Initialize rendering components
            console.log('Initializing rendering components...');
            this.renderer = new (await import('./rendering/Renderer.js')).Renderer(
                this.deviceManager,
                this.pipelineManager,
                this.bufferManager,
                this.treeGeometry
            );
            this.overlayRenderer = new (await import('./rendering/OverlayRenderer.js')).OverlayRenderer(
                this.overlayCanvas,
                this.parameters
            );

            // Initialize UI components
            console.log('Initializing UI components...');
            this.uiManager = new (await import('./ui/UIManager.js')).UIManager(
                this.parameters,
                this.physicsSimulator,
                this.performanceMonitor,
                this
            );

            // Setup components
            console.log('Setting up components...');
            this.setupComponents();

            // Initialize simulation (like original)
            console.log('Initializing simulation...');
            this.physicsSimulator.reset(); // Spawn initial trees
            this.startRenderLoop(); // Start render loop for continuous rendering

            this.logger.info('Tree Packer application initialized successfully');
            console.log('Tree Packer application initialized successfully');

        } catch (error) {
            console.error('Failed to initialize Tree Packer:', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Setup component interconnections
     */
    setupComponents() {
        // Initialize buffers and pipelines
        this.bufferManager.initBuffers(this.parameters.get('treeCount'), this.treeGeometry);
        this.pipelineManager.initPipelines();
        this.pipelineManager.updateBindGroup(this.bufferManager);

        // Setup UI and connect debug logging
        this.uiManager.init();
        const debugLogElement = document.getElementById('debug-log');
        if (debugLogElement) {
            this.logger.setDebugElement(debugLogElement);
        }

        // Initial canvas resize
        this.resizeCanvas();

        // Start the render loop (rendering always runs, physics only when playing)
        this.startRenderLoop();
    }

    /**
     * Start the physics simulation
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.logger.info('Physics simulation started');
    }

    /**
     * Stop the physics simulation
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.logger.info('Physics simulation stopped');
    }

    /**
     * Step one frame of the simulation
     */
    async step() {
        // Allow stepping at any time

        // Update performance monitor (simulate timestamp)
        this.performanceMonitor.update(performance.now());

        // Fixed timestep for physics stability
        const deltaTime = DELTA_TIME;
        this.frameCount++;

        // Handle simulation reset if needed
        if (this.physicsSimulator.needsResetSimulation()) {
            console.log('Resetting simulation...');
            this.physicsSimulator.reset();
        }

            // Update uniforms with current parameters
            const additionalParams = this.getAdditionalUniformParams();
            this.physicsSimulator.setFeedbackFrameCount(this.frameCount);

            // Override compression with ratchet logic
            const effectiveCompression = additionalParams.effectiveCompression;
            const uniformParams = {
                ...additionalParams,
                compression: effectiveCompression // Use ratcheted compression
            };

            this.physicsSimulator.updateUniforms(deltaTime, this.frameCount, uniformParams);

        // Render frame always for stepping (single step, so always render)
        this.renderer.renderFrame(deltaTime, this.frameCount, additionalParams, false, true);

        this.logger.info(`Stepped to frame ${this.frameCount}`);
    }

    /**
     * Start the main render loop
     */
    startRenderLoop() {
        const renderLoop = async (timestamp) => {
            // Always update uniforms and UI, but only run physics when playing
            const additionalParams = this.getAdditionalUniformParams();
            this.physicsSimulator.setFeedbackFrameCount(this.frameCount);
            this.physicsSimulator.updateUniforms(DELTA_TIME, this.frameCount, additionalParams);

            // Handle simulation reset if needed
            if (this.physicsSimulator.needsResetSimulation()) {
                console.log('Resetting simulation...');
                this.physicsSimulator.reset();
            }

            // Run physics simulation if playing (like original step())
            if (this.isRunning) {
                // Note: Physics is run in the renderer.renderFrame call
                // Update score every 10 frames (like original updateScore())
                if (this.frameCount % 10 === 0) {
                    this.updateScore();
                }
            }

            // Get render frequency from parameters
            const renderFrequency = this.parameters.get('renderFrequency');

            // Only render visually every N frames based on render frequency
            const shouldRender = (this.frameCount % renderFrequency === 0);

            if (shouldRender) {
                // Render frame always (like original render()) - run physics only when playing
                this.renderer.renderFrame(DELTA_TIME, this.frameCount, additionalParams, false, this.isRunning);

                // Update performance monitor and UI on render frames
                this.performanceMonitor.update(timestamp);
                this.updateUI();
                this.drawOverlay();
            }

            // Debug logging every 60 frames
            if (this.frameCount % LOG_FRAME_INTERVAL === 0) {
                const renderStatus = shouldRender ? 'rendering' : 'skipping render';
                console.log(`Frame ${this.frameCount}: ${renderStatus} ${additionalParams.treeCount} trees (every ${renderFrequency} frames)`);
            }

            this.frameCount++;
            this.animationId = requestAnimationFrame(renderLoop);
        };

        this.animationId = requestAnimationFrame(renderLoop);
    }

    /**
     * Get additional parameters for uniforms (compression probabilities, etc.)
     * @returns {Object} Additional uniform parameters
     */
    getAdditionalUniformParams() {
        // Use calculated probX from score feedback, fallback to 0.5
        let probX = this.currentProbX || 0.5;
        let probY = 1.0 - probX; // probY is inverse of probX for aspect ratio control
        let centerX = 0.0;
        let centerY = 0.0;

        return {
            probX,
            probY,
            centerX,
            centerY,
            treeCount: this.parameters.get('treeCount'),
            // Apply compression ratchet: stop compression if colliding
            effectiveCompression: this.getEffectiveCompression()
        };
    }

    /**
     * Get effective compression value with ratchet logic
     * @returns {number} Effective compression (0.0 if colliding, slider value otherwise)
     */
    getEffectiveCompression() {
        // Ratchet logic: if collisions detected, stop compression
        if (this.currentScoreData && this.currentScoreData.collisionCount > 0) {
            return 0.0;
        }
        // Otherwise use the slider value
        return this.parameters.get('compression');
    }

    /**
     * Update score calculation (called every 10 frames like original)
     */
    async updateScore() {
        try {
            const scoreData = await this.physicsSimulator.updateScore();
            if (scoreData) {
                // Update probX for adaptive compression based on current bounds
                this.updateProbX(scoreData.probX);

                // Store score data for UI and graph updates
                this.handleScoreUpdate(scoreData);
            }
        } catch (error) {
            this.logger.error(`Score calculation error: ${error.message}`);
        }
    }

    /**
     * Schedule feedback processing for next frame (score calculation and bounds)
     */
    async scheduleFeedbackProcessing() {
        // This method is kept for compatibility but updateScore() is called directly now
        await this.updateScore();
    }

    /**
     * Update probX for adaptive compression
     * @param {number} probX - New compression probability based on bounds
     */
    updateProbX(probX) {
        // Store probX for use in getAdditionalUniformParams
        this.currentProbX = probX;
    }

    /**
     * Handle score update from feedback loop
     * @param {Object} scoreData - Score data including bounds, score, collisionCount, etc.
     */
    handleScoreUpdate(scoreData) {
        // Store score data for UI updates
        this.currentScoreData = scoreData;

        // Store wind data
        this.windMagnitude = scoreData.windMagnitude || 0;
        this.windDirection = scoreData.windDirection || 0;

        // Update UI with score information
        this.uiManager.updateScore(scoreData);

        // Store score history for graph visualization
        if (!this.scoreHistory) {
            this.scoreHistory = [];
        }
        this.scoreHistory.push(scoreData.score);
        if (this.scoreHistory.length > 50) {
            this.scoreHistory.shift(); // Keep only last 50 scores
        }
    }

    /**
     * Update UI with current stats
     */
    updateUI() {
        const stats = {
            fps: this.performanceMonitor.getFPS(),
            treeCount: this.parameters.get('treeCount'),
            packRatio: this.currentScoreData ? (this.currentScoreData.width > 0 && this.currentScoreData.height > 0 ?
                Math.min(this.currentScoreData.width, this.currentScoreData.height) /
                Math.max(this.currentScoreData.width, this.currentScoreData.height) : 0) : 0
        };
        this.uiManager.updateStats(stats);
    }

    /**
     * Draw overlay elements
     */
    drawOverlay() {
        // Use bounds from score calculation if available, otherwise from physics simulator
        const bounds = this.currentScoreData && this.currentScoreData.bounds ?
            this.currentScoreData.bounds : this.physicsSimulator.getCurrentBounds();
        const probX = this.currentProbX || 0.5;
        const scoreHistory = this.scoreHistory || [];
        const stagnationCount = this.currentScoreData ? (this.currentScoreData.stagnationCount || 0) : 0;

        // Pass wind data to overlay renderer
        const windData = {
            magnitude: this.windMagnitude,
            direction: this.windDirection
        };

        this.overlayRenderer.drawOverlay(bounds, probX, scoreHistory, stagnationCount, windData);
    }

    /**
     * Handle canvas resize
     */
    resizeCanvas() {
        const rect = this.gpuCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Update canvas sizes
        this.gpuCanvas.width = rect.width * dpr;
        this.gpuCanvas.height = rect.height * dpr;
        this.overlayCanvas.width = rect.width;
        this.overlayCanvas.height = rect.height;

        // Update aspect ratio parameter
        const aspect = rect.width / rect.height;
        this.parameters.set('aspect', aspect);

        this.logger.info(`Canvas resized: ${this.gpuCanvas.width}x${this.gpuCanvas.height}`);
    }

    /**
     * Reset the simulation
     */
    reset() {
        this.physicsSimulator.markForReset();
        this.logger.info('Simulation reset requested');
    }

    /**
     * Handle tree count change - update buffers, bind groups, and mark for reset
     * @param {number} newTreeCount - New tree count
     */
    handleTreeCountChange(newTreeCount) {
        const resized = this.physicsSimulator.handleTreeCountChange(newTreeCount);
        if (resized) {
            // Update bind groups when buffers are resized
            this.pipelineManager.updateBindGroup(this.bufferManager);
            this.logger.info(`Buffers resized for ${newTreeCount} trees, bind groups updated`);
        }
    }

    /**
     * Get application state
     * @returns {Object} Application state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            fps: this.performanceMonitor.getFPS(),
            treeCount: this.parameters.get('treeCount'),
            parameters: this.parameters.getAll(),
            bounds: this.physicsSimulator.getCurrentBounds()
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stop();

        if (this.uiManager) {
            this.uiManager.destroy();
        }

        if (this.bufferManager) {
            this.bufferManager.destroy();
        }

        if (this.deviceManager) {
            this.deviceManager.destroy();
        }

        this.logger.info('Tree Packer application destroyed');
    }
}
