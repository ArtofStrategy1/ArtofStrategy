// =====================================================================================================
// ===================          Systems Thinking Page Rendering Functions           ====================
// =====================================================================================================
import { dom } from "../../utils/dom-utils.mjs";
import { appState } from "../../state/app-state.mjs";
import { animateElements } from "../../utils/ui-utils.mjs";
import { generateProcessMappingMermaidCode, parseFishboneData, buildDotString } from '../../diagrams/diagram-generation.mjs'
import { renderMermaidDiagram, renderFishboneDiagram } from '../../diagrams/diagram-renderer.mjs'
import { fitDiagram, resetZoom, exportPNG } from "../../diagrams/diagram-utils.mjs";

function renderProcessMappingPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator
    // Add validation for new fields
    if (!data || !data.process_name || !data.steps || !data.connections || !data.bottlenecks || !data.optimizations || !data.kpis) {
        console.error("Incomplete data passed to renderProcessMappingPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Process Map results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    const { process_name, steps, connections, bottlenecks, optimizations, kpis } = data;


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="flowchart">🗺️ Process Flowchart</button>
        <button class="analysis-tab-btn" data-tab="details">📋 Step Details</button>
        <button class="analysis-tab-btn" data-tab="optimizations">✨ Optimizations</button> <!-- New Tab -->
        <button class="analysis-tab-btn" data-tab="kpis">📊 KPIs & Bottlenecks</button> <!-- Renamed & Combined -->
        <button class="analysis-tab-btn" data-tab="mermaid"> Mermaid Diagram</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Mapping</button> <!-- New Tab -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="flowchartPanel" class="analysis-tab-panel active"></div>
        <div id="detailsPanel" class="analysis-tab-panel"></div>
        <div id="optimizationsPanel" class="analysis-tab-panel"></div> <!-- New Panel -->
        <div id="kpisPanel" class="analysis-tab-panel"></div> <!-- Renamed Panel -->
        <div id="mermaidPanel" class="analysis-tab-panel">
            <h3 class="text-2xl font-bold mb-4">Mermaid Process Diagram</h3>
            <div id="diagram-container" class="mermaid"></div>
        </div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New Panel -->
    `;

    // --- 1. Populate Flowchart Panel (Keep as is, but add better icons) ---
    const flowchartPanel = dom.$("flowchartPanel");
    let flowchartHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-6 text-center">${process_name}</h3><div class="space-y-2 max-w-lg mx-auto">`; // Centered flowchart

    const stepMap = new Map(steps.map((step) => [step.id, step]));

    steps.forEach((step, index) => {
        let stepClass = "bg-black/20 p-3 rounded-lg border-l-4 flex items-center gap-3 ";
        let icon = "▶️"; // Default
        switch (step.type.toLowerCase()) {
            case "start": stepClass += "border-green-400"; icon = "🏁"; break;
            case "end": stepClass += "border-red-400"; icon = "🛑"; break;
            case "decision": stepClass += "border-yellow-400"; icon = "🤔"; break;
            case "sub-process": stepClass += "border-purple-400"; icon = "🧩"; break; // Added sub-process
            default: stepClass += "border-blue-400"; icon = "⚙️"; // Task
        }
        flowchartHtml += `<div class="${stepClass}">
                            <span class="text-xl">${icon}</span>
                            <div>
                                <p class="font-bold text-md">${step.name}</p>
                                <p class="text-xs text-white/70">Owner: ${step.owner || 'N/A'}</p>
                            </div>
                        </div>`;

        // Add connection arrow and label if not the last step
        // Find connections originating FROM this step
        const outgoingConnections = connections.filter(c => c.from === step.id);
        if (outgoingConnections.length > 0) {
            if (outgoingConnections.length === 1) {
                // Single outgoing path
                const connection = outgoingConnections[0];
                const label = connection.label || "Next";
                flowchartHtml += `<div class="text-center text-white/50 text-2xl font-light leading-none my-1" aria-hidden="true">↓ <span class="text-xs font-sans align-middle">${label}</span></div>`;
            } else {
                // Multiple outgoing paths (likely from a decision)
                flowchartHtml += `<div class="text-center text-white/50 text-lg font-light leading-none my-1 flex justify-around items-center" aria-hidden="true">`;
                outgoingConnections.forEach(conn => {
                    const targetStepName = stepMap.get(conn.to)?.name || `Step ${conn.to}`;
                    flowchartHtml += `<span class="text-xs font-sans">↘️ ${conn.label || ''} (to ${targetStepName})</span>`;
                });
                flowchartHtml += `</div>`;
            }
        } else if (step.type.toLowerCase() !== 'end' && index < steps.length - 1) {
            // If no connection defined but not the end, assume 'Next'
            flowchartHtml += `<div class="text-center text-white/50 text-2xl font-light leading-none my-1" aria-hidden="true">↓ <span class="text-xs font-sans align-middle">Next</span></div>`;
        }

    });
    flowchartHtml += "</div></div>"; // Close space-y-2 and p-4
    flowchartPanel.innerHTML = flowchartHtml;

    // --- 2. Populate Step Details Panel (Keep table) ---
    const detailsPanel = dom.$("detailsPanel");
    let detailsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Detailed Step Breakdown</h3><div class="overflow-x-auto"><table class="coeff-table styled-table text-sm">
        <thead><tr><th>ID</th><th>Step Name</th><th>Owner/Role</th><th>Type</th><th>Description</th></tr></thead><tbody>`;
    steps.forEach((step) => {
        detailsHtml += `<tr>
            <td>${step.id}</td>
            <td class="font-semibold">${step.name}</td>
            <td>${step.owner || 'N/A'}</td>
            <td>${step.type}</td>
            <td class="text-white/80">${step.description}</td></tr>`;
    });
    detailsHtml += `</tbody></table></div></div>`;
    detailsPanel.innerHTML = detailsHtml;

    // --- 3. Populate Optimizations Panel (New) ---
    const optimizationsPanel = dom.$("optimizationsPanel");
    let optimizationsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">✨ Potential Optimizations</h3>`;
    if (optimizations && optimizations.length > 0) {
        optimizationsHtml += `<p class="text-sm text-white/70 mb-6 italic">Based on the process description, consider these improvements, particularly for identified bottlenecks.</p>`;
        optimizationsHtml += `<div class="space-y-6">`;
        optimizations.forEach((opt, index) => {
            optimizationsHtml += `
                <div class="prescription-card border-l-4 border-green-500">
                    <h4 class="text-xl font-bold">${index + 1}. ${opt.suggestion}</h4>
                    <p class="text-xs font-semibold my-1 text-indigo-300">TARGET STEP: ${opt.target_step_name || 'N/A'} | TYPE: ${opt.type || 'N/A'}</p>
                    <p class="rationale"><strong>Rationale:</strong> ${opt.rationale || 'N/A'}</p>
                </div>`;
        });
        optimizationsHtml += `</div>`;
    } else {
        optimizationsHtml += `<p class="text-center text-white/70 italic">No specific optimization opportunities were clearly identified from the provided process description.</p>`;
    }
    optimizationsHtml += `</div>`;
    optimizationsPanel.innerHTML = optimizationsHtml;

    // --- 4. Populate KPIs & Bottlenecks Panel (New/Combined) ---
    const kpisPanel = dom.$("kpisPanel");
    let kpisHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">📊 KPIs & Bottlenecks</h3>`;
    // Bottlenecks first
    if (bottlenecks && bottlenecks.length > 0) {
        kpisHtml += `<h4 class="text-xl font-semibold mb-3 text-red-300">⚠️ Identified Potential Bottlenecks</h4><div class="space-y-3 mb-8">`;
        bottlenecks.forEach((b) => {
            kpisHtml += `<div class="metric-card border-l-4 border-red-400">
                            <p class="font-bold">${b.step_name}</p>
                            <p class="text-sm text-white/80 italic">${b.reason}</p>
                        </div>`;
        });
        kpisHtml += `</div>`;
    } else {
        kpisHtml += `<p class="text-center text-white/70 italic mb-8">No clear bottlenecks were identified from the provided description.</p>`;
    }
    // Then KPIs
    if (kpis && kpis.length > 0) {
        kpisHtml += `<h4 class="text-xl font-semibold mb-3 text-green-300">✅ Recommended KPIs</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        kpis.forEach((k) => {
            kpisHtml += `<div class="summary-stat-card text-left p-4 border-l-4 border-green-400">
                            <p class="font-bold text-lg text-white">${k.name}</p>
                            <p class="text-sm text-white/80">${k.description}</p>
                        </div>`;
        });
        kpisHtml += `</div>`;
    } else {
        kpisHtml += `<p class="text-center text-white/70 italic">No specific KPIs were recommended based on the description.</p>`;
    }
    kpisHtml += `</div>`; // Close p-4
    kpisPanel.innerHTML = kpisHtml;


    // --- Populate Mermaid Panel and Render Diagram ---
    const mermaidPanel = dom.$("mermaidPanel");
    if (mermaidPanel) {
        const mermaidCode = generateProcessMappingMermaidCode(data); // Generate Mermaid code
        const diagramContainer = mermaidPanel.querySelector("#diagram-container");

        if (diagramContainer) { // Store mermaidCode and container for deferred rendering
            diagramContainer.dataset.mermaidCode = mermaidCode; // Store code in a data attribute
            diagramContainer.innerHTML = `<pre class="mermaid">${mermaidCode}</pre>`; // Display code for debugging/inspection
            // window.renderMermaidDiagram(diagramContainer, mermaidCode);
        }
    }


    // --- 5. Populate Learn Mapping Panel (New) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Process Mapping</h3>
        [Image of a business process map]
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is Process Mapping?</h4>
            <p class="text-sm text-white/80">Process mapping is a technique used to visually represent the sequence of steps, decisions, and handoffs involved in a specific work process from beginning to end. It helps teams understand, analyze, and improve workflows.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Common Symbols (Simplified):</h4>
                <ul class="space-y-2 text-sm">
                    <li><span class="font-mono text-xl mr-2">🏁</span> <strong>Start/End:</strong> Oval shapes indicating the beginning or end points.</li>
                    <li><span class="font-mono text-xl mr-2">⚙️</span> <strong>Task/Activity:</strong> Rectangles representing a specific action or step.</li>
                    <li><span class="font-mono text-xl mr-2">🤔</span> <strong>Decision:</strong> Diamonds indicating a point where a choice is made (usually with Yes/No branches).</li>
                    <li><span class="font-mono text-xl mr-2">🧩</span> <strong>Sub-process:</strong> Rectangle with double vertical lines, representing a predefined, separate process.</li>
                    <li><span class="font-mono text-xl mr-2">↓→</span> <strong>Flow Lines:</strong> Arrows showing the direction and sequence of steps.</li>
                    <li><span class="font-mono text-xl mr-2">📄</span> <strong>Document/Data:</strong> Often represented by a rectangle with a wavy bottom.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Why Map Processes?</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Clarity & Understanding:</strong> Provides a clear visual representation of how work gets done.</li>
                    <li><strong>Identify Inefficiencies:</strong> Highlights bottlenecks, redundancies, delays, and unnecessary steps.</li>
                    <li><strong>Improvement Foundation:</strong> Serves as a baseline for optimization efforts (simplification, automation).</li>
                    <li><strong>Standardization:</strong> Helps define and communicate standard operating procedures.</li>
                    <li><strong>Training:</strong> Useful tool for onboarding new team members.</li>
                    <li><strong>Role Clarity:</strong> Shows who is responsible for each step.</li>
                </ul>
            </div>
        </div>

        <details class="styled-details text-sm mt-4">
            <summary class="font-semibold">Tips for Effective Process Mapping</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p><strong>1. Define Scope Clearly:</strong> Know where the process starts and ends.</p>
                <p><strong>2. Involve the Right People:</strong> Include those who actually perform the work.</p>
                <p><strong>3. Observe the Real Process:</strong> Don't just rely on documented procedures; see how it actually happens.</p>
                <p><strong>4. Keep it Simple Initially:</strong> Start with a high-level map, then add detail as needed.</p>
                <p><strong>5. Use Consistent Symbols:</strong> Stick to a standard set of shapes for clarity.</p>
                <p><strong>6. Focus on Flow, Not Just Steps:</strong> Show handoffs, decisions, and potential loops.</p>
                <p><strong>7. Validate the Map:</strong> Review with stakeholders to ensure accuracy.</p>
                <p><strong>8. Use it for Action:</strong> The map is a tool for analysis and improvement, not just documentation.</p>
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
                // No Plotly charts expected in this version, so no resize needed
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }

            // If the Mermaid tab is activated, render the diagram
            if (e.target.dataset.tab === "mermaid") {
                const mermaidContainer = targetPanel.querySelector("#diagram-container");
                if (mermaidContainer && mermaidContainer.dataset.mermaidCode) {
                    // Clear previous content and render
                    mermaidContainer.innerHTML = ``; // Clear raw code or placeholder
                    renderMermaidDiagram(mermaidContainer, mermaidContainer.dataset.mermaidCode);
                }
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderParetoFishbonePage(container, data) {
    container.innerHTML = ""; // Clear loading
    // Basic validation
    if (!data || !data.problem_statement || !data.fishbone || !data.pareto_analysis || !data.action_plan) {
        console.error("Incomplete data passed to renderParetoFishbonePage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Pareto/Fishbone results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    const { problem_statement, fishbone, pareto_analysis, action_plan } = data;

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="pareto">📊 Pareto Chart & Summary</button>
        <button class="analysis-tab-btn" data-tab="fishbone">🐟 Fishbone Diagram</button>
        <button class="analysis-tab-btn" data-tab="fishboneDiagram">Fishbone DiagramC</button>
        <button class="analysis-tab-btn" data-tab="action">🎯 Action Plan (Vital Few)</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Techniques</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="paretoPanel" class="analysis-tab-panel active"></div>
        <div id="fishbonePanel" class="analysis-tab-panel"></div>
        <div id="fishboneDiagramPanel" class="analysis-tab-panel"></div>
        <div id="actionPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Pareto Chart & Summary Tab ---
    const paretoPanel = dom.$("paretoPanel");
    paretoPanel.innerHTML = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-4 text-center">Pareto Analysis (80/20 Rule)</h3>
        <p class="text-center text-lg italic text-white/80 mb-6">Problem: ${problem_statement}</p>
        <div id="paretoChartContainer" class="w-full h-[550px] plotly-chart bg-black/10 rounded-lg mb-8"></div>
        <h4 class="text-xl font-semibold mb-3">Analysis Summary:</h4>
        <blockquote class="p-3 italic border-l-4 border-gray-500 bg-black/20 text-white/90 text-sm">
            ${pareto_analysis.analysis_summary || "Summary unavailable."}
        </blockquote>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
            <div class="bg-red-900/20 p-3 rounded border border-red-500/50">
                <h5 class="font-bold text-red-300 mb-1">🔥 Vital Few (${pareto_analysis.vital_few.length} causes)</h5>
                <p class="text-xs text-white/70 mb-2">Focus improvement efforts here (~80% of impact).</p>
                <ul class="list-disc list-inside space-y-1">
                    ${pareto_analysis.vital_few.map(item => `<li>${item.cause} (${item.impact_score}%)</li>`).join("")}
                </ul>
            </div>
            <div class="bg-gray-700/20 p-3 rounded border border-gray-500/50">
                <h5 class="font-bold text-gray-300 mb-1">📋 Useful Many (${pareto_analysis.useful_many.length} causes)</h5>
                <p class="text-xs text-white/70 mb-2">Address later or if resources allow (~20% of impact).</p>
                <ul class="list-disc list-inside space-y-1">
                    ${pareto_analysis.useful_many.map(item => `<li>${item.cause} (${item.impact_score}%)</li>`).join("")}
                </ul>
            </div>
        </div>
    </div>`;
    // Render the Pareto chart
    try {
        createParetoChartJS(pareto_analysis, "paretoChartContainer"); // Use the existing chart function
    } catch(e) {
        console.error("Error rendering Pareto chart:", e);
        dom.$("paretoChartContainer").innerHTML = "<p class='p-4 text-center text-red-400'>Could not render Pareto chart.</p>";
    }

    // --- 2. Populate Fishbone Diagram Tab (Textual) ---
    const fishbonePanel = dom.$("fishbonePanel");
    let fishboneHtml = `<div class="p-4">
        <h3 class="text-2xl font-bold mb-4 text-center">Fishbone Diagram (Ishikawa) - Potential Causes</h3>
        <p class="text-center text-lg italic text-white/80 mb-6">Problem: ${problem_statement}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

    const standardCategories = ["Methods", "Machines", "Materials", "Manpower", "Measurement", "Environment"];
    standardCategories.forEach(category => {
        const subCauses = fishbone[category] || [];
        // Highlight vital few causes within the fishbone list
        const causesHtml = subCauses.map(cause => {
            const isVital = pareto_analysis.vital_few.some(item => item.cause.toLowerCase() === cause.toLowerCase());
            return `<li class="${isVital ? 'font-semibold text-red-300' : 'text-white/80'}">${isVital ? '🔥 ' : ''}${cause}</li>`;
        }).join("");

        fishboneHtml += `
            <div class="bg-white/5 p-3 rounded-lg border-t-4 border-indigo-400">
                <h4 class="font-semibold text-lg mb-2 text-indigo-300">${category}</h4>
                ${subCauses.length > 0
                    ? `<ul class="list-disc list-inside space-y-1 text-sm">${causesHtml}</ul>`
                    : `<p class="text-sm italic text-white/60">(No specific causes identified from context)</p>`
                }
            </div>`;
    });

    fishboneHtml += `</div></div>`; // Close grid and p-4
    fishbonePanel.innerHTML = fishboneHtml;


    // --- 3. Populate Action Plan Tab ---
    const actionPanel = dom.$("actionPanel");
    let actionHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">🎯 Action Plan (Focus on Vital Few)</h3>`;
    if (action_plan && action_plan.length > 0) {
        actionHtml += `<p class="text-sm text-white/70 mb-6 italic">Concentrate resources on addressing these high-impact causes identified in the Pareto analysis.</p>`;
        actionHtml += `<div class="space-y-6">`;
        action_plan.forEach((action, index) => {
            let impactClass = "text-yellow-400"; // Medium default
            if (action.potential_impact?.toLowerCase() === 'high') impactClass = "text-green-400";
            else if (action.potential_impact?.toLowerCase() === 'low') impactClass = "text-red-400";

            actionHtml += `
                <div class="prescription-card border-l-4 border-yellow-500">
                    <h4 class="text-xl font-bold">${index + 1}. ${action.action_suggestion}</h4>
                    <p class="text-xs font-semibold my-1 text-indigo-300">TARGET CAUSE: ${action.target_cause || 'N/A'}</p>
                    <p class="text-xs font-semibold my-1 ${impactClass}">POTENTIAL IMPACT: ${action.potential_impact || 'N/A'}</p>
                    <p class="rationale"><strong>Rationale:</strong> ${action.rationale || 'N/A'}</p>
                </div>`;
        });
        actionHtml += `</div>`;
    } else {
        actionHtml += `<p class="text-center text-white/70 italic">No specific actions were generated for the 'vital few' causes, possibly because none were identified or derivable from the context.</p>`;
    }
    actionHtml += `</div>`;
    actionPanel.innerHTML = actionHtml;

    // Populate Fishbone Diagram Panel.
    const fishboneDiagramPanel = dom.$("fishboneDiagramPanel");
    const fishboneElements = parseFishboneData(data);
    if (fishboneDiagramPanel) {
        fishboneDiagramPanel.innerHTML = `
        <div id="fishboneCy" class="fishboneCy"></div>
        <div class="diagram-controls">
            <button class="diagram-fit-btn" data-action="fit">Fit to View</button>
            <button class="diagram-reset-btn" data-action="reset">Reset Zoom</button>
            <button class="diagram-export-btn" data-action="export">Export as PNG</button>
        </div>
        `
    }
    

    // --- 4. Populate Learn Techniques Tab ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Pareto & Fishbone Analysis</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">📊 Pareto Principle (80/20 Rule)</h4>
                [Image of Pareto chart example]
                <p class="text-sm text-white/80 mb-3">States that for many outcomes, roughly 80% of consequences come from 20% of causes. In quality improvement, it helps identify the "vital few" causes that have the most significant impact on a problem, distinguishing them from the "useful many."</p>
                <h5 class="text-md font-semibold mb-1">How it's Used Here:</h5>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li>Identifies potential causes from the Fishbone analysis.</li>
                    <li>Estimates the relative impact of each cause on the main problem.</li>
                    <li>Sorts causes by impact score.</li>
                    <li>Calculates cumulative impact percentage.</li>
                    <li>Visually separates the "vital few" (first ~80% cumulative impact) from the "useful many".</li>
                    <li>Directs action planning towards the vital few for maximum efficiency.</li>
                </ul>
            </div>

            <div class="bg-black/20 p-4 rounded-lg">
                <h4 class="text-lg font-bold mb-2 text-indigo-300">🐟 Fishbone Diagram (Ishikawa / Cause-and-Effect)</h4>
                [Image of Fishbone diagram example]
                <p class="text-sm text-white/80 mb-3">A visualization tool used to brainstorm and categorize potential causes of a specific problem (the "effect"). Causes are grouped into major categories to ensure a structured and comprehensive analysis.</p>
                <h5 class="text-md font-semibold mb-1">Standard Categories (6Ms):</h5>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Methods:</strong> Policies, procedures, rules, regulations, laws.</li>
                    <li><strong>Machines:</strong> Equipment, tools, technology used.</li>
                    <li><strong>Materials:</strong> Raw materials, consumables, information.</li>
                    <li><strong>Manpower (People):</strong> Anyone involved in the process; skills, training, motivation.</li>
                    <li><strong>Measurement:</strong> Data generated from the process used for evaluation.</li>
                    <li><strong>Environment (Mother Nature):</strong> Location, time, temperature, workplace culture.</li>
                </ul>
                <p class="text-xs italic mt-2">Note: Categories can sometimes be adapted based on the industry (e.g., 4S for Service).</p>
            </div>
        </div>

        <div class="bg-white/5 p-4 rounded-lg mt-6 border border-white/10">
            <h4 class="text-lg font-bold mb-2">🤝 How They Work Together:</h4>
            <p class="text-sm text-white/80">The Fishbone diagram helps brainstorm a wide range of potential causes. The Pareto analysis then helps prioritize which of those causes are likely contributing the most to the problem, allowing teams to focus their improvement efforts effectively.</p>
        </div>
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
                // Resize chart if the Pareto tab is activated
                const chart = targetPanel.querySelector('.plotly-chart');
                if (chart && chart.layout && typeof Plotly !== 'undefined') {
                    try { Plotly.Plots.resize(chart); } catch (err) { console.error("Resize err:", err); }
                }
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }

            if (e.target.dataset.tab === "fishboneDiagram") {
                const fishboneDiagramContainer = targetPanel.querySelector("#fishboneCy");
                if (fishboneDiagramContainer && fishboneElements) {
                    let cy;
                    cy = renderFishboneDiagram(fishboneDiagramContainer, fishboneElements);
                    document.querySelector('.diagram-fit-btn').addEventListener('click', () => fitDiagram(cy));
                    document.querySelector('.diagram-reset-btn').addEventListener('click', () => resetZoom(cy));
                    document.querySelector('.diagram-export-btn').addEventListener('click', () => exportPNG(cy));
                }
            }
        }
    });

    // Attempt initial resize for chart in the default active tab (Pareto)
    setTimeout(() => {
        const initialChart = dom.$('paretoChartContainer');
        if (initialChart && initialChart.layout && typeof Plotly !== 'undefined') {
            try { Plotly.Plots.resize(initialChart); } catch (err) { console.error("Initial Resize err:", err); }
        }
    }, 150);


    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



