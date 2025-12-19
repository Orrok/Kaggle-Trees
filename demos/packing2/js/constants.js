/**
 * Shared constants for the Tree Packing demo
 */

// Tree data structure constants
export const FLOATS_PER_TREE = 8; // position:2, velocity:2, rotation:1, angular_velocity:1, collision:1, padding:1
export const LEGACY_FLOATS_PER_TREE = 10; // Legacy implementation: position:2, rotation:1, velocity:2, angular_velocity:1, radius:1, padding:3

// Simulation constants
export const TARGET_FPS = 60;
export const DELTA_TIME = 1.0 / TARGET_FPS; // Fixed timestep for stability

// Tree count limits
export const MAX_TREE_COUNT = 200; // Maximum number of trees for load calculations

// Buffer size constants
export const BYTES_PER_FLOAT = 4; // Size of a Float32 in bytes
export const PARAMETERS_FLOAT_COUNT = 8; // Number of floats in parameter buffer

// Debug/logging constants
export const LOG_FRAME_INTERVAL = 60; // Log every 60 frames

// UI constants
export const DECIMAL_PLACES_RATIO = 3; // Decimal places for pack ratio display
export const DECIMAL_PLACES_VALUES = 2; // Decimal places for compress/relax values

// Performance monitoring
export const PERFORMANCE_HISTORY_SIZE = 60; // Keep 60 frames of history for smoothing
