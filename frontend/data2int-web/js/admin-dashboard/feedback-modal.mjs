import { appState } from "../state/app-state.mjs";
import { appConfig } from "../config.mjs";
import { dom } from "../utils/dom-utils.mjs";

/**
 * Helper function to generate star ratings.
 */
function getStars(rating) {
    let stars = '';
    const maxStars = 5;
    const numRating = parseInt(rating);
    if (isNaN(numRating) || numRating < 1) return '<div></div>';
    
    for (let i = 1; i <= maxStars; i++) {
        stars += `<span class="${i <= numRating ? 'star-filled' : 'star-empty'}">★</span>`;
    }
    return `<div class="star-rating">${stars}</div>`;
}

/**
 * Helper function to generate status/type tags.
 */
function getTag(label, value, tagType = 'type') {
    if (!value) return '';
    const className = String(value).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `<span class="feedback-tag tag-${tagType}-${className}">${value}</span>`;
}

/**
 * Main controller for the Feedback Tab.
 */
function renderFeedbackTab() {
    console.log("DEBUG: renderFeedbackTab() called. Building UI..."); 
    const panel = dom.$("feedbackPanel");
    if (!panel) {
        console.error("DEBUG: feedbackPanel element not found!"); 
        return;
    }

    panel.innerHTML = `
        <div class="glass-container p-6"> 
            <h2 class="text-3xl font-bold mb-4">Feedback Management</h2>
            
            <div id="feedbackStatusTabs" class="feedback-tabs">
                <button class="feedback-tab-btn active" data-status="">All</button>
                <button class="feedback-tab-btn" data-status="Open">Open</button>
                <button class="feedback-tab-btn" data-status="In Progress">In Progress</button>
                <button class="feedback-tab-btn" data-status="Pending">Pending</button>
                <button class="feedback-tab-btn" data-status="Resolved">Resolved</button>
            </div>
            
            <div class="flex flex-col md:flex-row gap-4 mb-6">
                <div class="flex-grow">
                    <input type="text" id="feedbackSearch" class="input-field" placeholder="Search feedback...">
                </div>
                <div class="flex-shrink-0">
                    <select id="feedbackTypeFilter" class="input-field">
                        <option value="">All Types</option>
                        <option value="Bug / Error">Bug / Error</option>
                        <option value="Suggestion / Improvement">Suggestion / Improvement</option>
                        <option value="Not Satisfied">Not Satisfied</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            
            <div id="feedbackCardContainer">
                <p class="text-white/70 text-center p-10">Initializing feedback tab...</p>
            </div>
        </div>
    `;

    const statusTabs = panel.querySelector("#feedbackStatusTabs");
    const searchInput = panel.querySelector("#feedbackSearch");
    const typeFilter = panel.querySelector("#feedbackTypeFilter");

    statusTabs.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            console.log(`DEBUG: Status tab clicked. New status: '${e.target.dataset.status}'`); 
            statusTabs.querySelectorAll(".feedback-tab-btn").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            fetchAndRenderFeedback();
        }
    });

    let searchTimeout;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            console.log(`DEBUG: Search triggered. Term: '${searchInput.value}'`); 
            fetchAndRenderFeedback();
        }, 500);
    });

    typeFilter.addEventListener("change", () => {
        console.log(`DEBUG: Type filter changed. New type: '${typeFilter.value}'`); 
        fetchAndRenderFeedback();
    });

    console.log("DEBUG: renderFeedbackTab() finished. Calling fetchAndRenderFeedback() for the first time."); 
    fetchAndRenderFeedback();
}

/**
 * Fetches feedback data from Supabase based on current filters.
 */
