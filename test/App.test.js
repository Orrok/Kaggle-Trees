import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from '../js/App.js';
import { InputManager } from '../js/input/InputManager.js';
import { Simulation } from '../js/webgpu/Simulation.js';

describe('App', () => {
  let app;
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = mockCanvasGetContext('webgpu');
    mockDocumentGetElementById(mockCanvas);

    // Mock console.error and alert for error handling tests
    global.console.error = vi.fn();
    global.alert = vi.fn();

    app = new App();
  });

  describe('constructor', () => {
    it('should initialize DeviceManager', () => {
      expect(app.deviceManager).toBeDefined();
      expect(app.deviceManager.constructor.name).toBe('DeviceManager');
    });

    it('should initialize UIManager', () => {
      expect(app.uiManager).toBeDefined();
      expect(app.uiManager.constructor.name).toBe('UIManager');
    });

    it('should not initialize InputManager initially', () => {
      expect(app.inputManager).toBeNull();
    });

    it('should not initialize Simulation initially', () => {
      expect(app.simulation).toBeNull();
    });
  });

  describe('init', () => {
    it('should initialize successfully with valid WebGPU setup', async () => {
      await app.init();

      expect(app.inputManager).toBeDefined();
      expect(app.inputManager.constructor.name).toBe('InputManager');
      expect(app.simulation).toBeDefined();
      expect(app.simulation.constructor.name).toBe('Simulation');

      // Verify that input manager was created with the correct canvas
      expect(app.inputManager.canvas).toBe(mockCanvas);
    });

    it('should call deviceManager.init with correct canvas id', async () => {
      const initSpy = vi.spyOn(app.deviceManager, 'init');

      await app.init();

      expect(initSpy).toHaveBeenCalledWith('gpuCanvas');
    });

    it('should initialize simulation with correct parameters', async () => {
      await app.init();

      expect(app.simulation.deviceManager).toBe(app.deviceManager);
      expect(app.simulation.inputManager).toBe(app.inputManager);
    });

    it('should wire UI callbacks to simulation methods', async () => {
      await app.init();

      // Verify that UI callbacks are set
      expect(app.uiManager.onStart).toBeDefined();
      expect(app.uiManager.onParticleCountChange).toBeDefined();
    });



    it('should handle WebGPU initialization errors', async () => {
      // Mock device manager to throw an error
      const error = new Error('WebGPU initialization failed');
      vi.spyOn(app.deviceManager, 'init').mockRejectedValue(error);

      await app.init();

      expect(global.console.error).toHaveBeenCalledWith(error);
      expect(global.alert).toHaveBeenCalledWith('Error initializing WebGPU: WebGPU initialization failed');
    });


    it('should not proceed with initialization if device manager fails', async () => {
      const deviceError = new Error('Device manager failed');
      vi.spyOn(app.deviceManager, 'init').mockRejectedValue(deviceError);

      await app.init();

      // InputManager and Simulation should not be created
      expect(app.inputManager).toBeNull();
      expect(app.simulation).toBeNull();
    });
  });


  describe('error handling', () => {
    it('should handle missing canvas element gracefully', async () => {
      // Mock getElementById to return null
      global.document.getElementById = vi.fn().mockReturnValue(null);

      const error = new Error('Canvas not found');
      vi.spyOn(app.deviceManager, 'init').mockRejectedValue(error);

      await app.init();

      expect(global.console.error).toHaveBeenCalledWith(error);
      expect(global.alert).toHaveBeenCalled();
    });

  });
});
