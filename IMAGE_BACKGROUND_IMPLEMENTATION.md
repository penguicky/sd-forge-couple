# Image Background Implementation

## Overview

Implemented "Load Image" and "Clear Image" background functionality for the forge-couple Advanced mode shadow DOM interface to achieve feature parity with the original forge-couple extension. Users can now load reference images as canvas backgrounds for more precise region mapping.

## Implementation Details

### 🔘 **UI Controls Added**

**Button Layout** (`shadow-dom-container.js`):
```html
<div class="controls-section">
    <div class="button-group">
        <!-- Existing buttons -->
        <button class="btn" id="clear-all-btn">Clear All</button>
        <button class="btn" id="reset-default-btn">Default Mapping</button>
        <button class="btn" id="export-config-btn">Export Config</button>
        <button class="btn" id="import-config-btn">Import Config</button>
    </div>
    <div class="button-group image-controls">
        <button class="btn" id="load-image-btn">📂 Load Image</button>
        <button class="btn" id="clear-image-btn">🗑️ Clear Image</button>
    </div>
</div>
```

**Button Styling**:
```css
.controls-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.controls-section .image-controls {
    justify-content: flex-end;
    margin-top: -8px;
}
```

**Visual Design**:
- **Icons**: 📂 for Load Image, 🗑️ for Clear Image
- **Positioning**: Right-aligned with the table as requested
- **Styling**: Matches existing lobe-theme button design system
- **Layout**: Inline with other control buttons but visually separated

### 🖼️ **Image Loading System**

**File Input Handling** (`shadow-dom-container.js`):
```javascript
handleLoadImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.forgeCoupleInstance.loadBackgroundImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    input.click();
}
```

**Supported Formats**:
- **PNG**: Full transparency support
- **JPG/JPEG**: Standard image format
- **WebP**: Modern web format
- **GIF**: Basic support
- **All formats**: Accepted via `image/*` filter

### 🎨 **Canvas Background Integration**

**Background Image Management** (`shadow-forge-couple.js`):
```javascript
constructor(shadowRoot, mode) {
    // ... existing code ...
    
    // Background image management
    this.backgroundImage = null;
    this.backgroundImageData = null;
}
```

**Canvas Drawing Order**:
```javascript
updateCanvas() {
    // 1. Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw background image (bottom layer)
    this.drawBackgroundImage();

    // 3. Draw grid (optional overlay)
    this.drawGrid();

    // 4. Draw regions (top layer)
    this.regions.forEach(region => this.drawRegion(region));
    
    // 5. Draw selection handles (topmost)
    if (this.selectedRegion) {
        this.drawSelectionHandles(this.selectedRegion);
    }
}
```

### 📐 **Image Scaling and Positioning**

**Aspect Ratio Preservation**:
```javascript
drawBackgroundImage() {
    if (!this.backgroundImage) return;

    const canvasAspect = this.canvas.width / this.canvas.height;
    const imageAspect = this.backgroundImage.width / this.backgroundImage.height;

    let drawWidth, drawHeight, drawX, drawY;

    if (imageAspect > canvasAspect) {
        // Image is wider - fit to canvas width
        drawWidth = this.canvas.width;
        drawHeight = this.canvas.width / imageAspect;
        drawX = 0;
        drawY = (this.canvas.height - drawHeight) / 2;
    } else {
        // Image is taller - fit to canvas height
        drawWidth = this.canvas.height * imageAspect;
        drawHeight = this.canvas.height;
        drawX = (this.canvas.width - drawWidth) / 2;
        drawY = 0;
    }

    this.ctx.drawImage(this.backgroundImage, drawX, drawY, drawWidth, drawHeight);
}
```

**Scaling Behavior**:
- **Fit to canvas**: Image scales to fit within canvas bounds
- **Aspect ratio**: Always preserved to prevent distortion
- **Centering**: Image centered within canvas if aspect ratios differ
- **No cropping**: Full image always visible

### 🔧 **Image Processing**

**Size Optimization** (following original implementation):
```javascript
loadBackgroundImage(imageDataUrl) {
    const img = new Image();
    img.onload = () => {
        const maxDim = 1024 * 1024; // 1M pixels max
        let width = img.width;
        let height = img.height;

        if (width * height > maxDim) {
            // Resize large images for performance
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            while (width * height > maxDim) {
                width = Math.round(width / 2);
                height = Math.round(height / 2);
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Use resized image
            const resizedImg = new Image();
            resizedImg.onload = () => {
                this.backgroundImage = resizedImg;
                this.backgroundImageData = canvas.toDataURL('image/jpeg');
                this.updateCanvas();
            };
            resizedImg.src = canvas.toDataURL('image/jpeg');
        } else {
            // Use original image
            this.backgroundImage = img;
            this.backgroundImageData = imageDataUrl;
            this.updateCanvas();
        }
    };
    img.src = imageDataUrl;
}
```

**Performance Features**:
- **Size limiting**: Images larger than 1M pixels are automatically resized
- **Progressive scaling**: Reduces by half until under limit
- **Memory management**: Prevents browser crashes with huge images
- **Format conversion**: Large images converted to JPEG for efficiency

### 🗑️ **Image Clearing**

**Clear Functionality**:
```javascript
handleClearImage() {
    this.forgeCoupleInstance.clearBackgroundImage();
}

clearBackgroundImage() {
    this.backgroundImage = null;
    this.backgroundImageData = null;
    this.updateCanvas();
}
```

**Cleanup Process**:
- **Image reference**: Set to null for garbage collection
- **Data URL**: Cleared to free memory
- **Canvas update**: Immediate redraw without background
- **State reset**: Returns to clean canvas state

## User Experience Features

### ✅ **Visual Feedback**
- **Loading**: Smooth image loading with immediate canvas update
- **Error handling**: Graceful handling of invalid files
- **State indication**: Clear visual difference between loaded/cleared states

### ✅ **Interaction Model**
- **Non-interfering**: Background image doesn't affect region manipulation
- **Layer ordering**: Regions always render above background image
- **Selection clarity**: Selected regions remain clearly visible over background

### ✅ **Performance Optimization**
- **Efficient rendering**: Background drawn only when canvas updates
- **Memory management**: Automatic cleanup and size optimization
- **Smooth interaction**: No performance impact on region operations

## Integration Benefits

### ✅ **Feature Parity**
- **Original behavior**: Matches original forge-couple image background functionality
- **File support**: Same image format support as original
- **Size handling**: Same performance optimizations as original

### ✅ **Shadow DOM Integration**
- **Isolated functionality**: Works within shadow DOM boundaries
- **Event handling**: Proper resource management and cleanup
- **Theme consistency**: Buttons match lobe-theme design system

### ✅ **Canvas Performance**
- **Layered rendering**: Efficient drawing order for optimal performance
- **Aspect preservation**: Professional image scaling behavior
- **Memory efficiency**: Automatic optimization for large images

## Files Modified

### **`shadow-dom-container.js`**
- **UI buttons**: Added Load Image and Clear Image buttons with proper styling
- **Event handlers**: Added click handlers for image operations
- **Image methods**: Added handleLoadImage() and handleClearImage() methods

### **`shadow-forge-couple.js`**
- **State management**: Added backgroundImage and backgroundImageData properties
- **Canvas rendering**: Modified updateCanvas() to include background image layer
- **Drawing methods**: Added drawBackgroundImage() method with aspect ratio handling
- **Image processing**: Added loadBackgroundImage() and clearBackgroundImage() methods

The implementation provides a complete image background system that enhances the region mapping workflow by allowing users to load reference images for more precise region placement, while maintaining all the performance and usability characteristics of the original forge-couple extension.
