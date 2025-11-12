import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';

/**
 * NEW MASTER RENDERER for Factor Analysis.
 * Creates a 7-tab layout: Dashboard, Impact Map, S, W, O, T, Learn.
 * Calls helper functions to render each tab's content.
 */
function renderFactorAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Basic validation for the comprehensive structure
    if (!data || !data.internal_factors || !data.external_factors) {
         console.error("Incomplete data passed to renderFactorAnalysisPage:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received.</div>`;
         dom.$("analysisActions").classList.add("hidden");
         return;
    }

    const { internal_factors, external_factors } = data;
    // Consolidate all factors into one array for the dashboard & map
    const allFactors = [
        ...(internal_factors.strengths || []).map(f => ({ ...f, type: 'Strength' })),
        ...(internal_factors.weaknesses || []).map(f => ({ ...f, type: 'Weakness' })),
        ...(external_factors.opportunities || []).map(f => ({ ...f, type: 'Opportunity' })),
        ...(external_factors.threats || []).map(f => ({ ...f, type: 'Threat' }))
    ];

    // --- Create Tab Navigation (7 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="impactMap">🗺️ Impact Map</button>
        <button class="analysis-tab-btn" data-tab="strengths">💪 Strengths</button>
        <button class="analysis-tab-btn" data-tab="weaknesses">⚠️ Weaknesses</button>
        <button class="analysis-tab-btn" data-tab="opportunities">✨ Opportunities</button>
        <button class="analysis-tab-btn" data-tab="threats">🛡️ Threats</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Factors</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (7 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="impactMapPanel" class="analysis-tab-panel"></div>
        <div id="strengthsPanel" class="analysis-tab-panel"></div>
        <div id="weaknessesPanel" class="analysis-tab-panel"></div>
        <div id="opportunitiesPanel" class="analysis-tab-panel"></div>
        <div id="threatsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel ---
    renderFactorDashboardTab("dashboardPanel", allFactors, internal_factors, external_factors);

    // --- 2. Populate Impact Map Panel ---
    renderImpactMapTab("impactMapPanel", allFactors);

    // --- 3-6. Populate Detail Tabs ---
    renderFactorDetailTab("strengthsPanel", internal_factors.strengths || [], "Strengths", "border-green-500");
    renderFactorDetailTab("weaknessesPanel", internal_factors.weaknesses || [], "Weaknesses", "border-red-500");
    renderFactorDetailTab("opportunitiesPanel", external_factors.opportunities || [], "Opportunities", "border-blue-500");
    renderFactorDetailTab("threatsPanel", external_factors.threats || [], "Threats", "border-yellow-500");
    
    // --- 7. Populate Learn Panel ---
    renderLearnFactorAnalysisTab("learnPanel");


    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (with Plotly resize)
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
                
                // Resize any Plotly charts within the newly active panel
                const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                chartsInPanel.forEach(chartDiv => {
                    // Check if it's a rendered Plotly chart
                    if (chartDiv.layout && typeof Plotly !== 'undefined') { 
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
    
    // Attempt initial resize for charts in the default active tab
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
     }, 150); // Delay slightly

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
}

/**
 * NEW HELPER: Renders the Factor Analysis Dashboard tab.
 */
function renderFactorDashboardTab(containerId, allFactors, internal_factors, external_factors) {
    const container = dom.$(containerId);
    if (!container) return;

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
                            <p class="text-sm text-center text-white/70 italic mb-3">Type: ${criticalFactor.type} | Category: ${criticalFactor.category}</p>
                            <div class="rationale text-sm">
                                <strong>Analysis Summary:</strong> ${criticalFactor.analysis.summary || 'N/A'}
                            </div>
                         </div>`;
    }
    dashboardHtml += `</div>`; // Close p-4
    container.innerHTML = dashboardHtml;
}

/**
 * MODIFIED HELPER: Renders a detail tab (S, W, O, T)
 * NOW INCLUDES a horizontal bar chart of factors by category.
 *
 * --- FIX ---
 * Moved `categoryCounts` declaration to the top-level scope of the function
 * so it is accessible by both the HTML-building block and the
 * Plotly-rendering block.
 */
function renderFactorDetailTab(panelId, factors, title, borderColorClass) {
    const panel = dom.$(panelId);
    if (!panel) return;

    let categoryCounts = {}; // <-- FIX: Declared in outer scope
    let html = `<div class="p-4 space-y-6">
                    <h3 class="text-3xl font-bold mb-4 text-center">${title} (${factors.length})</h3>`;
    
    if (factors.length > 0) {
        // --- NEW: Category Bar Chart ---
        categoryCounts = factors.reduce((acc, f) => { // <-- FIX: Initialize here
            const category = f.category || "Uncategorized";
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
        const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]); // Sort by count desc

        html += `<div class="mb-8">
                    <h4 class="text-xl font-semibold mb-3 text-center">Factor Count by Category</h4>
                    <div id="${panelId}-chart" class="w-full h-[${30 + sortedCategories.length * 40}px] min-h-[200px] bg-black/10 rounded-lg p-2 plotly-chart"></div>
                 </div>`;
        // --- END NEW ---

        // Sort by impact score, highest first, for the list
        factors.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));
        
        factors.forEach((factor, index) => {
            const analysis = factor.analysis || { facts: [], deductions: [], conclusions: [], summary: "Analysis not provided." };
            
            html += `
                <div class="prescription-card ${borderColorClass} p-5">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="text-xl font-bold">${index + 1}. ${factor.factor}</h4>
                        <span class="text-lg font-bold text-yellow-300" title="Impact Score">(${factor.impact_score}/10)</span>
                    </div>
                    <p class="text-xs font-semibold text-indigo-300 uppercase mb-2">Category: ${factor.category || 'N/A'}</p>
                    <p class="text-sm text-white/80 italic mb-4"><strong>Description:</strong> ${factor.description || 'N/A'}</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-black/20 p-4 rounded-lg space-y-3">
                            <div>
                                <h5 class="font-bold text-green-300 mb-2">📋 Facts</h5>
                                <ul class="list-disc list-inside text-sm text-white/80 space-y-1">
                                    ${(analysis.facts && analysis.facts.length > 0) 
                                        ? analysis.facts.map(f => `<li>${f}</li>`).join('') 
                                        : '<li>No facts provided.</li>'}
                                </ul>
                            </div>
                            <div>
                                <h5 class="font-bold text-green-300 mb-2">🔍 Deductions</h5>
                                <ul class="list-disc list-inside text-sm text-white/80 space-y-1">
                                    ${(analysis.deductions && analysis.deductions.length > 0) 
                                        ? analysis.deductions.map(d => `<li>${d}</li>`).join('') 
                                        : '<li>No deductions provided.</li>'}
                                </ul>
                            </div>
                        </div>

                        <div class="bg-black/20 p-4 rounded-lg space-y-3">
                            <div>
                                <h5 class="font-bold text-yellow-300 mb-2">⚡ Conclusions</h5>
                                <ul class="list-disc list-inside text-sm text-white/80 space-y-1">
                                    ${(analysis.conclusions && analysis.conclusions.length > 0) 
                                        ? analysis.conclusions.map(c => `<li>${c}</li>`).join('') 
                                        : '<li>No conclusions provided.</li>'}
                                </ul>
                            </div>
                            <div class="mt-4">
                                <h5 class="font-bold text-indigo-300 mb-2">📝 Summary</h5>
                                <p class="text-sm text-white/80 italic">
                                    ${analysis.summary || 'No summary provided.'}
                                </p>
                            </div>
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

    // --- Render the new Category Bar Chart ---
    if (factors.length > 0) {
        try {
            // Sort ascending for horizontal bar chart
            const chartData = Object.entries(categoryCounts).sort((a, b) => a[1] - b[1]); // 'categoryCounts' is now in scope
            const trace = {
                y: chartData.map(c => c[0]), // Categories on Y-axis
                x: chartData.map(c => c[1]), // Counts on X-axis
                type: 'bar',
                orientation: 'h', // Horizontal
                marker: { color: borderColorClass.replace('border-', 'color-mix(in srgb, var(--') + ') 70%, transparent)' } // Use tab color
            };
            const layout = {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: 'white' },
                xaxis: { title: 'Number of Factors', gridcolor: 'rgba(255,255,255,0.1)' },
                yaxis: { automargin: true, tickfont: { size: 10 } },
                margin: { t: 20, b: 40, l: 150, r: 20 } // Give space for Y-axis labels
            };
            Plotly.newPlot(`${panelId}-chart`, [trace], layout, { responsive: true });
        } catch(e) {
            console.error(`Category chart render error for ${panelId}-chart:`, e);
            dom.$(`${panelId}-chart`).innerHTML = `<p class="text-red-400 text-center pt-10">Chart render error: ${e.message}</p>`;
        }
    }
}

/**
 * NEW HELPER: Renders the Factor Impact Map (Bubble Chart) tab.
 *
 * --- FIX v3 ---
 * 1. REMOVED the broken `sizeref` and `sizemin` properties.
 * 2. MODIFIED the `size` array to map impact scores directly to a
 * reasonable pixel diameter (e.g., 10px for impact 1, 46px for impact 10).
 * 3. INCREASED the axis `range` padding to -0.75 / +0.25 to "zoom out"
 * and ensure no bubbles are clipped at the edges.
 */
function renderImpactMapTab(containerId, allFactors) {
    const container = dom.$(containerId);
    if (!container) return;
    
    let html = `<div class="p-4">
                    <h3 class="text-2xl font-bold mb-4 text-center">Factor Impact Map</h3>
                    <p class="text-sm text-white/70 text-center mb-6 max-w-2xl mx-auto">This map visualizes all factors. The Y-axis shows the business category, the X-axis shows the strategic type, and the size of each bubble represents its impact score.</p>
                    <div id="factorImpactMapChart" class="w-full h-[600px] bg-black/10 rounded-lg p-2 plotly-chart"></div>
                </div>`;
    container.innerHTML = html;
    
    if (allFactors && allFactors.length > 0) {
        
        // --- Data Prep ---
        const types = ['Strength', 'Weakness', 'Opportunity', 'Threat'];
        // Get unique categories from the data and sort them
        const categories = [...new Set(allFactors.map(f => f.category || 'Uncategorized'))].sort();

        const trace = {
            x: allFactors.map(f => f.type),
            y: allFactors.map(f => f.category || 'Uncategorized'),
            text: allFactors.map(f => `<strong>${f.factor}</strong><br>Impact: ${f.impact_score}<br>${f.description}`),
            mode: 'markers',
            marker: {
                // --- FIX: Use direct pixel sizing ---
                // Map impact_score (1-10) to a pixel size (e.g., 10px to 46px)
                size: allFactors.map(f => (f.impact_score || 1) * 4 + 6), 
                // --- FIX: REMOVED `sizeref` and `sizemin` ---
                color: allFactors.map(f => {
                    if (f.type === 'Strength') return '#28a745';
                    if (f.type ==='Weakness') return '#dc3545';
                    if (f.type === 'Opportunity') return '#007bff';
                    if (f.type === 'Threat') return '#ffc107';
                    return '#6c757d';
                }),
                opacity: 0.7,
            },
            type: 'scatter',
            hovertemplate: '%{text}<extra></extra>'
        };

        const layout = {
            title: 'Factor Impact Map by Category and Type',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' },
            xaxis: { 
                title: 'Factor Type', 
                gridcolor: 'rgba(255,255,255,0.1)',
                categoryorder: 'array',
                categoryarray: types,
                // --- FIX: Add more padding to "zoom out" ---
                range: [-0.75, types.length - 0.25] // Adds 0.75 padding on each side
            },
            yaxis: { 
                title: 'Business Category', 
                gridcolor: 'rgba(255,255,255,0.1)',
                automargin: true,
                categoryorder: 'array',
                categoryarray: categories.reverse(), // Show from top to bottom
                // --- FIX: Add more padding to "zoom out" ---
                range: [-0.75, categories.length - 0.25] // Adds 0.75 padding on each side
            },
            margin: { t: 60, b: 100, l: 150, r: 40 }, // Keep margins for labels
            hovermode: 'closest'
        };

        try {
            Plotly.newPlot('factorImpactMapChart', [trace], layout, { responsive: true });
        } catch(e) { 
            console.error("Impact Map render error:", e); 
            dom.$('factorImpactMapChart').innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; 
        }
    } else {
        dom.$('factorImpactMapChart').innerHTML = "<p class='text-white/70 italic text-center pt-10'>No factors identified to plot.</p>";
    }
}

/**
 * NEW HELPER: Renders the static "Learn" tab for Factor Analysis.
 */
function renderLearnFactorAnalysisTab(containerId) {
    const container = dom.$(containerId);
    if (!container) return;

    container.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Factor Analysis (Strategic Context)</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Strategic Factor Analysis?</h4>
            <p class="text-sm text-white/80">In strategic planning, factor analysis involves systematically identifying and evaluating key internal and external elements that can influence an organization's ability to achieve its objectives. It's the foundation of a SWOT analysis.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">🌍 External Factor Analysis (PESTEL+)</h4>
                

[Image of PESTEL analysis diagram]

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
         <div class="bg-black/20 p-4 rounded-lg mt-6">
            <h4 class="text-lg font-bold mb-2 text-yellow-300">🕵️ From Identification to Analysis (How this tool works)</h4>
            <p class="text-sm text-white/80">Simply listing factors is not enough. This tool's AI provides a deep analysis for each factor:</p>
            <ul class="list-disc list-inside space-y-1 text-sm mt-2">
                <li><strong>Facts:</strong> What is the objective evidence for this factor from your text?</li>
                <li><strong>Deductions:</strong> What logical inferences can be drawn from the facts?</li>
                <li><strong>Conclusions:</strong> What is the strategic implication (Impact, Urgency, Stance)?</li>
                <li><strong>Summary:</strong> What is the simple takeaway for this factor?</li>
            </ul>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to find all factors in your text and provide this deep analysis for each one.</p>
    </div>
    `;
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

export {
    renderFactorAnalysisPage
}