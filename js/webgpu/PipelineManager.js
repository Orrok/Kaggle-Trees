export class PipelineManager {
    constructor(device, format) {
        this.device = device;
        this.format = format;
    }

    createComputePipeline(shaderCode, bindGroupLayouts) {
        const module = this.device.createShaderModule({ code: shaderCode });
        return this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts }),
            compute: { module, entryPoint: 'computeMain' }
        });
    }

    createRenderPipeline(shaderCode, bindGroupLayouts, vertexLayout) {
        const module = this.device.createShaderModule({ code: shaderCode });
        return this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts }),
            vertex: {
                module,
                entryPoint: 'vertMain',
                buffers: vertexLayout
            },
            fragment: {
                module,
                entryPoint: 'fragMain',
                targets: [{
                    format: this.format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list' }
        });
    }
}
