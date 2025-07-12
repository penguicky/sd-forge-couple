// ===== FORGE-COUPLE LOBE-THEME COMPATIBILITY TEST =====
// Simple test script to verify compatibility functionality

(function() {
  'use strict';

  // Test utilities
  const testUtils = {
    log: (message, ...args) => {
      console.log(`%c[ForgeCouple-Test] ${message}`, 'color: blue; font-weight: bold;', ...args);
    },
    
    success: (message, ...args) => {
      console.log(`%c[ForgeCouple-Test] ✅ ${message}`, 'color: green; font-weight: bold;', ...args);
    },
    
    fail: (message, ...args) => {
      console.log(`%c[ForgeCouple-Test] ❌ ${message}`, 'color: red; font-weight: bold;', ...args);
    }
  };

  // Simple test functions
  window.testForgeCouple = {
    // Quick compatibility check
    checkCompatibility: () => {
      testUtils.log('Checking forge-couple lobe-theme compatibility...');
      
      const results = {
        compatibilityLoaded: typeof window.ForgeCoupleLobeThemeCompat !== 'undefined',
        compatibilityInitialized: window.ForgeCoupleLobeThemeCompat?.initialized || false,
        t2iAccordionExists: !!document.getElementById('forge_couple_t2i'),
        i2iAccordionExists: !!document.getElementById('forge_couple_i2i'),
        forgeCoupleExists: typeof window.ForgeCouple !== 'undefined'
      };
      
      testUtils.log('=== COMPATIBILITY CHECK RESULTS ===');
      Object.entries(results).forEach(([key, value]) => {
        if (value) {
          testUtils.success(`${key}: ${value}`);
        } else {
          testUtils.fail(`${key}: ${value}`);
        }
      });
      
      const allPassed = Object.values(results).every(v => v);
      if (allPassed) {
        testUtils.success('All compatibility checks passed! 🎉');
      } else {
        testUtils.fail('Some compatibility checks failed');
      }
      
      return results;
    },
    
    // Test mode switching
    testModeSwitch: (mode = 't2i', targetMode = 'Advanced') => {
      testUtils.log(`Testing mode switch to ${targetMode} for ${mode}...`);
      
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) {
        testUtils.fail(`Accordion forge_couple_${mode} not found`);
        return false;
      }
      
      // Find radio button for target mode
      const radioButton = accordion.querySelector(`input[type="radio"][value="${targetMode}"]`);
      if (!radioButton) {
        testUtils.fail(`Radio button for ${targetMode} mode not found`);
        return false;
      }
      
      // Click the radio button
      radioButton.click();
      
      // Check if mode changed
      setTimeout(() => {
        const isChecked = radioButton.checked;
        if (isChecked) {
          testUtils.success(`Mode successfully switched to ${targetMode}`);
        } else {
          testUtils.fail(`Failed to switch to ${targetMode} mode`);
        }
      }, 100);
      
      return true;
    },
    
    // Test background controls
    testBackgroundControls: (mode = 't2i') => {
      testUtils.log(`Testing background controls for ${mode}...`);
      
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) {
        testUtils.fail(`Accordion forge_couple_${mode} not found`);
        return false;
      }
      
      const bgBtns = accordion.querySelector('.fc_bg_btns');
      if (!bgBtns) {
        testUtils.fail('Background buttons container not found');
        return false;
      }
      
      const loadBtn = bgBtns.querySelector('#fc_load_img_btn');
      const clearBtn = bgBtns.querySelector('#fc_clear_img_btn');
      
      if (loadBtn && clearBtn) {
        testUtils.success('Background control buttons found');
        return true;
      } else {
        testUtils.fail('Some background control buttons missing');
        return false;
      }
    },
    
    // Test element visibility
    testElementVisibility: (mode = 't2i') => {
      testUtils.log(`Testing element visibility for ${mode}...`);
      
      const accordion = document.getElementById(`forge_couple_${mode}`);
      if (!accordion) {
        testUtils.fail(`Accordion forge_couple_${mode} not found`);
        return false;
      }
      
      const criticalElements = [
        '.fc_mapping',
        '.fc_preview_img',
        '.fc_bg_btns'
      ];
      
      let allVisible = true;
      criticalElements.forEach(selector => {
        const element = accordion.querySelector(selector);
        if (!element) {
          testUtils.fail(`Element ${selector} not found`);
          allVisible = false;
        } else if (element.style.display === 'none') {
          testUtils.fail(`Element ${selector} is hidden`);
          allVisible = false;
        } else {
          testUtils.success(`Element ${selector} is visible`);
        }
      });
      
      return allVisible;
    },
    
    // Debug information
    debugInfo: () => {
      testUtils.log('=== DEBUG INFORMATION ===');
      
      const info = {
        'Compatibility script loaded': typeof window.ForgeCoupleLobeThemeCompat !== 'undefined',
        'Compatibility initialized': window.ForgeCoupleLobeThemeCompat?.initialized || false,
        'ForgeCouple available': typeof window.ForgeCouple !== 'undefined',
        'Lobe-theme detected': !!(
          document.querySelector('[data-testid="lobe-theme"]') ||
          document.body.className.includes('lobe') ||
          getComputedStyle(document.documentElement).getPropertyValue('--lobe-theme-primary')
        ),
        'T2I accordion exists': !!document.getElementById('forge_couple_t2i'),
        'I2I accordion exists': !!document.getElementById('forge_couple_i2i')
      };
      
      Object.entries(info).forEach(([key, value]) => {
        testUtils.log(`${key}: ${value}`);
      });
      
      // Check current modes if compatibility is available
      if (window.ForgeCoupleLobeThemeCompat?.currentModes) {
        testUtils.log('Current modes:', window.ForgeCoupleLobeThemeCompat.currentModes);
      }
      
      return info;
    },
    
    // Run all tests
    runAllTests: () => {
      testUtils.log('Running all forge-couple compatibility tests...');
      
      const results = {
        compatibility: window.testForgeCouple.checkCompatibility(),
        backgroundControls: window.testForgeCouple.testBackgroundControls('t2i'),
        elementVisibility: window.testForgeCouple.testElementVisibility('t2i')
      };
      
      testUtils.log('=== FINAL TEST RESULTS ===');
      const allPassed = Object.values(results).every(result => 
        typeof result === 'object' ? Object.values(result).every(v => v) : result
      );
      
      if (allPassed) {
        testUtils.success('All tests passed! Forge-couple lobe-theme compatibility is working correctly. 🎉');
      } else {
        testUtils.fail('Some tests failed. Check the results above for details.');
      }
      
      return results;
    }
  };

  // Auto-run basic compatibility check when script loads
  setTimeout(() => {
    if (typeof onUiLoaded !== 'undefined') {
      onUiLoaded(() => {
        setTimeout(() => {
          testUtils.log('Auto-running compatibility check...');
          window.testForgeCouple.checkCompatibility();
        }, 2000);
      });
    }
  }, 1000);

  testUtils.log('Forge-couple compatibility test script loaded.');
  testUtils.log('Available commands:');
  testUtils.log('- window.testForgeCouple.checkCompatibility()');
  testUtils.log('- window.testForgeCouple.testModeSwitch()');
  testUtils.log('- window.testForgeCouple.testBackgroundControls()');
  testUtils.log('- window.testForgeCouple.debugInfo()');
  testUtils.log('- window.testForgeCouple.runAllTests()');

})();
