// =====================================================================================================
// ===================               Data Analysis Handling Functions               ====================
// =====================================================================================================
import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import * as renderDA from '../ui/analysis-rendering/analysis-rendering-da.mjs';
import * as renderSEM from '../ui/analysis-rendering/analysis-rendering-sem.mjs';

async function handleDescriptiveAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Performing Full Descriptive Analysis...</h3><p class="text-white/80 mb-2">Calculating statistics, generating visualizations, and deriving insights...</p></div>`;
    setLoading("generate", true); // Set loading state

    try {
        // 1. Gather Inputs
        const dataFile = dom.$("descriptiveFile").files[0];
        const contextFile = dom.$("descriptiveContextFile").files[0];

        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }

        // 2. Prepare FormData for your Python backend
        const formData = new FormData();
        formData.append("analysis_type", "descriptive");
        formData.append("data_file", dataFile, dataFile.name);

        // Add the context file if it exists
        if (contextFile) {
            formData.append("context_file", contextFile, contextFile.name); 
            // NOTE: You will need to add `context_file: Optional[UploadFile] = File(None)` 
            // to your main.py router to accept this.
        }
        
        // We are NOT sending analysis_types, so the backend will run all of them.

        // 3. Call your FastAPI Backend (NOT Ollama)
        const API_URL = "https://analysis.data2int.com/api/data-analysis"; // Your main API endpoint
        
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            // Add Authorization headers if your API requires them
        });

        if (!response.ok) {
            let errorDetail = `API Error: ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.detail || `API Error: ${response.status}`;
            } catch (e) {
                // Fallback if error response isn't JSON
                errorDetail = `API Error: ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        const parsedData = await response.json();
        
        // 4. Check if the backend returned its *own* error
        if (parsedData.error) {
            throw new Error(`Backend Analysis Error: ${parsedData.error}`);
        }

        // 5. Pass the *entire response* to your teammate's render function
        // This is the critical step. We are now trusting the Python backend
        // to send the *exact* JSON structure that renderDescriptivePage_DA expects.
        renderDA.renderDescriptivePage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleDescriptiveAnalysis_DA:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    }
    // 'finally' block is not needed here because setLoading(false) is handled 
    // by renderDescriptivePage_DA on success and by the catch block on error.
}



/**
 * Handles the Predictive Analysis request.
 * Gathers data and parameters (using the assumed first column as the date column),
 * sends them to the backend API, and calls the rendering function upon receiving results.
 */
async function handlePredictiveAnalysis() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Running Predictive Analysis...</h3><p class="text-white/80 mb-2">Please wait while the forecast is generated.</p></div>`;
    setLoading("generate", true);
    dom.$("analysisActions").classList.add("hidden");

    try {
        // --- 1. Get Inputs from UI ---
        const dataFile = dom.$("predictiveFile").files[0];
        const dataText = dom.$("predictiveDataText").value.trim();
        const isUsingFile = dom.$("predictiveInputFileToggle").checked;

        // --- *** MODIFICATION START *** ---
        // Get the assumed date column name from the span where it's displayed
        const assumedDateColNameSpan = dom.$("assumedDateColName");
        const dateColumn = assumedDateColNameSpan ? assumedDateColNameSpan.textContent : null;
        // --- *** MODIFICATION END *** ---

        // Get other selected parameters
        const targetColumn = dom.$("predictiveTargetColumn").value;
        const forecastPeriods = dom.$("predictiveForecastPeriods").value; // Send as string
        const confidenceLevel = dom.$("predictiveConfidenceLevel").value; // Send as string
        const modelType = dom.$("predictiveModelType").value; // Send as string

        // --- 2. Validate Inputs ---
        // --- *** MODIFICATION START *** ---
        // Validate the *retrieved* date column name
        if (!dateColumn || dateColumn === "..." || dateColumn === "N/A" || dateColumn === "Error") {
            throw new Error("Could not determine the Date Column. Please ensure data is loaded correctly.");
        }
        // --- *** MODIFICATION END *** ---
        if (!targetColumn) {
            throw new Error("Please select the Target Variable column.");
        }
        if (dateColumn === targetColumn) {
             throw new Error("Date Column and Target Variable must be different.");
        }

        let fileToSend = null;
        let dataContentToSend = null;

        // Determine data source (same as before)
        if (isUsingFile) {
            if (!dataFile) { throw new Error("Please upload a data file (.csv or .xlsx)."); }
            const allowedExtensions = ['.csv', '.xlsx', '.xls'];
            const fileExt = dataFile.name.substring(dataFile.name.lastIndexOf('.')).toLowerCase();
            if (!allowedExtensions.includes(fileExt)) { throw new Error("Invalid file type. Please upload a CSV or Excel file."); }
            fileToSend = dataFile;
        } else {
            if (!dataText) { throw new Error("Please paste your CSV data into the text area."); }
            dataContentToSend = dataText;
        }

        // --- 3. Prepare FormData for Backend ---
        const formData = new FormData();
        formData.append("analysis_type", "predictive");

        // Append data source (same as before)
        if (fileToSend) { formData.append("data_file", fileToSend, fileToSend.name); }
        else if (dataContentToSend) { formData.append("data_text", dataContentToSend); }
        else { throw new Error("No data source (file or text) is available."); }

        // Append parameters (sending the *retrieved* dateColumn)
        formData.append("dateColumn", dateColumn); // Sends the assumed date column name
        formData.append("targetColumn", targetColumn);
        formData.append("forecastPeriods", forecastPeriods);
        formData.append("confidenceLevel", confidenceLevel);
        formData.append("modelType", modelType);

        // --- 4. Send Request to Backend API ---
        const API_URL = "https://analysis.data2int.com/api/data-analysis";
        console.log("Sending Predictive Analysis request to:", API_URL);

        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            // headers: { 'Authorization': `Bearer ${your_auth_token}` } // Add if needed
        });

        // --- 5. Handle Backend Response ---
        if (!response.ok) {
            let errorDetail = `API request failed (${response.status} ${response.statusText})`;
            try {
                const errorJson = await response.json();
                errorDetail += `: ${errorJson.detail || JSON.stringify(errorJson)}`;
            } catch (e) { try { errorDetail += `: ${await response.text()}`; } catch(readErr) {} }
            throw new Error(errorDetail);
        }

        const parsedData = await response.json();
        console.log("Received predictive analysis results:", parsedData);

        // Call the rendering function
        renderDA.renderPredictiveAnalysisPage(dom.$("analysisResult"), parsedData); // Assumes this function exists and works

    } catch (error) {
        console.error("Error during Predictive Analysis:", error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
        setLoading("generate", false); // Turn off loading state
    }
}



