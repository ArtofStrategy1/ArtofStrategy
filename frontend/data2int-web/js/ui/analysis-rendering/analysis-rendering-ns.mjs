// =====================================================================================================
// ===================          Novel Strategies Page Rendering Functions           ====================
// =====================================================================================================

import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';
import { setLoading } from '../../utils/ui-utils.mjs';

function renderNovelGoalsPage_NS(container, data) {
    container.innerHTML = ""; // Clear loading state
    const { main_goal, horizons } = data;

    // Basic validation
    if (!main_goal || !horizons || !Array.isArray(horizons) || horizons.length !== 3) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">Incomplete or invalid analysis data received. Cannot render Three Horizons plan.</div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        setLoading("generate", false); // Ensure loading indicator stops
        return;
    }

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6"; // Use standard tab styling
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="horizons">🌌 Horizons Visual</button>
        <button class="analysis-tab-btn" data-tab="details">📋 Detailed Plan</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Framework</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="horizonsPanel" class="analysis-tab-panel"></div>
        <div id="detailsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4 space-y-8">
        <div class="p-6 rounded-lg bg-white/10 border border-white/20 text-center">
            <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Overarching Goal</h3>
            <p class="text-2xl italic text-white/90">${main_goal}</p>
        </div>
        <h3 class="text-2xl font-bold text-center">Initiatives Across Horizons</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">`;

    horizons.forEach((horizon, index) => {
        const colors = ["border-blue-400", "border-yellow-400", "border-red-400"];
        const initiativesList = horizon.initiatives || []; // Ensure it's an array
        dashboardHtml += `<div class="bg-white/5 p-4 rounded-lg border-l-4 ${colors[index]}">
            <h4 class="text-lg font-bold mb-2">${horizon.horizon_name}</h4>
            <p class="text-xs font-semibold text-white/70 mb-3">${horizon.timeframe}</p>
            <p class="text-xs italic text-white/70 mb-3">${horizon.focus}</p>`;
        // Handle empty initiatives list in dashboard
        if (initiativesList.length > 0) {
                dashboardHtml += `<ul class="list-disc list-inside space-y-2 text-sm text-white/80">
                ${initiativesList.map(init => `<li>${init.initiative_name}</li>`).join("")}
            </ul>`;
        } else {
                dashboardHtml += `<p class="text-sm text-white/60 italic mt-2">(No specific initiatives derivable from context for this horizon)</p>`;
        }
        dashboardHtml += `</div>`;
    });
    dashboardHtml += `</div></div>`;
    dashboardPanel.innerHTML = dashboardHtml;


    // --- 2. Populate Horizons Visual Panel ---
    const horizonsPanel = dom.$("horizonsPanel");
    let horizonsHtml = `<div class="horizons-container">
                <div id="h3-circle" class="horizon-circle"><span class="horizon-label">Horizon 3 (${horizons[2]?.timeframe || '3-7+ Yrs'})</span></div>
                <div id="h2-circle" class="horizon-circle"><span class="horizon-label">Horizon 2 (${horizons[1]?.timeframe || '12-36 Mos'})</span></div>
                <div id="h1-circle" class="horizon-circle"><span class="horizon-label">Horizon 1 (${horizons[0]?.timeframe || '0-18 Mos'})</span></div>
                <div class="main-goal-center">${main_goal}</div>`;

    let initiativeCount = 0;
    // Flatten only initiatives that actually exist
    const allValidInitiatives = horizons.flatMap(h => h.initiatives || []);
    const totalInitiatives = allValidInitiatives.length || 1;

    horizons.forEach((horizon, hIndex) => {
        (horizon.initiatives || []).forEach((initiative) => {
            const baseAngle = Math.PI / 6;
            const angleIncrement = (Math.PI * 1.8) / totalInitiatives;
            const angle = baseAngle + initiativeCount * angleIncrement;
            const radii = [25, 38, 50];
            const radius = radii[hIndex];
            const randomOffset = (Math.random() - 0.5) * 3;
            const effectiveRadius = Math.max(10, Math.min(60, radius + randomOffset));
            const x = 50 + effectiveRadius * Math.cos(angle);
            const y = 50 + effectiveRadius * Math.sin(angle);
            horizonsHtml += `<div class="initiative-point" style="left: ${x.toFixed(2)}%; top: ${y.toFixed(2)}%; transform: translate(-50%, -50%);" title="${initiative.description || initiative.initiative_name}">${initiative.initiative_name}</div>`;
            initiativeCount++;
        });
    });
    horizonsHtml += `</div>`;
    // Add message if no initiatives could be plotted
    if (allValidInitiatives.length === 0) {
            horizonsHtml += `<p class="text-center text-white/70 mt-[-50px] relative z-10">(No initiatives derived from context to plot)</p>`;
    }
    horizonsPanel.innerHTML = horizonsHtml;


    // --- 3. Populate Detailed Plan Panel ---
    const detailsPanel = dom.$("detailsPanel");
    let detailsHtml = `<div class="p-4 space-y-6">
            <div class="p-4 rounded-lg bg-black/20 text-center mb-6">
            <h3 class="text-lg font-bold text-indigo-300">🎯 Overarching Goal</h3>
            <p class="text-xl italic text-white/90">${main_goal}</p>
        </div>`;
    horizons.forEach((horizon) => {
        const initiativesList = horizon.initiatives || []; // Ensure it's an array
        detailsHtml += `<div class="bg-white/10 p-6 rounded-lg shadow-lg mb-6">
                    <h3 class="text-2xl font-bold mb-1">${horizon.horizon_name}</h3>
                    <p class="text-sm text-indigo-300 font-semibold mb-2">${horizon.timeframe}</p>
                    <p class="text-md italic text-white/80 mb-4">${horizon.focus}</p>
                    <h4 class="text-lg font-semibold mb-3 border-b border-white/20 pb-1">Initiatives:</h4>
                    <div class="space-y-4">`;
        // Handle empty initiatives list in detailed view
        if (initiativesList.length > 0) {
            initiativesList.forEach(initiative => {
                    detailsHtml += `<div class="bg-black/20 p-4 rounded">
                                <p class="font-semibold text-white">${initiative.initiative_name}</p>
                                <p class="text-xs text-white/70 italic my-1">${initiative.description}</p>
                                <p class="text-xs text-yellow-300 mt-2"><strong>KPIs:</strong> ${(initiative.kpis || []).join(", ")}</p>
                            </div>`;
            });
        } else {
                detailsHtml += `<p class="text-sm text-white/60 italic">(No specific initiatives derivable from context for this horizon)</p>`;
        }
        detailsHtml += `</div></div>`; // Close initiatives space-y-4 and horizon bg-white/10
    });
    detailsHtml += `</div>`; // Close details panel p-4 space-y-6
    detailsPanel.innerHTML = detailsHtml;


    // --- 4. Populate Learn Framework Panel ---
    const learnPanel = dom.$("learnPanel");
    // (Keep the exact same HTML content for the learn panel as in the previous response)
    learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding the Three Horizons of Growth</h3>
            <p class="italic text-center">McKinsey's Three Horizons framework provides a structure for companies to manage current performance while maximizing future growth opportunities. It helps balance resources across initiatives with different timeframes and risk profiles.</p>
            <div class="text-center my-4"></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div class="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
                    <h4 class="text-xl font-bold text-blue-300 mb-2">Horizon 1: Optimize the Core</h4>
                    <p class="text-sm font-semibold mb-2">Timeframe: ~0-18 Months</p>
                    <p class="text-sm mb-3"><strong>Focus:</strong> Defend, extend, and increase the profitability of the existing, core business. Improve efficiency and extract maximum value from current operations.</p>
                    <p class="text-sm"><strong>Characteristics:</strong> Lower risk, incremental improvements, known markets/customers, focus on execution, generates cash flow.</p>
                    <p class="text-sm mt-2"><strong>Example Activities:</strong> Process automation, cost reduction, product line extensions, customer retention programs.</p>
                </div>
                <div class="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/50">
                    <h4 class="text-xl font-bold text-yellow-300 mb-2">Horizon 2: Build Adjacent Growth</h4>
                    <p class="text-sm font-semibold mb-2">Timeframe: ~12-36 Months</p>
                    <p class="text-sm mb-3"><strong>Focus:</strong> Develop emerging opportunities by leveraging existing capabilities into adjacent markets, products, or services. Build new lines of business.</p>
                    <p class="text-sm"><strong>Characteristics:</strong> Moderate risk, requires investment and new capabilities, potential for substantial growth, builds new revenue streams.</p>
                    <p class="text-sm mt-2"><strong>Example Activities:</strong> Geographic expansion, launching SaaS based on existing tech, entering new customer segments, strategic partnerships.</p>
                </div>
                <div class="bg-red-900/30 p-4 rounded-lg border border-red-500/50">
                    <h4 class="text-xl font-bold text-red-300 mb-2">Horizon 3: Create Transformational Options</h4>
                    <p class="text-sm font-semibold mb-2">Timeframe: ~3-7+ Years</p>
                    <p class="text-sm mb-3"><strong>Focus:</strong> Explore and invest in truly disruptive or novel ideas, technologies, or business models that could become the core business of the distant future. Create options.</p>
                    <p class="text-sm"><strong>Characteristics:</strong> High risk & uncertainty, experimental, requires R&D or venture investment, uncertain outcomes but massive potential.</p>
                    <p class="text-sm mt-2"><strong>Example Activities:</strong> Basic research in new tech (AI, quantum), pilot programs for radical business models, minority investments in startups, creating internal innovation labs.</p>
                </div>
            </div>
                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Why Use the Three Horizons Framework?</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Balanced Portfolio:</strong> Ensures resources are allocated across short, medium, and long-term growth opportunities.</li>
                    <li><strong>Future-Proofing:</strong> Prevents complacency by forcing focus on future disruption and innovation.</li>
                    <li><strong>Structured Innovation:</strong> Provides a common language and framework for discussing and managing different types of growth initiatives.</li>
                    <li><strong>Resource Allocation:</strong> Helps justify investments in H2 and H3 initiatives that may not yield immediate returns.</li>
                    <li><strong>Avoiding the "Tyranny of the Urgent":</strong> Protects nascent H2/H3 projects from being starved by the demands of the core H1 business.</li>
                </ul>
                </div>
        </div>
    `;

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the result

    // Add event listener for tab switching
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanelId = e.target.dataset.tab + "Panel";
            const targetPanel = dom.$(targetPanelId);
            if (targetPanel) {
                    targetPanel.classList.add("active");
                    // const chart = targetPanel.querySelector(".plotly-chart"); // If charts added later
                    // if (chart) Plotly.Plots.resize(chart);
            } else {
                    console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator AFTER rendering
}



function renderCreativeDissonancePage_NS(container, data) {
    container.innerHTML = ""; // Clear loading state
    // Add original inputs back for display if they were stored
    const { dissonance_points, gap_analysis, strategic_initiatives, original_inputs } = data;
    const currentRealityText = original_inputs?.currentReality || "[Current Reality Input Missing]";
    const futureVisionText = original_inputs?.futureVision || "[Future Vision Input Missing]";


    // Basic validation
    if (!dissonance_points || !gap_analysis || !strategic_initiatives || !Array.isArray(dissonance_points) || !Array.isArray(gap_analysis) || !Array.isArray(strategic_initiatives) ) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Creative Dissonance plan.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6"; // Standard tabs
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="gap">🔍 Gap Analysis</button>
        <button class="analysis-tab-btn" data-tab="initiatives">🚀 Strategic Initiatives</button>
        <button class="analysis-tab-btn" data-tab="matrix">🗺️ Prioritization Matrix</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Framework</button>
        `;
        // <button class="analysis-tab-btn" data-tab="kpis">📈 KPI Tracker</button> // Merged KPIs into Initiatives tab for brevity
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="gapPanel" class="analysis-tab-panel"></div>
        <div id="initiativesPanel" class="analysis-tab-panel"></div>
        <div id="matrixPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
        `;
        // <div id="kpisPanel" class="analysis-tab-panel"></div>

    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    // Simplified dashboard focusing on the core tension and initiative count
    let dashboardHtml = `<div class="p-4 space-y-8">
        <h3 class="text-2xl font-bold text-center mb-4">Creative Dissonance Overview</h3>
        <div class="dissonance-map-container">
                <div class="dissonance-pole">
                    <h4 class="text-xl font-bold mb-3 text-red-300">📉 Current Reality</h4>
                    <p class="text-white/80 text-sm">${currentRealityText}</p>
                </div>
                <div class="dissonance-gap">
                    <div class="text-center mb-4">
                    <span class="text-4xl">⚡</span>
                    <h4 class="text-lg font-bold text-yellow-300">Structural Tension</h4>
                    <p class="text-xs text-white/70">(Points of Dissonance)</p>
                    </div>
                ${(dissonance_points || []).map(dp => `<div class="dissonance-point text-xs">${dp}</div>`).join("")}
                </div>
                <div class="dissonance-pole">
                    <h4 class="text-xl font-bold mb-3 text-green-300">🚀 Future Vision</h4>
                    <p class="text-white/80 text-sm">${futureVisionText}</p>
                </div>
        </div>
        <div class="text-center mt-[-1rem] mb-6">
            <p class="text-lg text-white/90">Identified <strong class="text-yellow-300">${(gap_analysis || []).length}</strong> major gaps and formulated <strong class="text-yellow-300">${(strategic_initiatives || []).length}</strong> strategic initiatives to bridge them.</p>
        </div>
    </div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Populate Gap Analysis Panel ---
    const gapPanel = dom.$("gapPanel");
    let gapHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4">🔍 Detailed Gap Analysis</h3>`;
    if (gap_analysis.length > 0) {
        gap_analysis.forEach((gap) => {
            gapHtml += `<div class="insight-card">
                <h4 class="text-xl font-bold mb-3 text-indigo-300">${gap.theme || "Unnamed Gap Theme"}</h4>
                <p class="mb-2 text-sm"><strong>Current State:</strong> ${gap.reality_statement || "N/A"}</p>
                <p class="mb-3 text-sm"><strong>Future State:</strong> ${gap.vision_statement || "N/A"}</p>
                <div class="p-3 bg-black/20 rounded border-l-4 border-yellow-400 mt-3">
                    <p class="text-sm"><strong>Identified Gap:</strong> ${gap.gap || "N/A"}</p>
                </div>
            </div>`;
        });
    } else {
            gapHtml += `<p class="text-center text-white/70">No specific gaps identified based on input.</p>`;
    }
    gapHtml += `</div>`;
    gapPanel.innerHTML = gapHtml;

    // --- 3. Populate Strategic Initiatives Panel (Including KPIs) ---
    const initiativesPanel = dom.$("initiativesPanel");
    let initiativesHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🚀 Strategic Initiatives</h3>`;
        if (strategic_initiatives.length > 0) {
        initiativesHtml += `<div class="space-y-6">`;
        strategic_initiatives.forEach((p) => {
            initiativesHtml += `<div class="prescription-card">
                <h4 class="text-xl font-bold">${p.initiative_name || "Unnamed Initiative"}</h4>
                <p class="text-xs font-semibold my-1"><span class="text-yellow-300">Impact:</span> ${p.impact || "?"} | <span class="text-blue-300">Effort:</span> ${p.effort || "?"}</p>
                <p class="rationale"><strong>Strategic Rationale:</strong> ${p.rationale || "N/A"}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-indigo-300 mb-2">First Action Items</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${(p.action_items || []).map((a) => `<li>${a}</li>`).join("")}</ul>
                        ${!(p.action_items && p.action_items.length > 0) ? '<p class="text-white/60 italic text-xs">No specific first steps defined.</p>' : ''}
                    </div>
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-indigo-300 mb-2">KPIs to Track</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${(p.kpis_to_track || []).map((k) => `<li>${k}</li>`).join("")}</ul>
                        ${!(p.kpis_to_track && p.kpis_to_track.length > 0) ? '<p class="text-white/60 italic text-xs">No specific KPIs defined.</p>' : ''}
                    </div>
                </div>
            </div>`;
        });
        initiativesHtml += `</div>`;
        } else {
        initiativesHtml += `<p class="text-center text-white/70">No specific initiatives identified based on input.</p>`;
        }
    initiativesHtml += `</div>`;
    initiativesPanel.innerHTML = initiativesHtml;


    // --- 4. Populate Prioritization Matrix Panel ---
    const matrixPanel = dom.$("matrixPanel");
    matrixPanel.innerHTML = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">🗺️ Initiative Prioritization Matrix</h3><div id="initiativeMatrixPlot" class="w-full h-[600px] plotly-chart"></div></div>`;

    if (strategic_initiatives.length > 0) {
        const impactMap = { Low: 1, Medium: 2, High: 3 };
        const effortMap = { Low: 1, Medium: 2, High: 3 };
        // Add jitter to avoid points overlapping perfectly
        const addJitter = (val) => val + (Math.random() - 0.5) * 0.2;

        const matrixData = {
            x: strategic_initiatives.map((p) => addJitter(effortMap[p.effort] || 1)),
            y: strategic_initiatives.map((p) => addJitter(impactMap[p.impact] || 1)),
            text: strategic_initiatives.map((p) => p.initiative_name || "Unnamed"),
            mode: "markers+text",
            textposition: "top right", // Adjusted for better visibility with jitter
            marker: { size: 18, color: "var(--primary)", opacity: 0.8 },
            type: 'scatter' // Ensure type is scatter for jitter
        };
        const matrixLayout = { /* ... keep the same layout as before ... */
            title: { text: "Impact vs. Effort", y:0.95 },
            paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "white" },
            xaxis: { title: "Effort Required", range: [0.5, 3.5], tickvals: [1, 2, 3], ticktext: ["Low", "Medium", "High"], gridcolor: "rgba(255,255,255,0.2)", zeroline: false },
            yaxis: { title: "Potential Impact", range: [0.5, 3.5], tickvals: [1, 2, 3], ticktext: ["Low", "Medium", "High"], gridcolor: "rgba(255,255,255,0.2)", zeroline: false },
            shapes: [ { type: "line", x0: 2, y0: 0.5, x1: 2, y1: 3.5, line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dot" } }, { type: "line", x0: 0.5, y0: 2, x1: 3.5, y1: 2, line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dot" } } ],
            annotations: [ { x: 1, y: 3, text: "Quick Wins", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 3, y: 3, text: "Major Projects", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 1, y: 1, text: "Fill-ins", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } }, { x: 3, y: 1, text: "Thankless Tasks", showarrow: false, font: { size: 14, color: "rgba(255,255,255,0.6)" } } ]
        };
        Plotly.newPlot("initiativeMatrixPlot", [matrixData], matrixLayout, { responsive: true });
    } else {
            dom.$("initiativeMatrixPlot").innerHTML = `<p class="text-center text-white/70 pt-10">No initiatives identified to plot.</p>`;
    }

    // --- 5. Populate Learn Framework Panel ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Creative Dissonance (Structural Tension)</h3>

            <p class="italic text-center">Based on the work of Robert Fritz, Creative Dissonance (or Structural Tension) is the gap between the vision of what you want to create and your perception of current reality. This gap generates energy that naturally seeks resolution, driving action and creativity.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div class="bg-red-900/30 p-4 rounded-lg border border-red-500/50">
                    <h4 class="text-xl font-bold text-red-300 mb-2">📉 Current Reality</h4>
                    <p class="text-sm mb-3">A clear, objective, and honest assessment of the present situation. What *is* true right now, including limitations, challenges, and existing resources?</p>
                    <p class="text-sm"><strong>Focus:</strong> Objectivity, facts, data, current state.</p>
                    <p class="text-sm mt-2"><strong>Pitfall to Avoid:</strong> Letting the current reality limit your vision.</p>
                </div>

                <div class="bg-green-900/30 p-4 rounded-lg border border-green-500/50">
                    <h4 class="text-xl font-bold text-green-300 mb-2">🚀 Future Vision</h4>
                    <p class="text-sm mb-3">A compelling picture of the desired future state. What do you truly want to create or achieve? This should be aspirational and clearly defined.</p>
                    <p class="text-sm"><strong>Focus:</strong> Aspiration, desired outcome, clarity, intrinsic motivation.</p>
                    <p class="text-sm mt-2"><strong>Pitfall to Avoid:</strong> Making the vision a reaction to current problems (it should be about creation).</p>
                </div>
            </div>

                <div class="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/50 mt-6">
                    <h4 class="text-xl font-bold text-yellow-300 mb-2">⚡ The Tension (The Gap)</h4>
                    <p class="text-sm mb-3">The difference between the Vision and Current Reality creates a natural tension. This isn't a problem to be solved, but a structure that inherently seeks resolution.</p>
                    <p class="text-sm"><strong>Mechanism:</strong> Just like a stretched rubber band wants to return to equilibrium, this structural tension drives action towards the vision OR pulls the vision down towards reality.</p>
                    <p class="text-sm mt-2"><strong>Key Insight:</strong> You resolve the tension by taking actions that move reality closer to the vision.</p>
                </div>

                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">How This Tool Applies It:</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Dissonance Points & Gap Analysis:</strong> Clearly defines the specific areas of tension between your stated reality and vision.</li>
                    <li><strong>Strategic Initiatives:</strong> Proposes concrete actions aimed at altering the current reality structure to move it towards the desired vision, thereby resolving the tension constructively.</li>
                    <li><strong>Prioritization Matrix:</strong> Helps focus resources on initiatives likely to have the biggest impact in closing the gap relative to the effort required.</li>
                </ul>
                </div>
                <p class="text-xs text-center text-white/60 mt-4">Note: This framework emphasizes creating the future you want, rather than just solving problems from the past.</p>
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
                    const chart = targetPanel.querySelector(".plotly-chart");
                    if (chart) Plotly.Plots.resize(chart); // Resize chart if panel becomes active
            } else {
                    console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator
}



