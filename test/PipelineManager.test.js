import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineManager } from '../js/webgpu/PipelineManager.js';

describe('PipelineManager', () => {
  let pipelineManager;
  let mockDevice;
  let mockFormat;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    mockFormat = 'bgra8unorm';
    pipelineManager = new PipelineManager(mockDevice, mockFormat);
  });

  describe('constructor', () => {
    it('should store device and format references', () => {
      expect(pipelineManager.device).toBe(mockDevice);
      expect(pipelineManager.format).toBe(mockFormat);
    });
  });

  describe('createComputePipeline', () => {
    it('should create compute pipeline with correct parameters', () => {
      const shaderCode = '@compute @workgroup_size(64) fn computeMain() {}';
      const bindGroupLayouts = [{}, {}]; // Mock bind group layouts
      const mockPipeline = {};

      mockDevice.createShaderModule.mockReturnValue({ code: shaderCode });
      mockDevice.createPipelineLayout.mockReturnValue({});
      mockDevice.createComputePipeline.mockReturnValue(mockPipeline);

      const result = pipelineManager.createComputePipeline(shaderCode, bindGroupLayouts);

      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({ code: shaderCode });
      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({ bindGroupLayouts });
      expect(mockDevice.createComputePipeline).toHaveBeenCalledWith({
        layout: {},
        compute: { module: { code: shaderCode }, entryPoint: 'computeMain' }
      });
      expect(result).toBe(mockPipeline);
    });

    it('should handle single bind group layout', () => {
      const shaderCode = 'fn computeMain() {}';
      const bindGroupLayouts = [{}];

      pipelineManager.createComputePipeline(shaderCode, bindGroupLayouts);

      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({ bindGroupLayouts: [{}] });
    });

    it('should handle empty bind group layouts array', () => {
      const shaderCode = 'fn computeMain() {}';
      const bindGroupLayouts = [];

      pipelineManager.createComputePipeline(shaderCode, bindGroupLayouts);

      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({ bindGroupLayouts: [] });
    });
  });

  describe('createRenderPipeline', () => {
    it('should create render pipeline with correct parameters', () => {
      const shaderCode = '@vertex fn vertMain() {} @fragment fn fragMain() {}';
      const bindGroupLayouts = [{}, {}];
      const vertexLayout = [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
      }];
      const mockPipeline = {};

      mockDevice.createShaderModule.mockReturnValue({ code: shaderCode });
      mockDevice.createPipelineLayout.mockReturnValue({});
      mockDevice.createRenderPipeline.mockReturnValue(mockPipeline);

      const result = pipelineManager.createRenderPipeline(shaderCode, bindGroupLayouts, vertexLayout);

      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({ code: shaderCode });
      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({ bindGroupLayouts });
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith({
        layout: {},
        vertex: {
          module: { code: shaderCode },
          entryPoint: 'vertMain',
          buffers: vertexLayout
        },
        fragment: {
          module: { code: shaderCode },
          entryPoint: 'fragMain',
          targets: [{
            format: mockFormat,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' }
            }
          }]
        },
        primitive: { topology: 'triangle-list' }
      });
      expect(result).toBe(mockPipeline);
    });

    it('should handle single vertex buffer layout', () => {
      const shaderCode = 'fn vertMain() {} fn fragMain() {}';
      const bindGroupLayouts = [{}];
      const vertexLayout = [{
        arrayStride: 12,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 0, format: 'float32x3' }
        ]
      }];

      pipelineManager.createRenderPipeline(shaderCode, bindGroupLayouts, vertexLayout);

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          vertex: expect.objectContaining({
            buffers: vertexLayout
          })
        })
      );
    });

    it('should handle multiple vertex buffers', () => {
      const shaderCode = 'fn vertMain() {} fn fragMain() {}';
      const bindGroupLayouts = [{}];
      const vertexLayout = [
        { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
        { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32' }] }
      ];

      pipelineManager.createRenderPipeline(shaderCode, bindGroupLayouts, vertexLayout);

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          vertex: expect.objectContaining({
            buffers: vertexLayout
          })
        })
      );
    });

    it('should use correct blend settings for alpha blending', () => {
      const shaderCode = 'fn vertMain() {} fn fragMain() {}';
      const bindGroupLayouts = [{}];
      const vertexLayout = [{}];

      pipelineManager.createRenderPipeline(shaderCode, bindGroupLayouts, vertexLayout);

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          fragment: expect.objectContaining({
            targets: [{
              format: mockFormat,
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' }
              }
            }]
          })
        })
      );
    });
  });
});
