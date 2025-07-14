# Forge-Couple Advanced Mode Synchronization Bug Fix

## Problem Description

The forge-couple Advanced mode had a synchronization bug where:
- **First image generation** used outdated default mapping coordinates `[[0, 1, 0, 1, 1], [0, 1, 0, 1, 1], [0, 1, 0, 1, 1]]`
- **Second image generation** correctly used updated mapping coordinates
- Backend consistently received previous mapping state instead of current UI state
- Manual "Sync Backend" button worked correctly

## Root Cause Analysis

The issue was that `syncToBackend()` was **not being called automatically** when regions were updated in the shadow DOM interface. The sync only occurred:

1. During initialization (with 500ms delay)
2. When manually triggered via "Sync Backend" button (`forceSyncToBackend()`)
3. During generation hooks (but timing was unreliable)

**Key Finding**: The shadow DOM interface was updating regions but not syncing them to the backend Gradio components that forge-couple actually reads from.

## Solution Implemented

### 1. Added Automatic Sync Method

```javascript
/**
 * Automatically sync to backend when regions change
 * Uses debouncing to prevent excessive sync calls
 */
autoSyncToBackend() {
  // Only sync when in Advanced mode
  const currentMode = this.detectCurrentForgeCoupleMode();
  if (currentMode !== "Advanced") {
    return;
  }

  // Clear any existing timeout
  if (this.autoSyncTimeout) {
    clearTimeout(this.autoSyncTimeout);
  }

  // Debounce sync calls to prevent spam during rapid changes
  this.autoSyncTimeout = setTimeout(() => {
    console.log("[ShadowForgeCouple] Auto-syncing to backend...");
    this.syncToBackend();
  }, 100); // 100ms debounce
}
```

### 2. Added Auto-Sync Calls to All Region Modification Methods

**Region Management:**
- `addRegion()` - When regions are added
- `deleteRegion()` - When regions are deleted  
- `clearAllRegions()` - When all regions are cleared

**User Interactions:**
- `handleTableChange()` - When table values are modified
- Drag operations - When regions are moved or resized
- `handleAddAction()` - When regions are added via UI actions

**Data Synchronization:**
- `syncFromWebUIPrompts()` - When prompts are synced from WebUI

### 3. Enhanced Generation Detection

**Improved Button Hooks:**
```javascript
// Use capture phase to ensure we run before other handlers
button.addEventListener("click", (e) => {
  console.log("[ShadowForgeCouple] Generation click detected - forcing immediate sync...");
  // Force immediate sync without debouncing
  this.forceSyncToBackend();
}, { capture: true });
```

**Added Generation Observer:**
```javascript
setupGenerationObserver() {
  // Watch for changes in the progress bar or generation status
  const progressContainer = document.querySelector("#txt2img_results, #img2img_results");
  
  if (progressContainer && !this.generationObserver) {
    this.generationObserver = new MutationObserver((mutations) => {
      // Look for changes that indicate generation is starting
      const progressBar = document.querySelector(".progress-bar, [data-testid='progress-bar']");
      if (progressBar && progressBar.style.display !== 'none') {
        console.log("[ShadowForgeCouple] Generation detected via progress bar - syncing...");
        this.forceSyncToBackend();
      }
    });
    // ... observer configuration
  }
}
```

## Key Benefits

1. **Real-time Sync**: Backend now receives current mapping data immediately when regions change
2. **Debounced Updates**: Prevents excessive sync calls during rapid UI changes (100ms debounce)
3. **Multiple Detection Methods**: Generation detection via button clicks AND progress bar changes
4. **Automatic Operation**: No manual intervention required - sync happens transparently
5. **Backward Compatibility**: Manual "Sync Backend" button still works as before

## Testing

A test page has been created at `test-auto-sync.html` to verify:
- Auto-sync method availability
- Successful sync calls when regions are modified
- Manual sync functionality
- Error handling and logging

## Files Modified

- `data/extensions/sd-forge-couple/javascript/shadow-forge-couple.js`
  - Added `autoSyncToBackend()` method
  - Added auto-sync calls to all region modification methods
  - Enhanced generation detection with observer pattern
  - Added cleanup for new timeout and observer

## Expected Behavior After Fix

- **First image generation**: Uses current shadow DOM region coordinates immediately
- **All subsequent generations**: Continue to use current coordinates
- **Real-time updates**: Backend stays synchronized with UI changes
- **Performance**: Debounced updates prevent excessive sync calls
- **Reliability**: Multiple generation detection methods ensure sync occurs

The fix ensures that the backend always receives the current mapping state from the shadow DOM interface, eliminating the one-generation delay that was causing the synchronization bug.
