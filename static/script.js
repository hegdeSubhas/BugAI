// --- Global State ---
let currentAnalysisData = null; 
// const HISTORY_KEY = 'bugai_analysis_history'; // No longer used
let editor; 
let isReading = false;
let correctedCodeViewer;
let analyzedCodeViewer;

// --- DOM Elements ---
const tabAnalyze = document.getElementById('tab-analyze');
const tabHistory = document.getElementById('tab-history');
const panelAnalyze = document.getElementById('panel-analyze');
const panelHistory = document.getElementById('panel-history');

const languageInput = document.getElementById('language-input');
const otherLanguageInput = document.getElementById('other-language-input');

const analyzeButton = document.getElementById('analyze-button');
const analyzeButtonText = document.getElementById('analyze-button-text');
const analyzeSpinner = document.getElementById('analyze-spinner');

const resultsPanel = document.getElementById('results-panel');
const resultsPlaceholder = document.getElementById('results-placeholder');
const resultsLoading = document.getElementById('results-loading');
const resultsError = document.getElementById('results-error');
const errorMessage = document.getElementById('error-message');
const resultsContent = document.getElementById('results-content');

const resultExplanation = document.getElementById('result-explanation');
const resultLanguageLabel = document.getElementById('result-language-label');

const tabCorrected = document.getElementById('tab-corrected');
const tabAnalyzed = document.getElementById('tab-analyzed');
const panelCorrectedCode = document.getElementById('panel-corrected-code');
const panelAnalyzedCode = document.getElementById('panel-analyzed-code');

const noCorrectedCodeMsg = document.getElementById('no-corrected-code-msg');

const copyCodeButton = document.getElementById('copy-code-button');
const copyIcon = document.getElementById('copy-icon');
const checkIcon = document.getElementById('check-icon');

const bugsTableBody = document.getElementById('bugs-table-body');
const noBugsMessage = document.getElementById('no-bugs-message');
const suggestionsList = document.getElementById('suggestions-list');
const noSuggestionsMessage = document.getElementById('no-suggestions-message');

const historyList = document.getElementById('history-list');
const historyPlaceholder = document.getElementById('history-placeholder');

const downloadPdfButton = document.getElementById('download-pdf-button');
const readBugsButton = document.getElementById('read-bugs-button');
const readBugsButtonText = document.getElementById('read-bugs-button-text');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCancelButton = document.getElementById('modal-cancel-button');
let modalConfirmButton = document.getElementById('modal-confirm-button');

// --- Tab Switching ---
function switchTab(tab) {
    if (tab === 'analyze') {
        tabAnalyze.classList.add('border-indigo-400', 'text-white');
        tabAnalyze.classList.remove('border-transparent', 'text-gray-400');
        tabHistory.classList.add('border-transparent', 'text-gray-400');
        tabHistory.classList.remove('border-indigo-400', 'text-white');
        
        panelAnalyze.classList.remove('hidden');
        panelAnalyze.classList.add('border-indigo-500/30'); 
        panelHistory.classList.add('hidden');
        panelHistory.classList.remove('border-indigo-500/30');
    } else if (tab === 'history') {
        tabHistory.classList.add('border-indigo-400', 'text-white');
        tabHistory.classList.remove('border-transparent', 'text-gray-400');
        tabAnalyze.classList.add('border-transparent', 'text-gray-400');
        tabAnalyze.classList.remove('border-indigo-400', 'text-white');
        
        panelHistory.classList.remove('hidden');
        panelHistory.classList.add('border-indigo-500/30'); 
        panelAnalyze.classList.add('hidden');
        panelAnalyze.classList.remove('border-indigo-500/30');
        loadHistory(); 
    }
}

