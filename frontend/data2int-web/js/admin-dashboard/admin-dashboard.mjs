import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { appConfig } from '../config.mjs';
import { showMessage } from '../utils/ui-utils.mjs';
import { renderFeedbackTab } from './feedback-modal.mjs';
import { renderContactsTab } from './contacts-modal.mjs';

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
                // 'dbStats' is pre-filled

            } else {
                panel.style.display = "none";
            }
        });
    });
}

async function renderViewDatabaseTab() {
    const usersPanel = dom.$("usersPanel");
    if (!usersPanel) {
        console.error("Admin Dashboard: usersPanel not found.");
        return;
    }

    // 1. Build the UI (Toolbar + Table Placeholder)
    usersPanel.innerHTML = `
        <div class="glass-container p-6">
            <div class="flex flex-col md:flex-row gap-4 mb-4">
                <div class="flex-grow">
                    <input type="text" id="adminUserSearch" class="input-field" placeholder="Search email or name...">
                </div>
                <div class="flex-shrink-0">
                    <select id="adminTierFilter" class="input-field">
                        <option value="">All Tiers</option>
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="flex-shrink-0">
                    <select id="adminSortBy" class="input-field">
                        <option value="created_at" selected>Sort by: Created At</option>
                        <option value="last_name">Sort by: Last Name</option>
                        <option value="email">Sort by: Email</option>
                    </select>
                </div>
                <div class="flex-shrink-0">
                    <button id="adminManageBtn" class="btn btn-primary w-full md:w-auto" disabled>
                        Manage
                    </button>
                </div>
            </div>

            <div id="adminUserTableContainer" class="overflow-x-auto">
                </div>
        </div>
    `;

    // 2. Attach event listeners to filters
    const searchInput = dom.$("adminUserSearch");
    const tierFilter = dom.$("adminTierFilter");
    const sortSelect = dom.$("adminSortBy");

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchAndRenderUsers(1); // Reset to page 1
        }, 500); // 500ms debounce
    });

    tierFilter.addEventListener('change', () => {
        fetchAndRenderUsers(1); // Reset to page 1
    });

    sortSelect.addEventListener('change', () => {
        fetchAndRenderUsers(1); // Reset to page 1
    });

    // 3. Initial data load
    await fetchAndRenderUsers();
}

