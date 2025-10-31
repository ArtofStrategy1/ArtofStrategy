import { renderMermaidDiagram } from './diagrams/diagram-renderer.js'

document.addEventListener("DOMContentLoaded", () => {
    // --- Supabase Configuration ---
    const SUPABASE_URL = "https://supabase.data2int.com";
    const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU";

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- DOM Element References ---
    const $ = (id) => document.getElementById(id);
    const pages = document.querySelectorAll(".page");
    let currentTemplateId = null;
    let websocket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    let pendingAnalysisRequests = new Map();

    // --- User Session State ---
    let userLoggedIn = false;
    let currentUser = null;

    // --- Version Control State ---
    let currentSelectionLimit = 3; // Default to paid
    let selectedTemplateForModal = null;
    let preFillData = ""; // Used to pass context from home card to template detail

    // --- Analysis Cache ---
    const analysisCache = {};

    

    // WebSocket Management Functions
    function initializeWebSocket() {
        const wsStatus = document.getElementById("wsStatus");

        try {
            websocket = new WebSocket("wss://n8n-api.data2int.com/ws");

            wsStatus.textContent = "Connecting...";
            wsStatus.className = "ws-status connecting";

            websocket.onopen = function (event) {
                console.log("WebSocket connected successfully");
                wsStatus.textContent = "Connected";
                wsStatus.className = "ws-status connected";
                reconnectAttempts = 0;
            };

            websocket.onmessage = function (event) {
                console.log("Received WebSocket message:", event.data);

                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };

            websocket.onclose = function (event) {
                console.log("WebSocket connection closed:", event.code, event.reason);
                wsStatus.textContent = "Disconnected";
                wsStatus.className = "ws-status disconnected";

                if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                    setTimeout(() => {
                        reconnectAttempts++;
                        console.log(`WebSocket reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        initializeWebSocket();
                    }, reconnectDelay);
                }
            };

            websocket.onerror = function (error) {
                console.error("WebSocket error:", error);
                wsStatus.textContent = "Error";
                wsStatus.className = "ws-status disconnected";
            };
        } catch (error) {
            console.error("Failed to initialize WebSocket:", error);
            wsStatus.textContent = "Failed";
            wsStatus.className = "ws-status disconnected";
        }
    }

   // =========================================================
    // ===== REVISED EXPORT FUNCTIONS (Using html2canvas) =====
    // =========================================================

    // --- REVISED PDF Export Logic (Image-based) ---
    async function handleSaveAsPdf(filename = "SAGE_Analysis.pdf") {
        // 1. Check Libraries
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            alert("Error: jsPDF library not loaded."); return;
        }
        if (typeof window.html2canvas === 'undefined') {
            alert("Error: html2canvas library not loaded."); return;
        }

        const { jsPDF } = window.jspdf;
        const analysisResultElement = $("analysisResult");

        if (!analysisResultElement || !analysisResultElement.hasChildNodes() || analysisResultElement.innerText.includes("Your generated analysis will appear here.")) {
            alert("No analysis content found to save.");
            return;
        }

        alert("Preparing PDF screenshot... Please wait.");
        console.log("Starting PDF generation via html2canvas...");

        try {
            // 2. Use html2canvas to capture the element
            const canvas = await html2canvas(analysisResultElement, {
                scale: 2, // Increase scale for better resolution
                useCORS: true, // If you ever load images from other domains
                logging: true // Enable logging for debugging
            });

            console.log("Canvas generated from HTML content.");

            // 3. Convert canvas to image data
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            // 4. Create PDF and add image (potentially sliced)
            const doc = new jsPDF({
                orientation: imgWidth > imgHeight ? 'l' : 'p', // Use landscape if wider
                unit: 'pt',
                format: 'a4'
            });

            const pdfPageWidth = doc.internal.pageSize.getWidth();
            const pdfPageHeight = doc.internal.pageSize.getHeight();
            const margin = 20; // Small margin for image

            // Calculate image dimensions to fit page width
            const availableWidth = pdfPageWidth - margin * 2;
            const availableHeight = pdfPageHeight - margin * 2;

            const aspectRatio = imgHeight / imgWidth;
            let pdfImgWidth = availableWidth;
            let pdfImgHeight = pdfImgWidth * aspectRatio;

            // If scaled image is taller than available page height, scale based on height instead
            if (pdfImgHeight > availableHeight) {
                pdfImgHeight = availableHeight;
                pdfImgWidth = pdfImgHeight / aspectRatio;
            }

            // Calculate how many pages are needed based on the *original* canvas height
            // relative to the scaled height that fits *within* one PDF page.
            const totalPdfHeight = (imgHeight / imgWidth) * pdfImgWidth; // Total height the image would occupy in PDF units if not sliced
            const pageHeightToFitOneSlice = pdfImgHeight; // The height of one slice as it appears on the PDF page
            const numPages = Math.ceil(totalPdfHeight / pageHeightToFitOneSlice);


             console.log(`Original Canvas: ${imgWidth}x${imgHeight} | PDF Image Size per page: ${pdfImgWidth.toFixed(0)}x${pageHeightToFitOneSlice.toFixed(0)} | Total PDF Height: ${totalPdfHeight.toFixed(0)} | Pages: ${numPages}`);

            // Add image slices page by page
            let currentCanvasY = 0; // Position on the source canvas
            for (let i = 1; i <= numPages; i++) {
                if (i > 1) {
                    doc.addPage();
                }
                // Calculate the portion of the canvas to draw for this page
                const sourceHeight = Math.min(imgHeight - currentCanvasY, (pageHeightToFitOneSlice / pdfImgWidth) * imgWidth); // Height on original canvas for this slice

                // Create a temporary canvas for the slice
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = imgWidth;
                sliceCanvas.height = sourceHeight;
                const sliceCtx = sliceCanvas.getContext('2d');

                // Draw the slice from the main canvas
                sliceCtx.drawImage(canvas, 0, currentCanvasY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);

                const sliceDataUrl = sliceCanvas.toDataURL('image/png');

                 // Add the slice image to the PDF page
                 const slicePdfHeight = (sourceHeight / imgWidth) * pdfImgWidth; // Calculate height of this slice in PDF units
                 doc.addImage(sliceDataUrl, 'PNG', margin, margin, pdfImgWidth, slicePdfHeight);

                currentCanvasY += sourceHeight; // Move to the next slice position
                 console.log(`Added page ${i}/${numPages}. Slice height (canvas): ${sourceHeight.toFixed(0)}, Slice height (pdf): ${slicePdfHeight.toFixed(0)}`);
            }


            console.log("Adding image(s) to PDF complete.");

            // 5. Save the PDF
            doc.save(filename);
            console.log("PDF saved successfully.");

        } catch (error) {
            console.error("!!! Error generating PDF with html2canvas:", error);
            alert("Failed to generate PDF. Check console for details. Ensure content is visible.");
        }
    }


    // --- REVISED DOCX Export Logic (Image-based) ---
    async function handleSaveAsDocx(filename = "SAGE_Analysis.docx") {
        // 1. Check Libraries
        if (typeof window.docx === 'undefined' || typeof window.docx.Document === 'undefined' || typeof window.docx.Packer === 'undefined') {
            alert("Error: docx library not loaded."); return;
        }
        if (typeof window.saveAs === 'undefined') {
            alert("Error: FileSaver.js library not loaded."); return;
        }
        if (typeof window.html2canvas === 'undefined') {
            alert("Error: html2canvas library not loaded."); return;
        }

        const { Document, Packer, Paragraph, ImageRun, AlignmentType, convertInchesToTwip } = window.docx;
        const saveAs = window.saveAs;
        const analysisResultElement = $("analysisResult");

        if (!analysisResultElement || !analysisResultElement.hasChildNodes() || analysisResultElement.innerText.includes("Your generated analysis will appear here.")) {
            alert("No analysis content found to save.");
            return;
        }

        alert("Preparing DOCX screenshot... Please wait.");
        console.log("Starting DOCX generation via html2canvas...");

        try {
            // 2. Use html2canvas to capture the element
            const canvas = await html2canvas(analysisResultElement, {
                scale: 2, // Higher resolution
                useCORS: true,
                logging: true
            });
            console.log("Canvas generated from HTML content.");

            // 3. Convert canvas to image buffer for docx
            const dataUrl = canvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            // 4. Create DOCX Document with the image
            // A4 paper is approx 8.27 x 11.69 inches. Margins typically 1 inch.
            // Available width approx 6.27 inches. Let's use 6.0 for a bit more margin.
            const docPageWidthTwips = convertInchesToTwip(6.0);
            const aspectRatio = canvas.height / canvas.width;
            const imageWidthTwips = docPageWidthTwips;
            const imageHeightTwips = imageWidthTwips * aspectRatio;

             console.log(`Adding image to DOCX. DOCX Width (Twips): ${imageWidthTwips}, DOCX Height (Twips): ${imageHeightTwips.toFixed(0)}`);

            const doc = new Document({
                sections: [{
                    properties: { /* Define page size/margins if needed */ },
                    children: [
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: imageBuffer,
                                    transformation: {
                                        width: imageWidthTwips,
                                        height: imageHeightTwips
                                    },
                                })
                            ],
                            alignment: AlignmentType.CENTER
                        })
                    ]
                }]
            });

            // 5. Pack and Save
            console.log("Packing DOCX...");
            const blob = await Packer.toBlob(doc);
            saveAs(blob, filename);
            console.log("DOCX saved successfully.");

        } catch (error) {
            console.error("!!! Error generating DOCX with html2canvas:", error);
            alert("Failed to generate DOCX. Check console for details. Ensure content is visible.");
        }
    }

    // =========================================================
    // ===== END OF REVISED EXPORT FUNCTIONS ===================
    // =========================================================

    // Initialize WebSocket connection
    initializeWebSocket();

    // --- Session Management ---
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN") {
            userLoggedIn = true;
            currentUser = session.user;
        } else if (event === "SIGNED_OUT") {
            userLoggedIn = false;
            currentUser = null;
        }
        updateNavBar();
    });

    // --- Navigation Logic ---
    function navigateTo(pageId) {
        pages.forEach((page) => {
            page.classList.remove("active", "flex", "block");
            page.style.display = "none";
        });

        const targetPage = $(pageId);
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

        if (userLoggedIn) {
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

    // --- Attach Navigation Link Listeners ---
    function attachNavLinkListeners() {
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.removeEventListener("click", handleNavLinkClick);
            link.addEventListener("click", handleNavLinkClick);
        });
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

        if ((pageId === "login" || pageId === "signup") && userLoggedIn) {
            navigateTo("home");
            return;
        }
        navigateTo(pageId);
    }

    // --- Admin Dashboard Stats Logic ---
    const refreshStatsBtn = $("refreshStatsBtn");
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener("click", fetchAndDisplayStatistics);
    }

    async function fetchAndDisplayStatistics() {
        if (!userLoggedIn) {
            showMessage("statsMessage", "You must be logged in to refresh statistics.", "error");
            return;
        }

        const btn = $("refreshStatsBtn");
        const textEl = $("refreshStatsBtnText");
        const spinner = $("refreshStatsSpinner");

        btn.disabled = true;
        spinner.classList.remove("hidden");
        textEl.textContent = "Loading...";
        showMessage("statsMessage", "", "success");

        try {
            const { data, error } = await supabase.functions.invoke("statistics", {
                body: { update: true }
            });

            if (error) {
                throw error;
            }

            if (data && data.success) {
                const dbStatus = data.database_status;
                if (dbStatus) {
                    $("statTotalUsers").textContent = dbStatus.total_users ?? "N/A";
                    $("statActiveUsers").textContent = dbStatus.log_in_users ?? "N/A";
                    $("statTotalQueries").textContent = dbStatus.total_queries ?? "N/A";
                    $("dashQueryCount").textContent = dbStatus.total_queries ?? "0";
                    $("statDbSize").textContent = dbStatus.database_size ?? "N/A";
                    $("statAvgTime").textContent = dbStatus.avg_p_time
                        ? parseFloat(dbStatus.avg_p_time).toFixed(2) + " ms"
                        : "N/A";
                    $("statRecordedAt").textContent = dbStatus.recorded_at
                        ? new Date(dbStatus.recorded_at).toLocaleString()
                        : "N/A";
                }

                const pineconeStatus = data.pinecone_status;
                const pineconeContainer = $("pineconeStatsContainer");
                if (pineconeStatus && pineconeStatus.status) {
                    pineconeContainer.classList.remove("hidden");
                    $("statPineconeName").textContent = pineconeStatus.name ?? "N/A";
                    $("statTotalVectors").textContent = pineconeStatus.total_vectors ?? "N/A";
                    $("statBookVectors").textContent = pineconeStatus.book_namespace_vectors ?? "N/A";
                    $("statPineconeDimension").textContent = pineconeStatus.dimension ?? "N/A";
                    $("statPineconeStatus").textContent = pineconeStatus.status ?? "N/A";
                    $("statPineconeCloud").textContent =
                        `${pineconeStatus.cloud_provider ?? ""} (${pineconeStatus.region ?? ""})`;
                } else {
                    pineconeContainer.classList.add("hidden");
                }
                showMessage("statsMessage", "Statistics updated successfully!", "success");
            } else {
                throw new Error(data.error || "Failed to fetch statistics.");
            }
        } catch (error) {
            console.error("Error fetching statistics:", error);
            showMessage("statsMessage", `Error: ${error.message}`, "error");
        } finally {
            btn.disabled = false;
            spinner.classList.add("hidden");
            textEl.textContent = "Refresh Stats";
        }
    }

    // --- Home Page Card & Tab Logic ---
    function setupHomeTabs() {
        const tabsNav = $("homeTabsNav");
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
                preFillData = card.dataset.preFill || "";

                if (!userLoggedIn) {
                    showMessage("loginMessage", "Please log in to use the analysis tools.", "error");
                    navigateTo("login");
                } else {
                    selectedTemplateForModal = templateId;
                    $("versionChoiceModal").classList.remove("hidden");
                }
            });
        });
    }

    function proceedFromModal() {
        $("versionChoiceModal").classList.add("hidden");
        if (selectedTemplateForModal) {
            showTemplateDetail(selectedTemplateForModal);
        }
    }

    

    function setupInputToggle(fileInputId, fileLabelId, textInputAreaId, docUploadAreaId) {
        $("generateBtn").addEventListener("click", handleGenerate);
        reattachActionListeners();

        if (analysisCache[currentTemplateId]) {
            $("analysisResult").innerHTML = analysisCache[currentTemplateId];
            $("analysisActions").classList.remove("hidden");
            reattachTabListeners($("analysisResult"));
        } else {
            $("analysisResult").innerHTML =
                '<div class="text-white/60 p-8 text-center">Your generated analysis will appear here.</div>';
            $("analysisActions").classList.add("hidden");
        }

        // --- THIS IS THE FIX ---
        // Only add radio button listeners if the elements actually exist on the page.
        const textInput = $("textInput");
        const docUpload = $("docUpload");
        if (textInput && docUpload && $(textInputAreaId) && $(docUploadAreaId)) {
            textInput.addEventListener("change", () => {
                $(textInputAreaId).classList.remove("hidden");
                $(docUploadAreaId).classList.add("hidden");
            });
            docUpload.addEventListener("change", () => {
                $(textInputAreaId).classList.add("hidden");
                $(docUploadAreaId).classList.remove("hidden");
            });
        }
        // --- END OF FIX ---

        const fileInput = $(fileInputId);
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const label = $(fileLabelId);
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



    function frameworkCheckboxChangeHandler() {
        const checkedBoxes = document.querySelectorAll("#frameworkList .method-checkbox:checked");
        const selectionCounter = $("selectionCounter");

        if (checkedBoxes.length > currentSelectionLimit) {
            this.checked = false;
        }

        const finalCheckedCount = document.querySelectorAll("#frameworkList .method-checkbox:checked").length;
        if (selectionCounter) {
            selectionCounter.textContent = `Selected: ${finalCheckedCount} / ${currentSelectionLimit}`;
        }
    }



    function configureFrameworkSelector(limit) {
        currentSelectionLimit = limit;
        const selectionCounter = $("selectionCounter");
        const checkboxes = document.querySelectorAll("#frameworkList .method-checkbox");

        if (!selectionCounter || !checkboxes) return;

        selectionCounter.textContent = `Selected: 0 / ${limit}`;

        const rule = templateRules[currentTemplateId] || {};
        if (!rule.preselectFramework) {
            checkboxes.forEach((cb) => {
                cb.checked = false;
            });
        }
        frameworkCheckboxChangeHandler();
    }



    function getSelectedFrameworks() {
        const checkedBoxes = document.querySelectorAll("#frameworkList .method-checkbox:checked");
        const selectedMethods = [];

        const frameworkMap = {
            "Reframing Thinking": "ReframingThinking",
            "Delphi Method": "DelphiMethod",
            "Blue Ocean Strategy": "BlueOcean",
            "Design Thinking": "DesignThinking",
            "Thinking Hats": "ThinkingHats",
            "Business Model Canvas": "BusinessModelCanvas",
            SCAMPER: "SCAMPER",
            "TRIZ (Theory of Inventive Problem Solving)": "TRIZ"
        };

        checkedBoxes.forEach((checkbox) => {
            const methodText = checkbox.dataset.framework;
            if (frameworkMap[methodText]) {
                selectedMethods.push(frameworkMap[methodText]);
            }
        });
        return selectedMethods.join(",");
    }



    function getSelectedSections() {
        const checkedBoxes = document.querySelectorAll("#analysisList .method-checkbox:checked");
        const sectionMap = {
            Introduction: "introduction",
            "Overview of business": "overview_of_business",
            "process overview": "process_overview",
            "mission statement": "mission_statement",
            "vision analysis": "vision_analysis",
            "vision statement 2": "vision_statement_2",
            "novel strategy part 1": "novel_strategy_part_1",
            "novel strategy part 2": "novel_strategy_part_2",
            "novel strategy part 3": "novel_strategy_part_3"
        };

        if (checkedBoxes.length === 0) {
            return Object.values(sectionMap).join(",");
        }

        const selectedSections = [];
        checkedBoxes.forEach((checkbox) => {
            const sectionText = checkbox.nextElementSibling.textContent.trim();
            if (sectionMap[sectionText]) {
                selectedSections.push(sectionMap[sectionText]);
            }
        });
        return selectedSections.join(",");
    }



    function getFrameworkForTemplate(templateId) {
        const selectedFrameworks = getSelectedFrameworks();
        return selectedFrameworks || "BlueOcean,SCAMPER";
    }

   

    /**
     * Extracts text from a user-uploaded file. Supports .txt and .docx.
     */
    async function extractTextFromFile(file) {
        return new Promise((resolve, reject) => {
            if (file.type === "text/plain" || file.name.endsWith(".csv")) {
                // This is the corrected line
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject("Error reading file.");
                reader.readAsText(file);
            } else if (file.name.endsWith(".docx")) {
                if (window.mammoth) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const arrayBuffer = event.target.result;
                        try {
                            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                            resolve(result.value);
                        } catch (err) {
                            reject(`Error reading .docx file: ${err.message}`);
                        }
                    };
                    reader.onerror = () => reject("Error preparing .docx file for reading.");
                    reader.readAsArrayBuffer(file);
                } else {
                    reject(".docx reader library (mammoth.js) not found.");
                }
            } else {
                reject(`Unsupported file type: ${file.name.split(".").pop()}. Please use .txt or .docx.`);
            }
        });
    }



    /**
     * Robustly extracts a JSON object from a string, which might contain extra text.
     */
    function extractJsonRobust(text) {
        try {
            const jsonStart = text.indexOf("{");
            const jsonEnd = text.lastIndexOf("}") + 1;
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd);
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.warn("Standard JSON parsing failed. The AI response may be malformed.", e);
        }
        throw new Error("Failed to parse a valid JSON object from the AI's response.");
    }



    async function handleGenerate() {
        if (!currentTemplateId) return;

        const analysisResultContainer = $("analysisResult");
        setLoading("generate", true);
        const analysisActionsEl = $("analysisActions");
        if (analysisActionsEl) {
            analysisActionsEl.classList.add("hidden");
        }

        if (currentTemplateId === "swot-tows") {
            await handleSwotTowsAnalysis();
        } else if (currentTemplateId === "archetype-analysis") {
            await handleArchetypeAnalysis();
        } else if (currentTemplateId === "leverage-points") {
            await handleLeveragePointsAnalysis();
        } else if (currentTemplateId === "visualization") {
            // <-- ADD THIS BLOCK
            await handleVisualizationAnalysis_DA();
        } else if (currentTemplateId === "prescriptive-analysis") {
            // <-- ADD THIS BLOCK
            await handlePrescriptiveAnalysis_DA();
        } else if (currentTemplateId === "thinking-system") {
            // <-- ADD THIS BLOCK
            await handleThinkingSystemAnalysis_NS();
        } else if (currentTemplateId === "creative-dissonance") {
            // <-- ADD THIS BLOCK
            await handleCreativeDissonanceAnalysis_NS();
        } else if (currentTemplateId === "pareto-fishbone") {
            await handleParetoFishboneAnalysis();
        } else if (currentTemplateId === "system-actions") {
            // <-- ADD THIS BLOCK
            await handleSystemActionsAnalysis_ST();
        } else if (currentTemplateId === "goals-initiatives") {
            await handleGoalsAndInitiativesAnalysis_SP();
        } else if (currentTemplateId === "living-system") {
            // <-- ADD THIS BLOCK
            await handleLivingSystemAnalysis_NS();
        } else if (currentTemplateId === "system-objectives") {
            // <-- ADD THIS BLOCK
            await handleSystemObjectivesAnalysis_ST();
        } else if (currentTemplateId === "pls-analysis") {
            // <-- ADD THIS BLOCK
            await handlePlsAnalysis_DA();
        } else if (currentTemplateId === "sem-analysis") {
            // <-- ADD THIS BLOCK
            await handleSemAnalysis();
        } else if (currentTemplateId === "predictive-analysis") {
            await handlePredictiveAnalysis();
        } else if (currentTemplateId === "dematel-analysis") {
            await handleDematelAnalysis();
        } else if (currentTemplateId === "descriptive-analysis") {
            // <-- ADD THIS BLOCK
            await handleDescriptiveAnalysis_DA();
        } else if (currentTemplateId === "kpi-events") {
            await handleKpiAnalysis_KE();
        } else if (currentTemplateId === "regression-analysis") {
            // <-- ADD THIS BLOCK
            await handleRegressionAnalysis_DA();
        } else if (currentTemplateId === "novel-goals-initiatives") {
            // <-- ADD THIS BLOCK
            await handleNovelGoalsAnalysis_NS();
        } else if (currentTemplateId === "misc-summary") {
            await handleMiscAnalysis_MSC();
        } else if (currentTemplateId === "action-plans") {
            await handleActionPlansAnalysis_AP();
        } else if (currentTemplateId === "factor-analysis") {
            await handleFactorAnalysis();
        } else if (currentTemplateId === "system-goals-initiatives") {
            await handleSystemGoalsAnalysis();
        } else if (currentTemplateId === "process-mapping") {
            await handleProcessMappingAnalysis();
        } else if (currentTemplateId === "system-thinking-analysis") {
            await handleSystemThinkingAnalysis();
        } else {
            // --- Generic n8n workflow for all other tools ---
            analysisResultContainer.innerHTML = `
                        <div class="text-center text-white/70 p-8">
                            <div class="typing-indicator mb-6">
                                <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                            </div>
                            <h3 class="text-xl font-semibold text-white mb-4">Generating Your Strategic Analysis</h3>
                            <p class="text-white/80 mb-2">This comprehensive analysis may take 2-5 minutes to complete.</p>
                            <p class="text-white/60 text-sm">Please keep this page open while we process your request.</p>
                        </div>`;

            let fullPrompt = "";
            const formData = new FormData();
            const companyName = $("companyName").value.trim();
            const companyDocumentsFile = $("companyDocumentsFile").files[0];
            const location = $("location").value.trim();
            const framework = getFrameworkForTemplate(currentTemplateId);
            const sections = getSelectedSections();

            if (!companyName || !companyDocumentsFile || !location) {
                analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">Please fill out all fields and upload a file.</div>`;
                setLoading("generate", false);
                return;
            }
            fullPrompt = `User Information: - Company Name: ${companyName} - Location: ${location}`;

            // Add context if the field exists
            const contextEl = $("useCaseContext");
            if (contextEl && contextEl.value.trim()) {
                const context = contextEl.value.trim();
                fullPrompt += ` - Context: ${context}`;
                formData.append("context", context);
            }

            formData.append("customerName", companyName);
            formData.append("location", location);
            formData.append("company_documents", companyDocumentsFile.name);
            formData.append("file", companyDocumentsFile);
            formData.append("framework", framework);
            formData.append("sections", sections);
            formData.append("prompt", fullPrompt);
            formData.append("templateId", currentTemplateId);

            try {
                const {
                    data: { session }
                } = await supabase.auth.getSession();
                if (!session) throw new Error("Please log in to generate analysis.");

                const messageId = Date.now();
                pendingAnalysisRequests.set(messageId, analysisResultContainer);
                formData.append("messageId", messageId);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const response = await fetch("https://n8n.data2int.com/webhook/analysis-ev2", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                console.log("Analysis request submitted successfully.");
            } catch (error) {
                if (error.name === "AbortError") {
                    console.log("Fetch request timed out as expected. Waiting for WebSocket response.");
                    return;
                }
                console.error("Error submitting analysis request:", error);
                analysisResultContainer.innerHTML = `<div class="p-4 text-center text-red-400">An error occurred: ${error.message}</div>`;
                setLoading("generate", false);
            }
        }
    }



    // Ensure createParetoChartJS is available (it was defined in a previous step, but include it here for completeness if needed)
    function createParetoChartJS(paretoData, containerId) {
        const container = $(containerId);
        if (!container) {
            console.error(`Container with ID ${containerId} not found for Pareto chart.`);
            return;
        }
        container.innerHTML = ""; // Clear previous chart

        // Ensure paretoData exists and has the expected structure
        if (!paretoData || (!paretoData.vital_few && !paretoData.useful_many)) {
            container.innerHTML = "<p class='p-4 text-center text-red-400'>Pareto data is missing or incomplete.</p>";
            return;
        }

        const allCauses = (paretoData.vital_few || []).concat(paretoData.useful_many || []);
        if (allCauses.length === 0) {
            container.innerHTML = "<p class='p-4 text-center text-white/70'>No causes identified for Pareto analysis.</p>";
            return;
        }


        allCauses.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));

        const causes = allCauses.map((item) => item.cause || "Unknown Cause");
        const impacts = allCauses.map((item) => item.impact_score || 0);
        const categories = allCauses.map((item) => item.category || "Uncategorized");

        const cumulative = impacts.reduce((acc, val) => {
            acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val);
            return acc;
        }, []);
        // Ensure totalImpact is not zero before dividing
        const totalImpact = impacts.reduce((a, b) => a + b, 0);
        const cumulativePct = totalImpact > 0 ? cumulative.map((val) => (val / totalImpact) * 100) : cumulative.map(() => 0);


        const trace1 = {
            x: causes,
            y: impacts,
            name: "Impact Score",
            type: "bar",
            text: impacts.map((imp) => `${imp}%`),
            textposition: "outside",
            marker: { color: "var(--primary)" }, // Consistent color
            hovertemplate: "<b>%{x}</b><br>Impact: %{y}%<br>Category: %{customdata}<extra></extra>",
            customdata: categories
        };

        const trace2 = {
            x: causes,
            y: cumulativePct,
            name: "Cumulative %",
            type: "scatter",
            mode: "lines+markers",
            line: { color: "var(--accent)", width: 3 }, // Accent color for line
            marker: { size: 8 },
            yaxis: "y2",
            hovertemplate: "<b>%{x}</b><br>Cumulative: %{y:.1f}%<extra></extra>"
        };

        // Find the index where cumulative percentage crosses 80%
        const eightyPercentIndex = cumulativePct.findIndex(p => p >= 80);
        let vitalFewCount = eightyPercentIndex !== -1 ? eightyPercentIndex + 1 : allCauses.length;
        // Ensure vitalFewCount matches the actual vital_few array length if provided, otherwise use calculated
        vitalFewCount = paretoData.vital_few ? paretoData.vital_few.length : vitalFewCount;


        const layout = {
            title: "Pareto Analysis - Vital Few vs. Useful Many Causes",
            xaxis: { title: "Potential Root Causes", tickangle: -45, automargin: true },
            yaxis: { title: "Estimated Impact Score (%)", gridcolor: "rgba(255,255,255,0.1)" },
            yaxis2: {
                title: "Cumulative Impact (%)",
                overlaying: "y",
                side: "right",
                range: [0, 101],
                gridcolor: "rgba(255,255,255,0.05)",
                zeroline: false
            },
            shapes: [
                // 80% cumulative line
                { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y2", y0: 80, y1: 80, line: { color: "orange", width: 2, dash: "dot" } },
                // Vertical line separating vital few
                vitalFewCount > 0 && vitalFewCount < allCauses.length ? { type: "line", xref: "x", x0: vitalFewCount - 0.5, x1: vitalFewCount - 0.5, yref: "paper", y0: 0, y1: 1, line: { color: "rgba(255, 0, 0, 0.5)", width: 2, dash: "dash" } } : {}
            ],
            annotations: [
                vitalFewCount > 0 ? { xref: 'x', yref: 'paper', x: (vitalFewCount - 1) / 2, y: 1.05, text: '🔥 Vital Few', showarrow: false, font: {color: 'red'} } : {},
                vitalFewCount < allCauses.length ? { xref: 'x', yref: 'paper', x: vitalFewCount + (allCauses.length - vitalFewCount -1) / 2, y: 1.05, text: '📋 Useful Many', showarrow: false, font: {color: 'grey'} } : {},
                { xref: 'paper', yref: 'y2', x: 0.95, y: 80, text: '80% Impact', showarrow: false, font: {color: 'orange'}, xanchor: 'right', yanchor: 'bottom' }
            ],
            showlegend: true,
            height: 550, // Increased height slightly
            hovermode: "x unified",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "white" },
            legend: { orientation: "h", y: -0.3 }, // Adjusted legend position
            margin: { t: 60, b: 150, l: 60, r: 60 } // Adjusted margins
        };

        Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true });
    }

    

    function applyParetoAnalysisJS(factors) {
        if (!factors || factors.length === 0) return [];

        const sorted_factors = [...factors].sort((a, b) => b.impact_score - a.impact_score);
        const total_impact = sorted_factors.reduce((sum, f) => sum + f.impact_score, 0);

        if (total_impact === 0) {
            return sorted_factors.map((f, i) => ({ ...f, cumulative_percentage: 0, priority: "Low", rank: i + 1 }));
        }

        let cumulative_impact = 0;
        return sorted_factors.map((factor, i) => {
            cumulative_impact += factor.impact_score;
            const cumulative_percentage = (cumulative_impact / total_impact) * 100;
            return {
                ...factor,
                cumulative_percentage: parseFloat(cumulative_percentage.toFixed(1)),
                priority: cumulative_percentage <= 80 ? "High" : "Low",
                rank: i + 1
            };
        });
    }

    // =========================================================================
    // ===== VISUALIZATION & RENDERING FUNCTIONS                          =====
    // ========================================================================
    // Keep applyParetoAnalysisJS as it's used to process AI output
    function applyParetoAnalysisJS(factors) {
        if (!factors || factors.length === 0) return [];

        // Ensure impact_score is numeric before sorting
        const validFactors = factors.filter(f => typeof f.impact_score === 'number' && !isNaN(f.impact_score));
        if (validFactors.length === 0) {
            console.warn("No factors with valid numeric impact scores found for Pareto analysis.");
            // Return original factors with default priority/rank if scores were bad
            return factors.map((f, i) => ({ ...f, cumulative_percentage: 0, priority: "Low", rank: i + 1 }));
        }


        const sorted_factors = [...validFactors].sort((a, b) => b.impact_score - a.impact_score);
        const total_impact = sorted_factors.reduce((sum, f) => sum + f.impact_score, 0);

        if (total_impact === 0) {
            // Handle case where all scores are 0
            return sorted_factors.map((f, i) => ({ ...f, cumulative_percentage: 0, priority: "Low", rank: i + 1 }));
        }

        let cumulative_impact = 0;
        return sorted_factors.map((factor, i) => {
            cumulative_impact += factor.impact_score;
            const cumulative_percentage = (cumulative_impact / total_impact) * 100;
            return {
                ...factor,
                cumulative_percentage: parseFloat(cumulative_percentage.toFixed(1)),
                priority: cumulative_percentage <= 80 ? "High" : "Low",
                rank: i + 1
            };
        });
    }



    function handleWebSocketMessage(data) {
        const container = pendingAnalysisRequests.get(parseInt(data.messageId));
        if (!container) return;

        if (data.error) {
            container.innerHTML = `<div class="p-4 text-center text-red-400">Workflow error: ${data.error}</div>`;
            pendingAnalysisRequests.delete(parseInt(data.messageId));
            setLoading("generate", false);
            return;
        }

        if (data.progress && !data.result && data.templateId !== "pareto-fishbone") {
            container.innerHTML = `
                    <div class="text-center text-white/70 p-4">
                        <div class="typing-indicator mb-4">
                            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                        </div>
                        <p class="mb-2">🔄 ${data.progress}</p>
                        <p class="text-sm text-white/50">Analysis in progress...</p>
                    </div>`;
            return;
        }

        // Handle complex data for pareto-fishbone
        if (data.templateId === "pareto-fishbone" && data.fishbone && data.pareto) {
            container.innerHTML = ""; // Clear loading
            const fishboneData = data.fishbone;
            const paretoData = data.pareto;

            // Create Tab Interface
            const tabNav = document.createElement("div");
            tabNav.className = "flex border-b border-white/20 -mx-10 px-6";
            tabNav.innerHTML = `
                        <button class="analysis-tab-btn active" data-tab="pareto">📊 Pareto Chart</button>
                        <button class="analysis-tab-btn" data-tab="fishbone">🐟 Fishbone Diagram</button>
                        <button class="analysis-tab-btn" data-tab="details">📋 Analysis Details</button>
                        <button class="analysis-tab-btn" data-tab="plan">🎯 Action Plan</button>
                    `;
            container.appendChild(tabNav);

            const tabContent = document.createElement("div");
            container.appendChild(tabContent);

            // Create Tab Panels
            tabContent.innerHTML = `
                        <div id="paretoPanel" class="analysis-tab-panel active"></div>
                        <div id="fishbonePanel" class="analysis-tab-panel"></div>
                        <div id="detailsPanel" class="analysis-tab-panel"></div>
                        <div id="planPanel" class="analysis-tab-panel"></div>
                    `;

            // Populate Pareto Tab
            const paretoPanel = $("paretoPanel");
            const paretoChartDiv = document.createElement("div");
            paretoChartDiv.id = "paretoChartContainer";
            paretoChartDiv.className = "plotly-chart";
            paretoPanel.appendChild(paretoChartDiv);
            createParetoChartJS(paretoData, "paretoChartContainer");

            // Populate Fishbone Tab
            const fishbonePanel = $("fishbonePanel");
            if (data.fishbone_image) {
                fishbonePanel.innerHTML = `<img id="fishbone_img" src="data:image/png;base64,${data.fishbone_image}" class="w-full h-auto rounded-lg" alt="Fishbone Diagram">`;
            } else {
                fishbonePanel.innerHTML = `<p class="text-white/70">Fishbone image not available.</p>`;
            }

            // Populate Details Tab
            const detailsPanel = $("detailsPanel");
            let detailsHtml = `<h3 class="text-2xl font-bold mb-4">Analysis Summary</h3>`;
            if (paretoData.analysis_summary) {
                detailsHtml += `<div class="p-4 rounded-lg bg-white/5 mb-6 text-white/80 italic">${paretoData.analysis_summary}</div>`;
            }
            detailsHtml += `<h4 class="text-xl font-semibold mb-3">Category Breakdown</h4>`;
            for (const [category, sub_causes] of Object.entries(fishboneData)) {
                detailsHtml += `<details class="bg-white/5 p-3 rounded-lg mb-2"><summary class="cursor-pointer font-semibold">${category} (${sub_causes.length} causes)</summary><ul class="mt-2 pl-4">`;
                sub_causes.forEach((cause) => {
                    const isVital = (paretoData.vital_few || []).some(
                        (item) => cause.toLowerCase() === item.cause.toLowerCase()
                    );
                    detailsHtml += `<li class="mb-1">${isVital ? "🔥" : "📝"} ${cause}</li>`;
                });
                detailsHtml += `</ul></details>`;
            }
            detailsPanel.innerHTML = detailsHtml;

            // Populate Action Plan Tab
            const planPanel = $("planPanel");
            let planHtml = `<h3 class="text-2xl font-bold mb-4">Recommended Action Plan</h3>
                                    <div class="p-4 rounded-lg bg-green-500/10 text-green-300 mb-6">💡 <strong>80/20 Rule:</strong> Focus 80% of your resources on the 'Vital Few' causes for maximum impact!</div>
                                    <h4 class="text-xl font-semibold mb-3 border-b border-red-500/50 pb-2 text-red-300">🔥 IMMEDIATE FOCUS (Vital Few)</h4>`;
            (paretoData.vital_few || []).forEach((cause) => {
                planHtml += `<div class="mb-4">
                                        <p class="font-bold text-lg">${cause.cause} (${cause.impact_score}% impact)</p>
                                        <p class="text-sm text-white/70"><strong>Category:</strong> ${cause.category} | <strong>Priority:</strong> HIGH ⚡</p>
                                     </div>`;
            });
            planHtml += `<h4 class="text-xl font-semibold mt-8 mb-3 border-b border-white/20 pb-2">📋 SECONDARY ACTIONS (Useful Many)</h4>`;
            (paretoData.useful_many || []).forEach((cause) => {
                planHtml += `<div class="mb-4">
                                        <p class="font-bold text-lg">${cause.cause} (${cause.impact_score}% impact)</p>
                                        <p class="text-sm text-white/70"><strong>Category:</strong> ${cause.category} | <strong>Priority:</strong> Medium/Low</p>
                                     </div>`;
            });
            planPanel.innerHTML = planHtml;

            analysisCache[currentTemplateId] = container.innerHTML;

            // Add Tab Switching Logic
            tabNav.addEventListener("click", (e) => {
                if (e.target.tagName === "BUTTON") {
                    tabNav.querySelectorAll(".analysis-tab-btn").forEach((btn) => btn.classList.remove("active"));
                    tabContent.querySelectorAll(".analysis-tab-panel").forEach((pnl) => pnl.classList.remove("active"));

                    e.target.classList.add("active");
                    const targetPanelId = e.target.dataset.tab + "Panel";
                    const targetPanel = $(targetPanelId);
                    targetPanel.classList.add("active");
                    const chart = targetPanel.querySelector(".plotly-chart");
                    if (chart) Plotly.Plots.resize(chart);
                }
            });
        } else if (data.result) {
            // Handle simple text result for other templates
            container.innerHTML = `<div id="analysisContent" class="whitespace-pre-wrap">${data.result}</div>`;
            analysisCache[currentTemplateId] = container.innerHTML;
        }

        const analysisActionsEl = $("analysisActions");
        if (analysisActionsEl) analysisActionsEl.classList.remove("hidden");

        pendingAnalysisRequests.delete(parseInt(data.messageId));
        setLoading("generate", false);
    }

    // --- Auth Logic using Supabase ---
    async function handleLogin() {
        const email = $("loginEmail").value.trim();
        const password = $("loginPassword").value;
        const loginMessageEl = $("loginMessage");

        if (!email || !password) {
            showMessage("loginMessage", "Please fill in all fields", "error");
            return;
        }

        setLoading("login", true);
        loginMessageEl.classList.add("hidden");

        const { data, error } = await supabase.auth.signInWithPassword({
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
        const firstName = $("registerFirstName").value.trim();
        const lastName = $("registerLastName").value.trim();
        const email = $("registerEmail").value.trim();
        const password = $("registerPassword").value;
        const confirmPassword = $("registerConfirmPassword").value;

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
            const { data, error } = await supabase.functions.invoke("create-user-v3", {
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

            $("registerForm").reset();
            navigateTo("emailVerification");
        } catch (err) {
            console.error("Register error:", err);
            showMessage("registerMessage", "An error occurred during registration. Please try again.", "error");
        } finally {
            setLoading("register", false);
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        navigateTo("login");
    }

    // --- UI Helpers ---
    function setLoading(type, isLoading) {
        const btn = $(type + "Btn");
        if (!btn) return;

        const textEl = $(type + "BtnText");
        const spinner = $(type + "Spinner");

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

    function showMessage(id, msg, type) {
        const el = $(id);
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

    // --- Three.js Animation Logic ---
    let scene, camera, renderer, group;
    const particlesData = [];
    let positions, colors;
    let particlesGeometry;
    let pointCloud;
    let particlePositions;
    let linesMesh;
    let animationFrameId;

    const NUM_PARTICLES = 1000;
    const AREA_SIZE = 3000;
    const AREA_HALF = AREA_SIZE / 2;
    const MIN_DISTANCE = 200;

    let mouseX = 0,
        mouseY = 0;

    function createCircleTexture(size, color) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.fill();
        return new THREE.CanvasTexture(canvas);
    }

    function initThreeJS() {
        const canvas = $("threeJsCanvas");
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
        camera.position.z = 3000;

        scene = new THREE.Scene();
        group = new THREE.Group();
        scene.add(group);

        const particleTexture = createCircleTexture(64, "rgba(173, 216, 230, 1)");

        const pMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 7,
            blending: THREE.AdditiveBlending,
            transparent: true,
            sizeAttenuation: false,
            map: particleTexture
        });

        particlesGeometry = new THREE.BufferGeometry();
        particlePositions = new Float32Array(NUM_PARTICLES * 3);

        for (let i = 0; i < NUM_PARTICLES; i++) {
            const x = Math.random() * AREA_SIZE - AREA_HALF;
            const y = Math.random() * AREA_SIZE - AREA_HALF;
            const z = Math.random() * AREA_SIZE - AREA_HALF;

            particlePositions[i * 3] = x;
            particlePositions[i * 3 + 1] = y;
            particlePositions[i * 3 + 2] = z;

            particlesData.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                numConnections: 0
            });
        }

        particlesGeometry.setDrawRange(0, NUM_PARTICLES);
        particlesGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage)
        );

        pointCloud = new THREE.Points(particlesGeometry, pMaterial);
        group.add(pointCloud);

        const lineGeometry = new THREE.BufferGeometry();
        positions = new Float32Array(NUM_PARTICLES * NUM_PARTICLES * 3);
        colors = new Float32Array(NUM_PARTICLES * NUM_PARTICLES * 3);

        lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        lineGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
        lineGeometry.computeBoundingSphere();
        lineGeometry.setDrawRange(0, 0);

        const lineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.4
        });

        linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        group.add(linesMesh);

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        startAnimationLoop();

        window.addEventListener("resize", onWindowResize);
        window.addEventListener("mousemove", onDocumentMouseMove);
    }

    function startAnimationLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        function loop() {
            animateThreeJS();
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }

    function onDocumentMouseMove(event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function animateThreeJS() {
        let vertexpos = 0;
        let colorpos = 0;
        let numConnected = 0;

        for (let i = 0; i < NUM_PARTICLES; i++) {
            particlesData[i].numConnections = 0;
        }

        for (let i = 0; i < NUM_PARTICLES; i++) {
            const particleData = particlesData[i];
            particlePositions[i * 3] += particleData.velocity.x;
            particlePositions[i * 3 + 1] += particleData.velocity.y;
            particlePositions[i * 3 + 2] += particleData.velocity.z;

            if (particlePositions[i * 3 + 1] < -AREA_HALF || particlePositions[i * 3 + 1] > AREA_HALF)
                particleData.velocity.y = -particleData.velocity.y;
            if (particlePositions[i * 3] < -AREA_HALF || particlePositions[i * 3] > AREA_HALF)
                particleData.velocity.x = -particleData.velocity.x;
            if (particlePositions[i * 3 + 2] < -AREA_HALF || particlePositions[i * 3 + 2] > AREA_HALF)
                particleData.velocity.z = -particleData.velocity.z;

            for (let j = i + 1; j < NUM_PARTICLES; j++) {
                const dx = particlePositions[i * 3] - particlePositions[j * 3];
                const dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
                const dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < MIN_DISTANCE) {
                    const alpha = 1.0 - dist / MIN_DISTANCE;
                    positions[vertexpos++] = particlePositions[i * 3];
                    positions[vertexpos++] = particlePositions[i * 3 + 1];
                    positions[vertexpos++] = particlePositions[i * 3 + 2];
                    positions[vertexpos++] = particlePositions[j * 3];
                    positions[vertexpos++] = particlePositions[j * 3 + 1];
                    positions[vertexpos++] = particlePositions[j * 3 + 2];

                    const lineColor = new THREE.Color(0xadd8e6);
                    colors[colorpos++] = lineColor.r * alpha;
                    colors[colorpos++] = lineColor.g * alpha;
                    colors[colorpos++] = lineColor.b * alpha;
                    colors[colorpos++] = lineColor.r * alpha;
                    colors[colorpos++] = lineColor.g * alpha;
                    colors[colorpos++] = lineColor.b * alpha;
                    numConnected++;
                }
            }
        }

        linesMesh.geometry.setDrawRange(0, numConnected * 2);
        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;
        pointCloud.geometry.attributes.position.needsUpdate = true;

        const rotationSpeed = 0.03;
        group.rotation.y += (mouseX * 0.05 - group.rotation.y) * rotationSpeed;
        group.rotation.x += (mouseY * 0.05 - group.rotation.x) * rotationSpeed;
        group.rotation.y += 0.0001;
        group.rotation.x += 0.00005;

        renderer.render(scene, camera);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --- AI Analysis Examples Carousel Logic ---
    let currentExampleIndex = 0;
    const analysisExamples = document.querySelectorAll(".analysis-example-item");
    const prevExampleBtn = $("prevExampleBtn");
    const nextExampleBtn = $("nextExampleBtn");
    const exampleCounter = $("exampleCounter");

    function showAnalysisExample(index) {
        analysisExamples.forEach((item, i) => {
            item.classList.toggle("hidden", i !== index);
        });
        prevExampleBtn.disabled = index === 0;
        nextExampleBtn.disabled = index === analysisExamples.length - 1;
        exampleCounter.textContent = `${index + 1} of ${analysisExamples.length}`;
    }

    if (prevExampleBtn) {
        prevExampleBtn.addEventListener("click", () => {
            if (currentExampleIndex > 0) {
                currentExampleIndex--;
                showAnalysisExample(currentExampleIndex);
            }
        });
    }
    if (nextExampleBtn) {
        nextExampleBtn.addEventListener("click", () => {
            if (currentExampleIndex < analysisExamples.length - 1) {
                currentExampleIndex++;
                showAnalysisExample(currentExampleIndex);
            }
        });
    }
    if (analysisExamples.length > 0) {
        showAnalysisExample(currentExampleIndex);
    }

    // --- Initial Setup ---
    const versionModal = $("versionChoiceModal");
    const selectFreeBtn = $("selectFreeVersion");
    const selectPaidBtn = $("selectPaidVersion");
    const closeModalBtn = $("closeModalBtn");

    selectFreeBtn.addEventListener("click", () => {
        currentSelectionLimit = 1;
        proceedFromModal();
    });

    selectPaidBtn.addEventListener("click", () => {
        currentSelectionLimit = 3;
        proceedFromModal();
    });

    closeModalBtn.addEventListener("click", () => {
        versionModal.classList.add("hidden");
    });

    $("loginBtn").addEventListener("click", handleLogin);
    $("registerBtn").addEventListener("click", handleRegister);

    if (window.location.hash.includes("access_token")) {
        navigateTo("home");
    } else {
        navigateTo("home");
    }

    setupHomeTabs();
    attachHomeCardListeners();

    initThreeJS();

    // --- Dashboard Widget ---
    (function initDashboardWidget() {
        const PRESENCE_PREFIX = "sage_presence_";
        const HEARTBEAT_MS = 10000;
        const STALE_MS = 30000;
        const TAB_ID = crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();

        function heartbeat() {
            try {
                localStorage.setItem(PRESENCE_PREFIX + TAB_ID, String(Date.now()));
            } catch (e) {}
        }

        function cleanupStale() {
            const now = Date.now();
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(PRESENCE_PREFIX)) {
                        const ts = Number(localStorage.getItem(k) || "0");
                        if (!ts || now - ts > STALE_MS) localStorage.removeItem(k);
                    }
                }
            } catch (e) {}
        }

        function countOnline() {
            const now = Date.now();
            let cnt = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(PRESENCE_PREFIX)) {
                        const ts = Number(localStorage.getItem(k) || "0");
                        if (ts && now - ts <= STALE_MS) cnt++;
                    }
                }
            } catch (e) {}
            return cnt;
        }

        heartbeat();
        const hb = setInterval(() => {
            heartbeat();
            cleanupStale();
        }, HEARTBEAT_MS);
        window.addEventListener("beforeunload", () => {
            try {
                localStorage.removeItem(PRESENCE_PREFIX + TAB_ID);
            } catch (e) {}
            clearInterval(hb);
        });

        function updateDashboard() {
            const usersEl = document.getElementById("dashUsersOnline");
            const serverDot = document.getElementById("dashServerDot");
            const serverText = document.getElementById("dashServerText");
            const wsStatusEl = document.getElementById("wsStatus");

            if (usersEl) usersEl.textContent = String(countOnline());

            let statusText = "Unknown",
                statusClass = "bg-yellow-400";
            if (wsStatusEl) {
                const t = wsStatusEl.textContent.trim().toLowerCase();
                if (t.includes("connected")) {
                    statusText = "Connected";
                    statusClass = "bg-green-400";
                } else if (t.includes("disconnected") || t.includes("failed") || t.includes("error")) {
                    statusText = "Disconnected";
                    statusClass = "bg-red-400";
                } else if (t.includes("connecting")) {
                    statusText = "Connecting";
                    statusClass = "bg-yellow-400";
                }
            }

            if (serverText) serverText.textContent = statusText;
            if (serverDot) serverDot.className = "inline-block w-3 h-3 rounded-full " + statusClass;
        }
        setInterval(updateDashboard, 2000);
        updateDashboard();
    })();
});
