// =====================================================================================================
// ===================        Strategic Planning Analysis Handling Functions        ====================
// =====================================================================================================
import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import * as renderSP from '../ui/analysis-rendering/analysis-rendering-sp.mjs';

async function handleFactorAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white">Performing Context-Aware Factor Analysis...</h3>
            <p class="text-white/80 mb-2">Identifying Internal (S/W) and External (O/T) factors using AI based *only* on your text...</p>
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Or qwen3:30b-a3b

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

        // 2. Construct ENHANCED Prompt for LLM
        const prompt = `
            You are a meticulous strategic analyst. Analyze the provided business description based **ONLY** on the text itself. Identify key Internal Factors (Strengths, Weaknesses) and External Factors (Opportunities, Threats). ${truncatedNote}

            **USER'S BUSINESS DESCRIPTION:**
            \`\`\`
            ${documentText}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Identify Internal Factors:** Extract specific Strengths (internal positives) and Weaknesses (internal negatives) **mentioned or clearly implied in the text**. Categorize them (e.g., "Brand & Marketing", "Operations", "Financial", "Human Resources", "Technology"). Provide 4-6 factors for each (S & W).
            2.  **Identify External Factors:** Extract specific Opportunities (external positives) and Threats (external negatives) **mentioned or clearly implied in the text**. Categorize them using PESTEL+ framework (Political, Economic, Social, Technological, Environmental, Legal, Market/Competitive). Provide 4-6 factors for each (O & T).
            3.  **Assign Impact:** For EACH factor identified (Internal & External), assign a plausible \`impact_score\` (integer 1-10, where 10 is highest impact) based **only** on its significance as suggested **by the text**.
            4.  **Provide Description:** For EACH factor, provide a brief \`description\` summarizing the factor **using wording found in or directly inferred from the text**.
            5.  **Self-Correction:** Rigorously check: Is every factor, category, description, and impact score derived **SOLELY** from the provided text? Are factors correctly classified as Internal/External and S/W/O/T based on the text? Is the JSON structure perfect? Fix errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S BUSINESS DESCRIPTION". **DO NOT** invent factors, categories, or scores.
            - **SPECIFICITY:** Descriptions must be concise and grounded in the text.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object.
            {
              "internal_factors": {
                "strengths": [ // 4-6 factors based ONLY on text
                  {"category": "[Category ONLY from text]", "factor": "[Strength ONLY from text]", "description": "[Desc. ONLY from text]", "impact_score": "[Score 1-10 based ONLY on text]"},
                  // ...
                ],
                "weaknesses": [ // 4-6 factors based ONLY on text
                  {"category": "[Category ONLY from text]", "factor": "[Weakness ONLY from text]", "description": "[Desc. ONLY from text]", "impact_score": "[Score 1-10 based ONLY on text]"},
                  // ...
                ]
              },
              "external_factors": {
                "opportunities": [ // 4-6 factors based ONLY on text
                  {"category": "[PESTEL+ Category ONLY from text]", "factor": "[Opportunity ONLY from text]", "description": "[Desc. ONLY from text]", "impact_score": "[Score 1-10 based ONLY on text]"},
                  // ...
                ],
                "threats": [ // 4-6 factors based ONLY on text
                   {"category": "[PESTEL+ Category ONLY from text]", "factor": "[Threat ONLY from text]", "description": "[Desc. ONLY from text]", "impact_score": "[Score 1-10 based ONLY on text]"},
                  // ...
                ]
              }
            }
        `;

        // 3. Call Ollama API
        console.log(`Sending Factor Analysis prompt to ${MODEL_NAME}...`);
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
             // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Factor Analysis) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.internal_factors || typeof parsedData.internal_factors !== 'object' ||
                 !Array.isArray(parsedData.internal_factors.strengths) || !Array.isArray(parsedData.internal_factors.weaknesses) ||
                 !parsedData.external_factors || typeof parsedData.external_factors !== 'object' ||
                 !Array.isArray(parsedData.external_factors.opportunities) || !Array.isArray(parsedData.external_factors.threats) ||
                 // Check structure of first factor if lists are not empty
                 (parsedData.internal_factors.strengths.length > 0 && (typeof parsedData.internal_factors.strengths[0] !== 'object' || !parsedData.internal_factors.strengths[0].hasOwnProperty('factor') || !parsedData.internal_factors.strengths[0].hasOwnProperty('impact_score'))) ||
                 (parsedData.internal_factors.weaknesses.length > 0 && (typeof parsedData.internal_factors.weaknesses[0] !== 'object' || !parsedData.internal_factors.weaknesses[0].hasOwnProperty('factor') || !parsedData.internal_factors.weaknesses[0].hasOwnProperty('impact_score'))) ||
                  (parsedData.external_factors.opportunities.length > 0 && (typeof parsedData.external_factors.opportunities[0] !== 'object' || !parsedData.external_factors.opportunities[0].hasOwnProperty('factor') || !parsedData.external_factors.opportunities[0].hasOwnProperty('impact_score'))) ||
                  (parsedData.external_factors.threats.length > 0 && (typeof parsedData.external_factors.threats[0] !== 'object' || !parsedData.external_factors.threats[0].hasOwnProperty('factor') || !parsedData.external_factors.threats[0].hasOwnProperty('impact_score')))
                )
             {
                  console.error("Validation Failed (Factor Analysis): Required fields missing or invalid structure.", parsedData);
                  throw new Error(`AI response structure is incorrect or inconsistent (Factor Analysis). Check internal/external factors arrays and object structures. See console logs.`);
             }
             console.log(`Successfully parsed Factor Analysis JSON using ${MODEL_NAME}.`);

        } catch (e) {
            console.error(`Failed to parse/validate Factor Analysis JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Factor Analysis): ${e.message}. See raw response in console.`);
        }

        // 4. Process AI Output & Apply Pareto
        const allInternalFactors = [
            ...(parsedData.internal_factors.strengths || []).map(f => ({ ...f, type: 'Internal', swot: 'Strength' })),
            ...(parsedData.internal_factors.weaknesses || []).map(f => ({ ...f, type: 'Internal', swot: 'Weakness' }))
        ];
        const allExternalFactors = [
             ...(parsedData.external_factors.opportunities || []).map(f => ({ ...f, type: 'External', swot: 'Opportunity' })),
             ...(parsedData.external_factors.threats || []).map(f => ({ ...f, type: 'External', swot: 'Threat' }))
        ];

        // Ensure impact_score is a number for Pareto function
        const sanitizeScore = (factor) => ({
            ...factor,
            impact_score: Number(factor.impact_score) || 0 // Default to 0 if not a number
        });

        const prioritizedInternal = applyParetoAnalysisJS(allInternalFactors.map(sanitizeScore));
        const prioritizedExternal = applyParetoAnalysisJS(allExternalFactors.map(sanitizeScore));


        // 5. Render Results
        renderSP.renderFactorAnalysisPage(analysisResultContainer, {
            external: prioritizedExternal,
            internal: prioritizedInternal
        });

    } catch (error) {
        console.error(`Error in handleFactorAnalysis (LLM) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
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



async function handleActionPlansAnalysis_AP() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Action Plan...</h3><p class="text-white/80 mb-2">Breaking down your objective into actionable tasks based *only* on your text...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

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

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are an expert project manager. Analyze the user's objective description based **ONLY** on the provided text and break it down into a detailed, sequential action plan. ${truncatedNote}

            **USER'S OBJECTIVE / PROJECT DESCRIPTION:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Define Project Name:** Create a concise \`project_name\` derived **only from the text**.
            2.  **Develop Action Items (5-7 sequential items):** Create an array of \`action_items\`. For each item, derive the following **strictly from the user's text**:
                * \`task_name\`: Clear, actionable name (under 10 words).
                * \`description\`: Detailed explanation (2-3 sentences) of what needs to be done, **using specifics from the text**.
                * \`owner\`: Department, team, or role responsible, **as mentioned or implied in the text**.
                * \`timeline\`: Specific, sequential timeframe (e.g., "Weeks 1-2", "Month 2", "Q3") **suggested by the text's scope or explicit mentions**.
                * \`priority\`: Task's priority ("High", "Medium", "Low") **inferred from its importance described in the text**.
                * \`resources_needed\`: List key resources (e.g., Budget, Personnel, Technology, Data) **mentioned or clearly implied as necessary in the text**. If none implied, use ["Standard Operating Resources"].
                * \`key_dependency\`: (Optional) Name of another task from this plan that this task **clearly depends on according to the text**. If none, use null.
                * \`kpis_to_track\`: List 1-2 specific metrics **derived ONLY from the text** to measure the successful completion *of this specific task*.
            3.  **Self-Correction:** Rigorously check: Is project name derived from text? Are action items sequential and logical based on text? Is EVERY detail (name, description, owner, timeline, priority, resources, dependency, KPIs) **strictly derived ONLY from the user's text**? Is the JSON perfect? Fix errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S OBJECTIVE / PROJECT DESCRIPTION". **DO NOT** invent tasks, roles, timelines, resources, dependencies, or KPIs. If the text lacks detail for a field (e.g., resources), infer reasonably or state appropriately (like "Standard Operating Resources").
            - **NO GENERIC EXAMPLES:** Replace **ALL** placeholder text in the RETURN FORMAT structure below with content generated **strictly from the user's input text**.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text.
            {
              "project_name": "[Project Name derived ONLY from user text]",
              "action_items": [ // 5-7 items derived ONLY from text
                {
                  "task_name": "[Task 1 Name ONLY from text]",
                  "description": "[Detailed description ONLY from text...]",
                  "owner": "[Owner ONLY from text]",
                  "timeline": "[Timeline inferred ONLY from text scope]",
                  "priority": "[High/Medium/Low based ONLY on text]",
                  "resources_needed": ["[Resource 1 ONLY from text]", "[Resource 2 ONLY from text]"],
                  "key_dependency": null, // or "[Task Name ONLY from text]" if applicable
                  "kpis_to_track": ["[KPI for Task 1 ONLY from text]"]
                },
                {
                  "task_name": "[Task 2 Name ONLY from text]",
                  "description": "[Detailed description ONLY from text...]",
                  "owner": "[Owner ONLY from text]",
                  "timeline": "[Timeline inferred ONLY from text scope]",
                  "priority": "[High/Medium/Low based ONLY on text]",
                  "resources_needed": ["[Resource 3 ONLY from text]"],
                  "key_dependency": "[Task 1 Name ONLY from text]", // Example dependency
                  "kpis_to_track": ["[KPI for Task 2 ONLY from text 1]", "[KPI for Task 2 ONLY from text 2]"]
                }
                // ... 3-5 more items derived ONLY from text ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Action Plan prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Action Plan - SP):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Action Plan SP) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.project_name || typeof parsedData.project_name !== 'string' || parsedData.project_name.includes("[") ||
                 !Array.isArray(parsedData.action_items) || parsedData.action_items.length < 3 || // Expect at least a few actions
                 // Check structure and placeholders in first action item
                  (parsedData.action_items.length > 0 && (
                      typeof parsedData.action_items[0] !== 'object' ||
                      !parsedData.action_items[0].hasOwnProperty('task_name') || parsedData.action_items[0].task_name.includes("[") ||
                      !parsedData.action_items[0].hasOwnProperty('description') || parsedData.action_items[0].description.includes("[") ||
                      !parsedData.action_items[0].hasOwnProperty('owner') || // Allow owner to be missing if not in text
                      !parsedData.action_items[0].hasOwnProperty('timeline') || parsedData.action_items[0].timeline.includes("[") ||
                      !parsedData.action_items[0].hasOwnProperty('priority') || !['High', 'Medium', 'Low'].includes(parsedData.action_items[0].priority) ||
                      !Array.isArray(parsedData.action_items[0].resources_needed) ||
                      !parsedData.action_items[0].hasOwnProperty('key_dependency') || // Allow null
                      !Array.isArray(parsedData.action_items[0].kpis_to_track)
                  ))
                )
             {
                  console.error("Validation Failed (Enhanced Action Plan SP): Required fields missing, invalid structure, or placeholders detected.", parsedData);
                  throw new Error(`AI response structure is incorrect, inconsistent, or contains placeholders (Enhanced Action Plan SP). Check project name and action items structure/content carefully. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED Action Plan (SP) JSON using ${MODEL_NAME}. Found ${parsedData.action_items.length} action items.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Action Plan (SP) JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Action Plan SP): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderActionPlansPage_AP(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleActionPlansAnalysis_AP (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleKpiAnalysis_KE() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Defining Performance Metrics & Milestones...</h3><p class="text-white/80 mb-2">Identifying key indicators and critical events based *only* on your text...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

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

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are a performance management and strategy execution expert. Analyze the user's goal/project description based **ONLY** on the provided text. Develop a framework of Key Performance Indicators (KPIs) and critical events derived **strictly** from that text. ${truncatedNote}

            **USER'S GOAL / PROJECT DESCRIPTION:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Refine Goal:** Provide a refined, single-sentence summary of the user's primary goal (\`main_goal\`) **based ONLY on the text**.
            2.  **Define KPIs (4-6 KPIs):** Create an array of \`kpis\`. For each KPI, derive the following **strictly from the user's text**:
                * \`name\`: The name of the KPI **mentioned or logically implied**.
                * \`description\`: A brief explanation of what it measures **in this context**.
                * \`formula\`: How the KPI is calculated (e.g., "(Repeat Customers / Total Customers) * 100") **based on terms in the text**. If not explicitly calculable, describe conceptually (e.g., "Survey score on 7-point scale").
                * \`target\`: A specific, measurable target **mentioned or clearly implied in the text**. If none, state "Target Not Specified in Text".
                * \`type\`: Category (e.g., "Leading", "Lagging", "Financial", "Customer", "Operational") **inferred ONLY from the KPI's role described or implied in the text**.
            3.  **Define Critical Events (3-5 events):** Create an array of major project milestones (\`critical_events\`). For each event, derive the following **strictly from the user's text**:
                * \`event_name\`: Name of the milestone **mentioned or logically implied**.
                * \`description\`: What signifies completion **based on the text**.
                * \`timeline\`: Target timeframe **inferred ONLY from text scope or mentions**.
                * \`importance\`: Assess importance ("High" or "Medium") **based on text**.
            4.  **Performance Summary:** Write a brief \`performance_summary\` (2-3 sentences) linking the key KPIs and critical events back to achieving the main goal, **using ONLY information derived from the text**.
            5.  **Self-Correction:** Rigorously check: Is the goal derived solely from text? Is EVERY detail of KPIs and Events (name, desc, formula, target, type, timeline, importance) **strictly derived ONLY from the user's text**? Is the summary accurate based on text? Is JSON perfect? Fix errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S GOAL / PROJECT DESCRIPTION". **DO NOT** invent KPIs, events, targets, formulas, timelines, or summaries. If information isn't in the text, state that appropriately (e.g., in the target field).
            - **NO GENERIC EXAMPLES:** Replace **ALL** placeholder text in the RETURN FORMAT structure below with content generated **strictly from the user's input text**.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text.
            {
              "main_goal": "[Refined goal statement ONLY from user text]",
              "kpis": [ // 4-6 KPIs derived ONLY from text
                {
                  "name": "[KPI Name ONLY from text]",
                  "description": "[Description ONLY based on text context]",
                  "formula": "[Formula or calculation method ONLY from text]",
                  "target": "[Target ONLY from text or 'Target Not Specified in Text']",
                  "type": "[Leading/Lagging/Financial/etc. inferred ONLY from text]"
                },
                //...
              ],
              "critical_events": [ // 3-5 events derived ONLY from text
                {
                  "event_name": "[Event Name ONLY from text]",
                  "description": "[Completion criteria ONLY from text]",
                  "timeline": "[Timeline inferred ONLY from text]",
                  "importance": "[High/Medium based ONLY on text]"
                },
                //...
              ],
              "performance_summary": "[2-3 sentence summary linking KPIs/Events to goal, using ONLY text-derived info]"
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED KPI & Events prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (KPI & Events - SP):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced KPI & Events SP) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.main_goal || typeof parsedData.main_goal !== 'string' || parsedData.main_goal.includes("[") ||
                 !Array.isArray(parsedData.kpis) || parsedData.kpis.length < 2 || // Expect a few KPIs
                 !Array.isArray(parsedData.critical_events) || parsedData.critical_events.length < 1 || // Expect at least one event
                 !parsedData.performance_summary || typeof parsedData.performance_summary !== 'string' || parsedData.performance_summary.includes("[") ||
                 // Check structure of first KPI
                 (parsedData.kpis.length > 0 && (
                     typeof parsedData.kpis[0] !== 'object' ||
                     !parsedData.kpis[0].hasOwnProperty('name') || parsedData.kpis[0].name.includes("[") ||
                     !parsedData.kpis[0].hasOwnProperty('description') || parsedData.kpis[0].description.includes("[") ||
                     !parsedData.kpis[0].hasOwnProperty('formula') || // Allow formula to be complex string
                     !parsedData.kpis[0].hasOwnProperty('target') || // Allow specific string for missing target
                     !parsedData.kpis[0].hasOwnProperty('type') || parsedData.kpis[0].type.includes("[")
                 )) ||
                  // Check structure of first Event
                  (parsedData.critical_events.length > 0 && (
                      typeof parsedData.critical_events[0] !== 'object' ||
                      !parsedData.critical_events[0].hasOwnProperty('event_name') || parsedData.critical_events[0].event_name.includes("[") ||
                      !parsedData.critical_events[0].hasOwnProperty('description') || parsedData.critical_events[0].description.includes("[") ||
                      !parsedData.critical_events[0].hasOwnProperty('timeline') || parsedData.critical_events[0].timeline.includes("[") ||
                      !parsedData.critical_events[0].hasOwnProperty('importance') || !['High', 'Medium'].includes(parsedData.critical_events[0].importance)
                  ))
                )
             {
                  console.error("Validation Failed (Enhanced KPI & Events SP): Required fields missing, invalid structure, or placeholders detected.", parsedData);
                  throw new Error(`AI response structure is incorrect, inconsistent, or contains placeholders (Enhanced KPI & Events SP). Check all fields carefully. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED KPI & Events (SP) JSON using ${MODEL_NAME}. Found ${parsedData.kpis.length} KPIs.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED KPI & Events (SP) JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced KPI & Events SP): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderKpiPage_KE(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleKpiAnalysis_KE (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleMiscAnalysis_MSC() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Compiling Final Report Sections...</h3><p class="text-white/80 mb-2">Generating summary, risks, governance, and conclusion based *only* on your provided document...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
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
        const MAX_CONTEXT_LENGTH = 15000; // Allow larger context for final summary
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Misc analysis context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are a senior business strategist finalizing a strategic plan document. Analyze the provided document **based ONLY on the text itself** and compile the final key sections. ${truncatedNote}

            **USER'S STRATEGIC DOCUMENT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            Compile the final sections **strictly derived from the user's text**:
            1.  **Executive Summary (\`executive_summary\`):** Write a comprehensive, multi-sentence summary covering the core problem/opportunity, strategic goal, key initiatives/strategies proposed, and expected outcomes **as described in the text**. Ensure it accurately reflects the document's main points.
            2.  **Risk Assessment (\`risk_assessment\`):** Identify 3-4 major risks **mentioned or clearly implied in the text**. For each risk:
                * \`risk\`: Description **from the text**.
                * \`impact\`: Potential impact ("High", "Medium", "Low") **inferred ONLY from the text's description**.
                * \`likelihood\`: Likelihood ("High", "Medium", "Low") **inferred ONLY from the text's description**.
                * \`justification\`: Briefly explain (1 sentence) the reasoning for the impact/likelihood ratings **based ONLY on text evidence**.
                * \`mitigation\`: Specific mitigation strategy **mentioned or logically derived ONLY from the text**.
            3.  **Governance (\`governance\`):** Identify 3-4 key stakeholders or teams **mentioned in the text**. For each:
                * \`stakeholder\`: Name of team/role **from the text**.
                * \`responsibilities\`: List 2-3 specific responsibilities related to plan execution **explicitly stated or clearly implied in the text**.
            4.  **Conclusion (\`conclusion\`):** Write a comprehensive concluding section summarizing the strategic importance, reinforcing key success factors **mentioned in the text**, and providing a forward-looking statement **based ONLY on the text's narrative**.
            5.  **Self-Correction:** Rigorously check: Is EVERY detail (summary points, risks, justifications, mitigations, stakeholders, responsibilities, conclusion themes) **strictly derived ONLY from the user's text**? Are impact/likelihood justifications text-based? Is the JSON perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S STRATEGIC DOCUMENT". **DO NOT** invent information.
            - **NO GENERIC EXAMPLES:** Replace **ALL** placeholder text in the RETURN FORMAT with content generated **strictly from the user's input text**.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text.
            {
              "executive_summary": "[Comprehensive summary derived ONLY from user text, covering problem/goal/strategy/outcome...]",
              "risk_assessment": [ // 3-4 risks derived ONLY from text
                {
                  "risk": "[Risk description ONLY from text]",
                  "impact": "[High/Medium/Low based ONLY on text]",
                  "likelihood": "[High/Medium/Low based ONLY on text]",
                  "justification": "[Reason for ratings based ONLY on text evidence]",
                  "mitigation": "[Mitigation strategy ONLY from text]"
                },
                //...
              ],
              "governance": [ // 3-4 stakeholders derived ONLY from text
                {
                  "stakeholder": "[Stakeholder/Team Name ONLY from text]",
                  "responsibilities": [
                    "[Responsibility 1 ONLY from text]",
                    "[Responsibility 2 ONLY from text]"
                  ]
                },
                //...
              ],
              "conclusion": "[Comprehensive conclusion summarizing importance, success factors, and outlook, based ONLY on user text...]"
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Misc Sections prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Misc - SP):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Misc SP) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.executive_summary || typeof parsedData.executive_summary !== 'string' || parsedData.executive_summary.includes("[") ||
                 !Array.isArray(parsedData.risk_assessment) || parsedData.risk_assessment.length < 1 ||
                 !Array.isArray(parsedData.governance) || parsedData.governance.length < 1 ||
                 !parsedData.conclusion || typeof parsedData.conclusion !== 'string' || parsedData.conclusion.includes("[") ||
                 // Check structure of first risk
                 (parsedData.risk_assessment.length > 0 && (
                     typeof parsedData.risk_assessment[0] !== 'object' ||
                     !parsedData.risk_assessment[0].hasOwnProperty('risk') || parsedData.risk_assessment[0].risk.includes("[") ||
                     !parsedData.risk_assessment[0].hasOwnProperty('impact') || !['High', 'Medium', 'Low'].includes(parsedData.risk_assessment[0].impact) ||
                     !parsedData.risk_assessment[0].hasOwnProperty('likelihood') || !['High', 'Medium', 'Low'].includes(parsedData.risk_assessment[0].likelihood) ||
                     !parsedData.risk_assessment[0].hasOwnProperty('justification') || parsedData.risk_assessment[0].justification.includes("[") || // Added justification check
                     !parsedData.risk_assessment[0].hasOwnProperty('mitigation') || parsedData.risk_assessment[0].mitigation.includes("[")
                 )) ||
                  // Check structure of first governance item
                  (parsedData.governance.length > 0 && (
                      typeof parsedData.governance[0] !== 'object' ||
                      !parsedData.governance[0].hasOwnProperty('stakeholder') || parsedData.governance[0].stakeholder.includes("[") ||
                      !Array.isArray(parsedData.governance[0].responsibilities) || parsedData.governance[0].responsibilities.length < 1 ||
                      (parsedData.governance[0].responsibilities.length > 0 && parsedData.governance[0].responsibilities[0].includes("["))
                  ))
                )
             {
                  console.error("Validation Failed (Enhanced Misc SP): Required fields missing, invalid structure, or placeholders detected.", parsedData);
                  throw new Error(`AI response structure is incorrect, inconsistent, or contains placeholders (Enhanced Misc SP). Check all sections carefully. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED Misc Sections (SP) JSON using ${MODEL_NAME}.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Misc Sections (SP) JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Misc SP): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSP.renderMiscPage_MSC(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleMiscAnalysis_MSC (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
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


export {
    handleFactorAnalysis,
    handleSwotTowsAnalysis,
    handleGoalsAndInitiativesAnalysis_SP,
    handleActionPlansAnalysis_AP,
    handleKpiAnalysis_KE,
    handleMiscAnalysis_MSC
}