function switchCodeTab(tab) {
    if (tab === 'corrected') {
        tabCorrected.classList.add('border-indigo-400', 'text-white');
        tabCorrected.classList.remove('border-transparent', 'text-gray-400');
        tabAnalyzed.classList.add('border-transparent', 'text-gray-400');
        tabAnalyzed.classList.remove('border-indigo-400', 'text-white');
        
        panelCorrectedCode.classList.remove('hidden');
        panelAnalyzedCode.classList.add('hidden');
        
        if (correctedCodeViewer) {
            correctedCodeViewer.refresh();
        }
    } else {
        tabAnalyzed.classList.add('border-indigo-400', 'text-white');
        tabAnalyzed.classList.remove('border-transparent', 'text-gray-400');
        tabCorrected.classList.add('border-transparent', 'text-gray-400');
        tabCorrected.classList.remove('border-indigo-400', 'text-white');
        
        panelAnalyzedCode.classList.remove('hidden');
        panelCorrectedCode.classList.add('hidden');
        
        if (analyzedCodeViewer) {
            analyzedCodeViewer.refresh();
        }
    }
}

// --- Loading & Error States ---
function showLoading(isLoading) {
    if (isLoading) {
        resultsPlaceholder.classList.add('hidden');
        resultsError.classList.add('hidden');
        resultsContent.classList.add('hidden');
        resultsLoading.classList.remove('hidden');
        
        analyzeButtonText.textContent = 'Analyzing...';
        analyzeSpinner.classList.remove('hidden');
        analyzeButton.disabled = true;
    } else {
        resultsLoading.classList.add('hidden');
        analyzeButtonText.textContent = 'Analyze Code';
        analyzeSpinner.classList.add('hidden');
        analyzeButton.disabled = false;
    }
}

function showError(message) {
    showLoading(false);
    resultsPlaceholder.classList.add('hidden');
    resultsContent.classList.add('hidden');
    resultsError.classList.remove('hidden');
    errorMessage.textContent = message;
    
    currentAnalysisData = null;
    downloadPdfButton.classList.add('hidden');
    readBugsButton.classList.add('hidden');
}

// --- Modal ---
function showModal({ title, body, confirmText, confirmClass, onConfirm }) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    
    modalConfirmButton.textContent = confirmText || 'Confirm';
    modalConfirmButton.className = "text-white text-sm font-medium py-2 px-4 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none";
    const baseConfirmClass = confirmClass || 'bg-red-600 hover:bg-red-700 focus:ring-red-400';
    const confirmClasses = baseConfirmClass.split(' ');
    confirmClasses.push('focus:ring-2');
    modalConfirmButton.classList.add(...confirmClasses);
    
    const newConfirmButton = modalConfirmButton.cloneNode(true);
    modalConfirmButton.parentNode.replaceChild(newConfirmButton, modalConfirmButton);
    newConfirmButton.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    modalConfirmButton = newConfirmButton; 
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// --- Backend API Call (MODIFIED) ---
async function analyzeCode() {
    stopReading();
    const code = editor.getValue();

    let languageName = '';
    const langValue = languageInput.value;

    if (langValue === 'other') {
        languageName = otherLanguageInput.value.trim();
    } else {
        languageName = languageInput.options[languageInput.selectedIndex].text;
    }

    if (!code.trim()) {
        showError("Please enter some code to analyze.");
        resultsError.classList.remove('hidden');
        resultsPlaceholder.classList.add('hidden');
        resultsContent.classList.add('hidden');
        return;
    }
    if (!languageName) {
        showError("Please specify the programming language.");
        resultsError.classList.remove('hidden');
        resultsPlaceholder.classList.add('hidden');
        resultsContent.classList.add('hidden');
        return;
    }
    
    // API Key check is REMOVED from here

    showLoading(true);

    // This is the new payload for OUR backend
    const payload = {
        code: code,
        language: languageName,
        languageMime: langValue // Send the mime type too
    };

    try {
        // This is the NEW fetch URL
        const response = await fetch("/api/analyze", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.detail || `API Error: ${response.status}`);
        }

        // The response is ALREADY the JSON we need
        const analysisData = await response.json();
        
        // --- End of new block ---

        // Add back the data needed for display/PDF
        analysisData.code = code;
        analysisData.language = languageName;
        analysisData.languageMime = langValue;
        analysisData.timestamp = new Date().toISOString();

        currentAnalysisData = analysisData; 
        
        displayResults(analysisData);
        
        // saveToHistory(analysisData); // This is now handled by the backend

    } catch (error) {
        console.error("Analysis failed:", error);
        showError(error.message || "An unknown error occurred.");
    } finally {
        showLoading(false);
    }
}

