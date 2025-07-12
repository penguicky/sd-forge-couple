class ForgeCouple {
  /** The fc_mapping \<div\> */
  static container = { t2i: undefined, i2i: undefined };
  /** The actual \<tbody\> */
  static mappingTable = { t2i: undefined, i2i: undefined };

  /** The floating \<button\>s for row controls */
  static rowButtons = { t2i: undefined, i2i: undefined };

  /** The \<input\> for preview resolution */
  static previewResolution = { t2i: undefined, i2i: undefined };
  /** The \<button\> to trigger preview */
  static previewButton = { t2i: undefined, i2i: undefined };

  /** The ForgeCoupleDataframe class */
  static dataframe = { t2i: undefined, i2i: undefined };
  /** The ForgeCoupleBox class */
  static bbox = { t2i: undefined, i2i: undefined };

  /** The \<input\> for SendTo buttons */
  static pasteField = { t2i: undefined, i2i: undefined };
  /** The \<input\> for internal updates */
  static entryField = { t2i: undefined, i2i: undefined };

  /** The ForgeCoupleMaskHandler class */
  static maskHandler = { t2i: undefined, i2i: undefined };

  /**
   * After updating the mappings, trigger a preview
   * @param {string} mode "t2i" | "i2i"
   */
  static preview(mode) {
    let res = null;
    let w = -1;
    let h = -1;

    setTimeout(() => {
      if (mode === "t2i") {
        w = parseInt(
          document.getElementById("txt2img_width").querySelector("input").value
        );
        h = parseInt(
          document.getElementById("txt2img_height").querySelector("input").value
        );
      } else {
        const i2i_size = document
          .getElementById("img2img_column_size")
          .querySelector(".tab-nav");

        if (i2i_size.children[0].classList.contains("selected")) {
          // Resize to
          w = parseInt(
            document.getElementById("img2img_width").querySelector("input")
              .value
          );
          h = parseInt(
            document.getElementById("img2img_height").querySelector("input")
              .value
          );
        } else {
          // Resize by
          res = document
            .getElementById("img2img_scale_resolution_preview")
            ?.querySelector(".resolution")?.textContent;
        }
      }

      if (w > 100 && h > 100) res = `${w}x${h}`;

      if (!res) return;

      this.previewResolution[mode].value = res;
      updateInput(this.previewResolution[mode]);

      this.previewButton[mode].click();
    }, 100);
  }

  /**
   * Update the color of the rows based on the order and selection
   * @param {string} mode "t2i" | "i2i"
   */
  static updateColors(mode) {
    const [color, row] = this.dataframe[mode].updateColors();

    if (color) {
      this.bbox[mode].showBox(color, row);
      return row;
    } else {
      this.bbox[mode].hideBox();
      this.rowButtons[mode].style.display = "none";
      return null;
    }
  }

  /**
   * When using SendTo buttons, refresh the table
   * @param {string} mode "t2i" | "i2i"
   */
  static onPaste(mode) {
    const infotext = this.pasteField[mode].value;
    if (!infotext.trim()) return;

    const vals = JSON.parse(infotext);
    this.dataframe[mode].onPaste(vals);
    this.preview(mode);

    this.pasteField[mode].value = "";
    updateInput(this.pasteField[mode]);
  }

  /**
   * When clicking on a row, update the index
   * @param {string} mode "t2i" | "i2i"
   */
  static onSelect(mode) {
    const cell = this.updateColors(mode);

    if (cell) {
      const bounding = cell.querySelector("td").getBoundingClientRect();
      const bounding_container = this.container[mode].getBoundingClientRect();
      this.rowButtons[mode].style.top = `calc(${
        bounding.top - bounding_container.top
      }px - 1.5em)`;
      this.rowButtons[mode].style.display = "block";
    } else this.rowButtons[mode].style.display = "none";
  }

  /**
   * When editing the mapping, update the internal JSON
   * @param {string} mode "t2i" | "i2i"
   */
  static onEntry(mode) {
    const rows = this.mappingTable[mode].querySelectorAll("tr");

    const vals = Array.from(rows, (row) => {
      return Array.from(row.querySelectorAll("td"))
        .slice(0, -1)
        .map((cell) => parseFloat(cell.textContent));
    });

    const json = JSON.stringify(vals);
    this.entryField[mode].value = json;
    updateInput(this.entryField[mode]);
  }

  /**
   * Link the buttons related to the mapping
   * @param {Element} ex
   * @param {string} mode "t2i" | "i2i"
   */
  static #registerButtons(ex, mode) {
    ex.querySelector(".fc_reset_btn").onclick = () => {
      this.dataframe[mode].reset();
    };
    ex.querySelector("#fc_up_btn").onclick = (e) => {
      this.dataframe[mode].newRowAbove(e.shiftKey);
    };
    ex.querySelector("#fc_dn_btn").onclick = (e) => {
      this.dataframe[mode].newRowBelow(e.shiftKey);
    };
    ex.querySelector("#fc_del_btn").onclick = (e) => {
      this.dataframe[mode].deleteRow(e.shiftKey);
    };
  }

  /** Hook some elements to automatically refresh the resolution */
  static #registerResolutionHandles() {
    [
      ["txt2img", "t2i"],
      ["img2img", "i2i"],
    ].forEach(([tab, mode]) => {
      const btns = document
        .getElementById(`${tab}_dimensions_row`)
        ?.querySelectorAll("button");
      if (btns != null)
        btns.forEach((btn) => {
          btn.onclick = () => {
            this.preview(mode);
          };
        });
    });

    const i2i_size_btns = document
      .getElementById("img2img_column_size")
      .querySelector(".tab-nav");
    i2i_size_btns.addEventListener("click", () => {
      this.preview("i2i");
    });

    const tabs = document.getElementById("tabs").querySelector(".tab-nav");
    tabs.addEventListener("click", () => {
      if (tabs.children[0].classList.contains("selected")) this.preview("t2i");
      if (tabs.children[1].classList.contains("selected")) this.preview("i2i");
    });
  }

  /**
   * Remove Gradio Image Junks...
   * @param {string} mode "t2i" | "i2i"
   */
  static hideButtons(mode) {
    this.maskHandler[mode].hideButtons();
  }

  /**
   * After editing masks, refresh the preview rows
   * @param {string} mode "t2i" | "i2i"
   */
  static populateMasks(mode) {
    this.maskHandler[mode].generatePreview();
  }

  /**
   * After changing Global Effect, re-sync the prompts
   * @param {string} mode "t2i" | "i2i"
   */
  static onBackgroundChange(mode) {
    this.maskHandler[mode].syncPrompts();
  }

  static setup() {
    // Detect if lobe-theme is active
    const isLobeThemeActive = this.#detectLobeTheme();
    if (isLobeThemeActive) {
      console.log(
        "[ForgeCouple] Lobe-theme detected, applying compatibility fixes..."
      );
    }

    ["t2i", "i2i"].forEach((mode) => {
      const ex = document.getElementById(`forge_couple_${mode}`);
      const mapping_btns = ex.querySelector(".fc_mapping_btns");

      this.container[mode] = ex.querySelector(".fc_mapping");
      this.container[mode].appendChild(mapping_btns);

      // Apply lobe-theme compatibility fixes if needed
      if (isLobeThemeActive) {
        this.#applyLobeThemeCompatibility(ex, mode);
      }

      const separator = ex
        .querySelector(".fc_separator")
        .querySelector("input");
      const promptField = document
        .getElementById(`${mode === "t2i" ? "txt" : "img"}2img_prompt`)
        .querySelector("textarea");

      this.dataframe[mode] = new ForgeCoupleDataframe(
        this.container[mode],
        mode,
        separator
      );

      this.mappingTable[mode] = this.container[mode].querySelector("tbody");

      this.rowButtons[mode] = ex.querySelector(".fc_row_btns");
      this.rowButtons[mode].style.display = "none";

      this.rowButtons[mode].querySelectorAll("button").forEach((btn) => {
        btn.setAttribute("style", "margin: auto !important");
      });

      this.container[mode].appendChild(this.rowButtons[mode]);

      this.previewResolution[mode] = ex
        .querySelector(".fc_preview_res")
        .querySelector("input");
      this.previewButton[mode] = ex.querySelector(".fc_preview");

      const preview_img = ex.querySelector("img");
      preview_img.ondragstart = (e) => {
        e.preventDefault();
        return false;
      };
      preview_img.parentElement.style.overflow = "visible";

      this.bbox[mode] = new ForgeCoupleBox(preview_img, mode);

      const bg_btns = ex.querySelector(".fc_bg_btns");
      preview_img.parentElement.appendChild(bg_btns);

      ForgeCoupleImageLoader.setup(
        preview_img,
        bg_btns.querySelectorAll("button")
      );

      this.pasteField[mode] = ex
        .querySelector(".fc_paste_field")
        .querySelector("textarea");
      this.entryField[mode] = ex
        .querySelector(".fc_entry_field")
        .querySelector("textarea");

      this.maskHandler[mode] = new ForgeCoupleMaskHandler(
        ex.querySelector(".fc_msk"),
        ex.querySelector(".fc_msk_gal"),
        ex.querySelector(".fc_masks"),
        separator,
        ex.querySelector(".fc_global_effect"),
        promptField,
        ex.querySelector(".fc_msk_weights").querySelector("textarea"),
        ex.querySelector(".fc_msk_op").querySelector("textarea"),
        ex.querySelector(".fc_msk_op_btn"),
        ex.querySelector(".fc_msk_io").querySelectorAll("button")[1]
      );

      this.#registerButtons(ex, mode);
      ForgeCoupleObserver.observe(mode, promptField, () => {
        this.dataframe[mode].syncPrompts();
        this.maskHandler[mode].syncPrompts();
      });
    });

    this.#registerResolutionHandles();
  }

  /**
   * Detect if lobe-theme is active
   */
  static #detectLobeTheme() {
    // Check for lobe-theme specific elements or classes
    const lobeThemeIndicators = [
      'div[data-testid="lobe-theme"]',
      ".lobe-theme",
      "#lobe-theme-root",
      '[class*="lobe-theme"]',
    ];

    for (const indicator of lobeThemeIndicators) {
      if (document.querySelector(indicator)) {
        return true;
      }
    }

    // Check for lobe-theme in body classes
    if (document.body.className.includes("lobe")) {
      return true;
    }

    // Check for lobe-theme specific CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const lobeVars = ["--lobe-theme-primary", "--lobe-primary-color"];
    for (const varName of lobeVars) {
      if (computedStyle.getPropertyValue(varName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply lobe-theme specific compatibility fixes
   */
  static #applyLobeThemeCompatibility(accordion, mode) {
    console.log(
      `[ForgeCouple] Applying lobe-theme compatibility for ${mode}...`
    );

    // Ensure all forge-couple elements are visible
    const criticalSelectors = [
      ".fc_mapping",
      ".fc_preview_img",
      ".fc_bbox",
      ".fc_mapping_btns",
      ".fc_bg_btns",
      ".fc_adv",
      ".fc_bsc",
      ".fc_msk",
    ];

    criticalSelectors.forEach((selector) => {
      const elements = accordion.querySelectorAll(selector);
      elements.forEach((element) => {
        // Force visibility
        element.style.display = "";
        element.style.visibility = "visible";
        element.style.opacity = "1";

        // Add a class to mark as forge-couple protected
        element.classList.add("fc-lobe-protected");
      });
    });

    // Ensure preview images have proper dimensions
    const previewImg = accordion.querySelector(".fc_preview_img img");
    if (previewImg) {
      previewImg.style.minWidth = "200px";
      previewImg.style.minHeight = "200px";
      previewImg.style.display = "block";
    }

    // Ensure mapping table is visible and functional
    const mappingTable = accordion.querySelector(".fc_mapping tbody");
    if (mappingTable) {
      mappingTable.style.display = "";
      mappingTable.style.visibility = "visible";
    }

    console.log(`[ForgeCouple] Lobe-theme compatibility applied for ${mode}`);
  }
}

// Make ForgeCouple available globally
window.ForgeCouple = ForgeCouple;

onUiLoaded(() => {
  ForgeCouple.setup();

  // Load quick test script first for immediate debugging
  const quickTestScript = document.createElement("script");
  quickTestScript.src =
    "/file=extensions/sd-forge-couple/javascript/quick-test.js";
  quickTestScript.onload = () => {
    console.log("[ForgeCouple] Quick test script loaded");
  };
  quickTestScript.onerror = () => {
    console.warn("[ForgeCouple] Could not load quick test script");
  };
  document.head.appendChild(quickTestScript);

  // Function to load compatibility scripts
  const loadCompatibilityScripts = () => {
    console.log("[ForgeCouple] Loading compatibility scripts...");

    // Load minimal compatibility script (non-interfering)
    const compatScript = document.createElement("script");
    compatScript.src =
      "/file=extensions/sd-forge-couple/javascript/minimal-lobe-compatibility.js";
    compatScript.onload = () => {
      console.log(
        "[ForgeCouple] Minimal lobe-theme compatibility script loaded"
      );
    };
    compatScript.onerror = () => {
      console.warn(
        "[ForgeCouple] Could not load minimal lobe-theme compatibility script"
      );
    };
    document.head.appendChild(compatScript);
  };

  // Check for lobe-theme with multiple detection methods
  const detectLobeTheme = () => {
    const methods = [
      () => document.querySelector('[data-testid="lobe-theme"]'),
      () => document.body.className.includes("lobe"),
      () => {
        try {
          return getComputedStyle(document.documentElement).getPropertyValue(
            "--lobe-theme-primary"
          );
        } catch (e) {
          return false;
        }
      },
      () => document.querySelector(".lobe-theme"),
      () => document.querySelector("#lobe-theme"),
      () => window.location.href.includes("lobe"),
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        if (methods[i]()) {
          console.log(`[ForgeCouple] Lobe-theme detected via method ${i + 1}`);
          return true;
        }
      } catch (e) {
        // Ignore detection errors
      }
    }
    return false;
  };

  // Load compatibility scripts if lobe-theme is detected OR always load for testing
  if (detectLobeTheme()) {
    console.log(
      "[ForgeCouple] Lobe-theme detected, loading compatibility scripts..."
    );
    loadCompatibilityScripts();
  } else {
    console.log(
      "[ForgeCouple] Lobe-theme not detected, but loading compatibility scripts anyway for testing..."
    );
    loadCompatibilityScripts();
  }

  // Make load function available globally for manual loading
  window.loadForgeCoupleCompatibility = loadCompatibilityScripts;
});
