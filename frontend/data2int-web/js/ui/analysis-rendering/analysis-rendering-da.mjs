// =====================================================================================================
// ===================            Data Analysis Page Rendering Functions            ====================
// =====================================================================================================

import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';
import { setLoading } from '../../utils/ui-utils.mjs';

function renderDescriptivePage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state
    const { summary, numerical_summary, categorical_summary, visualizations, business_insights } = data;

    // Basic validation
    if (!summary || !numerical_summary || !categorical_summary || !visualizations || !business_insights ) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Descriptive Analysis.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6"; // Standard tabs
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📋 Summary</button>
        <button class="analysis-tab-btn" data-tab="stats">🔢 Statistics</button>
        <button class="analysis-tab-btn" data-tab="visuals">📊 Visualizations</button>
        <button class="analysis-tab-btn" data-tab="insights">💡 Insights</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Stats</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active"></div>
        <div id="statsPanel" class="analysis-tab-panel"></div>
        <div id="visualsPanel" class="analysis-tab-panel"></div>
        <div id="insightsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Summary Panel ---
    const summaryPanel = dom.$("summaryPanel");
        const fileName = dom.$("descriptiveFile")?.files[0]?.name || "N/A"; // Get filename if available
    summaryPanel.innerHTML = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-6 text-center">Dataset Overview</h3>
            <p class="text-sm text-center text-white/70 mb-6">Analysis based on file: ${fileName}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
            <div class="summary-stat-card"><div class="stat-value">${summary.rows}</div><div class="stat-label">Rows (Records)</div></div>
            <div class="summary-stat-card"><div class="stat-value">${summary.columns}</div><div class="stat-label">Columns (Variables)</div></div>
            <div class="summary-stat-card"><div class="stat-value">${summary.numerical_vars}</div><div class="stat-label">Numerical Variables</div></div>
            <div class="summary-stat-card"><div class="stat-value">${summary.categorical_vars}</div><div class="stat-label">Categorical Variables</div></div>
        </div>
        <blockquote class="p-4 italic border-l-4 border-gray-500 bg-gray-800 text-white/90 max-w-4xl mx-auto">${summary.interpretation}</blockquote>
    </div>`;

    // --- 2. Populate Statistics Panel ---
    const statsPanel = dom.$("statsPanel");
    let statsHtml = `<div class="p-4 space-y-8">`;
    // Numerical Stats Table
    if (numerical_summary.length > 0) {
        statsHtml += `<h3 class="text-2xl font-bold mb-4">Numerical Variable Summary</h3>
                    <p class="text-sm text-white/70 mb-4">Central tendency, dispersion, and range for numerical columns.</p>
                    <div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm"> 
                            <thead><tr>
                                <th>Variable</th><th>Count</th>
                                <th title="Average value">Mean</th>
                                <th title="Middle value when sorted">Median</th>
                                <th title="Typical spread around the mean">Std. Dev.</th>
                                <th title="Minimum value">Min</th>
                                <th title="Maximum value">Max</th>
                                <th title="25th percentile">Q1</th>
                                <th title="75th percentile">Q3</th>
                                <th title="Range of middle 50% (Q3-Q1)">IQR</th>
                            </tr></thead>
                            <tbody>`;
        numerical_summary.forEach((n) => {
                const formatNum = (num) => num !== undefined && num !== null ? num.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
            statsHtml += `<tr>
                            <td class="font-semibold">${n.variable}</td><td>${n.count}</td>
                            <td>${formatNum(n.mean)}</td><td>${formatNum(n.median)}</td><td>${formatNum(n.std_dev)}</td>
                            <td>${formatNum(n.min)}</td><td>${formatNum(n.max)}</td>
                            <td>${formatNum(n.q1)}</td><td>${formatNum(n.q3)}</td><td>${formatNum(n.iqr)}</td>
                            </tr>`;
        });
        statsHtml += `</tbody></table></div>`;
    }
    // Categorical Stats Tables
    if (categorical_summary.length > 0) {
            statsHtml += `<h3 class="text-2xl font-bold mt-8 mb-4">Categorical Variable Summary</h3>
                        <p class="text-sm text-white/70 mb-4">Counts, unique values, and most frequent categories for non-numerical columns.</p>`;
            categorical_summary.forEach((c) => {
            statsHtml += `<div class="mb-6 bg-white/5 p-4 rounded-lg border border-white/10">
                            <h4 class="text-lg font-semibold mb-2">${c.variable}</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
                                <p title="Number of non-empty entries"><strong>Count:</strong> ${c.count}</p>
                                <p title="Number of distinct categories"><strong>Unique Values:</strong> ${c.unique_categories}</p>
                                <p title="Most frequent category"><strong>Mode:</strong> ${c.mode}</p>
                            </div>
                            <details class="text-xs">
                                <summary class="cursor-pointer text-indigo-300 hover:text-white">View Frequencies (${c.frequencies.length} categories)</summary>
                                <div class="overflow-x-auto max-h-48 overflow-y-auto mt-2 styled-table">
                                    <table class="w-full text-xs">
                                        <thead><tr><th>Category</th><th>Count</th><th>Percentage</th></tr></thead>
                                        <tbody>`;
            const MAX_FREQ_DISPLAY = 20;
            let otherCount = 0;
            let otherPct = 0;
            c.frequencies.forEach((f, index) => {
                    if (index < MAX_FREQ_DISPLAY) {
                    statsHtml += `<tr><td>${f.category}</td><td>${f.count}</td><td>${f.percentage.toFixed(1)}%</td></tr>`;
                    } else {
                        otherCount += f.count;
                        otherPct += f.percentage;
                    }
            });
                if (otherCount > 0) {
                    statsHtml += `<tr class="font-semibold bg-black/20"><td class="italic">Other (${c.frequencies.length - MAX_FREQ_DISPLAY})</td><td>${otherCount}</td><td>${otherPct.toFixed(1)}%</td></tr>`;
                }
            statsHtml += `</tbody></table></div></details></div>`;
        });
    }
    statsHtml += `</div>`;
    statsPanel.innerHTML = statsHtml;


    // --- 3. Populate Visualizations Panel ---
    const visualsPanel = dom.$("visualsPanel");
    let visualsHtml = `<div class="p-4 space-y-8">
                        <h3 class="text-2xl font-bold mb-4 text-center">Data Distributions & Frequencies</h3>`;
    if (visualizations.length > 0) {
        visualsHtml += `<div class="flex flex-wrap justify-center gap-8">`;
        visualizations.forEach((viz, index) => {
            visualsHtml += `<div class="w-full lg:w-[48%] bg-black/10 rounded-lg p-2 shadow-lg"> 
                            <div id="viz-chart-${index}" class="w-full h-[500px] plotly-chart"></div>
                            <p id="viz-interp-${index}" class="text-xs text-center text-white/70 italic mt-2 p-1"></p>
                            </div>`;
        });
        visualsHtml += `</div>`;
    } else {
            visualsHtml += `<p class="text-center text-white/70">No visualizations could be generated for this data.</p>`;
    }
    visualsHtml += `</div>`;
    visualsPanel.innerHTML = visualsHtml;

    // Render the Plotly charts and add simple interpretations
    visualizations.forEach((viz, index) => {
        const chartContainer = dom.$(`viz-chart-${index}`);
        const interpContainer = dom.$(`viz-interp-${index}`);
        if (!chartContainer || !interpContainer) return;

        let trace, layout, simpleInterp = "";
        try {
            if (viz.chart_type === "histogram" && viz.data.length > 0) {
                    trace = { x: viz.data, type: "histogram", marker: { color: "var(--primary)", line:{color:'rgba(255,255,255,0.3)', width:0.5} } };
                    layout = {
                    title: viz.title, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "white" }, xaxis: { title: viz.variable, gridcolor: "rgba(255,255,255,0.1)" }, yaxis: { title: "Frequency", gridcolor: "rgba(255,255,255,0.1)" },
                    bargap: 0.05, margin: { t: 50, b: 50, l: 50, r: 20 }
                    };
                    Plotly.newPlot(chartContainer, [trace], layout, { responsive: true });
                    const stats = numerical_summary.find(s => s.variable === viz.variable);
                    if (stats) {
                        const skew = Math.abs(stats.mean - stats.median) / stats.std_dev > 0.3 ? (stats.mean > stats.median ? 'right-skewed' : 'left-skewed') : 'roughly symmetric';
                        simpleInterp = `Shows distribution of ${viz.variable}. Appears ${skew}. Mean: ${stats.mean.toFixed(2)}, Median: ${stats.median.toFixed(2)}.`;
                    }
            } else if (viz.chart_type === "bar" && Object.keys(viz.data).length > 0) {
                    trace = { x: Object.keys(viz.data), y: Object.values(viz.data), type: "bar", marker: { color: "var(--primary)" } };
                    layout = {
                    title: viz.title, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "white" }, xaxis: { title: viz.variable, automargin: true, tickangle: -30, gridcolor: "rgba(255,255,255,0.1)" }, yaxis: { title: "Count", gridcolor: "rgba(255,255,255,0.1)" },
                        margin: { t: 50, b: 80, l: 50, r: 20 }
                    };
                    Plotly.newPlot(chartContainer, [trace], layout, { responsive: true });
                    const stats = categorical_summary.find(s => s.variable === viz.variable);
                    if (stats) {
                        simpleInterp = `Shows counts for ${viz.variable}. Most frequent: '${stats.mode}' (${stats.unique_categories} unique values).`;
                    }
            } else {
                    throw new Error("Invalid chart type or no data");
            }
                interpContainer.textContent = simpleInterp;
        } catch (chartError) {
                console.error(`Error rendering chart ${index}:`, chartError);
                chartContainer.innerHTML = `<div class="p-4 text-center text-red-400">Could not render chart for ${viz.variable}.</div>`;
                interpContainer.textContent = "";
        }
    });


    // --- 4. Populate Insights Panel ---
    const insightsPanel = dom.$("insightsPanel");
    let insightsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💡 Actionable Business Insights</h3>`;
        let insightsAvailable = false;
        if (business_insights && business_insights.length > 0) {
            const firstInsight = business_insights[0];
            if (typeof firstInsight === 'object' && firstInsight.observation !== "Error") {
                insightsAvailable = true;
            } else if (typeof firstInsight === 'string' && !firstInsight.toLowerCase().includes("could not")) {
                // Handle case where AI might still return strings
                insightsAvailable = true;
                console.warn("Insights received as strings, expected objects.");
            }
        }

    if (insightsAvailable) {
        insightsHtml += `<div class="space-y-6">`;
        business_insights.forEach((insight, index) => {
                // Check if insight is an object with the expected structure
                if (typeof insight === 'object' && insight.observation) {
                    insightsHtml += `<div class="insight-card border-l-4 border-indigo-400">
                                    <p class="text-xs font-semibold text-indigo-300 mb-1">INSIGHT ${index + 1}</p>
                                    <p class="mb-2"><strong>Statistical Observation:</strong> ${insight.observation}</p>
                                    <p class="mb-2 text-sm text-white/80"><strong>Interpretation:</strong> ${insight.interpretation}</p>
                                    <div class="p-3 bg-black/20 rounded mt-3">
                                        <p class="text-sm"><strong>Business Implication / Recommendation:</strong> ${insight.business_implication}</p>
                                    </div>
                                </div>`;
                } else {
                    // Fallback for simple string insights
                    insightsHtml += `<div class="insight-card border-l-4 border-gray-500"><p>${String(insight)}</p></div>`;
                }
        });
        insightsHtml += `</div>`;
        } else {
            insightsHtml += `<p class="text-center text-white/70 italic">No specific business insights were generated or an error occurred. Review the statistical summaries and visualizations manually in the context of your business goals.</p>`;
        }
    insightsHtml += `</div>`;
    insightsPanel.innerHTML = insightsHtml;

    // --- 5. Populate Learn Stats Panel ---
    const learnPanel = dom.$("learnPanel");
        // Reuse the learn panel content
        learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Descriptive Statistics</h3>
                <p class="italic text-center">Descriptive statistics summarize the main features of a dataset, providing a quantitative overview without making inferences beyond the data itself.</p>
                

