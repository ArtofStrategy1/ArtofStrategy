import { dom } from '../utils/dom-utils.mjs';
import { appConfig } from '../config.mjs';
import { showMessage } from '../utils/ui-utils.mjs';

/**
 * Builds the Users tab UI, including the new "Create New User" button.
 */
async function renderViewDatabaseTab() {
    console.log("DEBUG: renderViewDatabaseTab() called");
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
                <div class="flex-shrink-0">
                    <button id="adminCreateUserBtn" class="btn btn-secondary w-full md:w-auto">
                         Create New User
                    </button>
                </div>
            </div>

            <div id="adminUserTableContainer" class="overflow-x-auto">
                <p class="text-white/70 text-center p-10">Initializing users tab...</p>
            </div>
        </div>
    `;

    // 2. Attach event listeners to filters
    const searchInput = dom.$("adminUserSearch");
    const tierFilter = dom.$("adminTierFilter");
    const sortSelect = dom.$("adminSortBy");

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        console.log("DEBUG: Search input changed");
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchAndRenderUsers(1); // Reset to page 1
        }, 500); // 500ms debounce
    });

    tierFilter.addEventListener('change', () => {
        console.log("DEBUG: Tier filter changed");
        fetchAndRenderUsers(1); // Reset to page 1
    });

    sortSelect.addEventListener('change', () => {
        console.log("DEBUG: Sort select changed");
        fetchAndRenderUsers(1); // Reset to page 1
    });

    // --- *** NEW LISTENER FOR THE CREATE BUTTON *** ---
    dom.$("adminCreateUserBtn").addEventListener('click', () => {
        console.log("DEBUG: 'Create New User' button clicked");
        openCreateUserModal();
    });

    // 3. Initial data load
    await fetchAndRenderUsers();
}

/**
 * Renders the user table and wires up the "Manage" button logic.
 */
function renderUserTable(container, users, pagination) {
    console.log("DEBUG: renderUserTable() called");
    if (!Array.isArray(users) || users.length === 0) {
        container.innerHTML = `<p class="text-white/70 text-center p-10">No users found matching your criteria.</p>`;
        return;
    }

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
        `;
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

    // --- "SMART BUTTON" LOGIC ---
    const manageBtn = dom.$("adminManageBtn"); 
    const allUserCheckboxes = container.querySelectorAll('.user-checkbox');
    const selectAllCheckbox = container.querySelector('#selectAllUsers');

    function updateManageButtonState() {
        const checkedBoxes = container.querySelectorAll('.user-checkbox:checked');
        const checkedCount = checkedBoxes.length;
        console.log(`DEBUG: updateManageButtonState() - ${checkedCount} boxes checked`);

        if (checkedCount === 0) {
            // 0 selected: Disable button
            manageBtn.disabled = true;
            manageBtn.textContent = "Manage";
            manageBtn.onclick = null;
        } else if (checkedCount === 1) {
            // 1 selected: Set to "Manage" and open singular modal
            manageBtn.disabled = false;
            manageBtn.textContent = "Manage";
            manageBtn.onclick = () => {
                const userId = checkedBoxes[0].dataset.id;
                console.log("DEBUG: Manage button (single) clicked for userId:", userId);
                openUserManagementModal(userId);
            };
        } else {
            // 2+ selected: Set to "Manage (x)" and open bulk modal
            manageBtn.disabled = false;
            manageBtn.textContent = `Manage (${checkedCount})`; // Show count
            manageBtn.onclick = () => {
                console.log("DEBUG: Manage button (bulk) clicked");
                const modal = dom.$("bulkActionModal");
                const countSpan = dom.$("bulkUserCount");
                const confirmBtn = dom.$("modalConfirmBulkBtn");
                const closeModalBtn = dom.$("closeBulkModalBtn");
                const actionSelect = dom.$("bulkActionSelect");
                const messageEl = dom.$("bulkModalMessage");

                const userIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);

                countSpan.textContent = userIds.length;
                actionSelect.value = ""; // Reset dropdown
                messageEl.classList.add("hidden");
                modal.classList.remove("hidden");

                closeModalBtn.onclick = () => modal.classList.add("hidden");
                
                confirmBtn.onclick = async () => {
                    const action = actionSelect.value;
                    if (!action) {
                        showMessage("bulkModalMessage", "Please select an action.", "error");
                        return;
                    }
                    console.log("DEBUG: Bulk 'Apply Action' clicked for action:", action);
                    await handleBulkUserUpdate(action, userIds); 
                };
            };
        }
        
        selectAllCheckbox.checked = checkedCount > 0 && checkedCount === allUserCheckboxes.length;
    }

    // Add listeners for all checkboxes
    selectAllCheckbox.addEventListener('change', (e) => {
        console.log("DEBUG: 'Select All' checkbox changed");
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
            console.log("DEBUG: Pagination button clicked for page:", newPage);
            fetchAndRenderUsers(parseInt(newPage));
        });
    });
    
    // Set the initial state of the button (disabled)
    updateManageButtonState();
}