/**
 * RENDERER: System Thinking Analysis
 * - NEW (v3): This renderer is now flexible.
 * - It checks if `system_archetype` exists. If not, it assumes a "research_plan"
 * and displays `focus_areas` instead of `leverage_points` and archetypes.
 * - FIX (v4): Added checks for loop.type, finalFocusAreas, and system_archetype before access.
 * - FIX (v5): Added check for "Unanalyzable" state.
 */
function renderSystemThinkingPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator

    // --- Validation for the flexible structure ---
    if (!data || !data.summary || !data.elements || !data.causal_links ||
        (data.system_archetype === undefined && data.focus_areas === undefined)) {
        console.error("Incomplete data passed to renderSystemThinkingPage (v3):", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    
    // --- NEW CHECK FOR UNANALYZABLE TEXT ---
    // If the AI returns no elements AND (no leverage points AND no focus areas), it's unanalyzable.
    if (data.elements.length === 0 && (!data.leverage_points || data.leverage_points.length === 0) && (!data.focus_areas || data.focus_areas.length === 0)) {
        console.warn("Data is unanalyzable. Displaying summary as error.");
        container.innerHTML = `<div class="p-4 text-center text-yellow-300">
                                 <h4 class="text-xl font-bold mb-3">Analysis Incomplete</h4>
                                 <p class="text-white/80">${data.summary}</p>
                                 <p class="text-sm text-white/70 mt-2">Please try again with text describing a business, a system problem, or a research plan.</p>
                               </div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        return; // Stop rendering
    }
    // --- END NEW CHECK ---

    // Destructure all possible fields
    const {
        elements,
        feedback_loops,
        summary,
        causal_links,
        system_archetype,
        focus_areas,
        leverage_points
    } = data;

    // Determine which mode we are in
    // A research model is identified by having `focus_areas` and no `system_archetype`.
    const isResearchModel = (!!focus_areas && !system_archetype);
    // Use leverage_points OR focus_areas. Ensure finalFocusAreas is an array.
    const finalFocusAreas = focus_areas || leverage_points || [];

    // --- Create Tab Navigation (6 Tabs) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    // Customize tab name based on input type
    const focusTabName = isResearchModel ? "⚡ Key Research Questions" : "⚡ Elements & Leverage";
    const loopTabName = (feedback_loops && feedback_loops.length > 0) ? "🔄 Feedback Loops" : "🔗 Causal Links (Hypotheses)"; // <-- Use feedback_loops to decide name
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="diagram">🗺️ Causal Diagram</button>
        <button class="analysis-tab-btn" data-tab="network">🕸️ Network</button>
        <button class="analysis-tab-btn" data-tab="loops">${loopTabName}</button>
        <button class="analysis-tab-btn" data-tab="focus">${focusTabName}</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn System Thinking</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (6 Panels) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="diagramPanel" class="analysis-tab-panel"></div>
        <div id="networkPanel" class="analysis-tab-panel"></div>
        <div id="loopsPanel" class="analysis-tab-panel"></div>
        <div id="focusPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");

    // Find the top focus area/leverage point
    let topFocusHtml = "";
    if (finalFocusAreas && finalFocusAreas.length > 0) { // <-- Added check for finalFocusAreas
        // Find the first item (either ranked "High" or just the first in the list)
        const topFocus = [...finalFocusAreas].sort((a, b) => { // <-- Use spread to avoid mutating original
            const order = {
                "High": 1,
                "Medium": 2,
                "Low": 3
            };
            // Handle both 'impact' and 'potential_impact_rank' keys
            const rankA = order[a.potential_impact_rank || a.impact] || 4;
            const rankB = order[b.potential_impact_rank || b.impact] || 4;
            return rankA - rankB;
        })[0];

        const title = isResearchModel ? "Top Research Question" : "Top Leverage Point";
        // Handle both 'description'/'intervention' and 'area_name'/'point_name'
        const desc = topFocus.description || topFocus.intervention || "No description provided.";
        const pointName = topFocus.area_name || topFocus.point_name || "Unnamed Point";

        topFocusHtml = `
            <div class="prescription-card border-l-4 border-red-500">
                <h3 class="text-lg font-bold text-red-300">${title}</h3>
                <p class="text-xl font-semibold mt-1">${pointName}</p>
                <p class="text-sm text-white/80 mt-2"><strong>Description:</strong> ${desc}</p>
            </div>`;
    }

    // Find the archetype (if it exists)
    let archetypeHtml = "";
    // Check for archetype *object* and *name property*
    if (system_archetype && typeof system_archetype === 'object' && system_archetype.name) {
        archetypeHtml = `
            <div class="archetype-card">
                <h3 class="text-lg font-bold text-indigo-300">Dominant System Archetype</h3>
                <p class="text-2xl font-semibold mt-1">${system_archetype.name}</p>
                <p class="text-sm text-white/80 mt-2 italic">${system_archetype.description || 'No description provided.'}</p>
            </div>`;
    } else if (isResearchModel) {
        // If it's a research model, create a simpler card
        archetypeHtml = `
            <div class="archetype-card">
                <h3 class="text-lg font-bold text-indigo-300">Analysis Type</h3>
                <p class="text-2xl font-semibold mt-1">Hypothesis Model</p>
                <p class="text-sm text-white/80 mt-2 italic">The system is a set of hypothesized causal links to be tested, not a dynamic problem archetype.</p>
            </div>`;
    } else {
        // Fallback if archetype is null/undefined but not a research model
        archetypeHtml = `
            <div class="archetype-card">
                <h3 class="text-lg font-bold text-indigo-300">Dominant System Archetype</h3>
                <p class="text-2xl font-semibold mt-1">Not Identified</p>
                <p class="text-sm text-white/80 mt-2 italic">No single dominant archetype was identified from the text.</p>
            </div>`;
    }

    dashboardPanel.innerHTML = `
        <div class="p-4 space-y-6">
            <h3 class="text-2xl font-bold mb-4 text-center">System Analysis Dashboard</h3>
            <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 text-sm">
                <strong>Analysis Summary:</strong> ${summary}
            </blockquote>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${archetypeHtml}
                ${topFocusHtml}
            </div>
        </div>`;

    // --- 2. Populate Causal Loop Diagram Panel ---
    const diagramPanel = dom.$("diagramPanel");
    const diagramTitle = isResearchModel ? "Hypothesis Model Diagram" : "Causal Loop Diagram (CLD)";
    diagramPanel.innerHTML = `
        <div class="p-4">
            <h3 class="text-2xl font-bold mb-4 text-center">${diagramTitle}</h3>
            <p class="text-sm text-white/70 text-center mb-4 italic">This diagram shows the causal relationships between system elements.</p>
            <div id="cldGraphContainer" class="w-full min-h-[600px] flex justify-center items-center bg-black/10 rounded-lg">
                <p class="text-white/70">Rendering diagram...</p>
            </div>
            <div id="cldKey" class="mt-4 text-xs text-white/70 text-center space-x-4"></div>
        </div>`;

    try {
        // This assumes buildDotString is available in the global scope and has the fix
        const dotString = buildDotString(elements, causal_links, feedback_loops);
        const viz = new Viz();
        viz.renderSVGElement(dotString)
            .then(svgElement => {
                const container = dom.$("cldGraphContainer");
                container.innerHTML = "";
                svgElement.style.width = "100%";
                svgElement.style.height = "auto";
                container.appendChild(svgElement);

                // Add key
                const keyContainer = dom.$("cldKey");
                let keyHtml = "";
                if (feedback_loops && feedback_loops.length > 0) {
                    // --- START FIX ---
                    // Check for loop types again with safety
                    const hasR = feedback_loops.some(l => l && l.type && typeof l.type === 'string' && l.type.toLowerCase() === 'reinforcing');
                    const hasB = feedback_loops.some(l => l && l.type && typeof l.type === 'string' && l.type.toLowerCase() === 'balancing');
                    // --- END FIX ---
                    if (hasR) keyHtml += `<span><span class="inline-block w-3 h-3 rounded-full bg-green-400 mr-1"></span> Reinforcing Loop</span> `;
                    if (hasB) keyHtml += `<span><span class="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span> Balancing Loop</span>`;
                }
                keyHtml += `<span><span class="inline-block w-3 h-0.5 bg-white mr-1" style="transform: translateY(-2px);"></span> (+) Same Direction</span> <span><span class="inline-block w-3 h-0.5 bg-white mr-1" style="transform: translateY(-2px); clip-path: polygon(0% 0%, 75% 0%, 75% 100%, 0% 100%);">T</span> (-) Opposite Direction</span>`;
                keyContainer.innerHTML = keyHtml;
            })
            .catch(error => {
                console.error("Viz.js rendering error:", error);
                dom.$("cldGraphContainer").innerHTML = `<p class="text-red-400">Error rendering diagram: ${error.message}</p>`;
            });
    } catch (e) {
        console.error("Error creating DOT string or initializing Viz.js:", e);
        dom.$("cldGraphContainer").innerHTML = `<p class="text-red-400">Error initializing diagram: ${e.message}</p>`;
    }

    // --- 3. Populate Network Tab ---
    renderSystemNetworkTab(elements, causal_links, "networkPanel");

    // --- 4. Populate Feedback Loops / Causal Links Panel ---
    const loopsPanel = dom.$("loopsPanel");
    let loopsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4 text-center">${loopTabName}</h3><div class="space-y-6">`;
    if (feedback_loops && feedback_loops.length > 0) {
        // Mode A: Dynamic Problem
        feedback_loops.forEach((loop) => {
            // --- START FIX ---
            // Check if loop and loop.type are valid before calling toLowerCase()
            const loopType = (loop && loop.type && typeof loop.type === 'string') ? loop.type.toLowerCase() : 'unknown';
            const isReinforcing = loopType === "reinforcing";
            // --- END FIX ---

            const loopIcon = isReinforcing ? "📈" : "⚖️";
            const loopColor = isReinforcing ? "border-green-400" : "border-yellow-400";
            const elementsList = Array.isArray(loop.elements) ? loop.elements.join(", ") : 'Elements not specified';
            const loopTypeName = loop.type || 'Type N/A'; // <-- Use safe value for display
            const loopName = loop.name || loop.loop_name || "Unnamed Loop"; // <-- Handle missing name

            loopsHtml += `
                <div class="bg-black/20 p-4 rounded-lg border-l-4 ${loopColor}">
                    <h4 class="text-lg font-bold flex items-center gap-2">${loopIcon} ${loopName} <span class="text-xs font-light text-white/60">(${loopTypeName})</span></h4>
                    <p class="text-sm text-white/80 my-3 italic"><strong>Causal Chain:</strong> ${loop.description || 'No description provided.'}</p>
                    <div class="text-xs text-white/60"><strong>Key Elements Involved:</strong> ${elementsList}</div>
                </div>`;
        });
    } else if (isResearchModel && causal_links.length > 0) {
        // Mode B: Research Plan
        causal_links.forEach((link) => {
            loopsHtml += `
                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-blue-400">
                    <h4 class="text-lg font-bold flex items-center gap-2">🔗 ${link.description || `${link.from} -> ${link.to}`}</h4>
                    <p class="text-sm text-white/80 my-3 font-mono"><code>${link.from}</code> --( ${link.polarity} )--> <code>${link.to}</code></p>
                </div>`;
        });
    } else {
        loopsHtml += `<p class="text-center text-white/70 italic">No feedback loops or causal links were identified from the text.</p>`;
    }
    loopsHtml += `</div></div>`;
    loopsPanel.innerHTML = loopsHtml;

    // --- 5. Populate Elements & Focus Panel ---
    const focusPanel = dom.$("focusPanel");
    let focusHtml = `<div class="p-4 space-y-8">
                        <div>
                            <h3 class="text-2xl font-bold mb-4 text-center">Key System Elements</h3>
                            <div class="overflow-x-auto">
                                <table class="coeff-table styled-table text-sm">
                                    <thead><tr><th>Element Name</th><th>Type</th><th>Role in Model</th></tr></thead>
                                    <tbody>`;
    elements.forEach(el => {
        let description = "A key construct in the model.";
        if (causal_links.some(l => l.from === el.name) && !causal_links.some(l => l.to === el.name)) {
            description = "Exogenous Driver (Predictor)";
        } else if (!causal_links.some(l => l.from === el.name) && causal_links.some(l => l.to === el.name)) {
            description = "Endogenous Outcome (Result)";
        } else if (causal_links.some(l => l.from === el.name) && causal_links.some(l => l.to === el.name)) {
            description = "Mediating Variable (Driver & Outcome)";
        }

        focusHtml += `<tr>
                            <td class="font-semibold">${el.name}</td>
                            <td class="font-mono text-xs">${el.type}</td>
                            <td class="text-white/70">${description}</td>
                         </tr>`;
    });
    focusHtml += `</tbody></table></div></div>`;

    // Focus Areas / Leverage Points Section
    focusHtml += `<div><h3 class="text-2xl font-bold mb-4 text-center">${focusTabName}</h3><div class="space-y-6">`;
    const sortedFocusAreas = [...finalFocusAreas].sort((a, b) => {
        const order = {
            "High": 1,
            "Medium": 2,
            "Low": 3
        };
        const rankA = order[a.potential_impact_rank || a.impact] || 4;
        const rankB = order[b.potential_impact_rank || b.impact] || 4;
        return rankA - rankB;
    });
    sortedFocusAreas.forEach((point, index) => {
        const impact = point.potential_impact_rank || point.impact;
        let borderColor = "border-indigo-400";
        if (impact === "High") borderColor = "border-red-500";
        else if (impact === "Medium") borderColor = "border-yellow-500";
        else if (impact === "Low") borderColor = "border-blue-500";

        const pointName = point.area_name || point.point_name;
        const pointDesc = point.description || point.intervention;
        const pointRationale = point.rationale;
        const pointOutcome = point.expected_outcome;

        focusHtml += `
            <div class="prescription-card ${borderColor}">
                 <h4 class="text-xl font-bold">${index + 1}. ${pointName}</h4>
                 ${impact ? `<p class="text-xs font-semibold my-1 ${borderColor.replace('border-', 'text-')}">${impact}</p>` : ''}
                 <p class="rationale mt-3"><strong>Description/Intervention:</strong> ${pointDesc}</p>
                 ${pointRationale ? `<p class="text-sm text-white/80 mt-2 italic"><strong>Rationale:</strong> ${pointRationale}</p>` : ''}
                 ${pointOutcome ? `<div class="p-3 bg-black/20 rounded mt-3 text-sm"><p><strong>Expected Outcome:</strong> ${pointOutcome}</p></div>` : ''}
            </div>`;
    });
    focusHtml += `</div></div></div>`;
    focusPanel.innerHTML = focusHtml;

    // --- 6. Populate Learn System Thinking Panel (Unchanged) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding System Thinking</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What is System Thinking?</h4>
            <p class="text-sm text-white/80">System thinking is a holistic approach to analysis that focuses on how a system's constituent parts interrelate and how systems work over time and within the context of larger systems. It contrasts with traditional analysis, which studies systems by breaking them down into their separate elements.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Key Concepts:</h4>
                <ul class="list-disc list-inside space-y-2 text-sm">
                    <li><strong>Interconnectedness:</strong> Elements within a system are interconnected; changing one part affects others.</li>
                    <li><strong>Feedback Loops:</strong> Circular causal relationships that amplify (reinforcing) or stabilize (balancing) change. </li>
                    <li><strong>Stocks & Flows:</strong> Stocks are accumulations (like water in a tub); Flows are the rates that change stocks (like the faucet and drain).</li>
                    <li><strong>Delays:</strong> Time lags between actions and their effects, often causing oscillations or overshoots.</li>
                    <li><strong>Leverage Points:</strong> Places in a system where a small change can have a large effect.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Why Use System Thinking?</h4>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>See the Bigger Picture:</strong> Understand context and connections.</li>
                    <li><strong>Identify Root Causes:</strong> Move beyond addressing symptoms to find underlying structural issues.</li>
                    <li><strong>Find High-Leverage Interventions:</strong> Identify points where small efforts yield significant results.</li>
                    <li><strong>Anticipate Unintended Consequences:</strong> Recognize how changes might ripple through the system.</li>
                 </ul>
            </div>
        </div>

         <details class="styled-details text-sm mt-4" open>
            <summary class="font-semibold">Common System Archetypes (Recurring Patterns)</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p><strong>Limits to Growth:</strong> Growth eventually slows or stops due to a limiting factor (a balancing loop).</p>
                <p><strong>Shifting the Burden:</strong> Using a short-term fix distracts from or undermines a fundamental long-term solution.</p>
                <p><strong>Fixes that Fail:</strong> A solution creates unintended consequences elsewhere that worsen the original problem later.</p>
                <p><strong>Tragedy of the Commons:</strong> Individuals overusing a shared resource deplete it for everyone.</p>
            </div>
        </details>
         <p class="text-xs text-center text-white/60 mt-4">This tool analyzes your text to identify elements, causal links, and key focus areas to help you understand the structure of your system.</p>
    </div>
    `;

    // --- NEW: Animate the new content ---
    const newElementsToAnimate = container.querySelectorAll(
        '.glass-container, .feature-card, .project-card, .kpi-card, .summary-stat-card, .prescription-card, .insight-card, .action-card, .ladder-rung, .dissonance-pole, .cascade-objective, .cascade-goal-card, .st-objective-card, .st-goal-card, .feedback-card, .plotly-chart, .styled-table'
    );
    animateElements(newElementsToAnimate);

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
                // Resize diagram if its tab is clicked
                if (targetPanelId === "diagramPanel") {
                    const svg = targetPanel.querySelector("svg");
                    if (svg) {
                        // Viz.js SVG should resize automatically
                    }
                }
                // NEW: Resize plotly chart if its tab is clicked
                const chart = targetPanel.querySelector(".plotly-chart");
                if (chart && typeof Plotly !== 'undefined') {
                    try { Plotly.Plots.resize(chart); } catch (err) { console.error("Resize err:", err); }
                }
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
}



function renderLeveragePointsPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator

    // --- Validation for the flexible structure ---
    if (!data || !data.summary || !data.elements || !data.feedback_loops || !data.leverage_points) {
        console.error("Incomplete data passed to renderLeveragePointsPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Leverage Points results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }
    
    // --- NEW CHECK FOR UNANALYZABLE TEXT ---
    // If the AI returns no elements AND no leverage points, it means the text was unanalyzable.
    // Display the summary (which is now an error message) and stop.
    if (data.elements.length === 0 && data.leverage_points.length === 0) {
        console.warn("Data is unanalyzable. Displaying summary as error.");
        container.innerHTML = `<div class="p-4 text-center text-yellow-300">
                                 <h4 class="text-xl font-bold mb-3">Analysis Incomplete</h4>
                                 <p class="text-white/80">${data.summary}</p>
                                 <p class="text-sm text-white/70 mt-2">Please try again with text describing a business, a system problem, or a research plan.</p>
                               </div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        return; // Stop rendering
    }
    // --- END NEW CHECK ---

    const {
        elements,
        feedback_loops,
        summary,
        leverage_points
    } = data;


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="gist">📝 Gist & Elements</button>
        <button class="analysis-tab-btn" data-tab="loops">🔄 Feedback Loops</button>
        <button class="analysis-tab-btn" data-tab="leverage">⚡ Leverage Points & Interventions</button> <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Leverage Points</button> `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="gistPanel" class="analysis-tab-panel active"></div>
        <div id="loopsPanel" class="analysis-tab-panel"></div>
        <div id="leveragePanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> `;

    // --- 1. Populate Gist & Elements Panel (Reusing logic from System Thinking) ---
    const gistPanel = dom.$("gistPanel");
    let gistHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">System Overview</h3>`;
    gistHtml += `<blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 mb-6 text-sm">"${summary}"</blockquote>`;
    gistHtml += `<h4 class="text-xl font-semibold mb-3">Key System Elements Identified</h4>`;
    gistHtml += `<div class="overflow-x-auto">
                    <table class="coeff-table styled-table text-sm">
                        <thead><tr><th>Element Name</th><th>Type</th><th>Description (Inferred Role)</th></tr></thead>
                        <tbody>`;
    elements.forEach(el => {
        let description = "";
        if (el.type === "Stock") description = "Accumulation over time";
        else if (el.type === "Flow") description = "Rate of change affecting a Stock";
        else if (el.type === "Variable") description = "Factor influencing Flows/Variables";
        else if (el.type === "Parameter") description = "Constant or policy";
        gistHtml += `<tr><td class="font-semibold">${el.name}</td><td class="font-mono text-xs">${el.type}</td><td class="text-white/70">${description}</td></tr>`;
    });
    gistHtml += `</tbody></table></div></div>`; // Close table div and p-4
    gistPanel.innerHTML = gistHtml;

    // --- 2. Populate Feedback Loops Panel (Reusing logic from System Thinking) ---
    const loopsPanel = dom.$("loopsPanel");
    let loopsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Identified Feedback Loops</h3><div class="space-y-6">`;
    
    // --- START FIX ---
    // Check if feedback_loops is an array and has items
    if (feedback_loops && feedback_loops.length > 0) {
        feedback_loops.forEach((loop) => {
            // Safety checks for loop object and loop.type property
            const loopType = (loop && loop.type && typeof loop.type === 'string') ? loop.type.toLowerCase() : 'unknown';
            const isReinforcing = loopType === "reinforcing";
            const loopIcon = isReinforcing ? "📈" : "⚖️";
            const loopColor = isReinforcing ? "border-green-400" : "border-yellow-400";
            const loopTypeName = loop.type || 'Type N/A';
            const loopName = loop.name || loop.loop_name || 'Unnamed Loop';
            const elementsList = Array.isArray(loop.elements) ? loop.elements.join(", ") : 'Elements not specified';

            loopsHtml += `
                <div class="bg-black/20 p-4 rounded-lg border-l-4 ${loopColor}">
                    <h4 class="text-lg font-bold flex items-center gap-2">${loopIcon} ${loopName} <span class="text-xs font-light text-white/60">(${loopTypeName})</span></h4>
                    <p class="text-sm text-white/80 my-3 italic"><strong>Causal Chain:</strong> ${loop.description || 'No description.'}</p>
                    <div class="text-xs text-white/60"><strong>Key Elements Involved:</strong> ${elementsList}</div>
                </div>`;
        });
    } else {
        // This will now correctly trigger for NexaFlow-Capital.txt
        loopsHtml += `<p class="text-center text-white/70 italic">No feedback loops were identified. This is expected for descriptive profiles.</p>`;
    }
    // --- END FIX ---

    loopsHtml += `</div></div>`;
    loopsPanel.innerHTML = loopsHtml;

    // --- 3. Populate Leverage Points Panel (Updated for detailed interventions) ---
    const leveragePanel = dom.$("leveragePanel");
    let leverageHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">⚡ High-Impact Leverage Points & Interventions</h3>`;
    if (leverage_points && leverage_points.length > 0) {
        leverageHtml += `<p class="text-sm text-white/70 mb-6 italic">These are ranked intervention points where actions can significantly shift system behavior, ordered from potentially highest to lowest impact based on system principles.</p>`;
        leverageHtml += `<div class="space-y-6">`;
        // Sort points based on High > Medium > Low impact rank for rendering
        const impactOrder = {
            "High": 1,
            "Medium": 2,
            "Low": 3
        };
        const sortedLeveragePoints = [...leverage_points].sort((a, b) => {
            const rankA = impactOrder[a.potential_impact_rank?.split(" ")[0]] || 4; // Default to lowest if rank missing
            const rankB = impactOrder[b.potential_impact_rank?.split(" ")[0]] || 4;
            return rankA - rankB;
        });

        sortedLeveragePoints.forEach((point, index) => {
            let borderColor = "border-indigo-400"; // Default
            if (point.potential_impact_rank?.startsWith("High")) borderColor = "border-red-500";
            else if (point.potential_impact_rank?.startsWith("Medium")) borderColor = "border-yellow-500";
            else if (point.potential_impact_rank?.startsWith("Low")) borderColor = "border-blue-500";

            leverageHtml += `
                <div class="prescription-card ${borderColor}">
                     <h4 class="text-xl font-bold">${index + 1}. ${point.point_name}</h4>
                     <p class="text-xs font-semibold my-1 ${borderColor.replace('border-', 'text-')}">${point.potential_impact_rank || 'Impact Undefined'}</p>
                     <p class="text-xs font-semibold my-1 text-white/70">TARGET: ${point.target_element_or_loop || 'N/A'}</p>
                     <p class="rationale mt-3"><strong>Proposed Intervention:</strong> ${point.intervention || 'N/A'}</p>
                     <p class="text-sm text-white/80 mt-2 italic"><strong>System Rationale:</strong> ${point.rationale || 'N/A'}</p>
                     <div class="p-3 bg-black/20 rounded mt-3 text-sm">
                         <p><strong>Expected Outcome:</strong> ${point.expected_outcome || 'N/A'}</p>
                     </div>
                </div>`;
        });
        leverageHtml += `</div>`;
    } else {
        leverageHtml += `<p class="text-center text-white/70 italic">No specific leverage points were clearly identified from the provided system description.</p>`;
    }
    leverageHtml += `</div>`; // Close p-4
    leveragePanel.innerHTML = leverageHtml;


    // --- 4. Populate Learn Leverage Points Panel (New) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Leverage Points</h3>
         
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">What are Leverage Points?</h4>
            <p class="text-sm text-white/80">Popularized by Donella Meadows, leverage points are places within a complex system where a small shift in one thing can produce big changes in everything. Intervening at higher leverage points is often more effective, though potentially harder, than intervening at lower ones.</p>
        </div>

        <h4 class="text-xl font-semibold mt-4 mb-2 text-center">Meadows' 12 Places to Intervene (Simplified & Ranked Low to High Impact):</h4>
        <div class="overflow-x-auto">
             <table class="coeff-table styled-table text-sm">
                 <thead><tr><th>#</th><th>Leverage Point Type</th><th>Example Intervention</th><th>Impact Potential</th></tr></thead>
                 <tbody>
                     <tr><td>12</td><td><strong>Constants, Parameters, Numbers</strong></td><td>Adjusting budgets, staff levels, thresholds</td><td>Low</td></tr>
                     <tr><td>11</td><td><strong>Sizes of Buffers/Stocks</strong></td><td>Increasing inventory, server capacity</td><td>Low</td></tr>
                     <tr><td>10</td><td><strong>Structure of Material Stocks/Flows</strong></td><td>Changing physical layout, supply chain routes</td><td>Low-Medium</td></tr>
                     <tr><td>9</td><td><strong>Lengths of Delays</strong></td><td>Reducing response times, speeding up feedback</td><td>Medium</td></tr>
                     <tr><td>8</td><td><strong>Strength of Balancing Feedback Loops</strong></td><td>Implementing quality controls, regulations</td><td>Medium</td></tr>
                     <tr><td>7</td><td><strong>Strength of Reinforcing Feedback Loops</strong></td><td>Boosting marketing for word-of-mouth, R&D investment</td><td>Medium-High</td></tr>
                     <tr><td>6</td><td><strong>Structure of Information Flows</strong></td><td>Improving transparency, communication channels</td><td>Medium-High</td></tr>
                     <tr><td>5</td><td><strong>Rules of the System</strong></td><td>Changing incentives, policies, regulations</td><td>High</td></tr>
                     <tr><td>4</td><td><strong>Power to Add/Change System Structure</strong></td><td>Creating new departments, feedback loops</td><td>High</td></tr>
                     <tr><td>3</td><td><strong>Goals of the System</strong></td><td>Shifting focus from profit to sustainability, speed to quality</td><td>High</td></tr>
                     <tr><td>2</td><td><strong>Mindset or Paradigm</strong></td><td>Changing core beliefs/values (e.g., growth vs. stability)</td><td>Very High</td></tr>
                     <tr><td>1</td><td><strong>Power to Transcend Paradigms</strong></td><td>Realizing no single paradigm is complete</td><td>Highest</td></tr>
                 </tbody>
             </table>
        </div>

         <div class="bg-white/5 p-4 rounded-lg mt-6 border border-white/10">
            <h4 class="text-lg font-bold mb-2">How This Tool Applies It:</h4>
            <p class="text-sm text-white/80">This tool analyzes your text to see if it's a dynamic problem or a descriptive profile.
            <br>
            - If it's a <strong>problem</strong>, it finds loops and suggests interventions to *fix* them, ranking them by this hierarchy.
            <br>
            - If it's a <strong>profile</strong> (like NexaFlow), it identifies your core differentiators as high-leverage points to *amplify*.
            </p>
        </div>
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
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderSystemNetworkTab(elements, causalLinks, containerId) {
    const container = dom.$(containerId);
    if (!container) return;
    container.innerHTML = `<div id="systemNetworkChart" class="w-full h-[600px] plotly-chart"></div>`;

    const nodes = elements.map(el => ({ id: el.name, ...el }));
    
    // Filter out causal links that don't have corresponding nodes
    const validCausalLinks = causalLinks.filter(link => {
        const sourceExists = nodes.some(node => node.id === link.from);
        const targetExists = nodes.some(node => node.id === link.to);
        return sourceExists && targetExists;
    });

    const edges = validCausalLinks.map(link => ({ source: link.from, target: link.to, polarity: link.polarity }));

    const positions = {};
    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    // Create positions for nodes in a circular layout
    nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI;
        positions[node.id] = { x: nodes.length * 15 * Math.cos(angle), y: nodes.length * 15 * Math.sin(angle) };
    });

    const edge_x = [];
    const edge_y = [];
    edges.forEach(edge => {
        const sourcePos = positions[edge.source];
        const targetPos = positions[edge.target];
        if (sourcePos && targetPos) {
            edge_x.push(sourcePos.x, targetPos.x, null);
            edge_y.push(sourcePos.y, targetPos.y, null);
        }
    });

    const node_x = [];
    const node_y = [];
    const node_text = [];
    const node_color = [];
    nodes.forEach(node => {
        const pos = positions[node.id];
        if (pos) {
            node_x.push(pos.x);
            node_y.push(pos.y);
            node_text.push(`${node.name}<br>Type: ${node.type}`);
            // Color nodes based on their type for better visual distinction
            switch (node.type) {
                case 'Stock': node_color.push('#4285F4'); break; // Google Blue
                case 'Flow': node_color.push('#34A853'); break; // Google Green
                case 'Variable': node_color.push('#FBBC05'); break; // Google Yellow
                case 'Parameter': node_color.push('#EA4335'); break; // Google Red
                default: node_color.push('grey');
            }
        }
    });

    const edgeTrace = {
        x: edge_x,
        y: edge_y,
        mode: 'lines',
        line: { width: 1, color: '#888' },
        hoverinfo: 'none'
    };

    const nodeTrace = {
        x: node_x,
        y: node_y,
        mode: 'markers+text',
        text: nodes.map(n => n.name),
        textposition: 'bottom center',
        hoverinfo: 'text',
        hovertext: node_text,
        marker: {
            size: 20,
            color: node_color,
            symbol: 'circle'
        }
    };

    Plotly.newPlot('systemNetworkChart', [edgeTrace, nodeTrace], {
        title: 'System Elements Network',
        showlegend: false,
        hovermode: 'closest',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'white' },
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false }
    }, { responsive: true });
}

