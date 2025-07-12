// ===== FORGE-COUPLE LOBE-THEME COMPATIBILITY LAYER =====
// This script provides comprehensive compatibility between lobe-theme and forge-couple extension
// It addresses mode switching, UI element visibility, bounding boxes, and background controls

(function () {
  "use strict";

  // Compatibility configuration
  const FORGE_COUPLE_CONFIG = {
    // Protected selectors that should never be hidden by lobe-theme
    PROTECTED_SELECTORS: [
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
    ],

    // Mode visibility mapping
    MODE_VISIBILITY: {
      Basic: {
        ".fc_bsc": true,
        ".fc_adv": false,
        ".fc_msk": false,
      },
      Advanced: {
        ".fc_bsc": false,
        ".fc_adv": true,
        ".fc_msk": false,
      },
      Mask: {
        ".fc_bsc": false,
        ".fc_adv": false,
        ".fc_msk": true,
      },
    },

    // Debug mode
    DEBUG: true,
  };

  // Utility functions
  const utils = {
    log: (...args) => {
      if (FORGE_COUPLE_CONFIG.DEBUG) {
        console.log("[ForgeCouple-LobeTheme]", ...args);
      }
    },

    error: (...args) => {
      console.error("[ForgeCouple-LobeTheme]", ...args);
    },

    isElementProtected: (element) => {
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
    },

    waitForElement: (selector, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        const observer = new MutationObserver((mutations, obs) => {
          const element = document.querySelector(selector);
          if (element) {
            obs.disconnect();
            resolve(element);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        setTimeout(() => {
          observer.disconnect();
          reject(
            new Error(`Element ${selector} not found within ${timeout}ms`)
          );
        }, timeout);
      });
    },

    forceElementVisibility: (element) => {
      if (!element) return;

      element.style.display = "";
      element.style.visibility = "visible";
      element.style.opacity = "1";
      element.classList.add("fc-lobe-protected");
    },

    createMissingElement: (parent, className, tagName = "div") => {
      const element = document.createElement(tagName);
      element.className = className.replace(".", "");
      parent.appendChild(element);
      utils.forceElementVisibility(element);
      return element;
    },
  };

  // Core compatibility class
  class ForgeCoupleLobeThemeCompat {
    constructor() {
      this.initialized = false;
      this.modeObservers = new Map();
      this.protectionObserver = null;
      this.originalForgeCouple = null;
      this.currentModes = { t2i: "Basic", i2i: "Basic" };
    }

    async init() {
      if (this.initialized) return;

      utils.log("Initializing forge-couple lobe-theme compatibility...");

      try {
        // Wait for UI to be loaded
        await this.waitForUI();

        // Setup protection mechanisms
        this.setupElementProtection();
        this.setupModeHandling();
        this.setupBoundingBoxSystem();
        this.setupBackgroundControls();

        // Hook into ForgeCouple if available
        this.hookForgeCouple();

        this.initialized = true;
        utils.log(
          "Forge-couple lobe-theme compatibility initialized successfully"
        );
      } catch (error) {
        utils.error("Failed to initialize compatibility:", error);
      }
    }

    async waitForUI() {
      // Wait for gradio to be ready
      if (typeof gradioApp === "undefined") {
        await new Promise((resolve) => {
          const checkGradio = () => {
            if (typeof gradioApp !== "undefined") {
              resolve();
            } else {
              setTimeout(checkGradio, 100);
            }
          };
          checkGradio();
        });
      }

      // Wait for forge-couple accordions to exist
      await Promise.all([
        utils.waitForElement("#forge_couple_t2i"),
        utils.waitForElement("#forge_couple_i2i"),
      ]);
    }

    setupElementProtection() {
      utils.log("Setting up element protection...");

      // Create a mutation observer to protect forge-couple elements
      this.protectionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "style"
          ) {
            const element = mutation.target;
            if (utils.isElementProtected(element)) {
              // Restore visibility if it was hidden
              if (element.style.display === "none") {
                utils.log(
                  "Restoring visibility for protected element:",
                  element
                );
                utils.forceElementVisibility(element);
              }
            }
          }
        });
      });

      // Start observing
      this.protectionObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["style"],
        subtree: true,
      });

      // Initial protection pass
      FORGE_COUPLE_CONFIG.PROTECTED_SELECTORS.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          utils.forceElementVisibility(element);
        });
      });
    }

    setupModeHandling() {
      utils.log("Setting up mode handling...");

      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        // Find all radio buttons in the accordion
        const allRadios = accordion.querySelectorAll('input[type="radio"]');
        utils.log(
          `Found ${allRadios.length} radio buttons in ${mode} accordion`
        );

        if (allRadios.length === 0) {
          utils.log(
            `No radio buttons found in ${mode}, skipping mode handling`
          );
          return;
        }

        // Group radio buttons by name
        const radioGroups = {};
        allRadios.forEach((radio) => {
          if (!radioGroups[radio.name]) {
            radioGroups[radio.name] = [];
          }
          radioGroups[radio.name].push(radio);
        });

        // Find mode radio buttons by value (they may have different names)
        const modeRadios = allRadios.filter(
          (radio) =>
            radio.value === "Basic" ||
            radio.value === "Advanced" ||
            radio.value === "Mask"
        );

        utils.log(
          `Found ${modeRadios.length} mode radio buttons:`,
          modeRadios.map((r) => `${r.name}=${r.value}(${r.checked})`)
        );

        let modeRadioGroup = null;
        if (modeRadios.length >= 2) {
          modeRadioGroup = modeRadios;
          utils.log(
            `Using mode radio buttons: ${modeRadios
              .map((r) => r.value)
              .join(", ")}`
          );
        } else {
          // Fallback: look for radio groups with Basic/Advanced/Mask values
          Object.entries(radioGroups).forEach(([groupName, radios]) => {
            const values = radios.map((r) => r.value);
            if (
              values.includes("Basic") ||
              values.includes("Advanced") ||
              values.includes("Mask")
            ) {
              modeRadioGroup = radios;
              utils.log(
                `Found mode radio group: ${groupName} with values: ${values.join(
                  ", "
                )}`
              );
            }
          });

          if (!modeRadioGroup) {
            utils.log(
              `No mode radio group found in ${mode}, trying alternative detection`
            );
            // Try to find any radio group that might control modes
            const firstGroup = Object.values(radioGroups)[0];
            if (firstGroup && firstGroup.length >= 2) {
              modeRadioGroup = firstGroup;
              utils.log(
                `Using first radio group as mode group: ${firstGroup
                  .map((r) => r.value)
                  .join(", ")}`
              );
            }
          }
        }

        if (modeRadioGroup) {
          // Add event listeners to mode radio buttons
          modeRadioGroup.forEach((radio) => {
            radio.addEventListener("change", () => {
              if (radio.checked) {
                utils.log(`Mode changed to: ${radio.value} for ${mode}`);

                // Since radio buttons have different names, manually uncheck others
                modeRadioGroup.forEach((otherRadio) => {
                  if (otherRadio !== radio) {
                    otherRadio.checked = false;
                  }
                });

                this.handleModeChange(mode, radio.value);
              }
            });

            // Also add click listener for better handling
            radio.addEventListener("click", () => {
              utils.log(`Mode clicked: ${radio.value} for ${mode}`);

              // Uncheck other mode radios
              modeRadioGroup.forEach((otherRadio) => {
                if (otherRadio !== radio) {
                  otherRadio.checked = false;
                }
              });

              radio.checked = true;
              this.handleModeChange(mode, radio.value);
            });
          });

          // Set initial mode - find the last checked radio or default to Basic
          const checkedRadios = modeRadioGroup.filter((r) => r.checked);
          let initialMode = null;

          if (checkedRadios.length > 1) {
            // Multiple radios checked, prefer Advanced > Basic > Mask
            const priority = ["Advanced", "Basic", "Mask"];
            for (const mode of priority) {
              const radio = checkedRadios.find((r) => r.value === mode);
              if (radio) {
                initialMode = radio;
                break;
              }
            }

            // Uncheck all others
            modeRadioGroup.forEach((radio) => {
              radio.checked = radio === initialMode;
            });
          } else if (checkedRadios.length === 1) {
            initialMode = checkedRadios[0];
          } else {
            // No radio checked, default to Basic
            const basicRadio = modeRadioGroup.find((r) => r.value === "Basic");
            if (basicRadio) {
              basicRadio.checked = true;
              initialMode = basicRadio;
            } else {
              initialMode = modeRadioGroup[0];
              initialMode.checked = true;
            }
          }

          if (initialMode) {
            utils.log(`Initial mode for ${mode}: ${initialMode.value}`);
            this.handleModeChange(mode, initialMode.value);
          }
        } else {
          utils.log(`Could not find mode radio group for ${mode}`);
        }
      });
    }

    handleModeChange(mode, selectedMode) {
      utils.log(`Mode changed for ${mode}: ${selectedMode}`);
      this.currentModes[mode] = selectedMode;

      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      // Apply visibility rules based on selected mode
      const visibilityRules = FORGE_COUPLE_CONFIG.MODE_VISIBILITY[selectedMode];
      if (!visibilityRules) {
        utils.log(`No visibility rules found for mode: ${selectedMode}`);
        return;
      }

      utils.log(
        `Applying visibility rules for ${selectedMode}:`,
        visibilityRules
      );

      Object.entries(visibilityRules).forEach(([selector, shouldBeVisible]) => {
        const elements = accordion.querySelectorAll(selector);
        utils.log(
          `Selector ${selector}: found ${elements.length} elements, shouldBeVisible: ${shouldBeVisible}`
        );

        elements.forEach((element, index) => {
          const beforeDisplay = element.style.display;

          if (shouldBeVisible) {
            element.style.display = "";
            element.style.visibility = "visible";
            element.style.opacity = "1";
            // Remove any lobe-theme hiding
            element.classList.add("fc-lobe-protected");
          } else {
            element.style.display = "none";
          }

          utils.log(
            `  Element ${index} (${selector}): ${beforeDisplay} -> ${element.style.display}`
          );
        });
      });

      // Ensure critical elements remain visible for Advanced mode
      this.ensureCriticalElementsVisible(accordion, selectedMode);

      utils.log(`Mode change complete for ${mode}: ${selectedMode}`);
    }

    ensureCriticalElementsVisible(accordion, mode) {
      // Always keep mapping and preview elements visible for Advanced mode
      if (mode === "Advanced") {
        const criticalSelectors = [
          ".fc_mapping",
          ".fc_preview_img",
          ".fc_mapping_btns",
        ];
        criticalSelectors.forEach((selector) => {
          const elements = accordion.querySelectorAll(selector);
          elements.forEach((element) => {
            utils.forceElementVisibility(element);
          });
        });
      }
    }

    setupBoundingBoxSystem() {
      utils.log("Setting up bounding box system...");

      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        // Ensure preview image container exists and is properly configured
        let previewContainer = accordion.querySelector(".fc_preview_img");
        if (!previewContainer) {
          // Create missing preview container
          const advSection = accordion.querySelector(".fc_adv");
          if (advSection) {
            previewContainer = utils.createMissingElement(
              advSection,
              "fc_preview_img"
            );
          }
        }

        if (previewContainer) {
          // Ensure the container has proper styling for bounding boxes
          previewContainer.style.position = "relative";
          previewContainer.style.overflow = "visible";

          // Ensure preview image exists
          let previewImg = previewContainer.querySelector("img");
          if (!previewImg) {
            previewImg = document.createElement("img");
            previewImg.style.display = "block";
            previewImg.style.maxWidth = "100%";
            previewImg.style.height = "auto";
            previewContainer.appendChild(previewImg);
          }

          // Set minimum dimensions to prevent 0x0 issues
          previewImg.style.minWidth = "200px";
          previewImg.style.minHeight = "200px";
          previewImg.style.backgroundColor = "#f0f0f0";
          previewImg.style.border = "1px solid #ccc";

          // Add placeholder if no image
          if (!previewImg.src || previewImg.src === window.location.href) {
            previewImg.style.backgroundColor = "#f8f8f8";
            previewImg.style.backgroundImage =
              'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f0f0f0" stroke="%23ccc" stroke-width="2"/><text x="100" y="100" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="%23666">Preview Image</text></svg>\')';
            previewImg.style.backgroundRepeat = "no-repeat";
            previewImg.style.backgroundPosition = "center";
            previewImg.style.backgroundSize = "contain";
          }

          // Create bounding box container if it doesn't exist
          let bboxContainer = previewContainer.querySelector(".fc_bbox");
          if (!bboxContainer) {
            bboxContainer = utils.createMissingElement(
              previewContainer,
              "fc_bbox"
            );
            bboxContainer.style.position = "absolute";
            bboxContainer.style.top = "0";
            bboxContainer.style.left = "0";
            bboxContainer.style.width = "100%";
            bboxContainer.style.height = "100%";
            bboxContainer.style.pointerEvents = "none";
            bboxContainer.style.zIndex = "10";
          }
        }
      });
    }

    setupBackgroundControls() {
      utils.log("Setting up background controls...");

      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        // Find or create background controls container
        let bgBtnsContainer = accordion.querySelector(".fc_bg_btns");
        if (!bgBtnsContainer) {
          // Create missing background buttons container
          const advSection = accordion.querySelector(".fc_adv");
          if (advSection) {
            bgBtnsContainer = utils.createMissingElement(
              advSection,
              "fc_bg_btns"
            );
            bgBtnsContainer.style.position = "absolute";
            bgBtnsContainer.style.right = "-50px";
            bgBtnsContainer.style.top = "0";
            bgBtnsContainer.style.display = "flex";
            bgBtnsContainer.style.flexDirection = "column";
            bgBtnsContainer.style.gap = "8px";
          }
        }

        if (bgBtnsContainer) {
          // Ensure all required background control buttons exist
          const requiredButtons = [
            {
              id: "fc_load_img_btn",
              icon: "📂",
              tooltip: "Load a background image for the mapping visualization",
            },
            {
              id: "fc_clear_img_btn",
              icon: "🗑",
              tooltip: "Remove the background image",
            },
          ];

          // Add eject button for img2img mode
          if (mode === "i2i") {
            requiredButtons.splice(1, 0, {
              id: "fc_load_i2i_img_btn",
              icon: "⏏",
              tooltip: "Load the img2img image as the background image",
            });
          }

          requiredButtons.forEach((buttonConfig) => {
            let button = bgBtnsContainer.querySelector(`#${buttonConfig.id}`);
            if (!button) {
              button = document.createElement("button");
              button.id = buttonConfig.id;
              button.textContent = buttonConfig.icon;
              button.title = buttonConfig.tooltip;
              button.className = "tool";
              button.style.width = "40px";
              button.style.height = "40px";
              button.style.border = "1px solid var(--border-color-primary)";
              button.style.borderRadius = "8px";
              button.style.backgroundColor = "var(--background-fill-primary)";
              button.style.cursor = "pointer";
              button.style.display = "flex";
              button.style.alignItems = "center";
              button.style.justifyContent = "center";
              button.style.fontSize = "16px";

              bgBtnsContainer.appendChild(button);
              utils.log(`Created missing button: ${buttonConfig.id}`);
            }

            utils.forceElementVisibility(button);
          });
        }
      });
    }

    hookForgeCouple() {
      utils.log("Hooking into ForgeCouple...");

      // Wait for ForgeCouple to be available and hook into its setup
      const checkForgeCouple = () => {
        if (typeof ForgeCouple !== "undefined") {
          this.patchForgeCouple();
        } else if (window.ForgeCouple) {
          this.patchForgeCouple();
        } else {
          // Try again in 500ms
          setTimeout(checkForgeCouple, 500);
        }
      };

      checkForgeCouple();
    }

    patchForgeCouple() {
      utils.log("Patching ForgeCouple for lobe-theme compatibility...");

      const ForgeCouple =
        window.ForgeCouple ||
        (typeof ForgeCouple !== "undefined" ? ForgeCouple : null);
      if (!ForgeCouple) {
        utils.error("ForgeCouple not found for patching");
        return;
      }

      // Store original setup method
      if (!this.originalForgeCouple) {
        this.originalForgeCouple = {
          setup: ForgeCouple.setup?.bind(ForgeCouple),
          preview: ForgeCouple.preview?.bind(ForgeCouple),
        };
      }

      // Patch setup method
      if (ForgeCouple.setup) {
        ForgeCouple.setup = (...args) => {
          utils.log(
            "ForgeCouple.setup called, applying compatibility patches..."
          );

          try {
            // Call original setup
            if (this.originalForgeCouple.setup) {
              this.originalForgeCouple.setup(...args);
            }

            // Apply post-setup fixes
            setTimeout(() => {
              this.postSetupFixes();
            }, 100);
          } catch (error) {
            utils.error("Error in patched ForgeCouple.setup:", error);

            // Fallback: try to setup manually
            this.manualSetupFallback();
          }
        };
      }
    }

    postSetupFixes() {
      utils.log("Applying post-setup fixes...");

      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        // Ensure all critical elements are visible and functional
        this.ensureElementsVisibleForMode(mode);

        // Fix any missing elements
        this.createMissingElements(accordion, mode);

        // Apply current mode visibility
        const currentMode = this.currentModes[mode];
        if (currentMode) {
          this.handleModeChange(mode, currentMode);
        }
      });
    }

    ensureElementsVisibleForMode(mode) {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      // Force visibility for all forge-couple elements
      FORGE_COUPLE_CONFIG.PROTECTED_SELECTORS.forEach((selector) => {
        const elements = accordion.querySelectorAll(selector);
        elements.forEach((element) => {
          utils.forceElementVisibility(element);
        });
      });
    }

    createMissingElements(accordion, mode) {
      // Ensure mapping container exists
      let mappingContainer = accordion.querySelector(".fc_mapping");
      if (!mappingContainer) {
        const advSection = accordion.querySelector(".fc_adv");
        if (advSection) {
          mappingContainer = utils.createMissingElement(
            advSection,
            "fc_mapping"
          );
        }
      }

      // Ensure mapping buttons exist
      let mappingBtns = accordion.querySelector(".fc_mapping_btns");
      if (!mappingBtns && mappingContainer) {
        mappingBtns = utils.createMissingElement(
          mappingContainer,
          "fc_mapping_btns"
        );
      }
    }

    manualSetupFallback() {
      utils.log("Attempting manual setup fallback...");

      ["t2i", "i2i"].forEach((mode) => {
        const accordion = document.getElementById(`forge_couple_${mode}`);
        if (!accordion) return;

        // Create all missing elements
        this.createMissingElements(accordion, mode);

        // Setup basic functionality
        this.setupBasicFunctionality(accordion, mode);
      });
    }

    setupBasicFunctionality(accordion, mode) {
      utils.log(`Setting up basic functionality for ${mode}...`);

      // Setup background control buttons
      const bgBtns = accordion.querySelectorAll(".fc_bg_btns button");
      utils.log(`Found ${bgBtns.length} background buttons in ${mode}`);

      bgBtns.forEach((btn, index) => {
        utils.log(
          `Button ${index}: id="${btn.id}", text="${
            btn.textContent
          }", setup="${btn.hasAttribute("data-fc-setup")}"`
        );

        if (!btn.hasAttribute("data-fc-setup")) {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            utils.log(
              `Background control button clicked: ${btn.id} for ${mode}`
            );
            this.handleBackgroundControl(btn.id, mode);
          });
          btn.setAttribute("data-fc-setup", "true");
          utils.log(`Event listener added to button: ${btn.id}`);
        }
      });

      // Also setup any existing buttons that might not be in .fc_bg_btns
      const allButtons = accordion.querySelectorAll('button[id*="fc_"]');
      utils.log(`Found ${allButtons.length} total fc_ buttons in ${mode}`);

      allButtons.forEach((btn) => {
        if (
          !btn.hasAttribute("data-fc-setup") &&
          (btn.id.includes("load") ||
            btn.id.includes("clear") ||
            btn.id.includes("img"))
        ) {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            utils.log(`FC button clicked: ${btn.id} for ${mode}`);
            this.handleBackgroundControl(btn.id, mode);
          });
          btn.setAttribute("data-fc-setup", "true");
          utils.log(`Event listener added to FC button: ${btn.id}`);
        }
      });
    }

    handleBackgroundControl(buttonId, mode) {
      switch (buttonId) {
        case "fc_load_img_btn":
          this.loadBackgroundImage(mode);
          break;
        case "fc_load_i2i_img_btn":
          this.loadI2IImage(mode);
          break;
        case "fc_clear_img_btn":
          this.clearBackgroundImage(mode);
          break;
      }
    }

    loadBackgroundImage(mode) {
      utils.log(`Loading background image for ${mode}`);
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.setBackgroundImage(mode, e.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }

    loadI2IImage(mode) {
      utils.log(`Loading img2img image as background for ${mode}`);
      const img2imgImage = document.querySelector("#img2img_image img");
      if (img2imgImage && img2imgImage.src) {
        this.setBackgroundImage(mode, img2imgImage.src);
      } else {
        utils.log("No img2img image found");
      }
    }

    clearBackgroundImage(mode) {
      utils.log(`Clearing background image for ${mode}`);
      this.setBackgroundImage(mode, null);
    }

    setBackgroundImage(mode, imageSrc) {
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) return;

      const previewImg = accordion.querySelector(".fc_preview_img img");
      if (previewImg) {
        if (imageSrc) {
          previewImg.src = imageSrc;
          previewImg.style.display = "block";
        } else {
          previewImg.src = "";
          previewImg.style.display = "none";
        }
      }
    }

    destroy() {
      if (this.protectionObserver) {
        this.protectionObserver.disconnect();
      }

      this.modeObservers.forEach((observer) => observer.disconnect());
      this.modeObservers.clear();

      this.initialized = false;
    }
  }

  // Global instance
  window.ForgeCoupleLobeThemeCompat = new ForgeCoupleLobeThemeCompat();

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.ForgeCoupleLobeThemeCompat.init();
    });
  } else {
    window.ForgeCoupleLobeThemeCompat.init();
  }

  // Also initialize on UI loaded event if available
  if (typeof onUiLoaded !== "undefined") {
    onUiLoaded(() => {
      setTimeout(() => {
        window.ForgeCoupleLobeThemeCompat.init();
      }, 1000);
    });
  }

  console.log("[ForgeCouple] Lobe-theme compatibility script loaded and ready");
})();
