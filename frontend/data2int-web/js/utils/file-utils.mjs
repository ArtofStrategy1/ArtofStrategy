import { dom } from './dom-utils.mjs';

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
    const analysisResultElement = dom.$("analysisResult");

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
    const analysisResultElement = dom.$("analysisResult");

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


export {
    handleSaveAsPdf,
    handleSaveAsDocx,
    extractTextFromFile,
}