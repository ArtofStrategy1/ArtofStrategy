// =====================================================================================================
// ===================         Strategic Planning Page Rendering Functions          ====================
// =====================================================================================================

import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';

/**
 * RENDERER: Mission Vision (DEEP ANALYSIS v4 - LAYOUT FIX)
 * - Fixes all layout/spacing issues by using `white-space: normal` and proper padding.
 * - Renders the full Mission, Vision, Values, and Goals into a 5-tab interface.
 * - Displays all new detailed data (breakdowns, initiatives, KPIs, etc.).
 */
function renderMissionVisionPage(container, data) {
    // --- THIS IS THE FIX FOR SPACING ---
    // This overrides the `white-space: pre-wrap;` style on the #analysisResult container
    container.style.whiteSpace = 'normal';
    // --- END OF FIX ---

    container.innerHTML = ""; // Clear loading indicator

    const { mission, vision, values, goals } = data;

    // --- Validation for the NEW deep structure ---
    if (!mission || !mission.statement || !Array.isArray(mission.breakdown) ||
        !vision || !vision.statement || !Array.isArray(vision.breakdown) ||
        !Array.isArray(values) || !Array.isArray(goals)) {
        console.error("Invalid data passed to renderMissionVisionPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Analysis data is incomplete or has the wrong structure.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    
    // --- Create Tab Navigation (5 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="summary">📊 Summary</button>
        <button class="analysis-tab-btn" data-tab="statements">📜 Mission & Vision</button>
        <button class="analysis-tab-btn" data-tab="values">🧭 Core Values</button>
        <button class="analysis-tab-btn" data-tab="goals">🎯 Strategic Goals</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Framework</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (5 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added padding (p-4 or p-6) to each panel for consistent spacing
    tabContent.innerHTML = `
        <div id="summaryPanel" class="analysis-tab-panel active p-4 md:p-6"></div>
        <div id="statementsPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="valuesPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="goalsPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="learnPanel" class="analysis-tab-panel p-4 md:p-6"></div>
    `;

    // --- 1. Populate Summary Panel ---
    const summaryPanel = dom.$("summaryPanel");
    summaryPanel.innerHTML = `
    <div class="space-y-8">
        <h3 class="text-3xl font-bold text-center mb-6">Strategic Foundation Summary</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div class="p-6 rounded-lg bg-black/20 border-l-4 border-indigo-400 glass-container">
                <h4 class="text-xl font-bold mb-3 text-indigo-300">🧬 Mission</h4>
                <p class="text-lg italic text-white/90">"${mission.statement}"</p>
            </div>
            <div class="p-6 rounded-lg bg-black/20 border-l-4 border-green-400 glass-container">
                <h4 class="text-xl font-bold mb-3 text-green-300">🚀 Vision</h4>
                <p class="text-lg italic text-white/90">"${vision.statement}"</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div class="bg-black/20 p-4 rounded-lg glass-container">
                <h4 class="text-lg font-bold mb-3 text-yellow-300">🧭 Top Core Values</h4>
                ${values.length > 0 ? 
                    `<ul class="list-disc list-inside space-y-1 text-sm text-white/80">
                        ${values.slice(0, 3).map(v => `<li><strong>${v.value}:</strong> ${v.description.substring(0, 80)}...</li>`).join('')}
                    </ul>` : 
                    `<p class="text-white/70 italic text-sm">No core values were extracted.</p>`
                }
            </div>
            <div class="bg-black/20 p-4 rounded-lg glass-container">
                <h4 class="text-lg font-bold mb-3 text-red-300">🎯 Top Strategic Goals</h4>
                ${goals.length > 0 ? 
                    `<ul class="list-disc list-inside space-y-1 text-sm text-white/80">
                        ${goals.slice(0, 3).map(g => `<li><strong>${g.goal_name}</strong></li>`).join('')}
                    </ul>` :
                    `<p class="text-white/70 italic text-sm">No strategic goals were extracted.</p>`
                }
            </div>
        </div>
    </div>
    `;

    // --- 2. Populate Mission & Vision Statements Panel ---
    const statementsPanel = dom.$("statementsPanel");
    statementsPanel.innerHTML = `
    <div class="space-y-8">
        <h3 class="text-3xl font-bold text-center mb-6">Mission & Vision Breakdown</h3>
        
        <div class="glass-container p-6">
            <h4 class="text-2xl font-bold mb-3 text-indigo-300">🧬 Mission Statement</h4>
            <blockquote class="p-4 italic text-lg border-l-4 border-indigo-400 bg-black/20 text-white/90 mb-6">
                "${mission.statement}"
            </blockquote>
            <h5 class="text-lg font-semibold mb-3">Component Breakdown:</h5>
            <div class="overflow-x-auto">
                <table class="coeff-table styled-table text-sm">
                    <thead><tr><th class="w-1/3">Component</th><th>Analysis (Based on Text)</th></tr></thead>
                    <tbody>
                        ${mission.breakdown.map(b => `
                            <tr>
                                <td class="font-semibold text-white/90">${b.component}</td>
                                <td class="text-white/80">${b.analysis}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="glass-container p-6">
            <h4 class="text-2xl font-bold mb-3 text-green-300">🚀 Vision Statement</h4>
            <blockquote class="p-4 italic text-lg border-l-4 border-green-400 bg-black/20 text-white/90 mb-6">
                "${vision.statement}"
            </blockquote>
            <h5 class="text-lg font-semibold mb-3">Component Breakdown:</h5>
            <div class="overflow-x-auto">
                <table class="coeff-table styled-table text-sm">
                    <thead><tr><th class="w-1/3">Component</th><th>Analysis (Based on Text)</th></tr></thead>
                    <tbody>
                        ${vision.breakdown.map(b => `
                            <tr>
                                <td class="font-semibold text-white/90">${b.component}</td>
                                <td class="text-white/80">${b.analysis}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;

    // --- 3. Populate Core Values Panel ---
    const valuesPanel = dom.$("valuesPanel");
    let valuesHtml = `<div class="space-y-6">
                        <h3 class="text-3xl font-bold text-center mb-8">🧭 Core Values</h3>
                        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">`;
    if (values.length > 0) {
        values.forEach((v_obj) => {
            valuesHtml += `
            <div class="insight-card border-l-4 border-yellow-400">
                <h4 class="text-xl font-bold mb-2">${v_obj.value}</h4>
                <p class="text-sm text-white/80 italic">${v_obj.description}</p>
            </div>
            `;
        });
    } else {
        valuesHtml += `<p class="text-white/70 italic text-center md:col-span-2">No core values were generated from the context.</p>`;
    }
    valuesHtml += `</div></div>`;
    valuesPanel.innerHTML = valuesHtml;


    // --- 4. Populate Strategic Goals Panel ---
    const goalsPanel = dom.$("goalsPanel");
    let goalsHtml = `<div class="space-y-6">
                        <h3 class="text-3xl font-bold text-center mb-8">🎯 Strategic Goals (${goals.length})</h3>
                        <div class="max-w-4xl mx-auto space-y-6">`;
    if (goals.length > 0) {
        goals.forEach((g_obj, index) => {
            goalsHtml += `
            <div class="prescription-card border-l-4 border-red-400">
                <h4 class="text-xl font-bold mb-2">${index + 1}. ${g_obj.goal_name}</h4>
                <p class="rationale"><strong>Rationale:</strong> ${g_obj.description}</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-indigo-300 mb-2">Key Initiatives</h5>
                        ${g_obj.key_initiatives && g_obj.key_initiatives.length > 0 ? 
                            `<ul class="list-disc list-inside space-y-1 text-white/90">${g_obj.key_initiatives.map(k => `<li>${k}</li>`).join('')}</ul>` :
                            `<p class="text-white/70 italic text-xs">No specific initiatives identified from text.</p>`
                        }
                    </div>
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-green-300 mb-2">KPIs to Track</h5>
                        ${g_obj.kpis_to_track && g_obj.kpis_to_track.length > 0 ? 
                            `<ul class="list-disc list-inside space-y-1 text-white/90">${g_obj.kpis_to_track.map(k => `<li>${k}</li>`).join('')}</ul>` :
                            `<p class="text-white/70 italic text-xs">No specific KPIs identified from text.</p>`
                        }
                    </div>
                </div>
            </div>
            `;
        });
    } else {
        goalsHtml += `<p class="text-white/70 italic text-center">No specific goals were generated from the context.</p>`;
    }
    goalsHtml += `</div></div>`;
    goalsPanel.innerHTML = goalsHtml;

    // --- 5. Populate Learn Panel (Fixed Layout) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="space-y-6 text-white/90 glass-container max-w-4xl mx-auto p-6 md:p-10">
        <h3 class="text-3xl font-bold text-center mb-4">🎓 Understanding Mission, Vision, Values & Goals</h3>
        
        

[Image of Mission, Vision, and Goals hierarchy]


        <div class="bg-black/20 p-4 rounded-lg border border-white/10">
            <h4 class="text-xl font-bold mb-2 text-indigo-300">🧬 What is a Mission Statement?</h4>
            <p class="text-sm text-white/80">A Mission statement defines the company's fundamental purpose. It's about the **PRESENT**.</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-white/80 mt-2 pl-4">
                <li><strong>What</strong> do we do? (Purpose)</li>
                <li><strong>Who</strong> do we do it for? (Audience)</li>
                <li><strong>Why</strong> do we do it? (Value Proposition)</li>
            </ul>
            <p class="text-sm text-white/80 mt-2"><strong>This tool's AI breaks down your text to find these three components and synthesizes a statement from them.</strong></p>
        </div>

        <div class="bg-black/20 p-4 rounded-lg border border-white/10">
            <h4 class="text-xl font-bold mb-2 text-green-300">🚀 What is a Vision Statement?</h4>
            <p class="text-sm text-white/80">A Vision statement describes the organization's desired future state. It's an aspirational declaration. It's about the **FUTURE**.</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-white/80 mt-2 pl-4">
                <li><strong>Where</strong> are we going? (Future State)</li>
                <li><strong>How</strong> will we win? (Differentiator)</li>
                <li><strong>What</strong> will be the result? (Impact)</li>
            </ul>
            <p class="text-sm text-white/80 mt-2"><strong>This tool's AI identifies your long-term ambitions from the text to construct a forward-looking vision.</strong></p>
        </div>

        <div class="bg-black/20 p-4 rounded-lg border border-white/10">
            <h4 class="text-xl font-bold mb-2 text-yellow-300">🧭 What are Core Values?</h4>
            <p class="text-sm text-white/80">Values are the guiding principles that define the company's culture and behavior. They are the **RULES** of conduct.</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-white/80 mt-2 pl-4">
                <li>How do we behave?</li>
                <li>What principles guide our decisions?</li>
            </ul>
            <p class="text-sm text-white/80 mt-2"><strong>This tool's AI scans your text for principles or cultural themes (e.g., "our commitment to innovation") and provides a description based on that context.</strong></p>
        </div>

        <div class="bg-black/20 p-4 rounded-lg border border-white/10">
            <h4 class="text-xl font-bold mb-2 text-red-300">🎯 What are Strategic Goals?</h4>
            <p class="text-sm text-white/80">Goals are the critical, high-level objectives that translate the aspirational Vision into specific, measurable targets. They are the **STEPS** to reach the vision.</p>
            <p class="text-sm text-white/80 mt-2">Good goals are often **S.M.A.R.T.** (Specific, Measurable, Achievable, Relevant, Time-bound).</p>
            <p class="text-sm text-white/80 mt-2"><strong>This tool's AI extracts major goals from your text and identifies their supporting initiatives and KPIs to create an actionable plan.</strong></p>
        </div>
    </div>
    `;

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the merged result
    dom.$("analysisActions").classList.remove("hidden"); // Show the 'Save PDF' / 'Save DOCX' buttons

    // Add tab switching logic
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


/**
 * RENDERER: Goals & Strategic Initiatives (Strategic Planning)
 * - NEW: Renders the full 6-tab OGSM interface.
 * - Includes: Cascade View, Objective, Goals, Strategies, Measures, and Learn tabs.
 */
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

    // --- Create Tab Navigation (6 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="cascade">🌊 Cascade View</button>
        <button class="analysis-tab-btn" data-tab="objective">🎯 Objective</button>
        <button class="analysis-tab-btn" data-tab="goals"> G Goals</button>
        <button class="analysis-tab-btn" data-tab="strategies"> S Strategies</button>
        <button class="analysis-tab-btn" data-tab="measures"> M Measures</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn OGSM</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (6 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="cascadePanel" class="analysis-tab-panel active"></div>
        <div id="objectivePanel" class="analysis-tab-panel"></div>
        <div id="goalsPanel" class="analysis-tab-panel"></div>
        <div id="strategiesPanel" class="analysis-tab-panel"></div>
        <div id="measuresPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Strategic Cascade Panel ---
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

    // --- 2. Populate Objective Panel ---
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


    // --- 3. Populate Goals Panel ---
    const goalsPanel = dom.$("goalsPanel");
    let goalsHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center"> G Goals</h3>`;
    goalsHtml += `<p class="text-sm text-white/70 mb-6 italic text-center">These are the specific, high-level results needed to achieve the main Objective.</p>`;
    goals.forEach((goal, index) => {
        goalsHtml += `<div class="cascade-goal-card max-w-3xl mx-auto p-4 border-l-4 border-red-400">
            <h4 class="text-md font-bold text-red-300">GOAL ${index + 1}</h4>
            <p class="text-lg font-semibold">${goal.goal_name}</p>
        </div>`;
    });
    goalsHtml += `</div>`;
    goalsPanel.innerHTML = goalsHtml;


    // --- 4. Populate Strategies Panel ---
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
         strategiesHtml += `</div></div>`;
    });
    strategiesHtml += `</div>`;
    strategiesPanel.innerHTML = strategiesHtml;


    // --- 5. Populate Measures Panel ---
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


    // --- 6. Populate Learn OGSM Panel ---
    const learnPanel = dom.$("learnPanel");
     learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding the OGSM Framework</h3>
        

[Image of OGSM framework diagram]

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



/**
 * RENDERER: Objectives (DEEP ANALYSIS v4 - 5 TABS)
 * - Renders the 5-tab layout.
 * - Tabs 1-3 are populated from the deep `data.ollama_data`
 * - Tab 4 is populated from the parsed `data.n8n_data`
 */
function renderObjectivesPage(container, data) {
    // --- THIS IS THE FIX FOR SPACING ---
    container.style.whiteSpace = 'normal';
    // --- END OF FIX ---
    
    container.innerHTML = ""; // Clear loading indicator

    const { ollama_data, n8n_data } = data;

    // --- Validation ---
    if (!ollama_data || !ollama_data.main_goal || !Array.isArray(ollama_data.smart_objectives) ||
        !Array.isArray(n8n_data)) {
        console.error("Invalid data passed to renderObjectivesPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Merged analysis data is incomplete or has the wrong structure.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    
    const { main_goal, smart_objectives } = ollama_data;

    // --- Create Tab Navigation (5 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="details">📋 S.M.A.R.T. Details</button>
        <button class="analysis-tab-btn" data-tab="plan">⚙️ Actions & Risks</button>
        <button class="analysis-tab-btn" data-tab="n8n">📑 n8n Table</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn S.M.A.R.T.</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (5 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    // Added padding (p-4 or p-6) to each panel
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active p-4 md:p-6"></div>
        <div id="detailsPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="planPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="n8nPanel" class="analysis-tab-panel p-4 md:p-6"></div>
        <div id="learnPanel" class="analysis-tab-panel p-4 md:p-6"></div>
    `;

    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="space-y-8">
        <div class="p-6 rounded-lg bg-black/20 border border-white/10 text-center glass-container max-w-3xl mx-auto">
            <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Main Goal (from Context)</h3>
            <p class="text-2xl italic text-white/90">${main_goal}</p>
        </div>
        <h3 class="text-2xl font-bold text-center">Formulated S.M.A.R.T. Objectives (${smart_objectives.length})</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
    
    if (smart_objectives.length > 0) {
        smart_objectives.forEach((obj) => {
            const breakdown = obj.smart_breakdown || {};
            dashboardHtml += `
                <div class="kpi-card">
                    <div><p class="kpi-name">${obj.objective_name || 'Unnamed Objective'}</p></div>
                    <div class="my-4">
                        <p class="text-xs text-white/70">Measurable By:</p>
                        <p class="text-lg font-bold text-indigo-300">${breakdown.measurable || 'N/A'}</p>
                    </div>
                    <div><p class="kpi-type">${breakdown.time_bound || 'N/A'}</p></div>
                </div>`;
        });
    } else {
        dashboardHtml += `<p class="col-span-full text-center text-white/60 italic">No S.M.A.R.T. objectives were generated by the deep analysis.</p>`;
    }
    dashboardHtml += `</div></div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Populate S.M.A.R.T. Details Panel ---
    const detailsPanel = dom.$("detailsPanel");
    let detailsHtml = `<div class="space-y-6"><h3 class="text-2xl font-bold mb-4 text-center">📋 S.M.A.R.T. Details</h3>`;
    if (smart_objectives.length > 0) {
        smart_objectives.forEach((obj) => {
            const s = obj.smart_breakdown || {}; 
            detailsHtml += `
                <div class="bg-black/20 p-5 rounded-lg border-l-4 border-indigo-400 glass-container max-w-4xl mx-auto">
                    <h4 class="text-xl font-bold mb-4">${obj.objective_name || 'Unnamed Objective'}</h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        <div class="border-b border-white/10 pb-2"><strong>S (Specific):</strong><br><span class="text-white/80">${s.specific || 'N/A'}</span></div>
                        <div class="border-b border-white/10 pb-2"><strong>M (Measurable):</strong><br><span class="text-white/80">${s.measurable || 'N/A'}</span></div>
                        <div class="border-b border-white/10 pb-2"><strong>A (Achievable):</strong><br><span class="text-white/80">${s.achievable || 'N/A'}</span></div>
                        <div class="border-b border-white/10 pb-2"><strong>R (Relevant):</strong><br><span class="text-white/80">${s.relevant || 'N/A'}</span></div>
                        <div class="border-b border-white/10 pb-2 col-span-full"><strong>T (Time-bound):</strong><br><span class="text-white/80">${s.time_bound || 'N/A'}</span></div>
                    </div>
                </div>
            `;
        });
    }
    detailsHtml += `</div>`;
    detailsPanel.innerHTML = detailsHtml;

    // --- 3. Populate Actions & Risks Panel ---
    const planPanel = dom.$("planPanel");
    let planHtml = `<div class="space-y-6"><h3 class="text-2xl font-bold mb-4 text-center">⚙️ Actions & Risks</h3>`;
    if (smart_objectives.length > 0) {
        smart_objectives.forEach((obj) => {
            planHtml += `
                <div class="prescription-card max-w-4xl mx-auto">
                    <h4 class="text-xl font-bold">${obj.objective_name || 'Unnamed Objective'}</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                        <div class="bg-black/20 p-3 rounded">
                            <h5 class="font-bold text-green-300 mb-2">Key Actions</h5>
                            <ul class="list-disc list-inside space-y-1 text-white/90">
                                ${(obj.key_actions && obj.key_actions.length > 0) 
                                    ? obj.key_actions.map(a => `<li>${a}</li>`).join('') 
                                    : '<li>No specific actions identified.</li>'}
                            </ul>
                        </div>
                        <div class="bg-black/20 p-3 rounded">
                            <h5 class="font-bold text-red-300 mb-2">Potential Risks</h5>
                            <ul class="list-disc list-inside space-y-1 text-white/90">
                                ${(obj.potential_risks && obj.potential_risks.length > 0) 
                                    ? obj.potential_risks.map(r => `<li>${r}</li>`).join('') 
                                    : '<li>No specific risks identified.</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    planHtml += `</div>`;
    planPanel.innerHTML = planHtml;

    // --- 4. Populate n8n Table Panel (NEW) ---
    const n8nPanel = dom.$("n8nPanel");
    let n8nHtml = `<div class="space-y-6">
                    <h3 class="text-3xl font-bold text-center mb-8">📑 n8n Workflow Output</h3>
                    <p class="text-center text-white/70 italic text-sm max-w-2xl mx-auto -mt-6">
                        This is the raw, table-based output from the base ` + "`objectives-v1`" + ` workflow, as parsed by the AI.
                    </p>
                    <div class="max-w-6xl mx-auto overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">`;
    
    if (n8n_data.length > 0) {
        const headers = Object.keys(n8n_data[0]);
        n8nHtml += `<thead><tr>`;
        headers.forEach(h => {
            n8nHtml += `<th>${h}</th>`;
        });
        n8nHtml += `</tr></thead><tbody>`;

        n8n_data.forEach(row => {
            n8nHtml += `<tr>`;
            headers.forEach(h => {
                n8nHtml += `<td class="text-white/80">${row[h] || 'N/A'}</td>`;
            });
            n8nHtml += `</tr>`;
        });
        n8nHtml += `</tbody>`;
    } else {
        n8nHtml += `<tbody><tr><td class="text-center text-white/70 italic p-4">No data was returned from the n8n workflow.</td></tr></tbody>`;
    }
    n8nHtml += `</table></div></div>`;
    n8nPanel.innerHTML = n8nHtml;


    // --- 5. Populate Learn S.M.A.R.T. Panel ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="space-y-6 text-white/90 glass-container max-w-4xl mx-auto p-6 md:p-10">
        <h3 class="text-3xl font-bold text-center mb-4">🎓 Understanding S.M.A.R.T. Objectives</h3>
        
        

[Image of S.M.A.R.T. acronym breakdown]


        <div class="bg-black/20 p-4 rounded-lg border border-white/10">
            <h4 class="text-xl font-bold mb-2 text-indigo-300">What does S.M.A.R.T. stand for?</h4>
            <p class="text-sm text-white/80">S.M.A.R.T. is a mnemonic acronym used to guide the setting of goals and objectives. To be S.M.A.R.T., an objective must be:</p>
        </div>

        <div class="space-y-4">
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-blue-400">
                <h4 class="text-lg font-bold text-blue-300">S - Specific</h4>
                <p class="text-sm text-white/80">Clearly state what needs to be accomplished. Answer the "W" questions: Who, What, Where, When, Which, Why.</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-green-400">
                <h4 class="text-lg font-bold text-green-300">M - Measurable</h4>
                <p class="text-sm text-white/80">Define concrete criteria for measuring progress and success. How will you know when it's done? (e.g., "Increase sales by 10%").</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-yellow-400">
                <h4 class="text-lg font-bold text-yellow-300">A - Achievable</h4>
                <p class="text-sm text-white/80">The objective should be challenging but realistic and attainable given available resources, constraints, and time.</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-red-400">
                <h4 class="text-lg font-bold text-red-300">R - Relevant</h4>
                <p class="text-sm text-white/80">The objective must align with the broader business goals and overall strategy. It must be worthwhile.</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-purple-400">
                <h4 class="text-lg font-bold text-purple-300">T - Time-bound</h4>
                <p class="text-sm text-white/80">The objective must have a clear target date or timeframe (e.g., "by the end of Q3", "within 6 months"). This creates urgency.</p>
            </div>
        </div>
        
            <div class="bg-black/20 p-4 rounded-lg mt-6 border border-white/10">
            <h4 class="text-lg font-bold mb-2">Why Use S.M.A.R.T.?</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                <li>Provides clarity and focus for everyone involved.</li>
                <li>Eliminates ambiguity and sets clear expectations.</li>
                <li>Makes it easy to track progress and identify when you've succeeded.</li>
                <li>Ensures that objectives are aligned with the company's main goals.</li>
            </ul>
        </div>
    </div>
    `;

    // --- Final Touches ---
    appState.analysisCache[appState.currentTemplateId] = container.innerHTML; // Cache the merged result
    dom.$("analysisActions").classList.remove("hidden"); // Show the 'Save PDF' / 'Save DOCX' buttons

    // Add tab switching logic
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
}



function renderActionPlansPage_AP(container, data) {
    container.innerHTML = ""; // Clear loading

    // --- Validation for new fields ---
    if (!data || !data.project_name || !data.action_items) {
        console.error("Incomplete data passed to renderActionPlansPage_AP:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Action Plan results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    // --- NEW CHECK FOR UNANALYZABLE TEXT ---
    // If the AI returns no action items and the project name contains "analyz", it's an error.
    if (data.action_items.length === 0 && data.project_name.toLowerCase().includes("analyz")) {
        console.warn("Data is unanalyzable. Displaying summary as error.");
        container.innerHTML = `<div class="p-4 text-center text-yellow-300">
                                    <h4 class="text-xl font-bold mb-3">Analysis Incomplete</h4>
                                    <p class="text-white/80">${data.project_name}</p>
                                    <p class="text-sm text-white/70 mt-2">Please try again with text describing a project, goal, or company plan.</p>
                                </div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        return; // Stop rendering
    }
    // --- END NEW CHECK ---

    const {
        project_name,
        action_items
    } = data;

    // --- Create Tab Navigation (Updated with MORE Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="timeline">🗓️ Timeline View</button> <button class="analysis-tab-btn" data-tab="details">📋 Task Details</button>
        <button class="analysis-tab-btn" data-tab="resources">🔗 Resources & Dependencies</button> <button class="analysis-tab-btn" data-tab="tracking">📊 Priorities & KPIs</button> <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Action Planning</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated with MORE Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="timelinePanel" class="analysis-tab-panel active"></div>
        <div id="detailsPanel" class="analysis-tab-panel"></div>
        <div id="resourcesPanel" class="analysis-tab-panel"></div> <div id="trackingPanel" class="analysis-tab-panel"></div> <div id="learnPanel" class="analysis-tab-panel"></div>
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
            if (timeline.includes('phase')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 100; // Give phases a high value
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
                <div class="action-card bg-black/20 p-4 rounded-lg border-l-4 border-gray-500"> <h4 class="text-lg font-bold mb-2">${index + 1}. ${item.task_name}</h4>
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
        const priorityOrder = {
            'High': 1,
            'Medium': 2,
            'Low': 3
        };
        const sortedByPriority = [...action_items].sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));

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



/**
 * RENDERER: KPI & Critical Events (Strategic Planning)
 * - NEW: Re-engineered to render the `kpi_groups` structure.
 * - Tab 1 (Dashboard): Cleaned up. Shows Goal, Summary, and Critical Events.
 * - Tab 2 (KPI Details): NEW grouped layout. Renders KPIs under their parent construct.
 * - Tabs 3, 4, 5 (Timeline, Event Details, Learn): Unchanged, as they were already good.
 */
function renderKpiPage_KE(container, data) {
    container.innerHTML = ""; // Clear loading state

    // --- Input Data Validation (for NEW kpi_groups structure) ---
    if (!data || typeof data !== 'object' ||
        !data.main_goal || typeof data.main_goal !== 'string' ||
        !Array.isArray(data.kpi_groups) || // Check for kpi_groups
        !Array.isArray(data.critical_events) ||
        !data.performance_summary || typeof data.performance_summary !== 'string')
    {
        console.error("Incomplete or invalid data passed to renderKpiPage_KE (v2):", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received (kpi_groups missing). Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    // Destructure data *after* validation
    const { main_goal, kpi_groups, critical_events, performance_summary } = data;
    const all_kpis_flat = kpi_groups.flatMap(g => g.kpis); // For the "Learn" tab example, if needed

    // --- Create Tab Navigation (5 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
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

    // --- 1. Populate KPI Dashboard Panel (NEW CLEANED VERSION) ---
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
            <h3 class="text-2xl font-bold text-center">Critical Events</h3>`;

        if (critical_events.length > 0) {
             dashboardHtml += `<div class="grid grid-cols-1 md:grid-cols-${Math.min(critical_events.length, 3)} gap-6">`;
             critical_events.forEach((event) => {
                 if (event && typeof event === 'object' && event.hasOwnProperty('event_name')) {
                     const importanceColor = event.importance === 'High' ? 'border-red-500' : 'border-yellow-500';
                     dashboardHtml += `
                        <div class="summary-stat-card text-left p-4 border-l-4 ${importanceColor}">
                            <p class="font-bold text-lg text-white">${event.event_name || 'Unnamed Event'}</p>
                            <p class="text-sm text-white/80">${event.description || 'N/A'}</p>
                            <p class="text-xs text-indigo-300 font-semibold mt-2">Timeline: ${event.timeline || 'N/A'}</p>
                        </div>`;
                 }
             });
             dashboardHtml += `</div>`; // Close grid
        } else {
            dashboardHtml += `<p class="col-span-full text-center text-white/60 italic">No critical events identified.</p>`;
        }
        dashboardHtml += `</div>`; // Close p-4 space-y-8
        dashboardPanel.innerHTML = dashboardHtml;
    } catch (e) {
         console.error("Error rendering Dashboard Panel:", e);
         dom.$("dashboardPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering dashboard.</div>`;
    }

    // --- 2. Populate KPI Details Panel (NEW GROUPED VERSION) ---
    try {
        const kpiDetailsPanel = dom.$("kpiDetailsPanel");
        let kpiDetailsHtml = `<div class="p-4 space-y-8"><h3 class="text-2xl font-bold mb-4 text-center">📋 KPI Details (Grouped by Construct)</h3>`;

        if (kpi_groups.length > 0) {
            kpi_groups.forEach((group) => {
                if (group && typeof group === 'object' && group.construct_name && Array.isArray(group.kpis)) {
                    kpiDetailsHtml += `
                        <div class="bg-black/10 p-4 rounded-lg">
                            <h4 class="text-xl font-semibold mb-3 text-indigo-300">${group.construct_name}</h4>
                            <div class="overflow-x-auto">
                                <table class="coeff-table styled-table text-sm">
                                    <thead><tr>
                                        <th>KPI (Indicator)</th>
                                        <th>Measurement Scale / Formula</th>
                                        <th>Type</th>
                                    </tr></thead>
                                    <tbody>`;
                    
                    if (group.kpis.length > 0) {
                        group.kpis.forEach((kpi) => {
                            if (kpi && typeof kpi === 'object' && kpi.hasOwnProperty('name')) {
                                kpiDetailsHtml += `<tr>
                                    <td class="font-semibold">${kpi.name || 'Unnamed KPI'}</td>
                                    <td class="font-mono text-xs">${kpi.formula || 'N/A'}</td>
                                    <td class="text-white/70">${kpi.type || 'N/A'}</td>
                                </tr>`;
                            }
                        });
                    } else {
                        kpiDetailsHtml += `<tr><td colspan="3" class="text-center text-white/60 italic p-4">No KPIs identified for this construct.</td></tr>`;
                    }

                    kpiDetailsHtml += `</tbody></table></div></div>`; // Close table div and group div
                }
            });
        } else {
            kpiDetailsHtml += `<p class="text-center text-white/60 italic p-4">No KPI groups were identified from the text.</p>`;
        }
        kpiDetailsHtml += `</div>`; // Close p-4
        kpiDetailsPanel.innerHTML = kpiDetailsHtml;
    } catch (e) {
         console.error("Error rendering KPI Details Panel:", e);
         dom.$("kpiDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering KPI details.</div>`;
    }

    // --- 3. Populate Events Timeline Panel (Unchanged) ---
    try {
        const timelinePanel = dom.$("timelinePanel");
        let timelineHtml = `<div class="p-4"><h2 class="text-3xl font-bold text-center mb-8">${main_goal} - Critical Events Timeline</h2><div class="action-plan-container flex flex-col items-center">`;
        if (critical_events.length > 0) {
            const sorted_events = [...critical_events].sort((a, b) => {
                 const getTimeValue = (timeline) => {
                     timeline = String(timeline || '').toLowerCase();
                     if (timeline.includes('week')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 7;
                     if (timeline.includes('month')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 30;
                     if (timeline.includes('q')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 90;
                     if (timeline.includes('year')) return parseInt(timeline.match(/\d+/)?.[0] || '0') * 365;
                     return 9999;
                 };
                 return getTimeValue(a.timeline) - getTimeValue(b.timeline);
             });

            sorted_events.forEach((event) => {
                 if (event && typeof event === 'object' && event.hasOwnProperty('event_name')) {
                    const importanceColor = event.importance === 'High' ? '#ef4444' : '#f97316';
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
                 }
            });
        } else {
            timelineHtml += `<p class="text-center text-white/70 italic">No critical events were identified from the text.</p>`;
        }
        timelineHtml += `</div></div>`;
        timelinePanel.innerHTML = timelineHtml;
    } catch (e) {
        console.error("Error rendering Timeline Panel:", e);
        dom.$("timelinePanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering timeline.</div>`;
    }

    // --- 4. Populate Event Details Panel (Unchanged) ---
    try {
        const eventDetailsPanel = dom.$("eventDetailsPanel");
        let eventDetailsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">📝 Event Details</h3>`;
        eventDetailsHtml += `<div class="overflow-x-auto">
                            <table class="coeff-table styled-table text-sm">
                                <thead><tr><th>Event Name</th><th>Description (Completion Criteria)</th><th>Timeline</th><th>Importance</th></tr></thead>
                                <tbody>`;
        if (critical_events.length > 0) {
            critical_events.forEach((event) => {
                 if (event && typeof event === 'object' && event.hasOwnProperty('event_name')) {
                    const importanceColor = event.importance === 'High' ? 'text-red-400' : 'text-yellow-400';
                    eventDetailsHtml += `<tr>
                                    <td class="font-semibold">${event.event_name || 'Unnamed Event'}</td>
                                    <td class="text-white/80">${event.description || 'N/A'}</td>
                                    <td class="text-white/70">${event.timeline || 'N/A'}</td>
                                    <td><span class="font-bold ${importanceColor}">${event.importance || 'N/A'}</span></td>
                                  </tr>`;
                 }
            });
        } else {
            eventDetailsHtml += `<tr><td colspan="4" class="text-center text-white/60 italic p-4">No event details were identified from the text.</td></tr>`;
        }
        eventDetailsHtml += `</tbody></table></div></div>`;
        eventDetailsPanel.innerHTML = eventDetailsHtml;
    } catch (e) {
        console.error("Error rendering Event Details Panel:", e);
        dom.$("eventDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering event details.</div>`;
    }

    // --- 5. Populate Learn KPIs & Milestones Panel (Unchanged) ---
    try {
        const learnPanel = dom.$("learnPanel");
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
                        <li><strong>In Research:</strong> KPIs are often the specific *indicators* or *survey questions* used to measure a larger, abstract *construct*.</li>
                        <li><strong>Types:</strong>
                            <ul class="list-[circle] list-inside pl-4 text-xs">
                               <li><strong>Lagging Indicators:</strong> Measure past performance (e.g., Revenue, Churn Rate).</li>
                               <li><strong>Leading Indicators:</strong> Measure activities likely to drive future results (e.g., Website Visits, Training Hours).</li>
                               <li><strong>Operational:</strong> Measures process efficiency (e.g., Website responsiveness).</li>
                               <li><strong>Customer:</strong> Measures perception/behavior (e.g., NPS, CSAT).</li>
                            </ul>
                        </li>
                    </ul>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-2 text-yellow-300">🗓️ Critical Events (Milestones)</h4>
                     <ul class="list-disc list-inside space-y-2 text-sm">
                        <li><strong>Definition:</strong> Significant points or achievements in a project or strategic initiative timeline.</li>
                        <li><strong>Examples:</strong> Project Kick-off, Design Approval, Product Launch, Funding Secured, Regulatory Approval, First Customer Acquired.</li>
                        <li><strong>In Research:</strong> Milestones include "Conduct Survey," "Analyze Data," and "Present Findings," or "Develop Roadmap."</li>
                        <li><strong>Purpose:</strong> Break down large projects, track progress, provide clear deadlines, facilitate communication.</li>
                     </ul>
                </div>
            </div>
             <div class="bg-black/20 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-bold mb-2">Connecting KPIs and Milestones</h4>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li>Milestones mark *when* key things happen; KPIs measure *how well* things are happening.</li>
                    <li>Achieving a milestone (e.g., "Launch Survey") enables the measurement of KPIs (e.g., "NPS").</li>
                    <li>KPI trends (e.g., "Low CSAT") can trigger the need for new projects with new milestones.</li>
                </ul>
            </div>
             <p class="text-xs text-center text-white/60 mt-4">This tool uses AI to identify potential KPIs (as indicators) and Critical Events based strictly on the goal/project description you provided.</p>
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
        dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    } catch (e) {
         console.error("Error setting up final touches (tabs, cache, buttons):", e);
         if (!container.innerHTML.includes('text-red-400')) {
              container.innerHTML += `<div class="p-4 text-center text-red-400">Error setting up UI components.</div>`;
         }
    }
}



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
    renderMissionVisionPage,
    renderFullSwotTowsPage,
    renderGoalsAndInitiativesPage_SP,
    renderObjectivesPage,
    renderActionPlansPage_AP,
    renderKpiPage_KE,
    renderMiscPage_MSC
}