import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';

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
    renderDematelAnalysisPage
}
