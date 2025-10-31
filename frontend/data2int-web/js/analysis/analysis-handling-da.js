// =====================================================================================================
// ===================               Data Analysis Handling Functions               ====================
// =====================================================================================================

async function handleDescriptiveAnalysis_DA() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Performing Calculations...</h3><p class="text-white/80 mb-2">Calculating descriptive statistics...</p></div>`;
    setLoading("generate", true); // Set loading state

    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** MODEL NAME UPDATED HERE ***
    const MODEL_NAME = "qwen3:30b-a3b"; // Switched to Qwen model
    // *******************************

    try {
        const dataFile = $("descriptiveFile").files[0];
        const contextFile = $("descriptiveContextFile").files[0];

        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }

        const csvText = await extractTextFromFile(dataFile);
        // Use existing robust parseCSV function
        const { header, rows } = parseCSV(csvText);

        if (rows.length === 0) {
                throw new Error("❌ The CSV file appears empty or could not be parsed correctly.");
        }

        // --- Client-Side Statistical Calculations (Improved) ---
        console.log(`Calculating stats for ${rows.length} rows and ${header.length} columns.`);
        const numerical_summary = [];
        const categorical_summary = [];
        const visualizations = [];

        // (Keep the existing calculation logic from the previous correct version here)
        header.forEach((col) => {
            const values = rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== '');
            if (values.length === 0) { console.warn(`Skipping empty column: ${col}`); return; }
            const numericValues = values.map(v => typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]+/g,"")) : Number(v)).filter(n => !isNaN(n));
            const isNumeric = (numericValues.length / values.length) > 0.8;

            if (isNumeric && numericValues.length > 1) {
                const count = numericValues.length;
                const sum = numericValues.reduce((a, b) => a + b, 0);
                const mean = sum / count;
                const sorted = [...numericValues].sort((a, b) => a - b);
                const median = count % 2 === 0 ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : sorted[Math.floor(count / 2)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];
                const variance = numericValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (count > 1 ? count - 1 : 1);
                const std_dev = count > 1 ? Math.sqrt(variance) : 0;
                const q1Index = Math.max(0, Math.floor((count + 1) * 0.25) - 1);
                const q3Index = Math.min(count - 1, Math.floor((count + 1) * 0.75) - 1);
                const q1 = sorted[q1Index];
                const q3 = sorted[q3Index];
                const iqr = (q3 !== undefined && q1 !== undefined) ? q3 - q1 : undefined;
                numerical_summary.push({ variable: col, count, mean, median, std_dev, min, max, q1, q3, iqr });
                visualizations.push({ chart_type: "histogram", variable: col, data: numericValues, title: `Distribution of ${col}` });
            } else {
                const frequencies = {};
                values.forEach((v) => { const key = String(v); frequencies[key] = (frequencies[key] || 0) + 1; });
                const unique_categories = Object.keys(frequencies).length;
                    const modeEntry = Object.entries(frequencies).sort(([,a],[,b]) => b-a)[0];
                    const mode = modeEntry ? modeEntry[0] : "N/A";
                const freqArray = Object.entries(frequencies).map(([category, count]) => ({ category, count, percentage: (count / values.length) * 100 })).sort((a,b) => b.count - a.count);
                categorical_summary.push({ variable: col, count: values.length, unique_categories, mode, frequencies: freqArray });
                const MAX_BAR_CATEGORIES = 15;
                const topFreq = freqArray.slice(0, MAX_BAR_CATEGORIES);
                visualizations.push({ chart_type: "bar", variable: col, data: topFreq.reduce((obj, item) => { obj[item.category] = item.count; return obj; }, {}), title: `Frequency of Top ${topFreq.length} Categories in ${col}` + (freqArray.length > MAX_BAR_CATEGORIES ? ' (Truncated)' : '') });
            }
        });

        const summary = {
            rows: rows.length, columns: header.length, numerical_vars: numerical_summary.length, categorical_vars: categorical_summary.length,
            interpretation: `The dataset contains ${rows.length} records across ${header.length} variables (${numerical_summary.length} numerical, ${categorical_summary.length} categorical). Analysis summarizes central tendency, dispersion, and frequencies.`
        };

        // --- LLM Insights Generation ---
        analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6">...</div><h3 class="text-xl font-semibold text-white mb-4">Generating Accurate Business Insights...</h3><p class="text-white/80 mb-2">Applying strict checks to statistical interpretation...</p></div>`;

        let businessContext = "No additional business context provided.";
        if (contextFile) {
                try { businessContext = await extractTextFromFile(contextFile); } catch(e) { console.warn("Could not read context file:", e.message); }
        }
        if (businessContext.length > 7000) { businessContext = businessContext.substring(0, 7000) + "... (truncated)"; }

        // Prepare summary for prompt
        const statsSummaryForPrompt = {
            overview: summary,
            numerical_highlights: numerical_summary.map(n => ({
                    variable: n.variable,
                    mean: n.mean?.toFixed(2),
                    median: n.median?.toFixed(2),
                    std_dev: n.std_dev?.toFixed(2),
                    min: n.min?.toFixed(2),
                    max: n.max?.toFixed(2)
                })),
            categorical_highlights: categorical_summary.map(c => ({
                    variable: c.variable,
                    unique_categories: c.unique_categories,
                    mode: c.mode,
                    top_category_pct: (c.frequencies[0]?.percentage || 0).toFixed(1) + '%'
                }))
        };

        // --- Prompt with Explicit Accuracy Constraints (kept from previous version) ---
        const prompt = `
            You are a meticulous senior data analyst presenting findings from a descriptive analysis. Accuracy is paramount. Use the provided statistics and business context to generate insightful recommendations.

            **BUSINESS CONTEXT:**
            """
            ${businessContext}
            """

            **CALCULATED STATISTICAL SUMMARY:**
            """
            ${JSON.stringify(statsSummaryForPrompt, null, 2)}
            """

            **TASK:**
            Generate **6 to 8** specific, actionable business insights. Each insight MUST be accurate and directly interpret the provided STATISTICAL SUMMARY within the BUSINESS CONTEXT.

            **For each insight:**
            1.  **Observation:** State the specific statistical finding *exactly* as calculated (e.g., "Mean for 'Age' (XX.X) is [correctly state: higher/lower] than Median (YY.Y)"). Verify all numerical comparisons. Do NOT use terms like 'dominance' or 'concentration' for numerical variable means/medians; use range, mean, median, std dev for interpretation.
            2.  **Accurate Interpretation:** Explain the practical meaning.
                * **SKEWNESS RULE (Apply Strictly):**
                    * If Mean > Median: Interpret as potential **right-skewness** (tail to higher values, possible high outliers).
                    * If Mean < Median: Interpret as potential **left-skewness** (tail to lower values, possible low outliers).
                    * If Mean ≈ Median: Interpret as roughly symmetric.
                * **Variability:** High Std Dev relative to Mean implies high variability/inconsistency. Low Std Dev implies consistency.
                * **Categorical Mode:** A high percentage for the mode indicates concentration in that category.
            3.  **Business Implication/Recommendation:** Connect the *accurate* interpretation to the BUSINESS CONTEXT. Suggest potential actions, investigations, or strategic points. **If a finding (e.g., 'Retail_Sales' stats) seems unrelated to the primary Business Context (e.g., an e-commerce description), explicitly note this potential mismatch** but still provide a recommendation based on the statistic itself.

            **CRITICAL REQUIREMENTS:**
            - **NUMERICAL ACCURACY:** All statements about numbers (e.g., comparisons) MUST be correct.
            - **CORRECT INTERPRETATION:** Skewness direction MUST follow the Mean vs. Median rule. Variability interpretation must be logical.
            - **Context Link:** Link insights to BUSINESS CONTEXT where possible, noting mismatches if necessary.
            - **Actionable:** Insights should lead to potential next steps.
            - **Synthesize:** Go beyond reporting numbers; explain *why* they matter.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object with a list of **6 to 8** insight objects:
            {
                "business_insights": [
                {
                    "observation": "Accurate observation statement...",
                    "interpretation": "Correct interpretation based on rules...",
                    "business_implication": "Recommendation linked to context (or noting mismatch)..."
                },
                // ... 6 to 8 insights total ...
                ]
            }
        `;

        console.log(`Sending ACCURACY-FOCUSED Descriptive Insights prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 }}) // Ensure num_ctx is appropriate
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const llmData = await response.json();

        let insightsData;
            try {
                insightsData = JSON.parse(llmData.response);
                if (!insightsData.business_insights || !Array.isArray(insightsData.business_insights) || (insightsData.business_insights.length > 0 && typeof insightsData.business_insights[0] !== 'object')) {
                    console.warn("Insights received but not in the expected object format. Attempting fallback.", insightsData.business_insights);
                    if (insightsData.business_insights && insightsData.business_insights.length > 0 && typeof insightsData.business_insights[0] === 'string') {
                        insightsData.business_insights = insightsData.business_insights.map(str => ({ observation: "General Insight", interpretation: str, business_implication: "Review manually." }));
                    } else { throw new Error("Insights format incorrect."); }
                }
                console.log(`Successfully parsed ${insightsData.business_insights.length} Insights (Accuracy Check) using ${MODEL_NAME}.`);
            } catch(e) {
                console.error(`Failed to parse Insights JSON (Accuracy Check) using ${MODEL_NAME}:`, llmData.response, e);
                insightsData = { business_insights: [{ observation: "Error", interpretation: "Could not generate insights.", business_implication: "Review stats manually." }] };
            }

        // --- Assemble Final Data Object ---
        const finalData = { summary, numerical_summary, categorical_summary, visualizations, business_insights: insightsData.business_insights || [] };

        renderDescriptivePage_DA(analysisResultContainer, finalData); // Use the existing (corrected) renderer

    } catch (error) {
        console.error(`Error during Descriptive Analysis (Accuracy Check) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    }
}