function renderUserTable(container, users, pagination) {
    if (!Array.isArray(users) || users.length === 0) {
        container.innerHTML = `<p class="text-white/70 text-center p-10">No users found matching your criteria.</p>`;
        return;
    }

    // --- HTML TABLE: "Actions" column is REMOVED ---
    let tableHtml = `
        <table class="w-full text-left styled-table">
            <thead>
                <tr>
                    <th class="p-3 w-10"><input type="checkbox" id="selectAllUsers" /></th>
                    <th class="p-3">UID</th>
                    <th class="p-3">Display Name</th>
                    <th class="p-3">Email</th>
                    <th class="p-3">Tier</th>
                    <th class="p-3">Created At</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(user => {
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A';
        const uid = user.auth_user_id || user.id; 
        
        tableHtml += `
            <tr class="border-b border-white/10">
                <td class="p-3"><input type="checkbox" class="user-checkbox" data-id="${user.id}" /></td>
                <td class="p-3 text-xs font-mono" title="${uid}">${uid ? uid.split('-')[0] + '...' : 'N/A'}</td>
                <td class="p-3">${displayName}</td>
                <td class="p-3">${user.email || 'N/A'}</td>
                <td class="p-3">${user.tier || 'N/A'}</td>
                <td class="p-3 text-sm">${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</td>
            </tr>
        `; // The "Manage" button <td> is GONE
    });

    tableHtml += `</tbody></table>`;

    // Add Pagination controls
    if (pagination && pagination.totalPages > 1) {
        tableHtml += `<div class="flex justify-between items-center mt-4 text-sm">`;
        tableHtml += `<span class="text-white/70">Page ${pagination.page} of ${pagination.totalPages} (Total: ${pagination.total})</span>`;
        tableHtml += `<div class="flex gap-2">`;
        if (pagination.page > 1) {
            tableHtml += `<button class="btn btn-secondary pagination-btn" data-page="${pagination.page - 1}">Previous</button>`;
        }
        if (pagination.page < pagination.totalPages) {
            tableHtml += `<button class="btn btn-secondary pagination-btn" data-page="${pagination.page + 1}">Next</button>`;
        }
        tableHtml += `</div></div>`;
    }

    container.innerHTML = tableHtml;

    // --- NEW: "SMART BUTTON" LOGIC ---
    const manageBtn = dom.$("adminManageBtn"); // The button in the toolbar
    const allUserCheckboxes = container.querySelectorAll('.user-checkbox');
    const selectAllCheckbox = container.querySelector('#selectAllUsers');

    /**
     * This function checks how many boxes are ticked and changes
     * the text and click action of the main "Manage" button.
     */
    function updateManageButtonState() {
        const checkedBoxes = container.querySelectorAll('.user-checkbox:checked');
        const checkedCount = checkedBoxes.length;

        if (checkedCount === 0) {
            // 0 selected: Disable button
            manageBtn.disabled = true;
            manageBtn.textContent = "Manage";
            manageBtn.onclick = null;
        } else if (checkedCount === 1) {
            // 1 selected: Set to "Manage 1 User" and open singular modal
            manageBtn.disabled = false;
            manageBtn.textContent = "Manage";
            manageBtn.onclick = () => {
                const userId = checkedBoxes[0].dataset.id;
                openUserManagementModal(userId);
            };
        } else {
            // 2+ selected: Set to "Bulk Actions (x)" and open bulk modal
            manageBtn.disabled = false;
            manageBtn.textContent = `Manage`;
            manageBtn.onclick = () => {
                // This is the logic we moved from renderViewDatabaseTab
                const modal = dom.$("bulkActionModal");
                const countSpan = dom.$("bulkUserCount");
                const confirmBtn = dom.$("modalConfirmBulkBtn");
                const closeModalBtn = dom.$("closeBulkModalBtn");
                const actionSelect = dom.$("bulkActionSelect");
                const messageEl = dom.$("bulkModalMessage");

                const userIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);

                countSpan.textContent = userIds.length;
                actionSelect.value = "";
                messageEl.classList.add("hidden");
                modal.classList.remove("hidden");

                closeModalBtn.onclick = () => modal.classList.add("hidden");
                
                confirmBtn.onclick = async () => {
                    const action = actionSelect.value;
                    if (!action) {
                        showMessage("bulkModalMessage", "Please select an action.", "error");
                        return;
                    }
                    
                    await handleBulkUserUpdate(action, userIds);
                    
                    if (!messageEl.classList.contains("error-message")) {
                        await fetchAndRenderUsers(1); 
                        modal.classList.add("hidden"); 
                    }
                };
            };
        }
        
        // Update "Select All" state
        selectAllCheckbox.checked = checkedCount > 0 && checkedCount === allUserCheckboxes.length;
    }

    // --- ADD LISTENERS FOR ALL CHECKBOXES ---
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        allUserCheckboxes.forEach(cb => cb.checked = isChecked);
        updateManageButtonState();
    });

    allUserCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateManageButtonState);
    });

    // Add event listeners for pagination buttons
    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.target.dataset.page;
            fetchAndRenderUsers(parseInt(newPage));
        });
    });

    // --- This listener block is no longer needed, as the buttons are gone ---
    // container.querySelectorAll('.admin-manage-user-btn')...
    
    // Set the initial state of the button (disabled)
    updateManageButtonState();
}

/**
 * Fetches user data from the API and calls the renderer.
 * This is now a standalone function.
 */
async function fetchAndRenderUsers(page = 1, limit = 20) {
    const tableContainer = dom.$("adminUserTableContainer");
    
    // Show loading state
    tableContainer.innerHTML = `
        <div class="flex items-center justify-center p-10">
            <div class="loading-spinner mr-3"></div>
            <span class="text-white/80">Fetching secure user data...</span>
        </div>
    `;

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("You are not logged in. Please log in as an admin.");

        // Get filter values from the UI
        const searchTerm = dom.$("adminUserSearch").value.trim();
        const tierValue = dom.$("adminTierFilter").value;
        const sortByValue = dom.$("adminSortBy").value;
        const sortOrderValue = 'desc';

        // Build the URL with query parameters
        const params = new URLSearchParams({
            page: page,
            limit: limit,
            sortBy: sortByValue,
            sortOrder: sortOrderValue
        });
        if (searchTerm) params.append('search', searchTerm);
        if (tierValue) params.append('tier', tierValue);

        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users?${params.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Failed to fetch users: ${response.statusText}`);
        }

        // Render the table with the new data
        renderUserTable(tableContainer, data.data, data.pagination);

    } catch (error) {
        console.error("Error in fetchAndRenderUsers:", error);
        tableContainer.innerHTML = `
            <div class="p-6 text-center">
                <h4 class="text-xl font-bold text-red-400 mb-2">Error Fetching User Data</h4>
                <pre class="bg-black/30 p-2 rounded mt-2 text-red-300 text-xs">${error.message}</pre>
            </div>`;
    }
}

