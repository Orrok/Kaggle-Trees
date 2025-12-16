# WebGPU Particle Simulation

A WebGPU-powered particle simulation featuring 1000 animated particles with physics-based movement.

## Features

- **1000 Particles**: Smooth animation of 1000 particles rendered using WebGPU
- **Physics Simulation**: Realistic particle physics with gravity, collision detection, and damping
- **Dynamic Colors**: Particles change color based on their velocity
- **GPU Acceleration**: All computation and rendering happens on the GPU for optimal performance

## Requirements

- A modern browser with WebGPU support:
  - Chrome 113+ or Edge 113+
  - Chrome Canary with WebGPU flags enabled
  - Safari Technology Preview (experimental support)

## Running the Project

1. Serve the files using a local web server (WebGPU requires HTTPS or localhost):
   
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server -p 8000
   
   # Using PHP
   php -S localhost:8000
   ```

2. Open your browser and navigate to `http://localhost:8000`

3. The particle simulation should start automatically!

## How It Works

- **Compute Shader**: Updates particle positions, velocities, and properties on the GPU
- **Vertex Shader**: Renders each particle as a small quad
- **Fragment Shader**: Applies color and transparency to particles
- **Physics**: Includes gravity, boundary collisions, random forces, and velocity-based coloring

## Project Structure

- `index.html` - Main HTML file with canvas setup
- `main.js` - WebGPU initialization, shaders, and animation loop

Enjoy the particle simulation! 🎉
