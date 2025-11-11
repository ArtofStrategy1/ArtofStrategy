// =====================================================================================================
// ===================               Data Analysis Handling Functions               ====================
// =====================================================================================================
import { appState } from "../state/app-state.mjs";
import { dom } from '../utils/dom-utils.mjs';
import { setLoading } from '../utils/ui-utils.mjs';
import { extractTextFromFile } from '../utils/file-utils.mjs';
import { renderPredictiveAnalysisPage } from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-predictive.mjs';
import { renderAdvancedRegressionPage } from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-regression.mjs';
import { renderPlsPage_DA } from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-pls.mjs';
import { renderSemAnalysisPage } from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-sem.mjs';
import { renderDematelAnalysisPage } from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-dematel.mjs';
import * as renderDA from '../ui/analysis-rendering/analysis-rendering-da/analysis-rendering-da.mjs';

async function handleDescriptiveAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div><h3 class="text-xl font-semibold text-white mb-4">Performing Full Descriptive Analysis...</h3><p class="text-white/80 mb-2">Calculating statistics, generating visualizations, and deriving insights...</p></div>`;
    setLoading("generate", true); // Set loading state

    try {
        // 1. Gather Inputs
        const dataFile = dom.$("descriptiveFile").files[0];
        
        const useDoc = dom.$("docUpload").checked;
        let contextFile = null;
        let contextText = "";

        if (useDoc) {
            contextFile = dom.$("descriptiveContextFile").files[0];
            if (!contextFile) {
                throw new Error("❌ You selected 'Document Upload' but did not select a context file.");
            }
        } else {
            contextText = dom.$("descriptiveContextText").value.trim();
            if (!contextText) {
                throw new Error("❌ Please paste your context into the text area or select 'Document Upload' to upload a file.");
            }
        }

        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }

        // 2. Prepare FormData for your Python backend
        const formData = new FormData();
        formData.append("analysis_type", "descriptive");
        formData.append("data_file", dataFile, dataFile.name);

        // --- MODIFIED: Add context file or context text blob ---
        if (contextFile) {
            // Add the context file if it exists
            formData.append("context_file", contextFile, contextFile.name); 
        } else if (contextText) {
            // Convert text to a Blob and append it as a file
            const contextBlob = new Blob([contextText], { type: 'text/plain' });
            formData.append("context_file", contextBlob, "context_input.txt");
        }
        
        // 3. Call your FastAPI Backend (NOT Ollama)
        const API_URL = "https://analysis.data2int.com/api/descriptive"; // Your main API endpoint
        
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
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

        // 5. Pass the entire response to render function
        renderDA.renderDescriptivePage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleDescriptiveAnalysis_DA:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    }
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
        const API_URL = "https://analysis.data2int.com/api/predictive";
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
        renderPredictiveAnalysisPage(dom.$("analysisResult"), parsedData); // Assumes this function exists and works

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
    dom.$("analysisActions").classList.add("hidden");
    
    // Updated API URL for backend
    const API_URL = "https://analysis.data2int.com/api/prescriptive";

    try {
        // 1. Gather Inputs
        
        // === TOGGLE LOGIC (UNCHANGED) ===
        const isUsingFile = dom.$("prescriptiveInputFileToggle").checked;
        let businessGoal = "";
        let contextFile = null;
        
        if (isUsingFile) {
            // User selected file upload
            contextFile = dom.$("prescriptiveContextFile").files[0];
            if (contextFile) {
                // For backend, we'll send the file and let the backend extract the text
                businessGoal = ""; // Backend will read from context_file
            } else {
                throw new Error("❌ Please upload a context document when using file upload mode.");
            }
        } else {
            // User selected text input
            businessGoal = dom.$("prescriptiveGoalText").value.trim();
            if (!businessGoal) {
                throw new Error("❌ Please describe your business goal.");
            }
        }
        // === END TOGGLE LOGIC ===
        
        const dataFile = dom.$("prescriptiveFile").files[0];
        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }

        // 2. Prepare FormData for backend API
        const formData = new FormData();
        formData.append("data_file", dataFile, dataFile.name);
        
        if (businessGoal) {
            formData.append("business_goal", businessGoal);
        } else {
            // If using file upload mode, we need a placeholder business goal
            // The backend will read the actual goal from context_file
            formData.append("business_goal", "See attached context file");
        }
        
        if (contextFile) {
            formData.append("context_file", contextFile, contextFile.name);
        }

        // 3. Send Request to Python Backend
        console.log(`Sending Prescriptive Analysis request to Python backend at ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            let errorDetail = `API Error: ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.detail || `API Error: ${response.status} - ${response.statusText}`;
            } catch (e) {
                errorDetail = `API Error: ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        const parsedData = await response.json();
        
        // Check if the backend returned an error
        if (parsedData.metadata && parsedData.metadata.error) {
            throw new Error(`Backend Analysis Error: ${parsedData.metadata.error_message}`);
        }

        // 4. Validate the response structure
        if (!parsedData.data_insights || !Array.isArray(parsedData.data_insights) || parsedData.data_insights.length < 1) {
            throw new Error("Invalid response structure: Missing or insufficient data insights");
        }
        
        if (!parsedData.prescriptions || !Array.isArray(parsedData.prescriptions) || parsedData.prescriptions.length < 1) {
            throw new Error("Invalid response structure: Missing or insufficient prescriptions");
        }

        console.log(`Successfully received prescriptive analysis with ${parsedData.data_insights.length} insights and ${parsedData.prescriptions.length} prescriptions.`);

        // 5. Render Results using existing render function
        renderDA.renderPrescriptivePage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handlePrescriptiveAnalysis_DA (Backend):`, error);
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
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Performing Visualization Analysis...</h3><p class="text-white/80 mb-2">Loading data, performing calculations, and generating insights...</p></div>`;
    setLoading("generate", true);
    dom.$("analysisActions").classList.add("hidden");
    const API_URL = "https://analysis.data2int.com/api/visualization";
    const MODEL_NAME = "llama3.1:latest";
    
    try {
        // 1. Gather Inputs
        
        // === ADDED TOGGLE LOGIC START ===
        // Check which input type is selected
        const isUsingFile = dom.$("vizInputFileToggle").checked;
        let vizRequestText = "";
        
        if (isUsingFile) {
            // User selected file upload - we'll handle the file differently
            const contextFile = dom.$("vizContextFile").files[0];
            // For now, we'll leave vizRequestText empty when using file
        } else {
            // User selected text input - use the original logic
            vizRequestText = dom.$("vizRequestText").value.trim();
        }
        // === ADDED TOGGLE LOGIC END ===
        
        const dataFile = dom.$("vizFile").files[0];
        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }
        // 2. Prepare FormData
        const formData = new FormData();
        formData.append("data_file", dataFile, dataFile.name);
        
        // === MODIFIED CONTEXT HANDLING START ===
        // 3. Cleverly handle the context text or file:
        if (isUsingFile) {
            // If user selected file upload, attach the context file directly
            const contextFile = dom.$("vizContextFile").files[0];
            if (contextFile) {
                formData.append("context_file", contextFile, contextFile.name);
                console.log("Attaching user uploaded context file.");
            }
        } else {
            // If user selected text input, convert the text from the <textarea> into a Blob
            if (vizRequestText) {
                const contextBlob = new Blob([vizRequestText], { type: 'text/plain' });
                formData.append("context_file", contextBlob, "visualization_context.txt");
                console.log("Attaching user request text as context_file.");
            }
        }
        // === MODIFIED CONTEXT HANDLING END ===
        
        // 4. We are NOT sending chart_configs, so the backend will auto-generate
        // formData.append("chart_configs", JSON.stringify([...])); 
        // 5. Send Request to Python Backend
        console.log(`Sending Visualization request to Python backend at ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            // Add Authorization headers if your API requires them
        });

        if (!response.ok) {
            let errorDetail = `API Error: ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.detail || `API Error: ${response.status} - ${response.statusText}`;
            } catch (e) {
                errorDetail = `API Error: ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        const parsedData = await response.json();
        
        // Check if the backend returned its *own* error
        if (parsedData.metadata && parsedData.metadata.error) {
            throw new Error(`Backend Analysis Error: ${parsedData.metadata.error_message}`);
        }

        // 6. Render Results
        // We now call the new renderer function that can handle the backend's JSON structure
        renderDA.renderVisualizationPage_DA(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleVisualizationAnalysis_DA (Backend) using ${MODEL_NAME}:`, error);
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">❌ An error occurred: ${error.message}</div>`;
        setLoading("generate", false);
    }
    // 'finally' block is not needed here; setLoading(false) is handled
    // by the renderer on success and the catch block on error.
}