function renderArchetypeAnalysisPage(container, data) {
    container.innerHTML = "";
    const { concepts, topArchetypes, topLeveragePoints } = data;
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `<button class="analysis-tab-btn active" data-tab="concepts">📋 Concepts</button><button class="analysis-tab-btn" data-tab="network">🕸️ Network</button><button class="analysis-tab-btn" data-tab="archetypes">🏛️ Archetypes</button><button class="analysis-tab-btn" data-tab="leverage">⚡ Leverage Points</button>`;
    container.appendChild(tabNav);
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `<div id="conceptsPanel" class="analysis-tab-panel active"></div><div id="networkPanel" class="analysis-tab-panel"></div><div id="archetypesPanel" class="analysis-tab-panel"></div><div id="leveragePanel" class="analysis-tab-panel"></div>`;
    renderConceptsTab(concepts, "conceptsPanel");
    renderNetworkTab(concepts, "networkPanel");
    renderArchetypesTab(topArchetypes, "archetypesPanel");
    renderLeveragePointsTab(topLeveragePoints, "leveragePanel");

    appState.analysisCache[appState.currentTemplateId] = container.innerHTML;

    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanel = dom.$(e.target.dataset.tab + "Panel");
            targetPanel.classList.add("active");
            const chart = targetPanel.querySelector(".plotly-chart");
            if (chart) Plotly.Plots.resize(chart);
        }
    });
}

