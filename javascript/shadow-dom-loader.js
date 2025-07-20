/**
 * Shadow DOM Loader for forge-couple lobe-theme integration
 * Loads and initializes all required components for Shadow DOM isolation
 */
(function () {
  "use strict";

  // Configuration - use bundled approach to avoid path issues
  const BUNDLE_SCRIPT = "shadow-dom-bundle.js";
  const REMAINING_SCRIPTS = [
    "shadow-forge-couple.js",
    "shadow-dom-container.js",
    "direct-backend-hook.js",
    "backend-to-frontend-sync.js",
    "smart-paste-handler.js",
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
      // First load the bundle with core classes
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
      console.error(
        `[ShadowDOMLoader] Missing classes: ${missingClasses.join(", ")}`
      );
      console.log(
        "[ShadowDOMLoader] Available window properties:",
        Object.keys(window).filter(
          (k) =>
            k.includes("Resource") ||
            k.includes("Event") ||
            k.includes("Backend") ||
            k.includes("Shadow") ||
            k.includes("ForgeCouple")
        )
      );
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

    // Look for forge-couple containers in advanced mode
    const t2iContainer = document.querySelector("#forge_couple_t2i .fc_adv");
    const i2iContainer = document.querySelector("#forge_couple_i2i .fc_adv");

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
    // Ensure ForgeCouple global exists before creating shadow containers
    if (!window.ForgeCouple) {
      window.ForgeCouple = {
        dataframe: {
          t2i: { body: document.createElement('tbody') },
          i2i: { body: document.createElement('tbody') }
        },
        entryField: {
          t2i: document.createElement('input'),
          i2i: document.createElement('input')
        },
        onEntry: () => {
          // Silent operation to prevent feedback loops
        },
        preview: () => {
          // Silent operation to prevent feedback loops
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
        el.style.position = "absolute";
        el.style.left = "-9999px";
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
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
      } catch (error) {
        console.error(
          `[ShadowDOMLoader] Failed to initialize ${mode} Shadow DOM:`,
          error
        );
      }
    });
  }

  /**
   * Set up observers for dynamic content
   */
  function setupObservers() {
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
