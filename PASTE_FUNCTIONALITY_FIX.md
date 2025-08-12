# Forge Couple Advanced Mode Paste Functionality Fix

## Problem Description

When using forge couple's advanced mode with the lobe theme compatibility layer (shadow DOM), the right-click "Send to txt2img/img2img" functionality was broken. Images generated with forge couple advanced mode contain mapping data in their metadata, but when sent to txt2img/img2img, this data was not being applied to the advanced mode UI.

## Root Cause Analysis

The issue occurred because:

1. **Shadow DOM Isolation**: The lobe theme compatibility layer creates a shadow DOM to isolate forge couple's UI from React interference
2. **Missing Data Bridge**: The shadow DOM implementation had monitoring for prompts, resolution, and image generation, but lacked monitoring for the paste field changes
3. **Data Flow Disconnect**: The parameter paste system updates the original gradio `mapping_paste_field`, but the shadow DOM never reads from this field

## Data Flow

### Working Flow (Basic Mode)
1. Image metadata contains `forge_couple_mapping` with JSON array: `[[x1, x2, y1, y2, weight], ...]`
2. Right-click → Send to txt2img/img2img extracts metadata
3. Parameter paste system updates hidden `mapping_paste_field` textarea
4. Field `.change()` event triggers `ForgeCouple.onPaste(mode)`
5. UI updates with mapping data

### Broken Flow (Advanced Mode with Shadow DOM)
1. Parameter paste system updates original gradio field ✅
2. Shadow DOM never monitors this field ❌
3. Data never reaches shadow DOM UI ❌

## Solution Implemented

Added a paste field watcher to the shadow DOM implementation that:

1. **Monitors Original Field**: Watches the original gradio `mapping_paste_field` for value changes
2. **Converts Data Format**: Transforms the mapping array to regions format expected by shadow DOM
3. **Applies to Shadow DOM**: Uses existing `importConfig()` method to update the UI
4. **Cleans Up**: Clears the paste field after processing to prevent repeated application

## Code Changes

### 1. Added Paste Field Watcher Properties (Constructor)
```javascript
// Paste field watcher for parameter paste functionality
this.originalPasteField = null;
this.pasteFieldObserver = null;
this.pasteFieldCheckInterval = null;
this.pasteFieldWatcherAttached = false;
this.debugMode = false;
```

### 2. Added setupPasteFieldWatcher() Method
- Finds the original gradio paste field using multiple selectors
- Sets up MutationObserver and event listeners for field changes
- Includes periodic fallback checking
- Follows same pattern as existing `setupPromptWatcher()` and `setupResolutionWatcher()`

### 3. Added handlePasteFieldChange() Method
- Parses JSON mapping data from paste field
- Validates data format
- Converts to regions format using `convertMappingToRegions()`
- Applies to shadow DOM using existing `importConfig()` method
- Clears paste field to prevent repeated processing

### 4. Added convertMappingToRegions() Method
- Converts backend mapping format `[x1, x2, y1, y2, weight]` to shadow DOM regions format
- Handles validation and error cases
- Assigns colors using new `getColorForIndex()` method

### 5. Added getColorForIndex() Method
- Returns color from palette based on index
- Used for consistent region coloring

### 6. Integrated into setupBackendIntegration()
- Added call to `setupPasteFieldWatcher()` alongside existing watchers

### 7. Added Cleanup in destroy() Method
- Properly disconnects MutationObserver
- Clears intervals to prevent memory leaks

## Data Structure

The mapping data is stored in image metadata as:
```json
{
  "forge_couple_mapping": "[[0.0, 0.5, 0.0, 1.0, 1.0], [0.5, 1.0, 0.0, 1.0, 1.0]]"
}
```

Where each array represents a region:
- `[x1, x2, y1, y2, weight]`
- Coordinates are normalized (0-1)
- Weight is a float value

## Testing

A test file `test_paste_functionality.html` was created to verify the implementation:
- Simulates gradio components and shadow DOM
- Tests the paste field monitoring and data conversion
- Provides visual feedback of the process

## Files Modified

1. `data/extensions/sd-forge-couple/javascript/shadow-forge-couple.js`
   - Added paste field monitoring functionality
   - ~150 lines of new code following existing patterns

## Files Added

1. `data/extensions/sd-forge-couple/test_paste_functionality.html`
   - Test interface for verifying the fix
2. `data/extensions/sd-forge-couple/PASTE_FUNCTIONALITY_FIX.md`
   - This documentation file

## Expected Behavior After Fix

1. Generate an image using forge couple advanced mode
2. Right-click the image in gallery or image browser
3. Select "Send to txt2img" or "Send to img2img"
4. Switch to forge couple advanced mode
5. The regions and masks should now be automatically loaded and displayed

## Compatibility

- Maintains backward compatibility with existing functionality
- Uses same patterns as existing watchers in the codebase
- Follows existing error handling and cleanup patterns
- No breaking changes to existing APIs

## Performance Impact

- Minimal performance impact
- Uses efficient MutationObserver for field monitoring
- Includes proper cleanup to prevent memory leaks
- Periodic fallback check runs every 500ms only when needed
