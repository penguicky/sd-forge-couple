// ===== FORGE-COUPLE QUICK TEST =====
// Immediate test functions that don't require other scripts

(function () {
  "use strict";

  // Quick test utilities
  const quickTest = {
    log: (message, ...args) => {
      console.log(
        `%c[ForgeCouple-QuickTest] ${message}`,
        "color: purple; font-weight: bold;",
        ...args
      );
    },

    success: (message, ...args) => {
      console.log(
        `%c[ForgeCouple-QuickTest] ✅ ${message}`,
        "color: green; font-weight: bold;",
        ...args
      );
    },

    fail: (message, ...args) => {
      console.log(
        `%c[ForgeCouple-QuickTest] ❌ ${message}`,
        "color: red; font-weight: bold;",
        ...args
      );
    },

    // Basic element existence check
    checkElements: () => {
      quickTest.log("Checking basic forge-couple elements...");

      const elements = {
        t2i_accordion: document.getElementById("forge_couple_t2i"),
        i2i_accordion: document.getElementById("forge_couple_i2i"),
        forge_couple_global: typeof window.ForgeCouple !== "undefined",
        compatibility_script:
          typeof window.ForgeCoupleLobeThemeCompat !== "undefined",
        test_functions: typeof window.testForgeCouple !== "undefined",
      };

      Object.entries(elements).forEach(([name, exists]) => {
        if (exists) {
          quickTest.success(`${name}: Found`);
        } else {
          quickTest.fail(`${name}: Missing`);
        }
      });

      return elements;
    },

    // Check if lobe-theme is present
    checkLobeTheme: () => {
      quickTest.log("Checking for lobe-theme...");

      const detectionMethods = [
        {
          name: "data-testid",
          check: () => document.querySelector('[data-testid="lobe-theme"]'),
        },
        {
          name: "body class",
          check: () => document.body.className.includes("lobe"),
        },
        {
          name: "CSS variable",
          check: () => {
            try {
              return getComputedStyle(
                document.documentElement
              ).getPropertyValue("--lobe-theme-primary");
            } catch (e) {
              return false;
            }
          },
        },
        {
          name: "lobe-theme class",
          check: () => document.querySelector(".lobe-theme"),
        },
        {
          name: "lobe-theme id",
          check: () => document.querySelector("#lobe-theme"),
        },
      ];

      let detected = false;
      detectionMethods.forEach((method) => {
        try {
          const result = method.check();
          if (result) {
            quickTest.success(
              `Lobe-theme detected via ${method.name}: ${result}`
            );
            detected = true;
          } else {
            quickTest.log(`Lobe-theme not found via ${method.name}`);
          }
        } catch (e) {
          quickTest.log(`Error checking ${method.name}: ${e.message}`);
        }
      });

      if (!detected) {
        quickTest.fail("Lobe-theme not detected by any method");
      }

      return detected;
    },

    // Check script loading
    checkScriptLoading: () => {
      quickTest.log("Checking script loading...");

      const scripts = Array.from(document.querySelectorAll("script")).map(
        (s) => s.src
      );
      const relevantScripts = scripts.filter(
        (src) =>
          src.includes("forge-couple") ||
          src.includes("lobe-theme") ||
          src.includes("compatibility")
      );

      if (relevantScripts.length > 0) {
        quickTest.success(`Found ${relevantScripts.length} relevant scripts:`);
        relevantScripts.forEach((src) => quickTest.log(`  - ${src}`));
      } else {
        quickTest.fail("No relevant scripts found");
      }

      return relevantScripts;
    },

    // Manual compatibility script loading
    loadCompatibilityManually: () => {
      quickTest.log("Attempting to load compatibility scripts manually...");

      if (typeof window.loadForgeCoupleCompatibility === "function") {
        window.loadForgeCoupleCompatibility();
        quickTest.success("Manual loading function called");
      } else {
        quickTest.fail("Manual loading function not available");

        // Try direct loading
        quickTest.log("Trying direct script loading...");
        const script = document.createElement("script");
        script.src =
          "/file=extensions/sd-forge-couple/javascript/lobe-theme-compatibility.js";
        script.onload = () => {
          quickTest.success("Compatibility script loaded directly");

          // Load test script
          const testScript = document.createElement("script");
          testScript.src =
            "/file=extensions/sd-forge-couple/javascript/compatibility-test.js";
          testScript.onload = () => {
            quickTest.success("Test script loaded directly");
          };
          testScript.onerror = () => {
            quickTest.fail("Failed to load test script directly");
          };
          document.head.appendChild(testScript);
        };
        script.onerror = () => {
          quickTest.fail("Failed to load compatibility script directly");
        };
        document.head.appendChild(script);
      }
    },

    // Run all quick tests
    runAll: () => {
      quickTest.log("=== RUNNING ALL QUICK TESTS ===");

      const results = {
        elements: quickTest.checkElements(),
        lobeTheme: quickTest.checkLobeTheme(),
        scripts: quickTest.checkScriptLoading(),
      };

      quickTest.log("=== QUICK TEST SUMMARY ===");
      quickTest.log("Elements check:", results.elements);
      quickTest.log("Lobe-theme detected:", results.lobeTheme);
      quickTest.log("Scripts found:", results.scripts.length);

      // If compatibility script isn't loaded, try to load it
      if (!results.elements.compatibility_script) {
        quickTest.log(
          "Compatibility script not loaded, attempting manual load..."
        );
        quickTest.loadCompatibilityManually();
      }

      return results;
    },

    // Debug info
    debugInfo: () => {
      quickTest.log("=== DEBUG INFORMATION ===");
      quickTest.log("Document ready state:", document.readyState);
      quickTest.log("Window location:", window.location.href);
      quickTest.log("User agent:", navigator.userAgent);
      quickTest.log("Available global objects:");

      const globals = [
        "ForgeCouple",
        "ForgeCoupleLobeThemeCompat",
        "testForgeCouple",
        "gradioApp",
        "onUiLoaded",
      ];
      globals.forEach((name) => {
        quickTest.log(`  - ${name}:`, typeof window[name]);
      });

      // Check for forge-couple elements
      const fcElements = document.querySelectorAll(
        '[id*="forge_couple"], [class*="fc_"]'
      );
      quickTest.log(`Found ${fcElements.length} forge-couple related elements`);

      // Detailed structure analysis
      const t2iAccordion = document.getElementById("forge_couple_t2i");
      if (t2iAccordion) {
        quickTest.log("=== T2I ACCORDION STRUCTURE ===");

        // Check for radio buttons
        const radios = t2iAccordion.querySelectorAll('input[type="radio"]');
        quickTest.log(`Found ${radios.length} radio buttons:`);
        radios.forEach((radio, i) => {
          quickTest.log(
            `  Radio ${i}: name="${radio.name}", value="${radio.value}", checked=${radio.checked}`
          );
        });

        // Check for mode sections
        const modeSections = {
          "Basic (.fc_bsc)": t2iAccordion.querySelectorAll(".fc_bsc"),
          "Advanced (.fc_adv)": t2iAccordion.querySelectorAll(".fc_adv"),
          "Mask (.fc_msk)": t2iAccordion.querySelectorAll(".fc_msk"),
        };

        Object.entries(modeSections).forEach(([name, elements]) => {
          quickTest.log(`${name}: ${elements.length} elements`);
          elements.forEach((el, i) => {
            const style = window.getComputedStyle(el);
            quickTest.log(
              `  Element ${i}: display=${style.display}, visibility=${style.visibility}`
            );
          });
        });

        // Check for background buttons
        const bgBtns = t2iAccordion.querySelectorAll(".fc_bg_btns button");
        quickTest.log(`Background buttons: ${bgBtns.length}`);
        bgBtns.forEach((btn, i) => {
          quickTest.log(
            `  Button ${i}: id="${btn.id}", text="${btn.textContent}"`
          );
        });

        // Check preview area
        const previewImg = t2iAccordion.querySelector(".fc_preview_img");
        if (previewImg) {
          const style = window.getComputedStyle(previewImg);
          quickTest.log(
            `Preview container: display=${style.display}, width=${style.width}, height=${style.height}`
          );

          const img = previewImg.querySelector("img");
          if (img) {
            quickTest.log(
              `Preview image: src="${img.src}", width=${img.width}, height=${img.height}`
            );
          }
        }
      }

      return {
        readyState: document.readyState,
        location: window.location.href,
        globals: globals.map((name) => ({ name, type: typeof window[name] })),
        fcElementCount: fcElements.length,
      };
    },

    // Test mode switching manually
    testModeSwitch: (mode = "t2i", targetMode = "Advanced") => {
      quickTest.log(
        `Testing manual mode switch to ${targetMode} for ${mode}...`
      );

      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) {
        quickTest.fail(`Accordion not found: forge_couple_${mode}`);
        return false;
      }

      // Find the radio button
      const radio = accordion.querySelector(
        `input[type="radio"][value="${targetMode}"]`
      );
      if (!radio) {
        quickTest.fail(`Radio button not found for ${targetMode}`);

        // List all available radio buttons
        const allRadios = accordion.querySelectorAll('input[type="radio"]');
        quickTest.log("Available radio buttons:");
        allRadios.forEach((r) => {
          quickTest.log(
            `  - name="${r.name}", value="${r.value}", checked=${r.checked}`
          );
        });
        return false;
      }

      // Click the radio button
      radio.click();

      setTimeout(() => {
        if (radio.checked) {
          quickTest.success(`Successfully switched to ${targetMode}`);

          // Check if compatibility script handled it
          if (window.ForgeCoupleLobeThemeCompat?.currentModes) {
            quickTest.log(
              "Compatibility script current modes:",
              window.ForgeCoupleLobeThemeCompat.currentModes
            );
          }
        } else {
          quickTest.fail(`Failed to switch to ${targetMode}`);
        }
      }, 100);

      return true;
    },
  };

  // Make quick test available globally
  window.quickTestForgeCouple = quickTest;

  // Auto-run basic check
  setTimeout(() => {
    quickTest.log("Quick test script loaded. Available commands:");
    quickTest.log("- window.quickTestForgeCouple.runAll()");
    quickTest.log("- window.quickTestForgeCouple.checkElements()");
    quickTest.log("- window.quickTestForgeCouple.checkLobeTheme()");
    quickTest.log("- window.quickTestForgeCouple.loadCompatibilityManually()");
    quickTest.log("- window.quickTestForgeCouple.debugInfo()");
    quickTest.log(
      "- window.quickTestForgeCouple.testModeSwitch('t2i', 'Advanced')"
    );

    // Auto-run if UI is ready
    if (document.readyState === "complete") {
      quickTest.log("Document ready, running quick check...");
      quickTest.checkElements();
    }
  }, 100);
})();
