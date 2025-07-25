/**
 * Direct Interface for forge-couple backend communication
 * Provides direct object manipulation instead of DOM updates
 */
class ForgeCoupleDirectInterface {
    constructor(mode) {
        this.mode = mode; // 't2i' or 'i2i'
        this.isReady = false;
        this.initializeInterface();
    }

    /**
     * Initialize and wait for ForgeCouple to be available with retry mechanism
     */
    async initializeInterface() {
        const maxRetries = 15;
        const retryDelay = 200;
        const maxWaitTime = 10000; // 10 seconds total

        console.log(`[ForgeCoupleDirectInterface] Initializing interface for ${this.mode} mode`);

        // Check if ForgeCouple is already available
        if (this.checkReadiness()) {
            this.isReady = true;
            console.log(`[ForgeCoupleDirectInterface] Already ready for ${this.mode} mode`);
            return true;
        }

        // Retry mechanism with exponential backoff
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[ForgeCoupleDirectInterface] Attempt ${attempt}/${maxRetries} for ${this.mode} mode`);

            if (this.checkReadiness()) {
                this.isReady = true;
                console.log(`[ForgeCoupleDirectInterface] Successfully initialized for ${this.mode} mode after ${attempt} attempts`);
                return true;
            }

            // Create missing components if needed
            this.ensureForgeCouplExists();

            if (attempt < maxRetries) {
                const delay = Math.min(retryDelay * Math.pow(1.2, attempt - 1), 1000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.error(`[ForgeCoupleDirectInterface] Failed to initialize for ${this.mode} mode after ${maxRetries} attempts`);
        return false;
    }

    /**
     * Check if all required components are ready
     */
    checkReadiness() {
        return window.ForgeCouple &&
               window.ForgeCouple.dataframe &&
               window.ForgeCouple.dataframe[this.mode] &&
               window.ForgeCouple.dataframe[this.mode].body;
    }

    /**
     * Ensure ForgeCouple global object exists with required structure
     */
    ensureForgeCouplExists() {
        if (!window.ForgeCouple) {
            console.log('[ForgeCoupleDirectInterface] Creating ForgeCouple global object');
            window.ForgeCouple = {};
        }

        if (!window.ForgeCouple.dataframe) {
            window.ForgeCouple.dataframe = {};
        }

        if (!window.ForgeCouple.dataframe[this.mode]) {
            console.log(`[ForgeCoupleDirectInterface] Creating dataframe for ${this.mode} mode`);
            window.ForgeCouple.dataframe[this.mode] = {
                body: document.createElement('tbody')
            };
        }

        if (!window.ForgeCouple.entryField) {
            window.ForgeCouple.entryField = {};
        }

        if (!window.ForgeCouple.entryField[this.mode]) {
            window.ForgeCouple.entryField[this.mode] = document.createElement('input');
        }
    }

    /**
     * Update regions directly in ForgeCouple with retry mechanism
     * @param {Array} regions - Array of region objects with x1, y1, x2, y2, weight, prompt
     * @returns {boolean} Success status
     */
    async updateRegions(regions) {
        if (!this.isReady) {
            console.warn(`[ForgeCoupleDirectInterface] Not ready yet for ${this.mode} mode, attempting to initialize`);
            const initialized = await this.initializeInterface();
            if (!initialized) {
                console.error(`[ForgeCoupleDirectInterface] Failed to initialize for ${this.mode} mode`);
                return false;
            }
        }

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[ForgeCoupleDirectInterface] Updating regions for ${this.mode} mode (attempt ${attempt}/${maxRetries})`);

                const fc = window.ForgeCouple;
                const dataframe = fc.dataframe[this.mode];

                if (!dataframe || !dataframe.body) {
                    console.error(`[ForgeCoupleDirectInterface] Dataframe not found for ${this.mode} mode`);
                    if (attempt < maxRetries) {
                        this.ensureForgeCouplExists();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        continue;
                    }
                    return false;
                }

