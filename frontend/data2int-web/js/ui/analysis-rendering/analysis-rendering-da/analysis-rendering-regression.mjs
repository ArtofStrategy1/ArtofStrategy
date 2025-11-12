import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';

/**
     * --- NEW RENDERER v5 (Null-Safe) ---
     * --- USER REQUESTED UPDATE V3 ---
     * - Changed residual plot marker color to bright yellow for visibility.
     *
     * This function is designed to render the rich output from
     * the new 'statsmodels' backend and safely handles
     * null/undefined values from the JSON.
     */
    function renderAdvancedRegressionPage(container, data) {
        container.innerHTML = ""; // Clear loading state

        /**
         * Safely formats a number for display, handling null/undefined.
         */
        function safeFormat(num, digits, defaultVal = 'N/A') {
            if (num === null || typeof num === 'undefined' || isNaN(num)) {
                return defaultVal;
            }
            if (digits > 2 && num > 0 && num < (1 / Math.pow(10, digits))) {
                return `< 0.${'0'.repeat(digits - 1)}1`;
            }
            return num.toFixed(digits);
        }

        // --- Validate the new data structure ---
        if (!data || !data.statsmodels_results || !data.statistical_analysis || !data.dataset_info) {
            console.error("Incomplete data passed to renderAdvancedRegressionPage:", data);
            container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received from the backend.</div>`;
            dom.$("analysisActions").classList.add("hidden");
            return;
        }

        const { statsmodels_results, sklearn_comparison, statistical_analysis, dataset_info } = data;
        const { model_summary, coefficients, diagnostics } = statsmodels_results;

        // --- Create Tab Navigation (8 Tabs) ---
        const tabNav = document.createElement("div");
        tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
        tabNav.innerHTML = `
            <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
            <button class="analysis-tab-btn" data-tab="coeffs">🔢 Coefficients</button>
            <button class="analysis-tab-btn" data-tab="diagnostics">⚠️ Diagnostics</button>
            <button class="analysis-tab-btn" data-tab="assumptions">🩺 Assumptions</button>
            <button class="analysis-tab-btn" data-tab="correlations">🔗 Correlations</button>
            <button class="analysis-tab-btn" data-tab="comparison">🔄 Model Comparison</button>
            <button class="analysis-tab-btn" data-tab="dataInfo">📋 Data Info</button>
            <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Regression</button> 
        `;
        container.appendChild(tabNav);

        // --- Create Tab Panels (8 Panels) ---
        const tabContent = document.createElement("div");
        container.appendChild(tabContent);
        tabContent.innerHTML = `
            <div id="dashboardPanel" class="analysis-tab-panel active"></div>
            <div id="coeffsPanel" class="analysis-tab-panel"></div>
            <div id="diagnosticsPanel" class="analysis-tab-panel"></div>
            <div id="assumptionsPanel" class="analysis-tab-panel"></div>
            <div id="correlationsPanel" class="analysis-tab-panel"></div>
            <div id="comparisonPanel" class="analysis-tab-panel"></div>
            <div id="dataInfoPanel" class="analysis-tab-panel"></div>
            <div id="learnPanel" class="analysis-tab-panel"></div>
        `;

        // --- 1. Populate Dashboard Panel ---
        const dashboardPanel = dom.$("dashboardPanel");
        const r2 = model_summary.r_squared ?? 0;
        const adj_r2 = model_summary.adj_r_squared ?? 0;
        const f_pvalue = model_summary.prob_f_statistic ?? 1.0;
        const f_stat = model_summary.f_statistic ?? 0;

        let dashboardHtml = `<div class="p-4 space-y-8">
            <h3 class="text-2xl font-bold text-center mb-4">Regression Dashboard (Statsmodels OLS)</h3>
            
            <div class="cascade-objective mb-6 text-center mx-auto max-w-4xl p-4">
                <h4 class="text-lg font-bold text-indigo-300">Regression Equation</h4>
                <p class="text-sm font-semibold break-words">${model_summary.equation}</p>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
                <div class="summary-stat-card">
                    <div class="stat-value text-green-400">${safeFormat(r2 * 100, 1)}%</div>
                    <div class="stat-label">R-Squared</div>
                </div>
                <div class="summary-stat-card">
                    <div class="stat-value text-green-400">${safeFormat(adj_r2 * 100, 1)}%</div>
                    <div class="stat-label">Adj. R-Squared</div>
                </div>
                <div class="summary-stat-card">
                    <div class="stat-value">${safeFormat(model_summary.observations, 0)}</div>
                    <div class="stat-label">Observations</div>
                </div>
                <div class="summary-stat-card">
                    <div class="stat-value">${safeFormat(f_stat, 2)}</div>
                    <div class="stat-label">F-Statistic</div>
                </div>
            </div>
            
            <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 max-w-4xl mx-auto">
                <strong>Model Fit Interpretation:</strong> 
                The model explains <strong>${safeFormat(adj_r2 * 100, 1)}%</strong> of the variance in <strong>${model_summary.dependent_variable}</strong> (Adj. R²). 
                The overall model is statistically <strong>${f_pvalue < 0.05 ? "significant" : "NOT significant"}</strong> 
                (F-stat p-value = ${safeFormat(f_pvalue, 3)}), suggesting the features
                ${f_pvalue < 0.05 ? "collectively have a real effect." : "do not reliably predict the target."}
            </blockquote>
        </div>`;
        dashboardPanel.innerHTML = dashboardHtml;

        // --- 2. Populate Coefficients Panel ---
        const coeffsPanel = dom.$("coeffsPanel");
        let coeffsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">Coefficient Details</h3>`;
        coeffsHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Variable</th>
                                    <th>Coefficient</th>
                                    <th>Std. Error</th>
                                    <th>t-Statistic</th>
                                    <th>P-value</th>
                                    <th>95% Conf. Interval</th>
                                </tr>
                            </thead>
                            <tbody>`;

        for (const c of coefficients) {
            const isSig = c.p_value !== null && typeof c.p_value !== 'undefined' && c.p_value < 0.05;
            const pValueDisplay = safeFormat(c.p_value, 3, 'N/A');
            const colorClass = isSig ? "text-green-300 font-bold" : "text-white/70";
            
            coeffsHtml += `<tr class="${colorClass}">
                                <td class="font-semibold">${c.variable}</td>
                                <td>${safeFormat(c.coefficient, 4)}</td>
                                <td>${safeFormat(c.std_error, 4)}</td>
                                <td>${safeFormat(c.t_statistic, 3)}</td>
                                <td>${pValueDisplay} ${isSig ? '***' : ''}</td>
                                <td>[${safeFormat(c.conf_int_low, 3)}, ${safeFormat(c.conf_int_high, 3)}]</td>
                           </tr>`;
        }
        coeffsHtml += `</tbody></table></div>
                       <p class="text-xs text-white/60 mt-4">*** Statistically significant at p < 0.05. Coefficients are *not* standardized.</p>
                       </div>`;
        coeffsPanel.innerHTML = coeffsHtml;

        // --- 3. Populate Assumptions Panel (Formerly Diagnostics) ---
        const assumptionsPanel = dom.$("assumptionsPanel");
        const bp_pvalue = diagnostics.breusch_pagan_pvalue.statistic ?? 1.0;
        const dw_stat = diagnostics.durbin_watson.statistic ?? 2.0;
        const jb_pvalue = diagnostics.jarque_bera_pvalue.statistic ?? 1.0;

        let assumpHtml = `<div class="p-4 space-y-8">
            <h3 class="text-2xl font-bold mb-4 text-center">Model Assumption Checks</h3>
            
            <div>
                <h4 class="text-xl font-semibold mb-2 text-center">Residuals vs. Predicted Plot</h4>
                <div id="residualsPlot" class="w-full h-[500px] plotly-chart bg-black/10 rounded-lg"></div>
                <p class="text-xs text-white/60 text-center mt-2"><strong>Goal:</strong> Look for random scatter around 0. Patterns (like a cone or a U-shape) indicate problems.</p>
            </div>
            
            <div>
                <h4 class="text-xl font-semibold mb-2 text-center">Statistical Tests</h4>
                <div class="overflow-x-auto max-w-3xl mx-auto">
                    <table class="coeff-table styled-table text-sm">
                        <thead>
                            <tr>
                                <th>Test</th>
                                <th>Statistic</th>
                                <th>Interpretation (p < 0.05 is Bad)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="font-semibold"><strong>Homoscedasticity (Breusch-Pagan)</strong><br><span class="text-xs text-white/60">Tests if residuals spread evenly.</span></td>
                                <td class="font-mono">${safeFormat(bp_pvalue, 3)}</td>
                                <td class="${bp_pvalue < 0.05 ? 'text-red-400' : 'text-green-300'}">${diagnostics.breusch_pagan_pvalue.interpretation}</td>
                            </tr>
                            <tr>
                                <td class="font-semibold"><strong>Autocorrelation (Durbin-Watson)</strong><br><span class="text-xs text-white/60">Tests if residuals are independent. (Want ~2.0)</span></td>
                                <td class="font-mono">${safeFormat(dw_stat, 3)}</td>
                                <td class="${(dw_stat < 1.5 || dw_stat > 2.5) ? 'text-red-400' : 'text-green-300'}">${diagnostics.durbin_watson.interpretation}</td>
                            </tr>
                            <tr>
                                <td class="font-semibold"><strong>Normality of Residuals (Jarque-Bera)</strong><br><span class="text-xs text-white/60">Tests if residuals form a bell curve.</span></td>
                                <td class="font-mono">${safeFormat(jb_pvalue, 3)}</td>
                                <td class="${jb_pvalue < 0.05 ? 'text-red-400' : 'text-green-300'}">${diagnostics.jarque_bera_pvalue.interpretation}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
        assumptionsPanel.innerHTML = assumpHtml;

        // Render Residuals Plot
        try {
            const residualsTrace = {
                x: diagnostics.residuals_plot_data.map(p => p.predicted),
                y: diagnostics.residuals_plot_data.map(p => p.residual),
                mode: 'markers', type: 'scatter', name: 'Residuals',
                // --- MODIFICATION 1 ---
                marker: { color: 'rgba(245, 158, 11, 0.7)', size: 8, line: { color: 'rgba(255,255,255,0.3)', width: 1 } }
            };
            const residualsLayout = {
                title: 'Residuals vs. Predicted Values',
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                xaxis: { title: 'Predicted Values', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
                yaxis: { title: 'Residuals', zeroline: true, zerolinecolor: 'var(--accent)', zerolinewidth: 2, gridcolor: 'rgba(255,255,255,0.1)' },
                margin: { t: 50, b: 50, l: 60, r: 30 }
            };
            Plotly.newPlot('residualsPlot', [residualsTrace], residualsLayout, { responsive: true });
        } catch(e) {
            console.error("Error rendering residuals plot:", e);
            dom.$("residualsPlot").innerHTML = `<div class="p-4 text-center text-red-400">Could not render residuals plot.</div>`;
        }

        // --- 4. Populate Correlations Panel ---
        const correlationsPanel = dom.$("correlationsPanel");
        let corrHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">Correlation with Target (${dataset_info.target_column})</h3>`;
        
        if (statistical_analysis.correlations) {
            corrHtml += `<div class="overflow-x-auto max-w-lg mx-auto">
                         <table class="coeff-table styled-table text-sm">
                            <thead><tr><th>Feature</th><th>Correlation Coefficient</th></tr></thead>
                            <tbody>`;
            const sortedCorrs = Object.entries(statistical_analysis.correlations)
                                    .sort(([, a], [, b]) => Math.abs(b ?? 0) - Math.abs(a ?? 0));
            for (const [feature, corr] of sortedCorrs) {
                const corrValue = corr ?? 0;
                let colorClass = "text-white/70";
                if (Math.abs(corrValue) > 0.7) colorClass = "text-green-300 font-bold";
                else if (Math.abs(corrValue) > 0.4) colorClass = "text-yellow-300";
                corrHtml += `<tr>
                                <td class="font-semibold">${feature}</td>
                                <td class="${colorClass}">${safeFormat(corrValue, 4)}</td>
                             </tr>`;
            }
            corrHtml += `</tbody></table></div>
                         <p class="text-xs text-white/60 text-center mt-4">Values close to +1.0 or -1.0 indicate a strong relationship.</p>`;
        } else if (statistical_analysis.error) {
            corrHtml += `<p class="text-center text-red-400 italic">Could not calculate correlations: ${statistical_analysis.error}</p>`;
        } else {
            corrHtml += `<p class="text-center text-white/70 italic">Correlation data not available.</p>`;
        }
        correlationsPanel.innerHTML = corrHtml;
        
        // --- 5. Populate Model Comparison Panel ---
        const comparisonPanel = dom.$("comparisonPanel");
        let compHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">Model Performance Comparison</h3>`;
        compHtml += `<p class="text-sm text-white/70 mb-4 text-center">Comparing Statsmodels OLS (for inference) vs. Sklearn models (for prediction).</p>`;
        compHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th>Test R-Squared (R²)</th>
                                    <th>Test RMSE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b-2 border-indigo-400">
                                    <td class="font-semibold">Statsmodels OLS</td>
                                    <td class="text-green-300 font-bold">${safeFormat(model_summary.r_squared, 4)}</td>
                                    <td>N/A (Full dataset used)</td>
                                </tr>`;

        // Sklearn Model Results
        for (const modelName in sklearn_comparison) {
            const result = sklearn_comparison[modelName];
            if (result.error) {
                compHtml += `<tr><td class="font-semibold">${modelName}</td><td colspan="2" class="text-red-400">${result.error}</td></tr>`;
            } else {
                compHtml += `<tr>
                                <td class="font-semibold">${modelName} (Sklearn)</td>
                                <td class="text-green-300 font-bold">${safeFormat(result.test_r2, 4)}</td>
                                <td>${safeFormat(result.test_rmse, 2)}</td>
                              </tr>`;
            }
        }
        compHtml += `</tbody></table></div>
                    <div class="mt-6 p-4 bg-black/20 rounded-lg border border-white/10">
                        <h4 class="text-lg font-bold text-indigo-300 mb-2">How to Interpret:</h4>
                        <ul class="list-disc list-inside space-y-1 text-sm text-white/80">
                            <li>Use <strong>Statsmodels OLS</strong> for p-values, diagnostics, and statistical *inference*.</li>
                            <li>Use <strong>Sklearn Models (e.g., Random Forest)</strong> for *predictive accuracy*. A higher Test R² here might mean better predictions, even if it's less interpretable.</li>
                            <li>If Random Forest R² is much higher than OLS R², it suggests your data has non-linear relationships that the linear model can't capture.</li>
                        </ul>
                    </div></div>`;
        comparisonPanel.innerHTML = compHtml;

        // --- 6. Populate Data Info Panel ---
        const dataInfoPanel = dom.$("dataInfoPanel");
        
        let targetStatsHtml = "";
        if (statistical_analysis.error) {
            targetStatsHtml = `<p class="text-sm text-red-400">Error during statistical analysis: ${statistical_analysis.error}</p>`;
        } else if (statistical_analysis.target_stats) {
            targetStatsHtml = `
                <p class="text-sm"><strong>Mean:</strong> ${safeFormat(statistical_analysis.target_stats.mean, 2)}</p>
                <p class="text-sm"><strong>Std. Dev:</strong> ${safeFormat(statistical_analysis.target_stats.std, 2)}</p>
                <p class="text-sm"><strong>Min:</strong> ${safeFormat(statistical_analysis.target_stats.min, 2)}</p>
                <p class="text-sm"><strong>Max:</strong> ${safeFormat(statistical_analysis.target_stats.max, 2)}</p>
            `;
        } else {
            targetStatsHtml = `<p class="text-sm text-white/70 italic">Target variable statistics not available.</p>`;
        }

        const originalFeatures = dataset_info.original_feature_columns || [];
        const finalFeatures = dataset_info.final_feature_columns_after_encoding || [];
        
        dataInfoPanel.innerHTML = `
            <div class="p-4 space-y-6">
                <h3 class="text-2xl font-bold mb-4 text-center">Analysis Data Summary</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                    <div class="summary-stat-card"><div class="stat-value">${safeFormat(dataset_info.original_rows, 0)}</div><div class="stat-label">Original Rows</div></div>
                    <div class="summary-stat-card"><div class="stat-value">${safeFormat(dataset_info.clean_rows, 0)}</div><div class="stat-label">Rows Used (After Clean)</div></div>
                    <div class="summary-stat-card"><div class="stat-value">${safeFormat(model_summary.observations, 0)}</div><div class="stat-label">Final Observations</div></div>
                    <div class="summary-stat-card"><div class="stat-value">${safeFormat(dataset_info.features_count, 0)}</div><div class="stat-label">Features Used</div></div>
                </div>
                <div class="bg-black/20 p-4 rounded-lg max-w-4xl mx-auto">
                    <h4 class="text-lg font-semibold mb-2">Target Variable: ${dataset_info.target_column}</h4>
                    ${targetStatsHtml}
                </div>
                <div class="bg-black/20 p-4 rounded-lg max-w-4xl mx-auto">
                    <h4 class="text-lg font-semibold mb-2">Original Features Submitted (${originalFeatures.length})</h4>
                    <p class="text-sm text-white/80"><strong>${originalFeatures.join(", ")}</strong></p>
                    
                    <h4 class="text-lg font-semibold mt-4 mb-2">Final Features Used (After Encoding: ${finalFeatures.length})</h4>
                    <p class="text-xs text-white/70">${finalFeatures.join(", ")}</p>
                </div>
            </div>`;

        // --- 7. Populate Learn Panel ---
        renderLearnRegressionPanel("learnPanel");

        // --- 8. Populate NEW Diagnostics Panel ---
        renderRegressionDiagnosticsTab("diagnosticsPanel", data);

        // --- Final Touches ---
        appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the new HTML
        dom.$("analysisActions").classList.remove("hidden"); // Show save buttons

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
                    
                    // Check if the panel being activated is the "Assumptions" panel
                    if (e.target.dataset.tab === "assumptions") {
                        const chart = targetPanel.querySelector(".plotly-chart"); // Find the chart *inside* this panel
                        if (chart && chart.layout && typeof Plotly !== 'undefined') {
                            try {
                                Plotly.Plots.resize(chart);
                            } catch (resizeError) {
                                console.error(`Error resizing chart ${chart.id} on tab switch:`, resizeError);
                            }
                        }
                    }
                }
            }
        });

        // --- Initial Chart Render ---
        setTimeout(() => {
            const residualsChart = dom.$("residualsPlot");
            if (residualsChart && !residualsChart.layout) { // Only render if not already rendered
                try {
                    const residualsTrace = {
                        x: diagnostics.residuals_plot_data.map(p => p.predicted),
                        y: diagnostics.residuals_plot_data.map(p => p.residual),
                        mode: 'markers', type: 'scatter', name: 'Residuals',
                        // --- MODIFICATION 2 ---
                        marker: { color: 'rgba(245, 158, 11, 0.7)', size: 8, line: { color: 'rgba(255,255,255,0.3)', width: 1 } }
                    };
                    const residualsLayout = {
                        title: 'Residuals vs. Predicted Values',
                        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                        xaxis: { title: 'Predicted Values', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
                        yaxis: { title: 'Residuals', zeroline: true, zerolinecolor: 'var(--accent)', zerolinewidth: 2, gridcolor: 'rgba(255,255,255,0.1)' },
                        margin: { t: 50, b: 50, l: 60, r: 30 }
                    };
                    Plotly.newPlot('residualsPlot', [residualsTrace], residualsLayout, { responsive: true });
                } catch(e) {
                    console.error("Error rendering residuals plot:", e);
                    dom.$("residualsPlot").innerHTML = `<div class="p-4 text-center text-red-400">Could not render residuals plot.</div>`;
                }
            }
        }, 100); // Give the DOM a moment to settle
    }
    
    /**
 * --- NEW FUNCTION (Corrected) ---
 * Renders the new "Diagnostics" tab for regression, focusing on warnings.
 * --- FIX ---
 * - Correctly destructures 'coefficients' from 'data.statsmodels_results' instead of 'data'.
 *
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {object} data - The full backend response data.
 */
function renderRegressionDiagnosticsTab(containerId, data) {
    const container = dom.$(containerId);
    if (!container) return;

    // Helper to safely format numbers
    function safeFormat(num, digits, defaultVal = 'N/A') {
        if (num === null || typeof num === 'undefined' || isNaN(num)) return defaultVal;
        if (digits > 2 && num > 0 && num < (1 / Math.pow(10, digits))) return `< 0.${'0'.repeat(digits - 1)}1`;
        return num.toFixed(digits);
    }

    // --- CORRECTED DESTRUCTURING ---
    // Destructure the main data object first
    const { statsmodels_results, sklearn_comparison, statistical_analysis } = data;
    // NOW destructure the nested objects
    const { model_summary, coefficients, diagnostics } = statsmodels_results;
    // --- END CORRECTION ---

    const warnings = [];

    // 1. Check for statistical_analysis errors
    if (statistical_analysis.error) {
        warnings.push({
            level: 'high',
            type: 'Data Preprocessing Error',
            message: `Could not perform initial statistical analysis: ${statistical_analysis.error}`,
            impact: 'Correlations and target stats are unavailable.'
        });
    }

    // 2. Check Sklearn model errors
    for (const modelName in sklearn_comparison) {
        if (sklearn_comparison[modelName].error) {
            warnings.push({
                level: 'medium',
                type: 'Sub-Model Failure',
                message: `The ${modelName} (Sklearn) model failed to train: ${sklearn_comparison[modelName].error}`,
                impact: 'Comparison data for this model is unavailable.'
            });
        }
    }

    // 3. Check overall model significance
    const f_pvalue = model_summary.prob_f_statistic ?? 1.0;
    if (f_pvalue >= 0.05) {
        warnings.push({
            level: 'high',
            type: 'Model Not Significant',
            message: `The overall model is not statistically significant (F-statistic p-value = ${safeFormat(f_pvalue, 3)}).`,
            impact: 'The independent variables, as a group, do not reliably predict the dependent variable. The results should not be trusted.'
        });
    }

    // 4. Check statistical assumption test FAILURES
    const bp_pvalue = diagnostics.breusch_pagan_pvalue.statistic ?? 1.0;
    if (bp_pvalue < 0.05) {
        warnings.push({
            level: 'medium',
            type: 'Heteroscedasticity Detected',
            message: `The Breusch-Pagan test failed (p = ${safeFormat(bp_pvalue, 3)}), suggesting residuals do not have constant variance.`,
            impact: 'p-values and standard errors for coefficients may be unreliable.'
        });
    }

    const dw_stat = diagnostics.durbin_watson.statistic ?? 2.0;
    if (dw_stat < 1.5 || dw_stat > 2.5) {
        warnings.push({
            level: 'medium',
            type: 'Autocorrelation Detected',
            message: `The Durbin-Watson statistic is ${safeFormat(dw_stat, 3)} (ideal is ~2.0), suggesting residuals are not independent.`,
            impact: 'This is a problem for time-series data. Standard errors and p-values may be inaccurate.'
        });
    }

    const jb_pvalue = diagnostics.jarque_bera_pvalue.statistic ?? 1.0;
    if (jb_pvalue < 0.05) {
        warnings.push({
            level: 'low',
            type: 'Non-Normal Residuals',
            message: `The Jarque-Bera test failed (p = ${safeFormat(jb_pvalue, 3)}), suggesting residuals are not normally distributed.`,
            impact: 'This is less critical with large samples, but indicates a potential violation of OLS assumptions.'
        });
    }

    // 5. Check for non-significant coefficients
    // This line will now work because 'coefficients' is correctly defined
    const nonSigCoeffs = coefficients.filter(c => c.variable.toLowerCase() !== 'const' && (c.p_value === null || c.p_value >= 0.05));
    if (nonSigCoeffs.length > 0) {
        warnings.push({
            level: 'low',
            type: 'Non-Significant Predictors',
            message: `The following variables were not statistically significant (p >= 0.05): ${nonSigCoeffs.map(c => c.variable).join(', ')}`,
            impact: 'These variables do not have a reliable, non-zero relationship with the target variable in this model.'
        });
    }

    // --- Render the HTML ---
    let html = `<div class="p-6 space-y-8 text-white/90 max-w-6xl mx-auto">
                <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                     ⚠️ Warnings & Diagnostics
                </h3>`;

    if (warnings.length > 0) {
        // Sort warnings: high, medium, low
        const levelOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        warnings.sort((a, b) => (levelOrder[a.level] || 4) - (levelOrder[b.level] || 4));

        html += `<div class="space-y-4">
                    <h4 class="text-xl font-bold text-red-300 mb-4">🚨 Analysis Alerts</h4>`;
        
        warnings.forEach(warning => {
            const colors = {
                high: { bg: 'bg-red-900/20', border: 'border-red-500', text: 'text-red-300', icon: '🔴' },
                medium: { bg: 'bg-yellow-900/20', border: 'border-yellow-500', text: 'text-yellow-300', icon: '🟡' },
                low: { bg: 'bg-blue-900/20', border: 'border-blue-500', text: 'text-blue-300', icon: '🔵' }
            };
            const c = colors[warning.level] || colors.low;

            html += `
                <div class="p-4 rounded-lg border-l-4 ${c.bg} ${c.border}">
                    <div class="flex items-start space-x-3">
                        <div class="text-2xl">${c.icon}</div>
                        <div class="flex-1">
                            <h5 class="font-semibold text-lg ${c.text}">${warning.type}</h5>
                            <p class="text-white/90 mt-1">${warning.message}</p>
                            <p class="text-white/70 text-sm mt-2"><strong>Impact:</strong> ${warning.impact}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    } else {
        html += `
            <div class="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                <div class="text-2xl mb-2">✅</div>
                <p class="text-green-300 font-semibold">No Critical Warnings Detected</p>
                <p class="text-white/70 text-sm mt-1">The statistical model appears to be stable and assumption tests passed.</p>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

    /**
 * --- NEW FUNCTION ---
 * Renders the static 'Learn Regression' content into the specified container.
 * @param {string} containerId - The ID of the HTML element to render into.
 */
function renderLearnRegressionPanel(containerId) {
    const container = dom.$(containerId);
    if (!container) return; // Exit if container not found

    // Static HTML content explaining Regression
    container.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-3xl font-bold text-center mb-4">🎓 Understanding Regression Analysis</h3>
            
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Regression Analysis?</h4>
                <p class="text-sm text-white/80">Regression analysis is a statistical method used to model the relationship between a **dependent variable** (the outcome you want to predict) and one or more **independent variables** (the factors you believe influence the outcome).</p>
                <p class="text-sm text-white/80 mt-2">It helps answer questions like: "How much does my marketing spend affect my sales?" or "Which factors have the biggest impact on customer satisfaction?"</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-2">Key Concepts to Know:</h4>
                    <ul class="list-disc list-inside space-y-2 text-sm">
                        <li>
                            <strong>Coefficient:</strong> The number showing how much the dependent variable is expected to change (on average) for a one-unit increase in the independent variable, holding all other variables constant.
                        </li>
                        <li>
                            <strong>p-value:</strong> The probability that the observed relationship is just due to random chance. A p-value **< 0.05** is typically considered "statistically significant," meaning the relationship is likely real.
                        </li>
                        <li>
                            <strong>R-Squared (R²):</strong> A score from 0% to 100% that indicates how much of the variation in the dependent variable is "explained" by the independent variables in your model. A higher R² is generally better.
                        </li>
                         <li>
                            <strong>Adj. R-Squared:</strong> A modified version of R-Squared that adjusts for the number of variables in the model. It's often preferred for comparing models with different numbers of predictors.
                        </li>
                    </ul>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-2">Interpreting Your Results:</h4>
                     <ol class="list-decimal list-inside space-y-1 text-sm">
                        <li><strong>Check Model Fit (Dashboard):</strong> Is the **Adj. R-Squared** high enough to be useful? Is the **F-statistic p-value** < 0.05? If not, the model as a whole isn't very good at explaining the outcome.</li>
                        <li><strong>Check Coefficients (Coefficients Tab):</strong> Look for variables with a **p-value < 0.05**. These are your significant predictors.</li>
                        <li><strong>Analyze Coefficients:</strong> For significant predictors, look at the **Coefficient** value. Is it positive (+) or negative (-)? How large is it? This tells you the direction and strength of the relationship.</li>
                        <li><strong>Check Diagnostics (Diagnostics Tab):</strong> Are there any red flags? You want random scatter in the residuals plot and "PASS" on the statistical tests.</li>
                     </ol>
                </div>
            </div>

             <details class="styled-details text-sm mt-4">
                <summary class="font-semibold">⚠️ Common Pitfalls & Assumptions</summary>
                <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                    <p><strong>Multicollinearity (Check Correlations):</strong> If your independent variables are highly correlated with *each other* (e.g., > 0.8), it can make your coefficients unreliable. The model can't tell which variable is "responsible" for the effect.</p>
                    <p><strong>Homoscedasticity (Check Breusch-Pagan):</strong> The model assumes residuals (errors) are spread randomly and evenly. If they form a cone or fan shape (heteroscedasticity), your p-values might be inaccurate. This is a common issue.</p>
                    <p><strong>Normality of Residuals (Check Jarque-Bera):</strong> Assumes the errors are normally distributed (a bell curve). Violations are less critical with large samples but can be an issue.</p>
                    <p><strong>Autocorrelation (Check Durbin-Watson):</strong> Assumes errors are independent. This is mainly a problem in time-series data (e.g., stock prices) where one day's error affects the next. You want a value around 2.0.</p>
                </div>
            </details>
        </div>
    `;
}

export {
    renderAdvancedRegressionPage
}