async function handleRegressionAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult");
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"> <div></div><div></div><div></div> </div><h3 class="text-xl font-semibold text-white mb-4">Running scikit-learn Regression...</h3><p class="text-white/80 mb-2">Sending data to Python backend for statistical analysis...</p></div>`;
    setLoading("generate", true);
    dom.$("analysisActions").classList.add("hidden");

    const API_URL = "https://analysis.data2int.com/api/regression"; // FastAPI endpoint
    
    // --- NEW: Get the warning div ---
    const warningEl = dom.$("regressionDataWarning");
    if (warningEl) warningEl.textContent = ""; // Clear previous warnings

    try {
        // --- 1. Gather Inputs from UI Elements ---
        const dependentVar = dom.$("dependentVar").value;
        
        const independentVarCheckboxes = document.querySelectorAll("#independentVarsContainer .independent-var-checkbox:checked");
        const independentVarsList = Array.from(independentVarCheckboxes).map(cb => cb.value);

        const dataFile = dom.$("regressionFile").files[0];
        
        // --- MODIFIED BLOCK START: Get Context ---
        const useDoc = dom.$("docUpload").checked;
        let contextFile = null;
        let contextText = "";

        if (useDoc) {
            contextFile = dom.$("regressionContextFile").files[0];
            // Note: We don't require the context file, so no error if it's missing.
        } else {
            contextText = dom.$("regressionContextText").value.trim();
            // Note: We don't require the context text.
        }
        // --- MODIFIED BLOCK END ---

        // 2. Validate Inputs
        if (!dataFile) {
            throw new Error("❌ Please upload a CSV data file.");
        }
        if (!dependentVar) {
            throw new Error("❌ Please select a Dependent Variable (Y).");
        }
        if (independentVarsList.length === 0) {
                throw new Error("❌ Please select at least one Independent Variable (X).");
        }
        if (independentVarsList.includes(dependentVar)) {
            throw new Error("❌ The Dependent Variable cannot also be an Independent Variable.");
        }

        const numFeatures = independentVarsList.length;
        const numObservations = appState.currentRegressionRowCount; // Get stored row count
        const ratio = numObservations / numFeatures;

        console.log(`Validation: ${numObservations} observations, ${numFeatures} features. Ratio: ${ratio}`);

        if (numObservations < 30) {
            throw new Error(`❌ Insufficient Data: You have only ${numObservations} rows. A minimum of 30 is recommended for basic regression.`);
        }
        if (ratio < 10) {
            throw new Error(`❌ Insufficient Data Ratio: You have ${numObservations} observations for ${numFeatures} features (a ratio of ${ratio.toFixed(1)}-to-1). A 10-to-1 ratio (or ${numFeatures * 10} rows) is recommended.`);
        }

        // 3. Prepare FormData for the backend
        const formData = new FormData();
        
        // Append files
        formData.append("data_file", dataFile, dataFile.name);

        if (contextFile) {
            // If user uploaded a file, append it
            formData.append("context_file", contextFile, contextFile.name);
        } else if (contextText) {
            // If user typed text, create a Blob and append it as a file
            const contextBlob = new Blob([contextText], { type: 'text/plain' });
            formData.append("context_file", contextBlob, "context_input.txt");
        }
        
        // Append simple text fields
        formData.append("target_column", dependentVar);

        // Convert and append fields that backend expects as JSON strings
        formData.append("feature_columns", JSON.stringify(independentVarsList));
        
        // 4. Send Request to Python Backend
        console.log(`Sending Regression request to Python backend at ${API_URL}...`);
        
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
        });

        // 5. Handle Response
        const parsedData = await response.json(); // Get JSON response regardless of status

        if (!response.ok) {
            // Handle HTTP errors (4xx, 5xx)
            const errorMsg = parsedData.detail || `API Error: ${response.status} - ${response.statusText}`;
            throw new Error(errorMsg);
        }

        // Check for application-level errors
        if (parsedData.metadata && parsedData.metadata.error === true) {
            console.error("Backend analysis failed:", parsedData.metadata.error_message);
            throw new Error(`Backend Analysis Error: ${parsedData.metadata.error_message}`);
        }

        // 6. Render Results
        renderAdvancedRegressionPage(analysisResultContainer, parsedData);

    } catch (error) {
        console.error(`Error in handleRegressionAnalysis_DA (Backend):`, error);
        const errorMessage = error.message;

        // --- MODIFIED ERROR HANDLING ---
        // Check if it's one of our new validation errors
        if (errorMessage.startsWith("❌")) {
                if (warningEl) {
                warningEl.textContent = errorMessage.substring(2); // Display it by the input
                warningEl.className = "text-red-400 text-sm mt-2"; // Make it red
                }
                analysisResultContainer.innerHTML = '<div class="text-white/60 p-8 text-center">Analysis stopped due to data issues.</div>'; // Reset results panel
        } else {
            // It's a different error, show it in the main results box
            analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400"><strong>Error:</strong> ${errorMessage}</div>`;
        }
        // --- END MODIFIED BLOCK ---

    } finally {
        setLoading("generate", false);
    }
}




