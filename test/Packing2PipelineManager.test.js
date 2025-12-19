import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineManager } from '../demos/packing2/js/webgpu/PipelineManager.js';

describe('PipelineManager (Packing2)', () => {
  let pipelineManager;
  let mockDeviceManager;
  let mockDevice;
  let mockTreeGeometry;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    mockDeviceManager = {
      getDevice: vi.fn().mockReturnValue(mockDevice),
      getPreferredFormat: vi.fn().mockReturnValue('bgra8unorm')
    };

    mockTreeGeometry = {};

    pipelineManager = new PipelineManager(mockDeviceManager, mockTreeGeometry);
  });

  describe('constructor', () => {
    it('should initialize with device manager and tree geometry', () => {
      expect(pipelineManager.deviceManager).toBe(mockDeviceManager);
      expect(pipelineManager.device).toBe(mockDevice);
      expect(pipelineManager.treeGeometry).toBe(mockTreeGeometry);
      expect(pipelineManager.computePipeline).toBeNull();
      expect(pipelineManager.renderPipeline).toBeNull();
      expect(pipelineManager.computeBindGroupLayout).toBeNull();
      expect(pipelineManager.renderBindGroupLayout).toBeNull();
      expect(pipelineManager.computeBindGroup).toBeNull();
      expect(pipelineManager.renderBindGroup).toBeNull();
    });
  });

  describe('initPipelines', () => {
    beforeEach(() => {
      pipelineManager.destroy = vi.fn();
      pipelineManager.createBindGroupLayout = vi.fn();
      pipelineManager.createComputePipeline = vi.fn().mockResolvedValue();
      pipelineManager.createRenderPipeline = vi.fn().mockResolvedValue();
      pipelineManager.createBindGroup = vi.fn();
    });

    it('should destroy existing resources first', async () => {
      await pipelineManager.initPipelines();

      expect(pipelineManager.destroy).toHaveBeenCalled();
    });

    it('should create bind group layouts', async () => {
      await pipelineManager.initPipelines();

      expect(pipelineManager.createBindGroupLayout).toHaveBeenCalled();
    });

    it('should create compute pipeline', async () => {
      await pipelineManager.initPipelines();

      expect(pipelineManager.createComputePipeline).toHaveBeenCalled();
    });

    it('should create render pipeline', async () => {
      await pipelineManager.initPipelines();

      expect(pipelineManager.createRenderPipeline).toHaveBeenCalled();
    });

    it('should create bind groups', async () => {
      await pipelineManager.initPipelines();

      expect(pipelineManager.createBindGroup).toHaveBeenCalled();
    });
  });

  describe('createComputePipeline', () => {
    beforeEach(() => {
      pipelineManager.computeBindGroupLayout = {};
    });

    it('should create shader module with compute code', async () => {
      const mockShaderModule = {};
      const mockPipelineLayout = {};
      const mockPipeline = {};

      mockDevice.createShaderModule.mockReturnValue(mockShaderModule);
      mockDevice.createPipelineLayout.mockReturnValue(mockPipelineLayout);
      mockDevice.createComputePipeline.mockReturnValue(mockPipeline);

      await pipelineManager.createComputePipeline();

      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
        code: expect.stringContaining('@compute @workgroup_size(64)')
      });
    });

    it('should create pipeline layout with compute bind group layout', async () => {
      const mockPipelineLayout = {};
      mockDevice.createPipelineLayout.mockReturnValue(mockPipelineLayout);

      await pipelineManager.createComputePipeline();

      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({
        bindGroupLayouts: [pipelineManager.computeBindGroupLayout]
      });
    });

    it('should create compute pipeline with correct configuration', async () => {
      const mockPipeline = {};
      mockDevice.createComputePipeline.mockReturnValue(mockPipeline);

      await pipelineManager.createComputePipeline();

      expect(mockDevice.createComputePipeline).toHaveBeenCalledWith({
        layout: expect.any(Object),
        compute: {
          module: expect.any(Object),
          entryPoint: 'main'
        }
      });
      expect(pipelineManager.computePipeline).toBe(mockPipeline);
    });
  });

  describe('createRenderPipeline', () => {
    beforeEach(() => {
      pipelineManager.renderBindGroupLayout = {};
    });

    it('should create shader module with render code', async () => {
      const mockShaderModule = {};
      const mockPipelineLayout = {};
      const mockPipeline = {};

      mockDevice.createShaderModule.mockReturnValue(mockShaderModule);
      mockDevice.createPipelineLayout.mockReturnValue(mockPipelineLayout);
      mockDevice.createRenderPipeline.mockReturnValue(mockPipeline);

      await pipelineManager.createRenderPipeline();

      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
        code: expect.stringContaining('@vertex')
      });
      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
        code: expect.stringContaining('@fragment')
      });
    });

    it('should create pipeline layout with render bind group layout', async () => {
      const mockPipelineLayout = {};
      mockDevice.createPipelineLayout.mockReturnValue(mockPipelineLayout);

      await pipelineManager.createRenderPipeline();

      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({
        bindGroupLayouts: [pipelineManager.renderBindGroupLayout]
      });
    });

    it('should create render pipeline with correct configuration', async () => {
      const mockPipeline = {};
      mockDevice.createRenderPipeline.mockReturnValue(mockPipeline);

      await pipelineManager.createRenderPipeline();

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith({
        layout: expect.any(Object),
        vertex: {
          module: expect.any(Object),
          entryPoint: 'vert'
        },
        fragment: {
          module: expect.any(Object),
          entryPoint: 'frag',
          targets: [{
            format: 'bgra8unorm'
          }]
        },
        primitive: {
          topology: 'line-strip'
        }
      });
      expect(pipelineManager.renderPipeline).toBe(mockPipeline);
    });

    it('should use preferred format from device manager', async () => {
      mockDeviceManager.getPreferredFormat.mockReturnValue('rgba8unorm');

      await pipelineManager.createRenderPipeline();

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          fragment: expect.objectContaining({
            targets: [{
              format: 'rgba8unorm'
            }]
          })
        })
      );
    });
  });

  describe('createBindGroupLayout', () => {
    it('should create compute bind group layout with storage and uniform bindings', () => {
      const mockComputeLayout = {};
      const mockRenderLayout = {};

      mockDevice.createBindGroupLayout
        .mockReturnValueOnce(mockComputeLayout)
        .mockReturnValueOnce(mockRenderLayout);

      pipelineManager.createBindGroupLayout();

      expect(mockDevice.createBindGroupLayout).toHaveBeenCalledWith({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
          }
        ]
      });
      expect(pipelineManager.computeBindGroupLayout).toBe(mockComputeLayout);
    });

    it('should create render bind group layout with read-only bindings', () => {
      const mockComputeLayout = {};
      const mockRenderLayout = {};

      mockDevice.createBindGroupLayout
        .mockReturnValueOnce(mockComputeLayout)
        .mockReturnValueOnce(mockRenderLayout);

      pipelineManager.createBindGroupLayout();

      expect(mockDevice.createBindGroupLayout).toHaveBeenCalledWith({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
          }
        ]
      });
      expect(pipelineManager.renderBindGroupLayout).toBe(mockRenderLayout);
    });
  });

  describe('createBindGroup', () => {
    beforeEach(() => {
      pipelineManager.computeBindGroupLayout = {};
      pipelineManager.renderBindGroupLayout = {};
      pipelineManager.bufferManager = {
        getTreeBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getGeometryBuffer: vi.fn().mockReturnValue(createMockGPUBuffer())
      };
    });

    it('should create compute bind group with tree, uniform, and geometry buffers', () => {
      const mockBindGroup = {};
      mockDevice.createBindGroup.mockReturnValue(mockBindGroup);

      pipelineManager.createBindGroup();

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: pipelineManager.computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: pipelineManager.bufferManager.getTreeBuffer() } },
          { binding: 1, resource: { buffer: pipelineManager.bufferManager.getUniformBuffer() } }
        ]
      });
      expect(pipelineManager.computeBindGroup).toBe(mockBindGroup);
    });

    it('should create render bind group with tree and uniform buffers', () => {
      const mockBindGroup = {};
      mockDevice.createBindGroup
        .mockReturnValueOnce({}) // compute bind group
        .mockReturnValueOnce(mockBindGroup); // render bind group

      pipelineManager.createBindGroup();

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: pipelineManager.renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: pipelineManager.bufferManager.getTreeBuffer() } },
          { binding: 1, resource: { buffer: pipelineManager.bufferManager.getUniformBuffer() } }
        ]
      });
      expect(pipelineManager.renderBindGroup).toBe(mockBindGroup);
    });
  });

  describe('updateBindGroup', () => {
    beforeEach(() => {
      pipelineManager.computeBindGroupLayout = {};
      pipelineManager.renderBindGroupLayout = {};
      const mockBufferManager = {
        getTreeBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getGeometryBuffer: vi.fn().mockReturnValue(createMockGPUBuffer())
      };

      pipelineManager.updateBindGroup(mockBufferManager);

      expect(pipelineManager.bufferManager).toBe(mockBufferManager);
    });

    it('should update compute bind group with new buffer manager', () => {
      const mockBufferManager = {
        getTreeBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getGeometryBuffer: vi.fn().mockReturnValue(createMockGPUBuffer())
      };

      pipelineManager.updateBindGroup(mockBufferManager);

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: pipelineManager.computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: mockBufferManager.getTreeBuffer() } },
          { binding: 1, resource: { buffer: mockBufferManager.getUniformBuffer() } }
        ]
      });
    });

    it('should update render bind group with new buffer manager', () => {
      const mockBufferManager = {
        getTreeBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        getGeometryBuffer: vi.fn().mockReturnValue(createMockGPUBuffer())
      };

      pipelineManager.updateBindGroup(mockBufferManager);

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: pipelineManager.renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: mockBufferManager.getTreeBuffer() } },
          { binding: 1, resource: { buffer: mockBufferManager.getUniformBuffer() } }
        ]
      });
    });
  });

  describe('getter methods', () => {
    beforeEach(() => {
      pipelineManager.computePipeline = {};
      pipelineManager.renderPipeline = {};
      pipelineManager.computeBindGroup = {};
      pipelineManager.renderBindGroup = {};
    });

    it('should return compute pipeline', () => {
      expect(pipelineManager.getComputePipeline()).toBe(pipelineManager.computePipeline);
    });

    it('should return render pipeline', () => {
      expect(pipelineManager.getRenderPipeline()).toBe(pipelineManager.renderPipeline);
    });

    it('should return compute bind group', () => {
      expect(pipelineManager.getBindGroup()).toBe(pipelineManager.computeBindGroup);
    });

    it('should return render bind group', () => {
      expect(pipelineManager.getRenderBindGroup()).toBe(pipelineManager.renderBindGroup);
    });
  });

  describe('getComputeShaderCode', () => {
    it('should return valid WGSL compute shader code', () => {
      const code = pipelineManager.getComputeShaderCode();

      expect(typeof code).toBe('string');
      expect(code).toContain('@compute @workgroup_size(64)');
      expect(code).toContain('fn main(@builtin(global_invocation_id) id: vec3u)');
      expect(code).toContain('struct Tree');
      expect(code).toContain('struct Params');
    });

    it('should include timestamp for cache invalidation', () => {
      const code = pipelineManager.getComputeShaderCode();

      expect(code).toContain('Compute shader v');
    });
  });

  describe('getRenderShaderCode', () => {
    it('should return valid WGSL render shader code', () => {
      const code = pipelineManager.getRenderShaderCode();

      expect(typeof code).toBe('string');
      expect(code).toContain('@vertex');
      expect(code).toContain('@fragment');
      expect(code).toContain('fn vert');
      expect(code).toContain('fn frag');
      expect(code).toContain('struct Tree');
      expect(code).toContain('struct Params');
    });

    it('should include hardcoded tree polygon data', () => {
      const code = pipelineManager.getRenderShaderCode();

      expect(code).toContain('var<private> tree_poly: array<vec2f, 16>');
      expect(code).toContain('vec2f(0.0, 0.8)');
    });

    it('should include timestamp for cache invalidation', () => {
      const code = pipelineManager.getRenderShaderCode();

      expect(code).toContain('Render shader v');
    });
  });

  describe('destroy', () => {
    it('should clear all pipeline and bind group references', () => {
      pipelineManager.computePipeline = {};
      pipelineManager.renderPipeline = {};
      pipelineManager.computeBindGroup = {};
      pipelineManager.renderBindGroup = {};
      pipelineManager.computeBindGroupLayout = {};
      pipelineManager.renderBindGroupLayout = {};

      pipelineManager.destroy();

      expect(pipelineManager.computePipeline).toBeNull();
      expect(pipelineManager.renderPipeline).toBeNull();
      expect(pipelineManager.computeBindGroup).toBeNull();
      expect(pipelineManager.renderBindGroup).toBeNull();
      expect(pipelineManager.computeBindGroupLayout).toBeNull();
      expect(pipelineManager.renderBindGroupLayout).toBeNull();
    });
  });
});
