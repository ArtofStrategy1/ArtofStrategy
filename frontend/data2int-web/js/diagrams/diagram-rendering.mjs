// Initialize Mermaid.js.
mermaid.initialize({ startOnLoad: true, theme: 'dark', darkMode: true });
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
            maxScale: 10, // Zoom in up to 10x.
            minScale: 0.1, // Zoom out to 0.1x.
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



// --- Initialize Cytoscape.js ---
function renderFishboneDiagram(containerId, elements) {
    const cy = cytoscape({
        container: containerId,
        elements: elements,
        
        // Use the 'preset' layout because we've already defined all positions
        layout: {
            name: 'preset'
        },
        
        // Zoom and pan settings
        zoom: 1,
        minZoom: 0.2,
        maxZoom: 5,
        zoomingEnabled: true,
        userZoomingEnabled: true,
        panningEnabled: true,
        userPanningEnabled: true,
        
        // --- 4. Style the Diagram (UPDATED STYLES) ---
        style: [
            {
                selector: 'node',
                style: {
                    'font-size': '12px',
                    'color': '#fff',
                    'text-wrap': 'wrap',
                    'text-max-width': '150px',
                    'text-valign': 'center',
                    'text-halign': 'center',
                }
            },
            {
                selector: 'node[label]',
                style: {
                    'label': 'data(label)',
                }
            },
            {
                selector: 'node[type = "head"]',
                style: {
                    'shape': 'round-rectangle',
                    'background-color': '#2f2f2f', // Black color,
                    'outline-width': '2px',
                    'outline-color': '#777',
                    'color': '#fff',
                    'font-weight': 'bold',
                    'font-size': '14px',
                    'padding': '15px',
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'text-max-width': '400px',  // Allows the text to spread out more 
                    'text-wrap': 'wrap',        // Allows text to wrap within node.
                    'width': 'label',           // Automatically size width to content
                    'height': 'label',          // Automatically size height to content                                       
                }
            },
            {
                selector: 'node[type = "category"]',
                style: {
                    'shape': 'round-rectangle',
                    'background-color': '#2f2f2f', // Black color,
                    'outline-width': '2px',
                    'outline-color': '#777',
                    'color': '#fff',
                    'font-weight': 'bold',
                    'font-size': '14px',
                    'padding': '10px',
                    'width': '80px',
                    'min-width': '100px'
                }
            },
            {
                selector: 'node[type = "cause"]',
                style: {
                    'shape': 'ellipse',
                    'background-color': '#fff',
                    'border-width': 3,
                    'border-color': '#333', // Teal border
                    'width': 20,
                    'height': 20,
                    // Place label to the right of the circle
                    'font-family': 'Arial',
                    'font-size': '14px',
                    // 'font-weight': 'bold',
                    'text-halign': 'right',
                    'text-valign': 'center',
                    'text-margin-x': 10,
                }
            },
            {
                // Make the invisible spine nodes hidden
                selector: 'node[type = "spine"]',
                style: {
                    'visibility': 'hidden'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#ccc',
                    'curve-style': 'straight', // Use straight lines
                    'target-arrow-shape': 'none',
                }
            },
            {
                selector: 'edge[type = "spine-bone"]',
                style: {
                    'width': 5,
                    'line-color': '#777',
                }
            },
            {
                selector: 'edge[type = "bone"]',
                style: {
                    'width': 3,
                    'line-color': '#777', // Teal
                }
            }
        ]
    });
    
    cy.fit(); // Fit the diagram to the viewport

    return cy;
}

export {
    renderMermaidDiagram,
    renderFishboneDiagram
}