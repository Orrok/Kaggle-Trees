@group(0) @binding(0) var<uniform> screenParams : vec2<f32>;

struct VertexInput {
    @location(0) position : vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

@vertex
fn vertMain(input : VertexInput) -> VertexOutput {
    let aspect = screenParams.x / screenParams.y;
    
    var output : VertexOutput;
    // Transform to clip space
    output.position = vec4<f32>(
        input.position.x / aspect,
        input.position.y,
        0.0,
        1.0
    );
    
    // Color based on Y position (green gradient for tree, brown for trunk)
    let y = input.position.y;
    if (y < -0.7) {
        // Trunk - brown
        output.color = vec4<f32>(0.4, 0.25, 0.1, 1.0);
    } else {
        // Tree - green gradient (darker at bottom, lighter at top)
        let greenIntensity = 0.3 + (y + 0.8) * 0.5;
        output.color = vec4<f32>(0.0, greenIntensity, 0.1, 1.0);
    }
    
    return output;
}

@fragment
fn fragMain(@location(0) color : vec4<f32>) -> @location(0) vec4<f32> {
    return color;
}
