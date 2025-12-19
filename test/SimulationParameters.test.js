import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulationParameters } from '../demos/packing2/js/simulation/SimulationParameters.js';

describe('SimulationParameters', () => {
  let params;

  beforeEach(() => {
    params = new SimulationParameters();
  });

  describe('constructor', () => {
  it('should initialize with default parameters', () => {
    expect(params.get('treeCount')).toBe(10);
    expect(params.get('zoom')).toBe(2.0);
    expect(params.get('compression')).toBe(1.0);
      expect(params.get('autoPack')).toBe(true);
      expect(params.get('aspect')).toBe(1.0);
    });

    it('should initialize with constraints', () => {
      const constraints = params.getConstraints('treeCount');
      expect(constraints).toEqual({ min: 1, max: 200, step: 1 });

      const boolConstraints = params.getConstraints('autoPack');
      expect(boolConstraints).toEqual({ type: 'boolean' });
    });
  });

  describe('get method', () => {
  it('should return the correct parameter value', () => {
    expect(params.get('treeCount')).toBe(10);
    expect(params.get('compression')).toBe(1.0);
    });

    it('should return undefined for non-existent parameters', () => {
      expect(params.get('nonExistent')).toBeUndefined();
    });
  });

  describe('set method', () => {
    it('should set valid numeric parameters', () => {
      expect(params.set('treeCount', 5)).toBe(true);
      expect(params.get('treeCount')).toBe(5);
    });

    it('should set valid boolean parameters', () => {
      expect(params.set('autoPack', false)).toBe(true);
      expect(params.get('autoPack')).toBe(false);
    });

  it('should reject invalid numeric values (too low)', () => {
    expect(params.set('treeCount', 0)).toBe(false); // min is 1
    expect(params.get('treeCount')).toBe(10); // unchanged
  });

  it('should reject invalid numeric values (too high)', () => {
    expect(params.set('treeCount', 300)).toBe(false); // max is 200
    expect(params.get('treeCount')).toBe(10); // unchanged
  });

    it('should reject invalid boolean values', () => {
      expect(params.set('autoPack', 'true')).toBe(false);
      expect(params.get('autoPack')).toBe(true); // unchanged
    });

    it('should reject NaN values', () => {
      expect(params.set('compression', NaN)).toBe(false);
      expect(params.get('compression')).toBe(1.0); // unchanged
    });

    it('should reject non-existent parameters', () => {
      expect(params.set('nonExistent', 42)).toBe(false);
    });

    it('should not notify observers when value does not change', () => {
      const observer = vi.fn();
      params.subscribe(observer);

      params.set('treeCount', 10); // same value
      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('getAll method', () => {
    it('should return a copy of all parameters', () => {
      const all = params.getAll();
      expect(all).toEqual({
        treeCount: 10,
        zoom: 2.0,
        compression: 1.0,
        relaxationRate: 1.0,
        autoPack: true,
        aspect: 1.0,
        renderFrequency: 1
      });

      // Verify it's a copy (not reference)
      all.treeCount = 99;
      expect(params.get('treeCount')).toBe(10);
    });
  });

  describe('getConstraints method', () => {
    it('should return a copy of constraints', () => {
      const constraints = params.getConstraints('treeCount');
      expect(constraints).toEqual({ min: 1, max: 200, step: 1 });

      // Verify it's a copy
      constraints.min = 0;
      expect(params.getConstraints('treeCount').min).toBe(1);
    });

    it('should return empty object for non-existent parameters', () => {
      expect(params.getConstraints('nonExistent')).toEqual({});
    });
  });

  describe('getUniforms method', () => {
    it('should return Float32Array with correct values', () => {
      const uniforms = params.getUniforms(0.016, 42);

      expect(uniforms).toBeInstanceOf(Float32Array);
      expect(uniforms.length).toBe(8);

      // Check parameter values (new structure: zoom, compression, probX, time, aspect, _pad1, _pad2, _pad3)
      expect(uniforms[0]).toBe(2.0); // zoom
      expect(uniforms[1]).toBe(1.0); // compression
      expect(uniforms[2]).toBe(0.5); // probX (default)
      expect(uniforms[3]).toBe(42); // time (frameCount)
      expect(uniforms[4]).toBe(1.0); // aspect
      expect(uniforms[5]).toBe(0.0); // _pad1
      expect(uniforms[6]).toBe(0.0); // _pad2
      expect(uniforms[7]).toBe(0.0); // _pad3
    });

    it('should use provided additional parameters', () => {
      const uniforms = params.getUniforms(0.016, 42, {
        probX: 0.7,
        probY: 0.8, // not used in new structure
        centerX: 10, // not used in new structure
        centerY: 20  // not used in new structure
      });

      expect(uniforms[2]).toBeCloseTo(0.7, 5); // probX
      // Other parameters (centerX, centerY, probY) are not used in new 8-float structure
    });
  });

  describe('observer pattern', () => {
    it('should notify observers when parameter changes', () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();

      params.subscribe(observer1);
      params.subscribe(observer2);

      params.set('treeCount', 5);

      expect(observer1).toHaveBeenCalledWith('treeCount', 5, 10);
      expect(observer2).toHaveBeenCalledWith('treeCount', 5, 10);
    });

    it('should return unsubscribe function', () => {
      const observer = vi.fn();
      const unsubscribe = params.subscribe(observer);

      params.set('treeCount', 15);
      expect(observer).toHaveBeenCalledTimes(1);

      unsubscribe();
      params.set('treeCount', 25);
      expect(observer).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle observer errors gracefully', () => {
      const errorObserver = vi.fn().mockImplementation(() => {
        throw new Error('Observer error');
      });
      const goodObserver = vi.fn();

      params.subscribe(errorObserver);
      params.subscribe(goodObserver);

      // Should not throw, and good observer should still be called
      expect(() => params.set('treeCount', 20)).not.toThrow();
      expect(goodObserver).toHaveBeenCalledWith('treeCount', 20, 10);
    });
  });

  describe('reset method', () => {
    it('should reset all parameters to defaults', () => {
      // Change some values
      params.set('treeCount', 100);
      params.set('compression', 2.0);
      params.set('autoPack', false);

      // Reset
      params.reset();

      // Check they are back to defaults
      expect(params.get('treeCount')).toBe(10);
      expect(params.get('compression')).toBe(1.0);
      expect(params.get('autoPack')).toBe(true);
    });

    it('should notify observers during reset', () => {
      const observer = vi.fn();
      params.subscribe(observer);

      params.set('treeCount', 100); // Change value first
      observer.mockClear(); // Clear previous call

      params.reset();

      expect(observer).toHaveBeenCalledWith('treeCount', 10, 100);
    });
  });

  describe('parameter validation (_validateParameter)', () => {
    it('should validate numeric parameters within range', () => {
      expect(params.set('compression', 2.5)).toBe(true); // within 0-5
      expect(params.set('compression', 0)).toBe(true); // min
      expect(params.set('compression', 5)).toBe(true); // max
    });

    it('should reject numeric parameters outside range', () => {
      expect(params.set('compression', -0.1)).toBe(false); // below min
      expect(params.set('compression', 5.1)).toBe(false); // above max
    });

    it('should validate treeCount range', () => {
      expect(params.set('treeCount', 1)).toBe(true); // min
      expect(params.set('treeCount', 200)).toBe(true); // max
      expect(params.set('treeCount', 0)).toBe(false); // below min
      expect(params.set('treeCount', 201)).toBe(false); // above max
    });

    it('should validate boolean parameters', () => {
      expect(params.set('autoPack', true)).toBe(true);
      expect(params.set('autoPack', false)).toBe(true);
      expect(params.set('autoPack', null)).toBe(false);
      expect(params.set('autoPack', 0)).toBe(false);
      expect(params.set('autoPack', 1)).toBe(false);
      expect(params.set('autoPack', 'true')).toBe(false);
    });

    it('should reject invalid parameter names', () => {
      expect(params.set('invalidParam', 42)).toBe(false);
    });
  });
});
