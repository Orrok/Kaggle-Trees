import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Simulation } from '../js/webgpu/Simulation.js';

describe('Simulation', () => {
  let simulation;
  let mockDeviceManager;
  let mockInputManager;
  let mockDevice;
  let mockBufferManager;
  let mockPipelineManager;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
    mockDeviceManager = {
      device: mockDevice,
      canvas: { width: 800, height: 600 },
      context: {
        canvas: { width: 800, height: 600 },
        getCurrentTexture: vi.fn().mockReturnValue({
          createView: vi.fn().mockReturnValue({}),
          format: 'bgra8unorm',
          width: 800,
          height: 600
        })
      }
    };
    mockInputManager = {
      touchX: 0.5,
      touchY: 0.5,
      isTouching: 0
    };

    // Mock ShaderLoader
    vi.doMock('../js/webgpu/ShaderLoader.js', () => ({
      ShaderLoader: {
        loadShaders: vi.fn().mockResolvedValue({
          compute: 'compute shader code',
          render: 'render shader code'
        })
      }
    }));

    // Create simulation instance
    simulation = new Simulation(mockDeviceManager, mockInputManager);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(simulation.deviceManager).toBe(mockDeviceManager);
      expect(simulation.inputManager).toBe(mockInputManager);
      expect(simulation.device).toBe(mockDevice);
      expect(simulation.MAX_PARTICLE_COUNT).toBe(1000000);
      expect(simulation.activeParticleCount).toBe(30000);
      expect(simulation.frameCount).toBe(0);
      expect(simulation.isRunning).toBe(false);
      expect(simulation.onFPSUpdate).toBeNull();
      expect(simulation.uniformValues).toBeInstanceOf(Float32Array);
      expect(simulation.uniformValues.length).toBe(8);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      // Mock buffer manager methods
      simulation.bufferManager = {
        createStorageBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        createUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        createVertexBuffer: vi.fn()
      };

      // Mock pipeline manager methods
      simulation.pipelineManager = {
        createComputePipeline: vi.fn().mockReturnValue({}),
        createRenderPipeline: vi.fn().mockReturnValue({})
      };
    });

    it('should load shaders and initialize components', async () => {
      const initBuffersSpy = vi.spyOn(simulation, 'initBuffers');
      const initPipelinesSpy = vi.spyOn(simulation, 'initPipelines');
      const initBindGroupsSpy = vi.spyOn(simulation, 'initBindGroups');

      await simulation.init();

      expect(initBuffersSpy).toHaveBeenCalled();
      expect(initPipelinesSpy).toHaveBeenCalled();
      expect(initBindGroupsSpy).toHaveBeenCalled();
    });
  });

  describe('initBuffers', () => {
    beforeEach(() => {
      simulation.bufferManager = {
        createStorageBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        createUniformBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
        createVertexBuffer: vi.fn()
      };
    });

    it('should create particle buffer with correct size', () => {
      const mockParticleBuffer = createMockGPUBuffer(simulation.MAX_PARTICLE_COUNT * 32);
      simulation.bufferManager.createStorageBuffer.mockReturnValue(mockParticleBuffer);

      simulation.initBuffers();

      expect(simulation.bufferManager.createStorageBuffer).toHaveBeenCalledWith(
        simulation.MAX_PARTICLE_COUNT * 32,
        true
      );
      expect(simulation.particleBuffer).toBe(mockParticleBuffer);
    });

    it('should initialize particle data correctly', () => {
      const mockBuffer = createMockGPUBuffer(simulation.MAX_PARTICLE_COUNT * 32);
      const mockMappedRange = new Float32Array(mockBuffer.getMappedRange());
      simulation.bufferManager.createStorageBuffer.mockReturnValue(mockBuffer);

      simulation.initBuffers();

      expect(mockBuffer.getMappedRange).toHaveBeenCalled();
      expect(mockBuffer.unmap).toHaveBeenCalled();
      // Check that some particles have been initialized (basic smoke test)
      expect(mockMappedRange.length).toBe(simulation.MAX_PARTICLE_COUNT * 8);
    });

    it('should create uniform buffer', () => {
      const mockUniformBuffer = createMockGPUBuffer(32);
      simulation.bufferManager.createUniformBuffer.mockReturnValue(mockUniformBuffer);

      simulation.initBuffers();

      expect(simulation.bufferManager.createUniformBuffer).toHaveBeenCalledWith(32);
      expect(simulation.uniformBuffer).toBe(mockUniformBuffer);
    });

    it('should create vertex buffer for quad rendering', () => {
      const expectedQuadData = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);

      simulation.initBuffers();

      expect(simulation.bufferManager.createVertexBuffer).toHaveBeenCalledWith(expectedQuadData);
    });
  });

  describe('initPipelines', () => {
    beforeEach(() => {
      simulation.pipelineManager = {
        createComputePipeline: vi.fn().mockReturnValue({}),
        createRenderPipeline: vi.fn().mockReturnValue({})
      };
      simulation.device = mockDevice;
      simulation.deviceManager = { format: 'bgra8unorm' };
    });

    it('should create bind group layouts', () => {
      const shaders = { compute: 'compute code', render: 'render code' };

      simulation.initPipelines(shaders);

      expect(mockDevice.createBindGroupLayout).toHaveBeenCalledTimes(2);
    });

    it('should create compute pipeline', () => {
      const shaders = { compute: 'compute code', render: 'render code' };

      simulation.initPipelines(shaders);

      expect(simulation.pipelineManager.createComputePipeline).toHaveBeenCalledWith(
        shaders.compute,
        [expect.any(Object)]
      );
    });

    it('should create render pipeline', () => {
      const shaders = { compute: 'compute code', render: 'render code' };
      const vertexLayout = [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
      }];

      simulation.initPipelines(shaders);

      expect(simulation.pipelineManager.createRenderPipeline).toHaveBeenCalledWith(
        shaders.render,
        [{}],
        vertexLayout
      );
    });
  });

  describe('initBindGroups', () => {
    beforeEach(() => {
      simulation.device = mockDevice;
      simulation.particleBuffer = createMockGPUBuffer();
      simulation.uniformBuffer = createMockGPUBuffer();
      simulation.computeBindGroupLayout = {};
      simulation.renderBindGroupLayout = {};
    });

    it('should create compute bind group', () => {
      simulation.initBindGroups();

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: simulation.computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: simulation.particleBuffer } },
          { binding: 1, resource: { buffer: simulation.uniformBuffer } }
        ]
      });
    });

    it('should create render bind group', () => {
      simulation.initBindGroups();

      expect(mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: simulation.renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: simulation.particleBuffer } },
          { binding: 1, resource: { buffer: simulation.uniformBuffer } }
        ]
      });
    });
  });

  describe('setParticleCount', () => {
    it('should update active particle count', () => {
      const newCount = 50000;

      simulation.setParticleCount(newCount);

      expect(simulation.activeParticleCount).toBe(newCount);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      global.performance.now = vi.fn().mockReturnValue(1000);
      global.requestAnimationFrame = vi.fn();
    });

    it('should start simulation if not already running', () => {
      simulation.start();

      expect(simulation.isRunning).toBe(true);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should not start if already running', () => {
      simulation.isRunning = true;

      simulation.start();

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('should set last time on start', () => {
      simulation.lastTime = 500;

      simulation.start();

      expect(simulation.lastTime).toBe(1000); // performance.now() returns 1000
    });
  });

  describe('loop', () => {
    beforeEach(() => {
      global.requestAnimationFrame = vi.fn();
      global.performance.now = vi.fn();
    });

    it('should not execute if not running', () => {
      simulation.isRunning = false;

      simulation.loop();

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('should update FPS every second', () => {
      simulation.isRunning = true;
      simulation.frameCount = 60;
      simulation.lastTime = 1000;
      simulation.onFPSUpdate = vi.fn();

      global.performance.now.mockReturnValue(2000); // 1 second later

      simulation.loop();

      expect(simulation.onFPSUpdate).toHaveBeenCalledWith(61);
      expect(simulation.frameCount).toBe(0);
      expect(simulation.lastTime).toBe(2000);
    });

    it('should call updateUniforms and render', () => {
      simulation.isRunning = true;
      simulation.updateUniforms = vi.fn();
      simulation.render = vi.fn();

      simulation.loop();

      expect(simulation.updateUniforms).toHaveBeenCalled();
      expect(simulation.render).toHaveBeenCalled();
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('updateUniforms', () => {
    beforeEach(() => {
      simulation.uniformBuffer = createMockGPUBuffer();
      simulation.device = mockDevice;
      simulation.deviceManager = { canvas: { width: 800, height: 600 } };
      simulation.inputManager = { touchX: 0.3, touchY: -0.4, isTouching: 1 };
      simulation.activeParticleCount = 25000;
    });

    it('should update uniform values correctly', () => {
      const mockNow = 1234.567;
      global.performance.now = vi.fn().mockReturnValue(mockNow);

      simulation.updateUniforms(mockNow);

      expect(simulation.uniformValues[0]).toBeCloseTo(mockNow / 1000, 5); // time in seconds
      expect(simulation.uniformValues[1]).toBe(800); // canvas width
      expect(simulation.uniformValues[2]).toBe(600); // canvas height
      expect(simulation.uniformValues[3]).toBeCloseTo(0.3, 5); // touchX
      expect(simulation.uniformValues[4]).toBeCloseTo(-0.4, 5); // touchY
      expect(simulation.uniformValues[5]).toBe(1); // isTouching
      expect(simulation.uniformValues[6]).toBe(25000); // particle count
    });

    it('should write buffer to GPU', () => {
      simulation.updateUniforms(1000);

      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        simulation.uniformBuffer,
        0,
        simulation.uniformValues
      );
    });
  });

  describe('render', () => {
    beforeEach(() => {
      simulation.device = mockDevice;
      simulation.computePipeline = {};
      simulation.renderPipeline = {};
      simulation.computeBG = {};
      simulation.renderBG = {};
      simulation.vertexBuffer = createMockGPUBuffer();
      simulation.deviceManager = { context: { getCurrentTexture: vi.fn().mockReturnValue({ createView: vi.fn() }) } };
      simulation.activeParticleCount = 16384;
    });

    it('should create command encoder', () => {
      const mockEncoder = createMockGPUCommandEncoder();
      mockDevice.createCommandEncoder.mockReturnValue(mockEncoder);

      simulation.render();

      expect(mockDevice.createCommandEncoder).toHaveBeenCalled();
    });

    it('should execute compute pass', () => {
      const mockEncoder = createMockGPUCommandEncoder();
      mockDevice.createCommandEncoder.mockReturnValue(mockEncoder);

      simulation.render();

      expect(mockEncoder.beginComputePass).toHaveBeenCalled();
      const computePass = mockEncoder.beginComputePass.mock.results[0].value;
      expect(computePass.setPipeline).toHaveBeenCalledWith(simulation.computePipeline);
      expect(computePass.setBindGroup).toHaveBeenCalledWith(0, simulation.computeBG);
      expect(computePass.dispatchWorkgroups).toHaveBeenCalledWith(Math.ceil(16384 / 64));
      expect(computePass.end).toHaveBeenCalled();
    });

    it('should execute render pass', () => {
      const mockEncoder = createMockGPUCommandEncoder();
      mockDevice.createCommandEncoder.mockReturnValue(mockEncoder);

      simulation.render();

      expect(mockEncoder.beginRenderPass).toHaveBeenCalled();
      const renderPass = mockEncoder.beginRenderPass.mock.results[0].value;
      expect(renderPass.setPipeline).toHaveBeenCalledWith(simulation.renderPipeline);
      expect(renderPass.setBindGroup).toHaveBeenCalledWith(0, simulation.renderBG);
      expect(renderPass.setVertexBuffer).toHaveBeenCalledWith(0, simulation.vertexBuffer);
      expect(renderPass.draw).toHaveBeenCalledWith(6, 16384);
      expect(renderPass.end).toHaveBeenCalled();
    });

    it('should submit command buffer', () => {
      const mockEncoder = createMockGPUCommandEncoder();
      const mockCommandBuffer = {};
      mockEncoder.finish.mockReturnValue(mockCommandBuffer);
      mockDevice.createCommandEncoder.mockReturnValue(mockEncoder);

      simulation.render();

      expect(mockEncoder.finish).toHaveBeenCalled();
      expect(mockDevice.queue.submit).toHaveBeenCalledWith([mockCommandBuffer]);
    });
  });
});