/**
 * NEW: Fetches a single user's data and opens the edit modal.
 */
async function openUserManagementModal(userId) {
    const modal = dom.$("userManagementModal");
    const modalContent = dom.$("userModalContent");
    const closeModalBtn = dom.$("closeUserModalBtn");
    if (!modal || !modalContent || !closeModalBtn) return;

    modal.classList.remove("hidden");
    modalContent.innerHTML = `<div class="flex items-center justify-center p-10"><div class="loading-spinner mr-3"></div><span class="text-white/80">Fetching user data...</span></div>`;
    
    // Assign close button listener
    const closeModal = () => modal.classList.add("hidden");
    closeModalBtn.onclick = closeModal;

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // Fetch specific user data (GET /users/:id) [cite: 254-279]
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch user");
        
        const user = data.data; // The user object

        // Populate modal with form
        modalContent.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-200 mb-2">Email</label>
                    <input type="email" id="modalUserEmail" class="input-field" value="${user.email || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="modalUserFirstName" class="block text-sm font-medium text-gray-200 mb-2">First Name</label>
                        <input type="text" id="modalUserFirstName" class="input-field" value="${user.first_name || ''}">
                    </div>
                    <div>
                        <label for="modalUserLastName" class="block text-sm font-medium text-gray-200 mb-2">Last Name</label>
                        <input type="text" id="modalUserLastName" class="input-field" value="${user.last_name || ''}">
                    </div>
                </div>
                <div>
                    <label for="modalUserTier" class="block text-sm font-medium text-gray-200 mb-2">User Tier</label>
                    <select id="modalUserTier" class="input-field">
                        <option value="basic" ${user.tier === 'basic' ? 'selected' : ''}>Basic</option>
                        <option value="premium" ${user.tier === 'premium' ? 'selected' : ''}>Premium</option>
                        <option value="admin" ${user.tier === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div id="userModalMessage" class="hidden"></div>
                <div class="flex justify-between items-center mt-6">
                    <button id="modalDisableUserBtn" class="btn btn-danger" ${user.tier === 'admin' ? 'disabled' : ''}>Disable User</button>
                    <button id="modalUpdateUserBtn" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;

        // Add listeners for the new buttons *inside* the modal
        dom.$("modalUpdateUserBtn").onclick = () => handleUserUpdate(user.id);
        if (user.tier !== 'admin') {
            dom.$("modalDisableUserBtn").onclick = () => handleUserDisable(user.id, user.email, closeModal);
        }

    } catch (error) {
        modalContent.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

/**
 * NEW: Handles the PUT /users/:id request to update a user.
 */
async function handleUserUpdate(userId) {
    const messageEl = dom.$("userModalMessage");
    const updateBtn = dom.$("modalUpdateUserBtn");
    const originalBtnText = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = `<span class="loading-spinner mr-2"></span> Saving...`;

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // Get new data from modal fields
        const updatedData = {
            first_name: dom.$("modalUserFirstName").value,
            last_name: dom.$("modalUserLastName").value,
            email: dom.$("modalUserEmail").value, // Added email
            tier: dom.$("modalUserTier").value
        };

        // Call PUT /users/:id [cite: 282-351]
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(updatedData)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to update user");

        showMessage("userModalMessage", "User updated successfully!", "success");
        await fetchAndRenderUsers(); // Refresh the main user table

    } catch (error) {
        showMessage("userModalMessage", error.message, "error");
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalBtnText;
    }
}

/**
 * NEW: Handles the PUT /users/:id/disable request.
 */
async function handleUserDisable(userId, userEmail, closeModalCallback) {
    if (!confirm(`Are you sure you want to disable this user?\n\nEmail: ${userEmail}\nID: ${userId}\n\nThis action is reversible and does NOT delete data.`)) {
        return;
    }

    const messageEl = dom.$("userModalMessage");
    const disableBtn = dom.$("modalDisableUserBtn");
    const originalBtnText = disableBtn.innerHTML;
    disableBtn.disabled = true;
    disableBtn.innerHTML = `<span class="loading-spinner mr-2"></span> Disabling...`;

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");
        
        // Call PUT /users/:id/disable [cite: 354-419]
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}/disable`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` 
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to disable user");

        showMessage("userModalMessage", `User ${data.disabled_user?.email || ''} disabled successfully.`, "success");
        await fetchAndRenderUsers(); // Refresh the main user table
        setTimeout(closeModalCallback, 1500); // Close modal on success

    } catch (error) {
        showMessage("userModalMessage", error.message, "error");
    } finally {
        disableBtn.disabled = false;
        disableBtn.innerHTML = originalBtnText;
    }
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