// =====================================================================================================
// ===================        Strategic Planning Analysis Handling Functions        ====================
// =====================================================================================================
import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { appConfig } from '../config.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import { attemptMergeAndRender } from '../ui/analysis-rendering/analysis-rendering.mjs';
import * as renderSP from '../ui/analysis-rendering/analysis-rendering-sp.mjs';
import * as renderFA from '../ui/analysis-rendering/analysis-rendering-factor.mjs';

/**
 * HANDLER: Mission Vision (DEEP ANALYSIS v4 - with Goal Enrichment)
 * - Calls n8n for a base result and Ollama for a deep, component-based analysis.
 * - **NEW**: Stores `fullContext` globally for the WebSocket handler.
 * - **NEW**: When merging, calls `enrichN8nGoal` for any unique n8n goal strings.
 */
async function handleMissionVisionAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8">
                                            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
                                            <h3 class="text-xl font-semibold text-white mb-4">Running Deep Dual-Analysis...</h3>
                                            <p id="analysisStatus" class="text-white/80 mb-2">Initializing n8n and Ollama requests...</p>
                                            </div>`;
    setLoading("generate", true);

    // --- 1. Reset state and create a unique ID for this analysis ---
    appState.pendingOllamaResult = null;
    appState.pendingN8nResult = null;
    appState.currentAnalysisMessageId = `analysis_${Date.now()}`;
    console.log(`Starting analysis with ID: ${appState.currentAnalysisMessageId}`);

    let text = ""; // Raw text for Ollama
    const n8nFormData = new FormData(); // FormData for n8n

    try {
        // 2. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        
        if (useDoc) {
            const file = dom.$("companyDocumentsFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file); 
            n8nFormData.append("file", file, file.name); 
        } else {
            text = dom.$("missionVisionContent").value.trim();
            if (!text.trim()) throw new Error("Please provide your company context.");
            n8nFormData.append("missionVisionContent", text); // n8n key
        }
        
        const companyName = dom.$("companyName").value.trim() || "The organization";
        const location = dom.$("location").value.trim() || "unspecified location";
        n8nFormData.append("customerName", companyName);
        n8nFormData.append("location", location);
        
        let fullContext = `Company Name: ${companyName}\nLocation: ${location}\n\nCompany Context/Document Content:\n${text}`;
        
        // --- NEW: Store context globally for WebSocket handler ---
        appState.currentAnalysisContext = fullContext; 

        const { data: { session } } = await appConfig.supabase.auth.getSession();
        if (!session) throw new Error("Please log in to generate analysis.");

        // 3. Define and *call* the two fetch functions
        
        // --- Fetch 1: n8n Workflow (Triggers async response) ---
        async function triggerN8N() {
            const N8N_MISSION_URL = "https://n8n.data2int.com/webhook/mission-vision-v1";
            console.log(`Sending data to n8n workflow at ${N8N_MISSION_URL}...`);
            
            const response = await fetch(N8N_MISSION_URL, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: n8nFormData
            });

            if (!response.ok) {
                throw new Error(`n8n Trigger Error: ${response.status} - ${await response.text()}`);
            }
            const n8nJson = await response.json();
            console.log("n8n workflow triggered, received response:", n8nJson);
            if (n8nJson.status !== "success") {
                    console.warn("n8n workflow did not return 'success'. Waiting for WebSocket anyway.");
            }
        }

        // --- Fetch 2: Direct Ollama Call (Gets deep data) ---
        async function fetchOllama() {
            const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
            const MODEL_NAME = "llama3.1:latest";
            
            let ollamaText = fullContext;
            const MAX_CONTEXT_LENGTH = 15000;
            let truncatedNote = "";
            if (ollamaText.length > MAX_CONTEXT_LENGTH) {
                ollamaText = ollamaText.substring(0, MAX_CONTEXT_LENGTH);
                truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            }

            const prompt = `
                You are a top-tier strategic consultant (e.g., McKinsey, BCG). Your task is to analyze the user's provided company context **based ONLY on the text itself** and generate a comprehensive strategic foundation. You must deconstruct the Mission, Vision, Values, and Goals into their core components and provide rich, actionable detail for each. ${truncatedNote}

                **USER'S COMPANY CONTEXT:**
                \`\`\`
                ${ollamaText}
                \`\`\`

                **DETAILED TASKS (Ground all answers *strictly* in the text):**

                1.  **Deconstruct Mission (\`mission\`):**
                    * \`statement\`: Synthesize a single, powerful mission statement.
                    * \`breakdown\`: An array of objects analyzing the mission's components:
                        * \`component\`: "Purpose" (What we do)
                        * \`analysis\`: "Analysis of what the company does, from the text..."
                        * \`component\`: "Target Audience" (For whom)
                        * \`analysis\`: "Analysis of the target customers, from the text..."
                        * \`component\`: "Value Proposition" (What value we provide)
                        * \`analysis\`: "Analysis of the core value delivered, from the text..."

                2.  **Deconstruct Vision (\`vision\`):**
                    * \`statement\`: Synthesize a single, inspirational vision statement.
                    * \`breakdown\`: An array of objects analyzing the vision's components:
                        * \`component\`: "Future State" (Where we are going)
                        * \`analysis\`: "Analysis of the company's aspirational future, from the text..."
                        * \`component\`: "Key Differentiator" (How we will win)
                        * \`analysis\`: "Analysis of the future competitive advantage, from the text..."
                        * \`component\`: "Impact" (The ultimate outcome)
                        * \`analysis\`: "Analysis of the long-term impact on the industry/world, from the text..."

                3.  **Analyze Core Values (\`values\`):**
                    * Extract an array of 3-5 core values **from the text** (e.g., "Innovation," "Integrity").
                    * For each, provide:
                        * \`value\`: The value itself (e.g., "Innovation").
                        * \`description\`: A 1-2 sentence explanation of *how* this value manifests **based on evidence in the text** (e.g., "This is shown by the company's heavy investment in R&D...").

                4.  **Analyze Strategic Goals (\`goals\`):**
                    * Extract an array of 3-5 high-level S.M.A.R.T. goals **from the text**.
                    * For each, provide:
                        * \`goal_name\`: The high-level goal (e.g., "Expand Market Share").
                        * \`description\`: A 1-2 sentence explanation of *why* this goal is critical for achieving the Vision, **based on the text**.
                        * \`key_initiatives\`: An array of 2-3 specific initiative strings **from the text** (e.g., "Launch product in European market", "Develop new pricing model").
                        * \`kpis_to_track\`: An array of 2-3 specific KPI strings **from the text** (e.g., "Increase market share from 15% to 25%", "Achieve 500K EU active users").

                **ABSOLUTE CONSTRAINTS:**
                - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S COMPANY CONTEXT".
                - **NO FABRICATION:** Do not invent values, goals, or aspirations not present or logically implied in the text.
                - **FULL DETAIL:** You *must* provide the full, deep analysis for all four components, including the arrays of objects.
                - **JSON FORMAT:** Adhere EXACTLY.

                **RETURN FORMAT:**
                Provide ONLY a valid JSON object.
                {
                    "mission": {
                    "statement": "[Synthesized 1-sentence mission]",
                    "breakdown": [
                        { "component": "Purpose", "analysis": "[Analysis from text...]" },
                        { "component": "Target Audience", "analysis": "[Analysis from text...]" },
                        { "component": "Value Proposition", "analysis": "[Analysis from text...]" }
                    ]
                    },
                    "vision": {
                    "statement": "[Synthesized 1-sentence vision]",
                    "breakdown": [
                        { "component": "Future State", "analysis": "[Analysis from text...]" },
                        { "component": "Key Differentiator", "analysis": "[Analysis from text...]" },
                        { "component": "Impact", "analysis": "[Analysis from text...]" }
                    ]
                    },
                    "values": [
                    { "value": "Value 1 from text", "description": "How this is shown in the text..." },
                    { "value": "Value 2 from text", "description": "How this is shown in the text..." }
                    ],
                    "goals": [
                    { "goal_name": "Goal 1 from text", "description": "Why this supports the vision, based on text...", "key_initiatives": ["Initiative 1.1 from text", "Initiative 1.2 from text"], "kpis_to_track": ["KPI 1 from text", "KPI 2 from text"] },
                    { "goal_name": "Goal 2 from text", "description": "Why this supports the vision, based on text...", "key_initiatives": ["Initiative 2.1 from text"], "kpis_to_track": ["KPI 3 from text"] }
                    ]
                }
            `;

            console.log(`Sending deep Mission/Vision prompt directly to ${MODEL_NAME}...`);
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
            });

            if (!response.ok) {
                let errorBody = `API error ${response.status}`;
                try { errorBody += `: ${await response.text()}`; } catch (e) {}
                throw new Error(errorBody);
            }
            
            const data = await response.json();
            const ollamaJson = JSON.parse(data.response);
            // Deep validation
            if (!ollamaJson.mission || !ollamaJson.mission.statement || !Array.isArray(ollamaJson.mission.breakdown) ||
                !ollamaJson.vision || !ollamaJson.vision.statement || !Array.isArray(ollamaJson.vision.breakdown) ||
                !Array.isArray(ollamaJson.values) || !Array.isArray(ollamaJson.goals)) {
                    throw new Error("Direct Ollama call returned an invalid or incomplete JSON structure.");
            }
            console.log("Received and validated deep data from direct Ollama.");
            
            appState.pendingOllamaResult = ollamaJson; // Store the result
            attemptMergeAndRender(); // Check if n8n is already done
        }
        
        // 4. Trigger both functions.
        triggerN8N().catch(async (err) => {
            console.error("n8n Trigger Failed:", err.message);
            // If n8n fails to even *trigger*, we can't wait for it.
            // Manually "fulfill" its part with empty data.
            appState.pendingN8nResult = { mission: "", vision: "", values: [], goals: [] };
            attemptMergeAndRender(); // Check if Ollama is done
        });
        
        fetchOllama().catch(async (err) => {
            console.error("Ollama Call Failed:", err.message);
            
            // --- MODIFIED FALLBACK ---
            // If Ollama fails, we MUST still wait for n8n
            console.log("Ollama failed. Waiting for n8n data as fallback...");
            // We'll set a "failed" placeholder for Ollama
            appState.pendingOllamaResult = {
                mission: { statement: "Deep analysis failed.", breakdown: [] },
                vision: { statement: "Deep analysis failed.", breakdown: [] },
                values: [],
                goals: []
            };
            
            // If n8n is already done, this will trigger the merge
            // If n8n is not done, the WebSocket handler will trigger it
            attemptMergeAndRender(); 
        });

    } catch (error) {
        console.error(`Error in handleMissionVisionAnalysis (Setup):`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
        appState.currentAnalysisContext = null; // Clean up context
    }
}



