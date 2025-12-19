import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIManager } from '../js/ui/UIManager.js';

describe('UIManager', () => {
  let uiManager;
  let mockElements;

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      fpsVal: createMockElement('span'),
      countDisplay: createMockElement('span'),
      slider: createMockElement('input'),
      startBtn: createMockElement('button'),
      startScreen: createMockElement('div')
    };

    // Mock getElementById to return our mock elements BEFORE creating UIManager
    global.document.getElementById = vi.fn((id) => {
      switch (id) {
        case 'fps-val': return mockElements.fpsVal;
        case 'count-display': return mockElements.countDisplay;
        case 'particle-slider': return mockElements.slider;
        case 'btn-start': return mockElements.startBtn;
        case 'start-screen': return mockElements.startScreen;
        default: return null;
      }
    });

    uiManager = new UIManager();
  });

  describe('constructor', () => {
    it('should initialize DOM element references', () => {
      expect(uiManager.fpsVal).toBe(mockElements.fpsVal);
      expect(uiManager.countDisplay).toBe(mockElements.countDisplay);
      expect(uiManager.slider).toBe(mockElements.slider);
      expect(uiManager.startBtn).toBe(mockElements.startBtn);
      expect(uiManager.startScreen).toBe(mockElements.startScreen);
    });

    it('should initialize callback properties', () => {
      expect(uiManager.onStart).toBeNull();
      expect(uiManager.onParticleCountChange).toBeNull();
    });

    it('should call initListeners', () => {
      const initListenersSpy = vi.spyOn(UIManager.prototype, 'initListeners');

      new UIManager();

      expect(initListenersSpy).toHaveBeenCalled();
    });
  });

  describe('initListeners', () => {
    it('should set onclick handler for start button', () => {
      uiManager.initListeners();

      expect(mockElements.startBtn.onclick).toBeDefined();
      expect(typeof mockElements.startBtn.onclick).toBe('function');
    });

    it('should add input listener to slider', () => {
      const addEventListenerSpy = vi.spyOn(mockElements.slider, 'addEventListener');

      uiManager.initListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('should not set handlers if elements are null', () => {
      global.document.getElementById = vi.fn().mockReturnValue(null);

      const newUIManager = new UIManager();

      // Should not throw errors even with null elements
      expect(() => newUIManager.initListeners()).not.toThrow();
    });
  });

  describe('start button functionality', () => {
    it('should call onStart callback when start button is clicked', () => {
      uiManager.onStart = vi.fn();

      uiManager.initListeners();

      // Call the onclick handler directly
      mockElements.startBtn.onclick();

      expect(uiManager.onStart).toHaveBeenCalled();
    });

    it('should call hideStartScreen when start button is clicked', () => {
      const hideStartScreenSpy = vi.spyOn(uiManager, 'hideStartScreen');

      uiManager.initListeners();

      mockElements.startBtn.onclick();

      expect(hideStartScreenSpy).toHaveBeenCalled();
    });

    it('should not call onStart if callback is not set', () => {
      uiManager.onStart = null;

      uiManager.initListeners();

      // Should not throw error
      expect(() => mockElements.startBtn.onclick()).not.toThrow();
    });
  });

  describe('slider functionality', () => {
    it('should call onParticleCountChange callback when slider value changes', () => {
      uiManager.onParticleCountChange = vi.fn();
      mockElements.slider.value = '50000';

      uiManager.initListeners();

      const inputListener = mockElements.slider.addEventListener.mock.calls[0][1];
      const mockEvent = { target: { value: '50000' } };

      inputListener(mockEvent);

      expect(uiManager.onParticleCountChange).toHaveBeenCalledWith(50000);
    });

    it('should call updateCountDisplay when slider value changes', () => {
      const updateCountDisplaySpy = vi.spyOn(uiManager, 'updateCountDisplay');
      mockElements.slider.value = '75000';

      uiManager.initListeners();

      const inputListener = mockElements.slider.addEventListener.mock.calls[0][1];
      const mockEvent = { target: { value: '75000' } };

      inputListener(mockEvent);

      expect(updateCountDisplaySpy).toHaveBeenCalledWith(75000);
    });

    it('should parse slider value as integer', () => {
      uiManager.onParticleCountChange = vi.fn();
      mockElements.slider.value = '42.7'; // String with decimal

      uiManager.initListeners();

      const inputListener = mockElements.slider.addEventListener.mock.calls[0][1];
      const mockEvent = { target: { value: '42.7' } };

      inputListener(mockEvent);

      expect(uiManager.onParticleCountChange).toHaveBeenCalledWith(42);
    });

    it('should handle invalid slider values', () => {
      uiManager.onParticleCountChange = vi.fn();
      mockElements.slider.value = 'invalid';

      uiManager.initListeners();

      const inputListener = mockElements.slider.addEventListener.mock.calls[0][1];
      const mockEvent = { target: { value: 'invalid' } };

      inputListener(mockEvent);

      expect(uiManager.onParticleCountChange).toHaveBeenCalledWith(NaN);
    });
  });

  describe('hideStartScreen', () => {
    it('should set start screen opacity to 0 and display to none after timeout', () => {
      vi.useFakeTimers();

      uiManager.hideStartScreen();

      expect(mockElements.startScreen.style.opacity).toBe('0');

      vi.advanceTimersByTime(500);

      expect(mockElements.startScreen.style.display).toBe('none');

      vi.useRealTimers();
    });

    it('should handle null start screen gracefully', () => {
      uiManager.startScreen = null;

      expect(() => uiManager.hideStartScreen()).not.toThrow();
    });
  });

  describe('updateCountDisplay', () => {
    it('should format count in thousands with k suffix', () => {
      uiManager.updateCountDisplay(50000);

      expect(mockElements.countDisplay.textContent).toBe('50k');
    });

    it('should round down correctly', () => {
      uiManager.updateCountDisplay(1234);

      expect(mockElements.countDisplay.textContent).toBe('1k');
    });

    it('should handle zero', () => {
      uiManager.updateCountDisplay(0);

      expect(mockElements.countDisplay.textContent).toBe('0k');
    });

    it('should handle large numbers', () => {
      uiManager.updateCountDisplay(1000000);

      expect(mockElements.countDisplay.textContent).toBe('1000k');
    });

    it('should handle null count display gracefully', () => {
      uiManager.countDisplay = null;

      expect(() => uiManager.updateCountDisplay(50000)).not.toThrow();
    });
  });

  describe('updateFPS', () => {
    it('should update fps display with provided value', () => {
      uiManager.updateFPS(60);

      expect(mockElements.fpsVal.textContent).toBe('60');
    });

    it('should convert number to string', () => {
      uiManager.updateFPS(42.7);

      expect(mockElements.fpsVal.textContent).toBe('42.7');
    });

    it('should handle zero fps', () => {
      uiManager.updateFPS(0);

      expect(mockElements.fpsVal.textContent).toBe('0');
    });

    it('should handle null fps element gracefully', () => {
      uiManager.fpsVal = null;

      expect(() => uiManager.updateFPS(60)).not.toThrow();
    });
  });
});
