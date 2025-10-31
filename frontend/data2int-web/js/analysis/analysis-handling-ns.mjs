// =====================================================================================================
// ===================         Novel Strategies Analysis Handling Functions         ====================
// =====================================================================================================

import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import * as renderNS from '../ui/analysis-rendering/analysis-rendering-ns.mjs';

async function handleNovelGoalsAnalysis_NS() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Mapping Horizons of Growth...</h3><p class="text-white/80 mb-2">Analyzing your ambition using a refined, context-aware prompt...</p></div>`;
    setLoading("generate", true);

    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Using Llama 3.1 as requested

    try {
        const useDoc = dom.$("docUpload").checked;
        let ambitionText = "";

        if (useDoc) {
            const file = dom.$("novelGoalsFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            ambitionText = await extractTextFromFile(file);
        } else {
            ambitionText = dom.$("novelGoalsContent").value.trim();
            if (!ambitionText) {
                throw new Error("Please describe your ambition or goal in the text area.");
            }
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        if (ambitionText.length > MAX_CONTEXT_LENGTH) {
            console.warn(`Ambition text truncated to ${MAX_CONTEXT_LENGTH} characters.`);
            ambitionText = ambitionText.substring(0, MAX_CONTEXT_LENGTH);
        }

        // --- Refined Prompt with Stricter Grounding ---
        const prompt = `
            You are an expert corporate strategist specializing in McKinsey's "Three Horizons of Growth" framework. Your task is to analyze the user's provided text and develop a structured strategic plan *strictly grounded* in that text.

            **USER'S PROVIDED CONTEXT:**
            """
            ${ambitionText}
            """

            **TASK:**
            Formulate a Three Horizons plan derived *exclusively* from the details within the USER'S PROVIDED CONTEXT.

            1.  **main_goal**: First, identify the primary goal explicitly stated or strongly implied in the context. Refine this into a single, clear, measurable goal statement (under 25 words) that accurately reflects the context's focus (e.g., if the context is about research, the goal should relate to using research findings).

            2.  **horizons**: Create an array containing exactly three objects, one for each horizon (H1, H2, H3). For each horizon, define initiatives *only if they directly address the main_goal and are supported by specific details in the USER'S PROVIDED CONTEXT*.

                * **Horizon 1 (Core - ~0-18 Months):** Focus on optimizing or improving the *current business* described in the context. Initiatives MUST relate to elements explicitly mentioned (e.g., improving listed service quality dimensions).
                * **Horizon 2 (Adjacent - ~12-36 Months):** Focus on leveraging insights or capabilities *mentioned in the context* to build logically adjacent growth related to the main_goal (e.g., using research findings on satisfaction drivers to propose a loyalty program *if loyalty programs are implied or discussed*).
                * **Horizon 3 (Transformational - ~3-7+ Years):** Focus on exploring future options *suggested by the context* (e.g., researching long-term implications mentioned in the text).

                For *each* horizon object, provide:
                * \`horizon_name\`: (e.g., "Horizon 1: Optimize Core CX Research").
                * \`timeframe\`: (e.g., "0-18 Months").
                * \`focus\`: A one-sentence description of this horizon's focus *directly tied to the main_goal and the context provided*.
                * \`initiatives\`: An array of 1-3 specific initiatives. **CRITICAL:** If no initiatives for a specific horizon can be reasonably derived *solely from the provided context* to support the main goal, return an empty array [] for that horizon's \`initiatives\`. For each valid initiative:
                    * \`initiative_name\`: Clear name (under 10 words).
                    * \`description\`: Brief explanation *linking it directly to specific details in the context* and explaining how it supports the horizon's focus.
                    * \`kpis\`: 2-3 specific, measurable KPIs relevant to the initiative and context.

            **ABSOLUTE CONSTRAINTS (VERY IMPORTANT):**
            - **NO FABRICATION:** Do NOT invent initiatives, goals, or focus areas that are not explicitly stated or logically derived from the USER'S PROVIDED CONTEXT.
            - **CONTEXT IS KING:** Your entire response must be based *only* on the text provided in the "USER'S PROVIDED CONTEXT" section.
            - **AVOID GENERIC STRATEGIES:** Do NOT suggest common business strategies (like 'omnichannel expansion', 'subscription models', 'AI implementation', 'sustainability drives', 'new market entry') UNLESS these concepts are *specifically mentioned* or *directly implied as goals* within the user's text. Focus only on what the text provides.
            - **RESEARCH CONTEXT AWARENESS:** If the context is about a research plan (like the example text), the goal and initiatives should relate to executing that research or acting on its *hypothesized* findings, not on unrelated business expansion.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields are filled according to the constraints above. Return empty arrays [] for initiatives if none are derivable from the context for a given horizon.
            {
                "main_goal": "Refined goal statement strictly derived from user context.",
                "horizons": [
                { // Horizon 1
                    "horizon_name": "Horizon 1: ...", "timeframe": "0-18 Months", "focus": "...",
                    "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
                },
                { // Horizon 2
                    "horizon_name": "Horizon 2: ...", "timeframe": "12-36 Months", "focus": "...",
                    "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
                },
                { // Horizon 3
                    "horizon_name": "Horizon 3: ...", "timeframe": "3-7+ Years", "focus": "...",
                    "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
                }
                ]
            }
        `;

        console.log("Sending STRICTLY GROUNDED Three Horizons prompt to Llama 3.1...");
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { num_ctx: 32768 }
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
        const data = await response.json();

        let parsedData;
        try {
                parsedData = JSON.parse(data.response);
                console.log("Successfully parsed STRICT Three Horizons JSON response from Llama 3.1.");
        } catch (e) {
            console.error("Failed to parse STRICT Three Horizons JSON response:", data.response, e);
            throw new Error("Invalid JSON received from AI. The AI may have failed to follow the strict formatting or grounding constraints. Please try again or refine the input text.");
        }

        // Validate structure minimally
        if (!parsedData.main_goal || !parsedData.horizons || !Array.isArray(parsedData.horizons) || parsedData.horizons.length !== 3) {
            console.error("Parsed JSON structure is invalid:", parsedData);
            throw new Error("AI response did not follow the required Three Horizons structure despite instructions.");
        }

        renderNS.renderNovelGoalsPage_NS(analysisResultContainer, parsedData); // Pass to the renderer

    } catch (error) {
        console.error("Error during Novel Goals analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    }
}



async function handleCreativeDissonanceAnalysis_NS() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Analyzing Creative Gap (Prioritizing Files)...</h3><p class="text-white/80 mb-2">Generating initiatives based primarily on document and data context...</p></div>`;
    setLoading("generate", true); // Set loading state

    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Using Llama 3.1 as requested

    try {
        // --- Gather Inputs ---
        const currentReality = dom.$("currentReality").value.trim();
        const futureVision = dom.$("futureVision").value.trim();
        const contextFile = dom.$("dissonanceContextFile").files[0];
        const dataFile = dom.$("dissonanceDataFile").files[0];

        if (!currentReality || !futureVision) {
            throw new Error("❌ Please describe both your Current Reality and Future Vision (even if brief summaries).");
        }
        // **Crucial Check:** Ensure at least one file is provided if we prioritize them.
        if (!contextFile && !dataFile) {
                throw new Error("❌ Please upload at least a Business Context (.txt/.docx) or Data Context (.csv) file for detailed analysis.");
        }


        // --- Process Optional Context Files ---
        let businessContext = "No business document provided."; // Default changed
        if (contextFile) {
            try {
                businessContext = await extractTextFromFile(contextFile);
                console.log("Extracted text from context file.");
            } catch (e) {
                console.warn("Could not read context file:", e.message);
                businessContext = `Error reading provided context file: ${e.message}`;
            }
        } else {
                console.log("No business context file uploaded.");
        }

        let dataContext = "No data file provided."; // Default changed
        if (dataFile) {
                try {
                dataContext = await extractTextFromFile(dataFile);
                console.log("Extracted text from data file.");
                } catch (e) {
                    console.warn("Could not read data file:", e.message);
                    dataContext = `Error reading provided data file: ${e.message}`;
                }
        } else {
                console.log("No data context file uploaded.");
        }

        // Truncate contexts if necessary
        const MAX_CONTEXT_LENGTH = 7000; // Keep reasonable for context focus
        if (businessContext.length > MAX_CONTEXT_LENGTH) {
            businessContext = businessContext.substring(0, MAX_CONTEXT_LENGTH) + "\n... (business context truncated)";
        }
        if (dataContext.length > MAX_CONTEXT_LENGTH) {
            dataContext = dataContext.substring(0, MAX_CONTEXT_LENGTH) + "\n... (data context truncated)";
        }

        // --- Enhanced Prompt Prioritizing Files ---
        const prompt = `
            You are a master strategist applying Robert Fritz's "Creative Dissonance" framework. Analyze the user's situation based *primarily* on the provided Business Context (.txt/.docx) and Data Context (.csv) files. Use the brief "Current Reality" and "Future Vision" inputs mainly for high-level framing and goal confirmation.

            **ANALYSIS INPUTS:**
            * **Business Context (Primary Source):** """${businessContext}"""
            * **Data Context (Primary Source):** """${dataContext}"""
            * **Current Reality (Framing):** ${currentReality}
            * **Future Vision (Framing):** ${futureVision}

            **TASK:**
            Perform a Creative Dissonance analysis based *strictly* on the detailed information within the **Business Context** and **Data Context** files.

            1.  **dissonance_points**: Identify 2-4 key thematic points of tension between the *detailed reality described in the files* and the *envisioned future described in the files (or framed by the Future Vision input)*. Phrase as "From '[Specific Reality from Files]' to '[Specific Vision from Files/Input]'".

            2.  **gap_analysis**: Create an array analyzing 2-4 major gaps *identified from the files*. For each gap:
                * \`theme\`: Overarching theme (e.g., "Operational Scalability," "Market Penetration," "Data Infrastructure").
                * \`reality_statement\`: A summary of the current state for this theme, citing specific details *from the files*.
                * \`vision_statement\`: A summary of the desired future state for this theme, citing specific details *from the files* or aligning with the Future Vision input.
                * \`gap\`: A clear description of the specific discrepancy *identified from the files*.

            3.  **strategic_initiatives**: Develop an array of 2-4 strategic initiatives designed *specifically* to close the gaps *identified from the files*. For each initiative:
                * \`initiative_name\`: Action-oriented name (under 10 words).
                * \`rationale\`: Explain *how* this initiative addresses a gap *identified from the files*, citing file context where possible.
                * \`impact\`: Potential impact ("High", "Medium", "Low").
                * \`effort\`: Likely effort ("High", "Medium", "Low").
                * \`action_items\`: 2-3 concrete first steps derived from the necessary actions suggested by the *file context*.
                * \`kpis_to_track\`: 2-3 specific KPIs relevant to the gap and measurable using data *suggested by the files* or standard business metrics.

            **ABSOLUTE CONSTRAINTS (CRITICAL):**
            - **FILE PRIORITY:** Base your ENTIRE analysis—gaps, initiatives, actions, KPIs—primarily on the **Business Context** and **Data Context** files. Use the text box inputs only for overall direction if the files lack a clear goal.
            - **EVIDENCE-BASED:** Every point, gap, and initiative detail MUST be directly traceable to, or a logical necessity based on, the information *within the uploaded files*.
            - **NO FABRICATION:** Do NOT invent details, challenges, solutions, or metrics not supported by the file content. If the files lack sufficient detail for a section (e.g., H3 initiatives), state that clearly or return an empty array.
            - **SPECIFICITY:** Extract and use concrete details, numbers, challenges, or opportunities mentioned in the files.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields reflect the file-first analysis.
            {
                "dissonance_points": [ /* Points based primarily on file details */ ],
                "gap_analysis": [ /* Gaps identified primarily from file details */ ],
                "strategic_initiatives": [ /* Initiatives addressing file-based gaps */ ]
            }
        `;

        console.log("Sending FILE-PRIORITIZED Creative Dissonance prompt to Llama 3.1...");
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { num_ctx: 32768 }
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
        const data = await response.json();

        let parsedData;
        try {
                parsedData = JSON.parse(data.response);
                console.log("Successfully parsed FILE-PRIORITIZED Creative Dissonance JSON response.");
        } catch (e) {
            console.error("Failed to parse FILE-PRIORITIZED Creative Dissonance JSON:", data.response, e);
            throw new Error("Invalid JSON received from AI (File-Priority). Check AI logs or input files.");
        }

        // Minimal validation
        if (!parsedData.dissonance_points || !parsedData.gap_analysis || !parsedData.strategic_initiatives) {
                console.error("Parsed JSON structure is invalid (File-Priority):", parsedData);
                throw new Error("AI response structure is incorrect (File-Priority).");
        }

        // Store original inputs for rendering comparison
        parsedData.original_inputs = {
                currentReality: currentReality,
                futureVision: futureVision
        };

        renderNS.renderCreativeDissonancePage_NS(analysisResultContainer, parsedData);

    } catch (error) {
        console.error("Error during Creative Dissonance Analysis (File-Priority):", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false); // Stop loading on error
    }
}

    

    

