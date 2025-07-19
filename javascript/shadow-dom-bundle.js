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

  /**
   * Direct Interface for forge-couple backend communication
   * Provides direct object manipulation instead of DOM updates
   */
  class ForgeCoupleDirectInterface {
    constructor(mode) {
      this.mode = mode; // 't2i' or 'i2i'
      this.isReady = false;

      // Ensure ForgeCouple global exists immediately
      this.ensureForgeCouple();

      // Initialize interface immediately
      this.initializeInterface();
    }

    /**
     * Ensure ForgeCouple global object exists
     */
    ensureForgeCouple() {
      if (!window.ForgeCouple) {
        this.createMinimalForgeCouple();
      }
    }

    /**
     * Initialize interface immediately
     */
    initializeInterface() {
      // Ensure ForgeCouple structure is complete
      this.createMinimalForgeCouple();

      // Mark as ready immediately
      this.isReady = true;
    }

    /**
     * Create minimal ForgeCouple structure for direct interface operation
     */
    createMinimalForgeCouple() {
      // Only create if it doesn't exist, or enhance existing structure
      if (!window.ForgeCouple) {
        window.ForgeCouple = {};
      }

      // Ensure dataframe structure exists
      if (!window.ForgeCouple.dataframe) {
        window.ForgeCouple.dataframe = {};
      }

      // Ensure mode-specific dataframes exist
      if (!window.ForgeCouple.dataframe.t2i) {
        window.ForgeCouple.dataframe.t2i = { body: document.createElement('tbody') };
      }
      if (!window.ForgeCouple.dataframe.i2i) {
        window.ForgeCouple.dataframe.i2i = { body: document.createElement('tbody') };
      }

      // Ensure entryField structure exists
      if (!window.ForgeCouple.entryField) {
        window.ForgeCouple.entryField = {
          t2i: document.createElement('input'),
          i2i: document.createElement('input')
        };
      }

      // Ensure methods exist (silent to prevent feedback loops)
      if (!window.ForgeCouple.onEntry) {
        window.ForgeCouple.onEntry = () => {
          // Silent operation to prevent feedback loops
        };
      }
      if (!window.ForgeCouple.preview) {
        window.ForgeCouple.preview = () => {
          // Silent operation to prevent feedback loops
        };
      }
    }

    /**
     * Update regions directly in ForgeCouple
     * @param {Array} regions - Array of region objects with x1, y1, x2, y2, weight, prompt
     * @returns {boolean} Success status
     */
    updateRegions(regions) {
      if (!this.isReady) {
        return false;
      }

      try {
        const fc = window.ForgeCouple;
        const dataframe = fc.dataframe[this.mode];

        if (!dataframe || !dataframe.body) {
          return false;
        }

        // Update the dataframe directly
        this.updateDataframe(dataframe, regions);

        // Update the JSON data in the entry field
        if (fc.entryField && fc.entryField[this.mode]) {
          const mappingData = regions.map(r => [
            parseFloat(r.x1.toFixed(2)),
            parseFloat(r.x2.toFixed(2)),
            parseFloat(r.y1.toFixed(2)),
            parseFloat(r.y2.toFixed(2)),
            parseFloat(r.weight.toFixed(1))
          ]);

          fc.entryField[this.mode].value = JSON.stringify(mappingData);

          // Trigger the update - using the updateInput function if available
          if (window.updateInput) {
            window.updateInput(fc.entryField[this.mode]);
          } else {
            fc.entryField[this.mode].dispatchEvent(new Event('input', { bubbles: true }));
            fc.entryField[this.mode].dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Call ForgeCouple's update methods (silent to prevent feedback loops)
        if (fc.onEntry && typeof fc.onEntry === 'function') {
          fc.onEntry(this.mode);
        }

        // Trigger preview update (silent to prevent feedback loops)
        if (fc.preview && typeof fc.preview === 'function') {
          fc.preview(this.mode);
        }

        // Update the mapping component if it exists
        this.updateMappingComponent(regions);

        // Update prompts in the main prompt field
        this.updatePromptField(regions);

        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Update the dataframe tbody directly
     * @param {Object} dataframe - ForgeCouple dataframe instance
     * @param {Array} regions - Region data
     */
    updateDataframe(dataframe, regions) {
      const tbody = dataframe.body;

      // Store active element to restore focus
      const activeElement = document.activeElement;
      const activeId = activeElement ? activeElement.id : null;

      // Clear existing rows
      while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
      }

      // Add new rows
      regions.forEach((region, index) => {
        const tr = tbody.insertRow();

        // Add coordinate cells
        const coords = [
          region.x1.toFixed(2),
          region.x2.toFixed(2),
          region.y1.toFixed(2),
          region.y2.toFixed(2),
          region.weight.toFixed(1)
        ];

        coords.forEach((value) => {
          const td = tr.insertCell();
          td.contentEditable = true;
          td.textContent = value;

          // Add event listeners matching original behavior
          td.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              td.blur();
            }
          });

          td.addEventListener('blur', () => {
            // Call dataframe's submit handler
            if (dataframe.onSubmit) {
              dataframe.onSubmit(td, false);
            }
          });

          td.onclick = () => {
            if (dataframe.onSelect) {
              dataframe.onSelect(index);
            }
          };
        });

        // Add prompt cell
        const promptTd = tr.insertCell();
        promptTd.contentEditable = true;
        promptTd.textContent = region.prompt || '';

        promptTd.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            promptTd.blur();
          }
        });

        promptTd.addEventListener('blur', () => {
          if (dataframe.onSubmit) {
            dataframe.onSubmit(promptTd, true);
          }
        });

        promptTd.onclick = () => {
          if (dataframe.onSelect) {
            dataframe.onSelect(index);
          }
        };
      });

      // Restore focus if needed
      if (activeId && activeElement) {
        const newActive = document.getElementById(activeId);
        if (newActive) {
          newActive.focus();
        }
      }
    }

    /**
     * Update the hidden mapping component used by the backend
     * @param {Array} regions - Region data
     */
    updateMappingComponent(regions) {
      try {
        const accordion = document.querySelector(`#forge_couple_${this.mode}`);
        if (!accordion) return;

        // Find the JSON component (hidden input)
        const jsonComponents = accordion.querySelectorAll('textarea[data-testid*="json"], input[type="hidden"]');

        const mappingData = regions.map(r => [
          parseFloat(r.x1.toFixed(2)),
          parseFloat(r.x2.toFixed(2)),
          parseFloat(r.y1.toFixed(2)),
          parseFloat(r.y2.toFixed(2)),
          parseFloat(r.weight.toFixed(1))
        ]);

        jsonComponents.forEach(component => {
          if (component.value && (component.value.includes('[[') || component.value === '[]')) {
            component.value = JSON.stringify(mappingData);

            // Trigger Gradio update if needed
            if (component._gradio_component) {
              component._gradio_component.value = mappingData;
            }
          }
        });
      } catch (error) {
        // Silent fail - mapping component update not critical
      }
    }

    /**
     * Update the main prompt field with region prompts
     * @param {Array} regions - Region data
     */
    updatePromptField(regions) {
      try {
        // Get the couple separator
        const separatorInput = document.querySelector('.fc_separator input') ||
                              document.querySelector('input[data-testid="forge_couple_separator"]');
        const separator = separatorInput ? separatorInput.value || '\n' : '\n';

        // Get prompt field
        const promptField = document.querySelector(
          `#${this.mode === 't2i' ? 'txt' : 'img'}2img_prompt textarea`
        );

        if (promptField) {
          // Check for background mode
          const backgroundRadio = document.querySelector(`#forge_couple_${this.mode} .fc_global_effect input:checked`);
          const background = backgroundRadio ? backgroundRadio.value : 'None';

          let prompts = regions.map(r => r.prompt);

          // Handle background modes
          if (background === 'First Line') {
            const existingPrompts = promptField.value.split(separator);
            if (existingPrompts.length > 0) {
              prompts.unshift(existingPrompts[0]);
            }
          } else if (background === 'Last Line') {
            const existingPrompts = promptField.value.split(separator);
            if (existingPrompts.length > 0) {
              prompts.push(existingPrompts[existingPrompts.length - 1]);
            }
          }

          promptField.value = prompts.join(separator);

          // Trigger update
          if (window.updateInput) {
            window.updateInput(promptField);
          } else {
            promptField.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      } catch (error) {
        // Silent fail - prompt field update not critical
      }
    }

    /**
     * Get current regions from ForgeCouple
     * @returns {Array} Array of region objects
     */
    getRegions() {
      if (!this.isReady) return [];

      try {
        const fc = window.ForgeCouple;
        const dataframe = fc.dataframe[this.mode];

        if (!dataframe || !dataframe.body) return [];

        const rows = dataframe.body.querySelectorAll('tr');
        const regions = [];

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            regions.push({
              x1: parseFloat(cells[0].textContent) || 0,
              x2: parseFloat(cells[1].textContent) || 1,
              y1: parseFloat(cells[2].textContent) || 0,
              y2: parseFloat(cells[3].textContent) || 1,
              weight: parseFloat(cells[4].textContent) || 1,
              prompt: cells[5].textContent || ''
            });
          }
        });

        return regions;
      } catch (error) {
        return [];
      }
    }

    /**
     * Check if ForgeCouple is in Advanced mode
     * @returns {boolean}
     */
    isAdvancedMode() {
      try {
        const accordion = document.querySelector(`#forge_couple_${this.mode}`);
        if (!accordion) return false;

        const modeRadio = accordion.querySelector('input[type="radio"][value="Advanced"]:checked');
        return !!modeRadio;
      } catch (error) {
        return false;
      }
    }

    /**
     * Clean up resources
     */
    destroy() {
      this.isReady = false;
    }
  }

  // Expose classes globally
  window.ResourceManager = ResourceManager;
  window.EventBridge = EventBridge;
  window.BackendBridge = BackendBridge;
  window.ForgeCoupleDirectInterface = ForgeCoupleDirectInterface;
})();
