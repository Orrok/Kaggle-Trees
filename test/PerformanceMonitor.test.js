import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../demos/packing2/js/monitoring/PerformanceMonitor.js';

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(monitor.frameCount).toBe(0);
      expect(monitor.lastTime).toBe(0);
      expect(monitor.fps).toBe(0);
      expect(monitor.frameTimeHistory).toEqual([]);
      expect(monitor.maxHistorySize).toBe(60);
    });
  });

  describe('update method', () => {
    it('should not calculate FPS on first update (no previous timestamp)', () => {
      monitor.update(1000);
      expect(monitor.fps).toBe(0);
      expect(monitor.frameCount).toBe(1);
      expect(monitor.lastTime).toBe(1000);
    });

    it('should calculate FPS correctly for 60 FPS', () => {
      // First frame
      monitor.update(1000);
      expect(monitor.fps).toBe(0);

      // Second frame - 16.67ms later (60 FPS)
      monitor.update(1016.67);
      expect(monitor.fps).toBe(60);
      expect(monitor.frameCount).toBe(2);
    });

    it('should calculate FPS correctly for 30 FPS', () => {
      monitor.update(1000);
      monitor.update(1033.33); // 33.33ms later (30 FPS)
      expect(monitor.fps).toBe(30);
    });

    it('should maintain frame time history', () => {
      monitor.update(1000);
      monitor.update(1016.67); // 16.67ms delta
      monitor.update(1033.33); // 16.67ms delta

      expect(monitor.frameTimeHistory[0]).toBeCloseTo(16.67, 1);
      expect(monitor.frameTimeHistory[1]).toBeCloseTo(16.67, 1);
    });

    it('should limit history size to maxHistorySize', () => {
      // Add 65 frames to exceed the 60 limit
      let time = 1000;
      for (let i = 0; i < 65; i++) {
        monitor.update(time);
        time += 16.67; // 60 FPS
      }

      expect(monitor.frameTimeHistory.length).toBe(60);
      // Should have removed the oldest entries
      expect(monitor.frameTimeHistory[0]).toBeCloseTo(16.67, 2);
    });

    it('should round FPS to nearest integer', () => {
      monitor.update(1000);
      monitor.update(1017); // ~58.8 FPS, should round to 59
      expect(monitor.fps).toBe(59);
    });
  });

  describe('getFPS method', () => {
    it('should return current FPS value', () => {
      expect(monitor.getFPS()).toBe(0);

      monitor.update(1000);
      monitor.update(1016.67);
      expect(monitor.getFPS()).toBe(60);
    });
  });

  describe('getFrameCount method', () => {
    it('should return total frame count', () => {
      expect(monitor.getFrameCount()).toBe(0);

      monitor.update(1000);
      expect(monitor.getFrameCount()).toBe(1);

      monitor.update(1016.67);
      expect(monitor.getFrameCount()).toBe(2);
    });
  });

  describe('getAverageFrameTime method', () => {
    it('should return 0 when no history', () => {
      expect(monitor.getAverageFrameTime()).toBe(0);
    });

    it('should calculate average frame time correctly', () => {
      monitor.update(1000);
      monitor.update(1010); // 10ms
      monitor.update(1025); // 15ms
      monitor.update(1035); // 10ms

      const expectedAverage = (10 + 15 + 10) / 3; // 35/3 = 11.67
      expect(monitor.getAverageFrameTime()).toBeCloseTo(expectedAverage, 2);
    });

    it('should handle single frame time', () => {
      monitor.update(1000);
      monitor.update(1016.67);
      expect(monitor.getAverageFrameTime()).toBeCloseTo(16.67, 2);
    });
  });

  describe('reset method', () => {
    it('should reset all counters and history', () => {
      // Add some data
      monitor.update(1000);
      monitor.update(1016.67);
      monitor.update(1033.33);

      expect(monitor.frameCount).toBe(3);
      expect(monitor.fps).toBe(60);
      expect(monitor.frameTimeHistory.length).toBe(2);

      // Reset
      monitor.reset();

      expect(monitor.frameCount).toBe(0);
      expect(monitor.lastTime).toBe(0);
      expect(monitor.fps).toBe(0);
      expect(monitor.frameTimeHistory).toEqual([]);
    });
  });

  describe('getMetrics method', () => {
    it('should return performance metrics object', () => {
      monitor.update(1000);
      monitor.update(1016.67);

      const metrics = monitor.getMetrics();

      expect(metrics.fps).toBe(60);
      expect(metrics.frameCount).toBe(2);
      expect(metrics.averageFrameTime).toBeCloseTo(16.67, 2);
    });

    it('should return correct metrics after reset', () => {
      monitor.update(1000);
      monitor.update(1016.67);
      monitor.reset();

      const metrics = monitor.getMetrics();

      expect(metrics).toEqual({
        fps: 0,
        frameCount: 0,
        averageFrameTime: 0
      });
    });
  });

  describe('FPS smoothing behavior', () => {
    it('should smooth FPS over history window', () => {
      // Simulate variable frame times
      monitor.update(1000);
      monitor.update(1010); // 10ms - 100 FPS
      monitor.update(1025); // 15ms - 67 FPS
      monitor.update(1040); // 15ms - 67 FPS

      // Average frame time: (10 + 15 + 15) / 3 = 40/3 ≈ 13.33ms
      // FPS: 1000 / 13.33 ≈ 75 FPS
      expect(monitor.fps).toBeCloseTo(75, 0);
    });

    it('should handle very fast frame rates', () => {
      monitor.update(1000);
      monitor.update(1001); // 1ms - 1000 FPS
      expect(monitor.fps).toBe(1000);
    });

    it('should handle very slow frame rates', () => {
      monitor.update(1000);
      monitor.update(2000); // 1000ms - 1 FPS
      expect(monitor.fps).toBe(1);
    });

    it('should handle zero delta time gracefully', () => {
      monitor.update(1000);
      monitor.update(1000); // Same timestamp - should skip update

      // FPS should remain 0 since no valid delta was processed
      expect(monitor.fps).toBe(0);
      expect(monitor.frameCount).toBe(1); // Only the first update should count
    });

    it('should handle division by zero in getAverageFrameTime with empty history', () => {
      monitor.reset(); // Clear history

      const result = monitor.getAverageFrameTime();
      expect(result).toBe(0); // Should return 0, not NaN or Infinity
    });

    it('should handle FPS calculation with very small average frame time', () => {
      // Add very small frame times that could cause division issues
      monitor.update(1000);
      monitor.update(1000.001); // Very small delta
      monitor.update(1000.002); // Another very small delta

      // Should not produce Infinity or NaN
      expect(monitor.fps).not.toBe(Infinity);
      expect(monitor.fps).not.toBe(NaN);
      expect(monitor.fps).toBeGreaterThanOrEqual(0);
    });

    it('should handle very small delta time', () => {
      monitor.update(1000);
      monitor.update(1000.0001); // Very small delta - should skip update

      // FPS should remain 0 since delta was too small
      expect(monitor.fps).toBe(0);
      expect(monitor.frameCount).toBe(1); // Only the first update should count
    });
  });
});
