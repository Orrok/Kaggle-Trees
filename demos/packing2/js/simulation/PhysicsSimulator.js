import { FLOATS_PER_TREE } from '../constants.js';

/**
 * Physics simulation management and CPU feedback loop
 */
export class PhysicsSimulator {

    constructor(bufferManager, simulationParameters, treeGeometry, logger) {
        this.bufferManager = bufferManager;
        this.parameters = simulationParameters;
        this.treeGeometry = treeGeometry;
        this.logger = logger;

        // Feedback loop state
        this.feedbackFrameCount = 0;
        this.currentBounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
        this.targetAspectRatio = 1.0;
        this.needsReset = false;
        this.isProcessingFeedback = false;

        // Score tracking
        this.bestScore = Infinity;
        this.stagnationCount = 0;
    }

    /**
     * Reset simulation with new initial conditions
     */
    reset() {
        // Cancel any pending feedback processing
        this.isProcessingFeedback = false;
        const treeCount = this.parameters.get('treeCount');
        const treeData = new Float32Array(treeCount * FLOATS_PER_TREE);
        const spread = Math.sqrt(treeCount) * 2.0;

        for (let i = 0; i < treeCount; i++) {
            const offset = i * FLOATS_PER_TREE;
            // Match original spawn logic: only initialize position and rotation
            treeData[offset + 0] = (Math.random() - 0.5) * spread; // position.x
            treeData[offset + 1] = (Math.random() - 0.5) * spread; // position.y
            treeData[offset + 2] = 0.0; // velocity.x (0)
            treeData[offset + 3] = 0.0; // velocity.y (0)
            treeData[offset + 4] = Math.random() * 6.28; // rotation (0-2π)
            treeData[offset + 5] = 0.0; // angular_velocity (0)
            treeData[offset + 6] = 0.0; // collision flag (0)
            treeData[offset + 7] = 0.0; // padding (0)
        }

        this.bufferManager.writeBuffer(this.bufferManager.getTreeBuffer(), treeData);

        // Reset score tracking
        this.bestScore = Infinity;
        this.stagnationCount = 0;

        this.logger.info('Simulation reset');
        this.needsReset = false;
    }

    /**
     * Check if simulation needs reset
     * @returns {boolean} True if reset is needed
     */
    needsResetSimulation() {
        return this.needsReset;
    }

    /**
     * Mark simulation for reset
     */
    markForReset() {
        this.needsReset = true;
    }

    /**
     * Update uniform buffer with current parameters
     * @param {number} deltaTime - Time since last frame
     * @param {number} frameCount - Current frame count
     * @param {Object} additionalParams - Additional parameters for feedback
     */
    updateUniforms(deltaTime, frameCount, additionalParams = {}) {
        const {
            probX = 1.0,
            probY = 1.0,
            centerX = 0.0,
            centerY = 0.0
        } = additionalParams;

        const uniforms = this.parameters.getUniforms(deltaTime, frameCount, {
            probX,
            probY,
            centerX,
            centerY
        });

        this.bufferManager.writeBuffer(this.bufferManager.getUniformBuffer(), uniforms);
    }

