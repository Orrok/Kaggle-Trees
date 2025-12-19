import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BufferManager } from '../demos/packing2/js/webgpu/BufferManager.js';

describe('BufferManager (Packing2)', () => {
  let bufferManager;
  let mockDeviceManager;
  let mockDevice;
  let mockTreeGeometry;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    mockDeviceManager = {
      getDevice: vi.fn().mockReturnValue(mockDevice)
    };

    mockTreeGeometry = {
      getVertices: vi.fn().mockReturnValue(new Float32Array([0, 1, 2, 3, 4, 5])),
      getIndices: vi.fn().mockReturnValue(new Uint32Array([0, 1, 2])),
      getPolygon: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3, 0.4]))
    };

    bufferManager = new BufferManager(mockDeviceManager);
  });

  describe('constructor', () => {
    it('should initialize with device manager and get device reference', () => {
      expect(bufferManager.deviceManager).toBe(mockDeviceManager);
      expect(bufferManager.device).toBe(mockDevice);
      expect(bufferManager.treeBuffer).toBeNull();
      expect(bufferManager.uniformBuffer).toBeNull();
      expect(bufferManager.vertexBuffer).toBeNull();
      expect(bufferManager.indexBuffer).toBeNull();
      expect(bufferManager.readBuffer).toBeNull();
      expect(bufferManager.geometryBuffer).toBeNull();
    });
  });

  describe('initBuffers', () => {
    it('should initialize all buffers with correct parameters', () => {
      const treeCount = 10;
      const createTreeBufferSpy = vi.spyOn(bufferManager, 'createTreeBuffer');
      const createReadBufferSpy = vi.spyOn(bufferManager, 'createReadBuffer');
      const createUniformBufferSpy = vi.spyOn(bufferManager, 'createUniformBuffer');
      const createGeometryBuffersSpy = vi.spyOn(bufferManager, 'createGeometryBuffers');

      bufferManager.initBuffers(treeCount, mockTreeGeometry);

      expect(createTreeBufferSpy).toHaveBeenCalledWith(treeCount);
      expect(createReadBufferSpy).toHaveBeenCalledWith(treeCount);
      expect(createUniformBufferSpy).toHaveBeenCalled();
      expect(createGeometryBuffersSpy).toHaveBeenCalledWith(mockTreeGeometry);
    });
  });

  describe('createTreeBuffer', () => {
    it('should create tree buffer with correct size and usage', () => {
      const treeCount = 5;

      bufferManager.createTreeBuffer(treeCount);

      // 5 trees * 8 floats per tree * 4 bytes per float = 160 bytes
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 160,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      expect(bufferManager.treeBuffer).toBeDefined();
    });
  });

  describe('createReadBuffer', () => {
    it('should create read buffer with correct size and usage', () => {
      const treeCount = 3;

      bufferManager.createReadBuffer(treeCount);

      // 3 trees * 8 floats per tree * 4 bytes per float = 96 bytes
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 96,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      expect(bufferManager.readBuffer).toBeDefined();
    });
  });

  describe('createUniformBuffer', () => {
    it('should create uniform buffer with correct size', () => {
      bufferManager.createUniformBuffer();

      // 8 floats * 4 bytes = 32 bytes
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      expect(bufferManager.uniformBuffer).toBeDefined();
    });
  });

  describe('createGeometryBuffers', () => {
    it('should create vertex buffer and map geometry data', () => {
      const vertices = new Float32Array([1, 2, 3, 4, 5, 6]);
      const mockVertexBuffer = createMockGPUBuffer(vertices.byteLength);
      mockTreeGeometry.getVertices.mockReturnValue(vertices);
      mockDevice.createBuffer.mockReturnValue(mockVertexBuffer);

      bufferManager.createGeometryBuffers(mockTreeGeometry);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      });

      expect(mockVertexBuffer.getMappedRange).toHaveBeenCalled();
      expect(mockVertexBuffer.unmap).toHaveBeenCalled();
      expect(bufferManager.vertexBuffer).toBe(mockVertexBuffer);
    });

    it('should create index buffer and map index data', () => {
      const indices = new Uint32Array([0, 1, 2, 2, 3, 0]);
      const mockIndexBuffer = createMockGPUBuffer(indices.byteLength);
      mockTreeGeometry.getIndices.mockReturnValue(indices);
      mockDevice.createBuffer
        .mockReturnValueOnce(createMockGPUBuffer()) // vertex buffer
        .mockReturnValueOnce(mockIndexBuffer); // index buffer

      bufferManager.createGeometryBuffers(mockTreeGeometry);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true
      });

      expect(mockIndexBuffer.getMappedRange).toHaveBeenCalled();
      expect(mockIndexBuffer.unmap).toHaveBeenCalled();
      expect(bufferManager.indexBuffer).toBe(mockIndexBuffer);
    });

    it('should create geometry buffer for collision detection', () => {
      const polygon = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const mockGeometryBuffer = createMockGPUBuffer(polygon.byteLength);
      mockTreeGeometry.getPolygon.mockReturnValue(polygon);
      mockDevice.createBuffer
        .mockReturnValueOnce(createMockGPUBuffer()) // vertex buffer
        .mockReturnValueOnce(createMockGPUBuffer()) // index buffer
        .mockReturnValueOnce(mockGeometryBuffer); // geometry buffer

      bufferManager.createGeometryBuffers(mockTreeGeometry);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: polygon.byteLength,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: true
      });

      expect(mockGeometryBuffer.getMappedRange).toHaveBeenCalled();
      expect(mockGeometryBuffer.unmap).toHaveBeenCalled();
      expect(bufferManager.geometryBuffer).toBe(mockGeometryBuffer);
    });
  });

  describe('writeBuffer', () => {
    it('should write data to buffer using device queue', () => {
      const mockBuffer = createMockGPUBuffer();
      const data = new Float32Array([1, 2, 3, 4]);
      const offset = 16;

      bufferManager.writeBuffer(mockBuffer, data, offset);

      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(mockBuffer, offset, data);
    });

    it('should default offset to 0', () => {
      const mockBuffer = createMockGPUBuffer();
      const data = new Float32Array([1, 2, 3]);

      bufferManager.writeBuffer(mockBuffer, data);

      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(mockBuffer, 0, data);
    });
  });

  describe('copyBufferToBuffer', () => {
    it('should create command encoder and copy buffer data', () => {
      const sourceBuffer = createMockGPUBuffer();
      const destBuffer = createMockGPUBuffer();
      const sourceOffset = 0;
      const destOffset = 64;
      const size = 128;

      const mockEncoder = createMockGPUCommandEncoder();
      mockDevice.createCommandEncoder.mockReturnValue(mockEncoder);

      const result = bufferManager.copyBufferToBuffer(sourceBuffer, sourceOffset, destBuffer, destOffset, size);

      expect(mockDevice.createCommandEncoder).toHaveBeenCalled();
      expect(mockEncoder.copyBufferToBuffer).toHaveBeenCalledWith(
        sourceBuffer,
        sourceOffset,
        destBuffer,
        destOffset,
        size
      );
      expect(result).toBe(mockEncoder);
    });
  });

  describe('getter methods', () => {
    beforeEach(() => {
      bufferManager.treeBuffer = createMockGPUBuffer();
      bufferManager.uniformBuffer = createMockGPUBuffer();
      bufferManager.vertexBuffer = createMockGPUBuffer();
      bufferManager.indexBuffer = createMockGPUBuffer();
      bufferManager.readBuffer = createMockGPUBuffer();
      bufferManager.geometryBuffer = createMockGPUBuffer();
    });

    it('should return WebGPU device', () => {
      expect(bufferManager.getDevice()).toBe(mockDevice);
    });

    it('should return tree buffer', () => {
      expect(bufferManager.getTreeBuffer()).toBe(bufferManager.treeBuffer);
    });

    it('should return uniform buffer', () => {
      expect(bufferManager.getUniformBuffer()).toBe(bufferManager.uniformBuffer);
    });

    it('should return vertex buffer', () => {
      expect(bufferManager.getVertexBuffer()).toBe(bufferManager.vertexBuffer);
    });

    it('should return index buffer', () => {
      expect(bufferManager.getIndexBuffer()).toBe(bufferManager.indexBuffer);
    });

    it('should return read buffer', () => {
      expect(bufferManager.getReadBuffer()).toBe(bufferManager.readBuffer);
    });

    it('should return geometry buffer', () => {
      expect(bufferManager.getGeometryBuffer()).toBe(bufferManager.geometryBuffer);
    });
  });

  describe('resizeTreeBuffers', () => {
    it('should resize buffers when size changes', () => {
      bufferManager.treeBuffer = createMockGPUBuffer(100);
      bufferManager.readBuffer = createMockGPUBuffer(100);
      const createTreeBufferSpy = vi.spyOn(bufferManager, 'createTreeBuffer');
      const createReadBufferSpy = vi.spyOn(bufferManager, 'createReadBuffer');

      const result = bufferManager.resizeTreeBuffers(5);

      expect(createTreeBufferSpy).toHaveBeenCalledWith(5);
      expect(createReadBufferSpy).toHaveBeenCalledWith(5);
      expect(result).toBe(true);
    });

    it('should not resize when size is the same', () => {
      // 3 trees * 8 floats * 4 bytes = 96 bytes
      bufferManager.treeBuffer = createMockGPUBuffer(96);
      bufferManager.readBuffer = createMockGPUBuffer(96);
      const createTreeBufferSpy = vi.spyOn(bufferManager, 'createTreeBuffer');
      const createReadBufferSpy = vi.spyOn(bufferManager, 'createReadBuffer');

      const result = bufferManager.resizeTreeBuffers(3);

      expect(createTreeBufferSpy).not.toHaveBeenCalled();
      expect(createReadBufferSpy).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should destroy all buffers and clear references', () => {
      const buffers = [
        createMockGPUBuffer(),
        createMockGPUBuffer(),
        createMockGPUBuffer(),
        createMockGPUBuffer(),
        createMockGPUBuffer(),
        createMockGPUBuffer()
      ];

      buffers.forEach((buffer, index) => {
        buffer.destroy = vi.fn();
        switch (index) {
          case 0: bufferManager.treeBuffer = buffer; break;
          case 1: bufferManager.uniformBuffer = buffer; break;
          case 2: bufferManager.vertexBuffer = buffer; break;
          case 3: bufferManager.indexBuffer = buffer; break;
          case 4: bufferManager.readBuffer = buffer; break;
          case 5: bufferManager.geometryBuffer = buffer; break;
        }
      });

      bufferManager.destroy();

      buffers.forEach(buffer => {
        expect(buffer.destroy).toHaveBeenCalled();
      });

      expect(bufferManager.treeBuffer).toBeNull();
      expect(bufferManager.uniformBuffer).toBeNull();
      expect(bufferManager.vertexBuffer).toBeNull();
      expect(bufferManager.indexBuffer).toBeNull();
      expect(bufferManager.readBuffer).toBeNull();
      expect(bufferManager.geometryBuffer).toBeNull();
    });

    it('should handle null buffers gracefully', () => {
      bufferManager.treeBuffer = null;
      bufferManager.uniformBuffer = null;

      expect(() => bufferManager.destroy()).not.toThrow();
    });
  });
});
