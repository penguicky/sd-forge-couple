# sd-webui-lobe-theme Compatibility

This document describes the compatibility between sd-forge-couple and sd-webui-lobe-theme extensions.

## Overview

sd-forge-couple is fully compatible with sd-webui-lobe-theme when using the compatibility fix implemented in sd-webui-lobe-theme v4.1.0+.

## Compatibility Issue (Resolved)

**Previous Issue**: sd-webui-lobe-theme was hiding essential UI elements needed for sd-forge-couple's advanced mode functionality, including:
- Visual mapping interface with interactive rectangle creation
- Control buttons (🆕, ❌, 📂, ⏏, 🗑)
- Bounding box highlighting and manipulation
- Advanced mode table and input controls

**Resolution**: sd-webui-lobe-theme v4.1.0+ includes a comprehensive compatibility system that protects all sd-forge-couple UI elements while preserving the modern theme aesthetics.

## Requirements

- **sd-webui-lobe-theme**: v4.1.0 or later
- **sd-forge-couple**: Any version (no changes required)

## Features Preserved

When using both extensions together, all sd-forge-couple features remain fully functional:

✅ **Advanced Mode**
- Interactive rectangle creation and editing
- Visual mapping table with coordinate inputs
- Weight adjustment (0.0-5.0 range)
- Prompt line synchronization

✅ **Control Interface**
- Row insertion/deletion buttons (🆕, ❌)
- Background image controls (📂, ⏏, 🗑)
- Row selection and highlighting
- Shift+click modifiers

✅ **Visual Feedback**
- Draggable bounding boxes
- Color-coded regions
- Real-time preview updates
- Background image loading

✅ **Preset System**
- Save/load functionality
- Default mapping reset
- Configuration persistence

## Installation

1. Install both extensions normally
2. Ensure sd-webui-lobe-theme is v4.1.0 or later
3. Enable both extensions in WebUI settings
4. Restart WebUI

No additional configuration is required - compatibility is automatic.

## Verification

To verify compatibility is working:

1. Navigate to txt2img or img2img tab
2. Locate the "Forge Couple" section
3. Switch to "Advanced" mode
4. Confirm all UI elements are visible:
   - Mapping table with editable cells
   - All control buttons are clickable
   - Bounding boxes appear on preview images
   - Row selection highlights properly

## Troubleshooting

If sd-forge-couple elements are not visible:

1. **Check lobe-theme version**: Ensure v4.1.0+
2. **Browser console**: Look for compatibility messages
3. **Refresh page**: Try a hard refresh (Ctrl+F5)
4. **Extension order**: Try disabling/re-enabling extensions
5. **Browser cache**: Clear browser cache if needed

## Technical Details

The compatibility fix in sd-webui-lobe-theme includes:

- **Protected Selector System**: Prevents hiding of forge-couple elements
- **CSS Compatibility Rules**: Explicit visibility declarations
- **Runtime Protection**: DOM mutation monitoring and restoration
- **Build Integration**: Automatic deployment of compatibility scripts

## Support

For compatibility issues:

1. **sd-webui-lobe-theme issues**: Report to lobe-theme repository
2. **sd-forge-couple functionality**: Report to forge-couple repository
3. **Integration problems**: Include both extension versions in reports

## Version History

- **2025-07-11**: Initial compatibility documentation
- **sd-webui-lobe-theme v4.1.0**: Compatibility system implemented

---

**Note**: This compatibility fix is maintained in the sd-webui-lobe-theme repository. No changes to sd-forge-couple are required for compatibility.
