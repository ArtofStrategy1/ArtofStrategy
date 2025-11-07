import { dom } from '../../utils/dom-utils.mjs';
import { appState } from '../../state/app-state.mjs';
import { setLoading } from '../../utils/ui-utils.mjs';
import * as renderSP from '../analysis-rendering/analysis-rendering-sp.mjs';

/**
 * UNIVERSAL MERGE FUNCTION (v7.1 - FIX)
 * - Checks if both async calls (Ollama + n8n) are complete.
 * - Checks `appState.currentTemplateId` to decide *how* to merge.
 * - Calls the correct renderer for the current tool.
 */
function attemptMergeAndRender() {
    // Check if both results are in
    if (!appState.pendingOllamaResult || !appState.pendingN8nResult) {
        console.log("Attempted merge, but one result is still pending...");
        const statusEl = dom.$("analysisStatus");
        if (statusEl) {
            if (appState.pendingOllamaResult) statusEl.textContent = "Deep analysis complete. Waiting for n8n workflow data...";
            if (appState.pendingN8nResult) statusEl.textContent = "n8n data received. Waiting for deep analysis from Ollama...";
        }
        return; // Not ready yet
    }

    console.log("Both n8n and Ollama results received. Merging...");
    
    let finalData;
    const analysisResultContainer = dom.$("analysisResult");

    if (appState.currentTemplateId === 'mission-vision') {
        // --- Merge Logic for Mission Vision ---
        finalData = appState.pendingOllamaResult; // Base is Ollama
        const secondaryData = appState.pendingN8nResult; // n8n data is secondary

        // Merge Values
        const baseValues = new Set(finalData.values.map(v => v.value.toLowerCase().trim()));
        secondaryData.values.forEach(v_str => {
            const clean_v_str = v_str.toLowerCase().trim();
            if (v_str && !baseValues.has(clean_v_str)) {
                finalData.values.push({ value: v_str, description: "Extracted from base analysis." });
                baseValues.add(clean_v_str); 
            }
        });

        // Merge Goals (n8n goals are objects now)
        const baseGoals = new Set(finalData.goals.map(g => g.goal_name.toLowerCase().trim()));
        secondaryData.goals.forEach(g_obj => {
            const goalString = g_obj.goal_name;
            if (!goalString) return; 
            const clean_g_str = goalString.toLowerCase().trim();
            
            if (!baseGoals.has(clean_g_str)) {
                finalData.goals.push(g_obj); // Add the *entire enriched object*
                baseGoals.add(clean_g_str); 
            }
        });
        
        // Render
        renderSP.renderMissionVisionPage(analysisResultContainer, finalData);

    } else if (appState.currentTemplateId === 'objectives') {
        // --- Merge Logic for Objectives ---
        // We just combine them into one object. No de-duplication needed.
        finalData = {
            ollama_data: appState.pendingOllamaResult, // The deep {main_goal, smart_objectives}
            n8n_data: appState.pendingN8nResult         // The array of table rows [{...}, {...}]
        };

        // Render
        renderSP.renderObjectivesPage(analysisResultContainer, finalData);
    
    } else {
        console.error(`AttemptMergeAndRender: Unknown appState.currentTemplateId: ${appState.currentTemplateId}`);
    }

    // --- 4. Clean up state ---
    appState.pendingOllamaResult = null;
    appState.pendingN8nResult = null;
    appState.currentAnalysisMessageId = null;
    appState.currentAnalysisContext = null; 
    setLoading("generate", false); 
}

export {
    attemptMergeAndRender
}
