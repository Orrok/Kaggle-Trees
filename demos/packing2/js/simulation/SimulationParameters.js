/**
 * Simulation parameter management with validation
 */
export class SimulationParameters {
    constructor() {
        this._params = {
            treeCount: 10,
            zoom: 2.0,
            compression: 1.0,
            relaxationRate: 1.0,
            autoPack: true,
            aspect: 1.0,
            renderFrequency: 1
        };

        // Parameter constraints
        this._constraints = {
            treeCount: { min: 1, max: 200, step: 1 },
            zoom: { min: 0.1, max: 10.0, step: 0.1 },
            compression: { min: 0.0, max: 5.0, step: 0.1 },
            relaxationRate: { min: 0.1, max: 2.0, step: 0.1 },
            autoPack: { type: 'boolean' },
            aspect: { min: 0.1, max: 10.0, step: 0.1 },
            renderFrequency: { min: 1, max: 30, step: 1 }
        };

        // Observers for parameter changes
        this._observers = [];
    }

    /**
     * Get a parameter value
     * @param {string} key - Parameter name
     * @returns {*} Parameter value
     */
    get(key) {
        return this._params[key];
    }

    /**
     * Set a parameter value with validation
     * @param {string} key - Parameter name
     * @param {*} value - New value
     * @returns {boolean} True if value was set, false if invalid
     */
    set(key, value) {
        if (!this._validateParameter(key, value)) {
            console.warn(`Invalid parameter ${key}: ${value}`);
            return false;
        }

        const oldValue = this._params[key];
        this._params[key] = value;

        // Notify observers if value changed
        if (oldValue !== value) {
            this._notifyObservers(key, value, oldValue);
        }

        return true;
    }

    /**
     * Get all parameters as an object
     * @returns {Object} Copy of parameters
     */
    getAll() {
        return { ...this._params };
    }

    /**
     * Validate a parameter value
     * @param {string} key - Parameter name
     * @param {*} value - Value to validate
     * @returns {boolean} True if valid
     * @private
     */
    _validateParameter(key, value) {
        const constraint = this._constraints[key];
        if (!constraint) return false;

        if (constraint.type === 'boolean') {
            return typeof value === 'boolean';
        }

        if (typeof value !== 'number' || isNaN(value)) return false;

        if (constraint.min !== undefined && value < constraint.min) return false;
        if (constraint.max !== undefined && value > constraint.max) return false;

        return true;
    }

    /**
     * Get parameter constraints for UI
     * @param {string} key - Parameter name
     * @returns {Object} Constraint object
     */
    getConstraints(key) {
        return { ...this._constraints[key] };
    }

    /**
     * Get uniform buffer data for GPU
     * @param {number} deltaTime - Time since last frame
     * @param {number} frameCount - Current frame count
     * @param {Object} additionalParams - Additional parameters (probX, probY, centerX, centerY)
     * @returns {Float32Array} Uniform data array
     */
    getUniforms(deltaTime, frameCount, additionalParams = {}) {
        const {
            probX = 0.5,
            probY = 0.5,
            centerX = 0.0,
            centerY = 0.0
        } = additionalParams;

        // Match original structure: zoom, compression, probX, time, aspect, _pad1, _pad2, _pad3
        return new Float32Array([
            this._params.zoom,
            this._params.compression,
            probX,
            frameCount, // time
            this._params.aspect,
            0.0, // _pad1
            0.0, // _pad2
            0.0  // _pad3
        ]);
    }

    /**
     * Add an observer for parameter changes
     * @param {Function} callback - Callback function (key, newValue, oldValue)
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this._observers.push(callback);
        return () => {
            const index = this._observers.indexOf(callback);
            if (index > -1) {
                this._observers.splice(index, 1);
            }
        };
    }

    /**
     * Notify observers of parameter changes
     * @param {string} key - Parameter name
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     * @private
     */
    _notifyObservers(key, newValue, oldValue) {
        this._observers.forEach(callback => {
            try {
                callback(key, newValue, oldValue);
            } catch (error) {
                console.error('Error in parameter observer:', error);
            }
        });
    }

    /**
     * Reset parameters to defaults
     */
    reset() {
        const defaults = {
            treeCount: 10,
            zoom: 2.0,
            compression: 1.0,
            relaxationRate: 1.0,
            autoPack: true,
            aspect: 1.0
        };

        Object.keys(defaults).forEach(key => {
            this.set(key, defaults[key]);
        });
    }
}