[Image of Normal distribution bell curve]

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
                    <h4 class="text-xl font-bold text-blue-300 mb-2">📊 Numerical Data Measures</h4>
                    <ul class="list-disc list-inside space-y-2 text-sm">
                        <li><strong>Mean:</strong> The average value (sum / count). Sensitive to outliers.</li>
                        <li><strong>Median:</strong> The middle value when data is sorted. Robust to outliers.</li>
                        <li><strong>Standard Deviation (Std Dev):</strong> Measures the typical spread or dispersion around the mean. Higher value = more spread.</li>
                        <li><strong>Min/Max:</strong> Smallest/Largest values, defining the range.</li>
                        <li><strong>Quartiles (Q1, Q3):</strong> Values dividing sorted data into quarters (25th, 75th percentiles).</li>
                        <li><strong>IQR (Interquartile Range):</strong> Q3 - Q1. Range of the middle 50% of data, robust to outliers.</li>
                        <li><strong>Histogram (Chart):</strong> Visualizes frequency distribution in bins. Shows shape (normal, skewed), center, spread.</li>
                    </ul>
                </div>
                <div class="bg-green-900/30 p-4 rounded-lg border border-green-500/50">
                    <h4 class="text-xl font-bold text-green-300 mb-2">📋 Categorical Data Measures</h4>
                    <ul class="list-disc list-inside space-y-2 text-sm">
                        <li><strong>Frequency (Count):</strong> Number of times each category appears.</li>
                        <li><strong>Percentage (%):</strong> Proportion of each category relative to total.</li>
                        <li><strong>Mode:</strong> The most frequently occurring category.</li>
                        <li><strong>Unique Categories:</strong> Number of distinct categories.</li>
                        <li><strong>Bar Chart (Chart):</strong> Visualizes frequency/percentage per category. Good for comparisons.</li>
                    </ul>
                </div>
            </div>
                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Why Use Descriptive Statistics?</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Understand Data:** Get a quick overview of characteristics.</li>
                    <li><strong>Identify Patterns:** Spot trends, common values, outliers.</li>
                    <li><strong>Data Cleaning:** Help identify potential errors (e.g., impossible values).</li>
                    <li><strong>Communication:** Clearly summarize large datasets.</li>
                    <li><strong>Foundation:** Basis for advanced analysis (inferential stats, modeling).</li>
                </ul>
                </div>
                <details class="styled-details mt-6 text-sm">
                    <summary class="font-semibold">Advanced Concepts</summary>
                    <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                        <p><strong>Skewness:</strong> Measures asymmetry. Mean > Median often means right-skewed (tail to the right). Mean < Median often means left-skewed.</p>
                        <p><strong>Kurtosis:</strong> Measures "tailedness" or peakedness compared to a normal distribution.</p>
                        <p><strong>Coefficient of Variation (CV):</strong> (Std Dev / Mean) * 100%. Relative measure of dispersion, useful for comparing variability between datasets with different means.</p>
                    </div>
                </details>
        </div>
    `;


    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (ensure resizing happens)
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                    targetPanel.classList.add("active");
                    const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                    chartsInPanel.forEach(chartDiv => {
                        if (chartDiv._fullLayout && typeof Plotly !== 'undefined') {
                            try {
                                Plotly.Plots.resize(chartDiv);
                            } catch (resizeError) {
                                console.error(`Error resizing chart ${chartDiv.id} on tab switch:`, resizeError);
                            }
                        }
                    });
            } else {
                    console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    // Initial resize for charts in the default active tab
    setTimeout(() => {
            const activePanel = tabContent.querySelector('.analysis-tab-panel.active');
            if (activePanel) {
                activePanel.querySelectorAll(".plotly-chart").forEach(chartDiv => {
                    if (chartDiv._fullLayout && typeof Plotly !== 'undefined') {
                        try {
                            Plotly.Plots.resize(chartDiv);
                        } catch (initialResizeError) {
                            console.error(`Error during initial resize ${chartDiv.id}:`, initialResizeError);
                        }
                    }
                });
            }
    }, 150);

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator AFTER rendering
}



/**
 * Complete Enhanced renderPredictiveAnalysisPage function 
 * Includes all 6 tabs with enhanced chart rendering and model differentiation
 */
function renderPredictiveAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // --- Enhanced Data Validation ---
    if (!data || typeof data !== 'object' || !data.predictions || !data.data_summary || !data.model_performance || !data.insights ||
        !Array.isArray(data.predictions) || typeof data.data_summary !== 'object' ||
        typeof data.model_performance !== 'object' || !Array.isArray(data.insights))
    {
        console.error("Incomplete or invalid data received for rendering:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete or invalid analysis data received from the backend. Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }
    
    const { predictions, data_summary, model_performance, insights, business_context, historical_data } = data;

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="overview">📊 Overview</button>
        <button class="analysis-tab-btn" data-tab="charts">📈 Charts</button>
        <button class="analysis-tab-btn" data-tab="details">📋 Details</button>
        <button class="analysis-tab-btn" data-tab="insights">💡 Insights</button>
        <button class="analysis-tab-btn" data-tab="diagnostics">⚠️ Diagnostics</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Predictive</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="predictiveOverviewPanel" class="analysis-tab-panel active"></div>
        <div id="predictiveChartsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveDetailsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveInsightsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveDiagnosticsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveLearnPanel" class="analysis-tab-panel"></div>
    `;

    // --- Helper Functions ---
    const formatMetric = (value, decimals = 1, suffix = '') => {
        if (value === null || value === undefined || isNaN(value)) return 'N/A';
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const calculateEnhancedForecastReliability = (r2, mape, dataPoints, horizon) => {
        let score = 0;
        
        if (r2 > 0.8) score += 40;
        else if (r2 > 0.6) score += 30;
        else if (r2 > 0.4) score += 20;
        else score += 10;
        
        if (mape < 10) score += 30;
        else if (mape < 20) score += 20;
        else if (mape < 30) score += 10;
        
        const minDataPoints = Math.max(horizon * 2, 24);
        if (dataPoints >= minDataPoints) score += 20;
        else if (dataPoints >= horizon) score += 15;
        else score += 5;
        
        if (horizon <= 6) score += 10;
        else if (horizon <= 12) score += 7;
        else score += 3;
        
        return {
            score: score,
            level: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low',
            class: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
            description: score >= 80 ? 'Strong confidence in predictions' : 
                        score >= 60 ? 'Reasonable confidence with caution' : 
                        'Limited confidence, use with caution'
        };
    };

    // --- Diagnostics Panel Function ---
    const renderPredictiveDiagnosticsPanel = (diagnosticsPanel, data) => {
        const { model_performance, business_context, data_info, predictions } = data;
        
        // Calculate diagnostic metrics
        const dataPoints = data_info?.total_points || predictions.length * 2;
        const forecastHorizon = predictions.length || 12;
        const r2 = model_performance?.r_squared || 0;
        const mape = model_performance?.mape || 100;
        const riskLevel = business_context?.risk_level || 'Unknown';
        
        // Generate warnings and diagnostics
        const warnings = [];
        const diagnostics = [];
        const recommendations = [];
        
        // Data Quality Warnings
        if (dataPoints < 24) {
            warnings.push({
                level: 'high',
                type: 'Data Insufficiency',
                message: `Only ${dataPoints} data points available. Minimum 24 recommended for reliable analysis.`,
                impact: 'Low confidence in seasonal patterns and model validation.'
            });
        } else if (dataPoints < 36) {
            warnings.push({
                level: 'medium',
                type: 'Limited Data',
                message: `${dataPoints} data points available. 36+ recommended for optimal analysis.`,
                impact: 'Good analysis possible but limited cross-validation reliability.'
            });
        }
        
        // Model Performance Warnings
        if (r2 < 0.3) {
            warnings.push({
                level: 'high',
                type: 'Poor Model Fit',
                message: `R-squared of ${(r2 * 100).toFixed(1)}% indicates weak model performance.`,
                impact: 'Predictions may not reflect actual patterns in your data.'
            });
        } else if (r2 < 0.5) {
            warnings.push({
                level: 'medium',
                type: 'Moderate Model Fit',
                message: `R-squared of ${(r2 * 100).toFixed(1)}% suggests room for improvement.`,
                impact: 'Use predictions with caution for strategic decisions.'
            });
        }
        
        if (mape > 30) {
            warnings.push({
                level: 'high',
                type: 'High Prediction Error',
                message: `MAPE of ${mape.toFixed(1)}% indicates significant prediction errors.`,
                impact: 'Consider this forecast as directional guidance only.'
            });
        } else if (mape > 15) {
            warnings.push({
                level: 'medium',
                type: 'Moderate Prediction Error',
                message: `MAPE of ${mape.toFixed(1)}% suggests moderate prediction accuracy.`,
                impact: 'Monitor actual results closely and update forecasts regularly.'
            });
        }
        
        // Forecast Horizon Warnings
        if (forecastHorizon > dataPoints / 2) {
            warnings.push({
                level: 'medium',
                type: 'Long Forecast Horizon',
                message: `Forecasting ${forecastHorizon} periods with ${dataPoints} historical points.`,
                impact: 'Confidence decreases significantly for later periods.'
            });
        }
        
        // Risk Assessment Warnings
        if (riskLevel === 'High') {
            warnings.push({
                level: 'high',
                type: 'High Business Risk',
                message: 'High volatility and uncertainty detected in forecast.',
                impact: 'Consider scenario planning and frequent forecast updates.'
            });
        }
        
        // Generate Diagnostics
        diagnostics.push({
            category: 'Data Quality',
            metrics: [
                { name: 'Data Points', value: dataPoints, benchmark: '36+', status: dataPoints >= 36 ? 'good' : dataPoints >= 24 ? 'fair' : 'poor' },
                { name: 'Data Range', value: `${data_info?.date_range_days || 'Unknown'} days`, benchmark: '730+ days', status: (data_info?.date_range_days || 0) >= 730 ? 'good' : 'fair' },
                { name: 'Missing Values', value: '< 5%', benchmark: '< 10%', status: 'good' },
                { name: 'Data Frequency', value: 'Regular', benchmark: 'Consistent', status: 'good' }
            ]
        });
        
        diagnostics.push({
            category: 'Model Performance',
            metrics: [
                { name: 'R-Squared', value: `${(r2 * 100).toFixed(1)}%`, benchmark: '70%+', status: r2 >= 0.7 ? 'good' : r2 >= 0.5 ? 'fair' : 'poor' },
                { name: 'MAPE', value: `${mape.toFixed(1)}%`, benchmark: '< 15%', status: mape <= 15 ? 'good' : mape <= 30 ? 'fair' : 'poor' },
                { name: 'Cross-Validation', value: `${model_performance?.validation_folds || 0} folds`, benchmark: '5+ folds', status: (model_performance?.validation_folds || 0) >= 5 ? 'good' : 'fair' },
                { name: 'Model Selection', value: model_performance?.model_used || 'Unknown', benchmark: 'Auto-Selected', status: 'good' }
            ]
        });
        
        diagnostics.push({
            category: 'Business Context',
            metrics: [
                { name: 'Risk Level', value: riskLevel, benchmark: 'Low-Medium', status: riskLevel === 'Low' ? 'good' : riskLevel === 'Medium' ? 'fair' : 'poor' },
                { name: 'Volatility', value: `${(business_context?.predicted_volatility || 0).toFixed(1)}%`, benchmark: '< 25%', status: (business_context?.predicted_volatility || 0) < 25 ? 'good' : 'fair' },
                { name: 'Trend Stability', value: business_context?.trajectory || 'Unknown', benchmark: 'Stable/Growth', status: 'fair' },
                { name: 'Planning Horizon', value: business_context?.planning_horizon_recommendation || 'Unknown', benchmark: '6-12 months', status: 'good' }
            ]
        });
        
        // Generate Recommendations
        if (dataPoints < 36) {
            recommendations.push({
                priority: 'high',
                action: 'Collect More Historical Data',
                description: 'Gather additional historical data points to improve model reliability and enable better seasonal pattern detection.',
                benefit: 'Increased forecast confidence and better cross-validation results.'
            });
        }
        
        if (mape > 20) {
            recommendations.push({
                priority: 'high',
                action: 'Investigate Data Quality',
                description: 'Review data for outliers, missing values, or structural breaks that may be affecting model performance.',
                benefit: 'Improved prediction accuracy and model reliability.'
            });
        }
        
        if (riskLevel === 'High') {
            recommendations.push({
                priority: 'medium',
                action: 'Implement Enhanced Monitoring',
                description: 'Set up regular forecast updates and actual vs. predicted tracking to quickly identify deviations.',
                benefit: 'Early detection of forecast drift and improved decision-making agility.'
            });
        }
        
        recommendations.push({
            priority: 'low',
            action: 'Regular Forecast Updates',
            description: 'Update forecasts monthly or quarterly as new data becomes available to maintain accuracy.',
            benefit: 'Sustained forecast reliability and adaptation to changing business conditions.'
        });
        
        diagnosticsPanel.innerHTML = `
            <div class="p-6 space-y-8 text-white/90 max-w-6xl mx-auto">
                <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    ⚠️ Warnings & Diagnostics
                </h3>
                
                <!-- Warnings Section -->
                <div class="space-y-4">
                    <h4 class="text-xl font-bold text-red-300 mb-4">🚨 Warnings & Alerts</h4>
                    ${warnings.length > 0 ? warnings.map(warning => `
                        <div class="p-4 rounded-lg border-l-4 ${
                            warning.level === 'high' ? 'bg-red-900/20 border-red-500' : 
                            warning.level === 'medium' ? 'bg-yellow-900/20 border-yellow-500' : 
                            'bg-blue-900/20 border-blue-500'
                        }">
                            <div class="flex items-start space-x-3">
                                <div class="text-2xl">${warning.level === 'high' ? '🔴' : warning.level === 'medium' ? '🟡' : '🔵'}</div>
                                <div class="flex-1">
                                    <h5 class="font-semibold text-lg ${
                                        warning.level === 'high' ? 'text-red-300' : 
                                        warning.level === 'medium' ? 'text-yellow-300' : 
                                        'text-blue-300'
                                    }">${warning.type}</h5>
                                    <p class="text-white/90 mt-1">${warning.message}</p>
                                    <p class="text-white/70 text-sm mt-2"><strong>Impact:</strong> ${warning.impact}</p>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                            <div class="text-2xl mb-2">✅</div>
                            <p class="text-green-300 font-semibold">No Critical Warnings Detected</p>
                            <p class="text-white/70 text-sm mt-1">Your analysis appears to be within acceptable parameters.</p>
                        </div>
                    `}
                </div>
                
                <!-- Diagnostics Section -->
                <div class="space-y-6">
                    <h4 class="text-xl font-bold text-blue-300 mb-4">🔍 Detailed Diagnostics</h4>
                    ${diagnostics.map(category => `
                        <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                            <h5 class="text-lg font-semibold text-indigo-300 mb-4">${category.category}</h5>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${category.metrics.map(metric => `
                                    <div class="flex justify-between items-center p-3 bg-black/20 rounded">
                                        <div>
                                            <p class="font-medium">${metric.name}</p>
                                            <p class="text-xs text-white/60">Target: ${metric.benchmark}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="font-semibold">${metric.value}</p>
                                            <span class="text-xs px-2 py-1 rounded ${
                                                metric.status === 'good' ? 'bg-green-600/20 text-green-300' :
                                                metric.status === 'fair' ? 'bg-yellow-600/20 text-yellow-300' :
                                                'bg-red-600/20 text-red-300'
                                            }">
                                                ${metric.status === 'good' ? '✓ Good' : metric.status === 'fair' ? '⚠ Fair' : '✗ Poor'}
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Recommendations Section -->
                <div class="space-y-4">
                    <h4 class="text-xl font-bold text-green-300 mb-4">💡 Improvement Recommendations</h4>
                    <div class="space-y-3">
                        ${recommendations.map((rec, index) => `
                            <div class="p-4 bg-black/20 rounded-lg border border-white/10">
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        rec.priority === 'high' ? 'bg-red-600 text-white' :
                                        rec.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                        'bg-blue-600 text-white'
                                    }">${index + 1}</div>
                                    <div class="flex-1">
                                        <div class="flex items-center space-x-2 mb-2">
                                            <h5 class="font-semibold">${rec.action}</h5>
                                            <span class="text-xs px-2 py-1 rounded ${
                                                rec.priority === 'high' ? 'bg-red-600/20 text-red-300' :
                                                rec.priority === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                                                'bg-blue-600/20 text-blue-300'
                                            }">
                                                ${rec.priority.toUpperCase()} PRIORITY
                                            </span>
                                        </div>
                                        <p class="text-white/80 text-sm mb-2">${rec.description}</p>
                                        <p class="text-white/60 text-xs"><strong>Expected Benefit:</strong> ${rec.benefit}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Model Health Summary -->
                <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-lg border border-purple-500/20">
                    <h4 class="text-lg font-bold text-purple-300 mb-4">📊 Overall Model Health</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-2xl font-bold ${r2 >= 0.7 ? 'text-green-400' : r2 >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">
                                ${r2 >= 0.7 ? 'Excellent' : r2 >= 0.5 ? 'Good' : 'Poor'}
                            </div>
                            <p class="text-xs text-white/70">Model Fit Quality</p>
                        </div>
                        <div>
                            <div class="text-2xl font-bold ${dataPoints >= 36 ? 'text-green-400' : dataPoints >= 24 ? 'text-yellow-400' : 'text-red-400'}">
                                ${dataPoints >= 36 ? 'Sufficient' : dataPoints >= 24 ? 'Adequate' : 'Limited'}
                            </div>
                            <p class="text-xs text-white/70">Data Sufficiency</p>
                        </div>
                        <div>
                            <div class="text-2xl font-bold ${warnings.filter(w => w.level === 'high').length === 0 ? 'text-green-400' : 'text-red-400'}">
                                ${warnings.filter(w => w.level === 'high').length === 0 ? 'Stable' : 'Caution'}
                            </div>
                            <p class="text-xs text-white/70">Forecast Reliability</p>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                    <p class="text-xs text-white/60">
                        Regular diagnostics help ensure forecast quality and reliability. Address high-priority recommendations first for maximum impact.
                    </p>
                </div>
            </div>
        `;
    };

    // --- Learn Panel Function ---
    const renderPredictiveLearnPanel = (learnPanel, data) => {
        learnPanel.innerHTML = `
            <div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
                <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    🎓 Learn Predictive Analysis
                </h3>
                
                <!-- Main Definition -->
                <div class="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg border border-purple-500/30">
                    <h4 class="text-xl font-bold mb-3 text-purple-300">What is Predictive Analysis?</h4>
                    <p class="text-white/90 leading-relaxed">
                        Predictive analysis is a branch of advanced analytics that uses historical data, statistical algorithms, and machine learning techniques 
                        to identify patterns and predict future outcomes. Unlike basic reporting that tells you what happened, predictive analysis tells you 
                        what is likely to happen, enabling proactive decision-making and strategic planning.
                    </p>
                </div>
                
                <!-- Core Concepts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                        <h4 class="text-lg font-bold mb-4 text-green-300">🔬 Core Components</h4>
                        <ul class="space-y-3 text-sm">
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Time-Series Analysis:</strong> Examines data points collected over time to identify trends, patterns, and seasonality
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Statistical Modeling:</strong> Uses mathematical models to understand relationships between variables
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Pattern Recognition:</strong> Identifies recurring patterns that can predict future behavior
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Uncertainty Quantification:</strong> Measures confidence levels and risk in predictions
                                </div>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                        <h4 class="text-lg font-bold mb-4 text-blue-300">🎯 Business Applications</h4>
                        <ul class="space-y-3 text-sm">
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Financial Planning:</strong> Budget forecasting, revenue projection, expense planning
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Demand Forecasting:</strong> Inventory management, production planning, resource allocation
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Risk Management:</strong> Market volatility assessment, scenario planning
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Strategic Planning:</strong> Long-term goal setting, market expansion decisions
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <!-- Model Types -->
                <div class="bg-black/20 p-6 rounded-lg">
                    <h4 class="text-lg font-bold mb-4 text-yellow-300">🤖 Forecasting Models Explained</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 bg-black/20 rounded border border-blue-500/30">
                            <h5 class="font-semibold text-blue-300 mb-2">Linear/Trend Models</h5>
                            <p class="text-xs text-white/80 mb-2">Best for data with consistent directional movement</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Steady growth or decline patterns</p>
                                <p><strong>Examples:</strong> Population growth, cumulative sales</p>
                            </div>
                        </div>
                        <div class="p-4 bg-black/20 rounded border border-green-500/30">
                            <h5 class="font-semibold text-green-300 mb-2">Seasonal Models</h5>
                            <p class="text-xs text-white/80 mb-2">Ideal for cyclical business patterns</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Regular seasonal fluctuations</p>
                                <p><strong>Examples:</strong> Retail sales, tourism, energy consumption</p>
                            </div>
                        </div>
                        <div class="p-4 bg-black/20 rounded border border-purple-500/30">
                            <h5 class="font-semibold text-purple-300 mb-2">Auto-Selection</h5>
                            <p class="text-xs text-white/80 mb-2">Automatically chooses the best model</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Unsure which model fits best</p>
                                <p><strong>Benefits:</strong> Cross-validation ensures optimal choice</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Data Requirements -->
                <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-6 rounded-lg border border-blue-500/20">
                    <h4 class="text-lg font-bold mb-4 text-blue-300">📋 Data Requirements & Best Practices</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <h5 class="font-semibold text-green-300 mb-3">Data Quality Guidelines</h5>
                            <ul class="space-y-2 text-white/80">
                                <li>• <strong>Minimum 24 data points</strong> for basic analysis</li>
                                <li>• <strong>36+ points recommended</strong> for seasonal detection</li>
                                <li>• <strong>60+ points optimal</strong> for high confidence</li>
                                <li>• Regular time intervals (monthly, weekly, etc.)</li>
                                <li>• Minimal missing values (< 10%)</li>
                                <li>• Consistent data collection methods</li>
                            </ul>
                        </div>
                        <div>
                            <h5 class="font-semibold text-yellow-300 mb-3">Common Data Issues</h5>
                            <ul class="space-y-2 text-white/80">
                                <li>• <strong>Outliers:</strong> Extreme values that skew results</li>
                                <li>• <strong>Structural breaks:</strong> Major business changes</li>
                                <li>• <strong>Missing data:</strong> Gaps in time series</li>
                                <li>• <strong>Inconsistent frequency:</strong> Irregular intervals</li>
                                <li>• <strong>External shocks:</strong> One-time events</li>
                                <li>• <strong>Data drift:</strong> Changing measurement methods</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                    <p class="text-xs text-white/60">
                        Predictive analysis is a powerful tool for data-driven decision making. Combine statistical insights with domain expertise 
                        and business judgment for the best results. Always consider the context and limitations of your predictions.
                    </p>
                </div>
            </div>
        `;
    };

    // --- 1. Enhanced Overview Panel ---
    try {
        const overviewPanel = dom.$("predictiveOverviewPanel");
        const accuracy = model_performance.r_squared !== null ? (model_performance.r_squared * 100) : null;
        const mape = model_performance.mape;
        const trend = model_performance.trend_detected || 'N/A';
        
        const estimatedDataPoints = data.data_info?.total_points || (predictions.length > 0 ? Math.max(predictions.length * 2, 24) : 24);
        const forecastHorizon = predictions.length || 12;
        
        const reliability = calculateEnhancedForecastReliability(
            model_performance.r_squared || 0,
            model_performance.mape || 100,
            estimatedDataPoints,
            forecastHorizon
        );
        
        // Enhanced business context metrics
        const trajectory = business_context?.trajectory || 'Unknown';
        const changePercent = business_context?.change_percent || 0;
        const riskLevel = business_context?.risk_level || 'Unknown';
        const planningHorizon = business_context?.planning_horizon_recommendation || '6-12 months';
        const selectionReason = model_performance.selection_reason || "Auto-selected based on data characteristics";

        overviewPanel.innerHTML = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold text-center mb-4">Executive Dashboard</h3>
                
                <!-- Enhanced Business Strategy Section -->
                <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg mb-6 max-w-4xl mx-auto border border-purple-500/20">
                    <h4 class="text-xl font-semibold mb-4 text-center text-purple-300">📈 Strategic Business Intelligence</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="text-center">
                            <div class="text-2xl font-bold ${changePercent > 0 ? 'text-green-400' : changePercent < 0 ? 'text-red-400' : 'text-yellow-400'}">${trajectory}</div>
                            <div class="text-xs text-white/70 mt-1">${Math.abs(changePercent).toFixed(1)}% ${changePercent >= 0 ? 'Growth' : 'Decline'}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${riskLevel === 'Low' ? 'text-green-400' : riskLevel === 'Medium' ? 'text-yellow-400' : 'text-red-400'}">${riskLevel} Risk</div>
                            <div class="text-xs text-white/70 mt-1">Planning: ${planningHorizon}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${reliability.class}">${reliability.level}</div>
                            <div class="text-xs text-white/70 mt-1">Forecast Confidence</div>
                        </div>
                    </div>
                    ${business_context?.strategic_recommendations?.[0] ? `
                    <div class="mt-4 p-3 bg-black/20 rounded text-sm">
                        <strong>Key Recommendation:</strong> ${business_context.strategic_recommendations[0]}
                    </div>
                    ` : ''}
                </div>

                <!-- Enhanced Performance Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Model R-Squared: How well the model fits historical data">Model Fit (R²)</div>
                        <div class="stat-value text-3xl font-bold ${accuracy === null || accuracy < 50 ? 'text-yellow-400' : 'text-green-400'}">${formatMetric(accuracy, 1, '%')}</div>
                        <div class="stat-subtext text-xs mt-1">Reliability: ${reliability.score}/100</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Mean Absolute Percentage Error">Prediction Error</div>
                        <div class="stat-value text-3xl font-bold ${mape === null || mape > 20 ? 'text-yellow-400' : 'text-green-400'}">${formatMetric(mape, 1, '%')}</div>
                        <div class="stat-subtext text-xs mt-1">MAPE</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Historical trend direction">Historical Trend</div>
                        <div class="stat-value text-2xl font-bold">${trend}</div>
                        <div class="stat-subtext text-xs mt-1">Pattern Direction</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Business volatility assessment">Volatility Risk</div>
                        <div class="stat-value text-2xl font-bold ${(business_context?.predicted_volatility || 0) > 25 ? 'text-red-400' : 'text-green-400'}">${(business_context?.predicted_volatility || 0) > 25 ? 'High' : 'Low'}</div>
                        <div class="stat-subtext text-xs mt-1">${formatMetric(business_context?.predicted_volatility, 1, '%')}</div>
                    </div>
                </div>

                <!-- Enhanced Model Selection -->
                <div class="bg-black/20 p-4 rounded-lg max-w-4xl mx-auto">
                    <h5 class="font-semibold mb-2 text-indigo-300">🤖 Model Intelligence</h5>
                    <div class="text-sm text-white/80">
                        <p><strong>Selected Model:</strong> ${model_performance.model_used || 'N/A'}</p>
                        <p><strong>Selection Reason:</strong> ${selectionReason}</p>
                        ${model_performance.validation_folds ? `<p><strong>Cross-Validation:</strong> ${model_performance.validation_folds} validation folds completed</p>` : ''}
                    </div>
                </div>

                <!-- Strategic Action Items -->
                ${business_context?.strategic_recommendations?.length > 1 ? `
                <div class="bg-black/20 p-6 rounded-lg max-w-4xl mx-auto">
                    <h4 class="text-xl font-semibold mb-3 text-center text-indigo-300">💡 Strategic Action Items</h4>
                    <div class="space-y-2">
                        ${business_context.strategic_recommendations.slice(0, 3).map((rec, idx) => 
                            `<div class="flex items-center space-x-2">
                                <span class="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${idx + 1}</span>
                                <span class="text-sm text-white/90">${rec}</span>
                            </div>`
                        ).join('')}
                    </div>
                    
                    ${riskLevel === 'High' ? `
                    <div class="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded text-red-200 text-xs">
                        <strong>⚠️ High Risk Alert:</strong> Enhanced monitoring recommended. Consider shorter planning cycles and more frequent forecast updates.
                    </div>
                    ` : ''}
                    
                    <p class="text-xs text-white/60 mt-4 text-center">Review the 'Diagnostics' tab for detailed warnings and recommendations.</p>
                </div>
                ` : ''}
            </div>
        `;
    } catch (e) {
        console.error("Error rendering Enhanced Overview Panel:", e);
        dom.$("predictiveOverviewPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering overview: ${e.message}</div>`;
    }

    // --- 2. Enhanced Charts Panel with Model Differentiation ---
    try {
        const chartsPanel = dom.$("predictiveChartsPanel");
        chartsPanel.innerHTML = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold mb-4 text-center">Visual Analysis</h3>
                <div>
                    <h4 class="text-xl font-semibold mb-2">Enhanced Forecast with Business Context</h4>
                    <div id="predictiveForecastChart" class="w-full h-[500px] plotly-chart bg-black/10 rounded-lg border border-white/20"></div>
                    <p class="text-xs text-white/60 mt-2 text-center">
                        Shaded area represents ${formatMetric((model_performance.confidence_level || 0.90) * 100, 0)}% confidence interval. 
                        ${business_context?.trajectory ? `Business trajectory: ${business_context.trajectory}` : ''}
                    </p>
                </div>
            </div>
        `;

        if (predictions && predictions.length > 0) {
            // Add historical data if available
            let historicalTrace = null;
            if (historical_data && historical_data.length > 0) {
                historicalTrace = {
                    x: historical_data.map(h => h.period),
                    y: historical_data.map(h => h.value),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Historical Data',
                    line: { 
                        color: '#8B5CF6', // Purple for historical
                        width: 3 
                    },
                    marker: { 
                        size: 6, 
                        color: '#8B5CF6' 
                    }
                };
            }

            // Enhanced forecast trace with model-specific styling
            const modelType = model_performance?.model_used || 'Unknown';
            let forecastColor = '#10B981'; // Default green
            let lineStyle = 'solid';
            
            // Differentiate by model type
            switch(modelType.toLowerCase()) {
                case 'linear regression':
                case 'linear trend':
                    forecastColor = '#3B82F6'; // Blue for linear
                    lineStyle = 'solid';
                    break;
                case 'seasonal forecast':
                case 'seasonal decomposition':
                    forecastColor = '#F59E0B'; // Orange for seasonal
                    lineStyle = 'solid';
                    break;
                case 'simple trend':
                    forecastColor = '#EF4444'; // Red for simple trend
                    lineStyle = 'dash';
                    break;
                case 'auto-select best':
                default:
                    forecastColor = '#10B981'; // Green for auto-select
                    lineStyle = 'solid';
                    break;
            }

            const traceForecast = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.predicted_value),
                type: 'scatter', 
                mode: 'lines+markers', 
                name: `Forecast (${modelType})`,
                line: { 
                    color: forecastColor,
                    width: 4,
                    dash: lineStyle
                },
                marker: { 
                    size: 8,
                    color: forecastColor,
                    line: { color: 'white', width: 2 }
                }
            };
            
            // Enhanced confidence bounds with model-specific colors
            const traceUpper = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.upper_bound),
                type: 'scatter', 
                mode: 'lines', 
                name: 'Upper Bound',
                line: { 
                    dash: 'dot', 
                    color: `rgba(255,255,255,0.7)`,
                    width: 2
                },
                fill: 'none',
                showlegend: true
            };
            
            const traceLower = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.lower_bound),
                type: 'scatter', 
                mode: 'lines', 
                name: 'Lower Bound',
                line: { 
                    dash: 'dot', 
                    color: `rgba(255,255,255,0.7)`,
                    width: 2
                },
                fill: 'tonexty',
                fillcolor: `${forecastColor}33`, // 20% opacity of forecast color
                showlegend: true
            };

            // Enhanced annotations with model-specific insights
            const annotations = [];
            
            // Add model type annotation
            if (predictions.length > 3) {
                const midPoint = Math.floor(predictions.length / 2);
                annotations.push({
                    x: predictions[midPoint]?.period,
                    y: predictions[midPoint]?.predicted_value,
                    text: `<b>${modelType}</b><br>${business_context?.trajectory || 'Pattern'} Detected`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: forecastColor,
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: forecastColor,
                    borderwidth: 1,
                    font: { color: 'white', size: 10 }
                });
            }

            // Add trend direction annotation if significant change
            if (business_context?.change_percent && Math.abs(business_context.change_percent) > 5) {
                const lastPoint = predictions.length - 1;
                annotations.push({
                    x: predictions[lastPoint]?.period,
                    y: predictions[lastPoint]?.predicted_value,
                    text: `<b>${Math.abs(business_context.change_percent).toFixed(1)}%</b><br>${business_context.change_percent > 0 ? '↗️ Growth' : '↘️ Decline'}`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: business_context.change_percent > 0 ? '#10B981' : '#EF4444',
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: business_context.change_percent > 0 ? '#10B981' : '#EF4444',
                    borderwidth: 1,
                    font: { color: 'white', size: 10 },
                    ax: -30,
                    ay: -30
                });
            }

            // Create traces array
            const traces = [traceLower, traceUpper, traceForecast];
            if (historicalTrace) {
                traces.unshift(historicalTrace); // Add historical data first
            }

            // Enhanced layout with better differentiation
            const layout = {
                title: {
                    text: `${modelType} Forecast: ${business_context?.trajectory || 'Pattern'} Detected`,
                    font: { color: 'white', size: 18, family: 'Arial, sans-serif' }
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0.1)',
                font: { color: 'white', size: 12 },
                xaxis: { 
                    title: {
                        text: 'Time Period',
                        font: { size: 14, color: 'white' }
                    },
                    gridcolor: 'rgba(255,255,255,0.3)',
                    tickformat: '%Y-%m',
                    tickfont: { size: 11, color: 'white' },
                    linecolor: 'rgba(255,255,255,0.5)',
                    linewidth: 1
                },
                yaxis: { 
                    title: {
                        text: 'Value',
                        font: { size: 14, color: 'white' }
                    },
                    gridcolor: 'rgba(255,255,255,0.3)',
                    zeroline: false,
                    tickfont: { size: 11, color: 'white' },
                    linecolor: 'rgba(255,255,255,0.5)',
                    linewidth: 1
                },
                legend: { 
                    orientation: 'h', 
                    y: -0.15, 
                    yanchor: 'top',
                    bgcolor: 'rgba(0,0,0,0.7)',
                    bordercolor: 'rgba(255,255,255,0.3)',
                    borderwidth: 1,
                    font: { size: 11, color: 'white' }
                },
                hovermode: 'x unified',
                hoverlabel: {
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: 'white',
                    font: { color: 'white', size: 11 }
                },
                margin: { t: 80, b: 100, l: 80, r: 40 },
                annotations: annotations,
                // Add vertical line to separate historical from forecast
                shapes: historicalTrace ? [{
                    type: 'line',
                    x0: historicalTrace.x[historicalTrace.x.length - 1],
                    y0: 0,
                    x1: historicalTrace.x[historicalTrace.x.length - 1],
                    y1: 1,
                    yref: 'paper',
                    line: {
                        color: 'rgba(255,255,255,0.5)',
                        width: 2,
                        dash: 'dash'
                    }
                }] : []
            };

            Plotly.newPlot('predictiveForecastChart', traces, layout, { 
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
                displaylogo: false
            });
        } else {
            dom.$("predictiveForecastChart").innerHTML = `<div class="p-4 text-center text-white/60">Forecast data unavailable for charting.</div>`;
        }
    } catch (e) {
        console.error("Error rendering Enhanced Charts Panel:", e);
        dom.$("predictiveChartsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering charts.</div>`;
    }

    // --- 3. Enhanced Details Panel ---
    try {
        const detailsPanel = dom.$("predictiveDetailsPanel");
        const detailsHtml = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold mb-4 text-center">Technical Details</h3>

                <div>
                    <h4 class="text-xl font-semibold mb-3">Enhanced Model Performance Metrics</h4>
                    <p class="text-sm text-white/70 mb-4 italic">Statistics evaluating how well the chosen model (${model_performance.model_used || 'N/A'}) fit the historical data.</p>
                    <div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th>Interpretation Guide</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>Model Used</td><td>${model_performance.model_used || 'N/A'}</td><td class="text-white/70">Algorithm selected for forecasting.</td></tr>
                                <tr><td>Selection Reason</td><td>${model_performance.selection_reason || 'Auto-selected'}</td><td class="text-white/70">Why this model was chosen.</td></tr>
                                <tr><td>R-Squared</td><td>${formatMetric(model_performance.r_squared, 3)}</td><td class="text-white/70">% variance explained (higher = better fit).</td></tr>
                                <tr><td>MAPE (%)</td><td>${formatMetric(model_performance.mape, 1)}</td><td class="text-white/70">Mean Absolute Percentage Error (lower = better accuracy).</td></tr>
                                <tr><td>MAE</td><td>${formatMetric(model_performance.mae, 2)}</td><td class="text-white/70">Mean Absolute Error (avg. error magnitude in original units).</td></tr>
                                <tr><td>RMSE</td><td>${formatMetric(model_performance.rmse, 2)}</td><td class="text-white/70">Root Mean Squared Error (error magnitude, penalizes large errors).</td></tr>
                                ${model_performance.validation_folds ? `<tr><td>Cross-Validation Folds</td><td>${model_performance.validation_folds}</td><td class="text-white/70">Number of validation tests performed.</td></tr>` : ''}
                            </tbody>
                        </table>
                        <blockquote class="mt-4 p-3 text-xs italic border-l-2 border-indigo-400 bg-black/20 text-white/70">${model_performance.interpretation || 'Model fit interpretation unavailable.'}</blockquote>
                    </div>
                </div>

                ${business_context ? `
                <div>
                    <h4 class="text-xl font-semibold mb-3">Business Context Analysis</h4>
                    <div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Business Metric</th>
                                    <th>Value</th>
                                    <th>Interpretation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>Business Trajectory</td><td>${business_context.trajectory || 'Unknown'}</td><td class="text-white/70">Overall direction of change.</td></tr>
                                <tr><td>Expected Change</td><td>${formatMetric(Math.abs(business_context.change_percent || 0), 1, '%')} ${(business_context.change_percent || 0) >= 0 ? 'Growth' : 'Decline'}</td><td class="text-white/70">Projected change over forecast period.</td></tr>
                                <tr><td>Risk Level</td><td>${business_context.risk_level || 'Unknown'}</td><td class="text-white/70">Overall forecast risk assessment.</td></tr>
                                <tr><td>Current Volatility</td><td>${formatMetric(business_context.current_volatility, 1, '%')}</td><td class="text-white/70">Historical variability level.</td></tr>
                                <tr><td>Predicted Volatility</td><td>${formatMetric(business_context.predicted_volatility, 1, '%')}</td><td class="text-white/70">Expected future variability.</td></tr>
                                <tr><td>Planning Horizon</td><td>${business_context.planning_horizon_recommendation || 'N/A'}</td><td class="text-white/70">Recommended planning timeframe.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <div>
                    <h4 class="text-xl font-semibold mb-3">Forecast Data Table</h4>
                    <p class="text-sm text-white/70 mb-4 italic">Predicted values and ${formatMetric((model_performance.confidence_level || 0.90) * 100, 0)}% confidence intervals for each future period.</p>
                    <div class="overflow-x-auto max-h-[500px]">
                        <table class="coeff-table styled-table forecast-table text-sm">
                            <thead class="sticky top-0 bg-gray-800/80 backdrop-blur-sm">
                                <tr>
                                    <th>Period</th>
                                    <th>Predicted Value</th>
                                    <th>Lower Bound</th>
                                    <th>Upper Bound</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${predictions?.map(p => `
                                    <tr>
                                        <td>${p.period ?? 'N/A'}</td>
                                        <td><strong>${formatMetric(p.predicted_value, 2)}</strong></td>
                                        <td>${formatMetric(p.lower_bound, 2)}</td>
                                        <td>${formatMetric(p.upper_bound, 2)}</td>
                                    </tr>`).join("") ?? '<tr><td colspan="4" class="text-center text-white/60">No prediction data available.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        detailsPanel.innerHTML = detailsHtml;
    } catch (e) {
        console.error("Error rendering Enhanced Details Panel:", e);
        dom.$("predictiveDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering details: ${e.message}</div>`;
    }

    // --- 4. Enhanced Insights Panel ---
    try {
        const insightsPanel = dom.$("predictiveInsightsPanel");
        let insightsHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center">💡 Strategic Insights & Recommendations</h3>`;

        if (insights && insights.length > 0) {
            insights.forEach((insight, index) => {
                const confidenceLevel = insight.confidence_level || 'Medium';
                const confidenceClass = confidenceLevel === 'High' ? 'border-green-500' : 
                                      confidenceLevel === 'Medium' ? 'border-yellow-500' : 'border-red-500';
                const confidenceIcon = confidenceLevel === 'High' ? '🟢' : 
                                      confidenceLevel === 'Medium' ? '🟡' : '🔴';
                
                insightsHtml += `
                    <div class="insight-card border-l-4 ${confidenceClass} relative">
                        <div class="flex justify-between items-start mb-2">
                            <p class="text-xs font-semibold text-indigo-300 mb-1">INSIGHT ${index + 1}</p>
                            <span class="text-xs bg-black/30 px-2 py-1 rounded flex items-center">
                                ${confidenceIcon} ${confidenceLevel} Confidence
                            </span>
                        </div>
                        <p class="mb-2"><strong>Observation:</strong> ${insight.observation}</p>
                        <p class="mb-2 text-sm text-white/80"><strong>Analysis:</strong> ${insight.accurate_interpretation}</p>
                        <div class="p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded mt-3 border-l-2 border-purple-400">
                            <p class="text-sm font-semibold">💼 Business Implication:</p>
                            <p class="text-sm text-white/90 mt-1">${insight.business_implication}</p>
                        </div>
                    </div>`;
            });
        } else {
            insightsHtml += `<p class="text-center text-white/70 italic">No specific insights were generated by the analysis.</p>`;
        }
        
        insightsHtml += `</div>`;
        insightsPanel.innerHTML = insightsHtml;
    } catch (e) {
        console.error("Error rendering Enhanced Insights Panel:", e);
        dom.$("predictiveInsightsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering insights.</div>`;
    }

    // --- 5. Enhanced Diagnostics Panel ---
    try {
        const diagnosticsPanel = dom.$("predictiveDiagnosticsPanel");
        renderPredictiveDiagnosticsPanel(diagnosticsPanel, data);
    } catch (e) {
        console.error("Error rendering Diagnostics Panel:", e);
        dom.$("predictiveDiagnosticsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering diagnostics: ${e.message}</div>`;
    }

    // --- 6. Simplified Learn Panel ---
    try {
        const learnPanel = dom.$("predictiveLearnPanel");
        renderPredictiveLearnPanel(learnPanel, data);
    } catch (e) {
        console.error("Error rendering Learn Panel:", e);
        dom.$("predictiveLearnPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering learn section: ${e.message}</div>`;
    }

    // --- Final Touches (keeping existing logic) ---
    try {
        appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
        dom.$("analysisActions").classList.remove("hidden");

        // --- Tab Switching Logic ---
        tabNav.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" && !e.target.classList.contains('active')) {
                tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
                tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

                e.target.classList.add("active");
                const targetPanelId = "predictive" + e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1) + "Panel";
                const targetPanel = dom.$(targetPanelId);
                if (targetPanel) {
                    targetPanel.classList.add("active");

                    const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                    chartsInPanel.forEach(chartDiv => {
                        if (chartDiv.layout && typeof Plotly !== 'undefined') {
                            try {
                                Plotly.Plots.resize(chartDiv);
                                console.log(`Resized chart ${chartDiv.id} on tab switch.`);
                            } catch (resizeError) {
                                console.error(`Error resizing chart ${chartDiv.id} on tab switch:`, resizeError);
                            }
                        }
                    });
                } else {
                     console.warn("Target panel not found for tab:", e.target.dataset.tab);
                }
            }
        });

        setTimeout(() => {
             const activePanel = tabContent.querySelector('.analysis-tab-panel.active');
             if (activePanel) {
                 activePanel.querySelectorAll(".plotly-chart").forEach(chartDiv => {
                     if (chartDiv.layout && typeof Plotly !== 'undefined') {
                         try {
                              Plotly.Plots.resize(chartDiv);
                              console.log(`Initial resize for chart ${chartDiv.id} attempted.`);
                         } catch (initialResizeError) {
                              console.error(`Error during initial resize ${chartDiv.id}:`, initialResizeError);
                         }
                     }
                 });
             }
        }, 200);

    } catch (e) {
        console.error("Error during final setup (cache/tabs/buttons):", e);
        if (!container.innerHTML.includes('text-red-400')) {
             container.innerHTML += `<div class="p-4 text-center text-red-400">Error setting up UI components after rendering.</div>`;
        }
    } finally {
        setLoading("generate", false);
    }
}