async function handlePredictiveAnalysis() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Generating Enhanced Forecast...</h3><p class="text-white/80 mb-2">Applying detailed prompt engineering & accuracy checks...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model (ensure these are correct for your setup)
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "llama3.1:latest"; // Use Qwen for potentially better numerical accuracy
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather all inputs from the UI
        const file = $("predictiveFile").files[0];
        const dateColumn = $("dateColumnSelect").value;
        const metricColumn = $("metricSelect").value;
        const horizon = $("horizonSelect").value;
        const modelType = document.querySelector('input[name="model"]:checked').value;

        if (!file || !dateColumn || !metricColumn) {
            throw new Error("❌ Please upload a file and select the date and metric columns.");
        }

        const fileContent = await extractTextFromFile(file);
        const periods = { quarter: 3, "6months": 6, year: 12, "2years": 24 }[horizon];
        const horizonText = { quarter: "Next Quarter", "6months": "Next 6 Months", year: "Next Year", "2years": "Next 2 Years" }[horizon];

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000; // Adjust as needed
         let truncatedNote = "";
         let dataSnippet = fileContent;
         if (fileContent.length > MAX_CONTEXT_LENGTH) {
             dataSnippet = fileContent.substring(0, MAX_CONTEXT_LENGTH);
             truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters of data.)`;
             console.warn(`Predictive analysis data truncated.`);
         }

        // 2. Construct the Enhanced Prompt for Ollama
         const prompt = `
            You are a meticulous and highly accurate senior data scientist performing a time-series forecast and analysis for a business user. Your primary goal is precision and providing actionable, data-grounded insights.

            **ANALYSIS INPUTS:**
            * **Data Snippet:** ${truncatedNote}\n\`\`\`csv\n${dataSnippet}\n\`\`\`
            * **Date/Time Column:** "${dateColumn}"
            * **Value Column to Predict:** "${metricColumn}"
            * **Forecast Horizon:** ${periods} months (${horizonText})
            * **Preferred Model:** ${modelType} (Use Prophet principles if possible, otherwise use ARIMA. State which model was ultimately used.)

            **DETAILED TASKS:**
            1.  **Forecast Generation:** Generate a plausible month-by-month forecast for "${metricColumn}" for the next ${periods} months. Include: \`predicted_value\` (float), \`lower_bound\` (float, e.g., 95% CI lower), \`upper_bound\` (float, e.g., 95% CI upper). Ensure bounds realistically reflect forecast uncertainty (wider further out). Format \`period\` as "YYYY-MM".
            2.  **Input Data Summary:** Calculate plausible descriptive statistics for the historical "${metricColumn}" data *consistent with patterns in the snippet*: Mean, Median, Standard Deviation (Std Dev), Minimum (Min), Maximum (Max), and Coefficient of Variation (CV = Std Dev / Mean * 100). Calculate CV percentage.
            3.  **Model Performance Simulation:** Estimate plausible performance metrics by simulating a train/test split (e.g., using last 20% data as test): Model Used (Confirm Prophet or ARIMA), MAPE (%), R-squared (0-1), MAE, and RMSE. Provide an accurate interpretation: "R-squared of [value] indicates that approximately [value*100]% of the variance in the historical data is explained by the model." Note limitations if data seems short/erratic.
            4.  **Detailed & Accurate Insights (Generate 6-8 Objects):** Analyze patterns ONLY within the provided data snippet.

                **For EACH Insight Object (MUST contain these 3 keys):**
                * **\`observation\`:** State the specific statistical finding *exactly* (e.g., "Mean ([value]) is [correctly state: higher/lower] than Median ([value]) for '${metricColumn}'."). Verify all numerical comparisons. Calculate and state CV percentage when discussing variability. State typical confidence interval width (Upper - Lower).
                * **\`accurate_interpretation\`:** Explain the practical meaning based *strictly* on statistical rules:
                    * **SKEWNESS (MANDATORY CHECK):** If Mean > Median, state: "potential **right-skewness** (tail high)". If Mean < Median, state: "potential **left-skewness** (tail low)". If Mean ≈ Median, state: "**roughly symmetric**". DO NOT GUESS.
                    * **VARIABILITY (CV %):** Interpret calculated CV *relatively* (e.g., <15% low, 15-30% moderate, >30% high inconsistency).
                    * **CONFIDENCE INTERVAL:** Wider interval = **less certainty/reliability**. Narrower = **more certainty/reliability**. State this clearly.
                * **\`business_implication\`:** Connect the *accurate interpretation* to potential business actions/investigations. If a finding seems anomalous, note it. Aim for actionable relevance.

            5.  **Self-Correction:** Before outputting JSON, rigorously check: Are all numbers/comparisons correct? Do interpretations strictly follow rules? Are implications logical? Is everything based ONLY on the data snippet? Fix errors.

            **ABSOLUTE CONSTRAINTS:**
            - **NUMERICAL PRECISION & ACCURACY:** Mandatory.
            - **RULE ADHERENCE:** Mandatory for Skewness, CV, CI interpretation.
            - **DATA GROUNDING:** Mandatory. No external knowledge or fabrication.
            - **JSON FORMAT:** Adhere EXACTLY. Ensure ALL FOUR top-level keys are present and insights are objects.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys: "predictions", "data_summary", "model_performance", AND "insights".** The "insights" array MUST contain **6-8 objects**, each with "observation", "accurate_interpretation", and "business_implication" keys.
            {
              "predictions": [ {"period": "YYYY-MM", "predicted_value": 0.0, "lower_bound": 0.0, "upper_bound": 0.0} /* ... */ ],
              "data_summary": { "mean": 0.0, "median": 0.0, "std_dev": 0.0, "min": 0.0, "max": 0.0, "coeff_variation": 0.0 },
              "model_performance": { "model_used": "...", "mape": 0.0, "r_squared": 0.0, "mae": 0.0, "rmse": 0.0, "interpretation": "..." },
              "insights": [
                { // MUST BE THIS OBJECT STRUCTURE
                  "observation": "Accurate observation...",
                  "accurate_interpretation": "Correct interpretation based on rules...", // Key name changed from 'interpretation'
                  "business_implication": "Recommendation..."
                } // ... 6 to 8 INSIGHT OBJECTS ...
              ]
            }
        `;

        // 3. Send the request to Ollama
        console.log(`Sending ENHANCED Predictive Analysis prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } }) // Increased context window
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        try {
            parsedData = JSON.parse(data.response);
            // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Prompt) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData ||
                 !parsedData.predictions || !Array.isArray(parsedData.predictions) ||
                 !parsedData.data_summary || typeof parsedData.data_summary !== 'object' || !parsedData.data_summary.hasOwnProperty('mean') || // Check specific field
                 !parsedData.model_performance || typeof parsedData.model_performance !== 'object' || !parsedData.model_performance.hasOwnProperty('model_used') || // Check specific field
                 !parsedData.insights || !Array.isArray(parsedData.insights) ||
                 // Check insights structure more carefully
                 (parsedData.insights.length > 0 && (
                     typeof parsedData.insights[0] !== 'object' ||
                     !parsedData.insights[0].hasOwnProperty('observation') ||
                     !parsedData.insights[0].hasOwnProperty('accurate_interpretation') || // Check for new key name
                     !parsedData.insights[0].hasOwnProperty('business_implication')
                 )) ||
                 // Check if insight count is reasonable (optional, adjust range if needed)
                  parsedData.insights.length < 4 // Expecting at least a few insights
                )
             {
                  console.error("Validation Failed: Required fields missing or invalid structure/count.", parsedData);
                  throw new Error(`AI response structure is incorrect. Missing or invalid fields (e.g., predictions, data_summary, model_performance, or insights). Check console logs.`);
             }
             console.log(`Successfully parsed ENHANCED Predictive Analysis JSON using ${MODEL_NAME}. Found ${parsedData.insights.length} insights.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Predictive Analysis JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or required fields missing in AI response: ${e.message}. Check console logs.`);
        }

        // 4. Render the results
        renderPredictiveAnalysisPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePredictiveAnalysis (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops even if rendering fails
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handlePrescriptiveAnalysis_DA() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Running Enhanced Prescriptive Analysis...</h3><p class="text-white/80 mb-2">Linking data insights directly to actionable recommendations...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "qwen3:30b-a3b"; // Use Qwen for potentially better numerical accuracy
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const businessGoal = $("prescriptiveGoal").value.trim();
        const file = $("prescriptiveFile").files[0];

        if (!businessGoal || !file) {
            throw new Error("❌ Please describe your business goal and upload a CSV data file.");
        }

        const fileContent = await extractTextFromFile(file);

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000; // Adjust as needed
        let truncatedNote = "";
        let dataSnippet = fileContent;
        if (fileContent.length > MAX_CONTEXT_LENGTH) {
            dataSnippet = fileContent.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters of data.)`;
            console.warn(`Prescriptive analysis data truncated.`);
        }

        // 2. Construct Enhanced Prompt
        const prompt = `
            You are a highly skilled prescriptive analytics consultant. Your task is to analyze the user's business goal and the provided dataset to recommend specific, data-driven actions. Precision, data grounding, and actionable insights are critical.

            **ANALYSIS INPUTS:**
            * **Business Goal:** "${businessGoal}"
            * **Data Snippet:** ${truncatedNote}\n\`\`\`csv\n${dataSnippet}\n\`\`\`

            **DETAILED TASKS:**
            1.  **Identify Key Data Insights (3-5 insights):** Analyze the data snippet *first* to find patterns, correlations, or segments directly relevant to achieving the stated business goal. For each insight:
                * **\`insight\`:** State the specific, quantifiable finding from the data (e.g., "Customers in 'Region X' have a 30% higher Average Order Value").
                * **\`implication\`:** Explain *why* this insight is important for achieving the business goal (e.g., "Targeting Region X could significantly boost overall revenue per customer").

            2.  **Develop Prescriptions (3-4 prescriptions):** Based *only* on the identified data insights and the business goal, formulate specific, actionable recommendations. For each prescription:
                * **\`recommendation\`:** A clear, concise action title (e.g., "Launch Targeted Campaign for Region X").
                * **\`rationale\`:** Explain *exactly how* this action leverages a specific data insight (reference the insight) to help achieve the business goal.
                * **\`impact\`:** Estimate the potential impact on the goal ("High", "Medium", "Low").
                * **\`effort\`:** Estimate the implementation effort ("High", "Medium", "Low").
                * **\`action_items\`:** List 2-3 concrete, specific first steps to implement the recommendation.
                * **\`expected_outcome\`:** State a specific, measurable outcome linked to the business goal (e.g., "Increase AOV in Region X by 15% within 6 months").
                * **\`kpis_to_track\`:** List 2-3 specific KPIs to measure the success of *this particular* prescription.

            3.  **Self-Correction:** Before outputting JSON, review: Are insights directly from the data snippet? Do prescriptions logically follow ONLY from insights and the goal? Are outcomes measurable? Are all constraints met? Fix any inconsistencies.

            **ABSOLUTE CONSTRAINTS:**
            - **DATA GROUNDING:** Insights and prescriptions MUST derive *solely* from the provided data snippet and business goal. No external knowledge or assumptions.
            - **LINKAGE:** Clearly link each prescription's rationale back to a specific data insight identified in step 1.
            - **ACTIONABILITY:** Recommendations and action items must be specific and practical.
            - **MEASURABILITY:** Expected outcomes and KPIs must be quantifiable.
            - **JSON FORMAT:** Adhere EXACTLY. Include all specified keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys: "main_goal", "data_insights", AND "prescriptions".** "data_insights" must contain 3-5 objects, and "prescriptions" must contain 3-4 objects, each with ALL specified sub-keys.
            {
              "main_goal": "${businessGoal}",
              "data_insights": [ // 3-5 insight objects
                {
                  "insight": "Specific finding from data...",
                  "implication": "Why this matters for the goal..."
                } // ...
              ],
              "prescriptions": [ // 3-4 prescription objects
                {
                  "recommendation": "Action Title",
                  "rationale": "Links insight X to goal Y...",
                  "impact": "High/Medium/Low",
                  "effort": "High/Medium/Low",
                  "action_items": ["Step 1...", "Step 2..."],
                  "expected_outcome": "Measurable outcome...",
                  "kpis_to_track": ["KPI 1...", "KPI 2..."]
                } // ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Prescriptive Analysis prompt to ${MODEL_NAME}...`);
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
        try {
            parsedData = JSON.parse(data.response);
             // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Prescriptive) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData ||
                 !parsedData.main_goal || typeof parsedData.main_goal !== 'string' ||
                 !parsedData.data_insights || !Array.isArray(parsedData.data_insights) || parsedData.data_insights.length < 2 || // Expect at least 2 insights
                 (parsedData.data_insights.length > 0 && (
                     typeof parsedData.data_insights[0] !== 'object' ||
                     !parsedData.data_insights[0].hasOwnProperty('insight') ||
                     !parsedData.data_insights[0].hasOwnProperty('implication')
                 )) ||
                 !parsedData.prescriptions || !Array.isArray(parsedData.prescriptions) || parsedData.prescriptions.length < 2 || // Expect at least 2 prescriptions
                 (parsedData.prescriptions.length > 0 && (
                     typeof parsedData.prescriptions[0] !== 'object' ||
                     !parsedData.prescriptions[0].hasOwnProperty('recommendation') ||
                     !parsedData.prescriptions[0].hasOwnProperty('rationale') ||
                     !parsedData.prescriptions[0].hasOwnProperty('impact') ||
                     !parsedData.prescriptions[0].hasOwnProperty('effort') ||
                     !parsedData.prescriptions[0].hasOwnProperty('action_items') || !Array.isArray(parsedData.prescriptions[0].action_items) ||
                     !parsedData.prescriptions[0].hasOwnProperty('expected_outcome') ||
                     !parsedData.prescriptions[0].hasOwnProperty('kpis_to_track') || !Array.isArray(parsedData.prescriptions[0].kpis_to_track)
                 ))
                )
             {
                  console.error("Validation Failed (Prescriptive): Required fields missing or invalid structure/count.", parsedData);
                  throw new Error(`AI response structure is incorrect. Missing/invalid fields (main_goal, data_insights [>=2], prescriptions [>=2] with all sub-keys). Check console.`);
             }
             console.log(`Successfully parsed ENHANCED Prescriptive Analysis JSON using ${MODEL_NAME}. Found ${parsedData.data_insights.length} insights, ${parsedData.prescriptions.length} prescriptions.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Prescriptive Analysis JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or required fields missing in AI response: ${e.message}. Check console logs.`);
        }

        // 4. Render Results
        renderPrescriptivePage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePrescriptiveAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleVisualizationAnalysis_DA() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Generating Advanced Visualizations...</h3><p class="text-white/80 mb-2">Analyzing data, selecting optimal charts, and crafting insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "llama3.1:latest"; // Use Qwen for potentially better numerical accuracy / chart logic
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const vizRequest = $("vizRequest").value.trim();
        const file = $("vizFile").files[0];

        if (!vizRequest || !file) {
            throw new Error("❌ Please describe your visualization request and upload a CSV data file.");
        }

        const fileContent = await extractTextFromFile(file);

        // Truncate if necessary
        const MAX_CONTEXT_LENGTH = 15000; // Adjust as needed
        let truncatedNote = "";
        let dataSnippet = fileContent;
        if (fileContent.length > MAX_CONTEXT_LENGTH) {
            dataSnippet = fileContent.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters of data.)`;
            console.warn(`Visualization analysis data truncated.`);
        }

        // 2. Construct Enhanced Prompt
        const prompt = `
            You are a senior business intelligence analyst using Plotly.js. Your task is to analyze a user's request and dataset snippet to create the most insightful and relevant visualizations. Accuracy, clarity, and actionable insights are paramount.

            **ANALYSIS INPUTS:**
            * **User Request:** "${vizRequest}"
            * **Data Snippet:** ${truncatedNote}\n\`\`\`csv\n${dataSnippet}\n\`\`\`

            **DETAILED TASKS:**
            1.  **Chart Selection Rationale:** Briefly explain (1-2 sentences) your thought process for choosing the types of charts generated based on the user request and apparent data structure.
            2.  **Generate Visualizations (3-4 charts):** Create distinct, complementary visualizations using appropriate chart types (e.g., bar, line, scatter, pie, box, heatmap) that directly address the user's request using ONLY the provided data snippet. For each visualization:
                * **\`title\`:** A short, descriptive title.
                * **\`plotly_trace\`:** A *complete* Plotly.js trace object (or array of traces if needed, e.g., for grouped bars). Ensure data types are correct (numbers for y-values etc.).
                * **\`plotly_layout\`:** A *complete* Plotly.js layout object, including axis labels and a title.
                * **\`interpretation\`:** A detailed, multi-sentence interpretation explaining *what the chart shows* based on visual patterns (trends, distributions, comparisons, outliers) evident in the plotted data.
                * **\`actionable_insight\`:** A specific business action or decision that should be considered based *only* on the interpretation of *this specific chart* and the original user request context.

            3.  **Self-Correction:** Before outputting JSON, review: Does the chart selection rationale make sense? Are trace/layout objects complete and valid Plotly JSON? Do interpretations accurately reflect the chart's visual patterns in the data snippet? Are insights actionable and directly linked to the interpretation? Fix errors rigorously.

            **ABSOLUTE CONSTRAINTS:**
            - **DATA GROUNDING:** All chart data, interpretations, and insights MUST be derived *solely* from the provided data snippet and user request. No external data or assumptions.
            - **PLOTLY VALIDITY:** Ensure \`plotly_trace\` and \`plotly_layout\` are valid JSON structures usable by Plotly.js. Use correct data types.
            - **ACTIONABILITY:** Insights must suggest concrete next steps or decisions.
            - **JSON FORMAT:** Adhere EXACTLY. Include all specified keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys: "chart_selection_rationale", AND "visualizations".** The "visualizations" array MUST contain **3-4 objects**, each with "title", "plotly_trace", "plotly_layout", "interpretation", and "actionable_insight" keys.
            {
              "chart_selection_rationale": "Brief explanation here...",
              "visualizations": [
                { // Chart 1
                  "title": "Chart Title 1",
                  "plotly_trace": { /* ... Complete Trace Object(s) ... */ },
                  "plotly_layout": { /* ... Complete Layout Object ... */ },
                  "interpretation": "Detailed interpretation of chart 1 based on data...",
                  "actionable_insight": "Specific action based on interpretation of chart 1..."
                },
                { // Chart 2
                  "title": "Chart Title 2",
                  "plotly_trace": { /* ... */ },
                  "plotly_layout": { /* ... */ },
                  "interpretation": "Detailed interpretation of chart 2...",
                  "actionable_insight": "Specific action based on interpretation of chart 2..."
                } // ... 3-4 charts total ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Visualization prompt to ${MODEL_NAME}...`);
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
        try {
            parsedData = JSON.parse(data.response);
             // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Visualization) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData ||
                 !parsedData.chart_selection_rationale || typeof parsedData.chart_selection_rationale !== 'string' ||
                 !parsedData.visualizations || !Array.isArray(parsedData.visualizations) || parsedData.visualizations.length < 2 || // Expect at least 2 charts
                 (parsedData.visualizations.length > 0 && (
                     typeof parsedData.visualizations[0] !== 'object' ||
                     !parsedData.visualizations[0].hasOwnProperty('title') ||
                     !parsedData.visualizations[0].hasOwnProperty('plotly_trace') || typeof parsedData.visualizations[0].plotly_trace !== 'object' || // Basic check
                     !parsedData.visualizations[0].hasOwnProperty('plotly_layout') || typeof parsedData.visualizations[0].plotly_layout !== 'object' || // Basic check
                     !parsedData.visualizations[0].hasOwnProperty('interpretation') ||
                     !parsedData.visualizations[0].hasOwnProperty('actionable_insight')
                 ))
                )
             {
                  console.error("Validation Failed (Visualization): Required fields missing or invalid structure/count.", parsedData);
                  throw new Error(`AI response structure is incorrect. Missing/invalid fields (chart_selection_rationale, visualizations array [>=2] with all sub-keys). Check console.`);
             }
             console.log(`Successfully parsed ENHANCED Visualization JSON using ${MODEL_NAME}. Rationale provided. Found ${parsedData.visualizations.length} visualizations.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Visualization JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or required fields missing in AI response: ${e.message}. Check console logs.`);
        }

        // 4. Render Results
        renderVisualizationPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleVisualizationAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleRegressionAnalysis_DA() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Running Comprehensive Regression...</h3><p class="text-white/80 mb-2">Building model, running diagnostics, and generating actionable insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "llama3.1:latest"; // Use Qwen for potentially better numerical accuracy
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const dependentVar = $("dependentVar").value.trim();
        const independentVarsRaw = $("independentVars").value.trim();
        const dataFile = $("regressionFile").files[0];
        const contextFile = $("regressionContextFile").files[0];

        if (!dependentVar || !independentVarsRaw || !dataFile) {
            throw new Error("❌ Please specify Dependent Variable, at least one Independent Variable, and upload a CSV data file.");
        }
        // Clean up independent vars list
        const independentVars = independentVarsRaw.split(',').map(v => v.trim()).filter(v => v).join(', ');
        if (!independentVars) {
             throw new Error("❌ Please specify at least one valid Independent Variable.");
        }


        const fileContent = await extractTextFromFile(dataFile);
        let businessContext = "No additional business context document provided.";
        if (contextFile) {
            try {
                 businessContext = await extractTextFromFile(contextFile);
                 console.log("Extracted text from context file for regression.");
            } catch (e) {
                 console.warn("Could not read context file:", e.message);
                 businessContext = `Error reading context file: ${e.message}. Proceeding without document context.`;
            }
        } else {
             console.log("No business context file uploaded for regression.");
        }


        // Truncate if necessary
        const MAX_DATA_LENGTH = 15000; // Keep data snippet reasonable
        const MAX_CONTEXT_LENGTH = 7000; // Context less critical than data for pure regression
        let truncatedNote = "";
        let dataSnippet = fileContent;

        if (fileContent.length > MAX_DATA_LENGTH) {
            dataSnippet = fileContent.substring(0, MAX_DATA_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_DATA_LENGTH} characters of the data file.)`;
            console.warn(`Regression analysis data truncated.`);
        }
         if (businessContext.length > MAX_CONTEXT_LENGTH) {
            businessContext = businessContext.substring(0, MAX_CONTEXT_LENGTH) + "\n... (business context truncated)";
            console.warn(`Regression business context truncated.`);
        }

        // 2. Construct Enhanced Prompt
        const prompt = `
            You are a meticulous senior data analyst performing a comprehensive multiple regression analysis. Accuracy, clear interpretation of statistics, validation of assumptions, and actionable business insights grounded in data are paramount.

            **ANALYSIS INPUTS:**
            * **Dependent Variable (Y):** "${dependentVar}"
            * **Independent Variables (X):** "${independentVars}"
            * **Business Context:** """${businessContext}"""
            * **Data Snippet:** ${truncatedNote}\n\`\`\`csv\n${dataSnippet}\n\`\`\`

            **DETAILED TASKS:**
            1.  **Model Summary & Fit:** Calculate and interpret key model statistics:
                * **R-squared & Adj. R-squared:** Provide values and explain *precisely* what percentage of variance in "${dependentVar}" is explained by the model, considering the number of predictors (Adj. R²).
                * **F-statistic & Prob(F-statistic):** Provide values and state clearly whether the overall model is statistically significant (typically p < 0.05).
                * **Regression Equation:** Provide the calculated equation.
                * **Overall Interpretation:** Summarize the model's goodness-of-fit based on these metrics.

            2.  **Variable Importance (if applicable/calculable):** Estimate the relative importance of each independent variable in predicting the dependent variable. Provide a score or ranking and a brief rationale based on model coefficients or other standard methods (e.g., contribution to R²). If not directly calculable from standard OLS output, omit this section or state it's based on coefficient magnitude/significance.

            3.  **Coefficients Analysis:** For *each* coefficient (including the Intercept):
                * Provide: Variable Name, Coefficient value, Standard Error, P-value.
                * **Interpretation:** Explain the practical meaning of the coefficient (e.g., "For each one-unit increase in [X variable], ${dependentVar} is predicted to [increase/decrease] by [coefficient value] units, holding other variables constant.").
                * **Significance:** State clearly whether the coefficient is statistically significant (p < 0.05) and its implication (i.e., we are confident this variable has a real effect).

            4.  **Residuals Analysis (Model Diagnostics):**
                * Simulate/generate plausible 'predicted' vs. 'residuals' data points (around 15-20 points consistent with the fit stats).
                * **Interpretation:** Analyze the *pattern* of these residuals. Explicitly check for:
                    * **Linearity:** Do residuals scatter randomly around zero, or show a curve (suggesting non-linear relationship)?
                    * **Homoscedasticity:** Is the spread of residuals roughly constant across predicted values, or does it fan out/in (heteroscedasticity)?
                    * **Normality (Conceptual):** Do residuals seem roughly normally distributed around zero?
                    * **Conclusion:** State whether the basic assumptions of linear regression appear to be met based *only* on the visual pattern of the simulated residuals.

            5.  **Business Recommendations (3-4 recommendations):** Based *only* on the significant coefficients, variable importance, and the provided Business Context:
                * **\`recommendation\`:** A clear, actionable title.
                * **\`insight_link\`:** State which specific significant variable(s) or model finding drives this recommendation.
                * **\`action_items\`:** List 2-3 concrete steps a business could take based on this finding and the context.
                * **\`potential_risks\`:** Briefly mention 1-2 potential risks or considerations for implementing the action.
                * **\`kpis_to_track\`:** List 2-3 KPIs to measure the success of the implemented action.

            6.  **Self-Correction:** Before outputting JSON, rigorously check: Are R²/F-stat interpretations correct? Are coefficient p-values interpreted correctly? Does the residual analysis correctly check assumptions? Are recommendations directly linked ONLY to significant findings and business context? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **DATA GROUNDING:** All interpretations and recommendations MUST derive *solely* from the analysis of the provided data snippet, variable definitions, and business context. No external knowledge.
            - **STATISTICAL ACCURACY:** Interpretations of R², F-stat, p-values, and residual patterns must be statistically sound.
            - **ACTIONABILITY & LINKAGE:** Recommendations must be practical and clearly linked back to specific, significant model results.
            - **JSON FORMAT:** Adhere EXACTLY. Include all specified keys and sub-keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
              "model_summary": {
                "dependent_variable": "${dependentVar}",
                "r_squared": 0.0, // Calculated
                "adj_r_squared": 0.0, // Calculated
                "f_statistic": 0.0, // Calculated
                "prob_f_statistic": 0.0, // Calculated
                "regression_equation": "Y = ...", // Calculated
                "interpretation": "Precise interpretation of fit..." // Generated
              },
              "variable_importance": [ // Optional section if calculable, otherwise omit or explain basis
                { "variable": "Var1", "importance_score": 0.0, "rationale": "Based on..." },
                { "variable": "Var2", "importance_score": 0.0, "rationale": "Based on..." }
              ],
              "coefficients": [ // Include Intercept + all Independent Vars
                {
                  "variable": "Intercept", "coefficient": 0.0, "std_error": 0.0, "p_value": 0.0,
                  "interpretation": "Baseline value interpretation...", "significance": "Is it significant? (p<0.05)"
                },
                {
                   "variable": "X1", "coefficient": 0.0, "std_error": 0.0, "p_value": 0.0,
                   "interpretation": "Practical meaning of coefficient...", "significance": "Is it significant? (p<0.05)"
                } // ... for all variables ...
              ],
              "residuals_analysis": { // Renamed key for clarity
                "predicted_vs_residuals": [ // Array of ~15-20 plausible points
                    { "predicted": 0.0, "residual": 0.0 }
                 ],
                "interpretation": "Analysis of pattern for Linearity, Homoscedasticity, Normality. Conclusion on assumptions met/violated..." // Generated
              },
              "business_recommendations": [ // 3-4 recommendations
                {
                  "recommendation": "Action Title",
                  "insight_link": "Driven by significance of [Variable X]...",
                  "action_items": ["Step 1...", "Step 2..."],
                  "potential_risks": "Risk 1...",
                  "kpis_to_track": ["KPI 1...", "KPI 2..."]
                } // ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED Regression prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } }) // Increased context
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        try {
            parsedData = JSON.parse(data.response);
             // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Regression) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData ||
                 !parsedData.model_summary || typeof parsedData.model_summary !== 'object' || !parsedData.model_summary.hasOwnProperty('r_squared') ||
                 // variable_importance is optional
                 !parsedData.coefficients || !Array.isArray(parsedData.coefficients) || parsedData.coefficients.length === 0 ||
                 (parsedData.coefficients.length > 0 && (typeof parsedData.coefficients[0] !== 'object' || !parsedData.coefficients[0].hasOwnProperty('p_value'))) ||
                 !parsedData.residuals_analysis || typeof parsedData.residuals_analysis !== 'object' || !parsedData.residuals_analysis.hasOwnProperty('predicted_vs_residuals') || !Array.isArray(parsedData.residuals_analysis.predicted_vs_residuals) ||
                 !parsedData.business_recommendations || !Array.isArray(parsedData.business_recommendations) || parsedData.business_recommendations.length < 2 || // Expect >= 2 recommendations
                 (parsedData.business_recommendations.length > 0 && (typeof parsedData.business_recommendations[0] !== 'object' || !parsedData.business_recommendations[0].hasOwnProperty('insight_link')))
                )
             {
                  console.error("Validation Failed (Regression): Required fields missing or invalid structure/count.", parsedData);
                  throw new Error(`AI response structure is incorrect. Missing/invalid fields (model_summary, coefficients, residuals_analysis, or business_recommendations [>=2]). Check console.`);
             }
             console.log(`Successfully parsed ENHANCED Regression JSON using ${MODEL_NAME}. Found ${parsedData.coefficients.length} coefficients, ${parsedData.business_recommendations.length} recommendations.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED Regression JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or required fields missing in AI response: ${e.message}. Check console logs.`);
        }

        // 4. Render Results
        renderRegressionPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleRegressionAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}




async function handlePlsAnalysis_DA() {
    const analysisResultContainer = $("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Running Comprehensive PLS-SEM...</h3><p class="text-white/80 mb-2">Estimating paths, evaluating model fit, and generating insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "qwen3:30b-a3b"; // Qwen might be better for structured analysis
    // const MODEL_NAME = "llama3.1:latest"; // Alternative

    try {
        // 1. Gather Inputs
        const measurementModel = $("plsMeasurementModel").value.trim();
        const structuralModel = $("plsStructuralModel").value.trim();
        const file = $("plsFile").files[0];

        if (!measurementModel || !structuralModel || !file) {
            throw new Error("❌ Please define the Measurement Model, Structural Model, and upload a CSV data file.");
        }

        const fileContent = await extractTextFromFile(file);

        // Truncate if necessary
        const MAX_DATA_LENGTH = 15000; // Keep reasonable for analysis
        let truncatedNote = "";
        let dataSnippet = fileContent;
        if (fileContent.length > MAX_DATA_LENGTH) {
            dataSnippet = fileContent.substring(0, MAX_DATA_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_DATA_LENGTH} characters of the data file.)`;
            console.warn(`PLS-SEM analysis data truncated.`);
        }

        // 2. Construct Enhanced Prompt
        const prompt = `
            You are an expert data scientist specializing in Partial Least Squares Structural Equation Modeling (PLS-SEM). Analyze the user's defined model and data snippet with high accuracy and provide detailed, actionable interpretations.

            **ANALYSIS INPUTS:**
            * **Measurement Model (Syntax):** \`${measurementModel}\`
            * **Structural Model (Syntax):** \`${structuralModel}\`
            * **Data Snippet:** ${truncatedNote}\n\`\`\`csv\n${dataSnippet}\n\`\`\`

            **DETAILED TASKS:**
            1.  **Model Evaluation (R-squared):** Calculate R-squared values for all endogenous (dependent) latent variables. For each:
                * Provide: Variable Name, R-squared Value.
                * **Interpretation:** Explain *precisely* what percentage of the variance in that variable is explained by its predictors within the model. Assess the explanatory power (e.g., >0.75 substantial, >0.5 moderate, >0.25 weak based on context, adjust if needed).

            2.  **Path Coefficients Analysis:** Estimate and analyze the structural paths. For *each* path:
                * Provide: Path (e.g., "ConstructA -> ConstructB"), Coefficient (β) value, T-Statistic, P-value.
                * **Interpretation:** Explain the practical meaning of the coefficient (e.g., "A one-unit increase in ConstructA is associated with a [β] unit [increase/decrease] in ConstructB, holding other paths constant.").
                * **Significance:** State clearly whether the path is statistically significant (typically p < 0.05) and its implication (we are confident this relationship exists in the data).

            3.  **Reliability & Validity Assessment:** Calculate key metrics for *each* latent construct defined in the measurement model.
                * Provide: Construct Name, Cronbach's Alpha, Composite Reliability (CR), Average Variance Extracted (AVE).
                * **Assessment:** For each metric, state whether it meets common thresholds (Cronbach's Alpha > 0.7, CR > 0.7, AVE > 0.5) and interpret the result (e.g., "AVE of [value] indicates [good/poor] convergent validity, meaning the indicators measure the construct well/poorly.").

            4.  **Business Recommendations (3-4 recommendations):** Based *only* on the **significant path coefficients** and the likely business context implied by the construct names:
                * **\`recommendation\`:** A clear, actionable title.
                * **\`insight_link\`:** State which specific significant path(s) drive this recommendation.
                * **\`action_items\`:** List 2-3 concrete steps a business could take based on this finding.
                * **\`kpis_to_track\`:** List 2-3 KPIs to measure the success of the implemented action, related to the constructs involved.

            5.  **Self-Correction:** Before outputting JSON, meticulously check: Are R² interpretations correct? Are path coefficient p-values interpreted correctly? Do reliability/validity assessments correctly compare against thresholds? Are recommendations directly linked ONLY to significant paths? Fix all errors.

            **ABSOLUTE CONSTRAINTS:**
            - **DATA GROUNDING:** All results (coefficients, R², metrics) and interpretations MUST derive *solely* from the analysis of the provided data snippet and model structure. No fabrication.
            - **STATISTICAL ACCURACY:** Interpretations of R², p-values, and reliability/validity metrics must be statistically sound and use standard thresholds.
            - **ACTIONABILITY & LINKAGE:** Recommendations must be practical and clearly linked back to specific, significant path results.
            - **JSON FORMAT:** Adhere EXACTLY. Include all specified keys and sub-keys.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
            {
              "model_evaluation": { // R-squared results
                "r_squared_values": [ // Array for each endogenous variable
                  { "variable": "EndogenousVar1", "r_squared": 0.0 }
                ],
                "interpretation": "Overall interpretation of model's explanatory power..." // Generated
              },
              "path_coefficients": [ // Array for each structural path
                {
                  "path": "ConstructA -> ConstructB", "coefficient": 0.0, "t_statistic": 0.0, "p_value": 0.0,
                  "interpretation": "Practical meaning and significance...", "significant": true/false // Added boolean flag
                } // ... for all paths ...
              ],
              "reliability_validity": [ // Array for each construct
                {
                  "construct": "ConstructA", "cronbachs_alpha": 0.0, "composite_reliability": 0.0, "ave": 0.0,
                  "assessment": "Assessment vs. thresholds (e.g., Good internal consistency (Alpha > 0.7)... Convergent validity met (AVE > 0.5)..." // Generated assessment
                } // ... for all constructs ...
              ],
              // "visual_data" might be hard for LLM, can omit if unreliable, or simplify
              // "visual_data": { "nodes": [ { "id": "<construct_name>" } ] }, // Simplified - just node names
              "business_recommendations": [ // 3-4 recommendations
                {
                  "recommendation": "Action Title",
                  "insight_link": "Driven by significant path [Path Name]...",
                  "action_items": ["Step 1...", "Step 2..."],
                  "kpis_to_track": ["KPI related to ConstructA...", "KPI related to ConstructB..."]
                } // ...
              ]
            }
        `;

        // 3. Send Request to Ollama
        console.log(`Sending ENHANCED PLS-SEM prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } }) // Increased context
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        try {
            parsedData = JSON.parse(data.response);
             // *** Robust Validation ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced PLS-SEM) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             if (!parsedData ||
                 !parsedData.model_evaluation || typeof parsedData.model_evaluation !== 'object' || !parsedData.model_evaluation.hasOwnProperty('r_squared_values') || !Array.isArray(parsedData.model_evaluation.r_squared_values) ||
                 !parsedData.path_coefficients || !Array.isArray(parsedData.path_coefficients) || parsedData.path_coefficients.length === 0 ||
                 (parsedData.path_coefficients.length > 0 && (typeof parsedData.path_coefficients[0] !== 'object' || !parsedData.path_coefficients[0].hasOwnProperty('p_value'))) ||
                 !parsedData.reliability_validity || !Array.isArray(parsedData.reliability_validity) || parsedData.reliability_validity.length === 0 ||
                 (parsedData.reliability_validity.length > 0 && (typeof parsedData.reliability_validity[0] !== 'object' || !parsedData.reliability_validity[0].hasOwnProperty('cronbachs_alpha'))) ||
                 !parsedData.business_recommendations || !Array.isArray(parsedData.business_recommendations) || parsedData.business_recommendations.length < 2 || // Expect >= 2 recommendations
                 (parsedData.business_recommendations.length > 0 && (typeof parsedData.business_recommendations[0] !== 'object' || !parsedData.business_recommendations[0].hasOwnProperty('insight_link')))
                 // visual_data is optional
                )
             {
                  console.error("Validation Failed (PLS-SEM): Required fields missing or invalid structure/count.", parsedData);
                  throw new Error(`AI response structure is incorrect. Missing/invalid fields (model_evaluation, path_coefficients, reliability_validity, or business_recommendations [>=2]). Check console.`);
             }
             console.log(`Successfully parsed ENHANCED PLS-SEM JSON using ${MODEL_NAME}. Found ${parsedData.path_coefficients.length} paths, ${parsedData.reliability_validity.length} constructs, ${parsedData.business_recommendations.length} recommendations.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED PLS-SEM JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or required fields missing in AI response: ${e.message}. Check console logs.`);
        }

        // Add user inputs to parsedData for rendering the diagram accurately
        parsedData.userInput = { measurementModel, structuralModel };


        // 4. Render Results
        renderPlsPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePlsAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}    



/**
 * Handles the submission of the SEM analysis request to the backend.
 * Sends data (file or text) and separate measurement/structural syntax.
 */
async function handleSemAnalysis() {
    const analysisResultContainer = $("analysisResult"); // Get the results container element
    // Display loading indicator
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><h3 class="text-xl font-semibold text-white">Running Structural Equation Model...</h3></div>`;
    setLoading("generate", true); // Assumes setLoading function exists to disable button and show spinner

    try {
        // --- 1. Get Inputs from UI ---
        const measurementSyntax = $("semMeasurementSyntax").value.trim();
        const structuralSyntax = $("semStructuralSyntax").value.trim();
        const dataFile = $("semFile").files[0]; // Get the selected file object
        const dataText = $("semDataText").value.trim(); // Get pasted text
        const isUsingFile = $("semInputFileToggle").checked; // Check which input type is selected

        let fileToSend = null;
        let dataContentToSend = null; // Use this variable if your backend accepts raw text

        // --- 2. Validate Inputs & Prepare Data Source ---
        if (isUsingFile) {
            if (!dataFile) {
                throw new Error("Please upload a data file (.csv or .xlsx).");
            }
            // Basic file type check (backend should also validate)
            const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
            //if (!allowedTypes.includes(dataFile.type) && !dataFile.name.toLowerCase().endsWith('.csv') && !dataFile.name.toLowerCase().endsWith('.xlsx')) {
            //    throw new Error("Invalid file type. Please upload a CSV or Excel file.");
            //}
            fileToSend = dataFile;
        } else {
            if (!dataText) {
                throw new Error("Please paste your CSV data into the text area.");
            }
            // Decide how to send text data based on backend requirements
            dataContentToSend = dataText; // Sending raw text
            // Alternative: If backend strictly expects a file, create a Blob
            // fileToSend = new Blob([dataText], { type: 'text/csv' });
            // fileToSend.name = "pasted_data.csv"; // Assign a default filename
        }

        // Validate that at least one syntax part is provided
        if (!measurementSyntax && !structuralSyntax) {
            throw new Error("Please provide Measurement Model Syntax and/or Structural Model Syntax.");
        }

        // --- 3. Prepare FormData for Backend ---
        const formData = new FormData();
        formData.append("analysis_type", "sem"); // Identify the analysis type

        // *** Send SYNTAX parts SEPARATELY ***
        formData.append("measurement_syntax", measurementSyntax);
        formData.append("structural_syntax", structuralSyntax);

        // Append the data source (either the file or the text content)
        if (fileToSend) {
            // If sending a file (uploaded or created from text via Blob)
            formData.append("data_file", fileToSend, fileToSend.name);
        } else if (dataContentToSend) {
            // If sending raw text content under a specific form field name
             formData.append("data_text", dataContentToSend);
             // Make sure your backend (main.py) expects "data_text" if you use this
        } else {
            // This case should ideally not be reached if validation above is correct
            throw new Error("No data source (file or text) could be prepared.");
        }


        // --- 4. Send Request to Backend API ---
        // *** Replace with your actual backend API endpoint ***
        const API_URL = "https://analysis.data2int.com/api/analysis"; // Example URL

        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            // Add Authorization header if your API requires authentication
            // headers: { 'Authorization': `Bearer ${your_auth_token}` }
        });

        // --- 5. Handle Backend Response ---
        if (!response.ok) {
            // Attempt to get detailed error message from backend
            let errorDetail = `API request failed (${response.status})`;
            try {
                const errorJson = await response.json(); // Assumes backend sends JSON errors
                errorDetail += `: ${errorJson.detail || JSON.stringify(errorJson)}`; // Use specific 'detail' field if available
            } catch (e) {
                // If response is not JSON, use the raw text
                errorDetail += `: ${await response.text()}`;
            }
            throw new Error(errorDetail); // Throw error to be caught below
        }

        // If response is OK (2xx status)
        const parsedData = await response.json(); // Expecting JSON response with results

        // Render the results using the SEM-specific rendering function
        // Assumes renderSemAnalysisPage exists and handles the parsedData structure
        renderSemAnalysisPage(analysisResultContainer, parsedData);

    } catch (error) { // Catch errors from input validation, fetch, or response handling
        console.error("Error during SEM analysis:", error);
        // Display the error message in the results container
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
        // Ensure loading indicator is turned off regardless of success or failure
        setLoading("generate", false); // Assumes setLoading function exists
    }
}


    
async function handleDematelAnalysis() {
    const analysisResultContainer = $("analysisResult");
    // Using the exact loading message structure you provided
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Running DEMATEL Analysis...</h3><p id="analysisStatus" class="text-white/60 text-sm">This may take a moment.</p></div>`;
    // Added setLoading call
    setLoading("generate", true);

    // Define URL and Model (using llama3.1 as per your function)
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const MODEL_NAME = "llama3.1:latest";

    try {
        // 1. Gather Inputs (using your logic)
        const useDoc = document.querySelector('input[name="inputType"]:checked').id === "docUpload";
        let content = "";
        if (useDoc) {
            const file = $("dematelFile").files[0];
            if (!file) throw new Error("Please select a document.");
            content = await extractTextFromFile(file);
        } else {
            content = $("dematelContent").value.trim();
            if (!content) throw new Error("Please describe the system's factors.");
        }

        // Truncate if necessary (added for safety)
        const MAX_CONTEXT_LENGTH = 15000;
        let truncatedNote = "";
        if (content.length > MAX_CONTEXT_LENGTH) {
            content = content.substring(0, MAX_CONTEXT_LENGTH);
            truncatedNote = `(Note: Analysis based on the first ${MAX_CONTEXT_LENGTH} characters.)`;
            console.warn(`DEMATEL analysis context truncated.`);
        }


        // 2. Construct ENHANCED Prompt (based on your numerical approach)
        const prompt = `
            You are an expert systems analyst applying the Decision Making Trial and Evaluation Laboratory (DEMATEL) method. Analyze the user's provided context to identify key factors, model their causal interrelationships numerically, and provide detailed, actionable insights. Accuracy and adherence to DEMATEL principles are paramount. ${truncatedNote}

            **ANALYSIS INPUTS:**
            * **User Context/Factor Description:**\n\`\`\`\n${content}\n\`\`\`

            **DETAILED TASKS:**
            1.  **Factor Identification:** Identify 5 to 7 key, distinct factors relevant to the core issue described *only* in the context. Ensure factors are clearly named (2-4 words max).
            2.  **Simulate Total Influence Matrix (T):** Based *only* on the relationships implied or stated in the context (or plausible defaults if vague), simulate a plausible square **total-influence matrix (T)** where T[i][j] represents the total (direct + indirect) influence of factor i on factor j. Diagonal elements should typically be smaller than off-diagonal. Ensure values are plausible positive numbers.
            3.  **Calculate Influence Metrics:** Based *strictly* on the simulated **total-influence matrix (T)**:
                * Calculate Row Sums (R - Total Dispatch Influence) for each factor.
                * Calculate Column Sums (C - Total Received Influence) for each factor.
                * Calculate Prominence (R+C - Total Importance/Involvement) for each factor.
                * Calculate Relation (R-C - Net Dispatcher/Receiver Role) for each factor.
            4.  **Causal Analysis & Interpretation:**
                * Identify the factor with the **highest Prominence (R+C)** as the most central/critical factor, explaining its role based on the R+C value.
                * Identify factors with **high positive Relation (R-C)** as key "Dispatchers" (causes), explaining their influence based on the R-C value.
                * Identify factors with **high negative Relation (R-C)** as key "Receivers" (effects), explaining their role based on the R-C value.
                * Provide a concise **\`summary\`** explaining the overall causal structure suggested by the R+C and R-C values (e.g., "Factors X (R-C=...) and Y (R-C=...) are primary drivers impacting Z (R-C=...), while Factor A (R+C=...) is most central.").
            5.  **Business Recommendations (Generate 3 distinct recommendations):** Based *only* on the numerical causal analysis (dispatcher/receiver roles) and the context:
                * **\`recommendation\`:** A clear, actionable title focusing on influencing a key "Dispatcher" (high +R-C) or managing/monitoring a key "Receiver" (high -R-C).
                * **\`focus_factor\`:** The primary factor targeted.
                * **\`rationale\`:** Explain *why* this action is strategic, explicitly linking it to the factor's calculated dispatcher/receiver role (R-C value) and the overall system dynamics described in the summary.
                * **\`action_items\`:** List 2-3 concrete, specific first steps a business could take based on the context.
                * **\`kpis_to_track\`:** List 2-3 specific, measurable KPIs relevant to monitoring the impact, ideally linked to receiver factors or the overall goal implied in the context.
            6.  **Self-Correction:** Before outputting JSON, meticulously check: Are factors derived solely from context? Are matrix values plausible? Are R, C, R+C, R-C calculated *correctly* based on T? Does the interpretation accurately classify dispatchers/receivers based on R-C values? Are recommendations (exactly 3) directly and logically linked ONLY to the calculated causal analysis and context? Fix all errors. Ensure JSON structure is perfect.

            **ABSOLUTE CONSTRAINTS:**
            - **CONTEXT GROUNDING:** Factors MUST derive *solely* from the context. Matrix values should be plausible based on implied relationships. Recommendations must link to context.
            - **METHOD ACCURACY:** Adhere to DEMATEL calculation logic (R, C, R+C, R-C derived strictly from T). Interpret roles based on calculated R-C.
            - **ACTIONABILITY & LINKAGE:** Recommendations must target specific factors based on their calculated causal role.
            - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys. Generate exactly 3 recommendations. Factor list length MUST match matrix dimensions and metrics array length.

            **RETURN FORMAT:**
            Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below. Generate exactly 3 recommendations.**
            {
              "factors": ["Factor A", "Factor B", "Factor C", "Factor D", "Factor E"], // 5-7 factors from context
              "total_influence_matrix": [ // Simulated square matrix T, plausible positive values
                [0.10, 0.25, 0.30, 0.15, 0.20], // Row 1 influence ON others
                [0.40, 0.05, 0.15, 0.35, 0.25], // Row 2 influence ON others
                [0.35, 0.45, 0.08, 0.10, 0.32],
                [0.10, 0.20, 0.40, 0.06, 0.14],
                [0.20, 0.15, 0.25, 0.40, 0.09]
              ],
              "influence_metrics": [ // Calculated strictly from T; array length MUST match factors length
                {"factor": "Factor A", "r_sum": 1.00, "c_sum": 1.15, "prominence": 2.15, "relation": -0.15},
                {"factor": "Factor B", "r_sum": 1.20, "c_sum": 1.05, "prominence": 2.25, "relation": 0.15},
                {"factor": "Factor C", "r_sum": 1.30, "c_sum": 1.10, "prominence": 2.40, "relation": 0.20},
                {"factor": "Factor D", "r_sum": 0.90, "c_sum": 1.00, "prominence": 1.90, "relation": -0.10},
                {"factor": "Factor E", "r_sum": 1.09, "c_sum": 1.11, "prominence": 2.20, "relation": -0.02}
                 // ... for all factors, ensure calculations are correct based on T ...
              ],
              "analysis": {
                "summary": "Overall causal structure interpretation based on R+C / R-C values...", // Generated
                "dispatchers": [ // Factors with highest positive R-C
                    {"factor": "Factor C", "relation_value": 0.20, "reason": "Highest positive R-C indicates strongest net causal influence..."}
                    // Add others if R-C > 0 and relatively high
                ],
                "receivers": [ // Factors with lowest negative R-C
                    {"factor": "Factor A", "relation_value": -0.15, "reason": "Lowest negative R-C indicates primarily receiving influence..."}
                    // Add others if R-C < 0 and relatively low
                ],
                "key_factor": {"factor": "Factor C", "prominence_value": 2.40, "reason": "Highest R+C signifies most central role..."} // Factor with highest R+C
              },
              "business_recommendations": [ // Exactly 3 recommendations linked to analysis
                {
                  "recommendation": "Recommendation Title 1",
                  "focus_factor": "Targeted Factor Name (e.g., a Dispatcher)",
                  "rationale": "Why this action matters based on calculated R-C and summary...",
                  "action_items": ["Specific Step 1 based on context...", "Specific Step 2..."],
                  "kpis_to_track": ["Specific KPI 1 relevant to context...", "Specific KPI 2..."]
                },
                { // Rec 2
                  "recommendation": "Recommendation Title 2",
                  "focus_factor": "Targeted Factor Name",
                  "rationale": "Why this action matters based on calculated R-C and summary...",
                  "action_items": ["Specific Step 1 based on context...", "Specific Step 2..."],
                  "kpis_to_track": ["Specific KPI 1 relevant to context...", "Specific KPI 2..."]
                },
                { // Rec 3
                  "recommendation": "Recommendation Title 3",
                  "focus_factor": "Targeted Factor Name",
                  "rationale": "Why this action matters based on calculated R-C and summary...",
                  "action_items": ["Specific Step 1 based on context...", "Specific Step 2..."],
                  "kpis_to_track": ["Specific KPI 1 relevant to context...", "Specific KPI 2..."]
                }
              ]
            }
        `;

        // 3. Send Request to Ollama (using llama3.1 as per your function)
        console.log(`Sending ENHANCED NUMERICAL DEMATEL prompt to ${MODEL_NAME}...`);
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json", options: { num_ctx: 32768 } }) // Added options for context window
        });

        if (!response.ok) {
            let errorBody = `API error ${response.status}`;
            try { errorBody += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorBody);
        }

        const data = await response.json();
        let parsedData;
        console.log('Raw AI Response:', data.response); // Log raw response
        try {
            parsedData = JSON.parse(data.response);
             // *** Refined Robust Validation (for numerical approach) ***
             console.log('--- RAW AI JSON RESPONSE (Parsed - Enhanced Numerical DEMATEL) ---');
             console.log(JSON.stringify(parsedData, null, 2));
             console.log('------------------------------------');

             const nFactors = parsedData?.factors?.length || 0;
             const nRecs = parsedData?.business_recommendations?.length || 0;

             // Check basic structure and types
            if (!parsedData || typeof parsedData !== 'object') throw new Error("Response is not a valid object.");
            if (!Array.isArray(parsedData.factors) || nFactors < 3 || nFactors > 10) throw new Error(`Invalid or missing 'factors' array (length ${nFactors}).`);
            if (!Array.isArray(parsedData.total_influence_matrix) || parsedData.total_influence_matrix.length !== nFactors) throw new Error("Invalid or missing 'total_influence_matrix' or length mismatch.");
            if (!parsedData.total_influence_matrix.every(row => Array.isArray(row) && row.length === nFactors && row.every(val => typeof val === 'number'))) throw new Error("'total_influence_matrix' has incorrect structure or non-numeric values.");
            if (!Array.isArray(parsedData.influence_metrics) || parsedData.influence_metrics.length !== nFactors) throw new Error("Invalid or missing 'influence_metrics' or length mismatch.");
            if (nFactors > 0 && (typeof parsedData.influence_metrics[0] !== 'object' || typeof parsedData.influence_metrics[0].prominence !== 'number' || typeof parsedData.influence_metrics[0].relation !== 'number')) throw new Error("'influence_metrics' items lack required numeric fields.");
            if (typeof parsedData.analysis !== 'object' || !parsedData.analysis.summary || !Array.isArray(parsedData.analysis.dispatchers) || !Array.isArray(parsedData.analysis.receivers) || typeof parsedData.analysis.key_factor !== 'object') throw new Error("Invalid or missing 'analysis' structure.");
            if (!Array.isArray(parsedData.business_recommendations) || nRecs !== 3) throw new Error(`Invalid or missing 'business_recommendations' array or incorrect count (expected 3, got ${nRecs}).`);
            if (nRecs > 0 && (typeof parsedData.business_recommendations[0] !== 'object' || !parsedData.business_recommendations[0].focus_factor || !parsedData.business_recommendations[0].rationale)) throw new Error("'business_recommendations' items lack required fields.");

             console.log(`Successfully parsed ENHANCED NUMERICAL DEMATEL JSON using ${MODEL_NAME}. Found ${nFactors} factors, ${nRecs} recommendations.`);

        } catch (e) {
            console.error(`Failed to parse/validate ENHANCED NUMERICAL DEMATEL JSON using ${MODEL_NAME}:`, data?.response, e);
            throw new Error(`Invalid JSON received or validation failed (Enhanced Numerical): ${e.message}. See raw response in console.`);
        }

        // 4. Render Results (using the modified render function below)
        renderDematelAnalysisPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleDematelAnalysis (Enhanced Numerical) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops reliably
         if ($("generateSpinner") && !$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



function parseCSV(csvText) {
        const lines = csvText.trim().split("\n");
        const header = lines[0].split(",").map((h) => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim());
            if (values.length === header.length) {
                const row = {};
                for (let j = 0; j < header.length; j++) {
                    const value = values[j];
                    // Attempt to convert to number if possible
                    const numValue = parseFloat(value);
                    row[header[j]] = isNaN(numValue) ? value : numValue;
                }
                rows.push(row);
            }
        }
        return { header, rows };
}

export {
    handleDescriptiveAnalysis_DA,
    handlePredictiveAnalysis,
    handlePrescriptiveAnalysis_DA,
    handleVisualizationAnalysis_DA,
    handleRegressionAnalysis_DA,
    handlePlsAnalysis_DA,
    handleSemAnalysis,
    handleDematelAnalysis,
    parseCSV
}