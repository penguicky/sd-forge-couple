/**
 * Unified Sync System for forge-couple
 * Consolidates Direct Interface + Backend Hook into single authoritative sync system
 * Version: 1.2.0
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleUnifiedSync) {
        return;
    }
    
    class ForgeCoupleUnifiedSync {
        constructor() {
            this.version = "1.6.0";
            this.originalFetch = window.fetch;
            this.pendingMappingData = {}; // Store mapping data for next request

            this.setupFetchInterceptor();
        }
        
        /**
         * Main sync method - called by Shadow DOM when regions change
         * @param {string} mode - 't2i' or 'i2i'
         * @param {Array} regions - Array of region objects {x1, y1, x2, y2, weight, prompt}
         */
        static syncToBackend(mode, regions) {
            if (!window.forgeCoupleUnifiedSync) {
                window.forgeCoupleUnifiedSync = new ForgeCoupleUnifiedSync();
            }
            
            const instance = window.forgeCoupleUnifiedSync;
            
            // Transform regions to mapping format
            const mappingData = instance.transformRegions(regions);
            
            // Store globally for compatibility and inject into next request
            instance.updateGlobalStorage(mode, mappingData);
            instance.prepareForNextRequest(mode, mappingData);
        }
        
        /**
         * Transform region objects to backend mapping format with validation
         * @param {Array} regions - Region objects from Shadow DOM
         * @returns {Array} - Mapping data in format [[x1, x2, y1, y2, weight], ...]
         */
        transformRegions(regions) {
            return regions.map(region => {
                // Comprehensive validation and normalization
                const validated = this.validateAndNormalizeRegion(region);
                return [
                    parseFloat(validated.x1.toFixed(2)),
                    parseFloat(validated.x2.toFixed(2)),
                    parseFloat(validated.y1.toFixed(2)),
                    parseFloat(validated.y2.toFixed(2)),
                    parseFloat(validated.weight.toFixed(1))
                ];
            });
        }

        /**
         * Comprehensive region validation and normalization
         * @param {Object} region - Region object to validate
         * @returns {Object} - Validated and normalized region
         */
        validateAndNormalizeRegion(region) {
            // Ensure all values are numbers
            let x1 = parseFloat(region.x1) || 0;
            let y1 = parseFloat(region.y1) || 0;
            let x2 = parseFloat(region.x2) || 1;
            let y2 = parseFloat(region.y2) || 1;
            let weight = parseFloat(region.weight) || 1;

            // Clamp to valid ranges
            x1 = Math.max(0, Math.min(1, x1));
            y1 = Math.max(0, Math.min(1, y1));
            x2 = Math.max(0, Math.min(1, x2));
            y2 = Math.max(0, Math.min(1, y2));
            weight = Math.max(0.1, Math.min(5, weight));

            // Ensure proper coordinate ordering
            if (x1 >= x2) {
                x2 = Math.min(1, x1 + 0.01);
            }
            if (y1 >= y2) {
                y2 = Math.min(1, y1 + 0.01);
            }

            // Ensure minimum region size
            const minSize = 0.01;
            if (x2 - x1 < minSize) {
                x2 = Math.min(1, x1 + minSize);
            }
            if (y2 - y1 < minSize) {
                y2 = Math.min(1, y1 + minSize);
            }

            return { x1, y1, x2, y2, weight };
        }
        
        /**
         * Update global storage for compatibility with existing systems
         * @param {string} mode - 't2i' or 'i2i'
         * @param {Array} mappingData - Transformed mapping data
         */
        updateGlobalStorage(mode, mappingData) {
            // Maintain global storage for compatibility
            if (!window.ForgeCoupleDirectMapping) {
                window.ForgeCoupleDirectMapping = {};
            }
            
            // Prevent overwriting custom data with defaults
            const existingData = window.ForgeCoupleDirectMapping[mode];
            if (existingData && existingData.length > 0) {
                const isExistingCustom = existingData.some(region => 
                    region[0] !== 0 || region[1] !== 1 || region[2] !== 0 || region[3] !== 1 || region[4] !== 1
                );
                const isNewDefault = mappingData.every(region => 
                    region[0] === 0 && region[1] === 1 && region[2] === 0 && region[3] === 1 && region[4] === 1
                );
                
                if (isExistingCustom && isNewDefault) {
                    // Don't overwrite custom data with defaults
                    return;
                }
            }
            
            window.ForgeCoupleDirectMapping[mode] = mappingData;
        }
        
        /**
         * Prepare mapping data for injection into next API request
         * @param {string} mode - 't2i' or 'i2i'
         * @param {Array} mappingData - Transformed mapping data
         */
        prepareForNextRequest(mode, mappingData) {
            this.pendingMappingData[mode] = mappingData;
        }
        
        /**
         * Set up fetch interceptor to inject mapping data into generation requests
         */
        setupFetchInterceptor() {
            const self = this;
            
            window.fetch = async function(url, options = {}) {
                // Check if this is a generation request
                if (self.isGenerationRequest(url, options)) {
                    options = self.injectMappingData(options, url);
                }
                
                // Call original fetch
                return self.originalFetch.call(this, url, options);
            };
        }
        
        /**
         * Check if the request is a generation request
         * @param {string} url - Request URL
         * @param {Object} options - Fetch options
         * @returns {boolean} - True if generation request
         */
        isGenerationRequest(url, options) {
            return (
                options.method === 'POST' &&
                (url.includes('/sdapi/v1/txt2img') ||
                 url.includes('/sdapi/v1/img2img') ||
                 url.includes('/api/v1/txt2img') ||
                 url.includes('/api/v1/img2img') ||
                 url.includes('/run/predict') ||
                 url.includes('/queue/join'))
            );
        }
        
        /**
         * Inject mapping data into generation request
         * @param {Object} options - Fetch options
         * @param {string} url - Request URL
         * @returns {Object} - Modified options with injected mapping data
         */
        injectMappingData(options, url) {
            try {
                if (!options.body) return options;

                let requestData;
                try {
                    requestData = JSON.parse(options.body);
                } catch (e) {
                    return options; // Not JSON, skip
                }

                // Check if forge-couple is enabled in the request
                const forgeCoupleEnabled = this.isForgeCoupleEnabled(requestData);
                if (!forgeCoupleEnabled) {
                    return options;
                }

                const mode = this.detectModeFromRequest(url, requestData);

                // Try pending data first, then fall back to global storage
                let mappingData = this.pendingMappingData[mode];
                if (!mappingData) {
                    mappingData = this.getGlobalMappingData(mode);
                }

                if (mappingData && mappingData.length > 0) {
                    this.updateGradioRequestWithMapping(requestData, mappingData, mode);
                    options.body = JSON.stringify(requestData);

                    // Clear pending data after injection (but keep global storage)
                    delete this.pendingMappingData[mode];
                }

            } catch (error) {
                // Silent error handling - injection failed
            }

            return options;
        }
        
        /**
         * Detect mode (t2i/i2i) from request
         * @param {string} url - Request URL
         * @param {Object} requestData - Request data
         * @returns {string|null} - Detected mode or null
         */
        detectModeFromRequest(url, requestData) {
            if (url.includes('txt2img') || url.includes('t2i')) {
                return 't2i';
            } else if (url.includes('img2img') || url.includes('i2i')) {
                return 'i2i';
            }
            
            // Fallback: try to detect from request data structure
            // This is a heuristic based on typical gradio request patterns
            return 't2i'; // Default to t2i if unclear
        }
        
        /**
         * Check if forge-couple is enabled in the request
         * @param {Object} requestData - Request data object
         * @returns {boolean} - True if forge-couple is enabled and ready
         */
        isForgeCoupleEnabled(requestData) {
            // For Gradio format, check if forge-couple is enabled and in Advanced mode
            if (requestData.data && Array.isArray(requestData.data)) {
                // Check if enabled (Data[63]) and mode is Advanced (Data[65])
                const isEnabled = requestData.data[63] === true;
                const isAdvanced = requestData.data[65] === 'Advanced';

                return isEnabled && isAdvanced;
            }

            // For direct API format, assume enabled if we have mapping data
            return true;
        }

        /**
         * Get mapping data from global storage (fallback)
         * @param {string} mode - 't2i' or 'i2i'
         * @returns {Array|null} - Mapping data or null
         */
        getGlobalMappingData(mode) {
            return window.ForgeCoupleDirectMapping?.[mode] || null;
        }

        /**
         * Update Gradio request with mapping data
         * @param {Object} requestData - Request data object
         * @param {Array} mappingData - Mapping data to inject
         * @param {string} mode - Mode (t2i/i2i)
         */
        updateGradioRequestWithMapping(requestData, mappingData, mode) {
            if (requestData.data && Array.isArray(requestData.data)) {
                // Update the mapping data at position 70
                if (mappingData && mappingData.length > 0) {
                    requestData.data[70] = mappingData;
                }
            }
        }
        
        /**
         * Get current mapping data for a mode (compatibility method)
         * @param {string} mode - 't2i' or 'i2i'
         * @returns {Array|null} - Current mapping data or null
         */
        getCurrentMapping(mode) {
            return window.ForgeCoupleDirectMapping?.[mode] || null;
        }
        
        /**
         * Clear mapping data for a mode
         * @param {string} mode - 't2i' or 'i2i'
         */
        clearMapping(mode) {
            if (window.ForgeCoupleDirectMapping) {
                delete window.ForgeCoupleDirectMapping[mode];
            }
            delete this.pendingMappingData[mode];
        }
        
        /**
         * Cleanup method
         */
        destroy() {
            // Restore original fetch
            if (this.originalFetch) {
                window.fetch = this.originalFetch;
            }
            
            // Clear pending data
            this.pendingMappingData = {};
        }
    }
    
    // Export to global scope
    window.ForgeCoupleUnifiedSync = ForgeCoupleUnifiedSync;
    
    // Auto-initialize global instance
    window.forgeCoupleUnifiedSync = new ForgeCoupleUnifiedSync();
    
})();
