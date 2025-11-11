// =====================================================================================================
// ===================        Data Analysis Page Template Creation Functions        ====================
// =====================================================================================================
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { handleGenerate } from "../../analysis/analysis-helpers.mjs";
import { reattachActionListeners, reattachTabListeners } from "./template-creation.mjs";
import { setupInputToggle } from "../../utils/ui-utils.mjs";
import { navigateTo } from "../navigation.mjs";
import { extractTextFromFile, handleSaveAsDocx, handleSaveAsPdf } from "../../utils/file-utils.mjs";

function createDescriptiveLayout_DA(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xl font-bold text-white">Upload Your Dataset & Context</h3>
                            <div class="flex items-center space-x-2">
                                <button type="button" id="descConfigExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                                <a href="data-files/descriptive/descriptive-sample-doc.txt" download="Descriptive_Sample_Doc.txt" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .txt</a>
                                <a href="data-files/descriptive/descriptive-sample-data.csv" download="Descriptive_Sample_Data.csv" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .csv</a>
                            </div>
                        </div>

                        <div id="descConfigExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">
                            <div class="text-xs font-medium text-white/90 mb-2">📋 How to Use Descriptive Analysis</div>
                            <div class="space-y-2 text-xs">
                                <div id="descExampleContent" class="text-white/80">Loading example...</div>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label for="descriptiveContextFile" class="block text-sm font-medium text-gray-200 mb-2">Company Document (.txt, .docx)</label>
                                <div class="input-file-wrapper">
                                    <label for="descriptiveContextFile" id="descriptiveContextFileLabel" class="input-file-btn">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select context document...</span>
                                    </label>
                                        <input type="file" id="descriptiveContextFile" class="input-file" accept=".txt,.docx">
                                </div>
                            </div>
                            <div>
                                <label for="descriptiveFile" class="block text-sm font-medium text-gray-200 mb-2">Data File (.csv)</label>
                                    <div class="input-file-wrapper">
                                    <label for="descriptiveFile" id="descriptiveFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .csv data file...</span>
                                    </label>
                                    <input type="file" id="descriptiveFile" class="input-file" accept=".csv">
                                </div>
                                <div id="descriptiveFileError" class="text-red-400 text-sm mt-2"></div>
                            </div>
                            
                            <div id="descriptiveDataPreview" class="space-y-2">
                                <label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>
                                <div class="overflow-x-auto rounded-lg border border-white/20">
                                    <table class="min-w-full text-left text-sm text-white/90" id="descriptivePreviewTable">
                                        <tbody>
                                            <tr>
                                                <td class="p-4 text-center text-white/60" colspan="100%">Upload a .csv file to see a preview.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
    
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">🔍 Analyze Data</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                        <div class="text-center mt-4">
                                <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Descriptive Analysis Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;

    // --- All Helper Functions are LOCAL to this function ---

    const getHeadersFromText = (text) => {
        if (!text || typeof text !== 'string' || !text.trim()) throw new Error("Input text is empty.");
        const firstLine = text.split(/[\r\n]+/)[0];
        if (!firstLine || !firstLine.trim()) throw new Error("First line (header) is empty.");

        let headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split(';').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split('\t').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length === 0) throw new Error("Could not parse headers (tried comma, semicolon, tab).");
        return headers;
    };
    
    const showDataPreview = (csvText, tableId, containerId) => {
        const previewContainer = dom.$(containerId);
        const previewTable = dom.$(tableId);
        if (!previewContainer || !previewTable) return;

        try {
            const lines = csvText.split(/[\r\n]+/).filter(Boolean);
            const rows = lines.slice(0, 6); 
            
            if (rows.length < 2) { 
                previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Data file is empty or has no data rows.</td></tr></tbody>';
                previewContainer.classList.remove("hidden"); 
                return; 
            }

            const headers = getHeadersFromText(rows[0]);
            let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
            headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            rows.slice(1).forEach((line, rowIndex) => {
                let cells = line.split(',');
                if (cells.length !== headers.length) cells = line.split(';');
                if (cells.length !== headers.length) cells = line.split('\t');

                tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    tableHTML += `<td class="px-4 py-2">${cells[cellIndex] === undefined ? '' : cells[cellIndex]}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
            previewTable.innerHTML = tableHTML;
            previewContainer.classList.remove("hidden");
        } catch (e) {
            console.error("Error showing data preview:", e);
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            previewContainer.classList.remove("hidden");
        }
    };

    const processDataInput_Descriptive = async (file) => {
        const errorEl = dom.$("descriptiveFileError");
        const previewContainer = dom.$("descriptiveDataPreview");
        const previewTable = dom.$("descriptivePreviewTable");
        
        errorEl.textContent = "";
        previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Processing data...</td></tr></tbody>';
        previewContainer.classList.remove("hidden");

        if (!file) {
                previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Upload a .csv file to see a preview.</td></tr></tbody>';
                return;
        }

        try {
            const textContent = await extractTextFromFile(file); 
            const originalHeaders = getHeadersFromText(textContent);

            const lines = textContent.split(/[\r\n]+/).filter(Boolean);
            if (lines.length < 10) {
                errorEl.textContent = "Warning: Small dataset (<10 rows). Analysis may be unreliable.";
            }

            showDataPreview(textContent, 'descriptivePreviewTable', 'descriptiveDataPreview');

        } catch (err) {
            console.error("Descriptive input processing failed:", err);
            errorEl.textContent = `Error: ${err.message}.`;
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            previewContainer.classList.remove("hidden");
        }
    };

    // === Simplified attachListener for context file ===
    const attachListener = (inputId, labelId) => {
        const fileInput = dom.$(inputId);
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = dom.$(labelId);
                const fileNameSpan = label.querySelector(".file-name");
                if (e.target.files.length > 0) {
                    fileNameSpan.textContent = e.target.files[0].name;
                    label.classList.add("has-file");
                } else {
                    fileNameSpan.textContent = "Select a file...";
                    label.classList.remove("has-file");
                }
            });
        }
    };
    attachListener("descriptiveContextFile", "descriptiveContextFileLabel");

    // === NEW: Event listener for the descriptive data file ===
    const descriptiveFileInput = dom.$("descriptiveFile");
    if (descriptiveFileInput) {
        descriptiveFileInput.addEventListener("change", (e) => {
            const label = dom.$("descriptiveFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
                processDataInput_Descriptive(e.target.files[0]); // Process the file
            } else {
                fileNameSpan.textContent = "Select .csv data file...";
                label.classList.remove("has-file");
                processDataInput_Descriptive(null); // Reset
            }
        });
    }

    // --- Add Example Toggle ---
    const examplesBtn = dom.$("descConfigExamplesBtn");
    const examplesDiv = dom.$("descConfigExamples");
    const exampleContentEl = dom.$("descExampleContent");

    if (examplesBtn && examplesDiv && exampleContentEl) {
        examplesBtn.addEventListener("click", () => {
            const isHidden = examplesDiv.classList.toggle("hidden");
            examplesBtn.textContent = isHidden ? "View Examples" : "Hide Examples";

            if (!isHidden && exampleContentEl.textContent === "Loading example...") {
                exampleContentEl.innerHTML = `
                    <div class="mb-4">
                        <div class="flex items-center mb-2">
                            <span class="text-green-400 mr-2">✅</span>
                            <span class="text-sm font-medium text-green-400">GOOD EXAMPLE</span>
                            <span class="text-xs text-white/60 ml-2">(Results in comprehensive statistical insights with clear patterns)</span>
                        </div>
                        <div class="bg-green-900/20 border border-green-500/30 rounded p-3 mb-3">
                            <div class="text-xs text-white/90 mb-2"><strong>Company Document:</strong></div>
                            <div class="text-xs text-white/80 mb-3">
                                "TechFlow Solutions seeks to understand performance drivers affecting customer satisfaction and revenue growth. 
                                Key areas of focus: regional performance variations, employee productivity trends, and customer retention patterns. 
                                Strategic priority: identify underperforming segments and optimization opportunities."
                            </div>
                            <div class="text-xs text-white/90 mb-2"><strong>CSV Data (quarterly metrics):</strong></div>
                            <div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">
Quarter,Revenue_Millions,Customer_Count,Satisfaction_Score,Employee_Count,Regional_Performance
Q1_2023,12.5,285,4.2,125,North
Q2_2023,13.8,295,4.1,132,North  
Q3_2023,15.2,310,4.5,140,South
Q4_2023,16.9,325,4.8,145,West</div>
                        </div>
                    </div>
                    <div class="mb-4">
                        <div class="flex items-center mb-2">
                            <span class="text-red-400 mr-2">❌</span>
                            <span class="text-sm font-medium text-red-400">BAD EXAMPLE</span>
                            <span class="text-xs text-white/60 ml-2">(Results in limited insights and unclear patterns)</span>
                        </div>
                        <div class="bg-red-900/20 border border-red-500/30 rounded p-3">
                            <div class="text-xs text-white/80 mb-3">
                                "Our company has some data and wants analysis. Please look at everything and tell us what's important."
                            </div>
                            <div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">
Data1,Data2,Info,Stuff,$Revenue
A,Good,5,Things,$15000
B,Bad,3,Items,$12000</div>
                        </div>
                    </div>
                    <div class="border-t border-white/20 pt-3">
                        <div class="text-xs font-medium text-white/90 mb-2">📝 Key Differences Between Good & Bad Input:</div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <div class="text-green-400 font-medium mb-1">✅ Good Practices:</div>
                                <div class="text-white/80 space-y-1">
                                    <div>• Clear business context and objectives</div>
                                    <div>• Specific questions or focus areas</div>
                                    <div>• Consistent column naming</div>
                                    <div>• Clean numeric data (no symbols)</div>
                                    <div>• Meaningful time periods</div>
                                </div>
                            </div>
                            <div>
                                <div class="text-red-400 font-medium mb-1">❌ Bad Practices:</div>
                                <div class="text-white/80 space-y-1">
                                    <div>• Vague or missing context</div>
                                    <div>• Generic column names</div>
                                    <div>• Mixed data formats</div>
                                    <div>• Currency symbols in numbers</div>
                                    <div>• Inconsistent categorization</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="border-t border-white/20 pt-3 mt-3">
                        <div class="text-xs font-medium text-white/90 mb-2">💡 How to Use This Tool:</div>
                        <div class="text-xs text-white/80 space-y-1">
                            <div>• <strong>Write naturally:</strong> Describe your situation in plain English</div>
                            <div>• <strong>Be specific:</strong> Mention what you want to understand or improve</div>
                            <div>• <strong>Clean your data:</strong> Use consistent formatting and clear column headers</div>
                            <div>• <strong>Include context:</strong> Help the AI understand your business goals</div>
                            <div>• <strong>Show relationships:</strong> The document explains what the numbers mean</div>
                        </div>
                    </div>
                `;
            }
        });
    }
    // --- End of Example Toggle ---

    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    // Attach listener for the feedback link
    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createDescriptiveLayout_DA");
    }
}



/**
 * Combined function to create the layout for Predictive Analysis
 * and set up its specific event listeners.
 * Assumes the first column of the data is the date column.
 */
function createPredictiveAnalysisLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Set layout class

    // --- 1. Build HTML Structure ---
    contentContainer.innerHTML = `
        <div class="lg:col-span-1">
            <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
            <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

            <div class="max-w-2xl mx-auto w-full">
                <div class="glass-container p-6 space-y-6">

                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-xl font-bold text-white">Forecasting Configuration</h3>
                        <div class="flex items-center space-x-2">
                            <button type="button" id="predictiveExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                            <a href="data-files/predictive/predictive-sample-data.csv" download="Predictive_Sample_Data.csv" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .csv</a>
                        </div>
                    </div>

                    <div id="predictiveExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">
                         <div id="predictiveExampleContent">Loading example...</div>
                    </div>

                    <div class="input-radio-group">
                        <input type="radio" name="predictiveInputType" id="predictiveInputFileToggle" class="input-radio" checked>
                        <label for="predictiveInputFileToggle" class="input-radio-label">File Upload</label>
                        <input type="radio" name="predictiveInputType" id="predictiveInputTextToggle" class="input-radio">
                        <label for="predictiveInputTextToggle" class="input-radio-label">Paste Data</label>
                    </div>

                    <div id="predictiveFileUploadArea">
                        <label for="predictiveFile" class="block text-sm font-medium text-gray-200 mb-2">Time Series Data (.csv, .xlsx)</label>
                        <div class="input-file-wrapper">
                            <label for="predictiveFile" id="predictiveFileLabel" class="input-file-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16">
                                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                                </svg>
                                <span class="file-name">Select data file...</span>
                            </label>
                            <input type="file" id="predictiveFile" class="input-file" accept=".csv,.xlsx">
                        </div>
                        <div id="predictiveFileError" class="text-red-400 text-sm mt-2"></div>
                    </div>

                    <div id="predictiveTextInputArea" class="hidden">
                        <label for="predictiveDataText" class="block text-sm font-medium text-gray-200 mb-2">Paste CSV Data</label>
                        <textarea id="predictiveDataText" class="input-field h-48" placeholder="Date,Revenue,Customers\n2023-01-01,150000,1250\n2023-02-01,162000,1340..."></textarea>
                        <div id="predictiveTextError" class="text-red-400 text-sm mt-2"></div>
                    </div>

                    <div id="predictiveDataPreview" class="hidden space-y-2">
                        <label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>
                        <div class="overflow-x-auto rounded-lg border border-white/20">
                            <table class="min-w-full text-left text-sm text-white/90" id="predictivePreviewTable">
                            </table>
                        </div>
                         <p class="text-xs text-white/70">Assuming first column ('<span id="assumedDateColName" class="font-medium">...</span>') is the Date/Time column.</p>
                    </div>

                    <div class="grid grid-cols-1 gap-4">
                        <div>
                            <label for="predictiveTargetColumn" class="block text-sm font-medium text-gray-200 mb-2">Target Variable (to Forecast)</label>
                            <select id="predictiveTargetColumn" class="input-field" disabled>
                                <option value="">-- Upload data first --</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="predictiveForecastPeriods" class="block text-sm font-medium text-gray-200 mb-2">Forecast Periods</label>
                            <input type="number" id="predictiveForecastPeriods" class="input-field" value="12" min="1" max="48" placeholder="e.g., 12">
                        </div>
                        <div>
                            <label for="predictiveConfidenceLevel" class="block text-sm font-medium text-gray-200 mb-2">Confidence Level</label>
                            <select id="predictiveConfidenceLevel" class="input-field">
                                <option value="0.80">80%</option>
                                <option value="0.90" selected>90%</option>
                                <option value="0.95">95%</option>
                                <option value="0.99">99%</option>
                            </select>
                        </div>
                         <div>
                            <label for="predictiveModelType" class="block text-sm font-medium text-gray-200 mb-2">Model Type</label>
                            <select id="predictiveModelType" class="input-field">
                                <option value="auto" selected>Auto-Select Best</option>
                                <option value="trend">Simple Trend</option>
                                <option value="seasonal">Seasonal Forecast</option>
                                <option value="linear">Linear Regression</option>
                            </select>
                        </div>
                    </div>

                    <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                        <span id="generateBtnText">📈 Generate Forecast</span>
                        <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                    </button>
                    <div class="text-center mt-4">
	                    <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                    </div>
                </div>
            </div>

            <div class="mt-12">
                <h2 class="text-3xl font-bold mb-4 text-center">Forecast Results</h2>
                <div id="analysisResult" class="glass-container min-h-[400px]">
                    <div class="text-white/60 p-8 text-center">Upload your data and configure options to generate a forecast.</div>
                </div>
                <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                    <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                    <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                </div>
            </div>
        </div>
    `;

    // --- 2. Setup Event Listeners ---
    const fileToggle = dom.$("predictiveInputFileToggle");
    const textToggle = dom.$("predictiveInputTextToggle");
    const fileArea = dom.$("predictiveFileUploadArea");
    const textArea = dom.$("predictiveTextInputArea");
    const dataPreviewContainer = dom.$("predictiveDataPreview");
    const previewTable = dom.$("predictivePreviewTable");
    const fileInput = dom.$("predictiveFile");
    const textInput = dom.$("predictiveDataText");
    const targetColumnSelect = dom.$("predictiveTargetColumn");
    const fileError = dom.$("predictiveFileError");
    const textError = dom.$("predictiveTextError");
    const examplesBtn = dom.$("predictiveExamplesBtn");
    const examplesDiv = dom.$("predictiveExamples");
    const generateBtn = dom.$("generateBtn");
    const assumedDateColNameSpan = dom.$("assumedDateColName");

    let fullHeaders = []; // To store all headers
    let assumedDateColumn = null; // To store the name of the assumed date column

    // --- Helper Functions ---

    /**
     * Extracts headers from CSV text, trying common delimiters.
     */
    const getHeadersFromText = (text) => {
        if (!text || typeof text !== 'string' || !text.trim()) throw new Error("Input text is empty.");
        const firstLine = text.split(/[\r\n]+/)[0];
        if (!firstLine || !firstLine.trim()) throw new Error("First line (header) is empty.");

        let headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) {
            headers = firstLine.split(';').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        }
        if (headers.length <= 1) {
            headers = firstLine.split('\t').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        }
        if (headers.length === 0) throw new Error("Could not parse headers (tried comma, semicolon, tab). Ensure header row is present.");
        return headers;
    };

    /**
     * Displays the first few rows of CSV data in a preview table.
     */
    const showDataPreview = (csvText) => {
        try {
            const lines = csvText.split(/[\r\n]+/).filter(Boolean);
            const rows = lines.slice(0, 6); // Header + max 5 data rows
            if (rows.length < 2) {
                dataPreviewContainer.classList.add("hidden");
                return;
            }

            const headers = getHeadersFromText(rows[0]);
            let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
            headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            rows.slice(1).forEach((line, rowIndex) => {
                let cells = line.split(',');
                if (cells.length !== headers.length) cells = line.split(';');
                if (cells.length !== headers.length) cells = line.split('\t');

                tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    const cellValue = cells[cellIndex]?.trim().replace(/^"|"$/g, '') ?? '';
                    tableHTML += `<td class="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title="${cellValue}">${cellValue}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
            previewTable.innerHTML = tableHTML;
            dataPreviewContainer.classList.remove("hidden");
        } catch (e) {
            console.error("Error showing data preview:", e);
            dataPreviewContainer.classList.add("hidden");
        }
    };

    /**
     * Updates the Target column dropdown. Assumes first header is date column.
     */
    const updateColumnSelects = (headers) => {
        fullHeaders = headers;
        targetColumnSelect.innerHTML = '<option value="">Select target variable...</option>';
        assumedDateColumn = null;

        if (headers.length === 0) {
            targetColumnSelect.innerHTML = '<option value="">-- No columns found --</option>';
            targetColumnSelect.disabled = true;
            if (assumedDateColNameSpan) assumedDateColNameSpan.textContent = "N/A";
            return;
        }

        assumedDateColumn = headers[0]; // Assume first column is date
        if (assumedDateColNameSpan) assumedDateColNameSpan.textContent = assumedDateColumn;

        let potentialTargetCol = null;

        // Populate target dropdown (skip first column)
        headers.forEach((header, index) => {
            if (index === 0) return; // Skip the assumed date column

            const optionTarget = new Option(header, header);
            targetColumnSelect.add(optionTarget);

            // Auto-detection logic for TARGET column
            const lowerHeader = header.toLowerCase();
            if (!potentialTargetCol && (lowerHeader.includes('revenue') || lowerHeader.includes('sales') || lowerHeader.includes('value') || lowerHeader.includes('count') || lowerHeader.includes('amount') || lowerHeader.includes('target') || lowerHeader.includes('metric'))) {
                potentialTargetCol = header;
            }
        });

        // Auto-select target or fallback to second column
        if (potentialTargetCol) {
            targetColumnSelect.value = potentialTargetCol;
        } else if (headers.length > 1) {
            targetColumnSelect.value = headers[1];
        }

        targetColumnSelect.disabled = false; // Enable target dropdown
    };

    /**
     * Processes data input, updates preview, and column selections.
     */
    const processDataInput = async (isFileInput) => {
        let textContent = null;
        const errorEl = isFileInput === null ? null : (isFileInput ? fileError : textError);

        // Clear errors and reset UI
        if (fileError) fileError.textContent = "";
        if (textError) textError.textContent = "";
        targetColumnSelect.disabled = true;
        targetColumnSelect.innerHTML = '<option value="">-- Processing data... --</option>';
        dataPreviewContainer.classList.add("hidden");
        previewTable.innerHTML = "";
        fullHeaders = [];
        assumedDateColumn = null;
        if (assumedDateColNameSpan) assumedDateColNameSpan.textContent = "...";

        if (isFileInput === null) { // Reset request
            targetColumnSelect.innerHTML = '<option value="">-- Upload data first --</option>';
            if (assumedDateColNameSpan) assumedDateColNameSpan.textContent = "N/A";
            return;
        }

        try {
            // Get data content
            if (isFileInput) {
                const file = fileInput.files[0];
                if (!file) return;
                textContent = await extractTextFromFile(file);
            } else {
                textContent = textInput.value;
                if (!textContent.trim()) return;
            }

            // Extract headers
            const headers = getHeadersFromText(textContent);

            // Basic Validation
            const lines = textContent.split(/[\r\n]+/).filter(Boolean);
            if (lines.length < 10) {
                if (errorEl) errorEl.textContent = "Warning: Small dataset (<10 rows). Forecasting might be unreliable.";
            } else {
                if (errorEl) errorEl.textContent = "";
            }

            // Update UI
            showDataPreview(textContent);
            updateColumnSelects(headers); // Calls the modified function

        } catch (err) {
            // Handle errors
            console.error("Input processing failed:", err);
            if (errorEl) errorEl.textContent = `Error: ${err.message}. Please check data format/content.`;
            targetColumnSelect.disabled = true;
            targetColumnSelect.innerHTML = '<option value="">-- Error reading data --</option>';
            dataPreviewContainer.classList.add("hidden");
            if (assumedDateColNameSpan) assumedDateColNameSpan.textContent = "Error";
        }
    };

    // --- Attach Event Listeners ---

    // Example button listener
    if (examplesBtn && examplesDiv) {
        examplesBtn.addEventListener("click", () => {
            const isHidden = examplesDiv.classList.toggle("hidden");
            examplesBtn.textContent = isHidden ? "View Examples" : "Hide Examples";

            if (!isHidden) {
                const exampleContent = dom.$("predictiveExampleContent");
                if (exampleContent && exampleContent.textContent === "Loading example...") {
                    exampleContent.innerHTML = `
                        <div class="text-xs font-medium text-white/90 mb-2">📊 Data Format Examples</div>
                        <div class="space-y-2 text-xs">
                             <div>
                                <div class="text-white/80 mb-1">Time Series Data (CSV):</div>
                                <pre class="bg-black/30 p-2 rounded font-mono text-white/90 text-xs whitespace-pre-wrap overflow-x-auto">Date,Revenue\n2023-01-01,150000\n2023-02-01,162000\n2023-03-01,175000</pre>
                            </div>
                            <div class="text-white/60 text-xs mt-2 space-y-1">
    <div>• <strong>Minimum:</strong> 24 data points (2 years monthly data)</div>
    <div>• <strong>Recommended:</strong> 36+ data points (3+ years monthly data)</div>
    <div>• <strong>Optimal:</strong> 60+ data points (5+ years monthly data)</div>
    <div>• First column must be the Date/Time column</div>
    <div>• Use clear, simple column names (no spaces/symbols)</div>
    <div>• Ensure date column is consistently formatted (e.g., YYYY-MM-DD)</div>
    <div>• Target variable column must contain only numbers</div>
</div>

<!-- Model Types Guide -->
<div class="mt-4 p-3 bg-white/5 rounded border border-white/10">
    <h4 class="text-sm font-medium mb-3 text-blue-300">Model Types & Data Patterns</h4>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="space-y-2">
            <div class="p-2 bg-blue-900/20 rounded border-l-2 border-blue-400">
                <div class="font-medium text-blue-300">Linear Regression</div>
                <div class="text-white/70">Best for: Steady growth or decline</div>
                <div class="text-white/50">Examples: Subscription revenue, planned expansion</div>
            </div>
            
            <div class="p-2 bg-yellow-900/20 rounded border-l-2 border-yellow-400">
                <div class="font-medium text-yellow-300">Seasonal Forecast</div>
                <div class="text-white/70">Best for: Repeating cycles</div>
                <div class="text-white/50">Examples: Retail sales, tourism, energy usage</div>
            </div>
        </div>
        
        <div class="space-y-2">
            <div class="p-2 bg-red-900/20 rounded border-l-2 border-red-400">
                <div class="font-medium text-red-300">Simple Trend</div>
                <div class="text-white/70">Best for: Stable operations</div>
                <div class="text-white/50">Examples: Mature markets, utility bills</div>
            </div>
            
            <div class="p-2 bg-green-900/20 rounded border-l-2 border-green-400">
                <div class="font-medium text-green-300">Auto-Select (Recommended)</div>
                <div class="text-white/70">Best for: Mixed or unknown patterns</div>
                <div class="text-white/50">Automatically chooses the best model</div>
            </div>
        </div>
    </div>
</div>
                        </div>`;
                }
            }
        });
    }

    // Input type toggle listeners
    if (fileToggle && textToggle && fileArea && textArea) {
        fileToggle.addEventListener("change", () => {
            if (fileToggle.checked) {
                fileArea.classList.remove("hidden");
                textArea.classList.add("hidden");
                processDataInput(fileInput.files.length > 0 ? true : null);
            }
        });
        textToggle.addEventListener("change", () => {
            if (textToggle.checked) {
                fileArea.classList.add("hidden");
                textArea.classList.remove("hidden");
                processDataInput(textInput.value.trim() ? false : null);
            }
        });
    }

    // File input change listener
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const label = dom.$("predictiveFileLabel");
            const fileNameSpan = label ? label.querySelector(".file-name") : null;
            if (fileNameSpan) {
                if (fileInput.files.length > 0) {
                    fileNameSpan.textContent = fileInput.files[0].name;
                    if (label) label.classList.add("has-file");
                    processDataInput(true);
                } else {
                    fileNameSpan.textContent = "Select data file...";
                    if (label) label.classList.remove("has-file");
                    processDataInput(null);
                }
            }
        });
    }

    // Text input 'blur' listener
    if (textInput) {
        textInput.addEventListener("blur", () => {
            if (textArea && !textArea.classList.contains("hidden")) {
                processDataInput(textInput.value.trim() ? false : null);
            }
        });
    }

    // Generate button listener -> Calls the main router function
    if (generateBtn) {
        generateBtn.removeEventListener("click", handleGenerate); // Ensure only one listener
        generateBtn.addEventListener("click", handleGenerate);
    }

    // Save button listeners
    const savePdfBtn = dom.$("savePdfBtn");
    const saveDocxBtn = dom.$("saveDocxBtn");
    if (savePdfBtn) savePdfBtn.removeEventListener("click", handleSaveAsPdf);
    if (saveDocxBtn) saveDocxBtn.removeEventListener("click", handleSaveAsDocx);
    reattachActionListeners(); // Use your global function to attach listeners

    // --- 3. Initial State & Cache Handling ---
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        // Re-initialize Plotly charts from cached HTML
        setTimeout(() => {
            const charts = dom.$("analysisResult").querySelectorAll('.plotly-chart');
            charts.forEach(chartDiv => {
                if (chartDiv.layout && typeof Plotly !== 'undefined') { // Check if it's a Plotly chart
                    try {
                        Plotly.Plots.resize(chartDiv);
                        console.log(`Resized cached chart ${chartDiv.id}`);
                    } catch (e) {
                        console.error(`Error resizing cached chart ${chartDiv.id}:`, e);
                    }
                }
            });
        }, 150);
    } else {
        // Default placeholder
        dom.$("analysisResult").innerHTML = '<div class="text-white/60 p-8 text-center">Upload your data (ensuring the first column is the date/time) and configure options to generate a forecast.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }
    // Attach listener for the feedback link
    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
                e.preventDefault();
            
            // This just calls the navigateTo function.
            // It relies on your main `MapsTo` function to be
            // the *simplified one* (without memory logic)
            // and your `submitFeedbackPageBtn` listener
            // to be the *simplified one* (that just goes home).
                if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createPredictiveAnalysisLayout");
    }

}



