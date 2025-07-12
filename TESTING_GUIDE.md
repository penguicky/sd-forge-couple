# Forge Couple Compatibility Testing Guide

This guide provides step-by-step instructions for testing the new proactive integration approach for forge-couple compatibility with lobe-theme.

## 🧪 Testing Environment

- **WebUI**: Running on http://localhost:7860
- **Extensions**: Both sd-webui-lobe-theme and sd-forge-couple enabled
- **Approach**: Proactive integration (hooks into ForgeCouple.setup())

## 📋 Pre-Test Checklist

1. ✅ WebUI is running and accessible
2. ✅ Both extensions are enabled in WebUI settings
3. ✅ Browser console is open (F12 → Console tab)
4. ✅ Proactive integration script is deployed

## 🔍 Test Procedures

### Test 1: Console Log Verification

**Objective**: Verify that proactive integration is initializing correctly

**Steps**:
1. Open browser console (F12)
2. Refresh the WebUI page
3. Look for these specific log messages:

```
[FC Compat] 🚀 Initializing proactive forge-couple integration...
[FC Compat] ✅ ForgeCouple class detected, hooking into setup...
[FC Compat] 🔗 Hooking into ForgeCouple.setup()...
[FC Compat] ✅ Successfully hooked into ForgeCouple.setup()
```

**Expected Result**: All messages appear in sequence
**If Failed**: Proactive integration is not working, check for errors

### Test 2: ForgeCouple Setup Hook Verification

**Objective**: Verify that our hook into ForgeCouple.setup() is working

**Steps**:
1. In browser console, run:
```javascript
// Check if ForgeCouple exists and our hook is in place
console.log('ForgeCouple exists:', typeof window.ForgeCouple !== 'undefined');
console.log('Original setup stored:', window.forgeCoupleCompatibility.isProactiveComplete());
```

**Expected Result**: 
- `ForgeCouple exists: true`
- `Original setup stored: true`

### Test 3: Enhanced Setup Execution

**Objective**: Verify that enhanced setup runs when ForgeCouple initializes

**Steps**:
1. Navigate to txt2img or img2img tab
2. Look for these additional log messages:
```
[FC Compat] 🎯 Enhanced ForgeCouple.setup() called...
[FC Compat] 🎨 Applying lobe-theme enhancements...
[FC Compat] ✅ Lobe-theme enhancements applied successfully
```

**Expected Result**: Messages appear when navigating to tabs with forge-couple
**If Failed**: Enhanced setup is not being triggered

### Test 4: Visual UI Verification

**Objective**: Verify that forge-couple UI elements are properly visible and functional

**Steps**:
1. Navigate to txt2img tab
2. Locate "Forge Couple" accordion section
3. Open the accordion
4. Switch to "Advanced" mode
5. Verify the following elements are visible:
   - ✅ Mapping table with coordinate inputs
   - ✅ Control buttons (🆕, ❌, 📂, ⏏, 🗑)
   - ✅ Preview image area
   - ✅ Background image controls

**Expected Result**: All elements are visible and properly styled
**If Failed**: Elements may still be hidden by lobe-theme

### Test 5: Table Duplication Check

**Objective**: Verify that only ONE mapping table exists (no duplicates)

**Steps**:
1. In forge-couple advanced mode
2. In browser console, run:
```javascript
// Count mapping tables
const tables = document.querySelectorAll('.fc_mapping tbody');
console.log('Number of mapping tables found:', tables.length);
console.log('Tables:', tables);
```

**Expected Result**: `Number of mapping tables found: 2` (one for t2i, one for i2i)
**If Failed**: More than 2 tables indicates duplication bug still exists

### Test 6: Bounding Box Functionality

**Objective**: Verify that bounding boxes are created and visible

**Steps**:
1. In forge-couple advanced mode
2. Ensure there are rows in the mapping table
3. In browser console, run:
```javascript
// Check for bounding boxes
const bboxes = document.querySelectorAll('.fc_bbox');
console.log('Number of bounding boxes found:', bboxes.length);
console.log('Bounding boxes:', bboxes);

// Check if preview images have proper dimensions
const previewImgs = document.querySelectorAll('.fc_preview_img img');
previewImgs.forEach((img, i) => {
  console.log(`Preview image ${i}:`, {
    width: img.offsetWidth,
    height: img.offsetHeight,
    display: window.getComputedStyle(img).display
  });
});
```

