import { appConfig } from '../config.mjs';
import { dom } from '../utils/dom-utils.mjs';
import { navigateTo } from '../ui/navigation.mjs';
import { showMessage, setLoading } from '../utils/ui-utils.mjs';

// --- Auth Logic using Supabase ---
async function handleLogin() {
    const email = dom.$("loginEmail").value.trim();
    const password = dom.$("loginPassword").value;
    const loginMessageEl = dom.$("loginMessage");

    if (!email || !password) {
        showMessage("loginMessage", "Please fill in all fields", "error");
        return;
    }

    setLoading("login", true);
    loginMessageEl.classList.add("hidden");

    const { data, error } = await appConfig.supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showMessage("loginMessage", error.message, "error");
    } else {
        showMessage("loginMessage", "Login successful! Redirecting...", "success");
        setTimeout(() => navigateTo("home"), 1500);
    }
    setLoading("login", false);
}

async function handleRegister() {
    const firstName = dom.$("registerFirstName").value.trim();
    const lastName = dom.$("registerLastName").value.trim();
    const email = dom.$("registerEmail").value.trim();
    const password = dom.$("registerPassword").value;
    const confirmPassword = dom.$("registerConfirmPassword").value;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showMessage("registerMessage", "Please fill in all fields", "error");
        return;
    }
    if (password !== confirmPassword) {
        showMessage("registerMessage", "Passwords do not match", "error");
        return;
    }
    if (password.length < 6) {
        showMessage("registerMessage", "Password must be at least 6 characters long", "error");
        return;
    }

    setLoading("register", true);
    try {
        const { data, error } = await appConfig.supabase.functions.invoke("create-user-v3", {
            body: {
                email,
                password,
                metadata: {
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });

        if (error || !data?.user) {
            showMessage("registerMessage", error?.message || "User creation failed.", "error");
            return;
        }

        dom.$("registerForm").reset();
        navigateTo("emailVerification");
    } catch (err) {
        console.error("Register error:", err);
        showMessage("registerMessage", "An error occurred during registration. Please try again.", "error");
    } finally {
        setLoading("register", false);
    }
}

async function handleLogout() {
    await appConfig.supabase.auth.signOut();
    navigateTo("login");
}


export {
    handleLogin,
    handleRegister,
    handleLogout
}