                // Update the dataframe directly
                this.updateDataframe(dataframe, regions);

                // Update the JSON data in the entry field
                if (fc.entryField && fc.entryField[this.mode]) {
                    const mappingData = regions.map(r => [
                        parseFloat(r.x1.toFixed(2)),
                        parseFloat(r.x2.toFixed(2)),
                        parseFloat(r.y1.toFixed(2)),
                        parseFloat(r.y2.toFixed(2)),
                        parseFloat(r.weight.toFixed(1))
                    ]);

                    fc.entryField[this.mode].value = JSON.stringify(mappingData);

                    // Trigger the update - using the updateInput function if available
                    if (window.updateInput) {
                        window.updateInput(fc.entryField[this.mode]);
                    } else {
                        fc.entryField[this.mode].dispatchEvent(new Event('input', { bubbles: true }));
                        fc.entryField[this.mode].dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                // Call ForgeCouple's update methods
                if (fc.onEntry) {
                    fc.onEntry(this.mode);
                }

                // Trigger preview update
                if (fc.preview) {
                    fc.preview(this.mode);
                }

                // Update the mapping component if it exists
                this.updateMappingComponent(regions);

                // Verify the update was successful
                if (this.verifyRegionsUpdate(regions)) {
                    console.log(`[ForgeCoupleDirectInterface] Successfully updated ${regions.length} regions for ${this.mode} mode`);
                    return true;
                } else {
                    console.warn(`[ForgeCoupleDirectInterface] Region update verification failed for ${this.mode} mode`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        continue;
                    }
                }

            } catch (error) {
                console.error(`[ForgeCoupleDirectInterface] Error updating regions (attempt ${attempt}/${maxRetries}):`, error);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
            }
        }

