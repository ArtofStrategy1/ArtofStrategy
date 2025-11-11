import { appState } from "../state/app-state.mjs";
import { appConfig } from "../config.mjs";
import { dom } from "../utils/dom-utils.mjs";

/**
 * Main controller for the Contacts Tab.
 * Builds the UI and triggers the first data fetch.
 */
function renderContactsTab() {
    console.log("DEBUG: renderContactsTab() called. Building UI...");
    const panel = dom.$("contactsPanel");
    if (!panel) {
        console.error("DEBUG: contactsPanel element not found!");
        return;
    }

    // 1. Build the UI (Toolbar + Table Placeholder)
    panel.innerHTML = `
        <div class="glass-container p-6"> 
            <h2 class="text-3xl font-bold mb-4">Contact Form Submissions</h2>
            
            <div class="flex flex-col md:flex-row gap-4 mb-6">
                <div class="flex-grow">
                    <input type="text" id="contactSearch" class="input-field" placeholder="Search email, subject, or message...">
                </div>
                <div class="flex-shrink-0">
                    <select id="contactStatusFilter" class="input-field">
                        <option value="">All Statuses</option>
                        <option value="New">New</option>
                        <option value="Replied">Replied</option>
                        <option value="Archived">Archived</option>
                    </select>
                </div>
                <div class="flex-shrink-0">
                    <select id="contactSortBy" class="input-field">
                        <option value="created_at" selected>Sort by: Newest</option>
                        <option value="email">Sort by: Email</option>
                        <option value="last_name">Sort by: Last Name</option>
                    </select>
                </div>
            </div>
            
            <div id="contactCardContainer" class="overflow-x-auto">
                <p class="text-white/70 text-center p-10">Initializing contacts tab...</p>
            </div>
        </div>
    `;

    // 2. Attach event listeners
    const searchInput = panel.querySelector("#contactSearch");
    const statusFilter = panel.querySelector("#contactStatusFilter");
    const sortSelect = panel.querySelector("#contactSortBy");

    let searchTimeout;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchAndRenderContacts(1); // Reset to page 1
        }, 500);
    });

    statusFilter.addEventListener("change", () => fetchAndRenderContacts(1));
    sortSelect.addEventListener("change", () => fetchAndRenderContacts(1));

    // 3. Initial data load
    fetchAndRenderContacts(1);
}

/**
 * Fetches contact data from the SECURE EDGE FUNCTION.
 */
async function fetchAndRenderContacts(page = 1) {
    console.log("DEBUG: fetchAndRenderContacts() called."); 
    const container = dom.$("contactCardContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-center p-10">
            <div class="loading-spinner mr-3"></div>
            <span class="text-white/80">Fetching secure contacts...</span>
        </div>
    `;

    try {
        // 1. Get session token
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("You are not logged in.");

        // 2. Get filter values
        const status = dom.$("contactStatusFilter").value;
        const searchTerm = dom.$("contactSearch").value.trim();
        const sortBy = dom.$("contactSortBy").value;
        
        console.log(`DEBUG: Fetching contacts: Status='${status}', Search='${searchTerm}', Sort='${sortBy}'`); 

        // 3. Build URL
        const params = new URLSearchParams({
            page: page,
            limit: 20, // 20 per page
            sortBy: sortBy,
            sortOrder: 'desc'
        });
        if (status) params.append('status', status);
        if (searchTerm) params.append('search', searchTerm);

        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-contacts-secure/contacts?${params.toString()}`;

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
            throw new Error(data.error || `Failed to fetch contacts: ${response.statusText}`);
        }

        const contactItems = data.data || [];
        const pagination = data.pagination || {};

        console.log(`DEBUG: Contact fetch success. Received ${contactItems.length} items.`); 

        appState.currentContactItems = contactItems; // Update cache
        renderContactsTable(container, contactItems, pagination); // Render as a table

    } catch (error) {
        console.error("Error fetching contacts:", error);
        container.innerHTML = `<div class="error-message p-4">${error.message}</div>`;
    }
}

/**
 * Renders the contacts as a table (similar to Users tab).
 */
