/**
 * NEW HELPER FUNCTION (v7.5 - JS PARSER)
 * Replaces the AI-based `fetchN8nTableAsJson` function.
 * This 100% reliable JS function parses the Markdown table from n8n.
 */
function parseMarkdownTable(markdownText) {
    console.log("Parsing n8n Markdown table with local JS parser...");
    try {
        // Get all lines that start with '|'
        const lines = markdownText.trim().split('\n')
                                .map(l => l.trim())
                                .filter(l => l.startsWith('|'));

        if (lines.length < 3) { // Must have header, separator, and at least one data row
            throw new Error(`Not enough table lines found (found ${lines.length}).`);
        }

        // Get headers from the first line
        // .slice(1, -1) removes the empty strings from the start/end
        const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
        if (headers.length === 0) {
            throw new Error("Could not parse headers from table.");
        }

        // Get data lines (skip header and separator row)
        const dataLines = lines.slice(2);
        const jsonData = [];

        for (const line of dataLines) {
            const values = line.split('|').slice(1, -1).map(v => v.trim());
            if (values.length === headers.length) {
                const rowObj = {};
                headers.forEach((header, index) => {
                    rowObj[header] = values[index];
                });
                jsonData.push(rowObj);
            }
        }
        
        console.log(`Successfully parsed ${jsonData.length} rows from n8n table.`);
        return jsonData; // This is the array: [{...}, {...}, ...]

    } catch (err) {
        console.error("JavaScript Markdown parser failed:", err);
        return [{ "Error": "Failed to parse n8n Markdown table.", "Data": markdownText }];
    }
}

export {
    parseMarkdownTable
}
