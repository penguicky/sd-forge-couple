/**
 * Test script for forge-couple initialization and state management
 * This script can be run in the browser console to validate the improvements
 */

(function() {
    'use strict';
    
    console.log('[ForgeCoupleTest] Starting initialization test...');
    
    // Test configuration
    const TEST_CONFIG = {
        timeout: 30000, // 30 seconds
        retryInterval: 1000, // 1 second
        debugMode: true
    };
    
    /**
     * Main test function
     */
    async function runInitializationTest() {
        console.group('[ForgeCoupleTest] Initialization Test');
        
        try {
            // Enable debug mode
            if (window.fcDebug) {
                window.fcDebug.enable();
                console.log('✓ Debug mode enabled');
            }
            
            // Test 1: Check if all required components are loaded
            console.log('\n--- Test 1: Component Loading ---');
            const componentTest = testComponentLoading();
            console.log(componentTest.success ? '✓ All components loaded' : '✗ Missing components:', componentTest.missing);
            
            // Test 2: Check initialization state
            console.log('\n--- Test 2: Initialization State ---');
            const initTest = await testInitializationState();
            console.log(initTest.success ? '✓ Initialization successful' : '✗ Initialization issues:', initTest.issues);
            
            // Test 3: Test state management
            console.log('\n--- Test 3: State Management ---');
            const stateTest = await testStateManagement();
            console.log(stateTest.success ? '✓ State management working' : '✗ State management issues:', stateTest.issues);
            
            // Test 4: Test coordinate sync
            console.log('\n--- Test 4: Coordinate Sync ---');
            const syncTest = await testCoordinateSync();
            console.log(syncTest.success ? '✓ Coordinate sync working' : '✗ Coordinate sync issues:', syncTest.issues);
            
            // Test 5: Test backend hook
            console.log('\n--- Test 5: Backend Hook ---');
            const hookTest = testBackendHook();
            console.log(hookTest.success ? '✓ Backend hook ready' : '✗ Backend hook issues:', hookTest.issues);
            
            // Summary
            const allTests = [componentTest, initTest, stateTest, syncTest, hookTest];
            const passedTests = allTests.filter(t => t.success).length;
            const totalTests = allTests.length;
            
            console.log(`\n--- Test Summary ---`);
            console.log(`Passed: ${passedTests}/${totalTests}`);
            
            if (passedTests === totalTests) {
                console.log('🎉 All tests passed! forge-couple should work consistently.');
            } else {
                console.log('⚠️ Some tests failed. Check the issues above.');
            }
            
            // Take a final state snapshot
            if (window.fcDebug) {
                window.fcDebug.snapshot('test-complete');
            }
            
        } catch (error) {
            console.error('[ForgeCoupleTest] Test failed with error:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Test if all required components are loaded
     */
    function testComponentLoading() {
        const requiredComponents = [
            'ForgeCoupleDebug',
            'ForgeCoupleStateManager',
            'EventBridge',
            'BackendBridge',
            'ShadowForgeCouple',
            'ForgeCoupleAdvancedShadowContainer',
            'ForgeCoupleDirectInterface'
        ];
        
        const missing = requiredComponents.filter(component => !window[component]);
        
        return {
            success: missing.length === 0,
            missing: missing
        };
    }
    
    /**
     * Test initialization state
     */
    async function testInitializationState() {
        const issues = [];
        
        // Check ForgeCouple global
        if (!window.ForgeCouple) {
            issues.push('ForgeCouple global not found');
        } else {
            if (!window.ForgeCouple.dataframe) {
                issues.push('ForgeCouple.dataframe not found');
            } else {
                if (!window.ForgeCouple.dataframe.t2i) issues.push('ForgeCouple.dataframe.t2i not found');
                if (!window.ForgeCouple.dataframe.i2i) issues.push('ForgeCouple.dataframe.i2i not found');
            }
        }
        
        // Check state manager
        if (window.ForgeCoupleStateManager) {
            const stateManager = window.ForgeCoupleStateManager.getInstance();
            const summary = stateManager.getStateSummary();
            
            if (!summary.initialized.t2i && !summary.initialized.i2i) {
                issues.push('State manager not initialized for any mode');
            }
        } else {
            issues.push('State manager not available');
        }
        
        // Check shadow DOM containers
        const shadowHosts = document.querySelectorAll('.forge-couple-shadow-host');
        if (shadowHosts.length === 0) {
            issues.push('No shadow DOM containers found');
        }
        
        return {
            success: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * Test state management functionality
     */
    async function testStateManagement() {
        const issues = [];
        
        if (!window.ForgeCoupleStateManager) {
            issues.push('State manager not available');
            return { success: false, issues };
        }
        
        const stateManager = window.ForgeCoupleStateManager.getInstance();
        
        // Test region update
        const testRegions = [
            { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5, weight: 1.0, prompt: 'test region 1' },
            { x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.9, weight: 1.0, prompt: 'test region 2' }
        ];
        
        try {
            const success = stateManager.updateRegions('t2i', testRegions, 'test');
            if (!success) {
                issues.push('Failed to update regions in state manager');
            }
            
            // Verify regions were stored
            const storedRegions = stateManager.getRegions('t2i');
            if (storedRegions.length !== testRegions.length) {
                issues.push(`Region count mismatch: expected ${testRegions.length}, got ${storedRegions.length}`);
            }
            
        } catch (error) {
            issues.push(`State manager error: ${error.message}`);
        }
        
        return {
            success: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * Test coordinate synchronization
     */
    async function testCoordinateSync() {
        const issues = [];
        
        // Check if direct mapping is available
        if (!window.ForgeCoupleDirectMapping) {
            issues.push('ForgeCoupleDirectMapping not available');
        } else {
            // Check if mapping data exists for at least one mode
            const t2iMapping = window.ForgeCoupleDirectMapping.t2i;
            const i2iMapping = window.ForgeCoupleDirectMapping.i2i;
            
            if (!t2iMapping && !i2iMapping) {
                issues.push('No mapping data found for any mode');
            } else {
                if (t2iMapping && !Array.isArray(t2iMapping)) {
                    issues.push('t2i mapping data is not an array');
                }
                if (i2iMapping && !Array.isArray(i2iMapping)) {
                    issues.push('i2i mapping data is not an array');
                }
            }
        }
        
        // Check if shadow DOM instances can sync
        const shadowHosts = document.querySelectorAll('.forge-couple-shadow-host');
        for (const host of shadowHosts) {
            const mode = host.dataset.mode;
            if (host.shadowContainer && host.shadowContainer.forgeCoupleInstance) {
                try {
                    host.shadowContainer.forgeCoupleInstance.syncToBackend();
                } catch (error) {
                    issues.push(`Sync failed for ${mode}: ${error.message}`);
                }
            }
        }
        
        return {
            success: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * Test backend hook functionality
     */
    function testBackendHook() {
        const issues = [];
        
        // Check if backend hook is loaded
        if (!window.ForgeCoupleDirectBackendHook) {
            issues.push('Backend hook not loaded');
        }
        
        // Check if fetch is intercepted
        if (window.fetch.toString().includes('ForgeCoupleDirectBackendHook')) {
            // Fetch is intercepted
        } else {
            issues.push('Fetch interception not detected');
        }
        
        return {
            success: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * Wait for initialization to complete
     */
    async function waitForInitialization() {
        const startTime = Date.now();
        
        while (Date.now() - startTime < TEST_CONFIG.timeout) {
            // Check if shadow DOM loader has completed
            if (window.initializeForgeCoupleShawDOM && 
                document.querySelectorAll('.forge-couple-shadow-host').length > 0) {
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.retryInterval));
        }
        
        return false;
    }
    
    // Auto-run test when script is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initialization
            runInitializationTest();
        });
    } else {
        // DOM is already ready
        setTimeout(runInitializationTest, 2000);
    }
    
    // Expose test function globally
    window.testForgeCoupleInitialization = runInitializationTest;
    
    console.log('[ForgeCoupleTest] Test script loaded. Run testForgeCoupleInitialization() to test manually.');
    
})();