/**
 * Handles the PLS-SEM analysis request to the backend.
 * Reads from the advanced UI (file/text toggle, syntax boxes).
 */
async function handlePlsAnalysis_DA() {
    const analysisResultContainer = dom.$("analysisResult"); // Get the results container element
    // Display loading indicator
    analysisResultContainer.innerHTML = `<div class="text-center text-white/70 p-8"><div class="typing-indicator mb-6"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><h3 class="text-xl font-semibold text-white">Running PLS-SEM Analysis...</h3><p class="text-white/80 mb-2">Please wait while the model is estimated.</p></div>`;
    setLoading("generate", true); // Assumes setLoading function exists

    try {
        // --- 1. Get Inputs from UI (using 'pls' IDs) ---
        const measurementSyntax = dom.$("plsMeasurementSyntax").value.trim();
        const structuralSyntax = dom.$("plsStructuralSyntax").value.trim();
        const dataFile = dom.$("plsFile").files[0]; // Get the selected file object
        const dataText = dom.$("plsDataText").value.trim(); // Get pasted text
        const isUsingFile = dom.$("plsInputFileToggle").checked; // Check which input type is selected

        let fileToSend = null;
        let dataContentToSend = null; 

        // --- 2. Validate Inputs & Prepare Data Source ---
        if (isUsingFile) {
            if (!dataFile) {
                throw new Error("Please upload a data file (.csv or .xlsx).");
            }
            fileToSend = dataFile;
        } else {
            if (!dataText) {
                throw new Error("Please paste your CSV data into the text area.");
            }
            dataContentToSend = dataText; 
        }

        // Validate that at least one syntax part is provided
        if (!measurementSyntax && !structuralSyntax) {
            throw new Error("Please provide Measurement Model Syntax and/or Structural Model Syntax.");
        }

        // --- 3. Prepare FormData for Backend ---
        const formData = new FormData();
        formData.append("analysis_type", "pls"); // Identify the analysis type

        // Send SYNTAX parts SEPARATELY
        formData.append("measurement_syntax", measurementSyntax);
        formData.append("structural_syntax", structuralSyntax);

        // Append the data source (either the file or the text content)
        if (fileToSend) {
            // If sending a file
            formData.append("data_file", fileToSend, fileToSend.name);
        } else if (dataContentToSend) {
            // If sending raw text content
             formData.append("data_text", dataContentToSend);
        } else {
            throw new Error("No data source (file or text) could be prepared.");
        }


        // --- 4. Send Request to Backend API ---
        // *** This now points to your PLS endpoint ***
        const API_URL = "https://analysis.data2int.com/api/pls"; 

        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            // headers: { 'Authorization': `Bearer ${your_auth_token}` } // Add if needed
        });

        // --- 5. Handle Backend Response ---
        if (!response.ok) {
            // Attempt to get detailed error message from backend
            let errorDetail = `API request failed (${response.status})`;
            try {
                const errorJson = await response.json(); // Assumes backend sends JSON errors
                errorDetail += `: ${errorJson.detail || JSON.stringify(errorJson)}`; // Use specific 'detail' field
            } catch (e) {
                // If response is not JSON, use the raw text
                try {
                    errorDetail += `: ${await response.text()}`;
                } catch (readErr) {}
            }
            throw new Error(errorDetail); // Throw error to be caught below
        }

        // If response is OK (2xx status)
        const parsedData = await response.json(); // Expecting JSON response with results

        // Render the results using the PLS-specific rendering function
        renderPlsPage_DA(analysisResultContainer, parsedData);

    } catch (error) { // Catch errors from input validation, fetch, or response handling
        console.error("Error during PLS-SEM analysis:", error);
        // Display the error message in the results container
        analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
        // Ensure loading indicator is turned off regardless of success or failure
        setLoading("generate", false);
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
        const API_URL = "https://analysis.data2int.com/api/sem"; // Example URL

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
    const PYTHON_BACKEND_URL = "https://analysis.data2int.com/api/dematel";
    
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
            renderDematelAnalysisPage(finalResults);
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