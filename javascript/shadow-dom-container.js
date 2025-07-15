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

      // Auto-update state management
      this.autoUpdateEnabled = true; // Default to enabled
      this.autoUpdateBtn = null;

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
                font-family: var(--font);
                font-size: var(--text-md);
                color: var(--body-text-color);
                background: var(--background-fill-secondary);
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                min-height: fit-content;
                width: 100%;
                position: relative;
            }
            
            .canvas-section {
                position: relative;
                min-height: 400px;
                max-height: 500px;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
                width: 100%;
                overflow: hidden;
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
                outline: none !important; /* Remove focus outline */
                box-shadow: none !important; /* Remove any box shadow */
            }

            .region-canvas:focus,
            .region-canvas:active,
            .region-canvas:hover {
                outline: none !important; /* Ensure no focus styling */
                border-color: #ddd !important; /* Keep original border color */
                box-shadow: none !important; /* Remove any highlight effects */
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
                max-height: 400px;
                min-height: 200px;
                border: 1px solid var(--border-color-primary);
                border-radius: var(--radius-md);
                flex-shrink: 0;
            }
            
            .region-table {
                width: 100%;
                border-collapse: collapse;
                background: var(--background-fill-secondary);
                font-size: var(--text-sm);
                font-family: inherit;
            }

            .region-table th {
                padding: 8px 6px;
                text-align: center;
                border: 1px solid var(--border-color-primary);
                background: var(--background-fill-primary);
                font-weight: 600;
                color: #000000 !important;
                font-size: var(--text-xs);
                font-family: var(--font);
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
                font-size: var(--text-xs);
            }

            .region-table td.weight {
                width: 50px;
                font-size: var(--text-xs);
            }

            .region-table td.prompt {
                text-align: left;
                padding-left: 12px;
                font-size: var(--text-sm);
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
                background: var(--background-fill-secondary);
                border: 1px solid var(--border-color-primary);
                color: var(--body-text-color);
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
                font-size: var(--text-sm);
                line-height: 1.4;
                background: var(--background-fill-secondary);
                border: 2px solid var(--border-color-primary);
                border-radius: 4px;
                margin: 2px 0;
                font-family: var(--font-mono);
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
                min-width: 120px;
                background: var(--background-fill-secondary);
                border: var(--button-border-width) solid var(--border-color-primary);
                border-radius: var(--radius-md);
                padding: var(--spacing-xs);
                display: none;
                z-index: 10;
                box-shadow: var(--shadow-drop-lg);
            }

            .row-menu button {
                display: block;
                width: 100%;
                padding: var(--spacing-xs) var(--spacing-sm);
                margin: var(--spacing-xxs) 0;
                background: var(--button-secondary-background-fill);
                color: #000000 !important;
                border: var(--button-border-width) solid var(--button-secondary-border-color);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-family: var(--font);
                cursor: pointer;
                white-space: nowrap;
                transition: var(--button-transition);
                text-align: left;
            }

            .row-menu button:hover {
                background: var(--button-secondary-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-secondary-border-color-hover);
            }

            .row-menu button:active {
                box-shadow: var(--button-shadow-active);
            }

            .row-menu-trigger {
                position: absolute;
                right: 2px;
                top: 2px;
                bottom: 2px;
                width: 24px;
                background: transparent;
                cursor: pointer;
                border-radius: var(--radius-xs);
                z-index: 5;
                border: none;
                transition: var(--button-transition);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .row-menu-trigger:hover {
                background: var(--button-secondary-background-fill-hover);
            }

            .row-menu-trigger:active {
                background: var(--button-secondary-background-fill);
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
                margin: 0 var(--spacing-xxs);
                padding: var(--spacing-xxs) var(--spacing-xs);
                font-size: var(--text-xxs);
                min-width: 24px;
                height: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--radius-xs);
                background: var(--button-secondary-background-fill);
                color: #000000 !important;
                border: var(--button-border-width) solid var(--button-secondary-border-color);
                transition: var(--button-transition);
                cursor: pointer;
            }

            .action-buttons .btn:hover {
                background: var(--button-secondary-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-secondary-border-color-hover);
            }

            .action-buttons .btn:active {
                box-shadow: var(--button-shadow-active);
            }
            
            .button-group {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .controls-section {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .controls-row {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
            }

            .controls-section .button-group {
                justify-content: flex-start;
            }

            .controls-section .image-controls {
                justify-content: flex-end;
            }

            .btn.auto-update-unlocked {
                background: var(--button-secondary-background-fill);
                color: #000000 !important;
                border-color: var(--button-secondary-border-color);
            }

            .btn.auto-update-unlocked:hover {
                background: var(--button-secondary-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-secondary-border-color-hover);
            }

            .btn.auto-update-locked {
                background: var(--button-cancel-background-fill);
                color: #000000 !important;
                border-color: var(--button-cancel-border-color);
            }

            .btn.auto-update-locked:hover {
                background: var(--button-cancel-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-cancel-border-color-hover);
            }
            
            .btn {
                padding: var(--button-small-padding);
                border: var(--button-border-width) solid var(--button-secondary-border-color);
                border-radius: var(--button-small-radius);
                background: var(--button-secondary-background-fill);
                color: #000000 !important;
                cursor: pointer;
                font-size: var(--button-small-text-size);
                font-weight: var(--button-small-text-weight);
                font-family: var(--font);
                transition: var(--button-transition);
                box-shadow: var(--button-shadow);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                min-width: fit-content;
            }

            .btn:hover {
                background: var(--button-secondary-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-secondary-border-color-hover);
                box-shadow: var(--button-shadow-hover);
            }

            .btn:active {
                box-shadow: var(--button-shadow-active);
            }

            .btn.primary {
                background: var(--button-primary-background-fill);
                color: #000000 !important;
                border-color: var(--button-primary-border-color);
            }

            .btn.primary:hover {
                background: var(--button-primary-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-primary-border-color-hover);
            }

            .btn.danger {
                background: var(--button-cancel-background-fill);
                color: #000000 !important;
                border-color: var(--button-cancel-border-color);
            }

            .btn.danger:hover {
                background: var(--button-cancel-background-fill-hover);
                color: #000000 !important;
                border-color: var(--button-cancel-border-color-hover);
            }

            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .btn:focus {
                outline: none;
                box-shadow: var(--button-shadow-hover);
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
                font-size: var(--text-lg);
                font-weight: 600;
                color: var(--body-text-color);
            }

            .status-indicator {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: var(--text-xs);
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
                <canvas id="region-canvas" class="region-canvas" tabindex="-1"></canvas>
                <div id="canvas-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
            </div>

            <div class="controls-section">
                <div class="controls-row">
                    <div class="button-group">
                        <button class="btn" id="clear-all-btn">Clear All</button>
                        <button class="btn" id="reset-default-btn">Default Mapping</button>
                        <button class="btn" id="import-config-btn">Import Config</button>
                        <button class="btn" id="export-config-btn">Export Config</button>
                    </div>
                    <div class="button-group image-controls">
                        <button class="btn" id="load-image-btn">📂 Load Image</button>
                        <button class="btn" id="clear-image-btn">🗑️ Clear Image</button>
                        <button class="btn" id="auto-update-btn">🔓 Auto-Update</button>
                    </div>
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

      // Image control buttons
      this.autoUpdateBtn = shadowRoot.getElementById("auto-update-btn");
      const loadImageBtn = shadowRoot.getElementById("load-image-btn");
      const clearImageBtn = shadowRoot.getElementById("clear-image-btn");

      // Initialize auto-update button state
      this.updateAutoUpdateButton();

      this.resourceManager.addEventListener(this.autoUpdateBtn, "click", () => {
        this.toggleAutoUpdate();
      });

      this.resourceManager.addEventListener(loadImageBtn, "click", () => {
        this.handleLoadImage();
      });

      this.resourceManager.addEventListener(clearImageBtn, "click", () => {
        this.handleClearImage();
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

    handleLoadImage() {
      // Create file input for image loading
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.forgeCoupleInstance.loadBackgroundImage(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    }

    handleClearImage() {
      this.forgeCoupleInstance.clearBackgroundImage();
    }

    toggleAutoUpdate() {
      this.autoUpdateEnabled = !this.autoUpdateEnabled;
      this.updateAutoUpdateButton();

      // Notify forge couple instance of state change
      if (this.forgeCoupleInstance) {
        this.forgeCoupleInstance.setAutoUpdateEnabled(this.autoUpdateEnabled);
      }
    }

    updateAutoUpdateButton() {
      if (!this.autoUpdateBtn) return;

      if (this.autoUpdateEnabled) {
        this.autoUpdateBtn.textContent = "🔓 Auto-Update";
        this.autoUpdateBtn.className = "btn auto-update-unlocked";
        this.autoUpdateBtn.title = "Auto-update enabled - Click to lock";
      } else {
        this.autoUpdateBtn.textContent = "🔒 Locked";
        this.autoUpdateBtn.className = "btn auto-update-locked";
        this.autoUpdateBtn.title = "Auto-update locked - Click to enable";
      }
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
