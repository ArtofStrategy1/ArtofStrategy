/// <reference types="mermaid" />
/// <reference types="cytoscape" />

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

    async function parseMermaidToCytoscape(mermaidCode) {
        console.log("Parsing Mermaid code to Cytoscape elements:", mermaidCode);
        try {
            // Get diagram type and instance
            const { diagramType, diagram } = await mermaid.mermaidAPI.getDiagramFromText(mermaidCode);
            
            // Initialize the diagram (this parses and populates the database)
            await diagram.parse(mermaidCode);
            
            if (diagramType === 'flowchart' || diagramType === 'graph') {
                const db = diagram.db;
                
                const elements = [];

                // Extract vertices (nodes)
                const vertices = db.getVertices();
                for (const [id, vertex] of Object.entries(vertices)) {
                    elements.push({ data: { id: id, label: vertex.text || id } });
                }
                
                // Extract edges
                const edges = db.getEdges();
                for (const edge of edges) {
                    elements.push({ data: { id: `${edge.start}-${edge.end}-${edge.text || ''}`, source: edge.start, target: edge.end, label: edge.text || '' } });
                }
                
                return elements;
            }
            
            return [];
            
        } catch (error) {
            console.error("Mermaid parsing error:", error);
            return [];
        }
    }

    function renderCytoscapeGraph(elements) {
        console.log("Rendering Cytoscape graph with elements:", elements);
        cy.elements().remove(); // Clear existing elements
        cy.add(elements); // Add new elements
        cy.layout({ name: 'cose' }).run(); // Apply a layout
    }

    function updateMermaidFromCytoscape() {
        const mermaidCode = serializeCytoscapeToMermaid(cy);
        mermaidInput.value = mermaidCode;
        processMermaidInput();
    }

    function serializeCytoscapeToMermaid(cyInstance) {
        console.log("Serializing Cytoscape instance to Mermaid syntax:", cyInstance);
        let mermaidSyntax = "graph TD;\n";

        // Add nodes
        cy.nodes().forEach(node => {
            const id = node.id();
            const label = node.data('label') || id;
            mermaidSyntax += `    ${id}[${label}];\n`;
        });

        // Add edges
        cy.edges().forEach(edge => {
            const source = edge.source().id();
            const target = edge.target().id();
            const label = edge.data('label');
            if (label) {
                mermaidSyntax += `    ${source}--"${label}"-->${target};\n`;
            } else {
                mermaidSyntax += `    ${source}-->${target};\n`;
            }
        });

        return mermaidSyntax;
    }
    async function processMermaidInput() {
        const mermaidCode = mermaidInput.value;
        const { svg } = await mermaid.render('mermaid-render-svg', mermaidCode);
        mermaidRenderDiv.innerHTML = svg;

        const cytoscapeElements = await parseMermaidToCytoscape(mermaidCode);
        renderCytoscapeGraph(cytoscapeElements);
    }

    // Event listeners for user edits on Cytoscape graph
    cy.on('dragfree', 'node', function(event) {
        const node = event.target;
        console.log(`Node '${node.id()}' dragged to position:`, node.position());
        updateMermaidFromCytoscape();
    });

    cy.on('tap', 'node', function(event) {
        const node = event.target;
        console.log(`Node '${node.id()}' tapped. This is where label edit functionality would be integrated.`);
        updateMermaidFromCytoscape();
    });

    cy.on('tap', 'edge', function(event) {
        const edge = event.target;
        console.log(`Edge '${edge.id()}' tapped. This is where label edit functionality would be integrated.`);
        updateMermaidFromCytoscape();
    });

    cy.on('remove', 'node, edge', function(event) {
        const element = event.target;
        console.log(`Element '${element.id()}' removed.`);
        updateMermaidFromCytoscape();
    });

    // Event listener for the Render button
    if (renderButton) {
        renderButton.addEventListener('click', () => {
            processMermaidInput();
        });
    } else {
        // Fallback if no render button, use input change
        mermaidInput.addEventListener('input', async () => {
            const mermaidCode = mermaidInput.value;
            const { svg } = await mermaid.render('mermaid-render-svg', mermaidCode);
            mermaidRenderDiv.innerHTML = svg;

            const cytoscapeElements = await parseMermaidToCytoscape(mermaidCode);
            renderCytoscapeGraph(cytoscapeElements);
        });
    }
});