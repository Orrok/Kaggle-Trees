@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform> params : SimParams;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    
    // Dynamic Check: Only process active particles
    if (index >= u32(params.particleCount)) { return; }

    var p = particles[index];

    // 1. Interaction Physics
    if (params.isTouching > 0.5) {
        let dx = params.touchX - p.pos.x;
        let dy = params.touchY - p.pos.y;
        let distSq = dx*dx + dy*dy;
        let dist = sqrt(distSq);
        
        if (dist > 0.02) {
            let dirX = dx / dist;
            let dirY = dy / dist;
            let attractStr = 0.0008;
            let swirlStr = 0.003; 

            p.vel.x += (dirX * attractStr) + (-dirY * swirlStr);
            p.vel.y += (dirY * attractStr) + (dirX * swirlStr);
        }
    } else {
        let t = params.time * 0.5;
        p.vel.x += sin(p.pos.y * 5.0 + t) * 0.00005;
        p.vel.y += cos(p.pos.x * 5.0 + t) * 0.00005;
    }

    // 2. Neighbor Repulsion (Stochastic)
    // We check 2 random neighbors per frame. 
    // Over many frames, this creates a statistical "pressure" that keeps particles apart.
    var rngState = index + u32(params.time * 1000.0);
    
    for (var i = 0u; i < 2u; i++) {
        // Simple Random Number Generator (LCG)
        rngState = rngState * 1664525u + 1013904223u;
        let otherIdx = rngState % u32(params.particleCount);

        if (otherIdx != index) {
            let other = particles[otherIdx];
            let rdx = p.pos.x - other.pos.x;
            let rdy = p.pos.y - other.pos.y;
            let rDistSq = rdx*rdx + rdy*rdy;

            // Interaction Radius: 0.02 (screen units)
            if (rDistSq < 0.0004 && rDistSq > 0.000001) {
                let rDist = sqrt(rDistSq);
                // Repel force gets stronger as they get closer
                let push = (0.02 - rDist) * 0.005; 
                p.vel.x += (rdx / rDist) * push;
                p.vel.y += (rdy / rDist) * push;
            }
        }
    }

    p.pos += p.vel;
    p.vel *= 0.965; 

    // Wall Bouncing
    if (p.pos.x < -1.0) { p.pos.x = -1.0; p.vel.x *= -0.5; }
    if (p.pos.x > 1.0)  { p.pos.x = 1.0;  p.vel.x *= -0.5; }
    if (p.pos.y < -1.0) { p.pos.y = -1.0; p.vel.y *= -0.5; }
    if (p.pos.y > 1.0)  { p.pos.y = 1.0;  p.vel.y *= -0.5; }

    // Color Calculation
    let speed = length(p.vel);
    var r = 0.05; var g = 0.02; var b = 0.3; let alpha = 0.6;
    r += speed * 30.0;
    g += speed * 60.0;
    b += speed * 20.0;
    p.color = vec4<f32>(min(r, 1.0), min(g, 1.0), min(b, 1.0), alpha);

    particles[index] = p;
}
