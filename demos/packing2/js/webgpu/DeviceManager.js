/**
 * WebGPU device and context management
 */
export class WebGPUDeviceManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.adapter = null;
        this.format = null;
    }

    /**
     * Initialize WebGPU device and context
     * @returns {Promise<void>}
     * @throws {Error} If WebGPU is not supported
     */
    async init() {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }

        // Request adapter
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
            throw new Error('Failed to get WebGPU adapter');
        }

        // Request device
        this.device = await this.adapter.requestDevice();
        if (!this.device) {
            throw new Error('Failed to get WebGPU device');
        }

        // Setup canvas context
        this.context = this.canvas.getContext('webgpu');
        if (!this.context) {
            throw new Error('Failed to get WebGPU context');
        }

        // Get preferred format
        this.format = navigator.gpu.getPreferredCanvasFormat();

        // Configure context
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'opaque'
        });
    }

    /**
     * Get the WebGPU device
     * @returns {GPUDevice} The WebGPU device
     */
    getDevice() {
        return this.device;
    }

    /**
     * Get the WebGPU context
     * @returns {GPUCanvasContext} The canvas context
     */
    getContext() {
        return this.context;
    }

    /**
     * Get the preferred canvas format
     * @returns {GPUTextureFormat} The preferred format
     */
    getPreferredFormat() {
        return this.format;
    }

    /**
     * Get adapter info for debugging
     * @returns {Object} Adapter information
     */
    getAdapterInfo() {
        if (!this.adapter) return null;

        return {
            name: this.adapter.name || 'Unknown',
            description: this.adapter.description || 'Unknown',
            vendor: this.adapter.vendor || 'Unknown',
            device: this.adapter.device || 'Unknown',
            type: this.adapter.type || 'Unknown'
        };
    }

    /**
     * Check if WebGPU is supported
     * @returns {boolean} True if WebGPU is supported
     */
    static isSupported() {
        return !!navigator.gpu;
    }

    /**
     * Destroy resources (for cleanup)
     */
    destroy() {
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.context = null;
        this.adapter = null;
    }
}
