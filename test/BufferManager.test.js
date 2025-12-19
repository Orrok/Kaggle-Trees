import { describe, it, expect, beforeEach } from 'vitest';
import { BufferManager } from '../js/webgpu/BufferManager.js';

describe('BufferManager', () => {
  let bufferManager;
  let mockDevice;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    bufferManager = new BufferManager(mockDevice);
  });

  describe('constructor', () => {
    it('should store device reference', () => {
      expect(bufferManager.device).toBe(mockDevice);
    });
  });

  describe('edge cases', () => {
    it('should handle zero size buffers', () => {
      bufferManager.createStorageBuffer(0, false);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 0,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false
      });
    });

    it('should handle very large buffer sizes', () => {
      const largeSize = 1024 * 1024 * 1024; // 1GB
      bufferManager.createStorageBuffer(largeSize, false);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: largeSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false
      });
    });

    it('should handle empty vertex data array', () => {
      const emptyData = new Float32Array(0);
      bufferManager.createVertexBuffer(emptyData);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 0,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
    });

    it('should handle vertex buffer mapping and unmapping', () => {
      const data = new Float32Array([1, 2, 3]);
      const mockBuffer = createMockGPUBuffer(data.byteLength);
      mockDevice.createBuffer.mockReturnValue(mockBuffer);

      bufferManager.createVertexBuffer(data);

      expect(mockBuffer.getMappedRange).toHaveBeenCalled();
      expect(mockBuffer.unmap).toHaveBeenCalled();
    });
  });
});
