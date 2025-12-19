/**
 * Canvas 2D overlay drawing (bounds, scoring square, compression arrows, graph)
 */
export class OverlayRenderer {
    constructor(overlayCanvas, simulationParameters) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d');
        this.parameters = simulationParameters;
        this.scoreHistory = [];
    }

    /**
     * Draw overlay elements matching original implementation
     * @param {Object} bounds - Current tree bounds {minX, maxX, minY, maxY}
     * @param {number} probX - Compression probability X
     * @param {Array} scoreHistory - Array of recent scores for graph
     * @param {number} stagnationCount - Frames since last improvement
     * @param {Object} windData - Wind data {magnitude, direction}
     */
    drawOverlay(bounds, probX, scoreHistory = [], stagnationCount = 0, windData = null) {
        const ctx = this.ctx;
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        if (!bounds) {
            return;
        }

        const zoom = this.parameters.get('zoom');
        const aspect = cw / ch;
        const worldScale = zoom * 0.1;

        // World to screen coordinate transformation (matches shader)
        const toScreen = (wx, wy) => {
            // This matches the shader transformation: world * zoom * 0.1 * aspect_vec
            // where aspect_vec = vec2f(1.0 / aspect, 1.0)
            let clipX = wx * worldScale / aspect;  // / aspect matches shader
            let clipY = wy * worldScale;            // * 1.0 matches shader
            let sx = (clipX + 1) * 0.5 * cw;
            let sy = (1 - (clipY + 1) * 0.5) * ch;
            return {x: sx, y: sy};
        };

        const { minX: x, minY: y, maxX, maxY } = bounds;
        const w = maxX - x;
        const h = maxY - y;
        const side = Math.max(w, h);

        // Draw Bounding Rect (Cyan)
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 2;
        const p1 = toScreen(x, y);
        const p2 = toScreen(x + w, y + h);

        // Calculate Screen Bounds for Arrows
        const minSx = Math.min(p1.x, p2.x);
        const maxSx = Math.max(p1.x, p2.x);
        const minSy = Math.min(p1.y, p2.y);
        const maxSy = Math.max(p1.y, p2.y);
        const midSx = (minSx + maxSx) / 2;
        const midSy = (minSy + maxSy) / 2;

        ctx.strokeRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);

        // Draw Scoring Square (Yellow)
        ctx.strokeStyle = "#f6e05e";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        let cx = x + w/2;
        let cy = y + h/2;
        let sx = cx - side/2;
        let sy = cy - side/2;
        const sp1 = toScreen(sx, sy);
        const sp2 = toScreen(sx + side, sy + side);
        ctx.strokeRect(sp1.x, sp2.y, sp2.x - sp1.x, sp1.y - sp2.y);
        ctx.setLineDash([]);

        // Draw Compression Arrows
        ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
        ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
        ctx.lineWidth = 4;

        const arrowLen = 40;
        const pad = 15;

        const drawArrow = (x, y, dx, dy) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + dx, y + dy);
            ctx.stroke();
            // Arrowhead
            const ang = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(x + dx, y + dy);
            ctx.lineTo(x + dx - 15*Math.cos(ang-0.5), y + dy - 15*Math.sin(ang-0.5));
            ctx.lineTo(x + dx - 15*Math.cos(ang+0.5), y + dy - 15*Math.sin(ang+0.5));
            ctx.closePath();
            ctx.fill();
        };

        if (probX > 0.55) {
            // Squeezing X (Width is too big) -> Horizontal Arrows In
            drawArrow(minSx - pad - arrowLen, midSy, arrowLen, 0);
            drawArrow(maxSx + pad + arrowLen, midSy, -arrowLen, 0);
        } else if (probX < 0.45) {
            // Squeezing Y (Height is too big) -> Vertical Arrows In
            drawArrow(midSx, minSy - pad - arrowLen, 0, arrowLen);
            drawArrow(midSx, maxSy + pad + arrowLen, 0, -arrowLen);
        }

        // Draw Graph
        this.drawGraph(ctx, cw, ch, scoreHistory, stagnationCount);

        // Draw Wind Radar
        if (windData && windData.magnitude !== undefined) {
            this.drawWindRadar(ctx, cw, ch, windData);
        }
    }

    /**
     * Draw score history graph
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     * @param {Array} scoreHistory - Array of score values
     * @param {number} stagnationCount - Frames since improvement
     */
    drawGraph(ctx, w, h, scoreHistory, stagnationCount) {
        if (scoreHistory.length < 2) return;

        const gw = 180; // Graph Width
        const gh = 50;  // Graph Height
        const gx = w - gw - 20;
        const gy = 70; // Below top bar

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = "#444";
        ctx.setLineDash([]);
        ctx.strokeRect(gx, gy, gw, gh);

        let minS = Math.min(...scoreHistory);
        let maxS = Math.max(...scoreHistory);
        let range = maxS - minS;
        if (range < 0.0001) range = 1.0;

        // Color Red if Stagnant
        const isStagnant = stagnationCount > 5;
        ctx.strokeStyle = isStagnant ? "#ff4444" : "#4fd1c5";
        ctx.lineWidth = 2;
        ctx.beginPath();

        let localMin = Infinity;
        let localMinX, localMinY;

        for (let i = 0; i < scoreHistory.length; i++) {
            let val = scoreHistory[i];
            let norm = (val - minS) / range;
            let x = gx + (i / (scoreHistory.length - 1)) * gw;
            let y = gy + gh - (norm * gh); // Bottom is minS

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            if (val <= localMin) {
                localMin = val;
                localMinX = x;
                localMinY = y;
            }
        }
        ctx.stroke();

        // Highlight Min
        if (localMin !== Infinity) {
            ctx.fillStyle = "#f6e05e";
            ctx.beginPath();
            ctx.arc(localMinX, localMinY, 3, 0, Math.PI*2);
            ctx.fill();
        }

        if (isStagnant) {
            ctx.fillStyle = "#ff4444";
            ctx.font = "10px sans-serif";
            ctx.fillText("STAGNANT", gx + 5, gy + 15);
        }
    }

    /**
     * Draw wind radar plot
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     * @param {Object} windData - Wind data {magnitude, direction}
     */
    drawWindRadar(ctx, w, h, windData) {
        const { magnitude, direction } = windData;

        // Position below the score graph
        const radarSize = 60;
        const radarX = w - radarSize - 20;
        const radarY = 140; // Below the graph

        // Draw radar background (circle)
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.arc(radarX + radarSize/2, radarY + radarSize/2, radarSize/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw radar grid lines
        ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
        ctx.lineWidth = 1;
        // Vertical line (East-West)
        ctx.beginPath();
        ctx.moveTo(radarX, radarY + radarSize/2);
        ctx.lineTo(radarX + radarSize, radarY + radarSize/2);
        ctx.stroke();
        // Horizontal line (North-South)
        ctx.beginPath();
        ctx.moveTo(radarX + radarSize/2, radarY);
        ctx.lineTo(radarX + radarSize/2, radarY + radarSize);
        ctx.stroke();

        // Add cardinal direction labels
        ctx.fillStyle = "#888";
        ctx.font = "8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", radarX + radarSize/2, radarY + 8);
        ctx.fillText("S", radarX + radarSize/2, radarY + radarSize - 2);
        ctx.fillText("W", radarX + 2, radarY + radarSize/2 + 3);
        ctx.fillText("E", radarX + radarSize - 2, radarY + radarSize/2 + 3);

        // Calculate wind vector position in radar
        // Normalize magnitude (assuming max magnitude of ~1.0 for full scale)
        const normalizedMagnitude = Math.min(magnitude / 1.0, 1.0);
        const radarRadius = (radarSize/2 - 8) * normalizedMagnitude; // Leave margin for labels

        // Convert direction to screen coordinates (N is up, standard math coordinates)
        const centerX = radarX + radarSize/2;
        const centerY = radarY + radarSize/2;
        const windX = centerX + Math.sin(direction) * radarRadius; // sin for x in screen coords
        const windY = centerY - Math.cos(direction) * radarRadius; // -cos for y (up is negative in screen coords)

        // Color based on magnitude: green (0) to red (1.0)
        const greenValue = Math.max(0, 1.0 - normalizedMagnitude);
        const redValue = Math.min(1.0, normalizedMagnitude);
        const color = `rgb(${Math.floor(redValue * 255)}, ${Math.floor(greenValue * 255)}, 0)`;

        // Draw wind vector dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(windX, windY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw wind vector line from center to dot
        if (normalizedMagnitude > 0.01) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(windX, windY);
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WIND", radarX + radarSize/2, radarY + radarSize + 12);
    }

    /**
     * Draw all overlay elements (legacy method for compatibility)
     * @param {Object} bounds - Current tree bounds {minX, maxX, minY, maxY}
     */
    draw(bounds = null) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear overlay
        this.ctx.clearRect(0, 0, width, height);

        // Draw center crosshair
        this.drawCrosshair(width, height);

        // Draw bounding box and related elements
        if (bounds) {
            this.drawBoundingBox(bounds, width, height);
            this.drawCompressionVectors(bounds, width, height);
        }
    }

    /**
     * Draw center crosshair
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    drawCrosshair(width, height) {
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2 - 20, height / 2);
        this.ctx.lineTo(width / 2 + 20, height / 2);
        this.ctx.moveTo(width / 2, height / 2 - 20);
        this.ctx.lineTo(width / 2, height / 2 + 20);
        this.ctx.stroke();
    }

    /**
     * Draw bounding box and center of mass
     * @param {Object} bounds - Bounds object
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    drawBoundingBox(bounds, width, height) {
        // Convert world coordinates to screen coordinates
        const screenMinX = ((bounds.minX + 2) / 4) * width;
        const screenMaxX = ((bounds.maxX + 2) / 4) * width;
        const screenMinY = ((bounds.minY + 2) / 4) * height;
        const screenMaxY = ((bounds.maxY + 2) / 4) * height;

        // Draw bounding box
        this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenMinX, screenMinY, screenMaxX - screenMinX, screenMaxY - screenMinY);

        // Draw center of mass
        const centerX = (screenMinX + screenMaxX) / 2;
        const centerY = (screenMinY + screenMaxY) / 2;
        this.ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw compression vectors as arrows
     * @param {Object} bounds - Bounds object
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    drawCompressionVectors(bounds, width, height) {
        if (!this.parameters.get('autoPack')) return;

        const width_ratio = (bounds.maxX - bounds.minX) / 4; // normalized
        const height_ratio = (bounds.maxY - bounds.minY) / 4; // normalized

        this.ctx.strokeStyle = 'rgba(100, 255, 100, 0.6)';
        this.ctx.lineWidth = 3;

        const arrowLength = 30;

        if (width_ratio > height_ratio) {
            // Compress horizontally
            this.drawHorizontalArrow(width, height, arrowLength);
        } else {
            // Compress vertically
            this.drawVerticalArrow(width, height, arrowLength);
        }
    }

    /**
     * Draw horizontal compression arrow
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} arrowLength - Length of arrow
     */
    drawHorizontalArrow(width, height, arrowLength) {
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2 - arrowLength, height / 2);
        this.ctx.lineTo(width / 2 + arrowLength, height / 2);
        // Left arrowhead
        this.ctx.moveTo(width / 2 - arrowLength, height / 2);
        this.ctx.lineTo(width / 2 - arrowLength + 10, height / 2 - 5);
        this.ctx.moveTo(width / 2 - arrowLength, height / 2);
        this.ctx.lineTo(width / 2 - arrowLength + 10, height / 2 + 5);
        this.ctx.stroke();
    }

    /**
     * Draw vertical compression arrow
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} arrowLength - Length of arrow
     */
    drawVerticalArrow(width, height, arrowLength) {
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, height / 2 - arrowLength);
        this.ctx.lineTo(width / 2, height / 2 + arrowLength);
        // Up arrowhead
        this.ctx.moveTo(width / 2, height / 2 - arrowLength);
        this.ctx.lineTo(width / 2 - 5, height / 2 - arrowLength + 10);
        this.ctx.moveTo(width / 2, height / 2 - arrowLength);
        this.ctx.lineTo(width / 2 + 5, height / 2 - arrowLength + 10);
        this.ctx.stroke();
    }

    /**
     * Resize overlay canvas
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Clear overlay
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Set overlay visibility
     * @param {boolean} visible - Whether overlay should be visible
     */
    setVisible(visible) {
        this.canvas.style.display = visible ? 'block' : 'none';
    }
}
