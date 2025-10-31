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

export const appState = {
    userLoggedIn,
    currentUser,
    pendingAnalysisRequests,
    currentTemplateId,
    currentSelectionLimit,
    selectedTemplateForModal,
    preFillData,
    analysisCache
}


// export const appState = {
//     // --- User Session State ---
//     userLoggedIn: false,
//     currentUser: null,
    
//     // --- Version Control State ---
//     pendingAnalysisRequests: new Map(),
//     currentTemplateId: null,
//     currentSelectionLimit: 3, // Default to paid
//     selectedTemplateForModal: null,
//     preFillData: "", // Used to pass context from home card to template detail

//     // --- Analysis Cache ---
//     analysisCache: {}
// }

