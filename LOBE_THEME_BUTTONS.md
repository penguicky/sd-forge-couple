# Lobe-Theme Button Integration

## Overview

The forge-couple Advanced mode shadow DOM interface buttons have been updated to match lobe-theme's button styling and behavior, ensuring visual consistency and native-like integration with the lobe-theme interface.

## Button Categories Updated

### 🔘 **Main Control Buttons**
- **Add Row** button
- **Delete Last Row** button  
- **Default Mapping** button
- **Export Config** button

### 🔘 **Action Buttons** (Table Cell Buttons)
- **Small action buttons** in table cells (🆕, ❌, etc.)
- **Compact sizing** for table integration

### 🔘 **Row Menu System**
- **Menu trigger buttons** (⋮ three dots)
- **Dropdown menu buttons** (Insert Above, Insert Below, Delete)
- **Context menu styling**

## Lobe-Theme Design System Integration

### 🎨 **Visual Styling**

**CSS Variables Used**:
```css
/* Button foundations */
--button-border-width: 1px
--button-transition: all 0.12s ease-in-out

/* Secondary buttons (default) */
--button-secondary-background-fill
--button-secondary-background-fill-hover
--button-secondary-border-color
--button-secondary-border-color-hover
--button-secondary-text-color
--button-secondary-text-color-hover

/* Primary buttons */
--button-primary-background-fill
--button-primary-background-fill-hover
--button-primary-border-color
--button-primary-border-color-hover
--button-primary-text-color
--button-primary-text-color-hover

/* Cancel/Danger buttons */
--button-cancel-background-fill
--button-cancel-background-fill-hover
--button-cancel-border-color
--button-cancel-border-color-hover
--button-cancel-text-color
--button-cancel-text-color-hover
```

**Size and Spacing**:
```css
/* Button sizing */
--button-small-padding: var(--spacing-sm) calc(2 * var(--spacing-sm))
--button-small-radius: border-radius-sm
--button-small-text-size: var(--text-md)
--button-small-text-weight: 400

/* Spacing system */
--spacing-xxs, --spacing-xs, --spacing-sm
--radius-xs, --radius-sm, --radius-md
```

**Shadow and Effects**:
```css
--button-shadow: none (default)
--button-shadow-hover: none
--button-shadow-active: none
--shadow-drop-lg: for dropdowns
```

### 🎯 **Interactive Behavior**

**Hover States**:
- **Background**: Transitions to hover background color
- **Text**: Changes to hover text color
- **Border**: Updates to hover border color
- **Timing**: Uses `--button-transition` (0.12s ease-in-out)

**Active States**:
- **Shadow**: Applies `--button-shadow-active`
- **Visual feedback**: Immediate response to clicks

**Focus States**:
- **Outline**: Removed (outline: none)
- **Shadow**: Uses hover shadow for keyboard navigation
- **Accessibility**: Maintains focus visibility

### 🌓 **Theme Mode Support**

**Automatic Adaptation**:
- **Light mode**: Uses light theme color tokens
- **Dark mode**: Automatically switches to dark theme colors
- **Dynamic**: Responds to theme changes without code updates

**Color Variables**:
- All colors reference lobe-theme's CSS variables
- Automatic contrast adjustment
- Consistent with other interface elements

## Implementation Details

### 🔧 **Main Buttons** (`.btn`)

**Base Styling**:
```css
.btn {
    padding: var(--button-small-padding);
    border: var(--button-border-width) solid var(--button-secondary-border-color);
    border-radius: var(--button-small-radius);
    background: var(--button-secondary-background-fill);
    color: var(--button-secondary-text-color);
    font-size: var(--button-small-text-size);
    font-weight: var(--button-small-text-weight);
    font-family: var(--font);
    transition: var(--button-transition);
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
```

**Button Variants**:
- **`.btn.primary`**: Uses primary color scheme
- **`.btn.danger`**: Uses cancel/error color scheme
- **Default**: Uses secondary color scheme

### 🔧 **Action Buttons** (`.action-buttons .btn`)

**Compact Design**:
```css
.action-buttons .btn {
    min-width: 24px;
    height: 24px;
    padding: var(--spacing-xxs) var(--spacing-xs);
    font-size: var(--text-xxs);
    border-radius: var(--radius-xs);
}
```

### 🔧 **Row Menu System**

**Menu Container**:
```css
.row-menu {
    background: var(--background-fill-secondary);
    border: var(--button-border-width) solid var(--border-color-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-drop-lg);
}
```

**Menu Buttons**:
```css
.row-menu button {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--text-xs);
    text-align: left;
    transition: var(--button-transition);
}
```

## Benefits Achieved

### ✅ **Visual Consistency**
- **Native appearance**: Buttons look identical to lobe-theme buttons
- **Unified design**: No visual disconnect from main interface
- **Professional integration**: Seamless user experience

### ✅ **Behavioral Consistency**
- **Hover timing**: Matches lobe-theme's transition timing
- **Interactive feedback**: Same visual responses as native buttons
- **Focus handling**: Consistent keyboard navigation

### ✅ **Theme Compatibility**
- **Light/dark modes**: Automatic adaptation to theme changes
- **Color schemes**: Respects user's theme preferences
- **Future-proof**: Adapts to lobe-theme updates automatically

### ✅ **Accessibility**
- **Contrast**: Inherits lobe-theme's accessibility improvements
- **Focus states**: Proper keyboard navigation support
- **Screen readers**: Maintains semantic button structure

### ✅ **Maintainability**
- **CSS variables**: Easy updates when lobe-theme changes
- **No hardcoded colors**: All styling references theme system
- **Consistent patterns**: Follows established design patterns

## Files Modified

### **`shadow-dom-container.js`**
- **Main buttons** (`.btn`): Updated to use lobe-theme design system
- **Action buttons** (`.action-buttons .btn`): Compact lobe-theme styling
- **Row menu** (`.row-menu`): Dropdown styling with lobe-theme colors
- **Menu buttons** (`.row-menu button`): Context menu button styling
- **Menu trigger** (`.row-menu-trigger`): Hover states and transitions

## Testing Scenarios

### ✅ **Visual Integration**
- Buttons match lobe-theme appearance exactly
- Hover states transition smoothly
- Active states provide immediate feedback
- Focus states work with keyboard navigation

### ✅ **Theme Mode Switching**
- Light mode: Buttons use light theme colors
- Dark mode: Buttons automatically switch to dark colors
- Dynamic switching: No visual glitches during theme changes

### ✅ **Interactive Behavior**
- Hover timing matches lobe-theme (0.12s)
- Click feedback is immediate and consistent
- Disabled states maintain proper opacity
- Menu dropdowns follow lobe-theme popup styling

The button integration ensures forge-couple's Advanced mode feels like a native part of the lobe-theme interface, with buttons that are indistinguishable from other lobe-theme interface elements in both appearance and behavior.
