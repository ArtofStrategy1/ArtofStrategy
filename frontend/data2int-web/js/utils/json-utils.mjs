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


export {
    extractJsonRobust
}