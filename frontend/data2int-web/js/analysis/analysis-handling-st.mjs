// =====================================================================================================
// ===================         Systems Thinking Analysis Handling Functions         ====================
// =====================================================================================================

import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import { fetchOllama, fetchGroq, fetchLLM } from './analysis-helpers.mjs';
import * as renderST from '../ui/analysis-rendering/analysis-rendering-st.mjs';

async function handleProcessMappingAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
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
            const file = dom.$("processFile").files[0];
            if (!file) throw new Error("Please select a document.");
            content = await extractTextFromFile(file);
        } else {
            content = dom.$("processContent").value.trim();
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
        renderST.renderProcessMappingPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleProcessMappingAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleParetoFishboneAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
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
        const useDoc = dom.$("docUpload").checked;
        let problemContext = "";

        if (useDoc) {
            const file = dom.$("paretoFile").files[0];
            if (!file) throw new Error("Please select a document (.txt, .docx) to upload.");
            problemContext = await extractTextFromFile(file);
        } else {
            problemContext = dom.$("problemStatement").value.trim(); // Use ID from createParetoLayout
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
        renderST.renderParetoFishbonePage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleParetoFishboneAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleSystemThinkingAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Analyzing System Context...</h3>
            <p class="text-white/80 mb-2">Reading and interpreting your provided text...</p>
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    let text = "";
    let truncatedNote = "";

    try {
        // 1. Gather Inputs
        const useDoc = document.querySelector('input[name="inputType"]:checked').id === "docUpload";
        if (useDoc) {
            const file = dom.$("systemFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("systemContent").value.trim();
            if (!text.trim()) throw new Error("Please describe the system.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`System Thinking analysis context truncated.`);
        }

        // 2. --- STEP 2: Run the NEW, ROBUST Unified Prompt ---
        analysisResultContainer.querySelector("p").textContent = "Running unified analysis...";
        
        // This new prompt has explicit if-then logic to check for research plans first.
        const analysis_prompt = `
            You are a master systems thinking analyst. Your task is to intelligently analyze the provided text and extract its systemic components.
            Base ALL output EXCLUSIVELY on the provided text. Do not invent information. ${truncatedNote}

            **USER'S TEXT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS (Follow this order):**

            **Task 1: Determine Text Intent.**
            First, read the text to determine its intent.
            - Is it a **Research Plan** (contains "hypothesis", "H1:", "H2:", "constructs", "research study", "SEM analysis", "drivers of")?
            - OR is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
            - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

            **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

            **IF IT IS A RESEARCH PLAN (like the 'E-Commerce Customer Experience Research Study'):**
                - You MUST return \`feedback_loops: []\`.
                - You MUST return \`system_archetype: null\`.
                - You MUST return \`leverage_points: null\`.
                - You MUST populate \`elements\` with the constructs (e.g., "Service Quality", "Customer Satisfaction").
                - You MUST populate \`causal_links\` from the hypotheses (e.g., "H1: Service Quality...").
                - You MUST populate \`focus_areas\` from the "Research Objectives" or "Expected Business Impact" sections.
            
            **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
                - You MUST populate \`feedback_loops\` with any R/B loops you find.
                - You MUST populate \`system_archetype\` (e.g., "Limits to Growth").
                - You MUST populate \`leverage_points\` with interventions.
                - You MUST return \`focus_areas: null\`.
                - You MUST populate \`causal_links\` from the loops.
            
            **IF IT IS UNANALYZABLE:**
            1.  **Elements (\`elements\`):** This MUST be an empty array [].
            2.  **Feedback Loops (\`feedback_loops\`):** This MUST be an empty array [].
            3.  **Summary (\`summary\`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a [poem/story/etc.] and does not contain analyzable system components...").
            4.  **Causal Links (\`causal_links\`):** This MUST be an empty array [].
            5.  **System Archetype (\`system_archetype\`):** This MUST be null.
            6.  **Leverage Points (\`leverage_points\`):** This MUST be null.
            7.  **Focus Areas (\`focus_areas\`):** This MUST be null.

            **Task 3: Extract Components (Strictly from text):**
            1.  \`summary\`: A concise summary explaining *what the text is* and its main objective (or the error message if unanalyzable).
            2.  \`elements\`: Extract 5-8 key elements/constructs (or [] if unanalyzable). For each:
                * \`name\`: Concise name (e.g., "Service Quality").
                * \`type\`: Classify as "Stock" (an accumulation, e.g., "Brand Trust") or "Variable" (a factor, e.g., "Service Quality").
            3.  \`feedback_loops\`: (See Task 2).
            4.  \`causal_links\`: List ALL 1-to-1 causal links *stated in the text* (or [] if unanalyzable). For each:
                * \`from\`: Cause element.
                * \`to\`: Effect element.
                * \`polarity\`: "+" or "-".
                * \`loop_name\`: Loop name (e.g., "R1") or "H" (for Hypothesis).
                * \`description\`: The rationale/hypothesis from the text (e.g., "H1: ...").
            5.  \`system_archetype\`: (See Task 2).
            6.  \`leverage_points\`: (See Task 2).
            7.  \`focus_areas\`: (See Task 2).

            **RETURN FORMAT (Example for Unanalyzable Text):**
            {
                "summary": "The provided text could not be analyzed. It appears to be a shopping list and does not contain any system elements, problems, or research hypotheses.",
                "elements": [],
                "feedback_loops": [],
                "causal_links": [],
                "system_archetype": null,
                "leverage_points": null,
                "focus_areas": null
            }
        `;

        // 3. Send the chosen analysis prompt
        const analysis_response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: analysis_prompt,
                stream: false,
                format: "json",
                options: {
                    num_ctx: 32768
                }
            })
        });

        if (!analysis_response.ok) throw new Error(`AI Analysis Error: ${analysis_response.statusText}`);

        const analysis_data = await analysis_response.json();
        const finalParsedData = JSON.parse(analysis_data.response);

        // 4. --- STEP 3: Render ---
        analysisResultContainer.querySelector("p").textContent = "Step 3/3: Assembling analysis...";

        // *** Validation for the final data (flexible) ***
        if (!finalParsedData || !finalParsedData.summary || !finalParsedData.elements || !finalParsedData.causal_links ||
            (finalParsedData.system_archetype === undefined && finalParsedData.focus_areas === undefined)
        ) {
            console.error("Validation Failed (Unified Handler): Final analysis data is missing key components.", finalParsedData);
            throw new Error("AI response was incomplete. Missing summary, elements, or focus/leverage points.");
        }

        console.log("Successfully parsed unified analysis JSON:", finalParsedData);

        // 5. Render Results
        renderST.renderSystemThinkingPage(analysisResultContainer, finalParsedData); // Call the flexible renderer

    } catch (error) {
        console.error(`Error in handleSystemThinkingAnalysis (Unified v4):`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleLeveragePointsAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Performing Full System Leverage Analysis</h3>
            <p class="text-white/80 mb-2">Identifying elements, feedback loops, and high-impact intervention points...</p>
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = dom.$("leverageFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("leverageContent").value.trim();
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


        // 2. --- NEW ENHANCED PROMPT (v3 with UNANALYZABLE path) ---
        const prompt = `
            You are a master systems thinking analyst. Your task is to analyze the provided text, determine its intent, and identify its key leverage points based *only* on the provided text. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS (Follow this order):**

            **Task 1: Determine Text Intent.**
            First, read the text to determine its intent.
            - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
            - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
            - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

            **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

            **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
            1.  **Elements (\`elements\`):** Extract 5-7 key elements (Stocks, Flows, Variables).
            2.  **Feedback Loops (\`feedback_loops\`):** Identify the 1-2 primary Reinforcing and Balancing loops *described in the text*.
            3.  **Summary (\`summary\`):** Summarize the dynamic problem caused by the loop interactions.
            4.  **Leverage Points (\`leverage_points\`):** Identify 3-4 *interventions* to fix or influence the loops. Rank them by "High", "Medium", "Low" impact. For each:
                * \`point_name\`: Name of the intervention (e.g., "Adjust Support Staffing").
                * \`potential_impact_rank\`: "High", "Medium", or "Low".
                * \`intervention\`: The specific action (e.g., "Increase budget parameter...").
                * \`rationale\`: How it fixes the loop (e.g., "Weakens B1 constraint...").
                * \`expected_outcome\`: The expected result (e.g., "Allow more growth...").

            **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):**
            1.  **Elements (\`elements\`):** Extract the 5-7 key services, features, or differentiators as "Variable" or "Stock" elements (e.g., "AI-driven investment advisory", "NexaScore AI engine").
            2.  **Feedback Loops (\`feedback_loops\`):** This MUST be an empty array [].
            3.  **Summary (\`summary\`):** A simple 1-sentence description of the company (e.g., "NexaFlow Capital is a FinTech...").
            4.  **Leverage Points (\`leverage_points\`):** Identify the 3-4 most important **"Differentiators"** or **"Core Services"** listed. These are the leverage points.
                * \`point_name\`: The name of the differentiator (e.g., "NexaScore AI engine").
                * \`potential_impact_rank\`: "High" (for differentiators) or "Medium" (for core services).
                * \`target_element_or_loop\`: The name of the element itself (e.g., "NexaScore AI engine").
                * \`intervention\`: An action to *amplify* this strength (e.g., "Enhance and scale the NexaScore AI engine").
                * \`rationale\`: Why this is a key strategic advantage (e.g., "This is a proprietary asset that provides a competitive edge...").
                * \`expected_outcome\`: The business result of amplifying it (e.g., "Increase market share and solidify position...").
            
            **IF IT IS UNANALYZABLE:**
            1.  **Elements (\`elements\`):** This MUST be an empty array [].
            2.  **Feedback Loops (\`feedback_loops\`):** This MUST be an empty array [].
            3.  **Summary (\`summary\`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a [poem/story/etc.] and does not contain analyzable system components...").
            4.  **Leverage Points (\`leverage_points\`):** This MUST be an empty array [].
            
            **ABSOLUTE CONSTRAINTS:**
            - STICK TO THE TEXT. Do NOT invent information.
            - If the text is descriptive, DO NOT invent feedback loops.
            - JSON format must be perfect.

            **RETURN FORMAT (Example for a Descriptive Profile):**
            {
                "elements": [
                {"name": "AI-driven investment advisory", "type": "Variable"},
                {"name": "NexaScore AI engine", "type": "Variable"},
                {"name": "Blockchain-audited trails", "type": "Variable"}
                ],
                "feedback_loops": [],
                "summary": "NexaFlow Capital is a digital-first financial services company offering AI-driven investment advisory...",
                "leverage_points": [
                {
                    "point_name": "Proprietary NexaScore AI engine",
                    "potential_impact_rank": "High",
                    "target_element_or_loop": "NexaScore AI engine",
                    "intervention": "Enhance and scale the NexaScore AI engine",
                    "rationale": "This is a key proprietary differentiator that provides a significant competitive advantage in real-time credit scoring.",
                    "expected_outcome": "Solidify market leadership and attract more SME lending clients."
                },
                {
                    "point_name": "Blockchain-audited transaction trails",
                    "potential_impact_rank": "Medium",
                    "target_element_or_loop": "Blockchain-audited trails",
                    "intervention": "Market the transparency of blockchain-audited trails",
                    "rationale": "This feature directly addresses the 'unprecedented transparency' value proposition.",
                    "expected_outcome": "Increase trust and adoption of DeFi payment services."
                }
                ]
            }
        `;
        // --- END OF NEW PROMPT ---

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Leverage Points prompt (v3) to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (Leverage Points):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
            // *** Refined Robust Validation ***
            console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Leverage Points v3) ---');
            console.log(JSON.stringify(parsedData, null, 2));
            console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                !Array.isArray(parsedData.elements) ||
                !Array.isArray(parsedData.feedback_loops) || // Must be an array, even if empty
                !parsedData.summary || typeof parsedData.summary !== 'string' ||
                !Array.isArray(parsedData.leverage_points) || // Must be an array, even if empty
                
                // Check for invalid state: must have leverage points IF elements exist
                (parsedData.elements.length > 0 && parsedData.leverage_points.length < 1) ||
                
                // Check for valid state: must have NO leverage points IF elements are empty
                (parsedData.elements.length === 0 && parsedData.leverage_points.length > 0)
            ) {
                // This logic handles the "Unanalyzable" case (elements: [], leverage_points: []) as VALID
                // But flags a case where AI finds elements but fails to find leverage points.
                if (parsedData.elements.length > 0 && parsedData.leverage_points.length < 1) {
                        console.error("Validation Failed (Enhanced Leverage Points v3): AI found elements but no leverage points.", parsedData);
                        throw new Error(`AI response structure is inconsistent. Found elements but no leverage points.`);
                }
            }
            console.log(`Successfully parsed ENHANCED Leverage Points JSON (v3) using ${MODEL_NAME}. Found ${parsedData.leverage_points.length} leverage points.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Leverage Points JSON (v3) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Leverage Points v3): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderST.renderLeveragePointsPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleLeveragePointsAnalysis (Enhanced v3) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleArchetypeAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");

    analysisResultContainer.innerHTML = `
                <div class="text-center text-white/70 p-8">
                    <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
                    <h3 class="text-xl font-semibold text-white mb-4">Performing System Thinking Analysis</h3>
                    <p class="text-white/80 mb-2">This multi-step process may take several minutes.</p>
                    <p id="analysisStatus" class="text-white/60 text-sm">Initializing...</p>
                </div>`;

    const statusEl = dom.$("analysisStatus");
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        statusEl.textContent = "Reading and processing your document...";
        const useDoc = dom.$("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = dom.$("archetypeFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("archetypeContent").value;
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
        renderST.renderArchetypeAnalysisPage(analysisResultContainer, {
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
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Formulating System-Aware Goals & Initiatives</h3>
            <p class="text-white/80 mb-2">Analyzing your context to identify strategic interventions...</p>
        </div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model


    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";

        if (useDoc) {
            const file = dom.$("systemGoalsFile").files[0];
            if (!file) throw new Error("Please select a document to upload.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("systemGoalsContent").value.trim();
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

        // 2. --- NEW ENHANCED PROMPT (v3 with UNANALYZABLE path) ---
        const prompt = `
            You are a master strategic consultant. Your task is to analyze the provided text, determine its intent, and formulate a high-level goal and strategic initiatives based *only* on the provided text. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION / GOAL CONTEXT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS (Follow this order):**

            **Task 1: Determine Text Intent.**
            First, read the text to determine its intent.
            - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
            - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
            - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

            **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

            **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
            1.  **System Goal (\`system_goal\`):** Refine the user's input into a single, measurable SMART goal to *fix the problem*.
            2.  **Key Loops (\`key_loops\`):** Identify the primary \`reinforcing_loop\` and \`balancing_loop\` *causing the problem*.
            3.  **Strategic Initiatives (\`strategic_initiatives\`):** Develop 2-3 initiatives to achieve the goal by *manipulating the identified loops* (e.g., "Strengthen R1", "Weaken B1"). For each:
                * \`initiative_name\`: Action-oriented name.
                * \`rationale\`: How it fixes the loop, based on text.
                * \`objectives\`: 2-3 specific sub-objectives.
                * \`kpis\`: 2-3 KPIs to track success.

            **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):**
            1.  **System Goal (\`system_goal\`):** Define a high-level strategic goal based on the company's description (e.g., "Achieve market leadership by leveraging core differentiators").
            2.  **Key Loops (\`key_loops\`):** This MUST be null or have empty loops, as no dynamic problem is described.
            3.  **Strategic Initiatives (\`strategic_initiatives\`):** Identify the 2-3 most important **"Differentiators"** or **"Core Services"** as initiatives. For each:
                * \`initiative_name\`: The name of the differentiator (e.g., "Amplify NexaScore AI Engine").
                * \`rationale\`: Why this is a key strategic initiative to *amplify* to achieve the goal (e.g., "This proprietary asset is the core driver of competitive advantage...").
                * \`objectives\`: 2-3 objectives for *amplifying* this strength (e.g., "Expand NexaScore into new verticals...").
                * \`kpis\`: 2-3 KPIs to track this amplification (e.g., "New client acquisition rate...").

            **IF IT IS UNANALYZABLE:**
            1.  **System Goal (\`system_goal\`):** A clear explanation of why the text cannot be analyzed.
            2.  **Key Loops (\`key_loops\`):** This MUST be null.
            3.  **Strategic Initiatives (\`strategic_initiatives\`):** This MUST be an empty array [].
            
            **ABSOLUTE CONSTRAINTS:**
            - STICK TO THE TEXT. Do NOT invent information.
            - If the text is descriptive, DO NOT invent feedback loops.
            - JSON format must be perfect.

            **RETURN FORMAT (Example for a Descriptive Profile):**
            {
                "system_goal": "Achieve market leadership in FinTech by leveraging proprietary AI and blockchain technology.",
                "key_loops": null,
                "strategic_initiatives": [
                {
                    "initiative_name": "Scale Proprietary NexaScore™ AI Engine",
                    "rationale": "This is the core differentiator. Scaling it amplifies the company's competitive advantage in AI-based credit scoring.",
                    "objectives": [
                    "Integrate new alternative data sets into the NexaScore model.",
                    "Market the NexaScore engine as a standalone B2B service.",
                    "Reduce credit risk scoring time by 30%."
                    ],
                    "kpis": ["NexaScore accuracy rate", "New B2B client acquisition", "Scoring time (ms)"]
                },
                {
                    "initiative_name": "Expand Cross-Border DeFi Payments",
                    "rationale": "Leverages the unique blockchain-audited transparency to build trust and capture a larger share of the cross-border market.",
                    "objectives": [
                    "Form partnerships with 3 new stablecoin providers.",
                    "Increase cross-border transaction volume by 50%."
                    ],
                    "kpis": ["Transaction Volume", "New Partnerships", "Customer Feedback on Transparency"]
                }
                ]
            }
        `;
        // --- END OF NEW PROMPT ---

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED System Goals prompt (v3) to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (System Goals):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
            // *** Refined Robust Validation ***
            console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced System Goals v3) ---');
            console.log(JSON.stringify(parsedData, null, 2));
            console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                !parsedData.system_goal || typeof parsedData.system_goal !== 'string' ||
                !Array.isArray(parsedData.strategic_initiatives) || // Must be an array, even if empty
                // key_loops can be null, so we don't need to check it
                
                // Check for invalid state: must have initiatives IF goal is not an error message
                (!parsedData.system_goal.toLowerCase().includes("analyz") && parsedData.strategic_initiatives.length < 1) ||
                
                // Check for valid state: must have NO initiatives IF goal IS an error message
                (parsedData.system_goal.toLowerCase().includes("analyz") && parsedData.strategic_initiatives.length > 0)
            ) {
                if (!parsedData.system_goal.toLowerCase().includes("analyz") && parsedData.strategic_initiatives.length < 1) {
                        console.error("Validation Failed (Enhanced System Goals v3): AI found a valid goal but no initiatives.", parsedData);
                        throw new Error(`AI response structure is inconsistent. Found a goal but no initiatives.`);
                }
            }
            console.log(`Successfully parsed ENHANCED System Goals JSON (v3) using ${MODEL_NAME}. Found ${parsedData.strategic_initiatives.length} initiatives.`);


        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED System Goals JSON (v3) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced System Goals v3): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results
        renderST.renderSystemGoalsPage(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleSystemGoalsAnalysis (Enhanced v3) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleSystemObjectivesAnalysis_ST() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Analyzing System Dynamics...</h3><p class="text-white/80 mb-2">Formulating objectives based on your context...</p></div>`;
    setLoading("generate", true); // Set loading state

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = dom.$("systemObjFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("systemObjContent").value.trim();
            if (!text.trim()) throw new Error("Please describe your system and goal.");
        }

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (text.length > MAX_CONTEXT_LENGTH) {
            text = text.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`System Objectives analysis context truncated.`);
        }

        // 2. --- NEW ENHANCED PROMPT (v3 with UNANALYZABLE path) ---
        const prompt = `
            You are a master strategic consultant. Your task is to analyze the provided text, determine its intent, and formulate a high-level Objective, 2-3 supporting Goals, and identify system dynamics *if they exist*. Base this *only* on the provided text. ${truncatedNote}

            **USER'S SYSTEM DESCRIPTION / GOAL CONTEXT:**
            \`\`\`
            ${text}
            \`\`\`

            **DETAILED TASKS (Follow this order):**

            **Task 1: Determine Text Intent.**
            First, read the text to determine its intent.
            - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
            - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
            - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

            **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

            **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
            1.  **Main Objective (\`main_objective\`):** Refine the user's input into a single, measurable SMART goal to *fix the problem*.
            2.  **Feedback Loops (\`feedback_loops\`):** Identify the primary \`reinforcing_loop\` and \`balancing_loop\` *causing the problem*. Include "name", "description", and "elements".
            3.  **Goals (\`goals\`):** Define 2-3 specific, measurable Goals that support the main objective by *addressing the loops*.

            **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):**
            1.  **Main Objective (\`main_objective\`):** Define a high-level strategic objective based on the company's description (e.g., "Achieve market leadership by leveraging core differentiators").
            2.  **Feedback Loops (\`feedback_loops\`):** This MUST be null.
            3.  **Goals (\`goals\`):** Identify 2-3 S.M.A.R.T. Goals based on *amplifying* the company's **"Differentiators"** or **"Core Services"**. (e.g., "Increase client acquisition for NexaScore AI Engine by 50%...").

            **IF IT IS UNANALYZABLE:**
            1.  **Main Objective (\`main_objective\`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a poem...").
            2.  **Feedback Loops (\`feedback_loops\`):** This MUST be null.
            3.  **Goals (\`goals\`):** This MUST be an empty array [].
            
            **ABSOLUTE CONSTRAINTS:**
            - STICK TO THE TEXT. Do NOT invent information.
            - If the text is descriptive, DO NOT invent feedback loops or problems.
            - JSON format must be perfect.

            **RETURN FORMAT (Example for a Descriptive Profile):**
            {
                "main_objective": "Achieve market leadership as a digital-first FinTech by leveraging proprietary AI and blockchain solutions.",
                "feedback_loops": null,
                "goals": [
                "Increase client acquisition for the NexaScore™ AI Engine by 40% within 12 months.",
                "Expand Cross-Border DeFi Payment volume by 60% by forming 3 new stablecoin partnerships in 18 months.",
                "Attract 5,000 new ESG-conscious investors to the Robo-Advisory platform by promoting built-in green finance metrics."
                ],
                "strategies_and_initiatives": null 
            }
        `;
        // Note: The old prompt returned 'strategies_and_initiatives', which this tool doesn't use.
        // The new prompt is simplified to only return what this tool *actually* renders: main_objective, feedback_loops, and goals.

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED System Objectives prompt (v3) to ${MODEL_NAME}...`);
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
        console.log('Raw AI Response (System Objectives):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
            // *** START CORRECTED VALIDATION ***
            console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced System Objectives v3) ---');
            console.log(JSON.stringify(parsedData, null, 2));
            console.log('------------------------------------');

            if (!parsedData || typeof parsedData !== 'object' ||
                !parsedData.main_objective || typeof parsedData.main_objective !== 'string') {
                // Basic validation failed
                console.error("Validation Failed (System Objectives v3): Basic structure missing (e.g., main_objective).", parsedData);
                throw new Error(`AI response structure is missing 'main_objective'.`);
            }

            // Now, safely check for the 'goals' array
            if (!Array.isArray(parsedData.goals)) {
                console.error("Validation Failed (System Objectives v3): 'goals' is not an array.", parsedData);
                throw new Error(`AI response structure is missing a 'goals' array.`);
            }
            
            // Now we know 'goals' is an array, we can safely check its length
            const isUnanalyzable = parsedData.main_objective.toLowerCase().includes("analyz");

            if (isUnanalyzable && parsedData.goals.length > 0) {
                // Invalid state: AI said it's unanalyzable but provided goals
                console.error("Validation Failed (System Objectives v3): Unanalyzable but goals are present.", parsedData);
                throw new Error(`AI response is inconsistent: 'Unanalyzable' summary but also provided goals.`);
            }
            
            if (!isUnanalyzable && parsedData.goals.length < 1) {
                // Invalid state: AI found a valid objective but no goals
                console.error("Validation Failed (System Objectives v3): Valid objective but no goals found.", parsedData);
                throw new Error(`AI response is inconsistent: Found a valid objective but provided no goals.`);
            }
            // --- END CORRECTED VALIDATION ---
            
            console.log(`Successfully parsed ENHANCED System Objectives JSON (v3) using ${MODEL_NAME}. Found ${parsedData.goals.length} goals.`);


        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED System Objectives JSON (v3) using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced System Objectives v3): ${e.message}. See raw response in console.`);
        }
        
        // Manually add `strategies_and_initiatives: null` if AI didn't, to prevent renderST.render error
        if (!parsedData.hasOwnProperty('strategies_and_initiatives')) {
            parsedData.strategies_and_initiatives = null; // Add this for compatibility with the old render function
        }


        // 4. Render Results
        renderST.renderSystemObjectivesPage_ST(analysisResultContainer, parsedData); // Use the updated renderer

    } catch (error) {
        console.error(`Error in handleSystemObjectivesAnalysis_ST (Enhanced v3) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}



async function handleSystemActionsAnalysis_ST() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Diagnosing System Behavior & Formulating Actions...</h3><p class="text-white/80 mb-2">Generating analysis strictly based on your provided context...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest"; // Consistent model

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let text = "";
        if (useDoc) {
            const file = dom.$("systemActionFile").files[0];
            if (!file) throw new Error("Please select a document.");
            text = await extractTextFromFile(file);
        } else {
            text = dom.$("systemActionContent").value.trim();
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
        renderST.renderSystemActionsPage_ST(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleSystemActionsAnalysis_ST (Refined v2) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}


async function handleParetoFishboneAnalysisGroq() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Pareto & Fishbone Analysis...</h3>
            <p class="text-white/80 mb-2">Identifying root causes, prioritizing impact, and suggesting actions...</p>
        </div>`; // Updated text
    setLoading("generate", true);

    // Define URL and Model
    const MODEL_NAME = "llama-3.1-8b-instant"; // Consistent model
    const PROXY_URL = "https://matt-groq.data2int.com/api/groq/chat"

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let problemContext = "";

        if (useDoc) {
            const file = dom.$("paretoFile").files[0];
            if (!file) throw new Error("Please select a document (.txt, .docx) to upload.");
            problemContext = await extractTextFromFile(file);
        } else {
            problemContext = dom.$("problemStatement").value.trim(); // Use ID from createParetoLayout
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

        const system_prompt = `
        You are an expert quality management and process improvement consultant. Analyze the user's provided problem description using the Fishbone (Ishikawa) diagram and Pareto Principle (80/20 rule). Infer plausible causes and impacts based *only* on the context provided. ${truncatedNote}
        
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
        `
        // 2. Construct ENHANCED Prompt
        const prompt = `
            **USER'S PROBLEM DESCRIPTION:**
            \`\`\`
            ${problemContext}
            \`\`\`

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

        const messages = [
            {"role": "system", "content": `${system_prompt}`},
            {"role": "user", "content": `${prompt}`}
        ]

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Pareto/Fishbone prompt to ${MODEL_NAME}...`);
        const response = await fetch(PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                model: MODEL_NAME, 
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
        let parsedData;
        console.log('Raw AI Response (Pareto/Fishbone):', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.choices[0].message.content);
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
        renderST.renderParetoFishbonePage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleParetoFishboneAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
        }
    }
}