function renderConceptsTab(concepts, containerId) {
    const container = dom.$(containerId);
    const positiveCount = concepts.filter((c) => c.effect === "+").length;
    const negativeCount = concepts.filter((c) => c.effect === "-").length;
    const neutralCount = concepts.filter((c) => c.effect === "0").length;
    let tableHtml = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"><div class="metric-card"><h4 class="font-bold">Positive Effects</h4><p class="text-3xl font-bold">${positiveCount}</p></div><div class="metric-card"><h4 class="font-bold">Negative Effects</h4><p class="text-3xl font-bold">${negativeCount}</p></div><div class="metric-card"><h4 class="font-bold">Neutral Effects</h4><p class="text-3xl font-bold">${neutralCount}</p></div></div><div id="effectPieChart" class="w-full h-[400px] mb-8 plotly-chart"></div><h3 class="text-2xl font-bold mb-4">Extracted Concepts</h3><div class="overflow-x-auto"><table class="w-full text-left"><thead class="border-b border-white/20"><tr><th class="p-2">Concept</th><th class="p-2">Description</th><th class="p-2">Effect</th><th class="p-2">Influence</th></tr></thead><tbody>`;
    concepts.forEach((c) => {
        tableHtml += `<tr class="border-b border-white/10"><td class="p-2 font-semibold">${c.name}</td><td class="p-2 text-sm text-white/80">${c.description}</td><td class="p-2 text-center">${c.effect}</td><td class="p-2">${c.influence}</td></tr>`;
    });
    tableHtml += "</tbody></table></div>";
    container.innerHTML = tableHtml;
    Plotly.newPlot(
        "effectPieChart",
        [
            {
                values: [positiveCount, negativeCount, neutralCount],
                labels: ["Positive", "Negative", "Neutral"],
                type: "pie",
                marker: { colors: ["#2E8B57", "#CD5C5C", "#808080"] },
                hole: 0.4
            }
        ],
        {
            title: "Distribution of Concept Effects",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "white" },
            legend: { orientation: "h", y: -0.1 }
        },
        { responsive: true }
    );
}

