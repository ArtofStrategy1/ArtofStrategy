import { dom } from './dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { reattachActionListeners } from '../ui/template-creation/template-creation.mjs';
import { reattachTabListeners } from '../ui/template-creation/template-creation.mjs';
import { showTemplateDetail } from '../ui/template-creation/template-creation.mjs'
// --- UI Helpers ---
/**
 * 
 * @param {*} id 
 * @param {*} msg 
 * @param {*} type 
 * @returns void
 */
function showMessage(id, msg, type) {
    const el = dom.$(id);
    if (!el) return;
    el.textContent = msg;
    el.className = type === "error" ? "error-message" : "success-message";
    if (msg) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
    if (type === "success" && msg) {
        setTimeout(() => el.classList.add("hidden"), 4000);
    }
}

/**
 * 
 * @param {*} type 
 * @param {*} isLoading 
 * @returns void
 */
function setLoading(type, isLoading) {
    const btn = dom.$(type + "Btn");
    if (!btn) return;

    const textEl = dom.$(type + "BtnText");
    const spinner = dom.$(type + "Spinner");

    btn.disabled = isLoading;
    if (spinner) spinner.classList.toggle("hidden", !isLoading);

    if (textEl) {
        if (isLoading) {
            // Store original text if it's not already stored
            if (!btn.dataset.originalText) {
                btn.dataset.originalText = textEl.textContent;
            }
            textEl.textContent = "Analyzing...";
        } else {
            // Restore original text
            textEl.textContent = btn.dataset.originalText || "Generate Analysis";
            // Clear the data attribute after use
            delete btn.dataset.originalText;
        }
    }
}


function setupInputToggle(fileInputId, fileLabelId, textInputAreaId, docUploadAreaId) {
    dom.$("generateBtn").addEventListener("click", handleGenerate);
    reattachActionListeners();

    if (appState.analysisCache[appState.currentTemplateId]) {
        dom.$("analysisResult").innerHTML = appState.analysisCache[appState.currentTemplateId];
        dom.$("analysisActions").classList.remove("hidden");
        reattachTabListeners(dom.$("analysisResult"));
    } else {
        dom.$("analysisResult").innerHTML =
            '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
        dom.$("analysisActions").classList.add("hidden");
    }

    // --- THIS IS THE FIX ---
    // Only add radio button listeners if the elements actually exist on the page.
    const textInput = dom.$("textInput");
    const docUpload = dom.$("docUpload");
    if (textInput && docUpload && dom.$(textInputAreaId) && dom.$(docUploadAreaId)) {
        textInput.addEventListener("change", () => {
            dom.$(textInputAreaId).classList.remove("hidden");
            dom.$(docUploadAreaId).classList.add("hidden");
        });
        docUpload.addEventListener("change", () => {
            dom.$(textInputAreaId).classList.add("hidden");
            dom.$(docUploadAreaId).classList.remove("hidden");
        });
    }
    // --- END OF FIX ---

    const fileInput = dom.$(fileInputId);
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const label = dom.$(fileLabelId);
            const fileNameSpan = label.querySelector(".file-name");
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                label.classList.add("has-file");
            } else {
                fileNameSpan.textContent = "Click to select a file...";
                label.classList.remove("has-file");
            }
        });
    }
}



function proceedFromModal() {
    dom.$("versionChoiceModal").classList.add("hidden");
    if (appState.selectedTemplateForModal) {
        showTemplateDetail(appState.selectedTemplateForModal);
    }
}


export {
    showMessage,
    setLoading,
    setupInputToggle,
    proceedFromModal
}