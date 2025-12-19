// Debug test to verify null access throws
import { describe, it, expect } from 'vitest';

describe('Debug null access', () => {
  it('should throw when accessing null property', () => {
    const obj = { context: null };

    expect(() => {
      const canvas = obj.context.canvas;
    }).toThrow('Cannot read properties of null');
  });

  it('should throw when calling method on null context', () => {
    const obj = { context: null };

    expect(() => {
      const canvas = obj.context.canvas;
      return { width: canvas.width, height: canvas.height };
    }).toThrow();
  });
});
