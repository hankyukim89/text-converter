document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const rulesInput = document.getElementById('rules-input');
    const copyBtn = document.getElementById('copy-btn');
    const sortBtn = document.getElementById('sort-btn');
    const loadBtn = document.getElementById('load-btn');
    const saveStatus = document.getElementById('save-status');

    // AI & Settings Elements
    const aiScanBtn = document.getElementById('ai-scan-btn');
    const addToRulesBtn = document.getElementById('add-to-rules-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Settings Inputs
    const apiKeyInput = document.getElementById('api-key');
    const systemPromptInput = document.getElementById('system-prompt');
    const tempSlider = document.getElementById('temp-slider');
    const topkSlider = document.getElementById('topk-slider');
    const toppSlider = document.getElementById('topp-slider');

    // Settings Display Values
    const tempValue = document.getElementById('temp-value');
    const topkValue = document.getElementById('topk-value');
    const toppValue = document.getElementById('topp-value');

    // Font controls
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    let currentFontSize = 1.15; // default in rem

    // Persistence Keys
    const STORAGE_KEY_RULES = 'text_replacer_rules';
    const STORAGE_KEY_FONT = 'text_replacer_font_size';
    const STORAGE_KEY_GH_TOKEN = 'text_replacer_gh_token';
    const STORAGE_KEY_AI_SETTINGS = 'text_replacer_ai_settings';

    // Default AI Settings
    const DEFAULT_SYSTEM_PROMPT = ''; // Cleared for privacy/git push

    // AI State
    let isAIOutput = false;


    const REPO_OWNER = 'hankyukim89';
    const REPO_NAME = 'text-converter';
    const REPO_FILE_PATH = 'rules.txt';

    // Load saved data
    loadFromStorage();

    // Event Listeners
    increaseFontBtn.addEventListener('click', () => adjustFontSize(0.1));
    decreaseFontBtn.addEventListener('click', () => adjustFontSize(-0.1));

    sortBtn.addEventListener('click', sortRules);

    // AI & Settings Event Listeners
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveAISettings);

    // Sliders Live Update
    tempSlider.addEventListener('input', (e) => tempValue.textContent = e.target.value);
    topkSlider.addEventListener('input', (e) => topkValue.textContent = e.target.value);
    toppSlider.addEventListener('input', (e) => toppValue.textContent = e.target.value);

    // AI Actions
    aiScanBtn.addEventListener('click', runAIScan);
    addToRulesBtn.addEventListener('click', addAIResultsToRules);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    // New Load Button Logic
    loadBtn.addEventListener('click', () => {
        if (confirm('Load default rules from rules.txt? This will append/overwrite based on implementation (Overwriting for now).')) {
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

            // Auto-sync to GitHub if token exists
            syncToGitHub();
        }, 1000); // Debounce set to 1s for cloud sync
    });

    // Text input processing (Real-time)
    inputText.addEventListener('input', () => {
        if (isAIOutput) {
            // If user types while viewing AI output, clear the AI state and return to normal processing
            isAIOutput = false;
            addToRulesBtn.style.display = 'none';
        }
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
            if (!rule.sources || rule.sources.length === 0) continue;

            // Sort sources by length descending to match longest first
            const sortedSources = [...rule.sources].sort((a, b) => b.length - a.length);

            // Escape special regex characters for each source
            const escapedSources = sortedSources.map(source =>
                source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            );

            // Create a single regex for all sources: (source1|source2|...)
            const combinedPattern = escapedSources.join('|');
            const regex = new RegExp(combinedPattern, 'gi');

            currentText = currentText.replace(regex, rule.replacement);
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
            // Load defaults if no local save
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
        syncToGitHub(); // Also sync on sort
    }

    async function loadDefaultRules(force = false) {
        try {
            // Force bust cache
            const response = await fetch('rules.txt?v=' + new Date().getTime());
            if (response.ok) {
                const text = await response.text();
                rulesInput.value = text;
                saveToStorage(rulesInput, STORAGE_KEY_RULES, saveStatus);
                processText();
                console.log('Loaded defaults');
            }
        } catch (e) {
            console.warn('Default rules not found');
        }
    }

    // --- GitHub Auto-Sync Logic (Silent) ---

    async function syncToGitHub() {
        const token = localStorage.getItem(STORAGE_KEY_GH_TOKEN);
        if (!token) return; // No token, no sync

        const content = rulesInput.value;

        try {
            // Get current SHA
            const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${REPO_FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            let sha = null;
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            }

            // Create/Update file
            const body = {
                message: 'auto-update rules.txt',
                content: btoa(unescape(encodeURIComponent(content))), // Handle UTF-8
                sha: sha
            };

            const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${REPO_FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(body)
            });

            if (putRes.ok) {
                console.log('GitHub Auto-Save: Success');
                showSaveStatus(saveStatus, 'Saved to Cloud');
            } else {
                console.warn('GitHub Auto-Save: Failed', await putRes.json());
            }

        } catch (e) {
            console.error('GitHub Auto-Save: Error', e);
        }
    }

    // Resizer Logic (Unchanged)
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

    // --- AI & Settings Logic ---

    function openSettings() {
        const settings = loadAISettings(); // Get latest
        apiKeyInput.value = settings.apiKey || '';
        systemPromptInput.value = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;

        tempSlider.value = settings.temp;
        tempValue.textContent = settings.temp;

        topkSlider.value = settings.topK;
        topkValue.textContent = settings.topK;

        toppSlider.value = settings.topP;
        toppValue.textContent = settings.topP;

        settingsModal.classList.add('visible');
    }

    function closeSettings() {
        settingsModal.classList.remove('visible');
    }

    function saveAISettings() {
        const settings = {
            apiKey: apiKeyInput.value.trim(),
            systemPrompt: systemPromptInput.value.trim(),
            temp: parseFloat(tempSlider.value),
            topK: parseInt(topkSlider.value),
            topP: parseFloat(toppSlider.value)
        };

        localStorage.setItem(STORAGE_KEY_AI_SETTINGS, JSON.stringify(settings));
        closeSettings();
        alert('Settings saved!');
    }

    function loadAISettings() {
        const saved = localStorage.getItem(STORAGE_KEY_AI_SETTINGS);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error parsing AI settings', e);
            }
        }
        return {
            apiKey: '',
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            temp: 0.1,
            topK: 40,
            topP: 0.95
        };
    }

    async function runAIScan() {
        const text = inputText.value.trim();
        if (!text) {
            alert('Please enter some text to scan.');
            return;
        }

        const settings = loadAISettings();
        if (!settings.apiKey) {
            alert('Please set your Gemini API Key in Settings first (Gear icon).');
            openSettings();
            return;
        }

        // UI Loading State
        const originalBtnText = aiScanBtn.textContent;
        aiScanBtn.textContent = 'Scanning...';
        aiScanBtn.disabled = true;
        outputText.value = 'Analyzing text with Gemini...';

        try {
            const result = await callGeminiAPI(text, settings);

            // Display Results
            outputText.value = result;
            isAIOutput = true;
            addToRulesBtn.style.display = 'inline-block'; // Show "Add to Rules"

        } catch (error) {
            outputText.value = 'Error: ' + error.message;
            console.error('AI Scan Error:', error);
        } finally {
            aiScanBtn.textContent = originalBtnText;
            aiScanBtn.disabled = false;
        }
    }

    async function callGeminiAPI(text, settings) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${settings.apiKey}`;

        const payload = {
            contents: [{
                parts: [{ text: text }]
            }],
            systemInstruction: {
                parts: [{ text: settings.systemPrompt }]
            },
            generationConfig: {
                temperature: settings.temp,
                topK: settings.topK,
                topP: settings.topP,
                maxOutputTokens: 8192,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Unknown API Error');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
    }

    function addAIResultsToRules() {
        const aiText = outputText.value;
        if (!aiText) return;

        const newRules = [];
        const lines = aiText.split(/\r?\n/);

        // Expected format: Term (Source)
        // Regex: (.*) \((.*)\)
        // We want to convert to: Term; Source

        const regex = /^(.*)\s\((.*)\)$/;

        for (const line of lines) {
            if (!line.trim()) continue;

            const match = line.match(regex);
            if (match) {
                const term = match[1].trim();
                const source = match[2].trim();
                newRules.push(`${term}; ${source}`);
            }
        }

        if (newRules.length === 0) {
            alert('No valid rules found in the output. Expected format: "Term (Source)"');
            return;
        }

        // Append to existing rules
        const currentRules = rulesInput.value;
        const separator = currentRules.trim() ? '\n' : '';
        const updatedRules = currentRules + separator + newRules.join('\n');

        rulesInput.value = updatedRules;

        // Trigger save and process
        saveToStorage(rulesInput, STORAGE_KEY_RULES, saveStatus);

        // Clear AI state and re-process
        isAIOutput = false;
        addToRulesBtn.style.display = 'none';
        processText();
        syncToGitHub();

        alert(`Added ${newRules.length} new rules!`);
    }
});
