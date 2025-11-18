import { appState } from "../state/app-state.mjs";
import { appConfig } from "../config.mjs";
import { dom } from "../utils/dom-utils.mjs";
import { setLoading, animateElements } from "../utils/ui-utils.mjs";
import { getFrameworkForTemplate, getSelectedSections } from "../ui/template-creation/framework-selection.mjs";
import { attemptMergeAndRender } from "../ui/analysis-rendering/analysis-rendering.mjs";
import { fetchFileAsObject } from "../utils/file-utils.mjs";
import { parseMarkdownTable } from "../utils/text-utils.mjs";
import * as handleSP from "./analysis-handling-sp.mjs";
import * as handleST from "./analysis-handling-st.mjs";
import * as handleNS from "./analysis-handling-ns.mjs";
import * as handleDA from "./analysis-handling-da.mjs";
import * as renderST from "../ui/analysis-rendering/analysis-rendering-st.mjs";

async function handleGenerate() {
    if (!appState.currentTemplateId) return;

    const analysisResultContainer = dom.$("analysisResult");
    setLoading("generate", true);
    const analysisActionsEl = dom.$("analysisActions");
    // 1. Hide the actions panel.
    if (analysisActionsEl) {
        analysisActionsEl.classList.add("hidden");
    }

    // 2. Start an if/else if chain to route the request.
    if (appState.currentTemplateId === "mission-vision") {
        await handleSP.handleMissionVisionAnalysis(); // Now it will be called
    } else if (appState.currentTemplateId === "objectives") {
        await handleSP.handleObjectivesAnalysis(); // This one too
    } else if (appState.currentTemplateId === "swot-tows") {
        await handleSP.handleSwotTowsAnalysis();
    } else if (appState.currentTemplateId === "archetype-analysis") {
        await handleST.handleArchetypeAnalysis();
    } else if (appState.currentTemplateId === "leverage-points") {
        await handleST.handleLeveragePointsAnalysis();
    } else if (appState.currentTemplateId === "visualization") {
        await handleDA.handleVisualizationAnalysis_DA();
    } else if (appState.currentTemplateId === "prescriptive-analysis") {
        await handleDA.handlePrescriptiveAnalysis_DA();
    } else if (appState.currentTemplateId === "all-framework") {
        await handleNS.handleAllFrameworkAnalysis();
    } else if (appState.currentTemplateId === "thinking-system") {
        // <-- ADD THIS BLOCK
        await handleNS.handleThinkingSystemAnalysis_NS();
    } else if (appState.currentTemplateId === "creative-dissonance") {
        // <-- ADD THIS BLOCK
        await handleNS.handleCreativeDissonanceAnalysis_NS();
    } else if (appState.currentTemplateId === "pareto-fishbone") {
        await handleST.handleParetoFishboneAnalysisComb();
    } else if (appState.currentTemplateId === "system-actions") {
        // <-- ADD THIS BLOCK
        await handleST.handleSystemActionsAnalysis_ST();
    } else if (appState.currentTemplateId === "goals-initiatives") {
        await handleSP.handleGoalsAndInitiativesAnalysis_SP();
    } else if (appState.currentTemplateId === "living-system") {
        // <-- ADD THIS BLOCK
        await handleNS.handleLivingSystemAnalysis_NS();
    } else if (appState.currentTemplateId === "system-objectives") {
        // <-- ADD THIS BLOCK
        await handleST.handleSystemObjectivesAnalysis_ST();
    } else if (appState.currentTemplateId === "pls-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handlePlsAnalysis_DA();
    } else if (appState.currentTemplateId === "sem-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleSemAnalysis();
    } else if (appState.currentTemplateId === "predictive-analysis") {
        await handleDA.handlePredictiveAnalysis();
    } else if (appState.currentTemplateId === "dematel-analysis") {
        await handleDA.handleDematelAnalysis();
    } else if (appState.currentTemplateId === "descriptive-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleDescriptiveAnalysis_DA();
    } else if (appState.currentTemplateId === "kpi-events") {
        await handleSP.handleKpiAnalysis_KE();
    } else if (appState.currentTemplateId === "regression-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleRegressionAnalysis_DA();
    } else if (appState.currentTemplateId === "novel-goals-initiatives") {
        // <-- ADD THIS BLOCK
        await handleNS.handleNovelGoalsAnalysis_NS();
    } else if (appState.currentTemplateId === "misc-summary") {
        await handleSP.handleMiscAnalysis_MSC();
    } else if (appState.currentTemplateId === "action-plans") {
        await handleSP.handleActionPlansAnalysis_AP();
    } else if (appState.currentTemplateId === "factor-analysis") {
        await handleSP.handleFactorAnalysis();
    } else if (appState.currentTemplateId === "system-goals-initiatives") {
        await handleST.handleSystemGoalsAnalysis();
    } else if (appState.currentTemplateId === "process-mapping") {
        await handleST.handleProcessMappingAnalysis();
    } else if (appState.currentTemplateId === "system-thinking-analysis") {
        await handleST.handleSystemThinkingAnalysis();
    } else {
        // --- Generic n8n workflow for all other tools ---
        analysisResultContainer.innerHTML = `
                    <div class="text-center text-white/70 p-8">
                        <div class="typing-indicator mb-6">
                            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                        </div>
                        <h3 class="text-xl font-semibold text-white mb-4">Generating Your Strategic Analysis</h3>
                        <p class="text-white/80 mb-2">This comprehensive analysis may take 2-5 minutes to complete.</p>
                        <p class="text-white/60 text-sm">Please keep this page open while we process your request.</p>
                    </div>`;

        let fullPrompt = "";
        const formData = new FormData();
        const companyName = dom.$("companyName").value.trim();
        const companyDocumentsFile = dom.$("companyDocumentsFile").files[0];
        const location = dom.$("location").value.trim();
        const framework = getFrameworkForTemplate(appState.currentTemplateId);
        const sections = getSelectedSections();

        if (!companyName || !companyDocumentsFile || !location) {
            analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">Please fill out all fields and upload a file.</div>`;
            setLoading("generate", false);
            return;
        }
        fullPrompt = `User Information: - Company Name: ${companyName} - Location: ${location}`;

        // Add context if the field exists
        const contextEl = dom.$("useCaseContext");
        if (contextEl && contextEl.value.trim()) {
            const context = contextEl.value.trim();
            fullPrompt += ` - Context: ${context}`;
            formData.append("context", context);
        }

        formData.append("customerName", companyName);
        formData.append("location", location);
        formData.append("company_documents", companyDocumentsFile.name);
        formData.append("file", companyDocumentsFile);
        formData.append("framework", framework);
        formData.append("sections", sections);
        formData.append("prompt", fullPrompt);
        formData.append("templateId", appState.currentTemplateId);

        try {
            const {
                data: { session }
            } = await appConfig.supabase.auth.getSession();
            if (!session) throw new Error("Please log in to generate analysis.");

            const messageId = Date.now();
            appState.pendingAnalysisRequests.set(messageId, analysisResultContainer);
            formData.append("messageId", messageId);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch("https://n8n.data2int.com/webhook/analysis-ev2", {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            console.log("Analysis request submitted successfully.");
        } catch (error) {
            if (error.name === "AbortError") {
                console.log("Fetch request timed out as expected. Waiting for WebSocket response.");
                return;
            }
            console.error("Error submitting analysis request:", error);
            analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}</div>`;
            setLoading("generate", false);
        }
    }
}

const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
const OLLAMA_MODEL = "llama3.1:latest";
const GROQ_URL = "https://matt-groq.data2int.com/api/groq/chat";
const GROQ_MODEL = "llama-3.1-8b-instant";
const MAX_CONTEXT_LENGTH = 15000;

async function fetchOllama(systemPrompt, userContext, analysisType) {
    let userPrompt = userContext;
    let truncatedNote = "";

    if (userPrompt.length > MAX_CONTEXT_LENGTH) {
        userPrompt = userPrompt.substring(0, MAX_CONTEXT_LENGTH);
        truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\n${truncatedNote}`;
    const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            options: { num_ctx: 32768 }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Raw AI Response ${analysisType}:`, data.response); // Log raw response
    return JSON.parse(data.response);
}


async function fetchGroq(systemPrompt, userContext, analysisType) {
    const messages = [
            {"role": "system", "content": `${systemPrompt}`},
            {"role": "user", "content": `${userContext}`}
        ]

        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                model: GROQ_MODEL, 
                messages: messages, 
                stream: false, 
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }
        
        const data = await response.json();
        console.log(`Raw AI Response ${analysisType}:`, data.response); // Log raw response
        return JSON.parse(data.choices[0].message.content);
}


async function fetchLLM(provider, systemPrompt, userContext, analysisType) {
    try {
        if (provider === "ollama") {
            return await fetchOllama(systemPrompt, userContext, analysisType);
        } else if (provider === "groq") {
            return await fetchGroq(systemPrompt, userContext, analysisType);
        }
    } catch (error) {
        console.error(`Error calling ${provider}:`, error);
        throw error;
    }
}


/**
 * NEW HELPER FUNCTION (v7)
 * Takes a simple goal string (from n8n) and the full context,
 * and calls Ollama to generate the missing details.
 */
async function enrichN8nGoal(goalString, fullContext) {
    console.log(`Enriching n8n goal: "${goalString.substring(0, 30)}..."`);
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    const prompt = `
        You are a strategic analyst. You are given a main company context and one specific goal. 
        Your task is to generate the supporting details for *only* that single goal, based *only* on the full context.

        **Full Company Context:**
        \`\`\`
        ${fullContext}
        \`\`\`

        **Specific Goal to Analyze:**
        "${goalString}"

        **DETAILED TASKS (Ground all answers *strictly* in the Full Company Context):**
        1.  **Goal Name (\`goal_name\`):** Return the exact goal string provided: "${goalString}".
        2.  **Description (\`description\`):** Write a 1-2 sentence explanation of *why* this specific goal is critical for the company, based on the context.
        3.  **Key Initiatives (\`key_initiatives\`):** List 2-3 specific initiatives **from the context** that would help achieve this goal. If none are mentioned, generate logical initiatives based on the context.
        4.  **KPIs to Track (\`kpis_to_track\`):** List 2-3 specific KPIs **from the context** to measure this goal. If none are mentioned, generate logical KPIs based on the context.

        **ABSOLUTE CONSTRAINTS:**
        - Base **ALL** output **EXCLUSIVELY** on the "Full Company Context".
        - The \`goal_name\` in the JSON output *must* be the exact string: "${goalString}".
        - Return ONLY the JSON object.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {
            "goal_name": "${goalString}",
            "description": "[1-2 sentence rationale based on context...]",
            "key_initiatives": [
            "[Initiative 1 derived from context...]",
            "[Initiative 2 derived from context...]"
            ],
            "kpis_to_track": [
            "[KPI 1 derived from context...]",
            "[KPI 2 derived from context...]"
            ]
        }
    `;

    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
        });
        if (!response.ok) throw new Error("Ollama enrichment call failed");
        const data = await response.json();
        const ollamaJson = JSON.parse(data.response);
        
        // Final validation of the enriched object
        if (!ollamaJson.goal_name || !ollamaJson.description || !Array.isArray(ollamaJson.key_initiatives)) {
                throw new Error("Ollama enrichment returned malformed JSON.");
        }
        return ollamaJson; // Return the full, detailed object
    } catch (err) {
        console.error(`Failed to enrich goal "${goalString}":`, err);
        // Return a fallback object with the user-requested text
        return {
            goal_name: goalString,
            description: "Rationale: Extracted from base n8n analysis.",
            key_initiatives: ["No specific initiatives identified from text."],
            kpis_to_track: ["No specific KPIs identified from text."]
        };
    }
}



