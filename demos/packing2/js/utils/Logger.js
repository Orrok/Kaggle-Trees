/**
 * Centralized logging utility with different log levels and debug panel support
 */
export class Logger {
    constructor() {
        this.debugElement = null;
        this.prefix = '[Tree Packer]';
    }

    /**
     * Set the debug element for UI logging
     * @param {HTMLElement} debugElement - The element to append log messages to
     */
    setDebugElement(debugElement) {
        this.debugElement = debugElement;
    }

    /**
     * Log an info message
     * @param {string} message - The message to log
     */
    info(message) {
        this.log(message, 'info');
    }

    /**
     * Log a success message
     * @param {string} message - The message to log
     */
    success(message) {
        this.log(message, 'success');
    }

    /**
     * Log a warning message
     * @param {string} message - The message to log
     */
    warn(message) {
        this.log(message, 'warn');
    }

    /**
     * Log an error message
     * @param {string} message - The message to log
     */
    error(message) {
        this.log(message, 'error');
    }

    /**
     * Internal logging method
     * @param {string} message - The message to log
     * @param {string} level - The log level (info, success, warn, error)
     */
    log(message, level = 'info') {
        // Console logging
        const consoleMessage = `${this.prefix} ${message}`;
        console.log(consoleMessage);

        // Debug panel logging
        if (this.debugElement) {
            const line = document.createElement('div');
            line.className = `log-line log-${level}`;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            this.debugElement.appendChild(line);
            this.debugElement.scrollTop = this.debugElement.scrollHeight;
        }
    }
}