async function handleFactorAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white">Performing EXHAUSTIVE Factor Analysis...</h3>
            <p class="text-white/80 mb-2">Finding every factor and analyzing each one deeply. This may take a moment...</p>
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let documentText = "";

        if (useDoc) {
            const file = dom.$("factorFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            documentText = await extractTextFromFile(file);
        } else {
            documentText = dom.$("factorContent").value.trim();
            if (!documentText.trim()) throw new Error("Please enter business information in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (documentText.length > MAX_CONTEXT_LENGTH) {
            documentText = documentText.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters of the provided text.)`;
            console.warn(`Factor Analysis context truncated.`);
        }

        // 2. Construct NEW COMPREHENSIVE Prompt
        // This prompt now includes the "Facts, Deductions, Conclusions, Summary" structure
        const prompt = `
            You are a meticulous senior strategic analyst. Your task is to perform an exhaustive and deeply detailed factor analysis based **ONLY** on the provided business text. You must find **EVERY SINGLE** relevant factor. ${truncatedNote}

            **USER'S BUSINESS DESCRIPTION:**
            \`\`\`
            ${documentText}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Identify Internal Factors:** Exhaustively scan the text for **ALL** internal positive factors (Strengths) and internal negative factors (Weaknesses).
            2.  **Identify External Factors:** Exhaustively scan the text for **ALL** external positive factors (Opportunities) and external negative factors (Threats).
            3.  **Provide Deep Analysis for EACH Factor:** For **EVERY** factor identified, you MUST provide the following detailed structure:
                * \`factor\`: The concise name of the factor (e.g., "Strong Brand Reputation").
                * \`category\`: The business function it relates to (e.g., "Marketing", "Operations", "Financial", "PESTEL - Technology").
                * \`description\`: A 1-2 sentence description summarizing the factor **using wording found in or directly inferred from the text**.
                * \`impact_score\`: A plausible impact score (integer 1-10, where 10 is highest impact) based **only** on its significance as suggested **by the text**.
                * \`analysis\`: A nested object containing the deep analysis:
                    * \`facts\`: A list of 3-5 specific, relevant factual statements about this factor **based *only* on the text**.
                    * \`deductions\`: A list of 3-4 logical inferences drawn **from the facts above**.
                    * \`conclusions\`: A list of 2-3 strategic implications. Each **MUST** include: Impact (High/Medium/Low), Urgency (Critical/Important/Monitor), and Stance (Leverage/Improve/Mitigate/Monitor).
                    * \`summary\`: A concise 2-3 sentence summary of this factor's strategic significance.

            **ABSOLUTE CONSTRAINTS:**
            - **BE EXHAUSTIVE:** Do not stop at 4-6 factors. Find all of them.
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided text. **DO NOT** invent factors, analysis, or recommendations not supported by the text.
            - **DEEP ANALYSIS IS MANDATORY:** The \`analysis\` object with its 4 parts is the most critical part of this task for **EVERY** factor.
            - **JSON FORMAT:** Adhere EXACTLY to the nested structure.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object.
            {
                "internal_factors": {
                "strengths": [
                    {
                    "factor": "...", "category": "...", "description": "...", "impact_score": 9, 
                    "analysis": {
                        "facts": ["Fact 1...", "Fact 2..."],
                        "deductions": ["Deduction 1...", "Deduction 2..."],
                        "conclusions": ["- Impact: High...", "- Urgency: Critical...", "- Stance: Leverage..."],
                        "summary": "..."
                    }
                    }
                    // ... *all* other strengths ...
                ],
                "weaknesses": [
                    {
                    "factor": "...", "category": "...", "description": "...", "impact_score": 7, 
                    "analysis": {
                        "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                    }
                    }
                    // ... *all* other weaknesses ...
                ]
                },
                "external_factors": {
                "opportunities": [
                    {
                    "factor": "...", "category": "...", "description": "...", "impact_score": 8, 
                    "analysis": {
                        "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                    }
                    }
                    // ... *all* other opportunities ...
                ],
                "threats": [
                    {
                    "factor": "...", "category": "...", "description": "...", "impact_score": 6, 
                    "analysis": {
                        "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                    }
                    }
                    // ... *all* other threats ...
                ]
                }
            }
        `;

        // 3. Call Ollama API
        console.log(`Sending DEEP Factor Analysis prompt (v2) to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        console.log('Raw AI Response (Factor Analysis):', data.response);
        try {
            parsedData = JSON.parse(data.response);
            
            // *** Robust Validation for NEW structure ***
            if (!parsedData || typeof parsedData !== 'object' ||
                !parsedData.internal_factors || typeof parsedData.internal_factors !== 'object' ||
                !Array.isArray(parsedData.internal_factors.strengths) || !Array.isArray(parsedData.internal_factors.weaknesses) ||
                !parsedData.external_factors || typeof parsedData.external_factors !== 'object' ||
                !Array.isArray(parsedData.external_factors.opportunities) || !Array.isArray(parsedData.external_factors.threats) ||
                // Check for the NEW DEEP ANALYSIS object in the first factor (if it exists)
                (parsedData.internal_factors.strengths.length > 0 && (
                    typeof parsedData.internal_factors.strengths[0] !== 'object' || 
                    !parsedData.internal_factors.strengths[0].hasOwnProperty('analysis') ||
                    typeof parsedData.internal_factors.strengths[0].analysis !== 'object' ||
                    !parsedData.internal_factors.strengths[0].analysis.hasOwnProperty('facts')
                ))
                )
            {
                console.error("Validation Failed (DEEP Factor Analysis v2): Required fields or new 'analysis' object structure missing.", parsedData);
                throw new Error(`AI response structure is incorrect. Missing internal/external factors or the required 'analysis' object. See console logs.`);
            }
            console.log(`Successfully parsed DEEP Factor Analysis JSON (v2) using ${MODEL_NAME}.`);

        } catch (e) {
            console.error(`Failed to parse/validate DEEP Factor Analysis JSON (v2) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (DEEP Factor Analysis v2): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderFA.renderFactorAnalysisPage(analysisResultContainer, parsedData); // Pass the full, rich data

    } catch (error) {
        console.error(`Error in handleFactorAnalysis (DEEP v2) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleSwotTowsAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Performing Comprehensive SWOT/TOWS Analysis...</h3>
            <p class="text-white/80 mb-2">Analyzing factors, generating strategies, and identifying priorities based *only* on your text...</p> <!-- Updated text -->
            <p id="analysisStatus" class="text-white/60 text-sm">Initializing...</p>
        </div>`;
    setLoading("generate", true); // Ensure loading state is set

    const statusEl = dom.$("analysisStatus");
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // --- Step 0: Gather Input ---
        statusEl.textContent = "Reading your business content...";
        const useDoc = dom.$("docUpload").checked;
        let businessContent = "";

        if (useDoc) {
            const file = dom.$("swotFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            businessContent = await extractTextFromFile(file);
        } else {
            businessContent = dom.$("businessContent").value.trim();
            if (!businessContent.trim()) throw new Error("Please enter business information in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (businessContent.length > MAX_CONTEXT_LENGTH) {
            businessContent = businessContent.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`SWOT/TOWS analysis context truncated.`);
        }

        // --- Helper: Call Ollama ---
        async function generateOllamaResponse(prompt) {
             console.log(`Sending prompt to ${MODEL_NAME}...`);
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    prompt: prompt,
                    stream: false,
                    format: "json", // Expect JSON format directly
                    options: { num_ctx: 32768 }
                })
            });
            if (!response.ok) {
                 let errorBody = `Ollama API error ${response.status}`;
                 try { errorBody += `: ${await response.text()}`; } catch(e){}
                 throw new Error(errorBody);
            }
            const data = await response.json();
            console.log('Raw AI Response:', data.response);
             try {
                 const parsed = JSON.parse(data.response);
                 console.log('Successfully parsed AI JSON response.');
                 return parsed;
             } catch (e) {
                 console.error("Failed to parse AI JSON response:", data.response, e);
                 throw new Error("Invalid JSON received from AI. Check AI logs or prompt structure.");
             }
        }

        // --- Step 1: Extract Internal Factors (S/W) with Descriptions ---
        statusEl.textContent = "Step 1/4: Analyzing internal factors (Strengths & Weaknesses)...";
        const internalPrompt = `
            Analyze the following business content based **ONLY** on the text provided. Identify 4-6 specific internal Strengths and 4-6 specific internal Weaknesses. ${truncatedNote}

            **USER'S BUSINESS CONTENT:**
            \`\`\`
            ${businessContent}
            \`\`\`

            **TASK:** For each Strength and Weakness identified **solely from the text**:
            1.  Provide a concise \`factor\` name (2-5 words).
            2.  Provide a brief \`description\` (1 sentence) summarizing the factor **using wording found in or directly inferred from the text**.

            **ABSOLUTE CONSTRAINTS:**
            - Base **ALL** output **EXCLUSIVELY** on the provided "USER'S BUSINESS CONTENT". **DO NOT** invent factors or descriptions.
            - Strengths = internal positive factors the company controls (mentioned in text).
            - Weaknesses = internal negative factors the company needs to address (mentioned in text).

            **RETURN FORMAT:** Provide ONLY a valid JSON object:
            {
              "strengths": [
                {"factor": "[Strength Name ONLY from text]", "description": "[Description ONLY from text wording]"},
                // ... 4-6 total ...
              ],
              "weaknesses": [
                 {"factor": "[Weakness Name ONLY from text]", "description": "[Description ONLY from text wording]"},
                 // ... 4-6 total ...
              ]
            }`;
        const internal_factors = await generateOllamaResponse(internalPrompt);
        // *** Validation ***
        if (!internal_factors || !Array.isArray(internal_factors.strengths) || !Array.isArray(internal_factors.weaknesses) || (internal_factors.strengths.length > 0 && typeof internal_factors.strengths[0] !== 'object') ) {
             console.error("Invalid internal factors structure:", internal_factors);
             throw new Error("AI failed to return valid internal factors. Check response structure.");
        }
        console.log(`Extracted ${internal_factors.strengths.length} Strengths, ${internal_factors.weaknesses.length} Weaknesses.`);


        // --- Step 2: Extract External Factors (O/T) with Descriptions ---
        statusEl.textContent = "Step 2/4: Analyzing external factors (Opportunities & Threats)...";
        const externalPrompt = `
            Analyze the following business content based **ONLY** on the text provided. Identify 4-6 specific external Opportunities and 4-6 specific external Threats. ${truncatedNote}

            **USER'S BUSINESS CONTENT:**
            \`\`\`
            ${businessContent}
            \`\`\`

            **TASK:** For each Opportunity and Threat identified **solely from the text**:
            1.  Provide a concise \`factor\` name (2-5 words).
            2.  Provide a brief \`description\` (1 sentence) summarizing the factor **using wording found in or directly inferred from the text**.

            **ABSOLUTE CONSTRAINTS:**
            - Base **ALL** output **EXCLUSIVELY** on the provided "USER'S BUSINESS CONTENT". **DO NOT** invent factors or descriptions.
            - Opportunities = external positive factors the company can leverage (mentioned in text).
            - Threats = external negative factors that pose risks (mentioned in text).

            **RETURN FORMAT:** Provide ONLY a valid JSON object:
            {
              "opportunities": [
                {"factor": "[Opportunity Name ONLY from text]", "description": "[Description ONLY from text wording]"},
                 // ... 4-6 total ...
              ],
              "threats": [
                 {"factor": "[Threat Name ONLY from text]", "description": "[Description ONLY from text wording]"},
                 // ... 4-6 total ...
              ]
            }`;
        const external_factors = await generateOllamaResponse(externalPrompt);
         // *** Validation ***
         if (!external_factors || !Array.isArray(external_factors.opportunities) || !Array.isArray(external_factors.threats) || (external_factors.opportunities.length > 0 && typeof external_factors.opportunities[0] !== 'object')) {
              console.error("Invalid external factors structure:", external_factors);
              throw new Error("AI failed to return valid external factors. Check response structure.");
         }
        console.log(`Extracted ${external_factors.opportunities.length} Opportunities, ${external_factors.threats.length} Threats.`);

        // Combine into swot_data
        const swot_data = {
            strengths: internal_factors.strengths || [],
            weaknesses: internal_factors.weaknesses || [],
            opportunities: external_factors.opportunities || [],
            threats: external_factors.threats || []
        };

        // --- Step 3: Generate TOWS Strategies with Rationale ---
        statusEl.textContent = "Step 3/4: Generating TOWS strategies...";
         // Attempt to infer primary goal from text (fallback if necessary)
         const goalInferencePrompt = `Based ONLY on the following text, what is the single primary strategic goal or objective? Respond with just the goal statement (max 25 words). TEXT: "${businessContent.substring(0, 1000)}..."`; // Limit context for goal inference
         let primaryGoal = "Achieve sustainable growth and enhance market position."; // Default fallback
         try {
             const goalResponse = await fetch(OLLAMA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL_NAME, prompt: goalInferencePrompt, stream: false }) });
             if (goalResponse.ok) {
                 const goalData = await goalResponse.json();
                 if (goalData.response) {
                      primaryGoal = goalData.response.trim().replace(/^Goal: /i, ''); // Clean up response
                      console.log("Inferred Primary Goal:", primaryGoal);
                 }
             }
         } catch (goalError) { console.warn("Could not infer primary goal, using default.", goalError); }


        const towsPrompt = `
            You are a strategic business consultant creating a TOWS matrix. Generate actionable strategies based **ONLY** on the provided SWOT factors and the inferred primary strategic goal.

            **Inferred Primary Strategic Goal:** ${primaryGoal}

            **SWOT ANALYSIS (Derived ONLY from User Text):**
            Strengths: ${swot_data.strengths.map(s => `- ${s.factor}: ${s.description}`).join("\n")}
            Weaknesses: ${swot_data.weaknesses.map(w => `- ${w.factor}: ${w.description}`).join("\n")}
            Opportunities: ${swot_data.opportunities.map(o => `- ${o.factor}: ${o.description}`).join("\n")}
            Threats: ${swot_data.threats.map(t => `- ${t.factor}: ${t.description}`).join("\n")}

            **TASK:** Generate 2-3 specific, actionable strategies for each TOWS quadrant (SO, WO, ST, WT). For each strategy:
            1.  Provide a concise \`strategy\` name (action-oriented, 5-10 words).
            2.  Provide a brief \`rationale\` (1-2 sentences) explaining *how* it uses the specific SWOT factors involved (e.g., "Leverages [Specific Strength] to capitalize on [Specific Opportunity]") and *how it supports the primary strategic goal*.

            **ABSOLUTE CONSTRAINTS:**
            - Base strategies **EXCLUSIVELY** on the provided SWOT factors. **DO NOT** introduce external ideas.
            - Ensure each strategy's rationale **explicitly mentions** the specific S/W/O/T factors it combines.
            - Ensure each strategy clearly supports the stated **Primary Strategic Goal**.
            - Ensure the JSON structure is exactly as specified.

            **RETURN FORMAT:** Provide ONLY a valid JSON object:
            {
              "SO_strategies": [
                {"strategy": "[Actionable SO Strategy Name]", "rationale": "Leverages [Strength X] to capitalize on [Opportunity Y] by... This supports the goal of [Primary Goal] by..."},
                // ... 1-2 more ...
              ],
              "WO_strategies": [
                 {"strategy": "[Actionable WO Strategy Name]", "rationale": "Overcomes [Weakness A] by leveraging [Opportunity B] through... This supports the goal of [Primary Goal] by..."},
                 // ... 1-2 more ...
              ],
              "ST_strategies": [
                  {"strategy": "[Actionable ST Strategy Name]", "rationale": "Uses [Strength C] to mitigate [Threat D] via... This supports the goal of [Primary Goal] by..."},
                  // ... 1-2 more ...
              ],
              "WT_strategies": [
                   {"strategy": "[Actionable WT Strategy Name]", "rationale": "Minimizes [Weakness E] and avoids [Threat F] by... This supports the goal of [Primary Goal] by..."},
                   // ... 1-2 more ...
              ]
            }`;
        const tows_strategies = await generateOllamaResponse(towsPrompt);
        // *** Validation ***
         if (!tows_strategies || typeof tows_strategies !== 'object' || !Array.isArray(tows_strategies.SO_strategies) /* Add checks for other quadrants too */ ) {
              console.error("Invalid TOWS strategies structure:", tows_strategies);
              throw new Error("AI failed to return valid TOWS strategies. Check response structure.");
         }
        console.log("Generated TOWS strategies.");


        // --- Step 4: Apply 80/20 rule for key insights ---
        statusEl.textContent = "Step 4/4: Applying 80/20 rule for key insights...";
        // Combine all generated strategies for the insights prompt
        const allStrategies = [].concat(...Object.values(tows_strategies || {}).map(arr => arr || []));

        const insightsPrompt = `
            You are a senior strategy consultant applying the Pareto Principle (80/20 rule) based **ONLY** on the provided SWOT/TOWS analysis derived from user text.

            **Primary Strategic Goal:** ${primaryGoal}

            **SWOT Factors (Derived ONLY from User Text):**
            Strengths: ${swot_data.strengths.map(s => s.factor).join(", ")}
            Weaknesses: ${swot_data.weaknesses.map(w => w.factor).join(", ")}
            Opportunities: ${swot_data.opportunities.map(o => o.factor).join(", ")}
            Threats: ${swot_data.threats.map(t => t.factor).join(", ")}

            **Generated TOWS Strategies (Derived ONLY from User Text & Factors):**
            ${allStrategies.map(s => `- ${s.strategy}: ${s.rationale}`).join("\n")}

            **TASK:** Apply the 80/20 rule to identify the critical few factors and strategies **from the lists above** that will likely drive ~80% of the impact towards achieving the **Primary Strategic Goal**.
            1.  \`strategic_focus\`: Define a single, overarching strategic direction (1 sentence) **based on the analysis** that best achieves the primary goal.
            2.  \`key_strategies\`: Select the 2-3 **most impactful strategies from the 'Generated TOWS Strategies' list** that most directly support the strategic_focus and primary goal. Provide the strategy name and a brief justification why it's key.
            3.  \`critical_factors\`: Identify the 2-3 **most critical SWOT factors from the 'SWOT Factors' list** that underpin the key_strategies or represent major hurdles/enablers for the primary goal. Provide factor name and brief justification.
            4.  \`priority_actions\`: List 2-3 immediate, concrete first steps **logically derived from the key_strategies** to begin execution.

            **ABSOLUTE CONSTRAINTS:**
            - Base **ALL** insights **EXCLUSIVELY** on the provided Goal, SWOT Factors, and TOWS Strategies. **DO NOT** introduce external ideas or factors.
            - Selections (strategies, factors, actions) MUST come directly from or be logically derived ONLY from the provided lists/context.

            **RETURN FORMAT:** Provide ONLY a valid JSON object:
            {
              "strategic_focus": "[Single sentence focus derived ONLY from analysis/goal]",
              "key_strategies": [ // 2-3 strategies PICKED ONLY FROM THE PROVIDED LIST
                {"strategy": "[Name of Strategy 1 from list]", "justification": "Why this specific strategy is key based on analysis..."},
                {"strategy": "[Name of Strategy 2 from list]", "justification": "Why this specific strategy is key based on analysis..."}
              ],
              "critical_factors": [ // 2-3 factors PICKED ONLY FROM THE PROVIDED LIST
                 {"factor": "[Name of Factor 1 from list]", "justification": "Why this specific factor is critical based on analysis..."},
                 {"factor": "[Name of Factor 2 from list]", "justification": "Why this specific factor is critical based on analysis..."}
              ],
              "priority_actions": [ // 2-3 actions DERIVED ONLY from key_strategies
                "[Immediate action derived ONLY from Key Strategy 1]",
                "[Immediate action derived ONLY from Key Strategy 2]"
              ]
            }`;
        const key_insights_80_20 = await generateOllamaResponse(insightsPrompt);
        // *** Validation ***
        if (!key_insights_80_20 || typeof key_insights_80_20 !== 'object' || !key_insights_80_20.strategic_focus || !Array.isArray(key_insights_80_20.key_strategies) || !Array.isArray(key_insights_80_20.critical_factors) || !Array.isArray(key_insights_80_20.priority_actions)) {
            console.error("Invalid 80/20 insights structure:", key_insights_80_20);
            throw new Error("AI failed to return valid 80/20 insights. Check response structure.");
        }
        console.log("Generated 80/20 insights.");

        // --- Final step: Render the full page ---
        statusEl.textContent = "Analysis complete! Rendering results...";
        const finalData = {
            swot_analysis: swot_data,
            tows_strategies: tows_strategies,
            key_insights_80_20: key_insights_80_20
        };
        renderSP.renderFullSwotTowsPage(analysisResultContainer, finalData); // Use the updated renderer

    } catch (error) {
        console.error("Error during SWOT/TOWS analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false); // Ensure loading stops on error
    } finally {
        // Ensure loading stops reliably if missed
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}


/**
 * HANDLER: Goals & Strategic Initiatives (Strategic Planning)
 * - NEW: Re-engineered to use a comprehensive OGSM prompt.
 * - Forces AI to deconstruct user text into Objective, Goals, Strategies, and Measures.
 * - Ensures high accuracy by grounding every component in the provided text.
 */
async function handleGoalsAndInitiativesAnalysis_SP() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Building OGSM Framework...</h3><p class="text-white/80 mb-2">Cascading your objective into actionable strategies based *only* on your provided text...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = dom.$("goalsFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("goalsContent").value.trim();
            if (!text.trim()) throw new Error("Please enter your high-level goal or business context in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Goals & Initiatives (SP) analysis context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are a strategic planning consultant specializing in the OGSM (Objective, Goals, Strategies, Measures) framework. Based **ONLY** on the user's provided context (which might describe a high-level goal or general business situation), create a complete OGSM plan derived strictly from that text. ${truncatedNote}

            **USER'S CONTEXT / HIGH-LEVEL GOAL:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Define Objective:** Refine the user's input or infer from the context a single, clear, overarching, and ideally measurable \`main_objective\` (SMART if possible).
            2.  **Define Goals (3-4 goals):** Identify specific, high-level \`goals\` that support the main_objective, derived **only from the text**.
            3.  **Develop Strategies & Measures:** For EACH goal, develop 1-2 supporting \`strategies\` **based only on actions or directions mentioned/implied in the text**. For EACH strategy:
                * Provide a concise \`strategy_name\` (action-oriented).
                * Provide a brief \`rationale\` (1-2 sentences) explaining *how* this strategy supports the parent goal and main objective, **using evidence ONLY from the text**.
                * List 1-2 specific, measurable \`measures\` (KPIs) **mentioned in, implied by, or logically derived ONLY from the text** to track the strategy's success.
            4.  **Self-Correction:** Rigorously check: Is the objective derived solely from input/context? Are goals/strategies/rationales/measures **strictly based ONLY on the user's text**? Is the structure logical and hierarchical? Is the JSON perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S CONTEXT / HIGH-LEVEL GOAL". **DO NOT** invent information, goals, strategies, or KPIs not present or logically implied in the text.
            - **NO GENERIC EXAMPLES:** Replace **ALL** placeholder text in the RETURN FORMAT structure below with content generated **strictly from the user's input text**.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text.
            {
              "main_objective": "[SMART Objective derived ONLY from user text/context]",
              "goals": [ // 3-4 goals derived ONLY from text
                {
                  "goal_name": "[Goal 1 Name derived ONLY from text]",
                  "strategies": [ // 1-2 strategies per goal derived ONLY from text
                    {
                      "strategy_name": "[Strategy 1.1 Name ONLY from text]",
                      "rationale": "[Rationale linking strategy to goal/objective using ONLY text evidence...]",
                      "measures": ["[Measure/KPI 1.1.1 derived ONLY from text]", "[Measure/KPI 1.1.2 derived ONLY from text]"]
                    },
                    {
                      "strategy_name": "[Strategy 1.2 Name ONLY from text]",
                      "rationale": "[Rationale linking strategy using ONLY text evidence...]",
                      "measures": ["[Measure/KPI 1.2.1 derived ONLY from text]"]
                    }
                  ]
                },
                {
                  "goal_name": "[Goal 2 Name derived ONLY from text]",
                  "strategies": [
                    {
                      "strategy_name": "[Strategy 2.1 Name ONLY from text]",
                      "rationale": "[Rationale linking strategy using ONLY text evidence...]",
                      "measures": ["[Measure/KPI 2.1.1 derived ONLY from text]"]
                    }
                  ]
                }
                // ... potentially 1-2 more goals derived ONLY from text ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED OGSM prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        console.log('Raw AI Response (OGSM - SP):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced OGSM SP) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.main_objective || typeof parsedData.main_objective !== 'string' || parsedData.main_objective.includes("[") ||
                 !Array.isArray(parsedData.goals) || parsedData.goals.length < 1 ||
                 // Check structure of first goal and its strategies/measures
                 (parsedData.goals.length > 0 && (
                     typeof parsedData.goals[0] !== 'object' ||
                     !parsedData.goals[0].hasOwnProperty('goal_name') || parsedData.goals[0].goal_name.includes("[") ||
                     !Array.isArray(parsedData.goals[0].strategies) || parsedData.goals[0].strategies.length < 1 ||
                     (parsedData.goals[0].strategies.length > 0 && (
                         typeof parsedData.goals[0].strategies[0] !== 'object' ||
                         !parsedData.goals[0].strategies[0].hasOwnProperty('strategy_name') || parsedData.goals[0].strategies[0].strategy_name.includes("[") ||
                         !parsedData.goals[0].strategies[0].hasOwnProperty('rationale') || parsedData.goals[0].strategies[0].rationale.includes("[") ||
                         !Array.isArray(parsedData.goals[0].strategies[0].measures) || parsedData.goals[0].strategies[0].measures.length < 1 ||
                         (parsedData.goals[0].strategies[0].measures.length > 0 && parsedData.goals[0].strategies[0].measures[0].includes("[")) // Check first measure for placeholder
                     ))
                 ))
                )
             {
                  console.error("Validation Failed (Enhanced OGSM SP): Required fields missing, invalid structure, or placeholders detected.", parsedData);
                  throw new Error(`AI response structure is incorrect, inconsistent, or contains placeholders (Enhanced OGSM SP). Check objective, goals, strategies, rationales, and measures. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED OGSM (SP) JSON using ${MODEL_NAME}. Found ${parsedData.goals.length} goals.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED OGSM (SP) JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced OGSM SP): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderGoalsAndInitiativesPage_SP(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleGoalsAndInitiativesAnalysis_SP (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



/**
 * HANDLER: Objectives (DEEP ANALYSIS v4 - True Async)
 * - Triggers both the deep Ollama call and the n8n workflow.
 * - Relies on `handleWebSocketMessage` to catch the n8n data.
 * - Relies on `attemptMergeAndRender` to combine the results.
 */
async function handleObjectivesAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8">
                                            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
                                            <h3 class="text-xl font-semibold text-white mb-4">Running Dual S.M.A.R.T. Analysis...</h3>
                                            <p id="analysisStatus" class="text-white/80 mb-2">Initializing n8n and Ollama requests...</p>
                                            </div>`;
    setLoading("generate", true);

    // --- 1. Reset state and create a unique ID for this analysis ---
    appState.pendingOllamaResult = null;
    appState.pendingN8nResult = null;
    appState.currentAnalysisMessageId = `analysis_${Date.now()}`;
    appState.currentAnalysisContext = null; // Clear context at the start
    console.log(`Starting analysis with ID: ${appState.currentAnalysisMessageId}`);

    let text = ""; // Raw text
    const n8nFormData = new FormData(); // FormData for n8n

    try {
        // 2. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        if (useDoc) {
            const file = dom.$("companyDocumentsFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
            n8nFormData.append("file", file, file.name); // For n8n
        } else {
            text = dom.$("objectivesContent").value.trim();
            if (!text.trim()) throw new Error("Please provide your high-level goal or context.");
            n8nFormData.append("objectivesContent", text); // For n8n
        }
        
        const companyName = dom.$("companyName").value.trim() || "The organization";
        const location = dom.$("location").value.trim() || "unspecified location";
        
        // Add other fields for n8n
        n8nFormData.append("customerName", companyName);
        n8nFormData.append("location", location);
        // We don't need to send messageId if n8n doesn't support it for this workflow

        // Create full context for Ollama
        let fullContext = `Company: ${companyName}\nLocation: ${location}\n\nContext:\n${text}`;
        
        // --- Store context globally for WebSocket handler ---
        appState.currentAnalysisContext = fullContext; 

        const { data: { session } } = await appConfig.supabase.auth.getSession();
        if (!session) throw new Error("Please log in to generate analysis.");

        // 3. Define and *call* the two fetch functions

        // --- Fetch 1: n8n Workflow (Triggers async response) ---
        async function triggerN8N_Objectives() {
            const N8N_OBJECTIVES_URL = "https://n8n.data2int.com/webhook/objectives-v1";
            console.log(`Sending data to n8n workflow at ${N8N_OBJECTIVES_URL}...`);
            
            const response = await fetch(N8N_OBJECTIVES_URL, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: n8nFormData
            });

            if (!response.ok) {
                throw new Error(`n8n Trigger Error: ${response.status} - ${await response.text()}`);
            }
            const n8nJson = await response.json();
            console.log("n8n workflow triggered, received response:", n8nJson);
            // We just trigger it, we don't store the result. We wait for the WebSocket.
        }

        // --- Fetch 2: Direct Ollama Call (Gets deep S.M.A.R.T. data) ---
        async function fetchOllama_Objectives() {
            const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
            const MODEL_NAME = "llama3.1:latest";
            
            let ollamaText = fullContext;
            const MAX_CONTEXT_LENGTH = 15000;
            if (ollamaText.length > MAX_CONTEXT_LENGTH) {
                console.warn(`Ollama text truncated to ${MAX_CONTEXT_LENGTH} chars.`);
                ollamaText = ollamaText.substring(0, MAX_CONTEXT_LENGTH);
            }

            const prompt = `
                You are an expert strategic planner. Analyze the user's provided goal/context **based ONLY on the text itself** and formulate a set of 3-5 detailed S.M.A.R.T. objectives.

                **USER'S GOAL / CONTEXT:**
                \`\`\`
                ${ollamaText}
                \`\`\`

                **DETAILED TASKS:**
                1.  **Refine Main Goal:** Provide a concise, 1-sentence summary of the user's primary goal (\`main_goal\`) **based ONLY on the text**.
                2.  **Formulate S.M.A.R.T. Objectives:** Create an array of 3-5 \`smart_objectives\`. For EACH objective, provide the following **strictly derived from the user's text**:
                    * \`objective_name\`: A clear, concise name for the objective.
                    * \`smart_breakdown\`: A nested object detailing each component:
                        * \`specific\`: What exactly will be achieved? (Be very specific, using details from the text).
                        * \`measurable\`: How will success be measured? (Identify the key metric mentioned or implied in the text).
                        * \`achievable\`: Why is this achievable? (Reference resources, strengths, or context from the text).
                        * \`relevant\`: Why is this relevant to the \`main_goal\`? (Link it directly to the user's context).
                        * \`time_bound\`: What is the timeframe? (Infer a realistic timeframe, e.g., "within 6 months", "by EOY", based on the text's scope).
                    * \`key_actions\`: A list of 2-3 high-level action items **from the text** needed to start this objective.
                    * \`potential_risks\`: A list of 1-2 potential risks **from the text** that could endanger this specific objective.
                3.  **Self-Correction:** Rigorously check: Is the main goal from text? Is EVERY detail of the SMART breakdown (S, M, A, R, T), key actions, and risks **strictly derived ONLY from the user's text**? Is the JSON perfect? Fix errors.

                **ABSOLUTE CONSTRAINTS:**
                - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S GOAL / CONTEXT". **DO NOT** invent information.
                - **JSON FORMAT:** Adhere EXACTLY.

                **RETURN FORMAT:**
                Provide ONLY a valid JSON object.
                {
                    "main_goal": "[Refined main goal summary ONLY from user text]",
                    "smart_objectives": [
                    {
                        "objective_name": "[Objective 1 Name ONLY from text]",
                        "smart_breakdown": {
                        "specific": "[Specific goal detail ONLY from text...]",
                        "measurable": "[Metric/KPI ONLY from text...]",
                        "achievable": "[Reason it's achievable ONLY from text...]",
                        "relevant": "[Relevance to main goal ONLY from text...]",
                        "time_bound": "[Timeframe inferred ONLY from text...]"
                        },
                        "key_actions": ["[Action 1 ONLY from text]", "[Action 2 ONLY from text]"],
                        "potential_risks": ["[Risk 1 ONLY from text]"]
                    }
                    ]
                }
            `;

            console.log(`Sending S.M.A.R.T. Objectives prompt directly to ${MODEL_NAME}...`);
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
            });

            if (!response.ok) {
                let errorBody = `API error ${response.status}`;
                try { errorBody += `: ${await response.text()}`; } catch (e) {}
                throw new Error(errorBody);
            }
            
            const data = await response.json();
            const ollamaJson = JSON.parse(data.response); // Ollama returns JSON *inside* a string
            if (!ollamaJson.main_goal || !ollamaJson.smart_objectives) {
                    throw new Error("Direct Ollama call returned an invalid JSON structure.");
            }
            console.log("Received data from direct Ollama.");
            
            appState.pendingOllamaResult = ollamaJson; // Store the result
            attemptMergeAndRender(); // Check if n8n is already done
        }
        
        // 4. Trigger both functions.
        triggerN8N_Objectives().catch(err => {
            console.error("n8n Trigger Failed:", err.message);
            appState.pendingN8nResult = []; // Fulfill n8n with an empty array on failure
            attemptMergeAndRender(); // Check if Ollama is done
        });
        
        fetchOllama_Objectives().catch(err => {
            console.error("Ollama Call Failed:", err.message);
            
            appState.pendingOllamaResult = {
                main_goal: "Deep analysis failed.",
                smart_objectives: []
            };
            
            attemptMergeAndRender(); 
        });

    } catch (error) {
        console.error(`Error in handleObjectivesAnalysis (Setup):`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
        appState.currentAnalysisContext = null; // Clean up context
    }
}



