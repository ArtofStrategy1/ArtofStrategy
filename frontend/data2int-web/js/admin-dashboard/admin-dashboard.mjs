import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { appConfig } from '../config.mjs';
import { showMessage } from '../utils/ui-utils.mjs';
import { renderFeedbackTab } from './feedback-modal.mjs';
import { renderContactsTab } from './contacts-modal.mjs';
import { renderViewDatabaseTab } from './users-tab.mjs';

function createAdminDashboardTabs() {
    const dashboardContainer = dom.$("adminDashboard");
    if (!dashboardContainer) return;

    // 1. Capture existing static content (metrics and stats panels)
    const usersOnlineGrid = dashboardContainer.querySelector('.grid.md\\:grid-cols-3');
    const statsContainer = dashboardContainer.querySelector('.glass-container.mt-8');

    // 2. Clear the dashboard content
    dashboardContainer.innerHTML = '';

    // 3. Define Tab Navigation (MODIFIED - Added Feedback)
    const tabNav = document.createElement("div");
    tabNav.id = "adminTabsNav";
    tabNav.className = "flex flex-wrap space-x-2 border-b-2 border-white/10 mt-8 mb-8";
    tabNav.innerHTML = `
        <button class="home-tab-btn active" data-tab="dbStats">📊 Database Statistics</button>
        <button class="home-tab-btn" data-tab="users">👥 Users</button>
        <button class="home-tab-btn" data-tab="feedback">🎫 Feedback</button> 
        <button class="home-tab-btn" data-tab="contacts">📨 Contacts</button>
        <button class="home-tab-btn" data-tab="subscriptions">💳 Subscriptions</button>
    `;
    
    // 4. Define Tab Content Panels (MODIFIED - Added feedbackPanel)
    const tabContent = document.createElement("div");
    tabContent.id = "adminTabsContent";
    tabContent.innerHTML = `
        
        <div id="dbStatsPanel" class="home-tab-panel active grid grid-cols-1 gap-8">
            ${usersOnlineGrid ? usersOnlineGrid.outerHTML : ''}
            ${statsContainer ? statsContainer.outerHTML : ''}
        </div>

        <div id="usersPanel" class="home-tab-panel">
        </div>

        <div id="feedbackPanel" class="home-tab-panel">
        </div>

        <div id="contactsPanel" class="home-tab-panel">
        </div>

        <div id="subscriptionsPanel" class="home-tab-panel">
        </div>
    `;

    // 5. Append new elements to the dashboard
    dashboardContainer.appendChild(tabNav);
    dashboardContainer.appendChild(tabContent);
    
    // 6. Attach the common tab switching listener
    setupAdminTabsListeners();
}

function setupAdminTabsListeners() {
    const tabsNav = dom.$("adminTabsNav");
    const tabPanels = document.querySelectorAll("#adminTabsContent .home-tab-panel");
    const tabBtns = document.querySelectorAll("#adminTabsNav .home-tab-btn");

    tabPanels.forEach(panel => {
        if (panel.id === "dbStatsPanel") { // Default active tab
            panel.style.display = "grid"; 
        } else {
            panel.style.display = "none";
        }
    });

    tabsNav.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") return;
        const targetTab = e.target.dataset.tab;

        tabBtns.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tab === targetTab);
        });

        tabPanels.forEach((panel) => {
            panel.classList.remove("active");
            if (panel.id === targetTab + "Panel") {
                panel.classList.add("active");
                panel.style.display = "grid"; 
                
                // --- MODIFIED: Added check for 'feedback' ---
                if (targetTab === 'users') renderViewDatabaseTab(); 
                if (targetTab === 'feedback') renderFeedbackTab(); // <-- NEW
                if (targetTab === 'contacts') renderContactsTab();
                if (targetTab === 'subscriptions') renderSubscriptionsTab();
                // 'dbStats' is pre-filled

            } else {
                panel.style.display = "none";
            }
        });
    });
}



/**
 * Renders the placeholder UI for the Subscriptions tab.
 */
function renderSubscriptionsTab() {
    console.log("DEBUG: renderSubscriptionsTab() called. Building UI..."); 
    const panel = dom.$("subscriptionsPanel");
    if (!panel) {
        console.error("DEBUG: subscriptionsPanel element not found!"); 
        return;
    }

    // 1. Build the UI
    panel.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-container">
                <h3 class="text-xl font-semibold mb-2 text-green-400">Monthly Revenue</h3>
                <p class="text-4xl font-bold">--</p>
                <p class="text-white/60 text-sm mt-2">Stripe data not connected.</p>
            </div>
            <div class="glass-container">
                <h3 class="text-xl font-semibold mb-2 text-blue-400">Premium Users</h3>
                <p class="text-4xl font-bold">--</p>
                <p class="text-white/60 text-sm mt-2">Stripe data not connected.</p>
            </div>
            <div class="glass-container">
                <h3 class="text-xl font-semibold mb-2 text-yellow-400">New Subscriptions (30d)</h3>
                <p class="text-4xl font-bold">--</p>
                <p class="text-white/60 text-sm mt-2">Stripe data not connected.</p>
            </div>
        </div>

        <div class="glass-container p-6 mt-8"> 
            <h2 class="text-3xl font-bold mb-4">Subscription Management</h2>
            <p class="text-white/70 text-center p-10">
                <span class="text-2xl mb-4">💳</span><br>
                <strong>This feature is not yet connected.</strong><br>
                Connecting this tab will require integrating a payment processor like Stripe.
            </p>
            
            <div class="opacity-30">
                <div class="flex flex-col md:flex-row gap-4 mb-6">
                    <input type="text" class="input-field" placeholder="Search by user email or subscription ID..." disabled>
                    <select class="input-field" disabled>
                        <option>Filter by: Active</option>
                        <option>Filter by: Canceled</option>
                    </select>
                </div>
                <table class="w-full text-left styled-table">
                    <thead>
                        <tr>
                            <th class="p-3">User Email</th>
                            <th class="p-3">Plan</th>
                            <th class="p-3">Status</th>
                            <th class="p-3">Subscribed On</th>
                            <th class="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="p-3 text-white/50">example@email.com</td>
                            <td class="p-3 text-white/50">Premium</td>
                            <td class="p-3 text-white/50">Active</td>
                            <td class="p-3 text-white/50">2025-10-01</td>
                            <td class="p-3">
                                <button class="btn btn-secondary py-1 px-3 text-xs" disabled>Manage</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 2. Attach any placeholder listeners (none needed for now)
}



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
    createAdminDashboardTabs,
    fetchAndDisplayStatistics
}