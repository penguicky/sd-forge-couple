/**
 * Event Bridge for communication between React (lobe-theme) and vanilla JavaScript (forge-couple)
 * Provides a singleton event bus for cross-context communication
 */

// Guard: Don't load if bundle version is already available
if (window.EventBridge) {
  console.log(
    "[EventBridge] Bundle version already loaded, skipping standalone version"
  );
} else {
  class EventBridge extends EventTarget {
    constructor() {
      super();
      this.debugMode = false;
      this.eventHistory = [];
      this.maxHistorySize = 100;
    }

    /**
     * Get singleton instance
     * @returns {EventBridge} Singleton instance
     */
    static getInstance() {
      if (!window.__forgeCoupleEventBridge) {
        window.__forgeCoupleEventBridge = new EventBridge();
      }
      return window.__forgeCoupleEventBridge;
    }

    /**
     * Emit custom event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @param {Object} options - Event options
     */
    emit(eventType, data = null, options = {}) {
      const eventData = {
        type: eventType,
        data: data,
        timestamp: Date.now(),
        source: options.source || "unknown",
        ...options,
      };

      // Log event if debug mode is enabled
      if (this.debugMode) {
        console.log(`[EventBridge] Emitting: ${eventType}`, eventData);
      }

      // Add to history
      this.addToHistory(eventData);

      // Create and dispatch custom event
      const customEvent = new CustomEvent(eventType, {
        detail: eventData,
        bubbles: options.bubbles !== false,
        cancelable: options.cancelable !== false,
      });

      this.dispatchEvent(customEvent);

      // Also emit on window for global listeners
      if (options.global !== false) {
        window.dispatchEvent(
          new CustomEvent(`forge-couple:${eventType}`, {
            detail: eventData,
            bubbles: false,
            cancelable: false,
          })
        );
      }
    }

    /**
     * Listen for events
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    on(eventType, handler, options = {}) {
      const wrappedHandler = (event) => {
        if (this.debugMode) {
          console.log(`[EventBridge] Received: ${eventType}`, event.detail);
        }
        handler(event);
      };

      this.addEventListener(eventType, wrappedHandler, options);

      // Return unsubscribe function
      return () => {
        this.removeEventListener(eventType, wrappedHandler);
      };
    }

    /**
     * Listen for events once
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    once(eventType, handler, options = {}) {
      const wrappedHandler = (event) => {
        if (this.debugMode) {
          console.log(
            `[EventBridge] Received (once): ${eventType}`,
            event.detail
          );
        }
        handler(event);
        this.removeEventListener(eventType, wrappedHandler);
      };

      this.addEventListener(eventType, wrappedHandler, options);

      // Return unsubscribe function
      return () => {
        this.removeEventListener(eventType, wrappedHandler);
      };
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     */
    off(eventType, handler) {
      this.removeEventListener(eventType, handler);
    }

    /**
     * Add event to history
     * @param {Object} eventData - Event data
     */
    addToHistory(eventData) {
      this.eventHistory.push(eventData);

      // Maintain history size limit
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    }

    /**
     * Get event history
     * @param {string} eventType - Optional event type filter
     * @returns {Array} Event history
     */
    getHistory(eventType = null) {
      if (eventType) {
        return this.eventHistory.filter((event) => event.type === eventType);
      }
      return [...this.eventHistory];
    }

    /**
     * Clear event history
     */
    clearHistory() {
      this.eventHistory = [];
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode enabled
     */
    setDebugMode(enabled) {
      this.debugMode = enabled;
      console.log(
        `[EventBridge] Debug mode ${enabled ? "enabled" : "disabled"}`
      );
    }

    /**
     * Get statistics about event usage
     * @returns {Object} Event statistics
     */
    getStats() {
      const eventTypes = {};
      this.eventHistory.forEach((event) => {
        eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
      });

      return {
        totalEvents: this.eventHistory.length,
        eventTypes: eventTypes,
        historySize: this.eventHistory.length,
        maxHistorySize: this.maxHistorySize,
      };
    }

    /**
     * Wait for specific event
     * @param {string} eventType - Event type to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Promise that resolves with event data
     */
    waitFor(eventType, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.removeEventListener(eventType, handler);
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);

        const handler = (event) => {
          clearTimeout(timer);
          this.removeEventListener(eventType, handler);
          resolve(event.detail);
        };

        this.addEventListener(eventType, handler);
      });
    }

    /**
     * Emit event and wait for response
     * @param {string} requestType - Request event type
     * @param {string} responseType - Response event type
     * @param {*} data - Request data
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Promise that resolves with response data
     */
    async request(requestType, responseType, data = null, timeout = 5000) {
      const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Emit request with unique ID
      this.emit(requestType, { ...data, requestId }, { source: "request" });

      // Wait for response with matching request ID
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.removeEventListener(responseType, handler);
          reject(new Error(`Timeout waiting for response: ${responseType}`));
        }, timeout);

        const handler = (event) => {
          if (event.detail.data && event.detail.data.requestId === requestId) {
            clearTimeout(timer);
            this.removeEventListener(responseType, handler);
            resolve(event.detail.data);
          }
        };

        this.addEventListener(responseType, handler);
      });
    }

    /**
     * Destroy the event bridge and clean up
     */
    destroy() {
      this.clearHistory();

      // Remove all listeners (this is a simplified cleanup)
      // In a real implementation, you'd want to track listeners more carefully
      console.log("[EventBridge] Event bridge destroyed");

      // Remove from window
      if (window.__forgeCoupleEventBridge === this) {
        delete window.__forgeCoupleEventBridge;
      }
    }
  }

  // Expose class globally if not already available
  if (!window.EventBridge) {
    window.EventBridge = EventBridge;
  }
} // End of guard
