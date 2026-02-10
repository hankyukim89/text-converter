document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const rulesInput = document.getElementById('rules-input');
    const processBtn = null; // Removed
    const copyBtn = document.getElementById('copy-btn');
    const saveStatus = document.getElementById('save-status');
    const inputSaveStatus = null;

    // Persistence Keys
    const STORAGE_KEY_RULES = 'text_replacer_rules';

    // Load saved data
    loadFromStorage();
    // Process immediately on load if there's data
    // processText(); // No need to process immediately if input is empty, but harmless. 

    // Event Listeners
    // processBtn.addEventListener('click', processText); // Removed

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

            const sourcePart = parts[0].trim();
            const replacement = parts[1].trim(); // Keep replacement as is (allow case)

            // Split source by &
            const sources = sourcePart.split('&').map(s => s.trim()).filter(s => s);

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

        if (savedRules) {
            rulesInput.value = savedRules;
        }
    }

    function showSaveStatus(element, msg) {
        element.textContent = msg;
        element.classList.add('visible');
    }
});
