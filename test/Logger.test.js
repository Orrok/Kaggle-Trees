import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger } from '../demos/packing2/js/utils/Logger.js';

describe('Logger', () => {
  let logger;
  let mockDebugElement;

  beforeEach(() => {
    logger = new Logger();
    mockDebugElement = createMockElement('div');
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(logger.debugElement).toBeNull();
      expect(logger.prefix).toBe('[Tree Packer]');
    });
  });

  describe('setDebugElement', () => {
    it('should set the debug element', () => {
      logger.setDebugElement(mockDebugElement);
      expect(logger.debugElement).toBe(mockDebugElement);
    });
  });


  describe('log method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log to console with prefix', () => {
      logger.log('test message', 'info');
      expect(console.log).toHaveBeenCalledWith('[Tree Packer] test message');
    });

    it('should use default info level when not specified', () => {
      logger.log('test message');
      expect(console.log).toHaveBeenCalledWith('[Tree Packer] test message');
    });

    it('should not append to debug element when not set', () => {
      logger.log('test message', 'info');
      expect(mockDebugElement.appendChild).not.toHaveBeenCalled();
    });

    it('should append to debug element when set', () => {
      logger.setDebugElement(mockDebugElement);
      logger.log('test message', 'info');

      expect(mockDebugElement.appendChild).toHaveBeenCalled();
      const appendedElement = mockDebugElement.appendChild.mock.calls[0][0];

      expect(appendedElement.tagName).toBe('DIV');
      expect(appendedElement.className).toBe('log-line log-info');
      expect(appendedElement.textContent).toMatch(/^\[\d{1,2}:\d{2}:\d{2} [ap]m\] test message$/);
    });

    it('should scroll debug element to bottom after logging', () => {
      logger.setDebugElement(mockDebugElement);
      logger.log('test message', 'info');

      expect(mockDebugElement.scrollTop).toBe(mockDebugElement.scrollHeight);
    });

    it('should handle different log levels with correct CSS classes', () => {
      logger.setDebugElement(mockDebugElement);

      logger.log('info message', 'info');
      expect(mockDebugElement.appendChild.mock.calls[0][0].className).toBe('log-line log-info');

      logger.log('success message', 'success');
      expect(mockDebugElement.appendChild.mock.calls[1][0].className).toBe('log-line log-success');

      logger.log('warning message', 'warn');
      expect(mockDebugElement.appendChild.mock.calls[2][0].className).toBe('log-line log-warn');

      logger.log('error message', 'error');
      expect(mockDebugElement.appendChild.mock.calls[3][0].className).toBe('log-line log-error');
    });
  });
});