async function handlePrescriptiveAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Running Enhanced Prescriptive Analysis...</h3><p class="text-white/80 mb-2">Linking data insights directly to actionable recommendations...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "qwen3:30b-a3b"; // Use Qwen for potentially better numerical accuracy
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const businessGoal = dom.$("prescriptiveGoal").value.trim();
        const file = dom.$("prescriptiveFile").files[0];

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
        renderDA.renderPrescriptivePage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePrescriptiveAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleVisualizationAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Generating Advanced Visualizations...</h3><p class="text-white/80 mb-2">Analyzing data, selecting optimal charts, and crafting insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "llama3.1:latest"; // Use Qwen for potentially better numerical accuracy / chart logic
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const vizRequest = dom.$("vizRequest").value.trim();
        const file = dom.$("vizFile").files[0];

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
        renderDA.renderVisualizationPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleVisualizationAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}



async function handleRegressionAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Running Comprehensive Regression...</h3><p class="text-white/80 mb-2">Building model, running diagnostics, and generating actionable insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "llama3.1:latest"; // Use Qwen for potentially better numerical accuracy
    // const MODEL_NAME = "llama3.1:latest"; // Alternative option

    try {
        // 1. Gather Inputs
        const dependentVar = dom.$("dependentVar").value.trim();
        const independentVarsRaw = dom.$("independentVars").value.trim();
        const dataFile = dom.$("regressionFile").files[0];
        const contextFile = dom.$("regressionContextFile").files[0];

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
        renderDA.renderRegressionPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleRegressionAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}