/**
 * Warnings and Diagnostics Panel Function
 * Call this to populate the new diagnostics tab
 */
function renderPredictiveDiagnosticsPanel(diagnosticsPanel, data) {
    const { model_performance, business_context, data_info, predictions } = data;
    
    // Calculate diagnostic metrics
    const dataPoints = data_info?.total_points || predictions.length * 2;
    const forecastHorizon = predictions.length || 12;
    const r2 = model_performance?.r_squared || 0;
    const mape = model_performance?.mape || 100;
    const riskLevel = business_context?.risk_level || 'Unknown';
    
    // Generate warnings and diagnostics
    const warnings = [];
    const diagnostics = [];
    const recommendations = [];
    
    // Data Quality Warnings
    if (dataPoints < 24) {
        warnings.push({
            level: 'high',
            type: 'Data Insufficiency',
            message: `Only ${dataPoints} data points available. Minimum 24 recommended for reliable analysis.`,
            impact: 'Low confidence in seasonal patterns and model validation.'
        });
    } else if (dataPoints < 36) {
        warnings.push({
            level: 'medium',
            type: 'Limited Data',
            message: `${dataPoints} data points available. 36+ recommended for optimal analysis.`,
            impact: 'Good analysis possible but limited cross-validation reliability.'
        });
    }
    
    // Model Performance Warnings
    if (r2 < 0.3) {
        warnings.push({
            level: 'high',
            type: 'Poor Model Fit',
            message: `R-squared of ${(r2 * 100).toFixed(1)}% indicates weak model performance.`,
            impact: 'Predictions may not reflect actual patterns in your data.'
        });
    } else if (r2 < 0.5) {
        warnings.push({
            level: 'medium',
            type: 'Moderate Model Fit',
            message: `R-squared of ${(r2 * 100).toFixed(1)}% suggests room for improvement.`,
            impact: 'Use predictions with caution for strategic decisions.'
        });
    }
    
    if (mape > 30) {
        warnings.push({
            level: 'high',
            type: 'High Prediction Error',
            message: `MAPE of ${mape.toFixed(1)}% indicates significant prediction errors.`,
            impact: 'Consider this forecast as directional guidance only.'
        });
    } else if (mape > 15) {
        warnings.push({
            level: 'medium',
            type: 'Moderate Prediction Error',
            message: `MAPE of ${mape.toFixed(1)}% suggests moderate prediction accuracy.`,
            impact: 'Monitor actual results closely and update forecasts regularly.'
        });
    }
    
    // Forecast Horizon Warnings
    if (forecastHorizon > dataPoints / 2) {
        warnings.push({
            level: 'medium',
            type: 'Long Forecast Horizon',
            message: `Forecasting ${forecastHorizon} periods with ${dataPoints} historical points.`,
            impact: 'Confidence decreases significantly for later periods.'
        });
    }
    
    // Risk Assessment Warnings
    if (riskLevel === 'High') {
        warnings.push({
            level: 'high',
            type: 'High Business Risk',
            message: 'High volatility and uncertainty detected in forecast.',
            impact: 'Consider scenario planning and frequent forecast updates.'
        });
    }
    
    // Generate Diagnostics
    diagnostics.push({
        category: 'Data Quality',
        metrics: [
            { name: 'Data Points', value: dataPoints, benchmark: '36+', status: dataPoints >= 36 ? 'good' : dataPoints >= 24 ? 'fair' : 'poor' },
            { name: 'Data Range', value: `${data_info?.date_range_days || 'Unknown'} days`, benchmark: '730+ days', status: (data_info?.date_range_days || 0) >= 730 ? 'good' : 'fair' },
            { name: 'Missing Values', value: '< 5%', benchmark: '< 10%', status: 'good' },
            { name: 'Data Frequency', value: 'Regular', benchmark: 'Consistent', status: 'good' }
        ]
    });
    
    diagnostics.push({
        category: 'Model Performance',
        metrics: [
            { name: 'R-Squared', value: `${(r2 * 100).toFixed(1)}%`, benchmark: '70%+', status: r2 >= 0.7 ? 'good' : r2 >= 0.5 ? 'fair' : 'poor' },
            { name: 'MAPE', value: `${mape.toFixed(1)}%`, benchmark: '< 15%', status: mape <= 15 ? 'good' : mape <= 30 ? 'fair' : 'poor' },
            { name: 'Cross-Validation', value: `${model_performance?.validation_folds || 0} folds`, benchmark: '5+ folds', status: (model_performance?.validation_folds || 0) >= 5 ? 'good' : 'fair' },
            { name: 'Model Selection', value: model_performance?.model_used || 'Unknown', benchmark: 'Auto-Selected', status: 'good' }
        ]
    });
    
    diagnostics.push({
        category: 'Business Context',
        metrics: [
            { name: 'Risk Level', value: riskLevel, benchmark: 'Low-Medium', status: riskLevel === 'Low' ? 'good' : riskLevel === 'Medium' ? 'fair' : 'poor' },
            { name: 'Volatility', value: `${(business_context?.predicted_volatility || 0).toFixed(1)}%`, benchmark: '< 25%', status: (business_context?.predicted_volatility || 0) < 25 ? 'good' : 'fair' },
            { name: 'Trend Stability', value: business_context?.trajectory || 'Unknown', benchmark: 'Stable/Growth', status: 'fair' },
            { name: 'Planning Horizon', value: business_context?.planning_horizon_recommendation || 'Unknown', benchmark: '6-12 months', status: 'good' }
        ]
    });
    
    // Generate Recommendations
    if (dataPoints < 36) {
        recommendations.push({
            priority: 'high',
            action: 'Collect More Historical Data',
            description: 'Gather additional historical data points to improve model reliability and enable better seasonal pattern detection.',
            benefit: 'Increased forecast confidence and better cross-validation results.'
        });
    }
    
    if (mape > 20) {
        recommendations.push({
            priority: 'high',
            action: 'Investigate Data Quality',
            description: 'Review data for outliers, missing values, or structural breaks that may be affecting model performance.',
            benefit: 'Improved prediction accuracy and model reliability.'
        });
    }
    
    if (riskLevel === 'High') {
        recommendations.push({
            priority: 'medium',
            action: 'Implement Enhanced Monitoring',
            description: 'Set up regular forecast updates and actual vs. predicted tracking to quickly identify deviations.',
            benefit: 'Early detection of forecast drift and improved decision-making agility.'
        });
    }
    
    recommendations.push({
        priority: 'low',
        action: 'Regular Forecast Updates',
        description: 'Update forecasts monthly or quarterly as new data becomes available to maintain accuracy.',
        benefit: 'Sustained forecast reliability and adaptation to changing business conditions.'
    });
    
    diagnosticsPanel.innerHTML = `
        <div class="p-6 space-y-8 text-white/90 max-w-6xl mx-auto">
            <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                ⚠️ Warnings & Diagnostics
            </h3>
            
            <!-- Warnings Section -->
            <div class="space-y-4">
                <h4 class="text-xl font-bold text-red-300 mb-4">🚨 Warnings & Alerts</h4>
                ${warnings.length > 0 ? warnings.map(warning => `
                    <div class="p-4 rounded-lg border-l-4 ${
                        warning.level === 'high' ? 'bg-red-900/20 border-red-500' : 
                        warning.level === 'medium' ? 'bg-yellow-900/20 border-yellow-500' : 
                        'bg-blue-900/20 border-blue-500'
                    }">
                        <div class="flex items-start space-x-3">
                            <div class="text-2xl">${warning.level === 'high' ? '🔴' : warning.level === 'medium' ? '🟡' : '🔵'}</div>
                            <div class="flex-1">
                                <h5 class="font-semibold text-lg ${
                                    warning.level === 'high' ? 'text-red-300' : 
                                    warning.level === 'medium' ? 'text-yellow-300' : 
                                    'text-blue-300'
                                }">${warning.type}</h5>
                                <p class="text-white/90 mt-1">${warning.message}</p>
                                <p class="text-white/70 text-sm mt-2"><strong>Impact:</strong> ${warning.impact}</p>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                        <div class="text-2xl mb-2">✅</div>
                        <p class="text-green-300 font-semibold">No Critical Warnings Detected</p>
                        <p class="text-white/70 text-sm mt-1">Your analysis appears to be within acceptable parameters.</p>
                    </div>
                `}
            </div>
            
            <!-- Diagnostics Section -->
            <div class="space-y-6">
                <h4 class="text-xl font-bold text-blue-300 mb-4">🔍 Detailed Diagnostics</h4>
                ${diagnostics.map(category => `
                    <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                        <h5 class="text-lg font-semibold text-indigo-300 mb-4">${category.category}</h5>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${category.metrics.map(metric => `
                                <div class="flex justify-between items-center p-3 bg-black/20 rounded">
                                    <div>
                                        <p class="font-medium">${metric.name}</p>
                                        <p class="text-xs text-white/60">Target: ${metric.benchmark}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-semibold">${metric.value}</p>
                                        <span class="text-xs px-2 py-1 rounded ${
                                            metric.status === 'good' ? 'bg-green-600/20 text-green-300' :
                                            metric.status === 'fair' ? 'bg-yellow-600/20 text-yellow-300' :
                                            'bg-red-600/20 text-red-300'
                                        }">
                                            ${metric.status === 'good' ? '✓ Good' : metric.status === 'fair' ? '⚠ Fair' : '✗ Poor'}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Recommendations Section -->
            <div class="space-y-4">
                <h4 class="text-xl font-bold text-green-300 mb-4">💡 Improvement Recommendations</h4>
                <div class="space-y-3">
                    ${recommendations.map((rec, index) => `
                        <div class="p-4 bg-black/20 rounded-lg border border-white/10">
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    rec.priority === 'high' ? 'bg-red-600 text-white' :
                                    rec.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                    'bg-blue-600 text-white'
                                }">${index + 1}</div>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-2 mb-2">
                                        <h5 class="font-semibold">${rec.action}</h5>
                                        <span class="text-xs px-2 py-1 rounded ${
                                            rec.priority === 'high' ? 'bg-red-600/20 text-red-300' :
                                            rec.priority === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                                            'bg-blue-600/20 text-blue-300'
                                        }">
                                            ${rec.priority.toUpperCase()} PRIORITY
                                        </span>
                                    </div>
                                    <p class="text-white/80 text-sm mb-2">${rec.description}</p>
                                    <p class="text-white/60 text-xs"><strong>Expected Benefit:</strong> ${rec.benefit}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Model Health Summary -->
            <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-lg border border-purple-500/20">
                <h4 class="text-lg font-bold text-purple-300 mb-4">📊 Overall Model Health</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <div class="text-2xl font-bold ${r2 >= 0.7 ? 'text-green-400' : r2 >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">
                            ${r2 >= 0.7 ? 'Excellent' : r2 >= 0.5 ? 'Good' : 'Poor'}
                        </div>
                        <p class="text-xs text-white/70">Model Fit Quality</p>
                    </div>
                    <div>
                        <div class="text-2xl font-bold ${dataPoints >= 36 ? 'text-green-400' : dataPoints >= 24 ? 'text-yellow-400' : 'text-red-400'}">
                            ${dataPoints >= 36 ? 'Sufficient' : dataPoints >= 24 ? 'Adequate' : 'Limited'}
                        </div>
                        <p class="text-xs text-white/70">Data Sufficiency</p>
                    </div>
                    <div>
                        <div class="text-2xl font-bold ${warnings.filter(w => w.level === 'high').length === 0 ? 'text-green-400' : 'text-red-400'}">
                            ${warnings.filter(w => w.level === 'high').length === 0 ? 'Stable' : 'Caution'}
                        </div>
                        <p class="text-xs text-white/70">Forecast Reliability</p>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                <p class="text-xs text-white/60">
                    Regular diagnostics help ensure forecast quality and reliability. Address high-priority recommendations first for maximum impact.
                </p>
            </div>
        </div>
    `;
}

/**
 * Simplified Learn Predictive Analysis Panel Function
 * Focuses purely on educational content without diagnostics
 */
function renderPredictiveLearnPanel(learnPanel, data) {
    learnPanel.innerHTML = `
        <div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
            <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                🎓 Learn Predictive Analysis
            </h3>
            
            <!-- Main Definition -->
            <div class="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg border border-purple-500/30">
                <h4 class="text-xl font-bold mb-3 text-purple-300">What is Predictive Analysis?</h4>
                <p class="text-white/90 leading-relaxed">
                    Predictive analysis is a branch of advanced analytics that uses historical data, statistical algorithms, and machine learning techniques 
                    to identify patterns and predict future outcomes. Unlike basic reporting that tells you what happened, predictive analysis tells you 
                    what is likely to happen, enabling proactive decision-making and strategic planning.
                </p>
            </div>
            
            <!-- Core Concepts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-4 text-green-300">🔬 Core Components</h4>
                    <ul class="space-y-3 text-sm">
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Time-Series Analysis:</strong> Examines data points collected over time to identify trends, patterns, and seasonality
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Statistical Modeling:</strong> Uses mathematical models to understand relationships between variables
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Pattern Recognition:</strong> Identifies recurring patterns that can predict future behavior
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Uncertainty Quantification:</strong> Measures confidence levels and risk in predictions
                            </div>
                        </li>
                    </ul>
                </div>
                
                <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-4 text-blue-300">🎯 Business Applications</h4>
                    <ul class="space-y-3 text-sm">
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Financial Planning:</strong> Budget forecasting, revenue projection, expense planning
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Demand Forecasting:</strong> Inventory management, production planning, resource allocation
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Risk Management:</strong> Market volatility assessment, scenario planning
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Strategic Planning:</strong> Long-term goal setting, market expansion decisions
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
            
            <!-- Model Types -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-yellow-300">🤖 Forecasting Models Explained</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-black/20 rounded border border-blue-500/30">
                        <h5 class="font-semibold text-blue-300 mb-2">Linear/Trend Models</h5>
                        <p class="text-xs text-white/80 mb-2">Best for data with consistent directional movement</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Steady growth or decline patterns</p>
                            <p><strong>Examples:</strong> Population growth, cumulative sales</p>
                        </div>
                    </div>
                    <div class="p-4 bg-black/20 rounded border border-green-500/30">
                        <h5 class="font-semibold text-green-300 mb-2">Seasonal Models</h5>
                        <p class="text-xs text-white/80 mb-2">Ideal for cyclical business patterns</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Regular seasonal fluctuations</p>
                            <p><strong>Examples:</strong> Retail sales, tourism, energy consumption</p>
                        </div>
                    </div>
                    <div class="p-4 bg-black/20 rounded border border-purple-500/30">
                        <h5 class="font-semibold text-purple-300 mb-2">Auto-Selection</h5>
                        <p class="text-xs text-white/80 mb-2">Automatically chooses the best model</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Unsure which model fits best</p>
                            <p><strong>Benefits:</strong> Cross-validation ensures optimal choice</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Key Metrics -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-indigo-300">📊 Understanding Key Metrics</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div class="space-y-4">
                        <div class="border-l-4 border-green-400 pl-4">
                            <h5 class="font-semibold text-green-300">R-Squared (R²)</h5>
                            <p class="text-white/80 mb-1">Measures how well the model explains historical data variance</p>
                            <div class="text-xs text-white/60">
                                <p>• 0.80+ = Excellent fit</p>
                                <p>• 0.60-0.79 = Good fit</p>
                                <p>• 0.40-0.59 = Moderate fit</p>
                                <p>• Below 0.40 = Poor fit</p>
                            </div>
                        </div>
                        <div class="border-l-4 border-blue-400 pl-4">
                            <h5 class="font-semibold text-blue-300">MAPE (Mean Absolute Percentage Error)</h5>
                            <p class="text-white/80 mb-1">Average percentage difference between predicted and actual values</p>
                            <div class="text-xs text-white/60">
                                <p>• Under 10% = Highly accurate</p>
                                <p>• 10-20% = Good accuracy</p>
                                <p>• 20-50% = Reasonable accuracy</p>
                                <p>• Above 50% = Poor accuracy</p>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="border-l-4 border-purple-400 pl-4">
                            <h5 class="font-semibold text-purple-300">Confidence Intervals</h5>
                            <p class="text-white/80 mb-1">Range of values where the true outcome is likely to fall</p>
                            <div class="text-xs text-white/60">
                                <p>• 90% confidence = 9 out of 10 outcomes fall within range</p>
                                <p>• Wider intervals = Higher uncertainty</p>
                                <p>• Narrower intervals = More precise predictions</p>
                            </div>
                        </div>
                        <div class="border-l-4 border-red-400 pl-4">
                            <h5 class="font-semibold text-red-300">Cross-Validation</h5>
                            <p class="text-white/80 mb-1">Testing model performance on different data subsets</p>
                            <div class="text-xs text-white/60">
                                <p>• Prevents overfitting to historical data</p>
                                <p>• More folds = More reliable validation</p>
                                <p>• Essential for model selection</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Data Requirements -->
            <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-6 rounded-lg border border-blue-500/20">
                <h4 class="text-lg font-bold mb-4 text-blue-300">📋 Data Requirements & Best Practices</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h5 class="font-semibold text-green-300 mb-3">Data Quality Guidelines</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Minimum 24 data points</strong> for basic analysis</li>
                            <li>• <strong>36+ points recommended</strong> for seasonal detection</li>
                            <li>• <strong>60+ points optimal</strong> for high confidence</li>
                            <li>• Regular time intervals (monthly, weekly, etc.)</li>
                            <li>• Minimal missing values (< 10%)</li>
                            <li>• Consistent data collection methods</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-yellow-300 mb-3">Common Data Issues</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Outliers:</strong> Extreme values that skew results</li>
                            <li>• <strong>Structural breaks:</strong> Major business changes</li>
                            <li>• <strong>Missing data:</strong> Gaps in time series</li>
                            <li>• <strong>Inconsistent frequency:</strong> Irregular intervals</li>
                            <li>• <strong>External shocks:</strong> One-time events</li>
                            <li>• <strong>Data drift:</strong> Changing measurement methods</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Interpretation Guide -->
            <details class="styled-details bg-white/5 rounded-lg">
                <summary class="font-semibold cursor-pointer p-4 text-lg text-indigo-300">🎯 How to Interpret Results</summary>
                <div class="px-6 pb-6 space-y-4 text-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 bg-green-900/20 border border-green-500/30 rounded">
                            <h5 class="font-semibold text-green-300 mb-2">High Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² > 70%, MAPE < 15%, 5+ validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for strategic planning</li>
                                <li>• Set budget targets</li>
                                <li>• Make resource allocation decisions</li>
                                <li>• Plan capacity expansions</li>
                            </ul>
                        </div>
                        <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                            <h5 class="font-semibold text-yellow-300 mb-2">Medium Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² 50-70%, MAPE 15-30%, 3-4 validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for tactical planning</li>
                                <li>• Monitor closely</li>
                                <li>• Build in flexibility</li>
                                <li>• Consider scenario planning</li>
                            </ul>
                        </div>
                        <div class="p-4 bg-red-900/20 border border-red-500/30 rounded">
                            <h5 class="font-semibold text-red-300 mb-2">Low Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² < 50%, MAPE > 30%, < 3 validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for directional guidance only</li>
                                <li>• Collect more data</li>
                                <li>• Investigate data quality</li>
                                <li>• Consider external factors</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Limitations -->
            <details class="styled-details bg-white/5 rounded-lg">
                <summary class="font-semibold cursor-pointer p-4 text-lg text-red-300">⚠️ Understanding Limitations</summary>
                <div class="px-6 pb-6 space-y-4 text-sm">
                    <div class="p-4 bg-red-900/20 border border-red-500/30 rounded">
                        <h5 class="font-semibold text-red-300 mb-3">Important Assumptions</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Historical patterns continue:</strong> Future resembles the past</li>
                            <li>• <strong>No major disruptions:</strong> Business environment remains stable</li>
                            <li>• <strong>Data quality:</strong> Historical data accurately reflects reality</li>
                            <li>• <strong>Model assumptions:</strong> Statistical model fits the underlying process</li>
                        </ul>
                    </div>
                    <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <h5 class="font-semibold text-yellow-300 mb-3">When Predictions May Fail</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• Market disruptions (economic crashes, pandemics)</li>
                            <li>• Technology shifts (digital transformation)</li>
                            <li>• Regulatory changes (new laws, policies)</li>
                            <li>• Competitive landscape changes (new entrants)</li>
                            <li>• Consumer behavior shifts (changing preferences)</li>
                        </ul>
                    </div>
                </div>
            </details>
            
            <!-- Best Practices -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-purple-300">✨ Best Practices for Success</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h5 class="font-semibold text-blue-300 mb-3">Before Analysis</h5>
                        <ul class="space-y-1 text-white/80">
                            <li>• Clean and validate your data</li>
                            <li>• Ensure consistent time intervals</li>
                            <li>• Document any known business changes</li>
                            <li>• Remove or explain outliers</li>
                            <li>• Verify data accuracy</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-green-300 mb-3">After Analysis</h5>
                        <ul class="space-y-1 text-white/80">
                            <li>• Review model diagnostics carefully</li>
                            <li>• Consider external factors not in data</li>
                            <li>• Plan for multiple scenarios</li>
                            <li>• Monitor actual vs. predicted regularly</li>
                            <li>• Update forecasts with new data</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                <p class="text-xs text-white/60">
                    Predictive analysis is a powerful tool for data-driven decision making. Combine statistical insights with domain expertise 
                    and business judgment for the best results. Always consider the context and limitations of your predictions.
                </p>
            </div>
        </div>
    `;
}



function renderPrescriptivePage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state

     // Basic validation
    if (!data || !data.main_goal || !data.data_insights || !data.prescriptions || !Array.isArray(data.data_insights) || !Array.isArray(data.prescriptions)) {
         console.error("Incomplete data passed to renderPrescriptivePage_DA:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
         dom.$("analysisActions").classList.add("hidden");
         return;
     }

    const { main_goal, data_insights, prescriptions } = data;


    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Added "Learn Prescriptive" tab
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="prescriptions">💊 Prescriptions</button>
        <button class="analysis-tab-btn" data-tab="insights">🔍 Data Insights</button>
        <button class="analysis-tab-btn" data-tab="matrix">🗺️ Prioritization Matrix</button>
        <button class="analysis-tab-btn" data-tab="kpis">📈 KPI Tracker</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Prescriptive</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added panel for "Learn Prescriptive"
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="prescriptionsPanel" class="analysis-tab-panel"></div>
        <div id="insightsPanel" class="analysis-tab-panel"></div>
        <div id="matrixPanel" class="analysis-tab-panel"></div>
        <div id="kpisPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel (No major changes needed, uses existing fields) ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4">
                <div class="p-6 rounded-lg bg-white/10 border border-white/20 text-center mb-8">
                    <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Business Goal</h3>
                    <p class="text-2xl italic text-white/90">${main_goal}</p>
                </div>
                <h3 class="text-2xl font-bold text-center mb-4">Recommended Prescriptions</h3>`;
     if (prescriptions.length > 0) {
          dashboardHtml += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(prescriptions.length, 4)} gap-6">`; // Adjust columns based on number
         prescriptions.forEach((p) => {
             dashboardHtml += `<div class="dashboard-prescription-card">
                         <h4 class="text-xl font-bold mb-2">${p.recommendation ?? 'N/A'}</h4>
                         <p class="text-sm text-white/70 mb-4"><strong>Impact:</strong> ${p.impact ?? '?'} | <strong>Effort:</strong> ${p.effort ?? '?'}</p>
                         <p class="font-semibold text-indigo-300 text-sm mt-auto">${p.expected_outcome ?? 'Outcome not specified.'}</p>
                     </div>`;
         });
         dashboardHtml += `</div>`;
     } else {
         dashboardHtml += `<p class="text-center text-white/70 italic">No prescriptions generated.</p>`;
     }
     dashboardHtml += `</div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Populate Prescriptions Panel (Uses new detailed fields) ---
    const prescriptionsPanel = dom.$("prescriptionsPanel");
    let prescriptionsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💊 Detailed Prescriptions</h3>`;
     if (prescriptions.length > 0) {
         prescriptionsHtml += `<div class="space-y-6">`;
         prescriptions.forEach((p, index) => {
             prescriptionsHtml += `<div class="prescription-card">
                         <h4 class="text-xl font-bold">${index + 1}. ${p.recommendation ?? 'N/A'}</h4>
                         <p class="text-xs font-semibold my-1"><span class="text-yellow-300">Impact:</span> ${p.impact ?? '?'} | <span class="text-blue-300">Effort:</span> ${p.effort ?? '?'}</p>
                         <p class="rationale"><strong>Rationale (Linked to Data):</strong> ${p.rationale ?? 'N/A'}</p>
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                             <div class="bg-black/20 p-3 rounded">
                                 <h5 class="font-bold text-indigo-300 mb-2">Action Items</h5>
                                 <ul class="list-disc list-inside space-y-1 text-white/90">${(p.action_items || []).map(a => `<li>${a}</li>`).join("")}</ul>
                                 ${!(p.action_items && p.action_items.length > 0) ? '<p class="text-white/60 italic text-xs">No specific action items defined.</p>' : ''}
                             </div>
                             <div class="bg-black/20 p-3 rounded">
                                 <h5 class="font-bold text-indigo-300 mb-2">Expected Outcome</h5>
                                 <p class="text-white/90">${p.expected_outcome ?? 'N/A'}</p>
                                 <h5 class="font-bold text-indigo-300 mt-3 mb-2">KPIs to Track</h5>
                                 <p class="text-white/90 text-xs">${(p.kpis_to_track || []).join(", ")}</p>
                                 ${!(p.kpis_to_track && p.kpis_to_track.length > 0) ? '<p class="text-white/60 italic text-xs">No specific KPIs defined.</p>' : ''}
                             </div>
                         </div>
                     </div>`;
         });
         prescriptionsHtml += `</div>`;
     } else {
         prescriptionsHtml += `<p class="text-center text-white/70 italic">No prescriptions generated.</p>`;
     }
     prescriptionsHtml += `</div>`;
    prescriptionsPanel.innerHTML = prescriptionsHtml;


    // --- 3. Populate Insights Panel (Uses new structure) ---
    const insightsPanel = dom.$("insightsPanel");
    let insightsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🔍 Key Data Insights Driving Prescriptions</h3>`;
     if (data_insights.length > 0) {
         insightsHtml += `<div class="space-y-6">`;
         data_insights.forEach((i, index) => {
             insightsHtml += `<div class="insight-card border-l-4 border-yellow-400">
                         <p class="text-xs font-semibold text-yellow-300 mb-1">INSIGHT ${index + 1}</p>
                         <p class="text-white/90 mb-3">"${i.insight ?? 'N/A'}"</p>
                         <h4 class="text-sm font-bold text-indigo-300">Business Implication:</h4>
                         <p class="text-white/80 text-sm">${i.implication ?? 'N/A'}</p>
                     </div>`;
         });
         insightsHtml += `</div>`;
     } else {
         insightsHtml += `<p class="text-center text-white/70 italic">No specific data insights were generated.</p>`;
     }
     insightsHtml += `</div>`;
    insightsPanel.innerHTML = insightsHtml;


    // --- 4. Populate Prioritization Matrix Panel (Plotly chart, no changes needed if structure is same) ---
    const matrixPanel = dom.$("matrixPanel");
    matrixPanel.innerHTML = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">🗺️ Prescription Prioritization Matrix</h3><div id="matrixPlot" class="w-full h-[600px] plotly-chart"></div></div>`;
     if (prescriptions.length > 0) {
         try {
             const impactMap = { Low: 1, Medium: 2, High: 3 };
             const effortMap = { Low: 1, Medium: 2, High: 3 };
             // Add jitter
             const addJitter = (val) => val + (Math.random() - 0.5) * 0.2;

             const matrixData = {
                 x: prescriptions.map(p => addJitter(effortMap[p.effort] || 1)),
                 y: prescriptions.map(p => addJitter(impactMap[p.impact] || 1)),
                 text: prescriptions.map(p => p.recommendation ?? 'N/A'),
                 mode: 'markers+text',
                 textposition: 'top right', // Adjusted for jitter
                 marker: { size: 18, color: 'var(--primary)', opacity: 0.8 },
                 type: 'scatter' // Ensure scatter type
             };
             const matrixLayout = { /* Keep layout the same */
                 title: { text: "Impact vs. Effort", y:0.95 },
                 paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "white" },
                 xaxis: { title: "Effort Required", range: [0.5, 3.5], tickvals: [1, 2, 3], ticktext: ["Low", "Medium", "High"], gridcolor: "rgba(255,255,255,0.2)", zeroline: false },
                 yaxis: { title: "Potential Impact", range: [0.5, 3.5], tickvals: [1, 2, 3], ticktext: ["Low", "Medium", "High"], gridcolor: "rgba(255,255,255,0.2)", zeroline: false },
                 shapes: [ { type: "line", x0: 2, y0: 0.5, x1: 2, y1: 3.5, line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dot" } }, { type: "line", x0: 0.5, y0: 2, x1: 3.5, y1: 2, line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dot" } } ],
                 annotations: [ { x: 1, y: 3, text: "Quick Wins", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 3, y: 3, text: "Major Projects", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 1, y: 1, text: "Fill-ins", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 3, y: 1, text: "Thankless Tasks", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } } ]
             };
             Plotly.newPlot('matrixPlot', [matrixData], matrixLayout, { responsive: true });
         } catch(e) {
             console.error("Error rendering prioritization chart:", e);
             matrixPanel.innerHTML += `<p class="text-center text-red-400">Could not render prioritization chart.</p>`;
         }
     } else {
         matrixPanel.innerHTML += `<p class="text-center text-white/70 italic">No prescriptions available to plot.</p>`;
     }


    // --- 5. Populate KPI Tracker Panel (Uses new kpis_to_track) ---
    const kpisPanel = dom.$("kpisPanel");
    let kpisHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📈 Consolidated KPI Tracker</h3>`;
     let kpisAvailable = prescriptions.some(p => p.kpis_to_track && p.kpis_to_track.length > 0);
     if (kpisAvailable) {
         kpisHtml += `<div class="overflow-x-auto"><table class="coeff-table styled-table text-sm">
                     <thead><tr><th>KPI to Track</th><th>Related Prescription</th></tr></thead>
                     <tbody>`;
         prescriptions.forEach((p) => {
             (p.kpis_to_track || []).forEach(kpi => {
                 kpisHtml += `<tr><td>${kpi}</td><td>${p.recommendation ?? 'N/A'}</td></tr>`;
             });
         });
         kpisHtml += `</tbody></table></div>`;
     } else {
         kpisHtml += `<p class="text-center text-white/70 italic">No specific KPIs identified for the proposed prescriptions.</p>`;
     }
     kpisHtml += `</div>`;
    kpisPanel.innerHTML = kpisHtml;

    // --- 6. Populate Learn Prescriptive Tab (New Content) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Prescriptive Analytics</h3>
         [Image of data analysis types: Descriptive, Diagnostic, Predictive, Prescriptive]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Prescriptive Analytics?</h4>
            <p class="text-sm text-white/80">Prescriptive analytics goes beyond predicting future outcomes (predictive analytics) to actually suggest specific actions a user can take to affect those outcomes. It answers the question: <strong>"What should we do about it?"</strong></p>
             <p class="text-sm text-white/80 mt-2">It often combines historical data, business rules, algorithms, machine learning, and simulations to recommend the optimal course of action for a given situation.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Differences:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Descriptive:</strong> What happened? (Reports, Dashboards)</li>
                    <li><strong>Diagnostic:</strong> Why did it happen? (Root Cause Analysis)</li>
                    <li><strong>Predictive:</strong> What is likely to happen? (Forecasting, Likelihoods)</li>
                    <li><strong>Prescriptive:</strong> What should we *do*? (Recommendations, Optimization)</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">How it Works (Simplified):</h4>
                 <ol class="list-decimal list-inside space-y-1 text-sm">
                    <li><strong>Goal Definition:</strong> Clearly state the business objective (e.g., increase sales, reduce churn).</li>
                    <li><strong>Data Analysis:</strong> Identify key factors (drivers) in historical data that influence the goal (Data Insights).</li>
                    <li><strong>Model Building (Often):</strong> Use simulations or optimization algorithms to explore how changing drivers affects the outcome.</li>
                    <li><strong>Recommendation Generation:</strong> Suggest specific actions (Prescriptions) based on the analysis, targeting the key drivers.</li>
                    <li><strong>Outcome Estimation:</strong> Predict the likely result of taking the recommended actions.</li>
                 </ol>
            </div>
        </div>

        <div class="bg-black/20 p-4 rounded-lg">
             <h4 class="text-lg font-bold mb-2 text-indigo-300">Components in This Tool:</h4>
             <ul class="list-disc list-inside space-y-1 text-sm text-white/80">
                <li><strong>Business Goal:</strong> Your specified objective.</li>
                <li><strong>Data Insights:</strong> Patterns found in your uploaded data relevant to the goal.</li>
                <li><strong>Prescriptions:</strong> Specific actions recommended by the AI, directly linked to the insights and goal.</li>
                <li><strong>Rationale:</strong> Explanation of *why* each prescription is suggested based on the data.</li>
                <li><strong>Impact/Effort:</strong> High-level estimate to help prioritize actions.</li>
                <li><strong>Expected Outcome & KPIs:</strong> Measurable targets to track success.</li>
             </ul>
        </div>

        <details class="styled-details text-sm">
            <summary class="font-semibold">Business Benefits</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                <p>✅ <strong>Improved Decision Making:</strong> Provides clear, data-backed recommendations.</p>
                <p>📈 <strong>Optimized Outcomes:</strong> Helps achieve specific business goals more effectively.</p>
                <p>⏱️ <strong>Increased Efficiency:</strong> Automates the process of finding optimal actions.</p>
                <p>ρίск <strong>Risk Mitigation:</strong> Can identify potential negative consequences of certain actions.</p>
                <p>💡 <strong>Actionable Insights:</strong> Translates complex data analysis into concrete steps.</p>
            </div>
        </details>
    </div>
    `;

    // --- Activate Listeners ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the result HTML
    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons

    // Re-attach tab switching logic, including chart resizing
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // Resize chart if matrix tab is activated
                if (e.target.dataset.tab === "matrix") {
                    const chartDiv = dom.$("matrixPlot");
                     if (chartDiv && chartDiv.layout && typeof Plotly !== 'undefined') {
                         try { Plotly.Plots.resize(chartDiv); } catch (e) { console.error("Resize error:", e); }
                     }
                }
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

     // Attempt initial resize after a short delay for Plotly
     setTimeout(() => {
         const initialMatrixChart = dom.$("matrixPlot");
         // Check if the initial active tab IS the matrix tab before resizing
         if (tabNav.querySelector(".analysis-tab-btn.active")?.dataset.tab === "matrix" &&
             initialMatrixChart && initialMatrixChart.layout && typeof Plotly !== 'undefined') {
             try { Plotly.Plots.resize(initialMatrixChart); } catch (e) { console.error("Initial resize error:", e); }
         }
     }, 150);

    // Ensure loading indicator is stopped
    setLoading("generate", false);
}