function renderNetworkTab(concepts, containerId) {
    const container = dom.$(containerId);
    container.innerHTML = `<div id="conceptNetworkChart" class="w-full h-[600px] plotly-chart"></div>`;
    const nodes = concepts.map((c) => ({ id: c.name, ...c }));
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            edges.push({ source: nodes[i].id, target: nodes[j].id });
        }
    }
    const positions = {};
    nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI;
        positions[node.id] = { x: nodes.length * 15 * Math.cos(angle), y: nodes.length * 15 * Math.sin(angle) };
    });
    const edge_x = [];
    const edge_y = [];
    edges.forEach((edge) => {
        edge_x.push(positions[edge.source].x, positions[edge.target].x, null);
        edge_y.push(positions[edge.source].y, positions[edge.target].y, null);
    });
    const node_x = [];
    const node_y = [];
    const node_text = [];
    const node_color = [];
    nodes.forEach((node) => {
        node_x.push(positions[node.id].x);
        node_y.push(positions[node.id].y);
        node_text.push(`${node.name}<br>Influence: ${node.influence}`);
        if (node.effect === "+") node_color.push("green");
        else if (node.effect === "-") node_color.push("red");
        else node_color.push("gray");
    });
    const edgeTrace = {
        x: edge_x,
        y: edge_y,
        mode: "lines",
        line: { width: 0.5, color: "#888" },
        hoverinfo: "none"
    };
    const nodeTrace = {
        x: node_x,
        y: node_y,
        mode: "markers+text",
        text: nodes.map((n) => n.name),
        textposition: "bottom center",
        hoverinfo: "text",
        hovertext: node_text,
        marker: { size: 20, color: node_color }
    };
    Plotly.newPlot(
        "conceptNetworkChart",
        [edgeTrace, nodeTrace],
        {
            title: "Concept Network Visualization",
            showlegend: false,
            hovermode: "closest",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "white" },
            xaxis: { showgrid: false, zeroline: false, showticklabels: false },
            yaxis: { showgrid: false, zeroline: false, showticklabels: false }
        },
        { responsive: true }
    );
}

function renderArchetypesTab(topArchetypes, containerId) {
    const container = dom.$(containerId);
    let contentHtml = `<h3 class="text-2xl font-bold mb-4">🎯 80/20 Analysis - Most Relevant Archetypes</h3><p class="text-white/70 mb-6">This analysis focuses on the top 20% of system archetypes that are most likely driving 80% of the system's behavior.</p><div id="archetypeBarChart" class="w-full h-[400px] mb-8 plotly-chart"></div>`;
    topArchetypes.forEach((archetype) => {
        contentHtml += `<div class="metric-card mb-4"><h4 class="text-xl font-bold">🏛️ ${archetype.name}</h4><p class="text-sm font-semibold text-yellow-300 mb-2">Relevance Score: ${archetype.relevance_score}/10</p><p class="text-sm text-white/80 mb-3">${archetype.description}</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div><h5 class="font-semibold">Leverage Points:</h5><ul class="list-disc list-inside">${archetype.leverage_points.map((lp) => `<li>${lp}</li>`).join("")}</ul></div><div><h5 class="font-semibold">Interventions:</h5><ul class="list-disc list-inside">${archetype.interventions.map((i) => `<li>${i}</li>`).join("")}</ul></div></div></div>`;
    });
    container.innerHTML = contentHtml;
    const chartData = topArchetypes.map((a) => ({ Archetype: a.name, "Relevance Score": a.relevance_score || 0 }));
    Plotly.newPlot(
        "archetypeBarChart",
        [
            {
                x: chartData.map((d) => d.Archetype),
                y: chartData.map((d) => d["Relevance Score"]),
                type: "bar",
                marker: { color: chartData.map((d) => d["Relevance Score"]), colorscale: "Viridis" }
            }
        ],
        {
            title: "Archetype Relevance Scores (Top 20%)",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "white" },
            xaxis: { automargin: true },
            yaxis: { title: "Relevance Score" }
        },
        { responsive: true }
    );
}