async function handleActionPlansAnalysis_AP() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Action Plan...</h3><p class="text-white/80 mb-2">Breaking down your context into actionable tasks...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = dom.$("actionPlanFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("actionPlanContent").value.trim();
            if (!text.trim()) throw new Error("Please describe the objective for your action plan.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Action Plan analysis context truncated.`);
        }

        // 2. --- NEW ENHANCED PROMPT (v3 with UNANALYZABLE path) ---
        const prompt = `
            You are an expert project manager. Your task is to analyze the provided text, determine its intent, and formulate a high-level project plan with 5-7 sequential action items. Base this *only* on the provided text. ${truncatedNote}

            **USER'S TEXT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS (Follow this order):**

            **Task 1: Determine Text Intent.**
            First, read the text to determine its intent.
            - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
            - OR is it a **Descriptive Company Profile / Strategic Plan** (listing services, differentiators, and goals, like "NexaFlow Capital" or "AquaGlow Skincare")?
            - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

            **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

            **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
            1.  **Project Name (\`project_name\`):** Define a name for the plan (e.g., "Resolving [The Problem]").
            2.  **Action Items (\`action_items\`):** Generate 5-7 sequential action items to *fix* the problem, based on the text. For each:
                * \`task_name\`: Actionable name (e.g., "Audit Control Loops").
                * \`description\`: What needs to be done, from text.
                * \`owner\`: Team/role from text.
                * \`timeline\`: Sequential timeline (e.g., "Week 1-2").
                * \`priority\`: "High", "Medium", "Low" based on text.
                * \`resources_needed\`: Resources mentioned in text.
                * \`key_dependency\`: Previous task name (or null).
                * \`kpis_to_track\`: 1-2 metrics for *this task*.

            **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow or AquaGlow):**
            1.  **Project Name (\`project_name\`):** Define a name for the plan (e.g., "Strategic Plan for [Company Name]").
            2.  **Action Items (\`action_items\`):** Generate 5-7 sequential action items based on the **"Core Services"**, **"Differentiators"**, or **"Proposed Solutions"** listed in the text.
                * \`task_name\`: The service or differentiator to be amplified (e.g., "Scale NexaScore AI Engine", "Launch Retail-Ready Packaging").
                * \`description\`: What this initiative involves, from text.
                * \`owner\`: Team/role from text (e.g., "Product Development Team").
                * \`timeline\`: Sequential timeline (e.g., "Phase 1").
                * \`priority\`: "High", "Medium", "Low" based on text.
                * \`resources_needed\`: Resources mentioned in text.
                * \`key_dependency\`: Previous task name (or null).
                * \`kpis_to_track\`: 1-2 metrics for *this task* (e.g., "NexaScore accuracy rate", "Retailer sell-through rate").

            **IF IT IS UNANALYZABLE:**
            1.  **Project Name (\`project_name\`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a poem...").
            2.  **Action Items (\`action_items\`):** This MUST be an empty array [].
            
            **ABSOLUTE CONSTRAINTS:**
            - STICK TO THE TEXT. Do NOT invent information.
            - JSON format must be perfect.

            **RETURN FORMAT (Example for a Descriptive Profile):**
            {
                "project_name": "Strategic Plan for NexaFlow Capital",
                "action_items": [
                {
                    "task_name": "Scale NexaScore™ AI Engine",
                    "description": "Expand the proprietary AI engine for real-time creditworthiness evaluation to new markets or data sources.",
                    "owner": "AI/Data Science Team",
                    "timeline": "Phase 1 (Months 1-6)",
                    "priority": "High",
                    "resources_needed": ["AI Talent", "Cloud Infrastructure", "New Data Partnerships"],
                    "key_dependency": null,
                    "kpis_to_track": ["NexaScore accuracy rate", "New client acquisition"]
                },
                {
                    "task_name": "Enhance DeFi Payments Platform",
                    "description": "Build on the existing cross-border DeFi payments service, focusing on stablecoin integrations and transparency.",
                    "owner": "Blockchain Team",
                    "timeline": "Phase 2 (Months 4-12)",
                    "priority": "Medium",
                    "resources_needed": ["Smart Contract Auditors", "Stablecoin Partnerships"],
                    "key_dependency": "Scale NexaScore™ AI Engine",
                    "kpis_to_track": ["Transaction Volume", "Settlement Time"]
                }
                ]
            }
        `;
        // --- END OF NEW PROMPT ---

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Action Plan prompt (v3) to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: "json",
                options: {
                    num_ctx: 32768
                }
            })
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try {
                errorBody += `: ${await response.text()}`;
            } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        console.log('Raw AI Response (Action Plan - SP):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
            // *** Refined Robust Validation ***
            console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Action Plan SP v3) ---');
            console.log(JSON.stringify(parsedData, null, 2));
            console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                !parsedData.project_name || typeof parsedData.project_name !== 'string' ||
                !Array.isArray(parsedData.action_items) || // Must be an array, even if empty

                // Check for invalid state: must have actions IF project_name is not an error message
                (!parsedData.project_name.toLowerCase().includes("analyz") && parsedData.action_items.length < 1) ||

                // Check for valid state: must have NO actions IF project_name IS an error message
                (parsedData.project_name.toLowerCase().includes("analyz") && parsedData.action_items.length > 0)
            ) {
                if (!parsedData.project_name.toLowerCase().includes("analyz") && parsedData.action_items.length < 1) {
                    console.error("Validation Failed (Enhanced Action Plan SP v3): AI found a valid project but no actions.", parsedData);
                    throw new Error(`AI response structure is inconsistent. Found a project but no action items.`);
                }
            }
            console.log(`Successfully parsed ENHANCED Action Plan (SP) JSON (v3) using ${MODEL_NAME}. Found ${parsedData.action_items.length} action items.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Action Plan (SP) JSON (v3) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Action Plan SP v3): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderActionPlansPage_AP(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleActionPlansAnalysis_AP (Enhanced v3) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



/**
 * HANDLER: KPI & Critical Events (Strategic Planning)
 * - NEW: Re-engineered to act as a "Research Plan Analyst".
 * - Prompt is now specifically trained to parse the user's research plan.
 * - It identifies constructs (e.g., "Service Quality")
 * and extracts their bulleted indicators (e.g., "Website responsiveness") as the KPIs,
 * and groups them under their parent construct.
 * - It finds the measurement scale (e.g., "7-point Likert scales").
 * - It extracts critical events from the research plan itself.
 */
async function handleKpiAnalysis_KE() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Analyzing Research Plan...</h3><p class="text-white/80 mb-2">Extracting specific indicators, scales, and milestones from your text...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = dom.$("kpiFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("kpiContent").value.trim();
            if (!text.trim()) throw new Error("Please describe the project or goal.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`KPI & Events analysis context truncated.`);
        }

        // 2. Construct NEW, HIGH-ACCURACY Prompt
        const prompt = `
        You are a meticulous research analyst and strategic consultant. Your task is to analyze the provided business context **ONLY** and extract its core components into a structured JSON.

        **USER'S BUSINESS CONTEXT:**
        \`\`\`
        ${text}
        \`\`\`

        **DETAILED TASKS (Ground all answers *strictly* in the text):**
        1.  **Extract Goal:** Identify the \`main_goal\` of the research/project (e.g., "to understand the key drivers of customer satisfaction...").
        2.  **Extract KPI Groups:**
            * First, identify the main constructs/problems (e.g., "SERVICE QUALITY", "Unstable Control Feedback Loops").
            * Then, for each construct, extract its *specific bulleted indicators* as the KPIs (e.g., "Website responsiveness", "Temperature regulation accuracy").
            * Create an array of \`kpi_groups\`. For each group:
                * \`construct_name\`: The parent construct (e.g., "Service Quality", "Unstable Control Feedback Loops").
                * \`kpis\`: An array of KPI objects. For each KPI:
                    * \`name\`: The specific indicator (e.g., "Website responsiveness", "Temperature regulation accuracy").
                    // --- CHANGED ---
                    * \`formula\`: A plausible, specific measurement scale or formula for this KPI (e.g., "Page Load Time (ms)", "Avg. Deviation from Setpoint (°C)", "Latency (ms)", "% of accurate calibrations", "Uptime %"). **If the text mentions a specific scale (like '1-7 scale'), use that. Otherwise, YOU MUST GENERATE a logical one.**
                    // --- END CHANGED ---
                    * \`type\`: Infer the category (e.g., "Operational", "Customer", "Financial").
        3.  **Extract Critical Events:** Identify key project milestones **from the text** (e.g., conducting the survey, developing the roadmap). Create an array of \`critical_events\`. For each event:
            * \`event_name\`: Name of the milestone (e.g., "Conduct Customer Survey").
            * \`description\`: What signifies completion (e.g., "Survey of 500 customers completed").
            * \`timeline\`: Timeframe (e.g., "Within 6 months", "3-year").
            * \`importance\`: Assess importance ("High" or "Medium").
        4.  **Extract Summary:** Extract the \`performance_summary\` or "Expected Business Impact" section.

        **ABSOLUTE CONSTRAINTS:**
        - **USE INDICATORS AS KPIs:** The KPIs *must* be the sub-items (e.g., "Product durability"), NOT the main constructs (e.g., "PRODUCT QUALITY").
        - **STICK TO THE TEXT:** Do NOT invent KPIs, scales, or events not present in the text, *unless* you are generating a formula as instructed.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {
            "main_goal": "[Goal extracted from text, e.g., 'To address severe challenges related to multiple dynamic systems...']",
            "kpi_groups": [
            {
                // --- CHANGED ---
                "construct_name": "Unstable Control Feedback Loops",
                "kpis": [
                {"name": "Automated control systems stability", "formula": "Oscillation Frequency (Hz) or Uptime %", "type": "Operational"},
                {"name": "Temperature regulation accuracy", "formula": "Avg. Deviation from Setpoint (°C)", "type": "Operational"}
                ]
            },
            {
                "construct_name": "Cross-System Latency",
                "kpis": [
                {"name": "IoT sensor data synchronization", "formula": "Max Data Lag (seconds)", "type": "Data"},
                {"name": "Communication latency", "formula": "Latency (ms)", "type": "Data"}
                ]
                // --- END CHANGED ---
            }
            // ... *all* other constructs and their indicators found in the text ...
            ],
            "critical_events": [
            {"event_name": "Conduct Comprehensive System Audit", "description": "Identify all conflicting dynamic interactions", "timeline": "Within 6 Months", "importance": "High"},
            {"event_name": "Rebuild Data Integration Pipelines", "description": "Implement asynchronous event-driven architecture", "timeline": "Within 9 Months", "importance": "High"}
            ],
            "performance_summary": "[Summary of expected business impact, extracted from text...]"
        }
    `;

        // 3. Send Request to Ollama
        console.log(`Sending RESEARCH-FOCUSED KPI prompt (v-fix) to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } })
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        console.log('Raw AI Response (KPI & Events - v-fix):', data.response);
        try {
            parsedData = JSON.parse(data.response);
                // *** Validation for the new GROUPED structure ***
                console.log('--- RAW AI JSON RESPONSE (Parsed - v-fix) ---');
                console.log(JSON.stringify(parsedData, null, 2));
                console.log('------------------------------------');

                if (!parsedData || !parsedData.main_goal || !Array.isArray(parsedData.kpi_groups) || parsedData.kpi_groups.length < 1 ||
                    !Array.isArray(parsedData.critical_events) ||
                    !parsedData.performance_summary ||
                    // Check the *first group* and its *first KPI* for correct structure
                    !parsedData.kpi_groups[0].construct_name ||
                    !Array.isArray(parsedData.kpi_groups[0].kpis) ||
                    parsedData.kpi_groups[0].kpis.length < 1 ||
                    !parsedData.kpi_groups[0].kpis[0].name ||
                    !parsedData.kpi_groups[0].kpis[0].formula // Check that formula is no longer "None"
                )
                {
                    // --- CHANGED ---
                    // Check if the formula is "None", which is the problem we're fixing
                    if (parsedData.kpi_groups[0].kpis[0].formula.toLowerCase() === "none") {
                        console.error("Validation Failed (v-fix): AI returned 'None' for formula despite new prompt.", parsedData);
                        throw new Error(`AI failed to generate a formula and returned 'None'. This may be a model context issue.`);
                    }
                    // --- END CHANGED ---
                    console.error("Validation Failed (v-fix): AI returned an invalid `kpi_groups` structure or had missing fields.", parsedData);
                    throw new Error(`AI response structure is incorrect. It may have failed to group KPIs. Check console.`);
                }
                console.log(`Successfully parsed (v-fix) KPI JSON using ${MODEL_NAME}. Found ${parsedData.kpi_groups.length} KPI groups.`);

        } catch (e) {
            console.error(`Failed to parse/validate (v-fix) KPI JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (v-fix): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderKpiPage_KE(analysisResultContainer, parsedData); // Call the NEW renderer

    } catch (error) {
        console.error(`Error in handleKpiAnalysis_KE (v-fix) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleMiscAnalysis_MSC() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8">
                                            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
                                            <h3 class="text-xl font-semibold text-white mb-4">Generating Comprehensive Business Analysis...</h3>
                                            <p class="text-white/80 mb-2">This is a full front-to-back analysis and may take several minutes.</p>
                                            <p id="analysisStatus" class="text-white/60 text-sm">Initializing...</p>
                                            </div>`;
    setLoading("generate", true);

    const statusEl = dom.$("analysisStatus");
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        statusEl.textContent = "Reading and processing your document...";
        const useDoc = dom.$("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = dom.$("miscFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("miscContent").value.trim();
            if (!text.trim()) throw new Error("Please provide your document content.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters of the provided text.)`;
            console.warn(`Comprehensive analysis context truncated.`);
        }

        // 2. Define Helper for Parallel AI Calls
        async function generateOllamaResponse(prompt, statusUpdate) {
            statusEl.textContent = statusUpdate;
            console.log(`Sending prompt for: ${statusUpdate}`);
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
            if (!response.ok) {
                throw new Error(`Ollama API error for ${statusUpdate}: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            try {
                return JSON.parse(data.response);
            } catch (e) {
                console.error(`Failed to parse JSON for ${statusUpdate}:`, data.response, e);
                throw new Error(`Invalid JSON received from AI for ${statusUpdate}.`);
            }
        }

        // 3. Define ALL 8 Prompts for Parallel Execution
        // Each prompt is simpler and asks for *only one* piece of the puzzle.

        const textContext = `**USER'S BUSINESS DOCUMENT:**\n\`\`\`\n${text}\n\`\`\`\n**ABSOLUTE CONSTRAINTS:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S BUSINESS DOCUMENT". **DO NOT** invent information. ${truncatedNote}`;

        const prompt_summary = `
            ${textContext}
            **TASK:** Write a comprehensive \`executive_summary\` covering the core problem/opportunity, strategic goal, key initiatives, and expected outcomes **as described in the text**.
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"executive_summary": "..."}`;

        const prompt_mission = `
            ${textContext}
            **TASK:** Extract the \`mission\`, \`vision\`, and 3-5 \`values\` **stated or implied in the text**.
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"mission": "...", "vision": "...", "values": ["...", "..."]}`;

        const prompt_internal = `
            ${textContext}
            **TASK:** Identify 4-6 internal \`strengths\` and 4-6 internal \`weaknesses\` **from the text**. For each, provide "factor", "description", and "impact_score" (1-10).
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"strengths": [{"factor": "...", "description": "...", "impact_score": 8}, ...], "weaknesses": [{"factor": "...", "description": "...", "impact_score": 6}, ...]}`;

        const prompt_external = `
            ${textContext}
            **TASK:** Identify 4-6 external \`opportunities\` and 4-6 external \`threats\` **from the text**. For each, provide "factor", "description", and "impact_score" (1-10).
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"opportunities": [{"factor": "...", "description": "...", "impact_score": 9}, ...], "threats": [{"factor": "...", "description": "...", "impact_score": 7}, ...]}`;

        const prompt_goals = `
            ${textContext}
            **TASK:** Identify 3-5 high-level \`strategic_goals\` **from the text**. For each goal, list 2-3 \`key_initiatives\` **from the text** to achieve it, including "initiative_name", "rationale", and "kpis".
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"strategic_goals": [{"goal_name": "...", "key_initiatives": [{"initiative_name": "...", "rationale": "...", "kpis": ["..."]}, ...]}, ...]}`;
        
        const prompt_risks = `
            ${textContext}
            **TASK:** Identify 3-4 major \`risk_assessment\` items **from the text**. For each, provide "risk", "impact", "likelihood", "justification", and "mitigation".
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"risk_assessment": [{"risk": "...", "impact": "High", "likelihood": "Medium", "justification": "...", "mitigation": "..."}, ...]}`;

        const prompt_gov = `
            ${textContext}
            **TASK:** Identify 3-4 key \`governance\` stakeholders/teams **from the text**. For each, list their "stakeholder" name and "responsibilities".
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"governance": [{"stakeholder": "...", "responsibilities": ["...", "..."]}, ...]}`;
        
        const prompt_conclusion = `
            ${textContext}
            **TASK:** Write a \`conclusion\` summarizing the strategic importance and forward-looking outlook **based ONLY on the text**.
            **RETURN FORMAT:** Provide ONLY a valid JSON object: {"conclusion": "..."}`;

        // 4. Run All Requests in Parallel
        statusEl.textContent = "Generating all 8 analysis sections in parallel...";
        const [
            summaryData,
            missionData,
            internalData,
            externalData,
            goalsData,
            risksData,
            govData,
            conclusionData
        ] = await Promise.all([
            generateOllamaResponse(prompt_summary, "Generating Executive Summary..."),
            generateOllamaResponse(prompt_mission, "Defining Mission & Vision..."),
            generateOllamaResponse(prompt_internal, "Analyzing Internal Factors..."),
            generateOllamaResponse(prompt_external, "Analyzing External Factors..."),
            generateOllamaResponse(prompt_goals, "Developing Strategic Goals..."),
            generateOllamaResponse(prompt_risks, "Assessing Risks..."),
            generateOllamaResponse(prompt_gov, "Defining Governance..."),
            generateOllamaResponse(prompt_conclusion, "Writing Conclusion...")
        ]);

        // 5. Assemble the Final JSON Object
        statusEl.textContent = "Assembling final report...";
        const parsedData = {
            executive_summary: summaryData.executive_summary,
            mission_vision: missionData,
            internal_factors: internalData, // This will be { strengths: [...], weaknesses: [...] }
            external_factors: externalData, // This will be { opportunities: [...], threats: [...] }
            strategic_goals: goalsData.strategic_goals,
            risk_assessment: risksData.risk_assessment,
            governance: govData.governance,
            conclusion: conclusionData.conclusion
        };
        
        // *** This validation is now much simpler, as we built the object ***
        if (!parsedData.executive_summary || !parsedData.mission_vision.mission || !parsedData.internal_factors.strengths || !parsedData.external_factors.opportunities || !parsedData.strategic_goals) {
                console.error("Validation Failed: One of the parallel AI calls returned an invalid structure.", parsedData);
                throw new Error("Failed to generate one or more sections of the analysis. Check console for details.");
        }

        console.log("Successfully assembled comprehensive analysis from 8 parallel calls.");

        // 6. Render Results
        statusEl.textContent = "Rendering comprehensive analysis...";
        renderSP.renderMiscPage_MSC(analysisResultContainer, parsedData); // Call the renderer

    } catch (error) {
        console.error(`Error in handleMiscAnalysis_MSC (Comprehensive):`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}

export {
    handleMissionVisionAnalysis,
    handleFactorAnalysis,
    handleSwotTowsAnalysis,
    handleGoalsAndInitiativesAnalysis_SP,
    handleObjectivesAnalysis,
    handleActionPlansAnalysis_AP,
    handleKpiAnalysis_KE,
    handleMiscAnalysis_MSC
}