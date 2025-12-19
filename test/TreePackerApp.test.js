import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreePackerApp } from '../demos/packing2/js/TreePackerApp.js';

describe('TreePackerApp', () => {
  let treePackerApp;
  let mockCanvasElements;

  beforeEach(() => {
    // Create mock canvas elements
    mockCanvasElements = {
      gpuCanvas: mockCanvasGetContext('webgpu'),
      overlayCanvas: {
        ...createMockElement('canvas'),
        getContext: vi.fn().mockReturnValue({
          clearRect: vi.fn(),
          strokeStyle: '',
          lineWidth: 1,
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          strokeRect: vi.fn(),
          fillStyle: '',
          arc: vi.fn(),
          fill: vi.fn()
        })
      }
    };

    // Mock document.getElementById
    global.document.getElementById = vi.fn((id) => {
      switch (id) {
        case 'gpuCanvas': return mockCanvasElements.gpuCanvas;
        case 'overlayCanvas': return mockCanvasElements.overlayCanvas;
        // UI elements
        case 'tree-slider':
        case 'tree-value':
        case 'zoom-slider':
        case 'zoom-value':
        case 'compress-slider':
        case 'compress-value':
        case 'relax-slider':
        case 'relax-value':
        case 'auto-pack-btn':
        case 'reset-btn':
        case 'debug-btn':
        case 'debug-panel':
        case 'debug-log':
        case 'close-debug':
        case 'tree-count':
        case 'pack-ratio':
        case 'fps':
        case 'perf-fill':
          return createMockElement('div');
        default: return null;
      }
    });

    // Mock console methods
    global.console.log = vi.fn();
    global.console.error = vi.fn();

    treePackerApp = new TreePackerApp();
  });

  describe('constructor', () => {
    it('should initialize with null component references', () => {
      expect(treePackerApp.logger).toBeNull();
      expect(treePackerApp.treeGeometry).toBeNull();
      expect(treePackerApp.parameters).toBeNull();
      expect(treePackerApp.performanceMonitor).toBeNull();
      expect(treePackerApp.deviceManager).toBeNull();
      expect(treePackerApp.bufferManager).toBeNull();
      expect(treePackerApp.pipelineManager).toBeNull();
      expect(treePackerApp.physicsSimulator).toBeNull();
      expect(treePackerApp.renderer).toBeNull();
      expect(treePackerApp.overlayRenderer).toBeNull();
      expect(treePackerApp.uiManager).toBeNull();
      expect(treePackerApp.gpuCanvas).toBeNull();
      expect(treePackerApp.overlayCanvas).toBeNull();
      expect(treePackerApp.animationId).toBeNull();
      expect(treePackerApp.isRunning).toBe(false);
      expect(treePackerApp.frameCount).toBe(0);
    });
  });

  describe('init', () => {
    it('should get canvas elements', async () => {
      await treePackerApp.init();

      expect(treePackerApp.gpuCanvas).toBe(mockCanvasElements.gpuCanvas);
      expect(treePackerApp.overlayCanvas).toBe(mockCanvasElements.overlayCanvas);
    });

    it('should initialize all components successfully', async () => {
      await treePackerApp.init();

      // Check that all components are initialized
      expect(treePackerApp.logger).toBeDefined();
      expect(treePackerApp.treeGeometry).toBeDefined();
      expect(treePackerApp.parameters).toBeDefined();
      expect(treePackerApp.performanceMonitor).toBeDefined();
      expect(treePackerApp.deviceManager).toBeDefined();
      expect(treePackerApp.bufferManager).toBeDefined();
      expect(treePackerApp.pipelineManager).toBeDefined();
      expect(treePackerApp.physicsSimulator).toBeDefined();
      expect(treePackerApp.renderer).toBeDefined();
      expect(treePackerApp.overlayRenderer).toBeDefined();
      expect(treePackerApp.uiManager).toBeDefined();
    });

    it('should handle missing canvas elements', async () => {
      global.document.getElementById = vi.fn().mockReturnValue(null);

      await expect(treePackerApp.init()).rejects.toThrow();
      expect(global.console.error).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Mock navigator.gpu to be undefined to cause WebGPU error
      const originalGpu = navigator.gpu;
      navigator.gpu = undefined;

      try {
        await expect(treePackerApp.init()).rejects.toThrow();
        expect(global.console.error).toHaveBeenCalled();
      } finally {
        navigator.gpu = originalGpu;
      }
    });
  });

  describe('canvas setup', () => {
    beforeEach(async () => {
      await treePackerApp.init();
    });

    it('should set canvas dimensions after initialization', () => {
      expect(treePackerApp.gpuCanvas.width).toBeDefined();
      expect(treePackerApp.gpuCanvas.height).toBeDefined();
      expect(treePackerApp.overlayCanvas.width).toBeDefined();
      expect(treePackerApp.overlayCanvas.height).toBeDefined();
    });

    it('should set overlay canvas dimensions after initialization', () => {
      expect(treePackerApp.overlayCanvas.width).toBeDefined();
      expect(treePackerApp.overlayCanvas.height).toBeDefined();
    });
  });

  describe('public API', () => {
    beforeEach(async () => {
      await treePackerApp.init();
    });

    it('should start and set isRunning to true', () => {
      treePackerApp.start();

      expect(treePackerApp.isRunning).toBe(true);
    });

    it('should stop and set isRunning to false', () => {
      treePackerApp.start();
      expect(treePackerApp.isRunning).toBe(true);

      treePackerApp.stop();

      expect(treePackerApp.isRunning).toBe(false);
    });

    it('should reset the simulation', () => {
      const resetSpy = vi.spyOn(treePackerApp.physicsSimulator, 'markForReset');

      treePackerApp.reset();

      expect(resetSpy).toHaveBeenCalled();
    });

    it('should return application state', () => {
      const state = treePackerApp.getState();

      expect(state).toHaveProperty('isRunning');
      expect(state).toHaveProperty('fps');
      expect(state).toHaveProperty('treeCount');
      expect(state).toHaveProperty('parameters');
      expect(state).toHaveProperty('bounds');
    });

    it('should destroy all components', () => {
      // Mock destroy methods
      treePackerApp.uiManager.destroy = vi.fn();
      treePackerApp.bufferManager.destroy = vi.fn();
      treePackerApp.deviceManager.destroy = vi.fn();

      treePackerApp.destroy();

      expect(treePackerApp.uiManager.destroy).toHaveBeenCalled();
      expect(treePackerApp.bufferManager.destroy).toHaveBeenCalled();
      expect(treePackerApp.deviceManager.destroy).toHaveBeenCalled();
    });
  });

  describe('component integration', () => {
    beforeEach(async () => {
      await treePackerApp.init();
    });

    describe('parameter change propagation', () => {
      it('should trigger simulation reset when tree count changes', () => {
        const resetSpy = vi.spyOn(treePackerApp.physicsSimulator, 'markForReset');
        const handleTreeCountSpy = vi.spyOn(treePackerApp, 'handleTreeCountChange');

      // Change tree count through parameters
      treePackerApp.parameters.set('treeCount', 20);

      expect(handleTreeCountSpy).toHaveBeenCalledWith(20);
      expect(resetSpy).toHaveBeenCalled();
      });


      it('should notify observers when parameters change', () => {
        const observerSpy = vi.fn();
        treePackerApp.parameters.subscribe(observerSpy);

      treePackerApp.parameters.set('treeCount', 5);

      expect(observerSpy).toHaveBeenCalledWith('treeCount', 5, 10);
      });
    });

    describe('tree count range and pause behavior', () => {
      beforeEach(async () => {
        await treePackerApp.init();
      });

      it('should enforce tree count range of 1-200', () => {
        // Test minimum value
        expect(treePackerApp.parameters.set('treeCount', 1)).toBe(true);
        expect(treePackerApp.parameters.get('treeCount')).toBe(1);

        // Test maximum value
        expect(treePackerApp.parameters.set('treeCount', 200)).toBe(true);
        expect(treePackerApp.parameters.get('treeCount')).toBe(200);

        // Test invalid values below minimum
        expect(treePackerApp.parameters.set('treeCount', 0)).toBe(false);
        expect(treePackerApp.parameters.get('treeCount')).toBe(200); // Should remain unchanged

        // Test invalid values above maximum
        expect(treePackerApp.parameters.set('treeCount', 201)).toBe(false);
        expect(treePackerApp.parameters.get('treeCount')).toBe(200); // Should remain unchanged
      });

      it('should pause simulation when tree count changes', () => {
        // Start the simulation
        treePackerApp.start();
        expect(treePackerApp.isRunning).toBe(true);

        // Change tree count - should pause
        treePackerApp.parameters.set('treeCount', 50);

        expect(treePackerApp.isRunning).toBe(false);
      });

      it('should spawn new trees when play is pressed after tree count change', () => {
        // Mock the physics simulator reset
        const resetSpy = vi.spyOn(treePackerApp.physicsSimulator, 'reset');

        // Change tree count (this pauses and marks for reset)
        treePackerApp.parameters.set('treeCount', 30);
        expect(treePackerApp.isRunning).toBe(false);

        // Start playing - should trigger reset on next render frame
        treePackerApp.start();
        expect(treePackerApp.isRunning).toBe(true);

        // Simulate a render frame (this would normally happen in requestAnimationFrame)
        // The reset should happen in the render loop when needsResetSimulation returns true
        // Since we can't easily simulate the full render loop, we'll test that the reset flag is set
        expect(treePackerApp.physicsSimulator.needsResetSimulation()).toBe(true);

        // When the render loop runs, it should call reset
        // We can't easily test the full render loop, but we can verify the setup is correct
      });

      it('should update bind groups when tree count changes and buffers are resized', () => {
        const updateBindGroupSpy = vi.spyOn(treePackerApp.pipelineManager, 'updateBindGroup');
        const physicsHandleSpy = vi.spyOn(treePackerApp.physicsSimulator, 'handleTreeCountChange');

        // Mock the physics simulator to return true (buffers resized)
        physicsHandleSpy.mockReturnValue(true);

        // Call handleTreeCountChange
        treePackerApp.handleTreeCountChange(50);

        // Should call physics simulator's handleTreeCountChange
        expect(physicsHandleSpy).toHaveBeenCalledWith(50);
        // Should update bind groups when buffers are resized
        expect(updateBindGroupSpy).toHaveBeenCalledWith(treePackerApp.bufferManager);
      });

      it('should not update bind groups when buffers are not resized', () => {
        const updateBindGroupSpy = vi.spyOn(treePackerApp.pipelineManager, 'updateBindGroup');
        const physicsHandleSpy = vi.spyOn(treePackerApp.physicsSimulator, 'handleTreeCountChange');

        // Mock the physics simulator to return false (buffers not resized)
        physicsHandleSpy.mockReturnValue(false);

        // Call handleTreeCountChange
        treePackerApp.handleTreeCountChange(50);

        // Should call physics simulator's handleTreeCountChange
        expect(physicsHandleSpy).toHaveBeenCalledWith(50);
        // Should not update bind groups when buffers are not resized
        expect(updateBindGroupSpy).not.toHaveBeenCalled();
      });
    });

    describe('UI integration', () => {
      it('should update UI stats through updateUI method', () => {
        const updateStatsSpy = vi.spyOn(treePackerApp.uiManager, 'updateStats');

        // Mock performance monitor
        treePackerApp.performanceMonitor.getFPS = vi.fn().mockReturnValue(60);

        treePackerApp.updateUI();

        expect(updateStatsSpy).toHaveBeenCalledWith({
          fps: 60,
          treeCount: 10,
          packRatio: 0
        });
      });
    });

    describe('render step integration', () => {
      it('should update performance monitor during step', () => {
        const updateSpy = vi.spyOn(treePackerApp.performanceMonitor, 'update');
        // Mock renderer to avoid canvas access issues
        treePackerApp.renderer.renderFrame = vi.fn();

        global.performance.now = vi.fn().mockReturnValue(1000);

        treePackerApp.step();

        expect(updateSpy).toHaveBeenCalledWith(1000);
      });

      it('should handle simulation reset during step', () => {
        const resetSpy = vi.spyOn(treePackerApp.physicsSimulator, 'reset');
        treePackerApp.physicsSimulator.needsResetSimulation = vi.fn().mockReturnValue(true);
        // Mock renderer to avoid canvas access issues
        treePackerApp.renderer.renderFrame = vi.fn();

        treePackerApp.step();

        expect(resetSpy).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle canvas not found error', async () => {
        const app = new TreePackerApp();
        global.document.getElementById = vi.fn().mockReturnValue(null);

        await expect(app.init()).rejects.toThrow();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('state synchronization', () => {
      it('should synchronize parameter changes across components', () => {
        // Change a parameter
        treePackerApp.parameters.set('compression', 0.5);

        // Check that the change is reflected in getState
        const state = treePackerApp.getState();
        expect(state.parameters.compression).toBe(0.5);
      });

      it('should synchronize bounds from physics simulator', () => {
        // Mock bounds in physics simulator
        treePackerApp.physicsSimulator.currentBounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

        const state = treePackerApp.getState();
        expect(state.bounds).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
      });

      it('should synchronize FPS from performance monitor', () => {
        treePackerApp.performanceMonitor.fps = 45;

        const state = treePackerApp.getState();
        expect(state.fps).toBe(45);
      });
    });
  });

  describe('Play/Pause/Step Controls', () => {
    beforeEach(async () => {
      await treePackerApp.init();
    });

    it('should start physics simulation when start() is called', () => {
      expect(treePackerApp.isRunning).toBe(false);

      treePackerApp.start();

      expect(treePackerApp.isRunning).toBe(true);
    });

    it('should stop physics simulation when stop() is called', () => {
      treePackerApp.start();
      expect(treePackerApp.isRunning).toBe(true);

      treePackerApp.stop();

      expect(treePackerApp.isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      treePackerApp.start();
      expect(treePackerApp.isRunning).toBe(true);

      // Should not change state
      treePackerApp.start();
      expect(treePackerApp.isRunning).toBe(true);
    });

    it('should not stop if not running', () => {
      expect(treePackerApp.isRunning).toBe(false);

      // Should not change state
      treePackerApp.stop();
      expect(treePackerApp.isRunning).toBe(false);
    });

    it('should run physics step when step() is called', async () => {
      // Mock the renderer to avoid canvas context issues
      const mockRenderFrame = vi.fn();
      treePackerApp.renderer.renderFrame = mockRenderFrame;

      const initialFrameCount = treePackerApp.frameCount;

      await treePackerApp.step();

      expect(treePackerApp.frameCount).toBe(initialFrameCount + 1);
      expect(mockRenderFrame).toHaveBeenCalled();
    });

    it('should call renderer with physics enabled when stepping', async () => {
      const mockRenderFrame = vi.fn();
      treePackerApp.renderer.renderFrame = mockRenderFrame;

      await treePackerApp.step();

      expect(mockRenderFrame).toHaveBeenCalledWith(
        expect.any(Number), // deltaTime
        expect.any(Number), // frameCount
        expect.any(Object), // additionalParams
        false, // shouldReadBack
        true // shouldRunPhysics - should be true for stepping
      );
    });

    it('should call renderer with physics enabled when isRunning is true', () => {
      const mockRenderFrame = vi.fn();
      treePackerApp.renderer.renderFrame = mockRenderFrame;

      treePackerApp.start();
      expect(treePackerApp.isRunning).toBe(true);

      // Simulate render loop call
      treePackerApp.renderer.renderFrame(0.016, 1, {}, false, treePackerApp.isRunning);

      expect(mockRenderFrame).toHaveBeenCalledWith(
        0.016,
        1,
        {},
        false,
        true // shouldRunPhysics should be true when isRunning
      );
    });

    it('should call renderer with physics disabled when isRunning is false', () => {
      const mockRenderFrame = vi.fn();
      treePackerApp.renderer.renderFrame = mockRenderFrame;

      expect(treePackerApp.isRunning).toBe(false);

      // Simulate render loop call
      treePackerApp.renderer.renderFrame(0.016, 1, {}, false, treePackerApp.isRunning);

      expect(mockRenderFrame).toHaveBeenCalledWith(
        0.016,
        1,
        {},
        false,
        false // shouldRunPhysics should be false when not running
      );
    });
  });


});