**Expected Result**: 
- Bounding boxes exist and are visible
- Preview images have non-zero dimensions

### Test 7: "New" Button Functionality

**Objective**: Verify that "New" button creates both table rows AND visual bounding boxes

**Steps**:
1. In forge-couple advanced mode
2. Count existing rows and bounding boxes
3. Click the "🆕" (New) button
4. Verify:
   - ✅ New row appears in mapping table
   - ✅ New bounding box appears in preview area
   - ✅ Both are synchronized

**Expected Result**: Both table row and bounding box are created together

### Test 8: Color Coordination

**Objective**: Verify that bounding box colors match table row indicators

**Steps**:
1. In forge-couple advanced mode with multiple rows
2. Observe table row colors/highlights
3. Observe corresponding bounding box colors
4. Verify they match or coordinate properly

**Expected Result**: Visual coordination between table and bounding boxes

## 🐛 Debugging Commands

If tests fail, use these console commands for debugging:

### Check Proactive Integration Status
```javascript
const compat = window.forgeCoupleCompatibility;
console.log('Compatibility object:', compat);
console.log('Proactive complete:', compat.isProactiveComplete());
console.log('Last debug report:', compat.getLastReport());
```

### Force Apply Enhancements
```javascript
// Manually trigger enhancements
window.forgeCoupleCompatibility.applyEnhancements();
```

### Generate Debug Report
```javascript
// Get detailed debug information
window.forgeCoupleCompatibility.generateDebugReport();
```

### Check ForgeCouple State
```javascript
// Check ForgeCouple internal state
console.log('ForgeCouple:', window.ForgeCouple);
console.log('ForgeCouple containers:', window.ForgeCouple?.container);
console.log('ForgeCouple mapping tables:', window.ForgeCouple?.mappingTable);
```

## ✅ Success Criteria

All tests should pass with these results:

1. **Console Logs**: All proactive integration messages appear
2. **Hook Status**: ForgeCouple.setup is successfully hooked
3. **UI Visibility**: All forge-couple elements are visible
4. **No Duplication**: Only 2 mapping tables total (t2i + i2i)
5. **Bounding Boxes**: Created and visible for all table rows
6. **New Button**: Creates both table rows and bounding boxes
7. **Color Coordination**: Visual elements are properly coordinated

## 🚨 Failure Scenarios

### Scenario 1: Proactive Integration Not Starting
- **Symptoms**: No proactive integration log messages
- **Cause**: Script not loading or ForgeCouple not detected
- **Solution**: Check script deployment and ForgeCouple availability

### Scenario 2: Hook Not Working
- **Symptoms**: ForgeCouple exists but hook messages don't appear
- **Solution**: Check if ForgeCouple.setup method exists and is hookable

### Scenario 3: Elements Still Hidden
- **Symptoms**: forge-couple elements not visible despite enhancements
- **Cause**: lobe-theme CSS still overriding visibility
- **Solution**: Check CSS specificity and element targeting

### Scenario 4: Fallback to Reactive Mode
- **Symptoms**: Reactive initialization messages instead of proactive
- **Cause**: ForgeCouple not detected within 10-second timeout
- **Solution**: Investigate ForgeCouple loading timing

## 📊 Test Results Template

```
## Test Results - [Date/Time]

### Environment
- WebUI Version: 
- Lobe Theme Version: 
- Forge Couple Version: 

### Test Results
- [ ] Test 1: Console Log Verification
- [ ] Test 2: ForgeCouple Setup Hook Verification  
- [ ] Test 3: Enhanced Setup Execution
- [ ] Test 4: Visual UI Verification
- [ ] Test 5: Table Duplication Check
- [ ] Test 6: Bounding Box Functionality
- [ ] Test 7: "New" Button Functionality
- [ ] Test 8: Color Coordination

### Issues Found
[List any issues discovered during testing]

### Overall Status
- [ ] ✅ All tests passed - Proactive integration working perfectly
- [ ] ⚠️ Some tests failed - Issues need addressing
- [ ] ❌ Major failures - Proactive integration not working
```

---

**Note**: This testing guide should be used immediately after deploying the proactive integration changes to verify that the new approach successfully resolves the previous compatibility issues.
