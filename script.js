document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const rulesInput = document.getElementById('rules-input');
    const processBtn = null; // Removed
    const copyBtn = document.getElementById('copy-btn');
    const sortBtn = document.getElementById('sort-btn');
    const resetBtn = document.getElementById('reset-btn');
    const saveStatus = document.getElementById('save-status');
    const inputSaveStatus = null;

    // Font controls
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    let currentFontSize = 1.15; // default in rem

    // Persistence Keys
    const STORAGE_KEY_RULES = 'text_replacer_rules';
    const STORAGE_KEY_FONT = 'text_replacer_font_size';

    // Load saved data
    loadFromStorage();
    // Process immediately on load if there's data
    // processText(); // No need to process immediately if input is empty, but harmless. 

    // Event Listeners
    // processBtn.addEventListener('click', processText); // Removed

    increaseFontBtn.addEventListener('click', () => adjustFontSize(0.1));
    decreaseFontBtn.addEventListener('click', () => adjustFontSize(-0.1));

    sortBtn.addEventListener('click', sortRules);

    resetBtn.addEventListener('click', () => {
        if (confirm('Reset to default rules? This will overwrite your current list.')) {
            loadDefaultRules(true);
        }
    });

    copyBtn.addEventListener('click', () => {
        outputText.select();
        document.execCommand('copy');

        // Visual feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = originalText, 1500);
    });

    // Auto-save rules on input
    let saveTimeout;
    rulesInput.addEventListener('input', () => {
        showSaveStatus(saveStatus, 'Saving...');
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveToStorage(rulesInput, STORAGE_KEY_RULES, saveStatus);
            processText(); // Re-process when rules change
        }, 500);
    });

    // Text input processing (Real-time)
    inputText.addEventListener('input', () => {
        processText(); // Real-time processing
    });

    function processText() {
        const text = inputText.value;
        const rulesRaw = rulesInput.value;

        // Even if empty text, we might want to clear output
        if (!text) {
            outputText.value = '';
            return;
        }

        const rules = parseRules(rulesRaw);
        const result = applyReplacements(text, rules);

        outputText.value = result;
    }

    function parseRules(raw) {
        // Split by newline
        const lines = raw.split(/\r?\n/);
        const rules = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.split(';');
            if (parts.length < 2) continue; // Skip invalid lines

            const replacement = parts[0].trim(); // First part is now the replacement
            const sourcePart = parts[1].trim(); // Second part is source(s)

            // Split source by /
            const sources = sourcePart.split('/').map(s => s.trim()).filter(s => s);

            if (sources.length > 0) {
                rules.push({
                    sources: sources,
                    replacement: replacement
                });
            }
        }
        return rules;
    }

    function applyReplacements(text, rules) {
        let currentText = text;

        for (const rule of rules) {
            for (const source of rule.sources) {
                // Escape special regex characters
                const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Create global, case-insensitive regex
                const regex = new RegExp(escapedSource, 'gi');

                currentText = currentText.replace(regex, rule.replacement);
            }
        }
        return currentText;
    }

    function saveToStorage(element, key, statusElement) {
        localStorage.setItem(key, element.value);
        showSaveStatus(statusElement, 'Saved');
        setTimeout(() => {
            statusElement.classList.remove('visible');
        }, 2000);
    }

    function loadFromStorage() {
        const savedRules = localStorage.getItem(STORAGE_KEY_RULES);
        const savedFont = localStorage.getItem(STORAGE_KEY_FONT);

        if (savedRules) {
            rulesInput.value = savedRules;
        } else {
            loadDefaultRules();
        }

        if (savedFont) {
            currentFontSize = parseFloat(savedFont);
            applyFontSize();
        }
    }

    function adjustFontSize(delta) {
        currentFontSize += delta;
        // Clamp between 0.8rem and 3rem
        currentFontSize = Math.max(0.8, Math.min(3.0, currentFontSize));
        applyFontSize();
        localStorage.setItem(STORAGE_KEY_FONT, currentFontSize);
    }

    function applyFontSize() {
        document.documentElement.style.setProperty('--content-font-size', `${currentFontSize}rem`);
    }

    function sortRules() {
        const raw = rulesInput.value;
        const lines = raw.split(/\r?\n/).filter(line => line.trim());

        lines.sort((a, b) => {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });

        rulesInput.value = lines.join('\n');

        // Trigger save and re-process
        saveToStorage(rulesInput, STORAGE_KEY_RULES, saveStatus);
        processText();
    }

    async function loadDefaultRules(force = false) {
        try {
            const response = await fetch('rules.txt');
            if (response.ok) {
                const text = await response.text();
                rulesInput.value = text;
                // Save to immediate storage so it persists
                saveToStorage(rulesInput, STORAGE_KEY_RULES, saveStatus);
                processText();
            } else {
                console.warn('Default rules file not found');
            }
        } catch (e) {
            console.error('Error loading default rules:', e);
            if (force) alert('Could not load default rules from server.');
        }
    }

    // Resizer Logic
    const resizer = document.getElementById('drag-handle');
    const leftPanel = document.querySelector('.left-panel');
    const container = document.querySelector('.split-view');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        // Calculate new width relative to container left
        // X position relative to viewport - container left position
        const newLeftWidth = e.clientX - containerRect.left;

        // Convert to percentage for responsiveness
        let newWidthPercent = (newLeftWidth / containerWidth) * 100;

        // Limits (10% to 90%)
        newWidthPercent = Math.max(10, Math.min(90, newWidthPercent));

        leftPanel.style.width = `${newWidthPercent}%`;
        // Right panel automatically takes remaining space due to flex: 1
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    function showSaveStatus(element, msg) {
        element.textContent = msg;
        element.classList.add('visible');
    }
});
