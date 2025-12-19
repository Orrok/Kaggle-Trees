import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayRenderer } from '../demos/packing2/js/rendering/OverlayRenderer.js';

describe('OverlayRenderer', () => {
  let overlayRenderer;
  let mockCanvas;
  let mockCtx;
  let mockSimulationParameters;

  beforeEach(() => {
    mockCanvas = {
      width: 800,
      height: 600,
      style: {},
      getContext: vi.fn()
    };

    mockCtx = {
      clearRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: vi.fn()
    };

    mockCanvas.getContext.mockReturnValue(mockCtx);

    mockSimulationParameters = {
      get: vi.fn()
    };

    overlayRenderer = new OverlayRenderer(mockCanvas, mockSimulationParameters);
  });

  describe('constructor', () => {
    it('should store canvas and parameters references', () => {
      expect(overlayRenderer.canvas).toBe(mockCanvas);
      expect(overlayRenderer.ctx).toBe(mockCtx);
      expect(overlayRenderer.parameters).toBe(mockSimulationParameters);
    });

    it('should get 2D context from canvas', () => {
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });
  });

  describe('draw', () => {
    beforeEach(() => {
      overlayRenderer.drawCrosshair = vi.fn();
      overlayRenderer.drawBoundingBox = vi.fn();
      overlayRenderer.drawCompressionVectors = vi.fn();
    });

    it('should clear the canvas', () => {
      overlayRenderer.draw();

      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('should draw crosshair', () => {
      overlayRenderer.draw();

      expect(overlayRenderer.drawCrosshair).toHaveBeenCalledWith(800, 600);
    });

    it('should draw bounding box when bounds provided', () => {
      const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

      overlayRenderer.draw(bounds);

      expect(overlayRenderer.drawBoundingBox).toHaveBeenCalledWith(bounds, 800, 600);
    });

    it('should draw compression vectors when bounds provided', () => {
      const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

      overlayRenderer.draw(bounds);

      expect(overlayRenderer.drawCompressionVectors).toHaveBeenCalledWith(bounds, 800, 600);
    });

    it('should not draw bounding box or vectors when no bounds provided', () => {
      overlayRenderer.draw();

      expect(overlayRenderer.drawBoundingBox).not.toHaveBeenCalled();
      expect(overlayRenderer.drawCompressionVectors).not.toHaveBeenCalled();
    });
  });

  describe('drawCrosshair', () => {
    it('should draw center crosshair with correct styling', () => {
      overlayRenderer.drawCrosshair(800, 600);

      expect(mockCtx.strokeStyle).toBe('rgba(0, 229, 255, 0.3)');
      expect(mockCtx.lineWidth).toBe(1);
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400 - 20, 300);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 + 20, 300);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400, 300 - 20);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400, 300 + 20);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('drawBoundingBox', () => {
    it('should convert world coordinates to screen coordinates', () => {
      const bounds = { minX: -2, maxX: 1, minY: -1.5, maxY: 0.5 };

      overlayRenderer.drawBoundingBox(bounds, 800, 600);

      // World coords (-2 to 1, -1.5 to 0.5) should map to screen coords
      // screenMinX = ((bounds.minX + 2) / 4) * width = ((-2 + 2) / 4) * 800 = 0
      // screenMaxX = ((bounds.maxX + 2) / 4) * width = ((1 + 2) / 4) * 800 = 600
      // screenMinY = ((bounds.minY + 2) / 4) * height = ((-1.5 + 2) / 4) * 600 = 75
      // screenMaxY = ((bounds.maxY + 2) / 4) * height = ((0.5 + 2) / 4) * 600 = 375

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(0, 75, 600, 300);
    });

    it('should draw center of mass', () => {
      const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

      overlayRenderer.drawBoundingBox(bounds, 800, 600);

      // Center should be at (400, 300)
      expect(mockCtx.fillStyle).toBe('rgba(255, 100, 100, 0.5)');
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalledWith(400, 300, 5, 0, Math.PI * 2);
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should use correct styling for bounding box', () => {
      const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

      overlayRenderer.drawBoundingBox(bounds, 800, 600);

      expect(mockCtx.strokeStyle).toBe('rgba(255, 100, 100, 0.8)');
      expect(mockCtx.lineWidth).toBe(2);
    });
  });

  describe('drawCompressionVectors', () => {
    beforeEach(() => {
      overlayRenderer.drawHorizontalArrow = vi.fn();
      overlayRenderer.drawVerticalArrow = vi.fn();
    });

    it('should not draw when autoPack is false', () => {
      mockSimulationParameters.get.mockReturnValue(false);
      const bounds = { minX: -2, maxX: 1, minY: -1, maxY: 0 };

      overlayRenderer.drawCompressionVectors(bounds, 800, 600);

      expect(overlayRenderer.drawHorizontalArrow).not.toHaveBeenCalled();
      expect(overlayRenderer.drawVerticalArrow).not.toHaveBeenCalled();
    });

    it('should draw horizontal arrow when width ratio > height ratio', () => {
      mockSimulationParameters.get.mockReturnValue(true);
      // width_ratio = (maxX - minX) / 4 = (1 - (-2)) / 4 = 0.75
      // height_ratio = (maxY - minY) / 4 = (0 - (-1)) / 4 = 0.25
      // 0.75 > 0.25, so compress horizontally
      const bounds = { minX: -2, maxX: 1, minY: -1, maxY: 0 };

      overlayRenderer.drawCompressionVectors(bounds, 800, 600);

      expect(overlayRenderer.drawHorizontalArrow).toHaveBeenCalledWith(800, 600, 30);
      expect(overlayRenderer.drawVerticalArrow).not.toHaveBeenCalled();
    });

    it('should draw vertical arrow when height ratio > width ratio', () => {
      mockSimulationParameters.get.mockReturnValue(true);
      // width_ratio = (maxX - minX) / 4 = (0 - (-1)) / 4 = 0.25
      // height_ratio = (maxY - minY) / 4 = (2 - (-1)) / 4 = 0.75
      // 0.25 < 0.75, so compress vertically
      const bounds = { minX: -1, maxX: 0, minY: -1, maxY: 2 };

      overlayRenderer.drawCompressionVectors(bounds, 800, 600);

      expect(overlayRenderer.drawVerticalArrow).toHaveBeenCalledWith(800, 600, 30);
      expect(overlayRenderer.drawHorizontalArrow).not.toHaveBeenCalled();
    });

    it('should set correct drawing style', () => {
      mockSimulationParameters.get.mockReturnValue(true);
      const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

      overlayRenderer.drawCompressionVectors(bounds, 800, 600);

      expect(mockCtx.strokeStyle).toBe('rgba(100, 255, 100, 0.6)');
      expect(mockCtx.lineWidth).toBe(3);
    });
  });

  describe('drawHorizontalArrow', () => {
    it('should draw horizontal arrow with correct path', () => {
      overlayRenderer.drawHorizontalArrow(800, 600, 30);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400 - 30, 300); // Left point
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 + 30, 300); // Right point
      // Left arrowhead
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400 - 30, 300);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 - 30 + 10, 300 - 5);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400 - 30, 300);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 - 30 + 10, 300 + 5);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('drawVerticalArrow', () => {
    it('should draw vertical arrow with correct path', () => {
      overlayRenderer.drawVerticalArrow(800, 600, 30);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400, 300 - 30); // Top point
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400, 300 + 30); // Bottom point
      // Up arrowhead
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400, 300 - 30);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 - 5, 300 - 30 + 10);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400, 300 - 30);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(400 + 5, 300 - 30 + 10);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('should update canvas dimensions', () => {
      const newWidth = 1024;
      const newHeight = 768;

      overlayRenderer.resize(newWidth, newHeight);

      expect(mockCanvas.width).toBe(newWidth);
      expect(mockCanvas.height).toBe(newHeight);
    });
  });

  describe('clear', () => {
    it('should clear the entire canvas', () => {
      overlayRenderer.clear();

      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('setVisible', () => {
    it('should set display to block when visible is true', () => {
      overlayRenderer.setVisible(true);

      expect(mockCanvas.style.display).toBe('block');
    });

    it('should set display to none when visible is false', () => {
      overlayRenderer.setVisible(false);

      expect(mockCanvas.style.display).toBe('none');
    });
  });
});
