import { DeviceManager } from './webgpu/DeviceManager.js';
import { Simulation } from './webgpu/Simulation.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';

export class App {
    constructor() {
        this.deviceManager = new DeviceManager();
        this.uiManager = new UIManager();
        this.inputManager = null; // Initialized after device init (needs canvas)
        this.simulation = null;
    }

    async init() {
        try {
            await this.deviceManager.init('gpuCanvas');
            
            this.inputManager = new InputManager(this.deviceManager.canvas);
            this.simulation = new Simulation(this.deviceManager, this.inputManager);
            
            await this.simulation.init();

            // Connect UI to Simulation
            this.uiManager.onStart = () => {
                this.simulation.start();
            };

            this.uiManager.onParticleCountChange = (count) => {
                this.simulation.setParticleCount(count);
            };

            this.simulation.onFPSUpdate = (fps) => {
                this.uiManager.updateFPS(fps);
            };

        } catch (e) {
            console.error(e);
            alert("Error initializing WebGPU: " + e.message);
        }
    }
}
