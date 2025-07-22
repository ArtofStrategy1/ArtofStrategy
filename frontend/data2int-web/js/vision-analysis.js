const messageInput = document.getElementById('messageInput');
const charCount = document.getElementById('charCount');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const chatMessages = document.getElementById('chatMessages');

// Global variable to store the WebSocket connection
let ws;
// Map to store temporary AI message IDs, keyed by execution ID if available
const activeAiMessages = new Map();

// --- WebSocket Setup ---
// IMPORTANT: Replace 'wss://listener.ai2int.com/ws' with your actual WebSocket URL for FastAPI
const websocketUrl = 'wss://api.data2int.com/ws';

function connectWebSocket() {
    // Prevent multiple connections
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log("WebSocket already connected or connecting.");
        return;
    }

    ws = new WebSocket(websocketUrl);

    ws.onopen = (event) => {
        console.log('WebSocket connected:', event);
        addMessage('Connected to real-time updates from AI.', 'ai');
    };

    ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            // Assuming n8n sends the final report_content or a structured JSON
            const executionId = data.executionId; // Assuming n8n sends an executionId
            const content = data.report_content || data.message || JSON.stringify(data, null, 2);

            let targetMessageId = null;
            if (executionId && activeAiMessages.has(executionId)) {
                targetMessageId = activeAiMessages.get(executionId);
                updateMessage(targetMessageId, content); // Update the specific AI message
                activeAiMessages.delete(executionId); // Remove from map once updated
            } else {
                // If no executionId or not found, add as a new message
                addMessage(`Real-time update: ${content}`, 'ai');
            }

        } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
            addMessage(`Real-time update (raw): ${event.data}`, 'ai');
        }
    };

    ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event);
        addMessage('Disconnected from real-time updates. Attempting to reconnect in 3 seconds...', 'ai');
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addMessage('WebSocket error occurred. Check console for details.', 'ai');
        ws.close(); // Close to trigger onclose and reconnect logic
    };
}

// Connect WebSocket when the page loads
window.addEventListener('load', connectWebSocket);

// --- Utility Functions (mostly unchanged) ---
function updateSendButtonState() {
    sendButton.disabled = messageInput.value.trim().length === 0;
}
updateSendButtonState(); // Initial state

messageInput.addEventListener('input', function () {
    const count = this.value.length;
    charCount.textContent = `${count}/2000`;
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    updateSendButtonState();
});

fileInput.addEventListener('change', function () {
    if (this.files.length > 0) {
        const fileNames = Array.from(this.files).map((f) => f.name).join(', ');
        fileName.textContent = fileNames;
        filePreview.classList.remove('hidden');
        filePreview.classList.add('animate-slide-up');
    }
});

removeFile.addEventListener('click', function () {
    fileInput.value = '';
    filePreview.classList.add('hidden');
    fileName.textContent = 'No files selected';
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    }
});

// --- Modified sendMessage function ---
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message
    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';
    charCount.textContent = '0/2000';
    updateSendButtonState();

    // Add initial "AI is thinking..." message and store its ID
    const aiMessageElement = addMessage('AI is thinking...', 'ai', true); // Pass true for isLoading
    const aiMessageId = aiMessageElement.id; // Get the ID of the created message element

    const payload = [{
        customerName: 'GUI User',
        location: 'Browser',
        useCase: 'General Prompt',
        prompt: message,
    }];

    try {
        // Make the initial fetch request to n8n
        // n8n should immediately respond with a status and optionally an executionId
        const response = await fetch('https://n8n.data2int.com/webhook-test/vision-analysis-13', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error: ${response.status}` }));
            updateMessage(aiMessageId, `Error starting workflow: ${errorData.message || 'Unknown error'}`);
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json(); // This is the immediate response from n8n
        const status = data.status || 'processing';
        const executionId = data.executionId; // Get execution ID from n8n's immediate response

        updateMessage(aiMessageId, `Workflow status: ${status}. Waiting for real-time updates...`);

        // If n8n provides an executionId, map it to the AI message ID for later update
        if (executionId) {
            activeAiMessages.set(executionId, aiMessageId);
        }

    } catch (error) {
        console.error('Fetch error:', error);
        updateMessage(aiMessageId, 'Error: Could not start workflow. ' + error.message);
    }
}

// --- Message Display Functions (slightly modified for ID handling) ---
function addMessage(text, sender, isLoading = false) {
    const wrapper = document.createElement('div');
    // Assign a unique ID to the wrapper for easier updates
    const messageUniqueId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    wrapper.id = messageUniqueId; // Assign ID to the wrapper
    wrapper.classList.add('flex', 'items-start', 'space-x-4', sender === 'user' ? 'justify-end' : 'justify-start', 'animate-slide-right');

    const bubble = document.createElement('div');
    bubble.classList.add('rounded-2xl', 'p-6', 'max-w-[70%]', sender === 'user' ? 'message-user' : 'message-ai', 'shadow-lg', 'whitespace-pre-wrap');

    if (isLoading) {
        bubble.innerHTML = `
            <div class="flex flex-col space-y-2">
                <span class="text-sm text-gray-500 mb-1">AI is thinking...</span>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
    } else {
        bubble.innerHTML = renderMarkdown(text);
    }

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return wrapper; // Return the wrapper element so its ID can be used
}

function updateMessage(elementId, text) {
    const wrapper = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (wrapper) {
        // Assuming the bubble is the first child of the wrapper
        const bubble = wrapper.querySelector('.rounded-2xl');
        if (bubble) {
            bubble.innerHTML = renderMarkdown(text);
            // Remove typing indicator if present
            const typingIndicator = bubble.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            const statusSpan = bubble.querySelector('span.text-sm.text-gray-500');
            if (statusSpan) {
                statusSpan.remove();
            }
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function renderMarkdown(rawText) {
    // Ensure marked and DOMPurify are loaded.
    // They are loaded in vision-analysis.html, so this should be fine.
    const html = marked.parse(rawText, { breaks: true });
    return DOMPurify.sanitize(html);
}
