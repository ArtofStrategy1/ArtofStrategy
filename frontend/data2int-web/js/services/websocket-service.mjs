// WebSocket Management Functions
import { appConfig } from '../config.mjs'
import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { createParetoChartJS } from '../ui/analysis-rendering/analysis-rendering-st.mjs'
import { setLoading } from '../utils/ui-utils.mjs';


let websocket = null;
let reconnectAttempts = 0;

const wsVars = {
    websocket,
    reconnectAttempts
}

/**
 * @returns void
 */
function initializeWebSocket() {
    const wsStatus = document.getElementById("wsStatus");

    try {
        websocket = new WebSocket("wss://n8n-api.data2int.com/ws");

        wsStatus.textContent = "Connecting...";
        wsStatus.className = "ws-status connecting";

        websocket.onopen = function (event) {
            console.log("WebSocket connected successfully");
            wsStatus.textContent = "Connected";
            wsStatus.className = "ws-status connected";
            reconnectAttempts = 0;
        };

        websocket.onmessage = function (event) {
            console.log("Received WebSocket message:", event.data);

            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        websocket.onclose = function (event) {
            console.log("WebSocket connection closed:", event.code, event.reason);
            wsStatus.textContent = "Disconnected";
            wsStatus.className = "ws-status disconnected";

            if (event.code !== 1000 && reconnectAttempts < appConfig.maxReconnectAttempts) {
                setTimeout(() => {
                    reconnectAttempts++;
                    console.log(`WebSocket reconnection attempt ${reconnectAttempts}/${appConfig.maxReconnectAttempts}`);
                    initializeWebSocket();
                }, appConfig.reconnectDelay);
            }
        };

        websocket.onerror = function (error) {
            console.error("WebSocket error:", error);
            wsStatus.textContent = "Error";
            wsStatus.className = "ws-status disconnected";
        };
    } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
        wsStatus.textContent = "Failed";
        wsStatus.className = "ws-status disconnected";
    }
}



