struct Particle {
    pos : vec2<f32>,
    vel : vec2<f32>,
    color : vec4<f32>,
};

struct SimParams {
    time : f32,
    screenW : f32,
    screenH : f32,
    touchX : f32,
    touchY : f32,
    isTouching: f32,
    particleCount: f32,
    pad2: f32,
};
