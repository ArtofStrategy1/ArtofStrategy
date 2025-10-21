import mermaid from 'mermaid';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Mermaid.
    mermaid.initialize({ startOnLoad: false });

    // Initialize Cytoscape.js.
    const cy = cytoscape({
        container: document.getElementById('cy'),
        elements: [],
        style: [
            // Define basic styles for nodes and edges.
            {
                selector: 'node',
                style: {
                    'background-color': '#666',
                    'label': 'data(id)'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            }
        ],
        layout: {
            name: 'preset'
        }
    });

    // Get references to elements.
    const mermaidInput = document.getElementById('mermaid-input');
    const mermaidRenderDiv = document.getElementById('mermaid-render');
    const renderButton = document.getElementById('render-button'); // Assuming a button with id 'render-button'.

    function parseMermaidToCytoscape(mermaidCode) {
        console.log("Parsing Mermaid code to Cytoscape elements:", mermaidCode);
        let ast;
        try {
            ast = mermaid.parse(mermaidCode);
        } catch (error) {
            console.error("Mermaid parsing error:", error);
            return []; // Return empty array on error
        }

        const elements = [];
        const nodes = new Map(); // To keep track of unique nodes and their labels.

        // Process AST based on diagram type.
        if (ast.parser.yy.get  && ast.parser.yy.get().diagramType === 'flowchart') {
            const flowchart = ast.parser.yy.get();

            // Extract nodes.
            for (const node of flowchart.nodes) {
                if (!nodes.has(node.id)) {
                    nodes.set(node.id, node.text);
                    elements.push({ data: { id: node.id, label: node.text } });
                }
            }

            // Extract edges.
            for (const link of flowchart.links) {
                const sourceId = link.start;
                const targetId = link.end;
                const edgeLabel = link.text || ''; // Use empty string if no label

                // Ensure source and target nodes exist in our elements array
                if (!nodes.has(sourceId)) {
                    nodes.set(sourceId, sourceId); // Use ID as label if not explicitly defined
                    elements.push({ data: { id: sourceId, label: sourceId } });
                }
                if (!nodes.has(targetId)) {
                    nodes.set(targetId, targetId); // Use ID as label if not explicitly defined
                    elements.push({ data: { id: targetId, label: targetId } });
                }

                elements.push({ data: { id: `${sourceId}-${targetId}-${edgeLabel}`, source: sourceId, target: targetId, label: edgeLabel } });
            }
        } else {
            console.warn("Unsupported Mermaid diagram type or AST structure for Cytoscape conversion.");
            return [];
        }

        return elements;
    }

    function renderCytoscapeGraph(elements) {
        console.log("Rendering Cytoscape graph with elements:", elements);
        cy.elements().remove(); // Clear existing elements
        cy.add(elements); // Add new elements
        cy.layout({ name: 'cose' }).run(); // Apply a layout
    }

    function serializeCytoscapeToMermaid(cyInstance) {
        console.log("Serializing Cytoscape instance to Mermaid syntax:", cyInstance);
        // For now, return a placeholder string
        return "graph TD\n    A[Placeholder Node] --> B(Another Placeholder)";
    }

    // Event listener for the Render button
    if (renderButton) {
        renderButton.addEventListener('click', () => {
            const mermaidCode = mermaidInput.value;
            mermaid.render('mermaid-render-svg', mermaidCode).then(({ svg }) => {
                mermaidRenderDiv.innerHTML = svg;
            });

            const cytoscapeElements = parseMermaidToCytoscape(mermaidCode);
            renderCytoscapeGraph(cytoscapeElements);
        });
    } else {
        // Fallback if no render button, use input change
        mermaidInput.addEventListener('input', () => {
            const mermaidCode = mermaidInput.value;
            mermaid.render('mermaid-render-svg', mermaidCode).then(({ svg }) => {
                mermaidRenderDiv.innerHTML = svg;
            });

            const cytoscapeElements = parseMermaidToCytoscape(mermaidCode);
            renderCytoscapeGraph(cytoscapeElements);
        });
    }
});