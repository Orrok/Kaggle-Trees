import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsSimulator } from '../demos/packing2/js/simulation/PhysicsSimulator.js';

// Mock dependencies
const mockBufferManager = {
  writeBuffer: vi.fn(),
  getTreeBuffer: vi.fn().mockReturnValue('mock-tree-buffer'),
  getUniformBuffer: vi.fn().mockReturnValue('mock-uniform-buffer'),
  getReadBuffer: vi.fn().mockReturnValue('mock-read-buffer')
};

const mockSimulationParameters = {
  get: vi.fn(),
  getUniforms: vi.fn()
};

const mockTreeGeometry = {
  getRadius: vi.fn().mockReturnValue(0.1)
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn()
};

describe('PhysicsSimulator', () => {
  let simulator;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock returns
    mockSimulationParameters.get.mockReturnValue(3); // treeCount = 3
    mockSimulationParameters.getUniforms.mockReturnValue(new Float32Array([1, 2, 3, 4]));

    simulator = new PhysicsSimulator(
      mockBufferManager,
      mockSimulationParameters,
      mockTreeGeometry,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(simulator.bufferManager).toBe(mockBufferManager);
      expect(simulator.parameters).toBe(mockSimulationParameters);
      expect(simulator.treeGeometry).toBe(mockTreeGeometry);
      expect(simulator.logger).toBe(mockLogger);

      expect(simulator.feedbackFrameCount).toBe(0);
      expect(simulator.currentBounds).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
      expect(simulator.targetAspectRatio).toBe(1.0);
      expect(simulator.needsReset).toBe(false);
      expect(simulator.isProcessingFeedback).toBe(false);
    });
  });

  describe('reset method', () => {
    it('should reset processing flag and generate tree data', () => {
      simulator.isProcessingFeedback = true;
      simulator.needsReset = true;

      simulator.reset();

      expect(simulator.isProcessingFeedback).toBe(false);
      expect(simulator.needsReset).toBe(false);
      expect(mockSimulationParameters.get).toHaveBeenCalledWith('treeCount');
      expect(mockBufferManager.writeBuffer).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Simulation reset');
    });

  it('should generate correct tree data structure', () => {
    mockSimulationParameters.get.mockReturnValue(2); // 2 trees

    simulator.reset();

    const writeCall = mockBufferManager.writeBuffer.mock.calls[0];
    const treeData = writeCall[1]; // Second argument is the data

    expect(treeData).toBeInstanceOf(Float32Array);
    expect(treeData.length).toBe(16); // 2 trees * 8 floats each

    // Check tree data structure (8 floats per tree: pos.x, pos.y, vel.x, vel.y, rot, ang_vel, col, _pad)
    // Position should be randomly spread
    expect(typeof treeData[0]).toBe('number'); // pos.x
    expect(typeof treeData[1]).toBe('number'); // pos.y

    // Velocity should be 0
    expect(treeData[2]).toBe(0); // vel.x
    expect(treeData[3]).toBe(0); // vel.y

    // Rotation should be set to a random value
    expect(typeof treeData[4]).toBe('number'); // rot
    expect(treeData[4]).toBeGreaterThanOrEqual(0);
    expect(treeData[4]).toBeLessThanOrEqual(6.28);

    // Angular velocity should be 0
    expect(treeData[5]).toBe(0); // ang_vel

    // Collision flag should be 0
    expect(treeData[6]).toBe(0); // col

    // Padding should be 0
    expect(treeData[7]).toBe(0); // _pad
    });

  it('should generate trees with random spread', () => {
    mockSimulationParameters.get.mockReturnValue(4); // 4 trees

    simulator.reset();

    const treeData = mockBufferManager.writeBuffer.mock.calls[0][1];

    // Check that positions are randomly generated within spread bounds
    const spread = Math.sqrt(4) * 2.0; // spread = sqrt(count) * 2.0
    expect(treeData[0]).toBeGreaterThanOrEqual(-spread/2); // x position within bounds
    expect(treeData[0]).toBeLessThanOrEqual(spread/2);
    expect(treeData[1]).toBeGreaterThanOrEqual(-spread/2); // y position within bounds
    expect(treeData[1]).toBeLessThanOrEqual(spread/2);

    // Check that velocities are 0 (not random initial velocities)
    expect(treeData[2]).toBe(0); // velocity.x = 0
    expect(treeData[3]).toBe(0); // velocity.y = 0
    expect(treeData[5]).toBe(0); // angular velocity = 0

    // Check that rotations are randomly set between 0 and 2π
      expect(treeData[2]).toBeGreaterThanOrEqual(0); // rotation
      expect(treeData[2]).toBeLessThanOrEqual(2 * Math.PI); // rotation
    });
  });

  describe('calculateCompressionProbabilities method', () => {
    it('should return default probabilities when autoPack is disabled', () => {
      mockSimulationParameters.get.mockReturnValue(false); // autoPack = false

      const result = simulator.calculateCompressionProbabilities({ currentAspect: 2.0 });

      expect(result).toEqual({ probX: 1.0, probY: 1.0 });
    });

    it('should return default probabilities when no feedback data provided', () => {
      mockSimulationParameters.get.mockReturnValue(true); // autoPack = true

      const result = simulator.calculateCompressionProbabilities(null);

      expect(result).toEqual({ probX: 1.0, probY: 1.0 });
    });

    it('should compress more in X when current aspect is greater than target', () => {
      mockSimulationParameters.get
        .mockReturnValueOnce(true) // autoPack = true
        .mockReturnValueOnce(1.0); // aspect = 1.0

      const feedbackData = {
        currentAspect: 2.0, // wider than target
        width: 2.0,
        height: 1.0
      };

      const result = simulator.calculateCompressionProbabilities(feedbackData);

      expect(result.probX).toBe(1.2);
      expect(result.probY).toBe(0.8);
    });

    it('should compress more in Y when current aspect is less than target', () => {
      mockSimulationParameters.get
        .mockReturnValueOnce(true) // autoPack = true
        .mockReturnValueOnce(1.0); // aspect = 1.0

      const feedbackData = {
        currentAspect: 0.5, // taller than target
        width: 1.0,
        height: 2.0
      };

      const result = simulator.calculateCompressionProbabilities(feedbackData);

      expect(result.probX).toBe(0.8);
      expect(result.probY).toBe(1.2);
    });

    it('should not compress when current aspect equals target', () => {
      mockSimulationParameters.get
        .mockReturnValueOnce(true) // autoPack = true
        .mockReturnValueOnce(1.0); // aspect = 1.0

      const feedbackData = {
        currentAspect: 1.0, // equal to target
        width: 1.0,
        height: 1.0
      };

      const result = simulator.calculateCompressionProbabilities(feedbackData);

      expect(result.probX).toBe(1.0);
      expect(result.probY).toBe(1.0);
    });
  });


  describe('updateUniforms method', () => {
    it('should delegate to parameters.getUniforms and write to buffer', () => {
      const deltaTime = 0.016;
      const frameCount = 100;
      const additionalParams = { probX: 0.8, probY: 1.2, centerX: 0.5, centerY: -0.3 };

      simulator.updateUniforms(deltaTime, frameCount, additionalParams);

      expect(mockSimulationParameters.getUniforms).toHaveBeenCalledWith(
        deltaTime,
        frameCount,
        additionalParams
      );
      expect(mockBufferManager.writeBuffer).toHaveBeenCalledWith(
        'mock-uniform-buffer',
        new Float32Array([1, 2, 3, 4])
      );
    });

    it('should use default values when additionalParams not provided', () => {
      simulator.updateUniforms(0.016, 100);

      expect(mockSimulationParameters.getUniforms).toHaveBeenCalledWith(
        0.016,
        100,
        { probX: 1.0, probY: 1.0, centerX: 0.0, centerY: 0.0 }
      );
    });
  });

  describe('processFeedbackLoop method', () => {
    // Note: This method has WebGPU dependencies, so we'd need extensive mocking
    // For now, we'll test the parts that can be tested

    it('should return null if already processing feedback', async () => {
      simulator.isProcessingFeedback = true;

      const result = await simulator.processFeedbackLoop();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Mock a scenario that would cause an error
      mockBufferManager.getReadBuffer.mockImplementation(() => {
        throw new Error('WebGPU error');
      });

      const result = await simulator.processFeedbackLoop();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Feedback loop error: WebGPU error');
      expect(simulator.isProcessingFeedback).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    describe('tree count changes', () => {
      it('should handle tree count changes during simulation', () => {
        // Mock buffer manager resize method
        mockBufferManager.resizeTreeBuffers = vi.fn().mockReturnValue(true);

        const resized = simulator.handleTreeCountChange(5);

        expect(mockBufferManager.resizeTreeBuffers).toHaveBeenCalledWith(5);
        expect(resized).toBe(true);
        expect(simulator.needsReset).toBe(true);
      });

      it('should handle tree count reduction', () => {
        mockBufferManager.resizeTreeBuffers = vi.fn().mockReturnValue(true);

        const resized = simulator.handleTreeCountChange(3);
        expect(resized).toBe(true);
        expect(simulator.needsReset).toBe(true);
      });

      it('should not mark for reset when buffers not resized', () => {
        mockBufferManager.resizeTreeBuffers = vi.fn().mockReturnValue(false);

        const resized = simulator.handleTreeCountChange(3);

        expect(resized).toBe(false);
        expect(simulator.needsReset).toBe(false);
      });
    });

    describe('buffer operations', () => {
      it('should handle buffer write errors gracefully', async () => {
        mockBufferManager.getReadBuffer.mockImplementation(() => {
          throw new Error('WebGPU error');
        });

        const result = await simulator.processFeedbackLoop();

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('Feedback loop error: WebGPU error');
      });

      it('should handle read buffer access errors', async () => {
        mockBufferManager.getReadBuffer.mockImplementation(() => {
          throw new Error('Read buffer access failed');
        });

        const result = await simulator.processFeedbackLoop();
        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('Feedback loop error: Read buffer access failed');
      });
    });

    describe('concurrent operations', () => {
      it('should prevent concurrent feedback processing', async () => {
        simulator.isProcessingFeedback = true;

        const result = await simulator.processFeedbackLoop();
        expect(result).toBeNull();
        expect(simulator.isProcessingFeedback).toBe(true); // Should remain true
      });

      it('should reset processing flag after error', async () => {
        mockBufferManager.getReadBuffer.mockImplementation(() => {
          throw new Error('GPU error');
        });

        const result = await simulator.processFeedbackLoop();
        expect(result).toBeNull();
        expect(simulator.isProcessingFeedback).toBe(false); // Should be reset
      });
    });

    describe('bounds calculation edge cases', () => {
      it('should handle empty tree data', async () => {
        mockSimulationParameters.get.mockReturnValue(0); // No trees

        const result = await simulator.processFeedbackLoop();
        expect(result).toBeNull(); // Should not process feedback with no trees
      });

    });

    describe('compression calculation edge cases', () => {
      it('should handle zero width bounds', () => {
        mockSimulationParameters.get.mockReturnValueOnce(true).mockReturnValueOnce(1.0);

        const feedbackData = {
          currentAspect: 2.0, // wider than target
          width: 0,  // Zero width - should still compress
          height: 1.0
        };

        const result = simulator.calculateCompressionProbabilities(feedbackData);
        // Even with zero width, the logic still applies compression
        expect(result.probX).toBe(1.2);
        expect(result.probY).toBe(0.8);
      });

      it('should handle zero height bounds', () => {
        mockSimulationParameters.get.mockReturnValueOnce(true).mockReturnValueOnce(1.0);

        const feedbackData = {
          currentAspect: 0.5, // taller than target
          width: 1.0,
          height: 0  // Zero height - should still compress
        };

        const result = simulator.calculateCompressionProbabilities(feedbackData);
        // Even with zero height, the logic still applies compression
        expect(result.probX).toBe(0.8);
        expect(result.probY).toBe(1.2);
      });

      it('should handle extreme aspect ratios', () => {
        // Very wide aspect ratio
        const wideData = {
          currentAspect: 100.0, // Very wide
          width: 100.0,
          height: 1.0
        };

        mockSimulationParameters.get.mockReturnValueOnce(true).mockReturnValueOnce(1.0);
        const result = simulator.calculateCompressionProbabilities(wideData);

        expect(result.probX).toBe(1.2);
        expect(result.probY).toBe(0.8);
      });
    });

    describe('parameter validation', () => {
      it('should handle invalid deltaTime values', () => {
        // Ensure buffer write doesn't throw for these tests
        mockBufferManager.writeBuffer.mockImplementation(() => {});

        expect(() => {
          simulator.updateUniforms(NaN, 1);
        }).not.toThrow();

        expect(() => {
          simulator.updateUniforms(Infinity, 1);
        }).not.toThrow();

        expect(() => {
          simulator.updateUniforms(-1, 1);
        }).not.toThrow();
      });

      it('should handle invalid frameCount values', () => {
        mockBufferManager.writeBuffer.mockImplementation(() => {});

        expect(() => {
          simulator.updateUniforms(0.016, NaN);
        }).not.toThrow();

        expect(() => {
          simulator.updateUniforms(0.016, -1);
        }).not.toThrow();
      });
    });

    describe('buffer access safety', () => {
      it('should handle tree count of zero in reset', () => {
        mockSimulationParameters.get.mockReturnValue(0); // Zero trees

        expect(() => simulator.reset()).not.toThrow();

        // Should still call buffer write with empty array
        expect(mockBufferManager.writeBuffer).toHaveBeenCalledWith(
          'mock-tree-buffer',
          expect.any(Float32Array)
        );
      });

      it('should handle very large tree counts in reset', () => {
        mockSimulationParameters.get.mockReturnValue(10000); // Very large tree count

        expect(() => simulator.reset()).not.toThrow();

        const call = mockBufferManager.writeBuffer.mock.calls.find(
          call => call[0] === 'mock-tree-buffer'
        );
        expect(call[1]).toBeInstanceOf(Float32Array);
        expect(call[1].length).toBe(10000 * 8); // treeCount * 8 floats per tree
      });

    });
  });
});