function renderLeveragePointsTab(topLeveragePoints, containerId) {
    const container = dom.$(containerId);
    let contentHtml = `<h3 class="text-2xl font-bold mb-4">⚡ 80/20 Analysis - Top Leverage Points</h3><p class="text-white/70 mb-6">These are the top 20% of concepts where small changes can lead to the largest (80%) improvements in the system.</p><div id="leverageBarChart" class="w-full h-[400px] mb-8 plotly-chart"></div>`;
    topLeveragePoints.forEach((point) => {
        let priorityClass = "";
        if (point.impact === "High" && point.score >= 8) priorityClass = "critical";
        else if (point.score >= 6) priorityClass = "high";
        contentHtml += `<div class="metric-card ${priorityClass} mb-4"><h4 class="text-xl font-bold">${point.concept}</h4><p class="text-sm font-semibold text-yellow-300 mb-2">Leverage Score: ${point.score}/10 | Expected Impact: ${point.impact}</p><p class="text-sm text-white/80 mb-3"><strong>Reasoning:</strong> ${point.reasoning}</p><div><h5 class="font-semibold text-sm">Recommended Actions:</h5><ul class="list-disc list-inside text-sm">${point.actions.map((a) => `<li>${a}</li>`).join("")}</ul></div></div>`;
    });
    container.innerHTML = contentHtml;
    const chartData = topLeveragePoints.map((p) => ({
        Concept: p.concept,
        "Leverage Score": p.score || 0,
        Impact: p.impact
    }));
    Plotly.newPlot(
        "leverageBarChart",
        [
            {
                x: chartData.map((d) => d.Concept),
                y: chartData.map((d) => d["Leverage Score"]),
                type: "bar",
                marker: {
                    color: chartData.map((d) => {
                        if (d.Impact === "High") return "#2E8B57";
                        if (d.Impact === "Medium") return "#FF8C00";
                        return "#DC143C";
                    })
                }
            }
        ],
        {
            title: "Leverage Point Scores (Top 20%)",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "white" },
            xaxis: { automargin: true },
            yaxis: { title: "Leverage Score" }
        },
        { responsive: true }
    );
}



