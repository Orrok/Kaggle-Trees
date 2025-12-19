import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShaderLoader } from '../js/webgpu/ShaderLoader.js';

describe('ShaderLoader', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  describe('load', () => {
    it('should fetch shader file and return text content', async () => {
      const mockShaderCode = `
        @compute @workgroup_size(64)
        fn computeMain() {
          // Shader code here
        }
      `;
      const mockResponse = {
        text: vi.fn().mockResolvedValue(mockShaderCode)
      };

      global.fetch.mockResolvedValue(mockResponse);

      const result = await ShaderLoader.load('shaders/compute.wgsl');

      expect(global.fetch).toHaveBeenCalledWith('shaders/compute.wgsl');
      expect(mockResponse.text).toHaveBeenCalled();
      expect(result).toBe(mockShaderCode);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      global.fetch.mockRejectedValue(error);

      await expect(ShaderLoader.load('shaders/missing.wgsl')).rejects.toThrow('Network error');
    });

    it('should handle empty shader files', async () => {
      const mockResponse = {
        text: vi.fn().mockResolvedValue('')
      };

      global.fetch.mockResolvedValue(mockResponse);

      const result = await ShaderLoader.load('shaders/empty.wgsl');

      expect(result).toBe('');
    });

    it('should handle different file paths', async () => {
      const mockResponse = {
        text: vi.fn().mockResolvedValue('shader code')
      };
      global.fetch.mockResolvedValue(mockResponse);

      await ShaderLoader.load('custom/path/shader.wgsl');

      expect(global.fetch).toHaveBeenCalledWith('custom/path/shader.wgsl');
    });
  });

  describe('loadShaders', () => {
    it('should load all three shader files and combine them correctly', async () => {
      const mockCommonCode = '// Common shader code\n';
      const mockComputeCode = '// Compute shader code\n';
      const mockRenderCode = '// Render shader code\n';

      const mockResponses = [
        { text: vi.fn().mockResolvedValue(mockCommonCode) }, // common.wgsl
        { text: vi.fn().mockResolvedValue(mockComputeCode) }, // compute.wgsl
        { text: vi.fn().mockResolvedValue(mockRenderCode) }  // render.wgsl
      ];

      global.fetch
        .mockResolvedValueOnce(mockResponses[0]) // common
        .mockResolvedValueOnce(mockResponses[1]) // compute
        .mockResolvedValueOnce(mockResponses[2]); // render

      const result = await ShaderLoader.loadShaders();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(1, 'shaders/common.wgsl');
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'shaders/compute.wgsl');
      expect(global.fetch).toHaveBeenNthCalledWith(3, 'shaders/render.wgsl');

      expect(result).toEqual({
        compute: mockCommonCode + '\n' + mockComputeCode,
        render: mockCommonCode + '\n' + mockRenderCode
      });
    });

    it('should handle shader files with complex content', async () => {
      const mockCommon = `
        struct Uniforms {
          time: f32,
          resolution: vec2<f32>,
        };
      `;

      const mockCompute = `
        @compute @workgroup_size(64)
        fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
          // Compute logic
        }
      `;

      const mockRender = `
        @vertex
        fn vertMain(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32> {
          return vec4<f32>(pos, 0.0, 1.0);
        }

        @fragment
        fn fragMain() -> @location(0) vec4<f32> {
          return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
      `;

      const mockResponses = [
        { text: vi.fn().mockResolvedValue(mockCommon) },
        { text: vi.fn().mockResolvedValue(mockCompute) },
        { text: vi.fn().mockResolvedValue(mockRender) }
      ];

      global.fetch
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const result = await ShaderLoader.loadShaders();

      expect(result.compute).toBe(mockCommon + '\n' + mockCompute);
      expect(result.render).toBe(mockCommon + '\n' + mockRender);
    });

    it('should handle fetch failure for common shader', async () => {
      const error = new Error('Failed to load common.wgsl');
      global.fetch.mockRejectedValueOnce(error);

      await expect(ShaderLoader.loadShaders()).rejects.toThrow('Failed to load common.wgsl');
    });

    it('should handle fetch failure for compute shader', async () => {
      const mockResponse = { text: vi.fn().mockResolvedValue('// common') };
      global.fetch
        .mockResolvedValueOnce(mockResponse) // common succeeds
        .mockRejectedValueOnce(new Error('Failed to load compute.wgsl')); // compute fails

      await expect(ShaderLoader.loadShaders()).rejects.toThrow('Failed to load compute.wgsl');
    });

    it('should handle fetch failure for render shader', async () => {
      const mockResponses = [
        { text: vi.fn().mockResolvedValue('// common') },
        { text: vi.fn().mockResolvedValue('// compute') }
      ];
      global.fetch
        .mockResolvedValueOnce(mockResponses[0]) // common succeeds
        .mockResolvedValueOnce(mockResponses[1]) // compute succeeds
        .mockRejectedValueOnce(new Error('Failed to load render.wgsl')); // render fails

      await expect(ShaderLoader.loadShaders()).rejects.toThrow('Failed to load render.wgsl');
    });

    it('should handle empty shader files', async () => {
      const mockResponses = [
        { text: vi.fn().mockResolvedValue('') },
        { text: vi.fn().mockResolvedValue('') },
        { text: vi.fn().mockResolvedValue('') }
      ];

      global.fetch
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const result = await ShaderLoader.loadShaders();

      expect(result).toEqual({
        compute: '\n',
        render: '\n'
      });
    });
  });
});
