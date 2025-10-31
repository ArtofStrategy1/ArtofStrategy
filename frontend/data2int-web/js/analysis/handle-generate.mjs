import { appState } from "../state/app-state.mjs";
import { appConfig } from "../config.mjs";
import { dom } from "../utils/dom-utils.mjs";
import { setLoading } from "../utils/ui-utils.mjs";
import { getFrameworkForTemplate, getSelectedSections } from "../ui/template-creation/framework-selection.mjs";
import * as handleSP from "./analysis-handling-sp.mjs";
import * as handleST from "./analysis-handling-st.mjs";
import * as handleNS from "./analysis-handling-ns.mjs";
import * as handleDA from "./analysis-handling-da.mjs";
async function handleGenerate() {
    if (!appState.currentTemplateId) return;

    const analysisResultContainer = dom.$("analysisResult");
    setLoading("generate", true);
    const analysisActionsEl = dom.$("analysisActions");
    if (analysisActionsEl) {
        analysisActionsEl.classList.add("hidden");
    }

    if (appState.currentTemplateId === "swot-tows") {
        await handleSP.handleSwotTowsAnalysis();
    } else if (appState.currentTemplateId === "archetype-analysis") {
        await handleST.handleArchetypeAnalysis();
    } else if (appState.currentTemplateId === "leverage-points") {
        await handleST.handleLeveragePointsAnalysis();
    } else if (appState.currentTemplateId === "visualization") {
        // <-- ADD THIS BLOCK
        await handleDA.handleVisualizationAnalysis_DA();
    } else if (appState.currentTemplateId === "prescriptive-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handlePrescriptiveAnalysis_DA();
    } else if (appState.currentTemplateId === "thinking-system") {
        // <-- ADD THIS BLOCK
        await handleNS.handleThinkingSystemAnalysis_NS();
    } else if (appState.currentTemplateId === "creative-dissonance") {
        // <-- ADD THIS BLOCK
        await handleNS.handleCreativeDissonanceAnalysis_NS();
    } else if (appState.currentTemplateId === "pareto-fishbone") {
        await handleST.handleParetoFishboneAnalysis();
    } else if (appState.currentTemplateId === "system-actions") {
        // <-- ADD THIS BLOCK
        await handleST.handleSystemActionsAnalysis_ST();
    } else if (appState.currentTemplateId === "goals-initiatives") {
        await handleSP.handleGoalsAndInitiativesAnalysis_SP();
    } else if (appState.currentTemplateId === "living-system") {
        // <-- ADD THIS BLOCK
        await handleNS.handleLivingSystemAnalysis_NS();
    } else if (appState.currentTemplateId === "system-objectives") {
        // <-- ADD THIS BLOCK
        await handleST.handleSystemObjectivesAnalysis_ST();
    } else if (appState.currentTemplateId === "pls-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handlePlsAnalysis_DA();
    } else if (appState.currentTemplateId === "sem-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleSemAnalysis();
    } else if (appState.currentTemplateId === "predictive-analysis") {
        await handleDA.handlePredictiveAnalysis();
    } else if (appState.currentTemplateId === "dematel-analysis") {
        await handleDA.handleDematelAnalysis();
    } else if (appState.currentTemplateId === "descriptive-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleDescriptiveAnalysis_DA();
    } else if (appState.currentTemplateId === "kpi-events") {
        await handleSP.handleKpiAnalysis_KE();
    } else if (appState.currentTemplateId === "regression-analysis") {
        // <-- ADD THIS BLOCK
        await handleDA.handleRegressionAnalysis_DA();
    } else if (appState.currentTemplateId === "novel-goals-initiatives") {
        // <-- ADD THIS BLOCK
        await handleNS.handleNovelGoalsAnalysis_NS();
    } else if (appState.currentTemplateId === "misc-summary") {
        await handleSP.handleMiscAnalysis_MSC();
    } else if (appState.currentTemplateId === "action-plans") {
        await handleSP.handleActionPlansAnalysis_AP();
    } else if (appState.currentTemplateId === "factor-analysis") {
        await handleSP.handleFactorAnalysis();
    } else if (appState.currentTemplateId === "system-goals-initiatives") {
        await handleST.handleSystemGoalsAnalysis();
    } else if (appState.currentTemplateId === "process-mapping") {
        await handleST.handleProcessMappingAnalysis();
    } else if (appState.currentTemplateId === "system-thinking-analysis") {
        await handleST.handleSystemThinkingAnalysis();
    } else {
        // --- Generic n8n workflow for all other tools ---
        analysisResultContainer.innerHTML = `
                    <div class="text-center text-white/70 p-8">
                        <div class="typing-indicator mb-6">
                            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                        </div>
                        <h3 class="text-xl font-semibold text-white mb-4">Generating Your Strategic Analysis</h3>
                        <p class="text-white/80 mb-2">This comprehensive analysis may take 2-5 minutes to complete.</p>
                        <p class="text-white/60 text-sm">Please keep this page open while we process your request.</p>
                    </div>`;

        let fullPrompt = "";
        const formData = new FormData();
        const companyName = dom.$("companyName").value.trim();
        const companyDocumentsFile = dom.$("companyDocumentsFile").files[0];
        const location = dom.$("location").value.trim();
        const framework = getFrameworkForTemplate(appState.currentTemplateId);
        const sections = getSelectedSections();

        if (!companyName || !companyDocumentsFile || !location) {
            analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">Please fill out all fields and upload a file.</div>`;
            setLoading("generate", false);
            return;
        }
        fullPrompt = `User Information: - Company Name: ${companyName} - Location: ${location}`;

        // Add context if the field exists
        const contextEl = dom.$("useCaseContext");
        if (contextEl && contextEl.value.trim()) {
            const context = contextEl.value.trim();
            fullPrompt += ` - Context: ${context}`;
            formData.append("context", context);
        }

        formData.append("customerName", companyName);
        formData.append("location", location);
        formData.append("company_documents", companyDocumentsFile.name);
        formData.append("file", companyDocumentsFile);
        formData.append("framework", framework);
        formData.append("sections", sections);
        formData.append("prompt", fullPrompt);
        formData.append("templateId", appState.currentTemplateId);

        try {
            const {
                data: { session }
            } = await appConfig.supabase.auth.getSession();
            if (!session) throw new Error("Please log in to generate analysis.");

            const messageId = Date.now();
            appState.pendingAnalysisRequests.set(messageId, analysisResultContainer);
            formData.append("messageId", messageId);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch("https://n8n.data2int.com/webhook/analysis-ev2", {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            console.log("Analysis request submitted successfully.");
        } catch (error) {
            if (error.name === "AbortError") {
                console.log("Fetch request timed out as expected. Waiting for WebSocket response.");
                return;
            }
            console.error("Error submitting analysis request:", error);
            analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}</div>`;
            setLoading("generate", false);
        }
    }
}   


export {
    handleGenerate
}