// --- JSON Parsing (No longer needed here) ---
// function extractJsonFromText(text) { ... } // This is now done on the backend

// --- Result Display (Updated for CodeMirror viewers) ---
function displayResults(data) {
    showLoading(false);
    resultsPlaceholder.classList.add('hidden');
    resultsError.classList.add('hidden');
    resultsContent.classList.remove('hidden');
    downloadPdfButton.classList.remove('hidden');
    readBugsButton.classList.remove('hidden');

    // 1. Summary
    resultExplanation.textContent = data.explanation || "No explanation provided.";

    // 2. Code Viewers
    const langMime = data.languageMime || 'text/plain';
    
    analyzedCodeViewer.setValue(data.code || "");
    analyzedCodeViewer.setOption("mode", langMime);
    
    if (data.correctedCode && data.correctedCode.trim() !== "") {
        correctedCodeViewer.setValue(data.correctedCode);
        correctedCodeViewer.setOption("mode", langMime);
        noCorrectedCodeMsg.classList.add('hidden');
        correctedCodeViewer.getWrapperElement().classList.remove('hidden');
        copyCodeButton.classList.remove('hidden');
    } else {
        correctedCodeViewer.setValue("");
        noCorrectedCodeMsg.classList.remove('hidden');
        correctedCodeViewer.getWrapperElement().classList.add('hidden');
        copyCodeButton.classList.add('hidden');
    }
    
    resultLanguageLabel.textContent = data.language || "code";
    // Ensure CodeMirror instances refresh layout *after* they become visible
    setTimeout(() => {
        correctedCodeViewer.refresh();
        analyzedCodeViewer.refresh();
    }, 10);
    switchCodeTab('corrected'); // Switch tab after setting content

    // 3. Bugs Table
    bugsTableBody.innerHTML = '';
    if (data.bugs && data.bugs.length > 0) {
        noBugsMessage.classList.add('hidden');
        bugsTableBody.parentElement.parentElement.classList.remove('hidden');
        data.bugs.forEach(bug => {
            const severity = (bug.severity || 'low').toLowerCase();
            let severityClass = 'bg-gray-700 text-gray-300';
            if (severity === 'medium') {
                severityClass = 'bg-yellow-700 text-yellow-200';
            } else if (severity === 'high') {
                severityClass = 'bg-red-700 text-red-200';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-2 text-sm text-gray-200">${bug.line || 'N/A'}</td>
                <td class="px-4 py-2 text-sm">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${severityClass}">${severity}</span>
                </td>
                <td class="px-4 py-2 text-sm text-gray-300">${bug.description || 'No description'}</td>
            `;
            bugsTableBody.appendChild(tr);
        });
    } else {
        noBugsMessage.classList.remove('hidden');
        // Hide the entire table div if no bugs
        bugsTableBody.parentElement.parentElement.classList.add('hidden'); 
    }

    // 4. Suggestions List
    suggestionsList.innerHTML = '';
    if (data.suggestions && data.suggestions.length > 0) {
        noSuggestionsMessage.classList.add('hidden');
        suggestionsList.classList.remove('hidden');
        data.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            suggestionsList.appendChild(li);
        });
    } else {
        noSuggestionsMessage.classList.remove('hidden');
        suggestionsList.classList.add('hidden');
    }
    
    isReading = false;
    readBugsButtonText.textContent = "Read Bugs";
    
    copyIcon.classList.remove('hidden');
    checkIcon.classList.add('hidden');
}

// --- History Management (MODIFIED) ---
// getHistory() and saveToHistory() are REMOVED

async function loadHistory() {
    historyList.innerHTML = '';
    
    try {
        const response = await fetch('/api/history');
        if (!response.ok) {
             throw new Error('Failed to fetch history');
        }
        const history = await response.json();

        if (history.length === 0) {
            historyPlaceholder.style.display = 'block';
            historyPlaceholder.textContent = "No history yet.";
            if (!historyList.contains(historyPlaceholder)) {
                 historyList.appendChild(historyPlaceholder);
            }
        } else {
            historyPlaceholder.style.display = 'none';
            history.forEach(entry => {
                const li = document.createElement('li');
                li.className = 'bg-gray-700/50 p-3 rounded-md hover:bg-gray-600/50 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] shadow-md border border-gray-700 hover:border-gray-600/80 hover:shadow-lg';
                
                // We use entry.fullData to get the complete analysis
                li.onclick = () => {
                    currentAnalysisData = entry.fullData;
                    displayResults(entry.fullData);
                    switchTab('analyze');
                    editor.setValue(entry.fullData.code);
                    
                    const langMime = entry.fullData.languageMime;
                    languageInput.value = langMime;
                    
                    if (langMime === 'other') {
                        otherLanguageInput.classList.remove('hidden');
                        otherLanguageInput.value = entry.fullData.language;
                    } else {
                        otherLanguageInput.classList.add('hidden');
                        otherLanguageInput.value = '';
                    }
                    updateEditorLanguage();
                };
                
                const bugText = entry.bugCount === 1 ? '1 bug' : `${entry.bugCount} bugs`;
                
                li.innerHTML = `
                    <div class="flex justify-between items-center text-sm mb-1">
                        <span class="font-bold text-indigo-300">${entry.language}</span>
                        <span class="text-xs text-gray-400">${new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p class="text-sm text-gray-300 truncate">${entry.explanation}</p>
                    <span class="text-xs font-medium ${entry.bugCount > 0 ? 'text-red-400' : 'text-green-400'}">${bugText}</span>
                `;
                historyList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Failed to load history:", error);
        historyPlaceholder.style.display = 'block';
        historyPlaceholder.textContent = "Failed to load history.";
        if (!historyList.contains(historyPlaceholder)) {
            historyList.appendChild(historyPlaceholder);

        }
    }
}

function showClearHistoryModal() {
    showModal({
        title: 'Clear History',
        body: 'Are you sure you want to clear all analysis history? This cannot be undone.',
        confirmText: 'Clear All',
        confirmClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-400',
        onConfirm: async () => {
            // This is the new part
            try {
                await fetch('/api/history', { method: 'DELETE' });
                loadHistory(); // Reload the now-empty list
            } catch (error) {
                console.error("Failed to clear history:", error);
            }
        }
    });
}

// --- Editor Language Sync ---
function updateEditorLanguage() {
    const langValue = languageInput.value;
    if (langValue === 'other') {
        otherLanguageInput.classList.remove('hidden');
        editor.setOption("mode", null); 
    } else {
        otherLanguageInput.classList.add('hidden');
        otherLanguageInput.value = ''; 
        editor.setOption("mode", langValue);
    }
}

// --- Text-to-Speech (TTS) ---
function stopReading() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    isReading = false;
    readBugsButtonText.textContent = "Read Bugs";
}

function toggleReadBugs(button) {
    if (!('speechSynthesis' in window)) {
        showModal({
            title: 'TTS Not Supported',
            body: 'Sorry, your browser does not support text-to-speech.',
            confirmText: 'OK',
            confirmClass: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
            onConfirm: () => {}
        });
        return;
    }

    if (isReading) {
        stopReading();
        return;
    }

    if (!currentAnalysisData || !currentAnalysisData.bugs) {
        speak("No analysis data found.", button);
        return;
    }

    const bugs = currentAnalysisData.bugs;
    let textToSpeak = "";

    if (bugs.length === 0) {
        textToSpeak = "No bugs were found.";
    } else {
        textToSpeak = `Found ${bugs.length} ${bugs.length === 1 ? 'bug' : 'bugs'}. `;
        bugs.forEach((bug, index) => {
            textToSpeak += `Bug ${index + 1}: On line ${bug.line || 'unknown'}, severity ${bug.severity || 'low'}. ${bug.description} ... `;
        });
    }
    
    speak(textToSpeak, button);
}

function speak(text, button) {
    stopReading(); 
    const utterance = new SpeechSynthesisUtterance(text);
    isReading = true;
    
    readBugsButtonText.textContent = "Stop Reading";
    
    utterance.onend = () => {
        isReading = false;
        readBugsButtonText.textContent = "Read Bugs";
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        isReading = false;
        readBugsButtonText.textContent = "Read Bugs";
    };
    
    speechSynthesis.speak(utterance);
}

// --- PDF Generation ---
function downloadPDF() {
    if (!currentAnalysisData) {
        showModal({
            title: 'No Data',
            body: 'No analysis data to download. Please run an analysis first.',
            confirmText: 'OK',
            confirmClass: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
            onConfirm: () => {}
        });
        return;
    }

    const { code, language, explanation, bugs, suggestions, timestamp, correctedCode } = currentAnalysisData;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const titleSize = 18;
    const headingSize = 14;
    const bodySize = 10;
    const codeSize = 8;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - (margin * 2);
    let y = margin;

    function addText(text, size, style, spaceAfter, align = 'left') {
        if (y + (size * 1.5) > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }
        doc.setFont("helvetica", style);
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, maxLineWidth);
        
        let x = margin;
        if(align === 'center') x = pageWidth / 2;
        
        // Set text color for general text (ensure it's not the code block color)
        doc.setTextColor(30, 30, 30); // Dark text for headings/body
        doc.text(lines, x, y, { align: align });
        y += (lines.length * size * 0.4) + spaceAfter;
    }
    
    addText("BugAI Code Analysis Report", titleSize, "bold", 15, 'center');
    addText(`Date: ${new Date(timestamp).toLocaleString()}`, bodySize, "normal", 5);
    addText(`Language: ${language}`, bodySize, "normal", 10);
    addText("Analysis Summary", headingSize, "bold", 8);
    addText(explanation, bodySize, "normal", 15);
    addText("Bugs Found", headingSize, "bold", 8);
    
    if (bugs && bugs.length > 0) {
        const tableHead = [['Line', 'Severity', 'Description']];
        const tableBody = bugs.map(bug => [
            bug.line || 'N/A',
            bug.severity || 'low',
            bug.description || 'No description'
        ]);
        
        doc.autoTable({
            head: tableHead,
            body: tableBody,
            startY: y,
            theme: 'grid',
            // headStyles: { fillColor: [67, 56, 202] }, // Old indigo color
            headStyles: { fillColor: [75, 85, 99] }, // NEW GRAY COLOR (like gray-600)
            styles: { cellPadding: 2, fontSize: bodySize, font: 'helvetica', textColor: [30, 30, 30] }, // Ensure table text is dark
            didDrawPage: (data) => { y = data.cursor.y; },
            columnStyles: { 2: { cellWidth: maxLineWidth - 30 } }
        });
        y = doc.autoTable.previous.finalY + 10;
    } else {
        addText("No bugs were found.", bodySize, "italic", 15);
    }

    if (y + 20 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
    addText("Suggestions", headingSize, "bold", 8);
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            addText(`• ${suggestion}`, bodySize, "normal", 5);
        });
        y += 10;
    } else {
        addText("No suggestions were provided.", bodySize, "italic", 15);
    }
    
    function addCodeBlock(title, codeString) {
        if (!codeString || codeString.trim() === '') return; // Skip empty code blocks

        if (y + 20 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        // Set text color before adding heading
        doc.setTextColor(30, 30, 30); // Dark text for headings
        addText(title, headingSize, "bold", 8);
        
        doc.setFont("courier", "normal");
        doc.setFontSize(codeSize);
        doc.setFillColor(248, 249, 250); // Light gray background for code block
        
        const codeLines = doc.splitTextToSize(codeString, maxLineWidth - 10);
        const blockHeight = (codeLines.length * codeSize * 0.4) + 10;

        if (y + blockHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }
        
        doc.rect(margin, y, maxLineWidth, blockHeight, 'F');
        // --- TEXT COLOR FIX ---
        // Set darker gray color for code text
        doc.setTextColor(55, 65, 81); // Dark gray text (like text-gray-700)
        doc.text(codeLines, margin + 5, y + 8);
        y += blockHeight + 10;
        // Reset text color after drawing code block
        doc.setTextColor(30, 30, 30); // Reset to dark text
    }

    addCodeBlock("Corrected Code", correctedCode);
    addCodeBlock("Original Analyzed Code", code);

    doc.save(`BugAI_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// --- Copy Code Function ---
function copyCorrectedCode() {
    const codeToCopy = correctedCodeViewer.getValue();
    if (!codeToCopy) return;
    
    navigator.clipboard.writeText(codeToCopy).then(() => {
        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
        
        setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
        // Fallback for older browsers or insecure contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = codeToCopy;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            copyIcon.classList.add('hidden');
            checkIcon.classList.remove('hidden');
            setTimeout(() => {
                copyIcon.classList.remove('hidden');
                checkIcon.classList.add('hidden');
            }, 2000);
        } catch (fallbackErr) {
            console.error('Fallback copy failed: ', fallbackErr);
            showModal({
                title: 'Copy Failed',
                body: 'Could not copy code to clipboard. Please copy it manually.',
                confirmText: 'OK',
                confirmClass: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
                onConfirm: () => {}
            });
        }
    });
}

// --- Initial Load (Updated) ---
window.onload = () => {
    // Initialize CodeMirror Editor
    editor = CodeMirror.fromTextArea(document.getElementById('code-input'), {
        lineNumbers: true,
        mode: 'python', 
        theme: 'dracula',
        autoCloseBrackets: true,
        matchBrackets: true,
        lineWrapping: true,
        placeholder: "Paste your code here"
    });
    editor.setSize("100%", "auto");
    editor.getWrapperElement().style.minHeight = "200px";
    editor.getWrapperElement().style.flexGrow = "1";
    editor.getWrapperElement().style.height = "100%";
    
    // Initialize Corrected Code Viewer
    correctedCodeViewer = CodeMirror.fromTextArea(document.getElementById('corrected-code-viewer'), {
        lineNumbers: true,
        mode: 'python',
        theme: 'dracula',
        readOnly: true,
        lineWrapping: true
    });
    correctedCodeViewer.setSize("100%", "auto");
    correctedCodeViewer.getWrapperElement().style.maxHeight = "240px"; // Limit height
    // Add padding to push code down below copy button
    correctedCodeViewer.getWrapperElement().style.paddingTop = "1.75rem"; // ~7 * 0.25rem = h-7


    // Initialize Analyzed Code Viewer
    analyzedCodeViewer = CodeMirror.fromTextArea(document.getElementById('analyzed-code-viewer'), {
        lineNumbers: true,
        mode: 'python',
        theme: 'dracula',
        readOnly: true,
        lineWrapping: true
    });
    analyzedCodeViewer.setSize("100%", "auto");
    analyzedCodeViewer.getWrapperElement().style.maxHeight = "240px"; // Limit height
    
    languageInput.addEventListener('change', updateEditorLanguage);
    
    // Do not load history on page load, only when tab is clicked
    // loadHistory(); 
    // Do NOT populate the editor initially — user should paste/type their code
    editor.setValue("");
    
    // Start with no mode until the user selects a language
    editor.setOption("mode", null);

    // Do not auto-focus so user sees an empty editor and language selection
};

document.addEventListener('mousemove', e => {
    document.body.style.setProperty('--x', `${e.clientX}px`);
    document.body.style.setProperty('--y', `${e.clientY}px`);
});


