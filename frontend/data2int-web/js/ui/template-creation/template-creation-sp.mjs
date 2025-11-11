// =====================================================================================================
// ===================     Strategic Planning Page Template Creation Functions      ====================
// =====================================================================================================
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { handleGenerate } from "../../analysis/analysis-helpers.mjs"
import { reattachActionListeners, reattachTabListeners } from "./template-creation.mjs";
import { extractTextFromFile } from "../../utils/file-utils.mjs";
import { setupInputToggle } from "../../utils/ui-utils.mjs";
import { navigateTo } from "../navigation.mjs";

/**
 * Creates the UI for the Mission Vision tool.
 * --- UPDATED ---
 * Now includes companyName and location fields to match the default form
 * and satisfy the n8n workflow's requirements, while keeping the custom UI.
 */
function createMissionVisionLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12"; // Single column layout
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide Company Context</h3>
                            
                            <div>
                            <label for="companyName" class="block text-sm font-medium text-gray-200 mb-2">Company Name</label>
                            <input type="text" id="companyName" class="input-field" placeholder="e.g., ${appState.preFillData || 'Innovate Inc.'}" required>
                            </div>
                            <div>
                            <label for="location" class="block text-sm font-medium text-gray-200 mb-2">Location</label>
                            <input type="text" id="location" class="input-field" placeholder="e.g., Global" required>
                            </div>
                            <div>
                            <label for="companyDocumentsFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Company Documents</label>
                            <div class="input-file-wrapper">
                                <label for="companyDocumentsFile" id="companyDocumentsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Click to select a file...</span>
                                </label>
                                <input type="file" id="companyDocumentsFile" class="input-file">
                            </div>
                            </div>
                            <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Manual Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio" disabled>
                            <label for="docUpload" class="input-radio-label opacity-50 cursor-not-allowed">Use Document Above</label>
                        </div>
                        <div id="textInputArea">
                            <label for="missionVisionContent" class="block text-sm font-medium text-gray-200 mb-2">Or Paste Context Here</label>
                            <textarea id="missionVisionContent" class="input-field h-32" placeholder="Describe your company, its purpose, its products, and its primary objectives... (Note: Uploading a document above is recommended)"></textarea>
                        </div>
                        
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">Generate Mission & Vision</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Generated Analysis</h2>
                            <div id="analysisResult" class="glass-container min-h-[300px] whitespace-pre-wrap overflow-x-auto">
                            </div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;

    // Re-attach event listeners
    // This helper attaches the 'generateBtn' and save buttons
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
    
    // --- Setup Logic for this specific page ---
    const fileInput = dom.$("companyDocumentsFile");
    const textInputToggle = dom.$("textInput");
    const docUploadToggle = dom.$("docUpload");
    const textArea = dom.$("textInputArea");
    
    // Radio button logic
    textInputToggle.addEventListener("change", () => {
        textArea.classList.remove("hidden");
    });
    docUploadToggle.addEventListener("change", () => {
        textArea.classList.add("hidden");
    });

    // File input logic
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$("companyDocumentsFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
                // Automatically select "Use Document Above" and disable text area
                docUploadToggle.checked = true;
                docUploadToggle.disabled = false;
                docUploadToggle.nextElementSibling.classList.remove("opacity-50", "cursor-not-allowed");
                textInputToggle.checked = false;
                textArea.classList.add("hidden");
            } else {
                fileNameSpan.textContent = "Click to select a file...";
                label.classList.remove("has-file");
                // Revert to text input
                docUploadToggle.checked = false;
                docUploadToggle.disabled = true;
                docUploadToggle.nextElementSibling.classList.add("opacity-50", "cursor-not-allowed");
                textInputToggle.checked = true;
                textArea.classList.remove("hidden");
            }
        });
    }
    
    // Restore from cache or set default
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
    } else {
        dom.$("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated mission and goals will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }
}



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
        console.warn("Feedback link not found inside createFactorAnalysisLayout");
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
                            <div class="text-center mt-4">
                                <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                            </div>
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
        console.warn("Feedback link not found inside createSwotTowsLayout");
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
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
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
        console.warn("Feedback link not found inside createGoalsAndInitiativesLayout_SP");
    }
}