// Keep applyParetoAnalysisJS as it's used to process AI output
function applyParetoAnalysisJS(factors) {
    if (!factors || factors.length === 0) return [];

    // Ensure impact_score is numeric before sorting
    const validFactors = factors.filter(f => typeof f.impact_score === 'number' && !isNaN(f.impact_score));
    if (validFactors.length === 0) {
        console.warn("No factors with valid numeric impact scores found for Pareto analysis.");
        // Return original factors with default priority/rank if scores were bad
        return factors.map((f, i) => ({ ...f, cumulative_percentage: 0, priority: "Low", rank: i + 1 }));
    }


    const sorted_factors = [...validFactors].sort((a, b) => b.impact_score - a.impact_score);
    const total_impact = sorted_factors.reduce((sum, f) => sum + f.impact_score, 0);

    if (total_impact === 0) {
        // Handle case where all scores are 0
        return sorted_factors.map((f, i) => ({ ...f, cumulative_percentage: 0, priority: "Low", rank: i + 1 }));
    }

    let cumulative_impact = 0;
    return sorted_factors.map((factor, i) => {
        cumulative_impact += factor.impact_score;
        const cumulative_percentage = (cumulative_impact / total_impact) * 100;
        return {
            ...factor,
            cumulative_percentage: parseFloat(cumulative_percentage.toFixed(1)),
            priority: cumulative_percentage <= 80 ? "High" : "Low",
            rank: i + 1
        };
    });
}



