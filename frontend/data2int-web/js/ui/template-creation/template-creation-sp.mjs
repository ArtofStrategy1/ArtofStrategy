// =====================================================================================================
// ===================     Strategic Planning Page Template Creation Functions      ====================
// =====================================================================================================
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { handleGenerate } from "../../analysis/handle-generate.mjs"
import { reattachActionListeners, reattachTabListeners } from "./template-creation.mjs";
import { extractTextFromFile } from "../../utils/file-utils.mjs";
import { setupInputToggle } from "../../utils/ui-utils.mjs";

function createFactorAnalysisLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                    <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                    <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

                    <div class="max-w-2xl mx-auto w-full">
                        <div class="glass-container p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide Business Information</h3>
                            <div class="input-radio-group">
                                <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                                <label for="textInput" class="input-radio-label">Text Input</label>
                                <input type="radio" name="inputType" id="docUpload" class="input-radio">
                                <label for="docUpload" class="input-radio-label">Document Upload</label>
                            </div>
                            <div id="textInputArea">
                                <textarea id="factorContent" class="input-field h-48" placeholder="Describe your business, its operations, market environment, and internal resources..."></textarea>
                            </div>
                            <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="factorFile" id="factorFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .txt or .docx file...</span>
                                    </label>
                                    <input type="file" id="factorFile" class="input-file" accept=".txt,.docx">
                                </div>
                                <div id="fileStats" class="text-sm text-white/70 text-center mt-2"></div>
                            </div>
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                                <span id="generateBtnText">🔍 Analyze Factors</span>
                                <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                            </button>
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
                </div>`;

    // Attach event listeners
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    // Restore from cache or set default
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        reattachTabListeners(dom.$("analysisResult"));
    } else {
        dom.$("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }

    // Add listeners for radio buttons and file input
    dom.$("textInput").addEventListener("change", () => {
        dom.$("textInputArea").classList.remove("hidden");
        dom.$("docUploadArea").classList.add("hidden");
    });
    dom.$("docUpload").addEventListener("change", () => {
        dom.$("textInputArea").classList.add("hidden");
        dom.$("docUploadArea").classList.remove("hidden");
    });

    const fileInput = dom.$("factorFile");
    if (fileInput) {
        fileInput.addEventListener("change", async (e) => {
            const label = dom.$("factorFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            const fileStats = dom.$("fileStats");
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                fileNameSpan.textContent = file.name;
                label.classList.add("has-file");
                try {
                    const text = await extractTextFromFile(file);
                    fileStats.innerHTML = `<p>Word Count: ${text.split(/\s+/).length}</p><p>Character Count: ${text.length}</p>`;
                } catch (err) {
                    fileStats.innerHTML = `<p class="text-red-400">Error reading file.</p>`;
                }
            } else {
                fileNameSpan.textContent = "Select .txt or .docx file...";
                label.classList.remove("has-file");
                fileStats.innerHTML = "";
            }
        });
    }
}



function createSwotTowsLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Change class for this layout
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                
                    <div class="glass-container p-6 max-w-2xl mx-auto w-full">
                        <h3 class="text-xl font-bold mb-4 text-white">Business Information</h3>
                        <div class="space-y-4">
                            <div class="input-radio-group">
                                <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                                <label for="textInput" class="input-radio-label">Text Input</label>
                                <input type="radio" name="inputType" id="docUpload" class="input-radio">
                                <label for="docUpload" class="input-radio-label">Document Upload</label>
                            </div>
                            <div id="textInputArea">
                                <textarea id="businessContent" class="input-field h-48" placeholder="Describe your business, industry, market position, challenges, opportunities, etc."></textarea>
                            </div>
                            <div id="docUploadArea" class="hidden">
                                    <div class="input-file-wrapper">
                                        <label for="swotFile" id="swotFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Click to select a file...</span>
                                        </label>
                                        <input type="file" id="swotFile" class="input-file" accept=".txt,.pdf,.docx">
                                </div>
                                <p class="text-xs text-white/50 mt-2 text-center">Note: Only .txt files can be read by the browser. PDF/DOCX are not supported for reading.</p>
                            </div>
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                                <span id="generateBtnText">Run SWOT/TOWS Analysis</span>
                                <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                            </button>
                        </div>
                    </div>

                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto">
                            </div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>`;

    // Re-attach event listeners for the newly created elements
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    // Restore from cache or set default
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        reattachTabListeners(dom.$("analysisResult"));
    } else {
        dom.$("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }

    // Listeners for radio buttons
    dom.$("textInput").addEventListener("change", () => {
        dom.$("textInputArea").classList.remove("hidden");
        dom.$("docUploadArea").classList.add("hidden");
    });
    dom.$("docUpload").addEventListener("change", () => {
        dom.$("textInputArea").classList.add("hidden");
        dom.$("docUploadArea").classList.remove("hidden");
    });
    // Listener for file input
    const fileInput = dom.$("swotFile");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$("swotFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
            } else {
                fileNameSpan.textContent = "Click to select a file...";
                label.classList.remove("has-file");
            }
        });
    }
}



function createGoalsAndInitiativesLayout_SP(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">High-Level Goal or Vision</h3>
                            <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="goalsContent" class="input-field h-48" placeholder="Describe your main business objective or long-term vision. For example: 'Become the #1 provider of eco-friendly cleaning supplies in North America by 2030.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="goalsFile" id="goalsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="goalsFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">📋 Build Strategic Plan</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Analysis Results</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("goalsFile", "goalsFileLabel", "textInputArea", "docUploadArea");
}



function createActionPlansLayout_AP(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Objective or Initiative to Plan</h3>
                            <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="actionPlanContent" class="input-field h-48" placeholder="Describe the goal or objective you want to create an action plan for. For example: 'Launch a new mobile application for our e-commerce store within the next 6 months.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="actionPlanFile" id="actionPlanFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="actionPlanFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">🗓️ Create Action Plan</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Generated Action Plan</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("actionPlanFile", "actionPlanFileLabel", "textInputArea", "docUploadArea");
}



function createKpiLayout_KE(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Project or Goal Description</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="kpiContent" class="input-field h-48" placeholder="Describe the project, goal, or strategic initiative you want to track. For example: 'Launch a new customer loyalty program to increase repeat purchase rate.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="kpiFile" id="kpiFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="kpiFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">📊 Define KPIs & Events</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Performance Framework</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("kpiFile", "kpiFileLabel", "textInputArea", "docUploadArea");
}



function createMiscLayout_MSC(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide Full Strategic Plan / Business Document</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="miscContent" class="input-field h-48" placeholder="Paste your complete business plan, strategic analysis, or project proposal here..."></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="miscFile" id="miscFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="miscFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">📝 Compile Final Report</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Final Sections</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("miscFile", "miscFileLabel", "textInputArea", "docUploadArea");
}


export {
    createFactorAnalysisLayout,
    createSwotTowsLayout,
    createGoalsAndInitiativesLayout_SP,
    createActionPlansLayout_AP,
    createKpiLayout_KE,
    createMiscLayout_MSC
}