function handleWebSocketMessage(data) {
    const container = appState.pendingAnalysisRequests.get(parseInt(data.messageId));
    if (!container) return;

    if (data.error) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">Workflow error: ${data.error}</div>`;
        appState.pendingAnalysisRequests.delete(parseInt(data.messageId));
        setLoading("generate", false);
        return;
    }

    if (data.progress && !data.result && data.templateId !== "pareto-fishbone") {
        container.innerHTML = `
                <div class="text-center text-white/70 p-4">
                    <div class="typing-indicator mb-4">
                        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                    </div>
                    <p class="mb-2">🔄 ${data.progress}</p>
                    <p class="text-sm text-white/50">Analysis in progress...</p>
                </div>`;
        return;
    }

    // Handle complex data for pareto-fishbone
    if (data.templateId === "pareto-fishbone" && data.fishbone && data.pareto) {
        container.innerHTML = ""; // Clear loading
        const fishboneData = data.fishbone;
        const paretoData = data.pareto;

        // Create Tab Interface
        const tabNav = document.createElement("div");
        tabNav.className = "flex border-b border-white/20 -mx-10 px-6";
        tabNav.innerHTML = `
                    <button class="analysis-tab-btn active" data-tab="pareto">📊 Pareto Chart</button>
                    <button class="analysis-tab-btn" data-tab="fishbone">🐟 Fishbone Diagram</button>
                    <button class="analysis-tab-btn" data-tab="details">📋 Analysis Details</button>
                    <button class="analysis-tab-btn" data-tab="plan">🎯 Action Plan</button>
                `;
        container.appendChild(tabNav);

        const tabContent = document.createElement("div");
        container.appendChild(tabContent);

        // Create Tab Panels
        tabContent.innerHTML = `
                    <div id="paretoPanel" class="analysis-tab-panel active"></div>
                    <div id="fishbonePanel" class="analysis-tab-panel"></div>
                    <div id="detailsPanel" class="analysis-tab-panel"></div>
                    <div id="planPanel" class="analysis-tab-panel"></div>
                `;

        // Populate Pareto Tab
        const paretoPanel = dom.$("paretoPanel");
        const paretoChartDiv = document.createElement("div");
        paretoChartDiv.id = "paretoChartContainer";
        paretoChartDiv.className = "plotly-chart";
        paretoPanel.appendChild(paretoChartDiv);
        createParetoChartJS(paretoData, "paretoChartContainer");

        // Populate Fishbone Tab
        const fishbonePanel = dom.$("fishbonePanel");
        if (data.fishbone_image) {
            fishbonePanel.innerHTML = `<img id="fishbone_img" src="data:image/png;base64,${data.fishbone_image}" class="w-full h-auto rounded-lg" alt="Fishbone Diagram">`;
        } else {
            fishbonePanel.innerHTML = `<p class="text-white/70">Fishbone image not available.</p>`;
        }

        // Populate Details Tab
        const detailsPanel = dom.$("detailsPanel");
        let detailsHtml = `<h3 class="text-2xl font-bold mb-4">Analysis Summary</h3>`;
        if (paretoData.analysis_summary) {
            detailsHtml += `<div class="p-4 rounded-lg bg-white/5 mb-6 text-white/80 italic">${paretoData.analysis_summary}</div>`;
        }
        detailsHtml += `<h4 class="text-xl font-semibold mb-3">Category Breakdown</h4>`;
        for (const [category, sub_causes] of Object.entries(fishboneData)) {
            detailsHtml += `<details class="bg-white/5 p-3 rounded-lg mb-2"><summary class="cursor-pointer font-semibold">${category} (${sub_causes.length} causes)</summary><ul class="mt-2 pl-4">`;
            sub_causes.forEach((cause) => {
                const isVital = (paretoData.vital_few || []).some(
                    (item) => cause.toLowerCase() === item.cause.toLowerCase()
                );
                detailsHtml += `<li class="mb-1">${isVital ? "🔥" : "📝"} ${cause}</li>`;
            });
            detailsHtml += `</ul></details>`;
        }
        detailsPanel.innerHTML = detailsHtml;

        // Populate Action Plan Tab
        const planPanel = dom.$("planPanel");
        let planHtml = `<h3 class="text-2xl font-bold mb-4">Recommended Action Plan</h3>
                                <div class="p-4 rounded-lg bg-green-500/10 text-green-300 mb-6">💡 <strong>80/20 Rule:</strong> Focus 80% of your resources on the 'Vital Few' causes for maximum impact!</div>
                                <h4 class="text-xl font-semibold mb-3 border-b border-red-500/50 pb-2 text-red-300">🔥 IMMEDIATE FOCUS (Vital Few)</h4>`;
        (paretoData.vital_few || []).forEach((cause) => {
            planHtml += `<div class="mb-4">
                                    <p class="font-bold text-lg">${cause.cause} (${cause.impact_score}% impact)</p>
                                    <p class="text-sm text-white/70"><strong>Category:</strong> ${cause.category} | <strong>Priority:</strong> HIGH ⚡</p>
                                    </div>`;
        });
        planHtml += `<h4 class="text-xl font-semibold mt-8 mb-3 border-b border-white/20 pb-2">📋 SECONDARY ACTIONS (Useful Many)</h4>`;
        (paretoData.useful_many || []).forEach((cause) => {
            planHtml += `<div class="mb-4">
                                    <p class="font-bold text-lg">${cause.cause} (${cause.impact_score}% impact)</p>
                                    <p class="text-sm text-white/70"><strong>Category:</strong> ${cause.category} | <strong>Priority:</strong> Medium/Low</p>
                                    </div>`;
        });
        planPanel.innerHTML = planHtml;

        appState.analysisCache[appState.currentTemplateId] = container.innerHTML;

        // Add Tab Switching Logic
        tabNav.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") {
                tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
                tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));

                e.target.classList.add("active");
                const targetPanelId = e.target.dataset.tab + "Panel";
                const targetPanel = dom.$(targetPanelId);
                targetPanel.classList.add("active");
                const chart = targetPanel.querySelector(".plotly-chart");
                if (chart) Plotly.Plots.resize(chart);
            }
        });
    } else if (data.result) {
        // Handle simple text result for other templates
        container.innerHTML = `<div id="analysisContent" class="whitespace-pre-wrap">${data.result}</div>`;
        appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
    }

    const analysisActionsEl = dom.$("analysisActions");
    if (analysisActionsEl) analysisActionsEl.classList.remove("hidden");

    appState.pendingAnalysisRequests.delete(parseInt(data.messageId));
    setLoading("generate", false);
}


export {
    wsVars,
    initializeWebSocket,
    handleWebSocketMessage
}