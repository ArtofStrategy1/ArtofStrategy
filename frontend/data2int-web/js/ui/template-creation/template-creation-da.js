// =====================================================================================================
// ===================        Data Analysis Page Template Creation Functions        ====================
// =====================================================================================================

function createDescriptiveLayout_DA(template) {
    const contentContainer = $("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Upload Your Dataset & Context</h3>
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
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">🔍 Analyze Data</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
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
    const attachListener = (inputId, labelId) => {
        const fileInput = $(inputId);
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = $(labelId);
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
    attachListener("descriptiveFile", "descriptiveFileLabel");
    attachListener("descriptiveContextFile", "descriptiveContextFileLabel");
    $("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
}



function createPredictiveAnalysisLayout(template) {
    const contentContainer = $("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
    <div class="lg:col-span-1">
        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
        <div class="max-w-3xl mx-auto w-full space-y-8">
            <div class="glass-container p-6">
                <h3 class="text-2xl font-bold mb-4 text-white">Step 1: Upload Your Data</h3>
                <div class="input-file-wrapper">
                    <label for="predictiveFile" id="predictiveFileLabel" class="input-file-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                        <span class="file-name">Select .csv or .xlsx file...</span>
                    </label>
                    <input type="file" id="predictiveFile" class="input-file" accept=".csv,.xlsx,.xls">
                </div>
                <div id="fileInfo" class="text-sm text-white/70 text-center mt-3"></div>
            </div>
            <div id="configSection" class="glass-container p-6 hidden">
                <h3 class="text-2xl font-bold mb-4 text-white">Step 2: Configure Prediction</h3>
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label for="dateColumnSelect" class="block text-sm font-medium text-gray-200 mb-2">Select Date/Time Column:</label>
                        <div class="select-wrapper"><select id="dateColumnSelect" class="input-field"></select></div>
                    </div>
                    <div>
                        <label for="metricSelect" class="block text-sm font-medium text-gray-200 mb-2">Select Value Column to Predict:</label>
                        <div class="select-wrapper"><select id="metricSelect" class="input-field"></select></div>
                    </div>
                </div>
                <div class="mt-4">
                    <label for="horizonSelect" class="block text-sm font-medium text-gray-200 mb-2">Forecast Horizon:</label>
                    <div class="select-wrapper">
                        <select id="horizonSelect" class="input-field">
                            <option value="quarter">Next Quarter (3 months)</option>
                            <option value="6months">Next 6 Months</option>
                            <option value="year" selected>Next Year (12 months)</option>
                            <option value="2years">Next 2 Years (24 months)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="modelSection" class="glass-container p-6 hidden">
                <h3 class="text-2xl font-bold mb-4 text-white">Step 3: Select Forecasting Model</h3>
                <div class="space-y-3">
                    <div class="p-4 rounded-lg bg-white/10 border border-white/20"><label><input type="radio" name="model" value="prophet" class="mr-2" checked> <strong>Prophet (Recommended)</strong></label><p class="text-sm text-white/70 pl-6">Best for business forecasting. Automatically handles seasonality, missing data, and outliers.</p></div>
                    <div class="p-4 rounded-lg bg-white/10 border border-white/20"><label><input type="radio" name="model" value="arima" class="mr-2"> <strong>ARIMA (Classic)</strong></label><p class="text-sm text-white/70 pl-6">Industry-standard time series model. Reliable for data with clear trends.</p></div>
                </div>
            </div>
            <div id="previewSection" class="glass-container p-6 hidden">
                <h3 class="text-2xl font-bold mb-4 text-white">Data Preview (First 5 Rows)</h3>
                <div id="dataPreviewTable" class="overflow-x-auto"></div>
            </div>
            <div class="flex flex-col sm:flex-row gap-4">
                <button id="generateBtn" class="btn btn-primary w-full text-lg py-3" disabled>
                    <span id="generateBtnText">🔮 Generate Forecast</span>
                    <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                </button>
                <button id="resetBtn" class="btn btn-secondary w-full text-lg py-3">Reset</button>
            </div>
        </div>
        <div class="mt-12">
            <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
            <div id="analysisResult" class="glass-container min-h-[300px] overflow-x-auto">
                <div class="text-white/60 p-8 text-center">Your generated forecast will appear here.</div>
            </div>
            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
            </div>
        </div>
    </div>`;

    $("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
    const fileInput = $("predictiveFile");

    // (Paste the corrected fileInput.addEventListener from above here)
    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        $("predictiveFileLabel").querySelector(".file-name").textContent = file.name;
        $("predictiveFileLabel").classList.add("has-file");
        try {
            const text = await extractTextFromFile(file);
            const lines = text.split(/\r?\n/);
            const columns = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
            $("fileInfo").innerHTML =
                `<strong>File:</strong> ${file.name}<br><strong>Columns Found:</strong> ${columns.length}`;
            const metricSelect = $("metricSelect");
            const dateColumnSelect = $("dateColumnSelect");
            metricSelect.innerHTML = '<option value="">Select...</option>';
            dateColumnSelect.innerHTML = '<option value="">Select...</option>';
            columns.forEach((col) => {
                metricSelect.add(new Option(col, col));
                dateColumnSelect.add(new Option(col, col));
            });
            const previewSection = $("previewSection");
            const dataPreviewTable = $("dataPreviewTable");
            let tableHTML =
                '<table class="w-full text-left text-sm text-white/80"><thead><tr class="border-b border-white/20">';
            columns.forEach((col) => {
                tableHTML += `<th class="p-2">${col}</th>`;
            });
            tableHTML += "</tr></thead><tbody>";
            const previewRows = lines.slice(1, 6);
            previewRows.forEach((rowStr) => {
                tableHTML += "<tr>";
                rowStr.split(",").forEach((cell) => {
                    tableHTML += `<td class="p-2 border-t border-white/10">${cell}</td>`;
                });
                tableHTML += "</tr>";
            });
            tableHTML += "</tbody></table>";
            dataPreviewTable.innerHTML = tableHTML;
            previewSection.classList.remove("hidden");
            $("configSection").classList.remove("hidden");
            $("modelSection").classList.remove("hidden");
            $("generateBtn").disabled = false;
        } catch (err) {
            $("fileInfo").innerHTML =
                `<p class="text-red-400">Error reading file. Please ensure it is a valid CSV or XLSX.</p>`;
            $("configSection").classList.add("hidden");
            $("modelSection").classList.add("hidden");
            $("generateBtn").disabled = true;
        }
    });

    const resetBtn = $("resetBtn");
    resetBtn.addEventListener("click", () => {
        fileInput.value = "";
        $("predictiveFileLabel").querySelector(".file-name").textContent = "Select .csv or .xlsx file...";
        $("predictiveFileLabel").classList.remove("has-file");
        $("fileInfo").innerHTML = "";
        $("configSection").classList.add("hidden");
        $("modelSection").classList.add("hidden");
        $("previewSection").classList.add("hidden");
        $("generateBtn").disabled = true;
        $("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated forecast will appear here.</div>';
        $("analysisActions").classList.add("hidden");
    });
}



function createPrescriptiveLayout_DA(template) {
    const contentContainer = $("templateDetailContent");
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
}



function createVisualizationLayout_DA(template) {
    const contentContainer = $("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Visualization Setup</h3>
                        <div class="space-y-4">
                            <div>
                                <label for="vizRequest" class="block text-sm font-medium text-gray-200 mb-2">What do you want to visualize?</label>
                                <textarea id="vizRequest" class="input-field h-24" placeholder="Be specific. For example: 'Show the relationship between Marketing Spend and Sales Revenue', or 'Visualize the distribution of customer ages by product category.'"></textarea>
                            </div>
                            <div>
                                <label for="vizFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Data File (.csv)</label>
                                <div class="input-file-wrapper">
                                    <label for="vizFile" id="vizFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .csv file...</span>
                                    </label>
                                    <input type="file" id="vizFile" class="input-file" accept=".csv">
                                </div>
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">📊 Generate Visualizations</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Data Visualizations</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("vizFile", "vizFileLabel", null, null);
}



/**
 * Creates the HTML structure and attaches listeners for the SEM Analysis tool.
 * Includes data preview, model template selection, and split syntax inputs.
 * @param {object} template - Object containing template title and description.
 */
function createSemAnalysisLayout(template) {
    const contentContainer = $("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout

    // --- HTML Structure ---
    contentContainer.innerHTML = `
        <div class="lg:col-span-1">
            <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
            <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

            <div class="max-w-2xl mx-auto w-full">
                <div class="glass-container p-6 space-y-6">
                    <h3 class="text-xl font-bold mb-2 text-white">Analysis Configuration</h3>

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

                    <div id="semDataPreview" class="hidden space-y-2">
                        <label class="block text-sm font-medium text-gray-200">Data Preview (First 5 Rows)</label>
                        <div class="overflow-x-auto rounded-lg border border-white/20">
                            <table class="min-w-full text-left text-sm text-white/90" id="semPreviewTable">
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
                        <label for="semMeasurementSyntax" class="block text-sm font-medium text-gray-200 mb-2">Measurement Model Syntax</label>
                        <textarea id="semMeasurementSyntax" class="input-field h-32" placeholder="e.g., Factor1 =~ varA + varB\nFactor2 =~ varC + varD..."></textarea>
                    </div>

                    <div>
                        <label for="semStructuralSyntax" class="block text-sm font-medium text-gray-200 mb-2">Structural Model Syntax</label>
                        <textarea id="semStructuralSyntax" class="input-field h-32" placeholder="e.g., Factor1 ~ Factor2\nObservedVar ~ Factor1..."></textarea>
                    </div>

                    <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                        <span id="generateBtnText">📊 Run SEM Analysis</span>
                        <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                    </button>
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
    $("generateBtn").addEventListener("click", handleGenerate); // Assumes handleGenerate exists and calls handleSemAnalysis
    reattachActionListeners(); // Assumes this function attaches save button listeners

    // --- Restore Cached Results (if any) ---
    if (analysisCache[currentTemplateId]) {
        $("analysisResult").innerHTML = analysisCache[currentTemplateId];
        $("analysisActions").classList.remove("hidden");
        // Re-attach listeners specific to the results content (e.g., tabs)
        reattachTabListeners($("analysisResult")); // Assumes this function exists
    } else {
        // Default placeholder if no cached results
        $("analysisResult").innerHTML = '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        $("analysisActions").classList.add("hidden");
    }

    // --- Get References to SEM-Specific DOM Elements ---
    const fileInput = $("semFile");
    const textInput = $("semDataText");
    const measurementSyntaxBox = $("semMeasurementSyntax");
    const structuralSyntaxBox = $("semStructuralSyntax");
    const fileError = $("semFileError");
    const textError = $("semTextError");
    const fileToggle = $("semInputFileToggle");
    const textToggle = $("semInputTextToggle");
    const fileArea = $("semFileUploadArea");
    const textArea = $("semTextInputArea");
    const dataPreviewContainer = $("semDataPreview");
    const previewTable = $("semPreviewTable");
    const modelTemplateSelect = $("semModelTemplate");
    let fullHeaders = []; // Holds the headers extracted from data

    // --- SEM Helper Functions --- (Keep all helper functions as they were)

    /**
     * Extracts headers from CSV text, trying common delimiters.
     * @param {string} text - CSV content.
     * @returns {string[]} Array of headers.
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
        if (headers.length === 0) throw new Error("Could not parse headers (tried comma, semicolon, tab).");
        return headers;
    };

    /** Shows the first 5 data rows in the preview table. */
    const showDataPreview = (csvText) => {
        try {
            const lines = csvText.split(/[\r\n]+/).filter(Boolean); // Filter empty lines
            const rows = lines.slice(0, 6); // Header + 5 data rows
            if (rows.length < 2) { dataPreviewContainer.classList.add("hidden"); return; }

            const headers = getHeadersFromText(rows[0]);
            let tableHTML = '<thead class="bg-white/10 text-xs uppercase"><tr>';
            headers.forEach(h => { tableHTML += `<th scope="col" class="px-4 py-2">${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            rows.slice(1).forEach((line, rowIndex) => {
                // Simple split for preview - assumes consistent delimiter detected by getHeadersFromText
                let cells = line.split(',');
                if (cells.length <= 1) cells = line.split(';');
                if (cells.length <= 1) cells = line.split('\t');

                tableHTML += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    tableHTML += `<td class="px-4 py-2">${cells[cellIndex] === undefined ? '' : cells[cellIndex]}</td>`;
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

    /** Populates the model template dropdown based on detected headers. */
    const updateModelTemplates = (headers) => {
        fullHeaders = headers;
        modelTemplateSelect.innerHTML = '';
        modelTemplateSelect.add(new Option("Select a model template...", ""));
        modelTemplateSelect.add(new Option("Custom Syntax (Type below)", "custom"));
        modelTemplateSelect.add(new Option("Auto-Suggest (Generic Model)", "autosuggest"));

        const hasMarketing = headers.includes('Ad_Spend_USD') && headers.includes('Brand_Awareness_Pct');
        const hasSales = headers.includes('Online_Sales_USD') && headers.includes('Retail_Sales_USD');
        const hasProfit = headers.includes('Profit_USD');
        if (hasMarketing && hasSales && hasProfit) {
            modelTemplateSelect.add(new Option("Marketing Path Analysis", "recommended"));
        }
        modelTemplateSelect.disabled = false;
    };

    /** Splits syntax into measurement/structural parts and populates text boxes, removing comments first. */
    const populateSyntaxBoxes = (fullSyntax) => {
        const uncommentedSyntax = fullSyntax.split('\n')
            .filter(line => !line.trim().startsWith('#')) // Remove comments
            .join('\n');
        const lines = uncommentedSyntax.split('\n');
        let measurement = [], structural = [], foundStructural = false;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return; // Skip blank lines after comment removal
            if (trimmedLine.includes('~') && !trimmedLine.includes('=~')) foundStructural = true;
            if (foundStructural) structural.push(line);
            else measurement.push(line);
        });

        measurementSyntaxBox.value = measurement.join('\n').trim();
        structuralSyntaxBox.value = structural.join('\n').trim();
        measurementSyntaxBox.placeholder = measurementSyntaxBox.value ? measurementSyntaxBox.placeholder : "e.g., F1 =~ x1+x2";
        structuralSyntaxBox.placeholder = structuralSyntaxBox.value ? structuralSyntaxBox.placeholder : "e.g., F1 ~ F2";
    };

    /** Generates the recommended path analysis syntax (comment-free). */
    const generateRecommendedSyntax = () => {
        const fullSyntax = `
Marketing =~ Ad_Spend_USD + Brand_Awareness_Pct

Profit_USD ~ Marketing + Online_Sales_USD + Retail_Sales_USD`;
        populateSyntaxBoxes(fullSyntax);
    };

    /** Generates a generic SEM syntax based on columns (comment-free). */
    const generateSyntax = () => {
        if (fullHeaders.length === 0) { alert("Data headers not found for auto-suggestion."); return; }
        const headersForModel = fullHeaders.filter(h => h.toLowerCase() !== 'date');
        const marketing = [], customer = [], sales = [], financial = [];
        // Categorization logic (same as before)
        const totalRev = headersForModel.find(h => h.toLowerCase().includes('total') && h.toLowerCase().includes('revenue'));
        const onlineSales = headersForModel.find(h => h.toLowerCase().includes('online') && h.toLowerCase().includes('sales'));
        const retailSales = headersForModel.find(h => h.toLowerCase().includes('retail') && h.toLowerCase().includes('sales'));
        const hasPerfectDependency = totalRev && onlineSales && retailSales;
        const varsToSkip = hasPerfectDependency ? [totalRev] : [];
        headersForModel.forEach(col => {
            const lower = col.toLowerCase();
            if (varsToSkip.includes(col)) return;
            if (lower.includes('ad') || lower.includes('marketing') || lower.includes('spend') || lower.includes('awareness') || lower.includes('brand')) { marketing.push(col); }
            else if (lower.includes('customer') || lower.includes('acquisition') || lower.includes('new_customer')) { customer.push(col); }
            else if ((lower.includes('sales') || lower.includes('orders')) && !lower.includes('total') && !lower.includes('revenue')) { sales.push(col); }
            else if (lower.includes('revenue') || lower.includes('profit') || lower.includes('income') || lower.includes('earnings')) { financial.push(col); }
        });

        let measurementPart = '', structuralPart = '';
        if (marketing.length > 0) measurementPart += `Marketing =~ ${marketing.slice(0, 3).join(' + ')}\n`;
        const customerSales = [...customer, ...sales];
        if (customerSales.length > 0) measurementPart += `CustomerSales =~ ${customerSales.slice(0, 3).join(' + ')}\n`;
        if (financial.length > 0) measurementPart += `Financial =~ ${financial.slice(0, 2).join(' + ')}\n`;
        if (marketing.length > 0 && customerSales.length > 0) structuralPart += 'CustomerSales ~ Marketing\n';
        if (customerSales.length > 0 && financial.length > 0) structuralPart += 'Financial ~ CustomerSales\n';

        let fullSyntax = measurementPart.trim();
        if (structuralPart.trim()) fullSyntax += (fullSyntax ? "\n\n" : "") + structuralPart.trim();

        populateSyntaxBoxes(fullSyntax || " "); // Pass space if empty to clear boxes
    };

    /** Processes data input (file or text) to update UI state. */
    const processDataInput = async (isFileInput) => {
        let textContent = null;
        let originalHeaders = [];
        const errorEl = isFileInput === null ? null : (isFileInput ? fileError : textError);
        const inputEl = isFileInput === null ? null : (isFileInput ? fileInput : textInput);

        // Clear errors
        if (fileError) fileError.textContent = "";
        if (textError) textError.textContent = "";

        // Reset UI before processing
        modelTemplateSelect.disabled = true;
        modelTemplateSelect.innerHTML = '<option value="">-- Upload or paste data first --</option>';
        dataPreviewContainer.classList.add("hidden");
        previewTable.innerHTML = "";
        measurementSyntaxBox.value = ""; // Clear syntax boxes too
        structuralSyntaxBox.value = "";
        measurementSyntaxBox.placeholder = "Upload or paste data to see model templates...";
        structuralSyntaxBox.placeholder = "";

        // If isFileInput is null, it means we just need to reset the UI (e.g., file deselected)
        if (isFileInput === null) return;

        try {
            if (isFileInput) {
                const file = inputEl.files[0];
                if (!file) return;
                textContent = await extractTextFromFile(file);
            } else {
                textContent = inputEl.value;
                if (!textContent.trim()) return;
            }

            originalHeaders = getHeadersFromText(textContent);

            // If headers parsed successfully:
            showDataPreview(textContent);
            updateModelTemplates(originalHeaders); // This enables the dropdown

            // *** NEW: Automatically trigger AI syntax generation IF data is present ***
            // Set dropdown to AI generated to trigger the change event
            modelTemplateSelect.value = "ai-generated";
            // Manually dispatch the change event to ensure the listener runs
            modelTemplateSelect.dispatchEvent(new Event('change'));

            // The placeholders will be updated *during* the AI generation via the change listener

        } catch (err) {
            console.error("Input processing failed:", err);
            if (errorEl) errorEl.textContent = `Error: ${err.message}.`;
            // Reset UI to error state
            modelTemplateSelect.disabled = true;
            modelTemplateSelect.innerHTML = '<option value="">-- Error reading data --</option>';
            dataPreviewContainer.classList.add("hidden");
            measurementSyntaxBox.placeholder = "Error reading input data.";
            structuralSyntaxBox.placeholder = "";
        }
    };

    // --- Attach Input Event Listeners ---

    // Radio toggles
    fileToggle.addEventListener("change", () => {
        fileArea.classList.remove("hidden");
        textArea.classList.add("hidden");
        processDataInput(fileInput.files.length > 0 ? true : null); // Re-process if file exists, else reset
    });
    textToggle.addEventListener("change", () => {
        fileArea.classList.add("hidden");
        textArea.classList.remove("hidden");
        processDataInput(textInput.value.trim() ? false : null); // Re-process if text exists, else reset
    });

    // File input selection
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const label = $("semFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (fileInput.files.length > 0) {
                fileNameSpan.textContent = fileInput.files[0].name;
                label.classList.add("has-file");
                processDataInput(true); // Process the new file
            } else { // File deselected
                fileNameSpan.textContent = "Select data file...";
                label.classList.remove("has-file");
                processDataInput(null); // Reset the UI
            }
        });
    }

    // Text input typing (only process if text area is visible)
    // Use 'blur' or a debounce mechanism if 'input' triggers too often
    if (textInput) {
        textInput.addEventListener("blur", () => { // Changed from 'input' to 'blur'
            if (!textArea.classList.contains("hidden")) {
                processDataInput(textInput.value.trim() ? false : null);
            }
        });
    }

    // Model template selection change
    if (modelTemplateSelect) {
        // --- MODIFIED LISTENER ---
        modelTemplateSelect.addEventListener("change", async () => { // Make the handler async
            const selected = modelTemplateSelect.value;
            measurementSyntaxBox.value = ""; // Clear boxes when selection changes
            structuralSyntaxBox.value = "";

            switch (selected) {
                case "custom":
                    measurementSyntaxBox.placeholder = "Type measurement model syntax here...";
                    structuralSyntaxBox.placeholder = "Type structural model syntax here...";
                    measurementSyntaxBox.focus(); // Focus the first box for custom entry
                    break;
                case "autosuggest":
                    measurementSyntaxBox.placeholder = "Auto-suggesting generic model...";
                    structuralSyntaxBox.placeholder = "Auto-suggesting generic model...";
                    generateSyntax(); // Call the simple auto-suggest function
                    measurementSyntaxBox.placeholder = measurementSyntaxBox.value ? "Review auto-suggested syntax." : "Could not auto-suggest.";
                    structuralSyntaxBox.placeholder = structuralSyntaxBox.value ? "Review auto-suggested syntax." : "";

                    break;
                case "recommended":
                    measurementSyntaxBox.placeholder = "Loading recommended model...";
                    structuralSyntaxBox.placeholder = "Loading recommended model...";
                    generateRecommendedSyntax(); // Call the specific recommended syntax function
                    measurementSyntaxBox.placeholder = "Review recommended syntax.";
                    structuralSyntaxBox.placeholder = "Review recommended syntax.";
                    break;
                default:
                    // Option "" selected (Select a model template...)
                    measurementSyntaxBox.placeholder = "Select a model template or type syntax...";
                    structuralSyntaxBox.placeholder = "";
            }
        });
        // --- END OF MODIFIED LISTENER ---
    }

}



function createDematelLayout(template) {
    const contentContainer = $("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
        <div class="lg:col-span-1">
            <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
            <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
            <div class="max-w-2xl mx-auto w-full">
                <div class="glass-container p-6 space-y-4">
                    <h3 class="text-xl font-bold mb-4 text-white">System or Problem Description</h3>
                    <div class="input-radio-group">
                        <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                        <label for="textInput" class="input-radio-label">Text Input</label>
                        <input type="radio" name="inputType" id="docUpload" class="input-radio">
                        <label for="docUpload" class="input-radio-label">Document Upload</label>
                    </div>
                    <div id="textInputArea">
                        <textarea id="dematelContent" class="input-field h-48" placeholder="Describe the system and its interacting factors. For example, 'Factors affecting product adoption include perceived usefulness, ease of use, social influence, and cost...'"></textarea>
                    </div>
                    <div id="docUploadArea" class="hidden">
                        <div class="input-file-wrapper">
                            <label for="dematelFile" id="dematelFileLabel" class="input-file-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                <span class="file-name">Select .txt or .docx file...</span>
                            </label>
                            <input type="file" id="dematelFile" class="input-file" accept=".txt,.docx">
                        </div>
                    </div>
                    <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                        <span id="generateBtnText">Analyze Causal Factors</span>
                        <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                    </button>
                </div>
            </div>
            <div class="mt-12">
                <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
                <div id="analysisResult" class="glass-container min-h-[300px] overflow-x-auto"></div>
                <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                    <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                    <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                </div>
            </div>
        </div>`;
    setupInputToggle("dematelFile", "dematelFileLabel", "textInputArea", "docUploadArea");
}
