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
     * Initialize and wait for ForgeCouple to be available
     */
    initializeInterface() {
        // Check if ForgeCouple is already available
        if (window.ForgeCouple && window.ForgeCouple.dataframe && window.ForgeCouple.dataframe[this.mode]) {
            this.isReady = true;
            return;
        }

        // Wait for ForgeCouple to be initialized
        const checkInterval = setInterval(() => {
            if (window.ForgeCouple && 
                window.ForgeCouple.dataframe && 
                window.ForgeCouple.dataframe[this.mode]) {
                this.isReady = true;
                clearInterval(checkInterval);
                console.log(`[ForgeCoupleDirectInterface] Ready for ${this.mode} mode`);
            }
        }, 100);

        // Timeout after 30 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.isReady) {
                console.error('[ForgeCoupleDirectInterface] Timeout waiting for ForgeCouple');
            }
        }, 30000);
    }

    /**
     * Update regions directly in ForgeCouple
     * @param {Array} regions - Array of region objects with x1, y1, x2, y2, weight, prompt
     * @returns {boolean} Success status
     */
    updateRegions(regions) {
        if (!this.isReady) {
            console.warn('[ForgeCoupleDirectInterface] Not ready yet');
            return false;
        }

        try {
            const fc = window.ForgeCouple;
            const dataframe = fc.dataframe[this.mode];

            if (!dataframe || !dataframe.body) {
                console.error('[ForgeCoupleDirectInterface] Dataframe not found');
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

            return true;
        } catch (error) {
            console.error('[ForgeCoupleDirectInterface] Error updating regions:', error);
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