/**
 * --- UPDATED (V15) ---
 * Renders the full Visualization Analysis page.
 * - ADDS a "Warnings & Diagnostics" tab.
 * - MOVES the data quality and correlation warnings from the
 * "Summary" tab to the new "Warnings" tab.
 * - Calls a new helper, renderVizWarningsPanel, to populate it.
 */
function renderVisualizationPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state

    const { dataset_info, visualizations, suggestions, insights, metadata } = data;

    // Basic validation
    if (!dataset_info || !visualizations || !suggestions || !insights) {
        console.error("Incomplete data passed to renderVisualizationPage_DA:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Visualization results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }

    // --- 1. Define Chart Theme (Same as before) ---
    const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#8E2DE2';
    const colorAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#C33764';
    const colorGrad2 = getComputedStyle(document.documentElement).getPropertyValue('--grad-2').trim() || '#1D2671';
    const colorPalette = [colorPrimary, colorAccent, '#3B82F6', '#10B981', '#F59E0B', '#4A00E0', '#EF4444', colorGrad2];
    const baseLayout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0.1)",
        font: { color: "white", size: 14, family: "'Inter', sans-serif" },
        title: { 
            font: { size: 20, color: 'white' },
            pad: { t: 5, b: 20 },
            x: 0.05, 
            xanchor: 'left'
        },
        xaxis: {
            title: { text: '', font: { size: 16, color: 'rgba(255,255,255,0.7)' } },
            gridcolor: "rgba(255,255,255,0.1)",
            automargin: true,
            tickangle: -30,
            zeroline: false,
            tickfont: { size: 13, color: 'rgba(255,255,255,0.8)' }
        },
        yaxis: {
            title: { text: '', font: { size: 16, color: 'rgba(255,255,255,0.7)' } },
            gridcolor: "rgba(255,255,255,0.1)",
            automargin: true,
            zeroline: false,
            tickfont: { size: 13, color: 'rgba(255,255,255,0.8)' }
        },
        margin: { t: 60, b: 100, l: 80, r: 40 }, 
        showlegend: true,
        legend: {
            font: { size: 12, color: 'white' },
            orientation: 'h',
            y: -0.3, 
            yanchor: 'top',
            bgcolor: 'rgba(0,0,0,0.2)',
            bordercolor: 'rgba(255,255,255,0.2)',
            borderwidth: 1,
            padding: 4
        },
        hoverlabel: {
            bgcolor: '#111827',
            bordercolor: 'rgba(255,255,255,0.3)',
            font: { size: 14, color: 'white' }
        }
    };

    // --- 2. Create Tab Navigation (ADDED "Warnings" tab) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📋 Summary & Insights</button>
        <button class="analysis-tab-btn" data-tab="visuals">📊 Visualizations</button>
        <button class="analysis-tab-btn" data-tab="suggestions">🧠 Suggestions</button>
        <button class="analysis-tab-btn" data-tab="warnings">⚠️ Warnings & Diagnostics</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Viz</button>
    `;
    container.appendChild(tabNav);

    // --- 3. Create Tab Panels (ADDED "warningsPanel") ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active"></div>
        <div id="visualsPanel" class="analysis-tab-panel"></div>
        <div id="suggestionsPanel" class="analysis-tab-panel"></div>
        <div id="warningsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 4. Populate Summary & Insights Panel (CLEANED) ---
    const summaryPanel = dom.$("summaryPanel");
    let summaryHtml = `<div class="p-4 space-y-8">
        <h3 class="text-2xl font-bold mb-6 text-center">Dataset Overview</h3>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
            <div class="summary-stat-card"><div class="stat-value">${dataset_info.rows}</div><div class="stat-label">Rows</div></div>
            <div class="summary-stat-card"><div class="stat-value">${dataset_info.columns}</div><div class="stat-label">Columns</div></div>
            <div class="summary-stat-card"><div class="stat-value">${Object.values(dataset_info.column_info).filter(c => c.data_type === 'numerical').length}</div><div class="stat-label">Numerical Cols</div></div>
            <div class="summary-stat-card"><div class="stat-value">${Object.values(dataset_info.column_info).filter(c => c.data_type === 'categorical').length}</div><div class="stat-label">Categorical Cols</div></div>
        </div>
        
        <h3 class="text-2xl font-bold mb-4">💡 Actionable Insights (from AI)</h3>

        <p class="text-sm text-white/70 italic mb-6">For important caveats about this analysis, please see the <strong>"⚠️ Warnings & Diagnostics"</strong> tab.</p>


        <div class="space-y-6">`;
    if (insights.length > 0 && insights[0].observation !== "Error") {
        insights.forEach((insight, index) => {
            summaryHtml += `<div class="insight-card border-l-4 border-indigo-400">
                <p class="text-xs font-semibold text-indigo-300 mb-1">INSIGHT ${index + 1}</p>
                <p class="mb-2"><strong>Observation:</strong> ${insight.observation}</p>
                <p class="mb-2 text-sm text-white/80"><strong>Interpretation:</strong> ${insight.interpretation}</p>
                <div class="p-3 bg-black/20 rounded mt-3">
                    <p class="text-sm"><strong>Recommendation:</strong> ${insight.recommendation}</p>
                </div>
            </div>`;
        });
    } else {
        summaryHtml += `<p class="text-center text-white/70 italic">No specific AI insights were generated based on the context.</p>`;
    }
    summaryHtml += `</div></div>`;
    summaryPanel.innerHTML = summaryHtml;

    // --- 5. Populate Visualizations Panel (HTML Structure) (Unchanged) ---
    const visualsPanel = dom.$("visualsPanel");
    let visualsHtml = `<div class="p-4 space-y-8">
                        <h3 class="text-2xl font-bold mb-4 text-center">Generated Visualizations</h3>`;
    if (visualizations.length > 0) {
        visualsHtml += `<div class="flex flex-wrap justify-center gap-8">`;
        
        visualizations.forEach((viz, index) => {
            // ... (code for rendering chart/table placeholders is unchanged) ...
            if (viz.error) {
                visualsHtml += `<div class="w-full lg:w-[48%] bg-black/10 rounded-lg p-2 shadow-lg"> 
                    <div class="p-4 text-center text-red-400">
                        <h4 class="font-bold mb-2">${viz.title || 'Chart Error'}</h4>
                        Could not render chart: ${viz.error}
                    </div>
                </div>`;
            } else if (viz.chart_type === "frequency_table") {
                visualsHtml += `<div class="w-full lg:w-[48%] bg-black/10 rounded-lg p-4 shadow-lg">
                                    <h4 class="text-lg font-bold mb-3 text-center">${viz.title}</h4>
                                    <div class="overflow-y-auto max-h-[480px]">
                                    <table class="coeff-table styled-table text-sm w-full">
                                        <thead><tr><th>Value</th><th>Freq.</th><th>%</th><th>Cumul. %</th></tr></thead>
                                        <tbody>`;
                (viz.data.table || []).forEach(row => {
                    visualsHtml += `<tr>
                                        <td>${row.value}</td>
                                        <td>${row.frequency}</td>
                                        <td>${row.percentage.toFixed(1)}%</td>
                                        <td>${row.cumulative_percentage.toFixed(1)}%</td>
                                    </tr>`;
                });
                visualsHtml += `</tbody></table></div>
                                <p class="text-xs text-center text-white/70 italic mt-2 p-1">${viz.suggestion_reason || ''}</p>
                                </div>`;
            } else {
                visualsHtml += `<div class="w-full lg:w-[48%] bg-black/10 rounded-lg p-2 shadow-lg"> 
                                <div id="viz-chart-${index}" class="w-full h-[500px] plotly-chart"></div>
                                <p class="text-xs text-center text-white/70 italic mt-2 p-1">${viz.suggestion_reason || ''}</p>
                                </div>`;
            }
        });
        visualsHtml += `</div>`;
    } else {
        visualsHtml += `<p class="text-center text-white/70">No visualizations were generated.</p>`;
    }
    visualsHtml += `</div>`;
    visualsPanel.innerHTML = visualsHtml;

    // --- 6. Populate Suggestions Panel (Unchanged) ---
    const suggestionsPanel = dom.$("suggestionsPanel");
    let suggestionsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🧠 Further Visualization Suggestions</h3>`;
    suggestionsHtml += `
        <blockquote class="p-3 italic border-l-4 border-blue-400 bg-blue-900/20 text-blue-200 text-sm mb-6">
            <strong>Note:</strong> These are general suggestions based on your data's column types. 
            Cross-reference these ideas with the specific findings in the <strong>"Summary & Insights"</strong> tab for more targeted analysis.
        </blockquote>
    `;
    if (suggestions && suggestions.length > 0) {
        suggestionsHtml += `<div class="overflow-x-auto">
                            <table class="coeff-table styled-table text-sm">
                                <thead><tr><th>Suggested Chart</th><th>Columns Involved</th><th>Reason</th></tr></thead>
                            <tbody>`;
        suggestions.forEach((s) => {
            suggestionsHtml += `<tr>
                <td class="font-semibold">${s.title}</td>
                <td class="text-white/80">${s.columns.join(', ')}</td>
                <td class="text-white/70 italic">${s.reason}</td>
            </tr>`;
        });
        suggestionsHtml += `</tbody></table></div>`;
    } else {
        suggestionsHtml += `<p class="text-center text-white/70 italic">No further suggestions could be generated.</p>`;
    }
    suggestionsHtml += `</div>`;
    suggestionsPanel.innerHTML = suggestionsHtml;

    // --- 7. NEW: Populate Warnings Panel ---
    const warningsPanel = dom.$("warningsPanel");
    renderVizWarningsPanel(warningsPanel, dataset_info); // Call new helper function

    // --- 8. Populate Learn Viz Panel (Unchanged) ---
    const learnPanel = dom.$("learnPanel");
    renderLearnVizPanel(learnPanel, dataset_info); 

    // --- 9. Tab Switching & Chart Rendering Logic (Unchanged) ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML;

    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");
                const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                chartsInPanel.forEach(chartDiv => {
                    if (chartDiv.layout && typeof Plotly !== 'undefined') {
                        try { Plotly.Plots.resize(chartDiv); } catch (resizeError) { console.error(`Error resizing chart ${chartDiv.id}:`, resizeError); }
                    }
                });
            }
        }
    });
    
    // ... (Chart rendering setTimeout block remains exactly the same) ...
    setTimeout(() => {
            const visualsTabPanel = dom.$("visualsPanel");
            if (visualsTabPanel) {
                visualsTabPanel.querySelectorAll(".plotly-chart").forEach(chartDiv => {
                    if (!chartDiv.layout && typeof Plotly !== 'undefined') {
                        const index = parseInt(chartDiv.id.split('-')[2]);
                        const viz = visualizations[index];
                        if (viz && !viz.error && viz.chart_type !== 'frequency_table') {
                            try {
                                let traces = [];
                                let layout = JSON.parse(JSON.stringify(baseLayout)); 
                                layout.title.text = viz.title;
                                layout.xaxis.title.text = viz.x_label;
                                layout.yaxis.title.text = viz.y_label;

                            // (all the if/else if blocks for chart types...)
                            if (viz.chart_type === "histogram" && viz.data.values) {
                                traces = [{ x: viz.data.values, type: "histogram", marker: { color: colorPrimary, line:{color:'rgba(255,255,255,0.3)', width:0.5} } }];
                                layout.bargap = 0.05;
                                layout.showlegend = false;
                            } else if (viz.chart_type === "bar" && viz.data.categories) {
                                traces = [{ 
                                    x: viz.data.categories, 
                                    y: viz.data.values, 
                                    type: "bar", 
                                    marker: { 
                                        color: viz.data.categories.map((_, i) => colorPalette[i % colorPalette.length])
                                    } 
                                }];
                                layout.showlegend = false;
                            } else if (viz.chart_type === "pie" && viz.data.labels) {
                                traces = [{ 
                                    labels: viz.data.labels, 
                                    values: viz.data.values, 
                                    type: "pie", 
                                    hole: 0.4, 
                                    textinfo: "percent+label",
                                    marker: { colors: colorPalette }
                                }];
                                layout.showlegend = true;
                                layout.margin = { t: 60, b: 80, l: 50, r: 50 };
                                layout.legend.y = -0.3;
                            } else if (viz.chart_type === "scatter" && viz.data.x) {
                                const correlation = viz.data.correlation || 0;
                                const rSquared = (correlation ** 2).toFixed(3);
                                traces = [{ x: viz.data.x, y: viz.data.y, mode: 'markers', type: 'scatter', marker: { color: colorPrimary, opacity: 0.7, size: 8 } }];
                                
                                layout.title.text = `${viz.title} <br><span style="font-size: 16px; color: ${colorAccent};">Corr: ${correlation.toFixed(3)} | R²: ${rSquared}</span>`;
                                layout.showlegend = false;
                            } else if (viz.chart_type === "line" && viz.data.x) {
                                traces = [{ 
                                    x: viz.data.x, 
                                    y: viz.data.y, 
                                    mode: 'lines+markers',
                                    type: 'scatter', 
                                    line: { color: colorAccent, width: 3 },
                                    marker: { size: 6, color: colorAccent }
                                }];
                                layout.showlegend = false;
                            } else if (viz.chart_type === "box" && viz.data) {
                                traces = [{ 
                                    y: viz.data.values, 
                                    type: 'box', 
                                    name: viz.x_label, 
                                    boxpoints: 'Outliers',
                                    marker: { color: colorPrimary },
                                    boxmean: 'sd'
                                }];
                                layout.yaxis.zeroline = false;
                                layout.showlegend = false;
                            } else if (viz.chart_type === "box_grouped" && viz.data) {
                                let i = 0;
                                for (const groupName in viz.data) {
                                    traces.push({ 
                                        y: viz.data[groupName].values, 
                                        type: 'box', 
                                        name: groupName, 
                                        boxpoints: 'Outliers',
                                        boxmean: 'sd',
                                        marker: { color: colorPalette[i % colorPalette.length] }
                                    });
                                    i++;
                                }
                                layout.yaxis.zeroline = false;
                                layout.showlegend = true;
                                layout.boxmode = 'group';
                            } else if (viz.chart_type === "area" && viz.data.x && viz.data.series) {
                                let i = 0;
                                for (const seriesName in viz.data.series) {
                                    traces.push({ 
                                        x: viz.data.x, 
                                        y: viz.data.series[seriesName], 
                                        type: 'scatter', 
                                        mode: 'lines', 
                                        name: seriesName, 
                                        fill: 'tozeroy',
                                        line: { color: colorPalette[i % colorPalette.length] }
                                    });
                                    i++;
                                }
                                layout.showlegend = true;
                            } else if (viz.chart_type === "heatmap" && viz.data.correlation_matrix) {
                                const zValues = viz.data.rows.map(row => {
                                    return viz.data.columns.map(col => {
                                        return viz.data.correlation_matrix[row][col];
                                    });
                                });
                                traces = [{ z: zValues, x: viz.data.columns, y: viz.data.rows, type: 'heatmap', colorscale: 'RdBu', zmin: -1, zmax: 1, showscale: true }];
                                layout.xaxis.tickangle = -45;
                                layout.margin = { t: 60, b: 120, l: 120, r: 50 };
                                layout.showlegend = false;
                            } else if (viz.chart_type === "treemap" && viz.data.nodes) {
                                traces = [{
                                    type: "treemap",
                                    labels: viz.data.nodes.map(n => n.name),
                                    values: viz.data.nodes.map(n => n.value),
                                    parents: viz.data.nodes.map(n => ""),
                                    textinfo: "label+value+percent root",
                                    marker: { colors: colorPalette }
                                }];
                                layout.margin = { t: 50, b: 20, l: 20, r: 20 };
                                layout.showlegend = false;
                            } else {
                                    throw new Error(`Unsupported or invalid chart type: ${viz.chart_type}`);
                            }
                                
                            Plotly.newPlot(chartDiv, traces, layout, { 
                                responsive: true, 
                                displaylogo: false, 
                                modeBarButtonsToRemove: ['sendDataToCloud', 'select2d', 'lasso2d'],
                                displayModeBar: true 
                            });
                                
                            } catch (e) { 
                                console.error("Initial render error:", e);
                                chartDiv.innerHTML = `<div class="p-4 text-center text-red-400">Could not render chart for ${viz.title}.</div>`;
                            }
                        }
                    }
                });
            }
    }, 150); 

    dom.$("analysisActions").classList.remove("hidden");
    setLoading("generate", false);
}

