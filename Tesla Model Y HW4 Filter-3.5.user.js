// ==UserScript==
// @name         Tesla Model Y HW4 Filter
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  Precisely filters HW4 Model Y cars on Tesla used inventory page
// @match        https://www.tesla.com/inventory/used/my?*
// @grant        none
// @run-at       document-idle
// @author		sambrears
// @homepage	https://github.com/sambrears/HW4-MY-Finder
// ==/UserScript==

(function () {
    'use strict';

    // HW4 thresholds
    const THRESHOLDS = {
        'F': 789500, // Fremont
        'A': 131200, // Austin
        'S': 380000, // Shanghai
        'B': 100000  // Berlin
    };

    // Model year mapping
    const MODEL_YEARS = {
        'N': 2022,
        'P': 2023,
        'R': 2024,
        'S': 2025
    };

    // Comprehensive HW4 detection logic
    function isHW4(vin) {
        if (!vin || vin.length !== 17) {
            return false;
        }

        const modelYearCode = vin.charAt(9);
        const factoryCode = vin.charAt(10);
        const serialNumber = parseInt(vin.substring(11), 10);

        // Prioritize 2024 detection (always HW4)
        if (modelYearCode === 'R') {
            return true;
        }

        const modelYear = MODEL_YEARS[modelYearCode] || 0;

        // 2022 and earlier are always HW3
        if (modelYear <= 2022) {
            return false;
        }

        // For 2023, check against thresholds
        if (modelYear === 2023) {
            const threshold = THRESHOLDS[factoryCode];
            return threshold !== undefined && serialNumber >= threshold;
        }

        return false;
    }

    // Find VIN for a card with multiple strategies
    function findVINForCard(card) {
        const vinsToTry = [
            () => {
                // Try finding VIN in multiple places
                const vinSelectors = [
                    '.vin-display',
                    '[data-test="vehicle-vin"]',
                    '.inventory-details-link',
                    '.result-details-vin'
                ];

                for (const selector of vinSelectors) {
                    const vinElement = card.querySelector(selector);
                    if (vinElement) {
                        const vinText = vinElement.textContent.trim();
                        if (vinText.length === 17) {
                            return vinText;
                        }
                    }
                }
                return null;
            },
            () => {
                // Try extracting VIN from card's inner HTML
                const matches = card.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
                return matches ? matches[0] : null;
            }
        ];

        for (const vinFinder of vinsToTry) {
            const vin = vinFinder();
            if (vin && vin.length === 17) {
                return vin;
            }
        }

        return null;
    }

    // Filter and highlight HW4 cars
    function filterHW4Cards() {
        // More robust selector to capture cars
        const cards = document.querySelectorAll(
            '.results-container .result, ' +
            '.inventory-results .result, ' +
            '[data-test="inventory-results"] .result'
        );

        let hw4Count = 0;
        let totalCount = cards.length;

        cards.forEach((card, index) => {
            // Ensure we can process the card
            if (!card || !card.querySelector) {
                return;
            }

            // Find VIN for the card
            const vin = findVINForCard(card);

            if (!vin) {
                return;
            }

            const isHW4Vehicle = isHW4(vin);

            if (isHW4Vehicle) {
                hw4Count++;
                card.classList.add('hw4-vehicle');
                card.classList.remove('non-hw4-vehicle');
                card.style.display = 'block';
                card.style.border = '3px solid limegreen';

                // Add HW4 badge
                let badge = card.querySelector('.hw4-badge');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.classList.add('hw4-badge');
                    badge.textContent = 'HW4';
                    badge.style.position = 'absolute';
                    badge.style.top = '8px';
                    badge.style.right = '8px';
                    badge.style.background = 'limegreen';
                    badge.style.color = 'black';
                    badge.style.fontWeight = 'bold';
                    badge.style.padding = '2px 6px';
                    badge.style.borderRadius = '4px';
                    badge.style.zIndex = '10';
                    badge.style.fontSize = '12px';
                    card.style.position = 'relative';
                    card.appendChild(badge);
                }
            } else {
                card.classList.add('non-hw4-vehicle');
                card.classList.remove('hw4-vehicle');
                card.style.display = 'none';
                card.style.border = '1px solid red';

                // Remove any existing HW4 badge
                const existingBadge = card.querySelector('.hw4-badge');
                if (existingBadge) {
                    existingBadge.remove();
                }
            }
        });

        updateFilterButtonText(hw4Count, totalCount);
    }

    // Create filter toggle button
    function createFilterToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'hw4-filter-toggle';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '20px';
        toggleBtn.style.right = '20px';
        toggleBtn.style.zIndex = '9999';
        toggleBtn.style.padding = '8px 12px';
        toggleBtn.style.backgroundColor = '#333';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.borderRadius = '4px';

        let showNonHW4 = false;
        toggleBtn.addEventListener('click', () => {
            showNonHW4 = !showNonHW4;
            const nonHW4Vehicles = document.querySelectorAll('.non-hw4-vehicle');
            nonHW4Vehicles.forEach(vehicle => {
                vehicle.style.display = showNonHW4 ? 'block' : 'none';
            });
            toggleBtn.textContent = showNonHW4
                ? `Show Only HW4 (${document.querySelectorAll('.hw4-vehicle').length}/${document.querySelectorAll('.result').length})`
                : `Show All Cars (${document.querySelectorAll('.hw4-vehicle').length}/${document.querySelectorAll('.result').length})`;
        });

        document.body.appendChild(toggleBtn);
        return toggleBtn;
    }

    // Update filter button text
    function updateFilterButtonText(hw4Count, totalCount) {
        const toggleBtn = document.getElementById('hw4-filter-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = `Show Only HW4 (${hw4Count}/${totalCount})`;
        }
    }

    // Run after delay to allow page to settle
    setTimeout(() => {
        createFilterToggleButton();

        // Initial filter
        filterHW4Cards();

        // Set up mutation observer to catch dynamic content
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    // Slight delay to ensure content is fully loaded
                    setTimeout(filterHW4Cards, 500);
                    break;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }, 2000);
})();
