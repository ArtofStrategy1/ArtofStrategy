/**
 * Comprehensive Mermaid Flowchart Parser
 * Parses Mermaid flowchart syntax into nodes and edges
 */
class MermaidFlowchartParser {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }
    /**
     * Parse Mermaid flowchart code into graph data
     * @param {string} mermaidCode - The Mermaid flowchart code
     * @returns {Object} { nodes: Array, edges: Array }
     */
    parse(mermaidCode) {
        this.nodes = new Map();
        this.edges = [];
        // Remove comments
        const cleanCode = this.removeComments(mermaidCode);
        // Extract direction (graph TD, flowchart LR, etc.)
        const direction = this.extractDirection(cleanCode);
        // Parse the code line by line
        const lines = cleanCode.split('\n').map(line => line.trim()).filter(line => line);
        for (const line of lines) {
            // Skip the graph/flowchart declaration line
            if (line.match(/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i)) {
                continue;
            }
            // Try to parse as edge definition
            if (this.parseEdge(line)) {
                continue;
            }
            // Try to parse as standalone node definition
            this.parseNode(line);
        }
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
            direction: direction
        };
    }
    /**
     * Remove comments from Mermaid code
     */
    removeComments(code) {
        // Remove %% comments
        return code.replace(/%%.*$/gm, '');
    }
    /**
     * Extract graph direction
     */
    extractDirection(code) {
        const match = code.match(/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/im);
        return match ? match[2] : 'TD';
    }
    /**
     * Parse a node definition and add to nodes map
     * Handles various node shapes:
     * - A[Text] - rectangle
     * - B(Text) - rounded rectangle
     * - C([Text]) - stadium/pill shape
     * - D[[Text]] - subroutine
     * - E[(Text)] - cylinder/database
     * - F((Text)) - circle
     * - G>Text] - asymmetric/flag
     * - H{Text} - rhombus/decision
     * - I{{Text}} - hexagon
     * - J[/Text/] - parallelogram
     * - K[\Text\] - parallelogram alt
     * - L[/Text\] - trapezoid
     * - M[\Text/] - trapezoid alt
     */
    parseNode(line) {
        // Node patterns with different shapes
        const patterns = [
            { regex: /(\w+)\[\[([^\]]+)\]\]/, shape: 'subroutine' }, // A[[text]]
            { regex: /(\w+)\[\(([^\)]+)\)\]/, shape: 'stadium-left' }, // A[(text)]
            { regex: /(\w+)\(\[([^\]]+)\]\)/, shape: 'stadium' }, // A([text])
            { regex: /(\w+)\[\{([^\}]+)\}\]/, shape: 'hexagon-left' }, // A[{text}]
            { regex: /(\w+)\{\{([^\}]+)\}\}/, shape: 'hexagon' }, // A{{text}}
            { regex: /(\w+)\[\\([^\]]+)\/\]/, shape: 'trapezoid-alt' }, // A[\text/]
            { regex: /(\w+)\[\/([^\]]+)\\\]/, shape: 'trapezoid' }, // A[/text\]
            { regex: /(\w+)\[\/([^\]]+)\/\]/, shape: 'parallelogram' }, // A[/text/]
            { regex: /(\w+)\[\\([^\]]+)\\\]/, shape: 'parallelogram-alt' }, // A[\text\]
            { regex: /(\w+)\[\(([^\)]+)\)\]/, shape: 'cylinder' }, // A[(text)]
            { regex: /(\w+)\(\(([^\)]+)\)\)/, shape: 'circle' }, // A((text))
            { regex: /(\w+)>([^\]]+)\]/, shape: 'asymmetric' }, // A>text]
            { regex: /(\w+)\{([^\}]+)\}/, shape: 'rhombus' }, // A{text}
            { regex: /(\w+)\(([^\)]+)\)/, shape: 'rounded' }, // A(text)
            { regex: /(\w+)\[([^\]]+)\]/, shape: 'rect' }, // A[text]
        ];
        for (const { regex, shape } of patterns) {
            const match = line.match(regex);
            if (match) {
                this.addNode(match[1], match[2], shape);
                return true;
            }
        }
        // Plain node without label: just "A"
        const plainMatch = line.match(/^(\w+)$/);
        if (plainMatch) {
            this.addNode(plainMatch[1], plainMatch[1], 'rect');
            return true;
        }
        return false;
    }
    /**
     * Parse an edge definition
     * Handles various edge types:
     * - A --> B (arrow)
     * - A --- B (line)
     * - A -.-> B (dotted arrow)
     * - A ==> B (thick arrow)
     * - A --text--> B (labeled arrow)
     * - A -->|text| B (labeled arrow alt)
     * - A -.text.-> B (labeled dotted)
     * - A ==text==> B (labeled thick)
     */
    parseEdge(line) {
        // Patterns for different edge types
        const edgePatterns = [
            // With label using | |
            {
                regex: /(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)\s*(-->|---|==>|-\.-|<-->|<->|o--o|x--x)\s*\|([^\|]+)\|\s*(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)/,
                hasLabel: true,
                labelIndex: 3
            },
            // With label embedded in arrow
            {
                regex: /(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)\s*--([^-]+)--(>|x|o)\s*(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)/,
                hasLabel: true,
                labelIndex: 2,
                customType: true
            },
            {
                regex: /(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)\s*==([^=]+)==(>)\s*(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)/,
                hasLabel: true,
                labelIndex: 2,
                customType: true
            },
            {
                regex: /(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)\s*-\.([^\.]+)\.->()\s*(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)/,
                hasLabel: true,
                labelIndex: 2,
                customType: true
            },
            // Without label
            {
                regex: /(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)\s*(-->|---|==>|-\.->|<-->|<->|o--o|x--x)\s*(\w+(?:\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})?)/,
                hasLabel: false
            },
        ];
        for (const pattern of edgePatterns) {
            const match = line.match(pattern.regex);
            if (match) {
                let sourceNode = match[1];
                let targetNode = pattern.hasLabel ? match[4] : match[3];
                let edgeType = pattern.customType ? this.getCustomEdgeType(match) : match[2];
                let label = (pattern.hasLabel && pattern.labelIndex !== undefined)
                    ? match[pattern.labelIndex].trim() : '';
                // Extract node IDs (remove shape decorators)
                const sourceId = this.extractNodeId(sourceNode);
                const targetId = this.extractNodeId(targetNode);
                // Parse and add nodes if they have shape definitions
                this.parseNodeIfHasShape(sourceNode);
                this.parseNodeIfHasShape(targetNode);
                // Ensure nodes exist (create plain nodes if not defined)
                if (!this.nodes.has(sourceId)) {
                    this.addNode(sourceId, sourceId, 'rect');
                }
                if (!this.nodes.has(targetId)) {
                    this.addNode(targetId, targetId, 'rect');
                }
                // Add edge
                this.edges.push({
                    source: sourceId,
                    target: targetId,
                    type: edgeType,
                    label: label
                });
                return true;
            }
        }
        return false;
    }
    /**
     * Get custom edge type from match
     */
    getCustomEdgeType(match) {
        if (match[0].includes('=='))
            return '==>';
        if (match[0].includes('-.'))
            return '-.->';
        if (match[3] === 'x')
            return 'x--x';
        if (match[3] === 'o')
            return 'o--o';
        return '-->';
    }
    /**
     * Extract node ID from node definition (removing shape decorators)
     */
    extractNodeId(nodeStr) {
        const match = nodeStr.match(/^(\w+)/);
        return match ? match[1] : nodeStr;
    }
    /**
     * Parse node if it contains shape definition
     */
    parseNodeIfHasShape(nodeStr) {
        if (nodeStr.match(/[\[\(\{]/)) {
            this.parseNode(nodeStr);
        }
    }
    /**
     * Add a node to the nodes map
     */
    addNode(id, label, shape) {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, {
                id: id,
                label: label.trim(),
                shape: shape
            });
        }
    }
}
// Export for use in modules
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = MermaidFlowchartParser;
// }
/*
// Usage Example
const parser = new MermaidFlowchartParser();

const exampleCode = `
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E((End))
    C --> E
`;

const result = parser.parse(exampleCode);
console.log('Parsed Graph:', JSON.stringify(result, null, 2));
*/
