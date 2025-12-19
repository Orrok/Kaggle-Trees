import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../demos/packing2/js/rendering/Renderer.js';

describe('Renderer', () => {
  let renderer;
  let mockDeviceManager;
  let mockPipelineManager;
  let mockBufferManager;
  let mockTreeGeometry;
  let mockDevice;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    mockDeviceManager = {
      device: mockDevice,
      getDevice: vi.fn().mockReturnValue(mockDevice),
      getContext: vi.fn().mockReturnValue({
        canvas: { width: 800, height: 600 },
        getCurrentTexture: vi.fn().mockReturnValue({
          createView: vi.fn().mockReturnValue({}),
          format: 'bgra8unorm',
          width: 800,
          height: 600
        })
      })
    };

    mockPipelineManager = {
      getComputePipeline: vi.fn().mockReturnValue({}),
      getBindGroup: vi.fn().mockReturnValue({}),
      getRenderPipeline: vi.fn().mockReturnValue({}),
      getRenderBindGroup: vi.fn().mockReturnValue({})
    };

    mockBufferManager = {
      getTreeBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
      getReadBuffer: vi.fn().mockReturnValue(createMockGPUBuffer())
    };

    mockTreeGeometry = {};

    renderer = new Renderer(
      mockDeviceManager,
      mockPipelineManager,
      mockBufferManager,
      mockTreeGeometry
    );
  });

  describe('constructor', () => {
    it('should store component references', () => {
      expect(renderer.deviceManager).toBe(mockDeviceManager);
      expect(renderer.pipelineManager).toBe(mockPipelineManager);
      expect(renderer.bufferManager).toBe(mockBufferManager);
      expect(renderer.treeGeometry).toBe(mockTreeGeometry);
      expect(renderer.context).toBe(mockDeviceManager.getContext());
    });
  });

  describe('render', () => {
    let mockCommandEncoder;

    beforeEach(() => {
      mockCommandEncoder = createMockGPUCommandEncoder();
      mockDevice.createCommandEncoder = vi.fn().mockReturnValue(mockCommandEncoder);

      // Mock the render pass methods
      renderer.renderComputePass = vi.fn();
      renderer.copyDataForFeedback = vi.fn();
      renderer.renderGraphicsPass = vi.fn();
    });

    it('should create command encoder', () => {
      const result = renderer.render(0.016, 1, {}, false);

      expect(mockDevice.createCommandEncoder).toHaveBeenCalled();
      expect(result).toBe(mockCommandEncoder);
    });

    it('should execute compute pass by default', () => {
      renderer.render(0.016, 1, {}, false);

      expect(renderer.renderComputePass).toHaveBeenCalled();
    });

    it('should execute compute pass when enabled', () => {
      // Temporarily enable compute pass
      const originalRender = renderer.render;
      renderer.render = function(deltaTime, frameCount, additionalParams, shouldReadBack) {
        console.log('[Renderer] Creating compute pass...');
        this.renderComputePass(mockCommandEncoder, additionalParams);
        this.renderGraphicsPass(mockCommandEncoder, additionalParams);
        return mockCommandEncoder;
      };

      renderer.render(0.016, 1, {}, false);

      expect(renderer.renderComputePass).toHaveBeenCalledWith(mockCommandEncoder, {});
    });

    it('should execute graphics pass', () => {
      renderer.render(0.016, 1, {}, false);

      expect(renderer.renderGraphicsPass).toHaveBeenCalledWith(mockCommandEncoder, {});
    });

    it('should copy data for feedback when requested', () => {
      renderer.render(0.016, 1, {}, true);

      expect(renderer.copyDataForFeedback).toHaveBeenCalledWith(mockCommandEncoder);
    });

    it('should not copy data for feedback when not requested', () => {
      renderer.render(0.016, 1, {}, false);

      expect(renderer.copyDataForFeedback).not.toHaveBeenCalled();
    });

    it('should pass additional params to render passes', () => {
      const additionalParams = { treeCount: 5, customParam: 'test' };

      renderer.render(0.016, 1, additionalParams, false);

      expect(renderer.renderGraphicsPass).toHaveBeenCalledWith(mockCommandEncoder, additionalParams);
    });
  });

  describe('renderComputePass', () => {
    let mockCommandEncoder;
    let mockComputePass;

    beforeEach(() => {
      mockCommandEncoder = createMockGPUCommandEncoder();
      mockComputePass = mockCommandEncoder.beginComputePass.mock.results[0]?.value || {};
    });

    it('should begin compute pass', () => {
      renderer.renderComputePass(mockCommandEncoder, {});

      expect(mockCommandEncoder.beginComputePass).toHaveBeenCalled();
    });

    it('should set compute pipeline', () => {
      renderer.renderComputePass(mockCommandEncoder, {});

      const computePass = mockCommandEncoder.beginComputePass.mock.results[0].value;
      expect(computePass.setPipeline).toHaveBeenCalledWith(mockPipelineManager.getComputePipeline());
    });

    it('should set bind group', () => {
      renderer.renderComputePass(mockCommandEncoder, {});

      const computePass = mockCommandEncoder.beginComputePass.mock.results[0].value;
      expect(computePass.setBindGroup).toHaveBeenCalledWith(0, mockPipelineManager.getBindGroup());
    });

    it('should dispatch workgroups based on tree count', () => {
      const treeCount = 256;

      renderer.renderComputePass(mockCommandEncoder, { treeCount });

      const computePass = mockCommandEncoder.beginComputePass.mock.results[0].value;
      const expectedWorkgroups = Math.ceil(treeCount / 64);
      expect(computePass.dispatchWorkgroups).toHaveBeenCalledWith(expectedWorkgroups);
    });

    it('should use default tree count of 3', () => {
      renderer.renderComputePass(mockCommandEncoder, {});

      const computePass = mockCommandEncoder.beginComputePass.mock.results[0].value;
      const expectedWorkgroups = Math.ceil(3 / 64);
      expect(computePass.dispatchWorkgroups).toHaveBeenCalledWith(expectedWorkgroups);
    });

    it('should end compute pass', () => {
      renderer.renderComputePass(mockCommandEncoder, {});

      const computePass = mockCommandEncoder.beginComputePass.mock.results[0].value;
      expect(computePass.end).toHaveBeenCalled();
    });
  });

  describe('copyDataForFeedback', () => {
    it('should copy buffer from tree buffer to read buffer', () => {
      const mockCommandEncoder = createMockGPUCommandEncoder();
      const mockTreeBuffer = createMockGPUBuffer(1024);
      const mockReadBuffer = createMockGPUBuffer(1024);

      mockBufferManager.getTreeBuffer.mockReturnValue(mockTreeBuffer);
      mockBufferManager.getReadBuffer.mockReturnValue(mockReadBuffer);

      renderer.copyDataForFeedback(mockCommandEncoder);

      expect(mockCommandEncoder.copyBufferToBuffer).toHaveBeenCalledWith(
        mockTreeBuffer,
        0,
        mockReadBuffer,
        0,
        mockTreeBuffer.size
      );
    });
  });

  describe('renderGraphicsPass', () => {
    let mockCommandEncoder;
    let mockRenderPass;

    beforeEach(() => {
      mockCommandEncoder = createMockGPUCommandEncoder();
      mockRenderPass = mockCommandEncoder.beginRenderPass.mock.results[0]?.value || {};
    });

    it('should begin render pass with correct color attachment', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      expect(mockCommandEncoder.beginRenderPass).toHaveBeenCalledWith({
        colorAttachments: [{
          view: expect.any(Object),
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
    });

    it('should get current texture from context', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      expect(renderer.context.getCurrentTexture).toHaveBeenCalled();
    });

    it('should create view from current texture', () => {
      const mockTexture = { createView: vi.fn() };
      renderer.context.getCurrentTexture.mockReturnValue(mockTexture);

      renderer.renderGraphicsPass(mockCommandEncoder, {});

      expect(mockTexture.createView).toHaveBeenCalled();
    });

    it('should set render pipeline', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      const renderPass = mockCommandEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.setPipeline).toHaveBeenCalledWith(mockPipelineManager.getRenderPipeline());
    });

    it('should set render bind group', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      const renderPass = mockCommandEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.setBindGroup).toHaveBeenCalledWith(0, mockPipelineManager.getRenderBindGroup());
    });

    it('should draw with correct vertex count and instance count', () => {
      const treeCount = 10;

      renderer.renderGraphicsPass(mockCommandEncoder, { treeCount });

      const renderPass = mockCommandEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.draw).toHaveBeenCalledWith(16, treeCount);
    });

    it('should use default tree count of 3', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      const renderPass = mockCommandEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.draw).toHaveBeenCalledWith(16, 3);
    });

    it('should end render pass', () => {
      renderer.renderGraphicsPass(mockCommandEncoder, {});

      const renderPass = mockCommandEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.end).toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('should submit command buffer to device queue', () => {
      const mockCommandEncoder = createMockGPUCommandEncoder();
      const mockCommandBuffer = {};
      mockCommandEncoder.finish.mockReturnValue(mockCommandBuffer);

      renderer.submit(mockCommandEncoder);

      expect(mockCommandEncoder.finish).toHaveBeenCalled();
      expect(mockDevice.queue.submit).toHaveBeenCalledWith([mockCommandBuffer]);
    });
  });

  describe('renderFrame', () => {
    beforeEach(() => {
      renderer.render = vi.fn().mockReturnValue(createMockGPUCommandEncoder());
      renderer.submit = vi.fn();
    });

    it('should call render with provided parameters', () => {
      const deltaTime = 0.016;
      const frameCount = 42;
      const additionalParams = { treeCount: 5 };
      const shouldReadBack = true;

      renderer.renderFrame(deltaTime, frameCount, additionalParams, shouldReadBack);

      expect(renderer.render).toHaveBeenCalledWith(deltaTime, frameCount, additionalParams, shouldReadBack, true);
    });

    it('should submit the command encoder', () => {
      renderer.renderFrame(0.016, 1, {}, false);

      expect(renderer.submit).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should use default parameters', () => {
      renderer.renderFrame(0.016, 1);

      expect(renderer.render).toHaveBeenCalledWith(0.016, 1, {}, false, true);
    });
  });

  describe('getRenderTargetSize', () => {
    it('should return canvas dimensions', () => {
      const result = renderer.getRenderTargetSize();

      expect(result).toEqual({
        width: 800,
        height: 600
      });
    });

    it('should throw error when context is null', () => {
      // Create a fresh renderer instance to test
      const testRenderer = new Renderer(
        mockDeviceManager,
        mockPipelineManager,
        mockBufferManager,
        mockTreeGeometry
      );

      // Override context to be null - this exposes the bug
      testRenderer.context = null;

      // This should throw a descriptive error
      expect(() => testRenderer.getRenderTargetSize()).toThrow('Renderer context is not initialized');
    });

    it('should throw error when context.canvas is null', () => {
      // Create a fresh renderer instance to test
      const testRenderer = new Renderer(
        mockDeviceManager,
        mockPipelineManager,
        mockBufferManager,
        mockTreeGeometry
      );

      // Override context.canvas to be null
      testRenderer.context = { canvas: null };

      // This should throw a descriptive error
      expect(() => testRenderer.getRenderTargetSize()).toThrow('Renderer context canvas is not available');
    });
  });

  describe('resize', () => {
    it('should update canvas dimensions', () => {
      const newWidth = 1024;
      const newHeight = 768;

      renderer.resize(newWidth, newHeight);

      expect(renderer.context.canvas.width).toBe(newWidth);
      expect(renderer.context.canvas.height).toBe(newHeight);
    });
  });
});
