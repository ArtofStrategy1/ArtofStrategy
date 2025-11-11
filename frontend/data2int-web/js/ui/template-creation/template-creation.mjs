// =====================================================================================================
// ===================              Template Creation Helper Functions              ====================
// =====================================================================================================
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";
import { templateConfig } from "./template-config.mjs";
import { handleGenerate } from "../../analysis/analysis-helpers.mjs";
import { handleSaveAsPdf, handleSaveAsDocx } from "../../utils/file-utils.mjs";
import { navigateTo } from '../navigation.mjs';
import { configureFrameworkSelector, frameworkCheckboxChangeHandler } from "./framework-selection.mjs";
import { renderContactApprovalsTab } from "../general-rendering.mjs";
import * as createSP from "./template-creation-sp.mjs";
import * as createST from "./template-creation-st.mjs";
import * as createNS from "./template-creation-ns.mjs";
import * as createDA from "./template-creation-da.mjs";


function showTemplateDetail(templateId) {
    appState.currentTemplateId = templateId;
    const rule = templateConfig.templateRules[templateId] || {};

    // Dynamically get template info from the clicked card if not in the predefined list
    let template = templateConfig.templates[templateId];
    if (!template) {
        const card = document.querySelector(`.home-template-link[data-template-id="${templateId}"]`);
        if (card) {
            const title = card.querySelector("h3").innerText;
            const descriptionEl = card.querySelector("p");
            const description = descriptionEl
                ? descriptionEl.innerText
                : `Generate a detailed analysis for ${title}.`;
            template = { title: title, description: description };
            templateConfig.templates[templateId] = template; // Cache it
        } else {
            // Generic fallback if card isn't found
            template = {
                title: templateId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                description: `Generate a detailed analysis.`
            };
            templateConfig.templates[templateId] = template;
        }
    }

    // Handle special layouts that replace the whole content area
    if (rule.useSwotLayout) {
        createSP.createSwotTowsLayout(template);
    } else if (rule.useArchetypeLayout) {
        createST.createArchetypeAnalysisLayout(template);
    } else if (rule.useThinkingSystemLayout_NS) {
        // <-- ADD THIS BLOCK
        createNS.createThinkingSystemLayout_NS(template);
    } else if (rule.useLivingSystemLayout_NS) {
        // <-- ADD THIS BLOCK
        createNS.createLivingSystemLayout_NS(template);
    } else if (rule.useVisualizationLayout_DA) {
        // <-- ADD THIS BLOCK
        createDA.createVisualizationLayout_DA(template);
    } else if (appState.currentTemplateId === "all-framework") {
        createNS.createAllFrameworkLayout(template);
        // --- ⬆️ END OF NEW BLOCK ⬆️ ---
    } else if (appState.currentTemplateId === "mission-vision") {
        createSP.createMissionVisionLayout(template);
    } else if (rule.useSystemObjectivesLayout_ST) {
        // <-- ADD THIS BLOCK
        createST.createSystemObjectivesLayout_ST(template);
    } else if (appState.currentTemplateId === "objectives") {
        createSP.createObjectivesLayout(template);
        // --- ⬆️ END OF NEW BLOCK ⬆️ ---
    } else if (rule.useCreativeDissonanceLayout_NS) {
        // <-- ADD THIS BLOCK
        createNS.createCreativeDissonanceLayout_NS(template);
    } else if (rule.useSystemActionsLayout_ST) {
        // <-- ADD THIS BLOCK
        createST.createSystemActionsLayout_ST(template);
    } else if (rule.usePrescriptiveLayout_DA) {
        // <-- ADD THIS BLOCK
        createDA.createPrescriptiveLayout_DA(template);
    } else if (rule.usePlsLayout_DA) {
        // <-- ADD THIS BLOCK
        createDA.createPlsLayout_DA(template);
    } else if (rule.useDescriptiveLayout_DA) {
        // <-- ADD THIS BLOCK
        createDA.createDescriptiveLayout_DA(template);
    } else if (rule.useFactorAnalysisLayout) {
        createSP.createFactorAnalysisLayout(template);
    } else if (rule.useSemAnalysisLayout) {
        // <-- ADD THIS BLOCK
        createDA.createSemAnalysisLayout(template);
    } else if (rule.useActionPlansLayout_AP) {
        createSP.createActionPlansLayout_AP(template);
    } else if (rule.useLeveragePointsLayout) {
        createST.createLeveragePointsLayout(template);
    } else if (rule.useMiscLayout_MSC) {
        createSP.createMiscLayout_MSC(template);
    } else if (rule.useNovelGoalsLayout_NS) {
        // <-- ADD THIS BLOCK
        createNS.createNovelGoalsLayout_NS(template);
    } else if (rule.useKpiLayout_KE) {
        createSP.createKpiLayout_KE(template);
    } else if (rule.useGoalsAndInitiativesLayout_SP) {
        createSP.createGoalsAndInitiativesLayout_SP(template);
    } else if (rule.useRegressionLayout_DA) {
        // <-- ADD THIS BLOCK
        createDA.createRegressionLayout_DA(template);
    } else if (rule.useParetoLayout) {
        createST.createParetoLayout(template);
    } else if (rule.useProcessMappingLayout) {
        createST.createProcessMappingLayout(template);
    } else if (rule.useSystemGoalsLayout) {
        createST.createSystemGoalsLayout(template);
    } else if (rule.useSystemThinkingLayout) {
        createST.createSystemThinkingLayout(template);
    } else if (rule.usePredictiveAnalysisLayout) {
        createDA.createPredictiveAnalysisLayout(template);
    } else if (rule.useDematelLayout) {
        createDA.createDematelLayout(template);
    } else {
        createDefaultLayout(template, rule);
    }
    navigateTo("templateDetail");
}



