# Automatic Background Update Implementation

## Overview

Implemented automatic background image updating for the forge-couple Advanced mode shadow DOM interface. When txt2img mode is active, newly generated images automatically appear as canvas backgrounds, with a lock/unlock toggle for user control.

## Features Implemented

### 🔓 **Auto-Update Toggle Button**

**Button Placement**:
```html
<div class="button-group image-controls">
    <button class="btn" id="auto-update-btn">🔓 Auto-Update</button>  <!-- ← New -->
    <button class="btn" id="load-image-btn">📂 Load Image</button>
    <button class="btn" id="clear-image-btn">🗑️ Clear Image</button>
</div>
```

**Button States**:
- **Unlocked (Default)**: `🔓 Auto-Update` - Blue primary button styling
- **Locked**: `🔒 Locked` - Red cancel button styling
- **Tooltips**: Contextual help text for each state

**Visual Styling**:
```css
.btn.auto-update-unlocked {
    background: var(--button-primary-background-fill);
    color: #000000 !important;
    border-color: var(--button-primary-border-color);
}

.btn.auto-update-locked {
    background: var(--button-cancel-background-fill);
    color: #000000 !important;
    border-color: var(--button-cancel-border-color);
}
```

### 🎯 **Automatic Image Detection**

**Trigger Conditions**:
- **Mode**: Only active in txt2img mode (not img2img)
- **State**: Auto-update must be enabled (unlocked)
- **Event**: New image generation completion in WebUI

**Detection Method**:
```javascript
setupImageGenerationObserver() {
    const txt2imgGallery = document.querySelector("#txt2img_gallery");
    
    this.imageGenerationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                // Detect new images added to gallery
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newImages = node.querySelectorAll("img");
                        if (newImages.length > 0 || node.tagName === "IMG") {
                            setTimeout(() => this.handleNewImageGenerated(), 500);
                        }
                    }
                });
            }
        });
    });

    this.imageGenerationObserver.observe(txt2imgGallery, {
        childList: true,
        subtree: true
    });
}
```

**Image Source Priority**:
1. **Main gallery image**: `img[data-testid="detailed-image"]`
2. **Gallery container**: `.gallery img`
3. **Fallback**: First `img` element in gallery

### 🖼️ **Background Update Process**

**Update Flow**:
```javascript
handleNewImageGenerated() {
    if (!this.autoUpdateEnabled) return;

    const latestImage = this.getLatestGeneratedImage();
    if (latestImage && latestImage.src && latestImage.src !== "data:,") {
        this.loadBackgroundImage(latestImage.src);
    }
}
```

**Image Processing**:
- **Same optimization**: Uses existing `loadBackgroundImage()` method
- **Size limiting**: Images > 1M pixels automatically resized
- **Aspect preservation**: Maintains proper scaling and centering
- **Performance**: No additional overhead beyond manual loading

### 🔒 **Lock/Unlock Functionality**

**State Management**:
```javascript
constructor() {
    // Auto-update state management
    this.autoUpdateEnabled = true; // Default to enabled
    this.autoUpdateBtn = null;
}

toggleAutoUpdate() {
    this.autoUpdateEnabled = !this.autoUpdateEnabled;
    this.updateAutoUpdateButton();
    
    if (this.forgeCoupleInstance) {
        this.forgeCoupleInstance.setAutoUpdateEnabled(this.autoUpdateEnabled);
    }
}
```

**Button State Updates**:
```javascript
updateAutoUpdateButton() {
    if (this.autoUpdateEnabled) {
        this.autoUpdateBtn.textContent = "🔓 Auto-Update";
        this.autoUpdateBtn.className = "btn auto-update-unlocked";
        this.autoUpdateBtn.title = "Auto-update enabled - Click to lock";
    } else {
        this.autoUpdateBtn.textContent = "🔒 Locked";
        this.autoUpdateBtn.className = "btn auto-update-locked";
        this.autoUpdateBtn.title = "Auto-update locked - Click to enable";
    }
}
```

## Technical Implementation

### 🔧 **State Synchronization**

