/**
 * Backend Bridge for forge-couple Shadow DOM implementation
 * Handles direct API communication without relying on Gradio components
 */

// Guard: Don't load if bundle version is already available
if (window.BackendBridge) {
  console.log(
    "[BackendBridge] Bundle version already loaded, skipping standalone version"
  );
} else {
  class BackendBridge {
    constructor() {
      this.baseUrl = window.location.origin;
      this.apiEndpoint = "/sdapi/v1/forge-couple";
      this.wsEndpoint = null;
      this.websocket = null;
      this.eventBridge = EventBridge.getInstance();
      this.requestQueue = new Map();
      this.retryAttempts = 3;
      this.retryDelay = 1000;

      // Don't auto-connect WebSocket to avoid errors
      // this.setupWebSocket();
      console.log(
        "[BackendBridge] Standalone version loaded (WebSocket disabled)"
      );
    }

    /**
     * Generate with regions using direct API call
     * @param {Array} regions - Region configuration
     * @param {string} globalPrompt - Global prompt text
     * @param {Object} settings - Generation settings
     * @returns {Promise} Generation result
     */
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
        console.log("[BackendBridge] Sending generation request:", requestData);

        const response = await this.makeRequest(
          "POST",
          this.apiEndpoint,
          requestData
        );

        // Emit success event
        this.eventBridge.emit("generation:success", {
          result: response,
          regions: regions,
          timestamp: Date.now(),
        });

        return response;
      } catch (error) {
        console.error("[BackendBridge] Generation failed:", error);

        // Emit error event
        this.eventBridge.emit("generation:error", {
          error: error.message,
          regions: regions,
          timestamp: Date.now(),
        });

        throw error;
      }
    }

    /**
     * Get current generation progress
     * @returns {Promise} Progress information
     */
    async getProgress() {
      try {
        const response = await this.makeRequest("GET", "/sdapi/v1/progress");
        return response;
      } catch (error) {
        console.error("[BackendBridge] Failed to get progress:", error);
        return null;
      }
    }

    /**
     * Get available models
     * @returns {Promise} List of available models
     */
    async getModels() {
      try {
        const response = await this.makeRequest("GET", "/sdapi/v1/sd-models");
        return response;
      } catch (error) {
        console.error("[BackendBridge] Failed to get models:", error);
        return [];
      }
    }

    /**
     * Get available samplers
     * @returns {Promise} List of available samplers
     */
    async getSamplers() {
      try {
        const response = await this.makeRequest("GET", "/sdapi/v1/samplers");
        return response;
      } catch (error) {
        console.error("[BackendBridge] Failed to get samplers:", error);
        return [];
      }
    }

    /**
     * Validate region configuration
     * @param {Array} regions - Regions to validate
     * @returns {Promise} Validation result
     */
    async validateRegions(regions) {
      const requestData = {
        regions: regions.map((r) => ({
          bbox: [r.x1, r.y1, r.x2, r.y2],
          weight: r.weight,
          prompt: r.prompt,
        })),
      };

      try {
        const response = await this.makeRequest(
          "POST",
          `${this.apiEndpoint}/validate`,
          requestData
        );
        return response;
      } catch (error) {
        console.error("[BackendBridge] Validation failed:", error);
        return { valid: false, errors: [error.message] };
      }
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @returns {Promise} Response data
     */
    async makeRequest(method, endpoint, data = null) {
      const url = `${this.baseUrl}${endpoint}`;
      const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const options = {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
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
          console.log(
            `[BackendBridge] Request attempt ${attempt}/${this.retryAttempts}: ${method} ${url}`
          );

          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          // Emit request success event
          this.eventBridge.emit("api:request:success", {
            method,
            endpoint,
            requestId,
            attempt,
            result,
          });

          return result;
        } catch (error) {
          lastError = error;
          console.warn(
            `[BackendBridge] Request attempt ${attempt} failed:`,
            error.message
          );

          // Emit request error event
          this.eventBridge.emit("api:request:error", {
            method,
            endpoint,
            requestId,
            attempt,
            error: error.message,
          });

          // Wait before retry (except on last attempt)
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }

      throw lastError;
    }

    /**
     * Set up WebSocket connection for real-time updates
     */
    setupWebSocket() {
      // Determine WebSocket URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/forge-couple`;

      try {
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          console.log("[BackendBridge] WebSocket connected");
          this.eventBridge.emit("websocket:connected", {
            timestamp: Date.now(),
          });
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error(
              "[BackendBridge] Failed to parse WebSocket message:",
              error
            );
          }
        };

        this.websocket.onclose = (event) => {
          console.log(
            "[BackendBridge] WebSocket disconnected:",
            event.code,
            event.reason
          );
          this.eventBridge.emit("websocket:disconnected", {
            code: event.code,
            reason: event.reason,
            timestamp: Date.now(),
          });

          // Attempt to reconnect after delay
          setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.websocket.onerror = (error) => {
          console.error("[BackendBridge] WebSocket error:", error);
          this.eventBridge.emit("websocket:error", {
            error: error.message,
            timestamp: Date.now(),
          });
        };
      } catch (error) {
        console.error("[BackendBridge] Failed to create WebSocket:", error);
      }
    }

    /**
     * Handle incoming WebSocket messages
     * @param {Object} data - Message data
     */
    handleWebSocketMessage(data) {
      console.log("[BackendBridge] WebSocket message received:", data);

      switch (data.type) {
        case "generation_progress":
          this.eventBridge.emit("generation:progress", data);
          break;
        case "generation_complete":
          this.eventBridge.emit("generation:complete", data);
          break;
        case "generation_error":
          this.eventBridge.emit("generation:error", data);
          break;
        case "model_changed":
          this.eventBridge.emit("model:changed", data);
          break;
        default:
          this.eventBridge.emit("websocket:message", data);
          break;
      }
    }

    /**
     * Send message via WebSocket
     * @param {Object} message - Message to send
     */
    sendWebSocketMessage(message) {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(message));
      } else {
        console.warn(
          "[BackendBridge] WebSocket not connected, cannot send message"
        );
      }
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Clean up resources
     */
    destroy() {
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      this.requestQueue.clear();

      console.log("[BackendBridge] Backend bridge destroyed");
    }
  }

  // Expose class globally if not already available
  if (!window.BackendBridge) {
    window.BackendBridge = BackendBridge;
  }
} // End of guard