function createPrescriptiveLayout_DA(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Analysis Setup</h3>
                        <div class="space-y-4">
                            <div>
                                <label for="prescriptiveGoal" class="block text-sm font-medium text-gray-200 mb-2">Business Goal</label>
                                <textarea id="prescriptiveGoal" class="input-field h-24" placeholder="Describe the business outcome you want to achieve. Example: 'Increase customer retention by 15% in the next quarter.'"></textarea>
                            </div>
                            <div>
                                <label for="prescriptiveFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Data File (.csv)</label>
                                <div class="input-file-wrapper">
                                    <label for="prescriptiveFile" id="prescriptiveFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .csv file...</span>
                                    </label>
                                    <input type="file" id="prescriptiveFile" class="input-file" accept=".csv">
                                </div>
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText"> prescribe Actions</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Prescriptive Analysis Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("prescriptiveFile", "prescriptiveFileLabel", null, null);

    // Attach listener for the feedback link
    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
            e.preventDefault();
            
            // This just calls the navigateTo function.
            // It relies on your main `MapsTo` function to be
            // the *simplified one* (without memory logic)
            // and your `submitFeedbackPageBtn` listener
            // to be the *simplified one* (that just goes home).
            if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createPrescriptiveLayout_DA");
    }
}



/**
 * --- UPDATED (V15 - Final Fix) ---
 * Creates the layout for the Visualization tool.
 * --- USER REQUESTED FORMATTING UPDATE V3 ---
 * - Added "Download Sample .txt" link next to the CSV link.
 */