function renderContactsTable(container, contacts, pagination) {
    if (!contacts || contacts.length === 0) {
        container.innerHTML = `<p class="text-white/70 text-center p-10">No contacts found matching your criteria.</p>`;
        return;
    }

    let tableHtml = `
        <table class="w-full text-left styled-table">
            <thead>
                <tr>
                    <th class="p-3">Status</th>
                    <th class="p-3">Date</th>
                    <th class="p-3">From</th>
                    <th class="p-3">Subject</th>
                    <th class="p-3">Company</th>
                    <th class="p-3 w-24">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    contacts.forEach(item => {
        const displayName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A';
        const statusTag = item.status === 'New' ? 'tag-status-open' : 
                          item.status === 'Replied' ? 'tag-status-resolved' : 'tag-type';
        
        tableHtml += `
            <tr class="border-b border-white/10">
                <td class="p-3"><span class="feedback-tag ${statusTag}">${item.status}</span></td>
                <td class="p-3 text-sm">${new Date(item.created_at).toLocaleDateString()}</td>
                <td class="p-3">
                    <div>${displayName}</div>
                    <div class="text-xs text-white/60" style="overflow-wrap: break-word;">${item.email}</div>
                </td>
                <td class="p-3">${item.subject}</td>
                <td class="p-3 text-sm text-white/70">${item.company_name || 'N/A'}</td>
                <td class="p-3">
                    <button class="admin-view-contact-btn btn btn-secondary py-1 px-3 text-xs" data-id="${item.id}">
                        View
                    </button>
                </td>
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
            tableHtml += `<button class="btn btn-secondary pagination-btn-contact" data-page="${pagination.page - 1}">Previous</button>`;
        }
        if (pagination.page < pagination.totalPages) {
            tableHtml += `<button class="btn btn-secondary pagination-btn-contact" data-page="${pagination.page + 1}">Next</button>`;
        }
        tableHtml += `</div></div>`;
    }

    container.innerHTML = tableHtml;

    // Attach "View" button listeners
    container.querySelectorAll('.admin-view-contact-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const contactId = e.currentTarget.dataset.id;
            openContactModal(contactId);
        });
    });

    // Attach pagination listeners
    container.querySelectorAll('.pagination-btn-contact').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.target.dataset.page;
            fetchAndRenderContacts(parseInt(newPage));
        });
    });
}

/**
 * Opens the modal for a specific contact message.
 */
function openContactModal(contactId) {
    console.log(`DEBUG: openContactModal() called for ID: ${contactId}`);
    
    const modal = dom.$("contactDetailModal");
    const modalContent = dom.$("contactModalContent");
    if (!modal || !modalContent) return;

    const item = appState.currentContactItems.find(c => c.id == contactId);
    if (!item) {
        alert("Error: Could not find contact data.");
        return;
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('modal-open'), 10);
    
    const displayName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A';
    const emailSubject = `Re: ${item.subject || 'Your Inquiry'}`;

    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-title-section">
                <h3 class="modal-title">${item.subject || 'Contact Submission'}</h3>
            </div>
            <button class="modal-close-btn" id="modalCloseContactBtn">&times;</button>
        </div>
        
        <div class="modal-body" style="max-height: 80vh; padding: 1.5rem 1.5rem 3.5rem;">
            <div class="modal-tags">
                <span class="feedback-tag ${item.status === 'New' ? 'tag-status-open' : 'tag-status-resolved'}">${item.status}</span>
                ${item.company_name ? `<span class="feedback-tag tag-type">${item.company_name}</span>` : ''}
            </div>
            
            <div class="modal-content-section" style="margin-bottom: 1.25rem;">
                <h4 class="modal-section-title" style="font-size: 1rem; margin-bottom: 0.5rem;">Message Content</h4>
                <div class="modal-feedback-content" style="font-size: 0.9rem; padding: 1rem;">
                    ${item.message}
                </div>
            </div>
            
            <div class="modal-info-grid" style="margin-bottom: 1.5rem;">
                <div class="modal-info-card" style="padding: 0.75rem 1rem;">
                    <h5 class="modal-info-label" style="font-size: 0.7rem; margin-bottom: 0.25rem;">From</h5>
                    <div class="modal-info-value" style="font-size: 0.875rem;">${displayName}</div>
                    <div class="modal-info-sub" style="font-size: 0.7rem; overflow-wrap: break-word;">${item.email}</div>
                </div>
                <div class="modal-info-card" style="padding: 0.75rem 1rem;">
                    <h5 class="modal-info-label" style="font-size: 0.7rem; margin-bottom: 0.25rem;">Submitted</h5>
                    <div class="modal-info-value" style="font-size: 0.875rem;">${new Date(item.created_at).toLocaleDateString()}</div>
                    <div class="modal-info-sub" style="font-size: 0.7rem;">${new Date(item.created_at).toLocaleTimeString()}</div>
                </div>
                <div class="modal-info-card" style="padding: 0.75rem 1rem;">
                    <h5 class="modal-info-label" style="font-size: 0.7rem; margin-bottom: 0.25rem;">Status</h5>
                    <div class="modal-info-value" style="font-size: 0.875rem;">${item.status}</div>
                </div>
                <div class="modal-info-card" style="padding: 0.75rem 1rem;">
                    <h5 class="modal-info-label" style="font-size: 0.7rem; margin-bottom: 0.25rem;">Phone</h5>
                    <div class="modal-info-value" style="font-size: 0.875rem;">${item.phone || 'N/A'}</div>
                </div>
            </div>
            
            <div id="contactModalMessage" class="modal-message" style="display: none;"></div>

            <div class="modal-status-section" style="margin-bottom: 1.25rem;">
                <h4 class="modal-section-title" style="font-size: 1rem; margin-bottom: 0.5rem;">Actions</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a href="mailto:${item.email}?subject=${encodeURIComponent(emailSubject)}" 
                       id="modalReplyContactBtn" 
                       class="modal-btn modal-btn-primary" 
                       style="padding: 0.75rem 1.25rem; font-size: 0.9rem;">
                       <span class="modal-btn-icon">↩️</span>
                       Reply via Email
                    </a>
                    
                    <div class="modal-status-controls">
                        <select id="modalContactStatusSelect" class="modal-select" style="padding: 0.75rem 1rem;">
                            <option value="New" ${item.status === 'New' ? 'selected' : ''}>Mark as New</option>
                            <option value="Replied" ${item.status === 'Replied' ? 'selected' : ''}>Mark as Replied</option>
                            <option value="Archived" ${item.status === 'Archived' ? 'selected' : ''}>Mark as Archived</option>
                        </select>
                        <button id="modalUpdateContactBtn" class="modal-btn modal-btn-secondary" style="padding: 0.75rem 1.25rem; font-size: 0.9rem;">Update</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners for the new modal
    setTimeout(() => {
        const closeBtn = dom.$("modalCloseContactBtn");
        const replyBtn = dom.$("modalReplyContactBtn");
        const updateBtn = dom.$("modalUpdateContactBtn");
        
        if (closeBtn) {
            closeBtn.onclick = closeContactModal;
        }
        
        if (replyBtn) {
            // This is the corrected line:
            replyBtn.onclick = () => {
                // This is just a link, but we also update status
                // in the background for a better UX.
                handleUpdateContactStatus(item.id, 'Replied');
            };
        }
        
        if (updateBtn) {
            updateBtn.onclick = () => {
                const statusSelect = dom.$("modalContactStatusSelect");
                const newStatus = statusSelect ? statusSelect.value : 'New';
                // Pass the closeCallback so the modal closes on update
                handleUpdateContactStatus(item.id, newStatus, closeContactModal); 
            };
        }
    }, 100);
}

