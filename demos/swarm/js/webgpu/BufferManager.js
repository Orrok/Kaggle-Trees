export class BufferManager {
    constructor(device) {
        this.device = device;
    }

    createBuffer(params) {
        return this.device.createBuffer(params);
    }

    createStorageBuffer(size, mappedAtCreation = false) {
        return this.createBuffer({
            size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation
        });
    }

    createUniformBuffer(size) {
        return this.createBuffer({
            size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    createVertexBuffer(data) {
        const buffer = this.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
        return buffer;
    }
}
