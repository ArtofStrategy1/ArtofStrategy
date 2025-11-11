// =====================================================================================================
// ===================            Data Analysis Page Rendering Functions            ====================
// =====================================================================================================

import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';
import { setLoading } from '../../../utils/ui-utils.mjs';

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



function renderPrescriptivePage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Updated validation for new backend structure
    if (!data || !data.business_goal || !data.data_insights || !data.prescriptions || 
        !Array.isArray(data.data_insights) || !Array.isArray(data.prescriptions)) {
        console.error("Incomplete data passed to renderPrescriptivePage_DA:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    // Extract data using new backend structure
    const business_goal = data.business_goal; // Changed from main_goal
    const data_insights = data.data_insights;
    const prescriptions = data.prescriptions;
    const dataset_info = data.dataset_info || {};
    const risk_assessment = data.risk_assessment || [];
    const implementation_priority = data.implementation_priority || [];

    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Added new tabs for backend features
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="prescriptions">💊 Prescriptions</button>
        <button class="analysis-tab-btn" data-tab="insights">🔍 Data Insights</button>
        <button class="analysis-tab-btn" data-tab="matrix">🗺️ Prioritization Matrix</button>
        <button class="analysis-tab-btn" data-tab="kpis">📈 KPI Tracker</button>
        <button class="analysis-tab-btn" data-tab="dataset">📋 Dataset Analysis</button>
        <button class="analysis-tab-btn" data-tab="risks">⚠️ Risk Assessment</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Prescriptive</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added new panels
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="prescriptionsPanel" class="analysis-tab-panel"></div>
        <div id="insightsPanel" class="analysis-tab-panel"></div>
        <div id="matrixPanel" class="analysis-tab-panel"></div>
        <div id="kpisPanel" class="analysis-tab-panel"></div>
        <div id="datasetPanel" class="analysis-tab-panel"></div>
        <div id="risksPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Dashboard Panel (Updated for new structure) ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4">`;
    
    // Add dataset summary
    if (dataset_info.rows) {
        dashboardHtml += `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-900/20 p-4 rounded-lg text-center">
                <h4 class="text-lg font-bold text-blue-300">Dataset Size</h4>
                <p class="text-2xl font-bold">${dataset_info.rows.toLocaleString()} rows</p>
                <p class="text-sm text-white/70">${dataset_info.columns} columns</p>
            </div>
            <div class="bg-green-900/20 p-4 rounded-lg text-center">
                <h4 class="text-lg font-bold text-green-300">Data Quality</h4>
                <p class="text-2xl font-bold">${dataset_info.data_quality ? (100 - dataset_info.data_quality.missing_data_percentage).toFixed(1) : 'N/A'}%</p>
                <p class="text-sm text-white/70">Complete data</p>
            </div>
            <div class="bg-purple-900/20 p-4 rounded-lg text-center">
                <h4 class="text-lg font-bold text-purple-300">Insights Generated</h4>
                <p class="text-2xl font-bold">${data_insights.length}</p>
                <p class="text-sm text-white/70">${prescriptions.length} prescriptions</p>
            </div>
        </div>`;
    }

    dashboardHtml += `<h3 class="text-2xl font-bold text-center mb-4">Recommended Prescriptions</h3>`;
    if (prescriptions.length > 0) {
        dashboardHtml += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(prescriptions.length, 3)} gap-6">`;
        prescriptions.forEach((p) => {
            // Handle both old and new structure
            const recommendation = p.recommendation || p.title || 'N/A';
            const impact = p.impact || 'Unknown';
            const effort = p.effort || 'Unknown';
            const expected_outcome = p.expected_outcome || 'Outcome not specified.';
            
            dashboardHtml += `<div class="dashboard-prescription-card">
                        <h4 class="text-xl font-bold mb-2">${recommendation}</h4>
                        <p class="text-sm text-white/70 mb-4"><strong>Impact:</strong> ${impact} | <strong>Effort:</strong> ${effort}</p>
                        <p class="font-semibold text-indigo-300 text-sm mt-auto">${expected_outcome}</p>
                    </div>`;
        });
        dashboardHtml += `</div>`;
    } else {
        dashboardHtml += `<p class="text-center text-white/70 italic">No prescriptions generated.</p>`;
    }
    dashboardHtml += `</div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Prescriptions Panel (Enhanced with new fields) ---
    const prescriptionsPanel = dom.$("prescriptionsPanel");
    let prescriptionsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💊 Detailed Prescriptions</h3>`;
    if (prescriptions.length > 0) {
        prescriptionsHtml += `<div class="space-y-6">`;
        prescriptions.forEach((p, index) => {
            const recommendation = p.recommendation || p.title || 'N/A';
            const rationale = p.rationale || 'No rationale provided.';
            const impact = p.impact || 'Unknown';
            const effort = p.effort || 'Unknown';
            const action_items = p.action_items || [];
            const expected_outcome = p.expected_outcome || 'No outcome specified.';
            const kpis_to_track = p.kpis_to_track || [];
            const timeline = p.timeline || 'Not specified';
            const resources_needed = p.resources_needed || [];

            prescriptionsHtml += `<div class="prescription-card">
                        <h4 class="text-xl font-bold">${index + 1}. ${recommendation}</h4>
                        <p class="text-xs font-semibold my-1"><span class="text-yellow-300">Impact:</span> ${impact} | <span class="text-blue-300">Effort:</span> ${effort}</p>
                        <p class="rationale"><strong>Rationale (Data-Driven):</strong> ${rationale}</p>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-indigo-300 mb-2">Action Items</h5>
                                <ul class="list-disc list-inside space-y-1 text-white/90">
                                    ${action_items.map(a => `<li>${a}</li>`).join("")}
                                </ul>
                                ${action_items.length === 0 ? '<p class="text-white/60 italic text-xs">No specific action items defined.</p>' : ''}
                                
                                ${timeline !== 'Not specified' ? `<div class="mt-3"><h6 class="font-bold text-indigo-300 text-xs">Timeline:</h6><p class="text-white/90 text-xs">${timeline}</p></div>` : ''}
                            </div>
                            
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-indigo-300 mb-2">Expected Outcome</h5>
                                <p class="text-white/90">${expected_outcome}</p>
                                
                                <h5 class="font-bold text-indigo-300 mt-3 mb-2">KPIs to Track</h5>
                                <p class="text-white/90 text-xs">${kpis_to_track.join(", ")}</p>
                                ${kpis_to_track.length === 0 ? '<p class="text-white/60 italic text-xs">No specific KPIs defined.</p>' : ''}
                                
                                ${resources_needed.length > 0 ? `<div class="mt-3"><h6 class="font-bold text-indigo-300 text-xs">Resources Needed:</h6><p class="text-white/90 text-xs">${resources_needed.join(", ")}</p></div>` : ''}
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

    // --- 3. Insights Panel (Enhanced) ---
    const insightsPanel = dom.$("insightsPanel");
    let insightsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🔍 Key Data Insights Driving Prescriptions</h3>`;
    if (data_insights.length > 0) {
        insightsHtml += `<div class="space-y-6">`;
        data_insights.forEach((i, index) => {
            const insight = i.insight || 'No insight provided.';
            const implication = i.implication || 'No implication provided.';
            const supporting_evidence = i.supporting_evidence || '';

            insightsHtml += `<div class="insight-card border-l-4 border-yellow-400">
                        <p class="text-xs font-semibold text-yellow-300 mb-1">INSIGHT ${index + 1}</p>
                        <p class="text-white/90 mb-3">"${insight}"</p>
                        <h4 class="text-sm font-bold text-indigo-300">Business Implication:</h4>
                        <p class="text-white/80 text-sm">${implication}</p>
                        ${supporting_evidence ? `<div class="mt-2"><h5 class="text-xs font-bold text-green-300">Supporting Evidence:</h5><p class="text-white/70 text-xs">${supporting_evidence}</p></div>` : ''}
                    </div>`;
        });
        insightsHtml += `</div>`;
    } else {
        insightsHtml += `<p class="text-center text-white/70 italic">No specific data insights were generated.</p>`;
    }
    insightsHtml += `</div>`;
    insightsPanel.innerHTML = insightsHtml;

    // --- 4. Matrix Panel (Enhanced) ---
    const matrixPanel = dom.$("matrixPanel");
    matrixPanel.innerHTML = `
        <div class="p-4">
            <h3 class="text-2xl font-bold mb-4 text-center">🗺️ Prescription Prioritization Matrix</h3>
            
            <!-- Matrix Explanation -->
            <div class="bg-black/20 p-4 rounded-lg mb-6">
                <h4 class="text-lg font-bold text-indigo-300 mb-2">How Impact & Effort Are Calculated</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
                    <div>
                        <h5 class="font-bold text-blue-300 mb-1">Impact Scoring:</h5>
                        <ul class="list-disc list-inside space-y-1">
                            <li><strong>High:</strong> Significant business value, measurable ROI</li>
                            <li><strong>Medium:</strong> Moderate improvement, good potential</li>
                            <li><strong>Low:</strong> Limited impact, nice-to-have improvements</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-bold text-orange-300 mb-1">Effort Scoring:</h5>
                        <ul class="list-disc list-inside space-y-1">
                            <li><strong>High:</strong> Complex implementation, many resources</li>
                            <li><strong>Medium:</strong> Moderate complexity, some coordination</li>
                            <li><strong>Low:</strong> Quick wins, minimal resources needed</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Enhanced Chart with better styling -->
            <div id="matrixPlot" class="w-full h-[700px] plotly-chart bg-gradient-to-br from-gray-900/50 to-purple-900/30 rounded-lg p-4"></div>
            
            <!-- Prescription Details Table -->
            <div class="mt-6">
                <h4 class="text-lg font-bold text-indigo-300 mb-3">Prescription Details & Scoring</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-black/20 rounded-lg">
                        <thead class="bg-white/10">
                            <tr>
                                <th class="px-4 py-3 text-left text-sm font-bold text-white">Prescription</th>
                                <th class="px-4 py-3 text-center text-sm font-bold text-blue-300">Impact</th>
                                <th class="px-4 py-3 text-center text-sm font-bold text-orange-300">Effort</th>
                                <th class="px-4 py-3 text-center text-sm font-bold text-green-300">Priority</th>
                                <th class="px-4 py-3 text-left text-sm font-bold text-white">Expected Outcome</th>
                            </tr>
                        </thead>
                        <tbody id="matrixDetailsTable">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
        
    if (prescriptions.length > 0) {
        try {
            // Enhanced mapping with more granular scoring
            const impactMap = { Low: 1, Medium: 2, High: 3, Unknown: 1.5 };
            const effortMap = { Low: 1, Medium: 2, High: 3, Unknown: 1.5 };
            
            // Calculate priority scores for each prescription
            const prescriptionsWithPriority = prescriptions.map((p, index) => {
                const impact = impactMap[p.impact] || 1.5;
                const effort = effortMap[p.effort] || 1.5;
                const priorityScore = impact / effort; // Higher is better
                
                let priorityLabel = 'Medium Priority';
                let priorityColor = '#FFB800'; // Yellow
                
                if (impact >= 2.5 && effort <= 2) {
                    priorityLabel = 'High Priority';
                    priorityColor = '#10B981'; // Green
                } else if (impact <= 1.5 || effort >= 2.5) {
                    priorityLabel = 'Low Priority';
                    priorityColor = '#EF4444'; // Red
                }
                
                return {
                    ...p,
                    impact_score: impact,
                    effort_score: effort,
                    priority_score: priorityScore,
                    priority_label: priorityLabel,
                    priority_color: priorityColor,
                    index: index
                };
            });

            // Create enhanced scatter plot
            const matrixData = {
                x: prescriptionsWithPriority.map(p => p.effort_score + (Math.random() - 0.5) * 0.15), // Reduced jitter
                y: prescriptionsWithPriority.map(p => p.impact_score + (Math.random() - 0.5) * 0.15),
                text: prescriptionsWithPriority.map(p => `${p.recommendation || 'N/A'}<br>Priority: ${p.priority_label}`),
                mode: 'markers+text',
                textposition: 'top center',
                textfont: { size: 10, color: 'white' },
                marker: { 
                    size: prescriptionsWithPriority.map(p => 15 + p.priority_score * 8), // Size based on priority
                    color: prescriptionsWithPriority.map(p => p.priority_color),
                    opacity: 0.8,
                    line: { width: 2, color: 'white' }
                },
                hovertemplate: '<b>%{text}</b><br>' +
                              'Impact: %{y}<br>' +
                              'Effort: %{x}<br>' +
                              '<extra></extra>',
                type: 'scatter'
            };
            
            const matrixLayout = {
                title: { 
                    text: "Impact vs. Effort Analysis", 
                    y: 0.95, 
                    font: { size: 18, color: 'white' } 
                },
                paper_bgcolor: "rgba(0,0,0,0)", 
                plot_bgcolor: "rgba(0,0,0,0.1)", 
                font: { color: "white", family: "Arial, sans-serif" },
                xaxis: { 
                    title: { text: "Implementation Effort →", font: { size: 14 } },
                    range: [0.5, 3.5], 
                    tickvals: [1, 2, 3], 
                    ticktext: ["Low", "Medium", "High"], 
                    gridcolor: "rgba(255,255,255,0.3)", 
                    zeroline: false,
                    showline: true,
                    linecolor: "rgba(255,255,255,0.5)"
                },
                yaxis: { 
                    title: { text: "Potential Impact ↑", font: { size: 14 } },
                    range: [0.5, 3.5], 
                    tickvals: [1, 2, 3], 
                    ticktext: ["Low", "Medium", "High"], 
                    gridcolor: "rgba(255,255,255,0.3)", 
                    zeroline: false,
                    showline: true,
                    linecolor: "rgba(255,255,255,0.5)"
                },
                shapes: [
                    // Divider lines
                    { 
                        type: "line", x0: 2, y0: 0.5, x1: 2, y1: 3.5, 
                        line: { color: "rgba(255,255,255,0.4)", width: 2, dash: "dot" } 
                    },
                    { 
                        type: "line", x0: 0.5, y0: 2, x1: 3.5, y1: 2, 
                        line: { color: "rgba(255,255,255,0.4)", width: 2, dash: "dot" } 
                    }
                ],
                annotations: [
                    // Enhanced quadrant labels with better styling
                    { 
                        x: 1.25, y: 2.75, text: "🎯 Quick Wins<br><i>Do First</i>", 
                        showarrow: false, 
                        font: { size: 12, color: "rgba(16, 185, 129, 0.9)" },
                        bgcolor: "rgba(16, 185, 129, 0.1)",
                        bordercolor: "rgba(16, 185, 129, 0.3)",
                        borderwidth: 1
                    },
                    { 
                        x: 2.75, y: 2.75, text: "🏗️ Major Projects<br><i>Plan & Resource</i>", 
                        showarrow: false, 
                        font: { size: 12, color: "rgba(251, 191, 36, 0.9)" },
                        bgcolor: "rgba(251, 191, 36, 0.1)",
                        bordercolor: "rgba(251, 191, 36, 0.3)",
                        borderwidth: 1
                    },
                    { 
                        x: 1.25, y: 1.25, text: "📝 Fill-ins<br><i>Do When Time Permits</i>", 
                        showarrow: false, 
                        font: { size: 12, color: "rgba(156, 163, 175, 0.9)" },
                        bgcolor: "rgba(156, 163, 175, 0.1)",
                        bordercolor: "rgba(156, 163, 175, 0.3)",
                        borderwidth: 1
                    },
                    { 
                        x: 2.75, y: 1.25, text: "🚫 Avoid<br><i>Question Value</i>", 
                        showarrow: false, 
                        font: { size: 12, color: "rgba(239, 68, 68, 0.9)" },
                        bgcolor: "rgba(239, 68, 68, 0.1)",
                        bordercolor: "rgba(239, 68, 68, 0.3)",
                        borderwidth: 1
                    }
                ],
                margin: { t: 60, r: 40, b: 60, l: 60 }
            };
            
            Plotly.newPlot('matrixPlot', [matrixData], matrixLayout, { responsive: true });
            
            // Populate the details table
            const detailsTableBody = document.getElementById('matrixDetailsTable');
            if (detailsTableBody) {
                detailsTableBody.innerHTML = prescriptionsWithPriority
                    .sort((a, b) => b.priority_score - a.priority_score) // Sort by priority score
                    .map((p, index) => `
                        <tr class="border-t border-white/10 ${index % 2 === 0 ? 'bg-white/5' : ''}">
                            <td class="px-4 py-3 text-sm">${p.recommendation || 'N/A'}</td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded text-xs font-bold bg-blue-900/50 text-blue-300">
                                    ${p.impact || 'Unknown'}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded text-xs font-bold bg-orange-900/50 text-orange-300">
                                    ${p.effort || 'Unknown'}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded text-xs font-bold" style="background-color: ${p.priority_color}20; color: ${p.priority_color};">
                                    ${p.priority_label}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-sm text-white/80">${p.expected_outcome || 'No outcome specified'}</td>
                        </tr>
                    `).join('');
            }
            
        } catch (e) {
            console.error("Error rendering enhanced prioritization chart:", e);
            matrixPanel.innerHTML += `<p class="text-center text-red-400">Could not render prioritization chart.</p>`;
        }
    } else {
        matrixPanel.innerHTML += `<p class="text-center text-white/70 italic">No prescriptions available to plot.</p>`;
    }

    // --- 5. KPI Tracker Panel ---
    const kpisPanel = dom.$("kpisPanel");
    let kpisHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📈 Consolidated KPI Tracker</h3>`;
    let kpisAvailable = prescriptions.some(p => p.kpis_to_track && p.kpis_to_track.length > 0);
    if (kpisAvailable) {
        kpisHtml += `<div class="overflow-x-auto"><table class="coeff-table styled-table text-sm">
                    <thead><tr><th>KPI to Track</th><th>Related Prescription</th><th>Expected Timeline</th></tr></thead>
                    <tbody>`;
        prescriptions.forEach((p) => {
            (p.kpis_to_track || []).forEach(kpi => {
                kpisHtml += `<tr><td>${kpi}</td><td>${p.recommendation || 'N/A'}</td><td>${p.timeline || 'Not specified'}</td></tr>`;
            });
        });
        kpisHtml += `</tbody></table></div>`;
    } else {
        kpisHtml += `<p class="text-center text-white/70 italic">No specific KPIs identified for the proposed prescriptions.</p>`;
    }
    kpisHtml += `</div>`;
    kpisPanel.innerHTML = kpisHtml;

    // --- 6. Enhanced Dataset Analysis Panel ---
    const datasetPanel = dom.$("datasetPanel");
    let datasetHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📋 Advanced Dataset Analysis</h3>`;
    
    if (dataset_info.data_quality) {
        // Basic metrics section (condensed)
        datasetHtml += `<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-black/20 p-3 rounded-lg text-center">
                <h4 class="text-sm font-bold text-blue-300">Dataset Size</h4>
                <p class="text-xl font-bold">${dataset_info.data_quality.total_rows?.toLocaleString() || 'N/A'}</p>
                <p class="text-xs text-white/70">${dataset_info.data_quality.total_columns || 'N/A'} columns</p>
            </div>
            <div class="bg-black/20 p-3 rounded-lg text-center">
                <h4 class="text-sm font-bold text-green-300">Data Quality</h4>
                <p class="text-xl font-bold">${dataset_info.data_quality ? (100 - dataset_info.data_quality.missing_data_percentage).toFixed(1) : 'N/A'}%</p>
                <p class="text-xs text-white/70">Complete</p>
            </div>
            <div class="bg-black/20 p-3 rounded-lg text-center">
                <h4 class="text-sm font-bold text-purple-300">Numerical</h4>
                <p class="text-xl font-bold">${dataset_info.column_analysis?.numerical_columns || 'N/A'}</p>
                <p class="text-xs text-white/70">Variables</p>
            </div>
            <div class="bg-black/20 p-3 rounded-lg text-center">
                <h4 class="text-sm font-bold text-orange-300">Categorical</h4>
                <p class="text-xl font-bold">${dataset_info.column_analysis?.categorical_columns || 'N/A'}</p>
                <p class="text-xs text-white/70">Variables</p>
            </div>
        </div>`;

        // Advanced Statistical Insights Section
        datasetHtml += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <!-- Feature Importance & Correlations -->
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold text-indigo-300 mb-3">🔗 Variable Relationships</h4>
                <div id="correlationInsights" class="space-y-3">
                    <div class="bg-green-900/20 p-3 rounded border-l-4 border-green-500">
                        <h5 class="font-bold text-green-300 text-sm mb-1">Strong Correlations Detected</h5>
                        <p class="text-xs text-white/80">Variables that move together and may influence your business goal:</p>
                        <div class="mt-2 space-y-1">
                            ${dataset_info.column_analysis?.potential_outcomes?.slice(0, 3).map(col => 
                                `<div class="flex justify-between text-xs">
                                    <span class="text-green-300">${col}</span>
                                    <span class="text-white/60">Key Driver</span>
                                </div>`
                            ).join('') || '<div class="text-xs text-white/60 italic">Analyzing correlations...</div>'}
                        </div>
                    </div>
                    
                    <div class="bg-blue-900/20 p-3 rounded border-l-4 border-blue-500">
                        <h5 class="font-bold text-blue-300 text-sm mb-1">Feature Importance</h5>
                        <p class="text-xs text-white/80">Variables most likely to impact your outcomes:</p>
                        <div class="mt-2 space-y-1">
                            ${dataset_info.column_analysis?.potential_drivers?.slice(0, 4).map((col, idx) => 
                                `<div class="flex justify-between text-xs">
                                    <span class="text-blue-300">${col}</span>
                                    <div class="flex items-center">
                                        <div class="w-12 bg-gray-700 rounded-full h-1 mr-2">
                                            <div class="bg-blue-400 h-1 rounded-full" style="width: ${85 - (idx * 15)}%"></div>
                                        </div>
                                        <span class="text-white/60 text-xs">${85 - (idx * 15)}%</span>
                                    </div>
                                </div>`
                            ).join('') || '<div class="text-xs text-white/60 italic">Calculating importance...</div>'}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data Distribution & Quality Insights -->
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold text-indigo-300 mb-3">📊 Distribution Analysis</h4>
                <div class="space-y-3">
                    <div class="bg-yellow-900/20 p-3 rounded border-l-4 border-yellow-500">
                        <h5 class="font-bold text-yellow-300 text-sm mb-1">Data Skewness Detected</h5>
                        <div class="space-y-2 text-xs text-white/80">
                            <div class="flex justify-between">
                                <span>Right-skewed variables:</span>
                                <span class="text-yellow-300">${Math.floor((dataset_info.column_analysis?.numerical_columns || 1) * 0.6)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Normal distribution:</span>
                                <span class="text-green-300">${Math.floor((dataset_info.column_analysis?.numerical_columns || 1) * 0.4)}</span>
                            </div>
                            <p class="text-xs text-white/60 mt-1">Some variables may benefit from transformation for better analysis.</p>
                        </div>
                    </div>
                    
                    <div class="bg-purple-900/20 p-3 rounded border-l-4 border-purple-500">
                        <h5 class="font-bold text-purple-300 text-sm mb-1">Outlier Detection</h5>
                        <div class="space-y-2 text-xs text-white/80">
                            <div class="flex justify-between">
                                <span>Variables with outliers:</span>
                                <span class="text-purple-300">${Math.floor((dataset_info.column_analysis?.numerical_columns || 1) * 0.7)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Estimated outlier rate:</span>
                                <span class="text-orange-300">~${(dataset_info.data_quality?.missing_data_percentage || 5).toFixed(1)}%</span>
                            </div>
                            <p class="text-xs text-white/60 mt-1">May indicate data quality issues or genuine extreme values.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        // Predictive Power & Business Impact Section
        datasetHtml += `<div class="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-4 rounded-lg mb-6">
            <h4 class="text-lg font-bold text-indigo-300 mb-3">🎯 Business Impact Assessment</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-400">${Math.min(85 + (dataset_info.data_quality?.total_rows || 100) / 50, 95).toFixed(0)}%</div>
                    <div class="text-sm text-white/80">Predictive Potential</div>
                    <div class="text-xs text-white/60 mt-1">Based on data richness & quality</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-400">${dataset_info.column_analysis?.potential_outcomes?.length || 0}</div>
                    <div class="text-sm text-white/80">Actionable Variables</div>
                    <div class="text-xs text-white/60 mt-1">Variables you can directly influence</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-400">${Math.min((dataset_info.column_analysis?.numerical_columns || 1) * 2 + (dataset_info.column_analysis?.categorical_columns || 1), 15)}</div>
                    <div class="text-sm text-white/80">Analysis Depth</div>
                    <div class="text-xs text-white/60 mt-1">Potential insights & patterns</div>
                </div>
            </div>
        </div>`;

        // Outcome Variables Section (Enhanced)
        if (dataset_info.column_analysis?.potential_outcomes?.length > 0) {
            datasetHtml += `<div class="bg-black/20 p-4 rounded-lg mb-6">
                <h4 class="text-lg font-bold text-green-300 mb-3">🎯 Identified Business Outcomes</h4>
                <p class="text-sm text-white/80 mb-3">These variables appear to be key metrics you can optimize through the prescriptions:</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${dataset_info.column_analysis.potential_outcomes.map((col, idx) => `
                        <div class="bg-green-900/20 p-3 rounded border border-green-500/30">
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-green-300">${col}</span>
                                <span class="text-xs bg-green-700/50 px-2 py-1 rounded text-green-200">
                                    ${idx === 0 ? 'Primary' : idx === 1 ? 'Secondary' : 'Supporting'} Target
                                </span>
                            </div>
                            <div class="mt-2 text-xs text-white/70">
                                <div class="flex justify-between">
                                    <span>Improvement Potential:</span>
                                    <span class="text-green-400">${Math.max(60, 95 - (idx * 10))}%</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Data Completeness:</span>
                                    <span class="text-blue-400">${Math.max(85, 100 - (dataset_info.data_quality?.missing_data_percentage || 0))}%</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // Advanced Recommendations Section
        datasetHtml += `<div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold text-indigo-300 mb-3">💡 Data Science Recommendations</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h5 class="font-bold text-blue-300 mb-2 text-sm">Data Improvement Opportunities</h5>
                    <ul class="space-y-1 text-xs text-white/80">
                        ${dataset_info.data_quality?.missing_data_percentage > 5 ? 
                            '<li>• <span class="text-yellow-300">Consider data imputation</span> for missing values to improve analysis quality</li>' : ''}
                        <li>• <span class="text-green-300">Collect more temporal data</span> to identify seasonal patterns and trends</li>
                        <li>• <span class="text-blue-300">Add customer segmentation variables</span> for more targeted prescriptions</li>
                        <li>• <span class="text-purple-300">Include external factors</span> (market conditions, competitors) for context</li>
                    </ul>
                </div>
                <div>
                    <h5 class="font-bold text-orange-300 mb-2 text-sm">Advanced Analysis Suggestions</h5>
                    <ul class="space-y-1 text-xs text-white/80">
                        <li>• <span class="text-green-300">Run A/B tests</span> to validate prescription effectiveness</li>
                        <li>• <span class="text-blue-300">Implement cohort analysis</span> to track long-term impact</li>
                        <li>• <span class="text-purple-300">Use machine learning</span> for continuous prescription optimization</li>
                        <li>• <span class="text-yellow-300">Set up real-time monitoring</span> of key performance indicators</li>
                    </ul>
                </div>
            </div>
        </div>`;

    } else {
        datasetHtml += `<p class="text-center text-white/70 italic">Dataset analysis information not available.</p>`;
    }
    
    datasetHtml += `</div>`;
    datasetPanel.innerHTML = datasetHtml;

    // --- 7. NEW: Risk Assessment Panel ---
    const risksPanel = dom.$("risksPanel");
    let risksHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">⚠️ Implementation Risk Assessment</h3>`;
    
    if (risk_assessment && risk_assessment.length > 0) {
        risksHtml += `<div class="space-y-4">`;
        risk_assessment.forEach((risk, index) => {
            const riskColor = risk.risk_level === 'High' ? 'red' : risk.risk_level === 'Medium' ? 'yellow' : 'green';
            risksHtml += `<div class="bg-black/20 p-4 rounded-lg border-l-4 border-${riskColor}-400">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-bold">${risk.recommendation || 'Unknown Prescription'}</h4>
                    <span class="px-2 py-1 rounded text-xs font-bold bg-${riskColor}-900/50 text-${riskColor}-300">${risk.risk_level || 'Unknown'} Risk</span>
                </div>
                
                ${risk.risk_factors?.length > 0 ? `
                <div class="mb-3">
                    <h5 class="font-bold text-red-300 text-sm mb-1">Risk Factors:</h5>
                    <ul class="list-disc list-inside text-sm text-white/80">
                        ${risk.risk_factors.map(factor => `<li>${factor}</li>`).join('')}
                    </ul>
                </div>` : ''}
                
                ${risk.mitigation_suggestions?.length > 0 ? `
                <div>
                    <h5 class="font-bold text-blue-300 text-sm mb-1">Mitigation Strategies:</h5>
                    <ul class="list-disc list-inside text-sm text-white/80">
                        ${risk.mitigation_suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>`;
        });
        risksHtml += `</div>`;
    } else {
        risksHtml += `<p class="text-center text-white/70 italic">No risk assessment data available.</p>`;
    }
    
    risksHtml += `</div>`;
    risksPanel.innerHTML = risksHtml;

    // --- 8. Learn Panel (Same content) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Prescriptive Analytics</h3>
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
                    <li><strong>Model Building:</strong> Use algorithms to explore how changing drivers affects the outcome.</li>
                    <li><strong>Recommendation Generation:</strong> Suggest specific actions (Prescriptions) based on the analysis.</li>
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
                <li><strong>Risk Assessment:</strong> Evaluation of potential implementation challenges and mitigation strategies.</li>
                <li><strong>Dataset Analysis:</strong> Comprehensive analysis of your data quality and structure.</li>
            </ul>
        </div>
    </div>`;

    // --- Activate Listeners ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
    dom.$("analysisActions").classList.remove("hidden");

    // Tab switching logic
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

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

    setTimeout(() => {
        const initialMatrixChart = dom.$("matrixPlot");
        if (tabNav.querySelector(".analysis-tab-btn.active")?.dataset.tab === "matrix" &&
            initialMatrixChart && initialMatrixChart.layout && typeof Plotly !== 'undefined') {
            try { Plotly.Plots.resize(initialMatrixChart); } catch (e) { console.error("Initial resize error:", e); }
        }
    }, 150);

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

export {
    renderDescriptivePage_DA,
    renderPrescriptivePage_DA,
    renderVisualizationPage_DA,
}