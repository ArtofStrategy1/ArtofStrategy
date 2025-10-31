// =====================================================================================================
// ===================              Template Creation Helper Functions              ====================
// =====================================================================================================

function reattachActionListeners() {
    const savePdfBtn = $("savePdfBtn");
    const saveDocxBtn = $("saveDocxBtn");
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
                const targetPanel = $(targetPanelId);
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



function showTemplateDetail(templateId) {
    currentTemplateId = templateId;
    const rule = templateRules[templateId] || {};

    // Dynamically get template info from the clicked card if not in the predefined list
    let template = templates[templateId];
    if (!template) {
        const card = document.querySelector(`.home-template-link[data-template-id="${templateId}"]`);
        if (card) {
            const title = card.querySelector("h3").innerText;
            const descriptionEl = card.querySelector("p");
            const description = descriptionEl
                ? descriptionEl.innerText
                : `Generate a detailed analysis for ${title}.`;
            template = { title: title, description: description };
            templates[templateId] = template; // Cache it
        } else {
            // Generic fallback if card isn't found
            template = {
                title: templateId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                description: `Generate a detailed analysis.`
            };
            templates[templateId] = template;
        }
    }

    // Handle special layouts that replace the whole content area
    if (rule.useSwotLayout) {
        createSwotTowsLayout(template);
    } else if (rule.useArchetypeLayout) {
        createArchetypeAnalysisLayout(template);
    } else if (rule.useThinkingSystemLayout_NS) {
        // <-- ADD THIS BLOCK
        createThinkingSystemLayout_NS(template);
    } else if (rule.useLivingSystemLayout_NS) {
        // <-- ADD THIS BLOCK
        createLivingSystemLayout_NS(template);
    } else if (rule.useVisualizationLayout_DA) {
        // <-- ADD THIS BLOCK
        createVisualizationLayout_DA(template);
    } else if (rule.useSystemObjectivesLayout_ST) {
        // <-- ADD THIS BLOCK
        createSystemObjectivesLayout_ST(template);
    } else if (rule.useCreativeDissonanceLayout_NS) {
        // <-- ADD THIS BLOCK
        createCreativeDissonanceLayout_NS(template);
    } else if (rule.useSystemActionsLayout_ST) {
        // <-- ADD THIS BLOCK
        createSystemActionsLayout_ST(template);
    } else if (rule.usePrescriptiveLayout_DA) {
        // <-- ADD THIS BLOCK
        createPrescriptiveLayout_DA(template);
    } else if (rule.usePlsLayout_DA) {
        // <-- ADD THIS BLOCK
        createPlsLayout_DA(template);
    } else if (rule.useDescriptiveLayout_DA) {
        // <-- ADD THIS BLOCK
        createDescriptiveLayout_DA(template);
    } else if (rule.useFactorAnalysisLayout) {
        createFactorAnalysisLayout(template);
    } else if (rule.useSemAnalysisLayout) {
        // <-- ADD THIS BLOCK
        createSemAnalysisLayout(template);
    } else if (rule.useActionPlansLayout_AP) {
        createActionPlansLayout_AP(template);
    } else if (rule.useLeveragePointsLayout) {
        createLeveragePointsLayout(template);
    } else if (rule.useMiscLayout_MSC) {
        createMiscLayout_MSC(template);
    } else if (rule.useNovelGoalsLayout_NS) {
        // <-- ADD THIS BLOCK
        createNovelGoalsLayout_NS(template);
    } else if (rule.useKpiLayout_KE) {
        createKpiLayout_KE(template);
    } else if (rule.useGoalsAndInitiativesLayout_SP) {
        createGoalsAndInitiativesLayout_SP(template);
    } else if (rule.useRegressionLayout_DA) {
        // <-- ADD THIS BLOCK
        createRegressionLayout_DA(template);
    } else if (rule.useParetoLayout) {
        createParetoLayout(template);
    } else if (rule.useProcessMappingLayout) {
        createProcessMappingLayout(template);
    } else if (rule.useSystemGoalsLayout) {
        createSystemGoalsLayout(template);
    } else if (rule.useSystemThinkingLayout) {
        createSystemThinkingLayout(template);
    } else if (rule.useSemAnalysisLayout) {
        createSemAnalysisLayout(template);
    } else if (rule.usePredictiveAnalysisLayout) {
        createPredictiveAnalysisLayout(template);
    } else if (rule.useDematelLayout) {
        createDematelLayout(template);
    } else {
        createDefaultLayout(template, rule);
    }
    navigateTo("templateDetail");
}



function createDefaultLayout(template, rule) {
    // --- Default Layout Handling (Rebuilds the DOM for consistency) ---
    const contentContainer = $("templateDetailContent");
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
    populateDefaultFormFields(currentTemplateId);

    // Restore from cache or set default
    if (analysisCache[currentTemplateId]) {
        $("analysisResult").innerHTML = analysisCache[currentTemplateId];
        $("analysisActions").classList.remove("hidden");
        reattachTabListeners($("analysisResult"));
    } else {
        $("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        $("analysisActions").classList.add("hidden");
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
    $("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();
    configureFrameworkSelector(currentSelectionLimit);
}



function populateDefaultFormFields(templateId) {
    const templateFormFields = $("templateFormFields");
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

        const fileInput = $("companyDocumentsFile");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = $("companyDocumentsFileLabel");
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