/**
 * HANDLES ALL WEBSOCKET MESSAGES (v7.5 - JS PARSER)
 * - Uses the new `parseMarkdownTable` function for 'objectives'.
 */
async function handleWebSocketMessage(data) { // Still async for mission-vision
    console.log("Received WebSocket message:", data);

    // --- Logic for 'mission-vision' ---
    if (appState.currentTemplateId === "mission-vision" && data.result && typeof data.result === 'string') {
        
        if (!appState.currentAnalysisMessageId) {
            console.warn("WebSocket: Received mission-vision data, but no analysis is currently pending. Ignoring.");
            return;
        }

        console.log("WebSocket: Received n8n data for current mission-vision analysis. Parsing and Enriching...");
        
        try {
            const resultText = data.result;
            
            // 1. Extract Vision (Using "Our vision is" or "Vision:" as anchor)
            let vision = "";
            const visionMatch = resultText.match(/(?:Our vision is|Vision:)([\s\S]*?)(?:\n\n|\n(?=[A-Z])|$)/i);
            if (visionMatch) {
                // Re-add the prefix if it was part of the sentence structure
                const prefix = resultText.match(/Our vision is/i) ? "Our vision is " : "";
                vision = prefix + visionMatch[1].trim().replace(/^:\s*/, '');
            }

            // 2. Extract Mission (Context before Vision)
            let mission = vision;
            if (visionMatch && visionMatch.index > 0) {
                // Take everything before the vision as the mission/context
                mission = resultText.substring(0, visionMatch.index).trim();
            } else {
                // Fallback: Check for explicit "Mission:" or take first paragraph
                const missionExplicit = resultText.match(/Mission:\s*([\s\S]*?)(?:\n\n|Vision:|$)/i);
                mission = missionExplicit ? missionExplicit[1].trim() : resultText.split('\n\n')[0].trim();
            }

            // 3. Extract Goals (Prioritize bullet points)
            let goalStrings = [];
            // Look for lines starting with bullet points (•, -, *)
            const bulletMatches = resultText.match(/(?:^|\n)\s*[•\-*]\s*(.+)/g);
            
            if (bulletMatches && bulletMatches.length > 0) {
                goalStrings = bulletMatches.map(g => g.replace(/(?:^|\n)\s*[•\-*]\s*/, '').trim());
            } else {
                // --- NEW: Animate the new content ---
                const newElementsToAnimate = container.querySelectorAll(
                    '.glass-container, .feature-card, .project-card, .kpi-card, .summary-stat-card, .prescription-card, .insight-card, .action-card, .ladder-rung, .dissonance-pole, .cascade-objective, .cascade-goal-card, .st-objective-card, .st-goal-card, .feedback-card, .plotly-chart, .styled-table'
                );
                animateElements(newElementsToAnimate);
                // Fallback: If no bullets, try to find a "Goals" section or parse lines after Vision
                const goalsExplicit = resultText.match(/Goals:\s*([\s\S]*)/i);
                const textToSearch = goalsExplicit ? goalsExplicit[1] : (visionMatch ? resultText.substring(visionMatch.index + visionMatch[0].length) : "");
                
                goalStrings = textToSearch.split('\n')
                    .map(l => l.trim())
                    // Filter out metadata lines, URLs, and short/empty lines
                    .filter(l => l.length > 15 
                        && !l.startsWith("Reference Links") 
                        && !l.startsWith("Processing Time") 
                        && !l.startsWith("Final Recommendation")
                        && !l.startsWith("[")
                        && !l.includes("http"));
            }

            if (!appState.currentAnalysisContext) {
                throw new Error("Cannot enrich goals, analysis context is missing.");
            }
            
            const enrichmentPromises = goalStrings.map(g_str => enrichN8nGoal(g_str, appState.currentAnalysisContext));
            const enrichedGoals = await Promise.all(enrichmentPromises);
            console.log(`Successfully enriched ${enrichedGoals.length} goals from n8n.`);

            appState.pendingN8nResult = {
                mission: mission,
                vision: "", 
                values: [], 
                goals: enrichedGoals
            };

            console.log("WebSocket: n8n data parsed and enriched. Stored in pendingN8nResult.");
            attemptMergeAndRender();

        } catch (parseError) {
            console.error("WebSocket: Failed to parse or enrich n8n result string:", parseError);
            appState.pendingN8nResult = { mission: "", vision: "", values: [], goals: [] };
            attemptMergeAndRender();
        }
        return; 
    
    // --- START OF FIX (v7.5) ---
    // Logic for 'objectives'
    } else if (appState.currentTemplateId === "objectives" && data.result && typeof data.result === 'string') {
        
            if (!appState.currentAnalysisMessageId) {
            console.warn("WebSocket: Received objectives data, but no analysis is currently pending. Ignoring.");
            return;
        }

        console.log("WebSocket: Received n8n data for current objectives analysis. Parsing table with JS...");

        try {
            const markdownTable = data.result;
            
            // Call the new, reliable JS parser
            const tableJson = parseMarkdownTable(markdownTable);
            
            appState.pendingN8nResult = tableJson; // This is the array of table rows
            
            console.log("WebSocket: n8n table data parsed. Stored in pendingN8nResult.");
            attemptMergeAndRender();

        } catch (parseError) {
                console.error("WebSocket: Failed to parse n8n table:", parseError);
                appState.pendingN8nResult = []; // Fulfill with empty array
                attemptMergeAndRender();
        }
        return;
    }
    // --- END OF FIX (v7.5) ---

    // This is your OLD logic for all *other* WebSocket messages
    const container = appState.pendingAnalysisRequests.get(parseInt(data.messageId));
    if (!container) {
        console.warn("WebSocket: Received message with no matching container in pendingAnalysisRequests. ID:", data.messageId);
        return;
    }

    if (data.error) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">Workflow error: ${data.error}</div>`;
        appState.pendingAnalysisRequests.delete(parseInt(data.messageId));
        setLoading("generate", false);
        return;
    }

    if (data.progress && !data.result && data.templateId !== "pareto-fishbone") {
        container.innerHTML = `
                <div class="text-center text-white/70 p-4">
                    <div class="typing-indicator mb-4">
                        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                    </div>
                    <p class="mb-2">🔄 ${data.progress}</p>
                    <p class="text-sm text-white/50">Analysis in progress...</p>
                </div>`;
        return;
    }

    if (data.templateId === "pareto-fishbone" && data.fishbone && data.pareto) {
        renderST.renderParetoFishbonePage(container, data);
    } 
    else if (data.result) {
        container.innerHTML = `<div id="analysisContent" class="whitespace-pre-wrap">${data.result}</div>`;
        appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
    }

    const analysisActionsEl = dom.$("analysisActions");
    if (analysisActionsEl) analysisActionsEl.classList.remove("hidden");

    appState.pendingAnalysisRequests.delete(parseInt(data.messageId));
    setLoading("generate", false);
}



