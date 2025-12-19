import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceManager } from '../js/webgpu/DeviceManager.js';

describe('DeviceManager', () => {
  let deviceManager;
  let mockCanvas;

  beforeEach(() => {
    deviceManager = new DeviceManager();
    mockCanvas = mockCanvasGetContext('webgpu');
    mockDocumentGetElementById(mockCanvas);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(deviceManager.device).toBeNull();
      expect(deviceManager.adapter).toBeNull();
      expect(deviceManager.canvas).toBeNull();
      expect(deviceManager.context).toBeNull();
      expect(deviceManager.format).toBeNull();
    });
  });

  describe('init', () => {
    it('should initialize WebGPU successfully with valid canvas', async () => {
      const device = await deviceManager.init('test-canvas');

      expect(navigator.gpu.requestAdapter).toHaveBeenCalled();
      expect(deviceManager.adapter).toBeDefined();
      expect(deviceManager.device).toBeDefined();
      expect(deviceManager.canvas).toBe(mockCanvas);
      expect(deviceManager.context).toBeDefined();
      expect(deviceManager.format).toBe('bgra8unorm');
      expect(deviceManager.context.configure).toHaveBeenCalledWith({
        device: deviceManager.device,
        format: 'bgra8unorm',
        alphaMode: 'premultiplied'
      });
      expect(device).toBe(deviceManager.device);
    });

    it('should throw error when WebGPU is not supported', async () => {
      // Temporarily remove gpu from navigator
      const originalGpu = navigator.gpu;
      delete navigator.gpu;

      await expect(deviceManager.init('test-canvas')).rejects.toThrow('WebGPU not supported on this browser.');

      // Restore gpu
      navigator.gpu = originalGpu;
    });

    it('should throw error when no adapter is found', async () => {
      navigator.gpu.requestAdapter.mockResolvedValueOnce(null);

      await expect(deviceManager.init('test-canvas')).rejects.toThrow('No appropriate GPUAdapter found.');
    });

    it('should call handleResize during initialization', async () => {
      const resizeSpy = vi.spyOn(deviceManager, 'handleResize');

      await deviceManager.init('test-canvas');

      expect(resizeSpy).toHaveBeenCalled();
    });

    it('should add resize event listener', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await deviceManager.init('test-canvas');

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('handleResize', () => {
    it('should update canvas size based on device pixel ratio', async () => {
      // Set up device manager
      await deviceManager.init('test-canvas');

      // Mock window properties
      Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
      Object.defineProperty(window, 'innerWidth', { value: 1600 });
      Object.defineProperty(window, 'innerHeight', { value: 1200 });

      deviceManager.handleResize();

      expect(deviceManager.canvas.width).toBe(3200); // 1600 * 2
      expect(deviceManager.canvas.height).toBe(2400); // 1200 * 2
    });

    it('should clamp device pixel ratio to maximum of 2', async () => {
      // Set up device manager
      await deviceManager.init('test-canvas');

      // Mock high device pixel ratio
      Object.defineProperty(window, 'devicePixelRatio', { value: 3 });
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      deviceManager.handleResize();

      expect(deviceManager.canvas.width).toBe(1600); // 800 * 2 (clamped)
      expect(deviceManager.canvas.height).toBe(1200); // 600 * 2 (clamped)
    });

    it('should ensure minimum canvas size of 1', async () => {
      // Set up device manager
      await deviceManager.init('test-canvas');

      // Mock zero dimensions
      Object.defineProperty(window, 'devicePixelRatio', { value: 1 });
      Object.defineProperty(window, 'innerWidth', { value: 0 });
      Object.defineProperty(window, 'innerHeight', { value: 0 });

      deviceManager.handleResize();

      expect(deviceManager.canvas.width).toBe(1);
      expect(deviceManager.canvas.height).toBe(1);
    });
  });

  describe('aspect getter', () => {
    it('should return correct aspect ratio', async () => {
      // Set up device manager
      await deviceManager.init('test-canvas');

      deviceManager.canvas.width = 800;
      deviceManager.canvas.height = 600;

      expect(deviceManager.aspect).toBe(800 / 600);
    });

    it('should handle zero height gracefully', async () => {
      // Set up device manager
      await deviceManager.init('test-canvas');

      deviceManager.canvas.width = 800;
      deviceManager.canvas.height = 0;

      expect(deviceManager.aspect).toBe(Infinity);
    });

    describe('edge cases', () => {
      it('should handle device pixel ratio of 0', async () => {
        await deviceManager.init('test-canvas');

        Object.defineProperty(window, 'devicePixelRatio', { value: 0 });
        Object.defineProperty(window, 'innerWidth', { value: 800 });
        Object.defineProperty(window, 'innerHeight', { value: 600 });

        deviceManager.handleResize();

        expect(deviceManager.canvas.width).toBe(1); // Should clamp to minimum
        expect(deviceManager.canvas.height).toBe(1);
      });

      it('should handle negative window dimensions', async () => {
        await deviceManager.init('test-canvas');

        Object.defineProperty(window, 'devicePixelRatio', { value: 1 });
        Object.defineProperty(window, 'innerWidth', { value: -100 });
        Object.defineProperty(window, 'innerHeight', { value: -50 });

        deviceManager.handleResize();

        expect(deviceManager.canvas.width).toBe(1); // Should clamp to minimum
        expect(deviceManager.canvas.height).toBe(1);
      });

      it('should handle extremely large canvas sizes', async () => {
        await deviceManager.init('test-canvas');

        Object.defineProperty(window, 'devicePixelRatio', { value: 10 });
        Object.defineProperty(window, 'innerWidth', { value: 10000 });
        Object.defineProperty(window, 'innerHeight', { value: 10000 });

        deviceManager.handleResize();

        expect(deviceManager.canvas.width).toBe(20000); // 10000 * 2 (clamped DPR)
        expect(deviceManager.canvas.height).toBe(20000);
      });

      it('should handle fractional device pixel ratios', async () => {
        await deviceManager.init('test-canvas');

        Object.defineProperty(window, 'devicePixelRatio', { value: 1.5 });
        Object.defineProperty(window, 'innerWidth', { value: 800 });
        Object.defineProperty(window, 'innerHeight', { value: 600 });

        deviceManager.handleResize();

        expect(deviceManager.canvas.width).toBe(1200); // 800 * 1.5
        expect(deviceManager.canvas.height).toBe(900);  // 600 * 1.5
      });
    });
  });
});
