# Unit Tests for Kaggle Trees Project

This directory contains comprehensive unit tests for the JavaScript modules in the Kaggle Trees project.

## Test Framework

- **Testing Framework**: [Vitest](https://vitest.dev/) - A modern testing framework built on top of Vite
- **Environment**: jsdom - For DOM manipulation testing
- **Assertions**: Built-in Vitest assertions

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tests:
   ```bash
   npm test          # Run tests in watch mode
   npm run test:run  # Run tests once
   npm run test:coverage  # Run tests with coverage report
   ```

## Test Structure

### Test Files

- `Logger.test.js` - Tests for the Logger utility class
- `SimulationParameters.test.js` - Tests for parameter management with validation
- `TreeGeometry.test.js` - Tests for tree geometry calculations
- `PerformanceMonitor.test.js` - Tests for FPS monitoring and metrics

### Test Coverage

The tests cover:

- **Logger**: Console and DOM logging, debug panel integration
- **SimulationParameters**: Parameter validation, observer pattern, uniform buffer generation
- **TreeGeometry**: Polygon data, vertex generation, index creation
- **PerformanceMonitor**: FPS calculation, frame time smoothing, metrics collection

## Key Features Tested

### Logger
- Console logging with prefixes
- DOM element logging with timestamps
- Different log levels (info, success, warn, error)
- Debug element scrolling

### SimulationParameters
- Parameter validation with min/max constraints
- Boolean and numeric parameter handling
- Observer pattern for parameter changes
- Uniform buffer generation for GPU
- Parameter reset functionality

### TreeGeometry
- Tree polygon coordinate accuracy
- Vertex and index buffer generation
- Triangle triangulation for rendering
- Collision radius and vertex count calculations

### PerformanceMonitor
- FPS calculation from frame timestamps
- Frame time history management
- Smoothed FPS averaging
- Performance metrics collection
- Reset functionality

## Test Environment

The tests run in a jsdom environment that mocks:
- WebGPU API (`navigator.gpu`)
- DOM elements and events
- Console methods
- Browser timing functions

## Running Tests

```bash
# Run all tests
npm run test:run

# Run tests in watch mode (for development)
npm test

# Run with coverage
npm run test:coverage
```

## Test Results

All 77 tests currently pass, covering the core JavaScript modules used in the tree packing simulations.

## Adding New Tests

When adding new JavaScript modules, create corresponding test files following the naming convention: `ModuleName.test.js`.

Use the existing test setup and helper functions in `setup.js` for consistent mocking and utilities.