function createVisualizationLayout_DA(template) {
    // Helper function to safely get element
    function safeGetElement(id) {
        try {
                return document.getElementById(id);
        } catch (e) {
            console.error("Error getting element:", id, e);
            return null;
        }
    }
    
    const contentContainer = safeGetElement("templateDetailContent");
    if (!contentContainer) {
        console.error("Content container not found");
        return;
    }
    
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    
    const htmlContent = [
        '<div class="lg:col-span-1">',
        '<h1 class="text-4xl font-bold text-center mb-2">' + (template.title || 'Visualization') + '</h1>',
        '<p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">' + (template.description || '') + '</p>',
        '<div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">',
        
        // --- CHANGED BLOCK START ---
        // Added the "Download Sample .txt" link here
        '<div class="flex items-center justify-between mb-2">',
        '<h3 class="text-xl font-bold text-white">Visualization Setup</h3>',
        '<div class="flex items-center space-x-2">', 
            '<button type="button" id="vizConfigExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>',
            // Added the new .txt link
            '<a href="data-files/visualization/visualization-sample-doc.txt" download="Visualization_Sample_Doc.txt" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .txt</a>',
            '<a href="data-files/visualization/visualization-sample.csv" download="Visualization_Sample_Data.csv" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .csv</a>',
        '</div>',
        '</div>',
        // --- CHANGED BLOCK END ---
        
        // --- Good vs. Bad Examples ---
        '<div id="vizConfigExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">',
        '<div class="text-xs font-medium text-white/90 mb-3">📋 How to Get the Best Results</div>',
        // Good Example
        '<div class="mb-4">', 
        '<div class="flex items-center mb-2">',
        '<span class="text-green-400 mr-2">✅</span>',
        '<span class="text-sm font-medium text-green-400">GOOD EXAMPLE</span>',
        '<span class="text-xs text-white/60 ml-2">(Results in relevant, accurate charts)</span>',
        '</div>',
        '<div class="bg-green-900/20 border border-green-500/30 rounded p-3">',
        '<div class="text-xs text-white/90 mb-2"><strong>Context Text (Your Request):</strong></div>',
        '<div class="text-xs text-white/80 mb-3">',
        '"Show me the sales revenue trend over time. Also, how does marketing spend correlate with sales revenue? And which product category has the highest total sales?"',
        '</div>',
        '<div class="text-xs text-white/90 mb-2"><strong>CSV Data (Snippet):</strong></div>',
        '<div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">',
        'Date,Region,Marketing_Spend,Sales_Revenue,Product_Category<br>',
        '2024-01-01,North,5000,78500,Electronics<br>',
        '2024-02-01,North,5200,79200,Apparel<br>',
        '2024-03-01,West,7100,107000,Home Goods',
        '</div>',
        '</div>',
        '</div>',
        // MODIFIED: Bad Example (with annotations)
        '<div class="mb-4">',
        '<div class="flex items-center mb-2">',
        '<span class="text-red-400 mr-2">❌</span>',
        '<span class="text-sm font-medium text-red-400">BAD EXAMPLE</span>',
        '<span class="text-xs text-white/60 ml-2">(Results in generic, unhelpful charts)</span>',
        '</div>',
        '<div class="bg-red-900/20 border border-red-500/30 rounded p-3">',
        '<div class="text-xs text-white/80 mb-3">',
        '<strong>Context Text:</strong> "Here\'s my data. Show me charts. I want to see what\'s happening." <span class="text-red-300 italic text-xs">(Vague, not specific)</span>',
        '</div>',
        '<div class="text-xs text-white/90 mb-2"><strong>CSV Data (Snippet):</strong></div>',
        '<div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">',
        'Date,Sales,Marketing ($),Region<br>',
        'Jan 1, "$5,000", "100", N/A <span class="text-red-300 italic text-xs">(Messy data: $, commas, inconsistent dates)</span><br>',
        'Feb 1, "$6,200", "120", North<br>',
        'Mar 1, "7000", "110", West',
        '</div>',
        '</div>',
        '</div>',
        '<div class="border-t border-white/20 pt-3">',
        '<div class="text-xs font-medium text-white/90 mb-2">💡 How to Write Your Request:</div>',
        '<div class="text-xs text-white/80 space-y-1">',
        '<div>• <strong>Be specific:</strong> Ask clear questions (e.g., "correlate X and Y," "show trend of Z").</div>',
        '<div>• <strong>Clean your data:</strong> Ensure numbers are just numbers (no $, %, or commas).</div>',
        '<div>• <strong>Use clean headers:</strong> Use simple column names (e.g., Marketing_Spend not Marketing ($)).</div>',
        '</div>',
        '</div>',

        // --- MOVED BLOCK START ---
        // The Data Requirements Checklist is now inside the "vizConfigExamples" div
        '<div class="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">',
        '<div class="mb-2">',
            '<h4 class="text-sm font-medium text-blue-300">📋 Data Requirements Checklist</h4>',
        '</div>',
        '<ul class="list-disc list-inside text-xs text-white/80 space-y-1">',
        '<li><strong>File Format:</strong> CSV (UTF-8 encoded).</li>',
        '<li><strong>Headers:</strong> Must be in the **first row**. Use simple names (e.g., `Sales_Revenue`, not `Sales ($)`).</li>',
        '<li><strong>Numbers:</strong> Must be **numbers only** (no $, ,, or % symbols).</li>',
        '<li><strong>Dates:</strong> Must be in a **consistent format** (e.g., YYYY-MM-DD or MM/DD/YYYY).</li>',
        '<li><strong>Categorical:</strong> Must have **consistent spelling** (e.g., "North", not "North" and "N.").</li>',
        '<li><strong>Data Quality:</strong> Check for missing values (nulls) or extreme outliers.</li>',
        '<li><strong>Limits:</strong> Recommended 30-50+ rows for reliable insights. Max file size ~5MB.</li>',
        '</ul>',
        '</div>',
        // --- MOVED BLOCK END ---

        '</div>',
        // --- End Examples Div ---

        '<div class="space-y-4">',
        '<div>',
        '<label for="vizRequest" class="block text-sm font-medium text-gray-200 mb-2">What do you want to visualize? (This is your context)</label>',
        '<textarea id="vizRequest" class="input-field h-24" placeholder="Be specific. For example: \'Show the relationship between Marketing Spend and Sales Revenue\', or \'Visualize the distribution of customer ages by product category.\'"></textarea>',
        '</div>',
        '<div>',
        '<label for="vizFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Data File (.csv)</label>',
        '<div class="input-file-wrapper">',
        '<label for="vizFile" id="vizFileLabel" class="input-file-btn">',
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16">',
        '<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>',
        '<path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>',
        '</svg>',
        '<span class="file-name">Select .csv file...</span>',
        '</label>',
        '<input type="file" id="vizFile" class="input-file" accept=".csv">',
        '</div>',
        '<div id="vizFileError" class="text-red-400 text-sm mt-2"></div>',
        '</div>',
        '</div>',

        // --- Column Guidance (V10) ---
        '<details class="styled-details text-sm mt-4">',
            '<summary class="font-semibold">View Column Guidance (using sample data)</summary>',
            '<div class="bg-black/20 p-4 rounded-b-lg space-y-3 text-xs text-white/80">',
                '<div>',
                    '<h5 class="font-semibold text-white mb-1">Sales & Marketing Analysis:</h5>',
                    '<p>• `Date`, `Sales_Revenue` (number), `Marketing_Spend` (number), `Region` (text), `Product_Category` (text)</p>',
                '</div>',
                '<div>',
                    '<h5 class="font-semibold text-white mb-1">Customer & Product Analysis:</h5>',
                    '<p>• `Date`, `Customer_Satisfaction` (number), `Region` (text), `Product_Category` (text), `Sales_Revenue` (number)</p>',
                '</div>',
            '</div>',
        '</details>',

        '<div id="vizDataQualityWarning" class="hidden error-message p-3 text-sm mt-4"></div>',
        '<div id="vizDataPreview" class="hidden space-y-2 mt-4">',
        '<label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>',
        '<div class="overflow-x-auto rounded-lg border border-white/20">',
        '<table class="min-w-full text-left text-sm text-white/90" id="vizPreviewTable">',
        '</table>',
        '</div>',
        '</div>',
        '<button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">',
        '<span id="generateBtnText">📊 Generate Visualizations</span>',
        '<span id="generateSpinner" class="loading-spinner hidden ml-2"></span>',
        '</button>',
        
        // --- Feedback Link (V12) ---
        '<div class="text-center mt-4">',
        '<a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>',
        '</div>',

        '</div>', // This closes <div class="glass-container ...
        '<div class="mt-12">',
        '<h2 class="text-3xl font-bold mb-4 text-center">Data Visualizations</h2>',
        '<div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>',
        '<div id="analysisActions" class="text-center mt-4 space-x-2 hidden">',
        '<button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>',
        '<button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>',
        '</div>',
        '</div>',
        '</div>',
    ].join('');
    
    contentContainer.innerHTML = htmlContent;

    // --- Helper functions for preview (V9) ---
    const getHeadersFromText = (text) => {
        const firstLine = text.split(/[\r\n]+/)[0];
        let headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split(';').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split('\t').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length === 0) throw new Error("Could not parse headers.");
        return headers;
    };

    const showDataPreview = (csvText) => {
        const previewContainer = safeGetElement("vizDataPreview");
        const previewTable = safeGetElement("vizPreviewTable");
        const qualityWarning = safeGetElement("vizDataQualityWarning");
        if (!previewContainer || !previewTable || !qualityWarning) return;

        let warnings = [];

        try {
            const lines = csvText.split(/[\r\n]+/).filter(line => line.trim() !== '');
            const rows = lines.slice(0, 6); 
            
            // --- Your Data Quality Logic ---
            const dataRowCount = lines.length - 1;
            if (dataRowCount < 30) {
                warnings.push(`Insufficient data for reliable visualization (only ${dataRowCount} rows).`);
            } else if (dataRowCount < 50) {
                warnings.push(`Limited dataset (${dataRowCount} rows). Basic charts only.`);
            }
            // --- END Your Logic ---

            if (rows.length < 2) {
                previewContainer.classList.add("hidden");
                if(dataRowCount === 0) {
                    warnings.push("File appears to be empty or missing data rows.");
                }
            } else {
                const headers = getHeadersFromText(rows[0]);
                let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
                headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
                tableHTML += '</tr></thead><tbody>';

                let nullCount = 0;
                let messyDataCount = 0;

                rows.slice(1).forEach((line, rowIndex) => {
                    let cells = line.split(',');
                    if (cells.length !== headers.length) cells = line.split(';');
                    if (cells.length !== headers.length) cells = line.split('\t');

                    tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                    headers.forEach((_, cellIndex) => {
                        const cellValue = cells[cellIndex]?.trim() ?? '';
                        let displayValue = cellValue;
                        
                        if (cellValue === '' || cellValue.toLowerCase() === 'null' || cellValue.toLowerCase() === 'na') {
                            nullCount++;
                            displayValue = `<span class="text-yellow-400 italic" title="Null/Missing Value">NULL</span>`;
                        } else if (/[$,%"]/.test(cellValue) && !isNaN(parseFloat(cellValue.replace(/[$,%"]/g, '')))) {
                            messyDataCount++;
                            displayValue = `<span class="text-orange-400" title="Messy Data (contains symbols)">${cellValue}</span>`;
                        }

                        tableHTML += `<td class="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title="${cellValue}">${displayValue}</td>`;
                    });
                    tableHTML += '</tr>';
                });
                tableHTML += '</tbody>';
                previewTable.innerHTML = tableHTML;
                previewContainer.classList.remove("hidden");

                if (nullCount > 0) {
                    warnings.push(`Spotted ${nullCount} missing values (NULL) in the preview.`);
                }
                if (messyDataCount > 0) {
                    warnings.push(`Spotted ${messyDataCount} numerical values with symbols ($, %, etc.). Please clean the data.`);
                }
            }

            // Display warnings
            if (warnings.length > 0) {
                qualityWarning.innerHTML = "<strong>⚠️ Data Quality Warnings:</strong><ul class='list-disc list-inside mt-1'>" + warnings.map(w => `<li>${w}</li>`).join('') + "</ul>";
                qualityWarning.classList.remove("hidden");
            } else {
                qualityWarning.classList.add("hidden");
            }

        } catch (e) {
            console.error("Error showing data preview:", e);
            previewContainer.classList.add("hidden");
            qualityWarning.textContent = `Error during preview: ${e.message}`;
            qualityWarning.classList.remove("hidden");
        }
    };
    // --- END HELPERS ---
    
    // --- Attaching Event Listeners ---
    setTimeout(function() {
        try {
            // 1. Examples toggle
            const examplesBtn = safeGetElement("vizConfigExamplesBtn");
            const examplesDiv = safeGetElement("vizConfigExamples");
            if (examplesBtn && examplesDiv) {
                examplesBtn.addEventListener("click", function() {
                    const isHidden = examplesDiv.classList.toggle("hidden");
                    examplesBtn.textContent = isHidden ? "View Examples" : "Hide Examples";
                });
            }

            // 2. File input handler
            const fileInput = safeGetElement("vizFile");
            const fileLabel = safeGetElement("vizFileLabel");
            const fileError = safeGetElement("vizFileError");

            if (fileInput && fileLabel && fileError) {
                fileInput.addEventListener("change", async function(e) {
                    const fileNameSpan = fileLabel.querySelector(".file-name");
                    const qualityWarning = safeGetElement("vizDataQualityWarning");
                    const previewContainer = safeGetElement("vizDataPreview");

                    fileError.textContent = "";
                    qualityWarning.classList.add("hidden");
                    previewContainer.classList.add("hidden");

                    if (fileNameSpan) {
                        if (e.target.files.length > 0) {
                            const file = e.target.files[0];
                            fileNameSpan.textContent = file.name;
                            fileLabel.classList.add("has-file");
                            
                            try {
                                if (typeof Papa === 'undefined') {
                                    throw new Error("CSV parsing library (PapaParse) not loaded.");
                                }
                                const text = await extractTextFromFile(file);
                                showDataPreview(text); 
                            } catch (err) {
                                fileError.textContent = `Error reading file: ${err.message}`;
                                previewContainer.classList.add("hidden");
                                qualityWarning.classList.add("hidden");
                            }
                        } else {
                            fileNameSpan.textContent = "Select .csv file...";
                            fileLabel.classList.remove("has-file");
                        }
                    }
                });
            }

            // 3. Generate button handler
            const generateBtn = safeGetElement("generateBtn");
            if (generateBtn && typeof handleGenerate === 'function') {
                generateBtn.addEventListener("click", handleGenerate);
            }

            // 4. Save button listeners
            if (typeof reattachActionListeners === 'function') {
                reattachActionListeners();
            }

            // 5. Handle analysis cache
            const analysisResult = safeGetElement("analysisResult");
            const analysisActions = safeGetElement("analysisActions");
            
            if (analysisResult && analysisActions) {
                if (typeof appState.analysisCache !== 'undefined' && 
                    typeof appState.currentTemplateId !== 'undefined' && 
                    appState.analysisCache[appState.currentTemplateId]) {
                    
                    analysisResult.innerHTML = appState.analysisCache[appState.currentTemplateId];
                    analysisActions.classList.remove("hidden");
                    
                    if (typeof reattachTabListeners === 'function') {
                        reattachTabListeners(analysisResult);
                    }
                    
                    setTimeout(() => {
                        const chartsInPanel = analysisResult.querySelectorAll('.plotly-chart');
                        chartsInPanel.forEach(chartDiv => {
                            if (chartDiv.layout && typeof Plotly !== 'undefined') {
                                try { Plotly.Plots.resize(chartDiv); } catch (resizeError) { console.error(`Error resizing cached chart ${chartDiv.id}:`, resizeError); }
                            }
                        });
                    }, 150);

                } else {
                    analysisResult.innerHTML = 
                        '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
                    analysisActions.classList.add("hidden");
                }
            }
            
            // --- THIS IS THE FIX ---
            // 6. Attach listener for the feedback link
            const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
            if (feedbackLink) {
                feedbackLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    
                    // This just calls the navigateTo function.
                    // It relies on your main `MapsTo` function to be
                    // the *simplified one* (without memory logic)
                    // and your `submitFeedbackPageBtn` listener
                    // to be the *simplified one* (that just goes home).
                    if (typeof navigateTo === 'function') {
                        navigateTo('feedback');
                    } else {
                        console.error("navigateTo function is not defined.");
                    }
                });
            } else {
                console.warn("Feedback link not found inside createVisualizationLayout_DA");
            }
            // --- END FIX ---


        } catch (error) {
            console.error("Error setting up visualization layout:", error);
        }
    }, 100);
}



