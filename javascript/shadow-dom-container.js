/**
 * Shadow DOM Container for forge-couple Advanced Mode
 * Provides complete isolation from lobe-theme's React virtual DOM
 */
(function () {
  "use strict";

  // Guard against multiple loading
  if (window.ForgeCoupleAdvancedShadowContainer) {
    return;
  }

  class ForgeCoupleAdvancedShadowContainer {
    constructor(hostElement, mode) {
      this.hostElement = hostElement;
      this.mode = mode; // "t2i" or "i2i"
      this.shadowRoot = null;
      this.forgeCoupleInstance = null;
      this.eventBridge = null;
      this.resourceManager = new ResourceManager();

      this.init();
    }

    async init() {
      try {
        // Create shadow root for complete isolation
        this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

        // Set up event bridge for React communication
        this.eventBridge = EventBridge.getInstance();

        // Load and inject styles and HTML template
        await this.loadTemplate();

        // Initialize forge-couple instance within shadow DOM
        this.initializeForgeCouple();

        // Set up communication bridges
        this.setupCommunicationBridges();
      } catch (error) {
        console.error(
          `[ForgeCouple] Failed to initialize shadow container:`,
          error
        );
      }
    }

    async loadTemplate() {
      // Inject isolated styles
      const styleElement = document.createElement("style");
      styleElement.textContent = this.getIsolatedStyles();
      this.shadowRoot.appendChild(styleElement);

      // Create HTML structure
      const containerDiv = document.createElement("div");
      containerDiv.className = "forge-couple-container";
      containerDiv.innerHTML = this.getHTMLTemplate();
      this.shadowRoot.appendChild(containerDiv);
    }

    getIsolatedStyles() {
      return `
            /* Reset and base styles for complete isolation */
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            .forge-couple-container {
                display: flex;
                flex-direction: column;
                gap: 20px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                color: #333;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .canvas-section {
                position: relative;
                min-height: 400px;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .region-canvas {
                width: 100%;
                height: 400px;
                border: 2px solid #ddd;
                border-radius: 4px;
                background: #f8f9fa;
                cursor: crosshair;
                position: relative;
                overflow: hidden;
            }
            
            .region-canvas:hover {
                border-color: #007bff;
            }
            
            .bounding-box {
                position: absolute;
                border: 2px solid;
                background: rgba(0, 123, 255, 0.1);
                pointer-events: none;
                z-index: 10;
            }
            
            .bounding-box.selected {
                background: rgba(0, 123, 255, 0.2);
                box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.5);
            }
            
            .resize-handle {
                position: absolute;
                width: 8px;
                height: 8px;
                background: #007bff;
                border: 1px solid #fff;
                border-radius: 50%;
                z-index: 11;
            }
            
            .resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
            .resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
            .resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
            .resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
            .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
            .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
            .resize-handle.w { top: 50%; left: -4px; transform: translateY(-50%); cursor: w-resize; }
            .resize-handle.e { top: 50%; right: -4px; transform: translateY(-50%); cursor: e-resize; }
            
            .controls-section {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .region-table-container {
                width: 100%;
                overflow-y: auto;
                max-height: 500px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            
            .region-table {
                width: 100%;
                border-collapse: collapse;
                background: #fff;
                font-size: 12px;
                font-family: inherit;
            }

            .region-table th {
                padding: 8px 6px;
                text-align: center;
                border: 1px solid #ddd;
                background: #f8f9fa;
                font-weight: 600;
                color: #555;
                font-size: 11px;
                position: sticky;
                top: 0;
                z-index: 5;
            }

            .region-table td {
                padding: 6px;
                text-align: center;
                border: 1px solid #ddd;
                position: relative;
            }

            .region-table td.coordinate {
                width: 60px;
                font-size: 11px;
            }

            .region-table td.weight {
                width: 50px;
                font-size: 11px;
            }

            .region-table td.prompt {
                text-align: left;
                padding-left: 12px;
                font-size: 12px;
                min-width: 300px;
            }

            .region-table tr:hover {
                background: #f8f9fa;
            }

            .region-table tr.selected {
                background: #e3f2fd;
                border: 3px solid transparent;
                box-sizing: border-box;
            }
            
            .region-table input {
                background: #fff;
                border: 1px solid #ccc;
                color: #333;
                width: 100%;
                text-align: inherit;
                font-family: inherit;
                font-size: inherit;
                border-radius: 3px;
                padding: 4px 6px;
                box-sizing: border-box;
            }

            .region-table input:focus {
                outline: none;
                border-color: #007bff !important;
                background: #fff;
                box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.5);
                z-index: 15;
                position: relative;
            }

            .region-table td.prompt {
                position: relative;
            }

            .region-table td.prompt input {
                padding: 8px 12px;
                min-height: 24px;
                font-size: 13px;
                line-height: 1.4;
                background: #fff;
                border: 2px solid #ddd;
                border-radius: 4px;
                margin: 2px 0;
            }

            .region-table td.prompt input:focus {
                border-color: #007bff !important;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.3);
                z-index: 20;
            }

            .region-table td.prompt input:hover {
                border-color: #999;
            }

            /* Remove spinner buttons from number inputs */
            .region-table input[type="number"]::-webkit-outer-spin-button,
            .region-table input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }

            .region-table input[type="number"] {
                -moz-appearance: textfield;
            }

            .row-menu {
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px;
                display: none;
                z-index: 10;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .row-menu button {
                display: block;
                width: 100%;
                padding: 4px 8px;
                margin: 2px 0;
                background: #f8f9fa;
                color: #333;
                border: 1px solid #ddd;
                border-radius: 2px;
                font-size: 10px;
                cursor: pointer;
                white-space: nowrap;
            }

            .row-menu button:hover {
                background: #007bff;
                color: #fff;
                border-color: #007bff;
            }

            .row-menu-trigger {
                position: absolute;
                right: 2px;
                top: 2px;
                bottom: 2px;
                width: 24px;
                background: transparent;
                cursor: pointer;
                border-radius: 2px;
                z-index: 5;
            }

            .row-menu-trigger:hover {
                background: rgba(0, 0, 0, 0.08);
            }
            
            .color-indicator {
                width: 20px;
                height: 20px;
                border-radius: 2px;
                border: 1px solid #ddd;
                display: inline-block;
            }

            .action-buttons {
                white-space: nowrap;
                text-align: center;
            }

            .action-buttons .btn {
                margin: 0 1px;
                padding: 2px 6px;
                font-size: 10px;
                min-width: 24px;
                height: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            
            .button-group {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 6px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fff;
                color: #333;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            
            .btn:hover {
                background: #f8f9fa;
                border-color: #007bff;
            }
            
            .btn:active {
                background: #e9ecef;
            }
            
            .btn.primary {
                background: #007bff;
                color: #fff;
                border-color: #007bff;
            }
            
            .btn.primary:hover {
                background: #0056b3;
            }
            
            .btn.danger {
                background: #dc3545;
                color: #fff;
                border-color: #dc3545;
            }
            
            .btn.danger:hover {
                background: #c82333;
            }
            
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
                margin-bottom: 16px;
            }
            
            .toolbar h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }
            
            .status-indicator {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
            }
            
            .status-indicator.active {
                background: #d4edda;
                color: #155724;
            }
            
            .status-indicator.inactive {
                background: #f8d7da;
                color: #721c24;
            }
        `;
    }

    getHTMLTemplate() {
      return `
            <div class="toolbar" style="display: none;">
                <h3>Advanced Mode - ${this.mode.toUpperCase()}</h3>
                <div class="status-indicator active">Active</div>
            </div>

            <div class="canvas-section">
                <canvas id="region-canvas" class="region-canvas"></canvas>
                <div id="canvas-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
            </div>

            <div class="controls-section">
                <div class="button-group">
                    <button class="btn" id="clear-all-btn">Clear All</button>
                    <button class="btn" id="reset-default-btn">Default Mapping</button>
                    <button class="btn" id="export-config-btn">Export Config</button>
                    <button class="btn" id="import-config-btn">Import Config</button>
                    <button class="btn debug" id="sync-backend-btn">🔄 Sync Backend</button>
                </div>

                <div class="region-table-container">
                    <table class="region-table" id="region-table">
                        <thead>
                            <tr>
                                <th class="coordinate">x1</th>
                                <th class="coordinate">x2</th>
                                <th class="coordinate">y1</th>
                                <th class="coordinate">y2</th>
                                <th class="weight">w</th>
                                <th class="prompt">Prompt</th>
                            </tr>
                        </thead>
                        <tbody id="region-tbody">
                            <!-- Regions will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    initializeForgeCouple() {
      // Initialize the forge-couple instance within shadow DOM
      this.forgeCoupleInstance = new ShadowForgeCouple(
        this.shadowRoot,
        this.mode
      );

      // Set up event listeners for UI interactions
      this.setupUIEventListeners();
    }

    setupUIEventListeners() {
      const shadowRoot = this.shadowRoot;

      // Clear all button
      const clearAllBtn = shadowRoot.getElementById("clear-all-btn");
      this.resourceManager.addEventListener(clearAllBtn, "click", () => {
        this.forgeCoupleInstance.clearAllRegions();
      });

      // Default mapping button (renamed from reset-default-btn)
      const resetDefaultBtn = shadowRoot.getElementById("reset-default-btn");
      this.resourceManager.addEventListener(resetDefaultBtn, "click", () => {
        this.forgeCoupleInstance.resetToDefault();
      });

      // Export/Import buttons
      const exportBtn = shadowRoot.getElementById("export-config-btn");
      const importBtn = shadowRoot.getElementById("import-config-btn");

      this.resourceManager.addEventListener(exportBtn, "click", () => {
        this.exportConfiguration();
      });

      this.resourceManager.addEventListener(importBtn, "click", () => {
        this.importConfiguration();
      });

      // Sync backend button (debug)
      const syncBackendBtn = shadowRoot.getElementById("sync-backend-btn");
      this.resourceManager.addEventListener(syncBackendBtn, "click", () => {
        this.forgeCoupleInstance.forceSyncToBackend();

        // Also log current state for debugging
        const regions = this.forgeCoupleInstance.getRegions();

        // Check if forge-couple components are found
        const accordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );

        if (accordion) {
          const inputs = accordion.querySelectorAll("input, textarea");

          inputs.forEach((input, i) => {
            const computedStyle = window.getComputedStyle(input);
          });

          // Show which components our sync logic found

          if (this.forgeCoupleInstance.mappingComponent) {
          }

          if (this.forgeCoupleInstance.entryField) {
          }
        }
      });
    }

    setupCommunicationBridges() {
      // Listen for updates from React/lobe-theme
      this.eventBridge.addEventListener("gradio:update", (event) => {
        this.handleGradioUpdate(event.detail);
      });

      // Listen for prompt changes
      this.eventBridge.addEventListener("prompt:change", (event) => {
        this.forgeCoupleInstance.updatePrompts(event.detail);
      });

      // Listen for dimension changes
      this.eventBridge.addEventListener("dimensions:change", (event) => {
        this.forgeCoupleInstance.updateDimensions(event.detail);
      });
    }

    handleGenerate() {
      const regions = this.forgeCoupleInstance.getRegions();

      // Emit generate event to React/backend
      this.eventBridge.emit("forge-couple:generate", {
        mode: this.mode,
        regions: regions,
        timestamp: Date.now(),
      });
    }

    handleGradioUpdate(data) {
      if (data.type === "preview_update") {
        this.forgeCoupleInstance.updatePreview(data.imageData);
      }
    }

    exportConfiguration() {
      const config = this.forgeCoupleInstance.exportConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `forge-couple-${this.mode}-config.json`;
      a.click();

      URL.revokeObjectURL(url);
    }

    importConfiguration() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const config = JSON.parse(e.target.result);
              this.forgeCoupleInstance.importConfig(config);
            } catch (error) {
              console.error(
                "[ForgeCouple] Failed to import configuration:",
                error
              );
            }
          };
          reader.readAsText(file);
        }
      };

      input.click();
    }

    destroy() {
      // Clean up resources
      this.resourceManager.cleanup();

      if (this.forgeCoupleInstance) {
        this.forgeCoupleInstance.destroy();
      }

      // Remove shadow root
      if (this.shadowRoot) {
        this.hostElement.removeChild(this.shadowRoot);
      }
    }
  }

  // Expose class globally
  window.ForgeCoupleAdvancedShadowContainer =
    ForgeCoupleAdvancedShadowContainer;
})();
