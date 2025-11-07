// --- User Session State ---
let userLoggedIn = false;
let currentUser = null;

// --- Version Control State ---
let pendingAnalysisRequests = new Map();
let currentTemplateId = null;
let currentSelectionLimit = 3; // Default to paid
let selectedTemplateForModal = null;
let preFillData = ""; // Used to pass context from home card to template detail

// --- Analysis Cache ---
const analysisCache = {};

// --- Variables for merging async results ---
let pendingOllamaResult = null;
let pendingN8nResult = null;
let currentAnalysisMessageId = null;
let currentAnalysisContext = null;

export const appState = {
    userLoggedIn,
    currentUser,
    pendingAnalysisRequests,
    currentTemplateId,
    currentSelectionLimit,
    selectedTemplateForModal,
    preFillData,
    analysisCache,
    pendingOllamaResult,
    pendingN8nResult,
    currentAnalysisMessageId,
    currentAnalysisContext
}