function renderSystemGoalsPage(container, data) {
    container.innerHTML = ""; // Clear loading

    // --- Validation for new structure ---
    if (!data || !data.system_goal || !data.strategic_initiatives) {
        console.error("Incomplete data passed to renderSystemGoalsPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render System Goals results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    // --- NEW CHECK FOR UNANALYZABLE TEXT ---
    // If the AI returns no initiatives and the goal contains "analyz", it's an error.
    if (data.strategic_initiatives.length === 0 && data.system_goal.toLowerCase().includes("analyz")) {
        console.warn("Data is unanalyzable. Displaying summary as error.");
        container.innerHTML = `<div class="p-4 text-center text-yellow-300">
                                 <h4 class="text-xl font-bold mb-3">Analysis Incomplete</h4>
                                 <p class="text-white/80">${data.system_goal}</p>
                                 <p class="text-sm text-white/70 mt-2">Please try again with text describing a business, a system problem, or a research plan.</p>
                               </div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        return; // Stop rendering
    }
    // --- END NEW CHECK ---


    const { system_goal, key_loops, strategic_initiatives } = data;
    
    // --- START FIX ---
    // Check if key_loops and its properties exist before trying to access them
    const hasLoops = key_loops && key_loops.reinforcing_loop && key_loops.balancing_loop;
    const reinforcing_loop = hasLoops ? key_loops.reinforcing_loop : null;
    const balancing_loop = hasLoops ? key_loops.balancing_loop : null;
    // --- END FIX ---


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        ${hasLoops ? '<button class="analysis-tab-btn" data-tab="map">🗺️ Strategic Map</button>' : ''}
        <button class="analysis-tab-btn" data-tab="initiatives">🚀 Initiatives & KPIs</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn System Goals</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        ${hasLoops ? '<div id="mapPanel" class="analysis-tab-panel"></div>' : ''}
        <div id="initiativesPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel (Updated) ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4 space-y-8">
        <div class="p-6 rounded-lg bg-black/20 border border-white/10 text-center">
            <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Overarching System Goal</h3>
            <p class="text-2xl italic text-white/90">${system_goal}</p>
        </div>`;

    // --- START FIX ---
    // Only show the "Key System Dynamics" section if loops were actually found
    if (hasLoops) {
        dashboardHtml += `
            <h3 class="text-2xl font-bold text-center">Key System Dynamics Affecting Goal</h3>
            <div class="grid md:grid-cols-2 gap-8">
                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-green-400">
                    <h4 class="text-lg font-bold flex items-center gap-2">📈 ${reinforcing_loop.name} <span class="text-xs font-light text-white/60">(Reinforcing)</span></h4>
                    <p class="text-sm text-white/80 my-3 italic">${reinforcing_loop.description}</p>
                    <div class="text-xs text-white/60"><strong>Elements:</strong> ${reinforcing_loop.elements.join(", ")}</div>
                </div>
                <div class="bg-black/20 p-4 rounded-lg border-l-4 border-yellow-400">
                     <h4 class="text-lg font-bold flex items-center gap-2">⚖️ ${balancing_loop.name} <span class="text-xs font-light text-white/60">(Balancing)</span></h4>
                    <p class="text-sm text-white/80 my-3 italic">${balancing_loop.description}</p>
                    <div class="text-xs text-white/60"><strong>Elements:</strong> ${balancing_loop.elements.join(", ")}</div>
                </div>
            </div>`;
    } else {
        // Show this if it's a descriptive profile (like NexaFlow)
        dashboardHtml += `<p class="text-center text-white/70 italic">No dynamic feedback loops (problems) were identified; analysis is focused on amplifying core strengths.</p>`;
    }
    // --- END FIX ---

    dashboardHtml += `<h3 class="text-2xl font-bold text-center mt-6">Strategic Initiatives Overview</h3>
         <div class="grid grid-cols-1 md:grid-cols-${Math.min(strategic_initiatives.length, 3)} gap-6">`; // Adjust columns
    strategic_initiatives.forEach(init => {
        dashboardHtml += `<div class="summary-stat-card text-left p-4">
                                     <p class="font-bold text-lg text-white mb-2">${init.initiative_name}</p>
                                     <p class="text-xs text-indigo-300 italic mb-2">${init.rationale}</p>
                                     <p class="text-xs text-white/70">Objectives: ${init.objectives.length}</p>
                                  </div>`;
    });
    dashboardHtml += `</div>
    </div>`; // Close p-4 space-y-8
    dashboardPanel.innerHTML = dashboardHtml;


    // --- 2. Populate Strategic Map Panel (Only if loops exist) ---
    // --- START FIX ---
    if (hasLoops) {
        const mapPanel = dom.$("mapPanel");
        let mapHtml = `<div class="strategy-map-container p-4">
                    <div class="p-4 rounded-lg bg-black/20 border border-white/10 text-center w-full max-w-lg">
                        <h3 class="text-lg font-bold text-indigo-300">🎯 GOAL</h3>
                        <p class="text-2xl italic text-white/90">${system_goal}</p>
                    </div>
                    <div class="vertical-connector"></div>
                    <div class="feedback-loops-grid">
                        <div id="reinforcing-box" class="bg-black/20 p-4 rounded-lg border-2 border-green-400/50 text-center flex flex-col justify-between h-full">
                            <h4 class="text-lg font-bold">📈 Growth Engine</h4>
                            <p class="text-sm text-white/80 my-2">${reinforcing_loop.name}<br><span class="text-xs italic">${reinforcing_loop.description.substring(0,100)}...</span></p>
                        </div>
                        <div id="balancing-box" class="bg-black/20 p-4 rounded-lg border-2 border-yellow-400/50 text-center flex flex-col justify-between h-full">
                            <h4 class="text-lg font-bold">⚖️ Limiting Factor</h4>
                            <p class="text-sm text-white/80 my-2">${balancing_loop.name}<br><span class="text-xs italic">${balancing_loop.description.substring(0,100)}...</span></p>
                        </div>
                    </div>
                    <div class="lines-to-interventions">
                        <h3 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-white z-10 bg-gray-900 px-4 py-2 rounded">Strategic Interventions</h3>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-${strategic_initiatives.length} gap-8 w-full max-w-4xl mt-4">`; // Use actual count

        strategic_initiatives.forEach((initiative) => {
            // Simple indicator logic based on rationale text
            const strengthensReinforcing = initiative.rationale.toLowerCase().includes("strengthen") && initiative.rationale.toLowerCase().includes(reinforcing_loop.name.split(':')[0]);
            const weakensBalancing = (initiative.rationale.toLowerCase().includes("weaken") || initiative.rationale.toLowerCase().includes("address")) && initiative.rationale.toLowerCase().includes(balancing_loop.name.split(':')[0]);

            let indicatorHtml = "";
            if (strengthensReinforcing && weakensBalancing) {
                indicatorHtml = `<div class="initiative-target-indicator flex items-center justify-center gap-1"><span class="indicator-boost">▲</span><span class="indicator-mitigate">▼</span></div>`;
            } else if (strengthensReinforcing) {
                indicatorHtml = `<div class="initiative-target-indicator indicator-boost">▲</div>`;
            } else if (weakensBalancing) {
                indicatorHtml = `<div class="initiative-target-indicator indicator-mitigate">▼</div>`;
            }

            mapHtml += `<div class="relative pt-8">
                        ${indicatorHtml}
                        <div class="bg-black/20 p-4 rounded-lg h-full border border-white/10 flex items-center justify-center text-center">
                            <h4 class="text-md font-bold text-white/90">${initiative.initiative_name}</h4>
                        </div>
                    </div>`;
        });

        mapHtml += `</div></div>`;
        mapPanel.innerHTML = mapHtml;
    }
    // --- END FIX ---


    // --- 3. Populate Initiatives & KPIs Panel (Updated) ---
    const initiativesPanel = dom.$("initiativesPanel");
    let initiativesHtml = `<div class="p-4 space-y-6">`;
    strategic_initiatives.forEach((initiative, index) => {
        initiativesHtml += `
            <div class="prescription-card border-l-4 border-blue-500">
                <h3 class="text-2xl font-bold mb-2">Initiative ${index + 1}: ${initiative.initiative_name}</h3>
                <p class="rationale"><strong>Rationale:</strong> ${initiative.rationale}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-yellow-300 mb-2">Specific Objectives</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${initiative.objectives.map((obj) => `<li>${obj}</li>`).join("")}</ul>
                    </div>
                    <div class="bg-black/20 p-3 rounded">
                        <h5 class="font-bold text-green-300 mb-2">KPIs to Track</h5>
                        <ul class="list-disc list-inside space-y-1 text-white/90">${initiative.kpis.map((kpi) => `<li>${kpi}</li>`).join("")}</ul>
                    </div>
                </div>
            </div>
        `;
    });
    initiativesHtml += `</div>`;
    initiativesPanel.innerHTML = initiativesHtml;


    // --- 4. Populate Learn System Goals Panel (New) ---
    const learnPanel = dom.$("learnPanel");
    learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Setting Goals in a Systems Context</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">Why System Goals?</h4>
            <p class="text-sm text-white/80">Traditional goal setting often focuses on isolated metrics. System goals consider the interconnected nature of the organization. They aim to influence the underlying structure (feedback loops, delays, stocks, flows) to achieve desired outcomes sustainably, rather than just treating symptoms.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Connecting Goals to Loops:</h4>
                <ul class="list-disc list-inside space-y-2 text-sm">
                    <li><strong>Identify Dynamics:</strong> First, understand the key reinforcing (growth) and balancing (limiting) loops driving current behavior related to your desired outcome.</li>
                    <li><strong>Target Loops:</strong> Frame your goal and subsequent initiatives around manipulating these loops.
                        <ul class="list-[circle] list-inside pl-4 text-xs">
                           <li>To accelerate growth? -> Strengthen the reinforcing loop(s).</li>
                           <li>To overcome constraints? -> Weaken the balancing loop(s) or increase their limits.</li>
                           <li>To stabilize fluctuations? -> Strengthen balancing loops or add delays to reinforcing loops.</li>
                        </ul>
                    </li>
                    <li><strong>Anticipate Side Effects:</strong> Consider how interventions might affect *other* parts of the system or create new loops.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">From Goal to Action (System View):</h4>
                 <ol class="list-decimal list-inside space-y-1 text-sm">
                    <li><strong>Define System Goal:</strong> High-level desired state, considering system dynamics.</li>
                    <li><strong>Analyze Loops:</strong> Identify key R & B loops influencing the goal.</li>
                    <li><strong>Identify Leverage Points:</strong> Find where interventions will be most effective on the loops.</li>
                    <li><strong>Develop Initiatives:</strong> Design actions specifically targeting those leverage points to manipulate loops.</li>
                    <li><strong>Define Objectives:</strong> Break initiatives into smaller, measurable steps.</li>
                    <li><strong>Select KPIs:</strong> Choose metrics that track both initiative progress *and* the behavior of the targeted loops/elements.</li>
                    <li><strong>Monitor & Adapt:</strong> Observe system behavior and adjust interventions as needed.</li>
                 </ol>
            </div>
        </div>

        <details class="styled-details text-sm mt-4">
            <summary class="font-semibold">Example: Reducing Customer Churn</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p><strong>Traditional Goal:</strong> Reduce churn by 15%.</p>
                <p><strong>System Goal:</strong> Reduce churn by 15% by strengthening the 'Customer Loyalty' (R) loop and weakening the 'Support Strain' (B) loop.</p>
                <p><strong>Initiative (Strengthen R):</strong> Improve product onboarding -> increases satisfaction -> increases loyalty.</p>
                <p><strong>Initiative (Weaken B):</strong> Increase support staff -> increases capacity -> maintains service quality under load -> reduces frustration -> reduces churn.</p>
                <p class="text-xs italic mt-2">Notice how initiatives explicitly link to loop manipulation.</p>
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
                // No Plotly charts expected in this tool, so no resize needed
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    dom.$("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderSystemObjectivesPage_ST(container, data) {
    container.innerHTML = ""; // Clear loading

    // --- Validation for new structure ---
    if (!data || !data.main_objective || !data.goals) {
        console.error("Incomplete data passed to renderSystemObjectivesPage_ST:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        return;
    }

    // --- NEW CHECK FOR UNANALYZABLE TEXT ---
    // If the AI returns no goals and the objective contains "analyz", it's an error.
    if (data.goals.length === 0 && data.main_objective.toLowerCase().includes("analyz")) {
        console.warn("Data is unanalyzable. Displaying summary as error.");
        container.innerHTML = `<div class="p-4 text-center text-yellow-300">
                                    <h4 class="text-xl font-bold mb-3">Analysis Incomplete</h4>
                                    <p class="text-white/80">${data.main_objective}</p>
                                    <p class="text-sm text-white/70 mt-2">Please try again with text describing a business, a system problem, or a research plan.</p>
                                </div>`;
        dom.$("analysisActions").classList.add("hidden"); // Hide save buttons
        return; // Stop rendering
    }
    // --- END NEW CHECK ---

    // Destructure data. feedback_loops may be null.
    const { main_objective, feedback_loops, goals } = data;

    // --- START FIX ---
    // Check if feedback_loops and its properties exist
    const hasLoops = feedback_loops && feedback_loops.reinforcing_loop && feedback_loops.balancing_loop;
    const reinforcing_loop = hasLoops ? feedback_loops.reinforcing_loop : null;
    const balancing_loop = hasLoops ? feedback_loops.balancing_loop : null;
    // --- END FIX ---


    // --- Create Tab Navigation (Simplified) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Strategic Dashboard</button>
        ${hasLoops ? '<button class="analysis-tab-btn" data-tab="dynamics">🧠 System Dynamics</button>' : ''}
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn OGSM</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Simplified) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        ${hasLoops ? '<div id="dynamicsPanel" class="analysis-tab-panel"></div>' : ''}
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Dashboard Panel ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="st-dashboard-container">
                <div class="st-objective-card">
                    <h3 class="text-xl font-bold text-indigo-300">MAIN OBJECTIVE</h3>
                    <p class="text-2xl font-semibold mt-2">${main_objective}</p>
                </div>
                <div>
                    <h3 class="text-2xl font-bold text-center mb-4">Key Goals</h3>
                    <div class="st-goals-grid">`;
    goals.forEach((goal) => {
        // Handle if 'goal' is a string (from new prompt) or an object (from old)
        const goalName = (typeof goal === 'string') ? goal : goal.goal_name;
        dashboardHtml += `<div class="st-goal-card"><p class="text-lg font-bold">${goalName}</p></div>`;
    });
    dashboardHtml += `</div></div>`;
    
    // --- START FIX ---
    // Only show "Influential System Dynamics" if loops were found
    if (hasLoops) {
        dashboardHtml += `
                    <div>
                        <h3 class="text-2xl font-bold text-center mb-4">Influential System Dynamics</h3>
                        <div class="st-loops-grid">
                            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-green-400"><h4 class="text-lg font-bold">📈 Reinforcing Loop</h4><p class="text-sm text-white/80 my-2">${reinforcing_loop.description}</p></div>
                            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-yellow-400"><h4 class="text-lg font-bold">⚖️ Balancing Loop</h4><p class="text-sm text-white/80 my-2">${balancing_loop.description}</p></div>
                        </div>
                    </div>`;
    } else {
        // This will show for NexaFlow
        dashboardHtml += `<p class="text-center text-white/70 italic">No dynamic feedback loops (problems) were identified; analysis is focused on amplifying core strengths.</p>`;
    }
    // --- END FIX ---

    dashboardHtml += `</div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Populate System Dynamics Panel (Only if it exists) ---
    if (hasLoops) {
        const dynamicsPanel = dom.$("dynamicsPanel");
        // This panel is simple, just repeats the loops from the dashboard
        let dynamicsHtml = `<div class="p-4 space-y-6">
            <h3 class="text-2xl font-bold text-center mb-4">Influential System Dynamics</h3>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-green-400">
                <h4 class="text-lg font-bold">📈 Reinforcing Loop: ${reinforcing_loop.name}</h4>
                <p class="text-sm text-white/80 my-2">${reinforcing_loop.description}</p>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border-l-4 border-yellow-400">
                <h4 class="text-lg font-bold">⚖️ Balancing Loop: ${balancing_loop.name}</h4>
                <p class="text-sm text-white/80 my-2">${balancing_loop.description}</p>
            </div>
        </div>`;
        dynamicsPanel.innerHTML = dynamicsHtml;
    }

    // --- 3. Populate Learn Panel ---
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
                <p class="text-xs text-center text-white/60 mt-4">This tool focuses on the **O (Objective)** and **G (Goals)**, deriving them from your system's context.</p>
        </div>
    `;

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
            }
        }
    });
    dom.$("analysisActions").classList.remove("hidden");
}



// No changes needed to renderSystemActionsPage_ST as it already handles the structured data.
// Keep the existing renderSystemActionsPage_ST function as it was.
function renderSystemActionsPage_ST(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Add validation for new fields
    if (!data || !data.problem_diagnosis || !data.system_archetype || !data.actions) {
         console.error("Incomplete data passed to renderSystemActionsPage_ST:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render System Actions results.</div>`;
         dom.$("analysisActions").classList.add("hidden");
         return;
    }
    const { problem_diagnosis, system_archetype, actions } = data; // leverage_points are inside system_archetype now


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="actions">⚙️ Action Plan</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="dynamics">🧠 System Dynamics</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Actions & Archetypes</button> <!-- New -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="actionsPanel" class="analysis-tab-panel"></div>
        <div id="dynamicsPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New -->
    `;

    // --- 1. Dashboard Panel (Updated) ---
    const dashboardPanel = dom.$("dashboardPanel");
    let dashboardHtml = `<div class="p-4 space-y-8">
        <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90">
            <strong>Problem Diagnosis:</strong> ${problem_diagnosis}
        </blockquote>
        <div class="archetype-card text-center">
            <h3 class="text-lg font-bold text-indigo-300">DOMINANT ARCHETYPE</h3>
            <p class="text-2xl font-semibold mt-1">${system_archetype.name}</p>
        </div>
        <h3 class="text-2xl font-bold text-center">Action Plan Summary</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="actionTypeChart" class="w-full h-[350px] bg-black/10 rounded-lg p-2 plotly-chart"></div>
            <div id="actionCompareChart" class="w-full h-[350px] bg-black/10 rounded-lg p-2 plotly-chart"></div>
        </div>
    </div>`; // Close p-4 space-y-8
    dashboardPanel.innerHTML = dashboardHtml;

    // Chart 1: Action Types
    try {
        const shortTermCount = actions.filter(a => a.type === "Short-Term Fix").length;
        const longTermCount = actions.filter(a => a.type === "Long-Term Solution").length;
        Plotly.newPlot('actionTypeChart', [{
            values: [shortTermCount, longTermCount], labels: ["Short-Term Fixes", "Long-Term Solutions"],
            type: 'pie', hole: 0.4, marker: { colors: ["#f59e0b", "#2563eb"] }, textinfo: 'value+percent', insidetextorientation: 'radial'
        }], {
            title: 'Action Type Breakdown', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' }, showlegend: true, legend: { orientation: 'h', y: -0.1 }, margin: { t: 40, b: 40, l: 20, r: 20 }
        }, { responsive: true });
    } catch(e){ console.error("Chart err 1:",e); dom.$("actionTypeChart").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }

    // Chart 2: Impact vs Effort (ensure mapping exists)
    try {
        const valueMap = { Low: 1, Medium: 2, High: 3 };
        const actionNames = actions.map(a => a.action_name);
        // Add default values (e.g., 1 for 'Low') if impact/effort missing
        const impactValues = actions.map(a => valueMap[a.impact] || 1);
        const effortValues = actions.map(a => valueMap[a.effort] || 1);

        const impactTrace = { y: actionNames, x: impactValues, name: 'Impact', type: 'bar', orientation: 'h', marker: { color: 'var(--accent)' } };
        const effortTrace = { y: actionNames, x: effortValues, name: 'Effort', type: 'bar', orientation: 'h', marker: { color: 'rgba(255,255,255,0.4)' } };
        Plotly.newPlot('actionCompareChart', [impactTrace, effortTrace], {
            title: 'Impact vs. Effort Comparison', barmode: 'group', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' }, yaxis: { automargin: true, tickfont: {size: 10} }, // Smaller font size
            xaxis: { tickvals: [1, 2, 3], ticktext: ['Low', 'Medium', 'High'], gridcolor: "rgba(255,255,255,0.1)" }, // Lighter grid
            legend: { x: 0.5, y: -0.2, xanchor: 'center', orientation: 'h' }, // Center legend below
            margin: { t: 40, b: 60, l: 150, r: 20 } // Adjust margins maybe
        }, { responsive: true });
     } catch(e){ console.error("Chart err 2:",e); dom.$("actionCompareChart").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }


    // --- 2. Action Plan Panel (Updated) ---
    const actionsPanel = dom.$("actionsPanel");
    let actionsHtml = `<div class="p-4 space-y-6">`;
    // Separate actions by type
    const shortTermActions = actions.filter(a => a.type === "Short-Term Fix");
    const longTermActions = actions.filter(a => a.type === "Long-Term Solution");

    if (shortTermActions.length > 0) {
         actionsHtml += `<h3 class="text-xl font-bold mb-3 text-yellow-400 border-b border-yellow-400/50 pb-1">🩹 Short-Term Fixes (Symptomatic)</h3>`;
         shortTermActions.forEach((a) => {
             actionsHtml += `<div class="action-card short-term"> <!-- Added class -->
                                <h4 class="text-lg font-bold">${a.action_name}</h4>
                                <p class="text-xs font-semibold my-1"><span class="text-yellow-300">Impact:</span> ${a.impact || "?"} | <span class="text-blue-300">Effort:</span> ${a.effort || "?"}</p>
                                <p class="rationale"><strong>Rationale:</strong> ${a.rationale || "N/A"}</p>
                                <div class="bg-black/20 p-3 rounded text-sm mt-3">
                                    <h5 class="font-bold text-green-300 mb-2">KPIs to Track</h5>
                                    <ul class="list-disc list-inside space-y-1 text-white/90">${(a.kpis || []).map(k => `<li>${k}</li>`).join('')}</ul>
                                </div>
                            </div>`;
         });
    }

    if (longTermActions.length > 0) {
         actionsHtml += `<h3 class="text-xl font-bold mt-8 mb-3 text-blue-400 border-b border-blue-400/50 pb-1">🔧 Long-Term Solutions (Structural)</h3>`;
         longTermActions.forEach((a) => {
             actionsHtml += `<div class="action-card long-term"> <!-- Added class -->
                                <h4 class="text-lg font-bold">${a.action_name}</h4>
                                <p class="text-xs font-semibold my-1"><span class="text-yellow-300">Impact:</span> ${a.impact || "?"} | <span class="text-blue-300">Effort:</span> ${a.effort || "?"}</p>
                                <p class="rationale"><strong>Rationale:</strong> ${a.rationale || "N/A"}</p>
                                <div class="bg-black/20 p-3 rounded text-sm mt-3">
                                    <h5 class="font-bold text-green-300 mb-2">KPIs to Track</h5>
                                    <ul class="list-disc list-inside space-y-1 text-white/90">${(a.kpis || []).map(k => `<li>${k}</li>`).join('')}</ul>
                                </div>
                            </div>`;
         });
    }
     if (shortTermActions.length === 0 && longTermActions.length === 0) {
         actionsHtml += `<p class="text-center text-white/70 italic">No specific actions were generated based on the problem description.</p>`;
     }

    actionsHtml += `</div>`; // Close p-4 space-y-6
    actionsPanel.innerHTML = actionsHtml;


    // --- 3. System Dynamics Panel (Updated) ---
    const dynamicsPanel = dom.$("dynamicsPanel");
    let dynamicsHtml = `<div class="p-4 space-y-6">
        <div class="archetype-card">
            <h3 class="text-lg font-bold text-indigo-300">IDENTIFIED ARCHETYPE</h3>
            <p class="text-2xl font-semibold mt-1">${system_archetype.name}</p>
            <p class="text-sm text-white/80 mt-2 italic">${system_archetype.explanation}</p>
        </div>`;
        // Leverage points are now inside archetype object
        if (system_archetype.leverage_points && system_archetype.leverage_points.length > 0) {
             dynamicsHtml += `<div class="insight-card">
                                <h4 class="text-lg font-bold text-yellow-300">Key Leverage Points (Derived from Archetype & Context):</h4>
                                <ul class="list-disc list-inside space-y-2 mt-2 text-white/90">`;
             system_archetype.leverage_points.forEach((lp) => {
                 // Check if lp is an object with 'point' property, otherwise assume it's a string
                 const pointText = (typeof lp === 'object' && lp.point) ? lp.point : String(lp);
                 dynamicsHtml += `<li>${pointText}</li>`;
             });
             dynamicsHtml += `</ul></div>`;
        } else {
             dynamicsHtml += `<p class="text-center text-white/70 italic">No specific leverage points explicitly identified for this archetype in the context.</p>`;
        }
     dynamicsHtml += `</div>`; // Close p-4 space-y-6
    dynamicsPanel.innerHTML = dynamicsHtml;


    // --- 4. Populate Learn Actions & Archetypes Panel (New) ---
    const learnPanel = dom.$("learnPanel");
     learnPanel.innerHTML = `
    <div class="p-6 space-y-6 text-white/90">
        <h3 class="text-2xl font-bold text-center mb-4">🎓 Understanding Actions in Systems</h3>
        
        <div class="bg-black/20 p-4 rounded-lg">
            <h4 class="text-lg font-bold mb-2 text-indigo-300">Intervening in Complex Systems</h4>
            <p class="text-sm text-white/80">When dealing with systemic problems revealed by archetypes, interventions (actions) need to be carefully considered. Actions can target different leverage points and have varying time horizons and potential side effects.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/50">
                <h4 class="text-xl font-bold text-yellow-300 mb-2">🩹 Short-Term Fixes (Symptomatic Solutions)</h4>
                <ul class="list-disc list-inside space-y-2 text-sm">
                    <li><strong>Goal:</strong> Alleviate immediate pressure or visible symptoms.</li>
                    <li><strong>Pros:</strong> Quick relief, buys time, politically easier.</li>
                    <li><strong>Cons:</strong> Doesn't solve the root cause, may have unintended negative side effects, can create dependency (as in "Shifting the Burden").</li>
                    <li><strong>Example:</strong> Hiring temporary staff to handle a surge instead of fixing the underlying process causing the surge.</li>
                    <li><strong>When to Use:</strong> Sparingly, as a bridge to a fundamental solution, or when immediate relief is critical.</li>
                </ul>
            </div>
            <div class="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
                <h4 class="text-xl font-bold text-blue-300 mb-2">🔧 Long-Term Solutions (Structural Interventions)</h4>
                <ul class="list-disc list-inside space-y-2 text-sm">
                    <li><strong>Goal:</strong> Address the root cause by changing the system's structure (loops, delays, goals, rules).</li>
                    <li><strong>Pros:</strong> Sustainable improvement, prevents recurrence, builds resilience.</li>
                    <li><strong>Cons:</strong> Often slower to implement, requires deeper understanding, may face resistance, results may be delayed.</li>
                    <li><strong>Example:</strong> Redesigning the process to eliminate the cause of the surge, changing performance metrics that incentivize bad behavior.</li>
                    <li><strong>When to Use:</strong> Whenever possible for lasting change. Often requires combining with short-term fixes initially.</li>
                </ul>
            </div>
        </div>

         <div class="bg-white/5 p-4 rounded-lg mt-6 border border-white/10">
            <h4 class="text-lg font-bold mb-2">Linking Actions to Archetypes:</h4>
            <p class="text-sm text-white/80 mb-2">The most effective actions target the specific structure of the identified archetype:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
                <li><strong>Limits to Growth:</strong> Focus on removing or easing the limiting condition (B loop) OR managing the growth engine (R loop).</li>
                <li><strong>Shifting the Burden:</strong> Strengthen the fundamental solution while weakening the symptomatic one.</li>
                <li><strong>Fixes that Fail:</strong> Map out and address the unintended consequences; anticipate delays.</li>
                <li><strong>Tragedy of the Commons:</strong> Change the rules/incentives governing resource use.</li>
                <li><strong>Success to the Successful:</strong> Re-evaluate resource allocation; create level playing fields.</li>
                <li><strong>Escalation:</strong> Find ways to de-escalate; focus on shared goals.</li>
            </ul>
        </div>
         <p class="text-xs text-center text-white/60 mt-4">This tool attempts to categorize actions and link them to the identified archetype's dynamics based on your input.</p>
    </div>
    `;
    
    // --- NEW: Animate the new content ---
    const newElementsToAnimate = container.querySelectorAll(
        '.glass-container, .feature-card, .project-card, .kpi-card, .summary-stat-card, .prescription-card, .insight-card, .action-card, .ladder-rung, .dissonance-pole, .cascade-objective, .cascade-goal-card, .st-objective-card, .st-goal-card, .feedback-card, .plotly-chart, .styled-table'
    );
    animateElements(newElementsToAnimate);

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
                // Resize charts if the Dashboard tab is activated
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

     // Initial resize for charts in the default active tab (Dashboard)
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
    // setLoading('generate', false); // Handled in the calling function
}



// Ensure createParetoChartJS is available (it was defined in a previous step, but include it here for completeness if needed)
function createParetoChartJS(paretoData, containerId) {
    const container = dom.$(containerId);
    if (!container) {
        console.error(`Container with ID ${containerId} not found for Pareto chart.`);
        return;
    }
    container.innerHTML = ""; // Clear previous chart

    // Ensure paretoData exists and has the expected structure
    if (!paretoData || (!paretoData.vital_few && !paretoData.useful_many)) {
        container.innerHTML = "<p class='p-4 text-center text-red-400'>Pareto data is missing or incomplete.</p>";
        return;
    }

    const allCauses = (paretoData.vital_few || []).concat(paretoData.useful_many || []);
    if (allCauses.length === 0) {
        container.innerHTML = "<p class='p-4 text-center text-white/70'>No causes identified for Pareto analysis.</p>";
        return;
    }


    allCauses.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));

    const causes = allCauses.map((item) => item.cause || "Unknown Cause");
    const impacts = allCauses.map((item) => item.impact_score || 0);
    const categories = allCauses.map((item) => item.category || "Uncategorized");

    const cumulative = impacts.reduce((acc, val) => {
        acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val);
        return acc;
    }, []);
    // Ensure totalImpact is not zero before dividing
    const totalImpact = impacts.reduce((a, b) => a + b, 0);
    const cumulativePct = totalImpact > 0 ? cumulative.map((val) => (val / totalImpact) * 100) : cumulative.map(() => 0);


    const trace1 = {
        x: causes,
        y: impacts,
        name: "Impact Score",
        type: "bar",
        text: impacts.map((imp) => `${imp}%`),
        textposition: "outside",
        marker: { color: "var(--primary)" }, // Consistent color
        hovertemplate: "<b>%{x}</b><br>Impact: %{y}%<br>Category: %{customdata}<extra></extra>",
        customdata: categories
    };

    const trace2 = {
        x: causes,
        y: cumulativePct,
        name: "Cumulative %",
        type: "scatter",
        mode: "lines+markers",
        line: { color: "var(--accent)", width: 3 }, // Accent color for line
        marker: { size: 8 },
        yaxis: "y2",
        hovertemplate: "<b>%{x}</b><br>Cumulative: %{y:.1f}%<extra></extra>"
    };

    // Find the index where cumulative percentage crosses 80%
    const eightyPercentIndex = cumulativePct.findIndex(p => p >= 80);
    let vitalFewCount = eightyPercentIndex !== -1 ? eightyPercentIndex + 1 : allCauses.length;
    // Ensure vitalFewCount matches the actual vital_few array length if provided, otherwise use calculated
    vitalFewCount = paretoData.vital_few ? paretoData.vital_few.length : vitalFewCount;


    const layout = {
        title: "Pareto Analysis - Vital Few vs. Useful Many Causes",
        xaxis: { title: "Potential Root Causes", tickangle: -45, automargin: true },
        yaxis: { title: "Estimated Impact Score (%)", gridcolor: "rgba(255,255,255,0.1)" },
        yaxis2: {
            title: "Cumulative Impact (%)",
            overlaying: "y",
            side: "right",
            range: [0, 101],
            gridcolor: "rgba(255,255,255,0.05)",
            zeroline: false
        },
        shapes: [
            // 80% cumulative line
            { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y2", y0: 80, y1: 80, line: { color: "orange", width: 2, dash: "dot" } },
            // Vertical line separating vital few
            vitalFewCount > 0 && vitalFewCount < allCauses.length ? { type: "line", xref: "x", x0: vitalFewCount - 0.5, x1: vitalFewCount - 0.5, yref: "paper", y0: 0, y1: 1, line: { color: "rgba(255, 0, 0, 0.5)", width: 2, dash: "dash" } } : {}
        ],
        annotations: [
            vitalFewCount > 0 ? { xref: 'x', yref: 'paper', x: (vitalFewCount - 1) / 2, y: 1.05, text: '🔥 Vital Few', showarrow: false, font: {color: 'red'} } : {},
            vitalFewCount < allCauses.length ? { xref: 'x', yref: 'paper', x: vitalFewCount + (allCauses.length - vitalFewCount -1) / 2, y: 1.05, text: '📋 Useful Many', showarrow: false, font: {color: 'grey'} } : {},
            { xref: 'paper', yref: 'y2', x: 0.95, y: 80, text: '80% Impact', showarrow: false, font: {color: 'orange'}, xanchor: 'right', yanchor: 'bottom' }
        ],
        showlegend: true,
        height: 550, // Increased height slightly
        hovermode: "x unified",
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "white" },
        legend: { orientation: "h", y: -0.3 }, // Adjusted legend position
        margin: { t: 60, b: 150, l: 60, r: 60 } // Adjusted margins
    };

    Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true });
}


export {
    renderProcessMappingPage,
    renderParetoFishbonePage,
    renderSystemThinkingPage,
    renderLeveragePointsPage,
    renderArchetypeAnalysisPage,
    renderSystemGoalsPage,
    renderSystemObjectivesPage_ST,
    renderSystemActionsPage_ST,
    createParetoChartJS
}
