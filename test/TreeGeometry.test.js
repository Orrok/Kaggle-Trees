import { describe, it, expect } from 'vitest';
import { TreeGeometry } from '../demos/packing2/js/geometry/TreeGeometry.js';

describe('TreeGeometry', () => {
  let geometry;

  beforeEach(() => {
    geometry = new TreeGeometry();
  });

  describe('constructor', () => {
    it('should initialize with correct polygon data', () => {
      expect(geometry.polygon).toBeDefined();
      expect(Array.isArray(geometry.polygon)).toBe(true);
      expect(geometry.polygon.length).toBe(32); // 16 vertices * 2 coordinates each
    });

    it('should generate vertices and indices', () => {
      expect(geometry.vertices).toBeDefined();
      expect(geometry.indices).toBeDefined();
      expect(Array.isArray(geometry.vertices)).toBe(true);
      expect(Array.isArray(geometry.indices)).toBe(true);
    });
  });

  describe('polygon data', () => {
    it('should have correct tree shape coordinates', () => {
      // Check some key points of the tree shape
      expect(geometry.polygon[0]).toBe(0.0);   // top center x
      expect(geometry.polygon[1]).toBeCloseTo(0.8, 5);   // top center y

      // Check bottom trunk points
      expect(geometry.polygon[16]).toBeCloseTo(-0.075, 5); // bottom left trunk x
      expect(geometry.polygon[17]).toBeCloseTo(-0.2, 5);   // bottom left trunk y

      // Last point should connect back to first (closed shape)
      expect(geometry.polygon[30]).toBe(0.0);    // back to top center x
      expect(geometry.polygon[31]).toBeCloseTo(0.8, 5);    // back to top center y
    });

    it('should have 16 vertices (32 coordinate values)', () => {
      expect(geometry.polygon.length).toBe(32); // 16 points * 2 coordinates
    });
  });

  describe('getPolygon method', () => {
    it('should return Float32Array of polygon data', () => {
      const polygon = geometry.getPolygon();
      expect(polygon).toBeInstanceOf(Float32Array);
      expect(polygon.length).toBe(32);
      expect(polygon[0]).toBe(0.0);
      expect(polygon[1]).toBeCloseTo(0.8, 5);
    });

    it('should return a new array each time (not cached reference)', () => {
      const polygon1 = geometry.getPolygon();
      const polygon2 = geometry.getPolygon();
      expect(polygon1).not.toBe(polygon2); // Different objects
      expect(polygon1).toEqual(polygon2); // Same values
    });
  });

  describe('getVertices method', () => {
    it('should return Float32Array of vertex data', () => {
      const vertices = geometry.getVertices();
      expect(vertices).toBeInstanceOf(Float32Array);
      expect(vertices.length).toBe(geometry.vertices.length);
    });

    it('should match the internal vertices array', () => {
      const vertices = geometry.getVertices();
      for (let i = 0; i < vertices.length; i++) {
        expect(vertices[i]).toBeCloseTo(geometry.vertices[i], 5);
      }
    });
  });

  describe('getIndices method', () => {
    it('should return Uint32Array of index data', () => {
      const indices = geometry.getIndices();
      expect(indices).toBeInstanceOf(Uint32Array);
      expect(indices.length).toBe(geometry.indices.length);
    });

    it('should match the internal indices array', () => {
      const indices = geometry.getIndices();
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBe(geometry.indices[i]);
      }
    });
  });

  describe('vertex generation', () => {
    it('should convert polygon to vertices correctly', () => {
      // Vertices should be the same as polygon points
      expect(geometry.vertices.length).toBe(geometry.polygon.length);
      for (let i = 0; i < geometry.polygon.length; i++) {
        expect(geometry.vertices[i]).toBe(geometry.polygon[i]);
      }
    });

    it('should have 16 vertices (32 floats)', () => {
      expect(geometry.vertices.length).toBe(32); // 16 points * 2 coordinates
    });
  });

  describe('index generation', () => {
    it('should generate valid triangle indices', () => {
      expect(geometry.indices.length % 3).toBe(0); // Should be multiple of 3 (triangles)

      // All indices should be valid (within vertex range)
      geometry.indices.forEach(index => {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(geometry.vertices.length / 2); // vertex count
      });
    });

    it('should create proper triangulation for tree shape', () => {
      // Basic triangulation checks
      expect(geometry.indices.length).toBeGreaterThan(0);
      expect(geometry.indices.length % 3).toBe(0); // triangles only

      // Check some specific triangulation patterns
      // Top section (first few triangles)
      expect(geometry.indices.slice(0, 6)).toEqual([0, 1, 2, 0, 2, 3]);
    });
  });

  describe('getRadius method', () => {
    it('should return a fixed collision radius', () => {
      expect(geometry.getRadius()).toBe(0.1);
    });
  });

  describe('getPolygonVertexCount method', () => {
    it('should return the correct vertex count', () => {
      expect(geometry.getPolygonVertexCount()).toBe(16); // 32 floats / 2 coordinates per vertex
    });

    it('should match polygon array length divided by 2', () => {
      const expectedCount = geometry.polygon.length / 2;
      expect(geometry.getPolygonVertexCount()).toBe(expectedCount);
    });
  });

  describe('geometry integrity', () => {
    it('should have consistent vertex and index counts', () => {
      const vertexCount = geometry.vertices.length / 2; // x,y pairs
      const maxIndex = Math.max(...geometry.indices);
      expect(maxIndex).toBeLessThan(vertexCount);
    });

    it('should form a closed shape', () => {
      const firstX = geometry.polygon[0];
      const firstY = geometry.polygon[1];
      const lastX = geometry.polygon[geometry.polygon.length - 2];
      const lastY = geometry.polygon[geometry.polygon.length - 1];

      // Shape should be closed (last point = first point)
      expect(lastX).toBe(firstX);
      expect(lastY).toBe(firstY);
    });

    it('should have even polygon length (x,y coordinate pairs)', () => {
      expect(geometry.polygon.length % 2).toBe(0);
    });

    it('should throw error for invalid polygon with odd length', () => {
      // Temporarily modify polygon to have odd length
      const originalPolygon = geometry.polygon;
      geometry.polygon = new Float32Array([1, 2, 3]); // 3 elements, odd length

      // getPolygonVertexCount should throw for invalid polygons
      expect(() => geometry.getPolygonVertexCount()).toThrow('Invalid polygon: length must be even');

      // Restore original
      geometry.polygon = originalPolygon;
    });
  });
});