**Shadow DOM Container** (`shadow-dom-container.js`):
- **UI State**: Manages button appearance and user interaction
- **Event Handling**: Processes toggle clicks and updates visual state
- **Communication**: Notifies forge-couple instance of state changes

**Forge Couple Instance** (`shadow-forge-couple.js`):
- **Auto-update Logic**: Handles image detection and background updates
- **Observer Management**: Sets up and manages mutation observers
- **Image Processing**: Processes detected images using existing methods

### 🎪 **Event Detection System**

**Mutation Observer Setup**:
- **Target**: `#txt2img_gallery` container
- **Options**: `{ childList: true, subtree: true }`
- **Trigger**: New DOM nodes added to gallery
- **Delay**: 500ms timeout to ensure image is fully loaded

**Error Handling**:
- **Gallery not found**: Retry with 1-second delay
- **Invalid images**: Check for valid src and non-empty data URLs
- **Observer cleanup**: Proper disconnection on component destruction

### 🚀 **Performance Considerations**

**Efficient Detection**:
- **Targeted observation**: Only watches txt2img gallery, not entire page
- **Conditional processing**: Only processes when auto-update is enabled
- **Debounced updates**: 500ms delay prevents multiple rapid updates

**Memory Management**:
- **Observer cleanup**: Proper disconnection in destroy method
- **Image optimization**: Same size limits as manual loading
- **State persistence**: Maintains settings during session only

## User Experience

### ✅ **Seamless Workflow**
- **Default enabled**: Auto-update active by default for immediate feedback
- **Visual feedback**: Clear button states indicate current mode
- **Non-intrusive**: Doesn't interfere with region manipulation
- **Manual override**: Load/Clear buttons work regardless of auto-update state

### ✅ **Intuitive Controls**
- **Clear icons**: 🔓 for unlocked, 🔒 for locked
- **Color coding**: Blue for enabled, red for locked
- **Tooltips**: Contextual help for each state
- **Consistent styling**: Matches lobe-theme design system

### ✅ **Flexible Usage**
- **Auto-workflow**: Generate → Auto-background → Map regions
- **Manual workflow**: Generate → Lock → Load specific image → Map regions
- **Mixed workflow**: Switch between auto and manual as needed

## Integration Benefits

### ✅ **txt2img Mode Only**
- **Targeted functionality**: Only active where it makes sense
- **No img2img interference**: Avoids conflicts with img2img workflow
- **Mode-specific behavior**: Respects different use cases

### ✅ **Existing Feature Compatibility**
- **Manual loading**: Load Image button works independently
- **Image clearing**: Clear Image button works regardless of auto-update
- **Background processing**: Uses same optimization and scaling logic

### ✅ **Resource Management**
- **Proper cleanup**: Observer disconnection on component destruction
- **Memory efficiency**: No memory leaks or persistent observers
- **Performance**: Minimal impact on canvas operations

## Files Modified

### **`shadow-dom-container.js`**
- **UI Button**: Added auto-update toggle button with state styling
- **Event Handlers**: Added toggle functionality and button state management
- **State Management**: Added autoUpdateEnabled property and update methods

### **`shadow-forge-couple.js`**
- **Auto-update Setup**: Added setupAutoImageUpdate() and observer initialization
- **Image Detection**: Added mutation observer for txt2img gallery monitoring
- **Background Updates**: Added automatic background loading on image generation
- **Cleanup**: Added observer disconnection in destroy method

## Usage Scenarios

### 🎨 **Rapid Iteration Workflow**
1. **Enable auto-update** (default state)
2. **Generate images** in txt2img
3. **Backgrounds update automatically** for immediate region mapping
4. **Iterate quickly** with visual feedback

### 🔒 **Reference Image Workflow**
1. **Generate reference image**
2. **Lock auto-update** to preserve background
3. **Continue generating** without background changes
4. **Map regions** on stable reference

### 🔄 **Mixed Workflow**
1. **Start with auto-update** for exploration
2. **Lock when satisfied** with specific image
3. **Manual load** different images as needed
4. **Unlock** to resume auto-updates

The implementation provides a seamless, intuitive workflow enhancement that significantly improves the user experience for region mapping tasks while maintaining full backward compatibility with existing manual image loading functionality.
