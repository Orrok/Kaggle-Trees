import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebGPUDeviceManager } from '../demos/packing2/js/webgpu/DeviceManager.js';

describe('WebGPUDeviceManager', () => {
  let deviceManager;
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = mockCanvasGetContext('webgpu');
    deviceManager = new WebGPUDeviceManager(mockCanvas);
  });

  describe('constructor', () => {
    it('should initialize with canvas reference', () => {
      expect(deviceManager.canvas).toBe(mockCanvas);
      expect(deviceManager.device).toBeNull();
      expect(deviceManager.context).toBeNull();
      expect(deviceManager.adapter).toBeNull();
      expect(deviceManager.format).toBeNull();
    });
  });

  describe('init', () => {
    it('should initialize successfully with valid WebGPU setup', async () => {
      const result = await deviceManager.init();

      expect(result).toBeUndefined(); // init() doesn't return anything
      expect(navigator.gpu.requestAdapter).toHaveBeenCalled();
      expect(deviceManager.adapter).toBeDefined();
      expect(deviceManager.device).toBeDefined();
      expect(deviceManager.context).toBeDefined();
      expect(deviceManager.format).toBe('bgra8unorm');
    });

    it('should throw error when WebGPU is not supported', async () => {
      const originalGpu = navigator.gpu;
      delete navigator.gpu;

      await expect(deviceManager.init()).rejects.toThrow('WebGPU not supported');

      navigator.gpu = originalGpu;
    });

    it('should throw error when adapter request fails', async () => {
      navigator.gpu.requestAdapter.mockResolvedValue(null);

      await expect(deviceManager.init()).rejects.toThrow('Failed to get WebGPU adapter');
    });

    it('should throw error when device request fails', async () => {
      const mockAdapter = { requestDevice: vi.fn().mockResolvedValue(null) };
      navigator.gpu.requestAdapter.mockResolvedValue(mockAdapter);

      await expect(deviceManager.init()).rejects.toThrow('Failed to get WebGPU device');
    });

    it('should throw error when context creation fails', async () => {
      // Ensure adapter has requestDevice method
      navigator.gpu.requestAdapter.mockResolvedValue({
        requestDevice: vi.fn().mockResolvedValue({
          createBuffer: vi.fn(),
          createShaderModule: vi.fn(),
          createComputePipeline: vi.fn(),
          createRenderPipeline: vi.fn(),
          createBindGroup: vi.fn(),
          createBindGroupLayout: vi.fn(),
          createPipelineLayout: vi.fn(),
          createTexture: vi.fn(),
          createSampler: vi.fn(),
          queue: { writeBuffer: vi.fn(), submit: vi.fn() }
        })
      });
      mockCanvas.getContext.mockReturnValue(null);

      await expect(deviceManager.init()).rejects.toThrow('Failed to get WebGPU context');
    });

    it('should configure context with correct parameters', async () => {
      await deviceManager.init();

      expect(deviceManager.context.configure).toHaveBeenCalledWith({
        device: deviceManager.device,
        format: 'bgra8unorm',
        alphaMode: 'opaque'
      });
    });
  });

  describe('getDevice', () => {
    it('should return the device', async () => {
      await deviceManager.init();

      const device = deviceManager.getDevice();

      expect(device).toBe(deviceManager.device);
    });

    it('should return null when not initialized', () => {
      const device = deviceManager.getDevice();

      expect(device).toBeNull();
    });
  });

  describe('getContext', () => {
    it('should return the context', async () => {
      await deviceManager.init();

      const context = deviceManager.getContext();

      expect(context).toBe(deviceManager.context);
    });

    it('should return null when not initialized', () => {
      const context = deviceManager.getContext();

      expect(context).toBeNull();
    });
  });

  describe('getPreferredFormat', () => {
    it('should return the preferred format', async () => {
      await deviceManager.init();

      const format = deviceManager.getPreferredFormat();

      expect(format).toBe('bgra8unorm');
    });

    it('should return null when not initialized', () => {
      const format = deviceManager.getPreferredFormat();

      expect(format).toBeNull();
    });
  });

  describe('getAdapterInfo', () => {
    it('should return adapter information when initialized', async () => {
      const mockAdapter = {
        name: 'Test GPU',
        description: 'Test Adapter',
        vendor: 'Test Vendor',
        device: 'Test Device',
        type: 'discrete-gpu',
        requestDevice: vi.fn().mockResolvedValue({
          createBuffer: vi.fn(),
          createShaderModule: vi.fn(),
          createComputePipeline: vi.fn(),
          createRenderPipeline: vi.fn(),
          createBindGroup: vi.fn(),
          createBindGroupLayout: vi.fn(),
          createPipelineLayout: vi.fn(),
          createTexture: vi.fn(),
          createSampler: vi.fn(),
          queue: { writeBuffer: vi.fn(), submit: vi.fn() }
        })
      };
      navigator.gpu.requestAdapter.mockResolvedValue(mockAdapter);

      await deviceManager.init();

      const info = deviceManager.getAdapterInfo();

      expect(info).toEqual({
        name: 'Test GPU',
        description: 'Test Adapter',
        vendor: 'Test Vendor',
        device: 'Test Device',
        type: 'discrete-gpu'
      });
    });

    it('should return null when adapter is not available', () => {
      const info = deviceManager.getAdapterInfo();

      expect(info).toBeNull();
    });

    it('should handle missing adapter properties gracefully', async () => {
      const mockAdapter = {
        requestDevice: vi.fn().mockResolvedValue({
          createBuffer: vi.fn(),
          createShaderModule: vi.fn(),
          createComputePipeline: vi.fn(),
          createRenderPipeline: vi.fn(),
          createBindGroup: vi.fn(),
          createBindGroupLayout: vi.fn(),
          createPipelineLayout: vi.fn(),
          createTexture: vi.fn(),
          createSampler: vi.fn(),
          queue: { writeBuffer: vi.fn(), submit: vi.fn() }
        })
      }; // Adapter with requestDevice but no info properties
      navigator.gpu.requestAdapter.mockResolvedValue(mockAdapter);

      await deviceManager.init();

      const info = deviceManager.getAdapterInfo();

      expect(info).toEqual({
        name: 'Unknown',
        description: 'Unknown',
        vendor: 'Unknown',
        device: 'Unknown',
        type: 'Unknown'
      });
    });
  });

  describe('isSupported (static)', () => {
    it('should return true when WebGPU is supported', () => {
      const supported = WebGPUDeviceManager.isSupported();

      expect(supported).toBe(true);
    });

    it('should return false when WebGPU is not supported', () => {
      const originalGpu = navigator.gpu;
      delete navigator.gpu;

      const supported = WebGPUDeviceManager.isSupported();

      expect(supported).toBe(false);

      navigator.gpu = originalGpu;
    });
  });

  describe('destroy', () => {
    it('should destroy device and clear references', async () => {
      await deviceManager.init();

      const mockDevice = deviceManager.device;
      mockDevice.destroy = vi.fn();

      deviceManager.destroy();

      expect(mockDevice.destroy).toHaveBeenCalled();
      expect(deviceManager.device).toBeNull();
      expect(deviceManager.context).toBeNull();
      expect(deviceManager.adapter).toBeNull();
    });

    it('should handle destroy when device is null', () => {
      deviceManager.device = null;

      expect(() => deviceManager.destroy()).not.toThrow();

      expect(deviceManager.device).toBeNull();
    });
  });
});
