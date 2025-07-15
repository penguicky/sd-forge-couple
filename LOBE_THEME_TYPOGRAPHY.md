# Lobe-Theme Typography Integration

## Overview

The forge-couple Advanced mode shadow DOM interface has been updated to match lobe-theme's typography system, ensuring visual consistency with the rest of the lobe-theme interface.

## Changes Made

### 🔤 **Font Family Integration**

**Shadow DOM Container** (`shadow-dom-container.js`):
- **Primary font**: Changed from hardcoded fonts to `var(--font)` (lobe-theme's primary font)
- **Monospace font**: Added `var(--font-mono)` for prompt inputs (code-like text)
- **System fallback**: Maintains compatibility when lobe-theme variables aren't available

**Canvas Labels** (`shadow-forge-couple.js`):
- **Dynamic font detection**: Added helper methods to get lobe-theme font values
- **Graceful fallback**: Uses system fonts when lobe-theme variables unavailable
- **Runtime adaptation**: Adapts to lobe-theme's current font settings

### 📏 **Font Size Standardization**

**CSS Variable Mapping**:
```css
/* Before: Hardcoded sizes */
font-size: 14px;
font-size: 13px;
font-size: 12px;
font-size: 11px;
font-size: 10px;

/* After: Lobe-theme variables */
font-size: var(--text-md);    /* Body text */
font-size: var(--text-sm);    /* Small text */
font-size: var(--text-xs);    /* Extra small text */
font-size: var(--text-xxs);   /* Tiny text */
font-size: var(--text-lg);    /* Large text (headers) */
```

**Size Usage Mapping**:
- **`var(--text-lg)`**: Toolbar headers (16px equivalent)
- **`var(--text-md)`**: Main container, buttons (14px equivalent)
- **`var(--text-sm)`**: Table content, prompt inputs (13px equivalent)
- **`var(--text-xs)`**: Table headers, status indicators (11px equivalent)
- **`var(--text-xxs)`**: Action buttons (10px equivalent)

### 🎨 **Color Integration**

**Lobe-Theme Color Variables**:
```css
/* Text colors */
color: var(--body-text-color);           /* Primary text */
color: var(--body-text-color-subdued);   /* Secondary text */

/* Background colors */
background: var(--background-fill-primary);    /* Primary backgrounds */
background: var(--background-fill-secondary);  /* Secondary backgrounds */

/* Border colors */
border: 1px solid var(--border-color-primary); /* Standard borders */
```

## Implementation Details

### 🔧 **Canvas Font Detection**

**Helper Methods Added**:
```javascript
getLobeThemeFontSize() {
    // Try to get --text-md CSS variable
    const rootStyles = getComputedStyle(document.documentElement);
    const textMd = rootStyles.getPropertyValue('--text-md').trim();
    if (textMd) return textMd;
    
    // Fallback to body font-size
    return rootStyles.fontSize || null;
}

getLobeThemeFontFamily() {
    // Try to get --font CSS variable
    const rootStyles = getComputedStyle(document.documentElement);
    const fontFamily = rootStyles.getPropertyValue('--font').trim();
    if (fontFamily) return fontFamily;
    
    // Fallback to body font-family
    return rootStyles.fontFamily || null;
}
```

**Canvas Label Rendering**:
```javascript
// Dynamic font application
const fontSize = this.getLobeThemeFontSize() || '14px';
const fontFamily = this.getLobeThemeFontFamily() || 'system-ui, -apple-system, sans-serif';
this.ctx.font = `bold ${fontSize} ${fontFamily}`;
```

### 📱 **Responsive Typography**

**Adaptive Sizing**:
- **CSS variables**: Automatically adapt to lobe-theme's responsive font scaling
- **Runtime detection**: Canvas labels adjust to current theme settings
- **Fallback system**: Maintains functionality when lobe-theme isn't available

**Monospace Integration**:
- **Prompt inputs**: Use `var(--font-mono)` for code-like text consistency
- **Coordinate fields**: Maintain readability with appropriate font choice
- **Table alignment**: Consistent spacing with monospace where needed

## Benefits

### ✅ **Visual Consistency**
- **Unified appearance**: Matches lobe-theme's typography exactly
- **Professional integration**: No visual disconnect between interfaces
- **Theme compatibility**: Adapts to lobe-theme updates automatically

### ✅ **Maintainability**
- **CSS variables**: Easy to update when lobe-theme changes
- **Centralized theming**: No hardcoded font values to maintain
- **Automatic adaptation**: Responds to theme changes without code updates

### ✅ **User Experience**
- **Familiar typography**: Users see consistent fonts across all interfaces
- **Accessibility**: Inherits lobe-theme's accessibility improvements
- **Customization**: Respects user's font preferences through lobe-theme

## Files Modified

### **`shadow-dom-container.js`**
- **Container styles**: Updated to use `var(--font)` and lobe-theme size variables
- **Table typography**: Standardized font sizes using CSS variables
- **Button styling**: Integrated with lobe-theme color and typography system
- **Input fields**: Added monospace font for prompt inputs

### **`shadow-forge-couple.js`**
- **Canvas labels**: Dynamic font detection and application
- **Helper methods**: Added font detection utilities
- **Fallback system**: Graceful degradation when lobe-theme unavailable

## Compatibility

### 🔄 **Backward Compatibility**
- **Fallback fonts**: System fonts used when lobe-theme variables unavailable
- **Size fallbacks**: Reasonable pixel values when CSS variables missing
- **Error handling**: Graceful handling of missing theme integration

### 🎯 **Forward Compatibility**
- **CSS variables**: Automatically adapt to future lobe-theme updates
- **Dynamic detection**: Runtime adaptation to theme changes
- **Extensible system**: Easy to add new typography features

The typography integration ensures forge-couple's Advanced mode feels like a native part of the lobe-theme interface while maintaining full functionality and compatibility.
