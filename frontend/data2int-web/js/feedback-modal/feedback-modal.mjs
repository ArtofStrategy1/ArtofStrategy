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
            <span class="text-white/80">Fetching feedback...</span>
        </div>
    `;

    try {
        const status = document.querySelector("#feedbackStatusTabs .active").dataset.status || "";
        const searchTerm = dom.$("feedbackSearch").value.trim();
        const type = dom.$("feedbackTypeFilter").value;

        console.log(`DEBUG: Fetching with filters: Status='${status}', Search='${searchTerm}', Type='${type}'`); 

        let query = appConfig.supabase
            .from('feedback')
            .select(`
                *,
                users (
                    first_name,
                    last_name,
                    email
                )
            `, { count: 'exact' });

        if (status) {
            query = query.eq('status', status); 
        }
        if (type) {
            query = query.eq('reason', type); 
        }
        if (searchTerm) {
            query = query.ilike('content', `%${searchTerm}%`); 
        }

        query = query.order('priority', { ascending: true, nullsFirst: false }); 
        query = query.order('created_at', { ascending: false });

        const { data, error, count } = await query.limit(50); 

        if (error) {
            console.error("DEBUG: Supabase fetch error:", error); 
            if (error.code === "42703") { 
                throw new Error("Database error. Did you add the `status` and `priority` columns to your `publicv2.feedback` table?");
            }
            throw error;
        }

        console.log(`DEBUG: Supabase fetch success. Received ${data ? data.length : 0} items. Total count: ${count}`); 

        appState.currentFeedbackItems = data || [];
        console.log("DEBUG: Updated 'appState.currentFeedbackItems' cache.", appState.currentFeedbackItems); 

        renderFeedbackCards(container, data, count);

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
            
            <div class="modal-actions-section">
                <h4 class="modal-section-title">Actions</h4>
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <div class="modal-action-buttons">
                    <button class="modal-btn modal-btn-primary" id="modalReplyBtn">
                        <span class="modal-btn-icon">↩️</span>
                        Reply to User
                    </button>
                    <button class="modal-btn modal-btn-success" id="modalResolveBtn">
                        <span class="modal-btn-icon">✅</span>
                        Mark as Resolved
                    </button>
                    <button class="modal-btn modal-btn-secondary" id="modalArchiveBtn">
                        <span class="modal-btn-icon">📁</span>
                        Archive (Soon)
                    </button>
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
                <textarea id="modalNotes" class="modal-textarea" placeholder="Add internal notes about this feedback..."></textarea>
                <button id="modalSaveNotesBtn" class="modal-btn modal-btn-secondary">Save Notes (Soon)</button>
            </div>
        </div>
    `;

    console.log("DEBUG: Modal content generated. Attaching listeners...");

    // Attach event listeners
    setTimeout(() => {
        const closeBtn = dom.$("modalCloseBtn");
        const replyBtn = dom.$("modalReplyBtn");
        const resolveBtn = dom.$("modalResolveBtn");
        const updateBtn = dom.$("modalUpdateBtn");
        const archiveBtn = dom.$("modalArchiveBtn");
        const saveNotesBtn = dom.$("modalSaveNotesBtn");
        
        // Close button handler
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log("DEBUG: Close button clicked");
                closeFeedbackModal();
            };
        }
        
        if (replyBtn) {
            replyBtn.onclick = () => {
                console.log("DEBUG: 'Reply' clicked");
                showModalMessage("Reply feature is not yet connected.", "error");
            };
        }

        if (resolveBtn) {
            resolveBtn.onclick = async () => {
                console.log("DEBUG: 'Resolve' clicked");
                await handleUpdateFeedbackStatus(item.id, 'Resolved', closeFeedbackModal);
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

        if (archiveBtn) {
            archiveBtn.onclick = () => {
                console.log("DEBUG: 'Archive' clicked");
                showModalMessage("Archive feature is not yet connected.", "error");
            };
        }

        if (saveNotesBtn) {
            saveNotesBtn.onclick = () => {
                console.log("DEBUG: 'Save Notes' clicked");
                showModalMessage("Internal notes are not yet connected.", "error");
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
    const resolveBtn = dom.$("modalResolveBtn");
    
    if(updateBtn) updateBtn.disabled = true;
    if(resolveBtn) resolveBtn.disabled = true;
    showModalMessage("Updating...", "success");
    
    try {
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        const { data, error } = await appConfig.supabase
            .from('feedback')
            .update({ status: newStatus })
            .eq('id', feedbackId)
            .select();
            
        if (error) {
            console.error("DEBUG: Supabase update error:", error); 
            throw error;
        }
        
        console.log("DEBUG: Supabase update success:", data); 
        showModalMessage(`Status updated to "${newStatus}"!`, "success");
        await fetchAndRenderFeedback();
        
        if (closeCallback) {
            setTimeout(closeCallback, 1500);
        }

    } catch (error) {
        console.error("Error updating status:", error);
        showModalMessage(error.message, "error");
    } finally {
        if(updateBtn) updateBtn.disabled = false;
        if(resolveBtn) resolveBtn.disabled = false;
    }
}

export {
    renderFeedbackTab,
    closeFeedbackModal
}
