import { appState } from '../state/app-state.mjs';
import { dom } from '../utils/dom-utils.mjs';
import { handleLogout } from '../services/auth-service.mjs';
import { fetchAndDisplayStatistics } from '../services/stats-service.mjs';

// --- Navigation Logic ---
function navigateTo(pageId) {
    dom.pages().forEach((page) => {
        page.classList.remove("active", "flex", "block");
        page.style.display = "none";
    });

    const targetPage = dom.$(pageId);
    if (targetPage) {
        targetPage.classList.add("active");
        if (["home", "templates", "templateDetail", "examplesPage", "adminDashboard", "about"].includes(pageId)) {
            targetPage.style.display = "block";
        } else {
            targetPage.style.display = "flex";
        }

        if (pageId === "adminDashboard") {
            fetchAndDisplayStatistics();
        }
        window.scrollTo(0, 0);
    }
}

// --- Update Navigation Bar Links ---
function updateNavBar() {
    const loginLink = document.querySelector('a[data-page="login"], a[data-page="logout"]');

    if (appState.userLoggedIn) {
        if (loginLink) {
            loginLink.textContent = "Logout";
            loginLink.setAttribute("data-page", "logout");
        }
    } else {
        if (loginLink) {
            loginLink.textContent = "Login";
            loginLink.setAttribute("data-page", "login");
        }
    }
    attachNavLinkListeners();
}



function handleNavLinkClick(e) {
    e.preventDefault();
    const pageId = this.getAttribute("data-page");

    if (pageId === "logout") {
        handleLogout();
        return;
    }

    if (pageId === "templates") {
        navigateTo("home");
        return;
    }

    if ((pageId === "login" || pageId === "signup") && appState.userLoggedIn) {
        navigateTo("home");
        return;
    }
    navigateTo(pageId);
}



// --- Attach Navigation Link Listeners ---
function attachNavLinkListeners() {
    document.querySelectorAll(".nav-link").forEach((link) => {
        link.removeEventListener("click", handleNavLinkClick);
        link.addEventListener("click", handleNavLinkClick);
    });
}


export {
    navigateTo,
    updateNavBar,
    handleNavLinkClick,
    attachNavLinkListeners
}