async function handleParetoFishboneAnalysisComb() {
    const provider = dom.$("providerSelect").value;
    const analysisType = "(Pareto/Fishbone)";
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Pareto & Fishbone Analysis...</h3>
            <p class="text-white/80 mb-2">Identifying root causes, prioritizing impact, and suggesting actions...</p>
        </div>`; // Updated text
    setLoading("generate", true);

    try {
        // 1. Gather Inputs
        const useDoc = dom.$("docUpload").checked;
        let problemContext = "";

        if (useDoc) {
            const file = dom.$("paretoFile").files[0];
            if (!file) throw new Error("Please select a document (.txt, .docx) to upload.");
            problemContext = await extractTextFromFile(file);
        } else {
            problemContext = dom.$("problemStatement").value.trim(); // Use ID from createParetoLayout
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

        const systemPrompt = `
        You are an expert quality management and process improvement consultant. Analyze the user's provided problem description using the Fishbone (Ishikawa) diagram and Pareto Principle (80/20 rule). Infer plausible causes and impacts based *only* on the context provided. ${truncatedNote}
        
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
        `
        // 2. Construct ENHANCED Prompt
        const prompt = `
            **USER'S PROBLEM DESCRIPTION:**
            \`\`\`
            ${problemContext}
            \`\`\`

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

        let parsedData = await fetchLLM(provider, systemPrompt, prompt, analysisType);;
        try {
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
        renderST.renderParetoFishbonePage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleParetoFishboneAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
        if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
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
    handleSystemActionsAnalysis_ST,
    handleParetoFishboneAnalysisGroq
}