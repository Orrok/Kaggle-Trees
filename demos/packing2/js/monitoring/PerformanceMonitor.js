import { PERFORMANCE_HISTORY_SIZE } from '../constants.js';

/**
 * Performance monitoring for FPS tracking and metrics
 */
export class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTimeHistory = [];
        this.maxHistorySize = PERFORMANCE_HISTORY_SIZE;
    }

    /**
     * Update performance metrics for a new frame
     * @param {number} timestamp - Current timestamp from requestAnimationFrame
     */
    update(timestamp) {
        if (this.lastTime) {
            const delta = timestamp - this.lastTime;

            // Prevent division by zero or very small deltas that would cause Infinity
            if (delta <= 0.001) {
                // Skip this update if delta is too small to avoid division by zero
                return;
            }

            const currentFPS = 1000 / delta;

            // Add to history for smoothing
            this.frameTimeHistory.push(delta);
            if (this.frameTimeHistory.length > this.maxHistorySize) {
                this.frameTimeHistory.shift();
            }

            // Calculate smoothed FPS
            const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
            this.fps = Math.round(1000 / avgFrameTime);
        }

        this.lastTime = timestamp;
        this.frameCount++;
    }

    /**
     * Get current FPS
     * @returns {number} Current FPS
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Get total frame count
     * @returns {number} Total frames rendered
     */
    getFrameCount() {
        return this.frameCount;
    }

    /**
     * Get average frame time over the history window
     * @returns {number} Average frame time in milliseconds
     */
    getAverageFrameTime() {
        if (this.frameTimeHistory.length === 0) return 0;
        return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    }

    /**
     * Reset performance counters
     */
    reset() {
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTimeHistory = [];
    }

    /**
     * Get performance metrics as an object
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            fps: this.fps,
            frameCount: this.frameCount,
            averageFrameTime: this.getAverageFrameTime()
        };
    }
}
