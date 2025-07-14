/**
 * Shadow DOM implementation of ForgeCouple functionality
 * Isolated from React virtual DOM and lobe-theme interference
 */
(function () {
  "use strict";

  // Guard against multiple loading
  if (window.ShadowForgeCouple) {
    console.log("[ShadowForgeCouple] Already loaded, skipping");
    return;
  }

  class ShadowForgeCouple {
    constructor(shadowRoot, mode) {
      this.shadowRoot = shadowRoot;
      this.mode = mode;
      this.canvas = null;
      this.ctx = null;
      this.tableBody = null;
      this.resourceManager = new ResourceManager();

      // Region management
      this.regions = [];
      this.selectedRegion = null;
      this.nextRegionId = 1;

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
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E9",
        "#F8C471",
        "#82E0AA",
      ];

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
      this.initializeDefaultRegions();

      console.log(`[ShadowForgeCouple] Initialized for ${this.mode}`);
    }

    setupCanvasDimensions() {
      // Try to get resolution from WebUI settings
      const width = this.getWebUIWidth() || 512;
      const height = this.getWebUIHeight() || 512;

      console.log(
        `[ShadowForgeCouple] Setting canvas dimensions: ${width}x${height}`
      );

      // Set internal canvas dimensions to match aspect ratio
      this.canvas.width = width;
      this.canvas.height = height;

      // Set display size to fit container while maintaining aspect ratio
      const maxDisplayWidth = 600;
      const maxDisplayHeight = 400;

      const aspectRatio = width / height;
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

      console.log(
        `[ShadowForgeCouple] Canvas display size: ${displayWidth}x${displayHeight}`
      );
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
        console.warn(
          "[ShadowForgeCouple] Could not get WebUI width, using default:",
          error
        );
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
        console.warn(
          "[ShadowForgeCouple] Could not get WebUI height, using default:",
          error
        );
        return 512;
      }
    }

    setupCanvasEvents() {
      // Mouse events for region creation and manipulation
      this.resourceManager.addEventListener(this.canvas, "mousedown", (e) => {
        e.preventDefault(); // Prevent canvas from taking focus
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
          this.resourceManager.addEventListener(promptTextarea, "input", () => {
            this.syncFromWebUIPrompts();
          });

          this.resourceManager.addEventListener(
            promptTextarea,
            "change",
            () => {
              this.syncFromWebUIPrompts();
            }
          );

          this.promptWatcherAttached = true;
          console.log(
            "[ShadowForgeCouple] Attached prompt watcher to WebUI textarea"
          );
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
        // Skip sync if disabled (prevents feedback loops)
        if (this.disablePromptWatcher) {
          console.log(
            "[ShadowForgeCouple] Prompt watcher disabled, skipping sync"
          );
          return;
        }

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
              };
              this.createRegion(regionData);
            }
          });

          // Remove excess regions if we have fewer prompts
          if (webUIPrompts.length < this.regions.length) {
            this.regions = this.regions.slice(0, webUIPrompts.length);
          }

          this.updateCanvas();
          this.updateTable();
          this.autoSyncToBackend(); // Auto-sync when prompts are synced from WebUI

          console.log(
            `[ShadowForgeCouple] Synced ${webUIPrompts.length} prompts from WebUI`
          );
        }
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Error syncing from WebUI prompts:",
          error
        );
      }
    }

    setupResolutionWatcher() {
      // Watch for changes in WebUI resolution sliders
      const watchResolution = () => {
        const currentWidth = this.getWebUIWidth();
        const currentHeight = this.getWebUIHeight();

        if (
          currentWidth !== this.canvas.width ||
          currentHeight !== this.canvas.height
        ) {
          console.log(
            `[ShadowForgeCouple] Resolution changed: ${currentWidth}x${currentHeight}`
          );
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

    setupBackendIntegration() {
      // Find the forge-couple mapping JSON component
      this.findMappingComponent();

      // Set up periodic sync with backend (disabled to prevent spam)
      // this.backendSyncInterval = setInterval(() => {
      //   this.syncToBackend();
      // }, 1000);

      // Also sync immediately when regions change
      this.lastRegionHash = "";

      // Set up generation hook to sync right before generation
      this.setupGenerationHook();
    }

    setupGenerationHook() {
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
            (e) => {
              console.log(
                "[ShadowForgeCouple] Generation click detected - forcing immediate sync..."
              );
              // Force immediate sync without debouncing
              this.forceSyncToBackend();
            },
            { capture: true }
          );

          console.log(
            `[ShadowForgeCouple] Hooked generation button: ${button.id}`
          );
        }
      });

      // Also hook into form submissions and API calls
      this.hookFormSubmissions();

      // Set up additional generation detection via MutationObserver
      this.setupGenerationObserver();
    }

    setupGenerationObserver() {
      // Watch for changes in the progress bar or generation status
      // This catches generation events that might not trigger button clicks
      const progressContainer = document.querySelector("#txt2img_results, #img2img_results");

      if (progressContainer && !this.generationObserver) {
        this.generationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            // Look for changes that indicate generation is starting
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
              const progressBar = document.querySelector(".progress-bar, [data-testid='progress-bar']");
              if (progressBar && progressBar.style.display !== 'none') {
                console.log("[ShadowForgeCouple] Generation detected via progress bar - syncing...");
                this.forceSyncToBackend();
              }
            }
          });
        });

        this.generationObserver.observe(progressContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });

        console.log("[ShadowForgeCouple] Generation observer set up");
      }
    }

    hookFormSubmissions() {
      // Hook into gradio form submissions
      const forms = document.querySelectorAll("form");
      forms.forEach((form) => {
        if (!form._forgeCoupleHooked) {
          form._forgeCoupleHooked = true;
          form.addEventListener(
            "submit",
            (e) => {
              console.log(
                "[ShadowForgeCouple] Form submission detected - syncing..."
              );
              this.forceSyncToBackend();
            },
            { capture: true }
          );
        }
      });

      // Hook into fetch API calls (gradio uses fetch for API calls)
      if (!window._forgeCoupleAPIHooked) {
        window._forgeCoupleAPIHooked = true;
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
          const url = args[0];
          if (
            typeof url === "string" &&
            (url.includes("/api/") || url.includes("predict"))
          ) {
            console.log(
              "[ShadowForgeCouple] API call detected - ensuring sync..."
            );
            // Get the shadow forge couple instance and sync
            const shadowContainers = document.querySelectorAll(
              "shadow-forge-couple-container"
            );
            shadowContainers.forEach((container) => {
              if (container.forgeCoupleInstance) {
                container.forgeCoupleInstance.forceSyncToBackend();
              }
            });
          }
          return originalFetch.apply(this, args);
        };
        console.log(
          "[ShadowForgeCouple] Hooked fetch API for generation detection"
        );
      }
    }

    findMappingComponent() {
      try {
        // Look for the forge-couple mapping JSON component
        const forgeCoupleAccordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );

        if (forgeCoupleAccordion) {
          this.findMappingComponentInAccordion(forgeCoupleAccordion);
        } else {
          console.warn(
            `[ShadowForgeCouple] Could not find forge-couple accordion #forge_couple_${
              this.mode === "t2i" ? "t2i" : "i2i"
            }`
          );

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
              console.log(
                `[ShadowForgeCouple] Found alternative accordion with selector: ${selector}`
              );
              // Retry component detection with this accordion
              this.findMappingComponentInAccordion(altAccordion);
              break;
            }
          }
        }
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Error finding mapping component:",
          error
        );
      }
    }

    findMappingComponentInAccordion(accordion) {
      console.log(
        `[ShadowForgeCouple] Searching for components in accordion:`,
        accordion.id || accordion.className
      );

      // List all inputs and textareas for debugging
      const allElements = accordion.querySelectorAll("input, textarea");
      console.log(
        `[ShadowForgeCouple] Found ${allElements.length} input/textarea elements:`
      );

      allElements.forEach((el, i) => {
        const computedStyle = window.getComputedStyle(el);
        console.log(
          `  ${i}: ${el.tagName} type="${el.type}" class="${el.className}" id="${el.id}" ` +
            `style="${el.style.cssText}" display="${computedStyle.display}" ` +
            `value="${el.value ? el.value.substring(0, 30) + "..." : "empty"}"`
        );
      });

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
          console.log(
            `[ShadowForgeCouple] Found mapping component with selector "${selector}":`,
            component
          );
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
        console.warn(
          "[ShadowForgeCouple] Could not find mapping component, trying all inputs/textareas"
        );
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
            console.log(
              "[ShadowForgeCouple] Found fallback mapping component:",
              input
            );
            break;
          }
        }
      }
    }

    syncToBackend() {
      try {
        // Convert regions to forge-couple mapping format: [x1, x2, y1, y2, weight]
        const mappingData = this.regions.map((region) => {
          const mapping = [
            region.x1,
            region.x2, // x2 comes before y1 in API format!
            region.y1,
            region.y2,
            region.weight,
          ];
          // console.log(`[ShadowForgeCouple] Region ${region.id} mapping:`, {
          //   original: {
          //     x1: region.x1,
          //     y1: region.y1,
          //     x2: region.x2,
          //     y2: region.y2,
          //     weight: region.weight,
          //   },
          //   mapped: mapping,
          // });
          return mapping;
        });

        // Create hash to detect changes
        const currentHash = JSON.stringify(mappingData);
        if (currentHash === this.lastRegionHash) {
          return; // No changes
        }

        this.lastRegionHash = currentHash;
        const mappingJson = JSON.stringify(mappingData);

        // Sync regions to backend

        // CRITICAL: Update the correct forge-couple components
        // Based on ui_adv.py, we need to update:
        // 1. The paste field (fc_paste_field) - this triggers the update
        // 2. The JSON component - this is the actual data store

        const accordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );

        if (accordion) {
          // Method 1: Update the paste field (this should trigger forge-couple's onPaste)
          const pasteField = accordion.querySelector(
            ".fc_paste_field textarea, .fc_paste_field input"
          );
          if (pasteField) {
            console.log(
              "[ShadowForgeCouple] Updating paste field component:",
              pasteField
            );
            pasteField.value = mappingJson;

            // Trigger the change event that calls on_entry -> updates JSON -> calls ForgeCouple.onPaste
            pasteField.dispatchEvent(new Event("input", { bubbles: true }));
            pasteField.dispatchEvent(new Event("change", { bubbles: true }));
            pasteField.dispatchEvent(new Event("blur", { bubbles: true }));

            console.log("[ShadowForgeCouple] Successfully updated paste field");
          }

          // Method 2: CRITICAL - Find and update the gradio JSON component
          // This is the component that forge-couple actually reads from (gr.JSON)
          let jsonComponentFound = false;

          // Try to find the gradio JSON component by looking for gradio's internal structure
          const gradioComponents = accordion.querySelectorAll("[data-testid]");
          for (const component of gradioComponents) {
            const testId = component.getAttribute("data-testid");
            if (testId && testId.includes("json")) {
              console.log(
                "[ShadowForgeCouple] Found gradio JSON component:",
                component
              );

              // Update the component value
              component.value = mappingJson;

              // Try to trigger gradio's internal update mechanism
              if (component._gradio_component) {
                component._gradio_component.value = mappingData;
              }

              // Trigger all possible events
              component.dispatchEvent(new Event("input", { bubbles: true }));
              component.dispatchEvent(new Event("change", { bubbles: true }));
              component.dispatchEvent(new Event("blur", { bubbles: true }));

              jsonComponentFound = true;
              console.log("[ShadowForgeCouple] Updated gradio JSON component");
              break;
            }
          }

          // Method 3: Try to access gradio's component registry directly
          if (window.gradio && window.gradio.components) {
            console.log(
              "[ShadowForgeCouple] Attempting to update via gradio component registry"
            );

            // Look for JSON components in gradio's registry
            for (const [id, component] of Object.entries(
              window.gradio.components
            )) {
              if (
                component &&
                component.constructor &&
                component.constructor.name === "JSON"
              ) {
                console.log(
                  `[ShadowForgeCouple] Found gradio JSON component in registry: ${id}`
                );

                try {
                  // Update the component's value directly
                  component.value = mappingData;

                  // Trigger gradio's update mechanism
                  if (component.update) {
                    component.update(mappingData);
                  }

                  console.log(
                    "[ShadowForgeCouple] Updated gradio JSON component via registry"
                  );
                } catch (error) {
                  console.warn(
                    "[ShadowForgeCouple] Error updating gradio component:",
                    error
                  );
                }
              }
            }
          }
        }

        // Also update entry field if found (this triggers the backend update)
        if (this.entryField) {
          console.log("[ShadowForgeCouple] About to update entry field:", {
            tagName: this.entryField.tagName,
            type: this.entryField.type,
            className: this.entryField.className,
            id: this.entryField.id,
            accept: this.entryField.accept,
          });

          if (
            this.entryField.type !== "file" &&
            this.entryField.accept !== ".json"
          ) {
            try {
              this.entryField.value = mappingJson;

              // Trigger events on entry field
              this.entryField.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              this.entryField.dispatchEvent(
                new Event("change", { bubbles: true })
              );

              console.log(
                "[ShadowForgeCouple] Successfully updated entry field"
              );
            } catch (error) {
              console.error(
                "[ShadowForgeCouple] Error updating entry field:",
                error,
                "Component details:",
                this.entryField
              );
            }
          } else {
            console.warn(
              "[ShadowForgeCouple] Skipping entry field file input - type:",
              this.entryField.type,
              "accept:",
              this.entryField.accept
            );
          }
        }

        // CRITICAL: Also try to find and update the actual gradio JSON component
        // This is the component that forge-couple reads for the mapping parameter
        const forgeCoupleAccordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );

        if (forgeCoupleAccordion) {
          // Look for any textarea that currently contains mapping-like data
          const allTextareas =
            forgeCoupleAccordion.querySelectorAll("textarea");
          for (const textarea of allTextareas) {
            const value = textarea.value;
            // Check if this textarea contains array data that looks like mapping
            if (
              value &&
              (value.includes("[[") ||
                value.includes("[0,") ||
                value.includes("[0.5,"))
            ) {
              console.log(
                "[ShadowForgeCouple] Found potential mapping textarea:",
                {
                  className: textarea.className,
                  currentValue: value.substring(0, 50) + "...",
                  element: textarea,
                }
              );

              try {
                textarea.value = mappingJson;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
                textarea.dispatchEvent(new Event("change", { bubbles: true }));
                console.log(
                  "[ShadowForgeCouple] Updated potential mapping textarea"
                );
              } catch (error) {
                console.warn(
                  "[ShadowForgeCouple] Error updating potential mapping textarea:",
                  error
                );
              }
            }
          }
        }

        // Also try to update via global ForgeCouple object if available
        if (
          window.ForgeCouple &&
          window.ForgeCouple.dataframe &&
          window.ForgeCouple.dataframe[this.mode]
        ) {
          try {
            console.log("[ShadowForgeCouple] Updating original dataframe...");
            this.updateOriginalDataframe(mappingData);
            console.log(
              "[ShadowForgeCouple] Successfully updated original dataframe"
            );
          } catch (error) {
            console.error(
              "[ShadowForgeCouple] Error updating original dataframe:",
              error
            );
          }
        }

        // CRITICAL: Direct integration with original forge-couple system
        if (window.ForgeCouple) {
          try {
            // First, update the original dataframe directly
            if (
              window.ForgeCouple.dataframe &&
              window.ForgeCouple.dataframe[this.mode]
            ) {
              console.log(
                "[ShadowForgeCouple] Updating original ForgeCouple dataframe..."
              );
              this.updateOriginalDataframe(mappingData);
            }

            // Then trigger the onEntry method to update the backend JSON
            if (window.ForgeCouple.onEntry) {
              console.log(
                "[ShadowForgeCouple] Triggering ForgeCouple.onEntry..."
              );
              window.ForgeCouple.onEntry(this.mode);
            }

            // Also try to directly update the entryField if it exists
            if (
              window.ForgeCouple.entryField &&
              window.ForgeCouple.entryField[this.mode]
            ) {
              console.log(
                "[ShadowForgeCouple] Updating ForgeCouple.entryField directly..."
              );
              const entryField = window.ForgeCouple.entryField[this.mode];
              entryField.value = mappingJson;
              entryField.dispatchEvent(new Event("input", { bubbles: true }));
              entryField.dispatchEvent(new Event("change", { bubbles: true }));

              // Trigger updateInput if available (from gradio)
              if (window.updateInput) {
                window.updateInput(entryField);
              }
            }

            console.log(
              "[ShadowForgeCouple] Direct ForgeCouple integration completed"
            );
          } catch (error) {
            console.error(
              "[ShadowForgeCouple] Error in direct ForgeCouple integration:",
              error
            );
          }
        } else {
          // ForgeCouple not available, use direct gradio approach

          // Direct gradio approach - find and trigger the exact component
          const accordion = document.querySelector(
            `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
          );

          if (accordion) {
            // Find the textarea that contains mapping data (should be element #18 from debug)
            const textareas = accordion.querySelectorAll(
              "textarea.scroll-hide.svelte-1f354aw"
            );

            for (const textarea of textareas) {
              if (textarea.value && textarea.value.includes("[[")) {
                console.log(
                  "[ShadowForgeCouple] Found mapping textarea, triggering gradio update..."
                );

                // Update the value
                textarea.value = mappingJson;

                // Trigger all possible gradio events
                const events = ["input", "change", "blur", "keyup"];
                events.forEach((eventType) => {
                  textarea.dispatchEvent(
                    new Event(eventType, { bubbles: true })
                  );
                });

                // Try to trigger gradio's internal update mechanism
                if (textarea._gradio_component) {
                  console.log(
                    "[ShadowForgeCouple] Triggering gradio component update..."
                  );
                  textarea._gradio_component.value = mappingJson;
                }

                // Try to find and trigger the gradio app update
                const gradioApp = document.querySelector("gradio-app");
                if (gradioApp && gradioApp.shadowRoot) {
                  const updateEvent = new CustomEvent("gradio:update", {
                    detail: { component: textarea, value: mappingJson },
                  });
                  gradioApp.dispatchEvent(updateEvent);
                }

                // CRITICAL: Try to update the gradio component's internal value
                // This is what forge-couple might actually read during generation
                try {
                  // Find the gradio component ID from the textarea's attributes
                  const componentId =
                    textarea.getAttribute("data-testid") ||
                    textarea
                      .closest("[data-testid]")
                      ?.getAttribute("data-testid");

                  if (componentId) {
                    console.log(
                      `[ShadowForgeCouple] Found component ID: ${componentId}`
                    );

                    // Try to access gradio's internal component registry
                    if (window.gradio && window.gradio.components) {
                      const component = window.gradio.components[componentId];
                      if (component) {
                        console.log(
                          "[ShadowForgeCouple] Updating gradio component registry..."
                        );
                        component.value = mappingJson;
                        if (component.update) {
                          component.update(mappingJson);
                        }
                      }
                    }

                    // Try alternative gradio access patterns
                    if (window.app && window.app.components) {
                      const component = window.app.components[componentId];
                      if (component) {
                        console.log(
                          "[ShadowForgeCouple] Updating app component registry..."
                        );
                        component.value = mappingJson;
                      }
                    }
                  }

                  // Also try to find the parent gradio block and update its value
                  const gradioBlock = textarea.closest(
                    ".gradio-block, .gradio-component, [data-testid]"
                  );
                  if (gradioBlock && gradioBlock._gradio) {
                    console.log(
                      "[ShadowForgeCouple] Updating gradio block value..."
                    );
                    gradioBlock._gradio.value = mappingJson;
                    if (gradioBlock._gradio.update) {
                      gradioBlock._gradio.update(mappingJson);
                    }
                  }
                } catch (error) {
                  console.warn(
                    "[ShadowForgeCouple] Error updating gradio internals:",
                    error
                  );
                }

                console.log(
                  "[ShadowForgeCouple] Direct gradio update completed"
                );
                break;
              }
            }
          }
        }

        // CRITICAL: Also ensure the couples (prompts) match the mapping count
        this.ensureCouplesMatchMapping();
      } catch (error) {
        console.warn("[ShadowForgeCouple] Error syncing to backend:", error);
      }
    }

    ensureCouplesMatchMapping() {
      try {
        console.log(
          "[ShadowForgeCouple] Ensuring couples count matches mapping count..."
        );

        // DISABLE prompt watcher temporarily to prevent feedback loop
        this.disablePromptWatcher = true;
        // Also try to find and update any couples-specific textareas
        const accordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );
        if (accordion) {
          // Look for textareas that might contain couples/prompts
          const textareas = accordion.querySelectorAll("textarea");
          textareas.forEach((ta, i) => {
            // Skip the mapping textarea (element 18)
            if (
              i !== 18 &&
              (!ta.value || ta.value.trim() === "" || ta.value === "empty")
            ) {
              // This might be a couples textarea - try to populate it
              if (i < this.regions.length) {
                ta.value = this.regions[i].prompt;
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                ta.dispatchEvent(new Event("change", { bubbles: true }));
                console.log(
                  `[ShadowForgeCouple] Set textarea ${i} to: ${this.regions[i].prompt}`
                );
              }
            }
          });
        }

        // Re-enable prompt watcher after a delay
        setTimeout(() => {
          this.disablePromptWatcher = false;
        }, 2000);
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Error ensuring couples match mapping:",
          error
        );
        this.disablePromptWatcher = false;
      }
    }

    updateOriginalDataframe(mappingData) {
      try {
        const dataframe = window.ForgeCouple.dataframe[this.mode];
        if (!dataframe || !dataframe.body) return;

        // Clear existing rows
        while (dataframe.body.querySelector("tr")) {
          dataframe.body.deleteRow(0);
        }

        // Add new rows based on our regions
        mappingData.forEach((mapping, index) => {
          const [x1, y1, x2, y2, weight] = mapping;
          const tr = dataframe.body.insertRow();

          // Create cells: x1, x2, y1, y2, w, prompt
          const values = [
            x1.toFixed(2),
            x2.toFixed(2),
            y1.toFixed(2),
            y2.toFixed(2),
            weight.toFixed(1),
            this.regions[index]?.prompt || "",
          ];

          values.forEach((value, cellIndex) => {
            const td = tr.insertCell();
            td.contentEditable = true;
            td.textContent = value;

            // Add event listeners similar to original
            td.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                td.blur();
              }
            });

            td.addEventListener("blur", () => {
              // Update our regions when original dataframe changes
              this.syncFromOriginalDataframe();
            });

            td.onclick = () => {
              // Select corresponding region in our interface
              if (index < this.regions.length) {
                this.selectRegion(this.regions[index]);
                this.updateCanvas();
                this.updateTable();
              }
            };
          });
        });

        console.log(
          "[ShadowForgeCouple] Updated original dataframe with",
          mappingData.length,
          "regions"
        );
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Error updating original dataframe:",
          error
        );
      }
    }

    syncFromOriginalDataframe() {
      try {
        const dataframe = window.ForgeCouple.dataframe[this.mode];
        if (!dataframe || !dataframe.body) return;

        const rows = dataframe.body.querySelectorAll("tr");
        const newRegions = [];

        rows.forEach((row, index) => {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 6) {
            const x1 = parseFloat(cells[0].textContent) || 0;
            const x2 = parseFloat(cells[1].textContent) || 1;
            const y1 = parseFloat(cells[2].textContent) || 0;
            const y2 = parseFloat(cells[3].textContent) || 1;
            const weight = parseFloat(cells[4].textContent) || 1;
            const prompt = cells[5].textContent || "";

            // Create or update region
            if (index < this.regions.length) {
              // Update existing region
              const region = this.regions[index];
              region.x1 = x1;
              region.x2 = x2;
              region.y1 = y1;
              region.y2 = y2;
              region.weight = weight;
              region.prompt = prompt;
            } else {
              // Create new region
              const region = {
                id: this.nextRegionId++,
                x1,
                y1,
                x2,
                y2,
                weight,
                prompt,
                color: this.getNextColor(),
              };
              newRegions.push(region);
            }
          }
        });

        // Add new regions
        this.regions.push(...newRegions);

        // Remove excess regions
        if (rows.length < this.regions.length) {
          this.regions = this.regions.slice(0, rows.length);
        }

        this.updateCanvas();
        this.updateTable();

        console.log(
          "[ShadowForgeCouple] Synced from original dataframe:",
          this.regions.length,
          "regions"
        );
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Error syncing from original dataframe:",
          error
        );
      }
    }

    initializeDefaultRegions() {
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
        webUIPrompts.forEach((prompt, index) => {
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

      // Force immediate sync to backend after initialization
      setTimeout(() => {
        this.syncToBackend();
      }, 500);

      console.log(
        `[ShadowForgeCouple] Initialized with ${this.regions.length} regions from WebUI prompts`
      );
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
          console.log(
            `[ShadowForgeCouple] Found ${prompts.length} prompts from WebUI:`,
            prompts
          );
          return prompts;
        }

        return [];
      } catch (error) {
        console.warn("[ShadowForgeCouple] Could not get WebUI prompts:", error);
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
        console.warn(
          "[ShadowForgeCouple] Could not get couple separator, using default:",
          error
        );
        return "\n";
      }
    }

    updateWebUIPrompts() {
      try {
        const separator = this.getCoupleSeparator();
        const prompts = this.regions
          .map((region) => region.prompt)
          .filter((p) => p.trim());
        const combinedPrompt = prompts.join(separator);

        // Try to update prompt in current tab (txt2img or img2img)
        const promptTextarea = document.querySelector(
          "#txt2img_prompt textarea, #img2img_prompt textarea"
        );

        if (promptTextarea) {
          promptTextarea.value = combinedPrompt;
          // Trigger input event to notify WebUI of the change
          promptTextarea.dispatchEvent(new Event("input", { bubbles: true }));
          console.log(
            `[ShadowForgeCouple] Updated WebUI prompt with ${prompts.length} regions`
          );
        }
      } catch (error) {
        console.warn(
          "[ShadowForgeCouple] Could not update WebUI prompts:",
          error
        );
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

    addRegion() {
      const region = this.createRegion();
      this.updateCanvas();
      this.updateTable();
      this.selectRegion(region);
      this.autoSyncToBackend(); // Auto-sync when region is added

      console.log(`[ShadowForgeCouple] Added region ${region.id}`);
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

        console.log(`[ShadowForgeCouple] Deleted region ${regionId}`);
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
      this.updateCanvas();
      this.updateTable();
      this.autoSyncToBackend(); // Auto-sync when all regions are cleared

      console.log(`[ShadowForgeCouple] Cleared all regions`);
    }

    resetToDefault() {
      this.clearAllRegions();
      this.initializeDefaultRegions();

      console.log(`[ShadowForgeCouple] Reset to default regions`);
    }

    updateCanvas() {
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

    drawRegion(region) {
      const x = region.x1 * this.canvas.width;
      const y = region.y1 * this.canvas.height;
      const width = (region.x2 - region.x1) * this.canvas.width;
      const height = (region.y2 - region.y1) * this.canvas.height;

      // Fill
      this.ctx.fillStyle = region.color + "20"; // 20% opacity
      this.ctx.fillRect(x, y, width, height);

      // Much thicker and more pronounced border
      this.ctx.strokeStyle = region.color;
      this.ctx.lineWidth = region === this.selectedRegion ? 6 : 4; // Much thicker borders
      this.ctx.strokeRect(x, y, width, height);

      // Add inner border for even more prominence
      if (region === this.selectedRegion) {
        this.ctx.strokeStyle = region.color + "80"; // Semi-transparent inner border
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + 3, y + 3, width - 6, height - 6);
      }

      // Label with background for better visibility
      this.ctx.fillStyle = region.color;
      this.ctx.font = "bold 14px Arial";
      const labelText = `Region ${region.id}`;
      const textMetrics = this.ctx.measureText(labelText);

      // Label background
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      this.ctx.fillRect(x + 5, y + 5, textMetrics.width + 6, 20);

      // Label text
      this.ctx.fillStyle = region.color;
      this.ctx.fillText(labelText, x + 8, y + 20);
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

      // Check if clicking on any region for selection
      const clickedRegion = this.getRegionAt(x, y);

      if (
        clickedRegion &&
        (!this.selectedRegion || clickedRegion.id !== this.selectedRegion.id)
      ) {
        // Select the clicked region
        this.selectRegion(clickedRegion);
        this.updateCanvas();
        this.updateTable();
        console.log(
          `[ShadowForgeCouple] Selected region ${clickedRegion.id} via canvas click`
        );
        return;
      }

      // If no region selected, ignore manipulation
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

        console.log(
          `[ShadowForgeCouple] Started resize ${resizeType} on region ${selectedRegion.id}`
        );
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

        console.log(
          `[ShadowForgeCouple] Started move on region ${selectedRegion.id}`
        );
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

      // Apply resize based on type
      if (resizeType.includes("n"))
        region.y1 = Math.max(
          0,
          Math.min(initial.y2 - 0.05, initial.y1 + deltaY)
        );
      if (resizeType.includes("s"))
        region.y2 = Math.min(
          1,
          Math.max(initial.y1 + 0.05, initial.y2 + deltaY)
        );
      if (resizeType.includes("w"))
        region.x1 = Math.max(
          0,
          Math.min(initial.x2 - 0.05, initial.x1 + deltaX)
        );
      if (resizeType.includes("e"))
        region.x2 = Math.min(
          1,
          Math.max(initial.x1 + 0.05, initial.x2 + deltaX)
        );

      this.updateTableRow(region);
      this.autoSyncToBackend(); // Auto-sync when region is resized via drag
    }

    getRegionAt(x, y) {
      // Find region at coordinates (in normalized 0-1 space)
      // Used for cursor updates and resize handle detection
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

      // Priority 1: Check if hovering over selected region's resize handles
      if (this.selectedRegion) {
        const selectedResizeType = this.getResizeType(
          this.selectedRegion,
          canvasX,
          canvasY
        );
        if (selectedResizeType) {
          this.canvas.style.cursor = selectedResizeType;
          return;
        }
      }

      // Priority 2: Check if hovering over selected region (for move)
      if (
        this.selectedRegion &&
        this.isPointInRegion(this.selectedRegion, x, y)
      ) {
        this.canvas.style.cursor = "move";
        return;
      }

      // Priority 3: Check other regions
      const hoveredRegion = this.getRegionAt(x, y);
      if (hoveredRegion) {
        this.canvas.style.cursor = "pointer"; // Indicate clickable but not selected
      } else {
        this.canvas.style.cursor = "crosshair";
      }
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
                }" data-field="prompt" placeholder="Enter prompt...">
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
          console.log(
            `[ShadowForgeCouple] Selected region ${regionId} via input click`
          );
        }
        // Don't prevent default - let the input get focus
        return;
      }

      // Handle row selection (click to select, click again to deselect) - only for non-input clicks
      if (region) {
        if (this.selectedRegion && this.selectedRegion.id === regionId) {
          // Clicking on already selected row - deselect
          this.selectedRegion = null;
          console.log(`[ShadowForgeCouple] Deselected region ${regionId}`);
        } else {
          // Select the clicked region
          this.selectRegion(region);
          console.log(`[ShadowForgeCouple] Selected region ${regionId}`);
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

      // Update region data
      if (field === "prompt") {
        region[field] = value;
        // Sync prompt changes to WebUI (debounced to avoid excessive updates)
        clearTimeout(this.promptSyncTimeout);
        this.promptSyncTimeout = setTimeout(() => {
          this.updateWebUIPrompts();
        }, 300);
      } else {
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
      // Handle validation and clamping when user finishes editing (blur/change)
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
          // Apply clamping and validation on change/blur
          region[field] = Math.max(
            0,
            Math.min(field === "weight" ? 5 : 1, numValue)
          );

          // Ensure valid bounds between coordinates
          if (field === "x1" && region.x1 >= region.x2)
            region.x2 = Math.min(1, region.x1 + 0.01);
          if (field === "x2" && region.x2 <= region.x1)
            region.x1 = Math.max(0, region.x2 - 0.01);
          if (field === "y1" && region.y1 >= region.y2)
            region.y2 = Math.min(1, region.y1 + 0.01);
          if (field === "y2" && region.y2 <= region.y1)
            region.y1 = Math.max(0, region.y2 - 0.01);

          // Update the input field with the clamped value
          e.target.value = region[field].toFixed(field === "weight" ? 1 : 2);
        } else {
          // Invalid number, reset to previous valid value
          e.target.value = region[field].toFixed(field === "weight" ? 1 : 2);
        }

        this.updateCanvas();
        this.autoSyncToBackend(); // Auto-sync when table values change
      }
    }

    handleDeleteAction(regionId, withShift) {
      console.log(
        `[ShadowForgeCouple] Delete region ${regionId}, shift: ${withShift}`
      );

      if (withShift) {
        // TODO: Also delete corresponding prompt line
        console.log(
          `[ShadowForgeCouple] Would also delete prompt line for region ${regionId}`
        );
      }

      this.deleteRegion(regionId);
    }

    handleAddAction(regionId, position, withShift) {
      console.log(
        `[ShadowForgeCouple] Add region ${position} region ${regionId}, shift: ${withShift}`
      );

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
        // TODO: Also insert empty prompt line
        console.log(
          `[ShadowForgeCouple] Would also insert empty prompt line at position ${insertIndex}`
        );
      }

      this.updateCanvas();
      this.updateTable();
      this.selectRegion(newRegion);
      this.autoSyncToBackend(); // Auto-sync when region is added via action

      console.log(
        `[ShadowForgeCouple] Added region ${newRegion.id} ${position} region ${regionId}`
      );
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
        console.log("[ShadowForgeCouple] Auto-syncing to backend...");
        this.syncToBackend();
      }, 100); // 100ms debounce
    }

    forceSyncToBackend() {
      // Only sync when in Advanced mode
      const currentMode = this.detectCurrentForgeCoupleMode();
      if (currentMode !== "Advanced") {
        return;
      }

      this.lastRegionHash = ""; // Force sync
      this.syncToBackend();
    }

    debugForgeCoupleState() {
      console.log("[ShadowForgeCouple] === FORGE-COUPLE DEBUG STATE ===");

      if (window.ForgeCouple) {
        console.log("[ShadowForgeCouple] ForgeCouple object exists");

        // Check dataframe
        if (
          window.ForgeCouple.dataframe &&
          window.ForgeCouple.dataframe[this.mode]
        ) {
          const dataframe = window.ForgeCouple.dataframe[this.mode];
          const rows = dataframe.body
            ? dataframe.body.querySelectorAll("tr")
            : [];
          console.log(`[ShadowForgeCouple] Dataframe has ${rows.length} rows`);

          rows.forEach((row, i) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 5) {
              const coords = [
                parseFloat(cells[0].textContent) || 0,
                parseFloat(cells[1].textContent) || 0,
                parseFloat(cells[2].textContent) || 0,
                parseFloat(cells[3].textContent) || 0,
                parseFloat(cells[4].textContent) || 0,
              ];
              console.log(
                `[ShadowForgeCouple] Row ${i}: [${coords.join(", ")}]`
              );
            }
          });
        }

        // Check entryField
        if (
          window.ForgeCouple.entryField &&
          window.ForgeCouple.entryField[this.mode]
        ) {
          const entryField = window.ForgeCouple.entryField[this.mode];
          console.log(
            "[ShadowForgeCouple] EntryField value:",
            entryField.value
          );
        }

        // Check all potential mapping components
        const accordion = document.querySelector(
          `#forge_couple_${this.mode === "t2i" ? "t2i" : "i2i"}`
        );
        if (accordion) {
          const textareas = accordion.querySelectorAll("textarea");
          console.log(
            `[ShadowForgeCouple] Found ${textareas.length} textareas in accordion`
          );
          textareas.forEach((ta, i) => {
            if (ta.value && ta.value.includes("[")) {
              console.log(
                `[ShadowForgeCouple] Textarea ${i} (${
                  ta.className
                }): ${ta.value.substring(0, 100)}...`
              );
            }
          });
        }
      } else {
        console.log("[ShadowForgeCouple] ForgeCouple object not found");

        // Try to manually initialize forge-couple
        this.tryManualForgeCoupleInit();
      }

      console.log("[ShadowForgeCouple] === END DEBUG STATE ===");

      // Try to patch the forge-couple validation to see what it's reading
      this.patchForgeCoupleValidation();
    }

    patchForgeCoupleValidation() {
      // Try to intercept the validation error to see what data forge-couple is actually reading
      const originalConsoleError = console.error;
      console.error = function (...args) {
        const message = args.join(" ");
        if (
          message.includes("Number of Couples and Masks mismatched") ||
          message.includes("ForgeCouple") ||
          message.includes("ERROR")
        ) {
          console.log("[ShadowForgeCouple] INTERCEPTED ERROR:", message);

          // Try to find what forge-couple is actually reading
          const accordion = document.querySelector(
            `#forge_couple_t2i, #forge_couple_i2i`
          );
          if (accordion) {
            const allTextareas = accordion.querySelectorAll("textarea");
            console.log(
              "[ShadowForgeCouple] All textarea values at validation time:"
            );
            allTextareas.forEach((ta, i) => {
              if (ta.value && ta.value.trim()) {
                console.log(`  Textarea ${i}: ${ta.value}`);
              }
            });

            // Check if there are any hidden inputs with mapping data
            const allInputs = accordion.querySelectorAll(
              'input[type="hidden"]'
            );
            console.log(
              "[ShadowForgeCouple] All hidden input values at validation time:"
            );
            allInputs.forEach((input, i) => {
              if (input.value && input.value.trim()) {
                console.log(`  Hidden input ${i}: ${input.value}`);
              }
            });
          }
        }
        return originalConsoleError.apply(this, args);
      };

      // Also patch console.warn and console.log for broader coverage
      const originalConsoleWarn = console.warn;
      console.warn = function (...args) {
        const message = args.join(" ");
        if (message.includes("ForgeCouple") || message.includes("couple")) {
          console.log("[ShadowForgeCouple] INTERCEPTED WARNING:", message);
        }
        return originalConsoleWarn.apply(this, args);
      };

      // Patch window.onerror for uncaught errors
      const originalOnError = window.onerror;
      window.onerror = function (message, source, lineno, colno, error) {
        if (
          message &&
          (message.includes("ForgeCouple") || message.includes("couple"))
        ) {
          console.log("[ShadowForgeCouple] INTERCEPTED WINDOW ERROR:", message);
        }
        if (originalOnError) {
          return originalOnError.apply(this, arguments);
        }
      };

      // Also monitor network responses for server-side errors
      this.monitorNetworkResponses();

      // Monitor for the specific 404 errors we're seeing
      this.monitor404Errors();

      console.log(
        "[ShadowForgeCouple] Patched console methods and window.onerror to intercept validation errors"
      );
    }

    monitor404Errors() {
      // Override Image constructor to catch when our data is being used as image src
      const originalImage = window.Image;
      window.Image = function (...args) {
        const img = new originalImage(...args);
        const originalSrcSetter = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          "src"
        ).set;

        Object.defineProperty(img, "src", {
          set: function (value) {
            if (value && (value.includes("[[") || value.includes("{quality"))) {
              console.log(
                "[ShadowForgeCouple] CAUGHT: Attempt to use forge-couple data as image src:",
                value
              );
              console.trace(
                "[ShadowForgeCouple] Stack trace for invalid image src:"
              );
              // Don't actually set the invalid src
              return;
            }
            return originalSrcSetter.call(this, value);
          },
          get: function () {
            return this.getAttribute("src");
          },
        });

        return img;
      };

      // Also monitor for fetch requests that might be causing 404s
      const originalFetch = window.fetch;
      window.fetch = function (url, ...args) {
        if (
          typeof url === "string" &&
          (url.includes("[[") || url.includes("{quality"))
        ) {
          console.log(
            "[ShadowForgeCouple] CAUGHT: Attempt to fetch forge-couple data as URL:",
            url
          );
          console.trace("[ShadowForgeCouple] Stack trace for invalid fetch:");
          // Return a rejected promise instead of making the invalid request
          return Promise.reject(
            new Error("Invalid URL: forge-couple data used as URL")
          );
        }
        return originalFetch.call(this, url, ...args);
      };

      console.log(
        "[ShadowForgeCouple] Monitoring for 404 errors caused by forge-couple data"
      );

      // Setup complete
    }

    addManualValidationCheck() {
      // Add a button to manually validate our data format
      // Try multiple locations since the container might not exist yet
      const tryAddButton = () => {
        // Try multiple possible locations
        const possibleContainers = [
          document.querySelector("shadow-forge-couple-container"),
          document.querySelector("#forge_couple_t2i"),
          document.querySelector("#forge_couple_i2i"),
          document.querySelector("#txt2img_tools"),
          document.querySelector("#img2img_tools"),
          document.body,
        ];

        console.log(
          "[ShadowForgeCouple] Looking for container to add validation button..."
        );

        for (const container of possibleContainers) {
          if (container && !container.querySelector(".manual-validation-btn")) {
            console.log(
              "[ShadowForgeCouple] Found container:",
              container.tagName,
              container.id || container.className
            );

            const button = document.createElement("button");
            button.className = "manual-validation-btn";
            button.textContent = "🔍 Manual Validation Check";
            button.style.cssText = `
              background: #ff6b6b;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 5px;
              font-size: 12px;
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 9999;
            `;

            button.addEventListener("click", () => {
              this.performManualValidation();
            });

            container.appendChild(button);
            console.log(
              "[ShadowForgeCouple] Added manual validation button to:",
              container.tagName
            );
            return true;
          }
        }

        console.log(
          "[ShadowForgeCouple] No suitable container found for validation button"
        );
        return false;
      };

      // Try immediately
      if (!tryAddButton()) {
        // Try again after a delay
        setTimeout(() => {
          if (!tryAddButton()) {
            // Try one more time after a longer delay
            setTimeout(tryAddButton, 3000);
          }
        }, 1500);
      }
    }

    async performManualValidation() {
      console.log("[ShadowForgeCouple] === MANUAL VALIDATION CHECK ===");

      // Check current state
      console.log("[ShadowForgeCouple] Current regions:", this.regions.length);
      this.regions.forEach((region, i) => {
        console.log(
          `  Region ${i + 1}: [${region.x1}, ${region.x2}, ${region.y1}, ${
            region.y2
          }, ${region.weight}] - "${region.prompt}"`
        );
      });

      // Check mapping component
      const mappingTextarea = document.querySelector(
        "#forge_couple_t2i textarea, #forge_couple_i2i textarea"
      );
      if (mappingTextarea) {
        console.log(
          "[ShadowForgeCouple] Mapping component value:",
          mappingTextarea.value
        );
      }

      // Check all forge-couple components
      const accordion = document.querySelector(
        "#forge_couple_t2i, #forge_couple_i2i"
      );
      if (accordion) {
        // Check for the critical forge-couple components
        const pasteField = accordion.querySelector(
          ".fc_paste_field textarea, .fc_paste_field input"
        );
        const entryField = accordion.querySelector(
          ".fc_entry_field textarea, .fc_entry_field input"
        );

        console.log("[ShadowForgeCouple] Critical forge-couple components:");
        console.log(
          "  Paste field (.fc_paste_field):",
          pasteField ? `Found: ${pasteField.value}` : "NOT FOUND"
        );
        console.log(
          "  Entry field (.fc_entry_field):",
          entryField ? `Found: ${entryField.value}` : "NOT FOUND"
        );

        // Check for JSON components
        const jsonSelectors = [
          'input[data-testid*="json"]',
          'textarea[data-testid*="json"]',
          'input[type="hidden"][value*="[["]',
          'textarea[style*="display: none"][value*="[["]',
        ];

        console.log("[ShadowForgeCouple] JSON components:");
        jsonSelectors.forEach((selector) => {
          const component = accordion.querySelector(selector);
          if (component) {
            console.log(
              `  ${selector}: Found: ${component.value?.substring(0, 50)}...`
            );
          }
        });

        // List all textareas for debugging
        const textareas = accordion.querySelectorAll("textarea");
        console.log("[ShadowForgeCouple] All forge-couple textareas:");
        textareas.forEach((ta, i) => {
          if (ta.value && ta.value.trim() && ta.value !== "empty") {
            console.log(
              `  Textarea ${i} (${ta.className}): ${ta.value.substring(
                0,
                50
              )}...`
            );
          }
        });
      }

      // Try to make a direct API call to test validation
      try {
        const mappingData = this.regions.map((region) => [
          region.x1,
          region.x2,
          region.y1,
          region.y2,
          region.weight,
        ]);

        console.log(
          "[ShadowForgeCouple] Testing API call with data:",
          mappingData
        );

        // Try to find the actual forge-couple API endpoint
        const testData = {
          mapping: mappingData,
          prompts: this.regions.map((r) => r.prompt),
          mode: "test",
        };

        // This might fail, but we'll see the error
        const response = await fetch(
          "/api/v1/extensions/forge-couple/validate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testData),
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("[ShadowForgeCouple] Validation API response:", result);
        } else {
          console.log(
            "[ShadowForgeCouple] Validation API error:",
            response.status,
            response.statusText
          );
          const errorText = await response.text();
          console.log("[ShadowForgeCouple] Error details:", errorText);
        }
      } catch (error) {
        console.log(
          "[ShadowForgeCouple] API call failed (expected in Docker):",
          error.message
        );
      }

      console.log("[ShadowForgeCouple] === END MANUAL VALIDATION ===");

      // If critical components are missing, try to create them
      if (
        !document.querySelector(".fc_paste_field") &&
        !document.querySelector(".fc_entry_field")
      ) {
        console.log(
          "[ShadowForgeCouple] Critical components missing - attempting to create them"
        );
        this.createMissingForgeCoupleComponents();
      }
    }

    detectCurrentForgeCoupleMode() {
      try {
        const accordion = document.querySelector(
          "#forge_couple_t2i, #forge_couple_i2i"
        );
        if (!accordion) return "Unknown";

        const modeRadios = accordion.querySelectorAll('input[type="radio"]');
        for (const radio of modeRadios) {
          if (radio.checked) {
            const value = radio.value;
            if (value.includes("Advanced") || value.includes("advanced"))
              return "Advanced";
            if (value.includes("Basic") || value.includes("basic"))
              return "Basic";
            if (value.includes("Mask") || value.includes("mask")) return "Mask";
          }
        }
        return "Unknown";
      } catch (error) {
        return "Unknown";
      }
    }

    createMissingForgeCoupleComponents() {
      try {
        const accordion = document.querySelector(
          "#forge_couple_t2i, #forge_couple_i2i"
        );
        if (!accordion) {
          console.warn(
            "[ShadowForgeCouple] No forge-couple accordion found to add components to"
          );
          return;
        }

        console.log(
          "[ShadowForgeCouple] Creating missing forge-couple components..."
        );

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

          console.log("[ShadowForgeCouple] Created paste field component");
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
          console.log("[ShadowForgeCouple] Created JSON mapping component");
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

          console.log("[ShadowForgeCouple] Created entry field component");
        }

        // Now try to sync to these newly created components
        setTimeout(() => {
          console.log(
            "[ShadowForgeCouple] Syncing to newly created components..."
          );
          this.syncToBackend();
        }, 100);
      } catch (error) {
        console.error(
          "[ShadowForgeCouple] Error creating missing components:",
          error
        );
      }
    }

    monitorNetworkResponses() {
      // Override fetch to monitor API responses
      if (!window._forgeCoupleNetworkMonitored) {
        window._forgeCoupleNetworkMonitored = true;

        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
          const url = args[0];
          const options = args[1] || {};

          // Log ALL requests to catch forge-couple API calls
          if (
            typeof url === "string" &&
            (url.includes("/api/") ||
              url.includes("predict") ||
              url.includes("run/") ||
              url.includes("queue/"))
          ) {
            // Log API calls for debugging
            if (options.body) {
              try {
                const bodyData = JSON.parse(options.body);
                if (bodyData.data && bodyData.data.length >= 24) {
                  console.log(
                    `[ShadowForgeCouple] Generation API call detected`
                  );
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }

          const response = await originalFetch.apply(this, args);

          // Clone response to read it without consuming the original
          const clonedResponse = response.clone();

          try {
            const text = await clonedResponse.text();
            if (
              text &&
              (text.includes("ForgeCouple") ||
                text.includes("Number of Couples and Masks") ||
                text.includes("ERROR") ||
                text.includes("error"))
            ) {
              console.log(
                "[ShadowForgeCouple] INTERCEPTED NETWORK RESPONSE:",
                text.substring(0, 1000) + (text.length > 1000 ? "..." : "")
              );

              // Also log the request details
              console.log("[ShadowForgeCouple] Response URL:", url);
            }
          } catch (error) {
            // Ignore JSON parsing errors for non-text responses
          }

          return response;
        };

        console.log(
          "[ShadowForgeCouple] Monitoring network responses for forge-couple errors"
        );
      }

      // Also monitor for generation completion to check results
      this.monitorGenerationResults();
    }

    tryManualForgeCoupleInit() {
      console.log(
        "[ShadowForgeCouple] Attempting manual ForgeCouple initialization..."
      );

      // Check if the original forge-couple script is loaded
      const scripts = document.querySelectorAll('script[src*="couple.js"]');
      console.log(
        `[ShadowForgeCouple] Found ${scripts.length} couple.js scripts`
      );

      // Try to load the original forge-couple script if not found
      if (scripts.length === 0) {
        console.log(
          "[ShadowForgeCouple] Loading original forge-couple script..."
        );
        const script = document.createElement("script");
        script.src = "/file=extensions/sd-forge-couple/javascript/couple.js";
        script.onload = () => {
          console.log(
            "[ShadowForgeCouple] Original forge-couple script loaded"
          );
          setTimeout(() => {
            if (window.ForgeCouple && window.ForgeCouple.setup) {
              console.log("[ShadowForgeCouple] Calling ForgeCouple.setup()...");
              window.ForgeCouple.setup();

              // Retry sync after setup
              setTimeout(() => {
                this.syncToBackend();
              }, 500);
            }
          }, 100);
        };
        script.onerror = () => {
          console.warn(
            "[ShadowForgeCouple] Failed to load original forge-couple script"
          );
        };
        document.head.appendChild(script);
      } else {
        // Script exists but ForgeCouple object doesn't - try to call setup
        console.log(
          "[ShadowForgeCouple] Script exists, trying to call setup..."
        );
        setTimeout(() => {
          if (window.ForgeCouple && window.ForgeCouple.setup) {
            console.log(
              "[ShadowForgeCouple] Calling existing ForgeCouple.setup()..."
            );
            window.ForgeCouple.setup();
          } else {
            console.log("[ShadowForgeCouple] ForgeCouple.setup not available");
          }
        }, 100);
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
        prompt: region.prompt,
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

    updateDimensions(dimensions) {
      // Handle dimension changes from external source
      console.log(`[ShadowForgeCouple] Dimensions updated:`, dimensions);
      // Canvas size is fixed, but we could adjust scaling here if needed
    }

    updatePreview(imageData) {
      // Handle preview image updates
      if (imageData) {
        // Could set canvas background image here
        console.log(`[ShadowForgeCouple] Preview updated`);
      }
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
        console.error("[ShadowForgeCouple] Invalid configuration");
        return;
      }

      try {
        this.clearAllRegions();

        config.regions.forEach((regionData) => {
          this.createRegion(regionData);
        });

        this.updateCanvas();
        this.updateTable();

        console.log(`[ShadowForgeCouple] Configuration imported successfully`);
      } catch (error) {
        console.error(
          "[ShadowForgeCouple] Failed to import configuration:",
          error
        );
      }
    }

    // Utility methods

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
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

      // Disconnect generation observer
      if (this.generationObserver) {
        this.generationObserver.disconnect();
        this.generationObserver = null;
      }

      this.resourceManager.cleanup();
      this.regions = [];
      this.selectedRegion = null;

      if (this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      console.log(`[ShadowForgeCouple] Destroyed for ${this.mode}`);
    }
  }

  // Expose class globally
  window.ShadowForgeCouple = ShadowForgeCouple;
  console.log("[ShadowForgeCouple] Class loaded and exposed globally");
})();