/**
 * Creates the UI for the S.M.A.R.T. Objectives tool.
 * --- UPDATED ---
 * Now includes companyName and location fields to match the default form
 * and satisfy the n8n workflow's requirements, while keeping the custom UI.
 */
function createObjectivesLayout(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Provide Business Goal or Context</h3>
                            
                            <div>
                            <label for="companyName" class="block text-sm font-medium text-gray-200 mb-2">Company Name</label>
                            <input type="text" id="companyName" class="input-field" placeholder="e.g., ${appState.preFillData || 'Innovate Inc.'}" required>
                            </div>
                            <div>
                            <label for="location" class="block text-sm font-medium text-gray-200 mb-2">Location</label>
                            <input type="text" id="location" class="input-field" placeholder="e.g., Global" required>
                            </div>
                            <div>
                            <label for="companyDocumentsFile" class="block text-sm font-medium text-gray-200 mb-2">Upload Context Document</label>
                            <div class="input-file-wrapper">
                                <label for="companyDocumentsFile" id="companyDocumentsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Click to select a file...</span>
                                </label>
                                <input type="file" id="companyDocumentsFile" class="input-file" accept=".txt,.docx">
                            </div>
                            </div>
                            <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Manual Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio" disabled>
                            <label for="docUpload" class="input-radio-label opacity-50 cursor-not-allowed">Use Document Above</label>
                        </div>
                        <div id="textInputArea">
                            <label for="objectivesContent" class="block text-sm font-medium text-gray-200 mb-2">Or Paste Context Here</label>
                            <textarea id="objectivesContent" class="input-field h-48" placeholder="Describe your high-level goal, project, or business context... (Note: Uploading a document above is recommended)"></textarea>
                        </div>
                        
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">🎯 Formulate S.M.A.R.T. Objectives</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Generated Objectives Framework</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    
    // Re-attach event listeners
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
    
    // --- Setup Logic for this specific page ---
    const fileInput = dom.$("companyDocumentsFile"); // Re-using the same ID is fine
    const textInputToggle = dom.$("textInput");
    const docUploadToggle = dom.$("docUpload");
    const textArea = dom.$("textInputArea");
    
    // Radio button logic
    textInputToggle.addEventListener("change", () => {
        textArea.classList.remove("hidden");
    });
    docUploadToggle.addEventListener("change", () => {
        textArea.classList.add("hidden");
    });

    // File input logic
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$("companyDocumentsFileLabel");
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
                // Automatically select "Use Document Above"
                docUploadToggle.checked = true;
                docUploadToggle.disabled = false;
                docUploadToggle.nextElementSibling.classList.remove("opacity-50", "cursor-not-allowed");
                textInputToggle.checked = false;
                textArea.classList.add("hidden");
            } else {
                fileNameSpan.textContent = "Click to select a file...";
                label.classList.remove("has-file");
                // Revert to text input
                docUploadToggle.checked = false;
                docUploadToggle.disabled = true;
                docUploadToggle.nextElementSibling.classList.add("opacity-50", "cursor-not-allowed");
                textInputToggle.checked = true;
                textArea.classList.remove("hidden");
            }
        });
    }
    
    // Restore from cache or set default
    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        reattachTabListeners(dom.$("analysisResult")); // Re-attach tab listeners for the 4-tab layout
    } else {
        dom.$("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated objectives framework will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }
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
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
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
        console.warn("Feedback link not found inside createActionPlansLayout_AP");
    }
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
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
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
        console.warn("Feedback link not found inside createKpiLayout_KE");
    }
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
                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
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
        console.warn("Feedback link not found inside createMiscLayout_MSC");
    }
}


export {
    createMissionVisionLayout,
    createFactorAnalysisLayout,
    createSwotTowsLayout,
    createGoalsAndInitiativesLayout_SP,
    createObjectivesLayout,
    createActionPlansLayout_AP,
    createKpiLayout_KE,
    createMiscLayout_MSC
}