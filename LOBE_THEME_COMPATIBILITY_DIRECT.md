# Forge Couple - Direct Lobe-Theme Compatibility Implementation

This document describes the **direct modification approach** for making forge-couple compatible with lobe-theme, implemented as a cleaner alternative to external compatibility scripts.

## 🎯 Approach: Direct Source Modification

Instead of creating external compatibility scripts in lobe-theme, we've modified forge-couple's source code directly to:

1. **Detect lobe-theme presence** during initialization
2. **Apply compatibility fixes** as part of forge-couple's natural setup process
3. **Use CSS overrides** to ensure elements remain visible
4. **Maintain full functionality** while working seamlessly with lobe-theme

## 🔧 Implementation Details

### JavaScript Changes (`javascript/couple.js`)

#### 1. Enhanced Setup Method
```javascript
static setup() {
    // Detect if lobe-theme is active
    const isLobeThemeActive = this.#detectLobeTheme();
    if (isLobeThemeActive) {
        console.log('[ForgeCouple] Lobe-theme detected, applying compatibility fixes...');
    }

    ["t2i", "i2i"].forEach((mode) => {
        // ... existing setup code ...
        
        // Apply lobe-theme compatibility fixes if needed
        if (isLobeThemeActive) {
            this.#applyLobeThemeCompatibility(ex, mode);
        }
    });
}
```

#### 2. Lobe-Theme Detection Method
```javascript
static #detectLobeTheme() {
    // Check for lobe-theme specific elements or classes
    const lobeThemeIndicators = [
        'div[data-testid="lobe-theme"]',
        '.lobe-theme',
        '#lobe-theme-root',
        '[class*="lobe-theme"]'
    ];

    // Check DOM for indicators
    for (const indicator of lobeThemeIndicators) {
        if (document.querySelector(indicator)) {
            return true;
        }
    }

    // Check body classes
    if (document.body.className.includes('lobe')) {
        return true;
    }

    // Check CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const lobeVars = ['--lobe-theme-primary', '--lobe-primary-color'];
    for (const varName of lobeVars) {
        if (computedStyle.getPropertyValue(varName)) {
            return true;
        }
    }

    return false;
}
```

#### 3. Compatibility Fixes Method
```javascript
static #applyLobeThemeCompatibility(accordion, mode) {
    console.log(`[ForgeCouple] Applying lobe-theme compatibility for ${mode}...`);

    // Ensure all forge-couple elements are visible
    const criticalSelectors = [
        '.fc_mapping', '.fc_preview_img', '.fc_bbox',
        '.fc_mapping_btns', '.fc_bg_btns',
        '.fc_adv', '.fc_bsc', '.fc_msk'
    ];

    criticalSelectors.forEach(selector => {
        const elements = accordion.querySelectorAll(selector);
        elements.forEach(element => {
            // Force visibility
            element.style.display = '';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
            
            // Add protection class
            element.classList.add('fc-lobe-protected');
        });
    });

    // Ensure preview images have proper dimensions
    const previewImg = accordion.querySelector('.fc_preview_img img');
    if (previewImg) {
        previewImg.style.minWidth = '200px';
        previewImg.style.minHeight = '200px';
        previewImg.style.display = 'block';
    }

    // Ensure mapping table is visible and functional
    const mappingTable = accordion.querySelector('.fc_mapping tbody');
    if (mappingTable) {
        mappingTable.style.display = '';
        mappingTable.style.visibility = 'visible';
    }

    console.log(`[ForgeCouple] Lobe-theme compatibility applied for ${mode}`);
}
```

### CSS Changes (`style.css`)

#### Added Lobe-Theme Compatibility Rules
```css
/* ===== LOBE-THEME COMPATIBILITY ===== */
/* Ensure forge-couple elements are always visible under lobe-theme */
.fc-lobe-protected,
#forge_couple_t2i .fc_mapping,
#forge_couple_i2i .fc_mapping,
#forge_couple_t2i .fc_preview_img,
#forge_couple_i2i .fc_preview_img,
#forge_couple_t2i .fc_bbox,
#forge_couple_i2i .fc_bbox,
#forge_couple_t2i .fc_mapping_btns,
#forge_couple_i2i .fc_mapping_btns,
#forge_couple_t2i .fc_bg_btns,
#forge_couple_i2i .fc_bg_btns,
#forge_couple_t2i .fc_adv,
#forge_couple_i2i .fc_adv,
#forge_couple_t2i .fc_bsc,
#forge_couple_i2i .fc_bsc,
#forge_couple_t2i .fc_msk,
#forge_couple_i2i .fc_msk {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
}

/* Ensure preview images have proper dimensions under lobe-theme */
#forge_couple_t2i .fc_preview_img img,
#forge_couple_i2i .fc_preview_img img {
    min-width: 200px !important;
    min-height: 200px !important;
    display: block !important;
}

/* Ensure mapping tables are visible under lobe-theme */
#forge_couple_t2i .fc_mapping tbody,
#forge_couple_i2i .fc_mapping tbody {
    display: table-row-group !important;
    visibility: visible !important;
}
```

## ✅ Benefits of Direct Modification Approach

### 1. **Cleaner Architecture**
- No external compatibility scripts needed
- Self-contained solution within forge-couple
- No timing dependencies between extensions

### 2. **More Reliable**
- Compatibility fixes applied during natural setup process
- No risk of missing elements or timing issues
- Works with forge-couple's existing flow

### 3. **Better Maintainability**
- Single codebase to maintain
- Changes are part of forge-couple's core functionality
- Easier to update and debug

### 4. **Future-Proof**
- Less likely to break with WebUI updates
- No dependency on external compatibility scripts
- Self-documenting code

## 🧪 Testing

### Expected Console Output
When lobe-theme is detected:
```
[ForgeCouple] Lobe-theme detected, applying compatibility fixes...
[ForgeCouple] Applying lobe-theme compatibility for t2i...
[ForgeCouple] Lobe-theme compatibility applied for t2i
[ForgeCouple] Applying lobe-theme compatibility for i2i...
[ForgeCouple] Lobe-theme compatibility applied for i2i
```

### Verification Steps
1. Open WebUI with both lobe-theme and forge-couple enabled
2. Check console for compatibility messages
3. Navigate to txt2img or img2img tabs
4. Open Forge Couple accordion
5. Switch to Advanced mode
6. Verify:
   - ✅ All elements visible
   - ✅ Mapping table functional
   - ✅ Bounding boxes working
   - ✅ No duplicate tables
   - ✅ "New" button creates both table rows and visual boxes

## 📁 Files Modified

### Core Files
- `javascript/couple.js` - Added lobe-theme detection and compatibility methods
- `style.css` - Added CSS overrides for lobe-theme compatibility

### Documentation
- `LOBE_THEME_COMPATIBILITY_DIRECT.md` - This file

## 🔄 Migration from External Scripts

If you were previously using external compatibility scripts in lobe-theme:

1. **Disable/Remove** the external compatibility script
2. **Use this direct implementation** instead
3. **Test functionality** to ensure everything works
4. **Remove any lobe-theme modifications** related to forge-couple

## 🎯 Expected Results

This direct modification approach should provide:

- ✅ **Full compatibility** with lobe-theme
- ✅ **No table duplication** issues
- ✅ **Proper bounding box functionality**
- ✅ **Synchronized table and visual elements**
- ✅ **Clean, maintainable code**
- ✅ **Self-contained solution**

---

**Status**: Implementation complete
**Approach**: Direct source modification
**Compatibility**: Lobe-theme auto-detected and handled
**Maintenance**: Self-contained within forge-couple extension
