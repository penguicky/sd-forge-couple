/**
 * Shadow DOM Bundle for forge-couple lobe-theme integration
 * Contains all required classes in a single file to avoid loading issues
 */
(function () {
  "use strict";

  // Check if already loaded
  if (window.ResourceManager && window.EventBridge && window.BackendBridge) {
    return;
  }

  /**
   * Resource Manager for proper cleanup and memory management
   */
  class ResourceManager {
    constructor() {
      this.listeners = new Map();
      this.timers = new Set();
      this.observers = new Set();
      this.intervals = new Set();
      this.animationFrames = new Set();
    }

    addEventListener(element, event, handler, options = {}) {
      if (!element || typeof handler !== "function") {
        console.warn(
          "[ResourceManager] Invalid element or handler for addEventListener"
        );
        return;
      }

      element.addEventListener(event, handler, options);

      if (!this.listeners.has(element)) {
        this.listeners.set(element, new Map());
      }

      const elementListeners = this.listeners.get(element);
      if (!elementListeners.has(event)) {
        elementListeners.set(event, []);
      }

      elementListeners.get(event).push({ handler, options });
    }

    setTimeout(callback, delay) {
      const timerId = setTimeout(() => {
        this.timers.delete(timerId);
        callback();
      }, delay);

      this.timers.add(timerId);
      return timerId;
    }

    cleanup() {
      this.listeners.forEach((events, element) => {
        events.forEach((handlers, event) => {
          handlers.forEach(({ handler }) => {
            element.removeEventListener(event, handler);
          });
        });
      });
      this.listeners.clear();

      this.timers.forEach((timerId) => clearTimeout(timerId));
      this.timers.clear();

      this.intervals.forEach((intervalId) => clearInterval(intervalId));
      this.intervals.clear();

      this.animationFrames.forEach((frameId) => cancelAnimationFrame(frameId));
      this.animationFrames.clear();

      this.observers.forEach((observer) => observer.disconnect());
      this.observers.clear();
    }
  }

  /**
   * Event Bridge for communication between React and vanilla JavaScript
   */
  class EventBridge extends EventTarget {
    constructor() {
      super();
      this.debugMode = false;
      this.eventHistory = [];
      this.maxHistorySize = 100;
    }

    static getInstance() {
      if (!window.__forgeCoupleEventBridge) {
        window.__forgeCoupleEventBridge = new EventBridge();
      }
      return window.__forgeCoupleEventBridge;
    }

    emit(eventType, data = null, options = {}) {
      const eventData = {
        type: eventType,
        data: data,
        timestamp: Date.now(),
        source: options.source || "unknown",
        ...options,
      };

      if (this.debugMode) {
      }

      this.addToHistory(eventData);

      const customEvent = new CustomEvent(eventType, {
        detail: eventData,
        bubbles: options.bubbles !== false,
        cancelable: options.cancelable !== false,
      });

      this.dispatchEvent(customEvent);

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

    on(eventType, handler, options = {}) {
      const wrappedHandler = (event) => {
        if (this.debugMode) {
        }
        handler(event);
      };

      this.addEventListener(eventType, wrappedHandler, options);

      return () => {
        this.removeEventListener(eventType, wrappedHandler);
      };
    }

    addToHistory(eventData) {
      this.eventHistory.push(eventData);
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    }

    setDebugMode(enabled) {
      this.debugMode = enabled;
    }
  }

  /**
   * Backend Bridge for direct API communication
   */
  class BackendBridge {
    constructor() {
      this.baseUrl = window.location.origin;
      this.apiEndpoint = "/sdapi/v1/forge-couple";
      this.eventBridge = EventBridge.getInstance();
      this.retryAttempts = 3;
      this.retryDelay = 1000;
    }

    async generateWithRegions(regions, globalPrompt, settings = {}) {
      const requestData = {
        regions: regions.map((r) => ({
          bbox: [r.x1, r.y1, r.x2, r.y2],
          weight: r.weight,
          prompt: r.prompt || globalPrompt,
        })),
        global_prompt: globalPrompt,
        settings: {
          width: settings.width || 512,
          height: settings.height || 512,
          steps: settings.steps || 20,
          cfg_scale: settings.cfg_scale || 7.0,
          sampler_name: settings.sampler_name || "Euler a",
          ...settings,
        },
        timestamp: Date.now(),
      };

      try {
        const response = await this.makeRequest(
          "POST",
          this.apiEndpoint,
          requestData
        );

        this.eventBridge.emit("generation:success", {
          result: response,
          regions: regions,
          timestamp: Date.now(),
        });

        return response;
      } catch (error) {
        console.error("[BackendBridge] Generation failed:", error);

        this.eventBridge.emit("generation:error", {
          error: error.message,
          regions: regions,
          timestamp: Date.now(),
        });

        throw error;
      }
    }

    async makeRequest(method, endpoint, data = null) {
      const url = `${this.baseUrl}${endpoint}`;
      const options = {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (
        data &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        options.body = JSON.stringify(data);
      }

      let lastError;

      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          return result;
        } catch (error) {
          lastError = error;
          console.warn(
            `[BackendBridge] Request attempt ${attempt} failed:`,
            error.message
          );

          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }

      throw lastError;
    }

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  // Expose classes globally
  window.ResourceManager = ResourceManager;
  window.EventBridge = EventBridge;
  window.BackendBridge = BackendBridge;
})();
