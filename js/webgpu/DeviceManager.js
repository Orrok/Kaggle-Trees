export class DeviceManager {
    constructor() {
        this.device = null;
        this.adapter = null;
        this.canvas = null;
        this.context = null;
        this.format = null;
    }

    async init(canvasId) {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        this.device = await this.adapter.requestDevice();
        
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('webgpu');
        this.format = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied'
        });

        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());

        return this.device;
    }

    handleResize() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        const w = window.innerWidth * dpr;
        const h = window.innerHeight * dpr;
        this.canvas.width = Math.max(1, w);
        this.canvas.height = Math.max(1, h);
    }

    get aspect() {
        return this.canvas.width / this.canvas.height;
    }
}
