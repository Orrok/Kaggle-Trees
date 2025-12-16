@group(0) @binding(0) var<storage, read> particles : array<Particle>;
@group(0) @binding(1) var<uniform> params : SimParams;

struct VertexInput {
    @builtin(instance_index) instanceIdx : u32,
    @location(0) position : vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

@vertex
fn vertMain(input : VertexInput) -> VertexOutput {
    let p = particles[input.instanceIdx];
    let aspect = params.screenW / params.screenH;
    
    let speed = length(p.vel);
    let size = 0.008 + (speed * 0.1); 

    let finalX = p.pos.x + (input.position.x * size / aspect);
    let finalY = p.pos.y + (input.position.y * size);

    var output : VertexOutput;
    output.position = vec4<f32>(finalX, finalY, 0.0, 1.0);
    output.color = p.color;
    return output;
}

@fragment
fn fragMain(@location(0) color : vec4<f32>) -> @location(0) vec4<f32> {
    return color;
}
