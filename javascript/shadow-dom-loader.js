/**
 * Shadow DOM Loader for forge-couple lobe-theme integration
 * Loads and initializes all required components for Shadow DOM isolation
 */
(function () {
  "use strict";

  // Configuration - use bundled approach to avoid path issues
  const PASTE_BRIDGE_SCRIPT = "forge-couple-paste-bridge.js";
  const BUNDLE_SCRIPT = "shadow-dom-bundle.js";
  const REMAINING_SCRIPTS = [
    "unified-sync.js",
    "shadow-forge-couple.js",
    "shadow-dom-container.js",
  ];

  // Note: backend-bridge.js, event-bridge.js, and resource-manager.js are included in the bundle

  // Try to determine the correct script path from current script
  let SCRIPT_BASE_PATH = null;

  // Get the path from the current script tag
  function getCurrentScriptPath() {
    const scripts = document.getElementsByTagName("script");
    for (let script of scripts) {
      if (script.src && script.src.includes("shadow-dom-loader.js")) {
        const path = script.src.substring(0, script.src.lastIndexOf("/") + 1);

        return path;
      }
    }

    // Fallback paths
    const fallbacks = [
      "/extensions/sd-forge-couple/javascript/",
      "/file=extensions/sd-forge-couple/javascript/",
      "./extensions/sd-forge-couple/javascript/",
    ];

    return fallbacks[0];
  }

  SCRIPT_BASE_PATH = getCurrentScriptPath();

  // Global state
  let isLoaded = false;
  let loadPromise = null;

  /**
   * Load script dynamically
   * @param {string} src - Script source URL
   * @returns {Promise} Promise that resolves when script is loaded
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded by src or by checking for specific classes
      const existingScript =
        document.querySelector(`script[src="${src}"]`) ||
        document.querySelector(`script[src*="${src.split("/").pop()}"]`);

      if (existingScript) {
        resolve();
        return;
      }

      // Additional check for specific classes being available
      const filename = src.split("/").pop();
      if (
        filename === "forge-couple-paste-bridge.js" &&
        window.ForgeCoupleGlobalPasteBridge
      ) {
        resolve();
        return;
      }

      if (
        filename === "shadow-dom-bundle.js" &&
        window.ResourceManager &&
        window.EventBridge &&
        window.BackendBridge
      ) {
        resolve();
        return;
      }

      if (filename === "shadow-forge-couple.js" && window.ShadowForgeCouple) {
        resolve();
        return;
      }

      if (
        filename === "shadow-dom-container.js" &&
        window.ForgeCoupleAdvancedShadowContainer
      ) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;

      script.onload = () => {
        // Debug: Check what classes are available after loading
        const filename = src.split("/").pop();
        if (filename === "shadow-dom-bundle.js") {
        }

        resolve();
      };

      script.onerror = () => {
        console.error(`[ShadowDOMLoader] Failed to load: ${src}`);
        reject(new Error(`Failed to load script: ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load all required scripts in sequence
   * @returns {Promise} Promise that resolves when all scripts are loaded
   */
  async function loadAllScripts() {
    try {
      // First load the global paste bridge
      await loadScript(SCRIPT_BASE_PATH + PASTE_BRIDGE_SCRIPT);

      // Then load the bundle with core classes
      await loadScript(SCRIPT_BASE_PATH + BUNDLE_SCRIPT);

      // Then load the remaining scripts
      for (const script of REMAINING_SCRIPTS) {
        await loadScript(SCRIPT_BASE_PATH + script);
      }

      return true;
    } catch (error) {
      console.error("[ShadowDOMLoader] Failed to load scripts:", error);
      throw error;
    }
  }

  /**
   * Initialize Shadow DOM components
   */
  function initializeShadowDOM() {
    // Verify all required classes are available
    const requiredClasses = [
      "ResourceManager",
      "EventBridge",
      "BackendBridge",
      "ShadowForgeCouple",
      "ForgeCoupleAdvancedShadowContainer",
      "ForgeCoupleDirectInterface",
    ];



    const missingClasses = requiredClasses.filter(
      (className) => typeof window[className] === "undefined"
    );

    if (missingClasses.length > 0) {
      throw new Error(`Missing required classes: ${missingClasses.join(", ")}`);
    }

    // Initialize global event bridge
    const eventBridge = window.EventBridge.getInstance();
    eventBridge.setDebugMode(false); // Set to true for debugging

    // Initialize backend bridge
    window.forgeCoupleBackendBridge = new BackendBridge();
  }

  /**
   * Check if lobe-theme is active with multiple detection methods
   * @returns {boolean} True if lobe-theme is active
   */
  function isLobeThemeActive() {
    // Method 1: Check for lobe-theme specific elements or classes
    if (
      document.querySelector(".lobe-theme") !== null ||
      document.querySelector('[data-theme="lobe"]') !== null
    ) {
      return true;
    }

    // Method 2: Check URL parameters
    if (window.location.search.includes("theme=lobe")) {
      return true;
    }

    // Method 3: Check localStorage
    if (localStorage.getItem("theme") === "lobe") {
      return true;
    }

    // Method 4: Check for React root elements (lobe-theme uses React)
    if (
      document.querySelector("#root") !== null ||
      document.querySelector("[data-reactroot]") !== null
    ) {
      return true;
    }

    // Method 5: Check for lobe-theme specific CSS classes in head
    const stylesheets = Array.from(document.styleSheets);
    for (const sheet of stylesheets) {
      try {
        if (sheet.href && sheet.href.includes("lobe")) {
          return true;
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors
        continue;
      }
    }

    // Method 6: Check for lobe-theme specific global variables
    if (window.__LOBE_THEME__ || window.lobeTheme || window.React) {
      return true;
    }

    // Method 7: Check for specific lobe-theme DOM structure
    if (
      document.querySelector(".ant-layout") !== null ||
      document.querySelector('[class*="lobe"]') !== null ||
      document.querySelector('[class*="ant-"]') !== null
    ) {
      return true;
    }

    // Method 8: Check for modern UI indicators (lobe-theme has modern styling)
    const bodyClasses = document.body.className;
    if (
      bodyClasses.includes("ant-") ||
      bodyClasses.includes("lobe") ||
      bodyClasses.includes("theme") ||
      bodyClasses.includes("react")
    ) {
      return true;
    }

    // Method 9: Check for script tags that indicate lobe-theme
    const scripts = Array.from(document.scripts);
    for (const script of scripts) {
      if (
        script.src &&
        (script.src.includes("lobe") ||
          script.src.includes("main") ||
          script.src.includes("chunk"))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for lobe-theme to be fully loaded
   * @param {number} timeout - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} Promise that resolves when lobe-theme is detected or timeout
   */
  function waitForLobeTheme(timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      function checkLobeTheme() {
        if (isLobeThemeActive()) {
          resolve(true);
          return;
        }

        // Check for timeout
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        // Continue checking
        setTimeout(checkLobeTheme, 100);
      }

      checkLobeTheme();
    });
  }

  /**
   * Find forge-couple extension containers
   * @returns {Object} Object with t2i and i2i containers
   */
  function findForgeCoupleContainers() {
    const containers = {
      t2i: null,
      i2i: null,
    };

    // Look for forge-couple containers in advanced mode (including hidden ones)
    let t2iContainer = document.querySelector("#forge_couple_t2i .fc_adv");
    let i2iContainer = document.querySelector("#forge_couple_i2i .fc_adv");

    // Fallback: search for any .fc_adv elements if standard selectors fail
    if (!t2iContainer || !i2iContainer) {
      const allAdvElements = document.querySelectorAll(".fc_adv");

      allAdvElements.forEach((el, i) => {
        // Assign based on order if we can't determine from IDs
        if (!t2iContainer && i === 0) {
          t2iContainer = el;
        } else if (!i2iContainer && i === 1) {
          i2iContainer = el;
        }
      });
    }

    if (t2iContainer) {
      containers.t2i = t2iContainer;
    }

    if (i2iContainer) {
      containers.i2i = i2iContainer;
    }

    return containers;
  }

  /**
   * Replace original forge-couple advanced mode with Shadow DOM version
   */
  function replaceForgeCoupleAdvancedMode() {
    // Prevent multiple initializations
    if (window._forgeCoupleInitialized) {
      return;
    }

    // Enhanced ForgeCouple global for compatibility with parameter paste system
    if (!window.ForgeCouple) {
      window.ForgeCouple = {
        onEntry: () => {
          // Silent operation to prevent feedback loops
        },
        preview: () => {
          // Silent operation to prevent feedback loops
        },
        onPaste: (mode) => {
          // Bridge parameter paste to shadow DOM
          console.log(`[ShadowDOMLoader] ForgeCouple.onPaste called for mode: ${mode}`);

          let pasteValue = null;
          let pasteField = null;

          // First, try to find the paste field for this mode
          const pasteFieldSelectors = [
            `#forge_couple_${mode} .fc_paste_field textarea`,
            `#forge_couple_${mode} .fc_paste_field input`,
            `.fc_paste_field textarea`,
            `.fc_paste_field input`
          ];

          for (const selector of pasteFieldSelectors) {
            pasteField = document.querySelector(selector);
            if (pasteField && pasteField.value && pasteField.value.trim()) {
              pasteValue = pasteField.value.trim();
              break;
            }
          }

          // If no current paste data, check for early paste data
          if (!pasteValue && window._forgeCoupleEarlyPasteData && window._forgeCoupleEarlyPasteData[mode]) {
            pasteValue = window._forgeCoupleEarlyPasteData[mode];
            console.log(`[ShadowDOMLoader] Using early paste data for ${mode}: ${pasteValue}`);
            // Clear early paste data after use
            delete window._forgeCoupleEarlyPasteData[mode];
          }

          if (pasteValue) {
            console.log(`[ShadowDOMLoader] Found paste data: ${pasteValue}`);

            try {
              const mappingData = JSON.parse(pasteValue);

              // Find the shadow container for this mode
              const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
              if (shadowHost && shadowHost.shadowContainer && shadowHost.shadowContainer.forgeCoupleInstance) {
                console.log(`[ShadowDOMLoader] Applying paste data to shadow DOM for ${mode}`);

                // Convert mapping data to regions format
                const regions = mappingData.map((item, index) => {
                  if (Array.isArray(item) && item.length >= 5) {
                    return {
                      id: index + 1,
                      x1: parseFloat(item[0]) || 0,
                      y1: parseFloat(item[2]) || 0,
                      x2: parseFloat(item[1]) || 1,
                      y2: parseFloat(item[3]) || 1,
                      weight: parseFloat(item[4]) || 1.0,
                      prompt: '',
                      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
                    };
                  }
                  return null;
                }).filter(region => region !== null);

                if (regions.length > 0) {
                  shadowHost.shadowContainer.forgeCoupleInstance.importConfig({ regions });
                  console.log(`[ShadowDOMLoader] Successfully applied ${regions.length} regions to shadow DOM`);

                  // Clear the paste field after a delay to prevent repeated processing
                  if (pasteField) {
                    setTimeout(() => {
                      pasteField.value = "";
                    }, 100);
                  }
                } else {
                  console.warn(`[ShadowDOMLoader] No valid regions found in paste data`);
                }
              } else {
                console.warn(`[ShadowDOMLoader] No shadow container found for mode: ${mode}`);
                // Store the data for later if shadow DOM isn't ready yet
                if (!window._forgeCoupleEarlyPasteData) window._forgeCoupleEarlyPasteData = {};
                window._forgeCoupleEarlyPasteData[mode] = pasteValue;
                console.log(`[ShadowDOMLoader] Stored paste data for later use when shadow DOM is ready`);
              }
            } catch (error) {
              console.error(`[ShadowDOMLoader] Error processing paste data:`, error);
            }
          } else {
            console.warn(`[ShadowDOMLoader] No paste data found for mode: ${mode}`);
          }
        }
      };
    }

    const containers = findForgeCoupleContainers();

    Object.entries(containers).forEach(([mode, container]) => {
      if (!container) return;

      // Create shadow DOM host element
      const shadowHost = document.createElement("div");
      shadowHost.className = "forge-couple-shadow-host";
      shadowHost.dataset.mode = mode;

      // HYBRID APPROACH: Hide original UI but keep gradio components functional
      // Hide the original UI visually but keep the gradio components for backend communication
      container.style.position = "relative";
      container.style.minHeight = "fit-content";
      container.style.overflow = "visible";

      // Hide all visible elements but keep the gradio components
      const visibleElements = container.querySelectorAll(
        "*:not(input):not(textarea):not(select)"
      );
      visibleElements.forEach((el) => {
        if (
          el.tagName !== "INPUT" &&
          el.tagName !== "TEXTAREA" &&
          el.tagName !== "SELECT"
        ) {
          el.style.display = "none";
        }
      });

      // Hide the gradio components visually but keep them functional
      const gradioComponents = container.querySelectorAll(
        "input, textarea, select"
      );
      gradioComponents.forEach((el) => {
        // Special handling for paste field - keep it more accessible for parameter paste system
        if (el.closest('.fc_paste_field')) {
          console.log(`[ShadowDOMLoader] Found paste field for ${mode}, keeping it accessible:`, el);
          // For paste field, just hide it but keep it in the DOM flow
          el.style.display = "none";
          // Ensure it can still receive events and updates
          el.style.pointerEvents = "auto";
        } else {
          // For other components, use the original hiding method
          el.style.position = "absolute";
          el.style.left = "-9999px";
          el.style.visibility = "hidden";
          el.style.pointerEvents = "none";
        }
      });

      // Add our shadow DOM interface on top
      shadowHost.style.position = "relative";
      shadowHost.style.width = "100%";
      shadowHost.style.minHeight = "fit-content";
      shadowHost.style.zIndex = "10";

      container.appendChild(shadowHost);

      // Initialize shadow DOM container
      try {
        const shadowContainer = new ForgeCoupleAdvancedShadowContainer(
          shadowHost,
          mode
        );

        // Store reference for external access
        shadowHost.shadowContainer = shadowContainer;

        // Register with global paste bridge if available
        if (window.forgeCoupleGlobalPasteBridge) {
          window.forgeCoupleGlobalPasteBridge.registerShadowContainer(mode, shadowContainer);
        }

        // Check for early paste data and apply it
        if (window._forgeCoupleEarlyPasteData && window._forgeCoupleEarlyPasteData[mode]) {
          setTimeout(() => {
            if (window.ForgeCouple && window.ForgeCouple.onPaste) {
              window.ForgeCouple.onPaste(mode);
            }
          }, 100);
        }
      } catch (error) {
        // Silent error handling - initialization failed
      }
    });

    // Mark as initialized to prevent multiple calls
    window._forgeCoupleInitialized = true;
  }

  /**
   * Set up global paste field monitoring for early paste events
   */
  function setupGlobalPasteFieldMonitoring() {
    // Store paste data that arrives before shadow DOM is ready
    window._forgeCoupleEarlyPasteData = window._forgeCoupleEarlyPasteData || {};

    // Monitor all paste fields for changes
    const pasteFieldObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for paste fields in added nodes
              const pasteFields = node.querySelectorAll ? node.querySelectorAll('.fc_paste_field textarea, .fc_paste_field input') : [];
              pasteFields.forEach(field => setupPasteFieldListener(field));

              // Check if the node itself is a paste field
              if (node.matches && node.matches('.fc_paste_field textarea, .fc_paste_field input')) {
                setupPasteFieldListener(node);
              }
            }
          });
        }
      });
    });

    // Set up listener for a paste field
    function setupPasteFieldListener(field) {
      if (field._forgeCoupleListenerAttached) return;
      field._forgeCoupleListenerAttached = true;

      const handlePasteFieldChange = () => {
        if (field.value && field.value.trim()) {
          const mode = field.closest('#forge_couple_t2i') ? 't2i' :
                      field.closest('#forge_couple_i2i') ? 'i2i' : 'unknown';

          console.log(`[ShadowDOMLoader] Early paste data detected for ${mode}: ${field.value}`);

          // Store the data for later use
          window._forgeCoupleEarlyPasteData[mode] = field.value.trim();

          // Try to apply immediately if shadow DOM is ready
          if (window.ForgeCouple && window.ForgeCouple.onPaste) {
            setTimeout(() => window.ForgeCouple.onPaste(mode), 50);
          }
        }
      };

      field.addEventListener('input', handlePasteFieldChange);
      field.addEventListener('change', handlePasteFieldChange);
    }

    // Set up initial listeners for existing fields
    document.querySelectorAll('.fc_paste_field textarea, .fc_paste_field input').forEach(setupPasteFieldListener);

    // Start observing
    pasteFieldObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Set up observers for dynamic content
   */
  function setupObservers() {
    // Set up global paste field monitoring
    setupGlobalPasteFieldMonitoring();

    // Observer for forge-couple containers appearing dynamically
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;

            // Check if forge-couple advanced mode was added
            if (element.matches && element.matches(".fc_adv")) {
              setTimeout(() => replaceForgeCoupleAdvancedMode(), 100);
            }

            // Check for child elements
            const advElements =
              element.querySelectorAll && element.querySelectorAll(".fc_adv");
            if (advElements && advElements.length > 0) {
              setTimeout(() => replaceForgeCoupleAdvancedMode(), 100);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Main initialization function
   */
  async function initialize() {
    if (isLoaded) {
      return loadPromise;
    }

    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = (async () => {
      try {
        // Wait for lobe-theme to be fully loaded
        const lobeThemeActive = await waitForLobeTheme();

        if (!lobeThemeActive) {
          return false;
        }

        // Load all required scripts
        await loadAllScripts();

        // Initialize Shadow DOM components
        initializeShadowDOM();

        // Wait a bit more for DOM to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Replace existing forge-couple advanced mode
        replaceForgeCoupleAdvancedMode();

        // Set up observers for dynamic content
        setupObservers();

        // Additional initialization attempt after a delay (for timing issues)
        setTimeout(() => {
          replaceForgeCoupleAdvancedMode();
        }, 2000);

        isLoaded = true;

        // Emit initialization complete event
        const eventBridge = window.EventBridge.getInstance();
        eventBridge.emit("shadow-dom:initialized", {
          timestamp: Date.now(),
          lobeThemeActive: true,
        });

        return true;
      } catch (error) {
        console.error("[ShadowDOMLoader] Initialization failed:", error);
        throw error;
      }
    })();

    return loadPromise;
  }

  // Auto-initialize with multiple timing strategies
  function scheduleInitialization() {
    // Strategy 1: Wait for DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(initialize, 1000); // Give lobe-theme time to load
      });
    } else {
      // DOM is already ready, wait a bit longer for lobe-theme
      setTimeout(initialize, 2000);
    }

    // Strategy 2: Also try after window load (fallback)
    window.addEventListener("load", () => {
      setTimeout(() => {
        if (!isLoaded) {
          initialize();
        }
      }, 3000);
    });

    // Strategy 3: Periodic check for lobe-theme (ultimate fallback)
    let checkCount = 0;
    const maxChecks = 30; // Check for 30 seconds
    const periodicCheck = setInterval(() => {
      checkCount++;

      if (isLoaded || checkCount >= maxChecks) {
        clearInterval(periodicCheck);
        return;
      }

      if (isLobeThemeActive()) {
        clearInterval(periodicCheck);
        initialize();
      }
    }, 1000);
  }

  scheduleInitialization();

  // Expose initialization function globally
  window.initializeForgeCoupleShawDOM = initialize;
})();