function reattachActionListeners() {
    const savePdfBtn = dom.$("savePdfBtn");
    const saveDocxBtn = dom.$("saveDocxBtn");
    if (savePdfBtn) savePdfBtn.addEventListener("click", handleSaveAsPdf);
    if (saveDocxBtn) saveDocxBtn.addEventListener("click", handleSaveAsDocx);
}



function reattachTabListeners(container) {
    const tabNav = container.querySelector(".flex.border-b");
    const tabContent = container.querySelector("div:not(.flex)");
    if (tabNav && tabContent) {
        tabNav.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") {
                tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
                tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
                e.target.classList.add("active");
                const targetPanelId = e.target.dataset.tab + "Panel";
                const targetPanel = dom.$(targetPanelId);
                if (targetPanel) {
                    targetPanel.classList.add("active");
                    const chart = targetPanel.querySelector(".plotly-chart");
                    if (chart) {
                        Plotly.Plots.resize(chart);
                    }
                }
            }
        });
    }
}



function createDefaultLayout(template, rule) {
    // --- Default Layout Handling (Rebuilds the DOM for consistency) ---
    const contentContainer = dom.$("templateDetailContent");
    contentContainer.className = "grid lg:grid-cols-2 gap-12"; // Reset to default grid class
    contentContainer.innerHTML = `
                <div>
                    <h1 id="templateTitle" class="text-4xl font-bold mb-4">${template.title}</h1>
                    <p id="templateDescription" class="text-white/80 mb-8">${template.description}</p>
                    <div class="glass-container p-6">
                        <div id="templateFormFields" class="space-y-4"></div>
                        
                        <div id="analysisSectionsContainer" class="glass-container mt-8" style="display: ${rule.hideAnalysisSection ? "none" : "block"}">
                            <h4 class="text-xl font-bold mb-2 text-white text-center">Select Your Analysis Sections</h4>
                            <p class="text-white/70 text-center mb-4">Choose the components for your report.</p>
                            <ul id="analysisList" class="list-none text-white/70 text-left mx-auto max-w-sm">
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>Introduction</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>Overview of business</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>process overview</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>mission statement</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>vision analysis</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>vision statement 2</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>novel strategy part 1</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>novel strategy part 2</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2"><span>novel strategy part 3</span></li>
                            </ul>
                        </div>
                        
                        <div id="methodsConsideredContainer" class="glass-container mt-8" style="display: ${rule.hideFrameworks ? "none" : "block"}">
                            <h4 class="text-xl font-bold mb-2 text-white text-center">Select Your Frameworks</h4>
                            <p id="selectionCounter" class="text-white/70 text-center mb-4">Selected: 0 / 3</p>
                            <ul id="frameworkList" class="list-none text-white/70 text-left mx-auto max-w-sm">
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Reframing Thinking"><span>Reframing Thinking</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Delphi Method"><span>Delphi Method</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Blue Ocean Strategy"><span>Blue Ocean Strategy</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Design Thinking"><span>Design Thinking</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Thinking Hats"><span>Thinking Hats</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="Business Model Canvas"><span>Business Model Canvas</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="SCAMPER"><span>SCAMPER</span></li>
                                <li class="flex items-center mb-2"><input type="checkbox" class="method-checkbox w-5 h-5 mr-2 accent-indigo-500" data-framework="TRIZ (Theory of Inventive Problem Solving)"><span>TRIZ (Theory of Inventive Problem Solving)</span></li>
                            </ul>
                        </div>

                        <button id="generateBtn" class="btn btn-primary w-full mt-4">
                            <span id="generateBtnText">Generate Analysis</span>
                            <span id="generateSpinner" class="loading-spinner hidden ml-2"></span>
                        </button>

                        <div class="text-center mt-4">
                            <a href="#" class="btn-tertiary nav-link text-sm" data-page="feedback">Have feedback on this tool?</a>
                        </div>
                    </div>
                </div>
                <div>
                    <h2 class="text-3xl font-bold mb-4">Generated Analysis</h2>
                    <div id="analysisResult" class="glass-container min-h-[300px] whitespace-pre-wrap overflow-x-auto">
                    </div>
                    <div id="analysisActions" class="text-center mt-4 space-x-2 hidden">
                            <button id="savePdfBtn" class="btn btn-secondary">PDF</button>
                            <button id="saveDocxBtn" class="btn btn-secondary">DOCX</button>
                    </div>
                </div>
            `;

    // Populate the form fields into the newly created div
    populateDefaultFormFields(appState.currentTemplateId);

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

    // Reset and configure frameworks, re-attaching listeners to new elements
    const frameworkCheckboxes = document.querySelectorAll("#frameworkList .method-checkbox");
    frameworkCheckboxes.forEach((cb) => {
        cb.addEventListener("change", frameworkCheckboxChangeHandler);
        cb.disabled = false;
        cb.checked = false;
    });

    if (rule.preselectFramework) {
        frameworkCheckboxes.forEach((cb) => {
            if (cb.dataset.framework === rule.preselectFramework) {
                cb.checked = true;
            }
            cb.disabled = true;
        });
    }

    // Re-attach all necessary event listeners for the new elements
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
    configureFrameworkSelector(appState.currentSelectionLimit);

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
        console.warn("Feedback link not found inside createDefaultLayout");
    }
}



