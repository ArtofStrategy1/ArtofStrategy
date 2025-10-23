// Initialize Mermaid.js.
mermaid.initialize({ startOnLoad: true });
// Variable for panzoomObject instance.
let panzoomInstance = null;
/**
 * Renders a Mermaid.js diagram based on provided Mermaid.js code into a specified container.
 * @param {HTMLElement} diagramContainerElement - The DOM element where the Mermaid diagram should be rendered.
 * @param {string} mermaidCode - The Mermaid.js code used to render the Mermaid.js diagram.
 */
async function renderMermaidDiagram(diagramContainerElement, mermaidCode) {
    try {
        if (panzoomInstance) {
            panzoomInstance.destroy();
            panzoomInstance = null;
        }
        // Clear previous diagram content to ensure a fresh render.
        diagramContainerElement.innerHTML = '';
        // Generate a unique ID for the diagram to prevent conflicts on re-renders.
        // This ID is used internally by Mermaid.js for rendering, but not for the DOM element itself.
        const diagramId = 'mermaid-diagram-' + Math.random().toString(36).slice(2, 11);
        // Use mermaid.render to directly render the SVG into the container.
        // The 'svg' variable will contain the generated SVG string.
        const { svg } = await mermaid.render(diagramId, mermaidCode);
        diagramContainerElement.innerHTML = svg; // Insert the generated SVG into the container.
        // Initialize Panzoom on the container.
        panzoomInstance = Panzoom(diagramContainerElement, {
            maxScale: 5, // Zoom in up to 5x.
            minScale: 0.5, // Zoom out to 0.5x.
            canvas: true, // Use 'canvas' style for SVGs.
            step: 0.2 // Zoom step for mouse .
        });
        // Enable mouse wheel zooming.
        const parent = diagramContainerElement.parentElement;
        parent.addEventListener('wheel', panzoomInstance.zoomWithWheel);
        console.log("Mermaid diagram rendered successfully into:", diagramContainerElement);
    }
    catch (error) {
        console.error("Error rendering Mermaid diagram:", error);
        // Display a user-friendly error message in the container
        diagramContainerElement.innerHTML = `<div class="text-red-400">Error rendering diagram: 
        ${error.message || error.str || 'Unknown error'}</div>`;
    }
}
export {};
// // Optional: Render an initial diagram on page load
// const initialCode = 'graph TD; A[Start] --> B[Analyze]; B --> C[Generate]; C --> D[Render];';
// renderMermaidDiagram(initialCode);
