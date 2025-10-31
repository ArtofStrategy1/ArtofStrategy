// =====================================================================================================
// ===================            SEM Analysis Page Rendering Functions             ====================
// =====================================================================================================

import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';


/**
 * Sets up the tab structure for SEM results ('Estimates', 'Model Fit', 'Effects', 'Diagnostics', 'Comparison', 'Diagram', 'Learn SEM').
 * Calls specific functions to render content into each tab panel.
 * @param {HTMLElement} container - The main container element for results.
 * @param {object} data - Data from the backend (contains CSV strings, DOT string, or error).
 */
function renderSemAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear previous content or loading indicator

    // --- Create Tab Navigation (Added Comparison Tab) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="results">📋 Estimates</button>
        <button class="analysis-tab-btn" data-tab="fit">📊 Model Fit</button>
        <button class="analysis-tab-btn" data-tab="effects">✨ Effects</button>
        <button class="analysis-tab-btn" data-tab="diagnostics">⚠️ Diagnostics</button>
        <button class="analysis-tab-btn" data-tab="comparison">🔄 Comparison</button>
        <button class="analysis-tab-btn" data-tab="diagram">📈 Path Diagram</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn SEM</button>
       `;
    container.appendChild(tabNav);

    // --- Create Tab Content Panels (Added Comparison Panel) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="resultsPanel" class="analysis-tab-panel active p-6"></div>
        <div id="fitPanel" class="analysis-tab-panel p-6"></div>
        <div id="effectsPanel" class="analysis-tab-panel p-6"></div>
        <div id="diagnosticsPanel" class="analysis-tab-panel p-6"></div>
        <div id="comparisonPanel" class="analysis-tab-panel p-6"></div>
        <div id="diagramPanel" class="analysis-tab-panel p-6"></div>
        <div id="learnPanel" class="analysis-tab-panel p-6"></div>
       `;

    // --- Render Content into Panels (Added call to renderSemComparisonTab) ---
    renderSemResultsTab("resultsPanel", data);      // Render parameter estimates
    renderSemFitTab("fitPanel", data);              // Render fit statistics
    renderSemEffectsTab("effectsPanel");            // Render effects explanation
    renderSemDiagnosticsTab("diagnosticsPanel", data.warnings); // Render diagnostics info
    renderSemComparisonTab("comparisonPanel");      // --- NEW --- Render model comparison explanation
    renderSemDiagramTab("diagramPanel", data.path_diagram_dot);
    renderLearnSemTab("learnPanel");                // Render general SEM info

    // --- Cache and Display Actions ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
    const actionsEl = dom.$("analysisActions");
    if (actionsEl) actionsEl.classList.remove("hidden");

    // --- Add Tab Switching Logic (No change needed here) ---
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" && !e.target.classList.contains('active')) {
            // Deactivate all buttons and panels
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate the clicked button and corresponding panel
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // Optional: Resize Plotly charts
                const chart = targetPanel.querySelector(".plotly-chart");
                if (chart && typeof Plotly !== 'undefined') {
                    try { Plotly.Plots.resize(chart); } catch (resizeError) { console.error("Plotly resize error:", resizeError); }
                }

                // Resize/fit viz.js diagram
                 const svgContainer = targetPanel.querySelector("svg");
                 if (svgContainer && targetPanelId === 'diagramPanel') {
                     // No specific resize needed for viz.js SVG
                 }
            }
        }
    });
}

/**
 * --- UPDATED FUNCTION (using viz.js) ---
 * Renders the SEM Path Diagram from a DOT string, including an explanatory section.
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {string} dotString - The pre-styled DOT language string from the backend.
 */
