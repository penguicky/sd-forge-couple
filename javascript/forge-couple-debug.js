/**
 * Debug utility for forge-couple
 * Provides comprehensive logging and state tracking for troubleshooting
 */

(function() {
    'use strict';
    
    // Guard against multiple loading
    if (window.ForgeCoupleDebug) {
        return;
    }
    
    class ForgeCoupleDebug {
        constructor() {
            this.enabled = false;
            this.logHistory = [];
            this.maxLogHistory = 1000;
            this.stateSnapshots = [];
            this.maxSnapshots = 50;
            this.startTime = Date.now();
            
            // Performance tracking
            this.performanceMarkers = new Map();
            this.initializationSteps = [];
            
            // Debug utility initialized silently
        }
        
        /**
         * Get singleton instance
         */
        static getInstance() {
            if (!window.__forgeCoupleDebug) {
                window.__forgeCoupleDebug = new ForgeCoupleDebug();
            }
            return window.__forgeCoupleDebug;
        }
        
        /**
         * Enable or disable debug logging
         */
        setEnabled(enabled) {
            this.enabled = enabled;
            if (enabled) {
                console.log('[ForgeCoupleDebug] Debug logging enabled');
                this.log('debug', 'Debug logging enabled');
            } else {
                console.log('[ForgeCoupleDebug] Debug logging disabled');
            }
        }
        
        /**
         * Log a message with timestamp and context
         */
        log(level, message, data = null, component = 'unknown') {
            const timestamp = Date.now() - this.startTime;
            const logEntry = {
                timestamp,
                level,
                component,
                message,
                data: data ? JSON.parse(JSON.stringify(data)) : null
            };
            
            // Add to history
            this.logHistory.push(logEntry);
            if (this.logHistory.length > this.maxLogHistory) {
                this.logHistory.shift();
            }
            
            // Console output if enabled
            if (this.enabled) {
                const timeStr = `+${timestamp}ms`;
                const prefix = `[ForgeCoupleDebug:${component}:${level.toUpperCase()}] ${timeStr}`;
                
                if (data) {
                    console.log(prefix, message, data);
                } else {
                    console.log(prefix, message);
                }
            }
        }
        
        /**
         * Track initialization steps
         */
        trackInitialization(step, success, details = null) {
            const entry = {
                step,
                success,
                timestamp: Date.now() - this.startTime,
                details
            };
            
            this.initializationSteps.push(entry);
            this.log('info', `Initialization step: ${step}`, { success, details }, 'init');
        }
        
        /**
         * Take a snapshot of current state
         */
        takeStateSnapshot(label = 'manual') {
            const snapshot = {
                timestamp: Date.now() - this.startTime,
                label,
                state: this.getCurrentState()
            };
            
            this.stateSnapshots.push(snapshot);
            if (this.stateSnapshots.length > this.maxSnapshots) {
                this.stateSnapshots.shift();
            }
            
            this.log('info', `State snapshot taken: ${label}`, snapshot.state, 'state');
            return snapshot;
        }
        
        /**
         * Get current state of all components
         */
        getCurrentState() {
            const state = {
                timestamp: Date.now(),
                components: {}
            };
            
            // ForgeCouple global state
            state.components.forgeCouple = {
                exists: !!window.ForgeCouple,
                dataframe: {
                    t2i: !!(window.ForgeCouple?.dataframe?.t2i),
                    i2i: !!(window.ForgeCouple?.dataframe?.i2i)
                },
                entryField: {
                    t2i: !!(window.ForgeCouple?.entryField?.t2i),
                    i2i: !!(window.ForgeCouple?.entryField?.i2i)
                }
            };
            
            // State manager
            if (window.ForgeCoupleStateManager) {
                const stateManager = window.ForgeCoupleStateManager.getInstance();
                state.components.stateManager = {
                    exists: true,
                    summary: stateManager.getStateSummary()
                };
            } else {
                state.components.stateManager = { exists: false };
            }
            
            // Direct mapping
            state.components.directMapping = {
                exists: !!window.ForgeCoupleDirectMapping,
                t2i: window.ForgeCoupleDirectMapping?.t2i?.length || 0,
                i2i: window.ForgeCoupleDirectMapping?.i2i?.length || 0
            };
            
            // Shadow DOM containers
            const shadowHosts = document.querySelectorAll('.forge-couple-shadow-host');
            state.components.shadowDOM = {
                containerCount: shadowHosts.length,
                containers: Array.from(shadowHosts).map(host => ({
                    mode: host.dataset.mode,
                    hasShadowRoot: !!host.shadowRoot,
                    hasInstance: !!(host.shadowContainer?.forgeCoupleInstance)
                }))
            };
            
            // Event bridge
            state.components.eventBridge = {
                exists: !!window.EventBridge,
                instance: !!(window.EventBridge && window.__forgeCoupleEventBridge)
            };
            
            // Backend bridge
            state.components.backendBridge = {
                exists: !!window.forgeCoupleBackendBridge
            };
            
            return state;
        }
        
        /**
         * Start performance tracking for an operation
         */
        startPerformanceTracking(operation) {
            this.performanceMarkers.set(operation, {
                start: performance.now(),
                steps: []
            });
            this.log('perf', `Started tracking: ${operation}`, null, 'perf');
        }
        
        /**
         * Add a step to performance tracking
         */
        addPerformanceStep(operation, step) {
            const marker = this.performanceMarkers.get(operation);
            if (marker) {
                marker.steps.push({
                    step,
                    timestamp: performance.now() - marker.start
                });
                this.log('perf', `Step in ${operation}: ${step}`, { elapsed: performance.now() - marker.start }, 'perf');
            }
        }
        
        /**
         * End performance tracking
         */
        endPerformanceTracking(operation) {
            const marker = this.performanceMarkers.get(operation);
            if (marker) {
                const totalTime = performance.now() - marker.start;
                this.log('perf', `Completed ${operation}`, { totalTime, steps: marker.steps }, 'perf');
                this.performanceMarkers.delete(operation);
                return { totalTime, steps: marker.steps };
            }
            return null;
        }
        
        /**
         * Generate a debug report
         */
        generateReport() {
            const report = {
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startTime,
                currentState: this.getCurrentState(),
                initializationSteps: this.initializationSteps,
                recentLogs: this.logHistory.slice(-50),
                stateSnapshots: this.stateSnapshots.slice(-10),
                performanceData: Array.from(this.performanceMarkers.entries())
            };
            
            return report;
        }
        
        /**
         * Export debug data as JSON
         */
        exportDebugData() {
            const report = this.generateReport();
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `forge-couple-debug-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.log('info', 'Debug data exported', null, 'export');
        }
        
        /**
         * Print current state to console
         */
        printCurrentState() {
            const state = this.getCurrentState();
            console.group('[ForgeCoupleDebug] Current State');
            console.log('Timestamp:', new Date(state.timestamp).toISOString());
            console.log('Components:', state.components);
            console.groupEnd();
        }
        
        /**
         * Print initialization summary
         */
        printInitializationSummary() {
            console.group('[ForgeCoupleDebug] Initialization Summary');
            console.log('Total steps:', this.initializationSteps.length);
            
            const successful = this.initializationSteps.filter(s => s.success).length;
            const failed = this.initializationSteps.length - successful;
            
            console.log('Successful:', successful);
            console.log('Failed:', failed);
            
            if (failed > 0) {
                console.log('Failed steps:', this.initializationSteps.filter(s => !s.success));
            }
            
            console.log('All steps:', this.initializationSteps);
            console.groupEnd();
        }
        
        /**
         * Clear debug history
         */
        clearHistory() {
            this.logHistory = [];
            this.stateSnapshots = [];
            this.initializationSteps = [];
            this.performanceMarkers.clear();
            this.log('info', 'Debug history cleared', null, 'debug');
        }
    }
    
    // Create global instance
    window.ForgeCoupleDebug = ForgeCoupleDebug;
    
    // Initialize singleton
    const debugInstance = ForgeCoupleDebug.getInstance();
    
    // Expose useful methods globally for console access
    window.fcDebug = {
        enable: () => debugInstance.setEnabled(true),
        disable: () => debugInstance.setEnabled(false),
        state: () => debugInstance.printCurrentState(),
        init: () => debugInstance.printInitializationSummary(),
        export: () => debugInstance.exportDebugData(),
        clear: () => debugInstance.clearHistory(),
        snapshot: (label) => debugInstance.takeStateSnapshot(label),
        report: () => debugInstance.generateReport()
    };
    
    // Debug utility loaded. Use fcDebug.enable() to start logging.
    
})();
