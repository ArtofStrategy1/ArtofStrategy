import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import { fetchLLM } from './analysis-helpers.mjs';
import * as renderST from '../ui/analysis-rendering/analysis-rendering-st.mjs';

async function handleParetoFishboneAnalysisComb() {
    const provider = "groq" //dom.$("providerSelect").value;
    const analysisType = "(Pareto/Fishbone)";
    const analysisResultContainer = dom.$("analysisResult");
    let modelName = "";

    analysisResultContainer.innerHTML = `
        <div class="text-center text-white/70 p-8">
            <div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>
            <h3 class="text-xl font-semibold text-white mb-4">Generating Detailed Pareto & Fishbone Analysis...</h3>
            <p class="text-white/80 mb-2">Identifying root causes, prioritizing impact, and suggesting actions...</p>
        </div>`; // Updated text
    setLoading("generate", true);

    if (provider === "ollama") {
        modelName = "llama3.1:latest";
    } else if (provider === "groq") {
        modelName = "llama-3.1-8b-instant"; // Consistent model
    }

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

        let parsedData = await fetchLLM(provider, systemPrompt, prompt, analysisType);
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

            console.log(`Successfully parsed ENHANCED Pareto/Fishbone JSON using ${modelName}. Problem: ${parsedData.problem_statement}.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Pareto/Fishbone JSON using ${modelName}:`, parsedData?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Pareto/Fishbone): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results using a new dedicated function
        renderST.renderParetoFishbonePage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleParetoFishboneAnalysis (Enhanced) using ${modelName}:`, error);
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
    handleParetoFishboneAnalysisComb
}