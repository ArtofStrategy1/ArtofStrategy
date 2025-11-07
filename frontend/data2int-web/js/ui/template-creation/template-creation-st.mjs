// =====================================================================================================
// ===================      Systems Thinking Page Template Creation Functions       ====================
// =====================================================================================================
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { handleGenerate } from "../../analysis/analysis-helpers.mjs"
import { reattachActionListeners, reattachTabListeners } from "./template-creation.mjs";
import { setupInputToggle } from "../../utils/ui-utils.mjs";

function createProcessMappingLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                    <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                    <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>

                    <div class="max-w-2xl mx-auto w-full">
                        <div class="glass-container p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Process Information</h3>
                            <div class="input-radio-group">
                                <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                                <label for="textInput" class="input-radio-label">Text Input</label>
                                <input type="radio" name="inputType" id="docUpload" class="input-radio">
                                <label for="docUpload" class="input-radio-label">Document Upload</label>
                            </div>
                            <div id="textInputArea">
                                <textarea id="processContent" class="input-field h-48" placeholder="Describe the business process from start to finish. Include the steps, roles involved, and any decision points..."></textarea>
                            </div>
                            <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="processFile" id="processFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .txt or .docx file...</span>
                                    </label>
                                    <input type="file" id="processFile" class="input-file" accept=".txt,.docx">
                                </div>
                            </div>
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                                <span id="generateBtnText">🗺️ Map Process</span>
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
    setupInputToggle("processFile", "processFileLabel", "textInputArea", "docUploadArea");
}



function createParetoLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div>
                    <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                    <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="max-w-2xl mx-auto">
                        <div class="glass-container p-6 space-y-4">
                            <div class="input-radio-group">
                                <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                                <label for="textInput" class="input-radio-label">Text Input</label>
                                <input type="radio" name="inputType" id="docUpload" class="input-radio">
                                <label for="docUpload" class="input-radio-label">Document Upload</label>
                            </div>
                            <div id="textInputArea">
                                <label for="problemStatement" class="block text-sm font-medium text-gray-200 mb-2">Problem Statement</label>
                                <textarea id="problemStatement" class="input-field h-32" placeholder="Describe the problem you want to analyze, including symptoms, context, and any known contributing factors..."></textarea>
                            </div>
                            <div id="docUploadArea" class="hidden">
                                    <div class="input-file-wrapper">
                                        <label for="paretoFile" id="paretoFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Click to select a file...</span>
                                        </label>
                                        <input type="file" id="paretoFile" class="input-file" accept=".txt,.pdf,.docx">
                                </div>
                                <p class="text-xs text-white/50 mt-2 text-center">Upload a document describing the problem.</p>
                            </div>
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                                <span id="generateBtnText">Analyze Root Causes</span>
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
                </div>
            `;

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

    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    // Add listeners for radio buttons and file input
    dom.$("textInput").addEventListener("change", () => {
        dom.$("textInputArea").classList.remove("hidden");
        dom.$("docUploadArea").classList.add("hidden");
    });
    dom.$("docUpload").addEventListener("change", () => {
        dom.$("textInputArea").classList.add("hidden");
        dom.$("docUploadArea").classList.remove("hidden");
    });

    const fileInput = dom.$("paretoFile");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$("paretoFileLabel");
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



function createSystemThinkingLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                    <div class="lg:col-span-1">
                    <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                    <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="max-w-2xl mx-auto w-full">
                        <div class="glass-container p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">System Description</h3>
                            <div class="input-radio-group">
                                <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                                <label for="textInput" class="input-radio-label">Text Input</label>
                                <input type="radio" name="inputType" id="docUpload" class="input-radio">
                                <label for="docUpload" class="input-radio-label">Document Upload</label>
                            </div>
                            <div id="textInputArea">
                                <textarea id="systemContent" class="input-field h-48" placeholder="Describe the system you want to analyze. Include key elements, their relationships, and any observed behaviors or problems..."></textarea>
                            </div>
                            <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="systemFile" id="systemFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select .txt or .docx file...</span>
                                    </label>
                                    <input type="file" id="systemFile" class="input-file" accept=".txt,.docx">
                                </div>
                            </div>
                            <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                                <span id="generateBtnText">🧠 Analyze System Dynamics</span>
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
    setupInputToggle("systemFile", "systemFileLabel", "textInputArea", "docUploadArea");
}



function createLeveragePointsLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide System Description</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="leverageContent" class="input-field h-48" placeholder="Describe the system, its components, the goal of the system, and any challenges or inefficiencies you have observed..."></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="leverageFile" id="leverageFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                    </label>
                                    <input type="file" id="leverageFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">⚡ Find Leverage Points</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
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
                </div>
            `;

    // Re-attach all necessary event listeners for the new elements
    setupInputToggle("leverageFile", "leverageFileLabel", "textInputArea", "docUploadArea");
}

function createArchetypeAnalysisLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Change layout to single column
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide System Information</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="archetypeContent" class="input-field h-48" placeholder="Describe the system, its components, behaviors, and any recurring problems or patterns you have observed..."></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="archetypeFile" id="archetypeFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                    </label>
                                    <input type="file" id="archetypeFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">🧠 Analyze System</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
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
                </div>
            `;

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

    const fileInput = dom.$("archetypeFile");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$("archetypeFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
            } else {
                fileNameSpan.textContent = "Select .docx or .txt file...";
                label.classList.remove("has-file");
            }
        });
    }
}



function createSystemGoalsLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">System & Goal Description</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="systemGoalsContent" class="input-field h-48" placeholder="Describe your system, its current state, and what you want to achieve. For example: 'Our software company is growing fast, but customer churn is high. We want to increase customer retention by 30%.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                                <div class="input-file-wrapper">
                                    <label for="systemGoalsFile" id="systemGoalsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                    </label>
                                    <input type="file" id="systemGoalsFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">🎯 Formulate Initiatives</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
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
                </div>
            `;

    // Re-attach all necessary event listeners for the new elements
    setupInputToggle("systemGoalsFile", "systemGoalsFileLabel", "textInputArea", "docUploadArea");
}



function createSystemObjectivesLayout_ST(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Describe Your System & Desired Outcome</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="systemObjContent" class="input-field h-48" placeholder="Describe the system and what you want to achieve. For example: 'Our user base is growing, but engagement is low. We want to increase the daily active user rate.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="systemObjFile" id="systemObjFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="systemObjFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">🎯 Set System-Aware Objectives</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Systemic Objective Analysis</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("systemObjFile", "systemObjFileLabel", "textInputArea", "docUploadArea");
}



function createSystemActionsLayout_ST(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Describe a Problem in Your System</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="systemActionContent" class="input-field h-48" placeholder="Describe a recurring problem. For example: 'Every time we hire more salespeople to boost revenue, our customer satisfaction drops and churn increases.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="systemActionFile" id="systemActionFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="systemActionFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">⚙️ Formulate Actions</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Systemic Action Plan</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("systemActionFile", "systemActionFileLabel", "textInputArea", "docUploadArea");
}


export {
    createProcessMappingLayout,
    createParetoLayout,
    createSystemThinkingLayout,
    createLeveragePointsLayout,
    createArchetypeAnalysisLayout,
    createSystemGoalsLayout,
    createSystemObjectivesLayout_ST,
    createSystemActionsLayout_ST
}