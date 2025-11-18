import { appState } from "../state/app-state.mjs";
import { appConfig } from "../config.mjs";
import { dom } from "../utils/dom-utils.mjs";
import { setLoading } from "../utils/ui-utils.mjs";
import { getFrameworkForTemplate, getSelectedSections } from "../ui/template-creation/framework-selection.mjs";
import { attemptMergeAndRender } from "../ui/analysis-rendering/analysis-rendering.mjs";
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
 * - Uses the new `parseMarkdownTable` function for 'objectives'
 * - No longer needs to be `async` for the objectives path.
 * - All other logic remains the same.
 */
async function handleWebSocketMessage(data) { // Still async for mission-vision
    console.log("Received WebSocket message:", data);

    // --- Logic for 'mission-vision' (This is still correct) ---
    if (appState.currentTemplateId === "mission-vision" && data.result && typeof data.result === 'string') {
        
        if (!appState.currentAnalysisMessageId) {
            console.warn("WebSocket: Received mission-vision data, but no analysis is currently pending. Ignoring.");
            return;
        }

        console.log("WebSocket: Received n8n data for current mission-vision analysis. Parsing and Enriching...");
        
        try {
            const resultText = data.result;
            const missionMatch = resultText.match(/Mission:\n([\s\S]*?)\n\nGoals:/i);
            const mission = missionMatch && missionMatch[1] ? missionMatch[1].trim() : "";
            const goalsMatch = resultText.match(/Goals:\n([\s\S]*)/i);
            
            const goalStrings = goalsMatch && goalsMatch[1] ? 
                goalsMatch[1].trim().split('\n').filter(g => g.trim() !== '' && !g.trim().toLowerCase().startsWith("processing time")) : 
                [];

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

            console.log("WebSocket: n8n data parsed and enriched. Stored in appState.pendingN8nResult.");
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
            
            console.log("WebSocket: n8n table data parsed. Stored in appState.pendingN8nResult.");
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
        console.warn("WebSocket: Received message with no matching container in appState.pendingAnalysisRequests. ID:", data.messageId);
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

export {
    handleGenerate,
    enrichN8nGoal,
    applyParetoAnalysisJS,
    handleWebSocketMessage,
    fetchOllama,
    fetchGroq,
    fetchLLM
}