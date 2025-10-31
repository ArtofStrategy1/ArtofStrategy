// =====================================================================================================
// ===================         Systems Thinking Analysis Handling Functions         ====================
// =====================================================================================================

async function handleProcessMappingAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white">Mapping and Analyzing Your Process...</h3><p class="text-white/80 mb-2">Identifying steps, bottlenecks, and potential optimizations...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = document.querySelector('input[name="inputType"]:checked').id === "docUpload";
        let content = "";
        if (useDoc) {
            const file = $("processFile").files[0];
            if (!file) throw new Error("Please select a document.");
            content = await extractTextFromFile(file);
        } else {
            content = $("processContent").value.trim();
            if (!content) throw new Error("Please describe the process.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (content.length > MAX_CONTEXT_LENGTH) {
            content = content.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Process Mapping context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are an expert business process analyst. Analyze the following process description provided by the user and model it comprehensively. Focus on identifying bottlenecks and suggesting concrete optimizations based *only* on the provided text. ${truncatedNote}

            **USER'S PROCESS DESCRIPTION:**
            \`\`\`
            ${content}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Process Definition:** Define a clear \`process_name\` based on the description.
            2.  **Identify Steps (8-12 steps):** Extract the sequential steps. For each step, provide:
                * \`id\`: A unique sequential number (1, 2, 3...).
                * \`name\`: A concise action-oriented name (2-5 words).
                * \`description\`: A brief explanation of the step based on the context.
                * \`owner\`: The role or department responsible, as mentioned or implied in the context.
                * \`type\`: Classify as "Start", "Task", "Decision", "End", or "Sub-process" based on context.
            3.  **Define Connections:** Specify the flow between steps. For each connection:
                * \`from\`: The ID of the source step.
                * \`to\`: The ID of the target step.
                * \`label\`: The condition or transition (e.g., "Next", "Yes", "No", "Approved", "Rejected"), inferred from context.
            4.  **Identify Bottlenecks (2-3 bottlenecks):** Pinpoint specific steps or transitions that appear inefficient, slow, or problematic based *only* on the description. For each bottleneck:
                * \`step_name\`: The name of the bottleneck step (or transition description like "Handover from Sales to Ops").
                * \`reason\`: A detailed explanation *citing evidence from the context* why it's considered a bottleneck (e.g., "Context mentions manual data entry here", "Description implies waiting time", "Multiple approvals required as stated in text").
            5.  **Suggest Optimizations (2-3 suggestions):** For the identified bottlenecks or other inefficient steps described, propose specific improvements. For each optimization:
                * \`target_step_name\`: The step the optimization applies to.
                * \`suggestion\`: A clear description of the proposed change (e.g., "Automate data entry", "Implement parallel processing", "Simplify approval workflow").
                * \`rationale\`: Explain *how* this optimization addresses the inefficiency *described in the context*.
                * \`type\`: Categorize the optimization (e.g., "Automation", "Simplification", "Parallelization", "Standardization", "Resource Allocation").
            6.  **Recommend KPIs (4-5 KPIs):** Suggest relevant Key Performance Indicators to measure the process's efficiency and effectiveness, based on the context. For each KPI:
                * \`name\`: Name of the KPI (e.g., "Cycle Time").
                * \`description\`: What it measures specifically in relation to this process.

            7.  **Self-Correction:** Before outputting JSON, rigorously check: Is every piece of information (steps, owners, types, connections, bottlenecks, reasons, optimizations, KPIs) derived *solely* from the user's text? Are connections logical? Are bottleneck reasons and optimization rationales explicitly linked to the text? Is the JSON structure perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** All output MUST be based *exclusively* on the provided PROCESS DESCRIPTION. Do NOT invent steps, roles, bottlenecks, or optimizations not supported by the text.
            - **SPECIFICITY:** Be specific in descriptions, reasons, and rationales, referencing the context where possible.
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys and sub-keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
              "process_name": "Example: Customer Order Fulfillment",
              "steps": [
                {"id": 1, "name": "Receive Order", "description": "System receives order via web form.", "owner": "System/Sales", "type": "Start"},
                {"id": 2, "name": "Check Inventory", "description": "Warehouse staff manually check stock levels.", "owner": "Warehouse", "type": "Task"},
                {"id": 3, "name": "Stock Available?", "description": "Decision based on inventory check.", "owner": "Warehouse", "type": "Decision"},
                {"id": 4, "name": "Allocate Stock", "description": "If available, reserve items.", "owner": "Warehouse", "type": "Task"},
                {"id": 5, "name": "Notify Backorder", "description": "If unavailable, inform customer.", "owner": "Customer Service", "type": "Task"},
                {"id": 6, "name": "Pack Order", "description": "Warehouse packs the allocated items.", "owner": "Warehouse", "type": "Task"},
                {"id": 7, "name": "Ship Order", "description": "Logistics arranges shipment.", "owner": "Logistics", "type": "Task"},
                {"id": 8, "name": "Send Confirmation", "description": "System sends shipping confirmation.", "owner": "System", "type": "Task"},
                {"id": 9, "name": "Process Complete", "description": "Order fulfillment cycle ends.", "owner": "System", "type": "End"}
              ],
              "connections": [
                {"from": 1, "to": 2, "label": "Next"},
                {"from": 2, "to": 3, "label": "Next"},
                {"from": 3, "to": 4, "label": "Yes"},
                {"from": 3, "to": 5, "label": "No"},
                {"from": 4, "to": 6, "label": "Next"},
                {"from": 5, "to": 9, "label": "End Cycle"}, // Example connection
                {"from": 6, "to": 7, "label": "Ready to Ship"},
                {"from": 7, "to": 8, "label": "Shipped"},
                {"from": 8, "to": 9, "label": "Confirmed"}
              ],
              "bottlenecks": [
                {"step_name": "Check Inventory", "reason": "Context states 'Warehouse staff manually check stock levels', indicating a slow, error-prone step compared to automated checks."},
                {"step_name": "Handover from Warehouse to Logistics", "reason": "The description implies a potential delay between packing ('Pack Order') and shipping ('Ship Order') without specifying a clear trigger or SLA, suggesting a possible bottleneck."}
              ],
              "optimizations": [
                {
                  "target_step_name": "Check Inventory",
                  "suggestion": "Implement a real-time inventory management system.",
                  "rationale": "Replaces the slow 'manual check' mentioned in the context with an automated system, reducing errors and speeding up the decision at step 3 ('Stock Available?').",
                  "type": "Automation"
                },
                {
                  "target_step_name": "Pack Order / Ship Order Transition",
                  "suggestion": "Establish automated notification from Warehouse to Logistics upon packing completion.",
                  "rationale": "Addresses the implied delay between steps 6 and 7 by creating a clear trigger, potentially reducing wait time as suggested by the lack of explicit connection in the description.",
                  "type": "Process Improvement/Automation"
                }
              ],
              "kpis": [
                {"name": "Order Cycle Time", "description": "Total time from 'Receive Order' (Step 1) to 'Send Confirmation' (Step 8)."},
                {"name": "Inventory Check Time", "description": "Time taken specifically for the 'Check Inventory' step (Step 2)."},
                {"name": "Picking and Packing Time", "description": "Time taken for 'Allocate Stock' and 'Pack Order' (Steps 4 & 6)."},
                {"name": "On-Time Shipment Rate", "description": "Percentage of orders shipped by the promised date."},
                {"name": "Order Accuracy Rate", "description": "Percentage of orders shipped without errors (correct items, quantity)."}
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Process Mapping prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Process Mapping):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Process Mapping) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.process_name || typeof parsedData.process_name !== 'string' ||
                 !Array.isArray(parsedData.steps) || parsedData.steps.length < 3 ||
                 !Array.isArray(parsedData.connections) || parsedData.connections.length < parsedData.steps.length - 1 || // At least n-1 connections usually
                 !Array.isArray(parsedData.bottlenecks) || // Can be empty, but must exist
                 !Array.isArray(parsedData.optimizations) || // Can be empty, but must exist
                 !Array.isArray(parsedData.kpis) || parsedData.kpis.length < 2 || // Expect at least a couple of KPIs
                 // Check structure of first elements if they exist
                 (parsedData.steps.length > 0 && (typeof parsedData.steps[0] !== 'object' || !parsedData.steps[0].hasOwnProperty('id') || !parsedData.steps[0].hasOwnProperty('name') || !parsedData.steps[0].hasOwnProperty('type'))) ||
                 (parsedData.connections.length > 0 && (typeof parsedData.connections[0] !== 'object' || !parsedData.connections[0].hasOwnProperty('from') || !parsedData.connections[0].hasOwnProperty('to'))) ||
                 (parsedData.bottlenecks.length > 0 && (typeof parsedData.bottlenecks[0] !== 'object' || !parsedData.bottlenecks[0].hasOwnProperty('step_name') || !parsedData.bottlenecks[0].hasOwnProperty('reason'))) ||
                 (parsedData.optimizations.length > 0 && (typeof parsedData.optimizations[0] !== 'object' || !parsedData.optimizations[0].hasOwnProperty('suggestion') || !parsedData.optimizations[0].hasOwnProperty('rationale'))) ||
                 (parsedData.kpis.length > 0 && (typeof parsedData.kpis[0] !== 'object' || !parsedData.kpis[0].hasOwnProperty('name') || !parsedData.kpis[0].hasOwnProperty('description')))
                )
             {
                  console.error("Validation Failed (Enhanced Process Mapping): Required fields missing or invalid structure.", parsedData);
                  throw new Error(`AI response structure is incorrect or inconsistent (Enhanced Process Mapping). Check process_name, steps, connections, bottlenecks, optimizations, and kpis. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED Process Mapping JSON using ${MODEL_NAME}. Found ${parsedData.steps.length} steps.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Process Mapping JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Process Mapping): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderProcessMappingPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleProcessMappingAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleParetoFishboneAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Pareto & Fishbone Analysis...</h3>
            <p class="text-white/80 mb-2">Identifying root causes, prioritizing impact, and suggesting actions...</p>
        </div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = $("docUpload").checked;
        let problemContext = "";

        if (useDoc) {
            const file = $("paretoFile").files[0];
            if (!file) throw new Error("Please select a document (.txt, .docx) to upload.");
            problemContext = await extractTextFromFile(file);
        } else {
            problemContext = $("problemStatement").value.trim(); // Use ID from createParetoLayout
            if (!problemContext) throw new Error("Please enter a problem statement or description in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (problemContext.length > MAX_CONTEXT_LENGTH) {
            problemContext = problemContext.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Pareto/Fishbone context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are an expert quality management and process improvement consultant. Analyze the user's provided problem description using the Fishbone (Ishikawa) diagram and Pareto Principle (80/20 rule). Infer plausible causes and impacts based *only* on the context provided. ${truncatedNote}

            **USER'S PROBLEM DESCRIPTION:**
            \`\`\`
            ${problemContext}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Problem Statement:** Clearly define the central \`problem_statement\` being analyzed, derived from the context.
            2.  **Fishbone Analysis:** Identify potential root causes categorized under the 6 standard Ms. For each category (Methods, Machines, Materials, Manpower, Measurement, Environment), list 2-4 specific sub-causes (2-5 words each) *inferred solely from the problem description*. If context doesn't suggest causes for a category, return an empty array for it.
            3.  **Pareto Analysis:** Based *only* on the inferred sub-causes and the problem context:
                * Estimate a plausible relative \`impact_score\` (percentage, summing to 100) for each identified sub-cause, reflecting its likely contribution to the main problem statement based on the context.
                * Categorize these causes into:
                    * \`vital_few\`: The top ~20% of causes contributing to ~80% of the impact. Include cause name, estimated impact_score, and fishbone category.
                    * \`useful_many\`: The remaining causes. Include cause name, estimated impact_score, and fishbone category.
                * Provide an \`analysis_summary\` explaining how the vital few dominate the impact, according to the 80/20 principle, based on your estimations.
            4.  **Action Plan (Focus on Vital Few):** Generate an array of 2-3 structured actions targeting the identified \`vital_few\` causes. For each action:
                * \`target_cause\`: The specific vital few cause being addressed.
                * \`action_suggestion\`: A concrete, actionable step to mitigate this cause (e.g., "Implement standardized training", "Upgrade specific software module").
                * \`rationale\`: Explain *how* this action addresses the target cause, referencing the problem context if possible.
                * \`potential_impact\`: Estimate the potential impact on the main problem (High, Medium, Low).
            5.  **Self-Correction:** Before outputting JSON, rigorously check: Is the problem statement accurate? Are all fishbone sub-causes derived *only* from the text? Are impact scores plausible estimations based on context? Does the Pareto categorization correctly reflect the 80/20 split based on *your estimated scores*? Does the action plan focus *only* on the vital few? Is the JSON structure perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** All analysis (problem, causes, impacts, actions) MUST be based *exclusively* on the USER'S PROBLEM DESCRIPTION. Do NOT invent information.
            - **PLAUSIBLE ESTIMATION:** Impact scores are estimations based on context, not precise calculations, but should be logical and sum to 100.
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys and sub-keys. Use standard 6M fishbone categories.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
            "problem_statement": "e.g., Low Customer Satisfaction Scores",
            "fishbone": {
                "Methods": ["Sub-cause inferred from text 1", "Sub-cause inferred from text 2"],
                "Machines": ["Sub-cause inferred from text 3"],
                "Materials": [], // Example if no context
                "Manpower": ["Sub-cause inferred from text 4", "Sub-cause inferred from text 5"],
                "Measurement": ["Sub-cause inferred from text 6"],
                "Environment": ["Sub-cause inferred from text 7"]
            },
            "pareto_analysis": {
                "vital_few": [ // Top ~20% causes, ~80% impact based on estimations
                {"cause": "Sub-cause inferred from text 4", "impact_score": 45, "category": "Manpower"},
                {"cause": "Sub-cause inferred from text 1", "impact_score": 30, "category": "Methods"}
                ],
                "useful_many": [ // Remaining causes
                {"cause": "Sub-cause inferred from text 6", "impact_score": 10, "category": "Measurement"},
                {"cause": "Sub-cause inferred from text 3", "impact_score": 8, "category": "Machines"},
                {"cause": "Sub-cause inferred from text 2", "impact_score": 5, "category": "Methods"},
                {"cause": "Sub-cause inferred from text 5", "impact_score": 1, "category": "Manpower"},
                {"cause": "Sub-cause inferred from text 7", "impact_score": 1, "category": "Environment"}
                ],
                "analysis_summary": "Explanation of 80/20 finding based on estimations (e.g., 'The analysis suggests that 'Sub-cause 4' and 'Sub-cause 1' collectively account for an estimated 75% of the impact...')"
            },
            "action_plan": [ // Actions targeting ONLY vital_few
                {
                "target_cause": "Sub-cause inferred from text 4",
                "action_suggestion": "e.g., Develop targeted training program",
                "rationale": "Addresses the primary driver identified (Manpower issue mentioned in context) by...",
                "potential_impact": "High"
                },
                {
                "target_cause": "Sub-cause inferred from text 1",
                "action_suggestion": "e.g., Standardize process documentation",
                "rationale": "Tackles the second major contributor (Methods issue described as...) by...",
                "potential_impact": "High"
                }
            ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Pareto/Fishbone prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Pareto/Fishbone):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
            // *** Refined Robust Validation ***
            console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Pareto/Fishbone) ---');
            console.log(JSON.stringify(parsedData, null, 2));
            console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                !parsedData.problem_statement || typeof parsedData.problem_statement !== 'string' ||
                !parsedData.fishbone || typeof parsedData.fishbone !== 'object' || !parsedData.fishbone.Methods || // Check one standard category
                !parsedData.pareto_analysis || typeof parsedData.pareto_analysis !== 'object' ||
                !Array.isArray(parsedData.pareto_analysis.vital_few) || !Array.isArray(parsedData.pareto_analysis.useful_many) || !parsedData.pareto_analysis.analysis_summary ||
                !Array.isArray(parsedData.action_plan) || // Action plan is required, even if empty based on vital_few
                // Check structure of first elements if they exist
                (parsedData.pareto_analysis.vital_few.length > 0 && (typeof parsedData.pareto_analysis.vital_few[0] !== 'object' || !parsedData.pareto_analysis.vital_few[0].hasOwnProperty('cause') || !parsedData.pareto_analysis.vital_few[0].hasOwnProperty('impact_score'))) ||
                (parsedData.action_plan.length > 0 && (typeof parsedData.action_plan[0] !== 'object' || !parsedData.action_plan[0].hasOwnProperty('target_cause') || !parsedData.action_plan[0].hasOwnProperty('rationale')))
                )
            {
                console.error("Validation Failed (Enhanced Pareto/Fishbone): Required fields missing or invalid structure.", parsedData);
                throw new Error(`AI response structure is incorrect or inconsistent (Enhanced Pareto/Fishbone). Check problem, fishbone, pareto (vital/useful/summary), and action_plan. See console logs.`);
            }
            // Simple check on impact scores summing roughly to 100
            const totalScore = [...parsedData.pareto_analysis.vital_few, ...parsedData.pareto_analysis.useful_many].reduce((sum, item) => sum + (item.impact_score || 0), 0);
            if (Math.abs(totalScore - 100) > 5) { // Allow some tolerance
                console.warn(`Pareto impact scores sum to ${totalScore}, not 100.`);
                // Don't throw error, but log it. AI might struggle with perfect sums.
            }

            console.log(`Successfully parsed ENHANCED Pareto/Fishbone JSON using ${MODEL_NAME}. Problem: ${parsedData.problem_statement}.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Pareto/Fishbone JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Pareto/Fishbone): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results using a new dedicated function
        renderParetoFishbonePage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleParetoFishboneAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleSystemThinkingAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white">Analyzing System Dynamics...</h3><p class="text-white/80 mb-2">Identifying elements, loops, and leverage points based on your description...</p></div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = document.querySelector('input[name="inputType"]:checked').id === "docUpload";
        let content = "";
        if (useDoc) {
            const file = $("systemFile").files[0];
            if (!file) throw new Error("Please select a document.");
            content = await extractTextFromFile(file);
        } else {
            content = $("systemContent").value.trim();
            if (!content) throw new Error("Please describe the system.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (content.length > MAX_CONTEXT_LENGTH) {
            content = content.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`System Thinking analysis context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are an expert systems thinking analyst. Analyze the provided system description to identify its underlying structure, feedback loops, and potential leverage points based *only* on the provided text. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION:**
            \`\`\`
            ${content}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Identify Elements (5-7 elements):** Extract key system elements mentioned or clearly implied. For each element:
                * \`name\`: Concise name (2-4 words).
                * \`type\`: Classify as "Stock" (accumulation), "Flow" (rate of change), "Variable" (influencing factor), or "Parameter" (constant/policy) based on context.
            2.  **Identify Feedback Loops (1 Reinforcing, 1 Balancing):** Identify the *primary* reinforcing loop (driving growth/change) and the *primary* balancing loop (limiting/stabilizing) suggested by the text. For each loop:
                * \`name\`: A descriptive name (e.g., "R1: Word of Mouth Growth", "B1: Service Capacity Limit").
                * \`type\`: "Reinforcing" or "Balancing".
                * \`description\`: Explain the causal chain step-by-step, explicitly mentioning how the elements interact (e.g., "Increased [Element A - Stock] leads to higher [Element B - Variable], which accelerates the [Element C - Flow], further increasing [Element A - Stock]").
                * \`elements\`: List the names of the key elements involved in this specific loop.
            3.  **System Behavior Summary:** Provide a concise \`summary\` explaining how the identified reinforcing and balancing loops interact to produce the overall behavior described or implied in the user's text.
            4.  **Identify Leverage Points (2-3 points):** Pinpoint high-leverage points where interventions could significantly alter the system's behavior, based on the loop analysis. For each point:
                * \`point_name\`: Name of the leverage point (often related to an element or connection).
                * \`target_element\`: The specific element the intervention primarily affects.
                * \`intervention\`: A concrete suggested action based on the context.
                * \`expected_impact\`: Describe the intended effect on the feedback loops (e.g., "Strengthens R1 loop by increasing inflow X", "Weakens B1 loop by reducing constraint Y", "Alters goal of B1").
            5.  **Self-Correction:** Before outputting JSON, rigorously check: Are all elements, loops, and leverage points derived *solely* from the text? Are element types correctly classified based on context? Are loop descriptions causally accurate and reference the identified elements? Does the summary explain the loop interplay? Are interventions linked to leverage points and expected impacts clearly stated in terms of loop effects? Is the JSON structure perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** All output MUST be based *exclusively* on the provided SYSTEM DESCRIPTION. Do NOT invent elements, loops, or interventions not supported by the text.
            - **SYSTEMS THINKING PRINCIPLES:** Apply concepts of stocks, flows, feedback loops, and leverage points correctly based on the context.
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys and sub-keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
              "elements": [
                {"name": "Customer Base", "type": "Stock"},
                {"name": "New Customers Rate", "type": "Flow"},
                {"name": "Service Quality", "type": "Variable"},
                {"name": "Support Capacity", "type": "Stock"},
                {"name": "Support Ticket Rate", "type": "Flow"},
                {"name": "Company Policy X", "type": "Parameter"}
              ],
              "feedback_loops": [
                {
                  "name": "R1: Word of Mouth Growth",
                  "type": "Reinforcing",
                  "description": "A larger [Customer Base - Stock] leads to potentially higher [Service Quality - Variable] perceptions (if capacity holds), generating positive word-of-mouth which increases the [New Customers Rate - Flow], further growing the [Customer Base - Stock].",
                  "elements": ["Customer Base", "Service Quality", "New Customers Rate"]
                },
                {
                  "name": "B1: Support Capacity Limit",
                  "type": "Balancing",
                  "description": "A growing [Customer Base - Stock] increases the [Support Ticket Rate - Flow]. If this exceeds [Support Capacity - Stock], [Service Quality - Variable] declines, potentially reducing the [New Customers Rate - Flow] and slowing growth of the [Customer Base - Stock].",
                  "elements": ["Customer Base", "Support Ticket Rate", "Support Capacity", "Service Quality", "New Customers Rate"]
                }
              ],
              "summary": "The system shows potential for reinforcing growth (R1) driven by customer base and quality perception. However, this growth is likely limited by the balancing loop (B1) related to support capacity, which negatively impacts service quality when strained, thus counteracting the growth engine.",
              "leverage_points": [
                {
                  "point_name": "Support Capacity Expansion",
                  "target_element": "Support Capacity",
                  "intervention": "Invest in hiring and training more support staff, or implement tools to increase efficiency, as suggested by the capacity limit bottleneck.",
                  "expected_impact": "Weakens the B1 loop by increasing the threshold at which service quality degrades, allowing the R1 growth loop to operate more effectively for longer."
                },
                {
                  "point_name": "Service Quality Monitoring",
                  "target_element": "Service Quality",
                  "intervention": "Implement real-time monitoring of service quality metrics (e.g., response time, CSAT) mentioned implicitly as important.",
                  "expected_impact": "Provides faster feedback within the B1 loop, allowing quicker adjustments to capacity (part of the intervention for B1) before quality drops significantly, thus stabilizing R1."
                },
                 {
                  "point_name": "Influence Policy X",
                  "target_element": "Company Policy X",
                  "intervention": "Re-evaluate 'Company Policy X' identified in the context to see if it inadvertently constrains growth or capacity.",
                  "expected_impact": "Alters a system parameter, potentially weakening the B1 loop or modifying the goal/speed of the R1 loop depending on the policy's function."
                }
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED System Thinking prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (System Thinking):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced System Thinking) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !Array.isArray(parsedData.elements) || parsedData.elements.length < 3 || // Expect a few elements
                 !Array.isArray(parsedData.feedback_loops) || parsedData.feedback_loops.length < 1 || // Expect at least one loop
                 !parsedData.summary || typeof parsedData.summary !== 'string' ||
                 !Array.isArray(parsedData.leverage_points) || parsedData.leverage_points.length < 1 || // Expect at least one point
                 // Check structure of first elements if they exist
                 (parsedData.elements.length > 0 && (typeof parsedData.elements[0] !== 'object' || !parsedData.elements[0].hasOwnProperty('name') || !parsedData.elements[0].hasOwnProperty('type'))) ||
                 (parsedData.feedback_loops.length > 0 && (typeof parsedData.feedback_loops[0] !== 'object' || !parsedData.feedback_loops[0].hasOwnProperty('name') || !parsedData.feedback_loops[0].hasOwnProperty('description') || !Array.isArray(parsedData.feedback_loops[0].elements))) ||
                 (parsedData.leverage_points.length > 0 && (typeof parsedData.leverage_points[0] !== 'object' || !parsedData.leverage_points[0].hasOwnProperty('point_name') || !parsedData.leverage_points[0].hasOwnProperty('intervention') || !parsedData.leverage_points[0].hasOwnProperty('expected_impact')))
                )
             {
                  console.error("Validation Failed (Enhanced System Thinking): Required fields missing or invalid structure.", parsedData);
                  throw new Error(`AI response structure is incorrect or inconsistent (Enhanced System Thinking). Check elements, loops, summary, and leverage points. See console logs.`);
             }
             console.log(`Successfully parsed ENHANCED System Thinking JSON using ${MODEL_NAME}. Found ${parsedData.elements.length} elements.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED System Thinking JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced System Thinking): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSystemThinkingPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleSystemThinkingAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleLeveragePointsAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Performing Full System Leverage Analysis</h3>
            <p class="text-white/80 mb-2">Identifying elements, feedback loops, and high-impact intervention points...</p> <!-- Updated text -->
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = $("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = $("leverageFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = $("leverageContent").value.trim();
            if (!text.trim()) throw new Error("Please enter system information in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`Leverage Points analysis context truncated.`);
        }


        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are a master systems thinking analyst applying principles similar to Donella Meadows' leverage points hierarchy. Your task is to analyze the provided system description, identify its structure, and pinpoint high-impact leverage points based *only* on the provided text. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Identify Elements (5-7 elements):** Extract key system elements mentioned or clearly implied. For each element:
                * \`name\`: Concise name (2-4 words).
                * \`type\`: Classify as "Stock" (accumulation), "Flow" (rate of change), "Variable" (influencing factor), or "Parameter" (constant/policy) based on context.
            2.  **Identify Feedback Loops (1 Reinforcing, 1 Balancing):** Identify the *primary* reinforcing loop (driving growth/change) and the *primary* balancing loop (limiting/stabilizing) suggested by the text. For each loop:
                * \`name\`: A descriptive name (e.g., "R1: Market Growth Engine", "B1: Resource Constraint").
                * \`type\`: "Reinforcing" or "Balancing".
                * \`description\`: Explain the causal chain step-by-step, explicitly mentioning how the identified elements interact (e.g., "Increased [Element A - Stock] leads to higher [Element B - Variable], which accelerates the [Element C - Flow], further increasing [Element A - Stock]").
                * \`elements\`: List the names of the key elements involved in this specific loop.
            3.  **System Behavior Summary:** Provide a concise \`summary\` explaining how the identified reinforcing and balancing loops interact to produce the overall behavior described or implied in the user's text.
            4.  **Identify Leverage Points (3-4 points, ranked):** Pinpoint high-leverage points where interventions could significantly alter the system's behavior, based *only* on the loop analysis and context. For each point:
                * \`point_name\`: Name of the leverage point (e.g., "Adjusting [Parameter Name]", "Influencing [Variable Name]", "Changing Goal of [Balancing Loop Name]").
                * \`potential_impact_rank\`: Rank the potential impact as "High", "Medium", or "Low" based on systems principles (e.g., changing parameters is often lower leverage than changing goals or loop structure). Provide a brief justification for the rank based on Meadows' concepts if applicable (e.g., "Lower leverage - Parameter Adjustment", "Higher leverage - Goal Change").
                * \`target_element_or_loop\`: The specific element, connection, or loop the intervention primarily affects.
                * \`intervention\`: A concrete suggested action based *only* on the context provided.
                * \`rationale\`: Explain *why* this is a leverage point according to system structure (e.g., "This parameter influences the speed of R1", "This intervention changes the information flow in B1").
                * \`expected_outcome\`: Describe the intended effect on the system's behavior and the identified loops (e.g., "Accelerate growth by strengthening R1", "Stabilize system by reducing oscillations in B1").
            5.  **Self-Correction:** Before outputting JSON, rigorously check: Is everything derived *solely* from the text? Are element types correct? Are loop descriptions causally accurate? Does the summary explain loop interplay? Are leverage points ranked plausibly? Is the intervention rationale clear and linked to system structure/loops? Is the JSON structure perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** All output MUST be based *exclusively* on the provided SYSTEM DESCRIPTION. Do NOT invent information.
            - **SYSTEMS PRINCIPLES:** Apply concepts correctly. Leverage point ranking should generally follow Meadows' hierarchy (changing goals > rules > information > parameters).
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.** Rank leverage points by potential impact (High first).
            {
              "elements": [ /* ... */ ],
              "feedback_loops": [ /* ... */ ],
              "summary": "...",
              "leverage_points": [ // Ranked High -> Low
                {
                  "point_name": "Shift System Goal",
                  "potential_impact_rank": "High - Goal Change", // Justification included
                  "target_element_or_loop": "B1 Loop Goal",
                  "intervention": "Redefine the success metric for support from 'ticket closure rate' to 'customer retention impact', as implied by churn issues.",
                  "rationale": "Changing the goal of a balancing loop is high leverage; it fundamentally alters behavior by shifting focus from speed to quality.",
                  "expected_outcome": "Shift focus towards actions that improve long-term retention (strengthening R1 indirectly) rather than just closing tickets quickly (weakening B1's negative impact)."
                },
                {
                   "point_name": "Improve Information Flow",
                   "potential_impact_rank": "Medium - Information Flow",
                   "target_element_or_loop": "Service Quality -> New Customers Rate Link",
                   "intervention": "Implement proactive communication about quality issues based on real-time monitoring.",
                   "rationale": "Adding timely, accurate information flow allows the system to self-correct faster, dampening oscillations caused by delays in the B1 loop.",
                   "expected_outcome": "Reduce negative word-of-mouth impact by managing expectations, thus stabilizing the R1 loop."
                },
                {
                  "point_name": "Adjust Support Staffing Parameter",
                  "potential_impact_rank": "Low - Parameter Adjustment",
                  "target_element_or_loop": "Support Capacity",
                  "intervention": "Increase the budget parameter for support staff hiring mentioned in the capacity constraint.",
                  "rationale": "Adjusting parameters (like numbers, buffer sizes) is typically lower leverage but directly addresses the B1 constraint.",
                  "expected_outcome": "Increase the threshold of the B1 loop, allowing more growth before quality degrades, weakening B1's limiting effect."
                }
                // ... potentially one more ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Leverage Points prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Leverage Points):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Leverage Points) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !Array.isArray(parsedData.elements) || parsedData.elements.length < 3 ||
                 !Array.isArray(parsedData.feedback_loops) || parsedData.feedback_loops.length < 1 ||
                 !parsedData.summary || typeof parsedData.summary !== 'string' ||
                 !Array.isArray(parsedData.leverage_points) || parsedData.leverage_points.length < 1 ||
                 // Check structure of first elements if they exist
                 (parsedData.elements.length > 0 && (typeof parsedData.elements[0] !== 'object' || !parsedData.elements[0].hasOwnProperty('name') || !parsedData.elements[0].hasOwnProperty('type'))) ||
                 (parsedData.feedback_loops.length > 0 && (typeof parsedData.feedback_loops[0] !== 'object' || !parsedData.feedback_loops[0].hasOwnProperty('name') || !parsedData.feedback_loops[0].hasOwnProperty('description') || !Array.isArray(parsedData.feedback_loops[0].elements))) ||
                 (parsedData.leverage_points.length > 0 && (typeof parsedData.leverage_points[0] !== 'object' || !parsedData.leverage_points[0].hasOwnProperty('point_name') || !parsedData.leverage_points[0].hasOwnProperty('potential_impact_rank') || !parsedData.leverage_points[0].hasOwnProperty('intervention') || !parsedData.leverage_points[0].hasOwnProperty('rationale') || !parsedData.leverage_points[0].hasOwnProperty('expected_outcome')))
                )
             {
                  console.error("Validation Failed (Enhanced Leverage Points): Required fields missing or invalid structure.", parsedData);
                  throw new Error(`AI response structure is incorrect or inconsistent (Enhanced Leverage Points). Check elements, loops, summary, and leverage points structure. See console logs.`);
             }
             // Ensure leverage points are sorted High -> Low (simple check on first element if multiple)
             if (parsedData.leverage_points.length > 1 && parsedData.leverage_points[0].potential_impact_rank?.startsWith('Low')) {
                 console.warn("Leverage points may not be correctly sorted by impact rank.");
             }

             console.log(`Successfully parsed ENHANCED Leverage Points JSON using ${MODEL_NAME}. Found ${parsedData.leverage_points.length} leverage points.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Leverage Points JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Leverage Points): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderLeveragePointsPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleLeveragePointsAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleArchetypeAnalysis() {
    const analysisResultContainer = $("analysisResult");

    analysisResultContainer.innerHTML = `
                <div class="text-center text-white/70 p-8">
                    <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
                    <h3 class="text-xl font-semibold text-white mb-4">Performing System Thinking Analysis</h3>
                    <p class="text-white/80 mb-2">This multi-step process may take several minutes.</p>
                    <p id="analysisStatus" class="text-white/60 text-sm">Initializing...</p>
                </div>`;

    const statusEl = $("analysisStatus");
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        statusEl.textContent = "Reading and processing your document...";
        const useDoc = $("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = $("archetypeFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = $("archetypeContent").value;
            if (!text.trim()) throw new Error("Please enter system information in the text area.");
        }
        if (!text) throw new Error("Could not get text from the document or text area.");

        if (text.length > 3000) text = text.substring(0, 3000);

        async function generateOllamaResponse(prompt) {
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
            if (!response.ok) throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            return JSON.parse(data.response); // Expecting valid JSON now
        }

        // Step 1: Extract Concepts
        statusEl.textContent = "Step 1/3: Extracting key system concepts...";
        const conceptPrompt = `
                    Analyze the following text and extract key 2-4 word concepts. For each concept, provide:
                    1. name (2-4 words)
                    2. description (brief)
                    3. effect ("+", "-", or "0")
                    4. influence ("High", "Medium", or "Low")
                    Text: ${text}
                    Return ONLY a valid JSON object with the structure: {"concepts": [{"name": "...", "description": "...", "effect": "...", "influence": "..."}]}`;
        const conceptData = await generateOllamaResponse(conceptPrompt);
        const concepts = conceptData.concepts;
        if (!concepts || concepts.length === 0) throw new Error("No concepts were extracted from the document.");

        // Step 2: Identify Archetypes
        statusEl.textContent = "Step 2/3: Identifying relevant system archetypes...";
        const conceptText = concepts.map((c) => c.name).join(", ");
        const archetypePrompt = `
                    You are a system thinking expert. Analyze the provided text and the key concepts extracted from it to identify the single most fitting system archetype.

                    **System Description/Text:**
                    ${text}

                    **Key Concepts:**
                    [${conceptText}]

                    **Task:**
                    From the list of common archetypes below, select the ONE that best explains the dynamics described in the text.
                    - **Success to the Successful:** One entity gets more resources, which it uses to perform better and get even more resources, starving competitors.
                    - **Limits to Growth:** A reinforcing process of growth eventually meets a balancing process that slows or stops the growth.
                    - **Shifting the Burden:** A short-term solution is used to correct a problem, but it undermines the ability of the system to use a more fundamental, long-term solution.
                    - **Tragedy of the Commons:** Individuals use a shared resource in their own self-interest, leading to its depletion.
                    - **Fixes that Fail:** A fix is applied to a problem that has immediate positive results but unforeseen long-term negative consequences.

                    **Analysis & Response:**
                    Based on the text and concepts, provide a JSON response with the following structure. The description MUST explain *why* the chosen archetype fits the specific situation described in the text.

                    Return ONLY a valid JSON object:
                    {
                        "archetypes": [{
                        "name": "Name of the chosen archetype (e.g., Success to the Successful)",
                        "relevance_score": 10,
                        "description": "A detailed explanation of how the dynamics in the provided text perfectly match the chosen archetype. Reference the key concepts.",
                        "leverage_points": ["Specific leverage point 1", "Specific leverage point 2"],
                        "interventions": ["Specific intervention 1", "Specific intervention 2"]
                        }]
                    }`;
        const archetypeData = await generateOllamaResponse(archetypePrompt);
        let archetypes = archetypeData.archetypes;

        archetypes.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
        const topArchetypeCount = Math.max(1, Math.floor(archetypes.length * 0.2));
        const topArchetypes = archetypes.slice(0, topArchetypeCount);

        // --- MODIFICATION START ---
        // Step 3: Analyze Leverage Points with enhanced context-aware prompt
        statusEl.textContent = "Step 3/3: Analyzing high-impact leverage points...";
        const leveragePrompt = `
                    You are a systems thinking strategist. Your task is to identify the most effective leverage point to overcome the central problem described in the provided text.

                    **Context:**
                    The text describes a 'Limits to Growth' situation. The company's growth, driven by its "Direct-to-Consumer Model," has hit a limit, causing sales stagnation.
                    The **primary strategic goal** is to break this limit by diversifying sales channels and entering physical retail stores.

                    **Key Concepts Extracted from the Text:**
                    [${conceptText}]

                    **Task:**
                    From the list of key concepts, identify the single concept that represents the **most powerful solution or intervention** to achieve the strategic goal of successful retail expansion.

                    **CRITICAL INSTRUCTION:** Do NOT select a concept that represents the problem (e.g., 'Direct-to-Consumer Model', 'Scalability and Growth Limitations'). You must select the concept that represents the **SOLUTION**.

                    Provide your response as a valid JSON object with the following structure:
                    {
                        "leverage_points": [{
                        "concept": "The name of the concept that is the best leverage point",
                        "score": 10,
                        "reasoning": "Explain WHY this concept is the key to overcoming the DTC limitation and achieving the retail expansion goal, based on the text.",
                        "actions": ["Action 1 related to the solution", "Action 2 related to the solution", "Action 3 related to the solution"],
                        "impact": "High"
                        }]
                    }`;
        // --- MODIFICATION END ---
        const leverageData = await generateOllamaResponse(leveragePrompt);
        let leveragePoints = leverageData.leverage_points;

        leveragePoints.sort((a, b) => (b.score || 0) - (a.score || 0));
        const topLeverageCount = Math.max(1, Math.floor(leveragePoints.length * 0.2));
        const topLeveragePoints = leveragePoints.slice(0, topLeverageCount);

        // Final step: Render the full page
        statusEl.textContent = "Analysis complete! Rendering results...";
        renderArchetypeAnalysisPage(analysisResultContainer, {
            concepts,
            topArchetypes,
            topLeveragePoints
        });
    } catch (error) {
        console.error("Error during Archetype analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}<br><br><span class="text-sm text-white/60">Please ensure your Ollama server is running and accessible at ${OLLAMA_URL}.</span></div>`;
    } finally {
        setLoading("generate", false);
    }
}



async function handleSystemGoalsAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Formulating System-Aware Goals & Initiatives</h3>
            <p class="text-white/80 mb-2">Analyzing feedback loops to identify strategic interventions based on your input...</p> <!-- Updated text -->
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model


    try {
        // 1. Gather Inputs
        const useDoc = $("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = $("systemGoalsFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = $("systemGoalsContent").value.trim();
            if (!text.trim()) throw new Error("Please enter system information and desired outcome in the text area.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`System Goals analysis context truncated.`);
        }

        // 2. Construct ENHANCED Prompt
        const prompt = `
            You are a senior strategic consultant specializing in applying systems thinking to business goals. Based *only* on the provided system description and desired outcome, formulate a high-level system goal and develop strategic initiatives grounded in feedback loop analysis. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION & GOAL CONTEXT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Define System Goal:** Refine the user's input into a single, concise, measurable \`system_goal\` (SMART goal if possible).
            2.  **Identify Key Loops:** Based *only* on the text, identify the primary \`reinforcing_loop\` (driving towards the goal) and the primary \`balancing_loop\` (hindering or limiting the goal). For each loop:
                * \`name\`: Descriptive name (e.g., "R1: Customer Growth Engine").
                * \`description\`: Explain the causal chain step-by-step, explicitly mentioning elements from the text.
                * \`elements\`: List key elements from the text involved in this loop.
            3.  **Develop Strategic Initiatives (2-3 initiatives):** Create initiatives to achieve the goal by manipulating the identified loops. For each initiative:
                * \`initiative_name\`: Clear, action-oriented name.
                * \`rationale\`: Explain *specifically* how this initiative manipulates the loops (e.g., "Strengthens R1 by enhancing [Element X]", "Weakens B1 by addressing [Element Y constraint mentioned in text]"). Must be grounded in the text.
                * \`objectives\`: List 2-3 specific, actionable objectives for this initiative based on the context.
                * \`kpis\`: List 2-3 specific KPIs to track the success of this initiative, relevant to the objectives and context.
            4.  **Self-Correction:** Rigorously check: Is the goal derived solely from input? Are loops and elements accurately extracted from text? Does initiative rationale *explicitly* reference loop manipulation based on text? Are objectives/KPIs context-specific? Is JSON structure perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** All output MUST be based *exclusively* on the provided text. Do NOT invent information.
            - **LOOP MANIPULATION RATIONALE:** Initiative rationale MUST explain how it targets the identified loops based on text evidence.
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
              "system_goal": "Increase the customer retention rate from X% to Y% within 18 months, based on the described churn problem.",
              "key_loops": {
                "reinforcing_loop": {
                  "name": "R1: Customer Loyalty Loop",
                  "description": "High product quality mentioned in text leads to greater customer satisfaction, driving positive word-of-mouth and repeat purchases, growing the loyal customer base.",
                  "elements": ["Product Quality", "Customer Satisfaction", "Word-of-Mouth", "Repeat Purchases", "Loyal Customer Base"]
                },
                "balancing_loop": {
                  "name": "B1: Support Strain Loop",
                  "description": "As the customer base grows (mentioned implicitly), support ticket volume increases. Text implies support capacity is limited, causing service quality to drop, leading to frustration and churn, limiting growth.",
                  "elements": ["Customer Base", "Support Tickets", "Support Capacity", "Service Quality", "Churn Rate"]
                }
              },
              "strategic_initiatives": [
                {
                  "initiative_name": "Proactive Quality & Success",
                  "rationale": "Strengthens the R1 'Loyalty Loop' by directly improving 'Product Quality' and 'Customer Satisfaction' mentioned as drivers, while weakening B1 by reducing the 'Support Tickets' flow arising from issues.",
                  "objectives": [
                    "Implement predictive analytics (based on described data) to identify at-risk customers with 90% accuracy.",
                    "Reduce critical bug reports mentioned by 50% via improved QA.",
                    "Launch targeted onboarding for features users struggle with (per text)."
                  ],
                  "kpis": ["Customer Retention Rate", "CSAT Score", "Support Ticket Volume"]
                },
                {
                  "initiative_name": "Scale Support Infrastructure",
                  "rationale": "Directly addresses the limiting factor ('Support Capacity') in the B1 'Support Strain Loop' identified from the text, allowing R1 to function more effectively.",
                  "objectives": [
                    "Decrease average support resolution time by 40% (addressing 'frustration' mentioned).",
                    "Implement AI knowledge base (leveraging 'mentioned data') to deflect 25% common queries."
                  ],
                  "kpis": ["Average Resolution Time", "First Contact Resolution Rate", "Knowledge Base Usage"]
                }
                // ... potentially one more ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED System Goals prompt to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (System Goals):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced System Goals) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.system_goal || typeof parsedData.system_goal !== 'string' ||
                 !parsedData.key_loops || typeof parsedData.key_loops !== 'object' ||
                 !parsedData.key_loops.reinforcing_loop || typeof parsedData.key_loops.reinforcing_loop !== 'object' || !parsedData.key_loops.reinforcing_loop.name ||
                 !parsedData.key_loops.balancing_loop || typeof parsedData.key_loops.balancing_loop !== 'object' || !parsedData.key_loops.balancing_loop.name ||
                 !Array.isArray(parsedData.strategic_initiatives) || parsedData.strategic_initiatives.length < 1 || // Expect at least one initiative
                 // Check structure of first initiative
                 (parsedData.strategic_initiatives.length > 0 && (
                     typeof parsedData.strategic_initiatives[0] !== 'object' ||
                     !parsedData.strategic_initiatives[0].hasOwnProperty('initiative_name') ||
                     !parsedData.strategic_initiatives[0].hasOwnProperty('rationale') ||
                     !Array.isArray(parsedData.strategic_initiatives[0].objectives) ||
                     !Array.isArray(parsedData.strategic_initiatives[0].kpis)
                 ))
               )
            {
                 console.error("Validation Failed (Enhanced System Goals): Required fields missing or invalid structure.", parsedData);
                 throw new Error(`AI response structure is incorrect or inconsistent (Enhanced System Goals). Check goal, loops, and initiatives structure. See console logs.`);
            }
             console.log(`Successfully parsed ENHANCED System Goals JSON using ${MODEL_NAME}. Found ${parsedData.strategic_initiatives.length} initiatives.`);


        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED System Goals JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced System Goals): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderSystemGoalsPage(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleSystemGoalsAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleSystemObjectivesAnalysis_ST() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Analyzing System Dynamics...</h3><p class="text-white/80 mb-2">Formulating objectives based on feedback loops...</p></div>`;

    try {
        const useDoc = $("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = $("systemObjFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = $("systemObjContent").value;
            if (!text.trim()) throw new Error("Please describe your system and goal.");
        }
        if (text.length > 15000) {
            text = text.substring(0, 15000);
        }

        const prompt = `
                    You are a systems thinking strategist. A user has described a system and a desired outcome. Your task is to structure an OGSI (Objective, Goals, Strategies, Initiatives) plan that is explicitly based on the system's feedback loops.

                    **System Context:**
                    ${text}

                    **TASK:**
                    Analyze the context and generate a complete OGSI plan.

                    1.  **main_objective**: Refine the user's input into a single, high-level, aspirational Objective.
                    2.  **feedback_loops**: Identify the most critical 'reinforcing_loop' (growth engine) and 'balancing_loop' (limiting factor) that affect the objective.
                    3.  **goals**: Define 2-3 specific, measurable Goals that contribute to the main objective.
                    4.  **strategies_and_initiatives**: An array where each item links a Goal to a system-aware Strategy and concrete Initiatives. For each item:
                        - "goal": The name of the goal it addresses.
                        - "strategy": A specific strategy designed to either **amplify the reinforcing loop** or **weaken the balancing loop**. The rationale must be explicit about this.
                        - "initiatives": An array of 2-3 specific action items to execute the strategy.
                        - "kpis": A list of 2-3 KPIs to track the success of the initiatives.

                    Return ONLY a valid JSON object with this exact structure:
                    {
                        "main_objective": "Transform our platform from a simple tool into a highly engaging, self-reinforcing ecosystem.",
                        "feedback_loops": {
                        "reinforcing_loop": "The 'Network Effect Loop': More active users create more valuable content, which attracts more new users, further increasing activity and value.",
                        "balancing_loop": "The 'New User Confusion Loop': A rapid influx of new users who don't understand the platform leads to low-quality contributions and clutters the experience for existing users, causing churn."
                        },
                        "goals": ["Increase Daily Active Users (DAU) by 50%", "Increase User-Generated Content by 100%"],
                        "strategies_and_initiatives": [
                        {
                            "goal": "Increase Daily Active Users (DAU) by 50%",
                            "strategy": "Amplify the 'Network Effect Loop' by making high-quality content more discoverable and rewarding its creators.",
                            "initiatives": [
                            "Develop a new content recommendation algorithm.",
                            "Launch a 'Top Creator of the Week' feature with platform-wide visibility.",
                            "Implement a user-friendly onboarding tutorial."
                            ],
                            "kpis": ["Daily Active Users", "Average Session Duration", "Content Share Rate"]
                        },
                        {
                            "goal": "Increase User-Generated Content by 100%",
                            "strategy": "Weaken the 'New User Confusion Loop' by improving the quality of first-time contributions and reducing friction for new creators.",
                            "initiatives": [
                            "Introduce content creation templates for new users.",
                            "Create a mentorship program pairing new users with experienced 'superusers'.",
                            "Gamify the content creation process with badges and rewards."
                            ],
                            "kpis": ["New Content Submissions per Day", "First-to-Second Post Conversion Rate", "User Retention Rate (30-day)"]
                        }
                        ]
                    }
                `;

        const response = await fetch("https://ollama.data2int.com/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.1:latest",
                prompt: prompt,
                stream: false,
                format: "json",
                options: { num_ctx: 32768 }
            })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        const parsedData = JSON.parse(data.response);
        renderSystemObjectivesPage_ST(analysisResultContainer, parsedData);
    } catch (error) {
        console.error("Error during System Objectives analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}</div>`;
    } finally {
        setLoading("generate", false);
    }
}



async function handleSystemActionsAnalysis_ST() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Diagnosing System Behavior & Formulating Actions...</h3><p class="text-white/80 mb-2">Generating analysis strictly based on your provided context...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = $("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = $("systemActionFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = $("systemActionContent").value.trim();
            if (!text.trim()) throw new Error("Please describe the system problem.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`System Actions analysis context truncated.`);
        }

        // 2. Construct REFINED Prompt with STRONGER Context Grounding & ACTION CLASSIFICATION Rules
        const prompt = `
            You are an expert systems thinking consultant. A user has described a recurring problem or strategic initiative. Analyze it based **ONLY** on the provided text to diagnose the underlying system structure (archetype, if applicable) and prescribe **context-specific** actions, correctly classifying them as short-term fixes or long-term solutions based *only* on the text provided. ${truncatedNote}

            **USER'S SYSTEM PROBLEM/INITIATIVE DESCRIPTION:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS:**
            1.  **Diagnose Problem/Goal:** Provide a concise, one-sentence \`problem_diagnosis\` stating the core systemic issue or goal described **in the user's text**.
            2.  **Identify Archetype (If Applicable):** Identify the single most likely \`system_archetype\` (e.g., "Limits to Growth", "Shifting the Burden", etc.) evident **in the user's text**, *only if a clear recurring problem pattern is described*. If the text describes a *proactive initiative* rather than a problem cycle, state "Proactive Initiative - No Archetype" for the name. Include:
                * \`name\`: The archetype name or "Proactive Initiative - No Archetype".
                * \`explanation\`: Detail *how* this archetype manifests **in the user's specific situation**, referencing elements **from the text** OR explain why it's a proactive initiative based on the text. Include reinforcing/balancing loops *if identifiable from the text*.
            3.  **Identify Leverage Points (2-3):** Based **only** on the analysis and **the user's text**, identify specific \`leverage_points\` (key areas for intervention) described or implied **in the text**.
            4.  **Prescribe Actions (3-4 actions):** Develop an array of recommended \`actions\` derived **solely from the user's text and the identified leverage points/goal**. For each action:
                * \`action_name\`: Clear, actionable name (under 10 words) **taken directly from or summarizing actions mentioned in the user's text**.
                * \`type\`: Classify strictly as "Short-Term Fix" or "Long-Term Solution". **CRUCIAL RULE:** Base this classification **ONLY** on the user's text.
                    * If the text describes the action as addressing an immediate symptom, a temporary measure, or a quick patch -> "Short-Term Fix".
                    * If the text describes the action as part of a fundamental change, addressing a root cause, building new capabilities for a strategic goal, or having lasting impact -> "Long-Term Solution". (e.g., Building necessary infrastructure like logistics for a *new strategic direction* described in the text is "Long-Term Solution").
                * \`rationale\`: Explain *how* this action addresses a specific leverage point or contributes to the goal, **using evidence and reasoning found ONLY within the user's text**. Justify the 'type' classification based on the text.
                * \`impact\`: Estimated potential impact ("High", "Medium", "Low") **based on importance stated or implied in the text**.
                * \`effort\`: Estimated implementation effort ("High", "Medium", "Low") **based on complexity described or implied in the text**.
                * \`kpis\`: List 2-3 specific KPIs **mentioned in, implied by, or logically derived ONLY from the user's text** to track this action's success.
            5.  **Self-Correction:** Rigorously check: Is every detail (diagnosis, archetype, leverage points, action names, **action types**, rationales, KPIs) **strictly derived ONLY from the user's text**? Is the archetype choice (or lack thereof) justified **by text evidence**? Is the **action type classification strictly following the rule based on the text's description of the action's purpose/duration**? Is rationale grounded **only in text**? Is JSON perfect? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT IS KING:** All output MUST be based **EXCLUSIVELY** on the provided "USER'S SYSTEM PROBLEM/INITIATIVE DESCRIPTION". **DO NOT** invent information.
            - **ACTION TYPE ACCURACY:** The classification of "Short-Term Fix" vs. "Long-Term Solution" **MUST strictly reflect how the action is described or purposed within the user's text**, following the rule above. Building foundational capabilities for a long-term goal described in the text is LONG-TERM.
            - **NO GENERIC EXAMPLES:** **DO NOT** use the placeholder content in the RETURN FORMAT structure below. Replace ALL placeholder text with content generated **strictly from the user's input text**.
            - **JSON FORMAT:** Adhere EXACTLY.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text and the action classification rule.
            {
              "problem_diagnosis": "[Concise diagnosis/goal derived ONLY from user text]",
              "system_archetype": {
                "name": "[Archetype name or 'Proactive Initiative - No Archetype' identified ONLY from user text]",
                "explanation": "[Detailed explanation linking archetype/initiative ONLY to user's text/concepts, including loops derived ONLY from text if applicable...]",
                "leverage_points": [ // Points derived ONLY from user text/analysis
                    {"point": "[Leverage point derived ONLY from user text]"},
                    {"point": "[Another leverage point derived ONLY from user text]"}
                 ]
              },
              "actions": [ // MUST derive actions ONLY from user text
                {
                  "action_name": "[Action Name derived ONLY from user text]",
                  "type": "[Short-Term Fix or Long-Term Solution based ONLY on text description/purpose rule]",
                  "rationale": "[Rationale linking action using ONLY user text evidence, justifying type classification based on text...]",
                  "impact": "[High/Medium/Low based ONLY on context]",
                  "effort": "[High/Medium/Low based ONLY on context]",
                  "kpis": ["[KPI derived ONLY from context 1]", "[KPI derived ONLY from context 2]"]
                },
                {
                  "action_name": "[Another Action Name derived ONLY from user text]",
                  "type": "[Short-Term Fix or Long-Term Solution based ONLY on text description/purpose rule]",
                  "rationale": "[Rationale linking action using ONLY user text evidence, justifying type classification based on text...]",
                  "impact": "[High/Medium/Low based ONLY on context]",
                  "effort": "[High/Medium/Low based ONLY on context]",
                  "kpis": ["[KPI derived ONLY from context 3]", "[KPI derived ONLY from context 4]"]
                }
                // ... potentially 1-2 more actions derived ONLY from context ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending REFINED Context-Focused System Actions prompt (v2) to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (System Actions - Refined Prompt v2):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Use the SAME Robust Validation as before, checking placeholders and structure ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Refined System Actions v2) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData || typeof parsedData !== 'object' ||
                 !parsedData.problem_diagnosis || typeof parsedData.problem_diagnosis !== 'string' || parsedData.problem_diagnosis.includes("[") ||
                 !parsedData.system_archetype || typeof parsedData.system_archetype !== 'object' ||
                 !parsedData.system_archetype.name || parsedData.system_archetype.name.includes("[") ||
                 !parsedData.system_archetype.explanation || parsedData.system_archetype.explanation.includes("[") ||
                 !Array.isArray(parsedData.system_archetype.leverage_points) ||
                 !Array.isArray(parsedData.actions) || parsedData.actions.length < 1 ||
                  (parsedData.actions.length > 0 && (
                      typeof parsedData.actions[0] !== 'object' ||
                      !parsedData.actions[0].hasOwnProperty('action_name') || parsedData.actions[0].action_name.includes("[") ||
                      !parsedData.actions[0].hasOwnProperty('type') || !['Short-Term Fix', 'Long-Term Solution'].includes(parsedData.actions[0].type) ||
                      !parsedData.actions[0].hasOwnProperty('rationale') || parsedData.actions[0].rationale.includes("[") ||
                      !parsedData.actions[0].hasOwnProperty('impact') ||
                      !parsedData.actions[0].hasOwnProperty('effort') ||
                      !Array.isArray(parsedData.actions[0].kpis) || (parsedData.actions[0].kpis.length > 0 && parsedData.actions[0].kpis[0].includes("["))
                  ))
                )
             {
                  console.error("Validation Failed (Refined System Actions v2): Required fields missing, invalid structure, or placeholders detected.", parsedData);
                  throw new Error(`AI response structure is incorrect, inconsistent, or contains placeholders (Refined System Actions v2). Check all fields carefully. See console logs.`);
             }

             console.log(`Successfully parsed REFINED System Actions JSON (v2) using ${MODEL_NAME}. Found archetype/status: ${parsedData.system_archetype.name}.`);

        } catch (e) {
            console.error(`Failed to parse/validate REFINED System Actions JSON (v2) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Refined System Actions v2): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results (Using the existing renderer)
        renderSystemActionsPage_ST(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleSystemActionsAnalysis_ST (Refined v2) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}

export {
    handleProcessMappingAnalysis,
    handleParetoFishboneAnalysis,
    handleSystemThinkingAnalysis,
    handleLeveragePointsAnalysis,
    handleArchetypeAnalysis,
    handleSystemGoalsAnalysis,
    handleSystemObjectivesAnalysis_ST,
    handleSystemActionsAnalysis_ST
}