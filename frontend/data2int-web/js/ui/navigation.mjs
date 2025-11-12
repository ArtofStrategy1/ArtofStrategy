import { appState } from '../state/app-state.mjs';
import { dom } from '../utils/dom-utils.mjs';
import { handleLogout } from '../services/auth-service.mjs';
import { fetchAndDisplayStatistics } from '../services/stats-service.mjs';
import { createAdminDashboardTabs } from '../admin-dashboard/admin-dashboard.mjs';

// --- Navigation Logic ---
    function navigateTo(pageId) {
        dom.pages().forEach((page) => {
            page.classList.remove("active", "flex", "block");
            page.style.display = "none";
        });

        // --- ADD THIS BLOCK to stop the timer when leaving the page ---
        if (appState.statsInterval) {
            clearInterval(appState.statsInterval);
            appState.statsInterval = null;
            console.log("Stopped admin stats auto-refresh.");
        }
        // --- END OF ADDED BLOCK ---

        // --- ADDED: Create the dashboard layout if it's the admin page ---
        if (pageId === "adminDashboard") {
            // Ensure the dynamic layout is built before fetching data into it
            createAdminDashboardTabs(); 
        }

        const targetPage = dom.$(pageId);
        if (targetPage) {
            targetPage.classList.add("active");
            if (["home", "templates", "templateDetail", "examplesPage", "adminDashboard", "about"].includes(pageId)) {
                targetPage.style.display = "block";
            } else {
                targetPage.style.display = "flex";
            }

            if (pageId === "adminDashboard") {
                // 1. Fetch the stats immediately on load
                fetchAndDisplayStatistics();
                
                // 2. Start a new timer to re-fetch every 10 seconds
                appState.statsInterval = setInterval(fetchAndDisplayStatistics, 10000); // 10000ms = 10 seconds
                console.log("Started admin stats auto-refresh.");
            }
            window.scrollTo(0, 0);
        }
    }

// --- Update Navigation Bar Links to include admin check ---
function updateNavBar() {
    const loginLink = document.querySelector('a[data-page="login"], a[data-page="logout"]');
    
    // --- Find BOTH admin elements ---
    const adminLink = document.getElementById("adminDashboardNav"); 
    const adminIndicator = document.getElementById("adminModeIndicator"); // <-- ADD THIS

    if (appState.userLoggedIn) {
        if (loginLink) {
            loginLink.textContent = "Logout";
            loginLink.setAttribute("data-page", "logout");
        }

        // --- Check for BOTH elements ---
        if (adminLink && adminIndicator) { 
            if (appState.currentUser && appState.currentUser.app_metadata.role === 'admin') {
                // Show both the link and the indicator
                adminLink.style.display = "inline-block"; 
                adminIndicator.style.display = "block"; // <-- ADD THIS
            } else {
                // Hide both for regular users
                adminLink.style.display = "none";
                adminIndicator.style.display = "none"; // <-- ADD THIS
            }
        }

    } else { // User is logged out
        if (loginLink) {
            loginLink.textContent = "Login";
            loginLink.setAttribute("data-page", "login");
        }

        // --- Hide BOTH elements if logged out ---
        if (adminLink) {
            adminLink.style.display = "none";
        }
        if (adminIndicator) { // <-- ADD THIS
            adminIndicator.style.display = "none";
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