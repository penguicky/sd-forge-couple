/**
 * Smart Paste Handler for forge-couple
 * Intercepts paste data from other plugins and generates appropriate coordinates
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleSmartPasteHandler) {
        return;
    }
    
    class ForgeCoupleSmartPasteHandler {
        constructor() {
            this.setupPasteInterception();
            console.log('[ForgeCoupleSmartPasteHandler] Initialized');
        }
        
        setupPasteInterception() {
            // Wait for ForgeCouple to be available
            const checkForgeCouple = () => {
                if (window.ForgeCouple && window.ForgeCouple.pasteField) {
                    this.interceptPasteFields();
                } else {
                    setTimeout(checkForgeCouple, 1000);
                }
            };
            checkForgeCouple();
        }
        
        interceptPasteFields() {
            const modes = ['t2i', 'i2i'];
            
            modes.forEach(mode => {
                const pasteField = window.ForgeCouple.pasteField[mode];
                if (pasteField && !pasteField._smartPasteHandlerAttached) {
                    pasteField._smartPasteHandlerAttached = true;
                    
                    // Store original change handler
                    const originalOnChange = pasteField.onchange;
                    const originalOnInput = pasteField.oninput;
                    
                    // Override the change handler
                    pasteField.addEventListener('input', (event) => {
                        this.handlePasteData(event, mode);
                    }, { capture: true });
                    
                    console.log(`[ForgeCoupleSmartPasteHandler] Intercepting paste field for ${mode}`);
                }
            });
        }
        
        handlePasteData(event, mode) {
            const pasteField = event.target;
            const rawData = pasteField.value;
            
            if (!rawData || !rawData.trim()) {
                return;
            }
            
            try {
                const parsedData = JSON.parse(rawData);
                const smartData = this.processIncomingData(parsedData, mode);
                
                if (smartData && JSON.stringify(smartData) !== rawData) {
                    console.log(`[ForgeCoupleSmartPasteHandler] Converting paste data for ${mode}:`, {
                        original: parsedData,
                        smart: smartData
                    });
                    
                    // Update the paste field with smart coordinates
                    pasteField.value = JSON.stringify(smartData);
                    
                    // Trigger the update
                    if (window.updateInput) {
                        window.updateInput(pasteField);
                    }
                }
                
            } catch (e) {
                // Not JSON data, let it pass through
                console.log(`[ForgeCoupleSmartPasteHandler] Non-JSON paste data for ${mode}, passing through`);
            }
        }
        
        processIncomingData(data, mode) {
            // Case 1: Direct coordinate array (most common)
            if (Array.isArray(data) && data.length > 0) {
                // Check if this looks like coordinate data
                if (this.isCoordinateData(data)) {
                    // Check if it's default coordinates that need improvement
                    if (this.isDefaultCoordinates(data)) {
                        console.log(`[ForgeCoupleSmartPasteHandler] Detected default coordinates, generating smart layout for ${data.length} regions`);
                        return this.generateSmartCoordinates(data.length);
                    }
                    // Valid coordinate data, pass through
                    return data;
                }
                
                // Array but not coordinate data, might be region count or other format
                if (data.every(item => typeof item === 'number' && item > 0)) {
                    // Looks like region counts or similar
                    const numRegions = Math.max(...data);
                    console.log(`[ForgeCoupleSmartPasteHandler] Detected region count data, generating ${numRegions} regions`);
                    return this.generateSmartCoordinates(numRegions);
                }
            }
            
            // Case 2: Object with region information
            if (typeof data === 'object' && data !== null) {
                if (data.regions && typeof data.regions === 'number') {
                    console.log(`[ForgeCoupleSmartPasteHandler] Detected region count: ${data.regions}`);
                    return this.generateSmartCoordinates(data.regions);
                }
                
                if (data.mapping && Array.isArray(data.mapping)) {
                    return this.processIncomingData(data.mapping, mode);
                }
                
                // Check for other common formats from different plugins
                if (data.prompts && Array.isArray(data.prompts)) {
                    const numRegions = data.prompts.length;
                    console.log(`[ForgeCoupleSmartPasteHandler] Detected prompt array, generating ${numRegions} regions`);
                    return this.generateSmartCoordinates(numRegions);
                }
            }
            
            // Case 3: String that might contain region information
            if (typeof data === 'string') {
                // Try to extract number of regions from string
                const lines = data.split('\n').filter(line => line.trim());
                if (lines.length > 1) {
                    console.log(`[ForgeCoupleSmartPasteHandler] Detected multi-line string, generating ${lines.length} regions`);
                    return this.generateSmartCoordinates(lines.length);
                }
            }
            
            // Default: return original data
            return data;
        }
        
        isCoordinateData(data) {
            if (!Array.isArray(data) || data.length === 0) return false;
            
            return data.every(item => 
                Array.isArray(item) && 
                item.length >= 4 && 
                item.every(coord => typeof coord === 'number')
            );
        }
        
        isDefaultCoordinates(data) {
            const defaultMapping = [[0.0, 0.5, 0.0, 1.0, 1.0], [0.5, 1.0, 0.0, 1.0, 1.0]];
            
            if (data.length !== defaultMapping.length) return false;
            
            return data.every((region, i) => 
                region.length >= 4 &&
                Math.abs(region[0] - defaultMapping[i][0]) < 0.001 &&
                Math.abs(region[1] - defaultMapping[i][1]) < 0.001 &&
                Math.abs(region[2] - defaultMapping[i][2]) < 0.001 &&
                Math.abs(region[3] - defaultMapping[i][3]) < 0.001
            );
        }
        
        generateSmartCoordinates(numRegions) {
            if (numRegions <= 0) return [[0.0, 1.0, 0.0, 1.0, 1.0]];
            
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
            let regionIdx = 0;
            
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (regionIdx >= numRegions) break;
                    
                    const x1 = col / cols;
                    const x2 = (col + 1) / cols;
                    const y1 = row / rows;
                    const y2 = (row + 1) / rows;
                    
                    coordinates.push([x1, x2, y1, y2, 1.0]);
                    regionIdx++;
                }
            }
            
            return coordinates;
        }
    }
    
    // Initialize the smart paste handler
    window.ForgeCoupleSmartPasteHandler = new ForgeCoupleSmartPasteHandler();
    
})();