function renderSemDiagramTab(containerId, dotString) {
    const container = dom.$(containerId);
    if (!container) return;

    // --- Start HTML with the Explanation ---
    let html = `
        <div class="mb-8 bg-green-900/20 p-6 rounded-lg border border-green-500/30">
            <h4 class="text-2xl font-bold mb-4 text-green-300">📈 Understanding the Path Diagram</h4>
            <p class="text-white/80 mb-4">This diagram visually represents the relationships in your SEM model. Here's how to interpret it:</p>
            <ul class="list-none space-y-3 text-white/90">
                <li class="flex items-start">
                    <span class="font-bold w-40 shrink-0">Shapes:</span>
                    <span><strong>Ellipses/Circles</strong> represent latent (unobserved) variables (e.g., 'Marketing'). <strong>Rectangles</strong> represent observed variables (your actual data columns).</span>
                </li>
                <li class="flex items-start">
                    <span class="font-bold w-40 shrink-0">Arrows:</span>
                    <span><strong>Single-headed arrows (→)</strong> show hypothesized causal paths (regressions or factor loadings). The variable the arrow points *to* is predicted by the variable it comes *from*.</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-40 shrink-0">Numbers on Arrows:</span>
                    <span>These are the **standardized path coefficients (estimates)** showing the strength and direction of the relationship. Below them is the **p-value**, indicating statistical significance (typically p < 0.05 means significant).</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-40 shrink-0">Layout:</span>
                    <span>The arrangement (Top-to-Bottom) helps visualize the flow of influence based on your model specification.</span>
                </li>
            </ul>
        </div>
        <hr class="border-white/20 my-6">
        <h3 class="text-2xl font-bold mb-4">Your Model's Path Diagram</h3>
    `; // Added title for the diagram itself

    // --- Check for the Viz.js library ---
    console.log("--- Checking libraries inside renderSemDiagramTab ---");
    console.log("typeof Viz:", typeof Viz);
    
    if (typeof Viz === 'undefined') {
        console.error("Viz.js is not loaded.");
        html += `
            <div class="p-4">
                <p class="text-red-400"><strong>Error:</strong> Visualization library not loaded. (Viz is undefined)</p>
                {/* ... (rest of the library error message) ... */}
            </div>`;
        container.innerHTML = html; // Show explanation and error
        return;
    }

    // Check for the DOT string
    if (!dotString) {
        html += `<p class="text-yellow-400 p-4">Path diagram data is not available. This can happen if the model failed to fit or if diagram generation failed on the server.</p>`;
        container.innerHTML = html; // Show explanation and warning
        return;
    }

    // Add placeholder for the diagram rendering
    const graphId = "semGraphContainer_" + containerId;
    html += `<div id="${graphId}" class="w-full h-full min-h-[500px] flex justify-center items-center"><div class="text-white/70 p-8 text-center">Rendering path diagram...</div></div>`;
    container.innerHTML = html; // Set initial HTML including explanation and placeholder

    // --- Render the diagram into the placeholder ---
    try {
        const viz = new Viz();
        const graphContainer = dom.$(graphId); // Get the placeholder div

        viz.renderSVGElement(dotString)
            .then(function (svgElement) {
                // --- Success ---
                if (graphContainer) { // Check if container still exists
                    graphContainer.innerHTML = ""; // Clear "Rendering..." text
                    
                    svgElement.style.width = "100%";
                    svgElement.style.height = "100%";
                    // No styling needed as it comes pre-styled from backend

                    graphContainer.appendChild(svgElement);
                }
            })
            .catch(function (error) {
                // --- Render Error ---
                console.error("Viz.js rendering error:", error);
                 if (graphContainer) { // Check if container still exists
                    graphContainer.innerHTML = `<p class="text-red-400 p-4"><strong>Error rendering path diagram:</strong> ${error.message || 'Unknown error'}</p>`;
                 }
            });
    } catch (error) {
        // --- Initialization Error ---
        console.error("Error initializing Viz.js:", error);
         const graphContainer = dom.$(graphId);
         if (graphContainer) {
            graphContainer.innerHTML = `<p class="text-red-400 p-4"><strong>Error initializing path diagram:</strong> ${error.message}</p>`;
         }
    }
}

/**
 * --- UPDATED FUNCTION ---
 * Parses CSV data for fit indices, adds explanatory text, and renders them.
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {object} data - Backend response containing 'fit_indices_csv_content' or an 'error'.
 */
function renderSemFitTab(containerId, data) {
    const container = dom.$(containerId);
    if (!container) return;

    // --- Start HTML with the Explanation ---
    let html = `
        <div class="mb-8 bg-indigo-900/20 p-6 rounded-lg border border-indigo-500/30">
            <h4 class="text-2xl font-bold mb-4 text-indigo-300">📊 Assessing Model Fit</h4>
            <p class="text-white/80 mb-4">These statistics check how well your theoretical model matches the actual structure of your data. Look at multiple indices together:</p>
            <ul class="list-none space-y-3 text-white/90">
                <li class="flex items-start">
                    <span class="font-bold w-28 shrink-0">Chi-Square (χ²):</span>
                    <span>Tests exact fit. A **non-significant p-value (> 0.05)** suggests good fit (model matches data), but it's sensitive to large samples.</span>
                </li>
                <li class="flex items-start">
                    <span class="font-bold w-28 shrink-0">CFI / TLI:</span>
                    <span>Compare your model to a baseline. **≥ 0.95 is good fit.**</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-28 shrink-0">RMSEA:</span>
                    <span>Error per degree of freedom. **≤ 0.06 is good fit**, ≤ 0.08 is acceptable.</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-28 shrink-0">SRMR:</span>
                    <span>Average residual correlation. **≤ 0.08 is good fit.**</span>
                </li>
            </ul>
        </div>
        <hr class="border-white/20 my-6">
        <h3 class="text-2xl font-bold mb-4">Your Model's Fit Indices</h3>
    `; // Added title for the results grid

    // --- Now add the results grid (or error message) ---
    if (data.error) {
        html += `<p class="text-red-400 p-4"><strong>Analysis Error prevented fit calculation:</strong> ${data.error}</p>`;
    } else if (typeof data.fit_indices_csv_content !== 'string') {
        html += `<p class="text-yellow-400 p-4">Warning: Model fit indices are missing or invalid in the backend response.</p>`;
        console.warn("Missing/invalid fit_indices_csv_content:", data);
    } else {
        try {
            if (typeof Papa === 'undefined') {
                 throw new Error("PapaParse library is not loaded.");
            }
            const fitIndicesConfig = { header: true, skipEmptyLines: true, dynamicTyping: true };
            const fitIndicesResult = Papa.parse(data.fit_indices_csv_content, fitIndicesConfig);

            if (fitIndicesResult.errors.length > 0) throw new Error(`Error parsing fit indices CSV: ${fitIndicesResult.errors[0].message}`);

            const fitIndices = fitIndicesResult.data.length > 0 ? fitIndicesResult.data[0] : {};

            html += renderFitIndices(fitIndices); // Use helper for fit indices grid

            // Add warnings related to fit if any exist
            if (data.warnings) {
                html += `<h4 class="text-lg font-semibold mt-6 mb-2">Warnings:</h4><ul class="list-disc list-inside text-yellow-300 text-sm">`;
                for (const key in data.warnings) {
                     html += `<li><strong>${key.replace(/_/g, ' ')}:</strong> ${data.warnings[key]}</li>`;
                }
                 html += `</ul>`;
            }
        } catch (error) {
            console.error("Error displaying SEM fit indices:", error);
            html += `<p class="text-red-400 p-4"><strong>Error displaying fit indices:</strong> ${error.message}</p>`;
        }
    }

    container.innerHTML = html; // Set the final HTML for the tab
}