/**
 * Fetches user data from the API and calls the renderer.
 */
async function fetchAndRenderUsers(page = 1, limit = 20) {
    console.log("DEBUG: fetchAndRenderUsers() called for page:", page);
    const tableContainer = dom.$("adminUserTableContainer");
    
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

        const params = new URLSearchParams({
            page: page,
            limit: limit,
            sortBy: sortByValue,
            sortOrder: sortOrderValue
        });
        if (searchTerm) params.append('search', searchTerm);
        if (tierValue) params.append('tier', tierValue);

        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users?${params.toString()}`;
        console.log("DEBUG: Fetching URL:", url);
        
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
        console.log("DEBUG: fetchAndRenderUsers() success, rendering table...");
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
 * UPDATED: Fetches a single user's data and opens the edit modal.
 * Now includes the "Delete User" button.
 */
async function openUserManagementModal(userId) {
    console.log("DEBUG: openUserManagementModal() called for userId:", userId);
    const modal = dom.$("userManagementModal");
    const modalContent = dom.$("userModalContent");
    const closeModalBtn = dom.$("closeUserModalBtn");
    if (!modal || !modalContent || !closeModalBtn) return;

    modal.classList.remove("hidden");
    modalContent.innerHTML = `<div class="flex items-center justify-center p-10"><div class="loading-spinner mr-3"></div><span class="text-white/80">Fetching user data...</span></div>`;
    
    const closeModal = () => modal.classList.add("hidden");
    closeModalBtn.onclick = closeModal;

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}`;
        console.log("DEBUG: Fetching single user data from:", url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch user");
        
        const user = data.data; 
        console.log("DEBUG: Successfully fetched user data, building modal HTML...");

        // *** THIS IS THE UPDATED HTML FOR THE MODAL ***
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
                    <div class="flex justify-end items-center mt-6 space-x-2">
                    <button id="modalDeleteUserBtn" class="btn btn-danger" ${user.tier === 'admin' ? 'disabled' : ''}>Delete User</button>
                    <button id="modalDisableUserBtn" class="btn btn-secondary" ${user.tier === 'admin' ? 'disabled' : ''}>Disable User</button>
                    <button id="modalUpdateUserBtn" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;

        // *** UPDATED LISTENERS ***
        console.log("DEBUG: Attaching modal button listeners...");
        dom.$("modalUpdateUserBtn").onclick = () => handleUserUpdate(user.id);
        
        if (user.tier !== 'admin') {
            dom.$("modalDisableUserBtn").onclick = () => handleUserDisable(user.id, user.email, closeModal);
            // Add the new delete listener
            dom.$("modalDeleteUserBtn").onclick = () => handleUserDelete(user.id, user.auth_user_id, user.email, closeModal);
        } else {
            console.log("DEBUG: User is admin, disabling delete/disable buttons.");
        }

    } catch (error) {
        console.error("Error in openUserManagementModal:", error);
        modalContent.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

/**
 * Handles the PUT /users/:id request to update a user.
 */
async function handleUserUpdate(userId) {
    console.log("DEBUG: handleUserUpdate() called for userId:", userId);
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
            email: dom.$("modalUserEmail").value,
            tier: dom.$("modalUserTier").value
        };
        console.log("DEBUG: Sending update data:", updatedData);

        // Call PUT /users/:id
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

        console.log("DEBUG: User update successful");
        showMessage("userModalMessage", "User updated successfully!", "success");
        await fetchAndRenderUsers(); // Refresh the main user table

    } catch (error) {
        console.error("Error in handleUserUpdate:", error);
        showMessage("userModalMessage", error.message, "error");
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalBtnText;
    }
}

