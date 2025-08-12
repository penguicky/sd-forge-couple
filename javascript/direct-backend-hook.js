/**
 * Direct Backend Hook for forge-couple Shadow DOM implementation
 * Intercepts generation requests and injects our direct mapping data
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleDirectBackendHook) {
        return;
    }
    
    class ForgeCoupleDirectBackendHook {
        constructor() {
            this.version = "1.5.2";
            this.originalFetch = window.fetch;
            this.setupFetchInterceptor();
        }
        
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
        
        isGenerationRequest(url, options) {
            // Check if this is a generation request (Gradio internal or SD API)
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

                // Get the current mode (t2i or i2i)
                const mode = this.detectMode(url, requestData);

                // Verify state is ready before proceeding
                const verificationResult = this.verifyStateReadiness(mode);
                if (!verificationResult.ready) {
                    console.warn(`[ForgeCoupleDirectBackendHook] State not ready for ${mode}:`, verificationResult.issues);
                    // Continue with fallback behavior
                }

                // Get mapping data from our direct interface
                const mappingData = this.getDirectMappingData(mode);
                if (mappingData && mappingData.length > 0) {
                    // Inject our mapping data into the request
                    if (requestData.data && Array.isArray(requestData.data)) {
                        // Update Gradio format
                        this.updateGradioRequestWithMapping(requestData, mappingData, mode);
                    } else {
                        // Update direct API format
                        requestData = this.updateRequestWithMapping(requestData, mappingData);
                    }

                    options.body = JSON.stringify(requestData);


                }

            } catch (error) {
                console.warn('[ForgeCoupleDirectBackendHook] Error injecting mapping data:', error);
            }

            return options;
        }
        
        isForgeCoupleEnabled(requestData) {
            // For Gradio format, check if forge-couple is enabled and in Advanced mode
            if (requestData.data && Array.isArray(requestData.data)) {
                // Check if enabled (Data[63]) and mode is Advanced (Data[65]) and we have mapping data (Data[70])
                const isEnabled = requestData.data[63] === true;
                const isAdvanced = requestData.data[65] === 'Advanced';
                const hasMapping = requestData.data[70] && (Array.isArray(requestData.data[70]) || typeof requestData.data[70] === 'object');

                return isEnabled && isAdvanced && hasMapping;
            }

            // Fallback: check alwayson_scripts format
            if (!requestData.alwayson_scripts) return false;

            const forgeCoupleScript = requestData.alwayson_scripts['forge couple'] ||
                                     requestData.alwayson_scripts['Forge Couple'];

            return forgeCoupleScript && forgeCoupleScript.args && forgeCoupleScript.args[0] === true;
        }
        
        getDirectMappingData(mode) {
            // Get mapping data from our global storage
            if (window.ForgeCoupleDirectMapping && window.ForgeCoupleDirectMapping[mode]) {
                return window.ForgeCoupleDirectMapping[mode];
            }

            // Fallback: try to get from ForgeCouple dataframe
            if (window.ForgeCouple && window.ForgeCouple.dataframe && window.ForgeCouple.dataframe[mode]) {
                const dataframe = window.ForgeCouple.dataframe[mode];
                const rows = dataframe.body.querySelectorAll('tr');
                const mappingData = [];

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 5) {
                        mappingData.push([
                            parseFloat(cells[0].textContent) || 0,
                            parseFloat(cells[1].textContent) || 1,
                            parseFloat(cells[2].textContent) || 0,
                            parseFloat(cells[3].textContent) || 1,
                            parseFloat(cells[4].textContent) || 1
                        ]);
                    }
                });

                return mappingData;
            }

            return null;
        }
        
        updateRequestWithMapping(requestData, mappingData) {
            // Update the forge-couple script args with our mapping data
            if (!requestData.alwayson_scripts) {
                requestData.alwayson_scripts = {};
            }
            
            const scriptKey = 'forge couple';
            if (!requestData.alwayson_scripts[scriptKey]) {
                requestData.alwayson_scripts[scriptKey] = { args: [] };
            }
            
            const args = requestData.alwayson_scripts[scriptKey].args;
            
            // Ensure we have enough args (forge-couple expects specific positions)
            while (args.length < 10) {
                args.push(null);
            }
            
            // Set the mapping data at the correct position (position 7 is mapping)
            args[7] = mappingData;
            
            return requestData;
        }

        findForgeCoupleDataInGradio(requestData) {
            // Look for forge-couple data in Gradio's data array
            // This is a simplified approach - may need refinement based on actual structure
            if (requestData.data && Array.isArray(requestData.data)) {
                // Look for objects that might contain alwayson_scripts
                for (let item of requestData.data) {
                    if (item && typeof item === 'object' && item.alwayson_scripts) {
                        return item;
                    }
                }
            }
            return null;
        }

        detectMode(url, data) {
            // Try to detect if this is t2i or i2i
            if (url.includes('img2img') || url.includes('i2i')) {
                return 'i2i';
            }
            if (url.includes('txt2img') || url.includes('t2i')) {
                return 't2i';
            }

            // Fallback: try to detect from current UI state
            const currentTab = document.querySelector('.tab-nav button.selected');
            if (currentTab && currentTab.textContent.includes('img2img')) {
                return 'i2i';
            }

            return 't2i'; // Default to t2i
        }

        verifyStateReadiness(mode) {
            const issues = [];
            let ready = true;

            // Check 1: State manager availability
            if (!window.ForgeCoupleStateManager) {
                issues.push('State manager not available');
                ready = false;
            } else {
                const stateManager = window.ForgeCoupleStateManager.getInstance();
                if (!stateManager.isInitialized(mode)) {
                    issues.push(`State manager not initialized for ${mode}`);
                    ready = false;
                }
            }

            // Check 2: Direct mapping data
            if (!window.ForgeCoupleDirectMapping || !window.ForgeCoupleDirectMapping[mode]) {
                issues.push(`Direct mapping data not available for ${mode}`);
                ready = false;
            }

            // Check 3: ForgeCouple dataframe
            if (!window.ForgeCouple ||
                !window.ForgeCouple.dataframe ||
                !window.ForgeCouple.dataframe[mode] ||
                !window.ForgeCouple.dataframe[mode].body) {
                issues.push(`ForgeCouple dataframe not ready for ${mode}`);
                ready = false;
            }

            // Check 4: Shadow DOM containers
            const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
            if (!shadowHost) {
                issues.push(`Shadow DOM container not found for ${mode}`);
                // This is not critical, so don't mark as not ready
            }

            if (ready) {
                console.log(`[ForgeCoupleDirectBackendHook] State verification passed for ${mode}`);
            } else {
                console.warn(`[ForgeCoupleDirectBackendHook] State verification failed for ${mode}:`, issues);
            }

            return { ready, issues };
        }

        updateGradioRequestWithMapping(requestData, mappingData, mode) {
            // Update Gradio format request with mapping data
            // Based on analysis: Data[63] = enable, Data[65] = mode, Data[70] = mapping
            if (requestData.data && Array.isArray(requestData.data)) {
                // Check if forge-couple is enabled and in Advanced mode
                const isEnabled = requestData.data[63] === true;
                const isAdvanced = requestData.data[65] === 'Advanced';

                if (isEnabled && isAdvanced) {
                    // Update the mapping data at position 70
                    if (mappingData && mappingData.length > 0) {
                        // Convert array format to the expected format
                        if (Array.isArray(mappingData[0])) {
                            // Already in correct format: [[x1,x2,y1,y2,w], [x1,x2,y1,y2,w]]
                            requestData.data[70] = mappingData;
                        } else {
                            // Convert from object format to array format
                            const mappingArray = mappingData.map(r => [
                                parseFloat(r.x1.toFixed(2)),
                                parseFloat(r.x2.toFixed(2)),
                                parseFloat(r.y1.toFixed(2)),
                                parseFloat(r.y2.toFixed(2)),
                                parseFloat(r.weight.toFixed(1))
                            ]);
                            requestData.data[70] = mappingArray;
                        }
                    }
                }
            }
        }
    }

    // Initialize the hook
    window.ForgeCoupleDirectBackendHook = new ForgeCoupleDirectBackendHook();
    
})();
