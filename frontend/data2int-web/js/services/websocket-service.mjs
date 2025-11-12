// WebSocket Management Functions
import { appConfig } from '../config.mjs'
import { handleWebSocketMessage } from '../analysis/analysis-helpers.mjs';

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

export {
    wsVars,
    initializeWebSocket
}