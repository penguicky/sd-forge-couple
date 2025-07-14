/**
 * Resource Manager for proper cleanup and memory management
 * Prevents memory leaks in Shadow DOM environment
 */
class ResourceManager {
  constructor() {
    this.listeners = new Map();
    this.timers = new Set();
    this.observers = new Set();
    this.intervals = new Set();
    this.animationFrames = new Set();
  }

  /**
   * Add event listener with automatic cleanup tracking
   * @param {Element} element - DOM element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element || typeof handler !== "function") {
      console.warn(
        "[ResourceManager] Invalid element or handler for addEventListener"
      );
      return;
    }

    element.addEventListener(event, handler, options);

    // Track for cleanup
    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }

    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(event)) {
      elementListeners.set(event, []);
    }

    elementListeners.get(event).push({ handler, options });
  }

  /**
   * Remove specific event listener
   * @param {Element} element - DOM element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   */
  removeEventListener(element, event, handler) {
    if (!element || !this.listeners.has(element)) {
      return;
    }

    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(event)) {
      return;
    }

    const eventHandlers = elementListeners.get(event);
    const index = eventHandlers.findIndex((item) => item.handler === handler);

    if (index !== -1) {
      element.removeEventListener(event, handler);
      eventHandlers.splice(index, 1);

      // Clean up empty arrays
      if (eventHandlers.length === 0) {
        elementListeners.delete(event);
      }

      if (elementListeners.size === 0) {
        this.listeners.delete(element);
      }
    }
  }

  /**
   * Set timeout with automatic cleanup tracking
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   */
  setTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);

    this.timers.add(timerId);
    return timerId;
  }

  /**
   * Clear specific timeout
   * @param {number} timerId - Timer ID
   */
  clearTimeout(timerId) {
    if (this.timers.has(timerId)) {
      clearTimeout(timerId);
      this.timers.delete(timerId);
    }
  }

  /**
   * Set interval with automatic cleanup tracking
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Interval ID
   */
  setInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    this.intervals.add(intervalId);
    return intervalId;
  }

  /**
   * Clear specific interval
   * @param {number} intervalId - Interval ID
   */
  clearInterval(intervalId) {
    if (this.intervals.has(intervalId)) {
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
    }
  }

  /**
   * Request animation frame with automatic cleanup tracking
   * @param {Function} callback - Callback function
   * @returns {number} Animation frame ID
   */
  requestAnimationFrame(callback) {
    const frameId = requestAnimationFrame(() => {
      this.animationFrames.delete(frameId);
      callback();
    });

    this.animationFrames.add(frameId);
    return frameId;
  }

  /**
   * Cancel specific animation frame
   * @param {number} frameId - Animation frame ID
   */
  cancelAnimationFrame(frameId) {
    if (this.animationFrames.has(frameId)) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(frameId);
    }
  }

  /**
   * Add observer with automatic cleanup tracking
   * @param {Object} observer - Observer instance (MutationObserver, IntersectionObserver, etc.)
   */
  addObserver(observer) {
    if (observer && typeof observer.disconnect === "function") {
      this.observers.add(observer);
    }
  }

  /**
   * Remove specific observer
   * @param {Object} observer - Observer instance
   */
  removeObserver(observer) {
    if (this.observers.has(observer)) {
      observer.disconnect();
      this.observers.delete(observer);
    }
  }

  /**
   * Clean up all tracked resources
   */
  cleanup() {
    // Remove all event listeners
    this.listeners.forEach((events, element) => {
      events.forEach((handlers, event) => {
        handlers.forEach(({ handler }) => {
          element.removeEventListener(event, handler);
        });
      });
    });
    this.listeners.clear();

    // Clear all timers
    this.timers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    this.timers.clear();

    // Clear all intervals
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    // Cancel all animation frames
    this.animationFrames.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    this.animationFrames.clear();

    // Disconnect all observers
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers.clear();
  }

  /**
   * Get current resource usage statistics
   * @returns {Object} Resource usage stats
   */
  getStats() {
    return {
      listeners: this.listeners.size,
      timers: this.timers.size,
      intervals: this.intervals.size,
      animationFrames: this.animationFrames.size,
      observers: this.observers.size,
    };
  }
}
