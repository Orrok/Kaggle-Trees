export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.touchX = 0;
        this.touchY = 0;
        this.isTouching = 0;
        
        this.initListeners();
    }

    initListeners() {
        const updateInput = (x, y, active) => {
            const r = this.canvas.getBoundingClientRect();
            // Convert to clip space coords (-1 to 1)
            // Note: In shader logic provided:
            // touchX = ((x - r.left)/r.width)*2 - 1;
            // touchY = -(((y - r.top)/r.height)*2 - 1);
            
            this.touchX = ((x - r.left) / r.width) * 2 - 1;
            this.touchY = -(((y - r.top) / r.height) * 2 - 1);
            this.isTouching = active ? 1 : 0;
        };

        this.canvas.addEventListener('touchstart', e => updateInput(e.touches[0].clientX, e.touches[0].clientY, true), {passive:false});
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); updateInput(e.touches[0].clientX, e.touches[0].clientY, true); }, {passive:false});
        this.canvas.addEventListener('touchend', () => this.isTouching = 0);
        
        this.canvas.addEventListener('mousedown', e => updateInput(e.clientX, e.clientY, true));
        this.canvas.addEventListener('mousemove', e => { if(this.isTouching) updateInput(e.clientX, e.clientY, true); });
        this.canvas.addEventListener('mouseup', () => this.isTouching = 0);
        // Also handle mouseleave to stop interaction if cursor leaves canvas
        this.canvas.addEventListener('mouseleave', () => this.isTouching = 0);
    }
}
