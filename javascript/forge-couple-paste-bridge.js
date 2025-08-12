/**
 * Forge Couple Paste Bridge
 * Global data structure and monitoring system for parameter paste integration
 */

(function() {
    'use strict';

    // Guard against multiple loading
    if (window.forgeCoupleGlobalPasteBridge) {
        return;
    }

    // Create the forge couple paste bridge
    window.forgeCoupleGlobalPasteBridge = {
        pasteData: {},

        init() {
            const initializeWithRetry = () => {
                this.scanAndInterceptPasteButtons();
                this.setupMutationObserver();

                // Check if we found any buttons, if not retry
                const buttons = document.querySelectorAll('button');
                let pasteButtons = 0;
                buttons.forEach(button => {
                    const text = button.textContent.trim().toLowerCase();
                    if (text.includes('paste') || text.includes('send to') || text.includes('apply')) {
                        pasteButtons++;
                    }
                });

                if (pasteButtons === 0) {
                    setTimeout(initializeWithRetry, 1000);
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeWithRetry);
            } else {
                setTimeout(initializeWithRetry, 500);
            }
        },

        scanAndInterceptPasteButtons() {
            const buttons = document.querySelectorAll('button');

            buttons.forEach(button => {
                const buttonText = button.textContent.trim().toLowerCase();
                const buttonTitle = (button.title || '').toLowerCase();

                if (buttonText.includes('paste') ||
                    buttonText.includes('send to') ||
                    buttonText.includes('apply preset') ||
                    buttonText === 'apply' ||
                    buttonTitle.includes('paste') ||
                    button.id.includes('paste')) {

                    this.interceptPasteButton(button);
                }
            });
        },

        interceptPasteButton(button) {
            if (button._forgeCoupleIntercepted) {
                return;
            }

            button._forgeCoupleIntercepted = true;
            const bridgeRef = this;

            button.addEventListener('click', (event) => {
                bridgeRef.handlePasteButtonClick(button);
            });
        },

        handlePasteButtonClick(button) {
            const bridgeRef = this;
            setTimeout(() => {
                const textareas = document.querySelectorAll('textarea');

                textareas.forEach((textarea) => {
                    if (textarea.value && textarea.value.includes('forge_couple_mapping')) {
                        const mappingData = bridgeRef.extractForgeCoupleDataFromText(textarea.value);
                        if (mappingData) {
                            bridgeRef.setPasteData('t2i', mappingData);
                            bridgeRef.setPasteData('i2i', mappingData);
                            return;
                        }
                    }
                });
            }, 200);
        },

        extractForgeCoupleDataFromText(text) {
            if (!text || typeof text !== 'string') {
                return null;
            }

            // JSON format (Quick Recents, IIB)
            try {
                const jsonData = JSON.parse(text);
                if (jsonData.extra_generation_params && jsonData.extra_generation_params.forge_couple_mapping) {
                    return JSON.parse(jsonData.extra_generation_params.forge_couple_mapping);
                }
            } catch (error) {}

            // Parameter format (PNG Info)
            const quotedMatch = text.match(/forge_couple_mapping: "([^"]+)"/);
            if (quotedMatch) {
                try {
                    return JSON.parse(quotedMatch[1]);
                } catch (error) {}
            }

            // Legacy format
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('forge_couple_mapping:')) {
                    try {
                        const parts = line.split(':', 2);
                        if (parts.length >= 2) {
                            return JSON.parse(parts[1].trim());
                        }
                    } catch (error) {}
                }
            }

            return null;
        },

        setPasteData(mode, mappingData) {
            const shadowHost = document.querySelector(`.forge-couple-shadow-host[data-mode="${mode}"]`);
            if (shadowHost && shadowHost.shadowContainer && shadowHost.shadowContainer.forgeCoupleInstance) {
                const regions = mappingData.map((item, index) => ({
                    id: index + 1,
                    x1: parseFloat(item[0]) || 0,
                    y1: parseFloat(item[2]) || 0,
                    x2: parseFloat(item[1]) || 1,
                    y2: parseFloat(item[3]) || 1,
                    weight: parseFloat(item[4]) || 1.0,
                    prompt: '',
                    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
                }));

                shadowHost.shadowContainer.forgeCoupleInstance.importConfig({ regions });
            }
        },

        setupMutationObserver() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const newButtons = node.querySelectorAll ? node.querySelectorAll('button') : [];
                            newButtons.forEach(button => {
                                if (!button._forgeCoupleIntercepted) {
                                    const buttonText = button.textContent.trim().toLowerCase();
                                    if (buttonText.includes('paste') || buttonText.includes('send to') || buttonText.includes('apply')) {
                                        this.interceptPasteButton(button);
                                    }
                                }
                            });
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    // Initialize the bridge
    window.forgeCoupleGlobalPasteBridge.init();
})();
