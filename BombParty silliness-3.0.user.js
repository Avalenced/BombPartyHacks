// ==UserScript==
// @name         BombParty silliness
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Advanced helper tool for BombParty Clone with improved features and stability
// @author       You
// @match        https://bombparty-clone.fly.dev/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Core state management
    let wordList = null;
    let usedWords = new Set();
    let autoMode = null;
    let autoInterval = null;
    let typingSpeed = 100;
    let humanMode = true;
    let mistakeChance = 0;
    let autoSubmitDelay = 200;
    let wordHistory = [];
    let isTyping = false;
    let consecutiveUses = new Map(); // Track word usage frequency
    let lastGameState = null;

    // Configuration
    const CONFIG = {
        MAX_HISTORY: 15,
        MAX_CONSECUTIVE_USES: 3,
        RESET_COOLDOWN: 5000,
        MIN_WORD_LENGTH: 4
    };

    // Wait for game to load
    const waitForGame = setInterval(() => {
        if (document.querySelector('.form-control')) {
            clearInterval(waitForGame);
            initHelper();
        }
    }, 1000);

    function initHelper() {
        const ui = createUI();
        document.body.appendChild(ui);
        initializeEventListeners(ui);
        initializeGameObserver();
    }

    function createUI() {
        const ui = document.createElement('div');
        ui.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #1a1b1e;
            color: #fff;
            border: 1px solid #2d2f36;
            padding: 20px;
            z-index: 10000;
            user-select: none;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            width: 320px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        ui.innerHTML = `
            <div style="margin: -20px -20px 15px -20px; padding: 15px 20px; background: #2d2f36; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                <span> BombParty "Helper" </span>
                <input type="file" id="wordlistInput" accept=".json" style="display: none;">
                <button id="loadWordsBtn" style="background: #4a4d57; border: none; color: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Load Words</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <button class="helper-btn" data-mode="best">Best Word</button>
                <button class="helper-btn" data-mode="longest">Longest</button>
                <button class="helper-btn" data-mode="random">Random</button>
            </div>
            <div class="settings-section">
                <div class="setting-item">
                    <label>Type Speed:</label>
                    <input type="range" id="speedSlider" min="20" max="200" value="${typingSpeed}">
                    <span id="speedValue">${typingSpeed}ms</span>
                </div>
                <div class="setting-item">
                    <label>Submit Delay:</label>
                    <input type="range" id="submitDelaySlider" min="0" max="500" value="${autoSubmitDelay}">
                    <span id="submitDelayValue">${autoSubmitDelay}ms</span>
                </div>
                <div class="setting-item">
                    <label>Typo Chance:</label>
                    <input type="range" id="mistakeSlider" min="0" max="20" value="${mistakeChance}">
                    <span id="mistakeValue">${mistakeChance}%</span>
                </div>
            </div>
            <div class="toggle-section">
                <label class="toggle">
                    <input type="checkbox" id="humanModeToggle" checked>
                    <span class="toggle-label">Human Mode</span>
                </label>
            </div>
            <div id="wordHistory" class="word-history">
                <div class="history-header">Recent Words (Right-click to reuse):</div>
                <div class="history-content"></div>
            </div>
            <div class="status-section">
                <div id="wordlistStatus">No wordlist loaded</div>
                <div id="gameStatus"></div>
                <div id="statsDisplay"></div>
            </div>
        `;

        addStyles();
        return ui;
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .helper-btn {
                background: #3d4048;
                border: none;
                color: #fff;
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .helper-btn:hover { background: #4a4d57; }
            .helper-btn.auto-enabled {
                background: #4a8eff;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(74, 142, 255, 0.4); }
                70% { box-shadow: 0 0 0 6px rgba(74, 142, 255, 0); }
                100% { box-shadow: 0 0 0 0 rgba(74, 142, 255, 0); }
            }
            .settings-section {
                margin: 15px 0;
                padding: 10px;
                background: #2d2f36;
                border-radius: 6px;
            }
            .setting-item {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 8px 0;
                font-size: 14px;
            }
            .setting-item input[type="range"] {
                flex-grow: 1;
            }
            .toggle-section {
                display: flex;
                gap: 15px;
                margin: 15px 0;
                flex-wrap: wrap;
            }
            .toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 14px;
            }
            .word-history {
                margin: 15px 0;
                padding: 10px;
                background: #2d2f36;
                border-radius: 6px;
                max-height: 120px;
                overflow-y: auto;
            }
            .history-header {
                font-size: 13px;
                color: #888;
                margin-bottom: 5px;
            }
            .history-content {
                font-size: 12px;
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }
            .history-word {
                background: #3d4048;
                padding: 2px 6px;
                border-radius: 4px;
                cursor: pointer;
            }
            .history-word:hover {
                background: #4a4d57;
            }
            .status-section {
                margin-top: 15px;
                font-size: 13px;
            }
            #statsDisplay {
                margin-top: 5px;
                font-size: 12px;
                color: #888;
            }
        `;
        document.head.appendChild(style);
    }

    function getNeededLetters() {
        const letters = document.querySelectorAll('.heart-letters-btn');
        const neededLetters = new Set();

        letters.forEach(letter => {
            // Check for both warning (yellow) and outline (white) buttons
            if (letter.classList.contains('btn-warning') || letter.classList.contains('btn-outline-dark')) {
                neededLetters.add(letter.textContent.toLowerCase());
            }
        });

        return neededLetters;
    }

    function countNeededLetters(word, neededLetters) {
        const uniqueLetters = new Set(word.toLowerCase());
        let count = 0;
        for (const letter of uniqueLetters) {
            if (neededLetters.has(letter)) {
                count++;
            }
        }
        return count;
    }

    async function simulateRealTyping(input, word) {
        if (isTyping) return;
        isTyping = true;

        input.focus();
        input.value = '';

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

        for (let i = 0; i < word.length; i++) {
            if (!isTyping) break;

            // Simulate realistic typing mistakes if enabled
            if (humanMode && Math.random() * 100 < mistakeChance) {
                const mistakeType = Math.random();
                if (mistakeType < 0.4) {
                    // Typo
                    const wrongChar = String.fromCharCode(
                        word.charCodeAt(i) + (Math.random() > 0.5 ? 1 : -1)
                    );
                    nativeInputValueSetter.call(input, input.value + wrongChar);
                } else if (mistakeType < 0.7) {
                    // Double letter
                    nativeInputValueSetter.call(input, input.value + word[i] + word[i]);
                } else {
                    // Skip letter (will be corrected next iteration)
                    continue;
                }

                input.dispatchEvent(new InputEvent('input', {bubbles: true}));
                await new Promise(r => setTimeout(r, typingSpeed));

                // Correct the mistake
                nativeInputValueSetter.call(input, input.value.slice(0, i));
                input.dispatchEvent(new InputEvent('input', {bubbles: true}));
                await new Promise(r => setTimeout(r, typingSpeed));
            }

            // Type correct character
            nativeInputValueSetter.call(input, input.value + word[i]);
            input.dispatchEvent(new InputEvent('input', {bubbles: true}));

            // Random delay between keystrokes if human mode is on
            const delay = humanMode ?
                typingSpeed + (Math.random() * 40 - 20) :
                typingSpeed;

            await new Promise(r => setTimeout(r, delay));
        }

        addToHistory(word);
        updateStats(word);
        isTyping = false;
    }

    function updateStats(word) {
        const statsDisplay = document.getElementById('statsDisplay');
        if (!statsDisplay) return;
        const usedCount = consecutiveUses.get(word) || 0;
        const neededLetters = getNeededLetters();
        const neededCount = countNeededLetters(word, neededLetters);
        statsDisplay.textContent = `Last word: ${word} (${word.length} letters, ${neededCount} needed, used ${usedCount}x)`;
    }

    function addToHistory(word) {
        if (!wordHistory.includes(word)) {
            wordHistory.unshift(word);
            if (wordHistory.length > CONFIG.MAX_HISTORY) wordHistory.pop();

            const historyContent = document.querySelector('.history-content');
            if (historyContent) {
                historyContent.innerHTML = wordHistory
                    .map(w => `<span class="history-word" data-word="${w}">${w}</span>`)
                    .join('');
            }

            // Update consecutive uses counter
            consecutiveUses.set(word, (consecutiveUses.get(word) || 0) + 1);
        }
    }

    async function submitWord(word) {
        const input = document.querySelector('.form-control');
        if (!input || isTyping || !isMyTurn()) return;

        await simulateRealTyping(input, word);

        if (autoMode) {
            setTimeout(() => {
                const form = input.closest('form');
                if (form) {
                    form.dispatchEvent(new SubmitEvent('submit', {
                        bubbles: true,
                        cancelable: true
                    }));
                }
            }, autoSubmitDelay);
        }
    }

    function isMyTurn() {
        const input = document.querySelector('.form-control');
        return input && !input.disabled;
    }

    function getRequiredLetters() {
        const el = document.querySelector('.h1.mb-0.mt-2');
        return el ? el.textContent.trim().toLowerCase() : '';
    }

    function findWord(mode) {
        if (!wordList || !getRequiredLetters() || !isMyTurn()) return null;

        const required = getRequiredLetters();
        const neededLetters = getNeededLetters();

        const validWords = Object.keys(wordList)
            .filter(word =>
                !usedWords.has(word) &&
                word.length >= CONFIG.MIN_WORD_LENGTH &&
                word.toLowerCase().includes(required) &&
                wordList[word] === 1 &&
                (consecutiveUses.get(word) || 0) < CONFIG.MAX_CONSECUTIVE_USES
            );

        if (validWords.length === 0) {
            usedWords.clear();
            consecutiveUses.clear();
            return findWord(mode);
        }

        let word;
        switch(mode) {
            case 'longest':
                word = validWords.reduce((a, b) => a.length >= b.length ? a : b);
                break;
            case 'random':
                word = validWords[Math.floor(Math.random() * validWords.length)];
                break;
            case 'best':
            default:
                // Score words based on how many needed letters they contain
                const scoredWords = validWords.map(word => ({
                    word,
                    score: countNeededLetters(word, neededLetters)
                }));

                // Sort by number of needed letters (primary) and word length (secondary)
                scoredWords.sort((a, b) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;  // Most needed letters first
                    }
                    return b.word.length - a.word.length;  // Then longer words
                });

                // Pick randomly from top 5 best scoring words
                const topWords = scoredWords.slice(0, Math.min(5, scoredWords.length));
                word = topWords[Math.floor(Math.random() * topWords.length)].word;
                break;
        }

        usedWords.add(word);
        return word;
    }

    function checkAndPlay() {
        if (!autoMode || !wordList || isTyping || !isMyTurn()) return;

        const input = document.querySelector('.form-control');
        if (!input || input.value) return;

        const word = findWord(autoMode);
        if (word) submitWord(word);
    }

    function initializeEventListeners(ui) {
        // Button handlers
        const buttons = ui.querySelectorAll('.helper-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!isMyTurn()) {
                    const gameStatus = document.getElementById('gameStatus');
                    if (gameStatus) {
                        gameStatus.textContent = "Wait for your turn!";
                        gameStatus.style.color = '#ff4a4a';
                        setTimeout(() => gameStatus.textContent = '', 2000);
                    }
                    return;
                }
                const word = findWord(btn.dataset.mode);
                if (word) submitWord(word);
            });

            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                buttons.forEach(b => b.classList.remove('auto-enabled'));
                clearInterval(autoInterval);

                if (autoMode === btn.dataset.mode) {
                    autoMode = null;
                } else {
                    autoMode = btn.dataset.mode;
                    btn.classList.add('auto-enabled');
                    autoInterval = setInterval(checkAndPlay, 100);
                }
            });
        });

        // Settings controls
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        if (speedSlider && speedValue) {
            speedSlider.addEventListener('input', (e) => {
                typingSpeed = parseInt(e.target.value);
                speedValue.textContent = `${typingSpeed}ms`;
            });
        }

        const submitDelaySlider = document.getElementById('submitDelaySlider');
        const submitDelayValue = document.getElementById('submitDelayValue');
        if (submitDelaySlider && submitDelayValue) {
            submitDelaySlider.addEventListener('input', (e) => {
                autoSubmitDelay = parseInt(e.target.value);
                submitDelayValue.textContent = `${autoSubmitDelay}ms`;
            });
        }

        const mistakeSlider = document.getElementById('mistakeSlider');
        const mistakeValue = document.getElementById('mistakeValue');
        if (mistakeSlider && mistakeValue) {
            mistakeSlider.addEventListener('input', (e) => {
                mistakeChance = parseInt(e.target.value);
                mistakeValue.textContent = `${mistakeChance}%`;
            });
        }

        // Mode toggles
        const humanModeToggle = document.getElementById('humanModeToggle');
        if (humanModeToggle) {
            humanModeToggle.addEventListener('change', (e) => {
                humanMode = e.target.checked;
            });
        }

        // Word list loading
        const loadWordsBtn = document.getElementById('loadWordsBtn');
        const wordlistInput = document.getElementById('wordlistInput');
        const wordlistStatus = document.getElementById('wordlistStatus');

        if (loadWordsBtn && wordlistInput) {
            loadWordsBtn.addEventListener('click', () => wordlistInput.click());

            loadWordsBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (wordList) {
                    usedWords.clear();
                    consecutiveUses.clear();
                    wordHistory = [];
                    const historyContent = document.querySelector('.history-content');
                    if (historyContent) {
                        historyContent.innerHTML = '';
                    }
                    if (wordlistStatus) {
                        wordlistStatus.textContent = 'Word list reset - all words available again';
                        wordlistStatus.style.color = '#4a8eff';
                        setTimeout(() => {
                            const validWordCount = Object.values(wordList).filter(v => v === 1).length;
                            wordlistStatus.textContent = `Loaded ${validWordCount.toLocaleString()} valid words`;
                            wordlistStatus.style.color = '';
                        }, 2000);
                    }
                }
            });
        }

        if (wordlistInput && wordlistStatus) {
            wordlistInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        wordList = JSON.parse(e.target.result);
                        const validWordCount = Object.values(wordList).filter(v => v === 1).length;
                        wordlistStatus.textContent = `Loaded ${validWordCount.toLocaleString()} valid words`;
                        wordlistStatus.style.color = '#4a8eff';

                        usedWords.clear();
                        consecutiveUses.clear();
                        wordHistory = [];
                        const historyContent = document.querySelector('.history-content');
                        if (historyContent) {
                            historyContent.innerHTML = '';
                        }
                    } catch (err) {
                        wordlistStatus.textContent = 'Error loading wordlist';
                        wordlistStatus.style.color = '#ff4a4a';
                    }
                };
                reader.readAsText(file);
            });
        }

        // Make UI draggable
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };

        ui.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'LABEL' ||
                e.target.closest('.settings-section') ||
                e.target.closest('.toggle-section')) return;

            isDragging = true;
            dragStart = {
                x: e.clientX - ui.offsetLeft,
                y: e.clientY - ui.offsetTop
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const maxX = window.innerWidth - ui.offsetWidth;
            const maxY = window.innerHeight - ui.offsetHeight;

            let newX = e.clientX - dragStart.x;
            let newY = e.clientY - dragStart.y;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            ui.style.left = `${newX}px`;
            ui.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => isDragging = false);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.key === 'Escape') {
                isTyping = false;
                return;
            }

            const shortcuts = {
                '1': 'best',
                '2': 'longest',
                '3': 'random'
            };

            if (e.ctrlKey && shortcuts[e.key] && isMyTurn()) {
                e.preventDefault();
                const word = findWord(shortcuts[e.key]);
                if (word) submitWord(word);
            }
        });

        // Word history click handlers
        const historyContent = document.querySelector('.history-content');
        if (historyContent) {
            historyContent.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const wordEl = e.target.closest('.history-word');
                if (wordEl && isMyTurn()) {
                    submitWord(wordEl.dataset.word);
                }
            });
        }
    }

    function initializeGameObserver() {
        // Observe game state for round changes
        const gameObserver = new MutationObserver(() => {
            const currentState = getRequiredLetters();
            if (currentState !== lastGameState) {
                lastGameState = currentState;
                isTyping = false; // Reset typing state between rounds
            }
        });

        const gameArea = document.querySelector('.h1.mb-0.mt-2')?.parentElement;
        if (gameArea) {
            gameObserver.observe(gameArea, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }
})();