async function fetchAndRenderFeedback() {
    console.log("DEBUG: fetchAndRenderFeedback() called."); 
    const container = dom.$("feedbackCardContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-center p-10">
            <div class="loading-spinner mr-3"></div>
            <span class="text-white/80">Fetching secure feedback...</span>
        </div>
    `;

    try {
        // 1. Get session token
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("You are not logged in.");

        // 2. Get filter values
        const status = document.querySelector("#feedbackStatusTabs .active").dataset.status || "";
        const searchTerm = dom.$("feedbackSearch").value.trim();
        const reason = dom.$("feedbackTypeFilter").value; // 'reason' matches the new function
        
        console.log(`DEBUG: Fetching with filters: Status='${status}', Search='${searchTerm}', Reason='${reason}'`); 

        // 3. Build URL with query parameters
        const params = new URLSearchParams({
            page: 1, // Add pagination later if needed
            limit: 50,
            sortBy: 'priority',
            sortOrder: 'asc'
        });
        if (status) params.append('status', status);
        if (reason) params.append('reason', reason);
        if (searchTerm) params.append('search', searchTerm);

        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-feedback-secure/feedback?${params.toString()}`;

        // 4. Call the secure Edge Function
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Failed to fetch feedback: ${response.statusText}`);
        }

        const feedbackItems = data.data || [];
        const count = data.pagination?.total || 0;

        console.log(`DEBUG: Supabase fetch success. Received ${feedbackItems.length} items. Total count: ${count}`); 

        appState.currentFeedbackItems = feedbackItems;
        console.log("DEBUG: Updated 'currentFeedbackItems' cache.", appState.currentFeedbackItems); 

        renderFeedbackCards(container, feedbackItems, count);

    } catch (error) {
        console.error("Error fetching feedback:", error);
        container.innerHTML = `<div class="error-message p-4">${error.message}</div>`;
    }
}

/**
 * Renders the individual feedback cards into the container.
 */
function renderFeedbackCards(container, feedbackItems, totalCount) {
    console.log(`DEBUG: renderFeedbackCards() called. Rendering ${feedbackItems ? feedbackItems.length : 0} cards.`); 
    if (!feedbackItems || feedbackItems.length === 0) {
        container.innerHTML = `<p class="text-white/70 text-center p-10">No feedback found matching your criteria.</p>`;
        return;
    }

    let cardsHtml = `<p class="text-white/70 text-sm mb-4">Showing ${feedbackItems.length} of ${totalCount} items.</p>`;

    feedbackItems.forEach(item => {
        const user = item.users;
        const displayName = (user && user.first_name) 
            ? `${user.first_name} ${user.last_name || ''}`.trim() 
            : (user && user.email) ? user.email.split('@')[0] : 'Anonymous';
        const displayEmail = user ? user.email : 'N/A';

        cardsHtml += `
            <div class="feedback-card">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        ${getTag('Type', item.reason, 'type')}
                        ${getTag('Priority', item.priority, 'priority')}
                        ${getTag('Status', item.status, 'status')}
                    </div>
                    
                    <button class="admin-view-feedback-btn btn btn-secondary py-1 px-3 text-xs" title="View details" data-id="${item.id}">
                        View Details
                    </button>
                </div>
                
                <h4 class="text-xl font-bold text-white mb-2">${item.reason || 'Feedback Submitted'}</h4> 
                <p class="text-white/80 text-sm mb-4">${item.content}</p>
                
                <div class="flex justify-between items-center border-t border-white/10 pt-3">
                    <div class="text-xs text-white/60">
                        <span class="font-medium">${displayName}</span>
                        <span class="mx-1">·</span>
                        <span>${displayEmail}</span>
                    </div>
                    ${getStars(item.rating)}
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;

    console.log("DEBUG: Cards HTML rendered. Attaching click listeners..."); 

    container.querySelectorAll('.admin-view-feedback-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const feedbackId = e.currentTarget.dataset.id;
            console.log(`DEBUG: 'View Details' button clicked for feedback ID: ${feedbackId}`); 
            openFeedbackModal(feedbackId);
        });
    });
    console.log("DEBUG: Click listeners attached."); 
}