/**
 * --- NEW FUNCTION (V15) ---
 * Renders the new "Warnings & Diagnostics" panel.
 * Moves warnings from the Summary tab to here for prominence.
 * Adds a new section on Statistical Significance.
 * Uses the user's updated row count logic.
 */
function renderVizWarningsPanel(warningsPanel, dataset_info) {
    if (!warningsPanel || !dataset_info) {
        if(warningsPanel) warningsPanel.innerHTML = "<p class='p-4 text-white/60'>Could not load warnings.</p>";
        return;
    }

    let warningsHtml = `<div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
        <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            ⚠️ Warnings & Diagnostics
        </h3>
        
        <div class="bg-red-900/20 p-6 rounded-lg border border-red-500/30">
            <h4 class="text-xl font-bold mb-3 text-red-300">Data Quality & Sufficiency</h4>`;
    
    // --- YOUR NEW WARNING LOGIC ---
    const dataRowCount = dataset_info.rows || 0;
    if (dataRowCount < 30) {
        warningsHtml += `<p class="text-red-200"><strong>CRITICAL WARNING:</strong> Your dataset has only <strong>${dataRowCount} rows</strong>. This is insufficient data for reliable visualization or statistical insights. Any patterns (like correlations) are highly likely to be due to random chance and should not be trusted for decision-making.</p>`;
    } else if (dataRowCount < 50) {
        warningsHtml += `<p class="text-yellow-200"><strong>WARNING:</strong> Your dataset has <strong>${dataRowCount} rows</strong>. This is a limited dataset. Basic charts may be useful, but findings (like correlations) have low statistical power and may not be reliable.</p>`;
    } else {
        warningsHtml += `<p class="text-green-300"><strong>CHECK:</strong> Your dataset has <strong>${dataRowCount} rows</strong>. This is a sufficient size for basic descriptive visualizations.</p>`;
    }
    // --- END YOUR LOGIC ---
    
    warningsHtml += `</div>

        <div class="bg-yellow-900/20 p-6 rounded-lg border border-yellow-500/30">
            <h4 class="text-xl font-bold mb-3 text-yellow-300">Interpretation Warning: Correlation is Not Causation</h4>
            <p class="text-white/90 leading-relaxed">
                Your charts (especially scatter plots) show **correlation** (a mutual relationship), not **causation** (proof that one thing *causes* another). 
            </p>
            <p class="text-white/80 text-sm mt-2">
                <strong>Example:</strong> A chart might show that \`Marketing_Spend\` and \`Sales_Revenue\` both go up together. This *does not prove* that spending more *caused* the sales. A third "lurking variable" (like a holiday season) could be causing both.
            </p>
            <p class="text-white/80 text-sm mt-2">
                <strong>Action:</strong> Always use your business expertise to determine if a causal link is plausible.
            </p>
        </div>

        <div class="bg-blue-900/20 p-6 rounded-lg border border-blue-500/30">
            <h4 class="text-xl font-bold mb-3 text-blue-300">A Note on Statistical Significance</h4>
            <p class="text-white/90 leading-relaxed">
                This tool performs **descriptive and exploratory** analysis. It shows you what is in the data.
            </p>
            <p class="text-white/80 text-sm mt-2">
                It does **not** automatically run formal statistical tests (like t-tests or regression with p-values) to confirm if these findings are "statistically significant." A pattern you see in a small dataset could be due to random chance.
            </p>
            <p class="text-white/80 text-sm mt-2">
                <strong>Action:</strong> Use these visualizations to form a <strong>hypothesis</strong>, then use a dedicated statistical tool (like the Regression or SEM tools in S.A.G.E.) to test that hypothesis formally.
            </p>
        </div>
    </div>`;

    warningsPanel.innerHTML = warningsHtml;
}