/**
 * Handles the PUT /users/:id/disable request.
 */
async function handleUserDisable(userId, userEmail, closeModalCallback) {
    console.log("DEBUG: handleUserDisable() called for userId:", userId);
    if (!confirm(`Are you sure you want to disable this user?\n\nEmail: ${userEmail}\nID: ${userId}\n\nThis action is reversible and does NOT delete data.`)) {
        console.log("DEBUG: Disable cancelled by user.");
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
        
        // Call PUT /users/:id/disable
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}/disable`;
        console.log("DEBUG: Calling disable endpoint:", url);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` 
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to disable user");

        console.log("DEBUG: User disable successful");
        showMessage("userModalMessage", `User ${data.disabled_user?.email || ''} disabled successfully.`, "success");
        await fetchAndRenderUsers(); // Refresh the main user table
        setTimeout(closeModalCallback, 1500); // Close modal on success

    } catch (error) {
        console.error("Error in handleUserDisable:", error);
        showMessage("userModalMessage", error.message, "error");
    } finally {
        disableBtn.disabled = false;
        disableBtn.innerHTML = originalBtnText;
    }
}

/**
 * NEW: Handles the DELETE /users/:id request to permanently delete a user.
 */
async function handleUserDelete(userId, authUserId, userEmail, closeModalCallback) {
    console.log("DEBUG: handleUserDelete() called for userId:", userId);
    const warningMessage = `ARE YOU SURE you want to PERMANENTLY DELETE this user?\n\nEmail: ${userEmail}\nID: ${userId}\n\nThis action is IRREVERSIBLE and will delete their auth record and all data.`;
    
    if (!confirm(warningMessage)) {
        console.log("DEBUG: Delete cancelled by user.");
        return;
    }

    const messageEl = dom.$("userModalMessage");
    const deleteBtn = dom.$("modalDeleteUserBtn");
    const originalBtnText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Deleting...';

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // Call DELETE /users/:id
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/${userId}`;
        console.log("DEBUG: Calling DELETE endpoint:", url);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` 
            }
        });

        const data = await response.json();

        // --- THIS IS THE FIX ---
        // We now check for 'data.details' to get the *real* error message
        // from the server's catch block.
        if (!response.ok) {
            throw new Error(data.details || data.error || "Failed to delete user");
        }
        // --- END OF FIX ---

        console.log("DEBUG: User delete successful");
        showMessage("userModalMessage", "User permanently deleted.", "success");
        await fetchAndRenderUsers(1); // Refresh the main user table
        setTimeout(closeModalCallback, 1500); // Close modal on success

    } catch (error) {
        console.error("Error in handleUserDelete:", error);
        // This will now show the *specific* server error
        showMessage("userModalMessage", error.message, "error");
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalBtnText;
    }
}

/**
 * NEW: Opens the user modal in "Create" mode.
 */
