/**
 * Centralized State Manager for forge-couple
 * Provides a single source of truth for coordinate data and manages synchronization
 * across all storage locations (regions array, ForgeCoupleDirectMapping, dataframe)
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleStateManager) {
        return;
    }
    
    class ForgeCoupleStateManager {
        constructor() {
            this.state = {
                regions: { t2i: [], i2i: [] },
                initialized: { t2i: false, i2i: false },
                lastUpdate: { t2i: 0, i2i: 0 }
            };
            
            this.listeners = {
                t2i: new Set(),
                i2i: new Set()
            };
            
            this.debugMode = false;
            this.syncInProgress = { t2i: false, i2i: false };
            
            console.log('[ForgeCoupleStateManager] Initialized');
        }
        
        /**
         * Get singleton instance
         */
        static getInstance() {
            if (!window.__forgeCoupleStateManager) {
                window.__forgeCoupleStateManager = new ForgeCoupleStateManager();
            }
            return window.__forgeCoupleStateManager;
        }
        
        /**
         * Set debug mode
         */
        setDebugMode(enabled) {
            this.debugMode = enabled;
            if (enabled) {
                console.log('[ForgeCoupleStateManager] Debug mode enabled');
            }
        }
        
        /**
         * Update regions for a specific mode
         * @param {string} mode - 't2i' or 'i2i'
         * @param {Array} regions - Array of region objects
         * @param {string} source - Source of the update (for debugging)
         */
        updateRegions(mode, regions, source = 'unknown') {
            if (this.syncInProgress[mode]) {
                if (this.debugMode) {
                    console.log(`[ForgeCoupleStateManager] Sync already in progress for ${mode}, skipping update from ${source}`);
                }
                return false;
            }
            
            this.syncInProgress[mode] = true;
            
            try {
                if (this.debugMode) {
                    console.log(`[ForgeCoupleStateManager] Updating ${regions.length} regions for ${mode} from ${source}`);
                }
                
                // Validate regions
                const validatedRegions = this.validateRegions(regions);
                
                // Update internal state
                this.state.regions[mode] = validatedRegions;
                this.state.lastUpdate[mode] = Date.now();
                this.state.initialized[mode] = true;
                
                // Sync to all storage locations
                this.syncToAllStores(mode);
                
                // Notify listeners
                this.notifyListeners(mode, validatedRegions, source);
                
                if (this.debugMode) {
                    console.log(`[ForgeCoupleStateManager] Successfully updated ${mode} with ${validatedRegions.length} regions`);
                }
                
                return true;
            } catch (error) {
                console.error(`[ForgeCoupleStateManager] Error updating regions for ${mode}:`, error);
                return false;
            } finally {
                this.syncInProgress[mode] = false;
            }
        }
        
        /**
         * Get current regions for a mode
         * @param {string} mode - 't2i' or 'i2i'
         * @returns {Array} Current regions
         */
        getRegions(mode) {
            return [...this.state.regions[mode]];
        }
        
        /**
         * Check if a mode is initialized
         * @param {string} mode - 't2i' or 'i2i'
         * @returns {boolean} True if initialized
         */
        isInitialized(mode) {
            return this.state.initialized[mode];
        }
        
        /**
         * Validate region data
         * @param {Array} regions - Regions to validate
         * @returns {Array} Validated regions
         */
        validateRegions(regions) {
            if (!Array.isArray(regions)) {
                console.warn('[ForgeCoupleStateManager] Invalid regions data, using empty array');
                return [];
            }
            
            return regions.map((region, index) => {
                const validated = {
                    id: region.id || index + 1,
                    x1: this.clamp(parseFloat(region.x1) || 0, 0, 1),
                    y1: this.clamp(parseFloat(region.y1) || 0, 0, 1),
                    x2: this.clamp(parseFloat(region.x2) || 1, 0, 1),
                    y2: this.clamp(parseFloat(region.y2) || 1, 0, 1),
                    weight: this.clamp(parseFloat(region.weight) || 1, 0, 10),
                    prompt: String(region.prompt || ''),
                    color: region.color || '#ff0000'
                };
                
                // Ensure x1 < x2 and y1 < y2
                if (validated.x1 >= validated.x2) {
                    [validated.x1, validated.x2] = [validated.x2, validated.x1];
                }
                if (validated.y1 >= validated.y2) {
                    [validated.y1, validated.y2] = [validated.y2, validated.y1];
                }
                
                return validated;
            });
        }
        
        /**
         * Sync regions to all storage locations
         * @param {string} mode - Mode to sync
         */
        syncToAllStores(mode) {
            const regions = this.state.regions[mode];
            
            try {
                // 1. Update global mapping for backend hook
                this.updateDirectMapping(mode, regions);
                
                // 2. Update ForgeCouple dataframe
                this.updateDataframe(mode, regions);
                
                // 3. Update shadow DOM if available
                this.updateShadowDOM(mode, regions);
                
                if (this.debugMode) {
                    console.log(`[ForgeCoupleStateManager] Synced ${regions.length} regions to all stores for ${mode}`);
                }
            } catch (error) {
                console.error(`[ForgeCoupleStateManager] Error syncing to stores for ${mode}:`, error);
            }
        }
        
        /**
         * Update global mapping for backend hook
         * @param {string} mode - Mode to update
         * @param {Array} regions - Region data
         */
        updateDirectMapping(mode, regions) {
            if (!window.ForgeCoupleDirectMapping) {
                window.ForgeCoupleDirectMapping = {};
            }
            
            const mappingData = regions.map(r => [
                parseFloat(r.x1.toFixed(2)),
                parseFloat(r.x2.toFixed(2)),
                parseFloat(r.y1.toFixed(2)),
                parseFloat(r.y2.toFixed(2)),
                parseFloat(r.weight.toFixed(1))
            ]);
            
            window.ForgeCoupleDirectMapping[mode] = mappingData;
            
            if (this.debugMode) {
                console.log(`[ForgeCoupleStateManager] Updated direct mapping for ${mode}:`, mappingData);
            }
        }
        
        /**
         * Update ForgeCouple dataframe
         * @param {string} mode - Mode to update
         * @param {Array} regions - Region data
         */
        updateDataframe(mode, regions) {
            try {
                if (!window.ForgeCouple || !window.ForgeCouple.dataframe || !window.ForgeCouple.dataframe[mode]) {
                    if (this.debugMode) {
                        console.log(`[ForgeCoupleStateManager] ForgeCouple dataframe not available for ${mode}`);
                    }
                    return;
                }
                
                const dataframe = window.ForgeCouple.dataframe[mode];
                if (!dataframe.body) {
                    if (this.debugMode) {
                        console.log(`[ForgeCoupleStateManager] Dataframe body not available for ${mode}`);
                    }
                    return;
                }
                
                // Clear existing rows
                while (dataframe.body.firstChild) {
                    dataframe.body.removeChild(dataframe.body.firstChild);
                }
                
                // Add new rows
                regions.forEach((region) => {
                    const row = dataframe.body.insertRow();
                    const coords = [
                        region.x1.toFixed(2),
                        region.x2.toFixed(2),
                        region.y1.toFixed(2),
                        region.y2.toFixed(2),
                        region.weight.toFixed(1),
                        region.prompt
                    ];
                    
                    coords.forEach((value) => {
                        const cell = row.insertCell();
                        cell.textContent = value;
                        cell.contentEditable = true;
                    });
                });
                
                if (this.debugMode) {
                    console.log(`[ForgeCoupleStateManager] Updated dataframe for ${mode} with ${regions.length} rows`);
                }
            } catch (error) {
                console.error(`[ForgeCoupleStateManager] Error updating dataframe for ${mode}:`, error);
            }
        }
        
        /**
         * Update shadow DOM instance
         * @param {string} mode - Mode to update
         * @param {Array} regions - Region data
         */
        updateShadowDOM(mode, regions) {
            try {
                // Find shadow DOM container
                const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
                if (!shadowHost || !shadowHost.shadowRoot) {
                    if (this.debugMode) {
                        console.log(`[ForgeCoupleStateManager] Shadow DOM not available for ${mode}`);
                    }
                    return;
                }
                
                // Get the forge couple instance from the shadow container
                const shadowContainer = shadowHost.shadowContainer;
                if (shadowContainer && shadowContainer.forgeCoupleInstance) {
                    // Update regions without triggering sync loop
                    shadowContainer.forgeCoupleInstance.regions = regions;
                    shadowContainer.forgeCoupleInstance.updateCanvas();
                    shadowContainer.forgeCoupleInstance.updateTable();
                    
                    if (this.debugMode) {
                        console.log(`[ForgeCoupleStateManager] Updated shadow DOM for ${mode} with ${regions.length} regions`);
                    }
                }
            } catch (error) {
                console.error(`[ForgeCoupleStateManager] Error updating shadow DOM for ${mode}:`, error);
            }
        }
        
        /**
         * Add listener for region changes
         * @param {string} mode - Mode to listen to
         * @param {Function} callback - Callback function
         * @returns {Function} Unsubscribe function
         */
        addListener(mode, callback) {
            this.listeners[mode].add(callback);
            return () => this.listeners[mode].delete(callback);
        }
        
        /**
         * Notify all listeners of region changes
         * @param {string} mode - Mode that changed
         * @param {Array} regions - New regions
         * @param {string} source - Source of change
         */
        notifyListeners(mode, regions, source) {
            this.listeners[mode].forEach(callback => {
                try {
                    callback(regions, source);
                } catch (error) {
                    console.error('[ForgeCoupleStateManager] Error in listener callback:', error);
                }
            });
        }
        
        /**
         * Utility function to clamp values
         */
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }
        
        /**
         * Get state summary for debugging
         */
        getStateSummary() {
            return {
                regions: {
                    t2i: this.state.regions.t2i.length,
                    i2i: this.state.regions.i2i.length
                },
                initialized: { ...this.state.initialized },
                lastUpdate: { ...this.state.lastUpdate },
                syncInProgress: { ...this.syncInProgress }
            };
        }
    }
    
    // Create global instance
    window.ForgeCoupleStateManager = ForgeCoupleStateManager;
    
    // Initialize singleton
    ForgeCoupleStateManager.getInstance();
    
})();
