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



async function handleContactSubmit() {
    // 1. Gather Inputs
    const firstName = dom.$("contactFirstName").value.trim();
    const lastName = dom.$("contactLastName").value.trim();
    const companyName = dom.$("contactCompanyName").value.trim();
    const email = dom.$("contactEmail").value.trim();
    const phone = dom.$("contactPhone").value.trim();
    const subject = dom.$("contactSubject").value.trim();
    const message = dom.$("contactMessage").value.trim();
    const messageResultEl = dom.$("contactMessageResult");

    // Basic client-side validation
    if (!firstName || !lastName || !email || !subject || !message || message.length < 5) {
        showMessage("contactMessageResult", "Please fill in all required fields, and ensure the message is at least 5 characters long.", "error");
        messageResultEl.classList.remove("hidden");
        return;
    }

    // 2. Set loading state
    setLoading("contactSubmit", true);
    messageResultEl.classList.add("hidden");

    try {
        // 3. Prepare JSON payload
        const payload = {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName, // Passes null/empty string if not provided
            email: email,
            phone: phone, // Passes null/empty string if not provided
            subject: subject,
            message: message
        };

        // 4. Call the Supabase Edge Function via HTTP POST
        // Note: The function name here must match the deployed function endpoint
        const FUNCTION_ENDPOINT = "https://supabase.data2int.com/functions/v1/insert-contact"; 
        
        const response = await fetch(FUNCTION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // API Key/Authorization is generally not needed if the function is public,
                // but the service role key is used internally by the function itself.
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 5. Handle response (2xx success vs. 4xx/5xx error)
        if (!response.ok) {
            // Error details from the Edge Function's own error response
            throw new Error(data.details || data.error || `HTTP Error ${response.status}`);
        }

        // Success: Clear form and show message
        dom.$("contactFirstName").value = "";
        dom.$("contactLastName").value = "";
        dom.$("contactCompanyName").value = "";
        dom.$("contactEmail").value = "";
        dom.$("contactPhone").value = "";
        dom.$("contactSubject").value = "";
        dom.$("contactMessage").value = "";
        
        showMessage("contactMessageResult", "Thank you! Your message has been sent to the admin team.", "success");
        messageResultEl.classList.remove("hidden");

    } catch (e) {
        // Display detailed error message from the try block
        console.error("Contact submission failed:", e);
        showMessage("contactMessageResult", `Submission failed: ${e.message}`, "error");
        messageResultEl.classList.remove("hidden");
    } finally {
        setLoading("contactSubmit", false);
    }
}


export {
    handleLogin,
    handleRegister,
    handleLogout,
    handleContactSubmit
}