    /**
     * Calculate exact bounds and score using polygon geometry (matches original updateScore)
     * @returns {Promise<Object>} Score data including bounds, score, collision count, and wind data
     */
    async updateScore() {
        if (this.isProcessingFeedback) {
            return null; // Already processing
        }

        this.isProcessingFeedback = true;
        try {
            const treeCount = this.parameters.get('treeCount');
            const readBuffer = this.bufferManager.getReadBuffer();

            // Copy tree data from GPU to CPU
            const enc = this.bufferManager.getDevice().createCommandEncoder();
            enc.copyBufferToBuffer(
                this.bufferManager.getTreeBuffer(), 0,
                readBuffer, 0,
                this.bufferManager.getTreeBuffer().size
            );
            this.bufferManager.getDevice().queue.submit([enc.finish()]);

            // Map the read buffer
            await readBuffer.mapAsync(GPUMapMode.READ);
            const treeData = new Float32Array(readBuffer.getMappedRange());

            // Validate buffer size
            const expectedSize = treeCount * FLOATS_PER_TREE;
            if (treeData.length < expectedSize) {
                throw new Error(`Buffer underflow: expected ${expectedSize} floats, got ${treeData.length}`);
            }

            // EXACT BOUNDS CALCULATION using polygon vertices
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let collisionCount = 0;

            // Wind calculation: net vector sum of tree pointy end directions
            let windVectorX = 0;
            let windVectorY = 0;

            for (let i = 0; i < treeCount; i++) {
                const idx = i * FLOATS_PER_TREE;
                const px = treeData[idx];     // position.x
                const py = treeData[idx + 1]; // position.y
                const rot = treeData[idx + 4]; // rotation
                const col = treeData[idx + 6]; // collision flag

                if (col > 0.5) collisionCount++;

                // Calculate wind vector: direction of tree pointy end (top)
                // For a tree, the pointy end is perpendicular to the trunk (rotation axis)
                // In standard math coordinates, pointy end direction is rot + π/2
                const pointyEndAngle = rot + Math.PI / 2;
                const pointyEndDirX = Math.cos(pointyEndAngle);
                const pointyEndDirY = Math.sin(pointyEndAngle);

                // Add to wind vector sum
                windVectorX += pointyEndDirX;
                windVectorY += pointyEndDirY;

                // Calculate extents of this tree using polygon vertices
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);

                // Get tree polygon vertices and rotate/translate them
                const treePoly = this.treeGeometry.getPolygon();
                for (let j = 0; j < treePoly.length; j += 2) {
                    const vx = treePoly[j];     // vertex x
                    const vy = treePoly[j + 1]; // vertex y

                    // Rotate vertex
                    const rx = vx * cosR - vy * sinR;
                    const ry = vx * sinR + vy * cosR;

                    // Translate to world position
                    const wx = px + rx;
                    const wy = py + ry;

                    // Update bounds
                    if (wx < minX) minX = wx;
                    if (wx > maxX) maxX = wx;
                    if (wy < minY) minY = wy;
                    if (wy > maxY) maxY = wy;
                }
            }


            readBuffer.unmap();

            if (minX !== Infinity) {
                const w = maxX - minX;
                const h = maxY - minY;
                const side = Math.max(w, h);

                // Calculate compression probability for aspect ratio control
                const probX = (w + h) > 0 ? w / (w + h) : 0.5;

                // Calculate score (matches original: side² / treeCount)
                const score = (side * side) / treeCount;

                // Track best score and stagnation
                if (score < this.bestScore) {
                    this.bestScore = score;
                    this.stagnationCount = 0;
                } else {
                    this.stagnationCount++;
                }

                // Update current bounds for overlay rendering
                this.currentBounds = { minX, maxX, minY, maxY };

                // Calculate wind magnitude and direction
                // Wind is the net vector in the direction of tree pointy ends
                const windMagnitude = Math.sqrt(windVectorX * windVectorX + windVectorY * windVectorY) / treeCount;
                const windDirection = Math.atan2(windVectorY, windVectorX);

                return {
                    bounds: this.currentBounds,
                    score,
                    bestScore: this.bestScore,
                    collisionCount,
                    probX,
                    width: w,
                    height: h,
                    side,
                    stagnationCount: this.stagnationCount,
                    windMagnitude,
                    windDirection
                };
            }

            return null;

        } catch (error) {
            this.logger.error(`Score calculation error: ${error.message}`);
            return null;
        } finally {
            this.isProcessingFeedback = false;
        }
    }

    /**
     * Process CPU feedback loop - read back tree positions and calculate bounds
     * @returns {Promise<Object>} Feedback data including bounds
     */
    async processFeedbackLoop() {
        if (this.isProcessingFeedback) {
            return null; // Already processing
        }

        this.isProcessingFeedback = true;
        try {
            const treeCount = this.parameters.get('treeCount');
            const readBuffer = this.bufferManager.getReadBuffer();

            // Map the read buffer
            await readBuffer.mapAsync(GPUMapMode.READ);
            const treeData = new Float32Array(readBuffer.getMappedRange());

            // Validate buffer size (each tree = FLOATS_PER_TREE floats)
            const expectedSize = treeCount * PhysicsSimulator.FLOATS_PER_TREE;
            if (treeData.length < expectedSize) {
                throw new Error(`Buffer underflow: expected ${expectedSize} floats, got ${treeData.length}`);
            }

            // Calculate bounding box
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            for (let i = 0; i < treeCount; i++) {
                const offset = i * FLOATS_PER_TREE;
                const x = treeData[offset + 0];
                const y = treeData[offset + 1];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }

            readBuffer.unmap();

            // Update bounds
            this.currentBounds = { minX, maxX, minY, maxY };

            // Calculate current aspect ratio and packing ratio
            const width = maxX - minX;
            const height = maxY - minY;

            // Prevent division by zero
            const currentAspect = height > 0 ? width / height : (width > 0 ? Infinity : 1);
            const packRatio = Math.max(width, height) > 0 ? Math.min(width, height) / Math.max(width, height) : 0;

            return {
                bounds: this.currentBounds,
                currentAspect,
                packRatio,
                width,
                height
            };

        } catch (error) {
            this.logger.error(`Feedback loop error: ${error.message}`);
            return null;
        } finally {
            this.isProcessingFeedback = false;
        }
    }

    /**
     * Calculate compression probabilities based on bounds and target aspect ratio
     * @param {Object} feedbackData - Data from feedback loop
     * @returns {Object} Compression probabilities {probX, probY}
     */
    calculateCompressionProbabilities(feedbackData) {
        let probX = 1.0;
        let probY = 1.0;

        if (this.parameters.get('autoPack') && feedbackData) {
            const { currentAspect, width, height } = feedbackData;
            const targetAspect = this.parameters.get('aspect');

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

        return { probX, probY };
    }

    /**
     * Get current bounds
     * @returns {Object} Current bounding box
     */
    getCurrentBounds() {
        return { ...this.currentBounds };
    }

    /**
     * Set feedback frame count (for scheduling feedback reads)
     * @param {number} count - Frame count
     */
    setFeedbackFrameCount(count) {
        this.feedbackFrameCount = count;
    }

    /**
     * Get feedback frame count
     * @returns {number} Frame count
     */
    getFeedbackFrameCount() {
        return this.feedbackFrameCount;
    }

    /**
     * Check if feedback should be processed this frame
     * @returns {boolean} True if feedback should be processed
     */
    shouldProcessFeedback() {
        // Process feedback every 10 frames for score calculation and adaptive compression
        return this.feedbackFrameCount % 10 === 0 && !this.isProcessingFeedback;
    }

    /**
     * Resize buffers if tree count changed
     * @param {number} newTreeCount - New tree count
     * @returns {boolean} True if buffers were resized
     */
    handleTreeCountChange(newTreeCount) {
        const resized = this.bufferManager.resizeTreeBuffers(newTreeCount);
        if (resized) {
            this.markForReset();
        }
        return resized;
    }
}
