/**
 * Generates Mermaid flowchart code from process mapping data.
 * @param {object} data - The process mapping data containing steps and connections.
 * @returns {string} Mermaid flowchart code.
 */
function generateProcessMappingMermaidCode(processData) {
    const { process_name, steps, connections } = processData;
    if (!steps || !connections) {
        return "graph LR\n    A[Error: Incomplete data for Mermaid diagram]";
    }

    let mermaidCode = `graph LR\n`; // Start with graph declaration
    mermaidCode += `%% Process: ${processData.process_name}\n`;
    let roleIdCounter = 0;
    const roleNameToMermaidId = new Map();
    // const roleTaskCounters = new Map(); // Maps role letter to its next task number (e.g., "A" -> 1)
    let taskIdCounter = 0;
    const stepIdToMermaidId = new Map(); // Maps original step.id to generated Mermaid Task_ID (e.g., 1 -> "A1")
    const processedSteps = []; // Temporary structure to hold steps with their generated IDs and role letters
    const stepsByRole = new Map();  // Group processed steps by roleLetter
    
    // First Pass: Assign unique alphanumeric IDs to roles
    processData.steps.forEach(step => {
        if (step.owner && !roleNameToMermaidId.has(step.owner)) {
            roleNameToMermaidId.set(step.owner, generateAlphaNumericId(roleIdCounter++));
        }
    });

    // Second Pass: Generate Task IDs and populate processedSteps.
    processData.steps.forEach(step => {
        const mermaidId = generateAlphaNumericId(taskIdCounter++); // Global task ID counter
        stepIdToMermaidId.set(step.id, mermaidId);
        processedSteps.push({ ...step, mermaidId, roleLetter: roleNameToMermaidId.get(step.owner) });
    });

    // Group processed steps by roleLetter
    processedSteps.forEach(step => {
        const role = step.owner;
        if (role) {
            if (!stepsByRole.has(role)) {
                stepsByRole.set(role, []);
            }
            stepsByRole.get(role).push(step);
        }
    });

    // Generate subgraphs for roles.
    roleNameToMermaidId.forEach((mermaidRoleLetter, roleName) => {
        mermaidCode += `    subgraph Role_${mermaidRoleLetter}[\"${roleName}\"]\n`;
        // Filter processedSteps by owner
        const roleSteps = processedSteps.filter(step => step.owner === roleName) || [];

        let hasStartInRole = false;
        let hasEndInRole = false;

        // Check for Start/End nodes within this role
        roleSteps.forEach(step => {
            if (step.type.toLowerCase() === "start") {
                hasStartInRole = true;
            }
            if (step.type.toLowerCase() === "end") {
                hasEndInRole = true;
            }
        });

        if (hasStartInRole) {
            mermaidCode += `        Start(("Start"))\n`;
        }
        if (hasEndInRole) {
            mermaidCode += `        End(("End"))\n`;
        }

        roleSteps.forEach(step => {
            let nodeShape;
            switch (step.type.toLowerCase()) {
                case "start":
                    nodeShape = `(("${step.name}"))`; // Use double parentheses for start/end tasks
                    break;
                case "end":
                    nodeShape = `((${step.name}))`; // Use double parentheses for start/end tasks
                    break;
                case "task":
                    nodeShape = `[\"${step.id}. ${step.name}\"]`;
                    break;
                case "decision":
                    nodeShape = `{\"${step.id}. ${step.name}\"}`;
                    break;
                default:
                    nodeShape = `[\"${step.id}. ${step.name}\"]`;
            }
            mermaidCode += `        ${step.mermaidId}${nodeShape}\n`;
        });
        mermaidCode += `    end\n`;
    });
    
    // Generate connections.
    mermaidCode += `%% Flow Connections\n`;
    processData.connections.forEach(conn => {
        const fromMermaidId = stepIdToMermaidId.get(conn.from);
        const toMermaidId = stepIdToMermaidId.get(conn.to);
        if (fromMermaidId && toMermaidId) {
            mermaidCode += `    ${fromMermaidId} --\"${conn.label}\"--> ${toMermaidId}\n`;
        }
    });

    // Handle implicit Start/End connections
    const actualStartTask = processedSteps.find(step => step.type.toLowerCase() === "start");
    const actualEndTask = processedSteps.find(step => step.type.toLowerCase() === "end");

    if (actualStartTask) {
        mermaidCode += `    Start --> ${actualStartTask.mermaidId}\n`;
    }

    if (actualEndTask) {
        mermaidCode += `    ${actualEndTask.mermaidId} --> End\n`;
    }

    return mermaidCode;
}

