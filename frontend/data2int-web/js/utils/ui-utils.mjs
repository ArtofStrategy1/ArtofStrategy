import { dom } from './dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { handleGenerate } from '../analysis/analysis-helpers.mjs';
import { reattachActionListeners, reattachTabListeners, showTemplateDetail } from '../ui/template-creation/template-creation.mjs';
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
    const modal = dom.$("versionChoiceModal");
    modal.classList.remove('modal-open'); // Start fade-out
    setTimeout(() => modal.style.display = 'none', 300); // Hide after animation
    if (appState.selectedTemplateForModal) {
        showTemplateDetail(appState.selectedTemplateForModal);
    }
}



/**
 * Core animation logic.
 * Applies fade-in-on-scroll animations to a given list of elements.
 * Manages its own observer and adds it to the global list for cleanup.
 * @param {NodeListOf<Element>} elementsToAnimate - The elements to apply animation to.
 */
function animateElements(elementsToAnimate) {
    if (!elementsToAnimate || elementsToAnimate.length === 0) {
        return; // Nothing to animate
    }

    const observerOptions = {
        threshold: 0.1, // Animate when 10% visible
        rootMargin: '0px 0px -50px 0px'
    };

    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Fade IN
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            } else {
                // Reset (Fade OUT)
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(20px)';
            }
        });
    }, observerOptions);

    // Apply initial (hidden) state and start observing
    elementsToAnimate.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        animationObserver.observe(el);
    });

    // Store this new observer so we can disconnect it on the next page navigation
    appState.activeObservers.push(animationObserver);
}

/**
 * Finds all animatable elements on the *initial* page load and animates them.
 * Cleans up all old observers from previous pages.
 * @param {string} pageId The ID of the page container (e.g., "home", "templateDetail").
 */
function setupPageAnimations(pageId) {
    // 1. Disconnect ALL old observers from previous pages/renders
    appState.activeObservers.forEach(obs => obs.disconnect());
    appState.activeObservers = []; // Clear the array

    // 2. Find the page container
    const container = dom.$(pageId);
    if (!container) return;

    // 3. Find all card/container elements *within this specific page* to animate
    const elementsToAnimate = container.querySelectorAll(
        '.glass-container, .feature-card, .project-card, .kpi-card, .summary-stat-card, .prescription-card, .insight-card, .action-card, .ladder-rung, .dissonance-pole, .cascade-objective, .cascade-goal-card, .st-objective-card, .st-goal-card, .feedback-card'
    );

    // 4. Call the core animation function
    animateElements(elementsToAnimate);
}


export {
    showMessage,
    setLoading,
    setupInputToggle,
    proceedFromModal,
    animateElements,
    setupPageAnimations
}