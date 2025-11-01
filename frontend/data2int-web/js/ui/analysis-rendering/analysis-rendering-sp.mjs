// =====================================================================================================
// ===================         Strategic Planning Page Rendering Functions          ====================
// =====================================================================================================

import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';

// Modified renderFactorAnalysisPage to add Learn Tab
// NEW renderFactorAnalysisPage - Creates a detailed 6-tab view
function renderFactorAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Basic validation
    if (!data || !data.internal_factors || !data.external_factors) {
         console.error("Incomplete data passed to renderFactorAnalysisPage:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received.</div>`;
         dom.$("analysisActions").classList.add("hidden");
         return;
    }

    const { internal_factors, external_factors } = data;
    const allFactors = [
        ...(internal_factors.strengths || []),
        ...(internal_factors.weaknesses || []),
        ...(external_factors.opportunities || []),
        ...(external_factors.threats || [])
    ];

    // --- Create Tab Navigation (6 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="strengths">💪 Strengths</button>
        <button class="analysis-tab-btn" data-tab="weaknesses">⚠️ Weaknesses</button>
        <button class="analysis-tab-btn" data-tab="opportunities">✨ Opportunities</button>
        <button class="analysis-tab-btn" data-tab="threats">🛡️ Threats</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Factor Analysis</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (6 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="strengthsPanel" class="analysis-tab-panel"></div>
        <div id="weaknessesPanel" class="analysis-tab-panel"></div>
        <div id="opportunitiesPanel" class="analysis-tab-panel"></div>
        <div id="threatsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- Helper Function to Render a Detail Tab ---
    const renderFactorDetailTab = (panelId, factors, title, borderColorClass) => {
        const panel = dom.$(panelId);
        if (!panel) return;

        let html = `<div class="p-4 space-y-6"><h3 class="text-3xl font-bold mb-4 text-center">${title} (${factors.length})</h3>`;
        if (factors.length > 0) {
            // Sort by impact score, highest first
            factors.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));
            
            factors.forEach((factor, index) => {
                html += `
                    <div class="prescription-card ${borderColorClass}">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="text-xl font-bold">${index + 1}. ${factor.factor}</h4>
                            <span class="text-lg font-bold text-yellow-300" title="Impact Score">(${factor.impact_score}/10)</span>
                        </div>
                        <p class="text-xs font-semibold text-indigo-300 uppercase mb-2">Category: ${factor.category || 'N/A'}</p>
                        <p class="text-sm text-white/80 italic mb-3"><strong>Description:</strong> ${factor.description || 'N/A'}</p>
                        
                        <div class="rationale">
                            <strong>Deep Analysis:</strong> ${factor.deep_analysis || 'No deep analysis provided.'}
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-green-300 mb-2">Actionable Recommendation</h5>
                                <p class="text-white/90">${factor.actionable_recommendation || 'N/A'}</p>
                            </div>
                            <div class="bg-black/20 p-3 rounded">
                                <h5 class="font-bold text-green-300 mb-2">Relevant KPIs</h5>
                                <ul class="list-disc list-inside text-white/90">
                                    ${(factor.relevant_kpis && factor.relevant_kpis.length > 0) 
                                        ? factor.relevant_kpis.map(kpi => `<li>${kpi}</li>`).join('') 
                                        : '<li>N/A</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<p class="text-center text-white/70 italic">No factors identified for this category based on the provided text.</p>`;
        }
        html += `</div>`; // Close p-4
        panel.innerHTML = html;
    };
    
    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4">
                            <h3 class="text-2xl font-bold mb-6 text-center">Factor Analysis Dashboard</h3>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
                                <div class="summary-stat-card"><div class="stat-value text-green-400">${internal_factors.strengths.length}</div><div class="stat-label">Strengths</div></div>
                                <div class="summary-stat-card"><div class="stat-value text-red-400">${internal_factors.weaknesses.length}</div><div class="stat-label">Weaknesses</div></div>
                                <div class="summary-stat-card"><div class="stat-value text-blue-400">${external_factors.opportunities.length}</div><div class="stat-label">Opportunities</div></div>
                                <div class="summary-stat-card"><div class="stat-value text-yellow-400">${external_factors.threats.length}</div><div class="stat-label">Threats</div></div>
                            </div>`;
    
    // Find most critical factor
    const allSorted = allFactors.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));
    const criticalFactor = allSorted[0];

    if (criticalFactor) {
        dashboardHtml += `<div class="bg-black/20 p-6 rounded-lg max-w-3xl mx-auto border-l-4 border-red-500">
                            <h4 class="text-xl font-bold mb-3 text-center text-red-300">Most Critical Factor Identified (Highest Impact)</h4>
                            <p class="text-lg font-bold text-center">${criticalFactor.factor} (Impact: ${criticalFactor.impact_score}/10)</p>
                            <p class="text-sm text-center text-white/70 italic mb-3">${criticalFactor.description}</p>
                            <div class="rationale text-sm">
                                <strong>Deep Analysis:</strong> ${criticalFactor.deep_analysis || 'N/A'}
                            </div>
                         </div>`;
    }
    dashboardHtml += `</div>`; // Close p-4
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Populate Detail Tabs ---
    renderFactorDetailTab("strengthsPanel", internal_factors.strengths || [], "💪 Strengths", "border-green-500");
    renderFactorDetailTab("weaknessesPanel", internal_factors.weaknesses || [], "⚠️ Weaknesses", "border-red-500");
    renderFactorDetailTab("opportunitiesPanel", external_factors.opportunities || [], "✨ Opportunities", "border-blue-500");
    renderFactorDetailTab("threatsPanel", external_factors.threats || [], "🛡️ Threats", "border-yellow-500");
    
    // --- 3. Populate Learn Panel ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Factor Analysis (Strategic Context)</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Strategic Factor Analysis?</h4>
            <p class="text-sm text-white/80">In strategic planning, factor analysis involves systematically identifying and evaluating key internal and external elements that can influence an organization's ability to achieve its objectives. It's often a precursor to SWOT analysis.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">🌍 External Factor Analysis (PESTEL+)</h4>
                <p class="text-xs text-white/70 mb-2 italic">Understanding the macro-environment.</p>
                <ul class="space-y-1 text-sm">
                    <li><strong>P</strong>olitical: Government stability, policy, regulation, taxes.</li>
                    <li><strong>E</strong>conomic: Growth rates, inflation, interest rates, exchange rates, employment.</li>
                    <li><strong>S</strong>ocial: Demographics, cultural trends, lifestyle changes, consumer attitudes.</li>
                    <li><strong>T</strong>echnological: Innovation, automation, R&D, digital trends.</li>
                    <li><strong>E</strong>nvironmental: Climate change, sustainability, weather, resource availability.</li>
                    <li><strong>L</strong>egal: Laws affecting employment, competition, health & safety, consumer protection.</li>
                    <li><strong>+ Market/Competitive:</strong> Industry trends, market size, competition intensity, supplier/buyer power.</li>
                </ul>
                <p class="text-xs text-white/70 mt-2"><strong>Goal:</strong> Identify Opportunities & Threats.</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">🏢 Internal Factor Analysis (Resources & Capabilities)</h4>
                 <p class="text-xs text-white/70 mb-2 italic">Assessing the organization's own assets and abilities.</p>
                <ul class="space-y-1 text-sm">
                    <li><strong>Financial:</strong> Profitability, cash flow, funding access, cost structure.</li>
                    <li><strong>Physical:</strong> Facilities, equipment, location, raw materials access.</li>
                    <li><strong>Human Resources:</strong> Skills, experience, motivation, culture, leadership.</li>
                    <li><strong>Technological:</strong> IT infrastructure, patents, R&D capabilities, proprietary tech.</li>
                    <li><strong>Organizational:</strong> Structure, processes, reputation, brand equity, partnerships.</li>
                    <li><strong>Marketing & Sales:</strong> Brand recognition, distribution channels, customer relationships.</li>
                 </ul>
                 <p class="text-xs text-white/70 mt-2"><strong>Goal:</strong> Identify Strengths & Weaknesses.</p>
            </div>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to identify factors from your text and then provide a deep analysis for each one.</p>
    </div>
    `;


    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
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

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
}



// Modified renderFactorTab to use AI categories and factor details
function renderFactorTab(containerId, title, factors) {
    const container = dom.$(containerId);
    let contentHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">${title}</h3>`; // Added p-4

    if (factors && factors.length > 0) {
        // Group factors by AI-provided category
        const categories = factors.reduce((acc, f) => {
            const category = f.category || "Uncategorized"; // Handle missing category
            if (!acc[category]) acc[category] = [];
            acc[category].push(f);
            return acc;
        }, {});

        // Sort categories alphabetically
        const sortedCategories = Object.keys(categories).sort();

        // Chart: Factor Count by Category
        contentHtml += `<div id="${containerId}-chart" class="w-full h-[400px] mb-8 bg-black/10 rounded-lg p-2 plotly-chart"></div>`;

        // Details sections for each category
         sortedCategories.forEach(category => {
            contentHtml += `<div class="mb-6"><details class="styled-details" ${sortedCategories.length <= 3 ? 'open' : ''}> <!-- Open details if few categories -->
                            <summary class="font-semibold text-lg">${category} (${categories[category].length} factors)</summary>
                            <div class="bg-black/20 p-4 rounded-b-lg space-y-4">`; // Use styled-details background
            // Sort factors within category by rank (desc impact)
            categories[category].sort((a, b) => a.rank - b.rank);
            categories[category].forEach((factor) => {
                 const priorityColor = factor.priority === "High" ? "text-red-400" : "text-yellow-400";
                 const swotColor = factor.swot === 'Strength' || factor.swot === 'Opportunity' ? 'text-green-400' : 'text-red-400';
                 contentHtml += `<div class="py-2 border-b border-white/10 last:border-b-0">
                                <p class="flex justify-between items-center">
                                    <span class="font-semibold text-white">${factor.factor}</span>
                                    <span class="text-xs ${priorityColor}"><strong>Rank #${factor.rank}</strong> | Prio: ${factor.priority}</span>
                                </p>
                                <p class="text-sm text-white/80 my-1 italic">${factor.description || 'No description provided.'}</p>
                                <p class="text-xs text-white/60">
                                    <span class="${swotColor}">${factor.swot}</span> |
                                    Score: ${factor.impact_score.toFixed(1)} |
                                    Cumul %: ${factor.cumulative_percentage}%
                                </p>
                            </div>`;
            });
            contentHtml += `</div></details></div>`; // Close details content and details tag
         });

    } else {
        contentHtml += '<p class="text-white/70 italic text-center">No factors identified in this category based on the provided text.</p>';
    }

    contentHtml += `</div>`; // Close p-4
    container.innerHTML = contentHtml;

    // Render Category Chart
    if (factors && factors.length > 0) {
        const categoryCounts = Object.entries(
            factors.reduce((acc, f) => {
                const category = f.category || "Uncategorized";
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {})
        ).sort((a, b) => b[1] - a[1]); // Sort by count desc

        try {
            Plotly.newPlot(
                `${containerId}-chart`,
                [{
                    x: categoryCounts.map(c => c[0]),
                    y: categoryCounts.map(c => c[1]),
                    type: 'bar',
                    marker: { color: 'var(--primary)' }
                }],
                {
                    title: `${title.split('(')[0]} Factors by Category`, // Clean title
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
                    xaxis: { automargin: true, tickangle: -30, tickfont: { size: 10 } }, // Smaller font
                    yaxis: { title: 'Number of Factors', gridcolor: 'rgba(255,255,255,0.1)' },
                    margin: { t: 50, b: 80, l: 50, r: 20 } // Adjust margins
                },
                { responsive: true }
            );
        } catch(e) { console.error(`Chart render error for ${containerId}-chart:`, e); dom.$(`${containerId}-chart`).innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }
    }
}



// Modified renderParetoTab to use AI factors and details
function renderParetoTab(containerId, allFactors) {
    const container = dom.$(containerId);
    let contentHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📈 80/20 Pareto Analysis - Combined Factors</h3>`; // Added p-4

    if (allFactors && allFactors.length > 0) {
        // Sort ALL factors by rank (desc impact) for the chart
        const sortedFactors = [...allFactors].sort((a, b) => a.rank - b.rank);
        const topFactorsForChart = sortedFactors.slice(0, 20); // Limit chart display for readability

        contentHtml += `<div id="pareto-chart-container" class="w-full h-[600px] mb-8 bg-black/10 rounded-lg p-2 plotly-chart"></div>`;

        const highPriorityFactors = sortedFactors.filter(f => f.priority === "High");
        contentHtml += `<h4 class="text-xl font-semibold mt-8 mb-3 text-center">🎯 High Priority Factors (Top ~80% Impact)</h4>
                        <p class="text-sm text-white/70 mb-6 italic text-center">Focus strategic efforts on these ${highPriorityFactors.length} factors identified by the AI and prioritized using the Pareto principle.</p>`;

        // Display high priority factors in two columns: Internal vs External
        const highInternal = highPriorityFactors.filter(f => f.type === 'Internal');
        const highExternal = highPriorityFactors.filter(f => f.type === 'External');

        contentHtml += `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;
        // Internal High Priority
        contentHtml += `<div class="bg-black/20 p-4 rounded-lg">
                           <h5 class="font-bold mb-3 text-center text-blue-300">Internal Priorities (${highInternal.length})</h5>
                           <div class="space-y-3">`;
        if (highInternal.length > 0) {
            highInternal.forEach(f => {
                const swotColor = f.swot === 'Strength' ? 'text-green-400' : 'text-red-400';
                 contentHtml += `<div class="text-xs p-2 bg-black/30 rounded">
                                    <p class="flex justify-between items-center">
                                        <span class="font-semibold text-white">${f.factor}</span>
                                        <span class="text-red-400">Rank #${f.rank}</span>
                                    </p>
                                    <p class="text-white/70 italic my-1">${f.description || ''}</p>
                                    <p class="text-white/60"><span class="${swotColor}">${f.swot}</span> | Cat: ${f.category || 'N/A'} | Score: ${f.impact_score.toFixed(1)}</p>
                                 </div>`;
            });
        } else {
            contentHtml += `<p class="text-white/60 italic text-center text-sm">No high priority internal factors identified.</p>`;
        }
        contentHtml += `</div></div>`; // Close internal div

        // External High Priority
        contentHtml += `<div class="bg-black/20 p-4 rounded-lg">
                            <h5 class="font-bold mb-3 text-center text-yellow-300">External Priorities (${highExternal.length})</h5>
                            <div class="space-y-3">`;
        if (highExternal.length > 0) {
            highExternal.forEach(f => {
                const swotColor = f.swot === 'Opportunity' ? 'text-green-400' : 'text-red-400';
                 contentHtml += `<div class="text-xs p-2 bg-black/30 rounded">
                                     <p class="flex justify-between items-center">
                                        <span class="font-semibold text-white">${f.factor}</span>
                                        <span class="text-red-400">Rank #${f.rank}</span>
                                    </p>
                                    <p class="text-white/70 italic my-1">${f.description || ''}</p>
                                    <p class="text-white/60"><span class="${swotColor}">${f.swot}</span> | Cat: ${f.category || 'N/A'} | Score: ${f.impact_score.toFixed(1)}</p>
                                  </div>`;
            });
        } else {
             contentHtml += `<p class="text-white/60 italic text-center text-sm">No high priority external factors identified.</p>`;
        }
        contentHtml += `</div></div>`; // Close external div
        contentHtml += `</div>`; // Close grid

    } else {
        contentHtml += '<p class="text-white/70 italic text-center">No factors available for Pareto analysis.</p>';
    }

    contentHtml += `</div>`; // Close p-4
    container.innerHTML = contentHtml;

    // Render Pareto Chart
    if (allFactors && allFactors.length > 0) {
         // Use the limited, sorted list for the chart
         const sortedFactors = [...allFactors].sort((a, b) => a.rank - b.rank);
         const topFactorsForChart = sortedFactors.slice(0, 20);

        const trace1 = {
            x: topFactorsForChart.map(f => `(#${f.rank}) ${f.factor.substring(0, 30)}...`), // Add rank, shorten name
            y: topFactorsForChart.map(f => f.impact_score),
            name: 'Impact Score',
            type: 'bar',
            marker: { color: topFactorsForChart.map(f => f.priority === 'High' ? 'var(--accent)' : 'var(--primary)') }
        };

        const trace2 = {
            x: topFactorsForChart.map(f => `(#${f.rank}) ${f.factor.substring(0, 30)}...`),
            y: topFactorsForChart.map(f => f.cumulative_percentage),
            name: 'Cumulative %',
            type: 'scatter', mode: 'lines+markers', // Add markers
            yaxis: 'y2',
            line: { color: '#FFF', width: 2 }, // Thicker white line
            marker: {size: 6}
        };

        const layout = {
            title: '80/20 Pareto Analysis - Top 20 Factors by Impact', // Updated title
            xaxis: { tickangle: -45, automargin: true, tickfont: { size: 9 } }, // Even smaller font
            yaxis: { title: 'Impact Score (1-10)', gridcolor: 'rgba(255,255,255,0.1)' },
            yaxis2: { title: 'Cumulative Impact %', overlaying: 'y', side: 'right', range: [0, 101], gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
            legend: { orientation: 'h', y: -0.3 }, // Adjust legend position maybe
            shapes: [{
                type: 'line', xref: 'paper', yref: 'y2', x0: 0, y0: 80, x1: 1, y1: 80,
                line: { color: 'orange', width: 2, dash: 'dash' }
            }],
             margin: { t: 50, b: 120, l: 50, r: 50 } // Adjust margins
        };

        try {
            Plotly.newPlot('pareto-chart-container', [trace1, trace2], layout, { responsive: true });
        } catch(e) { console.error("Pareto chart render error:", e); dom.$("pareto-chart-container").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }
    }
}



// Modified renderSummaryTab to use AI factors
function renderSummaryTab(containerId, external, internal) {
    const container = dom.$(containerId);

     // Ensure factors are arrays
     external = Array.isArray(external) ? external : [];
     internal = Array.isArray(internal) ? internal : [];

    const highPriorityExternal = external.filter(f => f.priority === 'High').length;
    const highPriorityInternal = internal.filter(f => f.priority === 'High').length;

    // Find top categories based on *count* of high-priority items
    const getTopHighPriorityCategory = (factors) => {
         if (!factors || factors.length === 0) return "N/A";
         const highPriority = factors.filter(f => f.priority === 'High');
         if (highPriority.length === 0) return "N/A (None High Priority)";
         const counts = highPriority.reduce((acc, f) => {
              const cat = f.category || "Uncategorized";
              acc[cat] = (acc[cat] || 0) + 1;
              return acc;
         }, {});
         return Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0];
    };

    const topExtCatHighPrio = getTopHighPriorityCategory(external);
    const topIntCatHighPrio = getTopHighPriorityCategory(internal);

    container.innerHTML = `
        <div class="p-4"> <!-- Added p-4 -->
            <h3 class="text-2xl font-bold mb-4">📋 Executive Summary</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="summary-stat-card"><div class="stat-value">${external.length}</div><div class="stat-label">Total External Factors</div></div>
                <div class="summary-stat-card"><div class="stat-value">${internal.length}</div><div class="stat-label">Total Internal Factors</div></div>
                <div class="summary-stat-card ${highPriorityExternal > 0 ? 'border-l-4 border-red-500' : ''}"><div class="stat-value">${highPriorityExternal}</div><div class="stat-label">High-Priority External</div></div>
                <div class="summary-stat-card ${highPriorityInternal > 0 ? 'border-l-4 border-red-500' : ''}"><div class="stat-value">${highPriorityInternal}</div><div class="stat-label">High-Priority Internal</div></div>
            </div>
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-xl font-semibold mb-3">Key Insights & Strategic Focus</h4>
                <ul class="list-disc list-inside space-y-2 text-sm">
                    <li>A total of <strong>${external.length + internal.length}</strong> strategic factors were identified from the text.</li>
                    <li>Pareto analysis highlighted <strong>${highPriorityExternal + highPriorityInternal}</strong> factors (${highPriorityExternal} external, ${highPriorityInternal} internal) as 'High Priority', representing the critical few likely driving ~80% of strategic impact.</li>
                    <li>The most frequent category among high-priority <strong>external</strong> factors appears to be <strong>${topExtCatHighPrio}</strong>. Strategies should consider leveraging opportunities or mitigating threats in this area.</li>
                    <li>The most frequent category among high-priority <strong>internal</strong> factors appears to be <strong>${topIntCatHighPrio}</strong>. Strategies should focus on exploiting related strengths or addressing related weaknesses.</li>
                    <li><strong>Recommendation:</strong> Focus primary strategic efforts on the ${highPriorityExternal + highPriorityInternal} 'High Priority' factors identified in the '80/20 Analysis' tab.</li>
                </ul>
            </div>
         </div>`; // Close p-4
}



function renderFullSwotTowsPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Basic Validation
    if (!data || !data.swot_analysis || !data.tows_strategies || !data.key_insights_80_20) {
        console.error("Incomplete data passed to renderFullSwotTowsPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render SWOT/TOWS results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    const { swot_analysis, tows_strategies, key_insights_80_20 } = data;


    // --- Create Tab Navigation (Added Learn Tab) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="insights">🎯 Key Insights (80/20)</button> <!-- Insights First -->
        <button class="analysis-tab-btn" data-tab="swot">📋 SWOT Matrix</button>
        <button class="analysis-tab-btn" data-tab="tows">💡 TOWS Strategies</button>
        <button class="analysis-tab-btn" data-tab="details">📊 Detailed Analysis</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn SWOT/TOWS</button> <!-- New -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Added Learn Panel) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="insightsPanel" class="analysis-tab-panel active"></div> <!-- Insights Active -->
        <div id="swotPanel" class="analysis-tab-panel"></div>
        <div id="towsPanel" class="analysis-tab-panel"></div>
        <div id="detailsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New -->
    `;

    // --- Populate Tabs (Order Changed) ---
    render8020Visualization(key_insights_80_20, "insightsPanel"); // Render Insights First
    renderSwotVisualization(swot_analysis, "swotPanel"); // Uses factor + description
    renderTowsVisualization(tows_strategies, "towsPanel"); // Uses strategy + rationale
    renderDetailedAnalysis(swot_analysis, tows_strategies, "detailsPanel"); // Keep charts

    // --- Populate Learn SWOT/TOWS Panel (New) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding SWOT & TOWS Analysis</h3>
        [Image of SWOT matrix diagram]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is SWOT Analysis?</h4>
            <p class="text-sm text-white/80">SWOT is a strategic planning technique used to identify an organization's Strengths, Weaknesses, Opportunities, and Threats related to business competition or project planning. It helps assess the internal and external factors impacting a goal.</p>
            <ul class="list-disc list-inside space-y-1 text-sm mt-2">
                <li><strong>Strengths (Internal, Positive):</strong> Characteristics of the business that give it an advantage over others (e.g., strong brand, skilled workforce).</li>
                <li><strong>Weaknesses (Internal, Negative):</strong> Characteristics that place the business at a disadvantage relative to others (e.g., outdated technology, high debt).</li>
                 <li><strong>Opportunities (External, Positive):</strong> Elements in the environment that the business could exploit to its advantage (e.g., growing market, competitor weakness).</li>
                 <li><strong>Threats (External, Negative):</strong> Elements in the environment that could cause trouble for the business (e.g., new regulations, emerging competitor).</li>
            </ul>
        </div>

         <div class="bg-black/20 p-4 rounded-lg mt-4">
             
            <h4 class="text-lg font-bold mb-2 text-yellow-300">From SWOT to TOWS: Generating Strategy</h4>
            <p class="text-sm text-white/80 mb-2">While SWOT identifies factors, TOWS uses these factors to generate actionable strategies by matching internal capabilities with external possibilities/challenges:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
                <li><strong>SO (Maxi-Maxi): Strengths + Opportunities:</strong> How can strengths be used to maximize opportunities? (Aggressive strategies)</li>
                <li><strong>WO (Mini-Maxi): Weaknesses + Opportunities:</strong> How can opportunities be used to overcome weaknesses? (Turnaround strategies)</li>
                 <li><strong>ST (Maxi-Mini): Strengths + Threats:</strong> How can strengths be used to minimize threats? (Defensive strategies)</li>
                 <li><strong>WT (Mini-Mini): Weaknesses + Threats:</strong> How can weaknesses be minimized and threats avoided? (Survival/Divestment strategies)</li>
            </ul>
             <p class="text-xs text-white/70 mt-2 italic">TOWS helps bridge the gap between analysis (SWOT) and action (Strategy).</p>
        </div>

         <div class="bg-white/5 p-4 rounded-lg mt-6 border border-white/10">
            <h4 class="text-lg font-bold mb-2">Why Use SWOT/TOWS?</h4>
             <ul class="list-disc list-inside space-y-1 text-sm">
                <li>Provides a structured framework for situation analysis.</li>
                <li>Helps identify competitive advantages and disadvantages.</li>
                <li>Uncovers potential growth areas and risks.</li>
                <li>Facilitates strategic thinking and discussion.</li>
                <li>Forms a basis for developing actionable strategic plans (TOWS).</li>
            </ul>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to extract SWOT factors from your text and then generate corresponding TOWS strategies, followed by an 80/20 prioritization.</p>
    </div>
    `;


    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (ensure resizing happens)
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
                // Resize charts if they are in the activated panel
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

     // Initial resize for charts in the default active tab (Insights - no chart) + hidden tabs
     setTimeout(() => {
          tabContent.querySelectorAll(".analysis-tab-panel").forEach(panel => {
               panel.querySelectorAll(".plotly-chart").forEach(chartDiv => {
                   if (chartDiv._fullLayout && typeof Plotly !== 'undefined') {
                       try {
                            Plotly.Plots.resize(chartDiv);
                       } catch (initialResizeError) {
                            console.error(`Error during initial resize ${chartDiv.id} in panel ${panel.id}:`, initialResizeError);
                       }
                   }
               });
          });
     }, 150); // Delay slightly


    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function render8020Visualization(insightsData, containerId) {
    const container = dom.$(containerId);
     // Ensure insightsData exists and has expected arrays/strings
     insightsData = insightsData || {};
     const keyStrategies = insightsData.key_strategies || [];
     const criticalFactors = insightsData.critical_factors || [];
     const priorityActions = insightsData.priority_actions || [];

    let contentHtml = `
        <div class="p-4 space-y-8">
            <div class="p-6 rounded-lg bg-black/20 border border-white/10 text-center">
                <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Strategic Focus</h3>
                <p class="text-lg italic text-white/90">${insightsData.strategic_focus || "Strategic focus not defined."}</p>
            </div>

            <div class="grid md:grid-cols-2 gap-8">
                <div class="bg-black/20 p-4 rounded-lg">
                    <h4 class="text-xl font-semibold mb-3 text-center text-green-400">🚀 Key Strategies (Top 20%)</h4>`;
                    if (keyStrategies.length > 0) {
                         contentHtml += `<ul class="space-y-4">`;
                         keyStrategies.forEach(s => {
                             contentHtml += `<li class="p-2 bg-black/30 rounded">
                                                 <strong class="text-white">${s.strategy}</strong>
                                                 <p class="text-xs text-white/70 italic mt-1">- ${s.justification || 'No justification.'}</p>
                                             </li>`;
                         });
                         contentHtml += `</ul>`;
                    } else {
                         contentHtml += `<p class="text-white/60 italic text-center text-sm">No key strategies identified.</p>`;
                    }
                contentHtml += `</div>
                <div class="bg-black/20 p-4 rounded-lg">
                    <h4 class="text-xl font-semibold mb-3 text-center text-yellow-400">⚡ Critical Factors (Top 20%)</h4>`;
                     if (criticalFactors.length > 0) {
                         contentHtml += `<ul class="space-y-4">`;
                         criticalFactors.forEach(f => {
                              contentHtml += `<li class="p-2 bg-black/30 rounded">
                                                  <strong class="text-white">${f.factor}</strong>
                                                  <p class="text-xs text-white/70 italic mt-1">- ${f.justification || 'No justification.'}</p>
                                              </li>`;
                         });
                         contentHtml += `</ul>`;
                     } else {
                          contentHtml += `<p class="text-white/60 italic text-center text-sm">No critical factors identified.</p>`;
                     }
                contentHtml += `</div>
            </div>

            <div class="p-6 rounded-lg bg-black/20 border border-white/10">
                <h4 class="text-xl font-semibold mb-3 text-center text-blue-400">✅ Priority Actions (First Steps)</h4>`;
                if (priorityActions.length > 0) {
                    contentHtml += `<ol class="space-y-3 list-decimal list-inside text-white/90 text-center md:text-left md:max-w-xl md:mx-auto">`; // Centered list
                    priorityActions.forEach(a => {
                         contentHtml += `<li>${a}</li>`;
                    });
                    contentHtml += `</ol>`;
                } else {
                     contentHtml += `<p class="text-white/60 italic text-center text-sm">No priority actions identified.</p>`;
                }
            contentHtml += `</div>
        </div>`;
    container.innerHTML = contentHtml;
}



function renderSwotVisualization(swotData, containerId) {
    const container = dom.$(containerId);
    const quadrants = [
        { title: 'Strengths', data: swotData.strengths || [], color: '#2E8B57', icon: '💪' },
        { title: 'Weaknesses', data: swotData.weaknesses || [], color: '#CD5C5C', icon: '⚠️' },
        { title: 'Opportunities', data: swotData.opportunities || [], color: '#4169E1', icon: '✨' },
        { title: 'Threats', data: swotData.threats || [], color: '#FF8C00', icon: '🛡️' }
    ];
    let gridHtml = '<div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">'; // Added p-4, gap-6
    quadrants.forEach(q => {
        const itemsHtml = q.data.length > 0 ? q.data.map(item =>
            `<li class="mb-2">
                <strong class="text-white">${item.factor}</strong>
                <p class="text-xs text-white/70 italic ml-2">- ${item.description || 'No description provided.'}</p>
             </li>`
        ).join('') : '<li>No items identified from text.</li>';

        gridHtml += `
            <div class="bg-black/20 rounded-lg p-4 border-t-4 shadow-lg" style="border-top-color: ${q.color};">
                <h3 class="text-xl font-bold text-center mb-3 flex items-center justify-center gap-2" style="color: ${q.color};">${q.icon} ${q.title}</h3>
                <ul class="space-y-2 text-white/80 text-sm"> <!-- Removed list-disc, list-inside -->
                    ${itemsHtml}
                </ul>
            </div>`;
    });
    gridHtml += '</div>'; // Close grid
    container.innerHTML = gridHtml;
}


// Modified renderTowsVisualization to show rationale
function renderTowsVisualization(towsData, containerId) {
    const container = dom.$(containerId);
     // Ensure towsData exists and has the expected arrays
     towsData = towsData || {};
     const quadrants = [
         { title: 'SO Strategies (Maxi-Maxi)', data: towsData.SO_strategies || [], color: '#32CD32', icon: '🚀' },
         { title: 'WO Strategies (Mini-Maxi)', data: towsData.WO_strategies || [], color: '#FFD700', icon: '📈' },
         { title: 'ST Strategies (Maxi-Mini)', data: towsData.ST_strategies || [], color: '#87CEEB', icon: '🛡️' },
         { title: 'WT Strategies (Mini-Mini)', data: towsData.WT_strategies || [], color: '#DDA0DD', icon: '🚧' }
     ];
    let gridHtml = '<div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">'; // Added p-4, gap-6
    quadrants.forEach(q => {
        const itemsHtml = q.data.length > 0 ? q.data.map(item =>
             `<li class="mb-3">
                <strong class="text-white">${item.strategy}</strong>
                <p class="text-xs text-white/70 italic mt-1 ml-2">- ${item.rationale || 'No rationale provided.'}</p>
             </li>`
        ).join('') : '<li>No strategies generated based on text.</li>';

        gridHtml += `
            <div class="bg-black/20 rounded-lg p-4 border-t-4 shadow-lg" style="border-top-color: ${q.color};">
                <h3 class="text-xl font-bold text-center mb-3 flex items-center justify-center gap-2" style="color: ${q.color};">${q.icon} ${q.title}</h3>
                <ul class="space-y-3 text-white/80 text-sm"> <!-- Removed list markers, increased spacing -->
                    ${itemsHtml}
                </ul>
            </div>`;
    });
    gridHtml += '</div>'; // Close grid
    container.innerHTML = gridHtml;
}



function renderDetailedAnalysis(swotData, towsData, containerId) {
    const container = dom.$(containerId);
     // Ensure data exists and has arrays
     swotData = swotData || {};
     towsData = towsData || {};
    const factorCounts = {
        Strengths: (swotData.strengths || []).length,
        Weaknesses: (swotData.weaknesses || []).length,
        Opportunities: (swotData.opportunities || []).length,
        Threats: (swotData.threats || []).length
    };
    const strategyCounts = {
        'SO': (towsData.SO_strategies || []).length, // Use short names for chart
        'WO': (towsData.WO_strategies || []).length,
        'ST': (towsData.ST_strategies || []).length,
        'WT': (towsData.WT_strategies || []).length
    };
    const factorColors = ["#2E8B57", "#CD5C5C", "#4169E1", "#FF8C00"]; // S, W, O, T

    let metricsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">📊 Factor & Strategy Counts</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">`; // Added p-4
    Object.entries(factorCounts).forEach(([key, value], index) => {
        metricsHtml += `<div class="summary-stat-card"><div class="stat-value" style="color:${factorColors[index]}">${value}</div><div class="stat-label">${key}</div></div>`; // Use summary-stat-card
    });
    metricsHtml += `</div>`;

    let chartHtml = `<div id="strategyBarChart" class="w-full h-[400px] bg-black/10 rounded-lg p-2 plotly-chart"></div>`;

    let recommendationsHtml = `<h4 class="text-xl font-semibold mt-8 mb-3 text-center">Summary Insights</h4>
                               <div class="bg-black/20 p-4 rounded-lg max-w-2xl mx-auto">
                                   <ul class="list-disc list-inside space-y-2 text-white/80 text-sm">`;
    recommendationsHtml += factorCounts['Strengths'] >= factorCounts['Weaknesses'] ?
                           "<li>Internal factors suggest a relatively stronger position; focus on leveraging strengths.</li>" :
                           "<li>Internal factors indicate areas for improvement; prioritize addressing key weaknesses.</li>";
    recommendationsHtml += factorCounts['Opportunities'] >= factorCounts['Threats'] ?
                           "<li>External environment appears more favorable; actively pursue identified opportunities.</li>" :
                           "<li>External environment presents challenges; focus on mitigating significant threats.</li>";
     // Add insight based on TOWS strategy counts
     const strategyTotals = Object.values(strategyCounts).reduce((a, b) => a + b, 0);
     if (strategyTotals > 0) {
         const dominantStrategy = Object.entries(strategyCounts).sort((a,b) => b[1] - a[1])[0][0];
         recommendationsHtml += `<li>The analysis generated the most strategies in the <strong>${dominantStrategy}</strong> quadrant, suggesting a potential focus on ${
             dominantStrategy === 'SO' ? 'aggressive growth' :
             dominantStrategy === 'WO' ? 'turnaround/development' :
             dominantStrategy === 'ST' ? 'diversification/defense' :
             'defensive/consolidation'
         }.</li>`;
     }

    recommendationsHtml += `</ul></div></div>`; // Close p-4

    container.innerHTML = metricsHtml + chartHtml + recommendationsHtml;

    // Render Strategy Count Chart
    try {
        const plotData = [{
            x: Object.keys(strategyCounts),
            y: Object.values(strategyCounts),
            type: 'bar',
            marker: { color: ['#32CD32', '#FFD700', '#87CEEB', '#DDA0DD'] } // SO, WO, ST, WT colors
        }];
        const layout = {
            title: 'Number of Generated Strategies by Type',
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: 'white' },
            xaxis: { title: 'Strategy Type', automargin: true },
            yaxis: { title: 'Count', gridcolor: 'rgba(255,255,255,0.1)' },
            margin: { t: 50, b: 50, l: 50, r: 20 }
        };
        Plotly.newPlot('strategyBarChart', plotData, layout, { responsive: true });
    } catch(e) { console.error("Strategy chart err:", e); dom.$("strategyBarChart").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }
}



function renderGoalsAndInitiativesPage_SP(container, data) {
    container.innerHTML = ""; // Clear loading

    // Add validation for new fields
    if (!data || !data.main_objective || !data.goals) {
        console.error("Incomplete data passed to renderGoalsAndInitiativesPage_SP:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render OGSM results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    const { main_objective, goals } = data;

    // --- Create Tab Navigation (Updated with More Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="cascade">🌊 Cascade View</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="objective">🎯 Objective</button> <!-- New -->
        <button class="analysis-tab-btn" data-tab="goals"> G Goals</button> <!-- New -->
        <button class="analysis-tab-btn" data-tab="strategies"> S Strategies</button> <!-- New -->
        <button class="analysis-tab-btn" data-tab="measures"> M Measures</button> <!-- New -->
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn OGSM</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated with More Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="cascadePanel" class="analysis-tab-panel active"></div>
        <div id="objectivePanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="goalsPanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="strategiesPanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="measuresPanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Strategic Cascade Panel (Keep as is) ---
    const cascadePanel = dom.$("cascadePanel");
    let cascadeHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-6 text-center">🌊 Strategic Cascade (OGSM)</h3><div class="cascade-container">
        <div class="cascade-objective">
            <h3 class="text-lg font-bold text-indigo-300">OBJECTIVE</h3>
            <p class="text-xl font-semibold">${main_objective}</p>
        </div>
        <div class="cascade-connector"></div>
        <div class="cascade-goals-grid">`;

    goals.forEach((goal) => {
        cascadeHtml += `<div class="cascade-goal-card">
            <div>
                <h4 class="text-md font-bold text-red-300">GOAL</h4>
                <p class="text-lg font-semibold">${goal.goal_name}</p>
            </div>
            <div class="space-y-3 mt-3">`;
        (goal.strategies || []).forEach((strategy) => {
            cascadeHtml += `<div class="cascade-strategy">
                <h5 class="text-sm font-bold text-yellow-300">STRATEGY</h5>
                <p class="font-semibold">${strategy.strategy_name}</p>
                 <p class="text-xs text-white/70 italic my-1">Rationale: ${strategy.rationale || 'N/A'}</p>
                <div class="mt-2 text-xs text-white/70">
                    <strong>Measures:</strong>
                    <ul class="list-disc list-inside ml-2">${(strategy.measures || []).map(m => `<li>${m}</li>`).join('')}</ul>
                </div>
            </div>`;
        });
        cascadeHtml += `</div></div>`;
    });
    cascadeHtml += `</div></div></div>`;
    cascadePanel.innerHTML = cascadeHtml;

    // --- 2. Populate Objective Panel (New) ---
    const objectivePanel = dom.$("objectivePanel");
    objectivePanel.innerHTML = `
        <div class="p-6">
             <h3 class="text-2xl font-bold mb-4 text-center">🎯 Objective</h3>
             <div class="cascade-objective mx-auto max-w-2xl text-center bg-black/20 p-6 rounded-lg">
                <h3 class="text-lg font-bold text-indigo-300 mb-2">OVERARCHING OBJECTIVE</h3>
                <p class="text-2xl font-semibold italic">${main_objective}</p>
                 <p class="text-xs text-white/60 mt-4">(This sets the primary direction for the entire plan, derived from your input.)</p>
            </div>
        </div>`;


    // --- 3. Populate Goals Panel (New) ---
    const goalsPanel = dom.$("goalsPanel");
    let goalsHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center"> G Goals</h3>`;
    goalsHtml += `<p class="text-sm text-white/70 mb-6 italic text-center">These are the specific, high-level results needed to achieve the main Objective.</p>`;
    goals.forEach((goal, index) => {
        goalsHtml += `<div class="cascade-goal-card max-w-3xl mx-auto p-4 border-l-4 border-red-400"> <!-- Add styling -->
            <h4 class="text-md font-bold text-red-300">GOAL ${index + 1}</h4>
            <p class="text-lg font-semibold">${goal.goal_name}</p>
            <!-- Optionally add short description here if AI provides it -->
        </div>`;
    });
    goalsHtml += `</div>`;
    goalsPanel.innerHTML = goalsHtml;


    // --- 4. Populate Strategies Panel (New) ---
    const strategiesPanel = dom.$("strategiesPanel");
    let strategiesHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center"> S Strategies</h3>`;
    strategiesHtml += `<p class="text-sm text-white/70 mb-6 italic text-center">These are the key approaches and choices ('how') to achieve each Goal.</p>`;
    goals.forEach((goal, index) => {
         strategiesHtml += `<div class="mb-6 bg-black/10 p-4 rounded-lg">
                               <h4 class="text-lg font-semibold mb-3 border-b border-white/10 pb-1 text-red-300">For Goal ${index + 1}: ${goal.goal_name}</h4>
                               <div class="space-y-4">`;
        (goal.strategies || []).forEach((strategy, s_index) => {
            strategiesHtml += `<div class="cascade-strategy border border-white/10 p-3 rounded-md">
                <h5 class="text-sm font-bold text-yellow-300">STRATEGY ${index + 1}.${s_index + 1}</h5>
                <p class="font-semibold text-white">${strategy.strategy_name}</p>
                <p class="text-xs text-white/70 italic my-2">${strategy.rationale || 'N/A'}</p>
            </div>`;
        });
         strategiesHtml += `</div></div>`; // Close space-y-4 and mb-6 bg-black/10
    });
    strategiesHtml += `</div>`;
    strategiesPanel.innerHTML = strategiesHtml;


    // --- 5. Populate Measures Panel (New) ---
    const measuresPanel = dom.$("measuresPanel");
    let measuresHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center"> M Measures (KPIs)</h3>`;
    measuresHtml += `<p class="text-sm text-white/70 mb-6 italic text-center">These metrics track the progress and success of the Strategies.</p>`;
     measuresHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead><tr><th>Measure / KPI</th><th>Related Strategy</th><th>Related Goal</th></tr></thead>
                            <tbody>`;
    let kpiFound = false;
    goals.forEach((goal) => {
        (goal.strategies || []).forEach((strategy) => {
            (strategy.measures || []).forEach(measure => {
                kpiFound = true;
                measuresHtml += `<tr>
                                    <td class="font-semibold text-green-300">${measure}</td>
                                    <td>${strategy.strategy_name}</td>
                                    <td class="text-white/70">${goal.goal_name}</td>
                                 </tr>`;
            });
        });
    });
     if (!kpiFound) {
         measuresHtml += `<tr><td colspan="3" class="text-center text-white/60 italic p-4">No specific measures were identified from the text.</td></tr>`;
     }
    measuresHtml += `</tbody></table></div></div>`;
    measuresPanel.innerHTML = measuresHtml;


    // --- 6. Populate Learn OGSM Panel (Keep as is) ---
    const learnPanel = dom.$("learnPanel");
     learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding the OGSM Framework</h3>

        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is OGSM?</h4>
            <p class="text-sm text-white/80">OGSM (Objective, Goals, Strategies, Measures) is a strategic planning framework used to define what an organization wants to achieve and how it plans to get there, ensuring clear alignment from the highest-level objective down to specific metrics.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10 space-y-4">
                <div>
                    <h4 class="text-lg font-bold text-indigo-300">O - Objective</h4>
                    <p class="text-sm">The single, overarching, ambitious, and qualitatively stated aim for the planning period (e.g., "Become the market leader"). It sets the direction.</p>
                </div>
                <div>
                    <h4 class="text-lg font-bold text-red-300">G - Goals</h4>
                    <p class="text-sm">Specific, measurable (SMART), time-bound results that need to be achieved to reach the Objective (e.g., "Increase market share to 25% by EOY"). They define 'what' success looks like.</p>
                </div>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10 space-y-4">
                 <div>
                    <h4 class="text-lg font-bold text-yellow-300">S - Strategies</h4>
                    <p class="text-sm">The choices and approaches ('how') that will be employed to achieve the Goals (e.g., "Expand into new geographic regions," "Launch innovative product line"). They describe the path.</p>
                </div>
                <div>
                    <h4 class="text-lg font-bold text-green-300">M - Measures</h4>
                    <p class="text-sm">Specific metrics (KPIs) used to track the progress and success of the Strategies (e.g., "Number of new stores opened," "Revenue from new products"). They monitor performance.</p>
                </div>
            </div>
        </div>

         <div class="bg-black/20 p-4 rounded-lg mt-6">
            <h4 class="text-lg font-bold mb-2">Why Use OGSM?</h4>
             <ul class="list-disc list-inside space-y-1 text-sm">
                <li><strong>Clarity & Focus:</strong> Creates a clear, concise (often one-page) view of the strategic plan.</li>
                <li><strong>Alignment:</strong> Ensures everyone understands the objective and how their work contributes through goals and strategies.</li>
                <li><strong>Actionability:</strong> Translates high-level objectives into concrete strategies and measurable targets.</li>
                <li><strong>Accountability:</strong> Measures provide a clear basis for tracking progress and holding teams accountable.</li>
                <li><strong>Communication:</strong> Simple structure makes it easy to communicate the plan across the organization.</li>
            </ul>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to structure your input context into an OGSM plan, deriving the elements strictly from the text provided.</p>
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
                 // No Plotly charts expected in this tool
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderActionPlansPage_AP(container, data) {
    container.innerHTML = ""; // Clear loading

    // Add validation for new fields
    if (!data || !data.project_name || !data.action_items) {
        console.error("Incomplete data passed to renderActionPlansPage_AP:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Action Plan results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    const { project_name, action_items } = data;

    // --- Create Tab Navigation (Updated with MORE Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="timeline">🗓️ Timeline View</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="details">📋 Task Details</button>
        <button class="analysis-tab-btn" data-tab="resources">🔗 Resources & Dependencies</button> <!-- New -->
        <button class="analysis-tab-btn" data-tab="tracking">📊 Priorities & KPIs</button> <!-- New, Renamed -->
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Action Planning</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated with MORE Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="timelinePanel" class="analysis-tab-panel active"></div>
        <div id="detailsPanel" class="analysis-tab-panel"></div>
        <div id="resourcesPanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="trackingPanel" class="analysis-tab-panel"></div> <!-- New -->
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Timeline Panel (Keep as is) ---
    const timelinePanel = dom.$("timelinePanel");
     const sorted_action_items = [...action_items].sort((a, b) => {
         const getTimeValue = (timeline) => {
             timeline = String(timeline || '').toLowerCase(); // Ensure timeline is string
             if (timeline.includes('week')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 7;
             if (timeline.includes('month')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 30;
             if (timeline.includes('q')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 90;
             if (timeline.includes('sprint')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 14;
             return 9999;
         };
         return getTimeValue(a.timeline) - getTimeValue(b.timeline);
     });

    let timelineHtml = `<div class="p-4"><h2 class="text-3xl font-bold text-center mb-8">${project_name} - Timeline View</h2><div class="action-plan-container flex flex-col items-center">`;
    sorted_action_items.forEach((item) => {
        const priorityClass = `priority-${(item.priority || 'medium').toLowerCase()}`;
        let priorityIcon = "🔵";
        if (item.priority === 'High') priorityIcon = "🔴";
        else if (item.priority === 'Medium') priorityIcon = "🟠";

        timelineHtml += `
            <div class="timeline-item">
                <div class="timeline-dot" style="border-color: ${item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f97316' : '#3b82f6'};"></div>
                <div class="timeline-content ${priorityClass}">
                    <p class="text-xs text-indigo-300 font-semibold">${item.timeline}</p>
                    <h4 class="text-lg font-bold">${item.task_name}</h4>
                    <p class="text-sm text-white/70"><strong>Owner:</strong> ${item.owner || 'N/A'}</p>
                    <p class="text-xs font-bold mt-1">${priorityIcon} Priority: ${item.priority}</p>
                </div>
            </div>
        `;
    });
    timelineHtml += `</div></div>`;
    timelinePanel.innerHTML = timelineHtml;


    // --- 2. Populate Task Details Panel (Focus on Name, Desc, Owner, Timeline) ---
    const detailsPanel = dom.$("detailsPanel");
    let detailsHtml = `<div class="p-4 space-y-6"><h2 class="text-3xl font-bold mb-6 text-center">${project_name} - Task Details</h2>`;
     if (action_items.length > 0) {
         action_items.forEach((item, index) => {
             detailsHtml += `
                 <div class="action-card bg-black/20 p-4 rounded-lg border-l-4 border-gray-500"> <!-- Neutral border -->
                     <h4 class="text-lg font-bold mb-2">${index + 1}. ${item.task_name}</h4>
                     <p class="text-sm text-white/80 mb-3">${item.description || 'No description.'}</p>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border-t border-white/10 pt-3">
                         <div><strong>Owner:</strong><br>${item.owner || 'N/A'}</div>
                         <div><strong>Timeline:</strong><br>${item.timeline || 'N/A'}</div>
                     </div>
                 </div>`;
         });
     } else {
          detailsHtml += `<p class="text-center text-white/70 italic">No action items were generated.</p>`;
     }
    detailsHtml += `</div>`;
    detailsPanel.innerHTML = detailsHtml;

    // --- 3. Populate Resources & Dependencies Panel (New) ---
    const resourcesPanel = dom.$("resourcesPanel");
    let resourcesHtml = `<div class="p-4"><h2 class="text-3xl font-bold mb-6 text-center">${project_name} - Resources & Dependencies</h2>`;
    resourcesHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead><tr><th>Task Name</th><th>Resources Needed</th><th>Key Dependency</th></tr></thead>
                            <tbody>`;
     if (action_items.length > 0) {
        action_items.forEach((item) => {
             resourcesHtml += `<tr>
                                 <td class="font-semibold">${item.task_name}</td>
                                 <td class="text-white/80">${(item.resources_needed || []).join(', ') || 'N/A'}</td>
                                 <td class="text-white/70 italic">${item.key_dependency || 'None'}</td>
                              </tr>`;
         });
     } else {
         resourcesHtml += `<tr><td colspan="3" class="text-center text-white/60 italic p-4">No resource or dependency information generated.</td></tr>`;
     }
    resourcesHtml += `</tbody></table></div></div>`;
    resourcesPanel.innerHTML = resourcesHtml;


    // --- 4. Populate Priorities & KPIs Panel (New) ---
    const trackingPanel = dom.$("trackingPanel");
    let trackingHtml = `<div class="p-4"><h2 class="text-3xl font-bold mb-6 text-center">${project_name} - Priorities & KPIs</h2>`;
     trackingHtml += `<div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead><tr><th>Task Name</th><th>Priority</th><th>KPIs to Track</th></tr></thead>
                            <tbody>`;
     if (action_items.length > 0) {
         // Sort by priority High > Medium > Low for this view
         const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
         const sortedByPriority = [...action_items].sort((a,b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));

         sortedByPriority.forEach((item) => {
             let priorityColor = "text-blue-400"; // Low
             if (item.priority === 'High') priorityColor = "text-red-400";
             else if (item.priority === 'Medium') priorityColor = "text-yellow-400";

             trackingHtml += `<tr>
                                 <td class="font-semibold">${item.task_name}</td>
                                 <td><span class="font-bold ${priorityColor}">${item.priority}</span></td>
                                 <td class="text-white/80">${(item.kpis_to_track || []).join(', ') || 'N/A'}</td>
                              </tr>`;
         });
     } else {
          trackingHtml += `<tr><td colspan="3" class="text-center text-white/60 italic p-4">No priority or KPI information generated.</td></tr>`;
     }
    trackingHtml += `</tbody></table></div></div>`;
    trackingPanel.innerHTML = trackingHtml;


    // --- 5. Populate Learn Action Planning Panel (Keep as is) ---
    const learnPanel = dom.$("learnPanel");
     learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Action Planning</h3>
        [Image of a Gantt chart or project timeline]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is an Action Plan?</h4>
            <p class="text-sm text-white/80">An action plan is a detailed document outlining the specific tasks, steps, resources, and timelines required to achieve a particular goal or objective. It bridges the gap between strategy and execution.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Components of an Action Item:</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Specific Task:</strong> What exactly needs to be done? (Verb-noun format is good, e.g., "Develop marketing brief").</li>
                    <li><strong>Owner:</strong> Who is responsible for ensuring the task is completed?</li>
                    <li><strong>Timeline/Due Date:</strong> When should the task be finished?</li>
                    <li><strong>Priority:</strong> How critical is this task relative to others? (High, Medium, Low).</li>
                    <li><strong>Resources:</strong> What is needed (budget, people, tools)?</li>
                    <li><strong>Dependencies:</strong> What other tasks must be completed first?</li>
                    <li><strong>Status/KPIs:</strong> How will completion or success be measured?</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Why Create Action Plans?</h4>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Clarity & Direction:</strong> Provides a clear roadmap for execution.</li>
                    <li><strong>Accountability:</strong> Assigns responsibility for each task.</li>
                    <li><strong>Prioritization:</strong> Helps focus effort on the most important activities.</li>
                    <li><strong>Resource Planning:</strong> Identifies necessary resources upfront.</li>
                    <li><strong>Progress Tracking:</strong> Allows monitoring of progress towards the goal.</li>
                    <li><strong>Coordination:</strong> Facilitates collaboration by showing dependencies.</li>
                    <li><strong>Risk Management:</strong> Helps anticipate potential roadblocks.</li>
                 </ul>
            </div>
        </div>

        <details class="styled-details text-sm mt-4">
            <summary class="font-semibold">Tips for Effective Action Planning</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p><strong>1. Start with SMART Objectives:</strong> Ensure the overall goal is Specific, Measurable, Achievable, Relevant, and Time-bound.</p>
                <p><strong>2. Break Down Large Tasks:</strong> Decompose complex objectives into smaller, manageable action steps.</p>
                <p><strong>3. Be Specific & Action-Oriented:</strong> Use clear verbs for task names.</p>
                <p><strong>4. Assign Single Owners:</strong> Avoid shared responsibility where possible.</p>
                <p><strong>5. Set Realistic Timelines:</strong> Consider dependencies and resource availability.</p>
                <p><strong>6. Identify Dependencies Clearly:</strong> Understand the sequence of tasks.</p>
                <p><strong>7. Define Success Metrics (KPIs):</strong> Know what 'done' looks like for each task.</p>
                <p><strong>8. Review and Update Regularly:</strong> Action plans are living documents; adapt as needed.</p>
            </div>
        </details>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to generate a potential action plan structure based strictly on the objective you provided.</p>
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
                 // No Plotly charts expected in this tool
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderKpiPage_KE(container, data) {
    container.innerHTML = ""; // Clear loading state

    // --- Input Data Validation ---
    if (!data || typeof data !== 'object' ||
        !data.main_goal || typeof data.main_goal !== 'string' ||
        !Array.isArray(data.kpis) ||
        !Array.isArray(data.critical_events) ||
        !data.performance_summary || typeof data.performance_summary !== 'string')
    {
        console.error("Incomplete or invalid data passed to renderKpiPage_KE:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete or invalid analysis data received. Cannot render KPI & Events results. Check console for details.</div>`;
        dom.$("analysisActions").classList.add("hidden"); // Ensure save buttons are hidden on error
        return; // Stop execution if data is bad
    }
    // Destructure data *after* validation
    const { main_goal, kpis, critical_events, performance_summary } = data;

    // --- Create Tab Navigation (5 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 KPI Dashboard</button>
        <button class="analysis-tab-btn" data-tab="kpiDetails">📋 KPI Details</button>
        <button class="analysis-tab-btn" data-tab="timeline">🗓️ Events Timeline</button>
        <button class="analysis-tab-btn" data-tab="eventDetails">📝 Event Details</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn KPIs & Milestones</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (5 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="kpiDetailsPanel" class="analysis-tab-panel"></div>
        <div id="timelinePanel" class="analysis-tab-panel"></div>
        <div id="eventDetailsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate KPI Dashboard Panel ---
    try {
        const dashboardPanel = dom.$("dashboardPanel");
        let dashboardHtml = `<div class="p-4 space-y-8">
            <div class="p-6 rounded-lg bg-black/20 border border-white/10 text-center">
                <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Main Goal</h3>
                <p class="text-2xl italic text-white/90">${main_goal}</p>
            </div>
            <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 text-sm">
                <strong>Performance Summary:</strong> ${performance_summary}
            </blockquote>
            <h3 class="text-2xl font-bold text-center">Key Performance Indicators</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-${Math.min(kpis.length, 5)} gap-4">`; // Dynamic columns
        if (kpis.length > 0) {
            kpis.forEach((kpi) => {
                    // Validate kpi object structure before accessing properties
                    if (kpi && typeof kpi === 'object' && kpi.hasOwnProperty('name') && kpi.hasOwnProperty('target') && kpi.hasOwnProperty('type')) {
                        const targetDisplay = kpi.target === "Target Not Specified in Text" ? "N/A" : kpi.target;
                        const targetClass = targetDisplay === 'N/A' ? 'text-xl text-white/60' : ''; // Style N/A differently
                        dashboardHtml += `
                        <div class="kpi-card">
                            <div><p class="kpi-name">${kpi.name || 'Unnamed KPI'}</p></div>
                            <div><p class="kpi-target ${targetClass}">${targetDisplay}</p></div>
                            <div><p class="kpi-type">${kpi.type || 'N/A'}</p></div>
                        </div>`;
                    } else {
                        console.warn("Skipping invalid KPI object in dashboard:", kpi);
                    }
            });
        } else {
            dashboardHtml += `<p class="col-span-full text-center text-white/60 italic">No KPIs identified.</p>`;
        }
        dashboardHtml += `</div></div>`; // Close grid and p-4 space-y-8
        dashboardPanel.innerHTML = dashboardHtml;
    } catch (e) {
            console.error("Error rendering Dashboard Panel:", e);
            dom.$("dashboardPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering dashboard.</div>`;
    }

    // --- 2. Populate KPI Details Panel ---
    try {
        const kpiDetailsPanel = dom.$("kpiDetailsPanel");
        let kpiDetailsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">📋 KPI Details</h3>`;
        kpiDetailsHtml += `<div class="overflow-x-auto">
                            <table class="coeff-table styled-table text-sm">
                                <thead><tr><th>KPI Name</th><th>Description</th><th>Formula / Calculation</th><th>Target</th><th>Type</th></tr></thead>
                                <tbody>`;
        if (kpis.length > 0) {
            kpis.forEach((kpi) => {
                    if (kpi && typeof kpi === 'object' && kpi.hasOwnProperty('name')) { // Basic validation
                    const targetDisplay = kpi.target === "Target Not Specified in Text" ? "<i class='text-white/50'>N/A in text</i>" : (kpi.target || 'N/A');
                    kpiDetailsHtml += `<tr>
                                    <td class="font-semibold">${kpi.name || 'Unnamed KPI'}</td>
                                    <td class="text-white/80">${kpi.description || 'N/A'}</td>
                                    <td class="font-mono text-xs">${kpi.formula || 'N/A'}</td>
                                    <td>${targetDisplay}</td>
                                    <td class="text-white/70">${kpi.type || 'N/A'}</td>
                                    </tr>`;
                    } else {
                        console.warn("Skipping invalid KPI object in details table:", kpi);
                    }
            });
        } else {
            kpiDetailsHtml += `<tr><td colspan="5" class="text-center text-white/60 italic p-4">No KPIs were identified from the text.</td></tr>`;
        }
        kpiDetailsHtml += `</tbody></table></div></div>`; // Close table div and p-4
        kpiDetailsPanel.innerHTML = kpiDetailsHtml;
    } catch (e) {
            console.error("Error rendering KPI Details Panel:", e);
            dom.$("kpiDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering KPI details.</div>`;
    }

    // --- 3. Populate Events Timeline Panel ---
    try {
        const timelinePanel = dom.$("timelinePanel");
        // Use main_goal for title consistency
        let timelineHtml = `<div class="p-4"><h2 class="text-3xl font-bold text-center mb-8">${main_goal} - Critical Events Timeline</h2><div class="action-plan-container flex flex-col items-center">`;
        if (critical_events.length > 0) {
            // Sorting logic included
            const sorted_events = [...critical_events].sort((a, b) => {
                    const getTimeValue = (timeline) => {
                        timeline = String(timeline || '').toLowerCase();
                        if (timeline.includes('week')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 7;
                        if (timeline.includes('month')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 30;
                        if (timeline.includes('q')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 90;
                        return 9999;
                    };
                    return getTimeValue(a.timeline) - getTimeValue(b.timeline);
                });

            sorted_events.forEach((event) => {
                    if (event && typeof event === 'object' && event.hasOwnProperty('event_name')) { // Basic validation
                    const importanceColor = event.importance === 'High' ? '#ef4444' : '#f97316'; // Red for High, Orange for Medium
                    const importanceIcon = event.importance === 'High' ? '🔴' : '🟠';

                    timelineHtml += `
                        <div class="timeline-item">
                            <div class="timeline-dot" style="border-color: ${importanceColor};"></div>
                            <div class="timeline-content border-l-4" style="border-left-color: ${importanceColor};">
                                <p class="text-xs text-indigo-300 font-semibold">${event.timeline || 'N/A'}</p>
                                <h4 class="text-lg font-bold">${event.event_name || 'Unnamed Event'}</h4>
                                <p class="text-xs font-bold mt-1">${importanceIcon} Importance: ${event.importance || 'N/A'}</p>
                            </div>
                        </div>`;
                    } else {
                        console.warn("Skipping invalid event object in timeline:", event);
                    }
            });
        } else {
            timelineHtml += `<p class="text-center text-white/70 italic">No critical events were identified from the text.</p>`;
        }
        timelineHtml += `</div></div>`; // Close container and p-4
        timelinePanel.innerHTML = timelineHtml;
    } catch (e) {
        console.error("Error rendering Timeline Panel:", e);
        dom.$("timelinePanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering timeline.</div>`;
    }

    // --- 4. Populate Event Details Panel ---
    try {
        const eventDetailsPanel = dom.$("eventDetailsPanel");
        let eventDetailsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">📝 Event Details</h3>`;
        eventDetailsHtml += `<div class="overflow-x-auto">
                            <table class="coeff-table styled-table text-sm">
                                <thead><tr><th>Event Name</th><th>Description (Completion Criteria)</th><th>Timeline</th><th>Importance</th></tr></thead>
                                <tbody>`;
        if (critical_events.length > 0) {
            critical_events.forEach((event) => {
                    if (event && typeof event === 'object' && event.hasOwnProperty('event_name')) { // Basic validation
                    const importanceColor = event.importance === 'High' ? 'text-red-400' : 'text-yellow-400';
                    eventDetailsHtml += `<tr>
                                    <td class="font-semibold">${event.event_name || 'Unnamed Event'}</td>
                                    <td class="text-white/80">${event.description || 'N/A'}</td>
                                    <td class="text-white/70">${event.timeline || 'N/A'}</td>
                                    <td><span class="font-bold ${importanceColor}">${event.importance || 'N/A'}</span></td>
                                    </tr>`;
                    } else {
                        console.warn("Skipping invalid event object in details table:", event);
                    }
            });
        } else {
            eventDetailsHtml += `<tr><td colspan="4" class="text-center text-white/60 italic p-4">No event details were identified from the text.</td></tr>`;
        }
        eventDetailsHtml += `</tbody></table></div></div>`; // Close table div and p-4
        eventDetailsPanel.innerHTML = eventDetailsHtml;
    } catch (e) {
        console.error("Error rendering Event Details Panel:", e);
        dom.$("eventDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering event details.</div>`;
    }

    // --- 5. Populate Learn KPIs & Milestones Panel ---
    try {
        const learnPanel = dom.$("learnPanel");
        // Re-using the content previously generated for this tab
        learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding KPIs & Milestones</h3>
                
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">Why Track Performance?</h4>
                <p class="text-sm text-white/80">Tracking performance is crucial for strategy execution. Key Performance Indicators (KPIs) measure progress towards goals, while Critical Events (Milestones) mark significant achievements along the way. Together, they provide visibility and enable course correction.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-2 text-green-300">📊 Key Performance Indicators (KPIs)</h4>
                    <ul class="list-disc list-inside space-y-2 text-sm">
                        <li><strong>Definition:</strong> Measurable values demonstrating how effectively a company is achieving key business objectives.</li>
                        <li><strong>Characteristics (SMART):</strong> Specific, Measurable, Achievable, Relevant, Time-bound.</li>
                        <li><strong>Types:</strong>
                            <ul class="list-[circle] list-inside pl-4 text-xs">
                                <li><strong>Lagging Indicators:</strong> Measure past performance (e.g., Revenue, Profit, Churn Rate). Show results.</li>
                                <li><strong>Leading Indicators:</strong> Measure activities likely to drive future results (e.g., Website Visits, Sales Leads, Employee Training Hours). Predict success.</li>
                                <li><strong>Financial:</strong> Related to money (e.g., ROI, Margin).</li>
                                <li><strong>Customer:</strong> Related to customer perception/behavior (e.g., CSAT, NPS, Retention).</li>
                                <li><strong>Operational:</strong> Related to internal processes (e.g., Cycle Time, Defect Rate).</li>
                            </ul>
                        </li>
                            <li><strong>Purpose:</strong> Monitor health, identify trends, inform decisions, measure strategic success.</li>
                    </ul>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-2 text-yellow-300">🗓️ Critical Events (Milestones)</h4>
                        <ul class="list-disc list-inside space-y-2 text-sm">
                        <li><strong>Definition:</strong> Significant points or achievements in a project or strategic initiative timeline.</li>
                        <li><strong>Characteristics:</strong> Clearly defined, mark transition between phases, often represent completion of major deliverables.</li>
                        <li><strong>Examples:</strong> Project Kick-off, Design Approval, Product Launch, Funding Secured, Regulatory Approval, First Customer Acquired.</li>
                        <li><strong>Purpose:</strong> Break down large projects, track progress, provide clear deadlines, facilitate communication, celebrate achievements.</li>
                        </ul>
                </div>
            </div>

                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Connecting KPIs and Milestones</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li>Milestones mark *when* key things happen; KPIs measure *how well* things are happening or the *results* of those happenings.</li>
                    <li>Achieving milestones should ideally lead to improvements in relevant KPIs.</li>
                    <li>KPI trends can signal potential issues *before* a milestone is missed.</li>
                    <li>Both are essential for effective strategy execution and performance management.</li>
                </ul>
            </div>
                <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to identify potential KPIs and Critical Events based strictly on the goal/project description you provided.</p>
        </div>
        `;
    } catch (e) {
            console.error("Error rendering Learn Panel:", e);
            dom.$("learnPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering learning content.</div>`;
    }

    // --- Final Touches ---
    try {
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
                        // No Plotly charts expected here, no resize needed
                } else {
                        console.warn("Target panel not found:", targetPanelId);
                }
            }
        });

        dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    } catch (e) {
            console.error("Error setting up final touches (tabs, cache, buttons):", e);
            // Don't overwrite the container if there was a rendering error earlier
            if (!container.innerHTML.includes('text-red-400')) {
                container.innerHTML += `<div class="p-4 text-center text-red-400">Error setting up UI components.</div>`;
            }
    }
    // setLoading('generate', false); // This is handled in the calling function
}




// Modified renderFullSwotTowsPage to add Learn Tab and use detailed data










// Modified renderMiscPage_MSC to add Learn Tab and display details
function renderMiscPage_MSC(container, data) {
    container.innerHTML = ""; // Clear loading

    // --- Validation for the comprehensive structure ---
    if (!data || !data.executive_summary || !data.mission_vision || !data.internal_factors || !data.external_factors || 
        !data.strategic_goals || !data.risk_assessment || !data.governance || !data.conclusion) 
    {
        console.error("Incomplete comprehensive data passed to renderMiscPage_MSC:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render full report.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    const { 
        executive_summary, mission_vision, internal_factors, external_factors, 
        strategic_goals, risk_assessment, governance, conclusion 
    } = data;

    // --- Create Tab Navigation (NOW 6 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📝 Exec. Summary</button>
        <button class="analysis-tab-btn" data-tab="strategy">🎯 Core Strategy</button>
        <button class="analysis-tab-btn" data-tab="initiatives">🚀 Initiatives</button>
        <button class="analysis-tab-btn" data-tab="risks">⚠️ Risks & Governance</button>
        <button class="analysis-tab-btn" data-tab="conclusion">🏁 Conclusion</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Planning</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (NOW 6 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active"></div>
        <div id="strategyPanel" class="analysis-tab-panel"></div>
        <div id="initiativesPanel" class="analysis-tab-panel"></div>
        <div id="risksPanel" class="analysis-tab-panel"></div>
        <div id="conclusionPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Summary Panel ---
    const summaryPanel = dom.$("summaryPanel");
    summaryPanel.innerHTML = `<div class="p-4">
                                <h3 class="text-2xl font-bold mb-4">Executive Summary</h3>
                                <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 whitespace-pre-wrap">${executive_summary}</blockquote>
                             </div>`;

    // --- 2. Populate Core Strategy Panel ---
    const strategyPanel = dom.$("strategyPanel");
    let strategyHtml = `<div class="p-4 space-y-8">
                            <h3 class="text-2xl font-bold mb-4 text-center">Core Strategy</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-indigo-400">
                                    <h4 class="text-lg font-bold text-indigo-300 mb-2">Mission</h4>
                                    <p class="text-sm text-white/80 italic">${mission_vision.mission || 'N/A'}</p>
                                </div>
                                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-indigo-400">
                                    <h4 class="text-lg font-bold text-indigo-300 mb-2">Vision</h4>
                                    <p class="text-sm text-white/80 italic">${mission_vision.vision || 'N/A'}</p>
                                </div>
                                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-indigo-400">
                                    <h4 class="text-lg font-bold text-indigo-300 mb-2">Core Values</h4>
                                    <ul class="list-disc list-inside text-sm text-white/80">${(mission_vision.values || []).map(v => `<li>${v}</li>`).join('')}</ul>
                                </div>
                            </div>
                            <div>
                                <h4 class="text-xl font-bold mb-3 text-center">High-Level Strategic Goals</h4>
                                <div class="space-y-4 max-w-2xl mx-auto">`;
    (strategic_goals || []).forEach((goal, index) => {
        strategyHtml += `<div class="cascade-goal-card p-4 text-center">
                            <h4 class="text-md font-bold text-red-300">GOAL ${index + 1}</h4>
                            <p class="text-lg font-semibold">${goal.goal_name || 'N/A'}</p>
                         </div>`;
    });
    strategyHtml += `</div></div></div>`; // Close space-y-4, max-w-2xl, div, p-4
    strategyPanel.innerHTML = strategyHtml;


    // --- 3. Populate Strategic Initiatives Panel (Was 4) ---
    const initiativesPanel = dom.$("initiativesPanel");
    let initiativesHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center">🚀 Strategic Initiatives</h3>`;
    (strategic_goals || []).forEach((goal, index) => {
        initiativesHtml += `<div class="mb-6 bg-black/10 p-4 rounded-lg">
                               <h4 class="text-lg font-semibold mb-3 border-b border-white/10 pb-1 text-red-300">For Goal: ${goal.goal_name}</h4>
                               <div class="space-y-4">`;
        (goal.key_initiatives || []).forEach((init, s_index) => {
            initiativesHtml += `<div class="prescription-card border-l-4 border-yellow-400">
                <h5 class="text-lg font-bold">${init.initiative_name}</h5>
                <p class="rationale"><strong>Rationale:</strong> ${init.rationale || 'N/A'}</p>
                <div class="bg-black/20 p-3 rounded text-sm mt-3">
                    <h5 class="font-bold text-green-300 mb-2">Measures / KPIs</h5>
                    <ul class="list-disc list-inside space-y-1 text-white/90">${(init.kpis || []).map(m => `<li>${m}</li>`).join('')}</ul>
                </div>
            </div>`;
        });
        initiativesHtml += `</div></div>`; // Close space-y-4 and mb-6 bg-black/10
    });
    initiativesHtml += `</div>`; // Close p-4
    initiativesPanel.innerHTML = initiativesHtml;


    // --- 4. Populate Risks & Governance Panel (Was 5) ---
    const risksPanel = dom.$("risksPanel");
    let risksHtml = `<div class="p-4 space-y-8">
                        <div>
                            <h3 class="text-2xl font-bold mb-4 text-center">⚠️ Risk Assessment</h3>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left styled-table text-sm">
                                    <thead>
                                        <tr>
                                            <th>Risk Description</th>
                                            <th class="text-center">Impact</th>
                                            <th class="text-center">Likelihood</th>
                                            <th>Justification</th>
                                            <th>Mitigation Strategy</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;
    if (risk_assessment.length > 0) {
        risk_assessment.forEach((item) => {
            const impactClass = `risk-level-${(item.impact || "low").toLowerCase()}`;
            const likelihoodClass = `risk-level-${(item.likelihood || "low").toLowerCase()}`;
            risksHtml += `<tr>
                <td>${item.risk || 'N/A'}</td>
                <td class="text-center"><span class="risk-pill ${impactClass}">${item.impact || '?'}</span></td>
                <td class="text-center"><span class="risk-pill ${likelihoodClass}">${item.likelihood || '?'}</span></td>
                <td class="text-xs text-white/70 italic">${item.justification || 'N/A'}</td>
                <td class="text-xs text-white/80">${item.mitigation || 'N/A'}</td>
            </tr>`;
        });
    } else {
         risksHtml += `<tr><td colspan="5" class="text-center text-white/60 italic p-4">No risks identified from the text.</td></tr>`;
    }
    risksHtml += `</tbody></table></div></div>`; // Close table div

    // Governance part
    risksHtml += `<div>
                    <h3 class="text-2xl font-bold mb-4 text-center">🏛️ Governance & Responsibilities</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
     if (governance.length > 0) {
        governance.forEach((item) => {
            risksHtml += `<div class="bg-black/20 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-3 border-b border-white/10 pb-1">${item.stakeholder || 'Unnamed Stakeholder'}</h4>
                <p class="text-xs font-semibold text-indigo-300 mb-2">Key Responsibilities:</p>
                <ul class="list-disc list-inside space-y-1 text-sm text-white/80">${(item.responsibilities || []).map(r => `<li>${r}</li>`).join('')}</ul>
            </div>`;
        });
     } else {
         risksHtml += `<p class="col-span-full text-center text-white/60 italic">No governance details identified from the text.</p>`;
     }
    risksHtml += `</div></div>`; // Close grid and div
    risksHtml += `</div>`; // Close p-4
    risksPanel.innerHTML = risksHtml;


    // --- 5. Populate Conclusion Panel (Was 6) ---
    const conclusionPanel = dom.$("conclusionPanel");
    conclusionPanel.innerHTML = `<div class="p-4">
                                    <h3 class="text-2xl font-bold mb-4">Conclusion</h3>
                                    <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 whitespace-pre-wrap">${conclusion}</blockquote>
                                 </div>`;

    // --- 6. Populate Learn Planning Panel (NEW) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Anatomy of a Strategic Plan</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is a Strategic Plan?</h4>
            <p class="text-sm text-white/80">A strategic plan is a document used to communicate an organization's goals, the actions needed to achieve those goals, and all of the other critical elements (like risks, resources, and governance) that will be involved.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Core Identity & Direction</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Executive Summary:</strong> A high-level overview for quick reference.</li>
                    <li><strong>Mission:</strong> *Why* the organization exists (its purpose).</li>
                    <li><strong>Vision:</strong> *Where* the organization is going (its future state).</li>
                    <li><strong>Values:</strong> The core beliefs that guide behavior.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Analysis & Strategy</h4>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Factor Analysis (SWOT):</strong> Identifies internal Strengths/Weaknesses and external Opportunities/Threats.</li>
                    <li><strong>Strategic Goals:</strong> High-level, long-term achievements to aim for (e.g., "Become market leader").</li>
                    <li><strong>Key Initiatives:</strong> The specific, large-scale projects or programs that will be executed to achieve the goals.</li>
                 </ul>
            </div>
        </div>

         <div class="bg-black/20 p-4 rounded-lg mt-6">
            <h4 class="text-lg font-bold mb-2 text-yellow-300">Execution & Accountability</h4>
            <p class="text-sm text-white/80">A plan is useless without a path to execution. This includes:</p>
            <ul class="list-disc list-inside space-y-1 text-sm mt-2">
                <li><strong>Risk Assessment:</strong> Identifying what could go wrong and planning how to mitigate it.</li>
                <li><strong>Governance:</strong> Defining who is responsible for what. This ensures accountability and clear lines of communication.</li>
                <li><strong>Measures (KPIs):</strong> Metrics used to track progress against initiatives and goals.</li>
            </ul>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to find all these components *within your provided document* and organize them into this tabbed view for clarity.</p>
    </div>
    `;

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
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

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
}


export {
    renderFactorAnalysisPage,
    renderFullSwotTowsPage,
    renderGoalsAndInitiativesPage_SP,
    renderActionPlansPage_AP,
    renderKpiPage_KE,
    renderMiscPage_MSC
}