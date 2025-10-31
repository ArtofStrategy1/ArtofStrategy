// =====================================================================================================
// ===================          Systems Thinking Page Rendering Functions           ====================
// =====================================================================================================

function renderProcessMappingPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator
    // Add validation for new fields
    if (!data || !data.process_name || !data.steps || !data.connections || !data.bottlenecks || !data.optimizations || !data.kpis) {
        console.error("Incomplete data passed to renderProcessMappingPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Process Map results.</div>`;
        $("analysisActions").classList.add("hidden");
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
    const flowchartPanel = $("flowchartPanel");
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
    const detailsPanel = $("detailsPanel");
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
    const optimizationsPanel = $("optimizationsPanel");
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
    const kpisPanel = $("kpisPanel");
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
    const mermaidPanel = $("mermaidPanel");
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
    const learnPanel = $("learnPanel");
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

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderParetoFishbonePage(container, data) {
    container.innerHTML = ""; // Clear loading
    // Basic validation
    if (!data || !data.problem_statement || !data.fishbone || !data.pareto_analysis || !data.action_plan) {
        console.error("Incomplete data passed to renderParetoFishbonePage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Pareto/Fishbone results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }

    const { problem_statement, fishbone, pareto_analysis, action_plan } = data;

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="pareto">📊 Pareto Chart & Summary</button>
        <button class="analysis-tab-btn" data-tab="fishbone">🐟 Fishbone Diagram</button>
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
        <div id="actionPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div>
    `;

    // --- 1. Populate Pareto Chart & Summary Tab ---
    const paretoPanel = $("paretoPanel");
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
        $("paretoChartContainer").innerHTML = "<p class='p-4 text-center text-red-400'>Could not render Pareto chart.</p>";
    }

    // --- 2. Populate Fishbone Diagram Tab (Textual) ---
    const fishbonePanel = $("fishbonePanel");
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
    const actionPanel = $("actionPanel");
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

    // --- 4. Populate Learn Techniques Tab ---
    const learnPanel = $("learnPanel");
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
                // Resize chart if the Pareto tab is activated
                const chart = targetPanel.querySelector('.plotly-chart');
                if (chart && chart.layout && typeof Plotly !== 'undefined') {
                    try { Plotly.Plots.resize(chart); } catch (err) { console.error("Resize err:", err); }
                }
            } else {
                console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    // Attempt initial resize for chart in the default active tab (Pareto)
    setTimeout(() => {
        const initialChart = $('paretoChartContainer');
        if (initialChart && initialChart.layout && typeof Plotly !== 'undefined') {
            try { Plotly.Plots.resize(initialChart); } catch (err) { console.error("Initial Resize err:", err); }
        }
    }, 150);


    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderSystemThinkingPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator

    // Add validation for new fields
    if (!data || !data.elements || !data.feedback_loops || !data.summary || !data.leverage_points) {
        console.error("Incomplete data passed to renderSystemThinkingPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render System Thinking results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }
    const { elements, feedback_loops, summary, leverage_points } = data;


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="gist">📝 Gist & Elements</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="loops">🔄 Feedback Loops</button>
        <button class="analysis-tab-btn" data-tab="leverage">⚡ Leverage Points</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn System Thinking</button> <!-- New -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="gistPanel" class="analysis-tab-panel active"></div>
        <div id="loopsPanel" class="analysis-tab-panel"></div>
        <div id="leveragePanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New -->
    `;

    // --- 1. Populate Gist & Elements Panel (Updated) ---
    const gistPanel = $("gistPanel");
    let gistHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">System Overview</h3>`;
    gistHtml += `<blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90 mb-6 text-sm">"${summary}"</blockquote>`; // Use enhanced summary
    gistHtml += `<h4 class="text-xl font-semibold mb-3">Key System Elements Identified</h4>`;
    // Table for elements
     gistHtml += `<div class="overflow-x-auto">
                    <table class="coeff-table styled-table text-sm">
                        <thead><tr><th>Element Name</th><th>Type</th><th>Description (Inferred Role)</th></tr></thead>
                        <tbody>`;
    elements.forEach(el => {
         let description = "";
         if (el.type === "Stock") description = "Accumulation over time (e.g., Customers, Inventory, Cash)";
         else if (el.type === "Flow") description = "Rate of change affecting a Stock (e.g., Sales Rate, Production Rate)";
         else if (el.type === "Variable") description = "Factor influencing Flows or other Variables (e.g., Price, Quality)";
         else if (el.type === "Parameter") description = "Constant or policy influencing the system (e.g., Tax Rate, Standard Procedure)";

        gistHtml += `<tr>
                        <td class="font-semibold">${el.name}</td>
                        <td class="font-mono text-xs">${el.type}</td>
                        <td class="text-white/70">${description}</td>
                     </tr>`;
    });
     gistHtml += `</tbody></table></div>`;

    gistHtml += `</div>`; // Close p-4
    gistPanel.innerHTML = gistHtml;

    // --- 2. Populate Feedback Loops Panel (Updated for detail) ---
    const loopsPanel = $("loopsPanel");
    let loopsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Identified Feedback Loops</h3><div class="space-y-6">`; // Increased spacing
    feedback_loops.forEach((loop) => {
        const isReinforcing = loop.type.toLowerCase() === "reinforcing";
        const loopIcon = isReinforcing ? "📈" : "⚖️"; // More distinct icons
        const loopColor = isReinforcing ? "border-green-400" : "border-yellow-400";
        loopsHtml += `
            <div class="bg-black/20 p-4 rounded-lg border-l-4 ${loopColor}">
                <h4 class="text-lg font-bold flex items-center gap-2">${loopIcon} ${loop.name} <span class="text-xs font-light text-white/60">(${loop.type})</span></h4>
                <p class="text-sm text-white/80 my-3 italic"><strong>Causal Chain:</strong> ${loop.description}</p>
                <div class="text-xs text-white/60"><strong>Key Elements Involved:</strong> ${loop.elements.join(", ")}</div>
            </div>`;
    });
    loopsHtml += `</div></div>`; // Close space-y-6 and p-4
    loopsPanel.innerHTML = loopsHtml;

    // --- 3. Populate Leverage Points Panel (Updated for detail) ---
    const leveragePanel = $("leveragePanel");
    let leverageHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">⚡ High-Impact Leverage Points</h3>`;
    if (leverage_points && leverage_points.length > 0) {
        leverageHtml += `<p class="text-sm text-white/70 mb-6 italic">Interventions at these points are likely to cause significant shifts in the system's behavior by influencing the core feedback loops.</p>`;
        leverageHtml += `<div class="space-y-6">`;
        leverage_points.forEach((point, index) => {
            leverageHtml += `
                <div class="prescription-card border-l-4 border-indigo-400">
                     <h4 class="text-xl font-bold">${index + 1}. ${point.point_name}</h4>
                     <p class="text-xs font-semibold my-1 text-indigo-300">TARGET ELEMENT: ${point.target_element || 'N/A'}</p>
                     <p class="rationale"><strong>Proposed Intervention:</strong> ${point.intervention || 'N/A'}</p>
                     <div class="p-3 bg-black/20 rounded mt-3 text-sm">
                         <p><strong>Expected Impact on Loops:</strong> ${point.expected_impact || 'N/A'}</p>
                     </div>
                </div>`;
        });
        leverageHtml += `</div>`;
    } else {
        leverageHtml += `<p class="text-center text-white/70 italic">No specific leverage points were clearly identified from the provided system description.</p>`;
    }
    leverageHtml += `</div>`; // Close p-4
    leveragePanel.innerHTML = leverageHtml;


    // --- 4. Populate Learn System Thinking Panel (New) ---
    const learnPanel = $("learnPanel");
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
                    <li><strong>Non-linearity:</strong> Cause and effect are not always proportional; small changes can sometimes have large effects (leverage points).</li>
                    <li><strong>Emergence:</strong> System behavior arises from the interactions of its parts and cannot always be predicted by looking at the parts in isolation.</li>
                </ul>
            </div>
            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                <h4 class="text-lg font-bold mb-2">Why Use System Thinking?</h4>
                 <ul class="list-disc list-inside space-y-1 text-sm">
                    <li><strong>See the Bigger Picture:</strong> Understand context and connections.</li>
                    <li><strong>Identify Root Causes:</strong> Move beyond addressing symptoms to find underlying structural issues.</li>
                    <li><strong>Find High-Leverage Interventions:</strong> Identify points where small efforts yield significant results.</li>
                    <li><strong>Anticipate Unintended Consequences:</strong> Recognize how changes might ripple through the system.</li>
                    <li><strong>Understand Dynamic Behavior:</strong> Explain patterns of growth, decline, oscillation, or stability over time.</li>
                    <li><strong>Foster Collaboration:</strong> Provides a shared language to discuss complex problems.</li>
                 </ul>
            </div>
        </div>

         <details class="styled-details text-sm mt-4">
            <summary class="font-semibold">Common System Archetypes (Recurring Patterns)</summary>
            <div class="bg-black/20 p-4 rounded-b-lg space-y-2">
                <p><strong>Limits to Growth:</strong> Growth eventually slows or stops due to a limiting factor (a balancing loop).</p>
                <p><strong>Shifting the Burden:</strong> Using a short-term fix distracts from or undermines a fundamental long-term solution.</p>
                <p><strong>Fixes that Fail:</strong> A solution creates unintended consequences elsewhere that worsen the original problem later.</p>
                <p><strong>Tragedy of the Commons:</strong> Individuals overusing a shared resource deplete it for everyone.</p>
                <p><strong>Success to the Successful:</strong> Winners get more resources, enabling them to win even more, while losers fall further behind.</p>
                <p><strong>Escalation:</strong> Two parties react competitively, leading to an accelerating race none desires.</p>
                 <p class="text-xs italic mt-2">Recognizing these patterns helps diagnose systemic issues quickly.</p>
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
                // No Plotly charts expected in this version, so no resize needed
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderLeveragePointsPage(container, data) {
    container.innerHTML = ""; // Clear the loading indicator

    // Add validation for new fields
    if (!data || !data.elements || !data.feedback_loops || !data.summary || !data.leverage_points) {
        console.error("Incomplete data passed to renderLeveragePointsPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render Leverage Points results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }
    const { elements, feedback_loops, summary, leverage_points } = data;


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="gist">📝 Gist & Elements</button>
        <button class="analysis-tab-btn" data-tab="loops">🔄 Feedback Loops</button>
        <button class="analysis-tab-btn" data-tab="leverage">⚡ Leverage Points & Interventions</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Leverage Points</button> <!-- New -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="gistPanel" class="analysis-tab-panel active"></div>
        <div id="loopsPanel" class="analysis-tab-panel"></div>
        <div id="leveragePanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New -->
    `;

    // --- 1. Populate Gist & Elements Panel (Reusing logic from System Thinking) ---
    const gistPanel = $("gistPanel");
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
    const loopsPanel = $("loopsPanel");
    let loopsHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">Identified Feedback Loops</h3><div class="space-y-6">`;
    feedback_loops.forEach((loop) => {
        const isReinforcing = loop.type.toLowerCase() === "reinforcing";
        const loopIcon = isReinforcing ? "📈" : "⚖️";
        const loopColor = isReinforcing ? "border-green-400" : "border-yellow-400";
        loopsHtml += `
            <div class="bg-black/20 p-4 rounded-lg border-l-4 ${loopColor}">
                <h4 class="text-lg font-bold flex items-center gap-2">${loopIcon} ${loop.name} <span class="text-xs font-light text-white/60">(${loop.type})</span></h4>
                <p class="text-sm text-white/80 my-3 italic"><strong>Causal Chain:</strong> ${loop.description}</p>
                <div class="text-xs text-white/60"><strong>Key Elements Involved:</strong> ${loop.elements.join(", ")}</div>
            </div>`;
    });
    loopsHtml += `</div></div>`;
    loopsPanel.innerHTML = loopsHtml;

    // --- 3. Populate Leverage Points Panel (Updated for detailed interventions) ---
    const leveragePanel = $("leveragePanel");
    let leverageHtml = `<div class="p-4"><h3 class="text-2xl font-bold mb-4">⚡ High-Impact Leverage Points & Interventions</h3>`;
    if (leverage_points && leverage_points.length > 0) {
        leverageHtml += `<p class="text-sm text-white/70 mb-6 italic">These are ranked intervention points where actions can significantly shift system behavior, ordered from potentially highest to lowest impact based on system principles.</p>`;
        leverageHtml += `<div class="space-y-6">`;
        // Sort points based on High > Medium > Low impact rank for rendering
        const impactOrder = { "High": 1, "Medium": 2, "Low": 3 };
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
    const learnPanel = $("learnPanel");
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
            <p class="text-sm text-white/80">This tool analyzes the system description to identify key feedback loops. It then suggests interventions (Leverage Points) targeting specific elements, parameters, or connections within those loops. The 'Potential Impact Rank' attempts to align with Meadows' hierarchy, suggesting whether the intervention targets a relatively low (e.g., parameter change) or potentially higher (e.g., rule/goal change implied by context) point of leverage.</p>
        </div>
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
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
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

    analysisCache[currentTemplateId] = container.innerHTML;

    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            const targetPanel = $(e.target.dataset.tab + "Panel");
            targetPanel.classList.add("active");
            const chart = targetPanel.querySelector(".plotly-chart");
            if (chart) Plotly.Plots.resize(chart);
        }
    });
}



function renderSystemGoalsPage(container, data) {
    container.innerHTML = ""; // Clear loading

    // Add validation for new fields
    if (!data || !data.system_goal || !data.key_loops || !data.strategic_initiatives || !data.key_loops.reinforcing_loop || !data.key_loops.balancing_loop) {
        console.error("Incomplete data passed to renderSystemGoalsPage:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render System Goals results.</div>`;
        $("analysisActions").classList.add("hidden");
        return;
    }

    const { system_goal, key_loops, strategic_initiatives } = data;


    // --- Create Tab Navigation (Updated) ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="dashboard">📊 Dashboard</button>
        <button class="analysis-tab-btn" data-tab="map">🗺️ Strategic Map</button>
        <button class="analysis-tab-btn" data-tab="initiatives">🚀 Initiatives & KPIs</button> <!-- Renamed -->
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn System Goals</button> <!-- New -->
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels (Updated) ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="dashboardPanel" class="analysis-tab-panel active"></div>
        <div id="mapPanel" class="analysis-tab-panel"></div>
        <div id="initiativesPanel" class="analysis-tab-panel"></div>
        <div id="learnPanel" class="analysis-tab-panel"></div> <!-- New -->
    `;

    // --- 1. Populate Dashboard Panel (Updated) ---
    const dashboardPanel = $("dashboardPanel");
    let dashboardHtml = `<div class="p-4 space-y-8">
        <div class="p-6 rounded-lg bg-black/20 border border-white/10 text-center">
            <h3 class="text-xl font-bold mb-2 text-indigo-300">🎯 Overarching System Goal</h3>
            <p class="text-2xl italic text-white/90">${system_goal}</p>
        </div>
        <h3 class="text-2xl font-bold text-center">Key System Dynamics Affecting Goal</h3>
        <div class="grid md:grid-cols-2 gap-8">
            <div class="bg-black/20 p-4 rounded-lg border-l-4 border-green-400">
                <h4 class="text-lg font-bold flex items-center gap-2">📈 ${key_loops.reinforcing_loop.name} <span class="text-xs font-light text-white/60">(Reinforcing)</span></h4>
                <p class="text-sm text-white/80 my-3 italic">${key_loops.reinforcing_loop.description}</p>
                <div class="text-xs text-white/60"><strong>Elements:</strong> ${key_loops.reinforcing_loop.elements.join(", ")}</div>
            </div>
            <div class="bg-black/20 p-4 rounded-lg border-l-4 border-yellow-400">
                 <h4 class="text-lg font-bold flex items-center gap-2">⚖️ ${key_loops.balancing_loop.name} <span class="text-xs font-light text-white/60">(Balancing)</span></h4>
                <p class="text-sm text-white/80 my-3 italic">${key_loops.balancing_loop.description}</p>
                <div class="text-xs text-white/60"><strong>Elements:</strong> ${key_loops.balancing_loop.elements.join(", ")}</div>
            </div>
        </div>
         <h3 class="text-2xl font-bold text-center mt-6">Strategic Initiatives Overview</h3>
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


    // --- 2. Populate Strategic Map Panel (Reusing existing logic) ---
    const mapPanel = $("mapPanel");
    let mapHtml = `<div class="strategy-map-container p-4">
                <div class="p-4 rounded-lg bg-black/20 border border-white/10 text-center w-full max-w-lg">
                    <h3 class="text-lg font-bold text-indigo-300">🎯 GOAL</h3>
                    <p class="text-2xl italic text-white/90">${system_goal}</p>
                </div>
                <div class="vertical-connector"></div>
                <div class="feedback-loops-grid">
                    <div id="reinforcing-box" class="bg-black/20 p-4 rounded-lg border-2 border-green-400/50 text-center flex flex-col justify-between h-full">
                        <h4 class="text-lg font-bold">📈 Growth Engine</h4>
                        <p class="text-sm text-white/80 my-2">${key_loops.reinforcing_loop.name}<br><span class="text-xs italic">${key_loops.reinforcing_loop.description.substring(0,100)}...</span></p>
                    </div>
                    <div id="balancing-box" class="bg-black/20 p-4 rounded-lg border-2 border-yellow-400/50 text-center flex flex-col justify-between h-full">
                        <h4 class="text-lg font-bold">⚖️ Limiting Factor</h4>
                        <p class="text-sm text-white/80 my-2">${key_loops.balancing_loop.name}<br><span class="text-xs italic">${key_loops.balancing_loop.description.substring(0,100)}...</span></p>
                    </div>
                </div>
                <div class="lines-to-interventions">
                    <h3 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-white z-10 bg-gray-900 px-4 py-2 rounded">Strategic Interventions</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-${strategic_initiatives.length} gap-8 w-full max-w-4xl mt-4">`; // Use actual count

    strategic_initiatives.forEach((initiative) => {
        // Simple indicator logic based on rationale text
        const strengthensReinforcing = initiative.rationale.toLowerCase().includes("strengthen") && initiative.rationale.toLowerCase().includes(key_loops.reinforcing_loop.name.split(':')[0]);
        const weakensBalancing = (initiative.rationale.toLowerCase().includes("weaken") || initiative.rationale.toLowerCase().includes("address")) && initiative.rationale.toLowerCase().includes(key_loops.balancing_loop.name.split(':')[0]);

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


    // --- 3. Populate Initiatives & KPIs Panel (Updated) ---
    const initiativesPanel = $("initiativesPanel");
    let initiativesHtml = `<div class="p-4 space-y-6">`;
    strategic_initiatives.forEach((initiative, index) => {
        initiativesHtml += `
            <div class="prescription-card border-l-4 border-blue-500">
                <h3 class="text-2xl font-bold mb-2">Initiative ${index + 1}: ${initiative.initiative_name}</h3>
                <p class="rationale"><strong>Systems Rationale:</strong> ${initiative.rationale}</p>
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
    const learnPanel = $("learnPanel");
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
                 // No Plotly charts expected in this tool, so no resize needed
            } else {
                 console.warn("Target panel not found:", targetPanelId);
            }
        }
    });

    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderSystemObjectivesPage_ST(container, data) {
    container.innerHTML = "";
    const { main_objective, feedback_loops, goals, strategies_and_initiatives } = data;
    if (!main_objective || !feedback_loops || !goals) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">Incomplete data received.</div>`;
        return;
    }

    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `<button class="analysis-tab-btn active" data-tab="dashboard">📊 Strategic Dashboard</button><button class="analysis-tab-btn" data-tab="strategies">🗺️ Goals & Strategies</button><button class="analysis-tab-btn" data-tab="initiatives">🚀 Initiatives & KPIs</button>`;
    container.appendChild(tabNav);

    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `<div id="dashboardPanel" class="analysis-tab-panel active"></div><div id="strategiesPanel" class="analysis-tab-panel"></div><div id="initiativesPanel" class="analysis-tab-panel"></div>`;

    // --- 1. Dashboard Panel ---
    const dashboardPanel = $("dashboardPanel");
    let dashboardHtml = `<div class="st-dashboard-container">
                <div class="st-objective-card">
                    <h3 class="text-xl font-bold text-indigo-300">MAIN OBJECTIVE</h3>
                    <p class="text-2xl font-semibold mt-2">${main_objective}</p>
                </div>
                <div>
                    <h3 class="text-2xl font-bold text-center mb-4">Key Goals</h3>
                    <div class="st-goals-grid">`;
    goals.forEach((goal) => {
        dashboardHtml += `<div class="st-goal-card"><p class="text-lg font-bold">${goal}</p></div>`;
    });
    dashboardHtml += `</div></div>
                <div>
                    <h3 class="text-2xl font-bold text-center mb-4">Influential System Dynamics</h3>
                    <div class="st-loops-grid">
                        <div class="bg-white/5 p-4 rounded-lg border-l-4 border-green-400"><h4 class="text-lg font-bold">📈 Reinforcing Loop</h4><p class="text-sm text-white/80 my-2">${feedback_loops.reinforcing_loop}</p></div>
                        <div class="bg-white/5 p-4 rounded-lg border-l-4 border-yellow-400"><h4 class="text-lg font-bold">⚖️ Balancing Loop</h4><p class="text-sm text-white/80 my-2">${feedback_loops.balancing_loop}</p></div>
                    </div>
                </div>
            </div>`;
    dashboardPanel.innerHTML = dashboardHtml;

    // --- 2. Goals & Strategies Panel ---
    const strategiesPanel = $("strategiesPanel");
    let strategiesHtml = `<div class="p-4 space-y-6">`;
    strategies_and_initiatives.forEach((item) => {
        strategiesHtml += `<div class="prescription-card">
                    <p class="text-sm font-semibold text-indigo-300">GOAL</p>
                    <h4 class="text-2xl font-bold mb-2">${item.goal}</h4>
                    <p class="rationale"><strong>System-Aware Strategy:</strong> ${item.strategy}</p>
                </div>`;
    });
    strategiesHtml += `</div>`;
    strategiesPanel.innerHTML = strategiesHtml;

    // --- 3. Initiatives & KPIs Panel ---
    const initiativesPanel = $("initiativesPanel");
    let initiativesHtml = `<div class="p-4"><div class="overflow-x-auto"><table class="coeff-table"><thead><tr><th>Initiative</th><th>Related Goal</th><th>KPIs to Track</th></tr></thead><tbody>`;
    strategies_and_initiatives.forEach((item) => {
        item.initiatives.forEach((initiative) => {
            initiativesHtml += `<tr><td>${initiative}</td><td>${item.goal}</td><td>${item.kpis.join(", ")}</td></tr>`;
        });
    });
    initiativesHtml += `</tbody></table></div></div>`;
    initiativesPanel.innerHTML = initiativesHtml;

    analysisCache[currentTemplateId] = container.innerHTML;
    tabNav.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
            tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));
            e.target.classList.add("active");
            $(e.target.dataset.tab + "Panel").classList.add("active");
        }
    });
    $("analysisActions").classList.remove("hidden");
}



function renderSystemActionsPage_ST(container, data) {
    container.innerHTML = ""; // Clear loading state

    // Add validation for new fields
    if (!data || !data.problem_diagnosis || !data.system_archetype || !data.actions) {
         console.error("Incomplete data passed to renderSystemActionsPage_ST:", data);
         container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete analysis data received. Cannot render System Actions results.</div>`;
         $("analysisActions").classList.add("hidden");
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
    const dashboardPanel = $("dashboardPanel");
    let dashboardHtml = `<div class="p-4 space-y-8">
        <blockquote class="p-4 italic border-l-4 border-gray-500 bg-black/20 text-white/90">
            <strong>Diagnosis/Goal:</strong> ${problem_diagnosis} <!-- Updated Label -->
        </blockquote>
        <div class="archetype-card text-center">
            <h3 class="text-lg font-bold text-indigo-300">SYSTEM DYNAMIC/ARCHETYPE</h3> <!-- Updated Label -->
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
    } catch(e){ console.error("Chart err 1:",e); $("actionTypeChart").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }

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
     } catch(e){ console.error("Chart err 2:",e); $("actionCompareChart").innerHTML = "<p class='text-red-400 text-center pt-10'>Chart render error.</p>"; }


    // --- 2. Action Plan Panel (Updated) ---
    const actionsPanel = $("actionsPanel");
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
    const dynamicsPanel = $("dynamicsPanel");
    let dynamicsHtml = `<div class="p-4 space-y-6">
        <div class="archetype-card">
            <h3 class="text-lg font-bold text-indigo-300">SYSTEM DYNAMIC / ARCHETYPE IDENTIFIED</h3> <!-- Updated Label -->
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
             dynamicsHtml += `<p class="text-center text-white/70 italic">No specific leverage points explicitly identified for this archetype/dynamic in the context.</p>`; // Modified text
        }
     dynamicsHtml += `</div>`; // Close p-4 space-y-6
    dynamicsPanel.innerHTML = dynamicsHtml;


    // --- 4. Populate Learn Actions & Archetypes Panel (Keep as is) ---
    const learnPanel = $("learnPanel");
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


    // --- Final Touches ---
    analysisCache[currentTemplateId] = container.innerHTML; // Cache result

    // Tab switching logic (ensure resizing happens)
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


    $("analysisActions").classList.remove("hidden"); // Show save buttons
    // setLoading('generate', false); // Handled in the calling function
}



function renderConceptsTab(concepts, containerId) {
    const container = $(containerId);
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
    const container = $(containerId);
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
    const container = $(containerId);
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
    const container = $(containerId);
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