function createRegressionLayout_DA(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
    
                <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xl font-bold text-white">Analysis Setup</h3>
                            <div class="flex items-center space-x-2">
                                <button type="button" id="regressionExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                                <a href="data-files/regression/regression-sample-doc.txt" download="Regression_Sample_Doc.txt" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .txt</a>
                                <a href="data-files/regression/regression-sample.csv" download="Regression_Sample_Data.csv" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .csv</a>
                            </div>
                        </div>

                        <div id="regressionExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">
                            <div id="regressionExampleContent" class="text-white/80">Loading example...</div>
                        </div>

                        <div class="space-y-4">
                            
                            <div>
                                <label for="regressionContextFile" class="block text-sm font-medium text-gray-200 mb-2">Company Document (Optional)</label>
                                <div class="input-file-wrapper">
                                    <label for="regressionContextFile" id="regressionContextFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi 
bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select context document...</span>
                                    </label>
                                    <input type="file" id="regressionContextFile" class="input-file" accept=".txt,.docx">
                            </div>
                            </div>
                            
                            <div>
                                <label for="regressionFile" class="block text-sm font-medium text-gray-200 mb-2" title="Must be a .csv file. All columns for analysis must be numeric. Ensure no spaces in headers (e.g., use 'Marketing_Spend').">
                                    Upload Data File (.csv)
                                </label>
                                <div class="input-file-wrapper">
                                    <label for="regressionFile" id="regressionFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .csv data file...</span>
                                    </label>
                                    <input type="file" id="regressionFile" class="input-file" accept=".csv">
                                </div>
                                <div id="regressionFileError" class="text-red-400 text-sm mt-2"></div>
                                <div id="regressionDataWarning" class="text-yellow-400 text-sm mt-2"></div>
                            </div>

                            <div id="regressionDataPreview" class="space-y-2">
                                <label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>
                                <div class="overflow-x-auto rounded-lg border border-white/20">
                                    <table class="min-w-full text-left text-sm text-white/90" id="regressionPreviewTable">
                                        <tbody>
                                            <tr>
                                                <td class="p-4 text-center text-white/60" colspan="100%">Upload a .csv file to see a preview.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <label for="dependentVar" class="block text-sm font-medium text-gray-200 mb-2" title="This is the 'outcome' variable you want to predict (e.g., 'Sales'). It must be numeric.">
                                    Dependent Variable (Y)
                                </label>
                                <div class="select-wrapper">
                                    <select id="dependentVar" class="input-field" disabled>
                                        <option value="">-- Upload data to see variables --</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-200 mb-2" title="These are the 'predictor' variables you think influence your outcome (e.g., 'Marketing_Spend', 'Website_Traffic'). They must be numeric.">
                                    Independent Variables (X)
                                </label>
                                <div id="independentVarsContainer" class="max-h-40 overflow-y-auto space-y-1 p-3 bg-black/20 rounded-lg border border-white/20">
                                    <p class="text-sm text-white/60 text-center">-- Upload data to see variables --</p>
                                </div>
                            </div>

                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                                <span id="generateBtnText">📈 Run Regression Analysis</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                        <div class="text-center mt-4">
                                <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
                
    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Regression Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            
<button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;

    // --- All Helper Functions are LOCAL to this function ---

    const getHeadersFromText = (text) => {
        if (!text || typeof text !== 'string' || !text.trim()) throw new Error("Input text is empty.");
        const firstLine = text.split(/[\r\n]+/)[0];
        if (!firstLine || !firstLine.trim()) throw new Error("First line (header) is empty.");

        let headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split(';').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split('\t').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length === 0) throw new Error("Could not parse headers (tried comma, semicolon, tab).");
        return headers;
    };
    
    const showDataPreview = (csvText, tableId, containerId) => {
        const previewContainer = dom.$(containerId);
        const previewTable = dom.$(tableId);
        if (!previewContainer || !previewTable) return;

        try {
            const lines = csvText.split(/[\r\n]+/).filter(Boolean); 
            const rows = lines.slice(0, 6); 
            
            if (rows.length < 2) { 
                previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Data file is empty or has no data rows.</td></tr></tbody>';
                previewContainer.classList.remove("hidden"); 
                return; 
            }

            const headers = getHeadersFromText(rows[0]);
            let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
            headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            rows.slice(1).forEach((line, rowIndex) => {
                let cells = line.split(',');
                if (cells.length !== headers.length) cells = line.split(';');
                if (cells.length !== headers.length) cells = line.split('\t');

                tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    tableHTML += `<td class="px-4 py-2">${cells[cellIndex] === undefined ? '' : cells[cellIndex]}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
            previewTable.innerHTML = tableHTML;
            previewContainer.classList.remove("hidden");
        } catch (e) {
            console.error("Error showing data preview:", e);
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            previewContainer.classList.remove("hidden");
        }
    };

    /**
     * --- MODIFIED HELPER FUNCTION ---
     * Populates variable selectors and adds event listeners
     * to prevent Y/X conflicts and check data ratios.
     */
    const updateRegressionVariables = (headers) => {
        const dependentSelect = dom.$("dependentVar");
        const independentContainer = dom.$("independentVarsContainer");
        const errorEl = dom.$("regressionFileError"); // Get the error element
        if (!dependentSelect || !independentContainer || !errorEl) return;

        dependentSelect.innerHTML = ''; 
        independentContainer.innerHTML = ''; 
        errorEl.textContent = ""; // Clear errors

        let dependentFound = false;
        const excludePatterns = ['id', 'date', 'time', 'timestamp', 'index', 'row'];
        
        headers.forEach((header, index) => {
            const option = new Option(header, header);
            dependentSelect.add(option);

            const checkboxHtml = `
                <label class="flex items-center space-x-2 text-sm text-white/90 p-1.5 rounded hover:bg-white/10">
                    <input type="checkbox" class="method-checkbox independent-var-checkbox" value="${header}">
                    <span>${header}</span>
                </label>`;
            independentContainer.innerHTML += checkboxHtml;

            if (!dependentFound && !excludePatterns.some(pattern => header.toLowerCase().includes(pattern))) {
                dependentSelect.value = header;
                dependentFound = true;
            }
        });

        if (!dependentFound && headers.length > 0) {
                dependentSelect.value = headers[0];
        }

        const allCheckboxes = independentContainer.querySelectorAll('.independent-var-checkbox');

        // --- NEW: Function to sync checkbox states ---
        const syncCheckboxes = () => {
            const selectedDependent = dependentSelect.value;
            errorEl.textContent = ""; // Clear any previous errors on change

            allCheckboxes.forEach(cb => {
                if (cb.value === selectedDependent) {
                    cb.checked = false;
                    cb.disabled = true;
                } else {
                    cb.disabled = false;
                }
            });
            // Trigger a change event on the container to re-run ratio check
            independentContainer.dispatchEvent(new Event('change'));
        };
        
        // --- Initial Checkbox State ---
        const initialSelectedDependent = dependentSelect.value;
        allCheckboxes.forEach(cb => {
            if (cb.value === initialSelectedDependent) {
                cb.checked = false;
                cb.disabled = true;
            } else if (!excludePatterns.some(pattern => cb.value.toLowerCase().includes(pattern))) {
                cb.checked = true;
            } else {
                cb.checked = false; 
            }
        });
        // --- End Initial State ---


        // --- Add Event Listeners ---
        
        // 1. When Dependent var changes, disable/uncheck matching independent var
        dependentSelect.removeEventListener('change', syncCheckboxes); // Avoid duplicates
        dependentSelect.addEventListener('change', syncCheckboxes);

        // 2. When Independent var is checked, check ratio
        independentContainer.removeEventListener('change', handleIndepChange); // Avoid duplicates
        independentContainer.addEventListener('change', handleIndepChange);
        
        function handleIndepChange(e) {
            // Only run if a checkbox was clicked (or event was dispatched)
            if (e.target.matches('.independent-var-checkbox') || e.type === 'change') {
                
                // Clear the general data warning (from file upload)
                const warningEl = dom.$("regressionDataWarning");
                if (warningEl) warningEl.textContent = "";

                // Check ratio and show warning *in the error field*
                const numFeatures = independentContainer.querySelectorAll('.independent-var-checkbox:checked').length;
                const numObservations = appState.currentRegressionRowCount;
                
                if (numFeatures === 0) {
                    errorEl.textContent = ""; // Clear errors if no features selected
                    return;
                }

                const ratio = numObservations / numFeatures;

                if (numObservations >= 30 && ratio < 10) {
                        errorEl.textContent = `Warning: Data ratio is low (${ratio.toFixed(1)}-to-1). A 10-to-1 ratio (or ${numFeatures * 10} rows) is recommended.`;
                        errorEl.className = "text-yellow-400 text-sm mt-2"; // Make it a yellow warning
                } else if (numObservations < 30) {
                        // This warning is already shown by processDataInput, but good to have
                        errorEl.textContent = `Warning: Insufficient data (${numObservations} rows). 30+ recommended.`;
                        errorEl.className = "text-yellow-400 text-sm mt-2";
                } else {
                        errorEl.textContent = ""; // Clear if ratio is fine
                        errorEl.className = "text-red-400 text-sm mt-2"; // Reset class
                }
            }
        }
        
        dependentSelect.disabled = false;
        // Trigger initial ratio check
        independentContainer.dispatchEvent(new Event('change'));
    };


    /**
     * Processes the uploaded regression data file.
     */
    const processDataInput_Regression = async (file) => {
        const errorEl = dom.$("regressionFileError");
        const warningEl = dom.$("regressionDataWarning"); 
        const dependentSelect = dom.$("dependentVar");
        const independentContainer = dom.$("independentVarsContainer");
        const previewContainer = dom.$("regressionDataPreview");
        const previewTable = dom.$("regressionPreviewTable");
        
        errorEl.textContent = ""; 
        if (warningEl) warningEl.textContent = ""; 

        dependentSelect.disabled = true;
        dependentSelect.innerHTML = '<option value="">-- Processing data... --</option>';
        independentContainer.innerHTML = "";
        
        previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Processing data...</td></tr></tbody>';
        previewContainer.classList.remove("hidden");

        appState.currentRegressionRowCount = 0; // Reset row count
        
        if (!file) {
                dependentSelect.innerHTML = '<option value="">-- Upload data file --</option>';
                independentContainer.innerHTML = '<p class="text-sm text-white/60 text-center">-- Upload data file --</p>';
                previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Upload a .csv file to see a preview.</td></tr></tbody>';
                return;
        }

        try {
            const textContent = await extractTextFromFile(file); 
            const originalHeaders = getHeadersFromText(textContent);

            const lines = textContent.split(/[\r\n]+/).filter(Boolean);
            
            appState.currentRegressionRowCount = lines.length - 1; 

            // --- MODIFIED WARNING LOGIC ---
            if (appState.currentRegressionRowCount < 10) { 
                // Use errorEl for critical file read errors/warnings
                errorEl.textContent = "Warning: Small dataset (<10 rows). Regression will be unreliable.";
                errorEl.className = "text-yellow-400 text-sm mt-2"; // Make it yellow
            } 
            else if (appState.currentRegressionRowCount < 30) {
                // Use warningEl for non-blocking data warnings
                if (warningEl) warningEl.textContent = `Warning: Insufficient data (${appState.currentRegressionRowCount} rows). A minimum of 30 rows is recommended.`;
            }
            // --- END MODIFIED LOGIC ---

            showDataPreview(textContent, 'regressionPreviewTable', 'regressionDataPreview');
            updateRegressionVariables(originalHeaders); // This will trigger the initial ratio check

        } catch (err) {
            console.error("Regression input processing failed:", err);
            errorEl.textContent = `Error: ${err.message}.`;
            errorEl.className = "text-red-400 text-sm mt-2"; // Make it red
            if (warningEl) warningEl.textContent = "";
            dependentSelect.disabled = true;
            dependentSelect.innerHTML = '<option value="">-- Error reading data --</option>';
            independentContainer.innerHTML = '<p class="text-sm text-red-400 text-center">Error reading data.</p>';
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            previewContainer.classList.remove("hidden");
        }
    };

    // --- Attach Event Listeners ---
    
    const examplesBtn = dom.$("regressionExamplesBtn");
    const examplesDiv = dom.$("regressionExamples");
    const exampleContentEl = dom.$("regressionExampleContent");

    if (examplesBtn && examplesDiv && exampleContentEl) {
        examplesBtn.addEventListener("click", () => {
            const isHidden = examplesDiv.classList.toggle("hidden");
            examplesBtn.textContent = isHidden ? "View Examples" : "Hide Examples";

            if (!isHidden && exampleContentEl.textContent === "Loading example...") {
                // Populate with relevant regression example
                exampleContentEl.innerHTML = `
                    <div class="text-xs font-medium text-white/90 mb-2">📋 How to Use Regression Analysis</div>
                    <div class="space-y-2 text-xs">
                        <div class="mb-4">
                            <div class="flex items-center mb-2">
                                <span class="text-green-400 mr-2">✅</span>
                                <span class="text-sm font-medium text-green-400">GOOD EXAMPLE</span>
                                <span class="text-xs text-white/60 ml-2">(Results in clear, significant findings)</span>
                            </div>
                            <div class="bg-green-900/20 border border-green-500/30 rounded p-3">
                                <div class="text-xs text-white/90 mb-2"><strong>CSV Data (Snippet):</strong></div>
                                <div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">
Date,Sales,Marketing_Spend,Website_Traffic,Customer_Service_Calls<br>
2023-01-01,50000,5000,15000,300<br>
2023-02-01,52000,5200,15500,320<br>
2023-03-01,60000,6000,18000,280
                                </div>
                                <div class="text-xs text-white/90 mt-3 mb-1"><strong>Selected Variables:</strong></div>
                                <div class="text-xs text-white/80">
                                    • <strong>Dependent (Y):</strong> Sales<br>
                                    • <strong>Independent (X):</strong> Marketing_Spend, Website_Traffic
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <div class="flex items-center mb-2">
                                <span class="text-red-400 mr-2">❌</span>
                                <span class="text-sm font-medium text-red-400">BAD EXAMPLE</span>
                                <span class="text-xs text-white/60 ml-2">(Results in errors or unreliable findings)</span>
                            </div>
                            <div class="bg-red-900/20 border border-red-500/30 rounded p-3">
                                <div class="text-xs text-white/90 mb-2"><strong>CSV Data (Snippet with issues):</strong></div>
                                <div class="bg-black/30 p-2 rounded font-mono text-xs text-white/90">
Date,Sales,Marketing,Traffic<br>
Jan 1, "$50,000", "$5k", "15,000 visitors"<br>
Feb 1, "$52,000", "$5.2k", "15,500 visitors"
                                </div>
                                <div class="text-xs text-white/90 mt-3 mb-1"><strong>Issues:</strong></div>
                                <div class="text-xs text-red-300 font-medium space-y-1">
                                    <div>• <strong>Non-Numeric Data:</strong> 'Sales' and 'Marketing' columns contain '$' and 'k', which will cause errors. Data must be numbers only (e.g., 50000, 5000).</div>
                                    <div>• <strong>Messy Data:</strong> 'Traffic' column contains text ("visitors") and commas. It should be a clean number (e.g., 15000).</div>
                                    <div>• <strong>Bad Column Names:</strong> 'Marketing Spend' (with a space) is better as 'Marketing_Spend'.</div>
                                </div>
                            </div>
                        </div>

                        <div class="border-t border-white/20 pt-3">
                            <div class="text-xs font-medium text-white/90 mb-2">💡 How to Get the Best Results:</div>
                            <div class="text-xs text-white/80 space-y-1">
                                <div>• <strong>Clean your data first!</strong> All columns used in the analysis (Y and X) must contain **numbers only**.</div>
                                <div>• Remove all text, commas (in numbers), and currency symbols ($, €) from your data columns.</div>
                                <div>• Use clear column names with **no spaces** (e.g., 'Website_Traffic' instead of 'Website Traffic').</div>
                                <div>• Ensure you have enough data (30+ rows recommended).</div>
                            </div>
                        </div>
                    </div>`;
            }
        });
    }
    
    const regressionFileInput = dom.$("regressionFile");
    if (regressionFileInput) {
        regressionFileInput.addEventListener("change", (e) => {
            const label = dom.$("regressionFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
                processDataInput_Regression(e.target.files[0]);
            } else {
                fileNameSpan.textContent = "Select .csv data file...";
                label.classList.remove("has-file");
                processDataInput_Regression(null);
            }
        });
    }
    
    const attachListener = (inputId, labelId) => {
        const fileInput = dom.$(inputId);
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = dom.$(labelId);
                const fileNameSpan = label.querySelector(".file-name");
                if (e.target.files.length > 0) {
                    fileNameSpan.textContent = e.target.files[0].name;
                    label.classList.add("has-file");
                } else {
                    fileNameSpan.textContent = "Select a file...";
                    label.classList.remove("has-file");
                }
            });
        }
    };
    attachListener("regressionContextFile", "regressionContextFileLabel");

    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createRegressionLayout_DA");
    }
}



function createPlsLayout_DA(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">PLS-SEM Model Setup</h3>
                        <div class="space-y-4">
                            <div>
                                <label for="plsMeasurementModel" class="block text-sm font-medium text-gray-200 mb-2">Measurement Model</label>
                                <textarea id="plsMeasurementModel" class="input-field h-32" placeholder="Define latent variables and their indicators. Example:\nBrandImage = BI1, BI2, BI3\nLoyalty = LOY1, LOY2, LOY3"></textarea>
                            </div>
                            <div>
                                <label for="plsStructuralModel" class="block text-sm font-medium text-gray-200 mb-2">Structural Model (Paths)</label>
                                <textarea id="plsStructuralModel" class="input-field h-24" placeholder="Define hypothesized paths between latent variables. Example:\nBrandImage -> Loyalty"></textarea>
                            </div>
                            <div>
                                <label for="plsFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Data File (.csv)</label>
                                <div class="input-file-wrapper">
                                    <label for="plsFile" id="plsFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .csv file...</span>
                                    </label>
                                    <input type="file" id="plsFile" class="input-file" accept=".csv">
                                </div>
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">📊 Run PLS-SEM Analysis</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">PLS-SEM Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;

    setupInputToggle("plsFile", "plsFileLabel", null, null);

    // Attach listener for the feedback link
    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
            e.preventDefault();
            
            // This just calls the navigateTo function.
            // It relies on your main `MapsTo` function to be
            // the *simplified one* (without memory logic)
            // and your `submitFeedbackPageBtn` listener
            // to be the *simplified one* (that just goes home).
            if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createPlsLayout_DA");
    }
}



/**
 * Creates the HTML structure and attaches listeners for the SEM Analysis tool.
 * Includes data preview, model template selection, and split syntax inputs.
 * @param {object} template - Object containing template title and description.
 */
function createSemAnalysisLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout

    // --- HTML Structure ---
    contentContainer.innerHTML = `
        <div class="lg:col-span-1">
            <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
            <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

        <div class="max-w-2xl mx-auto w-full">
            <div class="glass-container p-6 space-y-6">
                
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xl font-bold text-white">Analysis Configuration</h3>
                    <div class="flex items-center space-x-2">
                        <button type="button" id="configExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                        <a href="data-files/sem/sem-sample-data.csv" download="SEM_Sample_Data.csv" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .csv</a>
                    </div>
                </div>

                <div id="configExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">
                    <div class="text-xs font-medium text-white/90 mb-2">📋 Configuration Examples</div>
                    <div class="space-y-2 text-xs">
                        <div id="exampleContent" class="text-white/80">Loading example...</div>
                    </div>
                </div>

                    <div class="input-radio-group">
                        <input type="radio" name="semInputType" id="semInputFileToggle" class="input-radio" checked>
                        <label for="semInputFileToggle" class="input-radio-label">File Upload</label>
                        <input type="radio" name="semInputType" id="semInputTextToggle" class="input-radio">
                        <label for="semInputTextToggle" class="input-radio-label">Paste Text</label>
                    </div>

                    <div id="semFileUploadArea">
                        <label for="semFile" class="block text-sm font-medium text-gray-200 mb-2">Data File (.csv, .xlsx)</label>
                        <div class="input-file-wrapper">
                            <label for="semFile" id="semFileLabel" class="input-file-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                <span class="file-name">Select data file...</span>
                            </label>
                            <input type="file" id="semFile" class="input-file" accept=".csv,.xlsx">
                        </div>
                        <div id="semFileError" class="text-red-400 text-sm mt-2"></div>
                    </div>

                    <div id="semTextInputArea" class="hidden">
                        <label for="semDataText" class="block text-sm font-medium text-gray-200 mb-2">Paste CSV Data</label>
                        <textarea id="semDataText" class="input-field h-48" placeholder="Date,Var1,Var2...\n2023-01-01,10,20..."></textarea>
                        <div id="semTextError" class="text-red-400 text-sm mt-2"></div>
                    </div>

                    <div id="semDataPreview" class="space-y-2">
                        <label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>
                        <div class="overflow-x-auto rounded-lg border border-white/20">
                            <table class="min-w-full text-left text-sm text-white/90" id="semPreviewTable">
                                <tbody>
                                    <tr>
                                        <td class="p-4 text-center text-white/60" colspan="100%">Upload or paste data to see a preview.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <label for="semModelTemplate" class="block text-sm font-medium text-gray-200 mb-2">Model Template</label>
                        <select id="semModelTemplate" class="input-field" disabled>
                            <option value="">-- Upload or paste data first --</option>
                        </select>
                    </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label for="semMeasurementSyntax" class="block text-sm font-medium text-gray-200">Measurement Model Syntax</label>
                        <button type="button" id="measurementExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                    </div>
                    <div id="measurementExamples" class="hidden mb-2 p-3 bg-black/20 border border-white/15 rounded-lg">
                        <div class="text-xs font-medium text-white/90 mb-2">📊 Measurement Model Examples</div>
                        <div class="space-y-2 text-xs">
                            <div>
                                <div class="text-white/80 mb-1">Basic Factor Structure:</div>
                                <div class="bg-black/30 p-2 rounded font-mono text-white/90 relative">
                                    Anxiety =~ anx1 + anx2 + anx3 + anx4<br>Depression =~ dep1 + dep2 + dep3 + dep4
                                </div>
                            </div>
                            <div>
                                <div class="text-white/80 mb-1">With Fixed Loadings:</div>
                                <div class="bg-black/30 p-2 rounded font-mono text-white/90 relative">
                                    Performance =~ 1*perf1 + perf2 + perf3<br>Satisfaction =~ 1*sat1 + sat2 + sat3
                                </div>
                            </div>
                        </div>
                    </div>
                    <textarea id="semMeasurementSyntax" class="input-field h-32" placeholder="e.g., Factor1 =~ varA + varB\nFactor2 =~ varC + varD..."></textarea>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label for="semStructuralSyntax" class="block text-sm font-medium text-gray-200">Structural Model Syntax</label>
                        <button type="button" id="structuralExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                    </div>
                    <div id="structuralExamples" class="hidden mb-2 p-3 bg-black/20 border border-white/15 rounded-lg">
                        <div class="text-xs font-medium text-white/90 mb-2">🔗 Structural Model Examples</div>
                        <div class="space-y-2 text-xs">
                            <div>
                                <div class="text-white/80 mb-1">Simple Regression:</div>
                                <div class="bg-black/30 p-2 rounded font-mono text-white/90 relative">
                                    Performance ~ Motivation + Ability<br>Satisfaction ~ Performance
                                </div>
                            </div>
                            <div>
                                <div class="text-white/80 mb-1">Mediation Model:</div>
                                <div class="bg-black/30 p-2 rounded font-mono text-white/90 relative">
                                    Outcome ~ c*Predictor + b*Mediator<br>Mediator ~ a*Predictor<br><br>indirect := a*b<br>total := c + (a*b)
                                </div>
                            </div>
                        </div>
                    </div>
                    <textarea id="semStructuralSyntax" class="input-field h-32" placeholder="e.g., Factor1 ~ Factor2\nObservedVar ~ Factor1..."></textarea>
                </div>

                    <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                        <span id="generateBtnText">📊 Run SEM Analysis</span>
                        <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                    </button>
                    <div class="text-center mt-4">
                                <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                    </div>
                </div>
            </div>

            <div class="mt-12">
                <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
                <div id="analysisResult" class="glass-container min-h-[300px] overflow-x-auto"> {/* Results will be injected here */} </div>
                <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                    <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                    <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                </div>
            </div>
        </div>`;

// --- Attach Core Event Listeners ---
dom.$("generateBtn").addEventListener("click", handleGenerate); 
reattachActionListeners(); 

// --- Add Example Toggle Event Listeners ---
dom.$("configExamplesBtn").addEventListener("click", function() {
    const exampleDiv = dom.$("configExamples");
    const isHidden = exampleDiv.classList.contains("hidden");
    
    if (isHidden) {
        // Display hardcoded example content immediately
        const exampleContent = dom.$("exampleContent");
        const exampleText = `Date,Performance_Score,Satisfaction_Rating,Quality_Index,Revenue_USD
2023-01-01,85,4.2,8.5,15000
2023-02-01,87,4.4,8.7,16200
2023-03-01,89,4.6,8.9,17500
2023-04-01,82,4.1,8.2,14800
2023-05-01,91,4.8,9.1,18900
2023-06-01,88,4.5,8.8,17200`;

        exampleContent.innerHTML = `
            <div class="bg-black/30 p-2 rounded font-mono text-white/90 text-xs whitespace-pre-wrap">${exampleText}</div>
            <div class="text-white/60 text-xs mt-2 space-y-1">
                <div class="font-medium text-white/80">SEM Data Requirements:</div>
                <div>• <strong>Clean column names:</strong> No spaces, symbols, or special characters (use underscores instead)</div>
                <div>• <strong>Numeric data only:</strong> All measurement variables must be numbers</div>
                <div>• <strong>Sample size:</strong> Minimum 200 rows recommended for reliable results</div>
                <div>• <strong>No missing values:</strong> Complete data for all variables (or <10% missing)</div>
                <div>• <strong>Variable types:</strong> Use meaningful names like Performance_Score, Customer_Satisfaction</div>
                <div>• <strong>Scale consistency:</strong> Use same scale for related measures (e.g., all 1-10 ratings)</div>
            </div>
        `;
    }
    
    exampleDiv.classList.toggle("hidden");
    this.textContent = isHidden ? "Hide Examples" : "View Examples";
});

dom.$("measurementExamplesBtn").addEventListener("click", function() {
    const exampleDiv = dom.$("measurementExamples");
    const isHidden = exampleDiv.classList.contains("hidden");
    exampleDiv.classList.toggle("hidden");
    this.textContent = isHidden ? "Hide Examples" : "View Examples";
});

dom.$("structuralExamplesBtn").addEventListener("click", function() {
    const exampleDiv = dom.$("structuralExamples");
    const isHidden = exampleDiv.classList.contains("hidden");
    exampleDiv.classList.toggle("hidden");
    this.textContent = isHidden ? "Hide Examples" : "View Examples";
});

    // --- Restore Cached Results (if any) ---
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        reattachTabListeners(dom.$("analysisResult")); 
    } else {
        dom.$("analysisResult").innerHTML = '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }

    // --- Get References to SEM-Specific DOM Elements ---
    const fileInput = dom.$("semFile");
    const textInput = dom.$("semDataText");
    const measurementSyntaxBox = dom.$("semMeasurementSyntax");
    const structuralSyntaxBox = dom.$("semStructuralSyntax");
    const fileError = dom.$("semFileError");
    const textError = dom.$("semTextError");
    const fileToggle = dom.$("semInputFileToggle");
    const textToggle = dom.$("semInputTextToggle");
    const fileArea = dom.$("semFileUploadArea");
    const textArea = dom.$("semTextInputArea");
    const dataPreviewContainer = dom.$("semDataPreview");
    const previewTable = dom.$("semPreviewTable");
    const modelTemplateSelect = dom.$("semModelTemplate");
    let fullHeaders = []; 

    // --- SEM Helper Functions (with MODIFICATIONS) ---

    const getHeadersFromText = (text) => {
        if (!text || typeof text !== 'string' || !text.trim()) throw new Error("Input text is empty.");
        const firstLine = text.split(/[\r\n]+/)[0];
        if (!firstLine || !firstLine.trim()) throw new Error("First line (header) is empty.");

        let headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split(';').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length <= 1) headers = firstLine.split('\t').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length === 0) throw new Error("Could not parse headers (tried comma, semicolon, tab).");
        return headers;
    };

    /** === MODIFIED showDataPreview === */
    const showDataPreview = (csvText) => {
        try {
            const lines = csvText.split(/[\r\n]+/).filter(Boolean); 
            const rows = lines.slice(0, 6); 
            
            // === MODIFIED: Show placeholder if file is empty/no rows ===
            if (rows.length < 2) { 
                previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Data file is empty or has no data rows.</td></tr></tbody>';
                dataPreviewContainer.classList.remove("hidden"); 
                return; 
            }

            const headers = getHeadersFromText(rows[0]);
            let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
            headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            rows.slice(1).forEach((line, rowIndex) => {
                let cells = line.split(',');
                if (cells.length !== headers.length) cells = line.split(';');
                if (cells.length !== headers.length) cells = line.split('\t');

                tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    tableHTML += `<td class="px-4 py-2">${cells[cellIndex] === undefined ? '' : cells[cellIndex]}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
            previewTable.innerHTML = tableHTML;
            dataPreviewContainer.classList.remove("hidden"); // Ensure it's visible
        } catch (e) {
            console.error("Error showing data preview:", e);
            // === MODIFIED: Show error in table ===
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            dataPreviewContainer.classList.remove("hidden"); // Ensure it's visible
        }
    };

const updateModelTemplates = (headers) => {
    fullHeaders = headers;
    modelTemplateSelect.innerHTML = '';
    modelTemplateSelect.add(new Option("Select a model template...", ""));
    modelTemplateSelect.add(new Option("Custom Syntax (Type below)", "custom"));
    modelTemplateSelect.add(new Option("Auto-Suggest (Generic Model)", "autosuggest"));
    modelTemplateSelect.disabled = false;
};

    const populateSyntaxBoxes = (fullSyntax) => {
        const uncommentedSyntax = fullSyntax.split('\n')
            .filter(line => !line.trim().startsWith('#'))
            .join('\n');
        const lines = uncommentedSyntax.split('\n');
        let measurement = [], structural = [], foundStructural = false;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            if (trimmedLine.includes('~') && !trimmedLine.includes('=~')) foundStructural = true;
            if (foundStructural) structural.push(line);
            else measurement.push(line);
        });

        measurementSyntaxBox.value = measurement.join('\n').trim();
        structuralSyntaxBox.value = structural.join('\n').trim();
        measurementSyntaxBox.placeholder = measurementSyntaxBox.value ? measurementSyntaxBox.placeholder : "e.g., F1 =~ x1+x2";
        structuralSyntaxBox.placeholder = structuralSyntaxBox.value ? structuralSyntaxBox.placeholder : "e.g., F1 ~ F2";
    };

    const generateRecommendedSyntax = () => {
        const fullSyntax = `
Marketing =~ Ad_Spend_USD + Brand_Awareness_Pct
Profit_USD ~ Marketing + Online_Sales_USD + Retail_Sales_USD`;
        populateSyntaxBoxes(fullSyntax);
    };