function openCreateUserModal() {
    console.log("DEBUG: openCreateUserModal() called");
    const modal = dom.$("userManagementModal");
    const modalContent = dom.$("userModalContent");
    const closeModalBtn = dom.$("closeUserModalBtn");
    if (!modal || !modalContent || !closeModalBtn) return;

    modal.classList.remove("hidden");
    
    // Populate modal with a blank form for creation
    modalContent.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-200 mb-2">Email</label>
                <input type="email" id="modalUserEmail" class="input-field" placeholder="new.user@example.com">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-200 mb-2">Password</label>
                <input type="password" id="modalUserPassword" class="input-field" placeholder="Set a temporary password">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label for="modalUserFirstName" class="block text-sm font-medium text-gray-200 mb-2">First Name</label>
                    <input type="text" id="modalUserFirstName" class="input-field" value="">
                </div>
                <div>
                    <label for="modalUserLastName" class="block text-sm font-medium text-gray-200 mb-2">Last Name</label>
                    <input type="text" id="modalUserLastName" class="input-field" value="">
                </div>
            </div>
            <div>
                <label for="modalUserTier" class="block text-sm font-medium text-gray-200 mb-2">User Tier</label>
                <select id="modalUserTier" class="input-field">
                    <option value="basic" selected>Basic</option>
                    <option value="premium">Premium</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div id="userModalMessage" class="hidden"></div>
            <div class="flex justify-end items-center mt-6">
                <button id="modalCreateUserBtn" class="btn btn-primary">Create User</button>
            </div>
        </div>
    `;

    // Assign listeners for this new modal state
    console.log("DEBUG: Attaching 'Create User' modal listeners...");
    closeModalBtn.onclick = () => modal.classList.add("hidden");
    dom.$("modalCreateUserBtn").onclick = () => handleUserCreate();
}

/**
 * NEW: Handles the POST request to create a new user.
 */
async function handleUserCreate() {
    console.log("DEBUG: handleUserCreate() called");
    const messageEl = dom.$("userModalMessage");
    const createBtn = dom.$("modalCreateUserBtn");
    const originalBtnText = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Creating...';

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // Get data from modal fields
        const userData = {
            email: dom.$("modalUserEmail").value,
            password: dom.$("modalUserPassword").value,
            first_name: dom.$("modalUserFirstName").value,
            last_name: dom.$("modalUserLastName").value,
            tier: dom.$("modalUserTier").value
        };
        console.log("DEBUG: Creating user with data:", userData);

        if (!userData.email || !userData.password) {
            throw new Error("Email and Password are required.");
        }

        // Calls the new POST /users endpoint
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to create user");

        console.log("DEBUG: User creation successful");
        showMessage("userModalMessage", "User created successfully!", "success");
        await fetchAndRenderUsers(1); // Refresh the main user table
        
        setTimeout(() => {
            dom.$("userManagementModal").classList.add("hidden");
        }, 1500);

    } catch (error) {
        console.error("Error in handleUserCreate:", error);
        showMessage("userModalMessage", error.message, "error");
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = originalBtnText;
    }
}

/**
 * NEW: Handles bulk actions from the bulk action modal.
 */
async function handleBulkUserUpdate(action, userIds) {
    console.log("DEBUG: handleBulkUserUpdate() called for action:", action);
    const messageEl = dom.$("bulkModalMessage");
    const confirmBtn = dom.$("modalConfirmBulkBtn");
    
    // Add a confirmation for the delete action
    if (action === 'delete-users') {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${userIds.length} users? This action cannot be undone.`)) {
            console.log("DEBUG: Bulk delete cancelled by user.");
            return;
        }
    }
    
    // Set loading state
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Processing...';
    showMessage("bulkModalMessage", "Processing... Please wait.", "success");

    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // Calls the new 'bulk-update' endpoint
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-users-secure/users/bulk-update`;
        console.log("DEBUG: Calling bulk update endpoint:", url);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                action: action,
                userIds: userIds
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to perform bulk action");

        console.log("DEBUG: Bulk update successful");
        showMessage("bulkModalMessage", `Successfully processed ${data.count || 0} users. ${data.skipped_admins?.length || 0} admins were skipped.`, "success");
        await fetchAndRenderUsers(1); // Refresh the main user table

        // Automatically close the modal on success
        setTimeout(() => {
            dom.$("bulkActionModal").classList.add("hidden");
        }, 1500);

    } catch (error) {
        console.error("Error in handleBulkUserUpdate:", error);
        showMessage("bulkModalMessage", error.message, "error");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Apply Action';
    }
}


export {
    renderViewDatabaseTab,
    handleBulkUserUpdate
}