function generateAlphaNumericId(index) {
    let letterIndex = index % 26; // 0-25 for A-Z
    let numberSuffix = Math.floor(index / 26) + 1; // 1 for A-Z, 2 for A-Z again, etc.
    return `${String.fromCharCode(65 + letterIndex)}${numberSuffix}`;
}


/**
 * Parses the fishbone JSON schema and generates a Cytoscape.js elements array
 * with preset positions for a fishbone diagram layout.
 *
 * @param {object} jsonData The input JSON data.
 * @returns {Array} A Cytoscape.js elements array.
 */
function parseFishboneData(jsonData) {
    const elements = [];

    // --- 1. Layout Constants (Tweak these to change the diagram's appearance) ---
    const Y_SPINE = 500;        // Y-coordinate for the horizontal spine
    const X_HEAD = 1300;        // X-coordinate for the "Problem" node (the head)
    const X_TAIL = 0;           // X-coordinate for the tail
    
    const Y_RIB_TOP = 250;      // Y-coordinate for top-row categories
    const Y_RIB_BOTTOM = 750;   // Y-coordinate for bottom-row categories
    
    const X_RIB_START = 250;    // X-coordinate for the first group of ribs
    const X_RIB_SPACING = 350;  // Horizontal gap between rib groups

    // --- 2. Add Head and Tail Nodes ---
    
    // Add the "Head" (Problem)
    elements.push({
        data: { id: 'problem', label: jsonData.problem_statement, type: 'head' },
        position: { x: X_HEAD, y: Y_SPINE },
        locked: true,
    });

    // Add the "Tail" (an invisible node to anchor the spine)
    elements.push({
        data: { id: 'tail', type: 'spine' },
        position: { x: X_TAIL, y: Y_SPINE },
        locked: true,
    });

    // --- 3. Process Categories (Ribs) and Causes (Bones) ---

    // Filter out any categories that have no causes
    const categories = Object.keys(jsonData.fishbone)
                            .filter(key => jsonData.fishbone[key].length > 0);

    const spineNodesToConnect = ['tail']; // Start the spine connection list

    categories.forEach((categoryName, index) => {
        const causes = jsonData.fishbone[categoryName];
        const n = causes.length;

        // Alternate categories between top and bottom
        const isTop = index % 2 === 0;
        const yCategory = isTop ? Y_RIB_TOP : Y_RIB_BOTTOM;
        
        // Group ribs in pairs (e.g., 0 & 1, 2 & 3) at the same horizontal level
        const ribGroupIndex = Math.floor(index / 2);
        const xCategory = X_RIB_START + (ribGroupIndex * X_RIB_SPACING);

        // A. Create the invisible "Spine" node for this rib group to connect to
        const spineNodeId = 'spine-' + ribGroupIndex;
        let xSpinePoint;
        if (!elements.find(el => el.data.id === spineNodeId)) {
            xSpinePoint = xCategory + (X_RIB_SPACING / 3); // Make ribs angle forward
            elements.push({
                data: { id: spineNodeId, type: 'spine' },
                position: { x: xSpinePoint, y: Y_SPINE },
                locked: true,
            });
            spineNodesToConnect.push(spineNodeId);
        } else {
            // Get position of existing spine node
            xSpinePoint = elements.find(el => el.data.id === spineNodeId).position.x;
        }
        
        // B. Create the "Category" node (the rib end)
        const categoryNodeId = 'cat-' + index;
        elements.push({
            data: { id: categoryNodeId, label: categoryName, type: 'category' },
            position: { x: xCategory, y: yCategory },
            locked: true,
        });

        // C. Create the "Cause" nodes and chain the edges
        let lastNodeId = categoryNodeId; // Start the chain from the category node

        causes.forEach((causeText, causeIndex) => {
            const causeNodeId = 'cause-' + index + '-' + causeIndex;
            
            // Calculate position by interpolating between category and spine node
            // (causeIndex + 1) / (n + 1) ensures nodes are evenly spaced *between* start and end
            const percent = (causeIndex + 1) / (n + 1);
            
            const xCause = xCategory + (percent * (xSpinePoint - xCategory));
            const yCause = yCategory + (percent * (Y_SPINE - yCategory));

            // Add the cause node
            elements.push({
                data: { id: causeNodeId, label: causeText, type: 'cause' },
                position: { x: xCause, y: yCause },
                locked: true
            });

            // Add the "bone" edge from the *previous* node in the chain
            elements.push({
                data: { id: 'edge-' + lastNodeId + '-' + causeNodeId, source: lastNodeId, target: causeNodeId, type: 'bone' },
            });
            
            lastNodeId = causeNodeId; // This cause becomes the next source
        });

        // D. Connect the *last* cause node to the spine node
        elements.push({
            data: { id: 'edge-' + lastNodeId + '-' + spineNodeId, source: lastNodeId, target: spineNodeId, type: 'bone' },
        });
    });

    // --- 4. Connect the Spine Nodes ---
    spineNodesToConnect.push('problem'); // Add the head as the final connection

    for (let i = 0; i < spineNodesToConnect.length - 1; i++) {
        elements.push({
            data: {
                id: 'spine-edge-' + i,
                source: spineNodesToConnect[i],
                target: spineNodesToConnect[i+1],
                type: 'spine-bone'
            },
        });
    }

    return elements;
}



