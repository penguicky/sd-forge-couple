/**
 * Parameter Paste Interceptor for Forge Couple Shadow DOM
 * 
 * This script intercepts parameter paste operations and handles forge couple
 * advanced mode data directly, bypassing the normal gradio field mechanism
 * when lobe theme is active.
 */

(function() {
    'use strict';
    
    console.log('[ForgeCouple] Parameter paste interceptor loading...');
    
    // Store original paste functions to restore if needed
    let originalPasteFunctions = new Map();
    
    // Track if we've already intercepted paste buttons
    let interceptedButtons = new Set();
    
    /**
     * Parse generation parameters from infotext
     */
    function parseGenerationParameters(infotext) {
        if (!infotext || typeof infotext !== 'string') {
            return {};
        }
        
        const params = {};
        const lines = infotext.split('\n');
        
        for (const line of lines) {
            // Look for key: value pairs
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                params[key] = value;
            }
        }
        
        return params;
    }
    
    /**
     * Convert forge couple mapping data to shadow DOM regions format
     */
    function convertMappingToRegions(mappingData) {
        if (!Array.isArray(mappingData)) {
            return [];
        }
        
        return mappingData.map((item, index) => {
            if (Array.isArray(item) && item.length >= 5) {
                return {
                    id: index + 1,
                    x1: parseFloat(item[0]) || 0,
                    y1: parseFloat(item[2]) || 0,
                    x2: parseFloat(item[1]) || 1,
                    y2: parseFloat(item[3]) || 1,
                    weight: parseFloat(item[4]) || 1.0,
                    prompt: '',
                    color: '#' + Math.floor(Math.random()*16777215).toString(16)
                };
            }
            return null;
        }).filter(region => region !== null);
    }
    
    /**
     * Apply forge couple data directly to shadow DOM
     */
    function applyForgeCoupleDataToShadowDOM(mappingData, mode) {
        console.log(`[ForgeCouple] Applying data directly to shadow DOM for ${mode}:`, mappingData);
        
        // Find the shadow container for this mode
        const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
        if (shadowHost && shadowHost.shadowContainer && shadowHost.shadowContainer.forgeCoupleInstance) {
            const regions = convertMappingToRegions(mappingData);
            
            if (regions.length > 0) {
                shadowHost.shadowContainer.forgeCoupleInstance.importConfig({ regions });
                console.log(`[ForgeCouple] Successfully applied ${regions.length} regions to shadow DOM for ${mode}`);
                return true;
            } else {
                console.warn(`[ForgeCouple] No valid regions found in mapping data for ${mode}`);
            }
        } else {
            console.log(`[ForgeCouple] Shadow DOM not ready for ${mode}, storing data for later`);
            
            // Store data for later application
            if (!window._forgeCoupleDirectPasteData) window._forgeCoupleDirectPasteData = {};
            window._forgeCoupleDirectPasteData[mode] = mappingData;
            
            // Set up watcher for when shadow DOM becomes available
            const checkInterval = setInterval(() => {
                const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
                if (shadowHost && shadowHost.shadowContainer && shadowHost.shadowContainer.forgeCoupleInstance) {
                    clearInterval(checkInterval);
                    
                    const storedData = window._forgeCoupleDirectPasteData[mode];
                    if (storedData) {
                        console.log(`[ForgeCouple] Applying delayed data to shadow DOM for ${mode}`);
                        const regions = convertMappingToRegions(storedData);
                        
                        if (regions.length > 0) {
                            shadowHost.shadowContainer.forgeCoupleInstance.importConfig({ regions });
                            console.log(`[ForgeCouple] Successfully applied ${regions.length} delayed regions to shadow DOM for ${mode}`);
                        }
                        
                        delete window._forgeCoupleDirectPasteData[mode];
                    }
                }
            }, 100);
            
            // Clean up after 30 seconds
            setTimeout(() => clearInterval(checkInterval), 30000);
        }
        
        return false;
    }
    
    /**
     * Create intercepted paste function
     */
    function createInterceptedPasteFunction(originalFunction, mode) {
        return function(infotext) {
            console.log(`[ForgeCouple] Intercepted paste for ${mode}:`, infotext);
            
            // Parse the parameters
            const params = parseGenerationParameters(infotext);
            
            // Check for forge couple mapping data
            const forgeCoupleMapping = params['forge_couple_mapping'];
            if (forgeCoupleMapping) {
                try {
                    const mappingData = JSON.parse(forgeCoupleMapping);
                    console.log(`[ForgeCouple] Found forge couple mapping data for ${mode}:`, mappingData);
                    
                    // Apply directly to shadow DOM
                    const applied = applyForgeCoupleDataToShadowDOM(mappingData, mode);
                    
                    if (applied) {
                        // If we successfully applied to shadow DOM, we might want to
                        // prevent the normal paste operation for forge couple fields
                        // but still allow other parameters to be pasted
                        
                        // Create modified infotext without forge couple mapping to prevent
                        // conflicts with the gradio field
                        const modifiedInfotext = infotext.replace(/forge_couple_mapping:\s*[^\n]+\n?/g, '');
                        
                        // Call original function with modified infotext
                        return originalFunction.call(this, modifiedInfotext);
                    }
                } catch (error) {
                    console.error(`[ForgeCouple] Error parsing forge couple mapping data:`, error);
                }
            }
            
            // If no forge couple data or failed to apply, use original function
            return originalFunction.call(this, infotext);
        };
    }
    
    /**
     * Intercept paste buttons for a specific tab
     */
    function interceptPasteButtonsForTab(tabname) {
        const mode = tabname === 'txt2img' ? 't2i' : tabname === 'img2img' ? 'i2i' : null;
        if (!mode) return;
        
        // Look for paste buttons in this tab
        const tabContainer = document.querySelector(`#tab_${tabname}`);
        if (!tabContainer) return;
        
        const pasteButtons = tabContainer.querySelectorAll('button');
        pasteButtons.forEach(button => {
            // Check if this looks like a paste button
            const buttonText = button.textContent.trim().toLowerCase();
            if (buttonText.includes('paste') || button.title.toLowerCase().includes('paste')) {
                const buttonId = button.id || `paste-button-${Math.random().toString(36).substr(2, 9)}`;
                
                if (!interceptedButtons.has(buttonId)) {
                    console.log(`[ForgeCouple] Found paste button in ${tabname}:`, button);
                    
                    // Store original click handlers
                    const originalHandlers = [];
                    if (button._gradio_click_handlers) {
                        originalHandlers.push(...button._gradio_click_handlers);
                    }
                    
                    // Try to intercept gradio's internal paste function
                    // This is a bit hacky but necessary for deep integration
                    const observer = new MutationObserver(() => {
                        // Check if gradio has attached event handlers
                        if (button._gradio_click_handlers && button._gradio_click_handlers.length > 0) {
                            button._gradio_click_handlers.forEach((handler, index) => {
                                if (typeof handler === 'function' && !handler._forgeCouple_intercepted) {
                                    const originalHandler = handler;
                                    const interceptedHandler = function(...args) {
                                        console.log(`[ForgeCouple] Intercepting gradio click handler for ${mode}`);
                                        
                                        // Get the infotext input (usually the first argument or from a textarea)
                                        let infotext = '';
                                        if (args.length > 0 && typeof args[0] === 'string') {
                                            infotext = args[0];
                                        } else {
                                            // Try to find infotext from textarea in the same tab
                                            const textareas = tabContainer.querySelectorAll('textarea');
                                            for (const textarea of textareas) {
                                                if (textarea.value && textarea.value.includes('Steps:')) {
                                                    infotext = textarea.value;
                                                    break;
                                                }
                                            }
                                        }
                                        
                                        if (infotext) {
                                            const params = parseGenerationParameters(infotext);
                                            const forgeCoupleMapping = params['forge_couple_mapping'];
                                            
                                            if (forgeCoupleMapping) {
                                                try {
                                                    const mappingData = JSON.parse(forgeCoupleMapping);
                                                    applyForgeCoupleDataToShadowDOM(mappingData, mode);
                                                } catch (error) {
                                                    console.error(`[ForgeCouple] Error in intercepted handler:`, error);
                                                }
                                            }
                                        }
                                        
                                        return originalHandler.apply(this, args);
                                    };
                                    
                                    interceptedHandler._forgeCouple_intercepted = true;
                                    button._gradio_click_handlers[index] = interceptedHandler;
                                }
                            });
                        }
                    });
                    
                    observer.observe(button, { attributes: true, childList: true });
                    
                    interceptedButtons.add(buttonId);
                }
            }
        });
    }
    
    /**
     * Set up paste button interception
     */
    function setupPasteButtonInterception() {
        console.log('[ForgeCouple] Setting up paste button interception...');
        
        // Intercept for both tabs
        interceptPasteButtonsForTab('txt2img');
        interceptPasteButtonsForTab('img2img');
        
        // Set up observer for dynamically added paste buttons
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if this is a paste button
                        if (node.tagName === 'BUTTON') {
                            const buttonText = node.textContent.trim().toLowerCase();
                            if (buttonText.includes('paste') || node.title.toLowerCase().includes('paste')) {
                                // Determine which tab this belongs to
                                const tabContainer = node.closest('[id^="tab_"]');
                                if (tabContainer) {
                                    const tabname = tabContainer.id.replace('tab_', '');
                                    setTimeout(() => interceptPasteButtonsForTab(tabname), 100);
                                }
                            }
                        }
                        
                        // Check for paste buttons in added subtrees
                        const pasteButtons = node.querySelectorAll ? node.querySelectorAll('button') : [];
                        pasteButtons.forEach(button => {
                            const buttonText = button.textContent.trim().toLowerCase();
                            if (buttonText.includes('paste') || button.title.toLowerCase().includes('paste')) {
                                const tabContainer = button.closest('[id^="tab_"]');
                                if (tabContainer) {
                                    const tabname = tabContainer.id.replace('tab_', '');
                                    setTimeout(() => interceptPasteButtonsForTab(tabname), 100);
                                }
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupPasteButtonInterception);
    } else {
        setupPasteButtonInterception();
    }
    
    // Also try after a delay to catch late-loading elements
    setTimeout(setupPasteButtonInterception, 2000);
    
    console.log('[ForgeCouple] Parameter paste interceptor loaded');
    
})();
