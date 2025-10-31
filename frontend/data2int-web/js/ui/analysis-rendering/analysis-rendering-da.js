// =====================================================================================================
// ===================            Data Analysis Page Rendering Functions            ====================
// =====================================================================================================

function renderDescriptivePage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state
    const { summary, numerical_summary, categorical_summary, visualizations, business_insights } = data;

    // Basic validation
    if (!summary || !numerical_summary || !categorical_summary || !visualizations || !business_insights ) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Descriptive Analysis.</div>`;
        $("analysisActions").classList.add("hidden");
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
    const summaryPanel = $("summaryPanel");
        const fileName = $("descriptiveFile")?.files[0]?.name || "N/A"; // Get filename if available
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
    const statsPanel = $("statsPanel");
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
    const visualsPanel = $("visualsPanel");
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
        const chartContainer = $(`viz-chart-${index}`);
        const interpContainer = $(`viz-interp-${index}`);
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
    const insightsPanel = $("insightsPanel");
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
    const learnPanel = $("learnPanel");
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
    analysisCache[currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (ensure resizing happens)
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
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

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator AFTER rendering
}



function renderPredictiveAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Basic validation
    if (!data || !data.predictions || !data.data_summary || !data.model_performance || !data.insights) {
        console.error("Incomplete data passed to renderPredictiveAnalysisPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }

    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Added "Learn Forecast" tab
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📋 Summary & Performance</button>
        <button class="analysis-tab-btn" data-tab="chart">📈 Forecast Chart</button>
        <button class="analysis-tab-btn" data-tab="insights">💡 Key Insights</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Forecast</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added panel for "Learn Forecast"
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active"></div>
        <div id="chartPanel" class="analysis-tab-panel"></div>
        <div id="insightsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- Render Summary & Performance Tab (Updated) ---
    const summaryPanel = $("summaryPanel");
    const summary = data.data_summary;
    const performance = data.model_performance;
    summaryPanel.innerHTML = `
    <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-2xl font-bold mb-4">Historical Data Summary</h3>
                <div class="grid grid-cols-2 gap-4 text-center">
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70">Mean</p><p class="text-xl font-bold">${summary.mean?.toFixed(2) ?? 'N/A'}</p></div>
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70">Median</p><p class="text-xl font-bold">${summary.median?.toFixed(2) ?? 'N/A'}</p></div>
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70">Min Value</p><p class="text-xl font-bold">${summary.min?.toFixed(2) ?? 'N/A'}</p></div>
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70">Max Value</p><p class="text-xl font-bold">${summary.max?.toFixed(2) ?? 'N/A'}</p></div>
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70">Std. Deviation</p><p class="text-xl font-bold">${summary.std_dev?.toFixed(2) ?? 'N/A'}</p></div>
                    <div class="bg-white/5 p-3 rounded-lg"><p class="text-sm text-white/70" title="Coefficient of Variation (Std Dev / Mean * 100)">Volatility (CV)</p><p class="text-xl font-bold">${summary.coeff_variation?.toFixed(1) ?? 'N/A'}%</p></div>
                </div>
            </div>
            <div>
                <h3 class="text-2xl font-bold mb-4">Simulated Model Performance</h3>
                 <div class="bg-white/5 p-4 rounded-lg">
                    <ul class="list-disc list-inside space-y-3 text-white/80 text-sm">
                        <li><strong>Model Used:</strong> ${performance.model_used ?? 'N/A'}</li>
                        <li><strong>R-squared (R²):</strong> ${performance.r_squared?.toFixed(3) ?? 'N/A'}</li>
                        <li><strong>MAPE:</strong> ${performance.mape?.toFixed(2) ?? 'N/A'}%</li>
                        <li><strong>MAE:</strong> ${performance.mae?.toFixed(2) ?? 'N/A'}</li>
                        <li><strong>RMSE:</strong> ${performance.rmse?.toFixed(2) ?? 'N/A'}</li>
                    </ul>
                    <blockquote class="mt-4 p-3 text-xs italic border-l-2 border-indigo-400 bg-black/20 text-white/70">${performance.interpretation ?? 'Model performance interpretation unavailable.'}</blockquote>
                </div>
            </div>
        </div>
        <div class="mt-8">
            <h3 class="text-2xl font-bold mb-4">Detailed Forecast</h3>
            <div class="overflow-x-auto max-h-96">
                 <table class="w-full text-left styled-table forecast-table text-sm">
                     <thead class="sticky top-0 bg-gray-800/80 backdrop-blur-sm"><tr><th>Period</th><th>Predicted Value</th><th>Lower Bound (Est. 95%)</th><th>Upper Bound (Est. 95%)</th></tr></thead>
                     <tbody>
                        ${data.predictions?.map(p => `<tr>
                            <td>${p.period ?? 'N/A'}</td>
                            <td><strong>${p.predicted_value?.toFixed(2) ?? 'N/A'}</strong></td>
                            <td>${p.lower_bound?.toFixed(2) ?? 'N/A'}</td>
                            <td>${p.upper_bound?.toFixed(2) ?? 'N/A'}</td>
                        </tr>`).join("") ?? '<tr><td colspan="4" class="text-center text-white/60">No prediction data available.</td></tr>'}
                     </tbody>
                 </table>
            </div>
        </div>
    </div>
    `;

    // --- Render Forecast Chart Tab (No changes needed here) ---
    const chartPanel = $("chartPanel");
    chartPanel.innerHTML = `<div class="p-4"><div id="forecastChart" class="w-full h-[500px] plotly-chart"></div></div>`;
    if (data.predictions && data.predictions.length > 0) {
        try {
            const trace1 = {
                x: data.predictions.map(p => p.period),
                y: data.predictions.map(p => p.predicted_value),
                type: 'scatter', mode: 'lines', name: 'Forecast',
                line: { color: 'var(--accent)', width: 3 }
            };
            const trace2 = {
                x: data.predictions.map(p => p.period),
                y: data.predictions.map(p => p.upper_bound),
                type: 'scatter', mode: 'lines', name: 'Upper Bound',
                line: { dash: 'dot', color: 'rgba(255,255,255,0.4)', width: 1 },
                fill: 'none'
            };
            const trace3 = {
                x: data.predictions.map(p => p.period),
                y: data.predictions.map(p => p.lower_bound),
                type: 'scatter', mode: 'lines', name: 'Lower Bound',
                line: { dash: 'dot', color: 'rgba(255,255,255,0.4)', width: 1 },
                fill: 'tonexty', // Fill area between trace3 (Lower) and trace2 (Upper)
                fillcolor: 'rgba(142, 45, 226, 0.15)' // Semi-transparent fill
            };

            Plotly.newPlot('forecastChart', [trace3, trace2, trace1], {
                title: 'Predictive Forecast with Confidence Interval',
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                yaxis: { title: 'Predicted Value', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
                xaxis: { title: 'Period', gridcolor: 'rgba(255,255,255,0.1)' },
                legend: { orientation: 'h', y: -0.2 }
            }, { responsive: true });
        } catch (e) {
            console.error("Error rendering Plotly chart:", e);
            chartPanel.innerHTML = `<div class="p-4 text-center text-red-400">Could not render forecast chart.</div>`;
        }
    } else {
        chartPanel.innerHTML = `<div class="p-4 text-center text-white/60">Not enough data to generate chart.</div>`;
    }


    // --- Render Insights Tab (Updated for new object structure) ---
    const insightsPanel = $("insightsPanel");
     let insightsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💡 Key Insights & Observations</h3>`;
     if (data.insights && data.insights.length > 0 && typeof data.insights[0] === 'object') {
         insightsHtml += `<div class="space-y-6">`;
         data.insights.forEach((i, index) => {
             insightsHtml += `
             <div class="insight-card border-l-4 border-indigo-400">
                  <p class="text-xs font-semibold text-indigo-300 mb-1">OBSERVATION ${index + 1}</p>
                 <p class="mb-2"><strong>${i.observation ?? 'N/A'}</strong></p>
                 <p class="mb-2 text-sm text-white/80"><strong>Interpretation:</strong> ${i.accurate_interpretation ?? 'N/A'}</p>
                 <div class="p-3 bg-black/20 rounded mt-3">
                     <p class="text-sm"><strong>Business Implication:</strong> ${i.business_implication ?? 'N/A'}</p>
                 </div>
              </div>`;
         });
         insightsHtml += `</div>`;
     } else {
         insightsHtml += `<p class="text-center text-white/70 italic">No specific insights were generated or they are in an unexpected format.</p>`;
     }
     insightsHtml += `</div>`;
    insightsPanel.innerHTML = insightsHtml;

    // --- Render Learn Forecast Tab (New Content) ---
    const learnPanel = $("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Time-Series Forecasting</h3>

        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Time-Series Forecasting?</h4>
            <p class="text-sm text-white/80">Time-series forecasting involves analyzing historical data points collected over time (like daily sales, monthly website visits) to predict future values. The core idea is that past patterns can help us anticipate what might happen next.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Components Analyzed:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Trend:</strong> The long-term increase or decrease in the data.</li>
                    <li><strong>Seasonality:</strong> Patterns that repeat over a fixed period (e.g., daily, weekly, yearly).</li>
                    <li><strong>Cycles:</strong> Longer-term fluctuations not of a fixed period (e.g., economic cycles).</li>
                    <li><strong>Irregularity (Noise):</strong> Random, unpredictable variations.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Models Used Here:</h4>
                 <p class="text-sm mb-2"><strong>Prophet:</strong> Developed by Facebook, excels with business data having strong seasonality (daily, weekly, yearly) and holiday effects. Handles missing data and outliers well. Generally user-friendly.</p>
                 <p class="text-sm"><strong>ARIMA:</strong> (Autoregressive Integrated Moving Average) A classic statistical model. Powerful for data with clear trends and dependencies between observations. Requires more careful parameter tuning.</p>
            </div>
        </div>

        <div class="bg-black/20 p-4 rounded-lg">
             <h4 class="text-lg font-bold mb-2 text-indigo-300">Data Requirements:</h4>
             <ul class="list-disc list-inside space-y-1 text-sm text-white/80">
                <li><strong>Time Column:</strong> A clear column indicating the date or timestamp for each observation (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY HH:MM'). Consistent format is key.</li>
                <li><strong>Value Column:</strong> The numerical metric you want to forecast (e.g., 'Sales', 'Users', 'Temperature').</li>
                <li><strong>Sufficient History:</strong> Generally, the more historical data, the better. At least 1-2 full cycles of seasonality (e.g., 1-2 years for yearly patterns) is recommended for good results.</li>
             </ul>
        </div>

        <details class="styled-details text-sm">
            <summary class="font-semibold">How to Interpret Results</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                <p><strong>Forecast Line:</strong> The model's best prediction of future values.</p>
                <p><strong>Confidence Interval (Shaded Area / Upper & Lower Bounds):</strong> Represents the uncertainty. A wider band means less certainty. Actual values are likely (e.g., 95% probability) to fall within this range.</p>
                <p><strong>Performance Metrics (R², MAPE etc.):</strong> Indicate how well the model fit the *historical* data. High R² (closer to 1) and low MAPE/MAE/RMSE suggest a good historical fit, but don't guarantee future accuracy.</p>
                <p><strong>Insights:</strong> Help understand patterns in the historical data (like skewness or volatility) which can inform business decisions beyond just the forecast numbers.</p>
                <p><strong>⚠️ Caution:</strong> Forecasts are predictions, not guarantees. Unexpected events ('black swans') can significantly alter future outcomes. Use forecasts as one input for planning, not as absolute truth.</p>
            </div>
        </details>
    </div>
    `;

    // --- Activate Listeners ---
    analysisCache[currentTemplateId] = container.innerHTML; // Cache the result HTML
    $("analysisActions").classList.remove("hidden"); // Show save buttons

    // Re-attach tab switching logic, including chart resizing
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all tabs and panels
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate the clicked tab and corresponding panel
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // If the activated panel is the chart panel, resize the chart
                if (e.target.dataset.tab === "chart") {
                     const chartDiv = $("forecastChart");
                     // Check if Plotly chart exists before resizing
                     if (chartDiv && chartDiv.layout && typeof Plotly !== 'undefined') {
                         try {
                             Plotly.Plots.resize(chartDiv);
                             console.log("Resized forecast chart.");
                         } catch (resizeError) {
                              console.error("Error resizing Plotly chart:", resizeError);
                         }
                     }
                }
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

     // Attempt initial resize after a short delay for Plotly to potentially render
     setTimeout(() => {
         const initialChartDiv = $("forecastChart");
         if (initialChartDiv && initialChartDiv.layout && typeof Plotly !== 'undefined') {
             try {
                  Plotly.Plots.resize(initialChartDiv);
                  console.log("Initial resize of forecast chart attempted.");
             } catch (initialResizeError) {
                  console.error("Error during initial resize:", initialResizeError);
             }
         }
     }, 150); // Delay slightly longer

    // Ensure loading indicator is stopped
    setLoading("generate", false);
}



function renderPrescriptivePage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state

     // Basic validation
    if (!data || !data.main_goal || !data.data_insights || !data.prescriptions || !Array.isArray(data.data_insights) || !Array.isArray(data.prescriptions)) {
         console.error("Incomplete data passed to renderPrescriptivePage_DA:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
         $("analysisActions").classList.add("hidden");
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
    const dashboardPanel = $("dashboardPanel");
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
    const prescriptionsPanel = $("prescriptionsPanel");
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
    const insightsPanel = $("insightsPanel");
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
    const matrixPanel = $("matrixPanel");
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
    const kpisPanel = $("kpisPanel");
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
    const learnPanel = $("learnPanel");
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
    analysisCache[currentTemplateId] = container.innerHTML; // Cache the result HTML
    $("analysisActions").classList.remove("hidden"); // Show save buttons

    // Re-attach tab switching logic, including chart resizing
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // Resize chart if matrix tab is activated
                if (e.target.dataset.tab === "matrix") {
                    const chartDiv = $("matrixPlot");
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
         const initialMatrixChart = $("matrixPlot");
         // Check if the initial active tab IS the matrix tab before resizing
         if (tabNav.querySelector(".analysis-tab-btn.active")?.dataset.tab === "matrix" &&
             initialMatrixChart && initialMatrixChart.layout && typeof Plotly !== 'undefined') {
             try { Plotly.Plots.resize(initialMatrixChart); } catch (e) { console.error("Initial resize error:", e); }
         }
     }, 150);

    // Ensure loading indicator is stopped
    setLoading("generate", false);
}



function renderVisualizationPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading state

     // Basic validation
     if (!data || !data.chart_selection_rationale || !data.visualizations || !Array.isArray(data.visualizations) || data.visualizations.length === 0) {
         console.error("Incomplete data passed to renderVisualizationPage_DA:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render visualizations.</div>`;
         $("analysisActions").classList.add("hidden");
         return;
     }

    const { chart_selection_rationale, visualizations } = data;


    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Add "Learn Visualization" tab
    let tabButtonsHtml = `<button class="analysis-tab-btn active" data-tab="rationale">🧠 Rationale</button>`;
    visualizations.forEach((viz, index) => {
        // Use a generic name if title is missing, but log a warning
        let buttonTitle = viz.title || `Chart ${index + 1}`;
        if (!viz.title) console.warn(`Visualization ${index} is missing a title.`);
        // Truncate long titles for buttons
        if (buttonTitle.length > 25) buttonTitle = buttonTitle.substring(0, 22) + "...";
        tabButtonsHtml += `<button class="analysis-tab-btn" data-tab="viz-${index}">📊 ${buttonTitle}</button>`;
    });
    tabButtonsHtml += `<button class="analysis-tab-btn" data-tab="learn">🎓 Learn Viz</button>`;
    tabNav.innerHTML = tabButtonsHtml;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    let tabPanelsHtml = `<div id="rationalePanel" class="analysis-tab-panel active"></div>`;
    visualizations.forEach((viz, index) => {
        tabPanelsHtml += `<div id="viz-${index}Panel" class="analysis-tab-panel"></div>`;
    });
    // Add "Learn Visualization" panel
    tabPanelsHtml += `<div id="learnPanel" class="analysis-tab-panel"></div>`;
    tabContent.innerHTML = tabPanelsHtml;

    // --- 1. Populate Rationale Panel ---
    const rationalePanel = $("rationalePanel");
    rationalePanel.innerHTML = `
        <div class="p-6">
            <h3 class="text-2xl font-bold mb-4 text-center">Chart Selection Rationale</h3>
            <blockquote class="p-4 italic border-l-4 border-indigo-400 bg-black/20 text-white/90 max-w-3xl mx-auto">
                ${chart_selection_rationale}
            </blockquote>
            <p class="text-sm text-center text-white/60 mt-4">The following tabs contain the visualizations generated based on this reasoning.</p>
        </div>
    `;

    // --- 2. Populate Individual Visualization Panels ---
    visualizations.forEach((viz, index) => {
        const panel = $(`viz-${index}Panel`);
        if (!panel) {
            console.error(`Could not find panel for viz-${index}`);
            return; // Skip if panel doesn't exist
        }

        let panelHtml = `<div class="p-4">
                    <h3 class="text-2xl font-bold mb-4 text-center">${viz.title || `Visualization ${index + 1}`}</h3>
                    <div id="viz-chart-${index}" class="w-full min-h-[500px] plotly-chart mb-6 bg-black/10 rounded-lg flex items-center justify-center"><span class="text-white/50 italic">Rendering chart...</span></div>
                    <div class="viz-interpretation-box">
                        <h4 class="text-xl font-bold mb-2">Interpretation</h4>
                        <p class="text-white/80 mb-4 text-sm">${viz.interpretation ?? "No interpretation provided."}</p>
                        <h4 class="text-xl font-bold mb-2 text-indigo-300">💡 Actionable Insight</h4>
                        <p class="text-white/90 text-sm">${viz.actionable_insight ?? "No actionable insight provided."}</p>
                    </div>
                </div>`;
        panel.innerHTML = panelHtml;

        const chartContainer = $(`viz-chart-${index}`);
        if (!chartContainer) {
             console.error(`Chart container viz-chart-${index} not found after setting innerHTML.`);
             return; // Skip if container isn't found
        }

        // --- Render Plotly Chart ---
        try {
            // Basic validation of trace and layout
            if (!viz.plotly_trace || typeof viz.plotly_trace !== 'object' || !viz.plotly_layout || typeof viz.plotly_layout !== 'object') {
                throw new Error("Missing or invalid Plotly trace/layout object.");
            }

            // Ensure trace is an array
            const traces = Array.isArray(viz.plotly_trace) ? viz.plotly_trace : [viz.plotly_trace];

            // Define standard layout properties for consistency
            const layoutDefaults = {
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: { color: "white" },
                xaxis: { gridcolor: "rgba(255,255,255,0.1)", zeroline: false, automargin: true },
                yaxis: { gridcolor: "rgba(255,255,255,0.1)", zeroline: false, automargin: true },
                legend: { font: { color: "white" } },
                margin: { t: 50, b: 50, l: 60, r: 30 } // Adjusted margins
            };

            // Merge AI layout with defaults, AI takes precedence
            const finalLayout = { ...layoutDefaults, ...viz.plotly_layout };
            // Ensure titles are properly handled if provided by AI
            finalLayout.title = viz.plotly_layout.title || viz.title || `Chart ${index + 1}`; // Use AI title if available

            Plotly.newPlot(chartContainer, traces, finalLayout, { responsive: true });

        } catch (chartError) {
            console.error(`Error rendering chart ${index} (${viz.title}):`, chartError, "Trace:", viz.plotly_trace, "Layout:", viz.plotly_layout);
            chartContainer.innerHTML = `<div class="p-4 text-center text-red-400">Could not render chart. Error: ${chartError.message}. Check console for details.</div>`;
        }
    });


    // --- 3. Populate Learn Visualization Tab ---
    const learnPanel = $("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Data Visualization</h3>
         [Image of various chart types]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">Why Visualize Data?</h4>
            <p class="text-sm text-white/80">Our brains process visual information much faster than text or tables. Good visualizations help us:</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-white/80 mt-2">
                <li>Identify trends and patterns quickly.</li>
                <li>Spot outliers and anomalies easily.</li>
                <li>Understand complex relationships between variables.</li>
                <li>Communicate insights effectively to others.</li>
                <li>Make more informed, data-driven decisions.</li>
            </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Common Chart Types & Uses:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Line Chart:</strong> Show trends over time.</li>
                    <li><strong>Bar Chart:</strong> Compare quantities across categories.</li>
                    <li><strong>Pie/Donut Chart:</strong> Show parts of a whole (use sparingly, < 6 categories).</li>
                    <li><strong>Scatter Plot:</strong> Show relationship between two numerical variables.</li>
                    <li><strong>Histogram:</strong> Show distribution of a single numerical variable.</li>
                    <li><strong>Box Plot:</strong> Show distribution summary (median, quartiles, outliers).</li>
                    <li><strong>Heatmap:</strong> Show intensity/correlation in a matrix.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Choosing the Right Chart:</h4>
                 <p class="text-sm mb-2">Think about what you want to show:</p>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Comparison:</strong> Bar chart, Grouped bar chart.</li>
                    <li><strong>Trend/Time:</strong> Line chart, Area chart.</li>
                    <li><strong>Relationship:</strong> Scatter plot, Bubble chart.</li>
                    <li><strong>Distribution:</strong> Histogram, Box plot, Density plot.</li>
                    <li><strong>Composition:</strong> Pie chart, Stacked bar chart, Treemap.</li>
                 </ul>
                 <p class="text-xs text-white/60 mt-2 italic">This tool attempts to select appropriate charts based on your request and data.</p>
            </div>
        </div>

        <details class="styled-details text-sm">
            <summary class="font-semibold">Tips for Effective Visualization</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                <p><strong>Keep it Simple:</strong> Avoid clutter ("chart junk"). Focus on clarity.</p>
                <p><strong>Use Color Purposefully:</strong> Highlight key data, ensure contrast, consider color blindness.</p>
                <p><strong>Label Clearly:</strong> Use informative titles, axis labels, and legends. Add units where needed.</p>
                <p><strong>Provide Context:</strong> Explain what the chart shows and why it's important (like the 'Interpretation' and 'Insight' sections here).</p>
                <p><strong>Choose Appropriate Scale:</strong> Start axes at zero for bar charts showing magnitude. Use log scales if needed for wide ranges.</p>
                <p><strong>Tell a Story:</strong> Arrange multiple charts logically to guide the viewer through your analysis.</p>
            </div>
        </details>
    </div>
    `;

    // --- Final Touches ---
    analysisCache[currentTemplateId] = container.innerHTML; // Cache the result HTML
    $("analysisActions").classList.remove("hidden"); // Show save buttons

    // Re-attach tab switching logic, including chart resizing
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // Resize charts within the newly active panel
                const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                chartsInPanel.forEach(chartDiv => {
                    // Check if it's a Plotly chart that has been rendered
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
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

     // Attempt initial resize for charts in the default active tab (rationale)
     // Since the rationale tab has no charts, we don't need initial resize here.
     // Resizing will happen automatically when a chart tab is clicked.

    // Ensure loading indicator is stopped
    setLoading("generate", false);
}



function renderRegressionPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading

     // Basic Validation
     if (!data || !data.model_summary || !data.coefficients || !data.residuals_analysis || !data.business_recommendations) {
         console.error("Incomplete data passed to renderRegressionPage_DA:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
         $("analysisActions").classList.add("hidden");
         return;
     }

    const { model_summary, variable_importance, coefficients, residuals_analysis, business_recommendations } = data; // Use new key 'residuals_analysis'

    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Added "Learn Regression" tab
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="fit">⚙️ Model Fit & Diagnostics</button>
        ${(variable_importance && variable_importance.length > 0) ? '<button class="analysis-tab-btn" data-tab="importance">🔑 Variable Importance</button>' : ''}
        <button class="analysis-tab-btn" data-tab="coeffs">🔢 Coefficient Details</button>
        <button class="analysis-tab-btn" data-tab="rec">💡 Recommendations</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Regression</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added "learnPanel" and conditional "importancePanel"
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="fitPanel" class="analysis-tab-panel"></div>
        ${(variable_importance && variable_importance.length > 0) ? '<div id="importancePanel" class="analysis-tab-panel"></div>' : ''}
        <div id="coeffsPanel" class="analysis-tab-panel"></div>
        <div id="recPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Dashboard Panel (Updated interpretation source) ---
    const dashboardPanel = $("dashboardPanel");
    let dashboardHtml = `<div class="p-4">
                <h3 class="text-2xl font-bold mb-4 text-center">Regression Dashboard</h3>
                <div class="cascade-objective mb-6 text-center mx-auto max-w-4xl"><h4 class="text-lg font-bold text-indigo-300">Regression Equation</h4><p class="text-xl font-semibold break-words">${model_summary.regression_equation ?? 'N/A'}</p></div>
                <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 mb-8 max-w-4xl mx-auto">${model_summary.interpretation ?? 'Model summary interpretation unavailable.'}</blockquote>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
                    <div class="kpi-card"><p class="kpi-name" title="Proportion of variance explained by the model">R-Squared</p><p class="kpi-target">${model_summary.r_squared?.toFixed(3) ?? 'N/A'}</p></div>
                    <div class="kpi-card"><p class="kpi-name" title="R-Squared adjusted for number of predictors">Adj. R-Squared</p><p class="kpi-target">${model_summary.adj_r_squared?.toFixed(3) ?? 'N/A'}</p></div>
                </div>
            </div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Model Fit & Diagnostics Panel (Updated interpretation source) ---
    const fitPanel = $("fitPanel");
    let fitHtml = `<div class="p-4">
                <h3 class="text-2xl font-bold mb-6 text-center">Model Fit & Diagnostics</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                    <div class="diagnostic-card" title="Tests if the overall model is statistically significant"><div class="stat-value">${model_summary.f_statistic?.toFixed(2) ?? 'N/A'}</div><div class="stat-label">F-Statistic</div></div>
                    <div class="diagnostic-card" title="P-value for the F-Statistic (low value indicates overall model significance)"><div class="stat-value">${model_summary.prob_f_statistic?.toFixed(3) ?? 'N/A'}</div><div class="stat-label">Prob (F-Statistic)</div></div>
                </div>
                <h4 class="text-xl font-bold mb-2 text-center">Residuals Analysis</h4>
                <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 mb-8 max-w-4xl mx-auto">${residuals_analysis.interpretation ?? 'Residual analysis interpretation unavailable.'}</blockquote>
                <div id="residualsPlot" class="w-full h-[500px] plotly-chart bg-black/10 rounded-lg"></div>
            </div>`;
    fitPanel.innerHTML = fitHtml;

     // Render Residuals Plot
     if (residuals_analysis.predicted_vs_residuals && residuals_analysis.predicted_vs_residuals.length > 0) {
         try {
             const residualsTrace = {
                 x: residuals_analysis.predicted_vs_residuals.map(p => p.predicted),
                 y: residuals_analysis.predicted_vs_residuals.map(p => p.residual),
                 mode: 'markers', type: 'scatter', name: 'Residuals',
                 marker: { color: 'rgba(142, 45, 226, 0.6)', size: 8 } // Use theme color semi-transparent
             };
             const residualsLayout = {
                 title: 'Residuals vs. Predicted Values Plot',
                 paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                 xaxis: { title: 'Predicted Values', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
                 yaxis: { title: 'Residuals', zerolinecolor: 'var(--accent)', zerolinewidth: 2, gridcolor: 'rgba(255,255,255,0.1)' },
                 margin: { t: 50, b: 50, l: 60, r: 30 }
             };
             Plotly.newPlot('residualsPlot', [residualsTrace], residualsLayout, { responsive: true });
         } catch(e) {
             console.error("Error rendering residuals plot:", e);
             $("residualsPlot").innerHTML = `<div class="p-4 text-center text-red-400">Could not render residuals plot.</div>`;
         }
     } else {
         $("residualsPlot").innerHTML = `<div class="p-4 text-center text-white/60">Residual data points not available for plotting.</div>`;
     }


    // --- 3. Variable Importance Panel (Conditional, updated rationale source) ---
    if (variable_importance && variable_importance.length > 0) {
        const importancePanel = $("importancePanel");
        if (importancePanel) {
            let importanceHtml = `<div class="p-4">
                        <h3 class="text-2xl font-bold mb-4 text-center">Variable Importance</h3>
                        <div id="importancePlot" class="w-full h-[500px] plotly-chart bg-black/10 rounded-lg mb-8"></div>
                        <div class="space-y-4 max-w-3xl mx-auto">`;
             variable_importance.forEach(v => {
                 importanceHtml += `
                     <div class="bg-white/5 p-3 rounded-lg border-l-4 border-indigo-400">
                         <p class="font-bold">${v.variable ?? 'N/A'}</p>
                         <p class="text-sm text-white/80 italic"><strong>Rationale:</strong> ${v.rationale ?? 'Importance rationale not provided.'}</p>
                     </div>`;
             });
             importanceHtml += `</div></div>`;
             importancePanel.innerHTML = importanceHtml;

             // Render Importance Plot
             try {
                 const importanceData = [...variable_importance].sort((a, b) => (a.importance_score ?? 0) - (b.importance_score ?? 0)); // Sort ascending for horizontal bar
                 const importanceTrace = {
                     y: importanceData.map(v => v.variable), // Use y for horizontal bars
                     x: importanceData.map(v => v.importance_score ?? 0), // Use x for values
                     type: 'bar', orientation: 'h', // Set orientation to horizontal
                     marker: { color: 'var(--primary)' }
                 };
                 const importanceLayout = {
                     title: 'Relative Importance of Predictors',
                     paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                     yaxis: { automargin: true }, // Ensure labels fit
                     xaxis: { title: 'Importance Score', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
                     margin: { t: 50, b: 50, l: 150, r: 30 } // Increase left margin for labels
                 };
                 Plotly.newPlot('importancePlot', [importanceTrace], importanceLayout, { responsive: true });
             } catch(e) {
                  console.error("Error rendering importance plot:", e);
                  $("importancePlot").innerHTML = `<div class="p-4 text-center text-red-400">Could not render importance plot.</div>`;
             }
        }
    }

    // --- 4. Coefficient Details Panel (Updated significance source) ---
    const coeffsPanel = $("coeffsPanel");
    let coeffsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Coefficient Interpretation Details</h3><div class="space-y-4">`;
    coefficients.forEach((c) => {
        const isSignificant = (c.p_value != null && c.p_value <= 0.05); // Check p-value exists
         // Use significance field from AI if available, otherwise calculate
         const significanceText = c.significance ?? (isSignificant ? "Yes (p<0.05)" : "No (p>=0.05)");
         const borderColor = isSignificant ? "border-green-400" : "border-gray-500";
        coeffsHtml += `
            <div class="bg-white/5 p-4 rounded-lg border-l-4 ${borderColor}">
                <h4 class="text-lg font-bold">${c.variable ?? 'N/A'}</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-2 mb-3">
                    <p><strong>Coefficient:</strong> ${c.coefficient?.toFixed(4) ?? 'N/A'}</p>
                    <p><strong>Std. Error:</strong> ${c.std_error?.toFixed(4) ?? 'N/A'}</p>
                    <p class="${isSignificant ? "text-green-300 font-semibold" : "text-white/70"}"><strong>P-value:</strong> ${c.p_value?.toFixed(3) ?? 'N/A'}</p>
                    <p class="${isSignificant ? "text-green-300 font-semibold" : "text-white/70"}"><strong>Significant?:</strong> ${significanceText}</p>
                </div>
                <p class="text-sm text-white/80 italic"><strong>Interpretation:</strong> ${c.interpretation ?? 'N/A'}</p>
            </div>`;
    });
    coeffsHtml += `</div><p class="text-xs text-white/60 mt-4">* Significance based on p-value < 0.05 threshold.</p></div>`;
    coeffsPanel.innerHTML = coeffsHtml;

    // --- 5. Recommendations Panel (Updated insight link source) ---
    const recPanel = $("recPanel");
    let recHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💡 Actionable Recommendations</h3>`;
     if (business_recommendations.length > 0) {
         recHtml += `<div class="space-y-6">`;
         business_recommendations.forEach((rec, index) => {
             recHtml += `<div class="prescription-card">
                         <h4 class="text-xl font-bold">${index + 1}. ${rec.recommendation ?? 'N/A'}</h4>
                         <p class="rationale"><strong>Driven By:</strong> ${rec.insight_link ?? 'N/A'}</p>
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                             <div class="bg-black/20 p-3 rounded">
                                 <h5 class="font-bold text-indigo-300 mb-2">Action Items</h5>
                                 <ul class="list-disc list-inside space-y-1 text-white/90">${(rec.action_items || []).map(a => `<li>${a}</li>`).join("")}</ul>
                             </div>
                             <div class="bg-black/20 p-3 rounded">
                                 <h5 class="font-bold text-indigo-300 mb-2">Potential Risks</h5>
                                 <p class="text-white/90">${rec.potential_risks ?? 'N/A'}</p>
                                 <h5 class="font-bold text-indigo-300 mt-3 mb-2">KPIs to Track</h5>
                                 <p class="text-white/90 text-xs">${(rec.kpis_to_track || []).join(", ")}</p>
                             </div>
                         </div>
                     </div>`;
         });
         recHtml += `</div>`;
     } else {
         recHtml += `<p class="text-center text-white/70 italic">No specific business recommendations generated based on the model results.</p>`;
     }
     recHtml += `</div>`;
    recPanel.innerHTML = recHtml;


    // --- 6. Populate Learn Regression Tab ---
    const learnPanel = $("learnPanel");
     learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Regression Analysis</h3>
        [Image of scatter plot with regression line]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Regression Analysis?</h4>
            <p class="text-sm text-white/80">Regression is a statistical method used to model the relationship between a dependent variable (the outcome you want to predict or explain) and one or more independent variables (the factors believed to influence the outcome).</p>
             <p class="text-sm text-white/80 mt-2">Essentially, it tries to find the "best fit" line (or curve) through the data points to describe how changes in the independent variables are associated with changes in the dependent variable.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Concepts:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Dependent Variable (Y):</strong> The main variable you're interested in (e.g., Sales, Customer Score).</li>
                    <li><strong>Independent Variables (X):</strong> Predictor variables (e.g., Ad Spend, Website Visits, Temperature).</li>
                    <li><strong>Coefficients (β):</strong> Numbers representing the strength and direction of the relationship between each X and Y. A positive coefficient means X increases Y; negative means X decreases Y.</li>
                    <li><strong>Intercept (β₀):</strong> The predicted value of Y when all X variables are zero.</li>
                    <li><strong>R-squared (R²):</strong> Measures how well the model fits the data (0 to 1). A value of 0.7 means 70% of the variation in Y is explained by the X variables in the model.</li>
                     <li><strong>Adjusted R-squared:</strong> R-squared adjusted for the number of predictors in the model. More useful when comparing models with different numbers of variables.</li>
                    <li><strong>P-value:</strong> Indicates the statistical significance of a coefficient. A low p-value (typically < 0.05) suggests the variable likely has a real effect on Y.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Interpreting Results:</h4>
                 <p class="text-sm mb-2"><strong>Model Fit (R², F-stat P-value):</strong></p>
                 <ul class="list-[circle] list-inside pl-4 text-xs mb-3">
                    <li>High R² suggests a good fit *to the current data*.</li>
                    <li>Low Prob(F-stat) (<0.05) means the overall model is significant (better than random chance).</li>
                 </ul>
                 <p class="text-sm mb-2"><strong>Coefficients & P-values:</strong></p>
                  <ul class="list-[circle] list-inside pl-4 text-xs mb-3">
                    <li>Focus on coefficients with low P-values (<0.05). These represent significant relationships.</li>
                    <li>The coefficient's value tells you the magnitude and direction of the effect.</li>
                 </ul>
                  <p class="text-sm mb-2"><strong>Residuals Plot:</strong></p>
                   <ul class="list-[circle] list-inside pl-4 text-xs">
                    <li>Should show random scatter around zero.</li>
                    <li>Patterns (curves, funnels) indicate model assumption violations (like non-linearity or heteroscedasticity), meaning results might be unreliable.</li>
                 </ul>
            </div>
        </div>

        <details class="styled-details text-sm">
            <summary class="font-semibold">Important Assumptions & Cautions</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-3">
                <p>⚠️ <strong>Correlation is NOT Causation:</strong> Regression shows association, not necessarily that X *causes* Y.</p>
                <p> linearity <strong>Linearity:</strong> Assumes the relationship between X and Y is roughly linear (check residuals).</p>
                <p>🏠 <strong>Homoscedasticity:</strong> Assumes the variance of errors (residuals) is constant across all levels of X (check residuals for fanning).</p>
                <p>🚶 <strong>Independence:</strong> Assumes observations are independent of each other (important for time-series data).</p>
                 <p>🔔 <strong>Normality of Residuals:</strong> Assumes errors are normally distributed (less critical with large samples, but good to check).</p>
                <p>🗑️ <strong>Outliers:</strong> Extreme data points can heavily influence results.</p>
                <p> extrapolating <strong>Extrapolation:</strong> Avoid making predictions far outside the range of your original data.</p>
            </div>
        </details>
    </div>
    `;


    // --- Final Touches ---
    analysisCache[currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (including chart resizing)
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");

                // Resize any Plotly charts within the newly active panel
                const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                chartsInPanel.forEach(chartDiv => {
                    if (chartDiv.layout && typeof Plotly !== 'undefined') { // Check if it's a rendered Plotly chart
                        try {
                            Plotly.Plots.resize(chartDiv);
                             console.log(`Resized chart ${chartDiv.id} on tab switch.`);
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

     // Attempt initial resize for charts in the default active tab (dashboard has no charts, fit has one)
     setTimeout(() => {
         const activeTabButton = tabNav.querySelector(".analysis-tab-btn.active");
         if (activeTabButton && activeTabButton.dataset.tab === "fit") {
             const residualsChart = $("residualsPlot");
             if (residualsChart && residualsChart.layout && typeof Plotly !== 'undefined') {
                 try { Plotly.Plots.resize(residualsChart); } catch (e) { console.error("Initial resize error (residuals):", e); }
             }
         }
         // Add similar checks if other default tabs have charts
     }, 150);

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Already handled in the calling function's finally block
}



function renderPlsPage_DA(container, data) {
    container.innerHTML = ""; // Clear loading

    // Basic Validation
    if (!data || !data.model_evaluation || !data.path_coefficients || !data.reliability_validity || !data.business_recommendations || !data.userInput) {
        console.error("Incomplete data passed to renderPlsPage_DA:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
        $("analysisActions").classList.add("hidden");
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
    const diagramPanel = $("diagramPanel");
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
    const pathsPanel = $("pathsPanel");
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
    const reliabilityPanel = $("reliabilityPanel");
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
    const recPanel = $("recPanel");
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
    const learnPanel = $("learnPanel");
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
    analysisCache[currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            // Deactivate all
            tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

            // Activate clicked
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = $(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add("active");
                // No charts to resize in this specific PLS render function currently
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderDematelAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // *** Validation for NUMERICAL data ***
    if (!data || !data.factors || !data.total_influence_matrix || !data.influence_metrics || !data.analysis || !data.business_recommendations ||
        data.factors.length !== data.total_influence_matrix.length || data.factors.length !== data.influence_metrics.length ||
        (data.influence_metrics.length > 0 && (typeof data.influence_metrics[0].prominence !== 'number' || typeof data.influence_metrics[0].relation !== 'number'))) // Check for numbers
    {
        console.error("Inconsistent or incomplete NUMERICAL data passed to renderDematelAnalysisPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete or inconsistent NUMERICAL analysis data received. Cannot render DEMATEL results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }

    const { factors, total_influence_matrix, influence_metrics, analysis, business_recommendations } = data;

    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Adding back 'Influence Matrix' and adding 'Recommendations' + 'Learn'
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📋 Summary & Insights</button>
        <button class="analysis-tab-btn" data-tab="diagram">📊 Causal Diagram</button>
        <button class="analysis-tab-btn" data-tab="metrics">🔢 Influence Metrics</button>
        <button class="analysis-tab-btn" data-tab="matrix">▦ Total Influence Matrix</button>
        <button class="analysis-tab-btn" data-tab="rec">💡 Recommendations</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn DEMATEL</button>
    `;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Adding back matrix panel and adding rec + learn panels
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active"></div>
        <div id="diagramPanel" class="analysis-tab-panel"></div>
        <div id="metricsPanel" class="analysis-tab-panel"></div>
        <div id="matrixPanel" class="analysis-tab-panel"></div>
        <div id="recPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Render Summary Tab (Using NUMERICAL analysis data) ---
    const summaryPanel = $("summaryPanel");
    let summaryHtml = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-4">Analysis Summary</h3>
        <blockquote class="p-4 rounded-lg bg-black/20 border-l-4 border-gray-500 mb-6 text-white/90 italic text-sm">${analysis.summary || "Summary unavailable."}</blockquote>`;

    summaryHtml += `<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="bg-blue-900/20 p-4 rounded border border-blue-500/50">
            <h4 class="text-xl font-semibold mb-3 text-blue-300">Dispatchers (Cause Factors)</h4>
            <p class="text-xs text-white/70 mb-3">Factors with high positive Relation (R-C), strongly influencing others.</p>
            ${analysis.dispatchers?.length > 0
                ? analysis.dispatchers.map( d => `
                    <div class="mb-3 text-sm">
                        <p class="font-bold">${d.factor} (R-C: ${d.relation_value?.toFixed(3) ?? 'N/A'})</p>
                        <p class="text-white/70 text-xs italic">${d.reason}</p>
                    </div>`).join("")
                : '<p class="text-sm italic text-white/60">(None clearly identified)</p>'
            }
        </div>
        <div class="bg-red-900/20 p-4 rounded border border-red-500/50">
            <h4 class="text-xl font-semibold mb-3 text-red-300">Receivers (Effect Factors)</h4>
            <p class="text-xs text-white/70 mb-3">Factors with high negative Relation (R-C), primarily influenced by others.</p>
             ${analysis.receivers?.length > 0
                ? analysis.receivers.map( r => `
                    <div class="mb-3 text-sm">
                        <p class="font-bold">${r.factor} (R-C: ${r.relation_value?.toFixed(3) ?? 'N/A'})</p>
                        <p class="text-white/70 text-xs italic">${r.reason}</p>
                    </div>`).join("")
                : '<p class="text-sm italic text-white/60">(None clearly identified)</p>'
            }
        </div>
    </div>`;

    if (analysis.key_factor) {
        summaryHtml += `<div class="mt-8 bg-yellow-900/20 p-4 rounded border border-yellow-500/50">
            <h4 class="text-xl font-semibold mb-3 text-yellow-300">Most Central Factor</h4>
            <p class="font-bold">${analysis.key_factor.factor} (Prominence: ${analysis.key_factor.prominence_value?.toFixed(3) ?? 'N/A'})</p>
            <p class="text-sm text-white/70 text-xs italic">${analysis.key_factor.reason}</p>
        </div>`;
    }
    summaryHtml += `</div>`; // Close p-4 div
    summaryPanel.innerHTML = summaryHtml;


    // --- 2. Render Causal Diagram Tab (Plotly R+C vs R-C - Numerical) ---
    const diagramPanel = $("diagramPanel");
    diagramPanel.innerHTML = `<div class="p-4">
         <h3 class="text-2xl font-bold mb-4 text-center">DEMATEL Causal Diagram</h3>
         <blockquote class="p-3 italic border-l-4 border-gray-500 bg-black/20 text-white/90 text-sm mb-6 max-w-3xl mx-auto">
             Plotting Prominence (R+C) vs. Relation (R-C) visualizes factor importance and causal role. Factors in the top right are central causes.
         </blockquote>
        <div id="dematelDiagramPlot" class="w-full h-[600px] plotly-chart bg-black/10 rounded-lg"></div>
         <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-xs text-center">
             <div class="bg-blue-900/30 p-2 rounded border border-blue-500/50"><strong>Dispatchers (Causes):</strong> High positive R-C. Focus intervention here.</div>
             <div class="bg-red-900/30 p-2 rounded border border-red-500/50"><strong>Receivers (Effects):</strong> High negative R-C. Monitor impact here.</div>
             <div class="bg-yellow-900/30 p-2 rounded border border-yellow-500/50"><strong>Central Factor:</strong> Highest R+C (${analysis.key_factor?.factor || 'N/A'}). Most interconnected.</div>
        </div>
    </div>`;

    // Render Plotly Scatter Chart (using numerical R+C, R-C)
    try {
        const plotData = [{
            x: influence_metrics.map(m => m.prominence ?? 0), // R+C
            y: influence_metrics.map(m => m.relation ?? 0), // R-C
            text: influence_metrics.map(m => m.factor || 'N/A'),
            mode: 'markers+text',
            textposition: 'top right',
            marker: {
                size: 12,
                color: influence_metrics.map(m => m.relation ?? 0),
                colorscale: 'RdBu',
                colorbar: { title: 'Relation (R-C)<br>Cause -> Effect' }
            },
            type: 'scatter'
        }];

        const avgProminence = (influence_metrics.reduce((sum, m) => sum + (m.prominence ?? 0), 0)) / (influence_metrics.length || 1);
        const yRange = [Math.min(...plotData[0].y) - 0.1, Math.max(...plotData[0].y) + 0.1]; // Dynamic y-range

        const layoutDiagram = {
            title: 'DEMATEL Causal Diagram',
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
            xaxis: { title: 'Prominence (R+C) - Importance', gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
            yaxis: { title: 'Relation (R-C) - Net Causal Role', range: yRange, gridcolor: 'rgba(255,255,255,0.1)', zeroline: true, zerolinecolor: 'rgba(255,255,255,0.5)' },
             annotations: [
                { x: avgProminence, y: yRange[1], text: 'Dispatchers (Causes)', showarrow: false, xanchor: 'left', yanchor: 'top', font: {color: 'rgba(173, 216, 230, 0.7)'} },
                { x: avgProminence, y: yRange[0], text: 'Receivers (Effects)', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: {color: 'rgba(255, 182, 193, 0.7)'} }
             ],
            hovermode: 'closest',
            margin: { t: 50, b: 60, l: 60, r: 30 }
        };
        Plotly.newPlot('dematelDiagramPlot', plotData, layoutDiagram, { responsive: true });
    } catch(e) {
        console.error("Error creating DEMATEL Plotly chart:", e);
        $("dematelDiagramPlot").innerHTML = "<p class='p-4 text-center text-red-400'>Could not render causal diagram.</p>";
    }


    // --- 3. Render Influence Metrics Tab (Numerical) ---
    const metricsPanel = $("metricsPanel");
    let metricsHtml = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-4">Influence Metrics</h3>
         <p class="text-sm text-white/70 mb-6 italic">These metrics quantify the influence dispatched (R), received (C), total involvement (Prominence R+C), and net causal role (Relation R-C) for each factor.</p>
        <div class="overflow-x-auto mb-6">
            <table class="coeff-table styled-table text-sm">
                <thead><tr>
                    <th>Factor</th>
                    <th title="Total influence dispatched by this factor">Dispatch (R)</th>
                    <th title="Total influence received by this factor">Receive (C)</th>
                    <th title="Total involvement (importance)">Prominence (R+C)</th>
                    <th title="Net causal role (+ = Cause, - = Effect)">Relation (R-C)</th>
                </tr></thead>
                <tbody>`;
    // Sort by Prominence (numerical)
    influence_metrics.sort((a,b) => (b.prominence ?? 0) - (a.prominence ?? 0)).forEach(m => {
        let relationClass = '';
        const relationVal = m.relation ?? 0;
        if (relationVal > 0.01) relationClass = 'text-blue-300'; // Threshold for dispatcher color
        else if (relationVal < -0.01) relationClass = 'text-red-300'; // Threshold for receiver color

        metricsHtml += `<tr>
                        <td class="font-semibold">${m.factor || 'N/A'}</td>
                        <td>${m.r_sum?.toFixed(3) ?? 'N/A'}</td>
                        <td>${m.c_sum?.toFixed(3) ?? 'N/A'}</td>
                        <td>${m.prominence?.toFixed(3) ?? 'N/A'}</td>
                        <td class="${relationClass} font-medium">${m.relation?.toFixed(3) ?? 'N/A'}</td>
                    </tr>`;
    });
    metricsHtml += `</tbody></table></div>`;
    metricsHtml += `</div>`; // Close p-4 div
    metricsPanel.innerHTML = metricsHtml;


    // --- 4. Render Total Influence Matrix Tab (Heatmap - Numerical) ---
    const matrixPanel = $("matrixPanel");
    matrixPanel.innerHTML = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-4">Total Influence Matrix (T)</h3>
        <p class="text-sm text-white/70 mb-4 italic">Heatmap showing the total direct and indirect influence of the row factor ON the column factor. Brighter colors indicate stronger influence.</p>
        <div id="dematelMatrixHeatmap" class="w-full h-[600px] plotly-chart bg-black/10 rounded-lg"></div>
    </div>`;

    // Render Plotly Heatmap
    try {
        const heatmapTrace = {
            z: data.total_influence_matrix,
            x: data.factors,
            y: data.factors,
            type: 'heatmap',
            colorscale: 'Plasma', // Or 'Viridis', 'Jet', 'Portland'
            reversescale: false, // Adjust as needed
            hovertemplate: "Influencer (Row): %{y}<br>Influenced (Col): %{x}<br>Total Influence: %{z:.3f}<extra></extra>",
            text: data.total_influence_matrix.map(row => row.map(val => val.toFixed(2))),
            textfont: { color: "white", size: 9 }, // Smaller font size
            texttemplate: "%{text}",
            showscale: true,
            colorbar: { title: 'Total Influence', titleside: 'right' }
        };
        const layoutMatrix = {
            title: { text: 'Total Influence Matrix (T)', y: 0.98 },
            xaxis: { ticks: "", side: "top", automargin: true, tickangle: -45 },
            yaxis: { ticks: "", automargin: true },
            margin: { l: 150, t: 150, b: 50, r: 50 }, // Adjusted margins
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' }
        };
        Plotly.newPlot('dematelMatrixHeatmap', [heatmapTrace], layoutMatrix, { responsive: true });
    } catch (e) {
        console.error("Error creating DEMATEL Heatmap:", e);
        $("dematelMatrixHeatmap").innerHTML = "<p class='p-4 text-center text-red-400'>Could not render influence matrix heatmap.</p>";
    }

    // --- 5. Populate Recommendations Panel (using enhanced rationale) ---
    const recPanel = $("recPanel");
    let recHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💡 Actionable Recommendations</h3>`;
    if (business_recommendations && business_recommendations.length > 0) {
        recHtml += `<p class="text-sm text-white/70 mb-6 italic">These recommendations focus on leveraging the calculated causal structure (influencing Dispatchers, managing Receivers) to achieve strategic goals implied in the context.</p>`;
        recHtml += `<div class="space-y-6">`;
        business_recommendations.forEach((rec, index) => {
             // Determine if targeting dispatcher or receiver for styling based on NUMERICAL R-C
             let targetRole = "Neutral";
             const metric = influence_metrics.find(m => m.factor === rec.focus_factor);
             const relationVal = metric?.relation ?? 0;
             if (relationVal > 0.01) targetRole = "Dispatcher";
             else if (relationVal < -0.01) targetRole = "Receiver";

             let cardBorderClass = "border-gray-500";
             if (targetRole === "Dispatcher") cardBorderClass = "border-blue-500";
             else if (targetRole === "Receiver") cardBorderClass = "border-red-500";


            recHtml += `
                <div class="prescription-card border-l-4 ${cardBorderClass}">
                    <h4 class="text-xl font-bold">${index + 1}. ${rec.recommendation ?? 'N/A'}</h4>
                     <p class="text-xs font-semibold my-1 text-indigo-300">TARGET FACTOR: ${rec.focus_factor ?? 'N/A'} (${targetRole}, R-C: ${relationVal.toFixed(3)})</p>
                    <p class="rationale"><strong>Strategic Rationale:</strong> ${rec.rationale ?? 'N/A'}</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                        <div class="bg-black/20 p-3 rounded">
                            <h5 class="font-bold text-yellow-300 mb-2">Action Items</h5>
                            <ul class="list-disc list-inside space-y-1 text-white/90">${(rec.action_items || []).map(a => `<li>${a}</li>`).join("")}</ul>
                             ${!(rec.action_items && rec.action_items.length > 0) ? '<p class="text-white/60 italic text-xs">No specific action items defined.</p>' : ''}
                        </div>
                        <div class="bg-black/20 p-3 rounded">
                             <h5 class="font-bold text-yellow-300 mb-2">KPIs to Track</h5>
                            <ul class="list-disc list-inside space-y-1 text-white/90 text-xs">${(rec.kpis_to_track || []).map(k => `<li>${k}</li>`).join("")}</ul>
                             ${!(rec.kpis_to_track && rec.kpis_to_track.length > 0) ? '<p class="text-white/60 italic text-xs">No specific KPIs defined.</p>' : ''}
                        </div>
                    </div>
                </div>`;
        });
        recHtml += `</div>`;
    } else {
        recHtml += `<p class="text-center text-white/70 italic">No specific business recommendations generated based on the DEMATEL analysis.</p>`;
    }
    recHtml += `</div>`;
    recPanel.innerHTML = recHtml;


    // --- 6. Populate Learn DEMATEL Tab (Keep as is) ---
    const learnPanel = $("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding DEMATEL</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is DEMATEL?</h4>
            <p class="text-sm text-white/80">The Decision Making Trial and Evaluation Laboratory (DEMATEL) method is a structural modeling technique used to analyze the causal relationships among complex factors. It helps visualize the structure of intricate systems and identify the most influential elements.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Core Concepts:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Factors:</strong> The key elements or variables within the system being studied.</li>
                    <li><strong>Direct Influence:</strong> The immediate impact one factor has on another (often rated by experts).</li>
                    <li><strong>Total Influence (Matrix T):</strong> Captures both direct and indirect influences between all pairs of factors.</li>
                    <li><strong>Dispatch (R):</strong> The sum of influences a factor exerts on *all other* factors (Row Sum of T). High R = Influential Cause.</li>
                    <li><strong>Receive (C):</strong> The sum of influences a factor receives from *all other* factors (Column Sum of T). High C = Easily Influenced Effect.</li>
                    <li><strong>Prominence (R+C):</strong> The total involvement of a factor (sum of influences dispatched and received). High R+C = Central/Important.</li>
                    <li><strong>Relation (R-C):</strong> The net causal role. High positive R-C = Net Cause ("Dispatcher"). High negative R-C = Net Effect ("Receiver").</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Interpretation of Causal Roles:</h4>
                <p class="text-sm mb-2">Analysis typically categorizes factors based on Prominence (Importance) and Relation (Net Cause/Effect):</p>
                 <ul class="list-[circle] list-inside pl-4 text-xs mb-3 space-y-1">
                    <li><strong>Dispatchers (Causes):</strong> Have high positive Relation (R-C). These factors significantly influence others. Interventions targeting dispatchers tend to have widespread effects.</li>
                    <li><strong>Receivers (Effects):</strong> Have high negative Relation (R-C). These factors are primarily influenced by others. They are good indicators of system performance but less effective points for direct intervention.</li>
                    <li><strong>Central Factors:</strong> Have high Prominence (R+C). These are highly interconnected factors, playing a key role in the system's dynamics, whether as causes or effects.</li>
                 </ul>
                 <p class="text-sm mt-3"><strong>Strategic Focus:</strong> Identify the key Dispatchers to understand root causes and leverage points for change. Monitor Receivers to track the impact of interventions.</p>
            </div>
        </div>

        <details class="styled-details text-sm mt-4">
            <summary class="font-semibold">DEMATEL Steps (Simplified)</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p>1. Identify key factors.</p>
                <p>2. Create a Direct-Influence Matrix (Z) - often through expert surveys rating influence between pairs (e.g., 0-4 scale).</p>
                <p>3. Normalize the Direct-Influence Matrix (X).</p>
                <p>4. Calculate the Total-Influence Matrix (T = X * (I - X)^-1).</p>
                <p>5. Calculate R (row sums) and C (column sums) from T.</p>
                <p>6. Calculate Prominence (R+C) and Relation (R-C) for each factor.</p>
                <p>7. Analyze R+C and R-C to understand causal structure (e.g., using a causal diagram).</p>
                <p>8. Develop strategies based on dispatcher/receiver roles.</p>
            </div>
        </details>
    </div>
    `;


    // --- Final Touches ---
    analysisCache[currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (copied from your provided function)
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanel = $(e.target.dataset.tab + "Panel");
            targetPanel.classList.add("active");
            // Resize BOTH potential charts when switching tabs
            const diagramChart = targetPanel.querySelector('#dematelDiagramPlot');
            const matrixChart = targetPanel.querySelector('#dematelMatrixHeatmap');
            if (diagramChart && diagramChart.layout && typeof Plotly !== 'undefined') {
                try { Plotly.Plots.resize(diagramChart); } catch (err) { console.error("Resize err (Diagram):", err); }
            }
            if (matrixChart && matrixChart.layout && typeof Plotly !== 'undefined') {
                 try { Plotly.Plots.resize(matrixChart); } catch (err) { console.error("Resize err (Matrix):", err); }
            }
        }
    });

     // Attempt initial resize for chart in the default active tab (summaryPanel - no chart)
     // Attempt initial resize for charts in DIAGRAM and MATRIX tabs after a short delay
     setTimeout(() => {
         const initialDiagramChart = $('dematelDiagramPlot');
         const initialMatrixChart = $('dematelMatrixHeatmap');
         if (initialDiagramChart && initialDiagramChart.layout && typeof Plotly !== 'undefined') {
             try { Plotly.Plots.resize(initialDiagramChart); } catch (err) { console.error("Initial Resize err (Diagram):", err); }
         }
         if (initialMatrixChart && initialMatrixChart.layout && typeof Plotly !== 'undefined') {
             try { Plotly.Plots.resize(initialMatrixChart); } catch (err) { console.error("Initial Resize err (Matrix):", err); }
         }
     }, 150);


    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}  

export {
    renderDescriptivePage_DA,
    renderPredictiveAnalysisPage,
    renderPrescriptivePage_DA,
    renderVisualizationPage_DA,
    renderRegressionPage_DA,
    renderPlsPage_DA,
    renderDematelAnalysisPage
}