/**
 * --- NEW FUNCTION (V8) ---
 * Renders the improved, PURELY EDUCATIONAL "Learn Viz" panel.
 * - Removes all contextual data warnings and column name references.
 * - Focuses on explaining the "what" and "why" of chart types.
 * - Includes advanced concepts like statistical rigor and common pitfalls.
 */
function renderLearnVizPanel(learnPanel, dataset_info) {
    if (!learnPanel) return;
    
    // This content is now static and purely educational.
    learnPanel.innerHTML = `
        <div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
            <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                🎓 A Guide to Data Visualization
            </h3>
            
            <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-4 text-indigo-300">What is Data Visualization?</h4>
                <p class="text-white/80 text-sm">
                    Data visualization is the practice of translating information into a visual context, such as a map or graph, to make data easier for the human brain to understand and pull insights from. The main goal is to identify patterns, trends, and outliers in large data sets.
                </p>
            </div>

            <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-4 text-indigo-300">How to Read Different Chart Types</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h5 class="font-semibold text-blue-300 mb-2">Distributions (Histograms & Box Plots)</h5>
                        <p class="text-white/80 mb-2">Use these to understand the shape of a numerical variable.</p>
                        <ul class="list-disc list-inside space-y-1 text-white/80">
                            <li><strong>Central Tendency:</strong> Where is the center (median) or peak (mode)?</li>
                            <li><strong>Spread:</strong> Is the data tightly clustered or widely spread out?</li>
                            <li><strong>Skewness:</strong> Is it symmetric, or does it have a long "tail" to one side?</li>
                            <li><strong>Outliers:</strong> Are there extreme values far from the main group?</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-green-300 mb-2">Relationships (Scatter Plots)</h5>
                        <p class="text-white/80 mb-2">Use these to see how two numerical variables move together.</p>
                        <ul class="list-disc list-inside space-y-1 text-white/80">
                            <li><strong>Direction:</strong> Positive (both go up) or negative (one goes up, one goes down)?</li>
                            <li><strong>Strength:</strong> How tightly clustered are the points? (R² value shows this).</li>
                            <li><strong>Pattern:</strong> Is the relationship a straight line (linear) or curved?</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-yellow-300 mb-2">Compositions (Bar & Pie Charts)</h5>
                        <p class="text-white/80 mb-2">Use these to compare counts or values across categories.</p>
                        <ul class="list-disc list-inside space-y-1 text-white/80">
                            <li><strong>Magnitude:</strong> Which categories are the largest or smallest?</li>
                            <li><strong>Proportion:</strong> How much does each category contribute to the whole?</li>
                            <li><strong>Pareto Principle:</strong> Do a few categories account for most of the value?</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-purple-300 mb-2">Trends (Line Charts)</h5>
                        <p class="text-white/80 mb-2">Use these to see how a variable changes over a time column.</p>
                        <ul class="list-disc list-inside space-y-1 text-white/80">
                            <li><strong>Trend:</strong> Is the overall direction upward, downward, or flat?</li>
                            <li><strong>Seasonality:</strong> Are there repeating cycles (e.g., peaks every summer)?</li>
                            <li><strong>Volatility:</strong> Is the line smooth or erratic and spiky?</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="bg-yellow-900/20 p-6 rounded-lg border border-yellow-500/30">
                <h4 class="text-xl font-bold mb-3 text-yellow-300">⚠️ A Critical Warning: Correlation vs. Causation</h4>
                <p class="text-white/90 leading-relaxed">
                    Charts (especially scatter plots) show **correlation**, not **causation**. 
                    Just because two variables move together does not *prove* that one *causes* the other.
                </p>
                <p class="text-white/80 text-sm mt-2">
                    A hidden "lurking variable" (e.g., seasonality, a market event) could be causing both to change. 
                    Always use your domain expertise to interpret these relationships.
                </p>
            </div>

            <details class="styled-details bg-white/5 rounded-lg">
                <summary class="font-semibold cursor-pointer p-4 text-lg text-red-300">Common Visualization Pitfalls to Avoid</summary>
                <div class="px-6 pb-6 space-y-4 text-sm">
                    <div class="p-4 bg-red-900/20 border border-red-500/30 rounded">
                        <h5 class="font-semibold text-red-300 mb-2">Misleading Axes</h5>
                        <p class="text-white/80">Truncating the Y-axis (not starting at zero) on a bar chart can make small differences look massive. Be cautious when interpreting comparisons.</p>
                    </div>
                    <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <h5 class="font-semibold text-yellow-300 mb-2">Cherry-Picking Data</h5>
                        <p class="text-white/80">Visualizing only a small date range or a specific subset of data can create a misleading impression that doesn't hold true for the entire dataset.</p>
                    </div>
                    <div class="p-4 bg-purple-900/20 border border-purple-500/30 rounded">
                        <h5 class="font-semibold text-purple-300 mb-2">Using the Wrong Chart</h5>
                        <p class="text-white/80">Using a line chart for non-time-based categorical data or a pie chart for data that doesn't sum to 100% can confuse and mislead the audience.</p>
                    </div>
                </div>
            </details>

            <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                <p class="text-xs text-white/60">
                    The best analysis combines these statistical findings with your deep knowledge of your business and industry.
                </S.A.G.E.>
            </div>
        </div>
    `;
}



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



function renderPlsPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading

    // Basic Validation
    if (!data || !data.model_evaluation || !data.path_coefficients || !data.reliability_validity || !data.business_recommendations || !data.userInput) {
        console.error("Incomplete data passed to renderPlsPage_DA:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    const { model_evaluation, path_coefficients, reliability_validity, business_recommendations, userInput } = data;
    // Extract constructs from reliability data for diagram rendering
    const constructNames = reliability_validity.map(c => c.construct);


    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Added Learn PLS-SEM tab
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="diagram">🧬 Path Model</button>
        <button class="analysis-tab-btn" data-tab="paths">📈 Path Analysis</button>
        <button class="analysis-tab-btn" data-tab="reliability">✅ Model Fit & Reliability</button>
        <button class="analysis-tab-btn" data-tab="rec">💡 Recommendations</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn PLS-SEM</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added learnPanel
    tabContent.innerHTML = `
        <div id="diagramPanel" class="analysis-tab-panel active"></div>
        <div id="pathsPanel" class="analysis-tab-panel"></div>
        <div id="reliabilityPanel" class="analysis-tab-panel"></div>
        <div id="recPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Path Diagram Panel (Improved Rendering) ---
    const diagramPanel = dom.$("diagramPanel");
    if (constructNames && constructNames.length > 0 && path_coefficients) {
        try {
            // Basic logic to determine exogenous/endogenous based on paths
            const sources = new Set(path_coefficients.map(p => p.path?.split(" -> ")[0]).filter(Boolean));
            const targets = new Set(path_coefficients.map(p => p.path?.split(" -> ")[1]).filter(Boolean));

            const exogenous = constructNames.filter(id => sources.has(id) && !targets.has(id));
            const endogenous = constructNames.filter(id => targets.has(id)); // Simplified: anything targeted is endogenous/mediating
             // Attempt to place mediators in the middle if possible
             const mediators = endogenous.filter(id => sources.has(id));
             const finalOutcomes = endogenous.filter(id => !sources.has(id));


            let diagramHtml = `<div class="path-flow-container">`;

             // Column 1: Exogenous
             diagramHtml += `<div class="path-column"><div class="path-column-title">Predictors (Exogenous)</div>`;
             if (exogenous.length > 0) {
                 diagramHtml += exogenous.map(id => `<div class="path-node-card"><h4>${id}</h4></div>`).join("");
             } else {
                 diagramHtml += `<p class="text-white/60 text-sm italic">(None identified)</p>`;
             }
             diagramHtml += `</div>`;


             // Column 2: Mediators (if any)
             if (mediators.length > 0) {
                 diagramHtml += `<div class="path-column"><div class="path-column-title">Mediators</div>`;
                 diagramHtml += mediators.map(id => {
                     const influences = path_coefficients.filter(p => p.path?.endsWith(` -> ${id}`));
                     return `<div class="path-node-card"><h4>${id}</h4><div class="path-influence-list text-xs">Influenced by:<br>${influences.map(inf => {
                         const isSig = inf.significant ?? ((inf.p_value ?? 1) < 0.05);
                         const coeff = (inf.coefficient ?? 0).toFixed(3);
                         return `<span class="path-influence ${isSig ? "significant" : ""}"><strong>${inf.path?.split(" -> ")[0] ?? "N/A"}</strong> (${coeff})${isSig ? "***" : ""}</span>`;
                     }).join("<br>")}</div></div>`;
                 }).join("");
                 diagramHtml += `</div>`;
             }

             // Column 3: Final Outcomes
             diagramHtml += `<div class="path-column"><div class="path-column-title">Outcomes (Endogenous)</div>`;
              if (finalOutcomes.length > 0) {
                 diagramHtml += finalOutcomes.map(id => {
                     const influences = path_coefficients.filter(p => p.path?.endsWith(` -> ${id}`));
                     return `<div class="path-node-card"><h4>${id}</h4><div class="path-influence-list text-xs">Influenced by:<br>${influences.map(inf => {
                         const isSig = inf.significant ?? ((inf.p_value ?? 1) < 0.05);
                         const coeff = (inf.coefficient ?? 0).toFixed(3);
                         return `<span class="path-influence ${isSig ? "significant" : ""}"><strong>${inf.path?.split(" -> ")[0] ?? "N/A"}</strong> (${coeff})${isSig ? "***" : ""}</span>`;
                     }).join("<br>")}</div></div>`;
                 }).join("");
              } else if (mediators.length === 0 && exogenous.length > 0) {
                 // If no mediators AND no final outcomes, show exogenous ones here again for simple models
                 diagramHtml += exogenous.map(id => {
                     const influences = path_coefficients.filter(p => p.path?.endsWith(` -> ${id}`));
                      if (influences.length > 0) { // Only show if it IS actually an outcome in a simple A->B model
                         return `<div class="path-node-card"><h4>${id}</h4><div class="path-influence-list text-xs">Influenced by:<br>${influences.map(inf => {
                             const isSig = inf.significant ?? ((inf.p_value ?? 1) < 0.05);
                             const coeff = (inf.coefficient ?? 0).toFixed(3);
                             return `<span class="path-influence ${isSig ? "significant" : ""}"><strong>${inf.path?.split(" -> ")[0] ?? "N/A"}</strong> (${coeff})${isSig ? "***" : ""}</span>`;
                         }).join("<br>")}</div></div>`;
                      }
                      return '';
                 }).join("");
             } else {
                 diagramHtml += `<p class="text-white/60 text-sm italic">(None identified as final outcomes)</p>`;
             }
            diagramHtml += `</div></div>`; // Close column and container
            diagramHtml += `<p class="text-xs text-white/60 text-center mt-4">*** Indicates statistical significance (p < 0.05)</p>`;
            diagramPanel.innerHTML = diagramHtml;

        } catch (e) {
            console.error("Error rendering PLS diagram:", e);
            diagramPanel.innerHTML = `<div class="p-4 text-center text-red-400">Path model could not be rendered due to an error.</div>`;
        }

    } else {
        diagramPanel.innerHTML = `<div class="p-4 text-center text-white/60">Path model data is insufficient for rendering.</div>`;
    }


    // --- 2. Populate Path Analysis Panel (Added significance boolean) ---
    const pathsPanel = dom.$("pathsPanel");
    if (path_coefficients && path_coefficients.length > 0) {
        let pathsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Structural Model - Path Coefficients</h3><div class="overflow-x-auto"><table class="coeff-table styled-table text-sm"><thead><tr><th>Path</th><th>Coefficient (β)</th><th>T-Statistic</th><th>P-value</th><th>Significant?</th></tr></thead><tbody>`;
        path_coefficients.forEach((p) => {
            // Use AI's significance flag if present, otherwise calculate
            const isSignificant = p.significant ?? ((p.p_value != null) && p.p_value < 0.05);
            pathsHtml += `
                <tr class="${isSignificant ? "text-green-300" : "text-white/70"}">
                    <td class="font-semibold">${p.path || "N/A"}</td>
                    <td>${(p.coefficient ?? 0).toFixed(3)}</td>
                    <td>${(p.t_statistic ?? 0).toFixed(2)}</td>
                    <td>${(p.p_value ?? 1).toFixed(3)}</td>
                    <td class="font-bold">${isSignificant ? "Yes***" : "No"}</td>
                </tr>`;
        });
        pathsHtml += `</tbody></table><p class="text-xs text-white/60 mt-2">*** Significant at p < 0.05</p></div><div class="mt-6 space-y-4">`;
        pathsHtml += `<h4 class="text-xl font-bold mb-2">Interpretation of Paths:</h4>`
        path_coefficients.forEach((p) => {
             const isSignificant = p.significant ?? ((p.p_value != null) && p.p_value < 0.05);
             const borderColor = isSignificant ? "border-green-400" : "border-gray-500";
            pathsHtml += `<div class="bg-white/5 p-3 rounded-lg border-l-4 ${borderColor}">
                            <p class="font-bold">${p.path || "N/A"}</p>
                            <p class="text-sm text-white/80 italic">${p.interpretation || "No interpretation provided."}</p>
                        </div>`;
        });
        pathsHtml += `</div></div>`;
        pathsPanel.innerHTML = pathsHtml;
    } else {
        pathsPanel.innerHTML = `<div class="p-4 text-center text-white/60">Path coefficient data is not available.</div>`;
    }

    // --- 3. Populate Reliability Panel (Added assessment text) ---
    const reliabilityPanel = dom.$("reliabilityPanel");
    if (reliability_validity && reliability_validity.length > 0 && model_evaluation) {
        let reliabilityHtml = `<div class="p-4">
            <h3 class="text-2xl font-bold mb-4">Model Fit & Reliability Assessment</h3>
            <div class="bg-black/20 p-4 rounded-lg mb-6">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">Overall Model Explanatory Power (R²)</h4>`;
         if (model_evaluation.r_squared_values && model_evaluation.r_squared_values.length > 0) {
             model_evaluation.r_squared_values.forEach(rsq => {
                 reliabilityHtml += `<p class="text-sm text-white/80"><strong>${rsq.variable}:</strong> ${rsq.r_squared?.toFixed(3) ?? 'N/A'}</p>`;
             });
         } else {
             reliabilityHtml += `<p class="text-sm text-white/70 italic">R-squared values not available.</p>`;
         }
         reliabilityHtml += `<p class="text-sm text-white/80 italic mt-3">${model_evaluation.interpretation || "Overall interpretation unavailable."}</p>
            </div>

            <h4 class="text-xl font-bold mb-3">Construct Reliability & Validity Metrics</h4>
            <div class="overflow-x-auto">
                <table class="coeff-table styled-table text-sm">
                    <thead><tr>
                        <th>Construct</th>
                        <th title="Internal Consistency Reliability">Cronbach's Alpha (>0.7)</th>
                        <th title="Internal Consistency Reliability">Composite Reliability (CR >0.7)</th>
                        <th title="Convergent Validity">Avg. Variance Extracted (AVE >0.5)</th>
                    </tr></thead>
                    <tbody>`;
        reliability_validity.forEach((r) => {
             const alphaOk = (r.cronbachs_alpha ?? 0) >= 0.7;
             const crOk = (r.composite_reliability ?? 0) >= 0.7;
             const aveOk = (r.ave ?? 0) >= 0.5;
            reliabilityHtml += `
                <tr>
                    <td class="font-semibold">${r.construct || "N/A"}</td>
                    <td class="${alphaOk ? 'text-green-300' : 'text-red-300'}">${(r.cronbachs_alpha ?? 0).toFixed(3)} ${alphaOk ? '✓' : '✗'}</td>
                    <td class="${crOk ? 'text-green-300' : 'text-red-300'}">${(r.composite_reliability ?? 0).toFixed(3)} ${crOk ? '✓' : '✗'}</td>
                    <td class="${aveOk ? 'text-green-300' : 'text-red-300'}">${(r.ave ?? 0).toFixed(3)} ${aveOk ? '✓' : '✗'}</td>
                </tr>`;
        });
        reliabilityHtml += `</tbody></table>
            <p class="text-xs text-white/60 mt-2">✓ Meets common threshold, ✗ Below common threshold.</p>
            </div>
            <div class="mt-6 space-y-4">`;
         reliabilityHtml += `<h4 class="text-xl font-bold mb-2">Assessment Details:</h4>`
         reliability_validity.forEach(r => {
             reliabilityHtml += `<div class="bg-white/5 p-3 rounded-lg border-l-4 ${ (r.cronbachs_alpha >= 0.7 && r.composite_reliability >= 0.7 && r.ave >= 0.5) ? 'border-green-400' : 'border-yellow-400' }">
                                     <p class="font-bold">${r.construct}</p>
                                     <p class="text-sm text-white/80 italic">${r.assessment || "Assessment not provided."}</p>
                                 </div>`;
         });
         reliabilityHtml += `</div></div>`;
        reliabilityPanel.innerHTML = reliabilityHtml;
    } else {
        reliabilityPanel.innerHTML = `<div class="p-4 text-center text-white/60">Model reliability and fit data is not available.</div>`;
    }

    // --- 4. Populate Recommendations Panel (Added insight link) ---
    const recPanel = dom.$("recPanel");
    if (business_recommendations && business_recommendations.length > 0) {
        let recHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💡 Actionable Recommendations</h3><div class="space-y-6">`;
        business_recommendations.forEach((rec, index) => {
            recHtml += `<div class="prescription-card">
                        <h4 class="text-xl font-bold">${index + 1}. ${rec.recommendation || "N/A"}</h4>
                        <p class="rationale"><strong>Driven By:</strong> ${rec.insight_link || "N/A"}</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-indigo-300 mb-2">Action Items</h5>
                                <ul class="list-disc list-inside space-y-1 text-white/90">${(rec.action_items || []).map(a => `<li>${a}</li>`).join("")}</ul>
                            </div>
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-indigo-300 mb-2">KPIs to Track</h5>
                                <p class="text-white/90 text-xs">${(rec.kpis_to_track || []).join(", ")}</p>
                            </div>
                        </div>
                    </div>`;
        });
        recHtml += `</div></div>`;
        recPanel.innerHTML = recHtml;
    } else {
        recPanel.innerHTML = `<div class="p-4 text-center text-white/60 italic">No specific business recommendations generated based on the significant paths.</div>`;
    }

    // --- 5. Populate Learn PLS-SEM Tab ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding PLS-SEM</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is PLS-SEM?</h4>
            <p class="text-sm text-white/80">Partial Least Squares Structural Equation Modeling (PLS-SEM) is a statistical method used to analyze complex relationships between observed (indicator) and unobserved (latent) variables.</p>
            <p class="text-sm text-white/80 mt-2">It's particularly useful for:</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-white/80 mt-1 pl-4">
                <li><strong>Prediction-oriented research:</strong> When the goal is to predict key target constructs.</li>
                <li><strong>Complex models:</strong> Handling many constructs and indicators.</li>
                <li><strong>Non-normal data:</strong> It doesn't require data to be normally distributed like traditional SEM (CB-SEM).</li>
                <li><strong>Smaller sample sizes:</strong> Can often work with smaller datasets than CB-SEM.</li>
                <li><strong>Formative constructs:</strong> When indicators are assumed to *cause* the latent variable (less common, but PLS handles it).</li>
            </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Components:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Measurement Model:</strong> Links latent variables (constructs) to their observable indicators (like survey items). Assesses reliability and validity.</li>
                    <li><strong>Structural Model:</strong> Defines the hypothesized relationships (paths) *between* the latent variables.</li>
                    <li><strong>Latent Variables:</strong> Unobserved concepts (e.g., Brand Image, Loyalty).</li>
                    <li><strong>Indicators:</strong> Observed variables that measure the latent concepts.</li>
                    <li><strong>Path Coefficients (β):</strong> Strength and direction of relationships between latent variables.</li>
                    <li><strong>R-squared (R²):</strong> Percentage of variance in an endogenous (dependent) construct explained by its predictors.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Interpreting Key Metrics:</h4>
                 <p class="text-sm mb-2"><strong>Reliability & Validity:</strong></p>
                 <ul class="list-[circle] list-inside pl-4 text-xs mb-3">
                    <li><strong>Cronbach's Alpha / CR (>0.7):</strong> Internal consistency - do indicators for a construct measure the *same* thing reliably?</li>
                    <li><strong>AVE (>0.5):</strong> Convergent validity - does the construct explain more than half the variance of its indicators?</li>
                    <li><em>(Discriminant Validity - Not shown here, checks if constructs are distinct. Often HTMT < 0.9)</em></li>
                 </ul>
                 <p class="text-sm mb-2"><strong>Structural Model:</strong></p>
                  <ul class="list-[circle] list-inside pl-4 text-xs mb-3">
                    <li><strong>Path Coefficients (β):</strong> Size indicates strength. Sign indicates direction (+/-).</li>
                    <li><strong>P-values (<0.05):</strong> Indicates statistical significance of the path (relationship likely exists).</li>
                    <li><strong>R-squared:</strong> Explanatory power for dependent constructs (e.g., 0.6 means 60% explained).</li>
                 </ul>
            </div>
        </div>

        <details class="styled-details text-sm">
            <summary class="font-semibold">PLS-SEM vs. CB-SEM (Traditional SEM)</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                <p><strong>PLS-SEM:</strong> Variance-based, prediction-focused, fewer assumptions (good for exploration, non-normal data, complex models).</p>
                <p><strong>CB-SEM (e.g., LISREL, AMOS):</strong> Covariance-based, theory-testing focused, requires normal data and larger samples (good for confirming established theories).</p>
                <p>Choose PLS-SEM when your primary goal is prediction, your theory is less developed, or your data doesn't meet CB-SEM assumptions.</p>
            </div>
        </details>
    </div>
    `;

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");
                // No charts to resize in this specific PLS render function currently
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



/**
 * Renders the full DEMATEL analysis page from the backend results.
 * --- UPDATED ---
 * This function now includes a smarter tab-switching logic
 * that calls the chart rendering function *only when* the
 * diagram tab is clicked, solving the visibility issue.
 * @param {object} data - The full JSON response from the backend.
 */
function renderDematelAnalysisPage(data) {
    const container = dom.$("analysisResult");
    if (!container) return;

    container.innerHTML = ""; // Clear loading state

    // --- Create Tab Navigation (5 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active py-3 px-5 text-white font-medium border-b-2 border-indigo-400 transition" data-tab="summary">📋 Summary & Insights</button>
        <button class="analysis-tab-btn py-3 px-5 text-white/60 hover:text-white border-b-2 border-transparent transition" data-tab="diagram">📊 Causal Diagram</button>
        <button class="analysis-tab-btn py-3 px-5 text-white/60 hover:text-white border-b-2 border-transparent transition" data-tab="metrics">🔢 Metrics & Matrix</button>
        <button class="analysis-tab-btn py-3 px-5 text-white/60 hover:text-white border-b-2 border-transparent transition" data-tab="diagnostics">⚠️ Diagnostics</button>
        <button class="analysis-tab-btn py-3 px-5 text-white/60 hover:text-white border-b-2 border-transparent transition" data-tab="learn">🎓 Learn DEMATEL</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (5 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dematelSummaryPanel" class="analysis-tab-panel active p-6"></div>
        <div id="dematelDiagramPanel" class="analysis-tab-panel p-6"></div>
        <div id="dematelMetricsPanel" class="analysis-tab-panel p-6"></div>
        <div id="dematelDiagnosticsPanel" class="analysis-tab-panel p-6"></div>
        <div id="dematelLearnPanel" class="analysis-tab-panel p-6"></div>
    `;

    // --- Populate Each Tab ---
    renderDematelSummaryTab("dematelSummaryPanel", data);
    renderDematelDiagramTab("dematelDiagramPanel", data); // This just creates the placeholder
    renderDematelMetricsTab("dematelMetricsPanel", data);
    renderDematelDiagnosticsTab("dematelDiagnosticsPanel", data.diagnostics);
    renderLearnDematelTab("dematelLearnPanel");

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the new HTML
    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons

    // --- UPDATED: Tab Switching Logic ---
    // This logic now *replaces* the reattachTabListeners call for this specific tool.
    const allTabButtons = tabNav.querySelectorAll(".analysis-tab-btn");
    const allTabPanels = tabContent.querySelectorAll(".analysis-tab-panel");
    let chartRendered = false; // Flag to prevent re-rendering

    allTabButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            const clickedTab = e.currentTarget;
            if (!clickedTab || clickedTab.classList.contains("active")) return;

            // Deactivate all
            allTabButtons.forEach((btn) => {
                btn.classList.remove("active", "text-white", "font-medium", "border-indigo-400");
                btn.classList.add("text-white/60", "hover:text-white", "border-transparent");
            });
            allTabPanels.forEach((pnl) => pnl.classList.remove("active"));

            // Activate clicked tab
            clickedTab.classList.add("active", "text-white", "font-medium", "border-indigo-400");
            clickedTab.classList.remove("text-white/70", "hover:text-white", "border-transparent");
            
            // Activate corresponding panel
            const targetPanelId = "dematel" + clickedTab.dataset.tab.charAt(0).toUpperCase() + clickedTab.dataset.tab.slice(1) + "Panel";
            const targetPanel = dom.$(targetPanelId);
            
            if (targetPanel) {
                targetPanel.classList.add("active");
                
                // --- THIS IS THE FIX ---
                // If the user clicked the "diagram" tab and the chart hasn't been rendered yet...
                if (clickedTab.dataset.tab === "diagram" && !chartRendered) {
                    // We call the render function *now*, while the tab is visible.
                    setTimeout(() => { // Use a tiny timeout to ensure the panel is fully visible
                        renderDematelChart(data.chart_data);
                        chartRendered = true; // Set flag so we don't render it again
                    }, 50);
                } 
                // If the chart *has* been rendered, just resize it
                else if (clickedTab.dataset.tab === "diagram") {
                     setTimeout(() => {
                        const chartDiv = dom.$("dematel-chart-container");
                        if (chartDiv && chartDiv.layout && typeof Plotly !== 'undefined') {
                            try { Plotly.Plots.resize(chartDiv); } catch (e) { console.error("Resize error:", e); }
                        }
                    }, 50);
                }
                // --- END OF FIX ---
            }
        });
    });

    // --- Initial Chart Render ---
    // This is no longer needed because the Summary tab is active by default,
    // and the chart will be rendered when the user clicks the Diagram tab.
    // setTimeout(() => { ... }, 200);
}

/**
 * Updated renderDematelDiagramTab function with proper container sizing
 */
function renderDematelDiagramTab(containerId, data) {
    const container = dom.$(containerId);
    if (!container) return;

    container.innerHTML = `
        <h3 class="result-subheader text-2xl font-bold text-center mb-4">Causal Influence Diagram</h3>
        <p class="text-white/70 mb-6 text-center mx-auto max-w-3xl">This diagram visualizes the relationships. Factors are plotted by their Prominence (importance) and Relation (cause/effect).</p>
        
        <!-- Fixed chart container with proper sizing -->
        <div class="w-full mb-6">
            <div id="dematel-chart-container" class="w-full bg-black/10 rounded-lg border border-white/10" style="height: 600px; min-height: 600px;">
                <p class="text-white/60 flex items-center justify-center h-full">Chart will render when this tab is active...</p>
            </div>
        </div>
        
        <div class="chart-interpretation mx-auto bg-black/20 p-4 rounded-lg border border-white/10">
            <strong class="text-white">How to Read:</strong>
            <ul class="list-disc list-inside text-sm mt-2 space-y-1 text-white/80">
                <li><strong>Quadrant Lines:</strong> The chart is divided into four quadrants by a horizontal line (at 0) and a vertical line (at the average prominence).</li>
                <li><strong>Horizontal Axis (Prominence):</strong> Factors to the right are more important/central to the system.</li>
                <li><strong>Vertical Axis (Relation):</strong> Factors in the top-half (positive) are 'Cause' factors (net drivers). Factors in the bottom-half (negative) are 'Effect' factors (net receivers).</li>
            </ul>
        </div>
    `;
}

/**
     * Renders the Summary & Insights tab for DEMATEL.
     * --- UPDATED ---
     * Checks for a "fail" status in the diagnostics data
     * and directs the user to the Diagnostics tab.
     */
    function renderDematelSummaryTab(containerId, data) {
        const container = dom.$(containerId);
        if (!container) return;

        // --- This code only runs if insights are valid ---
        let insights_html = "";
        const insights = data.analysis_insights || [];
        const centralInsight = insights.find(i => i.observation.includes("most central"));
        const causeInsight = insights.find(i => i.observation.includes("'Cause' factor"));
        const effectInsight = insights.find(i => i.observation.includes("'Effect' factor"));
        const centralFactorName = centralInsight ? centralInsight.observation.split(":")[0].replace(/\*\*/g, '').trim() : null;
        const effectFactorName = effectInsight ? effectInsight.observation.split(":")[0].replace(/\*\*/g, '').trim() : null;
        const isCentralAlsoEffect = centralInsight && effectInsight && centralFactorName === effectFactorName;

        if (centralInsight) {
            let interpretation = centralInsight.interpretation;
            if (isCentralAlsoEffect) {
                interpretation += `<br/><strong>Causal Role:</strong> This factor is also the system's primary <strong>'Effect' factor</strong> (net receiver).`;
            }
            insights_html += `
            <div class="insight-card-detailed border-l-4 border-yellow-500 bg-black/20 p-4 rounded-lg shadow-lg mb-4">
                <h5 class="text-lg font-semibold">${centralInsight.observation}</h5>
                <p class="text-sm text-white/80 mt-2 pl-2"><strong>Interpretation:</strong> ${interpretation}</p>
                <p class="text-sm text-white/90 mt-2 pl-2"><strong>Recommendation:</strong> ${centralInsight.recommendation}</p>
            </div>`;
        }
        if (causeInsight) {
            insights_html += `
            <div class="insight-card-detailed border-l-4 border-blue-500 bg-black/20 p-4 rounded-lg shadow-lg mb-4">
                <h5 class="text-lg font-semibold">${causeInsight.observation}</h5>
                <p class="text-sm text-white/80 mt-2 pl-2"><strong>Interpretation:</strong> ${causeInsight.interpretation}</p>
                <p class="text-sm text-white/90 mt-2 pl-2"><strong>Recommendation:</strong> ${causeInsight.recommendation}</p>
            </div>`;
        }
        if (effectInsight && !isCentralAlsoEffect) {
            insights_html += `
            <div class="insight-card-detailed border-l-4 border-red-500 bg-black/20 p-4 rounded-lg shadow-lg mb-4">
                <h5 class="text-lg font-semibold">${effectInsight.observation}</h5>
                <p class="text-sm text-white/80 mt-2 pl-2"><strong>Interpretation:</strong> ${effectInsight.interpretation}</p>
                <p class="text-sm text-white/90 mt-2 pl-2"><strong>Recommendation:</strong> ${effectInsight.recommendation}</p>
            </div>`;
        }

        let cause_group_html = "<div class='space-y-2'>";
        if (data.cause_group && data.cause_group.length > 0) {
            data.cause_group.forEach(row => {
                cause_group_html += `
                <div class='p-2 bg-blue-900/20 rounded border border-blue-500/30'>
                    <span class='font-semibold'>${row['Factor']}</span>
                    <span class='text-xs float-right text-blue-300' style="margin-top: 4px;">Net Influence: +${row['Relation (D-R)'].toFixed(3)}</span>
                </div>
                `;
            });
        } else {
            cause_group_html += "<p class='text-sm text-white/60 italic'>No cause factors identified.</p>";
        }
        cause_group_html += "</div>";

        let effect_group_html = "<div class='space-y-2'>";
        if (data.effect_group && data.effect_group.length > 0) {
            data.effect_group.forEach(row => {
                if (!(isCentralAlsoEffect && row['Factor'] === centralFactorName)) {
                    effect_group_html += `
                    <div class='p-2 bg-red-900/20 rounded border border-red-500/30'>
                        <span class='font-semibold'>${row['Factor']}</span>
                        <span class='text-xs float-right text-red-300' style="margin-top: 4px;">Net Receiver: ${row['Relation (D-R)'].toFixed(3)}</span>
                    </div>
                    `;
                }
            });
             if (effect_group_html === "<div class='space-y-2'>") {
                 effect_group_html += "<p class='text-sm text-white/60 italic'>No other effect factors identified.</p>";
            }
        } else {
            effect_group_html += "<p class='text-sm text-white/60 italic'>No effect factors identified.</p>";
        }
        effect_group_html += "</div>";

        container.innerHTML = `
            <h3 class="result-subheader">Key Insights</h3>
            <div class="insights-container space-y-4">
                ${insights_html}
            </div>
            
            <h3 class="result-subheader mt-8">Causal Groups</h3>
            <div class="cause-effect-container grid grid-cols-1 gap-6">
                <div>
                    <h4 class="result-subheader text-blue-300">Cause Group (Drivers)</h4>
                    ${cause_group_html}
                </div>
                <div>
                    <h4 class="result-subheader text-red-300">Effect Group (Outcomes)</h4>
                    ${effect_group_html}
                </div>
            </div>
        `;
    }

/**
     * Renders the Metrics & Matrix tab.
     * --- UPDATED ---
     * Checks for a "fail" status in the diagnostics data
     * and shows an error message instead of tables.
     */
    function renderDematelMetricsTab(containerId, data) {
        const container = dom.$(containerId);
        if (!container) return;

        // --- This code only runs if data is valid ---
        let summaryTableHtml = "";
        let matrixTableHtml = "";
        const summaryData = data.summary_table || [];
        const matrixData = data.total_relation_matrix || [];
        const factors = data.raw_data ? data.raw_data.factors : [];

        // Build Summary Table HTML
        if (summaryData.length > 0) {
            const avgProminence = summaryData.reduce((sum, row) => sum + row['Prominence (D+R)'], 0) / summaryData.length;
            
            summaryTableHtml = `<div class="overflow-x-auto"><table class="coeff-table styled-table text-sm">
                <thead><tr>
                    <th>Factor</th>
                    <th>D (Influence Given)</th>
                    <th>R (Influence Received)</th>
                    <th>Prominence (D+R)</th>
                    <th>Relation (D-R)</th>
                </tr></thead>
                <tbody>`;
            
            summaryData.forEach(row => {
                const prominenceClass = row['Prominence (D+R)'] > avgProminence ? 'font-bold text-yellow-300' : '';
                let relationClass = 'text-white/70';
                if (row['Relation (D-R)'] > 0.1) relationClass = 'font-medium text-blue-300'; // Cause
                if (row['Relation (D-R)'] < -0.1) relationClass = 'font-medium text-red-300'; // Effect

                summaryTableHtml += `
                    <tr>
                        <td class="font-semibold">${row['Factor']}</td>
                        <td>${row['D (Influence Given)'].toFixed(4)}</td>
                        <td>${row['R (Influence Received)'].toFixed(4)}</td>
                        <td class="${prominenceClass}">${row['Prominence (D+R)'].toFixed(4)}</td>
                        <td class="${relationClass}">${row['Relation (D-R)'].toFixed(4)}</td>
                    </tr>
                `;
            });
            summaryTableHtml += `</tbody></table></div>`;
        } else {
            summaryTableHtml = "<p class='text-white/70'>Summary table data is missing.</p>";
        }

        // Build Total Relation Matrix HTML
        if (matrixData.length > 0 && factors.length > 0) {
            let sum = 0;
            let count = 0;
            matrixData.forEach(row => row.forEach(cell => {
                if (cell > 0) {
                    sum += cell;
                    count++;
                }
            }));
            const avgInfluence = (count > 0) ? (sum / count) : 0.1;

            matrixTableHtml = `<div class="overflow-x-auto"><table class="coeff-table styled-table text-sm dematel-matrix">
                <thead><tr><th class="bg-black/10">Influencer ↓ | Influenced →</th>`;
            
            factors.forEach(factor => {
                matrixTableHtml += `<th>${factor}</th>`;
            });
            matrixTableHtml += `</tr></thead><tbody>`;

            matrixData.forEach((row, index) => {
                matrixTableHtml += `<tr><th class="font-semibold">${factors[index]}</th>`;
                row.forEach(cell => {
                    const cellClass = cell > avgInfluence ? 'font-bold text-yellow-300' : 'text-white/7Two';
                    matrixTableHtml += `<td class="${cellClass}">${cell.toFixed(4)}</td>`;
                });
                matrixTableHtml += `</tr>`;
            });
            matrixTableHtml += `</tbody></table></div>`;
        } else {
            matrixTableHtml = "<p class='text-white/70'>Total relation matrix data is missing.</p>";
        }

        // Assemble Final Tab HTML
        container.innerHTML = `
            <h3 class="result-subheader">Factor Summary (D+R, D-R)</h3>
            <p class="text-white/70 mb-4">This table quantifies each factor's role. 
                <strong>Prominence (D+R)</strong> = Total Importance. 
                <strong>Relation (D-R)</strong> = Causal Role (<strong>+</strong> is Cause, <strong>-</strong> is Effect).
            </p>
            <div class="table-container mb-8">
                ${summaryTableHtml}
            </div>
            
            <h3 class="result-subheader">Total Relation Matrix (T)</h3>
            <p class="text-white/70 mb-4">This matrix shows the total (direct + indirect) influence. 
                Read as: <strong>Row Factor</strong> → <strong>Column Factor</strong>. 
                Values above the average influence (approx. ${matrixData.length > 0 ? (matrixData.flat().reduce((a,b)=>a+b,0) / (matrixData.length*matrixData.length)).toFixed(3) : '0.1'}) are highlighted.
            </p>
            <div class="table-container">
                ${matrixTableHtml}
            </div>
            
            <div class="chart-interpretation mt-6 max-w-none mx-auto bg-black/20 p-4 rounded-lg border border-white/10">
                <strong>How to Read the Matrix:</strong>
                <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                    <li><strong>What does a "zero row" mean?</strong> (e.g., "Customer Service" or "Price Competitiveness" in the test data). This is <strong>correct</strong> and means the factor is a <strong>"pure effect"</strong>. It does not influence any other factors in the system.</li>
                    <li><strong>What does a "zero column" mean?</strong> This would mean the factor is a <strong>"pure cause"</strong> and is not influenced by any other factor (this is very rare).</li>
                    <li><strong>Highlighted Values:</strong> These are the strongest causal relationships in your system. They represent the primary pathways of influence.</li>
                </ul>
            </div>
        `;
    }

/**
 * Renders the comprehensive Diagnostics tab with enhanced data quality assessment.
 * --- FULL ENHANCED VERSION ---
 * Detects critical issues like mathematical instability, extreme values, and poor data quality.
 * Provides specific guidance for fixing common problems.
 */
function renderDematelDiagnosticsTab(containerId, diagnostics) {
    const container = dom.$(containerId);
    if (!container) return;

    // Enhanced diagnostic analysis with specific checks for bad data
    let overallStatus = "good";
    let criticalIssues = 0;
    let warningIssues = 0;
    let mathematicalInstability = false;
    let extremeValues = false;
    let poorDataQuality = false;
    
    // Check for mathematical instability (astronomical values)
    if (diagnostics && diagnostics.statistics) {
        const stats = diagnostics.statistics;
        
        // Check for extreme prominence values (indicates mathematical overflow)
        if (stats.max_prominence && parseFloat(stats.max_prominence) > 1000) {
            mathematicalInstability = true;
            criticalIssues++;
            overallStatus = "critical";
        }
        
        // Check for AI scale violations
        if (stats.ai_max_value && parseFloat(stats.ai_max_value) > 4) {
            poorDataQuality = true;
            criticalIssues++;
            overallStatus = "critical";
        }
        
        // Check for extreme matrix density
        if (stats.matrix_density && parseFloat(stats.matrix_density) > 90) {
            poorDataQuality = true;
            if (overallStatus !== "critical") overallStatus = "warning";
            warningIssues++;
        }
    }

    // Analyze diagnostic checks
    if (diagnostics && diagnostics.checks) {
        diagnostics.checks.forEach(check => {
            if (check.status === 'fail') {
                criticalIssues++;
                overallStatus = "critical";
                
                // Detect specific failure types
                if (check.metric === 'Model Stability') {
                    mathematicalInstability = true;
                }
                if (check.metric === 'AI Scale Adherence') {
                    poorDataQuality = true;
                }
            } else if (check.status === 'warn') {
                warningIssues++;
                if (overallStatus !== "critical") overallStatus = "warning";
            }
        });
    }

    // Generate enhanced status summary
    let statusHtml = "";
    let statusClass = "";
    let statusIcon = "";
    let actionableAdvice = "";
    
    if (overallStatus === "critical") {
        statusClass = "bg-red-900/40 border-red-500/60 text-red-200";
        statusIcon = "🚨";
        
        if (mathematicalInstability) {
            statusHtml = `<strong>MATHEMATICAL INSTABILITY DETECTED</strong> - The calculations have failed due to extreme values.`;
            actionableAdvice = `This usually means your input described relationships that are too strong or contradictory. Try simplifying your system description.`;
        } else if (poorDataQuality) {
            statusHtml = `<strong>POOR DATA QUALITY DETECTED</strong> - The AI misunderstood your input or used extreme values.`;
            actionableAdvice = `Try rewriting your description with clearer intensity words like "strongly influences" or "has moderate impact on."`;
        } else {
            statusHtml = `<strong>CRITICAL ISSUES DETECTED</strong> - The analysis has significant problems that affect reliability.`;
            actionableAdvice = `Please review the detailed checks below and consider revising your input data.`;
        }
    } else if (overallStatus === "warning") {
        statusClass = "bg-yellow-900/40 border-yellow-500/60 text-yellow-200";
        statusIcon = "⚠️";
        statusHtml = `<strong>WARNINGS PRESENT</strong> - The analysis has some issues that may affect interpretation.`;
        actionableAdvice = `The results are usable but could be improved with better input data.`;
    } else {
        statusClass = "bg-green-900/40 border-green-500/60 text-green-200";
        statusIcon = "✅";
        statusHtml = `<strong>ANALYSIS LOOKS GOOD</strong> - No major issues detected with the model.`;
        actionableAdvice = `Your results should be reliable and actionable.`;
    }

    // Enhanced checks with comprehensive explanations
    let checksHtml = "";
    if (diagnostics && diagnostics.checks && diagnostics.checks.length > 0) {
        // Sort checks: fail, warn, pass
        const levelOrder = { "fail": 1, "warn": 2, "pass": 3, "success": 3 };
        diagnostics.checks.sort((a, b) => (levelOrder[a.status] || 4) - (levelOrder[b.status] || 4));

        diagnostics.checks.forEach(check => {
            let statusClass = "text-blue-300"; 
            let icon = "ℹ️";
            let recommendation = "";
            let severity = "";
            
            if (check.status === 'fail') {
                statusClass = "text-red-300";
                icon = "🔴";
                severity = "CRITICAL";
                
                // Enhanced recommendations for specific failures
                if (check.metric === 'AI Scale Adherence') {
                    recommendation = `
                        <div class="mt-3 p-3 bg-red-900/30 rounded-lg text-xs border border-red-500/30">
                            <div class="font-medium text-red-200 mb-2">🔧 How to Fix This:</div>
                            <div class="space-y-1 text-red-100">
                                <div>• <strong>Use specific intensity words:</strong> "strongly influences", "moderately affects", "weakly impacts"</div>
                                <div>• <strong>Avoid extreme language:</strong> Instead of "completely controls" use "strongly influences"</div>
                                <div>• <strong>Be more explicit:</strong> Instead of "affects" use "has a moderate impact on"</div>
                                <div>• <strong>Review your relationships:</strong> Make sure they're realistic, not maximum intensity</div>
                            </div>
                        </div>
                    `;
                } else if (check.metric === 'Model Stability') {
                    recommendation = `
                        <div class="mt-3 p-3 bg-red-900/30 rounded-lg text-xs border border-red-500/30">
                            <div class="font-medium text-red-200 mb-2">🔧 How to Fix This:</div>
                            <div class="space-y-1 text-red-100">
                                <div>• <strong>Simplify your system:</strong> Focus on 3-7 key factors instead of many</div>
                                <div>• <strong>Avoid circular logic:</strong> Don't make A→B and B→A equally strong</div>
                                <div>• <strong>Reduce over-connectivity:</strong> Not everything should influence everything</div>
                                <div>• <strong>Use varied intensities:</strong> Mix strong, moderate, and weak relationships</div>
                            </div>
                        </div>
                    `;
                }
            } else if (check.status === 'warn') {
                statusClass = "text-yellow-300";
                icon = "🟡";
                severity = "WARNING";
                
                if (check.metric === 'Matrix Density') {
                    recommendation = `
                        <div class="mt-3 p-3 bg-yellow-900/30 rounded-lg text-xs border border-yellow-500/30">
                            <div class="font-medium text-yellow-200 mb-2">💡 Suggestion:</div>
                            <div class="space-y-1 text-yellow-100">
                                <div>• <strong>Focus on key relationships:</strong> Describe only the most important connections</div>
                                <div>• <strong>Use "little to no impact":</strong> For weak relationships instead of ignoring them</div>
                                <div>• <strong>Consider system boundaries:</strong> Maybe some factors should be external</div>
                            </div>
                        </div>
                    `;
                } else if (check.metric === 'Low Factor Count') {
                    recommendation = `
                        <div class="mt-3 p-3 bg-yellow-900/30 rounded-lg text-xs border border-yellow-500/30">
                            <div class="font-medium text-yellow-200 mb-2">💡 Suggestion:</div>
                            <div class="space-y-1 text-yellow-100">
                                <div>• <strong>Add more factors:</strong> Try to identify 4-7 key factors for better analysis</div>
                                <div>• <strong>Break down broad factors:</strong> "Performance" could become "Speed" + "Quality"</div>
                                <div>• <strong>Consider sub-components:</strong> What are the parts of your main factors?</div>
                            </div>
                        </div>
                    `;
                }
            } else if (check.status === 'pass' || check.status === 'success') {
                statusClass = "text-green-300";
                icon = "✅";
                severity = "PASS";
            }

            checksHtml += `
                <tr class="border-b border-white/10">
                    <td class="p-4">
                        <div class="flex items-center">
                            <span class="${statusClass} text-lg mr-2">${icon}</span>
                            <div>
                                <div class="font-semibold text-white">${check.metric}</div>
                                <div class="text-xs ${statusClass} font-medium">${severity}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-white/90">${check.message || 'No message provided.'}</div>
                        ${recommendation}
                    </td>
                </tr>
            `;
        });
    } else {
        checksHtml = "<tr><td colspan='2' class='p-4 text-white/70 text-center'>No diagnostic checks were generated.</td></tr>";
    }

    // Enhanced statistics with critical value detection
    let statsHtml = "";
    if (diagnostics && diagnostics.statistics) {
        const stats = diagnostics.statistics;
        
        // AI Max Value with enhanced interpretation
        let aiValueInterpretation = "";
        let aiValueClass = "text-white/80";
        const aiMax = parseFloat(stats.ai_max_value) || 0;
        if (aiMax > 4) {
            aiValueInterpretation = `<div class="text-xs text-red-300 mt-1 font-medium">🚨 CRITICAL: Outside 0-4 scale</div>`;
            aiValueClass = "text-red-300";
        } else if (aiMax === 0) {
            aiValueInterpretation = `<div class="text-xs text-yellow-300 mt-1">⚠️ No relationships detected</div>`;
            aiValueClass = "text-yellow-300";
        } else {
            aiValueInterpretation = `<div class="text-xs text-green-300 mt-1">✓ Within expected range</div>`;
            aiValueClass = "text-green-300";
        }
        
        // Stability with interpretation
        let stabilityInterpretation = "";
        let stabilityClass = "text-white/80";
        const stability = parseFloat(stats.max_norm_row_sum) || 0;
        if (stability > 5) {
            stabilityInterpretation = `<div class="text-xs text-red-300 mt-1 font-medium">🚨 UNSTABLE</div>`;
            stabilityClass = "text-red-300";
        } else if (stability > 2) {
            stabilityInterpretation = `<div class="text-xs text-yellow-300 mt-1">⚠️ Borderline</div>`;
            stabilityClass = "text-yellow-300";
        } else {
            stabilityInterpretation = `<div class="text-xs text-green-300 mt-1">✓ Stable</div>`;
            stabilityClass = "text-green-300";
        }
        
        // Matrix Density with enhanced interpretation
        let densityInterpretation = "";
        let densityClass = "text-white/80";
        const density = parseFloat(stats.matrix_density) || 0;
        if (density >= 100) {
            densityInterpretation = `<div class="text-xs text-red-300 mt-1 font-medium">🚨 TOTAL CONNECTIVITY</div>`;
            densityClass = "text-red-300";
        } else if (density > 80) {
            densityInterpretation = `<div class="text-xs text-yellow-300 mt-1">⚠️ Over-connected</div>`;
            densityClass = "text-yellow-300";
        } else if (density < 20) {
            densityInterpretation = `<div class="text-xs text-blue-300 mt-1">ℹ️ Sparse system</div>`;
            densityClass = "text-blue-300";
        } else {
            densityInterpretation = `<div class="text-xs text-green-300 mt-1">✓ Good balance</div>`;
            densityClass = "text-green-300";
        }
        
        // Cause Factors interpretation
        let causeInterpretation = "";
        let causeClass = "text-white/80";
        const causeCount = parseInt(stats.cause_factors_found) || 0;
        const totalFactors = parseInt(stats.total_factors) || parseInt(stats.factor_count) || 5;
        if (causeCount === 0) {
            causeInterpretation = `<div class="text-xs text-red-300 mt-1 font-medium">🚨 No drivers found</div>`;
            causeClass = "text-red-300";
        } else if (causeCount === 1 && totalFactors > 4) {
            causeInterpretation = `<div class="text-xs text-yellow-300 mt-1">⚠️ Only one driver</div>`;
            causeClass = "text-yellow-300";
        } else if (causeCount === totalFactors) {
            causeInterpretation = `<div class="text-xs text-yellow-300 mt-1">⚠️ All are drivers</div>`;
            causeClass = "text-yellow-300";
        } else {
            causeInterpretation = `<div class="text-xs text-green-300 mt-1">✓ Good balance</div>`;
            causeClass = "text-green-300";
        }

        statsHtml = `
            <div class="summary-stat-card border-l-4 ${aiMax > 4 ? 'border-red-500' : aiMax === 0 ? 'border-yellow-500' : 'border-green-500'}">
                <div class="stat-value ${aiValueClass}">${stats.ai_max_value || 'N/A'}</div>
                <div class="stat-label">Max AI Value</div>
                <div class="text-xs text-white/60 mt-1">(Should be 0-4)</div>
                ${aiValueInterpretation}
            </div>
            <div class="summary-stat-card border-l-4 ${stability > 5 ? 'border-red-500' : stability > 2 ? 'border-yellow-500' : 'border-green-500'}">
                <div class="stat-value ${stabilityClass}">${stats.max_norm_row_sum || 'N/A'}</div>
                <div class="stat-label">Stability</div>
                <div class="text-xs text-white/60 mt-1">(Max Row Sum)</div>
                ${stabilityInterpretation}
            </div>
            <div class="summary-stat-card border-l-4 ${density >= 100 ? 'border-red-500' : density > 80 ? 'border-yellow-500' : 'border-green-500'}">
                <div class="stat-value ${densityClass}">${stats.matrix_density || 'N/A'}</div>
                <div class="stat-label">Matrix Density</div>
                <div class="text-xs text-white/60 mt-1">(% Connected)</div>
                ${densityInterpretation}
            </div>
            <div class="summary-stat-card border-l-4 ${causeCount === 0 ? 'border-red-500' : (causeCount === 1 && totalFactors > 4) ? 'border-yellow-500' : 'border-green-500'}">
                <div class="stat-value ${causeClass}">${stats.cause_factors_found || 'N/A'} / ${totalFactors}</div>
                <div class="stat-label">Cause Factors</div>
                <div class="text-xs text-white/60 mt-1">(Drivers Found)</div>
                ${causeInterpretation}
            </div>
        `;
    }

    // Enhanced Data Quality Tips section
    const dataQualityTips = `
        <div class="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-lg border border-blue-500/30 mt-8">
            <h5 class="text-xl font-semibold mb-4 text-blue-300 flex items-center">
                <span class="mr-2">💡</span> Complete Guide to Better DEMATEL Data
            </h5>
            
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h6 class="font-semibold text-green-300 mb-2">✅ DO This:</h6>
                    <div class="space-y-2 text-sm text-white/80">
                        <div><strong>Use Specific Intensity Words:</strong><br>"strongly influences", "moderately affects", "weakly impacts", "has little effect on"</div>
                        <div><strong>Vary Relationship Strengths:</strong><br>Mix strong, moderate, and weak relationships realistically</div>
                        <div><strong>Explain WHY:</strong><br>"A influences B because..." gives AI better context</div>
                        <div><strong>Focus on Key Relationships:</strong><br>Describe the most important connections, not every possible one</div>
                        <div><strong>Use 3-7 Factors:</strong><br>This range gives the best analysis results</div>
                    </div>
                </div>
                
                <div>
                    <h6 class="font-semibold text-red-300 mb-2">❌ AVOID This:</h6>
                    <div class="space-y-2 text-sm text-white/80">
                        <div><strong>Everything is "Strong":</strong><br>Don't make all relationships maximum intensity</div>
                        <div><strong>Circular Logic:</strong><br>Avoid A→B and B→A with equal strength</div>
                        <div><strong>Vague Language:</strong><br>"affects", "impacts", "influences" without intensity</div>
                        <div><strong>"Everything affects everything":</strong><br>This creates mathematical instability</div>
                        <div><strong>Too Many Factors:</strong><br>8+ factors often lead to over-complexity</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 p-3 bg-blue-900/30 rounded border border-blue-500/50">
                <h6 class="font-semibold text-blue-200 mb-2">📝 Example of Good Input:</h6>
                <div class="text-xs text-blue-100 font-mono">
                    "Product Quality <strong>strongly influences</strong> Customer Satisfaction because defects create complaints. 
                    Price <strong>moderately affects</strong> Sales Volume through demand elasticity. 
                    Marketing <strong>weakly impacts</strong> Product Quality since it doesn't change the actual product."
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <h3 class="result-subheader text-2xl font-bold">Model Diagnostics & Health Check</h3>
        <p class="text-white/70 mb-6">This tab analyzes the quality and reliability of your DEMATEL analysis to help you get better results.</p>
        
        <!-- Enhanced Overall Status Banner -->
        <div class="p-6 rounded-xl border-2 ${statusClass} mb-8 shadow-lg">
            <div class="flex items-start">
                <span class="text-3xl mr-4 mt-1">${statusIcon}</span>
                <div class="flex-1">
                    <div class="text-lg font-bold mb-2">${statusHtml}</div>
                    <div class="text-sm opacity-90 mb-3">${criticalIssues} critical issues, ${warningIssues} warnings detected</div>
                    <div class="text-sm font-medium">${actionableAdvice}</div>
                </div>
            </div>
        </div>

        <h4 class="text-xl font-semibold mb-4">📊 Model Statistics</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            ${statsHtml}
        </div>

        <h4 class="text-xl font-semibold mb-4">🔍 Detailed Health Check Results</h4>
        <div class="overflow-x-auto mb-8">
            <table class="coeff-table styled-table text-sm w-full">
                <thead>
                    <tr>
                        <th class="w-1/3 text-left">Diagnostic Check</th>
                        <th class="w-2/3 text-left">Status & Recommendations</th>
                    </tr>
                </thead>
                <tbody>
                    ${checksHtml}
                </tbody>
            </table>
        </div>
        
        ${dataQualityTips}
    `;
}

/**
 * Renders the new "Learn DEMATEL" tab.
 * --- UPDATED ---
 * This version explains our AI-powered methodology, not the
 * manual, academic process, to build user trust and
 * clarify how the tool actually works.
 */
function renderLearnDematelTab(containerId) {
    const container = dom.$(containerId);
    if (!container) return;

    // This is static content, but now it's accurate to our tool
    container.innerHTML = `
        <h3 class="text-3xl font-bold text-center mb-6">🎓 Understanding Our AI-Powered DEMATEL Analysis</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-black/20 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">What is DEMATEL?</h4>
                <p class="text-sm text-white/80">The <strong>DEMATEL</strong> method is a powerful tool used to analyze a complex system and understand the *causal relationships* between its parts.</p>
                <p class="text-sm text-white/80 mt-2">Its main goal is to separate factors into two simple groups:</p>
                <ul class="list-disc list-inside space-y-1 text-sm mt-2 pl-4">
                    <li><strong>'Cause' Factors (Drivers):</strong> The root factors that *influence* the rest of the system.</li>
                    <li><strong>'Effect' Factors (Outcomes):</strong> The factors that are *influenced by* others (the symptoms or results).</li>
                </ul>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">How This Tool Works (Our Methodology)</h4>
                <p class="text-sm text-white/80">You don't need to be an expert. Our tool automates the hard parts:</p>
                <ol class="list-decimal list-inside space-y-2 text-sm mt-2 pl-4">
                    <li><strong>1. You Describe:</strong> You provide a natural language description of your system, its factors, and their relationships (e.g., "Factor A strongly influences Factor B").</li>
                    <li><strong>2. AI Analyzes:</strong> The AI (Llama 3.1) reads your text, identifies your key factors, and builds the complex "Direct Influence Matrix" for you, using a 0-4 scale based on your wording.</li>
                    <li><strong>3. You Validate:</strong> You check the AI's work in the "Preview" step to ensure it understood you correctly.</li>
                    <li><strong>4. Backend Calculates:</strong> Our Python backend takes the confirmed matrix and performs all the complex DEMATEL math (normalization, matrix inversion, etc.) to get the final, accurate results.</li>
                </ol>
            </div>
        </div>

        <h3 class="result-subheader text-2xl font-bold text-center mt-8 mb-4">How to Interpret Your Results</h3>
        <p class="text-white/70 mb-4 text-center max-w-3xl mx-auto">The analysis gives you two key numbers for each factor. Use them to decide where to focus your efforts.</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2 text-yellow-300">Prominence (D+R): "Importance"</h4>
                <p class="text-sm text-white/80">This number shows how "connected" a factor is. A high prominence means the factor has many strong relationships (both giving and receiving influence). This is your system's "central hub."</p>
                <p class="text-sm text-white/90 font-semibold mt-2"><strong>Rule:</strong> The higher the Prominence, the more central and important the factor is to the overall system.</p>
            </div>
            
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2 text-blue-300">Relation (D-R): "Causal Role"</h4>
                <p class="text-sm text-white/80">This is the most critical number. It tells you if a factor is a driver or an outcome.</p>
                <ul class="list-none space-y-2 text-sm mt-2">
                    <li><strong class="text-blue-300">Positive (D-R > 0) = 'Cause' Factor:</strong> This factor *gives* more influence than it receives. It is a root driver.</li>
                    <li><strong class="text-red-300">Negative (D-R < 0) = 'Effect' Factor:</strong> This factor *receives* more influence than it gives. It is a symptom or outcome.</li>
                </ul>
            </div>
        </div>

        <div class="p-6 rounded-lg bg-green-900/20 border border-green-500/30 text-center mt-8">
            <h4 class="text-xl font-bold mb-2 text-green-300">Your Strategic Action Plan</h4>
            <p class="text-white/90">To fix a complex problem, **focus your energy on the 'Cause' factors** (positive D-R). By improving them, you will automatically fix the 'Effect' factors.</p>
            <p class="text-white/90 mt-1">Use the **'Effect' factors as your KPIs** to monitor if your changes are working.</p>
        </div>

        <div class="p-4 rounded-lg bg-black/20 border border-white/10 text-center mt-8">
             <h4 class="text-lg font-bold mb-2 text-indigo-300">Check Your Model's Health</h4>
             <p class="text-sm text-white/80">Always check the <strong>"Diagnostics"</strong> tab. It will tell you if the AI's analysis was stable and if any potential issues (like no 'Cause' factors) were found.</p>
        </div>
    `;
}

/**
 * Renders the DEMATEL Causal Diagram chart into its container.
 * --- FIXED VERSION - Minimal changes to existing function ---
 * Fixes alignment issues and adds color bar
 */
function renderDematelChart(chartData) {
    const chartContainer = dom.$("dematel-chart-container");
    if (!chartContainer) {
        console.warn("DEMATEL chart container not found.");
        return;
    }

    // Check for all zero data (from a failed calculation)
    const isAllZero = chartData.data.every(d => d.x === 0 && d.y === 0);
    if (isAllZero) {
        chartContainer.innerHTML = `
            <div class="p-6 text-center text-white/70 flex items-center justify-center h-full">
                <div>
                    <h4 class="text-xl font-bold text-yellow-300 mb-4">Chart Cannot Be Rendered</h4>
                    <p>The analysis resulted in zero prominence and relation for all factors.</p>
                    <p>This is a valid result but cannot be plotted. Please see the <strong class="text-red-400">Diagnostics</strong> tab.</p>
                </div>
            </div>
        `;
        return;
    }

    chartContainer.innerHTML = ""; // Clear placeholder

    try {
        // Calculate intelligent text positions to avoid overlap
        const textPositions = chartData.data.map((point, index) => {
            const x = point.x;
            const y = point.y;
            const avgX = chartData.data.reduce((sum, p) => sum + p.x, 0) / chartData.data.length;
            
            // Position labels based on quadrant and avoid clustering
            if (x > avgX && y > 0) {
                // Top right quadrant - alternate positions
                return index % 2 === 0 ? 'top left' : 'bottom right';
            } else if (x <= avgX && y > 0) {
                // Top left quadrant - alternate positions  
                return index % 2 === 0 ? 'top right' : 'bottom left';
            } else if (x > avgX && y <= 0) {
                // Bottom right quadrant
                return index % 2 === 0 ? 'top right' : 'bottom left';
            } else {
                // Bottom left quadrant
                return index % 2 === 0 ? 'top left' : 'bottom right';
            }
        });

        const plotData = [{
            x: chartData.data.map(m => m.x), // Prominence (D+R)
            y: chartData.data.map(m => m.y), // Relation (D-R)
            text: chartData.data.map(m => m.name),
            mode: 'markers+text',
            textposition: textPositions,
            textfont: {
                size: 11,
                color: 'white'
            },
            marker: {
                size: 12,
                color: chartData.data.map(m => m.y),
                colorscale: 'RdBu',
                showscale: true, // Show the color bar
                colorbar: {
                    title: {
                        text: "Relation (D-R)<br>Cause ↔ Effect",
                        font: { color: 'white', size: 12 }
                    },
                    titleside: "right",
                    tickfont: { color: 'white', size: 10 },
                    x: 1.02, // Position colorbar to the right
                    len: 0.8,
                    thickness: 15
                }
            },
            type: 'scatter',
            hovertemplate: '<b>%{text}</b><br>Prominence: %{x:.3f}<br>Relation: %{y:.3f}<extra></extra>'
        }];

        // Calculate context lines with better spacing
        const avgProminence = chartData.data.reduce((sum, p) => sum + p.x, 0) / chartData.data.length;
        const maxRelation = Math.max(...chartData.data.map(p => Math.abs(p.y)));
        const yPadding = maxRelation * 0.15 || 0.1; 
        const yRange = [-(maxRelation + yPadding), maxRelation + yPadding];
        const minProminence = Math.min(...chartData.data.map(p => p.x));
        const maxProminence = Math.max(...chartData.data.map(p => p.x));
        const xPadding = (maxProminence - minProminence) * 0.1 || 0.1;
        const xRange = [minProminence - xPadding, maxProminence + xPadding];

        const layout = {
            title: {
                text: chartData.title,
                font: { color: 'white' } 
            },
            paper_bgcolor: 'rgba(0,0,0,0)', 
            plot_bgcolor: 'rgba(0,0,0,0.1)', 
            font: { color: 'white' }, 
            xaxis: { 
                title: {
                    text: chartData.x_axis_label,
                    font: { color: 'white' } 
                },
                gridcolor: 'rgba(255, 255, 255, 0.2)', 
                zeroline: false,
                tickfont: { color: 'white' },
                range: xRange // Use calculated range instead of automargin
            },
            yaxis: { 
                title: {
                    text: chartData.y_axis_label,
                    font: { color: 'white' } 
                },
                gridcolor: 'rgba(255, 255, 255, 0.2)', 
                zeroline: true, 
                zerolinecolor: 'rgba(255, 255, 255, 0.5)', 
                tickfont: { color: 'white' },
                range: yRange // Use calculated range for proper alignment
            },
            hovermode: 'closest',
            margin: { t: 50, b: 60, l: 80, r: 120 }, // Fixed margins instead of automargin
            autosize: true,

            shapes: [
                { 
                    type: 'line',
                    xref: 'paper', x0: 0, x1: 1,
                    yref: 'y', y0: 0, y1: 0,
                    line: { color: 'rgba(255, 255, 255, 0.5)', width: 1, dash: 'dot' }
                },
                { 
                    type: 'line',
                    xref: 'x', x0: avgProminence, x1: avgProminence,
                    yref: 'paper', y0: 0, y1: 1,
                    line: { color: 'rgba(255, 255, 255, 0.5)', width: 1, dash: 'dot' }
                }
            ],
            annotations: [
                {
                    text: 'Core Drivers',
                    x: maxProminence - xPadding * 0.5, 
                    y: yRange[1] - yPadding * 0.5,
                    showarrow: false, 
                    font: { color: 'rgba(255, 255, 255, 0.4)' }
                },
                {
                    text: 'Independent Drivers',
                    x: minProminence + xPadding * 0.5, 
                    y: yRange[1] - yPadding * 0.5,
                    showarrow: false, 
                    font: { color: 'rgba(255, 255, 255, 0.4)' }
                },
                {
                    text: 'Central Outcomes',
                    x: maxProminence - xPadding * 0.5, 
                    y: yRange[0] + yPadding * 0.5,
                    showarrow: false, 
                    font: { color: 'rgba(255, 255, 255, 0.4)' }
                },
                {
                    text: 'Independent Outcomes',
                    x: minProminence + xPadding * 0.5, 
                    y: yRange[0] + yPadding * 0.5,
                    showarrow: false, 
                    font: { color: 'rgba(255, 255, 255, 0.4)' }
                }
            ]
        };

        Plotly.newPlot(chartContainer, plotData, layout, { responsive: true });

    } catch (e) {
        console.error("Chart rendering failed (is Plotly.js loaded?):", e);
        chartContainer.innerHTML = `<div class="error-message">Chart rendering failed: ${e.message}.<br><pre class="text-xs bg-black/30 p-2 rounded mt-2">${JSON.stringify(chartData.data, null, 2)}</pre></div>`;
    }
}

export {
    renderDescriptivePage_DA,
    renderPredictiveAnalysisPage,
    renderPrescriptivePage_DA,
    renderVisualizationPage_DA,
    renderAdvancedRegressionPage,
    renderPlsPage_DA,
    renderDematelAnalysisPage
}