async function handleLivingSystemAnalysis_NS() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Diagnosing System Health...</h3><p class="text-white/80 mb-2">Analyzing metabolism, nervous system, and immune response using enhanced, context-aware prompting...</p></div>`;
    setLoading("generate", true); // Set loading state

    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Using Llama 3.1 as requested

    try {
        const useDoc = dom.$("docUpload").checked;
        let systemDescription = "";

        if (useDoc) {
            const file = dom.$("lsFile").files[0];
            if (!file) throw new Error("❌ Please select a document to upload.");
            systemDescription = await extractTextFromFile(file);
            console.log("Extracted text from Living System context file.");
        } else {
            // Combine text area inputs into a single description
            const coreIdentity = dom.$("lsCoreIdentity")?.value.trim() || "Not specified.";
            const environment = dom.$("lsEnvironment")?.value.trim() || "Not specified.";
            const metabolism = dom.$("lsMetabolism")?.value.trim() || "Not specified.";
            const nervousSystem = dom.$("lsNervousSystem")?.value.trim() || "Not specified.";

            if (!coreIdentity || !environment || !metabolism || !nervousSystem) {
                throw new Error("❌ Please fill out all four detailed input sections (Core Identity, Environment, Metabolism, Nervous System).");
            }
            systemDescription = `Core Identity (DNA): ${coreIdentity}\n\nEnvironment: ${environment}\n\nMetabolism: ${metabolism}\n\nNervous System: ${nervousSystem}`;
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000; // Adjust based on Llama 3.1 capabilities
        if (systemDescription.length > MAX_CONTEXT_LENGTH) {
            console.warn(`Living System description truncated to ${MAX_CONTEXT_LENGTH} characters.`);
            systemDescription = systemDescription.substring(0, MAX_CONTEXT_LENGTH);
        }

        // --- Enhanced Prompt ---
        const prompt = `
            You are an expert organizational strategist specializing in applying the "Living System" or "Viable System Model" principles to diagnose business health. Analyze the user's provided description *strictly* based on that context.

            **USER'S SYSTEM DESCRIPTION:**
            """
            ${systemDescription}
            """

            **TASK:**
            Perform a comprehensive Living System diagnosis. Identify the health status and provide analysis for each key system component *based solely on evidence within the user's description*. Formulate specific strategic interventions to address identified weaknesses, again, grounded *only* in the provided text.

            1.  **overall_diagnosis**: Provide a concise, 1-2 sentence overall assessment of the system's health and key challenges *as described by the user*.

            2.  **system_analysis**: Create an array analyzing the core system components. For each component (Metabolism, Nervous System, Immune System, Growth & Adaptation):
                * system_name: The name of the component.
                * health_status: Assess the health as "Robust," "Strained," or "Fragile" *based strictly on evidence (or lack thereof) in the user's text*. If the text provides no information to judge a component, default to "Strained" and state the lack of evidence in the analysis.
                * analysis: Explain *why* you assigned that health status, citing specific examples, phrases, or lack of information *from the user's description*.

            3.  **strategic_interventions**: Develop an array of 2-4 specific strategic initiatives designed *only* to address the weaknesses identified in the system_analysis section and supported by the user's context. For each initiative:
                * initiative_name: A clear, action-oriented name (under 10 words).
                * target_system: The primary system component(s) this initiative aims to improve (e.g., "Metabolism", "Nervous System").
                * rationale: Explain *how* this initiative directly addresses a weakness identified in the system_analysis, referencing the user's context.
                * action_items: List 2-3 concrete first steps to begin implementing this initiative, logically derived from the context.
                * kpis_to_track: List 2-3 specific, measurable KPIs relevant to the initiative's goal, based on the context.

            **ABSOLUTE CONSTRAINTS (CRITICAL):**
            - **GROUNDING:** Every diagnosis, analysis point, health status, and intervention MUST be directly traceable to specific statements or the lack of specific information within the "USER'S SYSTEM DESCRIPTION". Do NOT infer beyond the text.
            - **NO FABRICATION:** Do NOT invent organizational problems, strengths, strategies, or metrics not explicitly supported by the provided text.
            - **FRAMEWORK ADHERENCE:** Interpret the user's text through the lens of the Living System components (Metabolism, Nervous System, Immune System, Growth/Adaptation).
            - **HEALTH STATUS JUSTIFICATION:** Clearly justify each "Robust," "Strained," or "Fragile" assessment using evidence *from the text*. If evidence is missing, state that.
            - **INTERVENTION LINKAGE:** Interventions must *only* target weaknesses identified in *your* system_analysis section.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields adhere strictly to the grounding constraints.
            {
                "overall_diagnosis": "Concise overall assessment based ONLY on user text.",
                "system_analysis": [
                {
                    "system_name": "Metabolism",
                    "health_status": "Robust/Strained/Fragile (Justified by text)",
                    "analysis": "Explanation citing specific user text or lack thereof..."
                },
                {
                    "system_name": "Nervous System",
                    "health_status": "Robust/Strained/Fragile (Justified by text)",
                    "analysis": "Explanation citing specific user text or lack thereof..."
                },
                {
                    "system_name": "Immune System", // How it handles threats/change
                    "health_status": "Robust/Strained/Fragile (Justified by text)",
                    "analysis": "Explanation citing specific user text or lack thereof..."
                },
                {
                    "system_name": "Growth & Adaptation", // How it evolves/learns
                    "health_status": "Robust/Strained/Fragile (Justified by text)",
                    "analysis": "Explanation citing specific user text or lack thereof..."
                }
                ],
                "strategic_interventions": [ // Only if weaknesses identified
                {
                    "initiative_name": "Initiative Name 1",
                    "target_system": "System Name(s)",
                    "rationale": "How this addresses a specific weakness identified above, citing text...",
                    "action_items": ["Action 1.1 derived from context", "Action 1.2 derived from context"],
                    "kpis_to_track": ["KPI 1.1 from context", "KPI 1.2 from context"]
                },
                { /* ... 2-4 total, if applicable ... */ }
                ]
            }
        `;

        console.log("Sending STRICTLY GROUNDED Living System prompt to Llama 3.1...");
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { num_ctx: 32768 } // Adjust context window if needed
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
        const data = await response.json();

        let parsedData;
        try {
                parsedData = JSON.parse(data.response);
                console.log("Successfully parsed Living System JSON response from Llama 3.1.");
        } catch (e) {
            console.error("Failed to parse Living System JSON response:", data.response, e);
            throw new Error("Invalid JSON received from AI (Living System). Check AI logs or input text.");
        }

        // Minimal validation
        if (!parsedData.overall_diagnosis || !parsedData.system_analysis || !Array.isArray(parsedData.system_analysis) || parsedData.system_analysis.length < 4 || !parsedData.strategic_interventions) {
                console.error("Parsed JSON structure is invalid (Living System):", parsedData);
                throw new Error("AI response structure is incorrect (Living System).");
        }
            // Store original inputs if text areas were used, for potential display
            if (!dom.$("docUpload").checked) {
                parsedData.original_inputs = {
                    coreIdentity: dom.$("lsCoreIdentity")?.value.trim() || "",
                    environment: dom.$("lsEnvironment")?.value.trim() || "",
                    metabolism: dom.$("lsMetabolism")?.value.trim() || "",
                    nervousSystem: dom.$("lsNervousSystem")?.value.trim() || ""
                };
            }


        renderNS.renderLivingSystemPage_NS(analysisResultContainer, parsedData);

    } catch (error) {
        console.error("Error during Living System Analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false); // Stop loading on error
    }
}
    

    

async function handleThinkingSystemAnalysis_NS() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Deconstructing Mental Models...</h3><p class="text-white/80 mb-2">Analyzing your thought process with enhanced prompting to uncover new paths...</p></div>`;
    setLoading("generate", true); // Set loading state

    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Using Llama 3.1 as requested

    try {
        const useDoc = dom.$("docUpload").checked;
        let beliefOrProblemContext = "";

        if (useDoc) {
            const file = dom.$("tsFile").files[0];
            if (!file) throw new Error("❌ Please select a document to upload.");
            beliefOrProblemContext = await extractTextFromFile(file);
            console.log("Extracted text from Thinking System context file.");
        } else {
            beliefOrProblemContext = dom.$("tsContent").value.trim();
            if (!beliefOrProblemContext) {
                throw new Error("❌ Please describe a belief, conclusion, or problem context to analyze.");
            }
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000; // Adjust based on Llama 3.1
        if (beliefOrProblemContext.length > MAX_CONTEXT_LENGTH) {
            console.warn(`Thinking System context truncated to ${MAX_CONTEXT_LENGTH} characters.`);
            beliefOrProblemContext = beliefOrProblemContext.substring(0, MAX_CONTEXT_LENGTH);
        }

        // --- Enhanced Prompt ---
        const prompt = `
            You are an expert facilitator applying Chris Argyris' "Ladder of Inference" framework. Analyze the user's provided text, which describes a belief, conclusion, or a problematic situation resulting from a certain line of thinking. Your task is to deconstruct the likely thought process *down* the ladder and then guide a reframing *up* a potentially more constructive ladder, based *strictly* on the provided context.

            **USER'S CONTEXT (Belief/Problem Description):**
            """
            ${beliefOrProblemContext}
            """

            **TASK:**
            Perform a Ladder of Inference analysis grounded *exclusively* in the USER'S CONTEXT.

            1.  **Infer Top Rung:** First, infer the core problematic **Action** or **Belief** described or implied at the top of the ladder within the user's context.

            2.  **Deconstruction (Working DOWN the Ladder):** Based *only* on the user's context, reconstruct the likely steps leading to that top rung. For each rung below, explain *how it derives from the rung above it*, citing evidence or logical inference *from the user's text*:
                * action (The inferred problematic action/decision based on the text).
                * belief (The inferred underlying belief driving the action, derived from the text).
                * conclusion (The inferred conclusion drawn from assumptions/interpretations, based on the text).
                * assumption (Inferred assumptions made based on interpretations, drawn from the text).
                * interpretation (How selected data/observations were likely interpreted, based on the text).
                * selection (What specific data or observations from the available 'reality' were likely focused on, ignoring others, based on the text).
                * observation (The pool of observable data/reality described or implied in the user's text).

            3.  **Reframing (Identifying Leverage & Building UP a New Ladder):**
                * critical_question: Formulate a challenging question that probes the assumptions or interpretations identified in the deconstruction.
                * new_observation: Suggest broadening the pool of observable data – what else *could* be observed or considered from the context?
                * new_interpretation: Offer an alternative, potentially more constructive interpretation of the (potentially broadened) observations.
                * new_conclusion: State a different conclusion that could logically follow from the new interpretation.

            4.  **New Actions:** Propose 2-3 specific, actionable initiatives based on the new_conclusion. For each action:
                * action_name: Clear name (under 10 words).
                * rationale: Explain how this action stems from the reframed perspective and helps address the original problem described in the user's context.
                * steps: List 2-3 concrete first steps to implement this action.
                * kpis: List 2-3 measurable KPIs to track the effectiveness of this new action.


            **ABSOLUTE CONSTRAINTS (CRITICAL):**
            - **INPUT GROUNDING:** Every step of the deconstruction and reframing MUST be directly traceable to, or a logical inference *solely based upon*, the information presented in the "USER'S CONTEXT". Do NOT introduce external knowledge or assumptions.
            - **NO FABRICATION:** Do NOT invent observations, interpretations, beliefs, or actions not supported by the user's text.
            - **LADDER LOGIC:** Ensure a clear, step-by-step causal link when moving both down and up the ladder rungs. Explain the connection between rungs based on the context.
            - **FOCUS ON THINKING:** The analysis must focus on deconstructing and reframing the *thought process*, not just listing business problems.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object with the exact structure specified below. Fill all fields according to the constraints, using inferences grounded *only* in the user's context.
            {
                "deconstruction": {
                "action": "Inferred action from user text...",
                "belief": "Inferred belief from user text...",
                "conclusion": "Inferred conclusion from user text...",
                "assumption": "Inferred assumption(s) from user text...",
                "interpretation": "Inferred interpretation from user text...",
                "selection": "Inferred selected data/observations from user text...",
                "observation": "Observable reality described/implied in user text..."
                },
                "reframing": {
                "critical_question": "Challenging question based on deconstruction...",
                "new_observation": "Suggestion to broaden observation based on context...",
                "new_interpretation": "Alternative interpretation grounded in context...",
                "new_conclusion": "New conclusion based on alternative interpretation..."
                },
                "new_actions": [
                {
                    "action_name": "New Action Name 1",
                    "rationale": "How this follows from reframing & addresses original problem...",
                    "steps": ["Step 1.1 based on context", "Step 1.2 based on context"],
                    "kpis": ["KPI 1.1 relevant to context", "KPI 1.2 relevant to context"]
                },
                { /* ... 1-2 more actions ... */ }
                ]
            }
        `;

        console.log("Sending STRICTLY GROUNDED Ladder of Inference prompt to Llama 3.1...");
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { num_ctx: 32768 } // Adjust context window if needed
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
        const data = await response.json();

        let parsedData;
        try {
                parsedData = JSON.parse(data.response);
                console.log("Successfully parsed Ladder of Inference JSON response from Llama 3.1.");
        } catch (e) {
            console.error("Failed to parse Ladder of Inference JSON response:", data.response, e);
            throw new Error("Invalid JSON received from AI (Ladder of Inference). Check AI logs or input text.");
        }

        // Minimal validation
        if (!parsedData.deconstruction || !parsedData.reframing || !parsedData.new_actions || !parsedData.deconstruction.observation) {
                console.error("Parsed JSON structure is invalid (Ladder of Inference):", parsedData);
                throw new Error("AI response structure is incorrect (Ladder of Inference).");
        }

        renderNS.renderThinkingSystemPage_NS(analysisResultContainer, parsedData);

    } catch (error) {
        console.error("Error during Thinking System Analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false); // Stop loading on error
    }
}


export {
    handleNovelGoalsAnalysis_NS,
    handleCreativeDissonanceAnalysis_NS,
    handleLivingSystemAnalysis_NS,
    handleThinkingSystemAnalysis_NS
}