/**
 * Closes the contact modal.
 */
function closeContactModal() {
    const modal = dom.$("contactDetailModal");
    if (modal) {
        modal.classList.remove('modal-open');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

/**
 * Handles updating the status of a contact item via the SECURE EDGE FUNCTION.
 */
async function handleUpdateContactStatus(contactId, newStatus, closeCallback) {
    console.log(`DEBUG: handleUpdateContactStatus() called. ID: ${contactId}, New Status: ${newStatus}`); 
    const updateBtn = dom.$("modalUpdateContactBtn");
    
    if(updateBtn) updateBtn.disabled = true;
    showContactModalMessage("Updating...", "success");
    
    try {
        // 1. Get session token
        const { data: { session }, error: sessionError } = await appConfig.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Not logged in");

        // 2. Call the secure Edge Function
        const url = `${appConfig.SUPABASE_URL}/functions/v1/admin-contacts-secure/contacts/${contactId}`;
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
            
        console.log("DEBUG: Contact update success:", data.data); 
        showContactModalMessage(`Status updated to "${newStatus}"!`, "success");
        
        // 3. Refresh the main contact list from the server
        await fetchAndRenderContacts(1); // Go back to page 1
        
        if (closeCallback) {
            setTimeout(closeCallback, 1500);
        }

    } catch (error) {
        console.error("Error updating contact status:", error);
        showContactModalMessage(error.message, "error");
    } finally {
        if(updateBtn) updateBtn.disabled = false;
    }
}

/**
 * Shows messages in the contact modal.
 */
function showContactModalMessage(message, type) {
    const messageEl = dom.$("contactModalMessage");
    if (messageEl) {
        messageEl.style.display = "block";
        messageEl.className = `modal-message ${type === "error" ? "modal-message-error" : "modal-message-success"}`;
        messageEl.textContent = message;
        
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 3000);
    }
}

// Global click handler to close contact modal
document.addEventListener('click', (e) => {
    const modal = dom.$("contactDetailModal");
    if (modal && e.target === modal) {
        closeContactModal();
    }
});

// Global escape key handler for contact modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = dom.$("contactDetailModal");
        if (modal && modal.style.display === 'flex') {
            closeContactModal();
        }
    }
});

export {
    renderContactsTab
}