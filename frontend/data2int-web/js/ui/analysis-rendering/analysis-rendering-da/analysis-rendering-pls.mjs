import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';

/**
 * RENDERER: PLS-SEM (v7 - 3-Tab Focused Version)
 * - Renders a 3-tab interface: "Path Model", "Measurement Model Assessment", "Learn PLS-SEM".
 * - Calls a new helper `renderPlsMeasurementTab` to populate the new tab.
 * - This version implements the user's "Critical Priority 9/10" request.
 */
function renderPlsPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading

    // --- Enhanced Validation (still important) ---
    if (!data || !data.model_evaluation || !data.path_coefficients || !data.reliability_validity || !data.business_recommendations || !data.userInput ||
        !data.discriminant_validity_htmt || !data.discriminant_validity_fornell_larcker) {
        console.error("Incomplete data passed to renderPlsPage_DA (v7):", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. The backend is missing required fields like 'discriminant_validity_htmt' or 'model_evaluation'.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    const {
        model_evaluation,
        path_coefficients,
        reliability_validity,
        business_recommendations,
        userInput,
        discriminant_validity_htmt,
        discriminant_validity_fornell_larcker,
        path_diagram // This is an HTML string with an <img> tag
    } = data;
    const constructNames = reliability_validity.map(c => c.construct);

    // --- 3-Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="diagram">🧬 Path Model</button>
        <button class="analysis-tab-btn" data-tab="measurement">🔬 Measurement Model</button>
        <button class="analysis-tab-btn" data-tab="structural">📊 Structural Results</button>
        <button class="analysis-tab-btn" data-tab="diagnostics">🔍 Model Diagnostics</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn PLS-SEM</button>
    `;
    container.appendChild(tabNav);

    // --- 3-Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="diagramPanel" class="analysis-tab-panel active"></div>
        <div id="measurementPanel" class="analysis-tab-panel"></div>
        <div id="structuralPanel" class="analysis-tab-panel"></div>
        <div id="diagnosticsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Path Diagram Panel ---
    const diagramPanel = dom.$("diagramPanel");
    if (data.diagram_available && data.path_diagram) {
        diagramPanel.innerHTML = data.path_diagram;
        console.log("✅ Rendering backend-generated PNG diagram.");
        
        // Add error handling just in case
        setTimeout(() => {
            const imgElement = diagramPanel.querySelector('img');
            if (imgElement) {
                imgElement.addEventListener('error', (e) => {
                    console.warn('PNG diagram image failed to load:', e);
                    diagramPanel.innerHTML = `
                        <div class="p-4 text-center text-yellow-400">
                            <p>⚠️ Diagram image failed to load.</p>
                            <p class="text-xs text-white/60">The backend data may be corrupted.</p>
                        </div>`;
                });
            } else if (!diagramPanel.innerHTML.includes("img")) {
                 console.warn("Diagram content loaded, but no <img> tag was found.");
                 diagramPanel.innerHTML = `
                        <div class="p-4 text-center text-yellow-400">
                            <p>⚠️ Diagram content loaded, but no <img> tag was found.</p>
                            <p class="text-xs text-white/60">Backend may not have returned a valid image.</p>
                        </div>`;
            }
        }, 500); 
    } else {
        console.log("⚠️ Graphviz diagram not available (diagram_available=false or path_diagram=null).");
        diagramPanel.innerHTML = `<div class="p-4 text-center text-white/60">Path diagram data is not available. The backend did not provide a graph.</div>`;
    }

    // --- 2. Populate NEW Measurement Model Panel ---
    const measurementPanel = dom.$("measurementPanel");
    // Call the new helper function
    measurementPanel.innerHTML = renderPlsMeasurementTab(
        reliability_validity,
        discriminant_validity_htmt,
        discriminant_validity_fornell_larcker,
        data.outer_loadings_json // This will be undefined, but we pass it anyway
    );

    // --- 3. Populate NEW Structural Results Panel ---
    const structuralPanel = dom.$("structuralPanel");
    structuralPanel.innerHTML = renderPlsStructuralTab(
        data.path_coefficients,
        data.model_evaluation,
        data.userInput,
        data.bootstrap_results
    );

    // --- 4. Populate NEW Model Diagnostics Panel ---
    const diagnosticsPanel = dom.$("diagnosticsPanel");
    diagnosticsPanel.innerHTML = renderPlsDiagnosticsTab(
        data.data_summary,
        data.model_evaluation,
        data.reliability_validity,
        data.path_coefficients,
        data.bootstrap_results
    );

    // --- 5. Populate Learn PLS-SEM Tab (Enhanced Version) ---
const learnPanel = dom.$("learnPanel");
learnPanel.innerHTML = `
<div class="p-6 space-y-6 text-white/90">
    <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding PLS-SEM</h3>
    
    <!-- When to Use PLS-SEM vs Alternatives -->
    <div class="bg-black/20 p-4 rounded-lg border border-blue-500/30">
        <h4 class="text-lg font-bold mb-3 text-blue-300">🤔 When to Use PLS-SEM vs. Alternatives</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-green-900/20 p-3 rounded border border-green-500/30">
                <h5 class="font-bold text-green-300 mb-2">✅ Use PLS-SEM When:</h5>
                <ul class="text-sm space-y-1">
                    <li>• <strong>Exploratory research:</strong> Testing new theories or relationships</li>
                    <li>• <strong>Complex models:</strong> Many constructs (5+) and indicators (20+)</li>
                    <li>• <strong>Prediction focus:</strong> Goal is predicting key outcomes</li>
                    <li>• <strong>Small samples:</strong> Less than 200 observations</li>
                    <li>• <strong>Non-normal data:</strong> Skewed or non-parametric distributions</li>
                    <li>• <strong>Formative measures:</strong> Indicators cause the construct</li>
                </ul>
            </div>
            
            <div class="bg-red-900/20 p-3 rounded border border-red-500/30">
                <h5 class="font-bold text-red-300 mb-2">❌ Use CB-SEM Instead When:</h5>
                <ul class="text-sm space-y-1">
                    <li>• <strong>Theory testing:</strong> Confirming well-established models</li>
                    <li>• <strong>Model comparison:</strong> Testing competing theoretical models</li>
                    <li>• <strong>Global fit focus:</strong> Need overall model fit indices</li>
                    <li>• <strong>Large samples:</strong> 300+ observations available</li>
                    <li>• <strong>Normal data:</strong> Multivariate normality assumptions met</li>
                    <li>• <strong>Simple models:</strong> Few constructs, well-established measures</li>
                </ul>
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-yellow-900/20 rounded border border-yellow-500/30">
            <h5 class="font-bold text-yellow-300 mb-2">⚡ Other Alternatives:</h5>
            <div class="text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
                <div><strong>Multiple Regression:</strong> Single outcome, linear relationships</div>
                <div><strong>Factor Analysis:</strong> Just measurement model validation</div>
                <div><strong>Path Analysis:</strong> Observed variables only, no latents</div>
                <div><strong>Machine Learning:</strong> Pure prediction, no theory testing</div>
            </div>
        </div>
    </div>
    
    <!-- Practical Model Specification Tips -->
    <div class="bg-black/20 p-4 rounded-lg border border-purple-500/30">
        <h4 class="text-lg font-bold mb-3 text-purple-300">🛠️ Practical Model Specification Tips</h4>
        
        <div class="space-y-4">
            <div class="bg-white/5 p-3 rounded">
                <h5 class="font-semibold text-white mb-2">📋 Measurement Model Best Practices:</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>3+ indicators per construct:</strong> Minimum for identification</li>
                    <li>• <strong>Avoid single-item measures:</strong> Unless unavoidable (e.g., age)</li>
                    <li>• <strong>Similar response scales:</strong> Mix of Likert scales can cause issues</li>
                    <li>• <strong>Clear wording:</strong> Avoid double-barreled or complex items</li>
                    <li>• <strong>Balanced scales:</strong> Include both positive and negative items when possible</li>
                </ul>
            </div>
            
            <div class="bg-white/5 p-3 rounded">
                <h5 class="font-semibold text-white mb-2">🏗️ Structural Model Design:</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>Theoretical justification:</strong> Every path should have literature support</li>
                    <li>• <strong>Avoid kitchen sink models:</strong> Include only theoretically relevant constructs</li>
                    <li>• <strong>Consider mediation:</strong> Test indirect effects when theoretically meaningful</li>
                    <li>• <strong>Control variables:</strong> Include demographic or contextual controls</li>
                    <li>• <strong>Alternative models:</strong> Test competing theoretical explanations</li>
                </ul>
            </div>
            
            <div class="bg-white/5 p-3 rounded">
                <h5 class="font-semibold text-white mb-2">⚠️ Common Specification Errors:</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>Reflective vs. Formative confusion:</strong> Most constructs are reflective</li>
                    <li>• <strong>Multicollinearity:</strong> Highly correlated predictors (r > 0.9)</li>
                    <li>• <strong>Missing pathways:</strong> Omitting theoretically important relationships</li>
                    <li>• <strong>Cross-loadings:</strong> Indicators loading on multiple constructs</li>
                    <li>• <strong>Endogeneity:</strong> Ignoring reverse causation possibilities</li>
                </ul>
            </div>
        </div>
    </div>
    
    <!-- Enhanced Interpretation Guide -->
    <div class="bg-black/20 p-4 rounded-lg border border-green-500/30">
        <h4 class="text-lg font-bold mb-3 text-green-300">📊 Practical Interpretation Guidelines</h4>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="space-y-3">
                <div>
                    <h5 class="font-semibold mb-2">Effect Sizes (Cohen's Guidelines)</h5>
                    <div class="text-sm space-y-1 text-white/80">
                        <div><strong>Path Coefficients (β):</strong></div>
                        <div class="ml-4">• Small: |0.10| - |0.29|</div>
                        <div class="ml-4">• Medium: |0.30| - |0.49|</div> 
                        <div class="ml-4">• Large: |0.50|+</div>
                    </div>
                </div>
                
                <div>
                    <h5 class="font-semibold mb-2">R² Interpretation</h5>
                    <div class="text-sm space-y-1 text-white/80">
                        <div>• <strong>0.75+:</strong> Substantial (excellent)</div>
                        <div>• <strong>0.50-0.74:</strong> Moderate (good)</div>
                        <div>• <strong>0.25-0.49:</strong> Weak (acceptable)</div>
                        <div>• <strong>&lt;0.25:</strong> Very weak (concerning)</div>
                    </div>
                </div>
                
                <div>
                    <h5 class="font-semibold mb-2">Statistical Significance</h5>
                    <div class="text-sm space-y-1 text-white/80">
                        <div>• <strong>p &lt; 0.001:</strong> *** (highly significant)</div>
                        <div>• <strong>p &lt; 0.01:</strong> ** (very significant)</div>
                        <div>• <strong>p &lt; 0.05:</strong> * (significant)</div>
                        <div>• <strong>p ≥ 0.05:</strong> Not significant</div>
                    </div>
                </div>
            </div>
            
            <div class="space-y-3">
                <div>
                    <h5 class="font-semibold mb-2">Reporting Best Practices</h5>
                    <ul class="text-sm space-y-1 text-white/80">
                        <li>• Report both β and p-values for all paths</li>
                        <li>• Include confidence intervals when available</li>
                        <li>• Discuss practical vs. statistical significance</li>
                        <li>• Address alternative explanations</li>
                        <li>• Acknowledge model limitations</li>
                    </ul>
                </div>
                
                <div>
                    <h5 class="font-semibold mb-2">Sample Size Guidelines</h5>
                    <div class="text-sm space-y-1 text-white/80">
                        <div><strong>Minimum rules:</strong></div>
                        <div class="ml-4">• 5-10 cases per indicator</div>
                        <div class="ml-4">• 10 times largest # of indicators</div>
                        <div class="ml-4">• Absolute minimum: 50 cases</div>
                        <div class="ml-4">• Recommended: 100+ cases</div>
                    </div>
                </div>
                
                <div>
                    <h5 class="font-semibold mb-2">Validation Strategies</h5>
                    <ul class="text-sm space-y-1 text-white/80">
                        <li>• Split-sample validation (if N > 200)</li>
                        <li>• Cross-industry replication</li>
                        <li>• Temporal stability testing</li>
                        <li>• Alternative model comparison</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    
    <!-- What is PLS-SEM (Condensed) -->
    <div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-2 text-indigo-300">What is PLS-SEM?</h4>
        <p class="text-sm text-white/80">Partial Least Squares Structural Equation Modeling (PLS-SEM) is a statistical method for testing complex cause-and-effect relationships between observed and latent variables. Unlike traditional regression, it can handle multiple dependent variables, indirect effects, and measurement error simultaneously.</p>
    </div>
    
    <details class="styled-details text-sm">
        <summary class="font-semibold cursor-pointer hover:text-blue-300">📚 Additional Resources & Further Reading</summary>
        <div class="bg-black/20 p-4 rounded-b-lg space-y-2 text-white/80">
            <div><strong>Key Books:</strong></div>
            <ul class="ml-4 space-y-1 text-sm">
                <li>• Hair et al. (2021) - A Primer on Partial Least Squares SEM (4th ed.)</li>
                <li>• Sarstedt & Ringle (2020) - Partial Least Squares SEM using SmartPLS</li>
                <li>• Henseler et al. (2016) - Handbook of PLS-SEM</li>
            </ul>
            <div class="mt-3"><strong>Software Alternatives:</strong></div>
            <ul class="ml-4 space-y-1 text-sm">
                <li>• SmartPLS (Commercial, user-friendly GUI)</li>
                <li>• R packages: semPLS, plspm, SEMinR</li>
                <li>• Python: plspm, scikit-learn PLS</li>
            </ul>
        </div>
    </details>
</div>
`;

    // --- Tab Switching Logic ---
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    // --- Final Setup ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result
    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
}

/**
 * --- UPDATED HELPER FUNCTION (v2) ---
 * Renders the new "Measurement Model Assessment" tab content.
 * - FIX: Now reads `data.outer_loadings_json` to build the Factor Loadings table.
 * @param {object} reliability_validity - Data for the reliability table.
 * @param {object} htmt_data - Data for the HTMT matrix.
 * @param {object} fornell_larcker_data - Data for the Fornell-Larcker matrix.
 * @param {object} outer_loadings_data - The new JSON-friendly object.
 * @returns {string} HTML string for the tab
 */
function renderPlsMeasurementTab(reliability_validity, htmt_data, fornell_larcker_data, outer_loadings_data) {
    let html = `<div class="p-4 space-y-8">`;
    let reliabilityHtml = "";
    let validityHtml = "";
    let loadingsHtml = "";

    // --- 1. Reliability Section (Unchanged) ---
    if (reliability_validity && reliability_validity.length > 0) {
        reliabilityHtml = `
            <h3 class="text-2xl font-bold mb-3">Construct Reliability & Convergent Validity</h3>
            <div class="overflow-x-auto">
                <table class="coeff-table styled-table text-sm">
                    <thead>
                        <tr>
                            <th>Construct</th>
                            <th title="Internal Consistency Reliability">Cronbach's Alpha (>0.7)</th>
                            <th title="Internal Consistency Reliability">Composite Reliability (CR >0.7)</th>
                            <th title="Convergent Validity">Avg. Variance Extracted (AVE >0.5)</th>
                        </tr>
                    </thead>
                    <tbody>`;
        reliability_validity.forEach((r) => {
            const alphaOk = (r.cronbachs_alpha ?? 0) >= 0.7;
            const crOk = (r.composite_reliability ?? 0) >= 0.7;
            const aveOk = (r.ave ?? 0) >= 0.5;
            const crClass = crOk ? 'text-green-300' : 'text-red-300 font-bold'; // Highlight bad CR
            
            reliabilityHtml += `
                <tr>
                    <td class="font-semibold">${r.construct || "N/A"}</td>
                    <td class="${alphaOk ? 'text-green-300' : 'text-red-300'}">${(r.cronbachs_alpha ?? 0).toFixed(3)} ${alphaOk ? '✓' : '✗'}</td>
                    <td class="${crClass}">${(r.composite_reliability ?? 0).toFixed(3)} ${crOk ? '✓' : '✗'}</td>
                    <td class="${aveOk ? 'text-green-300' : 'text-red-300'}">${(r.ave ?? 0).toFixed(3)} ${aveOk ? '✓' : '✗'}</td>
                </tr>`;
        });
        reliabilityHtml += `</tbody></table>
            <p class="text-xs text-white/60 mt-2">✓ Meets common threshold, ✗ Below common threshold.</p>
        </div>`;
    } else {
        reliabilityHtml = `<p class="text-white/60">Reliability data is not available.</p>`;
    }

    // --- 2. Factor Loadings Section (NOW READS JSON) ---
    loadingsHtml = `<h3 class="text-2xl font-bold mb-3 mt-8">Factor Loadings (Outer Model)</h3>`;
    if (outer_loadings_data && outer_loadings_data.headers && outer_loadings_data.rows) {
        loadingsHtml += `<p class="text-sm text-white/70 mb-4 italic">Shows how strongly each indicator (item) loads onto its construct. Loadings **> 0.7** are ideal. Loadings **< 0.4** (red) should be considered for removal.</p>`;
        loadingsHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                        <thead><tr><th>Indicator</th>`;
        
        const headers = outer_loadings_data.headers;
        headers.forEach(h => { loadingsHtml += `<th>${h}</th>`; });
        loadingsHtml += `</tr></thead><tbody>`;

        outer_loadings_data.rows.forEach(row => {
            loadingsHtml += `<tr><td class="font-semibold">${row.indicator}</td>`;
            headers.forEach(h => {
                const val = row[h];
                let cellHtml = 'N/A';
                if (val !== null && val !== undefined) {
                    const valNum = parseFloat(val);
                    // Highlight significant loadings (> 0.7) in green
                    // Highlight weak loadings (< 0.4) in red
                    const valClass = valNum >= 0.7 ? 'text-green-300 font-bold' : (valNum < 0.4 ? 'text-red-400' : 'text-white/80');
                    cellHtml = `<span class="${valClass}">${val.toFixed(3)}</span>`;
                }
                loadingsHtml += `<td>${cellHtml}</td>`;
            });
            loadingsHtml += `</tr>`;
        });
        loadingsHtml += `</tbody></table></div>`;
    } else {
        // This message will show if the backend modification wasn't made
        loadingsHtml += `
            <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <h4 class="text-lg font-bold text-yellow-300">Data Not Available on Frontend</h4>
                <p class="text-sm text-white/80 mt-2">Factor loadings were not received from the backend. This requires a small modification to <code>pls_analysis.py</code> in the <code>perform_pls_sem</code> function to pass the 'outer_loadings_df' to the frontend as a JSON object.</p>
            </div>
        `;
    }

    // --- 3. HTMT Section (Unchanged) ---
    validityHtml += `<div>
        <h3 class="text-2xl font-bold mb-2 mt-8">Discriminant Validity - HTMT Ratio</h3>
        <p class="text-sm text-white/70 mb-4 italic">Checks if constructs are distinct. Values **below 0.90** (or 0.85) indicate good discriminant validity.</p>
        <div class="overflow-x-auto">
            <table class="coeff-table styled-table text-sm">`;
    if (htmt_data && htmt_data.headers && htmt_data.rows) {
        validityHtml += `<thead><tr><th></th>`; // Empty top-left cell
        htmt_data.headers.forEach(h => { validityHtml += `<th>${h}</th>`; });
        validityHtml += `</tr></thead><tbody>`;
        // In the HTMT section of renderPlsMeasurementTab
        htmt_data.rows.forEach(row => {
            validityHtml += `<tr><td class="font-semibold">${row.construct}</td>`;
            htmt_data.headers.forEach(h => {
                const val = row[h];
                if (val === null || val === undefined || row.construct === h) {
                    // Empty cell for diagonal or missing values
                    validityHtml += `<td class="bg-black/20 text-center">—</td>`; 
                } else {
                    const isBad = val >= 0.90;
                    validityHtml += `<td class="${isBad ? 'text-red-300 font-bold' : 'text-green-300'}">${val.toFixed(3)} ${isBad ? '✗' : '✓'}</td>`;
                }
                });
            validityHtml += `</tr>`;
        });
        validityHtml += `</tbody>`;
    } else {
        validityHtml += `<tbody><tr><td class="text-center text-white/60 italic p-4">HTMT data not available.</td></tr></tbody>`;
    }
    validityHtml += `</table></div></div>`;

    // --- 4. Fornell-Larcker Section (Unchanged) ---
    validityHtml += `<div class="mt-8">
        <h3 class="text-2xl font-bold mb-2">Discriminant Validity - Fornell-Larcker Criterion</h3>
        <p class="text-sm text-white/70 mb-4 italic">The **diagonal value (bolded)** in each column should be the **highest** value in that column.</p>
        <div class="overflow-x-auto">
            <table class="coeff-table styled-table text-sm">`;
    if (fornell_larcker_data && fornell_larcker_data.headers && fornell_larcker_data.rows) {
        validityHtml += `<thead><tr><th></th>`; // Empty top-left cell
        fornell_larcker_data.headers.forEach(h => { validityHtml += `<th>${h}</th>`; });
        validityHtml += `</tr></thead><tbody>`;

        fornell_larcker_data.rows.forEach(row => {
            validityHtml += `<tr><td class="font-semibold">${row.construct}</td>`;
            for (const h of fornell_larcker_data.headers) {
                const val = row[h];
                if (val === null || val === undefined) {
                    validityHtml += `<td class="bg-black/20"></td>`; // Empty cells
                } else {
                    const isDiagonal = row.construct === h;
                    let isHighest = true;
                    if (isDiagonal) {
                        for (const r of fornell_larcker_data.rows) {
                            if (r.construct !== h && r[h] > val) {
                                isHighest = false;
                                break;
                            }
                        }
                    }
                    const valStr = val.toFixed(3);
                    if (isDiagonal) {
                        validityHtml += `<td class="${isHighest ? 'text-green-300' : 'text-red-300'} font-bold">${valStr} ${isHighest ? '✓' : '✗'}</td>`;
                    } else {
                        validityHtml += `<td class="text-white/70">${valStr}</td>`;
                    }
                }
            }
            validityHtml += `</tr>`;
        });
        validityHtml += `</tbody>`;
    } else {
        validityHtml += `<tbody><tr><td class="text-center text-white/60 italic p-4">Fornell-Larcker data not available.</td></tr></tbody>`;
    }
    validityHtml += `</table></div></div>`;
    
    // Assemble the tab
    html += reliabilityHtml + loadingsHtml + validityHtml;
    html += `</div>`; // Close p-4
    return html;
}

/**
 * Renders the Structural Model Results tab content
 * @param {array} path_coefficients - Path results with coefficients and significance
 * @param {object} model_evaluation - R-squared values and model fit
 * @param {object} userInput - Original model syntax for hypothesis mapping
 * @param {object} bootstrap_results - Bootstrap info for confidence intervals
 * @returns {string} HTML string for the structural results tab
 */
function renderPlsStructuralTab(path_coefficients, model_evaluation, userInput, bootstrap_results) {
    let html = `<div class="p-4 space-y-6">`;
    
    // Header
    html += `<h3 class="text-2xl font-bold text-center mb-4">📊 Structural Model Results</h3>`;
    
    // --- 1. Path Coefficients Table with Effect Sizes ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-blue-300">🛤️ Path Coefficients & Effect Sizes</h4>
        
        <div class="overflow-x-auto">
            <table class="coeff-table styled-table text-sm">
                <thead>
                    <tr>
                        <th>Structural Path</th>
                        <th>Path Coefficient (β)</th>
                        <th>Effect Size</th>
                        <th>t-Statistic</th>
                        <th>p-Value</th>
                        <th>Significance</th>
                        <th>95% CI</th>
                    </tr>
                </thead>
                <tbody>`;
    
    if (path_coefficients && path_coefficients.length > 0) {
        path_coefficients.forEach(path => {
            const coeff = path.coefficient || 0;
            const absCoeff = Math.abs(coeff);
            
            // Cohen's guidelines for effect sizes
            let effectSize, effectColor;
            if (absCoeff >= 0.5) {
                effectSize = "Large";
                effectColor = "text-green-300 font-bold";
            } else if (absCoeff >= 0.3) {
                effectSize = "Medium";
                effectColor = "text-yellow-300 font-semibold";
            } else if (absCoeff >= 0.1) {
                effectSize = "Small";
                effectColor = "text-orange-300";
            } else {
                effectSize = "Negligible";
                effectColor = "text-red-300";
            }
            
            const isSignificant = path.significant === true;
            const pValue = path.p_value;
            const tStat = path.t_statistic;
            
            // Significance stars
            let sigStars = "";
            if (pValue !== null && pValue < 0.001) sigStars = "***";
            else if (pValue !== null && pValue < 0.01) sigStars = "**";
            else if (pValue !== null && pValue < 0.05) sigStars = "*";
            
            // Confidence interval (approximate)
            let ciText = "N/A";
            if (bootstrap_results?.available && tStat !== null) {
                const margin = 1.96 * Math.abs(coeff / tStat); // Rough approximation
                const lowerCI = coeff - margin;
                const upperCI = coeff + margin;
                ciText = `[${lowerCI.toFixed(3)}, ${upperCI.toFixed(3)}]`;
            }
            
            html += `
                <tr>
                    <td class="font-semibold">${path.path}</td>
                    <td class="text-center font-bold ${coeff >= 0 ? 'text-green-300' : 'text-red-300'}">${coeff.toFixed(3)}${sigStars}</td>
                    <td class="text-center ${effectColor}">${effectSize}</td>
                    <td class="text-center">${tStat !== null ? tStat.toFixed(3) : 'N/A'}</td>
                    <td class="text-center">${pValue !== null ? pValue.toFixed(3) : 'N/A'}</td>
                    <td class="text-center ${isSignificant ? 'text-green-300 font-bold' : 'text-red-300'}">${isSignificant ? '✓ Yes' : '✗ No'}</td>
                    <td class="text-center text-xs">${ciText}</td>
                </tr>`;
        });
    } else {
        html += `<tr><td colspan="7" class="text-center text-white/60 italic">No path coefficients available</td></tr>`;
    }
    
    html += `</tbody></table></div>
        
        <div class="mt-3 text-xs text-white/60">
            <p><strong>Effect Size Guidelines:</strong> Small (0.1+), Medium (0.3+), Large (0.5+) | 
            <strong>Significance:</strong> * p < 0.05, ** p < 0.01, *** p < 0.001</p>
        </div>
    </div>`;
    
    // --- 2. R-Squared Values for Endogenous Constructs ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-green-300">📈 Explained Variance (R²)</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
    
    if (model_evaluation?.r_squared_values) {
        model_evaluation.r_squared_values.forEach(rsq => {
            if (rsq.r_squared > 0) { // Only show endogenous constructs
                const percentage = (rsq.r_squared * 100).toFixed(1);
                let strength, color;
                
                if (rsq.r_squared >= 0.75) {
                    strength = "Substantial";
                    color = "text-green-300";
                } else if (rsq.r_squared >= 0.50) {
                    strength = "Moderate";
                    color = "text-yellow-300";
                } else if (rsq.r_squared >= 0.25) {
                    strength = "Weak";
                    color = "text-orange-300";
                } else {
                    strength = "Very Weak";
                    color = "text-red-300";
                }
                
                html += `<div class="bg-black/20 p-4 rounded-lg">
                    <div class="text-lg font-bold">${rsq.variable}</div>
                    <div class="text-2xl font-bold ${color}">${percentage}%</div>
                    <div class="text-sm text-white/70">${strength} explanatory power</div>
                    <div class="text-xs text-white/60 mt-1">R² = ${rsq.r_squared.toFixed(3)}</div>
                </div>`;
            }
        });
    }
    
    html += `</div></div>`;
    
    // --- 3. Hypothesis Testing Summary ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-purple-300">🧪 Hypothesis Testing Summary</h4>
        
        <div class="space-y-3">`;
    
    if (path_coefficients && path_coefficients.length > 0) {
        let supportedCount = 0;
        
        path_coefficients.forEach((path, index) => {
            const isSignificant = path.significant === true;
            const coeff = path.coefficient || 0;
            const absCoeff = Math.abs(coeff);
            
            // Consider hypothesis supported if significant AND meaningful effect size
            const meaningfulEffect = absCoeff >= 0.1;
            const supported = isSignificant && meaningfulEffect;
            
            if (supported) supportedCount++;
            
            html += `<div class="flex justify-between items-center p-3 rounded-lg ${supported ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}">
                <div>
                    <div class="font-semibold">H${index + 1}: ${path.path}</div>
                    <div class="text-sm text-white/70">Expected ${coeff >= 0 ? 'positive' : 'negative'} relationship</div>
                </div>
                <div class="text-right">
                    <div class="${supported ? 'text-green-300 font-bold' : 'text-red-300'} text-lg">
                        ${supported ? '✓ SUPPORTED' : '✗ NOT SUPPORTED'}
                    </div>
                    <div class="text-xs text-white/60">
                        β = ${coeff.toFixed(3)}, p = ${path.p_value !== null ? path.p_value.toFixed(3) : 'N/A'}
                    </div>
                </div>
            </div>`;
        });
        
        // Summary stats
        const supportRate = ((supportedCount / path_coefficients.length) * 100).toFixed(0);
        html += `<div class="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
            <div class="text-lg font-bold">${supportedCount}/${path_coefficients.length} hypotheses supported (${supportRate}%)</div>
            <div class="text-sm text-white/70">Based on statistical significance (p < 0.05) and meaningful effect size (|β| ≥ 0.1)</div>
        </div>`;
    }
    
    html += `</div></div>`;
    
    // --- 4. Interpretation & Implications ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-yellow-300">💡 Key Findings & Implications</h4>
        
        <div class="space-y-4">`;
    
    if (path_coefficients && path_coefficients.length > 0) {
        // Find strongest relationship
        const strongestPath = path_coefficients.reduce((prev, current) => 
            Math.abs(current.coefficient || 0) > Math.abs(prev.coefficient || 0) ? current : prev
        );
        
        html += `<div class="p-3 bg-blue-900/20 rounded">
            <h5 class="font-semibold text-blue-300">🏆 Strongest Relationship</h5>
            <p class="text-white/80">${strongestPath.path} (β = ${(strongestPath.coefficient || 0).toFixed(3)}) 
            shows the strongest ${strongestPath.coefficient >= 0 ? 'positive' : 'negative'} effect in your model.</p>
        </div>`;
        
        // Count significant paths
        const significantPaths = path_coefficients.filter(p => p.significant === true);
        if (significantPaths.length > 0) {
            html += `<div class="p-3 bg-green-900/20 rounded">
                <h5 class="font-semibold text-green-300">✓ Confirmed Relationships</h5>
                <p class="text-white/80">Your model confirms ${significantPaths.length} significant relationship${significantPaths.length > 1 ? 's' : ''}, 
                providing empirical support for these theoretical connections.</p>
            </div>`;
        }
    }
    
    html += `<div class="p-3 bg-amber-900/20 rounded">
        <h5 class="font-semibold text-amber-300">📊 Model Performance</h5>
        <p class="text-white/80">Your structural model explains varying levels of variance in the endogenous constructs. 
        Consider the practical significance of these relationships in addition to statistical significance.</p>
    </div>`;
    
    html += `</div></div>`;
    
    html += `</div>`; // Close main container
    return html;
}

/**
 * Renders the Model Diagnostics tab content
 * @param {object} data_summary - Data quality and cleaning info
 * @param {object} model_evaluation - R-squared and fit indices
 * @param {array} reliability_validity - Construct reliability data
 * @param {array} path_coefficients - Path results with significance
 * @param {object} bootstrap_data - Bootstrap results if available
 * @returns {string} HTML string for the diagnostics tab
 */
function renderPlsDiagnosticsTab(data_summary, model_evaluation, reliability_validity, path_coefficients, bootstrap_data) {
    let html = `<div class="p-4 space-y-6">`;
    
    // Header
    html += `<h3 class="text-2xl font-bold text-center mb-4">🔍 Model Diagnostics</h3>`;
    
    // --- 1. Data Quality Check ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-blue-300">📊 Data Quality Assessment</h4>`;
    
    if (data_summary) {
        const dataLoss = data_summary.total_rows - data_summary.analysis_rows;
        const dataLossPercent = (dataLoss / data_summary.total_rows * 100).toFixed(1);
        
        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Original Rows</div>
                <div class="text-xl font-bold">${data_summary.total_rows}</div>
            </div>
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Analysis Rows</div>
                <div class="text-xl font-bold ${dataLoss > 0 ? 'text-yellow-300' : 'text-green-300'}">${data_summary.analysis_rows}</div>
            </div>
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Data Loss</div>
                <div class="text-xl font-bold ${dataLossPercent > 10 ? 'text-red-300' : dataLossPercent > 5 ? 'text-yellow-300' : 'text-green-300'}">${dataLossPercent}%</div>
            </div>
        </div>`;
        
        // Sample size adequacy
        const minSample = Math.max(50, data_summary.variables?.length * 5 || 50);
        const sampleAdequate = data_summary.analysis_rows >= minSample;
        
        html += `<div class="p-3 rounded ${sampleAdequate ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}">
            <div class="font-semibold ${sampleAdequate ? 'text-green-300' : 'text-red-300'}">
                Sample Size: ${sampleAdequate ? '✓ Adequate' : '⚠ May be insufficient'}
            </div>
            <div class="text-sm text-white/80">
                Current: ${data_summary.analysis_rows} | Recommended minimum: ${minSample}
            </div>
        </div>`;
    }
    
    html += `</div>`;
    
    // --- 2. Model Fit Summary ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-green-300">🎯 Model Fit Summary</h4>`;
    
    if (model_evaluation?.r_squared_values) {
        html += `<div class="grid grid-cols-1 md:grid-cols-${model_evaluation.r_squared_values.length} gap-4 mb-4">`;
        
        model_evaluation.r_squared_values.forEach(rsq => {
            const strength = rsq.r_squared >= 0.75 ? 'Strong' : rsq.r_squared >= 0.50 ? 'Moderate' : rsq.r_squared >= 0.25 ? 'Weak' : 'Very Weak';
            const color = rsq.r_squared >= 0.50 ? 'text-green-300' : rsq.r_squared >= 0.25 ? 'text-yellow-300' : 'text-red-300';
            
            html += `<div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">${rsq.variable} R²</div>
                <div class="text-xl font-bold ${color}">${(rsq.r_squared * 100).toFixed(1)}%</div>
                <div class="text-xs text-white/60">${strength}</div>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Reliability summary
    if (reliability_validity?.length) {
        const avgAlpha = (reliability_validity.reduce((sum, r) => sum + (r.cronbachs_alpha || 0), 0) / reliability_validity.length).toFixed(3);
        const avgCR = (reliability_validity.reduce((sum, r) => sum + (r.composite_reliability || 0), 0) / reliability_validity.length).toFixed(3);
        const avgAVE = (reliability_validity.reduce((sum, r) => sum + (r.ave || 0), 0) / reliability_validity.length).toFixed(3);
        
        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Avg. Cronbach's α</div>
                <div class="text-lg font-bold ${avgAlpha >= 0.7 ? 'text-green-300' : 'text-red-300'}">${avgAlpha}</div>
            </div>
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Avg. Composite Reliability</div>
                <div class="text-lg font-bold ${avgCR >= 0.7 ? 'text-green-300' : 'text-red-300'}">${avgCR}</div>
            </div>
            <div class="bg-black/20 p-3 rounded">
                <div class="text-sm text-white/70">Avg. AVE</div>
                <div class="text-lg font-bold ${avgAVE >= 0.5 ? 'text-green-300' : 'text-red-300'}">${avgAVE}</div>
            </div>
        </div>`;
    }
    
    html += `</div>`;
    
    // --- 3. Path Significance Summary ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-purple-300">🛤️ Path Significance Summary</h4>`;
    
    if (path_coefficients?.length) {
        const significantPaths = path_coefficients.filter(p => p.significant === true).length;
        const totalPaths = path_coefficients.length;
        const significanceRate = ((significantPaths / totalPaths) * 100).toFixed(0);
        
        html += `<div class="mb-4">
            <div class="text-lg font-semibold">
                ${significantPaths}/${totalPaths} paths significant (${significanceRate}%)
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: ${significanceRate}%"></div>
            </div>
        </div>`;
        
        html += `<div class="space-y-2">`;
        path_coefficients.forEach(path => {
            const isSignificant = path.significant === true;
            const icon = isSignificant ? '✓' : '✗';
            const color = isSignificant ? 'text-green-300' : 'text-red-300';
            
            html += `<div class="flex justify-between items-center p-2 bg-black/20 rounded">
                <span class="font-medium">${path.path}</span>
                <div class="flex items-center gap-2">
                    <span class="text-white/80">β = ${(path.coefficient || 0).toFixed(3)}</span>
                    ${path.p_value !== null ? `<span class="text-xs text-white/60">p = ${path.p_value.toFixed(3)}</span>` : ''}
                    <span class="${color} font-bold">${icon}</span>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    html += `</div>`;
    
    // --- 4. Interpretation Guide ---
    html += `<div class="bg-white/5 p-4 rounded-lg border border-white/10">
        <h4 class="text-lg font-bold mb-3 text-yellow-300">📚 Interpretation Guide</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <h5 class="font-semibold mb-2">R² (Explained Variance)</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>0.75+:</strong> Substantial</li>
                    <li>• <strong>0.50-0.74:</strong> Moderate</li>
                    <li>• <strong>0.25-0.49:</strong> Weak</li>
                    <li>• <strong>&lt;0.25:</strong> Very weak</li>
                </ul>
            </div>
            
            <div>
                <h5 class="font-semibold mb-2">Reliability Thresholds</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>Cronbach's α:</strong> &gt;0.7</li>
                    <li>• <strong>Composite Reliability:</strong> &gt;0.7</li>
                    <li>• <strong>AVE:</strong> &gt;0.5</li>
                    <li>• <strong>Factor Loadings:</strong> &gt;0.7 ideal</li>
                </ul>
            </div>
            
            <div>
                <h5 class="font-semibold mb-2">Discriminant Validity</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>HTMT:</strong> &lt;0.90 (liberal) or &lt;0.85 (conservative)</li>
                    <li>• <strong>Fornell-Larcker:</strong> √AVE &gt; correlations</li>
                </ul>
            </div>
            
            <div>
                <h5 class="font-semibold mb-2">Sample Size</h5>
                <ul class="text-sm space-y-1 text-white/80">
                    <li>• <strong>Minimum:</strong> 5-10 cases per indicator</li>
                    <li>• <strong>Recommended:</strong> 100+ cases</li>
                    <li>• <strong>Complex models:</strong> 200+ cases</li>
                </ul>
            </div>
        </div>
    </div>`;
    
    html += `</div>`; // Close main container
    return html;
}

export {
    renderPlsPage_DA
}