// --- NEW MASTER HANDLER: For all "Use Sample" buttons (v5 - Preload Only) ---
async function handleUseSampleClick(e) {
    const button = e.currentTarget;
    const templateId = button.dataset.templateId;
    if (!templateId) return;

    // Set loading state
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="loading-spinner" style="width: 12px; height: 12px; margin-right: 5px;"></span> Loading...`;
    
    // --- THIS IS THE NEW FLAG ---
    window.isSampleModeActive = false; // Reset flag at start
    
    let dataFile, contextFile, dataText, contextText;

    // --- Helper logic to build preview (inline) ---
    const buildPreview = (csvText) => {
        if (!csvText) return '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">Sample file is empty.</td></tr></tbody>';
        const lines = csvText.split(/[\r\n]+/).filter(Boolean);
        if (lines.length < 1) return '<tbody><tr><td class="p-4 text-center text-white/60" colspan="100%">No data in sample file.</td></tr></tbody>';
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (headers.length === 0) return '<tbody><tr><td class="p-4 text-center text-red-400" colspan="100%">Could not parse headers from sample file.</td></tr></tbody>';

        let tableHtml = '<thead class="bg-white/10 text-xs uppercase"><tr>';
        headers.forEach(h => { tableHtml += `<th class="px-4 py-2">${h}</th>`; });
        tableHtml += '</tr></thead><tbody>';

        const rows = lines.slice(1, 6); // Get up to 5 data rows
        if (rows.length === 0) {
                tableHtml += `<tr><td class="p-4 text-center text-white/60" colspan="${headers.length}">No data rows found in sample.</td></tr>`;
        } else {
            rows.forEach((line, rowIndex) => {
                const values = line.split(',');
                tableHtml += `<tr class="border-t border-white/10 ${rowIndex % 2 === 0 ? 'bg-white/5' : ''}">`;
                headers.forEach((_, cellIndex) => {
                    const val = values[cellIndex] ? values[cellIndex].trim().replace(/^"|"$/g, '') : '';
                    tableHtml += `<td class="px-4 py-2 whitespace-nowrap">${val}</td>`;
                });
                tableHtml += '</tr>';
            });
        }
        tableHtml += '</tbody>';
        return tableHtml;
    };

    try {
        switch (templateId) {
            
            case "descriptive-analysis":
                // 1. Fetch files
                dataFile = await fetchFileAsObject('data-files/descriptive/descriptive-sample-data.csv');
                contextFile = await fetchFileAsObject('data-files/descriptive/descriptive-sample-doc.txt');
                if (!dataFile || !contextFile) throw new Error("Sample file(s) failed to load.");
                                    
                // 2. Read text content
                dataText = await dataFile.text();
                contextText = await contextFile.text();

                // 3. Update UI
                dom.$("descriptiveFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("descriptiveFileLabel").classList.add("has-file");
                dom.$("descriptivePreviewTable").innerHTML = buildPreview(dataText); // Use real data
                dom.$("descriptiveDataPreview").classList.remove("hidden");
                dom.$("descriptiveContextText").value = contextText;
                dom.$("textInput").checked = true; // Select the text input radio
                dom.$("docUpload").checked = false;
                dom.$("descriptiveContextTextArea").classList.remove("hidden");
                dom.$("descriptiveContextFileArea").classList.add("hidden");
                break;
            
            case "predictive-analysis":
                dataFile = await fetchFileAsObject('data-files/predictive/predictive-sample-data.csv');
                if (!dataFile) throw new Error("Sample data file failed to load.");

                dataText = await dataFile.text();
                const predHeaders = dataText.split(/[\r\n]+/)[0].split(',').map(h => h.trim());

                // 1. Update file label
                dom.$("predictiveFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("predictiveFileLabel").classList.add("has-file");

                // 2. Update assumed date column
                dom.$("assumedDateColName").textContent = predHeaders[0] || "N/A";

                // 3. Manually populate dropdowns
                const targetSelect = dom.$("predictiveTargetColumn");
                if (targetSelect) {
                    targetSelect.innerHTML = ""; // Clear
                    predHeaders.slice(1).forEach(h => { // Add all headers except the first one
                        targetSelect.add(new Option(h, h));
                    });
                    targetSelect.value = "Revenue"; // Select sample default
                    targetSelect.disabled = false;
                }
                
                // 4. Show the preview table
                dom.$("predictivePreviewTable").innerHTML = buildPreview(dataText);
                dom.$("predictiveDataPreview").classList.remove("hidden");
                break;

            case "prescriptive-analysis":
                // 1. Fetch files
                dataFile = await fetchFileAsObject('data-files/prescriptive/prescriptive-sample-data.csv');
                contextFile = await fetchFileAsObject('data-files/prescriptive/prescriptive-sample-doc.txt');
                if (!dataFile || !contextFile) throw new Error("Sample file(s) failed to load.");
                
                // 2. Read text content
                dataText = await dataFile.text();
                contextText = await contextFile.text();

                // 3. Update UI
                dom.$("prescriptiveFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("prescriptiveFileLabel").classList.add("has-file");
                dom.$("prescriptivePreviewTable").innerHTML = buildPreview(dataText);
                dom.$("prescriptiveDataPreview").classList.remove("hidden");
                dom.$("prescriptiveGoalText").value = contextText;
                dom.$("prescriptiveInputTextToggle").checked = true; // Select text input
                dom.$("prescriptiveInputFileToggle").checked = false;
                dom.$("prescriptiveTextInputArea").classList.remove("hidden");
                dom.$("prescriptiveFileInputArea").classList.add("hidden");
                break;

            case "visualization":
                // 1. Fetch files
                dataFile = await fetchFileAsObject('data-files/visualization/visualization-sample.csv');
                contextFile = await fetchFileAsObject('data-files/visualization/visualization-sample-doc.txt');
                if (!dataFile || !contextFile) throw new Error("Sample file(s) failed to load.");
                
                // 2. Read text content
                dataText = await dataFile.text();
                contextText = await contextFile.text();

                // 3. Update UI
                dom.$("vizFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("vizFileLabel").classList.add("has-file");
                dom.$("vizPreviewTable").innerHTML = buildPreview(dataText);
                dom.$("vizDataPreview").classList.remove("hidden");
                dom.$("vizRequestText").value = contextText;
                dom.$("vizInputTextToggle").checked = true; // Select text input
                dom.$("vizInputFileToggle").checked = false;
                dom.$("vizTextInputArea").classList.remove("hidden");
                dom.$("vizFileInputArea").classList.add("hidden");
                break;

            case "regression-analysis":
                // 1. Fetch files
                dataFile = await fetchFileAsObject('data-files/regression/regression-sample.csv');
                contextFile = await fetchFileAsObject('data-files/regression/regression-sample-doc.txt');
                if (!dataFile || !contextFile) throw new Error("Sample file(s) failed to load.");

                // 2. Read text content
                dataText = await dataFile.text();
                contextText = await contextFile.text();

                // 3. Update UI (File Label, Preview, Context Text)
                dom.$("regressionFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("regressionFileLabel").classList.add("has-file");
                dom.$("regressionPreviewTable").innerHTML = buildPreview(dataText);
                dom.$("regressionDataPreview").classList.remove("hidden");
                dom.$("regressionContextText").value = contextText;
                dom.$("textInput").checked = true; // Select text input
                dom.$("docUpload").checked = false;
                dom.$("regressionContextTextArea").classList.remove("hidden");
                dom.$("regressionContextFileArea").classList.add("hidden");

                // 4. Update dropdowns - Use exact column names: marketing_spend,product_price,customer_rating,region,sales_revenue
                const regHeaders = ["marketing_spend", "product_price", "customer_rating", "region", "sales_revenue"];
                console.log("Using exact column names:", regHeaders); // Debug log

                const regDepSelect = dom.$("dependentVar");
                const regIndepContainer = dom.$("independentVarsContainer");

                regDepSelect.innerHTML = ""; // Clear
                regIndepContainer.innerHTML = ""; // Clear

                // Add all columns to both dependent and independent options
                regHeaders.forEach(h => {
                    regDepSelect.add(new Option(h, h));
                    regIndepContainer.innerHTML += `
                        <label class="flex items-center space-x-2"><input type="checkbox" class="method-checkbox independent-var-checkbox" value="${h}"><span>${h}</span></label>
                    `;
                });

                // Set defaults based on what's actually selected in your UI
                regDepSelect.value = "marketing_spend"; // Match the actual selection
                regDepSelect.disabled = false;

                // Check the correct boxes based on actual UI selections
                regIndepContainer.querySelectorAll('.independent-var-checkbox').forEach(cb => {
                    // Check these specific columns that are selected in your screenshot
                    if (cb.value === "product_price" || cb.value === "customer_rating" || 
                        cb.value === "region" || cb.value === "sales_revenue") {
                        cb.checked = true;
                    }
                    // Disable the dependent variable checkbox
                    if (cb.value === "marketing_spend") {
                        cb.disabled = true;
                    }
                });

                appState.currentRegressionRowCount = dataText.split(/[\r\n]+/).filter(Boolean).length - 1;
                break;
                
            case "pls-analysis":
                // 1. Fetch file
                dataFile = await fetchFileAsObject('data-files/pls/pls-sample-data.csv');
                if (!dataFile) throw new Error("Sample data file failed to load.");
                
                dataText = await dataFile.text();
                
                // 2. Update UI
                dom.$("plsFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("plsFileLabel").classList.add("has-file");
                dom.$("plsPreviewTable").innerHTML = buildPreview(dataText);
                dom.$("plsDataPreview").classList.remove("hidden");
                dom.$("plsInputFileToggle").checked = true; // Select file input
                dom.$("plsInputTextToggle").checked = false;
                dom.$("plsFileUploadArea").classList.remove("hidden");
                dom.$("plsTextInputArea").classList.add("hidden");

                // 3. Update syntax boxes
                dom.$("plsModelTemplate").disabled = true;
                dom.$("plsModelTemplate").innerHTML = `<option value="custom">Custom Syntax</option>`;
                dom.$("plsModelTemplate").value = "custom";
                dom.$("plsMeasurementSyntax").value = "Quality =~ qual1 + qual2 + qual3\nSatisfaction =~ sat1 + sat2 + sat3\nLoyalty =~ loy1 + loy2 + loy3";
                dom.$("plsStructuralSyntax").value = "Satisfaction ~ Quality\nLoyalty ~ Satisfaction + Quality";
                break;

            case "sem-analysis":
                // 1. Fetch file
                dataFile = await fetchFileAsObject('data-files/sem/sem-sample-data.csv');
                if (!dataFile) throw new Error("Sample data file failed to load.");

                dataText = await dataFile.text();

                // 2. Update UI
                dom.$("semFileLabel").querySelector(".file-name").textContent = dataFile.name;
                dom.$("semFileLabel").classList.add("has-file");
                dom.$("semPreviewTable").innerHTML = buildPreview(dataText);
                dom.$("semDataPreview").classList.remove("hidden");
                dom.$("semInputFileToggle").checked = true; // Select file input
                dom.$("semInputTextToggle").checked = false;
                dom.$("semFileUploadArea").classList.remove("hidden");
                dom.$("semTextInputArea").classList.add("hidden");

                // 3. Update syntax boxes with actual column names
                // Column names: Date,Year,Month,Quarter,Ad_Spend_USD,Ad_Spend_Level,Brand_Awareness_Pct,Brand_Awareness_Level,
                // Online_Sales_USD,Retail_Sales_USD,Total_Sales_USD,New_Customers_Count,Profit_USD,ROI_Pct,
                // Customer_Acquisition_Cost,Sales_Per_Customer,Online_Sales_Ratio

                dom.$("semModelTemplate").disabled = true;
                dom.$("semModelTemplate").innerHTML = `<option value="custom">Custom Syntax</option>`;
                dom.$("semModelTemplate").value = "custom";

                // Set measurement syntax using actual column names
                dom.$("semMeasurementSyntax").value = `Marketing_Performance =~ Ad_Spend_USD + Brand_Awareness_Pct
                Sales_Performance =~ Online_Sales_USD + Retail_Sales_USD + Total_Sales_USD
                Customer_Metrics =~ New_Customers_Count + Sales_Per_Customer`;

                // Set structural syntax using actual column names and latent variables
                dom.$("semStructuralSyntax").value = `Sales_Performance ~ Marketing_Performance
                Customer_Metrics ~ Marketing_Performance + Sales_Performance
                Profit_USD ~ Sales_Performance + Customer_Metrics`;
                break;

            case "dematel-analysis":
                // 1. Fetch file and text
                contextFile = await fetchFileAsObject('data-files/dematel/dematel-sample-doc.txt');
                if (!contextFile) throw new Error("Sample context file failed to load.");

                contextText = await contextFile.text();

                // 2. Update UI
                dom.$("dematelFileLabel").querySelector(".file-name").textContent = contextFile.name;
                dom.$("dematelFileLabel").classList.add("has-file");
                dom.$("dematelContent").value = contextText;
                dom.$("dematelFilePreview").textContent = contextText.split('\n').slice(0, 10).join('\n');
                dom.$("dematelFilePreviewContainer").classList.remove("hidden");
                dom.$("dematelInputTextToggle").checked = true; // Select text input
                dom.$("dematelInputFileToggle").checked = false;
                dom.$("dematelTextInputArea").classList.remove("hidden");
                dom.$("dematelFileUploadArea").classList.add("hidden");
                break;
        }

        // --- THIS IS THE KEY CHANGE ---
        // DO NOT call handleGenerate().
        // Instead, set the flag and update the button text.
        window.isSampleModeActive = true;
        button.innerHTML = `✓ Sample Loaded!`;
        // We leave it disabled so the user can't click it again.
        // The user will now click the main "Generate Analysis" button.

    } catch (error) {
        console.error("Error in handleUseSampleClick:", error);
        alert(`Failed to load sample data: ${error.message}`);
        window.isSampleModeActive = false; // Clear flag on error
        // Restore button on error
        button.disabled = false;
        button.innerHTML = originalText;
    } 
    // NO finally block. We want the button to *stay* in its new state.
}

export {
    handleGenerate,
    enrichN8nGoal,
    applyParetoAnalysisJS,
    handleWebSocketMessage,
    handleUseSampleClick,
    fetchOllama,
    fetchGroq,
    fetchLLM
}