/**
 * --- UPDATED FUNCTION ---
 * Renders the SEM parameter estimates tab, including an explanation,
 * variable lists, and the main estimates table.
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {object} data - Backend response containing estimates, fit indices, variables, or an 'error'.
 */
function renderSemResultsTab(containerId, data) {
    const container = dom.$(containerId);
    if (!container) return; // Exit if container not found

    // --- Start HTML with the Explanation ---
    let html = `
        <div class="mb-8 bg-blue-900/20 p-6 rounded-lg border border-blue-500/30">
            <h4 class="text-2xl font-bold mb-4 text-blue-300">📋 Understanding Parameter Estimates</h4>
            <p class="text-white/80 mb-4">This table shows the calculated strength and significance of each relationship (path) in your model. Key columns include:</p>
            <ul class="list-none space-y-3 text-white/90 text-sm">
                <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">lval / rval:</span>
                    <span>The left-hand and right-hand variables involved in the relationship.</span>
                </li>
                <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">op:</span>
                    <span>The operator defining the relationship type: <code>=~</code> (measurement/loading), <code>~</code> (regression/path), <code>~~</code> (variance/covariance).</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">Estimate:</span>
                    <span>The calculated **standardized path coefficient**. It indicates the strength and direction of the relationship in standard deviation units (e.g., a 1 SD change in predictor leads to X SD change in outcome). **Makes effects comparable** across different paths.</span>
                 </li>
                 <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">Std. Err:</span>
                    <span>The standard error of the estimate, indicating its precision (lower is better).</span>
                 </li>
                 <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">z-value:</span>
                    <span>The estimate divided by its standard error. Used to test significance.</span>
                 </li>
                 <li class="flex items-start">
                    <span class="font-bold w-24 shrink-0">p-value:</span>
                    <span>The probability of observing the relationship if there were truly no effect. A **p-value < 0.05** is typically considered statistically significant, suggesting the relationship is unlikely due to chance.</span>
                </li>
            </ul>
             <p class="text-xs text-white/60 mt-4"><em>(Note: These estimates are standardized because the input data was scaled before analysis.)</em></p>
        </div>
        <hr class="border-white/20 my-6">
    `;
    // --- END MODIFIED SECTION ---

    // Display error message if present in data
    if (data.error) {
        html += `<p class="text-red-400 p-4"><strong>Analysis Error:</strong> ${data.error}</p>`;
        container.innerHTML = html; // Show explanation and error
        return;
    }

    // Display Observed and Latent Variables
    if (data.model_variables) {
        const observedVars = data.model_variables.observed || [];
        const latentVars = data.model_variables.latent || [];

        html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                    <h4 class="text-lg font-semibold mb-2 text-blue-300">Observed Variables (${observedVars.length})</h4>
                    <p class="text-xs text-white/70 break-words">${observedVars.join(', ') || 'None'}</p>
                </div>
                <div class="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30">
                    <h4 class="text-lg font-semibold mb-2 text-purple-300">Latent Variables (${latentVars.length})</h4>
                    <p class="text-xs text-white/70 break-words">${latentVars.join(', ') || 'None'}</p>
                </div>
            </div>
            <hr class="border-white/20 my-6">
        `;
    }

    // Validate estimates CSV content
    if (typeof data.estimates_csv_content !== 'string') {
        html += `<p class="text-yellow-400 p-4">Warning: SEM parameter estimates are incomplete or missing.</p>`;
        console.warn("Missing/invalid estimates_csv_content:", data);
        container.innerHTML = html; // Show explanation, variables, and warning
        return;
    }

    try {
        // --- Parse Estimates CSV Data ---
        if (typeof Papa === 'undefined') {
             throw new Error("PapaParse library is not loaded.");
        }
        const estimatesConfig = { header: true, skipEmptyLines: true, dynamicTyping: true };
        const estimatesResult = Papa.parse(data.estimates_csv_content, estimatesConfig);
        if (estimatesResult.errors.length > 0) throw new Error(`Error parsing estimates CSV: ${estimatesResult.errors[0].message}`);
        const estimates = estimatesResult.data;

        // --- Build HTML Output for Estimates Table ---
        html += `<h3 class="text-2xl font-bold mb-4">Parameter Estimates Table</h3>`; // Added 'Table' to title
        html += renderHtmlTable(estimates); // Use helper for estimates table

        container.innerHTML = html; // Set the final combined HTML

    } catch (error) { // Catch errors during parsing or rendering helpers
        console.error("Error displaying SEM results:", error);
        // Append error message to existing HTML
        html += `<p class="text-red-400 p-4"><strong>Error displaying estimate results:</strong> ${error.message}</p>`;
        container.innerHTML = html;
    }
}

/**
 * --- NEW FUNCTION ---
 * Renders the explanation for Total, Direct, and Indirect Effects (Mediation).
 * @param {string} containerId - The ID of the HTML element to render into.
 */
function renderSemEffectsTab(containerId) {
    const container = dom.$(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="bg-teal-900/20 p-6 rounded-lg border border-teal-500/30">
            <h4 class="text-2xl font-bold mb-4 text-teal-300">✨ Total, Direct & Indirect Effects (Mediation)</h4>
            <p class="text-white/80 mb-4">When a variable (X) influences another variable (Y) *through* an intermediate variable (M), this is called **mediation**. Analyzing effects helps understand these pathways:</p>
            <ul class="list-none space-y-3 text-white/90 text-sm mb-6">
                <li class="flex items-start">
                    <span class="font-bold w-32 shrink-0">Direct Effect:</span>
                    <span>The influence of X directly on Y, ignoring any mediators (e.g., the path X → Y).</span>
                </li>
                <li class="flex items-start">
                    <span class="font-bold w-32 shrink-0">Indirect Effect(s):</span>
                    <span>The influence of X on Y that flows *through* one or more mediators (M). Calculated by multiplying the path coefficients along the indirect route (e.g., X → M * M → Y).</span>
                </li>
                 <li class="flex items-start">
                    <span class="font-bold w-32 shrink-0">Total Effect:</span>
                    <span>The overall impact of X on Y, combining both the direct and all indirect effects. (Total = Direct + Indirect).</span>
                </li>
            </ul>

            <h5 class="font-semibold text-lg mb-2 text-teal-300">Example Decomposition:</h5>
            <pre class="bg-black/20 p-4 rounded text-sm text-white/90 mb-4 whitespace-pre-wrap">
Marketing → Profit
├── Direct Effect:         -0.026 (non-significant)
├── Indirect via Online_Sales: 0.318
├── Indirect via Retail_Sales: -0.009
└── TOTAL Effect:           0.309 ✓

Proportion Mediated: ≈100% (complete mediation because direct is non-sig.)</pre>

            <h5 class="font-semibold text-lg mb-2 text-teal-300">What it Tells You:</h5>
             <ul class="list-disc list-inside text-white/80 space-y-1 text-sm">
                 <li><strong>How much** of the effect is direct vs. mediated through other variables.</li>
                 <li>The **actual total impact** of a predictor on an outcome, which is often crucial for business decisions.</li>
                 <li>Helps validate (or refute) your **mediation story** – does the intermediate variable truly act as a pathway?</li>
            </ul>
             <p class="text-xs text-white/60 mt-4"><em>(Note: Calculating these effects often requires specific commands or post-estimation analysis in SEM software. They are derived from the standard path estimates.)</em></p>
        </div>
    `;
}

/**
 * --- NEW FUNCTION ---
 * Renders diagnostic information, focusing on warnings like high correlation.
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {object | null} warnings - The warnings object from the backend response, or null if none.
 */
function renderSemDiagnosticsTab(containerId, warnings) {
    const container = dom.$(containerId);
    if (!container) return;

    let html = `<h3 class="text-2xl font-bold mb-4">⚠️ Model Diagnostics & Warnings</h3>`;

    if (!warnings || Object.keys(warnings).length === 0) {
        html += `<div class="p-4 rounded-lg bg-green-900/20 border border-green-500/30 text-green-300">
                    <p>✅ No major warnings detected during the analysis.</p>
                 </div>`;
        container.innerHTML = html;
        return;
    }

    // --- Display High Correlation Warning Specifically ---
    if (warnings.high_correlation) {
        html += `
            <div class="mb-6 bg-yellow-900/30 p-6 rounded-lg border border-yellow-500/30">
                <h4 class="text-xl font-bold mb-3 text-yellow-300">High Correlation Detected (Multicollinearity Warning)</h4>
                <p class="text-white/80 mb-2">The analysis found very high correlations (typically > 0.85 or 0.90) between some of your observed variables:</p>
                <pre class="bg-black/20 p-3 rounded text-sm text-yellow-200 mb-4 whitespace-pre-wrap">${warnings.high_correlation}</pre>
                <h5 class="font-semibold mb-1 text-white/90">Potential Issues:</h5>
                <ul class="list-disc list-inside text-white/80 space-y-1 text-sm mb-3">
                    <li><strong>Unstable Estimates:</strong> Path coefficients (Estimates) might change drastically with small data changes.</li>
                    <li><strong>Inflated Standard Errors:</strong> This can make it harder to find statistically significant relationships (higher p-values), even if a real effect exists.</li>
                    <li><strong>Interpretation Difficulty:</strong> It's hard to isolate the unique effect of one highly correlated variable from the other.</li>
                </ul>
                <h5 class="font-semibold mb-1 text-white/90">Possible Actions:</h5>
                 <ul class="list-disc list-inside text-white/80 space-y-1 text-sm">
                    <li><strong>Review Theory:</strong> Do these variables measure very similar concepts? Is it expected?</li>
                    <li><strong>Combine Variables:</strong> If theoretically sound, consider creating a composite score or factor from the highly correlated variables.</li>
                    <li><strong>Remove Variable(s):</strong> If two variables are redundant, consider removing one, but only if justified by theory (don't remove just to fix the statistic).</li>
                    <li><strong>Acknowledge Limitation:</strong> If removal/combination isn't appropriate, report the high correlation as a limitation when interpreting the results.</li>
                </ul>
            </div>
        `;
    }

    // --- Display Other Warnings ---
    html += `<h4 class="text-xl font-semibold mt-6 mb-3">Other Warnings:</h4>`;
    let otherWarningsFound = false;
    for (const key in warnings) {
        if (key !== 'high_correlation') { // Skip the one we already handled
             otherWarningsFound = true;
             html += `<div class="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                        <h5 class="font-bold text-red-300">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</h5>
                        <p class="text-white/80 text-sm">${warnings[key]}</p>
                      </div>`;
        }
    }

    if (!otherWarningsFound) {
        html += `<p class="text-white/70 text-sm italic">No other specific warnings were generated.</p>`;
    }

    container.innerHTML = html;
}

/**
 * --- NEW FUNCTION ---
 * Renders the explanation for Model Comparison in SEM.
 * @param {string} containerId - The ID of the HTML element to render into.
 */
function renderSemComparisonTab(containerId) {
    const container = dom.$(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="bg-orange-900/20 p-6 rounded-lg border border-orange-500/30">
            <h4 class="text-2xl font-bold mb-4 text-orange-300">🔄 Comparing Alternative Models</h4>
            <p class="text-white/80 mb-4">Often, there isn't just one single "correct" model. Theory might suggest several plausible ways variables relate. Model comparison helps you determine which specified model best fits your data among a set of alternatives.</p>

            <h5 class="font-semibold text-lg mb-2 text-orange-300">Why Compare Models?</h5>
            <ul class="list-disc list-inside text-white/80 space-y-1 text-sm mb-4">
                <li><strong>Test Competing Theories:</strong> See which theoretical structure is better supported by the data.</li>
                <li><strong>Assess Mediation/Moderation:</strong> Compare a model with mediation paths to one without, or test different moderation effects.</li>
                <li><strong>Improve Parsimony:</strong> Determine if adding or removing paths significantly improves or worsens model fit relative to the change in complexity.</li>
                <li><strong>Refine Understanding:</strong> Explore nuances in relationships by testing slightly different model specifications.</li>
            </ul>

            <h5 class="font-semibold text-lg mb-2 text-orange-300">Common Comparison Methods:</h5>
            <ul class="list-disc list-inside text-white/80 space-y-1 text-sm mb-4">
                <li><strong>Nested Model Comparison (Chi-Square Difference Test):</strong> Used when one model is a simpler version of another (e.g., Model B is Model A with some paths removed). A significant Chi-Square difference suggests the more complex model fits significantly better.</li>
                <li><strong>Information Criteria (AIC, BIC):</strong> Used for comparing non-nested models (models that aren't subsets of each other). The model with the **lower** AIC or BIC value is generally preferred, balancing fit and complexity. BIC penalizes complexity more heavily.</li>
                <li><strong>Comparing Fit Indices:</strong> While not a formal test, you can compare indices like CFI, TLI, RMSEA across models. Look for meaningful improvements in fit alongside theoretical justification.</li>
            </ul>

            <h5 class="font-semibold text-lg mb-2 text-orange-300">How to Do It Here:</h5>
            <p class="text-white/80 text-sm">Currently, this tool runs one model at a time. To compare models:</p>
            <ol class="list-decimal list-inside text-white/80 space-y-1 text-sm">
                <li>Run your first model specification and note its fit indices (especially Chi-Square, AIC, BIC if available).</li>
                <li>Modify the Measurement or Structural Syntax text boxes to define your alternative model.</li>
                <li>Run the analysis again with the same data.</li>
                <li>Compare the fit indices between the runs. Use the guidelines above (Chi-Square difference, lower AIC/BIC) to help decide which model is preferable.</li>
            </ol>
             <p class="text-xs text-white/60 mt-4"><em>(Note: Rigorous model comparison should always be guided by theory, not just statistical fit.)</em></p>
        </div>
    `;
}

/**
 * Renders the static 'Learn SEM' content into the specified container.
 * @param {string} containerId - The ID of the HTML element to render into.
 */
function renderLearnSemTab(containerId) {
    const container = dom.$(containerId);
    if (!container) return; // Exit if container not found

    // Static HTML content explaining SEM
    container.innerHTML = `
        <h3 class="text-3xl font-bold mb-6">🎓 Understanding SEM Analysis</h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div class="md:col-span-2 space-y-6">
                <div>
                    <h4 class="text-xl font-bold mb-3">🧠 What is SEM?</h4>
                    <p class="text-white/80 mb-2">Structural Equation Modeling is a powerful statistical technique that allows researchers to test complex theoretical models. It essentially combines:</p>
                    <ul class="list-disc list-inside text-white/80 space-y-1">
                        <li><strong>Factor Analysis:</strong> To understand how well observed variables (like survey items) measure underlying unobserved concepts (latent variables or constructs). This is the <strong>Measurement Model</strong>.</li>
                        <li><strong>Path Analysis / Regression:</strong> To examine the direct and indirect causal relationships hypothesized between different constructs (latent or observed). This is the <strong>Structural Model</strong>.</li>
                    </ul>
                     <p class="text-white/80 mt-2">It allows testing the entire model simultaneously, providing a holistic view of relationships.</p>
                </div>
                <div>
                    <h4 class="text-xl font-bold mb-3">🎯 Common Business Applications:</h4>
                    <ul class="list-disc list-inside text-white/80 space-y-1">
                        <li><strong>Customer Satisfaction/Loyalty:</strong> Modeling drivers like service quality, price perception, and brand image.</li>
                        <li><strong>Employee Engagement:</strong> Understanding factors like leadership, work environment, and compensation.</li>
                        <li><strong>Brand Equity/Image:</strong> Assessing components like awareness, associations, and perceived quality.</li>
                        <li><strong>Marketing Mix Modeling:</strong> Evaluating the combined impact of advertising, promotions, etc., on sales or brand perception.</li>
                        <li><strong>Technology Acceptance:</strong> Testing models like TAM (Technology Acceptance Model).</li>
                        <li><strong>Supply Chain Performance:</strong> Analyzing relationships between supplier integration, logistics, and firm performance.</li>
                    </ul>
                </div>
            </div>

            <div class="md:col-span-1 bg-white/5 p-4 rounded-lg">
                <h4 class="text-xl font-bold mb-3">🔑 Key Components:</h4>
                <ul class="list-disc list-inside text-white/80 space-y-2">
                    <li>
                        <strong>Latent Variables (Ellipses):</strong>
                        <ul class="list-[circle] list-inside pl-4 text-sm">
                            <li>Unobserved concepts (e.g., 'Brand Loyalty').</li>
                            <li>Syntax: <code>Loyalty =~ item1 + item2</code></li>
                        </ul>
                    </li>
                    <li>
                        <strong>Observable Variables (Rectangles):</strong>
                        <ul class="list-[circle] list-inside pl-4 text-sm">
                            <li>Directly measured data (e.g., survey answers).</li>
                        </ul>
                    </li>
                     <li>
                        <strong>Measurement Paths (<code>=~</code>):</strong>
                        <ul class="list-[circle] list-inside pl-4 text-sm">
                             <li>Link latent variables to their indicators.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Structural Paths (<code>~</code>):</strong>
                         <ul class="list-[circle] list-inside pl-4 text-sm">
                            <li>Hypothesized causal relationships between variables.</li>
                        </ul>
                    </li>
                     <li>
                        <strong>Covariances (<code>~~</code>):</strong>
                         <ul class="list-[circle] list-inside pl-4 text-sm">
                            <li>Correlations without assumed causality.</li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>

        <div class="mb-8">
            <h4 class="text-xl font-bold mb-3">🔄 SEM Analysis Workflow:</h4>
            <ol class="list-decimal list-inside text-white/80 space-y-1">
                <li><strong>Model Specification:</strong> Define constructs and relationships based on theory using syntax.</li>
                <li><strong>Data Collection:</strong> Gather sufficient data (N > 200 often recommended).</li>
                <li><strong>Model Estimation:</strong> The software calculates path coefficients and error terms.</li>
                <li><strong>Model Evaluation:</strong> Assess how well the model fits the data using indices (χ², RMSEA, CFI, TLI, SRMR).</li>
                <li><strong>Interpretation:</strong> Examine significant paths and overall model fit.</li>
                <li><strong>Modification (Optional):</strong> Adjust model based on theory and modification indices if fit is poor.</li>
            </ol>
        </div>

        <div class="mb-8">
             <h4 class="text-xl font-bold mb-3">💡 Best Practices:</h4>
            <ul class="list-disc list-inside text-white/80 space-y-1">
                <li><strong>Theory Driven:</strong> Model specification should be based on existing research or strong logical arguments.</li>
                <li><strong>Sample Size:</strong> Ensure adequate sample size (rules of thumb: >200, or 10-20 per estimated parameter).</li>
                <li><strong>Indicators per Factor:</strong> Use at least 3, preferably 4+, indicators per latent variable for stability.</li>
                <li><strong>Model Fit:</strong> Aim for good fit across multiple indices (e.g., RMSEA ≤ 0.06, CFI/TLI ≥ 0.95, SRMR ≤ 0.08, non-significant χ² p-value > 0.05).</li>
                <li><strong>Parsimony:</strong> Prefer simpler models that fit well over overly complex ones.</li>
            </ul>
        </div>

        <details class="styled-details mt-8">
            <summary>🔧 Advanced SEM Tips</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-6">
                <div>
                    <h5 class="text-lg font-semibold text-white/90 mb-2">Model Building Strategy:</h5>
                    <ol class="list-decimal list-inside text-white/80 space-y-1">
                        <li>Start with the measurement model (CFA) to ensure constructs are well-defined before testing structural paths.</li>
                        <li>Gradually add structural paths based on theory.</li>
                        <li>Compare nested models using Chi-Square difference tests.</li>
                        <li>Consider alternative models and compare their fit.</li>
                    </ol>
                </div>
                <div>
                    <h5 class="text-lg font-semibold text-white/90 mb-2">⚠️ Common Pitfalls:</h5>
                    <ul class="list-disc list-inside text-white/80 space-y-1">
                        <li><strong>Overfitting:</strong> Specifying too many paths just to improve fit without theoretical justification.</li>
                        <li><strong>Multicollinearity:</strong> Very high correlations between predictor variables (check correlations > 0.85).</li>
                        <li><strong>Heywood Cases:</strong> Impossible results like negative variances ("error variance") or correlations > 1.0, often due to model misspecification or poor data.</li>
                        <li><strong>Identification Issues:</strong> The model has too few knowns (data points) to estimate the unknowns (parameters). Ensure df > 0.</li>
                    </ul>
                </div>
                <div>
                    <h5 class="text-lg font-semibold text-white/90 mb-2">🛠️ Troubleshooting Poor Fit:</h5>
                    <ul class="list-disc list-inside text-white/80 space-y-1">
                        <li><strong>Check Data:</strong> Look for outliers, non-normality (consider robust estimators like MLR or MLW), missing data patterns.</li>
                        <li><strong>Review Theory:</strong> Is the model theoretically sound? Are important paths missing?</li>
                        <li><strong>Examine Modification Indices:</strong> Suggest potential paths to add, but ONLY add those that make theoretical sense.</li>
                        <li><strong>Simplify Model:</strong> Remove non-significant paths or combine highly correlated constructs if justified.</li>
                        <li><strong>Check Measurement Model:</strong> Ensure indicators load strongly and cleanly onto their intended factors.</li>
                    </ul>
                </div>
            </div>
        </details>
    `;
}

    /**
 * Helper function to convert an array of objects (like parsed CSV data) into an HTML table.
 * @param {object[]} data - Array of row objects.
 * @returns {string} HTML string for the table.
 */
function renderHtmlTable(data) {
    if (!data || data.length === 0) return '<p class="text-white/70">No estimate data available.</p>';

    const headers = Object.keys(data[0]);
    let tableHtml = '<div class="overflow-x-auto"><table class="w-full text-left styled-table text-sm"><thead><tr>';
    headers.forEach(h => { tableHtml += `<th>${h}</th>`; });
    tableHtml += '</tr></thead><tbody>';

    data.forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(h => {
            let value = row[h];
            let displayValue = '';

            if (typeof value === 'number') {
                if (h.toLowerCase().includes('p-value') && value < 0.0001 && value >= 0) {
                    displayValue = "&lt; 0.0001"; // Use HTML entity
                } else if (value % 1 === 0) { // Integer
                    displayValue = value.toString();
                } else { // Decimal - default to 4 places for estimates/stats
                    const precision = (['Estimate', 'Std. Err', 'z-value'].includes(h)) ? 4 : 3;
                    displayValue = value.toFixed(precision);
                }
            } else if (value === null || value === undefined) {
                displayValue = '';
            } else if (value === '-') {
                displayValue = '—'; // Replace placeholder dash
            } else {
                displayValue = value.toString(); // Default to string
            }
            tableHtml += `<td>${displayValue}</td>`;
        });
        tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table></div>';
    return tableHtml;
}

    /**
 * Helper function to render fit indices object into a styled grid with interpretations.
 * @param {object} indices - Object containing fit index key-value pairs.
 * @returns {string} HTML string for the grid.
 */
function renderFitIndices(indices) {
    if (!indices || Object.keys(indices).length === 0) return '<p class="text-white/70">No fit indices available.</p>';

    // Configuration for common indices
    const config = {
        'chi2': { label: 'Chi-Square (χ²)', threshold: null, higherIsBetter: null, note: 'Model vs Data diff.' },
        'chi2 p-value': { label: 'χ² p-value', threshold: 0.05, higherIsBetter: true, note: 'Want > 0.05 (fit)' },
        'RMSEA': { label: 'RMSEA', threshold: 0.08, higherIsBetter: false, note: '< 0.08 Good, < 0.06 Exc.' },
        'CFI': { label: 'CFI', threshold: 0.90, higherIsBetter: true, note: '> 0.90 Accept, > 0.95 Good' },
        'TLI': { label: 'TLI', threshold: 0.90, higherIsBetter: true, note: '> 0.90 Accept, > 0.95 Good' },
        'SRMR': { label: 'SRMR', threshold: 0.08, higherIsBetter: false, note: '< 0.08 Good' },
        'AIC': { label: 'AIC', threshold: null, higherIsBetter: false, note: 'Lower is better (compare)' },
        'BIC': { label: 'BIC', threshold: null, higherIsBetter: false, note: 'Lower is better (compare)' },
        'DoF': { label: 'Degrees of Freedom', threshold: null, higherIsBetter: null, note: 'Model complexity' },
         // Add others as needed, e.g., GFI, AGFI if semopy provides them consistently
         'GFI': { label: 'GFI', threshold: 0.90, higherIsBetter: true, note: '> 0.90 Good' },
         'AGFI': { label: 'AGFI', threshold: 0.90, higherIsBetter: true, note: '> 0.90 Good' },
         'NFI': { label: 'NFI', threshold: 0.90, higherIsBetter: true, note: '> 0.90 Good' },
    };

    let gridHtml = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">';

    for (const key in indices) {
        if (indices.hasOwnProperty(key)) {
            const valueStr = indices[key];
            let valueNum = parseFloat(valueStr);
            if (isNaN(valueNum)) continue; // Skip non-numeric values

            const idxConfig = config[key] || {
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                threshold: null, higherIsBetter: null, note: ''
            };

            let interpretation = '', colorClass = 'bg-white/5'; // Default style

            // Determine interpretation and color based on threshold
            if (idxConfig.threshold !== null && idxConfig.higherIsBetter !== null) {
                const passesThreshold = (idxConfig.higherIsBetter && valueNum >= idxConfig.threshold) ||
                                       (!idxConfig.higherIsBetter && valueNum <= idxConfig.threshold);
                if (passesThreshold) {
                    interpretation = '✅ Good Fit';
                    colorClass = 'bg-green-600/10 text-green-300 border border-green-600/30';
                } else {
                    interpretation = '⚠️ Potential Issue';
                    colorClass = 'bg-yellow-600/10 text-yellow-300 border border-yellow-600/30';
                }
            }
             // Specific logic for p-value interpretation
             if (key === 'chi2 p-value') {
                if (valueNum >= 0.05) {
                    interpretation = '✅ Fits Data (p ≥ 0.05)';
                    colorClass = 'bg-green-600/10 text-green-300 border border-green-600/30';
                } else {
                    interpretation = '⚠️ Differs from Data (p < 0.05)';
                    colorClass = 'bg-yellow-600/10 text-yellow-300 border border-yellow-600/30';
                }
            }


            gridHtml += `
                <div class="p-3 rounded-lg ${colorClass}">
                    <p class="text-sm font-medium text-white/80">${idxConfig.label}</p>
                    <p class="text-xl font-bold text-white">${valueNum.toFixed(3)}</p>
                    ${interpretation ? `<p class="text-xs mt-1 font-semibold">${interpretation}</p>` : ''}
                    ${idxConfig.note ? `<p class="text-xs mt-1 text-white/60">${idxConfig.note}</p>` : ''}
                </div>`;
        }
    }
    gridHtml += '</div>';

    // Footer with general guidelines
    gridHtml += `
        <div class="mt-6 text-xs text-white/60 space-y-1">
            <p><strong>Note:</strong> Fit index interpretation depends on context (sample size, model complexity, theory). Thresholds are common guidelines.</p>
        </div>`;

    return gridHtml;
}

export {
    renderSemAnalysisPage
}