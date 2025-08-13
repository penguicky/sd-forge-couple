/**
 * Shadow DOM implementation of ForgeCouple functionality
 * Isolated from React virtual DOM and lobe-theme interference
 */
(function () {
  "use strict";

  // Guard against multiple loading
  if (window.ShadowForgeCouple) {
    return;
  }

  class ShadowForgeCouple {
    constructor(shadowRoot, mode) {
      this.shadowRoot = shadowRoot;
      this.mode = mode;
      this.instanceId = `${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Version tracking for cache busting
      this.version = "1.6.0";

      // Debug mode for logging
      this.debugMode = false;

      // Initialize mode cache and initialization flag
      this._modeCache = null;
      this._isInitializing = false;
      this.canvas = null;
      this.ctx = null;
      this.tableBody = null;
      this.resourceManager = new ResourceManager();

      // Region management
      this.regions = [];
      this.selectedRegion = null;
      this.nextRegionId = 1;

      // Background image management
      this.backgroundImage = null;
      this.backgroundImageData = null;
      this.autoUpdateEnabled = true; // Default to enabled
      this.imageGenerationObserver = null;
      this.lastLoadedImageSrc = null;
      this.periodicCheckInterval = null;

      // Paste field watcher for parameter paste functionality
      this.originalPasteField = null;
      this.pasteFieldObserver = null;
      this.pasteFieldCheckInterval = null;
      this.pasteFieldWatcherAttached = false;

      // Interaction state
      this.dragState = {
        isDragging: false,
        dragType: null, // 'move', 'resize'
        startX: 0,
        startY: 0,
        initialRegion: null,
      };

      // Color palette for regions
      this.colorPalette = [
        "#ffffffff",
        "#ff0000ff",
        "#0066ffff",
        "#00d0ffff",
        "#01c03dff",
        "#ffc400ff",
        "#ff00ffff",
        "#00ffbfff",
        "#fef658ff",
        "#b300ffff",
        "#0099ffff",
        "#ff0073ff",
        "#91001bff",
      ];

      // Direct interface replaced by unified sync system

      this.init();
    }

    init() {
      this.canvas = this.shadowRoot.getElementById("region-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.tableBody = this.shadowRoot.getElementById("region-tbody");

      // Set up canvas dimensions based on WebUI resolution
      this.setupCanvasDimensions();

      this.setupCanvasEvents();
      this.setupTableEvents();
      this.setupResolutionWatcher();
      this.setupPromptWatcher();
      this.setupBackendIntegration();
      this.setupAutoImageUpdate();
      this.initializeDefaultRegions();
    }

    // Direct interface initialization removed - using unified sync system

    setupCanvasDimensions() {
      // Try to get resolution from WebUI settings
      const webuiWidth = this.getWebUIWidth() || 512;
      const webuiHeight = this.getWebUIHeight() || 512;
      const aspectRatio = webuiWidth / webuiHeight;

      // Use fixed canvas size that maintains aspect ratio
      // This is more efficient than full resolution
      const maxCanvasSize = 800;
      let canvasWidth, canvasHeight;

      if (aspectRatio > 1) {
        // Landscape: width is larger
        canvasWidth = maxCanvasSize;
        canvasHeight = maxCanvasSize / aspectRatio;
      } else {
        // Portrait or square: height is larger or equal
        canvasHeight = maxCanvasSize;
        canvasWidth = maxCanvasSize * aspectRatio;
      }

      // Set internal canvas dimensions
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;

      // Set display size to fit container while maintaining aspect ratio
      const maxDisplayWidth = 600;
      const maxDisplayHeight = 400;
      let displayWidth, displayHeight;

      if (aspectRatio > maxDisplayWidth / maxDisplayHeight) {
        // Width is the limiting factor
        displayWidth = maxDisplayWidth;
        displayHeight = maxDisplayWidth / aspectRatio;
      } else {
        // Height is the limiting factor
        displayHeight = maxDisplayHeight;
        displayWidth = maxDisplayHeight * aspectRatio;
      }

      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
    }

    getWebUIWidth() {
      // Try multiple methods to get width from WebUI
      try {
        // Method 1: Check gradio components
        const widthSlider = document.querySelector(
          "#txt2img_width input, #img2img_width input"
        );
        if (widthSlider) {
          return parseInt(widthSlider.value) || 512;
        }

        // Method 2: Check for stored values
        const storedWidth = localStorage.getItem("webui_width");
        if (storedWidth) {
          return parseInt(storedWidth) || 512;
        }

        // Method 3: Default
        return 512;
      } catch (error) {
        return 512;
      }
    }

    getWebUIHeight() {
      // Try multiple methods to get height from WebUI
      try {
        // Method 1: Check gradio components
        const heightSlider = document.querySelector(
          "#txt2img_height input, #img2img_height input"
        );
        if (heightSlider) {
          return parseInt(heightSlider.value) || 512;
        }

        // Method 2: Check for stored values
        const storedHeight = localStorage.getItem("webui_height");
        if (storedHeight) {
          return parseInt(storedHeight) || 512;
        }

        // Method 3: Default
        return 512;
      } catch (error) {
        return 512;
      }
    }

    setupCanvasEvents() {
      // Mouse events for region creation and manipulation
      this.resourceManager.addEventListener(this.canvas, "mousedown", (e) => {
        e.preventDefault(); // Prevent canvas from taking focus
        this.canvas.blur(); // Ensure canvas doesn't get focus
        this.handleMouseDown(e);
      });

      this.resourceManager.addEventListener(this.canvas, "mousemove", (e) => {
        this.handleMouseMove(e);
      });

      this.resourceManager.addEventListener(this.canvas, "mouseup", (e) => {
        this.handleMouseUp(e);
      });

      this.resourceManager.addEventListener(this.canvas, "mouseleave", (e) => {
        this.handleMouseUp(e);
      });

      // Keyboard events
      this.resourceManager.addEventListener(document, "keydown", (e) => {
        this.handleKeyDown(e);
      });
    }

    setupTableEvents() {
      // Event delegation for table interactions
      this.resourceManager.addEventListener(this.tableBody, "click", (e) => {
        this.handleTableClick(e);
      });

      this.resourceManager.addEventListener(this.tableBody, "input", (e) => {
        this.handleTableInput(e);
      });

      this.resourceManager.addEventListener(this.tableBody, "change", (e) => {
        this.handleTableChange(e);
      });

      this.resourceManager.addEventListener(
        this.tableBody,
        "blur",
        (e) => {
          this.handleTableChange(e);
        },
        true
      );

      // Row menu events
      this.resourceManager.addEventListener(
        this.tableBody,
        "mouseenter",
        (e) => {
          if (e.target.classList.contains("row-menu-trigger")) {
            this.showRowMenu(e.target);
          }
        },
        true
      );

      this.resourceManager.addEventListener(
        this.tableBody,
        "mouseleave",
        (e) => {
          if (
            e.target.closest("tr") &&
            !e.relatedTarget?.closest(".row-menu")
          ) {
            this.hideRowMenu(e.target.closest("tr"));
          }
        },
        true
      );
    }

    setupPromptWatcher() {
      // Watch for changes in WebUI prompt textarea
      const watchPrompt = () => {
        const promptTextarea = document.querySelector(
          "#txt2img_prompt textarea, #img2img_prompt textarea"
        );

        if (promptTextarea && !this.promptWatcherAttached) {
          // Use debounced input to avoid interfering with typing
          this.resourceManager.addEventListener(promptTextarea, "input", () => {
            clearTimeout(this.webUIPromptSyncTimeout);
            this.webUIPromptSyncTimeout = setTimeout(() => {
              this.syncFromWebUIPrompts();
            }, 1000); // Wait 1 second after user stops typing
          });

          // Immediate sync on blur/change when user finishes editing
          this.resourceManager.addEventListener(
            promptTextarea,
            "blur",
            () => {
              clearTimeout(this.webUIPromptSyncTimeout);
              this.syncFromWebUIPrompts();
            }
          );

          this.promptWatcherAttached = true;
        }
      };

      // Initial setup
      watchPrompt();

      // Retry periodically in case the textarea isn't available yet
      const watchInterval = setInterval(() => {
        if (this.promptWatcherAttached) {
          clearInterval(watchInterval);
        } else {
          watchPrompt();
        }
      }, 1000);

      // Clean up after 30 seconds if still not found
      setTimeout(() => {
        clearInterval(watchInterval);
      }, 30000);
    }

    syncFromWebUIPrompts() {
      try {
        const webUIPrompts = this.getWebUIPrompts();

        if (webUIPrompts.length > 0) {
          // Update existing regions with new prompts
          webUIPrompts.forEach((prompt, index) => {
            if (index < this.regions.length) {
              this.regions[index].prompt = prompt.trim();
            } else {
              // Create new region if we have more prompts than regions
              const regionData = {
                x1: 0.0,
                y1: 0.0,
                x2: 1.0,
                y2: 1.0,
                weight: 1.0,
                prompt: prompt.trim(),
                color: this.getNextColor(),
              };
              this.createRegion(regionData);
            }
          });

          // If we have fewer prompts than regions, clear the extra region prompts
          // but keep the regions (preserve coordinates and settings)
          if (webUIPrompts.length < this.regions.length) {
            for (let i = webUIPrompts.length; i < this.regions.length; i++) {
              this.regions[i].prompt = "";
            }
          }

          this.updateCanvas();
          this.updateTable();
          this.autoSyncToBackend();
        }
      } catch (error) {
        // Silently handle sync errors
      }
    }

    setupResolutionWatcher() {
      // Store current WebUI resolution for comparison
      this.lastWebuiWidth = this.getWebUIWidth() || 512;
      this.lastWebuiHeight = this.getWebUIHeight() || 512;

      // Watch for changes in WebUI resolution sliders
      const watchResolution = () => {
        const currentWidth = this.getWebUIWidth() || 512;
        const currentHeight = this.getWebUIHeight() || 512;

        if (
          currentWidth !== this.lastWebuiWidth ||
          currentHeight !== this.lastWebuiHeight
        ) {
          this.lastWebuiWidth = currentWidth;
          this.lastWebuiHeight = currentHeight;
          this.setupCanvasDimensions();
          this.updateCanvas();
        }
      };

      // Check every 2 seconds for resolution changes
      this.resolutionWatcher = setInterval(watchResolution, 2000);

      // Also watch for input events on resolution sliders
      const widthSliders = document.querySelectorAll(
        "#txt2img_width input, #img2img_width input"
      );
      const heightSliders = document.querySelectorAll(
        "#txt2img_height input, #img2img_height input"
      );

      [...widthSliders, ...heightSliders].forEach((slider) => {
        if (slider) {
          slider.addEventListener("input", () => {
            setTimeout(watchResolution, 100); // Small delay to let value update
          });
        }
      });
    }

    setupPasteFieldWatcher() {
      // Watch for changes in the original gradio paste field for parameter paste functionality
      const watchPasteField = () => {
        const mode = this.mode === "t2i" ? "t2i" : "i2i";
        const pasteFieldSelectors = [
          `#forge_couple_${mode} .fc_paste_field textarea`,
          `#forge_couple_${mode} .fc_paste_field input`,
          `.fc_paste_field textarea`,
          `.fc_paste_field input`
        ];

        let pasteField = null;
        for (const selector of pasteFieldSelectors) {
          pasteField = document.querySelector(selector);
          if (pasteField) break;
        }

        if (pasteField && !this.pasteFieldWatcherAttached) {
          // Store reference to the paste field
          this.originalPasteField = pasteField;

          // Check if there's already data in the field (from previous paste)
          if (pasteField.value && pasteField.value.trim()) {
            if (this.debugMode) {
              console.log("[ShadowForgeCouple] Found existing paste data on initialization:", pasteField.value);
            }
            // Process existing data immediately
            setTimeout(() => this.handlePasteFieldChange(), 100);
          }

          // Set up mutation observer to watch for value changes
          this.pasteFieldObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                this.handlePasteFieldChange();
              }
            });
          });

          // Observe attribute changes on the paste field
          this.pasteFieldObserver.observe(pasteField, {
            attributes: true,
            attributeFilter: ['value']
          });

          // Also listen for input events as a fallback
          this.resourceManager.addEventListener(pasteField, "input", () => {
            this.handlePasteFieldChange();
          });

          // Listen for change events (most reliable for gradio components)
          this.resourceManager.addEventListener(pasteField, "change", () => {
            this.handlePasteFieldChange();
          });

          // Periodic check as additional fallback
          this.pasteFieldCheckInterval = setInterval(() => {
            if (this.originalPasteField && this.originalPasteField.value && this.originalPasteField.value.trim()) {
              this.handlePasteFieldChange();
            }
          }, 500);

          this.pasteFieldWatcherAttached = true;

          if (this.debugMode) {
            console.log("[ShadowForgeCouple] Paste field watcher attached for mode:", mode);
          }
        }
      };

      // Initial setup
      watchPasteField();

      // Retry periodically in case the paste field isn't available yet
      const watchInterval = setInterval(() => {
        if (this.pasteFieldWatcherAttached) {
          clearInterval(watchInterval);
        } else {
          watchPasteField();
        }
      }, 1000);

      // Clean up after 30 seconds if still not found
      setTimeout(() => {
        clearInterval(watchInterval);
      }, 30000);
    }

    handlePasteFieldChange() {
      if (!this.originalPasteField || !this.originalPasteField.value) {
        return;
      }

      const pasteValue = this.originalPasteField.value.trim();
      if (!pasteValue) {
        return;
      }

      try {
        // Parse the mapping data from the paste field
        const mappingData = JSON.parse(pasteValue);

        if (!Array.isArray(mappingData) || mappingData.length === 0) {
          if (this.debugMode) {
            console.log("[ShadowForgeCouple] Invalid mapping data - not an array or empty:", mappingData);
          }
          return;
        }

        if (this.debugMode) {
          console.log("[ShadowForgeCouple] Received paste data:", mappingData);
        }

        // Convert mapping data to regions format
        const regions = this.convertMappingToRegions(mappingData);

        if (regions.length > 0) {
          // Apply the regions to the shadow DOM
          this.importConfig({ regions });

          // Clear the paste field to prevent repeated processing
          this.originalPasteField.value = "";

          // Trigger an input event to notify gradio
          const inputEvent = new Event('input', { bubbles: true });
          this.originalPasteField.dispatchEvent(inputEvent);

          if (this.debugMode) {
            console.log("[ShadowForgeCouple] Applied paste data to shadow DOM:", regions);
          }
        }
      } catch (error) {
        console.error("[ShadowForgeCouple] Error parsing paste field data:", error);
      }
    }

    convertMappingToRegions(mappingData) {
      if (!Array.isArray(mappingData)) {
        return [];
      }

      return mappingData.map((item, index) => {
        // Handle array format [x1, x2, y1, y2, weight]
        let x1, y1, x2, y2, weight;

        if (Array.isArray(item) && item.length >= 5) {
          x1 = item[0];
          x2 = item[1];
          y1 = item[2];
          y2 = item[3];
          weight = item[4];
        } else if (Array.isArray(item) && item.length >= 4) {
          // Fallback for shorter arrays
          x1 = item[0] || 0;
          x2 = item[1] || 1;
          y1 = item[2] || 0;
          y2 = item[3] || 1;
          weight = item[4] || 1.0;
        } else {
          // Invalid format
          return null;
        }

        // Ensure values are numbers and handle edge cases
        const numX1 = parseFloat(x1);
        const numY1 = parseFloat(y1);
        const numX2 = parseFloat(x2);
        const numY2 = parseFloat(y2);
        const numWeight = parseFloat(weight);

        return {
          id: index + 1,
          x1: isNaN(numX1) ? 0 : numX1,
          y1: isNaN(numY1) ? 0 : numY1,
          x2: isNaN(numX2) ? 1 : numX2,
          y2: isNaN(numY2) ? 1 : numY2,
          weight: isNaN(numWeight) ? 1.0 : numWeight,
          prompt: '',
          color: this.getColorForIndex(index)
        };
      }).filter(region => region !== null);
    }

    setupBackendIntegration() {
      // Find the forge-couple mapping JSON component
      this.findMappingComponent();

      // Set up generation hook to sync right before generation
      this.setupGenerationHook();

      // Set up paste field monitoring for parameter paste functionality
      this.setupPasteFieldWatcher();
    }

    setupGenerationHook() {
      // Consolidated generation detection - only hook the primary method
      this.setupPrimaryGenerationHook();
    }

    setupPrimaryGenerationHook() {
      // Hook into the generate button clicks to sync right before generation
      const generateButtons = document.querySelectorAll(
        "#txt2img_generate, #img2img_generate"
      );

      generateButtons.forEach((button) => {
        if (button && !button._forgeCoupleHooked) {
          button._forgeCoupleHooked = true;

          // Use capture phase to ensure we run before other handlers
          button.addEventListener(
            "click",
            () => {
              // Force immediate sync without debouncing
              this.forceSyncToBackend();
            },
            { capture: true }
          );
        }
      });
    }

    // Removed redundant setupGenerationObserver - button click hook is sufficient

    // Removed redundant hookFormSubmissions - backend hook handles API interception

    findMappingComponent() {
      try {
        // Look for the forge-couple mapping JSON component
        const forgeCoupleAccordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );

        if (forgeCoupleAccordion) {
          this.findMappingComponentInAccordion(forgeCoupleAccordion);
        } else {
          // Could not find forge-couple accordion

          // Try alternative accordion selectors
          const alternativeSelectors = [
            `#forge_couple_${this.mode}`, // Direct mode
            `#forge-couple-${this.mode}`, // Dash instead of underscore
            `[id*="forge_couple"]`, // Contains forge_couple
            `[id*="forge-couple"]`, // Contains forge-couple
            `.forge-couple`, // Class selector
            `.forge_couple`, // Class selector with underscore
          ];

          for (const selector of alternativeSelectors) {
            const altAccordion = document.querySelector(selector);
            if (altAccordion) {
              // Retry component detection with this accordion
              this.findMappingComponentInAccordion(altAccordion);
              break;
            }
          }
        }
      } catch (error) {
        // Error finding mapping component
      }
    }

    findMappingComponentInAccordion(accordion) {
      // Look for mapping components in accordion

      // Look for the JSON component that stores mapping data - try multiple selectors
      const selectors = [
        'textarea[data-testid*="json"]', // Gradio JSON component
        ".fc_paste_field textarea", // Paste field textarea (this is the main backend component!)
        '.fc_paste_field input:not([type="file"])', // Paste field input
        ".fc_entry_field textarea", // Entry field textarea
        ".fc_entry_field input:not([type='file'])", // Entry field input
        'input[type="hidden"]:not([type="file"])', // Hidden input (not file)
        'textarea[style*="display: none"]', // Hidden textarea
        'textarea[style*="display:none"]', // Hidden textarea (no space)
        'input[style*="display: none"]:not([type="file"])', // Hidden input (not file)
        'input[style*="display:none"]:not([type="file"])', // Hidden input (not file, no space)
        "textarea[data-testid]", // Any textarea with data-testid
        'input[data-testid]:not([type="file"])', // Any input with data-testid (not file)
      ];

      for (const selector of selectors) {
        const component = accordion.querySelector(selector);
        if (component && component.type !== "file") {
          this.mappingComponent = component;
          break;
        }
      }

      // Also try to find the entry field specifically for updates
      this.entryField =
        accordion.querySelector(".fc_entry_field textarea") ||
        accordion.querySelector(".fc_entry_field input:not([type='file'])") ||
        accordion.querySelector(".fc_paste_field textarea") ||
        accordion.querySelector(".fc_paste_field input:not([type='file'])");

      if (!this.mappingComponent) {
        // Could not find mapping component, trying all inputs/textareas
        // Fallback: try all hidden inputs/textareas (excluding file inputs)
        const allInputs = accordion.querySelectorAll(
          "input:not([type='file']), textarea"
        );
        for (const input of allInputs) {
          const style = window.getComputedStyle(input);
          if (
            (style.display === "none" || input.type === "hidden") &&
            input.type !== "file"
          ) {
            this.mappingComponent = input;

            break;
          }
        }
      }
    }

    /**
     * Sync regions to backend using direct interface
     */
    syncToBackend() {
      // Only sync when in Advanced mode
      if (!this.isAdvancedMode()) {
        return;
      }

      // Prepare region data with prompts
      const regionsWithPrompts = this.regions.map(region => ({
        x1: region.x1,
        y1: region.y1,
        x2: region.x2,
        y2: region.y2,
        weight: region.weight,
        prompt: region.prompt
      }));

      // Use unified sync system
      if (window.ForgeCoupleUnifiedSync) {
        window.ForgeCoupleUnifiedSync.syncToBackend(this.mode, regionsWithPrompts);
      }
    }

    isAdvancedMode() {
      // Cache the result for 100ms to prevent excessive DOM queries
      const now = Date.now();
      if (this._modeCache && (now - this._modeCache.timestamp) < 100) {
        return this._modeCache.mode === "Advanced";
      }

      try {
        const accordion = document.querySelector(`#forge_couple_${this.mode}`);
        if (!accordion) {
          this._modeCache = { mode: "Unknown", timestamp: now };
          return false;
        }

        const modeRadio = accordion.querySelector('input[type="radio"][value="Advanced"]:checked');
        const isAdvanced = !!modeRadio;

        // Cache the result
        this._modeCache = { mode: isAdvanced ? "Advanced" : "Other", timestamp: now };
        return isAdvanced;
      } catch (error) {
        this._modeCache = { mode: "Unknown", timestamp: now };
        return false;
      }
    }




    // Removed updateOriginalDataframe - fallback dataframe sync no longer needed

    // Removed syncFromOriginalDataframe - fallback dataframe reading no longer needed

    initializeDefaultRegions() {
      // Prevent multiple initializations
      if (this._isInitializing || this.regions.length > 0) {
        return;
      }

      this._isInitializing = true;

      // Get prompts from WebUI and split by separator
      const webUIPrompts = this.getWebUIPrompts();

      if (webUIPrompts.length === 0) {
        // Fallback to default regions if no prompts - single region covering full canvas
        const defaultRegions = [
          {
            x1: 0.0,
            y1: 0.0,
            x2: 1.0,
            y2: 1.0,
            weight: 1.0,
            prompt: "",
          },
        ];

        defaultRegions.forEach((regionData) => {
          this.createRegion(regionData);
        });
      } else {
        // Create regions based on WebUI prompts
        webUIPrompts.forEach((prompt) => {
          const regionData = {
            x1: 0.0,
            y1: 0.0,
            x2: 1.0,
            y2: 1.0,
            weight: 1.0,
            prompt: prompt.trim(),
          };
          this.createRegion(regionData);
        });
      }

      this.updateCanvas();
      this.updateTable();

      this._isInitializing = false;

      // Only auto-sync if we're in Advanced mode and this is the active tab
      if (this.isAdvancedMode()) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          this.syncToBackend();
        }, 100);
      }
    }

    getWebUIPrompts() {
      try {
        // Get the couple separator (default is '\n')
        const separator = this.getCoupleSeparator();

        // Try to get prompt from current tab (txt2img or img2img)
        const promptTextarea = document.querySelector(
          "#txt2img_prompt textarea, #img2img_prompt textarea"
        );

        if (promptTextarea && promptTextarea.value.trim()) {
          const fullPrompt = promptTextarea.value.trim();
          const prompts = fullPrompt.split(separator).filter((p) => p.trim());

          return prompts;
        }

        return [];
      } catch (error) {
        return [];
      }
    }

    getCoupleSeparator() {
      try {
        // Try to get the separator from forge-couple settings
        // Default to '\n' if not found
        const separatorInput = document.querySelector(
          "#forge_couple_separator input"
        );
        if (separatorInput && separatorInput.value) {
          return separatorInput.value;
        }

        // Check for other possible separator inputs
        const altSeparatorInput = document.querySelector(
          'input[data-testid="forge_couple_separator"]'
        );
        if (altSeparatorInput && altSeparatorInput.value) {
          return altSeparatorInput.value;
        }

        return "\n"; // Default separator
      } catch (error) {
        return "\n";
      }
    }



    createRegion(regionData = null) {
      // Default coordinates: first region is 0,1,0,1,1, additional regions are 0.3,0.6,0.3,0.6,1
      const isFirstRegion = this.regions.length === 0;
      const defaultCoords = isFirstRegion
        ? { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 }
        : { x1: 0.3, y1: 0.3, x2: 0.6, y2: 0.6 };

      const region = {
        id: this.nextRegionId++,
        x1: regionData?.x1 ?? defaultCoords.x1,
        y1: regionData?.y1 ?? defaultCoords.y1,
        x2: regionData?.x2 ?? defaultCoords.x2,
        y2: regionData?.y2 ?? defaultCoords.y2,
        weight: regionData?.weight ?? 1.0,
        prompt: regionData?.prompt ?? "",
        color: this.getNextColor(),
      };

      this.regions.push(region);
      return region;
    }

    getNextColor() {
      const index = this.regions.length % this.colorPalette.length;
      return this.colorPalette[index];
    }

    getColorForIndex(index) {
      return this.colorPalette[index % this.colorPalette.length];
    }

    addRegion() {
      const region = this.createRegion();
      this.updateCanvas();
      this.updateTable();
      this.selectRegion(region);
      this.autoSyncToBackend(); // Auto-sync when region is added
    }

    deleteRegion(regionId) {
      const index = this.regions.findIndex((r) => r.id === regionId);
      if (index !== -1) {
        const region = this.regions[index];
        this.regions.splice(index, 1);

        if (this.selectedRegion === region) {
          this.selectedRegion = null;
        }

        this.updateCanvas();
        this.updateTable();
        this.autoSyncToBackend(); // Auto-sync when region is deleted
      }
    }

    selectRegion(region) {
      this.selectedRegion = region;
      this.updateCanvas();
      this.updateTable();
    }

    clearAllRegions() {
      this.regions = [];
      this.selectedRegion = null;
      this.nextRegionId = 1;
      this._isInitializing = false; // Reset initialization flag
      this.updateCanvas();
      this.updateTable();
      this.autoSyncToBackend(); // Auto-sync when all regions are cleared
    }

    resetToDefault() {
      this.clearAllRegions();
      this.initializeDefaultRegions();
    }

    updateCanvas() {
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw background image if loaded
      this.drawBackgroundImage();

      // Draw background grid (optional)
      this.drawGrid();

      // Draw non-selected regions first
      this.regions.forEach((region) => {
        if (region !== this.selectedRegion) {
          this.drawRegion(region);
        }
      });

      // Draw selected region last (on top) to give it priority
      if (this.selectedRegion) {
        this.drawRegion(this.selectedRegion);
        this.drawSelectionHandles(this.selectedRegion);
      }
    }

    drawGrid() {
      const gridSize = 50;
      this.ctx.strokeStyle = "#f0f0f0";
      this.ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x <= this.canvas.width; x += gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= this.canvas.height; y += gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
      }
    }

    drawBackgroundImage() {
      if (!this.backgroundImage) return;

      // Calculate scaling to fit canvas while maintaining aspect ratio
      const canvasAspect = this.canvas.width / this.canvas.height;
      const imageAspect =
        this.backgroundImage.width / this.backgroundImage.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (imageAspect > canvasAspect) {
        // Image is wider than canvas aspect ratio
        drawWidth = this.canvas.width;
        drawHeight = this.canvas.width / imageAspect;
        drawX = 0;
        drawY = (this.canvas.height - drawHeight) / 2;
      } else {
        // Image is taller than canvas aspect ratio
        drawWidth = this.canvas.height * imageAspect;
        drawHeight = this.canvas.height;
        drawX = (this.canvas.width - drawWidth) / 2;
        drawY = 0;
      }

      // Draw the background image
      this.ctx.drawImage(
        this.backgroundImage,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    }

    drawRegion(region) {
      const x = region.x1 * this.canvas.width;
      const y = region.y1 * this.canvas.height;
      const width = (region.x2 - region.x1) * this.canvas.width;
      const height = (region.y2 - region.y1) * this.canvas.height;

      // Draw internal border only (inside the region boundaries)
      const borderWidth = region === this.selectedRegion ? 12 : 8;
      const halfBorder = borderWidth / 2;

      this.ctx.strokeStyle = region.color;
      this.ctx.lineWidth = borderWidth;

      // Draw border inside the region boundaries
      this.ctx.strokeRect(
        x + halfBorder,
        y + halfBorder,
        width - borderWidth,
        height - borderWidth
      );

      // Add additional inner border for selected region
      if (region === this.selectedRegion) {
        this.ctx.strokeStyle = region.color + "80"; // Semi-transparent inner border
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
          x + borderWidth + 2,
          y + borderWidth + 2,
          width - (borderWidth + 2) * 2,
          height - (borderWidth + 2) * 2
        );
      }

      // // Label with background for better visibility
      // this.ctx.fillStyle = region.color;
      // // Use lobe-theme compatible font - get CSS variable value or fallback
      // const fontSize = this.getLobeThemeFontSize() || "14px";
      // const fontFamily =
      //   this.getLobeThemeFontFamily() || "system-ui, -apple-system, sans-serif";
      // this.ctx.font = `bold ${fontSize} ${fontFamily}`;
      // const labelText = `Region ${region.id}`;
      // const textMetrics = this.ctx.measureText(labelText);

      // // Label background
      // this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      // this.ctx.fillRect(x + 5, y + 5, textMetrics.width + 6, 20);

      // // Label text
      // this.ctx.fillStyle = region.color;
      // this.ctx.fillText(labelText, x + 8, y + 20);
    }

    drawSelectionHandles(region) {
      const x = region.x1 * this.canvas.width;
      const y = region.y1 * this.canvas.height;
      const width = (region.x2 - region.x1) * this.canvas.width;
      const height = (region.y2 - region.y1) * this.canvas.height;

      const handleSize = 16; // Increased to 16 for even better usability
      const handles = [
        { x: x - handleSize / 2, y: y - handleSize / 2, cursor: "nw-resize" },
        {
          x: x + width - handleSize / 2,
          y: y - handleSize / 2,
          cursor: "ne-resize",
        },
        {
          x: x - handleSize / 2,
          y: y + height - handleSize / 2,
          cursor: "sw-resize",
        },
        {
          x: x + width - handleSize / 2,
          y: y + height - handleSize / 2,
          cursor: "se-resize",
        },
        {
          x: x + width / 2 - handleSize / 2,
          y: y - handleSize / 2,
          cursor: "n-resize",
        },
        {
          x: x + width / 2 - handleSize / 2,
          y: y + height - handleSize / 2,
          cursor: "s-resize",
        },
        {
          x: x - handleSize / 2,
          y: y + height / 2 - handleSize / 2,
          cursor: "w-resize",
        },
        {
          x: x + width - handleSize / 2,
          y: y + height / 2 - handleSize / 2,
          cursor: "e-resize",
        },
      ];

      this.ctx.fillStyle = "#007bff";
      this.ctx.strokeStyle = "#fff";
      this.ctx.lineWidth = 1;

      handles.forEach((handle) => {
        this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        this.ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
      });
    }

    handleMouseDown(e) {
      const rect = this.canvas.getBoundingClientRect();
      // Convert display coordinates to canvas coordinates, then normalize
      const canvasX =
        ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      const canvasY =
        ((e.clientY - rect.top) / rect.height) * this.canvas.height;
      const x = canvasX / this.canvas.width;
      const y = canvasY / this.canvas.height;

      // Only allow manipulation if a region is selected from the table
      if (!this.selectedRegion) {
        return;
      }

      // Only allow manipulation of the currently selected region
      const selectedRegion = this.selectedRegion;

      // Priority 1: Check if clicking on selected region's resize handles (even if overlapped)
      const resizeType = this.getResizeType(selectedRegion, canvasX, canvasY);

      if (resizeType) {
        // Resize handle clicked - always takes priority
        this.dragState = {
          isDragging: true,
          dragType: resizeType,
          startX: x,
          startY: y,
          initialRegion: { ...selectedRegion },
        };

        return;
      }

      // Priority 2: Check if clicking within the selected region's bounds for moving
      if (this.isPointInRegion(selectedRegion, x, y)) {
        this.dragState = {
          isDragging: true,
          dragType: "move",
          startX: x,
          startY: y,
          initialRegion: { ...selectedRegion },
        };
      }
    }

    handleMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      // Convert display coordinates to canvas coordinates, then normalize
      const canvasX =
        ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      const canvasY =
        ((e.clientY - rect.top) / rect.height) * this.canvas.height;
      const x = canvasX / this.canvas.width;
      const y = canvasY / this.canvas.height;

      if (!this.dragState.isDragging) {
        // Update cursor based on hover
        this.updateCursor(canvasX, canvasY);
        return;
      }

      const deltaX = x - this.dragState.startX;
      const deltaY = y - this.dragState.startY;

      switch (this.dragState.dragType) {
        case "create":
          this.handleCreateDrag(deltaX, deltaY);
          break;
        case "move":
          this.handleMoveDrag(deltaX, deltaY);
          break;
        default:
          if (this.dragState.dragType.includes("resize")) {
            this.handleResizeDrag(deltaX, deltaY);
          }
          break;
      }

      this.updateCanvas();
    }

    handleMouseUp(e) {
      if (this.dragState.isDragging && this.dragState.dragType === "create") {
        const rect = this.canvas.getBoundingClientRect();
        // Convert display coordinates to canvas coordinates, then normalize
        const canvasX =
          ((e.clientX - rect.left) / rect.width) * this.canvas.width;
        const canvasY =
          ((e.clientY - rect.top) / rect.height) * this.canvas.height;
        const x = canvasX / this.canvas.width;
        const y = canvasY / this.canvas.height;

        // Only create region if there's meaningful size
        const width = Math.abs(x - this.dragState.startX);
        const height = Math.abs(y - this.dragState.startY);

        if (width > 0.05 && height > 0.05) {
          const region = this.createRegion({
            x1: Math.min(this.dragState.startX, x),
            y1: Math.min(this.dragState.startY, y),
            x2: Math.max(this.dragState.startX, x),
            y2: Math.max(this.dragState.startY, y),
            weight: 1.0,
            prompt: "",
          });

          this.selectRegion(region);
          this.updateTable();
          this.autoSyncToBackend(); // Auto-sync when new region is created via drag
        }
      }

      this.dragState.isDragging = false;
      this.updateCanvas();
    }

    handleCreateDrag(deltaX, deltaY) {
      // Visual feedback for region creation
      const startX = this.dragState.startX;
      const startY = this.dragState.startY;
      const endX = startX + deltaX;
      const endY = startY + deltaY;

      // Draw preview rectangle
      const x = Math.min(startX, endX) * this.canvas.width;
      const y = Math.min(startY, endY) * this.canvas.height;
      const width = Math.abs(endX - startX) * this.canvas.width;
      const height = Math.abs(endY - startY) * this.canvas.height;

      this.ctx.strokeStyle = "#007bff";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(x, y, width, height);
      this.ctx.setLineDash([]);
    }

    handleMoveDrag(deltaX, deltaY) {
      if (!this.selectedRegion) return;

      const region = this.selectedRegion;
      const width = region.x2 - region.x1;
      const height = region.y2 - region.y1;

      // Calculate new position
      let newX1 = this.dragState.initialRegion.x1 + deltaX;
      let newY1 = this.dragState.initialRegion.y1 + deltaY;

      // Constrain to canvas bounds
      newX1 = Math.max(0, Math.min(1 - width, newX1));
      newY1 = Math.max(0, Math.min(1 - height, newY1));

      region.x1 = newX1;
      region.y1 = newY1;
      region.x2 = newX1 + width;
      region.y2 = newY1 + height;

      this.updateTableRow(region);
      this.autoSyncToBackend(); // Auto-sync when region is moved via drag
    }

    handleResizeDrag(deltaX, deltaY) {
      if (!this.selectedRegion) return;

      const region = this.selectedRegion;
      const initial = this.dragState.initialRegion;
      const resizeType = this.dragState.dragType;

      // Apply resize based on handle type with proper anchor points
      switch (resizeType) {
        // Corner handles - opposite corner stays fixed
        case "nw-resize":
          // Anchor at SE corner (x2, y2 fixed)
          region.x1 = initial.x1 + deltaX;
          region.y1 = initial.y1 + deltaY;
          break;
        case "ne-resize":
          // Anchor at SW corner (x1, y2 fixed)
          region.x2 = initial.x2 + deltaX;
          region.y1 = initial.y1 + deltaY;
          break;
        case "sw-resize":
          // Anchor at NE corner (x2, y1 fixed)
          region.x1 = initial.x1 + deltaX;
          region.y2 = initial.y2 + deltaY;
          break;
        case "se-resize":
          // Anchor at NW corner (x1, y1 fixed)
          region.x2 = initial.x2 + deltaX;
          region.y2 = initial.y2 + deltaY;
          break;

        // Edge handles - opposite edge stays fixed
        case "n-resize":
          // Anchor at bottom edge (y2 fixed)
          region.y1 = initial.y1 + deltaY;
          break;
        case "s-resize":
          // Anchor at top edge (y1 fixed)
          region.y2 = initial.y2 + deltaY;
          break;
        case "w-resize":
          // Anchor at right edge (x2 fixed)
          region.x1 = initial.x1 + deltaX;
          break;
        case "e-resize":
          // Anchor at left edge (x1 fixed)
          region.x2 = initial.x2 + deltaX;
          break;
      }

      // Apply bounds checking to ensure regions stay within canvas (0.0-1.0)
      region.x1 = Math.max(0, Math.min(1, region.x1));
      region.x2 = Math.max(0, Math.min(1, region.x2));
      region.y1 = Math.max(0, Math.min(1, region.y1));
      region.y2 = Math.max(0, Math.min(1, region.y2));

      // Ensure coordinates are in correct order (x1 < x2, y1 < y2)
      if (region.x1 >= region.x2) {
        const temp = region.x1;
        region.x1 = region.x2;
        region.x2 = temp;
      }
      if (region.y1 >= region.y2) {
        const temp = region.y1;
        region.y1 = region.y2;
        region.y2 = temp;
      }

      // Maintain minimum size constraint of 0.05
      const width = region.x2 - region.x1;
      const height = region.y2 - region.y1;

      if (width < 0.05) {
        const center = (region.x1 + region.x2) / 2;
        region.x1 = center - 0.025;
        region.x2 = center + 0.025;
      }
      if (height < 0.05) {
        const center = (region.y1 + region.y2) / 2;
        region.y1 = center - 0.025;
        region.y2 = center + 0.025;
      }

      this.updateTableRow(region);
      this.autoSyncToBackend(); // Auto-sync when region is resized via drag
    }

    getRegionAt(x, y) {
      // Find region at coordinates (in normalized 0-1 space)
      // Returns any region that contains the point (for selection purposes)
      return this.regions.find(
        (region) =>
          x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2
      );
    }

    getResizeType(region, canvasX, canvasY) {
      const x = region.x1 * this.canvas.width;
      const y = region.y1 * this.canvas.height;
      const width = (region.x2 - region.x1) * this.canvas.width;
      const height = (region.y2 - region.y1) * this.canvas.height;

      const handleSize = 16; // Increased to 16 for even better usability
      const tolerance = handleSize;

      // Check each resize handle
      const handles = [
        { x: x, y: y, type: "nw-resize" },
        { x: x + width, y: y, type: "ne-resize" },
        { x: x, y: y + height, type: "sw-resize" },
        { x: x + width, y: y + height, type: "se-resize" },
        { x: x + width / 2, y: y, type: "n-resize" },
        { x: x + width / 2, y: y + height, type: "s-resize" },
        { x: x, y: y + height / 2, type: "w-resize" },
        { x: x + width, y: y + height / 2, type: "e-resize" },
      ];

      for (const handle of handles) {
        if (
          Math.abs(canvasX - handle.x) <= tolerance &&
          Math.abs(canvasY - handle.y) <= tolerance
        ) {
          return handle.type;
        }
      }

      return null;
    }

    updateCursor(canvasX, canvasY) {
      const x = canvasX / this.canvas.width;
      const y = canvasY / this.canvas.height;

      // Only show interactive cursors for the selected region
      if (this.selectedRegion) {
        // Check if hovering over selected region's resize handles
        const selectedResizeType = this.getResizeType(
          this.selectedRegion,
          canvasX,
          canvasY
        );
        if (selectedResizeType) {
          this.canvas.style.cursor = selectedResizeType;
          return;
        }

        // Check if hovering over selected region (for move)
        if (this.isPointInRegion(this.selectedRegion, x, y)) {
          this.canvas.style.cursor = "move";
          return;
        }
      }

      // Default cursor for all other areas (including non-selected regions)
      this.canvas.style.cursor = "crosshair";
    }

    isPointInRegion(region, x, y) {
      return (
        x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2
      );
    }

    handleKeyDown(e) {
      // Only handle keys when shadow DOM has focus
      if (!this.shadowRoot.contains(document.activeElement)) {
        return;
      }

      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (this.selectedRegion) {
            this.deleteRegion(this.selectedRegion.id);
            e.preventDefault();
          }
          break;
        case "Escape":
          this.selectedRegion = null;
          this.updateCanvas();
          this.updateTable();
          break;
      }
    }

    updateTable() {
      // Clear existing rows
      this.tableBody.innerHTML = "";

      // Add row for each region
      this.regions.forEach((region) => {
        this.addTableRow(region);
      });
    }

    addTableRow(region) {
      const row = document.createElement("tr");
      row.dataset.regionId = region.id;

      // Set row background color based on region color with transparency for better text readability
      const color = region.color;
      // Convert hex to rgba with 0.3 opacity
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      row.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.3)`;

      if (region === this.selectedRegion) {
        row.classList.add("selected");
        // Set border color to the region's own color for pronounced highlighting
        row.style.borderColor = region.color;
      }

      row.innerHTML = `
            <td class="coordinate"><input type="number" step="0.01" min="0" max="1" value="${region.x1.toFixed(
              2
            )}" data-field="x1"></td>
            <td class="coordinate"><input type="number" step="0.01" min="0" max="1" value="${region.x2.toFixed(
              2
            )}" data-field="x2"></td>
            <td class="coordinate"><input type="number" step="0.01" min="0" max="1" value="${region.y1.toFixed(
              2
            )}" data-field="y1"></td>
            <td class="coordinate"><input type="number" step="0.01" min="0" max="1" value="${region.y2.toFixed(
              2
            )}" data-field="y2"></td>
            <td class="weight"><input type="number" step="0.1" min="0" max="5" value="${region.weight.toFixed(
              1
            )}" data-field="weight"></td>
            <td class="prompt">
                <input type="text" value="${
                  region.prompt
                }" data-field="prompt" placeholder="Controlled by main prompt box" readonly style="cursor: default;" title="Prompts are controlled by the main prompt box above">
                <div class="row-menu-trigger"></div>
                <div class="row-menu">
                    <button data-action="add-above">Add Above</button>
                    <button data-action="delete">Delete</button>
                    <button data-action="add-below">Add Below</button>
                </div>
            </td>
        `;

      this.tableBody.appendChild(row);
    }

    showRowMenu(trigger) {
      const row = trigger.closest("tr");
      const menu = row.querySelector(".row-menu");
      if (menu) {
        menu.style.display = "block";
      }
    }

    hideRowMenu(row) {
      const menu = row.querySelector(".row-menu");
      if (menu) {
        menu.style.display = "none";
      }
    }

    updateTableRow(region) {
      const row = this.tableBody.querySelector(
        `tr[data-region-id="${region.id}"]`
      );
      if (!row) return;

      // Update input values
      row.querySelector('[data-field="x1"]').value = region.x1.toFixed(2);
      row.querySelector('[data-field="x2"]').value = region.x2.toFixed(2);
      row.querySelector('[data-field="y1"]').value = region.y1.toFixed(2);
      row.querySelector('[data-field="y2"]').value = region.y2.toFixed(2);
      row.querySelector('[data-field="weight"]').value =
        region.weight.toFixed(1);
      row.querySelector('[data-field="prompt"]').value = region.prompt;
    }

    handleTableClick(e) {
      const row = e.target.closest("tr");
      if (!row) return;

      const regionId = parseInt(row.dataset.regionId);
      const region = this.regions.find((r) => r.id === regionId);

      // Handle button actions
      if (e.target.dataset.action === "delete") {
        this.handleDeleteAction(regionId, e.shiftKey);
        return;
      }

      if (e.target.dataset.action === "add-above") {
        this.handleAddAction(regionId, "above", e.shiftKey);
        return;
      }

      if (e.target.dataset.action === "add-below") {
        this.handleAddAction(regionId, "below", e.shiftKey);
        return;
      }

      // If clicking on an input field, select the region and let the input handle focus
      if (e.target.tagName === "INPUT") {
        if (
          region &&
          (!this.selectedRegion || this.selectedRegion.id !== regionId)
        ) {
          this.selectRegion(region);
          this.updateCanvas();
          this.updateTable();
        }
        // Don't prevent default - let the input get focus
        return;
      }

      // Handle row selection (click to select, click again to deselect) - only for non-input clicks
      if (region) {
        if (this.selectedRegion && this.selectedRegion.id === regionId) {
          // Clicking on already selected row - deselect
          this.selectedRegion = null;
        } else {
          // Select the clicked region
          this.selectRegion(region);
        }

        this.updateCanvas();
        this.updateTable();
      }
    }

    handleTableInput(e) {
      const row = e.target.closest("tr");
      if (!row) return;

      const regionId = parseInt(row.dataset.regionId);
      const region = this.regions.find((r) => r.id === regionId);
      if (!region) return;

      const field = e.target.dataset.field;
      const value = e.target.value;

      // Update region data (skip prompt since it's read-only)
      if (field !== "prompt") {
        // For numeric fields, just store the raw value during typing
        // Validation will happen on blur/change
        region[field + "_raw"] = value;

        // Only update the actual numeric value if it's a valid number
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          region[field] = numValue; // Don't clamp during typing
        }
      }

      // Update canvas but don't update table row (to avoid resetting input)
      this.updateCanvas();
    }

    handleTableChange(e) {
      // Simplified validation - comprehensive validation happens in unified sync
      const row = e.target.closest("tr");
      if (!row) return;

      const regionId = parseInt(row.dataset.regionId);
      const region = this.regions.find((r) => r.id === regionId);
      if (!region) return;

      const field = e.target.dataset.field;
      const value = e.target.value;

      if (field !== "prompt") {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          // Store raw value - validation happens during sync
          region[field] = numValue;

          // Update display with formatted value
          e.target.value = numValue.toFixed(field === "weight" ? 1 : 2);
        } else {
          // Invalid number, reset to previous valid value
          e.target.value = region[field].toFixed(field === "weight" ? 1 : 2);
        }

        this.updateCanvas();
        this.autoSyncToBackend(); // Validation happens here
      }
    }

    handleDeleteAction(regionId, withShift) {
      if (withShift) {
        // Also delete corresponding prompt line
      }

      this.deleteRegion(regionId);
    }

    handleAddAction(regionId, position, withShift) {
      const targetRegion = this.regions.find((r) => r.id === regionId);
      if (!targetRegion) return;

      // Create new region with default position
      const newRegion = this.createRegion();

      // Find insertion index
      const targetIndex = this.regions.findIndex((r) => r.id === regionId);
      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;

      // Remove from end and insert at correct position
      this.regions.pop(); // Remove from end
      this.regions.splice(insertIndex, 0, newRegion);

      if (withShift) {
        // Also insert empty prompt line
      }

      this.updateCanvas();
      this.updateTable();
      this.selectRegion(newRegion);
      this.autoSyncToBackend(); // Auto-sync when region is added via action
    }

    // External API methods for integration

    /**
     * Automatically sync to backend when regions change
     * Uses debouncing to prevent excessive sync calls
     */
    autoSyncToBackend() {
      // Only sync when in Advanced mode
      const currentMode = this.detectCurrentForgeCoupleMode();
      if (currentMode !== "Advanced") {
        return;
      }

      // Clear any existing timeout
      if (this.autoSyncTimeout) {
        clearTimeout(this.autoSyncTimeout);
      }

      // Debounce sync calls to prevent spam during rapid changes
      this.autoSyncTimeout = setTimeout(() => {
        this.syncToBackend();
      }, 100); // 100ms debounce
    }

    forceSyncToBackend() {
      // Only sync when in Advanced mode
      const currentMode = this.detectCurrentForgeCoupleMode();
      if (currentMode !== "Advanced") {
        return;
      }

      this.syncToBackend();
    }

    detectCurrentForgeCoupleMode() {
      // Cache the result for 100ms to prevent excessive DOM queries
      const now = Date.now();
      if (this._modeCache && (now - this._modeCache.timestamp) < 100) {
        return this._modeCache.mode;
      }

      try {
        const accordion = document.querySelector(
          "#forge_couple_t2i, #forge_couple_i2i"
        );
        if (!accordion) {
          return "Unknown";
        }

        const modeRadios = accordion.querySelectorAll('input[type="radio"]');

        for (const radio of modeRadios) {
          if (radio.checked) {
            const value = radio.value;
            let detectedMode = "Unknown";
            if (value.includes("Advanced") || value.includes("advanced"))
              detectedMode = "Advanced";
            else if (value.includes("Basic") || value.includes("basic"))
              detectedMode = "Basic";
            else if (value.includes("Mask") || value.includes("mask"))
              detectedMode = "Mask";

            // Cache the result
            this._modeCache = { mode: detectedMode, timestamp: now };
            return detectedMode;
          }
        }

        this._modeCache = { mode: "Unknown", timestamp: now };
        return "Unknown";
      } catch (error) {
        this._modeCache = { mode: "Unknown", timestamp: now };
        return "Unknown";
      }
    }

    createMissingForgeCoupleComponents() {
      try {
        const accordion = document.querySelector(
          "#forge_couple_t2i, #forge_couple_i2i"
        );
        if (!accordion) {
          return;
        }

        // Create the paste field component (fc_paste_field)
        if (!accordion.querySelector(".fc_paste_field")) {
          const pasteFieldContainer = document.createElement("div");
          pasteFieldContainer.className = "fc_paste_field";
          pasteFieldContainer.style.display = "none"; // Hidden like in the original

          const pasteFieldTextarea = document.createElement("textarea");
          pasteFieldTextarea.className = "scroll-hide svelte-1f354aw";
          pasteFieldTextarea.style.cssText =
            "overflow-y: scroll; height: 42px; display: none;";
          pasteFieldTextarea.value = JSON.stringify(
            this.regions.map((r) => [r.x1, r.x2, r.y1, r.y2, r.weight])
          );

          pasteFieldContainer.appendChild(pasteFieldTextarea);
          accordion.appendChild(pasteFieldContainer);
        }

        // Create the JSON component (hidden input for mapping data)
        if (!accordion.querySelector('input[data-testid*="json"]')) {
          const jsonInput = document.createElement("input");
          jsonInput.type = "hidden";
          jsonInput.setAttribute("data-testid", "json-mapping");
          jsonInput.value = JSON.stringify(
            this.regions.map((r) => [r.x1, r.x2, r.y1, r.y2, r.weight])
          );

          accordion.appendChild(jsonInput);
        }

        // Create the entry field component (fc_entry_field)
        if (!accordion.querySelector(".fc_entry_field")) {
          const entryFieldContainer = document.createElement("div");
          entryFieldContainer.className = "fc_entry_field";
          entryFieldContainer.style.display = "none"; // Hidden like in the original

          const entryFieldTextarea = document.createElement("textarea");
          entryFieldTextarea.className = "scroll-hide svelte-1f354aw";
          entryFieldTextarea.style.cssText =
            "overflow-y: scroll; height: 42px; display: none;";
          entryFieldTextarea.value = JSON.stringify(
            this.regions.map((r) => [r.x1, r.x2, r.y1, r.y2, r.weight])
          );

          entryFieldContainer.appendChild(entryFieldTextarea);
          accordion.appendChild(entryFieldContainer);
        }

        // Now try to sync to these newly created components
        setTimeout(() => {
          this.syncToBackend();
        }, 100);
      } catch (error) {
        // Error creating missing components
      }
    }

    getRegions() {
      return this.regions.map((region) => ({
        id: region.id,
        x1: region.x1,
        y1: region.y1,
        x2: region.x2,
        y2: region.y2,
        weight: region.weight,
        color: region.color,
      }));
    }

    updatePrompts(prompts) {
      // Update prompts from external source (e.g., main prompt field)
      if (Array.isArray(prompts)) {
        this.regions.forEach((region, index) => {
          if (index < prompts.length) {
            region.prompt = prompts[index] || "";
          }
        });
        this.updateTable();
      }
    }

    updateDimensions() {
      // Handle dimension changes from external source
      // Canvas size is fixed, but we could adjust scaling here if needed
    }

    updatePreview(imageData) {
      // Handle preview image updates
      if (imageData) {
        // Could set canvas background image here
      }
    }

    loadBackgroundImage(imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        // Resize image if too large (following original implementation)
        const maxDim = 1024 * 1024;
        let width = img.width;
        let height = img.height;

        if (width * height > maxDim) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          while (width * height > maxDim) {
            width = Math.round(width / 2);
            height = Math.round(height / 2);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Create new image from resized canvas
          const resizedImg = new Image();
          resizedImg.onload = () => {
            this.backgroundImage = resizedImg;
            this.backgroundImageData = canvas.toDataURL("image/jpeg");
            this.updateCanvas();
          };
          resizedImg.src = canvas.toDataURL("image/jpeg");
        } else {
          this.backgroundImage = img;
          this.backgroundImageData = imageDataUrl;
          this.updateCanvas();
        }
      };
      img.src = imageDataUrl;
    }

    clearBackgroundImage() {
      this.backgroundImage = null;
      this.backgroundImageData = null;
      this.updateCanvas();
    }

    setAutoUpdateEnabled(enabled) {
      this.autoUpdateEnabled = enabled;
    }

    setupAutoImageUpdate() {
      // Only set up auto-update for txt2img mode
      if (this.mode !== "t2i") return;

      // Set up mutation observer to watch for new images in txt2img gallery
      this.setupImageGenerationObserver();

      // Set up periodic fallback check
      this.setupPeriodicImageCheck();
    }

    setupImageGenerationObserver() {
      // Find the txt2img gallery container
      const txt2imgGallery = document.querySelector("#txt2img_gallery");
      if (!txt2imgGallery) {
        // Retry after a delay if gallery not found yet
        setTimeout(() => this.setupImageGenerationObserver(), 1000);
        return;
      }

      // Create mutation observer to watch for image changes
      this.imageGenerationObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        mutations.forEach((mutation) => {
          // Watch for new nodes being added (new images)
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const newImages = node.querySelectorAll
                  ? node.querySelectorAll("img")
                  : [];
                if (newImages.length > 0 || node.tagName === "IMG") {
                  shouldUpdate = true;
                }
              }
            });
          }

          // Watch for attribute changes on existing images (src updates)
          if (
            mutation.type === "attributes" &&
            mutation.target.tagName === "IMG" &&
            mutation.attributeName === "src"
          ) {
            const newSrc = mutation.target.src;
            if (
              newSrc &&
              newSrc !== "data:," &&
              !newSrc.includes("data:image/gif")
            ) {
              shouldUpdate = true;
            }
          }
        });

        if (shouldUpdate) {
          // Debounce multiple rapid changes
          clearTimeout(this.updateTimeout);
          this.updateTimeout = setTimeout(
            () => this.handleNewImageGenerated(),
            800
          );
        }
      });

      // Start observing the gallery
      this.imageGenerationObserver.observe(txt2imgGallery, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
        attributeOldValue: true,
      });
    }

    setupPeriodicImageCheck() {
      // Clear any existing interval
      if (this.periodicCheckInterval) {
        clearInterval(this.periodicCheckInterval);
      }

      // Set up a fallback periodic check every 2 seconds
      // This ensures we catch images even if the mutation observer misses them
      this.periodicCheckInterval = setInterval(() => {
        if (this.autoUpdateEnabled && this.mode === "t2i") {
          const latestImage = this.getLatestGeneratedImage();
          if (
            latestImage &&
            latestImage.src &&
            latestImage.src !== "data:," &&
            this.lastLoadedImageSrc !== latestImage.src
          ) {
            // Use the same logic as handleNewImageGenerated to preserve regions
            this.handleNewImageGenerated();
          }
        }
      }, 2000);
    }

    handleNewImageGenerated() {
      if (!this.autoUpdateEnabled) return;

      // Get the latest generated image from txt2img gallery
      const latestImage = this.getLatestGeneratedImage();
      if (latestImage && latestImage.src && latestImage.src !== "data:,") {
        // Check if this is actually a new image (different from last loaded)
        if (this.lastLoadedImageSrc !== latestImage.src) {
          this.lastLoadedImageSrc = latestImage.src;

          // No need to store regions - they should not be affected by loading a background image

          // Load the new image as background
          this.loadBackgroundImage(latestImage.src);

          // The loadBackgroundImage method should not clear regions
          // If regions are somehow cleared, this is a bug that needs investigation
          // For now, let's not try to restore them as it might mask the real issue
        }
      }
    }

    getLatestGeneratedImage() {
      // Find the txt2img gallery and get the first (latest) image
      const txt2imgGallery = document.querySelector("#txt2img_gallery");
      if (!txt2imgGallery) return null;

      // Try multiple selectors to find the main gallery image
      const selectors = [
        'img[data-testid="detailed-image"]', // Main detailed view
        ".gallery img:first-child", // First image in gallery
        ".gradio-gallery img:first-child", // Gradio gallery first image
        'img[src*="tmp"]', // Images with tmp in src (generated)
        'img:not([src*="data:image/gif"])', // Non-GIF images (avoid loading gifs)
        "img", // Fallback to any image
      ];

      for (const selector of selectors) {
        const images = txt2imgGallery.querySelectorAll(selector);
        for (const img of images) {
          // Check if image has valid src and is not a placeholder
          if (
            img.src &&
            img.src !== "data:," &&
            !img.src.includes("data:image/gif") &&
            (img.src.startsWith("http") ||
              img.src.startsWith("file:") ||
              img.src.startsWith("data:image/"))
          ) {
            return img;
          }
        }
      }

      return null;
    }

    exportConfig() {
      return {
        version: "1.0",
        mode: this.mode,
        regions: this.getRegions(),
        timestamp: Date.now(),
      };
    }

    importConfig(config) {
      if (!config || !config.regions) {
        return;
      }

      try {
        this.clearAllRegions();

        config.regions.forEach((regionData) => {
          // Don't import prompts - only coordinates, weight, and color
          const cleanRegionData = {
            x1: regionData.x1,
            y1: regionData.y1,
            x2: regionData.x2,
            y2: regionData.y2,
            weight: regionData.weight,
            color: regionData.color,
            prompt: "", // Always start with empty prompt
          };
          this.createRegion(cleanRegionData);
        });

        this.updateCanvas();
        this.updateTable();
      } catch (error) {
        console.error("[ShadowForgeCouple] Failed to import configuration:", error);
      }
    }

    // Utility methods

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    // Helper methods to get lobe-theme font values
    getLobeThemeFontSize() {
      try {
        // Try to get CSS variable value from document
        const rootStyles = getComputedStyle(document.documentElement);
        const textMd = rootStyles.getPropertyValue("--text-md").trim();
        if (textMd) return textMd;

        // Fallback: try to get from body font-size
        const bodyFontSize = rootStyles.fontSize;
        if (bodyFontSize) return bodyFontSize;

        return null;
      } catch (error) {
        return null;
      }
    }

    getLobeThemeFontFamily() {
      try {
        // Try to get CSS variable value from document
        const rootStyles = getComputedStyle(document.documentElement);
        const fontFamily = rootStyles.getPropertyValue("--font").trim();
        if (fontFamily) return fontFamily;

        // Fallback: try to get from body font-family
        const bodyFontFamily = rootStyles.fontFamily;
        if (bodyFontFamily) return bodyFontFamily;

        return null;
      } catch (error) {
        return null;
      }
    }

    normalizeCoordinates(x1, y1, x2, y2) {
      return {
        x1: Math.min(x1, x2),
        y1: Math.min(y1, y2),
        x2: Math.max(x1, x2),
        y2: Math.max(y1, y2),
      };
    }

    getCanvasCoordinates(normalizedX, normalizedY) {
      return {
        x: normalizedX * this.canvas.width,
        y: normalizedY * this.canvas.height,
      };
    }

    getNormalizedCoordinates(canvasX, canvasY) {
      return {
        x: canvasX / this.canvas.width,
        y: canvasY / this.canvas.height,
      };
    }

    // Cleanup

    destroy() {
      // Clear resolution watcher
      if (this.resolutionWatcher) {
        clearInterval(this.resolutionWatcher);
        this.resolutionWatcher = null;
      }

      // Clear backend sync interval
      if (this.backendSyncInterval) {
        clearInterval(this.backendSyncInterval);
        this.backendSyncInterval = null;
      }

      // Clear auto-sync timeout
      if (this.autoSyncTimeout) {
        clearTimeout(this.autoSyncTimeout);
        this.autoSyncTimeout = null;
      }

      // Clear paste field watcher
      if (this.pasteFieldObserver) {
        this.pasteFieldObserver.disconnect();
        this.pasteFieldObserver = null;
      }

      if (this.pasteFieldCheckInterval) {
        clearInterval(this.pasteFieldCheckInterval);
        this.pasteFieldCheckInterval = null;
      }

      // Generation observer was removed - no cleanup needed

      if (this.imageGenerationObserver) {
        this.imageGenerationObserver.disconnect();
        this.imageGenerationObserver = null;
      }

      if (this.periodicCheckInterval) {
        clearInterval(this.periodicCheckInterval);
        this.periodicCheckInterval = null;
      }

      // Direct interface replaced by unified sync system - no cleanup needed

      this.resourceManager.cleanup();
      this.regions = [];
      this.selectedRegion = null;

      if (this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  // Expose class globally
  window.ShadowForgeCouple = ShadowForgeCouple;
})();