/**
 * Opens the beautiful feedback modal.
 */
function openFeedbackModal(feedbackId) {
    console.log(`DEBUG: openFeedbackModal() called for ID: ${feedbackId}`);
    
    const modal = dom.$("feedbackDetailModal");
    const modalContent = dom.$("feedbackModalContent");
    
    if (!modal || !modalContent) {
        console.error("DEBUG: Modal elements not found!");
        return;
    }

    const item = appState.currentFeedbackItems.find(f => f.id == feedbackId);
    if (!item) {
        console.error(`DEBUG: Failed to find feedbackId ${feedbackId} in cache!`);
        alert("Error: Could not find feedback data.");
        return;
    }

    console.log("DEBUG: Found item in cache. Building modal content...", item);
    
    // Show modal with animation
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('modal-open'), 10);
    
    const user = item.users;
    const displayName = (user && user.first_name) ? `${user.first_name} ${user.last_name || ''}`.trim() : (user && user.email) ? user.email.split('@')[0] : 'Anonymous';
    const displayEmail = user ? user.email : 'N/A';

    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-title-section">
                <h3 class="modal-title">${item.reason || 'Feedback'}</h3>
                <div class="modal-rating">${getStars(item.rating)}</div>
            </div>
            <button class="modal-close-btn" id="modalCloseBtn">&times;</button>
        </div>
        
        <div class="modal-body">
            <div class="modal-tags">
                ${getTag('Type', item.reason, 'type')}
                ${getTag('Priority', item.priority, 'priority')}
                ${getTag('Status', item.status, 'status')}
            </div>
            
            <div class="modal-content-section">
                <h4 class="modal-section-title">Feedback Content</h4>
                <div class="modal-feedback-content">
                    ${item.content}
                </div>
            </div>
            
            <div class="modal-info-grid">
                <div class="modal-info-card">
                    <h5 class="modal-info-label">From</h5>
                    <div class="modal-info-value">${displayName}</div>
                    <div class="modal-info-sub">${displayEmail}</div>
                </div>
                <div class="modal-info-card">
                    <h5 class="modal-info-label">Submitted</h5>
                    <div class="modal-info-value">${new Date(item.created_at).toLocaleDateString()}</div>
                    <div class="modal-info-sub">${new Date(item.created_at).toLocaleTimeString()}</div>
                </div>
                <div class="modal-info-card">
                    <h5 class="modal-info-label">Status</h5>
                    <div class="modal-info-value">${item.status}</div>
                </div>
                <div class="modal-info-card">
                    <h5 class="modal-info-label">Category</h5>
                    <div class="modal-info-value">${item.tool_name}</div>
                </div>
            </div>

            <div class="modal-status-section">
                <h4 class="modal-section-title">Update Status</h4>
                <div class="modal-status-controls">
                    <select id="modalStatusSelect" class="modal-select">
                        <option value="Open" ${item.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                    <button id="modalUpdateBtn" class="modal-btn modal-btn-primary">Update</button>
                </div>
            </div>
            
            <div class="modal-notes-section">
                <h4 class="modal-section-title">Internal Notes</h4>
                <textarea id="modalNotes" class="modal-textarea" placeholder="Add internal notes about this feedback...">${item.admin_notes || ''}</textarea>
                <button id="modalSaveNotesBtn" class="modal-btn modal-btn-secondary">Save Notes (Soon)</button>
            </div>
        </div>
    `;

    console.log("DEBUG: Modal content generated. Attaching listeners...");

    // Attach event listeners
    setTimeout(() => {
        const closeBtn = dom.$("modalCloseBtn");
        const updateBtn = dom.$("modalUpdateBtn");
        const saveNotesBtn = dom.$("modalSaveNotesBtn");
        
        // Close button handler
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log("DEBUG: Close button clicked");
                closeFeedbackModal();
            };
        }

        if (updateBtn) {
            updateBtn.onclick = async () => {
                const statusSelect = dom.$("modalStatusSelect");
                const newStatus = statusSelect ? statusSelect.value : 'Open';
                console.log(`DEBUG: 'Update Status' clicked. New status: ${newStatus}`);
                await handleUpdateFeedbackStatus(item.id, newStatus, null);
            };
        }

        if (saveNotesBtn) {
            // Make the button functional and remove "(Soon)"
            saveNotesBtn.textContent = "Save Notes";
            saveNotesBtn.onclick = () => {
                console.log("DEBUG: 'Save Notes' clicked");
                // Pass the feedback item's ID to your new handler
                handleSaveFeedbackNotes(item.id); 
            };
        }
    }, 100);
}

/**
 * Closes the feedback modal.
 */
function closeFeedbackModal() {
    console.log("DEBUG: closeFeedbackModal() called");
    const modal = dom.$("feedbackDetailModal");
    if (modal) {
        modal.classList.remove('modal-open');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

/**
 * Shows messages in the modal.
 */
function showModalMessage(message, type) {
    const messageEl = dom.$("modalMessage");
    if (messageEl) {
        messageEl.style.display = "block";
        messageEl.className = `modal-message ${type === "error" ? "modal-message-error" : "modal-message-success"}`;
        messageEl.textContent = message;
        
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 3000);
    }
}

/**
 * Handles updating the status of a feedback item.
 */
async function handleUpdateFeedbackStatus(feedbackId, newStatus, closeCallback) {
    console.log(`DEBUG: handleUpdateFeedbackStatus() called. ID: ${feedbackId}, New Status: ${newStatus}`); 
    const updateBtn = dom.$("modalUpdateBtn");
    
    if(updateBtn) updateBtn.disabled = true;
    showModalMessage("Updating...", "success");
    
    try {
        // 1. Get session token
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // 2. Call the secure Edge Function
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-feedback-secure/feedback/${feedbackId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to update status");
        }
            
        console.log("DEBUG: Supabase update success:", data.data); 
        showModalMessage(`Status updated to "${newStatus}"!`, "success");
        
        // 3. Refresh the list from the server
        await fetchAndRenderFeedback();
        
        if (closeCallback) {
            setTimeout(closeCallback, 1500);
        }

    } catch (error) {
        console.error("Error updating status:", error);
        showModalMessage(error.message, "error");
    } finally {
        if(updateBtn) updateBtn.disabled = false;
    }
}

/**
 * Handles saving the internal admin notes via the SECURE EDGE FUNCTION.
 */
async function handleSaveFeedbackNotes(feedbackId) {
    console.log(`DEBUG: handleSaveFeedbackNotes() called for ID: ${feedbackId}`);
    
    const notesText = dom.$("modalNotes").value.trim();
    const saveBtn = dom.$("modalSaveNotesBtn");
    if (!saveBtn) return;

    const originalBtnText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Saving...';
    
    showModalMessage("Saving notes...", "success"); 

    try {
        // 1. Get session token
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("You are not authenticated.");

        // 2. Call the secure Edge Function
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-feedback-secure/feedback/${feedbackId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ admin_notes: notesText }) // Send only the notes
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to save notes");
        }
        
        const updatedNotes = data.data?.admin_notes;

        // 3. Update the local cache
        const index = appState.currentFeedbackItems.findIndex(f => f.id == feedbackId);
        if (index !== -1) {
            appState.currentFeedbackItems[index].admin_notes = updatedNotes;
            console.log("DEBUG: Local cache updated with new notes.");
        }
        
        // 4. Show success
        showModalMessage("Notes saved successfully!", "success");

    } catch (error) {
        console.error("Error saving notes:", error);
        showModalMessage(error.message, "error");
    } finally {
        // 5. Reset button
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

export {
    renderFeedbackTab,
    closeFeedbackModal
}