async function handlePlsAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Running Comprehensive PLS-SEM...</h3><p class="text-white/80 mb-2">Estimating paths, evaluating model fit, and generating insights...</p></div>`;
    setLoading("generate", true);

    // Define URL and Model
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    // *** CHOOSE MODEL: qwen or llama ***
    const MODEL_NAME = "qwen3:30b-a3b"; // Qwen might be better for structured analysis
    // const MODEL_NAME = "llama3.1:latest"; // Alternative

    try {
        // 1. Gather Inputs
        const measurementModel = dom.$("plsMeasurementModel").value.trim();
        const structuralModel = dom.$("plsStructuralModel").value.trim();
        const file = dom.$("plsFile").files[0];

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
        renderDA.renderPlsPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePlsAnalysis_DA (Enhanced) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    } finally {
        // Ensure loading stops
         if (dom.$("generateSpinner") && !dom.$("generateSpinner").classList.contains("hidden")) {
            setLoading("generate", false);
         }
    }
}    



/**
 * Handles the submission of the SEM analysis request to the backend.
 * Sends data (file or text) and separate measurement/structural syntax.
 */
async function handleSemAnalysis() {
    const analysisResultContainer = dom.$("analysisResult"); // Get the results container element
    // Display loading indicator
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><h3 class="text-xl font-semibold text-white">Running Structural Equation Model...</h3></div>`;
    setLoading("generate", true); // Assumes setLoading function exists to disable button and show spinner

    try {
        // --- 1. Get Inputs from UI ---
        const measurementSyntax = dom.$("semMeasurementSyntax").value.trim();
        const structuralSyntax = dom.$("semStructuralSyntax").value.trim();
        const dataFile = dom.$("semFile").files[0]; // Get the selected file object
        const dataText = dom.$("semDataText").value.trim(); // Get pasted text
        const isUsingFile = dom.$("semInputFileToggle").checked; // Check which input type is selected

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
        const API_URL = "https://analysis.data2int.com/api/data-analysis"; // Example URL

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
        renderSEM.renderSemAnalysisPage(analysisResultContainer, parsedData);

    } catch (error) { // Catch errors from input validation, fetch, or response handling
        console.error("Error during SEM analysis:", error);
        // Display the error message in the results container
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
        // Ensure loading indicator is turned off regardless of success or failure
        setLoading("generate", false); // Assumes setLoading function exists
    }
}


    
/**
 * Handles the DEMATEL analysis request.
 * --- THIS IS THE "REAL" VERSION - v2 ---
 * Step 1: Gets user text and sends it to OLLAMA with a highly-structured,
 * "chain-of-thought" prompt to force accurate factor/matrix generation.
 * Step 2: Sends the OLLAMA result to our Python backend for math.
 * Step 3: Renders the final result from the Python backend.
 */