/**
 * Helper function to build a DOT string for Viz.js from analysis data.
 * --- FIX v2 --- Added safety checks for loop and loop.type
 */
function buildDotString(elements, causal_links, feedback_loops) {
    if (!elements || !causal_links) return "digraph G {}"; // Return empty graph if data is missing
    
    let dot = 'digraph G {\n';
    dot += '  layout=dot;\n';
    dot += '  overlap=false;\n';
    dot += '  splines=true;\n';
    dot += '  sep="+15,15";\n';
    dot += '  bgcolor="transparent";\n';
    dot += '  node [style=filled, shape=oval, fillcolor="rgba(0,0,0,0.3)", fontcolor="white", color="rgba(255,255,255,0.3)"];\n';
    dot += '  edge [fontcolor="white", fontsize=10];\n\n';

    // Define nodes
    elements.forEach(el => {
        // Safety check for el.type
        if (el.type && typeof el.type === 'string' && el.type.toLowerCase() === 'stock') {
            dot += `  "${el.name}" [shape=box, style="filled,bold", color="var(--primary)"];\n`;
        } else {
            dot += `  "${el.name}";\n`;
        }
    });

    // Get loop colors
    const loopColors = {};
    const colors = ["#2ECC71", "#E74C3C", "#3498DB", "#F39C12", "#9B59B6", "#1ABC9C"];
    let colorIndex = 0;
    
    if (feedback_loops) {
        // --- START FIX ---
        // Added checks for loop, loop.type, and typeof loop.type
        feedback_loops.forEach(loop => {
            const loopName = loop.name || loop.loop_name; // Handle both possible name keys
            if (loop && loop.type && typeof loop.type === 'string' && loop.type.toLowerCase() === 'reinforcing') {
                loopColors[loopName] = colors[colorIndex % colors.length];
                colorIndex++;
            }
        });
        feedback_loops.forEach(loop => {
            const loopName = loop.name || loop.loop_name; // Handle both possible name keys
             if (loop && loop.type && typeof loop.type === 'string' && loop.type.toLowerCase() === 'balancing') {
                loopColors[loopName] = colors[colorIndex % colors.length];
                colorIndex++;
            }
        });
        // --- END FIX ---
    }

    // Define edges
    dot += '\n';
    causal_links.forEach(link => {
        // Use loop color if available, otherwise default
        const color = loopColors[link.loop_name] || (link.loop_name === 'H' ? "rgba(100,100,255,0.6)" : "rgba(255,255,255,0.4)");
        let style = `color="${color}"`;
        if (link.polarity === '-') {
            style += ', arrowhead=tee';
        }
        // Add description as label, fallback to polarity
        const label = link.description || ` ${link.polarity} `;
        dot += `  "${link.from}" -> "${link.to}" [label=" ${label} ", ${style}];\n`;
    });

    // Add loop labels (if they exist)
    if (feedback_loops && feedback_loops.length > 0) {
        dot += '\n  labelloc="b";\n';
        let label = 'Key: ';
        Object.entries(loopColors).forEach(([name, color]) => {
             label += `<font color="${color}">${name}</font>  `;
        });
        dot += `  label = <${label}>;\n`;
    }

    dot += '}';
    return dot;
}

export {
    generateProcessMappingMermaidCode,
    parseFishboneData,
    buildDotString
}