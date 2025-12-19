import { MAX_TREE_COUNT, DECIMAL_PLACES_RATIO, DECIMAL_PLACES_VALUES } from '../constants.js';

/**
 * UI element management and event handling with observer pattern
 */
export class UIManager {
    constructor(simulationParameters, physicsSimulator, performanceMonitor, app = null) {
        this.parameters = simulationParameters;
        this.physicsSimulator = physicsSimulator;
        this.performanceMonitor = performanceMonitor;
        this.app = app;

        // UI element references
        this.elements = {};

        // Parameter observer unsubscribe functions
        this.parameterUnsubscribers = [];

        // Event listeners (for cleanup)
        this.eventListeners = [];
    }

    /**
     * Initialize UI elements and event listeners
     */
    init() {
        this.setupUIElements();
        this.setupEventListeners();
        this.setupParameterObservers();
    }

    /**
     * Get references to UI elements
     */
    setupUIElements() {
        // Sliders
        this.elements.treeSlider = document.getElementById('tree-slider');
        this.elements.treeValue = document.getElementById('tree-value');
        this.elements.zoomSlider = document.getElementById('zoom-slider');
        this.elements.zoomValue = document.getElementById('zoom-value');
        this.elements.compressSlider = document.getElementById('compress-slider');
        this.elements.compressValue = document.getElementById('compress-value');
        this.elements.relaxSlider = document.getElementById('relax-slider');
        this.elements.relaxValue = document.getElementById('relax-value');
        this.elements.renderFrequencySlider = document.getElementById('render-frequency-slider');
        this.elements.renderFrequencyValue = document.getElementById('render-frequency-value');

        // Buttons
        this.elements.autoPackBtn = document.getElementById('auto-pack-btn');
        this.elements.resetBtn = document.getElementById('reset-btn');
        this.elements.debugBtn = document.getElementById('debug-btn');
        this.elements.minimizeBtn = document.getElementById('minimize-btn');

        // Control panel
        this.elements.controlsPanel = document.getElementById('controls-panel');
        this.elements.controlsContent = document.getElementById('controls-content');

        // Debug panel
        this.elements.debugPanel = document.getElementById('debug-panel');
        this.elements.debugLog = document.getElementById('debug-log');
        this.elements.closeDebug = document.getElementById('close-debug');

        // Stats - legacy elements
        this.elements.treeCountEl = document.getElementById('tree-count');
        this.elements.packRatioEl = document.getElementById('pack-ratio');
        this.elements.fpsEl = document.getElementById('fps');

        // HUD elements
        this.elements.hudFPS = document.getElementById('hudFPS');
        this.elements.hudStatus = document.getElementById('hudStatus');
        this.elements.hudCurrent = document.getElementById('hudCurrent');
        this.elements.hudBest = document.getElementById('hudBest');

        // Initialize HUD with default values
        this.initializeHUD();

        // Performance indicator
        this.elements.perfFill = document.getElementById('perf-fill');

        // Initialize draggable panel
        this.setupDraggablePanel();
    }

    /**
     * Setup event listeners for UI controls
     */
    setupEventListeners() {
        // Tree count slider
        this.addEventListener(this.elements.treeSlider, 'input', (e) => {
            const value = parseInt(e.target.value);
            this.parameters.set('treeCount', value);
        });

        // Zoom slider
        this.addEventListener(this.elements.zoomSlider, 'input', (e) => {
            const value = parseFloat(e.target.value);
            this.parameters.set('zoom', value);
        });

        // Compression slider
        this.addEventListener(this.elements.compressSlider, 'input', (e) => {
            const value = parseFloat(e.target.value);
            this.parameters.set('compression', value);
        });

        // Relaxation rate slider
        this.addEventListener(this.elements.relaxSlider, 'input', (e) => {
            const value = parseFloat(e.target.value);
            this.parameters.set('relaxationRate', value);
        });

        // Render frequency slider
        this.addEventListener(this.elements.renderFrequencySlider, 'input', (e) => {
            const value = parseInt(e.target.value);
            this.parameters.set('renderFrequency', value);
        });

        // Auto pack button
        this.addEventListener(this.elements.autoPackBtn, 'click', () => {
            const current = this.parameters.get('autoPack');
            this.parameters.set('autoPack', !current);
        });

        // Reset button
        this.addEventListener(this.elements.resetBtn, 'click', () => {
            this.physicsSimulator.markForReset();
        });

        // Debug button
        this.addEventListener(this.elements.debugBtn, 'click', () => {
            if (this.elements.debugPanel) this.elements.debugPanel.style.display = 'block';
        });

        // Close debug button
        this.addEventListener(this.elements.closeDebug, 'click', () => {
            if (this.elements.debugPanel) this.elements.debugPanel.style.display = 'none';
        });

        // Minimize button
        this.addEventListener(this.elements.minimizeBtn, 'click', () => {
            this.toggleMinimize();
        });

        // Window resize
        this.addEventListener(window, 'resize', () => {
            // This will be handled by the main app
            // but we listen here for potential UI adjustments
        });
    }