function renderLivingSystemPage_NS(container, data) {
    container.innerHTML = ""; // Clear loading state
    const { overall_diagnosis, system_analysis, strategic_interventions, original_inputs } = data;

    // Basic validation
    if (!overall_diagnosis || !system_analysis || !Array.isArray(system_analysis) || system_analysis.length < 4 || !strategic_interventions ) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Living System plan.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6"; // Standard tabs
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">🧬 System Health</button>
        <button class="analysis-tab-btn" data-tab="deepdive">🔬 Deep Dive</button>
        <button class="analysis-tab-btn" data-tab="interventions">💊 Interventions</button>
        <button class="analysis-tab-btn" data-tab="kpis">📈 KPI Tracker</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Framework</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="deepdivePanel" class="analysis-tab-panel"></div>
        <div id="interventionsPanel" class="analysis-tab-panel"></div>
        <div id="kpisPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // Map system names for consistent ordering/display
    const systemMap = {
        "Metabolism": system_analysis.find(s => s.system_name.includes("Metabolism")) || { system_name: "Metabolism", health_status: "Strained", analysis: "Data missing." },
        "Nervous System": system_analysis.find(s => s.system_name.includes("Nervous")) || { system_name: "Nervous System", health_status: "Strained", analysis: "Data missing." },
        "Immune System": system_analysis.find(s => s.system_name.includes("Immune")) || { system_name: "Immune System", health_status: "Strained", analysis: "Data missing." },
        "Growth & Adaptation": system_analysis.find(s => s.system_name.includes("Growth") || s.system_name.includes("Adaptation")) || { system_name: "Growth & Adaptation", health_status: "Strained", analysis: "Data missing." }
    };
    const orderedSystems = ["Metabolism", "Nervous System", "Immune System", "Growth & Adaptation"];


    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    // Get Core Identity text either from original inputs or analysis if available
        const coreIdentityText = original_inputs?.coreIdentity || system_analysis.find(s => s.system_name.includes("Core Identity"))?.analysis || "Core Identity not specified in detail.";

    let dashboardHtml = `<div class="p-4">
        <blockquote class="p-4 italic border-l-4 border-gray-500 bg-gray-800 text-white/90 mb-8">
            <strong>Overall Diagnosis:</strong> ${overall_diagnosis}
        </blockquote>
        <div class="ls-dashboard-container">
            <div class="ls-core">
                <h3 class="text-lg font-bold">Core Identity</h3>
                <p class="text-xs text-white/70 mt-1">${coreIdentityText.substring(0, 100)}${coreIdentityText.length > 100 ? '...' : ''}</p>
                </div>`;

    // Position nodes consistently
    const positions = [
        { bottom: "5%", left: "50%", transform: "translateX(-50%)" }, // Metabolism at bottom
        { top: "50%", left: "5%", transform: "translateY(-50%)" },   // Nervous System left
        { top: "50%", right: "5%", transform: "translateY(-50%)" },  // Immune System right
        { top: "5%", left: "50%", transform: "translateX(-50%)" }    // Growth & Adaptation at top
    ];

    orderedSystems.forEach((sysName, index) => {
        const sys = systemMap[sysName];
        const pos = positions[index];
        // Normalize health status for class name
        const healthStatusNormalized = (sys.health_status || "strained").toLowerCase();
        const healthClass = `ls-health-${healthStatusNormalized}`; // e.g., ls-health-robust

        dashboardHtml += `<div class="ls-system-node ${healthClass}" style="top:${pos.top || "auto"}; left:${pos.left || "auto"}; right:${pos.right || "auto"}; bottom:${pos.bottom || "auto"}; transform:${pos.transform || 'none'};">
            <h4 class="font-bold text-sm">${sys.system_name}</h4>
            <p class="text-md font-bold mt-1">${sys.health_status || "Unknown"}</p>
        </div>`;
    });
    dashboardHtml += `</div></div>`; // Close ls-dashboard-container and p-4
    dashboardPanel.innerHTML = dashboardHtml;


    // --- 2. Populate Deep Dive Panel ---
    const deepdivePanel = dom.$("deepdivePanel");
    let deepdiveHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4">Deep Dive Analysis</h3>`;
    orderedSystems.forEach((sysName) => {
        const sys = systemMap[sysName];
        const healthStatusNormalized = (sys.health_status || "strained").toLowerCase();
        const healthClass = `ls-health-${healthStatusNormalized}`; // Use normalized status for class

        // Add border color based on health status
        let borderColorClass = "border-gray-500"; // Default border
        if (healthStatusNormalized === "robust") borderColorClass = "border-green-400";
        else if (healthStatusNormalized === "fragile") borderColorClass = "border-red-400";
        else if (healthStatusNormalized === "strained") borderColorClass = "border-yellow-400";


        deepdiveHtml += `<div class="insight-card border-l-4 ${borderColorClass}">
            <h4 class="text-xl font-bold mb-2">${sys.system_name} - <span class="font-semibold ${healthClass}">${sys.health_status || "Unknown"}</span></h4>
            <p class="text-white/90 text-sm">${sys.analysis || "No analysis provided."}</p>
        </div>`;
    });
    deepdiveHtml += `</div>`;
    deepdivePanel.innerHTML = deepdiveHtml;


    // --- 3. Populate Interventions Panel ---
    const interventionsPanel = dom.$("interventionsPanel");
    let interventionsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">💊 Strategic Interventions</h3>`;
    if (strategic_interventions && strategic_interventions.length > 0) {
            interventionsHtml += `<div class="space-y-6">`;
            strategic_interventions.forEach((p) => {
            interventionsHtml += `<div class="prescription-card">
                <h4 class="text-xl font-bold">${p.initiative_name || "Unnamed Initiative"}</h4>
                <p class="text-xs font-semibold my-1 text-indigo-300">TARGET SYSTEM(S): ${p.target_system || "N/A"}</p>
                <p class="rationale"><strong>Rationale:</strong> ${p.rationale || "N/A"}</p>
                <div class="bg-black/20 p-3 rounded text-sm mt-3">
                    <h5 class="font-bold text-yellow-300 mb-2">Action Items</h5>
                    <ul class="list-disc list-inside space-y-1 text-white/90">${(p.action_items || []).map((a) => `<li>${a}</li>`).join("")}</ul>
                    ${!(p.action_items && p.action_items.length > 0) ? '<p class="text-white/60 italic text-xs">No specific action items defined.</p>' : ''}
                </div>
            </div>`;
        });
            interventionsHtml += `</div>`;
    } else {
            interventionsHtml += `<p class="text-center text-white/70 italic">No specific strategic interventions were identified based on the provided context, likely indicating no major weaknesses were found or derivable.</p>`;
    }
    interventionsHtml += `</div>`;
    interventionsPanel.innerHTML = interventionsHtml;


    // --- 4. Populate KPI Tracker Panel ---
    const kpisPanel = dom.$("kpisPanel");
    let kpisHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📈 Consolidated KPI Tracker</h3>`;
    if (strategic_interventions && strategic_interventions.length > 0 && strategic_interventions.some(p => p.kpis_to_track && p.kpis_to_track.length > 0)) {
        kpisHtml += `<div class="overflow-x-auto"><table class="coeff-table">
                    <thead><tr><th>KPI to Track</th><th>Related Initiative</th><th>Target System</th></tr></thead>
                    <tbody>`;
        strategic_interventions.forEach((p) => {
            (p.kpis_to_track || []).forEach((kpi) => {
                kpisHtml += `<tr><td>${kpi}</td><td>${p.initiative_name || "N/A"}</td><td>${p.target_system || "N/A"}</td></tr>`;
            });
        });
        kpisHtml += `</tbody></table></div>`;
    } else {
        kpisHtml += `<p class="text-center text-white/70 italic">No specific KPIs identified for the proposed interventions.</p>`;
    }
    kpisHtml += `</div>`;
    kpisPanel.innerHTML = kpisHtml;


    // --- 5. Populate Learn Framework Panel ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding the Living System / Viable System Model (VSM)</h3>

            <p class="italic text-center">This framework views organizations not just as machines, but as complex, adaptive systems akin to living organisms. It helps diagnose systemic health and identify interventions for viability and resilience, drawing heavily on Stafford Beer's Viable System Model.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div class="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
                    <h4 class="text-xl font-bold text-blue-300 mb-2">🧬 Core Identity (VSM System 5 - Policy)</h4>
                    <p class="text-sm mb-3"><strong>Focus:</strong> The organization's fundamental purpose, values, mission, and long-term direction. Its "DNA."</p>
                    <p class="text-sm"><strong>Health Check:</strong> Is the identity clear, shared, and guiding decisions? Does it align with the environment?</p>
                </div>

                <div class="bg-green-900/30 p-4 rounded-lg border border-green-500/50">
                    <h4 class="text-xl font-bold text-green-300 mb-2">🔥 Metabolism (VSM System 1 - Operations)</h4>
                    <p class="text-sm mb-3"><strong>Focus:</strong> How the organization takes in resources (inputs like revenue, materials, talent) and transforms them into value (outputs like products, services).</p>
                    <p class="text-sm"><strong>Health Check:</strong> Are core operations efficient? Is resource conversion effective? Is there waste? Can it acquire needed resources?</p>
                </div>

                <div class="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/50">
                    <h4 class="text-xl font-bold text-yellow-300 mb-2">🧠 Nervous System (VSM Systems 2, 3, 3* - Coordination, Control, Audit)</h4>
                    <p class="text-sm mb-3"><strong>Focus:</strong> How information flows, how coordination happens, how performance is monitored, and how decisions are made to regulate operations and respond to the environment.</p>
                    <p class="text-sm"><strong>Health Check:</strong> Is information timely and accurate? Are feedback loops effective? Is decision-making swift and informed? Is there internal stability?</p>
                </div>

                <div class="bg-red-900/30 p-4 rounded-lg border border-red-500/50">
                    <h4 class="text-xl font-bold text-red-300 mb-2">🛡️ Immune System / Adaptation (VSM System 4 - Intelligence/Environment Sensing)</h4>
                    <p class="text-sm mb-3"><strong>Focus:</strong> How the organization senses changes in its external environment (market, competitors, tech), anticipates threats/opportunities, and adapts its strategy and identity for long-term survival.</p>
                    <p class="text-sm"><strong>Health Check:</strong> Is the organization aware of external trends? Can it adapt proactively? Does it learn and evolve its model?</p>
                        <p class="text-xs italic mt-1">(Note: Sometimes 'Immune System' is used more narrowly for internal threat response, while VSM's System 4 covers broader external adaptation.)</p>
                </div>
            </div>

                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Why Use This Framework?</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Holistic View:</strong> Considers the organization as an interconnected whole, not just separate parts.</li>
                    <li><strong>Resilience Focus:</strong> Helps identify vulnerabilities and build adaptability for long-term survival.</li>
                    <li><strong>Systemic Diagnosis:</strong> Pinpoints root causes of problems within the system's structure, not just symptoms.</li>
                    <li><strong>Viability Assessment:</strong> Based on principles required for any system (biological or organizational) to remain viable in its environment.</li>
                </ul>
                </div>
                <p class="text-xs text-center text-white/60 mt-4">This analysis maps concepts like Metabolism, Nervous System, etc., onto the core functions described in Stafford Beer's Viable System Model (VSM).</p>
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
                    // const chart = targetPanel.querySelector(".plotly-chart"); // If charts added later
                    // if (chart) Plotly.Plots.resize(chart);
            } else {
                    console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator AFTER rendering
}



function renderThinkingSystemPage_NS(container, data) {
    container.innerHTML = ""; // Clear loading state
    const { deconstruction, reframing, new_actions } = data;

    // Basic validation
    if (!deconstruction || !reframing || !new_actions || !Array.isArray(new_actions) || !deconstruction.observation ) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Incomplete or invalid analysis data received. Cannot render Ladder of Inference analysis.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6"; // Standard tabs
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="ladder">🪜 Deconstruction</button>
        <button class="analysis-tab-btn" data-tab="reframing">🧠 Reframing</button>
        <button class="analysis-tab-btn" data-tab="actions">🚀 New Actions</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Framework</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="ladderPanel" class="analysis-tab-panel active"></div>
        <div id="reframingPanel" class="analysis-tab-panel"></div>
        <div id="actionsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Ladder Deconstruction Panel ---
    const ladderPanel = dom.$("ladderPanel");
    // Rungs ordered bottom-up for display
    const rungs = [
        { name: "Observation", text: deconstruction.observation },
        { name: "Selection", text: deconstruction.selection },
        { name: "Interpretation", text: deconstruction.interpretation },
        { name: "Assumption", text: deconstruction.assumption },
        { name: "Conclusion", text: deconstruction.conclusion },
        { name: "Belief", text: deconstruction.belief },
        { name: "Action", text: deconstruction.action }
    ];
    let ladderHtml = `<div class="p-4"><h3 class="text-2xl font-bold text-center mb-6">🪜 Deconstructing the Thought Process (Bottom-Up)</h3><div class="ladder-container">`;
    rungs.forEach(rung => {
            ladderHtml += `<div class="ladder-rung"><h4>${rung.name}</h4><p>${rung.text || "Not explicitly derived from context."}</p></div>`;
            // Add arrow between rungs, except after the last one
            if (rung.name !== "Action") {
                ladderHtml += `<div class="ladder-arrow">›</div>`;
            }
    });
    ladderHtml += `</div></div>`; // Close ladder-container and p-4
    ladderPanel.innerHTML = ladderHtml;


    // --- 2. Populate Reframing Panel ---
    const reframingPanel = dom.$("reframingPanel");
    reframingPanel.innerHTML = `<div class="p-4 space-y-6">
            <h3 class="text-2xl font-bold mb-4">🧠 Reframing the Perspective</h3>
        <div class="insight-card">
            <h4 class="text-lg font-bold text-yellow-300">❓ Critical Question to Challenge Assumptions:</h4>
            <p class="text-white/90 text-md mt-2">${reframing.critical_question || "N/A"}</p>
        </div>
        <div class="insight-card">
            <h4 class="text-lg font-bold">🪜 Building a New Path Up the Ladder:</h4>
            <p class="mt-2 text-sm"><strong>1. Broaden Observations:</strong> What else could be considered? <code>${reframing.new_observation || "N/A"}</code></p>
            <p class="mt-2 text-sm"><strong>2. New Interpretation:</strong> How else could this data be seen? <code>${reframing.new_interpretation || "N/A"}</code></p>
            <p class="mt-2 text-sm"><strong>3. New Conclusion:</strong> What different conclusion arises? <code>${reframing.new_conclusion || "N/A"}</code></p>
            <p class="mt-4 text-sm font-semibold">➡️ This reframed conclusion should lead to more constructive beliefs and actions.</p>
        </div>
    </div>`;

    // --- 3. Populate New Actions Panel ---
    const actionsPanel = dom.$("actionsPanel");
    let actionsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🚀 New Actions Based on Reframing</h3>`;
        if (new_actions.length > 0) {
        actionsHtml += `<div class="space-y-6">`;
        new_actions.forEach((p) => {
            actionsHtml += `<div class="prescription-card">
                <h4 class="text-xl font-bold">${p.action_name || "Unnamed Action"}</h4>
                <p class="rationale"><strong>Rationale (Linked to Reframing):</strong> ${p.rationale || "N/A"}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-indigo-300 mb-2">First Steps</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${(p.steps || []).map((a) => `<li>${a}</li>`).join("")}</ul>
                            ${!(p.steps && p.steps.length > 0) ? '<p class="text-white/60 italic text-xs">No specific first steps defined.</p>' : ''}
                    </div>
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-indigo-300 mb-2">KPIs to Track</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${(p.kpis || []).map((k) => `<li>${k}</li>`).join("")}</ul>
                            ${!(p.kpis && p.kpis.length > 0) ? '<p class="text-white/60 italic text-xs">No specific KPIs defined.</p>' : ''}
                    </div>
                </div>
            </div>`;
        });
        actionsHtml += `</div>`;
        } else {
            actionsHtml += `<p class="text-center text-white/70 italic">No specific new actions were formulated based on the reframing.</p>`;
        }
    actionsHtml += `</div>`;
    actionsPanel.innerHTML = actionsHtml;

    // --- 4. Populate Learn Framework Panel ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
        <div class="p-6 space-y-6 text-white/90">
            <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding the Ladder of Inference</h3>

            <p class="italic text-center">Developed by Chris Argyris, the Ladder of Inference describes the often unconscious thinking process we go through to get from an observation to a decision or action. Understanding it helps us challenge our assumptions and make better decisions.</p>
                
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div class="bg-gray-800/50 p-4 rounded-lg border border-gray-600/50 space-y-3">
                        <h4 class="text-xl font-bold text-indigo-300 mb-2">🪜 The Rungs (Bottom-Up)</h4>
                        <p class="text-sm"><strong>1. Observation:</strong> Selecting data from the pool of available reality.</p>
                        <p class="text-sm"><strong>2. Selection:</strong> Filtering and choosing specific data to pay attention to (often unconsciously).</p>
                        <p class="text-sm"><strong>3. Interpretation:</strong> Adding meaning to the selected data based on our mental models.</p>
                        <p class="text-sm"><strong>4. Assumption:</strong> Making assumptions based on the interpreted meaning.</p>
                        <p class="text-sm"><strong>5. Conclusion:</strong> Drawing conclusions based on our assumptions.</p>
                        <p class="text-sm"><strong>6. Belief:</strong> Adopting beliefs based on these conclusions.</p>
                        <p class="text-sm"><strong>7. Action:</strong> Taking action based on our beliefs.</p>
                    </div>
                    <div class="bg-black/20 p-4 rounded-lg space-y-4">
                    <h4 class="text-lg font-bold mb-2">⚠️ The Danger: Reflexive Loops</h4>
                    <p class="text-sm">Our beliefs influence what data we select next time, creating a "reflexive loop." This reinforces our existing beliefs and can prevent us from seeing contradictory evidence, leading to poor decisions.</p>
                        <h4 class="text-lg font-bold mb-2 mt-4">✅ Using the Ladder Constructively:</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                        <li><strong>Awareness:</strong> Become conscious of your own thinking process.</li>
                        <li><strong>Reflection:</strong> Question your assumptions and interpretations. Ask "Why do I believe this?"</li>
                        <li><strong>Inquiry:</strong> Seek out different perspectives and data you might have ignored. Ask others how they interpret the situation.</li>
                        <li><strong>Testing:</strong> Test your conclusions and assumptions explicitly.</li>
                    </ul>
                    <p class="text-xs italic mt-3">This tool helps by making the inferred ladder explicit (Deconstruction) and prompting a conscious effort to challenge it (Reframing).</p>
                    </div>
            </div>

                <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Why Use This Framework?</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm">
                    <li>Improves critical thinking and decision-making.</li>
                    <li>Helps uncover hidden assumptions and biases.</li>
                    <li>Facilitates better communication by making reasoning explicit.</li>
                    <li>Enables more effective problem-solving by addressing root mental models.</li>
                    <li>Reduces conflict arising from misunderstood perspectives.</li>
                </ul>
                </div>
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
                    // const chart = targetPanel.querySelector(".plotly-chart"); // If charts added later
                    // if (chart) Plotly.Plots.resize(chart);
            } else {
                    console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    setLoading("generate", false); // Stop loading indicator AFTER rendering
}

export {
    renderNovelGoalsPage_NS,
    renderCreativeDissonancePage_NS,
    renderLivingSystemPage_NS,
    renderThinkingSystemPage_NS
}