        console.error(`[ForgeCoupleDirectInterface] Failed to update regions for ${this.mode} mode after ${maxRetries} attempts`);
        return false;
    }

    /**
     * Verify that regions were successfully updated
     * @param {Array} expectedRegions - Expected region data
     * @returns {boolean} True if verification passes
     */
    verifyRegionsUpdate(expectedRegions) {
        try {
            const fc = window.ForgeCouple;
            const dataframe = fc.dataframe[this.mode];

            if (!dataframe || !dataframe.body) {
                return false;
            }

            const rows = dataframe.body.querySelectorAll('tr');
            if (rows.length !== expectedRegions.length) {
                console.warn(`[ForgeCoupleDirectInterface] Row count mismatch: expected ${expectedRegions.length}, got ${rows.length}`);
                return false;
            }

            // Verify mapping data is stored globally
            if (!window.ForgeCoupleDirectMapping || !window.ForgeCoupleDirectMapping[this.mode]) {
                console.warn(`[ForgeCoupleDirectInterface] Global mapping data not found for ${this.mode} mode`);
                return false;
            }

            const globalMapping = window.ForgeCoupleDirectMapping[this.mode];
            if (globalMapping.length !== expectedRegions.length) {
                console.warn(`[ForgeCoupleDirectInterface] Global mapping count mismatch: expected ${expectedRegions.length}, got ${globalMapping.length}`);
                return false;
            }

            console.log(`[ForgeCoupleDirectInterface] Verification passed for ${this.mode} mode: ${expectedRegions.length} regions`);
            return true;
        } catch (error) {
            console.error('[ForgeCoupleDirectInterface] Verification error:', error);
            return false;
        }
    }

    /**
     * Update the dataframe tbody directly
     * @param {Object} dataframe - ForgeCouple dataframe instance
     * @param {Array} regions - Region data
     */
    updateDataframe(dataframe, regions) {
        const tbody = dataframe.body;
        
        // Store active element to restore focus
        const activeElement = document.activeElement;
        const activeId = activeElement ? activeElement.id : null;
        
        // Clear existing rows
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }

        // Add new rows
        regions.forEach((region, index) => {
            const tr = tbody.insertRow();
            
            // Add coordinate cells
            const coords = [
                region.x1.toFixed(2),
                region.x2.toFixed(2),
                region.y1.toFixed(2),
                region.y2.toFixed(2),
                region.weight.toFixed(1)
            ];

            coords.forEach((value) => {
                const td = tr.insertCell();
                td.contentEditable = true;
                td.textContent = value;

                // Add event listeners matching original behavior
                td.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        td.blur();
                    }
                });

                td.addEventListener('blur', () => {
                    // Call dataframe's submit handler
                    if (dataframe.onSubmit) {
                        dataframe.onSubmit(td, false);
                    }
                });

                td.onclick = () => {
                    if (dataframe.onSelect) {
                        dataframe.onSelect(index);
                    }
                };
            });

            // Add prompt cell
            const promptTd = tr.insertCell();
            promptTd.contentEditable = true;
            promptTd.textContent = region.prompt || '';

            promptTd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    promptTd.blur();
                }
            });

            promptTd.addEventListener('blur', () => {
                if (dataframe.onSubmit) {
                    dataframe.onSubmit(promptTd, true);
                }
            });

            promptTd.onclick = () => {
                if (dataframe.onSelect) {
                    dataframe.onSelect(index);
                }
            };
        });

        // Restore focus if needed
        if (activeId && activeElement) {
            const newActive = document.getElementById(activeId);
            if (newActive) {
                newActive.focus();
            }
        }
    }

    /**
     * Update the hidden mapping component used by the backend
     * @param {Array} regions - Region data
     */
    updateMappingComponent(regions) {
        try {
            const accordion = document.querySelector(`#forge_couple_${this.mode}`);
            if (!accordion) return;

            // Find the JSON component (hidden input)
            const jsonComponents = accordion.querySelectorAll('textarea[data-testid*="json"], input[type="hidden"]');
            
            const mappingData = regions.map(r => [
                parseFloat(r.x1.toFixed(2)),
                parseFloat(r.x2.toFixed(2)),
                parseFloat(r.y1.toFixed(2)),
                parseFloat(r.y2.toFixed(2)),
                parseFloat(r.weight.toFixed(1))
            ]);

            jsonComponents.forEach(component => {
                if (component.value && (component.value.includes('[[') || component.value === '[]')) {
                    component.value = JSON.stringify(mappingData);
                    
                    // Trigger Gradio update if needed
                    if (component._gradio_component) {
                        component._gradio_component.value = mappingData;
                    }
                }
            });
        } catch (error) {
            console.warn('[ForgeCoupleDirectInterface] Could not update mapping component:', error);
        }
    }



    /**
     * Get current regions from ForgeCouple
     * @returns {Array} Array of region objects
     */
    getRegions() {
        if (!this.isReady) return [];

        try {
            const fc = window.ForgeCouple;
            const dataframe = fc.dataframe[this.mode];
            
            if (!dataframe || !dataframe.body) return [];

            const rows = dataframe.body.querySelectorAll('tr');
            const regions = [];

            rows.forEach((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    regions.push({
                        x1: parseFloat(cells[0].textContent) || 0,
                        x2: parseFloat(cells[1].textContent) || 1,
                        y1: parseFloat(cells[2].textContent) || 0,
                        y2: parseFloat(cells[3].textContent) || 1,
                        weight: parseFloat(cells[4].textContent) || 1,
                        prompt: cells[5].textContent || ''
                    });
                }
            });

            return regions;
        } catch (error) {
            console.error('[ForgeCoupleDirectInterface] Error getting regions:', error);
            return [];
        }
    }

    /**
     * Check if ForgeCouple is in Advanced mode
     * @returns {boolean}
     */
    isAdvancedMode() {
        try {
            const accordion = document.querySelector(`#forge_couple_${this.mode}`);
            if (!accordion) return false;

            const modeRadio = accordion.querySelector('input[type="radio"][value="Advanced"]:checked');
            return !!modeRadio;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.isReady = false;
    }
}

// Make available globally
window.ForgeCoupleDirectInterface = ForgeCoupleDirectInterface;