function populateDefaultFormFields(templateId) {
    const templateFormFields = dom.$("templateFormFields");
    templateFormFields.innerHTML = ""; // Clear previous fields

    // For Fishbone/Pareto, we only need the problem statement.
    if (templateId === "pareto-fishbone") {
        templateFormFields.innerHTML = `
                    <div>
                        <label for="problemStatement" class="block text-sm font-medium text-gray-200 mb-2">Problem Statement</label>
                        <input type="text" id="problemStatement" class="input-field" placeholder="e.g., Low Customer Satisfaction" required>
                    </div>
                `;
    } else {
        // Default form for most tools
        let formHtml = `
                    <div><label for="companyName" class="block text-sm font-medium text-gray-200 mb-2">Company Name</label><input type="text" id="companyName" class="input-field" placeholder="e.g., Innovate Inc." required></div>
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
                    <div><label for="location" class="block text-sm font-medium text-gray-200 mb-2">Location</label><input type="text" id="location" class="input-field" placeholder="e.g., Global" required></div>
                `;

        // Add context box for specific templates
        if (templateId === "mission-vision" || templateId === "objectives") {
            formHtml += `
                        <div>
                            <label for="useCaseContext" class="block text-sm font-medium text-gray-200 mb-2">Use Case / Company Context</label>
                            <textarea id="useCaseContext" class="input-field h-32" placeholder="Describe your company's mission, goals, or the specific use case for this analysis..."></textarea>
                        </div>
                    `;
        }

        templateFormFields.innerHTML = formHtml;

        const fileInput = dom.$("companyDocumentsFile");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = dom.$("companyDocumentsFileLabel");
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
}



// --- NEW FUNCTION TO CREATE DYNAMIC DASHBOARD LAYOUT ---
function createAdminDashboardTabs() {
    const dashboardContainer = dom.$("adminDashboard");
    if (!dashboardContainer) return;

    // 1. Capture existing static content (metrics and stats panels)
    const usersOnlineGrid = dashboardContainer.querySelector('.grid.md\\:grid-cols-3');
    const statsContainer = dashboardContainer.querySelector('.glass-container.mt-8');

    // 2. Clear the dashboard content
    dashboardContainer.innerHTML = '';

    // 3. Define Tab Navigation
    const tabNav = document.createElement("div");
    tabNav.id = "adminTabsNav";
    tabNav.className = "flex flex-wrap space-x-2 border-b-2 border-white/10 mt-8 mb-8";
    tabNav.innerHTML = `
        <button class="home-tab-btn active" data-tab="metrics">📊 Metrics & Stats</button>
        <button class="home-tab-btn" data-tab="approvals">📧 Contact Approvals</button>
        <button class="home-tab-btn" data-tab="tickets">🎫 Ticket System</button>
        <button class="home-tab-btn" data-tab="dbView">💾 View DB Content</button>
    `;
    
    // 4. Define Tab Content Panels
    const tabContent = document.createElement("div");
    tabContent.id = "adminTabsContent";
    tabContent.innerHTML = `
        <div id="metricsPanel" class="home-tab-panel active grid grid-cols-1 gap-8">
            ${usersOnlineGrid ? usersOnlineGrid.outerHTML : ''}
            ${statsContainer ? statsContainer.outerHTML : ''}
        </div>
        <div id="approvalsPanel" class="home-tab-panel"></div>
        <div id="ticketsPanel" class="home-tab-panel"></div>
        <div id="dbViewPanel" class="home-tab-panel"></div>
    `;

    // 5. Append new elements to the dashboard
    dashboardContainer.appendChild(tabNav);
    dashboardContainer.appendChild(tabContent);
    
    // 6. Attach the common tab switching listener
    setupAdminTabsListeners();
}

// --- NEW FUNCTION TO HANDLE TAB SWITCHING LOGIC ---
function setupAdminTabsListeners() {
    const tabsNav = dom.$("adminTabsNav");
    const tabPanels = document.querySelectorAll("#adminTabsContent .home-tab-panel");
    const tabBtns = document.querySelectorAll("#adminTabsNav .home-tab-btn");

    // Ensure the initial state is correct for the metrics panel
    tabPanels.forEach(panel => {
         if (panel.id === "metricsPanel") {
             panel.style.display = "grid"; 
         } else {
             panel.style.display = "none";
         }
    });

    tabsNav.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") return;
        const targetTab = e.target.dataset.tab;

        tabBtns.forEach((btn) => {
            // Apply home-tab-btn active styles
            btn.classList.toggle("active", btn.dataset.tab === targetTab);
        });

        tabPanels.forEach((panel) => {
            panel.classList.remove("active");
            if (panel.id === targetTab + "Panel") {
                panel.classList.add("active");
                panel.style.display = "grid"; // Show grid for content pages
                
                // *CRUCIAL: Trigger loading for specific tabs upon activation*
                if (targetTab === 'approvals') renderContactApprovalsTab();
                if (targetTab === 'tickets') renderTicketSystemTab();
                if (targetTab === 'dbView') renderViewDatabaseTab();

            } else {
                panel.style.display = "none";
            }
        });
    });
}

export {
    showTemplateDetail,
    reattachTabListeners,
    reattachActionListeners,
    createAdminDashboardTabs,
    setupAdminTabsListeners
}