async function handleDematelAnalysis() {
    // API URLs
    const OLLAMA_URL = "https://ollama.data2int.com/api/generate";
    const PYTHON_BACKEND_URL = "https://analysis.data2int.com/api/data-analysis";
    
    // Model to use for AI analysis
    const MODEL_NAME = "llama3.1:latest"; // Sticking with Llama 3.1

    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Starting DEMATEL Analysis...</h3><p class="text-white/80 mb-2">Please wait...</p></div>`;
    
    // Get references to input elements
    const textInput = dom.$("dematelContent");
    const fileInput = dom.$("dematelFile");
    const textError = dom.$("dematelTextError");
    const fileError = dom.$("dematelFileError");

    // Determine input type
    const isFileInput = dom.$("dematelInputFileToggle").checked;
    
    // Clear previous errors
    textError.textContent = "";
    fileError.textContent = "";

    try {
        // 1. Set loading state
        setLoading("generate", true); 
        analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Step 1/3: Reading and Understanding Text...</h3><p class="text-white/80 mb-2">Extracting key factors from your document...</p></div>`;

        // 2. Get User Text (from file or textarea)
        let userText = "";
        if (isFileInput) {
            const file = fileInput.files[0];
            if (!file) throw new Error("Please select a .txt or .docx file.");
            userText = await extractTextFromFile(file); 
        } else {
            userText = textInput.value.trim();
            if (!userText) throw new Error("Please enter a system or problem description.");
        }
        
        // Truncate if necessary (Llama 3.1 has a large context)
        const MAX_CONTEXT_LENGTH = 16000;
        if (userText.length > MAX_CONTEXT_LENGTH) {
            console.warn(`Text truncated to ${MAX_CONTEXT_LENGTH} characters for analysis.`);
            userText = userText.substring(0, MAX_CONTEXT_LENGTH);
        }

        // 3. --- STEP 1: CALL OLLAMA (with new, much better prompt) ---
        analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Step 2/3: Generating Influence Matrix...</h3><p class="text-white/80 mb-2">AI is quantifying the causal relationships (this may take a moment)...</p></div>`;

        // --- NEW ADVANCED PROMPT ---
        const prompt = `
            You are a meticulous DEMATEL analyst. Your task is to perform a rigorous analysis of the provided text.

            **USER TEXT:**
            """
            ${userText}
            """

            **YOUR TASKS (Follow this order):**

            **TASK 1: Extract Factors**
            First, carefully read the text and identify the key named factors. List them.
            *Example:*
            * Factors: ["Factor 1", "Factor 2", "Factor 3"]

            **TASK 2: Analyze Relationships (Chain of Thought)**
            Second, think step-by-step. For each *pair* of factors, analyze the influence from the row factor to the column factor.
            - Use this scale ONLY: 0=No, 1=Low, 2=Moderate, 3=Strong, 4=Very Strong.
            - You MUST justify your rating with a quote or direct inference from the text.
            - If the text does not describe an influence, the rating MUST be 0.
            
            *Example of thinking process:*
            * (Factor 1 -> Factor 1): 0 (Self-influence is zero)
            * (Factor 1 -> Factor 2): Rating 3 (Strong). Justification: The text states "Factor 1 strongly influences Factor 2."
            * (Factor 1 -> Factor 3): Rating 0. Justification: The text does not mention any relationship.
            * (Factor 2 -> Factor 1): Rating 1 (Low). Justification: The text implies "Factor 2 has some small impact on Factor 1."
            * ... (continue for all pairs)

            **TASK 3: Create Final JSON**
            Finally, use your step-by-step analysis to build the final JSON object.
            - The "factors" list must match the factors you identified.
            - The "matrix" must be an N x N matrix corresponding to your justified ratings.
            - The matrix row/column order MUST match the factor list order.

            You must return ONLY the valid JSON object. Do not add any other text or explanations outside the JSON structure.

            **JSON FORMAT:**
            {
              "factors": [
                "Factor Name 1",
                "Factor Name 2",
                "..."
              ],
              "matrix": [
                [0, 3, 0, ...], 
                [1, 0, 0, ...],
                [...],
                ...
              ]
            }
        `;
        // --- END OF NEW PROMPT ---

        const ollamaResponse = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL_NAME, prompt: prompt, stream: false, format: "json" })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama AI server error: ${ollamaResponse.statusText}`);
        }

        const ollamaResult = await ollamaResponse.json();
        let aiData;
        try {
            aiData = JSON.parse(ollamaResult.response);
            if (!aiData.factors || !aiData.matrix || !Array.isArray(aiData.factors) || !Array.isArray(aiData.matrix)) {
                throw new Error("AI response missing 'factors' or 'matrix' key, or they are not arrays.");
            }
            if (aiData.factors.length !== aiData.matrix.length) {
                throw new Error("AI returned a matrix size that does not match the factors list.");
            }
        } catch (e) {
            console.error("Failed to parse AI response:", ollamaResult.response);
            throw new Error(`AI returned invalid JSON. Error: ${e.message}`);
        }

        // 4. --- STEP 2: CALL PYTHON BACKEND ---
        analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div></div><div></div><div></div></div><h3 class="text-xl font-semibold text-white">Step 3/3: Calculating DEMATEL Mathematics...</h3><p class="text-white/80 mb-2">Running matrix calculations and generating insights...</p></div>`;
        
        const backendFormData = new FormData();
        backendFormData.append("analysis_type", "dematel");
        backendFormData.append("dematel_factors", JSON.stringify(aiData.factors));
        backendFormData.append("dematel_matrix", JSON.stringify(aiData.matrix));

        const backendResponse = await fetch(PYTHON_BACKEND_URL, {
            method: "POST",
            body: backendFormData,
        });

        if (!backendResponse.ok) {
            let errorDetail = `Python Backend Error: ${backendResponse.statusText}`;
            try {
                const errorData = await backendResponse.json();
                errorDetail = errorData.detail || `Python Backend Error: ${backendResponse.statusText}`;
            } catch (e) {}
            throw new Error(errorDetail);
        }

        // 5. Process Final Response
        const finalResults = await backendResponse.json();

        // Check for the *data* object, not the HTML
        if (finalResults.analysis_insights && finalResults.chart_data) {
            renderDA.renderDematelAnalysisPage(finalResults);
        } else {
            throw new Error("Received an invalid response from the Python backend.");
        }

    } catch (error) {
        console.error("DEMATEL Analysis Error:", error);
        const errorMessage = error.message || "An unknown error occurred.";
        
        analysisResultContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
        
        if (isFileInput) {
            fileError.textContent = errorMessage;
        } else {
            textError.textContent = errorMessage;
        }

    } finally {
        // 6. Reset loading state
        setLoading("generate", false);
    }
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
}