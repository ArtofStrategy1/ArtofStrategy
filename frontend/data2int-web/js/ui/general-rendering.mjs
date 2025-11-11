import { appState } from '../state/app-state.mjs';
import { dom } from '../utils/dom-utils.mjs';

// --- Function called when the 'Contact Approvals' tab is activated ---
async function renderContactApprovalsTab() {
    const container = dom.$("approvalsPanel");
    container.innerHTML = `<div class="glass-container p-6">
        <h3 class="text-2xl font-bold mb-4">Contact Section Approvals</h3>
        <p class="text-sm text-white/70 mb-4">Review and approve contact messages before processing (from publicv2.contacts).</p>
        <div id="contactApprovalList" class="space-y-4">
            <div class="text-center text-white/70">Loading messages... <span class="loading-spinner ml-2"></span></div>
        </div>
        <div id="contactApprovalMessage" class="hidden mt-4"></div>
    </div>`;

    const listContainer = dom.$("contactApprovalList");
    
    // *** Fetch contacts explicitly targeting the publicv2 schema and only unapproved messages ***
    const { data: contacts, error } = await appState.supabase
        .schema('publicv2') 
        .from('contacts')
        .select('*')
        .eq('is_approved', false) // Filters for pending messages
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = `<p class="error-message">Error loading contacts: ${error.message}</p>`;
        return;
    }

    if (contacts.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-white/70">✅ No pending contact messages found.</p>`;
        return;
    }

    let html = '';
    contacts.forEach(contact => {
        html += `
            <div id="contact-${contact.id}" class="bg-black/20 p-4 rounded-lg border border-white/10">
                <p class="font-bold">${contact.first_name} ${contact.last_name} (${contact.email})</p>
                <p class="text-xs text-indigo-300 mt-1">Subject: ${contact.subject} | Phone: ${contact.phone || 'N/A'}</p>
                <p class="text-xs text-white/70">Company: ${contact.company_name || 'N/A'}</p>
                <p class="text-sm text-white/80 mt-2 whitespace-pre-wrap">${contact.message}</p>
                <div class="text-right mt-3 space-x-2">
                    <button class="btn btn-primary btn-sm" data-id="${contact.id}" data-action="approve">Approve & Archive</button>
                    <button class="btn btn-danger btn-sm" data-id="${contact.id}" data-action="delete">Delete Permanently</button>
                </div>
            </div>`;
    });
    listContainer.innerHTML = html;

    // Attach event listeners (relying on handleContactApproval being defined)
    listContainer.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => handleContactApproval(e));
    });
}

export {
    renderContactApprovalsTab
}