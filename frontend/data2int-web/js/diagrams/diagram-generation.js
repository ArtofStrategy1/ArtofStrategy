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