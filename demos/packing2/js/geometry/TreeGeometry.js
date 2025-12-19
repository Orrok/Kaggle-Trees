/**
 * Tree geometry definition and vertex/index generation
 * Centralizes tree polygon data to eliminate duplication between CPU and GPU
 */
export class TreeGeometry {
    constructor() {
        // Tree geometry (detailed Christmas tree shape from original_working.html)
        this.polygon = [
            0.0, 0.8,     // top center
            0.125, 0.5,   // top right branch
            0.0625, 0.5,  // top right inner
            0.2, 0.25,    // upper right branch
            0.1, 0.25,    // upper right inner
            0.35, 0.0,    // middle right branch
            0.075, 0.0,   // middle right trunk
            0.075, -0.2,  // bottom right trunk
            -0.075, -0.2, // bottom left trunk
            -0.075, 0.0,  // middle left trunk
            -0.35, 0.0,   // middle left branch
            -0.1, 0.25,   // upper left inner
            -0.2, 0.25,   // upper left branch
            -0.0625, 0.5, // top left inner
            -0.125, 0.5,  // top left branch
            0.0, 0.8      // back to top center
        ];

        // Validate polygon data
        if (this.polygon.length % 2 !== 0) {
            throw new Error('Invalid polygon data: length must be even (pairs of x,y coordinates)');
        }

        // Generate vertices and indices for rendering
        this._generateGeometry();
    }

    /**
     * Generate vertices and indices for triangle-based rendering
     * @private
     */
    _generateGeometry() {
        // Convert the detailed tree polygon into triangles for filled rendering
        this.vertices = [];
        this.indices = [];

        // Add all polygon points as vertices (16 points total)
        for (let i = 0; i < this.polygon.length; i += 2) {
            this.vertices.push(this.polygon[i], this.polygon[i + 1]);
        }

        // Create triangles to fill the tree shape
        // Divide into sections and triangulate each part

        // Top section (points 0-3)
        this.indices.push(0, 1, 2);
        this.indices.push(0, 2, 3);

        // Upper right section (points 3-6)
        this.indices.push(3, 4, 5);
        this.indices.push(3, 5, 6);

        // Lower right section (points 6-8)
        this.indices.push(6, 7, 8);

        // Bottom trunk section (points 7-9)
        this.indices.push(7, 8, 9);

        // Lower left section (points 9-12)
        this.indices.push(9, 10, 11);
        this.indices.push(9, 11, 12);

        // Upper left section (points 12-15, connecting back to 0)
        this.indices.push(12, 13, 14);
        this.indices.push(12, 14, 15);
        this.indices.push(14, 15, 0);
        this.indices.push(15, 0, 1);
    }

    /**
     * Get the tree polygon vertices (used for collision detection)
     * @returns {Float32Array} Polygon vertices as x,y pairs
     */
    getPolygon() {
        return new Float32Array(this.polygon);
    }

    /**
     * Get vertices for rendering (triangle-based)
     * @returns {Float32Array} Vertex positions as x,y pairs
     */
    getVertices() {
        return new Float32Array(this.vertices);
    }

    /**
     * Get indices for rendering
     * @returns {Uint32Array} Triangle indices
     */
    getIndices() {
        return new Uint32Array(this.indices);
    }

    /**
     * Get the radius used for collision detection (approximate)
     * @returns {number} Collision radius
     */
    getRadius() {
        return 0.1;
    }

    /**
     * Get the number of vertices in the polygon
     * @returns {number} Vertex count
     */
    getPolygonVertexCount() {
        if (this.polygon.length % 2 !== 0) {
            throw new Error('Invalid polygon: length must be even (pairs of x,y coordinates)');
        }
        return this.polygon.length / 2; // Each vertex is 2 floats (x,y)
    }
}
