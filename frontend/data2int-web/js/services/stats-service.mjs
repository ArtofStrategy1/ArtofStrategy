import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { appConfig } from '../config.mjs';
import { showMessage } from '../utils/ui-utils.mjs';

async function fetchAndDisplayStatistics() {
    if (!appState.userLoggedIn) {
        showMessage("statsMessage", "You must be logged in to refresh statistics.", "error");
        return;
    }

    const btn = dom.$("refreshStatsBtn");
    const textEl = dom.$("refreshStatsBtnText");
    const spinner = dom.$("refreshStatsSpinner");

    btn.disabled = true;
    spinner.classList.remove("hidden");
    textEl.textContent = "Loading...";
    showMessage("statsMessage", "", "success");

    try {
        const { data, error } = await appConfig.supabase.functions.invoke("statistics", {
            body: { update: true }
        });

        if (error) {
            throw error;
        }

        if (data && data.success) {
            const dbStatus = data.database_status;
            if (dbStatus) {
                dom.$("statTotalUsers").textContent = dbStatus.total_users ?? "N/A";
                dom.$("statActiveUsers").textContent = dbStatus.log_in_users ?? "N/A";
                dom.$("statTotalQueries").textContent = dbStatus.total_queries ?? "N/A";
                dom.$("dashQueryCount").textContent = dbStatus.total_queries ?? "0";
                dom.$("statDbSize").textContent = dbStatus.database_size ?? "N/A";
                dom.$("statAvgTime").textContent = dbStatus.avg_p_time
                    ? parseFloat(dbStatus.avg_p_time).toFixed(2) + " ms"
                    : "N/A";
                dom.$("statRecordedAt").textContent = dbStatus.recorded_at
                    ? new Date(dbStatus.recorded_at).toLocaleString()
                    : "N/A";
            }

            const pineconeStatus = data.pinecone_status;
            const pineconeContainer = dom.$("pineconeStatsContainer");
            if (pineconeStatus && pineconeStatus.status) {
                pineconeContainer.classList.remove("hidden");
                dom.$("statPineconeName").textContent = pineconeStatus.name ?? "N/A";
                dom.$("statTotalVectors").textContent = pineconeStatus.total_vectors ?? "N/A";
                dom.$("statBookVectors").textContent = pineconeStatus.book_namespace_vectors ?? "N/A";
                dom.$("statPineconeDimension").textContent = pineconeStatus.dimension ?? "N/A";
                dom.$("statPineconeStatus").textContent = pineconeStatus.status ?? "N/A";
                dom.$("statPineconeCloud").textContent =
                    `${pineconeStatus.cloud_provider ?? ""} (${pineconeStatus.region ?? ""})`;
            } else {
                pineconeContainer.classList.add("hidden");
            }
            showMessage("statsMessage", "Statistics updated successfully!", "success");
        } else {
            throw new Error(data.error || "Failed to fetch statistics.");
        }
    } catch (error) {
        console.error("Error fetching statistics:", error);
        showMessage("statsMessage", `Error: ${error.message}`, "error");
    } finally {
        btn.disabled = false;
        spinner.classList.add("hidden");
        textEl.textContent = "Refresh Stats";
    }
}


export {
    fetchAndDisplayStatistics
}