    /**
     * Setup observers for parameter changes to update UI
     */
    setupParameterObservers() {
        // Tree count observer
        const treeCountUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'treeCount') {
                if (this.elements.treeValue) this.elements.treeValue.textContent = value;
                if (this.elements.treeSlider) this.elements.treeSlider.value = value;
                // Pause simulation when tree count changes
                if (this.app) {
                    this.app.stop();
                    this.app.handleTreeCountChange(value);
                } else {
                    this.physicsSimulator.handleTreeCountChange(value);
                }
            }
        });
        this.parameterUnsubscribers.push(treeCountUnsub);

        // Zoom observer
        const zoomUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'zoom') {
                if (this.elements.zoomValue) this.elements.zoomValue.textContent = value.toFixed(1);
                if (this.elements.zoomSlider) this.elements.zoomSlider.value = value;
            }
        });
        this.parameterUnsubscribers.push(zoomUnsub);

        // Compression observer
        const compressUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'compression') {
                if (this.elements.compressValue) this.elements.compressValue.textContent = value.toFixed(DECIMAL_PLACES_VALUES);
                if (this.elements.compressSlider) this.elements.compressSlider.value = value;
            }
        });
        this.parameterUnsubscribers.push(compressUnsub);

        // Relaxation rate observer
        const relaxUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'relaxationRate') {
                if (this.elements.relaxValue) this.elements.relaxValue.textContent = value.toFixed(DECIMAL_PLACES_VALUES);
                if (this.elements.relaxSlider) this.elements.relaxSlider.value = value;
            }
        });
        this.parameterUnsubscribers.push(relaxUnsub);

        // Render frequency observer
        const renderFrequencyUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'renderFrequency') {
                if (this.elements.renderFrequencyValue) this.elements.renderFrequencyValue.textContent = value;
                if (this.elements.renderFrequencySlider) this.elements.renderFrequencySlider.value = value;
            }
        });
        this.parameterUnsubscribers.push(renderFrequencyUnsub);

        // Auto pack observer
        const autoPackUnsub = this.parameters.subscribe((key, value) => {
            if (key === 'autoPack') {
                if (this.elements.autoPackBtn) this.elements.autoPackBtn.classList.toggle('active', value);
            }
        });
        this.parameterUnsubscribers.push(autoPackUnsub);
    }

    /**
     * Update UI stats display
     * @param {Object} stats - Stats object with fps, treeCount, packRatio
     */
    updateStats(stats) {
        const { fps, treeCount, packRatio } = stats;

        // Update legacy stats elements
        if (this.elements.fpsEl) {
            this.elements.fpsEl.textContent = fps;
        }

        if (this.elements.treeCountEl) {
            this.elements.treeCountEl.textContent = treeCount;
        }

        if (this.elements.packRatioEl && packRatio !== undefined) {
            this.elements.packRatioEl.textContent = packRatio.toFixed(DECIMAL_PLACES_RATIO);
        }

        // Update HUD elements
        if (this.elements.hudFPS) {
            this.elements.hudFPS.textContent = fps;
        }

        // Update performance indicator
        if (this.elements.perfFill && treeCount !== undefined) {
            const load = Math.min(100, (treeCount / MAX_TREE_COUNT) * 100);
            this.elements.perfFill.style.width = load + '%';
        }
    }

    /**
     * Initialize HUD with default values
     */
    initializeHUD() {
        if (this.elements.hudStatus) {
            this.elements.hudStatus.textContent = "READY";
            this.elements.hudStatus.className = "hud-val";
        }
        if (this.elements.hudCurrent) {
            this.elements.hudCurrent.textContent = "0.00";
            this.elements.hudCurrent.className = "hud-val";
        }
        if (this.elements.hudBest) {
            this.elements.hudBest.textContent = "--";
        }
        if (this.elements.hudFPS) {
            this.elements.hudFPS.textContent = "0";
        }
    }

    /**
     * Update score and status displays
     * @param {Object} scoreData - Score data from feedback loop
     */
    updateScore(scoreData) {
        if (!scoreData) return;

        const { score, bestScore, collisionCount } = scoreData;

        // Update current score
        if (this.elements.hudCurrent) {
            this.elements.hudCurrent.textContent = score.toFixed(4);
            // Update status based on collision count
            if (collisionCount > 0) {
                this.elements.hudStatus.textContent = "RELAXING";
                this.elements.hudStatus.className = "hud-val val-relax";
                this.elements.hudCurrent.className = "hud-val val-invalid";
            } else {
                this.elements.hudStatus.textContent = "SQUEEZING";
                this.elements.hudStatus.className = "hud-val val-valid";
                this.elements.hudCurrent.className = "hud-val val-valid";
            }
        }

        // Update best score
        if (this.elements.hudBest && bestScore !== Infinity) {
            this.elements.hudBest.textContent = bestScore.toFixed(4);
        }
    }

    /**
     * Update pack ratio specifically
     * @param {number} packRatio - Current packing ratio
     */
    updatePackRatio(packRatio) {
        if (this.elements.packRatioEl) {
            this.elements.packRatioEl.textContent = packRatio.toFixed(DECIMAL_PLACES_RATIO);
        }
    }

    /**
     * Add event listener and track for cleanup
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    addEventListener(element, event, handler) {
        if (!element) {
            console.warn(`UIManager: Cannot add event listener for ${event} - element is null`);
            return;
        }
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }

    /**
     * Remove all event listeners (for cleanup)
     */
    removeEventListeners() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }

    /**
     * Unsubscribe from all parameter observers (for cleanup)
     */
    removeParameterObservers() {
        this.parameterUnsubscribers.forEach(unsub => unsub());
        this.parameterUnsubscribers = [];
    }

    /**
     * Set debug element for logging
     * @param {HTMLElement} debugElement - Debug log element
     */
    setDebugElement(debugElement) {
        this.elements.debugLog = debugElement;
    }

    /**
     * Setup draggable panel functionality
     */
    setupDraggablePanel() {
        if (!this.elements.controlsPanel) return;

        const panel = this.elements.controlsPanel;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let panelStartX = 0;
        let panelStartY = 0;

        const handleMouseDown = (e) => {
            // Only start drag if clicking on header or if panel is minimized
            if (e.target.closest('#controls-header') || panel.classList.contains('minimized')) {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                const rect = panel.getBoundingClientRect();
                panelStartX = rect.left;
                panelStartY = rect.top;

                e.preventDefault();
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, panelStartX + deltaX));
            const newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, panelStartY + deltaY));

            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto'; // Override right positioning when dragged
        };

        const handleMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        this.addEventListener(panel, 'mousedown', handleMouseDown);
    }

    /**
     * Toggle minimize state of controls panel
     */
    toggleMinimize() {
        if (!this.elements.controlsPanel) return;

        const panel = this.elements.controlsPanel;
        const isMinimized = panel.classList.contains('minimized');

        if (isMinimized) {
            panel.classList.remove('minimized');
            this.elements.minimizeBtn.textContent = '−';
        } else {
            panel.classList.add('minimized');
            this.elements.minimizeBtn.textContent = '+';
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.removeEventListeners();
        this.removeParameterObservers();
    }
}
