export class ShaderLoader {
    static async load(path) {
        const response = await fetch(path);
        return await response.text();
    }

    static async loadShaders() {
        const common = await this.load('shaders/common.wgsl');
        const compute = await this.load('shaders/compute.wgsl');
        const render = await this.load('shaders/render.wgsl');

        return {
            compute: common + '\n' + compute,
            render: common + '\n' + render
        };
    }
}