const generateSyntax = () => {
    if (fullHeaders.length === 0) { 
        alert("Data headers not found for auto-suggestion."); 
        return; 
    }
    const excludePatterns = ['id', 'date', 'time', 'timestamp', 'index', 'row'];
    const analyticalHeaders = fullHeaders.filter(h => 
        !excludePatterns.some(pattern => h.toLowerCase().includes(pattern))
    );
    if (analyticalHeaders.length < 4) {
        populateSyntaxBoxes(`# Need at least 4 numeric columns for SEM\n# Available: ${analyticalHeaders.join(', ')}\n# Please add more numeric variables to your data`);
        return;
    }
    let measurementPart = '';
    let structuralPart = '';
    measurementPart += `Factor1 =~ ${analyticalHeaders[0]} + ${analyticalHeaders[1]}\n`;
    measurementPart += `Factor2 =~ ${analyticalHeaders[2]} + ${analyticalHeaders[3]}\n`;
    structuralPart = 'Factor2 ~ Factor1\n';
    let fullSyntax = measurementPart.trim() + '\n\n' + structuralPart.trim();
    populateSyntaxBoxes(fullSyntax);
};

    /** === MODIFIED processDataInput === */
    const processDataInput = async (isFileInput) => {
        let textContent = null;
        let originalHeaders = [];
        const errorEl = isFileInput === null ? null : (isFileInput ? fileError : textError);
        const inputEl = isFileInput === null ? null : (isFileInput ? fileInput : textInput);

        if (fileError) fileError.textContent = "";
        if (textError) textError.textContent = "";

        modelTemplateSelect.disabled = true;
        modelTemplateSelect.innerHTML = '<option value="">-- Processing data... --</option>';
        // === MODIFIED: Show processing in table ===
        previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Processing data...</td></tr></tbody>';
        dataPreviewContainer.classList.remove("hidden"); // Make sure it's visible
        
        measurementSyntaxBox.value = ""; 
        structuralSyntaxBox.value = "";
        measurementSyntaxBox.placeholder = "Upload or paste data to see model templates...";
        structuralSyntaxBox.placeholder = "";

        if (isFileInput === null) {
            // === MODIFIED: Show placeholder on reset ===
            modelTemplateSelect.innerHTML = '<option value="">-- Upload or paste data first --</option>';
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Upload or paste data to see a preview.</td></tr></tbody>';
            return;
        }

        try {
            if (isFileInput) {
                const file = inputEl.files[0];
                if (!file) {
                    // === MODIFIED: Show placeholder if no file ===
                    modelTemplateSelect.innerHTML = '<option value="">-- Upload or paste data first --</option>';
                    previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Upload or paste data to see a preview.</td></tr></tbody>';
                    return;
                }
                textContent = await extractTextFromFile(file);
            } else {
                textContent = inputEl.value;
                if (!textContent.trim()) {
                    // === MODIFIED: Show placeholder if no text ===
                    modelTemplateSelect.innerHTML = '<option value="">-- Upload or paste data first --</option>';
                    previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Upload or paste data to see a preview.</td></tr></tbody>';
                    return;
                }
            }

        originalHeaders = getHeadersFromText(textContent);

        const lines = textContent.split(/[\r\n]+/).filter(Boolean);
        const dataRows = lines.slice(1); 
        
        if (dataRows.length < 10) {
            if (errorEl) errorEl.textContent = "Warning: Very small dataset. Need at least 10 rows for reliable SEM analysis.";
        }
        
        let numericColumnsCount = 0;
        if (dataRows.length > 0) {
            const firstRow = dataRows[0].split(/[,;\t]/);
            firstRow.forEach((cell, index) => {
                if (index > 0 && !isNaN(parseFloat(cell)) && isFinite(cell)) {
                    numericColumnsCount++;
                }
            });
        }
        
        if (numericColumnsCount < 3) {
            if (errorEl) errorEl.textContent = "Warning: Most columns appear non-numeric. SEM requires numeric data.";
        }

            showDataPreview(textContent);
            updateModelTemplates(originalHeaders);

        if (dataRows.length >= 10 && numericColumnsCount >= 3) {
            modelTemplateSelect.value = "autosuggest";
            modelTemplateSelect.dispatchEvent(new Event('change'));
        }

        } catch (err) {
            console.error("Input processing failed:", err);
            if (errorEl) errorEl.textContent = `Error: ${err.message}.`;
            modelTemplateSelect.disabled = true;
            modelTemplateSelect.innerHTML = '<option value="">-- Error reading data --</option>';
            // === MODIFIED: Show error in table ===
            previewTable.innerHTML = '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Error reading data preview.</td></tr></tbody>';
            dataPreviewContainer.classList.remove("hidden");
            measurementSyntaxBox.placeholder = "Error reading input data.";
            structuralSyntaxBox.placeholder = "";
        }
    };

    // --- Attach Input Event Listeners ---

    fileToggle.addEventListener("change", () => {
        fileArea.classList.remove("hidden");
        textArea.classList.add("hidden");
        processDataInput(fileInput.files.length > 0 ? true : null); 
    });
    textToggle.addEventListener("change", () => {
        fileArea.classList.add("hidden");
        textArea.classList.remove("hidden");
        processDataInput(textInput.value.trim() ? false : null); 
    });

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const label = dom.$("semFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (fileInput.files.length > 0) {
                fileNameSpan.textContent = fileInput.files[0].name;
                label.classList.add("has-file");
                processDataInput(true); 
            } else { 
                fileNameSpan.textContent = "Select data file...";
                label.classList.remove("has-file");
                processDataInput(null); 
            }
        });
    }

    if (textInput) {
        textInput.addEventListener("blur", () => { 
            if (!textArea.classList.contains("hidden")) {
                processDataInput(textInput.value.trim() ? false : null);
            }
        });
    }

    if (modelTemplateSelect) {
        modelTemplateSelect.addEventListener("change", async () => { 
            const selected = modelTemplateSelect.value;
            measurementSyntaxBox.value = ""; 
            structuralSyntaxBox.value = "";

            switch (selected) {
                case "custom":
                    measurementSyntaxBox.placeholder = "Type measurement model syntax here...";
                    structuralSyntaxBox.placeholder = "Type structural model syntax here...";
                    measurementSyntaxBox.focus(); 
                    break;
                case "autosuggest":
                    measurementSyntaxBox.placeholder = "Auto-suggesting generic model...";
                    structuralSyntaxBox.placeholder = "Auto-suggesting generic model...";
                    generateSyntax(); 
                    measurementSyntaxBox.placeholder = measurementSyntaxBox.value ? "Review auto-suggested syntax." : "Could not auto-suggest.";
                    structuralSyntaxBox.placeholder = structuralSyntaxBox.value ? "Review auto-suggested syntax." : "";
                    break;
                case "recommended":
                    measurementSyntaxBox.placeholder = "Loading recommended model...";
                    structuralSyntaxBox.placeholder = "Loading recommended model...";
                    generateRecommendedSyntax(); 
                    measurementSyntaxBox.placeholder = "Review recommended syntax.";
                    structuralSyntaxBox.placeholder = "Review recommended syntax.";
                    break;
                default:
                    measurementSyntaxBox.placeholder = "Select a model template or type syntax...";
                    structuralSyntaxBox.placeholder = "";
            }
        });
    }

    // Attach listener for the feedback link
            const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
            if (feedbackLink) {
                feedbackLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (typeof navigateTo === 'function') {
                        navigateTo('feedback');
                    } else {
                        console.error("navigateTo function is not defined.");
                    }
                });
            } else {
                console.warn("Feedback link not found inside createSemAnalysisLayout");
            }
}



