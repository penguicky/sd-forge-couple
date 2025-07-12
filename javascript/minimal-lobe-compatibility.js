// ===== MINIMAL FORGE-COUPLE LOBE-THEME COMPATIBILITY =====
// This script provides minimal, non-interfering compatibility between lobe-theme and forge-couple
// It ONLY prevents lobe-theme from hiding forge-couple elements, without changing existing functionality

(function () {
  "use strict";

  const utils = {
    log: (message, ...args) => {
      console.log("[ForgeCouple-Minimal]", message, ...args);
    },

    error: (message, ...args) => {
      console.error("[ForgeCouple-Minimal]", message, ...args);
    },
  };

  // Protected selectors that should never be hidden by lobe-theme
  const PROTECTED_SELECTORS = [
    "#forge_couple_t2i",
    "#forge_couple_i2i",
    ".fc_mapping",
    ".fc_preview_img",
    ".fc_bbox",
    ".fc_mapping_btns",
    ".fc_bg_btns",
    ".fc_adv",
    ".fc_bsc",
    ".fc_msk",
    ".fc_msk_gal",
    ".fc_masks",
    ".fc_row_btns",
    ".fc_preview_res",
    ".fc_preview",
    ".fc_paste_field",
    ".fc_entry_field",
  ];

  // Color palette for regions
  const REGION_COLORS = [
    { border: "#ff0000", bg: "rgba(255, 0, 0, 0.15)", name: "red" },
    { border: "#0066ff", bg: "rgba(0, 102, 255, 0.15)", name: "blue" },
    { border: "#00cc00", bg: "rgba(0, 204, 0, 0.15)", name: "green" },
    { border: "#ff8800", bg: "rgba(255, 136, 0, 0.15)", name: "orange" },
    { border: "#8800ff", bg: "rgba(136, 0, 255, 0.15)", name: "purple" },
    { border: "#ffcc00", bg: "rgba(255, 204, 0, 0.15)", name: "yellow" },
    { border: "#00ccff", bg: "rgba(0, 204, 255, 0.15)", name: "cyan" },
    { border: "#ff0088", bg: "rgba(255, 0, 136, 0.15)", name: "magenta" },
  ];

  // Global state for bounding box management
  let selectedRegionIndex = -1;
  let allBoundingBoxes = new Map(); // regionIndex -> bbox element
  let resolutionObserver = null;
  let currentResolution = { width: 512, height: 512 };

  /**
   * Get current WebUI resolution settings
   */
  function getCurrentResolution() {
    // Try multiple strategies to find width and height inputs
    let widthInput = null;
    let heightInput = null;
    let width = 512;
    let height = 512;

    // Strategy 1: Look for visible tab-specific inputs
    const visibleInputs = document.querySelectorAll(
      'input[type="number"]:not([style*="display: none"])'
    );

    for (const input of visibleInputs) {
      if (
        input.id &&
        input.id.includes("width") &&
        input.offsetParent !== null
      ) {
        widthInput = input;
      }
      if (
        input.id &&
        input.id.includes("height") &&
        input.offsetParent !== null
      ) {
        heightInput = input;
      }
    }

    // Strategy 2: Try specific selectors for current active tab
    if (!widthInput || !heightInput) {
      const tabSelectors = [
        ["#txt2img_width input", "#txt2img_height input"],
        ["#img2img_width input", "#img2img_height input"],
        ['input[id*="width"]', 'input[id*="height"]'],
      ];

      for (const [wSelector, hSelector] of tabSelectors) {
        const w = document.querySelector(wSelector);
        const h = document.querySelector(hSelector);
        if (w && h && w.offsetParent !== null && h.offsetParent !== null) {
          widthInput = w;
          heightInput = h;
          break;
        }
      }
    }

    // Strategy 3: Find any width/height inputs that are visible and have values
    if (!widthInput || !heightInput) {
      const allInputs = Array.from(
        document.querySelectorAll('input[type="number"]')
      ).filter((input) => input.offsetParent !== null && input.value);

      for (const input of allInputs) {
        const id = input.id?.toLowerCase() || "";
        const name = input.name?.toLowerCase() || "";

        if ((id.includes("width") || name.includes("width")) && !widthInput) {
          widthInput = input;
        }
        if (
          (id.includes("height") || name.includes("height")) &&
          !heightInput
        ) {
          heightInput = input;
        }
      }
    }

    // Extract values
    if (widthInput && widthInput.value) {
      width = parseInt(widthInput.value) || 512;
    }
    if (heightInput && heightInput.value) {
      height = parseInt(heightInput.value) || 512;
    }

    // Ensure reasonable bounds
    width = Math.max(256, Math.min(width, 2048));
    height = Math.max(256, Math.min(height, 2048));

    utils.log(
      `Resolution detected: ${width}x${height} (inputs: ${
        widthInput?.id || "none"
      }, ${heightInput?.id || "none"})`
    );
    return { width, height };
  }

  /**
   * Get color for region index
   */
  function getRegionColor(index) {
    return REGION_COLORS[index % REGION_COLORS.length];
  }

  /**
   * Setup resolution monitoring for dynamic preview resizing
   */
  function setupResolutionMonitoring() {
    const handleResolutionChange = () => {
      setTimeout(() => {
        const newResolution = getCurrentResolution();

        // Check if resolution actually changed
        if (
          newResolution.width !== currentResolution.width ||
          newResolution.height !== currentResolution.height
        ) {
          utils.log(
            `Resolution changed: ${currentResolution.width}x${currentResolution.height} → ${newResolution.width}x${newResolution.height}`
          );
          currentResolution = newResolution;

          // Update all preview containers immediately
          updateAllPreviewContainers();

          // Also force a re-setup of bounding boxes to match new dimensions
          setTimeout(() => {
            setupBoundingBoxSystem();
          }, 200);
        }
      }, 50); // Reduced delay for faster response
    };

    // Monitor for input changes more broadly with specific targeting
    const setupInputListeners = () => {
      // Target specific resolution inputs
      const resolutionSelectors = [
        '#txt2img_width input[type="number"]',
        '#txt2img_height input[type="number"]',
        '#img2img_width input[type="number"]',
        '#img2img_height input[type="number"]',
      ];

      resolutionSelectors.forEach((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.removeEventListener("input", handleResolutionChange);
          input.removeEventListener("change", handleResolutionChange);
          input.addEventListener("input", handleResolutionChange);
          input.addEventListener("change", handleResolutionChange);
          utils.log(`Added resolution listener to: ${input.id || selector}`);
        }
      });

      // Also monitor any other width/height inputs as fallback
      const allInputs = document.querySelectorAll('input[type="number"]');
      allInputs.forEach((input) => {
        if (
          input.id &&
          (input.id.toLowerCase().includes("width") ||
            input.id.toLowerCase().includes("height")) &&
          !input.hasAttribute("data-fc-listener")
        ) {
          input.removeEventListener("input", handleResolutionChange);
          input.removeEventListener("change", handleResolutionChange);
          input.addEventListener("input", handleResolutionChange);
          input.addEventListener("change", handleResolutionChange);
          input.setAttribute("data-fc-listener", "true");
          utils.log(`Added fallback resolution listener to: ${input.id}`);
        }
      });
    };

    // Initial setup
    setupInputListeners();

    // Monitor for DOM changes
    if (!resolutionObserver) {
      resolutionObserver = new MutationObserver((mutations) => {
        let shouldResetup = false;
        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (
                node.nodeType === 1 &&
                (node.tagName === "INPUT" || node.querySelector("input"))
              ) {
                shouldResetup = true;
              }
            });
          }
        });

        if (shouldResetup) {
          setTimeout(setupInputListeners, 100);
        }
      });

      resolutionObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Also add a periodic check for resolution changes
    setInterval(() => {
      const newResolution = getCurrentResolution();
      if (
        newResolution.width !== currentResolution.width ||
        newResolution.height !== currentResolution.height
      ) {
        utils.log(
          `Periodic resolution check detected change: ${currentResolution.width}x${currentResolution.height} → ${newResolution.width}x${newResolution.height}`
        );
        currentResolution = newResolution;
        updateAllPreviewContainers();
      }
    }, 1000); // Check every second
  }

  /**
   * Update all preview containers when resolution changes
   */
  function updateAllPreviewContainers() {
    const previewContainers = document.querySelectorAll(".fc_preview_img");

    previewContainers.forEach((container) => {
      updatePreviewContainerSize(container);
    });
  }

  /**
   * Update a single preview container size and resize bounding boxes
   */
  function updatePreviewContainerSize(previewContainer) {
    if (!previewContainer) return;

    const resolution = getCurrentResolution();
    const aspectRatio = resolution.width / resolution.height;

    // Use the same sizing logic as setupPreviewContainer
    const maxDimension = 400;

    let containerWidth, containerHeight;
    if (aspectRatio >= 1) {
      // Landscape or square: width is the limiting factor
      containerWidth = maxDimension;
      containerHeight = Math.round(maxDimension / aspectRatio);
    } else {
      // Portrait: height is the limiting factor
      containerHeight = maxDimension;
      containerWidth = Math.round(maxDimension * aspectRatio);
    }

    // Ensure minimum sizes for usability
    containerWidth = Math.max(containerWidth, 200);
    containerHeight = Math.max(containerHeight, 200);

    // Store old dimensions for scaling
    const oldWidth = previewContainer.offsetWidth;
    const oldHeight = previewContainer.offsetHeight;

    // Update container size with important flags to override any conflicting styles
    previewContainer.style.setProperty(
      "width",
      `${containerWidth}px`,
      "important"
    );
    previewContainer.style.setProperty(
      "height",
      `${containerHeight}px`,
      "important"
    );
    previewContainer.style.setProperty(
      "max-width",
      `${containerWidth}px`,
      "important"
    );
    previewContainer.style.setProperty(
      "max-height",
      `${containerHeight}px`,
      "important"
    );

    utils.log(
      `Updated preview container size: ${containerWidth}x${containerHeight} (was ${oldWidth}x${oldHeight})`
    );

    // Scale all bounding boxes proportionally
    const bboxContainer = previewContainer.querySelector(".fc-bbox-container");
    if (bboxContainer && oldWidth > 0 && oldHeight > 0) {
      const scaleX = containerWidth / oldWidth;
      const scaleY = containerHeight / oldHeight;

      const bboxes = bboxContainer.querySelectorAll(".fc-bbox");
      bboxes.forEach((bbox) => {
        const currentLeft = parseFloat(bbox.style.left) || 0;
        const currentTop = parseFloat(bbox.style.top) || 0;
        const currentWidth = parseFloat(bbox.style.width) || 0;
        const currentHeight = parseFloat(bbox.style.height) || 0;

        bbox.style.left = `${currentLeft * scaleX}px`;
        bbox.style.top = `${currentTop * scaleY}px`;
        bbox.style.width = `${currentWidth * scaleX}px`;
        bbox.style.height = `${currentHeight * scaleY}px`;
      });
    }

    utils.log(
      `Updated preview container to ${containerWidth}x${containerHeight} (${resolution.width}x${resolution.height})`
    );
  }

  /**
   * Check if an element should be protected from hiding
   */
  function isElementProtected(element) {
    if (!element) return false;

    // Check if element or any parent has protected classes/IDs
    let current = element;
    while (current && current !== document.body) {
      // Check ID
      if (
        current.id &&
        (current.id.includes("forge_couple") || current.id.startsWith("fc_"))
      ) {
        return true;
      }

      // Check classes
      if (current.classList) {
        for (const className of current.classList) {
          if (
            className.startsWith("fc_") ||
            className.includes("forge-couple")
          ) {
            return true;
          }
        }
      }

      current = current.parentElement;
    }

    return false;
  }

  /**
   * Force element visibility
   */
  function forceElementVisibility(element) {
    if (!element) return;

    // Only restore visibility if it was hidden, don't override existing styles
    if (element.style.display === "none") {
      element.style.display = "";
      element.style.visibility = "visible";
      element.style.opacity = "1";
      element.classList.add("fc-lobe-protected");
      utils.log("Restored visibility for protected element:", element);
    }
  }

  /**
   * Setup comprehensive forge-couple functionality restoration
   */
  function setupElementProtection() {
    utils.log(
      "Setting up comprehensive forge-couple functionality restoration..."
    );

    // 1. Restore normal accordion functionality
    restoreAccordionFunctionality();

    // 2. Restore mode switching
    restoreModeSwitching();

    // 3. Protect critical content elements only
    protectContentElements();

    // 4. Setup bounding box functionality
    setupBoundingBoxSystem();

    // 5. Monitor for interference and restore
    setupInterferenceMonitoring();

    utils.log("Comprehensive functionality restoration complete");
  }

  /**
   * Restore normal accordion collapse/expand functionality
   */
  function restoreAccordionFunctionality() {
    ["t2i", "i2i"].forEach((mode) => {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      // Only ensure accordion can be clicked - don't force visibility
      const labelWrap = accordion.querySelector(".label-wrap");
      if (labelWrap) {
        labelWrap.style.pointerEvents = "auto";
        labelWrap.style.cursor = "pointer";
      }

      utils.log(`Ensured accordion clickability for ${mode}`);
    });
  }

  /**
   * Restore proper mode switching (only one mode visible at a time)
   */
  function restoreModeSwitching() {
    ["t2i", "i2i"].forEach((mode) => {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      // Find mode radio buttons
      const modeRadios = accordion.querySelectorAll('input[type="radio"]');
      const modeContainers = {
        Basic: accordion.querySelector(".fc_bsc"),
        Advanced: accordion.querySelector(".fc_adv"),
        Mask: accordion.querySelector(".fc_msk"),
      };

      // Find which mode is currently selected
      let selectedMode = "Basic"; // default
      modeRadios.forEach((radio) => {
        if (
          radio.checked &&
          ["Basic", "Advanced", "Mask"].includes(radio.value)
        ) {
          selectedMode = radio.value;
        }
      });

      // Show only the selected mode - respect Gradio's hide class
      Object.entries(modeContainers).forEach(([modeName, container]) => {
        if (container) {
          if (modeName === selectedMode) {
            // Only show if not hidden by Gradio
            if (!container.classList.contains("hide")) {
              container.style.display = "";
              container.style.visibility = "visible";
            }
          } else {
            container.style.display = "none";
          }
        }
      });

      // Add event listeners for mode switching
      modeRadios.forEach((radio) => {
        if (["Basic", "Advanced", "Mask"].includes(radio.value)) {
          radio.addEventListener("change", () => {
            if (radio.checked) {
              // Hide all modes
              Object.values(modeContainers).forEach((container) => {
                if (container) container.style.display = "none";
              });

              // Show selected mode only if not hidden by Gradio
              const selectedContainer = modeContainers[radio.value];
              if (
                selectedContainer &&
                !selectedContainer.classList.contains("hide")
              ) {
                selectedContainer.style.display = "";
                selectedContainer.style.visibility = "visible";
              }

              utils.log(`Mode switched to ${radio.value} for ${mode}`);
            }
          });
        }
      });

      utils.log(
        `Restored mode switching for ${mode}, current mode: ${selectedMode}`
      );
    });
  }

  /**
   * Protect only critical content elements from being hidden
   */
  function protectContentElements() {
    // Create a mutation observer to protect forge-couple content elements
    const protectionObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const element = mutation.target;
          if (isElementProtected(element)) {
            // Only restore visibility if it was hidden and it's a content element
            if (element.style.display === "none" && isContentElement(element)) {
              forceElementVisibility(element);
            }
          }
        }
      });
    });

    // Start observing
    protectionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
      subtree: true,
    });

    // Initial protection pass - only restore hidden content elements
    PROTECTED_SELECTORS.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (element.style.display === "none" && isContentElement(element)) {
          forceElementVisibility(element);
        }
      });
    });
  }

  /**
   * Check if element is a content element (not a container)
   */
  function isContentElement(element) {
    if (!element || !element.classList) return false;

    // Don't protect mode containers or main accordions
    const containerClasses = ["fc_bsc", "fc_adv", "fc_msk"];
    for (const className of element.classList) {
      if (containerClasses.includes(className)) return false;
    }

    if (element.id && element.id.includes("forge_couple_")) return false;

    return true;
  }

  /**
   * Setup bounding box functionality for Advanced mode
   */
  function setupBoundingBoxSystem() {
    utils.log("Setting up bounding box system...");

    ["t2i", "i2i"].forEach((mode) => {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) {
        utils.log(`No accordion found for ${mode}`);
        return;
      }

      const advContainer = accordion.querySelector(".fc_adv");
      if (!advContainer) {
        utils.log(`No advanced container found for ${mode}`);
        return;
      }

      utils.log(`Setting up bounding boxes for ${mode}...`);

      // Create mapping table if it doesn't exist
      createMappingTable(mode, advContainer);

      // Setup preview image container for bounding boxes
      setupPreviewContainer(mode, advContainer);

      // Setup mapping table interactions
      setupMappingTableInteractions(mode, advContainer);

      utils.log(`Bounding box system setup complete for ${mode}`);
    });

    // Also setup a delayed version in case elements aren't ready
    setTimeout(() => {
      utils.log("Running delayed bounding box setup...");
      setupBoundingBoxSystemDelayed();
    }, 2000);
  }

  /**
   * Delayed setup for bounding boxes (in case elements load later)
   */
  function setupBoundingBoxSystemDelayed() {
    ["t2i", "i2i"].forEach((mode) => {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      const advContainer = accordion.querySelector(".fc_adv");
      if (!advContainer) return;

      // Only setup if not already done
      if (!advContainer.querySelector(".fc-mapping-table")) {
        utils.log(`Delayed setup for ${mode}...`);
        createMappingTable(mode, advContainer);
        setupPreviewContainer(mode, advContainer);
        setupMappingTableInteractions(mode, advContainer);
      }
    });
  }

  /**
   * Create interactive mapping table
   */
  function createMappingTable(mode, container) {
    let mappingDiv = container.querySelector(".fc_mapping");
    if (!mappingDiv) {
      mappingDiv = document.createElement("div");
      mappingDiv.className = "fc_mapping fc-lobe-protected";
      container.appendChild(mappingDiv);
    }

    // Create table structure with controls
    const tableHTML = `
      <div class="fc-mapping-controls" style="margin: 10px 0; display: flex; gap: 10px; align-items: center;">
        <button class="fc-add-row-btn" style="padding: 5px 10px; background: var(--button-primary-background-fill); color: var(--button-primary-text-color); border: 1px solid var(--border-color-primary); border-radius: 4px; cursor: pointer;">
          ➕ Add Row
        </button>
        <button class="fc-delete-row-btn" style="padding: 5px 10px; background: var(--button-secondary-background-fill); color: var(--button-secondary-text-color); border: 1px solid var(--border-color-primary); border-radius: 4px; cursor: pointer;">
          ➖ Delete
        </button>
        <button class="fc-reset-mapping-btn" style="padding: 5px 10px; background: var(--button-secondary-background-fill); color: var(--button-secondary-text-color); border: 1px solid var(--border-color-primary); border-radius: 4px; cursor: pointer;">
          🔄 Reset
        </button>
        <div style="margin-left: auto; display: flex; gap: 10px;">
          <button class="fc-load-img-btn" style="padding: 5px 10px; background: var(--button-secondary-background-fill); color: var(--button-secondary-text-color); border: 1px solid var(--border-color-primary); border-radius: 4px; cursor: pointer;">
            📂 Load Image
          </button>
          <button class="fc-clear-img-btn" style="padding: 5px 10px; background: var(--button-secondary-background-fill); color: var(--button-secondary-text-color); border: 1px solid var(--border-color-primary); border-radius: 4px; cursor: pointer;">
            🗑 Delete Image
          </button>
        </div>
      </div>
      <table class="fc-mapping-table" style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background: var(--background-fill-secondary);">
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">Region</th>
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">X1</th>
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">X2</th>
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">Y1</th>
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">Y2</th>
            <th style="padding: 8px; border: 1px solid var(--border-color-primary);">Weight</th>
          </tr>
        </thead>
        <tbody class="fc-mapping-tbody">
          <tr class="fc-mapping-row" style="cursor: pointer; background-color: rgba(255, 0, 0, 0.1);">
            <td style="padding: 8px; border: 1px solid var(--border-color-primary); border-left: 4px solid #ff0000;">Region 1</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.5</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
          </tr>
          <tr class="fc-mapping-row" style="cursor: pointer; background-color: rgba(0, 102, 255, 0.1);">
            <td style="padding: 8px; border: 1px solid var(--border-color-primary); border-left: 4px solid #0066ff;">Region 2</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.5</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
            <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
          </tr>
        </tbody>
      </table>
    `;

    mappingDiv.innerHTML = tableHTML;

    // Setup control button functionality
    setupTableControls(mode, mappingDiv);

    // Setup background image controls
    setupBackgroundImageControls(mode, mappingDiv);
  }

  /**
   * Setup preview image container for bounding boxes
   */
  function setupPreviewContainer(mode, container) {
    utils.log(`Setting up preview container for ${mode}...`);

    // First, find the preview container
    const previewContainer = container.querySelector(".fc_preview_img");
    if (!previewContainer) {
      utils.log(`No .fc_preview_img container found for ${mode}`);
      return;
    }

    utils.log(`Found preview container for ${mode}:`, previewContainer);
    utils.log(`Preview container children:`, previewContainer.children.length);

    // Log all children for debugging
    Array.from(previewContainer.children).forEach((child, i) => {
      utils.log(`  Child ${i}:`, child.tagName, child.className, child.id);
    });

    // Try to find any image element inside
    let previewImg = previewContainer.querySelector("img");
    if (!previewImg) {
      previewImg = previewContainer.querySelector(".forge-image");
    }
    if (!previewImg) {
      // Look for any element that might be an image
      const allElements = previewContainer.querySelectorAll("*");
      for (const el of allElements) {
        if (
          el.tagName === "IMG" ||
          el.classList.contains("forge-image") ||
          el.src
        ) {
          previewImg = el;
          break;
        }
      }
    }

    if (previewImg) {
      utils.log(`Found preview image for ${mode}:`, previewImg);
    } else {
      utils.log(
        `No preview image found inside container for ${mode}, proceeding anyway...`
      );
    }

    // Get current resolution and setup dynamic sizing to match WebUI resolution
    const resolution = getCurrentResolution();
    currentResolution = resolution; // Update global state
    const aspectRatio = resolution.width / resolution.height;

    // Use a consistent base size that maintains aspect ratio
    const maxDimension = 400; // Reduced from 512 for better UI fit

    let containerWidth, containerHeight;
    if (aspectRatio >= 1) {
      // Landscape or square: width is the limiting factor
      containerWidth = maxDimension;
      containerHeight = Math.round(maxDimension / aspectRatio);
    } else {
      // Portrait: height is the limiting factor
      containerHeight = maxDimension;
      containerWidth = Math.round(maxDimension * aspectRatio);
    }

    // Ensure minimum sizes for usability
    containerWidth = Math.max(containerWidth, 200);
    containerHeight = Math.max(containerHeight, 200);

    // Ensure preview container has proper positioning and dynamic sizing
    previewContainer.style.position = "relative";
    previewContainer.style.display = "block";
    previewContainer.style.width = `${containerWidth}px`;
    previewContainer.style.height = `${containerHeight}px`;
    previewContainer.style.border = "1px solid var(--border-color-primary)";
    previewContainer.style.overflow = "hidden";

    utils.log(
      `Preview container sized to ${containerWidth}x${containerHeight} (aspect ratio: ${aspectRatio.toFixed(
        2
      )})`
    );

    // Ensure image has proper dimensions if it exists
    if (previewImg && previewImg.tagName === "IMG") {
      previewImg.style.width = "100%";
      previewImg.style.height = "100%";
      previewImg.style.objectFit = "contain";
      previewImg.style.display = "block";
    }

    // Create bounding box container
    let bboxContainer = previewContainer.querySelector(".fc-bbox-container");
    if (!bboxContainer) {
      bboxContainer = document.createElement("div");
      bboxContainer.className = "fc-bbox-container";
      bboxContainer.style.position = "absolute";
      bboxContainer.style.top = "0";
      bboxContainer.style.left = "0";
      bboxContainer.style.width = "100%";
      bboxContainer.style.height = "100%";
      bboxContainer.style.pointerEvents = "none";
      bboxContainer.style.zIndex = "999";
      bboxContainer.style.backgroundColor = "rgba(0,0,0,0.05)"; // Slight tint to see it
      previewContainer.appendChild(bboxContainer);

      utils.log(`Created bounding box container for ${mode}:`, bboxContainer);
    } else {
      utils.log(`Bounding box container already exists for ${mode}`);
    }
  }

  /**
   * Setup mapping table click interactions with multi-box support
   */
  function setupMappingTableInteractions(mode, container) {
    const mappingTable = container.querySelector(".fc-mapping-table");
    if (!mappingTable) return;

    const rows = mappingTable.querySelectorAll(".fc-mapping-row");
    const previewContainer = container.querySelector(".fc_preview_img");
    const bboxContainer = container.querySelector(".fc-bbox-container");

    if (!bboxContainer) return;

    // Clear existing bounding boxes and recreate them to ensure clean state
    allBoundingBoxes.clear();
    bboxContainer.innerHTML = "";

    // Create all bounding boxes initially
    createAllBoundingBoxes(bboxContainer, rows);

    rows.forEach((row, index) => {
      row.addEventListener("click", () => {
        // Use simple index-based selection (like checkpoint 16)
        selectRegion(index, rows, bboxContainer);
        utils.log(`Selected region ${index + 1}`);
      });

      // Add event listeners for editable cells
      const editableCells = row.querySelectorAll(".fc-editable");
      editableCells.forEach((cell, cellIndex) => {
        // Make cell properly editable
        cell.setAttribute("contenteditable", "true");
        cell.style.outline = "none";

        // Allow proper decimal input
        cell.addEventListener("keydown", (e) => {
          // Allow: backspace, delete, tab, escape, enter, period, and numbers
          if (
            [46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true) ||
            // Allow home, end, left, right, arrows
            (e.keyCode >= 35 && e.keyCode <= 40)
          ) {
            return;
          }
          // Ensure that it is a number and stop the keypress
          if (
            (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
            (e.keyCode < 96 || e.keyCode > 105)
          ) {
            e.preventDefault();
          }
        });

        cell.addEventListener("blur", () => {
          // Validate and constrain input on blur
          let value = parseFloat(cell.textContent);

          if (isNaN(value)) {
            value = cellIndex === 4 ? 1.0 : 1.0; // Default for invalid input
          } else {
            if (cellIndex === 4) {
              // Weight column: 0.0 to 5.0, default 1.0
              value = Math.max(0, Math.min(5, value));
            } else {
              // Coordinate columns: 0.0 to 1.0, default 1.0
              value = Math.max(0, Math.min(1, value));
            }
          }

          cell.textContent = value.toFixed(3);

          // Update bounding box when table values change
          updateBoundingBoxFromTable(index, row, bboxContainer);
        });

        cell.addEventListener("input", () => {
          // Real-time validation during input
          const text = cell.textContent;
          const value = parseFloat(text);

          // Only update if it's a valid number within appropriate range
          if (!isNaN(value)) {
            if (cellIndex === 4) {
              // Weight column
              if (value >= 0 && value <= 5) {
                updateBoundingBoxFromTable(index, row, bboxContainer);
              }
            } else {
              // Coordinate columns
              if (value >= 0 && value <= 1) {
                updateBoundingBoxFromTable(index, row, bboxContainer);
              }
            }
          }
        });
      });
    });

    // Select first region by default (simple index-based like checkpoint 16)
    if (rows.length > 0) {
      // Small delay to ensure bounding boxes are fully created
      setTimeout(() => {
        selectRegion(0, rows, bboxContainer);
        utils.log(
          `Initial selection set to region 0, total boxes: ${allBoundingBoxes.size}`
        );
      }, 50);
    }
  }

  /**
   * Create all bounding boxes for all regions
   */
  function createAllBoundingBoxes(container, rows) {
    Array.from(rows).forEach((row, index) => {
      const cells = row.querySelectorAll("td");
      const x1 = parseFloat(cells[1].textContent);
      const x2 = parseFloat(cells[2].textContent);
      const y1 = parseFloat(cells[3].textContent);
      const y2 = parseFloat(cells[4].textContent);

      // First box is selected by default (like checkpoint 16)
      const isSelected = index === 0;
      createSingleBoundingBox(container, index, x1, x2, y1, y2, isSelected);
    });
  }

  /**
   * Select a specific region and update visual states
   */
  function selectRegion(index, rows, bboxContainer) {
    selectedRegionIndex = index;
    utils.log(
      `Selecting region ${index}, available boxes:`,
      Array.from(allBoundingBoxes.keys())
    );

    // Update table row selection (simple index-based like checkpoint 16)
    Array.from(rows).forEach((row, i) => {
      const color = getRegionColor(i);
      if (i === index) {
        // Selected row - highlighted background
        row.style.backgroundColor = color.bg.replace("0.15", "0.3");
        row.style.fontWeight = "bold";
      } else {
        // Unselected row - subtle background
        row.style.backgroundColor = color.bg;
        row.style.fontWeight = "normal";
      }
    });

    // Update bounding box states - only selected box is interactive
    allBoundingBoxes.forEach((bbox, i) => {
      if (i === index) {
        // Selected box - interactive with full opacity and drag/resize capability
        bbox.style.opacity = "1";
        bbox.style.pointerEvents = "auto";
        bbox.style.zIndex = "1001";
        // Show resize handles
        bbox.querySelectorAll(".fc-resize-handle").forEach((handle) => {
          handle.style.display = "block";
        });
      } else {
        // Unselected box - visible but non-interactive
        bbox.style.opacity = "0.5";
        bbox.style.pointerEvents = "none";
        bbox.style.zIndex = "1000";
        // Hide resize handles
        bbox.querySelectorAll(".fc-resize-handle").forEach((handle) => {
          handle.style.display = "none";
        });
      }
    });
  }

  /**
   * Create single bounding box with color coding and constraints
   */
  function createSingleBoundingBox(
    container,
    index,
    x1,
    x2,
    y1,
    y2,
    isSelected = false
  ) {
    const color = getRegionColor(index);

    // Create new bounding box
    const bbox = document.createElement("div");
    bbox.className = `fc-bbox fc-bbox-${index}`;
    bbox.style.position = "absolute";
    bbox.style.border = `2px solid ${color.border}`;
    bbox.style.backgroundColor = color.bg;
    bbox.style.pointerEvents = isSelected ? "auto" : "none";
    bbox.style.cursor = "move";
    bbox.style.zIndex = isSelected ? "1001" : "1000";
    bbox.style.minWidth = "20px";
    bbox.style.minHeight = "20px";
    bbox.style.opacity = isSelected ? "1" : "0.5";

    // Calculate position and size using exact table coordinates
    const containerWidth = container.offsetWidth || 512; // Fallback if container not ready
    const containerHeight = container.offsetHeight || 512;

    const left = x1 * containerWidth;
    const top = y1 * containerHeight;
    const width = (x2 - x1) * containerWidth;
    const height = (y2 - y1) * containerHeight;

    // Apply exact coordinates for initial positioning
    bbox.style.left = `${left}px`;
    bbox.style.top = `${top}px`;
    bbox.style.width = `${width}px`;
    bbox.style.height = `${height}px`;

    utils.log(
      `Created bbox ${
        index + 1
      }: coords [${x1}, ${x2}, ${y1}, ${y2}] -> position [${left}, ${top}, ${width}, ${height}] (container: ${containerWidth}x${containerHeight})`
    );

    // Add label
    const label = document.createElement("div");
    label.textContent = `Region ${index + 1}`;
    label.style.position = "absolute";
    label.style.top = "-20px";
    label.style.left = "0";
    label.style.fontSize = "12px";
    label.style.color = color.border;
    label.style.fontWeight = "bold";
    label.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    label.style.padding = "2px 4px";
    label.style.borderRadius = "2px";
    label.style.pointerEvents = "none";
    label.style.border = `1px solid ${color.border}`;
    bbox.appendChild(label);

    // Add resize handles
    addResizeHandles(bbox, color.border);

    // Add drag and resize functionality
    makeDraggableAndResizable(bbox, container, index);

    // Store in global map
    allBoundingBoxes.set(index, bbox);
    container.appendChild(bbox);
    utils.log(
      `Created and stored bounding box ${index}, map size: ${allBoundingBoxes.size}`
    );

    utils.log(
      `Created bounding box ${index + 1} (${
        color.name
      }) at [${left}, ${top}, ${width}, ${height}]`
    );

    return bbox;
  }

  /**
   * Add resize handles to bounding box
   */
  function addResizeHandles(bbox, borderColor = "#ff0000") {
    const handles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];

    handles.forEach((handle) => {
      const handleEl = document.createElement("div");
      handleEl.className = `fc-resize-handle fc-resize-${handle}`;
      handleEl.style.position = "absolute";
      handleEl.style.width = "8px";
      handleEl.style.height = "8px";
      handleEl.style.backgroundColor = borderColor;
      handleEl.style.border = "1px solid #fff";
      handleEl.style.zIndex = "1001";
      handleEl.style.display = "none"; // Hidden by default, shown only for selected

      // Position handles
      switch (handle) {
        case "nw":
          handleEl.style.top = "-4px";
          handleEl.style.left = "-4px";
          handleEl.style.cursor = "nw-resize";
          break;
        case "ne":
          handleEl.style.top = "-4px";
          handleEl.style.right = "-4px";
          handleEl.style.cursor = "ne-resize";
          break;
        case "sw":
          handleEl.style.bottom = "-4px";
          handleEl.style.left = "-4px";
          handleEl.style.cursor = "sw-resize";
          break;
        case "se":
          handleEl.style.bottom = "-4px";
          handleEl.style.right = "-4px";
          handleEl.style.cursor = "se-resize";
          break;
        case "n":
          handleEl.style.top = "-4px";
          handleEl.style.left = "50%";
          handleEl.style.transform = "translateX(-50%)";
          handleEl.style.cursor = "n-resize";
          break;
        case "s":
          handleEl.style.bottom = "-4px";
          handleEl.style.left = "50%";
          handleEl.style.transform = "translateX(-50%)";
          handleEl.style.cursor = "s-resize";
          break;
        case "e":
          handleEl.style.right = "-4px";
          handleEl.style.top = "50%";
          handleEl.style.transform = "translateY(-50%)";
          handleEl.style.cursor = "e-resize";
          break;
        case "w":
          handleEl.style.left = "-4px";
          handleEl.style.top = "50%";
          handleEl.style.transform = "translateY(-50%)";
          handleEl.style.cursor = "w-resize";
          break;
      }

      bbox.appendChild(handleEl);
    });
  }

  /**
   * Make bounding box draggable and resizable with table sync
   */
  function makeDraggableAndResizable(element, container, index) {
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    let isUpdatingFromDrag = false;

    // Drag functionality
    element.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("fc-resize-handle")) {
        // Resizing
        isResizing = true;
        resizeHandle = e.target.classList[1]; // fc-resize-nw, etc.
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(element.style.left);
        startTop = parseInt(element.style.top);
        startWidth = parseInt(element.style.width);
        startHeight = parseInt(element.style.height);
      } else {
        // Dragging
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(element.style.left);
        startTop = parseInt(element.style.top);
      }

      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Constrain movement within container bounds
        const newLeft = Math.max(
          0,
          Math.min(
            startLeft + deltaX,
            container.offsetWidth - element.offsetWidth
          )
        );
        const newTop = Math.max(
          0,
          Math.min(
            startTop + deltaY,
            container.offsetHeight - element.offsetHeight
          )
        );

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;

        // Update table coordinates
        isUpdatingFromDrag = true;
        updateTableFromBoundingBox(element, container, index);
        isUpdatingFromDrag = false;
      } else if (isResizing && resizeHandle) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;

        // Handle different resize directions with proper edge behavior
        if (resizeHandle.includes("w")) {
          // West: resize from left edge (position must move to maintain right edge)
          const newWidthCandidate = startWidth - deltaX;
          if (newWidthCandidate >= 20 && startLeft + deltaX >= 0) {
            newLeft = startLeft + deltaX;
            newWidth = newWidthCandidate;
          }
        }
        if (resizeHandle.includes("e")) {
          // East: resize from right edge (position stays, only width changes)
          const newWidthCandidate = startWidth + deltaX;
          const rightEdge = startLeft + newWidthCandidate;
          if (newWidthCandidate >= 20 && rightEdge <= container.offsetWidth) {
            newWidth = newWidthCandidate;
          }
        }
        if (resizeHandle.includes("n")) {
          // North: resize from top edge (position must move to maintain bottom edge)
          const newHeightCandidate = startHeight - deltaY;
          if (newHeightCandidate >= 20 && startTop + deltaY >= 0) {
            newTop = startTop + deltaY;
            newHeight = newHeightCandidate;
          }
        }
        if (resizeHandle.includes("s")) {
          // South: resize from bottom edge (position stays, only height changes)
          const newHeightCandidate = startHeight + deltaY;
          const bottomEdge = startTop + newHeightCandidate;
          if (
            newHeightCandidate >= 20 &&
            bottomEdge <= container.offsetHeight
          ) {
            newHeight = newHeightCandidate;
          }
        }

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        // Update table coordinates
        updateTableFromBoundingBox(element, container, index);
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      isResizing = false;
      resizeHandle = null;
    });
  }

  /**
   * Update table coordinates from bounding box position
   */
  function updateTableFromBoundingBox(bbox, container, index) {
    const left = parseInt(bbox.style.left);
    const top = parseInt(bbox.style.top);
    const width = parseInt(bbox.style.width);
    const height = parseInt(bbox.style.height);

    // Convert to normalized coordinates
    const x1 = (left / container.offsetWidth).toFixed(3);
    const y1 = (top / container.offsetHeight).toFixed(3);
    const x2 = ((left + width) / container.offsetWidth).toFixed(3);
    const y2 = ((top + height) / container.offsetHeight).toFixed(3);

    // Update table cells
    const row = document.querySelector(
      `.fc-mapping-row[data-index="${index}"]`
    );
    if (row) {
      const cells = row.querySelectorAll(".fc-editable");
      if (cells.length >= 5) {
        cells[0].textContent = x1; // X1
        cells[1].textContent = x2; // X2
        cells[2].textContent = y1; // Y1
        cells[3].textContent = y2; // Y2
        // Weight (cells[4]) remains unchanged
      }
    }

    utils.log(
      `Updated table for region ${index + 1}: [${x1}, ${x2}, ${y1}, ${y2}]`
    );
  }

  /**
   * Update bounding box from table coordinate changes
   */
  function updateBoundingBoxFromTable(index, row, bboxContainer) {
    const bbox = allBoundingBoxes.get(index);
    if (!bbox) return;

    const cells = row.querySelectorAll(".fc-editable");
    if (cells.length < 4) return;

    const x1 = parseFloat(cells[0].textContent) || 0;
    const x2 = parseFloat(cells[1].textContent) || 1;
    const y1 = parseFloat(cells[2].textContent) || 0;
    const y2 = parseFloat(cells[3].textContent) || 1;

    // Ensure valid coordinates (no auto-correction here, just use values)
    const validX1 = Math.max(0, Math.min(x1, 1));
    const validX2 = Math.max(validX1, Math.min(x2, 1));
    const validY1 = Math.max(0, Math.min(y1, 1));
    const validY2 = Math.max(validY1, Math.min(y2, 1));

    // Update bounding box position and size
    const left = validX1 * bboxContainer.offsetWidth;
    const top = validY1 * bboxContainer.offsetHeight;
    const width = (validX2 - validX1) * bboxContainer.offsetWidth;
    const height = (validY2 - validY1) * bboxContainer.offsetHeight;

    bbox.style.left = `${left}px`;
    bbox.style.top = `${top}px`;
    bbox.style.width = `${width}px`;
    bbox.style.height = `${height}px`;

    utils.log(
      `Updated bounding box ${
        index + 1
      } from table: [${validX1}, ${validX2}, ${validY1}, ${validY2}]`
    );
  }

  /**
   * Setup background image control buttons (Upload, Clear)
   */
  function setupBackgroundImageControls(mode, mappingDiv) {
    const loadBtn = mappingDiv.querySelector(".fc-load-img-btn");
    const clearBtn = mappingDiv.querySelector(".fc-clear-img-btn");
    const container = mappingDiv.closest(".fc_adv");
    const previewContainer = container?.querySelector(".fc_preview_img");

    utils.log(`Setting up background controls for ${mode}:`, {
      loadBtn: !!loadBtn,
      clearBtn: !!clearBtn,
      container: !!container,
      previewContainer: !!previewContainer,
    });

    if (!loadBtn || !clearBtn || !previewContainer) {
      utils.log("Missing required elements for background controls");
      return;
    }

    // Upload image functionality
    loadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      utils.log("Load image button clicked");
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            // Remove existing background image
            const existingImg = previewContainer.querySelector(
              ".fc-background-image"
            );
            if (existingImg) {
              existingImg.remove();
            }

            // Create new background image
            const img = document.createElement("img");
            img.className = "fc-background-image";
            img.src = e.target.result;
            img.style.position = "absolute";
            img.style.top = "0";
            img.style.left = "0";
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain";
            img.style.zIndex = "1";
            img.style.pointerEvents = "none";

            // Insert as first child (behind bounding boxes)
            previewContainer.insertBefore(img, previewContainer.firstChild);

            utils.log(`Loaded background image: ${file.name}`);
          };
          reader.readAsDataURL(file);
        }
      });

      input.click();
    });

    // Clear image functionality
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      utils.log("Clear image button clicked");
      const existingImg = previewContainer.querySelector(
        ".fc-background-image"
      );
      if (existingImg) {
        existingImg.remove();
        utils.log("Cleared background image");
      } else {
        utils.log("No background image to clear");
      }
    });
  }

  /**
   * Setup table control buttons (Add, Delete, Reset)
   */
  function setupTableControls(mode, mappingDiv) {
    const addBtn = mappingDiv.querySelector(".fc-add-row-btn");
    const deleteBtn = mappingDiv.querySelector(".fc-delete-row-btn");
    const resetBtn = mappingDiv.querySelector(".fc-reset-mapping-btn");
    const tbody = mappingDiv.querySelector(".fc-mapping-tbody");

    if (!addBtn || !deleteBtn || !resetBtn || !tbody) return;

    // Add row functionality
    addBtn.addEventListener("click", () => {
      const rowCount = tbody.children.length;
      const newIndex = rowCount;

      const color = getRegionColor(newIndex);
      const newRow = document.createElement("tr");
      newRow.className = "fc-mapping-row";
      newRow.style.cursor = "pointer";
      newRow.style.backgroundColor = color.bg;

      newRow.innerHTML = `
        <td style="padding: 8px; border: 1px solid var(--border-color-primary); border-left: 4px solid ${
          color.border
        };">Region ${newIndex + 1}</td>
        <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
        <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
        <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
        <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
        <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
      `;

      tbody.appendChild(newRow);

      // Re-setup interactions for all rows
      const container = mappingDiv.closest(".fc_adv");
      if (container) {
        setupMappingTableInteractions(mode, container);
      }

      utils.log(`Added new row: Region ${newIndex + 1}`);
    });

    // Delete last row functionality (LIFO - Last In, First Out)
    deleteBtn.addEventListener("click", () => {
      if (tbody.children.length > 1) {
        // Remove the last row
        const lastRow = tbody.children[tbody.children.length - 1];
        lastRow.remove();

        // Re-setup interactions for all remaining rows
        const container = mappingDiv.closest(".fc_adv");
        if (container) {
          setupMappingTableInteractions(mode, container);
        }

        utils.log(`Deleted last row`);
      } else {
        utils.log("Cannot delete - at least one row must remain");
      }
    });

    // Reset to default mapping
    resetBtn.addEventListener("click", () => {
      tbody.innerHTML = `
        <tr class="fc-mapping-row" style="cursor: pointer;">
          <td style="padding: 8px; border: 1px solid var(--border-color-primary);">Region 1</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.5</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
        </tr>
        <tr class="fc-mapping-row" style="cursor: pointer;">
          <td style="padding: 8px; border: 1px solid var(--border-color-primary);">Region 2</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.5</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">0.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
          <td class="fc-editable" style="padding: 8px; border: 1px solid var(--border-color-primary); cursor: text;" contenteditable="true">1.0</td>
        </tr>
      `;

      // Re-setup interactions
      const container = mappingDiv.closest(".fc_adv");
      if (container) {
        setupMappingTableInteractions(mode, container);
      }

      utils.log("Reset mapping to default");
    });
  }

  /**
   * Monitor for system interference and restore functionality
   */
  function setupInterferenceMonitoring() {
    // Check every 2 seconds for interference
    setInterval(() => {
      // Check if mode switching is broken
      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        const modeContainers = [
          accordion.querySelector(".fc_bsc"),
          accordion.querySelector(".fc_adv"),
          accordion.querySelector(".fc_msk"),
        ].filter(Boolean);

        // Count visible modes
        const visibleModes = modeContainers.filter(
          (container) =>
            container.style.display !== "none" &&
            getComputedStyle(container).display !== "none"
        );

        // If more than one mode is visible, fix it
        if (visibleModes.length > 1) {
          utils.log(
            `Detected mode switching interference in ${mode}, fixing...`
          );
          restoreModeSwitching();
        }
      });
    }, 2000);
  }

  /**
   * Ensure missing background buttons exist (minimal creation only)
   */
  function ensureBackgroundButtons() {
    utils.log("Checking for missing background buttons...");

    // Note: Removed isolated background button creation to prevent duplicate buttons
    // The inline folder/trash buttons in the main button row are sufficient
  }

  /**
   * Initialize minimal compatibility
   */
  function initMinimalCompatibility() {
    utils.log("Initializing minimal forge-couple lobe-theme compatibility...");

    // Wait for forge-couple elements to exist
    const checkForElements = () => {
      const t2iAccordion = document.getElementById("forge_couple_t2i");
      const i2iAccordion = document.getElementById("forge_couple_i2i");

      if (t2iAccordion && i2iAccordion) {
        // Setup protection
        setupElementProtection();

        // Setup resolution monitoring
        setupResolutionMonitoring();

        // Ensure missing buttons exist
        setTimeout(() => {
          ensureBackgroundButtons();
        }, 500);

        utils.log("Minimal compatibility initialized successfully");

        // Make available for testing
        window.MinimalForgeCoupleCompat = {
          initialized: true,
          setupElementProtection,
          forceElementVisibility,
          isElementProtected,
          restoreAccordionFunctionality,
          restoreModeSwitching,
          protectContentElements,
          getCurrentResolution,
          setupResolutionMonitoring,
          updateAllPreviewContainers,
          forceBoundingBoxSetup: () => {
            utils.log("Force setting up bounding box system...");
            setupBoundingBoxSystem();
          },
          forceResolutionUpdate: () => {
            utils.log("Force updating resolution and preview containers...");
            const newResolution = getCurrentResolution();
            currentResolution = newResolution;
            updateAllPreviewContainers();
            setupBoundingBoxSystem();
          },
          testBoundingBoxes: () => {
            utils.log("=== TESTING BOUNDING BOX SYSTEM ===");
            const resolution = getCurrentResolution();
            utils.log(
              `Current resolution: ${resolution.width}x${resolution.height}`
            );

            ["t2i", "i2i"].forEach((mode) => {
              const container = document.querySelector(
                `#${mode}_forge_couple_advanced`
              );
              if (container) {
                const table = container.querySelector(".fc-mapping-table");
                const bboxContainer =
                  container.querySelector(".fc-bbox-container");
                const previewContainer =
                  container.querySelector(".fc_preview_img");

                if (table && bboxContainer && previewContainer) {
                  const rows = table.querySelectorAll(".fc-mapping-row");
                  utils.log(
                    `${mode}: Found ${rows.length} table rows, ${allBoundingBoxes.size} bounding boxes`
                  );
                  utils.log(
                    `Preview container: ${previewContainer.offsetWidth}x${previewContainer.offsetHeight}`
                  );

                  rows.forEach((row, i) => {
                    const cells = row.querySelectorAll("td");
                    if (cells.length >= 5) {
                      const coords = [
                        parseFloat(cells[1].textContent),
                        parseFloat(cells[2].textContent),
                        parseFloat(cells[3].textContent),
                        parseFloat(cells[4].textContent),
                      ];
                      utils.log(`  Row ${i}: [${coords.join(", ")}]`);
                    }
                  });
                }
              }
            });
          },
          testAllFixes: () => {
            utils.log("=== TESTING ALL 3 CURRENT FIXES ===");

            // Test 1: Preview container aspect ratio
            const resolution = getCurrentResolution();
            const aspectRatio = resolution.width / resolution.height;
            utils.log(
              `1. Resolution: ${resolution.width}x${
                resolution.height
              }, aspect ratio: ${aspectRatio.toFixed(2)}`
            );

            const previewContainers =
              document.querySelectorAll(".fc_preview_img");
            previewContainers.forEach((container, i) => {
              const containerAspect =
                container.offsetWidth / container.offsetHeight;
              const aspectDiff = Math.abs(containerAspect - aspectRatio);
              utils.log(
                `   Preview ${i + 1}: ${container.offsetWidth}x${
                  container.offsetHeight
                }, aspect: ${containerAspect.toFixed(
                  2
                )} (diff: ${aspectDiff.toFixed(3)})`
              );
            });

            // Test 2: Resolution monitoring
            const resolutionInputs = [
              '#txt2img_width input[type="number"]',
              '#txt2img_height input[type="number"]',
              '#img2img_width input[type="number"]',
              '#img2img_height input[type="number"]',
            ];

            let listenersFound = 0;
            resolutionInputs.forEach((selector) => {
              const input = document.querySelector(selector);
              if (input && input.hasAttribute("data-fc-listener")) {
                listenersFound++;
                utils.log(`   Listener on: ${input.id} = ${input.value}`);
              }
            });
            utils.log(
              `2. Resolution monitoring: ${listenersFound}/4 inputs have listeners`
            );

            // Test 3: Button layout
            const controls = document.querySelector(".fc-mapping-controls");
            if (controls) {
              const buttons = controls.querySelectorAll("button");
              utils.log(`3. Button layout: Found ${buttons.length} buttons`);
              buttons.forEach((btn, i) => {
                utils.log(`   Button ${i + 1}: "${btn.textContent.trim()}"`);
              });
            }

            utils.log("=== TEST COMPLETE ===");
            utils.log(
              "To force resolution update: window.MinimalForgeCoupleCompat.forceResolutionUpdate()"
            );
          },
          isContentElement,
          setupBoundingBoxSystem,
          createMappingTable,
          setupPreviewContainer,
          createBoundingBox,
          checkStatus: () => {
            console.log("=== FORGE-COUPLE STATUS ===");
            ["t2i", "i2i"].forEach((mode) => {
              const accordion = document.getElementById(`forge_couple_${mode}`);
              console.log(`${mode.toUpperCase()} Accordion:`, {
                exists: !!accordion,
                open:
                  accordion?.hasAttribute("open") ||
                  !accordion?.classList.contains("hide"),
                modes: {
                  basic:
                    accordion?.querySelector(".fc_bsc")?.style.display !==
                    "none",
                  advanced:
                    accordion?.querySelector(".fc_adv")?.style.display !==
                    "none",
                  mask:
                    accordion?.querySelector(".fc_msk")?.style.display !==
                    "none",
                },
              });
            });

            // Note: Isolated background buttons removed to prevent duplicates

            const protectedElements =
              document.querySelectorAll(".fc-lobe-protected");
            console.log(
              `Protected elements: ${protectedElements.length} found`
            );

            return "Status logged to console";
          },
          debugBoundingBoxes: () => {
            console.log("=== BOUNDING BOX DEBUG ===");

            // Check if mapping table exists
            const mappingTable = document.querySelector(".fc-mapping-table");
            console.log("Mapping table:", mappingTable);

            // Check if preview containers exist
            const previewContainers =
              document.querySelectorAll(".fc_preview_img");
            console.log("Preview containers:", previewContainers.length);

            // Check if bounding box containers exist
            const bboxContainers =
              document.querySelectorAll(".fc-bbox-container");
            console.log("Bbox containers:", bboxContainers.length);

            // Check Advanced mode containers
            const advContainers = document.querySelectorAll(".fc_adv");
            console.log("Advanced containers:", advContainers.length);
            advContainers.forEach((container, i) => {
              console.log(`Advanced container ${i}:`, {
                visible: container.style.display !== "none",
                computedDisplay: getComputedStyle(container).display,
                hasMapping: !!container.querySelector(".fc_mapping"),
                hasPreview: !!container.querySelector(".fc_preview_img"),
                hasMappingTable: !!container.querySelector(".fc-mapping-table"),
                hasBboxContainer:
                  !!container.querySelector(".fc-bbox-container"),
              });
            });

            return "Debug info logged to console";
          },
          forceBoundingBoxSetup: () => {
            utils.log("Forcing bounding box setup...");
            setupBoundingBoxSystem();
            return "Bounding box setup forced";
          },
        };
      } else {
        // Try again in 500ms
        setTimeout(checkForElements, 500);
      }
    };

    checkForElements();
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMinimalCompatibility);
  } else {
    initMinimalCompatibility();
  }

  // Also initialize on UI loaded event if available
  if (typeof onUiLoaded !== "undefined") {
    onUiLoaded(() => {
      setTimeout(initMinimalCompatibility, 1000);
    });
  }

  utils.log("Minimal forge-couple lobe-theme compatibility script loaded");
})();
