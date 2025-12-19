// Test setup file for Vitest
// This file runs before each test suite
import { vi } from 'vitest';

// Mock WebGPU API for testing
global.navigator = {
  ...global.navigator,
  gpu: {
    requestAdapter: vi.fn().mockResolvedValue({
      requestDevice: vi.fn().mockResolvedValue({
        createBuffer: vi.fn((params) => {
          const size = params?.size || 1024;
          return {
            size,
            getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(size)),
            unmap: vi.fn(),
            destroy: vi.fn()
          };
        }),
        createShaderModule: vi.fn(),
        createComputePipeline: vi.fn(),
        createRenderPipeline: vi.fn(),
        createBindGroup: vi.fn(),
        createBindGroupLayout: vi.fn(),
        createPipelineLayout: vi.fn(),
        createTexture: vi.fn(),
        createSampler: vi.fn(),
        queue: {
          writeBuffer: vi.fn(),
          submit: vi.fn()
        }
      })
    }),
    getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm')
  }
};

// Mock fetch for ShaderLoader
global.fetch = vi.fn().mockResolvedValue({
  text: vi.fn().mockResolvedValue('mock shader code'),
  ok: true
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn();

// Mock performance.now
global.performance.now = vi.fn().mockReturnValue(0);

// WebGPU API constants
global.GPUBufferUsage = {
  STORAGE: 0x0001,
  UNIFORM: 0x0002,
  VERTEX: 0x0004,
  COPY_DST: 0x0008,
  COPY_SRC: 0x0010,
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002
};

global.GPUShaderStage = {
  COMPUTE: 0x0001,
  FRAGMENT: 0x0002,
  VERTEX: 0x0004
};

// Mock console methods to avoid noise during testing
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock DOM elements
global.createMockElement = (tagName = 'div') => {
  let _textContent = '';
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    style: {},
    className: '',
    get textContent() { return _textContent; },
    set textContent(value) { _textContent = String(value); },
    innerHTML: '',
    scrollTop: 0,
    scrollHeight: 0,

    appendChild: vi.fn(function(child) {
      this.children.push(child);
      return child;
    }),

    removeChild: vi.fn(function(child) {
      const index = this.children.indexOf(child);
      if (index > -1) {
        this.children.splice(index, 1);
      }
      return child;
    }),

    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([])
  };
  return element;
};

// Helper to mock document.getElementById
global.mockDocumentGetElementById = (element) => {
  global.document = {
    ...global.document,
    getElementById: vi.fn().mockReturnValue(element)
  };
};

// Helper functions for creating mock GPU objects
const createMockGPUBuffer = (size = 1024) => ({
  size,
  getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(size)),
  unmap: vi.fn(),
  destroy: vi.fn()
});

const createMockGPUCanvasContext = () => ({
  configure: vi.fn(),
  getCurrentTexture: vi.fn().mockReturnValue({
    createView: vi.fn().mockReturnValue({})
  })
});

const createMockGPUCommandEncoder = () => ({
  beginComputePass: vi.fn().mockReturnValue({
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    end: vi.fn()
  }),
  beginRenderPass: vi.fn().mockReturnValue({
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    draw: vi.fn(),
    end: vi.fn()
  }),
  copyBufferToBuffer: vi.fn(),
  finish: vi.fn().mockReturnValue({})
});

const createMockGPUDevice = () => ({
  createBuffer: vi.fn().mockReturnValue(createMockGPUBuffer()),
  createShaderModule: vi.fn().mockReturnValue({}),
  createComputePipeline: vi.fn().mockReturnValue({}),
  createRenderPipeline: vi.fn().mockReturnValue({}),
  createBindGroup: vi.fn().mockReturnValue({}),
  createBindGroupLayout: vi.fn().mockReturnValue({}),
  createPipelineLayout: vi.fn().mockReturnValue({}),
  createTexture: vi.fn().mockReturnValue({}),
  createSampler: vi.fn().mockReturnValue({}),
        createCommandEncoder: vi.fn().mockReturnValue(createMockGPUCommandEncoder()),
        destroy: vi.fn(),
        queue: {
          writeBuffer: vi.fn(),
          submit: vi.fn()
        }
});

// Helper to mock canvas getContext
const mockCanvasGetContext = (contextType = 'webgpu') => {
  const mockCanvas = createMockElement('canvas');
  mockCanvas.width = 800;
  mockCanvas.height = 600;
  mockCanvas.getContext = vi.fn().mockReturnValue(createMockGPUCanvasContext());
  mockCanvas.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  });
  return mockCanvas;
};

// Attach to global object
global.createMockGPUBuffer = createMockGPUBuffer;
global.createMockGPUCanvasContext = createMockGPUCanvasContext;
global.createMockGPUCommandEncoder = createMockGPUCommandEncoder;
global.createMockGPUDevice = createMockGPUDevice;
global.mockCanvasGetContext = mockCanvasGetContext;
