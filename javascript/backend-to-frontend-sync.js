/**
 * Backend to Frontend Coordinate Sync for forge-couple Advanced mode
 * Detects when external plugins/WebUI send coordinate data to forge-couple
 * and syncs those coordinates to the shadow DOM interface
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleBackendSync) {
        return;
    }
    
    class ForgeCoupleBackendSync {
        constructor() {
            this.observers = new Map();
            this.lastKnownMappings = new Map();
            this.activationStates = new Map(); // Track activation states to prevent double-toggling
            this.setupMutationObservers();
            this.setupPasteInterception();
            console.log('[ForgeCoupleBackendSync] Initialized backend to frontend sync');
        }

        setupPasteInterception() {
            // Intercept the ForgeCouple.onPaste calls to get coordinate data directly
            if (window.ForgeCouple && window.ForgeCouple.onPaste) {
                const originalOnPaste = window.ForgeCouple.onPaste;
                window.ForgeCouple.onPaste = (mode) => {
                    console.log(`[ForgeCoupleBackendSync] Intercepted onPaste for ${mode}`);

                    // Call original function first
                    const result = originalOnPaste.call(window.ForgeCouple, mode);

                    // Then try to sync the data
                    setTimeout(() => {
                        this.handlePasteEvent(mode);
                    }, 100);

                    return result;
                };
            } else {
                // ForgeCouple not ready yet, try again later
                setTimeout(() => this.setupPasteInterception(), 1000);
            }
        }

        handlePasteEvent(mode) {
            console.log(`[ForgeCoupleBackendSync] Handling paste event for ${mode}`);

            // Find the paste field that was just updated
            const accordion = document.querySelector(`#forge_couple_${mode}`);
            if (!accordion) return;

            const pasteField = accordion.querySelector('.fc_paste_field textarea');
            if (pasteField && pasteField.value) {
                console.log(`[ForgeCoupleBackendSync] Found paste data for ${mode}:`, pasteField.value);

                try {
                    // Parse the paste data
                    const pasteData = JSON.parse(pasteField.value);

                    // Check if this is coordinate data or region count data
                    if (Array.isArray(pasteData)) {
                        // Direct coordinate data
                        console.log(`[ForgeCoupleBackendSync] Received ${pasteData.length} coordinate regions from external source`);
                        this.syncToShadowDOM(mode, pasteData);
                    } else if (typeof pasteData === 'object' && pasteData.regions) {
                        // Region count data - generate smart coordinates
                        const numRegions = pasteData.regions;
                        console.log(`[ForgeCoupleBackendSync] Received request for ${numRegions} regions from external source`);
                        const smartCoords = this.generateSmartCoordinates(numRegions);
                        this.syncToShadowDOM(mode, smartCoords);
                    }
                } catch (e) {
                    console.log(`[ForgeCoupleBackendSync] Failed to parse paste data:`, e);
                }
            }
        }
        
        setupMutationObservers() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeObservers());
            } else {
                this.initializeObservers();
            }
        }
        
        initializeObservers() {
            // Monitor both t2i and i2i modes
            ['t2i', 'i2i'].forEach(mode => {
                this.setupModeObserver(mode);
            });
            
            // Also monitor for new shadow DOM instances
            this.setupShadowDOMObserver();
        }
        
        setupModeObserver(mode) {
            const accordion = document.querySelector(`#forge_couple_${mode}`);
            if (!accordion) {
                // Try again later if accordion not found
                setTimeout(() => this.setupModeObserver(mode), 1000);
                return;
            }
            
            // Find the hidden JSON mapping component
            const mappingComponents = accordion.querySelectorAll('textarea[data-testid="textbox"]');
            
            mappingComponents.forEach((component, index) => {
                // Check if this component contains mapping data
                if (this.isLikelyMappingComponent(component)) {
                    console.log(`[ForgeCoupleBackendSync] Found mapping component for ${mode} (index ${index})`);
                    this.observeMappingComponent(component, mode);
                }
            });
        }
        
        isLikelyMappingComponent(component) {
            const value = component.value;
            // Check if it looks like coordinate data
            return value === '' || 
                   value.includes('[[') || 
                   value.includes('[0') ||
                   (value.startsWith('[') && value.includes(','));
        }
        
        observeMappingComponent(component, mode) {
            const observerId = `${mode}_${Date.now()}`;
            
            // Store initial value
            this.lastKnownMappings.set(mode, component.value);
            
            // Create mutation observer for the component
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        this.handleMappingUpdate(component, mode);
                    }
                });
            });
            
            // Observe value attribute changes
            observer.observe(component, {
                attributes: true,
                attributeFilter: ['value']
            });
            
            // Also listen for input events
            component.addEventListener('input', () => {
                this.handleMappingUpdate(component, mode);
            });
            
            // Store observer reference
            this.observers.set(observerId, observer);
            
            console.log(`[ForgeCoupleBackendSync] Observing mapping component for ${mode}`);
        }
        
        handleMappingUpdate(component, mode) {
            const newValue = component.value;
            const lastValue = this.lastKnownMappings.get(mode);
            
            // Check if value actually changed
            if (newValue === lastValue) {
                return;
            }
            
            console.log(`[ForgeCoupleBackendSync] Mapping update detected for ${mode}`);
            console.log(`  Previous: ${lastValue}`);
            console.log(`  New: ${newValue}`);
            
            // Update stored value
            this.lastKnownMappings.set(mode, newValue);
            
            // Parse and validate the coordinate data
            let coordinates;
            try {
                coordinates = JSON.parse(newValue);
                if (!Array.isArray(coordinates)) {
                    console.log(`[ForgeCoupleBackendSync] Invalid coordinate format for ${mode}`);
                    return;
                }
            } catch (e) {
                console.log(`[ForgeCoupleBackendSync] Failed to parse coordinates for ${mode}:`, e);
                return;
            }
            
            // Sync to shadow DOM
            this.syncToShadowDOM(mode, coordinates);
        }
        
        syncToShadowDOM(mode, coordinates) {
            console.log(`[ForgeCoupleBackendSync] Starting sync for ${mode} with ${coordinates.length} coordinates`);

            // Debounce rapid sync calls
            const syncKey = `${mode}_sync`;
            const lastSync = this.activationStates.get(syncKey);
            const now = Date.now();

            if (lastSync && (now - lastSync) < 500) {
                console.log(`[ForgeCoupleBackendSync] Debouncing sync for ${mode} - too rapid`);
                return;
            }

            this.activationStates.set(syncKey, now);

            // First, activate forge-couple and set to Advanced mode
            this.activateForgeCoupleAdvanced(mode);

            // Wait a moment for activation to complete before syncing coordinates
            setTimeout(() => {
                // Find the shadow DOM instance for this mode
                const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
                if (!shadowHost || !shadowHost.shadowContainer) {
                    console.log(`[ForgeCoupleBackendSync] No shadow DOM instance found for ${mode}`);
                    return;
                }

                const instance = shadowHost.shadowContainer.forgeCoupleInstance;
                if (!instance) {
                    console.log(`[ForgeCoupleBackendSync] No forge-couple instance found for ${mode}`);
                    return;
                }

                console.log(`[ForgeCoupleBackendSync] Syncing ${coordinates.length} coordinates to shadow DOM for ${mode}`);

                // Convert coordinates to region format
                const regions = coordinates.map((coord, index) => {
                    const [x1, x2, y1, y2, weight] = coord;
                    return {
                        id: `region_${index + 1}`,
                        x1: parseFloat(x1),
                        x2: parseFloat(x2),
                        y1: parseFloat(y1),
                        y2: parseFloat(y2),
                        weight: parseFloat(weight),
                        prompt: instance.regions[index]?.prompt || '', // Preserve existing prompts
                        color: instance.colorPalette[index % instance.colorPalette.length]
                    };
                });

                // Update the instance regions
                instance.regions = regions;

                // Update the UI
                instance.updateTable();
                instance.updateCanvas();

                // Sync to backend (to update our direct mapping storage)
                instance.syncToBackend();

                console.log(`[ForgeCoupleBackendSync] Successfully synced coordinates to shadow DOM for ${mode}`);
                console.log(`  Regions:`, regions.map(r => `(${r.x1},${r.y1})→(${r.x2},${r.y2}) w:${r.weight}`));

            }, 400); // Wait for activation to complete
        }

        activateForgeCoupleAdvanced(mode) {
            console.log(`[ForgeCoupleBackendSync] Activating forge-couple Advanced mode for ${mode}`);

            const accordion = document.querySelector(`#forge_couple_${mode}`);
            if (!accordion) {
                console.log(`[ForgeCoupleBackendSync] Forge-couple accordion not found for ${mode}`);
                return;
            }

            // Check current state first - target only the mode radio buttons
            const enableCheckbox = accordion.querySelector('input[type="checkbox"]');

            // Find the mode radio group specifically (Basic, Advanced, Mask)
            const modeRadios = Array.from(accordion.querySelectorAll('input[type="radio"]')).filter(radio =>
                ['Basic', 'Advanced', 'Mask'].includes(radio.value)
            );

            let advancedRadio = null;
            let currentModeRadio = null;

            modeRadios.forEach(radio => {
                if (radio.value === 'Advanced') {
                    advancedRadio = radio;
                }
                if (radio.checked) {
                    currentModeRadio = radio;
                }
            });

            const isCurrentlyEnabled = enableCheckbox?.checked || false;
            const isCurrentlyAdvanced = advancedRadio?.checked || false;

            console.log(`[ForgeCoupleBackendSync] Current state for ${mode}:`);
            console.log(`  Enabled: ${isCurrentlyEnabled}`);
            console.log(`  Current mode: ${currentModeRadio?.value || 'None'}`);
            console.log(`  Advanced checked: ${isCurrentlyAdvanced}`);
            console.log(`  Mode radio buttons found: ${modeRadios.length}`);

            // Check if we need to make any changes
            const needsEnabling = !isCurrentlyEnabled;
            const needsModeChange = !isCurrentlyAdvanced;

            if (!needsEnabling && !needsModeChange) {
                console.log(`[ForgeCoupleBackendSync] Already in desired state for ${mode} - no changes needed`);
                return;
            }

            // Check debouncing only if we need to make changes
            const activationKey = `${mode}_activation`;
            const lastActivation = this.activationStates.get(activationKey);
            const now = Date.now();

            if (lastActivation && (now - lastActivation) < 1000) {
                console.log(`[ForgeCoupleBackendSync] Debouncing activation for ${mode} - too rapid (${now - lastActivation}ms ago)`);
                return;
            }

            // Mark this activation attempt
            this.activationStates.set(activationKey, now);

            // 1. Enable forge-couple if needed
            if (needsEnabling && enableCheckbox) {
                console.log(`[ForgeCoupleBackendSync] Enabling forge-couple for ${mode}`);
                enableCheckbox.checked = true;
                enableCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (enableCheckbox) {
                console.log(`[ForgeCoupleBackendSync] Forge-couple already enabled for ${mode}`);
            }

            // 2. Set mode to Advanced if needed
            if (needsModeChange && advancedRadio) {
                console.log(`[ForgeCoupleBackendSync] Setting mode to Advanced for ${mode}`);

                // First uncheck all other mode radio buttons (only Basic, Advanced, Mask group)
                modeRadios.forEach(radio => {
                    if (radio !== advancedRadio) {
                        radio.checked = false;
                    }
                });

                // Then set Advanced mode
                advancedRadio.checked = true;
                advancedRadio.dispatchEvent(new Event('change', { bubbles: true }));

                // Verify the state change
                setTimeout(() => {
                    const isNowAdvanced = advancedRadio.checked;
                    const otherModeRadiosUnchecked = modeRadios.filter(r => r !== advancedRadio).every(r => !r.checked);
                    console.log(`[ForgeCoupleBackendSync] Mode change verification: Advanced=${isNowAdvanced}, Other modes unchecked=${otherModeRadiosUnchecked}`);
                }, 100);

            } else if (advancedRadio) {
                console.log(`[ForgeCoupleBackendSync] Already in Advanced mode for ${mode}`);
            }

            // 3. Expand the accordion if it's collapsed
            const accordionHeader = accordion.querySelector('.label-wrap');
            if (accordionHeader) {
                const isCollapsed = accordion.classList.contains('hide') ||
                                  accordion.style.display === 'none' ||
                                  accordionHeader.getAttribute('aria-expanded') === 'false';

                if (isCollapsed) {
                    console.log(`[ForgeCoupleBackendSync] Expanding forge-couple accordion for ${mode}`);
                    accordionHeader.click();
                } else {
                    console.log(`[ForgeCoupleBackendSync] Accordion already expanded for ${mode}`);
                }
            }

            // 4. Wait a moment for UI updates to complete
            setTimeout(() => {
                // Verify final state - only check mode radio buttons
                const finalEnableState = enableCheckbox?.checked;
                const finalModeState = advancedRadio?.checked;

                // Check only mode radio button states (Basic, Advanced, Mask)
                const modeRadioStates = modeRadios.map(radio => ({
                    value: radio.value,
                    checked: radio.checked
                }));

                const checkedModeRadios = modeRadioStates.filter(r => r.checked);

                console.log(`[ForgeCoupleBackendSync] Activation complete for ${mode}:`);
                console.log(`  Final enable state: ${finalEnableState}`);
                console.log(`  Final mode state: ${finalModeState ? 'Advanced' : 'Other'}`);
                console.log(`  Mode radio states:`, modeRadioStates);
                console.log(`  Checked mode radios count: ${checkedModeRadios.length}`);

                if (checkedModeRadios.length > 1) {
                    console.warn(`[ForgeCoupleBackendSync] WARNING: Multiple mode radio buttons checked for ${mode}:`, checkedModeRadios);

                    // Fix the issue by unchecking all mode radios except Advanced
                    modeRadios.forEach(radio => {
                        if (radio.value !== 'Advanced') {
                            radio.checked = false;
                        }
                    });

                    console.log(`[ForgeCoupleBackendSync] Fixed multiple mode radio selection for ${mode}`);
                } else if (checkedModeRadios.length === 1) {
                    console.log(`[ForgeCoupleBackendSync] ✅ Correct: Only one mode radio checked (${checkedModeRadios[0].value})`);
                }
            }, 300);
        }
        
        setupShadowDOMObserver() {
            // Monitor for new shadow DOM instances being created
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const shadowHosts = node.querySelectorAll ? 
                                node.querySelectorAll('.forge-couple-shadow-host') : [];
                            
                            shadowHosts.forEach((host) => {
                                const mode = host.dataset.mode;
                                if (mode && !this.observers.has(`shadow_${mode}`)) {
                                    console.log(`[ForgeCoupleBackendSync] New shadow DOM instance detected for ${mode}`);
                                    // Give it time to initialize
                                    setTimeout(() => this.setupModeObserver(mode), 500);
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
        
        generateSmartCoordinates(numRegions) {
            // Mirror the Python smart coordinate generation logic
            if (numRegions <= 0) return [[0.0, 0.5, 0.0, 1.0, 1.0], [0.5, 1.0, 0.0, 1.0, 1.0]];

            if (numRegions === 1) {
                return [[0.0, 1.0, 0.0, 1.0, 1.0]];
            }

            if (numRegions === 2) {
                return [
                    [0.0, 0.5, 0.0, 1.0, 1.0],  // Left half
                    [0.5, 1.0, 0.0, 1.0, 1.0]   // Right half
                ];
            }

            if (numRegions === 3) {
                return [
                    [0.0, 0.33, 0.0, 1.0, 1.0],   // Left third
                    [0.33, 0.67, 0.0, 1.0, 1.0],  // Center third
                    [0.67, 1.0, 0.0, 1.0, 1.0]    // Right third
                ];
            }

            if (numRegions === 4) {
                return [
                    [0.0, 0.5, 0.0, 0.5, 1.0],    // Top-left
                    [0.5, 1.0, 0.0, 0.5, 1.0],    // Top-right
                    [0.0, 0.5, 0.5, 1.0, 1.0],    // Bottom-left
                    [0.5, 1.0, 0.5, 1.0, 1.0]     // Bottom-right
                ];
            }

            // For more regions, create a grid layout
            const cols = Math.ceil(Math.sqrt(numRegions));
            const rows = Math.ceil(numRegions / cols);
            const coordinates = [];

            for (let i = 0; i < numRegions; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;

                const x1 = col / cols;
                const x2 = (col + 1) / cols;
                const y1 = row / rows;
                const y2 = (row + 1) / rows;

                coordinates.push([x1, x2, y1, y2, 1.0]);
            }

            return coordinates;
        }

        // Manual sync method for testing
        forceSyncAll() {
            ['t2i', 'i2i'].forEach(mode => {
                const accordion = document.querySelector(`#forge_couple_${mode}`);
                if (accordion) {
                    const mappingComponents = accordion.querySelectorAll('textarea[data-testid="textbox"]');
                    mappingComponents.forEach(component => {
                        if (this.isLikelyMappingComponent(component) && component.value) {
                            this.handleMappingUpdate(component, mode);
                        }
                    });
                }
            });
        }
    }
    
    // Initialize the sync system
    window.ForgeCoupleBackendSync = new ForgeCoupleBackendSync();
    
})();
