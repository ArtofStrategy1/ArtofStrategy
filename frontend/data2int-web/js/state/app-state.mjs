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

// --- Admin Dashboard ---
let statsInterval = null; // Admin Dashboard Stats Timer
let currentFeedbackItems = []; // Caches the feedback list
let currentContactItems = []; // Caches the contact list

// --- Regression Analysis ---
let currentRegressionRowCount = 0; // Stores the row count for ratio validation


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
    currentAnalysisContext,
    statsInterval,
    currentRegressionRowCount,
    currentFeedbackItems,
    currentContactItems
}
