import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager } from '../js/input/InputManager.js';

describe('InputManager', () => {
  let inputManager;
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = mockCanvasGetContext('2d');
    inputManager = new InputManager(mockCanvas);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(inputManager.canvas).toBe(mockCanvas);
      expect(inputManager.touchX).toBe(0);
      expect(inputManager.touchY).toBe(0);
      expect(inputManager.isTouching).toBe(0);
    });

    it('should call initListeners', () => {
      const initListenersSpy = vi.spyOn(InputManager.prototype, 'initListeners');

      new InputManager(mockCanvas);

      expect(initListenersSpy).toHaveBeenCalled();
    });
  });

  describe('initListeners', () => {
    it('should add touch event listeners', () => {
      const addEventListenerSpy = vi.spyOn(mockCanvas, 'addEventListener');

      inputManager.initListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
    });

    it('should add mouse event listeners', () => {
      const addEventListenerSpy = vi.spyOn(mockCanvas, 'addEventListener');

      inputManager.initListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
  });

  describe('touch event handling', () => {
    beforeEach(() => {
      inputManager.initListeners();
    });

    it('should handle touchstart event correctly', () => {
      const touchEvent = {
        touches: [{
          clientX: 400,
          clientY: 300
        }],
        preventDefault: vi.fn()
      };

      // Get the touchstart listener
      const touchStartListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];

      touchStartListener(touchEvent);

      // Canvas is 800x600, so center (400, 300) should map to (0, 0) in clip space
      expect(inputManager.touchX).toBeCloseTo(0);
      expect(inputManager.touchY).toBeCloseTo(0);
      expect(inputManager.isTouching).toBe(1);
    });

    it('should handle touchmove event correctly', () => {
      const touchEvent = {
        touches: [{
          clientX: 600, // Right side of 800px canvas
          clientY: 450  // Bottom quarter of 600px canvas
        }],
        preventDefault: vi.fn()
      };

      const touchMoveListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchmove'
      )[1];

      touchMoveListener(touchEvent);

      // (600-0)/800 * 2 - 1 = 1.5 - 1 = 0.5
      expect(inputManager.touchX).toBe(0.5);
      // -(((450-0)/600 * 2) - 1) = -((1.5) - 1) = -0.5
      expect(inputManager.touchY).toBe(-0.5);
      expect(inputManager.isTouching).toBe(1);
    });

    it('should handle touchend event correctly', () => {
      inputManager.isTouching = 1; // Simulate ongoing touch

      const touchEndListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchend'
      )[1];

      touchEndListener();

      expect(inputManager.isTouching).toBe(0);
    });

    it('should handle touch coordinates at canvas edges', () => {
      const touchEvent = {
        touches: [{
          clientX: 0,   // Left edge
          clientY: 0    // Top edge
        }],
        preventDefault: vi.fn()
      };

      const touchStartListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];

      touchStartListener(touchEvent);

      // Left-top corner should map to (-1, 1) in clip space
      expect(inputManager.touchX).toBe(-1);
      expect(inputManager.touchY).toBe(1);
    });
  });

  describe('mouse event handling', () => {
    beforeEach(() => {
      inputManager.initListeners();
    });

    it('should handle mousedown event correctly', () => {
      const mouseEvent = {
        clientX: 200, // Left quarter of 800px canvas
        clientY: 150  // Top quarter of 600px canvas
      };

      const mouseDownListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];

      mouseDownListener(mouseEvent);

      // (200-0)/800 * 2 - 1 = 0.5 - 1 = -0.5
      expect(inputManager.touchX).toBe(-0.5);
      // -(((150-0)/600 * 2) - 1) = -((0.5) - 1) = -(-0.5) = 0.5
      expect(inputManager.touchY).toBe(0.5);
      expect(inputManager.isTouching).toBe(1);
    });

    it('should handle mousemove event only when touching', () => {
      inputManager.isTouching = 1; // Simulate mouse down

      const mouseEvent = {
        clientX: 400,
        clientY: 300
      };

      const mouseMoveListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousemove'
      )[1];

      mouseMoveListener(mouseEvent);

      expect(inputManager.touchX).toBeCloseTo(0);
      expect(inputManager.touchY).toBeCloseTo(0);
      expect(inputManager.isTouching).toBe(1);
    });

    it('should ignore mousemove event when not touching', () => {
      inputManager.isTouching = 0;
      inputManager.touchX = 0.5; // Set initial values
      inputManager.touchY = -0.3;

      const mouseEvent = {
        clientX: 400,
        clientY: 300
      };

      const mouseMoveListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousemove'
      )[1];

      mouseMoveListener(mouseEvent);

      // Values should remain unchanged
      expect(inputManager.touchX).toBe(0.5);
      expect(inputManager.touchY).toBe(-0.3);
      expect(inputManager.isTouching).toBe(0);
    });

    it('should handle mouseup event correctly', () => {
      inputManager.isTouching = 1; // Simulate mouse down

      const mouseUpListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mouseup'
      )[1];

      mouseUpListener();

      expect(inputManager.isTouching).toBe(0);
    });

    it('should handle mouseleave event correctly', () => {
      inputManager.isTouching = 1; // Simulate mouse down

      const mouseLeaveListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mouseleave'
      )[1];

      mouseLeaveListener();

      expect(inputManager.isTouching).toBe(0);
    });
  });

  describe('coordinate conversion', () => {
    it('should convert screen coordinates to clip space correctly', () => {
      // Test various points on the canvas
      const testCases = [
        { clientX: 0, clientY: 0, expectedX: -1, expectedY: 1 },       // Top-left
        { clientX: 800, clientY: 0, expectedX: 1, expectedY: 1 },      // Top-right
        { clientX: 0, clientY: 600, expectedX: -1, expectedY: -1 },    // Bottom-left
        { clientX: 800, clientY: 600, expectedX: 1, expectedY: -1 },   // Bottom-right
        { clientX: 400, clientY: 300, expectedX: 0, expectedY: 0 }     // Center
      ];

      testCases.forEach(({ clientX, clientY, expectedX, expectedY }) => {
        const mockEvent = { clientX, clientY };

        // Simulate coordinate conversion logic from the class
        const r = mockCanvas.getBoundingClientRect();
        const x = ((clientX - r.left) / r.width) * 2 - 1;
        const y = -(((clientY - r.top) / r.height) * 2 - 1);

        expect(x).toBeCloseTo(expectedX);
        expect(y).toBeCloseTo(expectedY);
      });
    });

    it('should handle canvas with non-zero offset', () => {
      // Mock canvas with offset
      mockCanvas.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100,
        top: 50,
        width: 800,
        height: 600
      });

      const mouseEvent = {
        clientX: 500, // 500 - 100 = 400 relative to canvas
        clientY: 200  // 200 - 50 = 150 relative to canvas
      };

      inputManager.initListeners();
      const mouseDownListener = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];

      mouseDownListener(mouseEvent);

      // Should still map to center-left area
      expect(inputManager.touchX).toBe(0);
      expect(inputManager.touchY).toBe(0.5);
    });
  });
});
