import { dom } from '../utils/dom-utils.mjs';
import { appState } from '../state/app-state.mjs';
import { navigateTo } from '../ui/navigation.mjs';
import { showMessage } from '../utils/ui-utils.mjs';

// --- Home Page Card & Tab Logic ---
function setupHomeTabs() {
    const tabsNav = dom.$("homeTabsNav");
    const tabPanels = document.querySelectorAll(".home-tab-panel");
    const tabBtns = document.querySelectorAll(".home-tab-btn");

    tabPanels.forEach((panel) => {
        if (panel.classList.contains("active")) {
            panel.style.display = "grid";
        } else {
            panel.style.display = "none";
        }
    });

    tabsNav.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") return;
        const targetTab = e.target.dataset.tab;

        tabBtns.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tab === targetTab);
        });

        tabPanels.forEach((panel) => {
            if (panel.id === targetTab) {
                panel.classList.add("active");
                panel.style.display = "grid";
            } else {
                panel.classList.remove("active");
                panel.style.display = "none";
            }
        });
    });
}

function attachHomeCardListeners() {
    document.querySelectorAll(".home-template-link").forEach((card) => {
        card.addEventListener("click", () => {
            const templateId = card.dataset.templateId;
            appState.preFillData = card.dataset.preFill || "";

            if (!appState.userLoggedIn) {
                showMessage("loginMessage", "Please log in to use the analysis tools.", "error");
                navigateTo("login");
            } else {
                appState.selectedTemplateForModal = templateId;
                dom.$("versionChoiceModal").classList.remove("hidden");
            }
        });
    });
}

export {
    setupHomeTabs,
    attachHomeCardListeners
}