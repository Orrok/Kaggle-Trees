export class UIManager {
    constructor() {
        this.fpsVal = document.getElementById('fps-val');
        this.countDisplay = document.getElementById('count-display');
        this.slider = document.getElementById('particle-slider');
        this.startBtn = document.getElementById('btn-start');
        this.startScreen = document.getElementById('start-screen');
        
        this.onStart = null;
        this.onParticleCountChange = null;

        this.initListeners();
    }

    initListeners() {
        if (this.startBtn) {
            this.startBtn.onclick = () => {
                if (this.onStart) this.onStart();
                this.hideStartScreen();
            };
        }

        if (this.slider) {
            this.slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                this.updateCountDisplay(val);
                if (this.onParticleCountChange) this.onParticleCountChange(val);
            });
        }
    }

    hideStartScreen() {
        if (this.startScreen) {
            this.startScreen.style.opacity = '0';
            setTimeout(() => this.startScreen.style.display = 'none', 500);
        }
    }

    updateCountDisplay(count) {
        if (this.countDisplay) {
            const kVal = (count / 1000).toFixed(0);
            this.countDisplay.textContent = kVal + 'k';
        }
    }

    updateFPS(fps) {
        if (this.fpsVal) {
            this.fpsVal.textContent = fps;
        }
    }
}
