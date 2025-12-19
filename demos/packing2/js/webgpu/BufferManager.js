import { FLOATS_PER_TREE, BYTES_PER_FLOAT, PARAMETERS_FLOAT_COUNT } from '../constants.js';

/**
 * WebGPU buffer creation and management
 */
export class BufferManager {
    constructor(deviceManager) {
        this.deviceManager = deviceManager;
        this.device = deviceManager.getDevice();

        // Buffer references
        this.treeBuffer = null;
        this.uniformBuffer = null;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.readBuffer = null;
        this.geometryBuffer = null;
    }

    /**
     * Initialize all buffers
     * @param {number} treeCount - Number of trees to allocate for
     * @param {TreeGeometry} treeGeometry - Tree geometry data
     */
    initBuffers(treeCount, treeGeometry) {
        console.log(`[BufferManager] Initializing buffers for ${treeCount} trees...`);
        console.log(`[BufferManager] Tree geometry: ${treeGeometry.getVertices().length} vertices, ${treeGeometry.getIndices().length} indices, ${treeGeometry.getPolygon().length} polygon points`);

        this.createTreeBuffer(treeCount);
        this.createReadBuffer(treeCount);
        this.createUniformBuffer();
        this.createGeometryBuffers(treeGeometry);

        console.log('[BufferManager] All buffers initialized successfully');
    }

    /**
     * Create tree data buffer (position, rotation, velocity, etc.)
     * @param {number} treeCount - Number of trees
     */
    createTreeBuffer(treeCount) {
        const treeDataSize = treeCount * FLOATS_PER_TREE * BYTES_PER_FLOAT;
        this.treeBuffer = this.device.createBuffer({
            size: treeDataSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
    }

    /**
     * Create read buffer for CPU feedback loop
     * @param {number} treeCount - Number of trees
     */
    createReadBuffer(treeCount) {
        const treeDataSize = treeCount * FLOATS_PER_TREE * BYTES_PER_FLOAT;
        this.readBuffer = this.device.createBuffer({
            size: treeDataSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
    }

    /**
     * Create uniform buffer for simulation parameters
     */
    createUniformBuffer() {
        this.uniformBuffer = this.device.createBuffer({
            size: PARAMETERS_FLOAT_COUNT * BYTES_PER_FLOAT,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    /**
     * Create vertex and index buffers for rendering
     * @param {TreeGeometry} treeGeometry - Tree geometry data
     */
    createGeometryBuffers(treeGeometry) {
        // Vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: treeGeometry.getVertices().length * BYTES_PER_FLOAT,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(treeGeometry.getVertices());
        this.vertexBuffer.unmap();

        // Index buffer
        this.indexBuffer = this.device.createBuffer({
            size: treeGeometry.getIndices().length * BYTES_PER_FLOAT,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(treeGeometry.getIndices());
        this.indexBuffer.unmap();

        // Geometry buffer for collision detection (polygon data)
        this.geometryBuffer = this.device.createBuffer({
            size: treeGeometry.getPolygon().length * BYTES_PER_FLOAT,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });
        new Float32Array(this.geometryBuffer.getMappedRange()).set(treeGeometry.getPolygon());
        this.geometryBuffer.unmap();
    }

    /**
     * Write data to a buffer
     * @param {GPUBuffer} buffer - Target buffer
     * @param {ArrayBufferView} data - Data to write
     * @param {number} offset - Offset in buffer (default: 0)
     */
    writeBuffer(buffer, data, offset = 0) {
        this.device.queue.writeBuffer(buffer, offset, data);
    }

    /**
     * Get the WebGPU device
     * @returns {GPUDevice} The WebGPU device
     */
    getDevice() {
        return this.device;
    }

    /**
     * Copy data between buffers
     * @param {GPUBuffer} source - Source buffer
     * @param {number} sourceOffset - Source offset
     * @param {GPUBuffer} destination - Destination buffer
     * @param {number} destinationOffset - Destination offset
     * @param {number} size - Size to copy
     * @returns {GPUCommandEncoder} Command encoder with copy operation
     */
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size);
        return encoder;
    }

    /**
     * Get tree buffer
     * @returns {GPUBuffer} Tree data buffer
     */
    getTreeBuffer() {
        return this.treeBuffer;
    }

    /**
     * Get uniform buffer
     * @returns {GPUBuffer} Uniform buffer
     */
    getUniformBuffer() {
        return this.uniformBuffer;
    }

    /**
     * Get vertex buffer
     * @returns {GPUBuffer} Vertex buffer
     */
    getVertexBuffer() {
        return this.vertexBuffer;
    }

    /**
     * Get index buffer
     * @returns {GPUBuffer} Index buffer
     */
    getIndexBuffer() {
        return this.indexBuffer;
    }

    /**
     * Get read buffer
     * @returns {GPUBuffer} Read buffer for CPU access
     */
    getReadBuffer() {
        return this.readBuffer;
    }

    /**
     * Get geometry buffer
     * @returns {GPUBuffer} Geometry buffer for collision detection
     */
    getGeometryBuffer() {
        return this.geometryBuffer;
    }

    /**
     * Resize tree buffers for new tree count
     * @param {number} newTreeCount - New number of trees
     * @returns {boolean} True if buffers were resized
     */
    resizeTreeBuffers(newTreeCount) {
        // Only resize if tree count actually changed
        const currentSize = this.treeBuffer?.size || 0;
        const newSize = newTreeCount * FLOATS_PER_TREE * BYTES_PER_FLOAT;

        if (currentSize !== newSize) {
            this.createTreeBuffer(newTreeCount);
            this.createReadBuffer(newTreeCount);
            return true;
        }

        return false;
    }

    /**
     * Destroy all buffers
     */
    destroy() {
        const buffers = [
            this.treeBuffer,
            this.uniformBuffer,
            this.vertexBuffer,
            this.indexBuffer,
            this.readBuffer,
            this.geometryBuffer
        ];

        buffers.forEach(buffer => {
            if (buffer) {
                buffer.destroy();
            }
        });

        this.treeBuffer = null;
        this.uniformBuffer = null;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.readBuffer = null;
        this.geometryBuffer = null;
    }
}
