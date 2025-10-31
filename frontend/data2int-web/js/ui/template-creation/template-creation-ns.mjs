// =====================================================================================================
// ===================      Novel Strategies Page Template Creation Functions       ====================
// =====================================================================================================
import { handleGenerate } from "../../analysis/handle-generate.mjs"
import { reattachActionListeners } from "./template-creation.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { setupInputToggle } from "../../utils/ui-utils.mjs";

function createNovelGoalsLayout_NS(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg-col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Describe Your Overarching Ambition or Goal</h3>
                            <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="novelGoalsContent" class="input-field h-48" placeholder="Provide a high-level, ambitious goal. For example: 'To transition our company from a traditional hardware manufacturer to a leading software-as-a-service provider in the IoT space.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="novelGoalsFile" id="novelGoalsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="novelGoalsFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3">
                            <span id="generateBtnText">🗺️ Map Strategic Horizons</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Horizons of Growth Analysis</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("novelGoalsFile", "novelGoalsFileLabel", "textInputArea", "docUploadArea");
}

function createCreativeDissonanceLayout_NS(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-4xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-center text-white">Define the Dissonance</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label for="currentReality" class="block text-lg font-medium text-gray-200 mb-2">📉 Current Reality</label>
                                <textarea id="currentReality" class="input-field h-48" placeholder="Describe your current situation, challenges, and limitations..."></textarea>
                            </div>
                            <div>
                                <label for="futureVision" class="block text-lg font-medium text-gray-200 mb-2">🚀 Future Vision</label>
                                <textarea id="futureVision" class="input-field h-48" placeholder="Describe your ambitious, desired future state..."></textarea>
                            </div>
                        </div>
                            <h3 class="text-xl font-bold mt-6 mb-4 text-center text-white">Provide Additional Context (Optional)</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label for="dissonanceContextFile" class="block text-sm font-medium text-gray-200 mb-2">Business Document (.txt, .docx)</label>
                                <div class="input-file-wrapper">
                                    <label for="dissonanceContextFile" id="dissonanceContextFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select context file...</span>
                                    </label>
                                    <input type="file" id="dissonanceContextFile" class="input-file" accept=".txt,.docx">
                                </div>
                            </div>
                            <div>
                                <label for="dissonanceDataFile" class="block text-sm font-medium text-gray-200 mb-2">Data File (.csv)</label>
                                <div class="input-file-wrapper">
                                    <label for="dissonanceDataFile" id="dissonanceDataFileLabel" class="input-file-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                        <span class="file-name">Select data file...</span>
                                    </label>
                                    <input type="file" id="dissonanceDataFile" class="input-file" accept=".csv">
                                </div>
                            </div>
                            </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">⚡️ Generate Creative Strategies</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Creative Dissonance Analysis</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    const attachListener = (inputId, labelId) => {
        const fileInput = dom.$(inputId);
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = dom.$(labelId);
                const fileNameSpan = label.querySelector(".file-name");
                if (e.target.files.length > 0) {
                    fileNameSpan.textContent = e.target.files[0].name;
                } else {
                    fileNameSpan.textContent = "Select a file...";
                }
            });
        }
    };
    attachListener("dissonanceContextFile", "dissonanceContextFileLabel");
    attachListener("dissonanceDataFile", "dissonanceDataFileLabel");
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
}




function createLivingSystemLayout_NS(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-4xl mx-auto w-full p-6 space-y-6">
                            <h3 class="text-xl font-bold mb-4 text-center text-white">Describe Your Living System</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Detailed Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label for="lsCoreIdentity" class="block text-lg font-medium text-gray-200 mb-2">🧬 Core Identity (DNA)</label>
                                    <textarea id="lsCoreIdentity" class="input-field h-32" placeholder="What is your organization's fundamental purpose, mission, and core values?"></textarea>
                                </div>
                                <div>
                                    <label for="lsEnvironment" class="block text-lg font-medium text-gray-200 mb-2">🌍 Environment</label>
                                    <textarea id="lsEnvironment" class="input-field h-32" placeholder="Describe your market, competitors, customers, and key trends."></textarea>
                                </div>
                                <div>
                                    <label for="lsMetabolism" class="block text-lg font-medium text-gray-200 mb-2">🔥 Metabolism</label>
                                    <textarea id="lsMetabolism" class="input-field h-32" placeholder="How does your organization take in resources (revenue, talent, data) and convert them into value?"></textarea>
                                </div>
                                <div>
                                    <label for="lsNervousSystem" class="block text-lg font-medium text-gray-200 mb-2">🧠 Nervous System</label>
                                    <textarea id="lsNervousSystem" class="input-field h-32" placeholder="How does information flow? How do you sense changes and make decisions?"></textarea>
                                </div>
                            </div>
                        </div>
                        <div id="docUploadArea" class="hidden max-w-md mx-auto">
                            <div class="input-file-wrapper">
                                <label for="lsFile" id="lsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="lsFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">🔬 Diagnose Living System</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">System Health Analysis</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("lsFile", "lsFileLabel", "textInputArea", "docUploadArea");
}



function createThinkingSystemLayout_NS(template) {
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-1 gap-12";
    contentContainer.innerHTML = `
                <div class="lg:col-span-1">
                        <h1 class="text-4xl font-bold text-center mb-2">${template.title}</h1>
                        <p class="text-lg text-white/80 text-center mb-12 max-w-3xl mx-auto">${template.description}</p>
                    <div class="glass-container max-w-2xl mx-auto w-full p-6 space-y-4">
                            <h3 class="text-xl font-bold mb-4 text-white">Describe a Belief or Conclusion</h3>
                        <div class="input-radio-group">
                            <input type="radio" name="inputType" id="textInput" class="input-radio" checked>
                            <label for="textInput" class="input-radio-label">Text Input</label>
                            <input type="radio" name="inputType" id="docUpload" class="input-radio">
                            <label for="docUpload" class="input-radio-label">Document Upload</label>
                        </div>
                        <div id="textInputArea">
                            <textarea id="tsContent" class="input-field h-48" placeholder="Describe a belief, conclusion, or decision that has led to a recurring problem. For example: 'I believe our marketing campaigns are failing because the creative team is uninspired.'"></textarea>
                        </div>
                        <div id="docUploadArea" class="hidden">
                            <div class="input-file-wrapper">
                                <label for="tsFile" id="tsFileLabel" class="input-file-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload mr-2" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                    <span class="file-name">Select .docx or .txt file...</span>
                                </label>
                                <input type="file" id="tsFile" class="input-file" accept=".txt,.docx">
                            </div>
                        </div>
                        <button id="generateBtn" class="btn btn-primary w-full text-lg py-3 mt-4">
                            <span id="generateBtnText">🧠 Deconstruct Thinking</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>
                    </div>
                    <div class="mt-12">
                            <h2 class="text-3xl font-bold mb-4 text-center">Analysis of Your Thinking System</h2>
                            <div id="analysisResult" class="glass-container min-h-[500px] overflow-x-auto"></div>
                            <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">Save as PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">Save as DOCX</button>
                        </div>
                    </div>
                </div>
            `;
    setupInputToggle("tsFile", "tsFileLabel", "textInputArea", "docUploadArea");
}


export {
    createNovelGoalsLayout_NS,
    createCreativeDissonanceLayout_NS,
    createLivingSystemLayout_NS,
    createThinkingSystemLayout_NS
}