/**
 * Creates the DOM layout for the DEMATEL analysis page.
 * --- UPDATED WITH ENHANCED EXAMPLE ---
 * - Removed the AI Preview step.
 * - Added a text preview for uploaded files, just like the SEM layout.
 * - Enhanced example with full spectrum of relationship intensities.
 * @param {object} template - The template object with title and description.
 */
function createDematelLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout

    // --- HTML Structure ---
contentContainer.innerHTML = `
    <div class="lg:col-span-1">
        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

        <div class="max-w-2xl mx-auto w-full">
            <div class="glass-container p-6 space-y-6">

                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xl font-bold text-white">Analysis Configuration</h3>
                    <div class="flex items-center space-x-2">
                        <button type="button" id="configExamplesBtn" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Examples</button>
                        <a href="data-files/dematel/dematel-sample-doc.txt" download="DEMATEL_Sample_Context.txt" class="btn btn-secondary text-xs" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download Sample .txt</a>
                    </div>
                </div>
                
                <div id="configExamples" class="hidden mb-4 p-3 bg-black/20 border border-white/15 rounded-lg">
                    <div class="text-xs font-medium text-white/90 mb-3">📋 Good vs Bad DEMATEL Input Examples</div>
                    
                    <!-- GOOD EXAMPLE -->
                    <div class="mb-6">
                        <div class="flex items-center mb-2">
                            <span class="text-green-300 font-semibold text-xs mr-2">✅ GOOD EXAMPLE</span>
                            <span class="text-green-200 text-xs">(Results in stable analysis with clear cause/effect separation)</span>
                        </div>
                        <div class="bg-green-900/20 border border-green-500/30 p-3 rounded font-mono text-white/90 relative text-xs">
                            <button class="absolute top-1 right-1 text-xs px-1 py-0.5 bg-white/10 rounded hover:bg-white/20" onclick="copyToClipboard(this, 'We identified five factors: (1) Product Quality, (2) Website Usability, (3) Customer Service, (4) Delivery Speed, and (5) Price Competitiveness.\\n\\nProduct Quality causes a very strong increase in Customer Service complaints. Bad Website Usability also strongly influences Customer Service. Slow Delivery Speed has a moderate impact on Price Competitiveness. Price Competitiveness has little influence on Product Quality since we maintain standards. Delivery Speed weakly influences Price Competitiveness because faster shipping costs more. Customer Service has very little impact on Website Usability since support issues rarely lead to website changes.')">Copy</button>
                            We identified five factors: (1) Product Quality, (2) Website Usability, (3) Customer Service, (4) Delivery Speed, and (5) Price Competitiveness.<br><br>
                            Product Quality causes a <strong>very strong</strong> increase in Customer Service complaints. Bad Website Usability also <strong>strongly</strong> influences Customer Service. Slow Delivery Speed has a <strong>moderate</strong> impact on Price Competitiveness. Price Competitiveness has <strong>little influence</strong> on Product Quality since we maintain standards. Delivery Speed <strong>weakly influences</strong> Price Competitiveness because faster shipping costs more. Customer Service has <strong>very little impact</strong> on Website Usability since support issues rarely lead to website changes.
                        </div>
                    </div>

                    <!-- BAD EXAMPLE -->
                    <div class="mb-6">
                        <div class="flex items-center mb-2">
                            <span class="text-red-300 font-semibold text-xs mr-2">❌ BAD EXAMPLE</span>
                            <span class="text-red-200 text-xs">(Results in mathematical instability and unclear insights)</span>
                        </div>
                        <div class="bg-red-900/20 border border-red-500/30 p-3 rounded font-mono text-white/90 relative text-xs">
                            <button class="absolute top-1 right-1 text-xs px-1 py-0.5 bg-white/10 rounded hover:bg-white/20" onclick="copyToClipboard(this, 'Our company has these success factors: Leadership, Innovation, Market Position, Financial Performance, Employee Satisfaction, Customer Relationships, Technology Infrastructure, Brand Reputation.\\n\\nLeadership affects everything in the company very strongly. Innovation influences all other factors significantly. Market Position impacts everything else. Financial Performance drives all business decisions and affects every single factor. Employee Satisfaction influences everything because happy employees work better. All factors influence each other bidirectionally with maximum strength.')">Copy</button>
                            Our company has these success factors: Leadership, Innovation, Market Position, Financial Performance, Employee Satisfaction, Customer Relationships, Technology Infrastructure, Brand Reputation.<br><br>
                            Leadership affects <strong>everything</strong> in the company <strong>very strongly</strong>. Innovation influences <strong>all other factors significantly</strong>. Market Position impacts <strong>everything else</strong>. Financial Performance drives all business decisions and affects <strong>every single factor</strong>. Employee Satisfaction influences <strong>everything</strong> because happy employees work better. <strong>All factors influence each other bidirectionally with maximum strength.</strong>
                        </div>
                    </div>

                    <!-- KEY DIFFERENCES -->
                    <div class="text-white/60 text-xs space-y-1 mb-4">
                        <div class="font-medium text-white/80">Key Differences Between Good & Bad Input:</div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                                <div class="text-green-300 font-medium">✅ Good Practices:</div>
                                <div>• Varied intensity words (very strong → very little)</div>
                                <div>• Specific explanations for each relationship</div>
                                <div>• Realistic relationship patterns</div>
                                <div>• 5-7 factors (manageable complexity)</div>
                                <div>• Not everything affects everything</div>
                            </div>
                            <div>
                                <div class="text-red-300 font-medium">❌ Bad Practices:</div>
                                <div>• "Everything affects everything" mentality</div>
                                <div>• All relationships are "maximum strength"</div>
                                <div>• Too many factors (8+ creates complexity)</div>
                                <div>• Vague language without explanations</div>
                                <div>• "Bidirectional with maximum strength"</div>
                            </div>
                        </div>
                    </div>

                    <!-- HOW TO USE INSTRUCTIONS -->
                    <div class="bg-blue-900/20 border border-blue-500/30 p-3 rounded">
                        <div class="text-blue-300 font-semibold text-xs mb-2">📝 How to Use This Tool:</div>
                        <div class="text-white/80 text-xs space-y-1">
                            <div>• <strong>Just write naturally!</strong> Describe your system in plain English.</div>
                            <div>• <strong>List your factors:</strong> Use a numbered list like "(1) Factor Name" for clarity.</div>
                            <div>• <strong>Describe relationships:</strong> Use words like "strongly influences," "moderately affects," "weakly impacts," or "has little impact on."</div>
                            <div>• <strong>Show the full spectrum:</strong> Mix very strong, strong, moderate, weak, and very weak relationships.</div>
                            <div>• <strong>Explain WHY:</strong> Add "because..." to help the AI understand the logic.</div>
                            <div>• <strong>The AI does the rest:</strong> You don't need to provide scales or matrices.</div>
                        </div>
                    </div>
                </div>

                <div class="input-radio-group">
                    <input type="radio" name="dematelInputType" id="dematelInputTextToggle" class="input-radio" checked>
                    <label for="dematelInputTextToggle" class="input-radio-label">Text Input</label>
                    <input type="radio" name="dematelInputType" id="dematelInputFileToggle" class="input-radio">
                    <label for="dematelInputFileToggle" class="input-radio-label">Document Upload</label>
                </div>

                <div id="dematelTextInputArea">
                    <label for="dematelContent" class="block text-sm font-medium text-gray-200 mb-2">System or Problem Description</label>
                    <textarea id="dematelContent" class="input-field h-48" placeholder="Describe your system in natural language. 
List your factors, like '(1) My First Factor'.
Then, describe their relationships using varied intensities: 
'Factor A strongly influences Factor B...'
'Factor C has little impact on Factor D...'
'Factor E very weakly affects Factor F...'
The AI will read this and build the matrix for you."></textarea>
                    <div id="dematelTextError" class="text-red-400 text-sm mt-2"></div>
                </div>

                <div id="dematelFileUploadArea" class="hidden">
                    <label for="dematelFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Document (.txt, .docx)</label>
                    <div class="input-file-wrapper">
                        <label for="dematelFile" id="dematelFileLabel" class="input-file-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                            <span class="file-name">Select .txt or .docx file...</span>
                        </label>
                        <input type="file" id="dematelFile" class="input-file" accept=".txt,.docx">
                    </div>
                    <div id="dematelFileError" class="text-red-400 text-sm mt-2"></div>

                    <div id="dematelFilePreviewContainer" class="hidden space-y-2 mt-4">
                        <label class="block text-sm font-medium text-gray-200">File Content Preview (First 10 lines)</label>
                        <pre id="dematelFilePreview" class="bg-black/20 p-3 rounded-lg text-white/80 text-xs overflow-x-auto h-32"></pre>
                    </div>
                </div>

                <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                    <span id="generateBtnText">Analyze Causal Factors</span>
                    <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                </button>
                <div class="text-center mt-4">
	                <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                </div>
            </div>
        </div>

        <div class="mt-12">
            <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
            <div id="analysisResult" class="glass-container min-h-[300px] overflow-x-auto">
            </div>
            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
            </div>
        </div>
    </div>
`;

    // --- Helper function for copying to clipboard ---
    if (!window.copyToClipboard) {
        window.copyToClipboard = function(button, text) {
            navigator.clipboard.writeText(text.replace(/\\n/g, '\n')).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        };
    }

    // --- Attach Core Event Listeners ---
    dom.$("generateBtn").addEventListener("click", handleGenerate); 
    
    reattachActionListeners(); 

    // --- Add Example Toggle Event Listener ---
    dom.$("configExamplesBtn").addEventListener("click", function() {
        const exampleDiv = dom.$("configExamples");
        const isHidden = exampleDiv.classList.contains("hidden");
        exampleDiv.classList.toggle("hidden");
        this.textContent = isHidden ? "Hide Examples" : "View Examples";
    });

    // --- Restore Cached Results (if any) ---
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        if (window.reattachTabListeners) {
             reattachTabListeners(dom.$("analysisResult"));
        }
    } else {
        dom.$("analysisResult").innerHTML = '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }

    // --- Get References to DEMATEL-Specific DOM Elements ---
    const fileInput = dom.$("dematelFile");
    const textInput = dom.$("dematelContent");
    const fileToggle = dom.$("dematelInputFileToggle");
    const textToggle = dom.$("dematelInputTextToggle");
    const fileArea = dom.$("dematelFileUploadArea");
    const textArea = dom.$("dematelTextInputArea");
    const filePreviewContainer = dom.$("dematelFilePreviewContainer");
    const filePreview = dom.$("dematelFilePreview");

    // --- Attach Input Event Listeners ---
    fileToggle.addEventListener("change", () => {
        fileArea.classList.remove("hidden");
        textArea.classList.add("hidden");
        // Show preview if a file is already selected
        if (fileInput.files.length > 0) {
            filePreviewContainer.classList.remove("hidden");
        }
    });
    textToggle.addEventListener("change", () => {
        fileArea.classList.add("hidden");
        textArea.classList.remove("hidden");
        // Hide file preview when switching to text input
        filePreviewContainer.classList.add("hidden");
    });

    if (fileInput) {
        fileInput.addEventListener("change", async () => { // Make async
            const label = dom.$("dematelFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            const fileError = dom.$("dematelFileError");
            
            fileError.textContent = ""; // Clear errors
            
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                fileNameSpan.textContent = file.name;
                label.classList.add("has-file");
                
                // --- NEW PREVIEW LOGIC ---
                try {
                    // extractTextFromFile is a global function in your script
                    const text = await extractTextFromFile(file); 
                    const first10Lines = text.split('\n').slice(0, 10).join('\n');
                    filePreview.textContent = first10Lines || "(File appears to be empty)";
                    filePreviewContainer.classList.remove("hidden");
                } catch (err) {
                    console.error("File preview error:", err);
                    fileError.textContent = `Error reading file: ${err.message}`;
                    filePreviewContainer.classList.add("hidden");
                }
                // --- END NEW PREVIEW LOGIC ---

            } else { 
                fileNameSpan.textContent = "Select .txt or .docx file...";
                label.classList.remove("has-file");
                filePreviewContainer.classList.add("hidden"); // Hide on file deselect
                filePreview.textContent = "";
            }
        });
    }

    if (textInput) {
        textInput.addEventListener("input", () => {
             dom.$("dematelTextError").textContent = "";
        });
    }

    // Attach listener for the feedback link
    const feedbackLink = contentContainer.querySelector('a[data-page="feedback"]');
    if (feedbackLink) {
        feedbackLink.addEventListener("click", (e) => {
            e.preventDefault();
            
            // This just calls the navigateTo function.
            // It relies on your main `MapsTo` function to be
            // the *simplified one* (without memory logic)
            // and your `submitFeedbackPageBtn` listener
            // to be the *simplified one* (that just goes home).
            if (typeof navigateTo === 'function') {
                navigateTo('feedback');
            } else {
                console.error("navigateTo function is not defined.");
            }
        });
    } else {
        console.warn("Feedback link not found inside createDematelLayout");
    }
}


export {
    createDescriptiveLayout_DA,
    createPredictiveAnalysisLayout,
    createPrescriptiveLayout_DA,
    createVisualizationLayout_DA,
    createRegressionLayout_DA,
    createPlsLayout_DA,
    createSemAnalysisLayout,
    createDematelLayout,
}