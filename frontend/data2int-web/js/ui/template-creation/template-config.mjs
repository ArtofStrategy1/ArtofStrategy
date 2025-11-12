// =====================================================================================================
// ===================                      Template Constants                      ====================
// =====================================================================================================

// --- Template Data ---
const templates = {
    "custom-template": {
        title: "Custom Strategy Generator",
        description: "Design your own strategic analysis by defining the type of strategy, company, and location.",
        isPremium: true
    },
    "vision-mission-goals": {
        title: "Vision & Mission Planning",
        description: "A unified tool to define your organization's guiding purpose, future state, and core goals."
    },
    swot: {
        title: "SWOT Analysis",
        description: "Analyze your organization's Strengths, Weaknesses, Opportunities, and Threats."
    },
    "swot-tows": {
        title: "SWOT/TOWS Analysis",
        description:
            "Develop strategies by matching internal factors (Strengths, Weaknesses) to external factors (Opportunities, Threats)."
    },
    "pareto-fishbone": {
        title: "Pareto & Fishbone Analysis",
        description:
            "A combined approach to identify the root causes of problems (Fishbone) and prioritize them based on impact (Pareto)."
    },
    "external-analysis": {
        title: "External Analysis",
        description:
            "Analyze the external environment (market, competition, trends) to identify opportunities and threats."
    },
    "internal-analysis": {
        title: "Internal Analysis",
        description:
            "Evaluate your organization's internal strengths and weaknesses in resources, capabilities, and core competencies."
    },
    "advanced-system-analysis": {
        title: "Advanced System Analysis",
        description:
            "Model complex systems to understand interdependencies, feedback loops, and high-leverage intervention points."
    },
    "archetype-analysis": {
        title: "Archetype Analysis",
        description:
            "Identify and analyze recurring patterns of behavior (archetypes) within your system or market."
    },
    "creative-dissonance": {
        title: "Creative Dissonance Analysis",
        description:
            "Explore the gap between your current reality and desired future to fuel innovation and strategic change."
    },
    "reframing-thinking": {
        title: "Reframing Thinking Analysis",
        description:
            "Apply the reframing technique to look at problems from new perspectives and unlock creative solutions."
    },
    "delphi-method": {
        title: "Delphi Method Analysis",
        description:
            "Utilize the Delphi method to gather and synthesize expert opinions for forecasting and decision-making."
    },
    "blue-ocean": {
        title: "Blue Ocean Strategy",
        description: "Focuses on creating uncontested market space rather than competing in existing industries."
    },
    "design-thinking": {
        title: "Design Thinking",
        description: "A human-centered, iterative process for creative problem-solving and innovation."
    },
    "thinking-hats": {
        title: "Thinking Hats Analysis",
        description: "Apply Edward de Bono's system for parallel thinking to explore an issue comprehensively."
    },
    scamper: {
        title: "SCAMPER Analysis",
        description:
            "A creative thinking technique using seven prompts (Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse) to innovate."
    },
    triz: {
        title: "TRIZ Analysis",
        description:
            "A systematic approach based on the study of global patent patterns to find innovative solutions to technical problems."
    },
    "regression-analysis": {
        title: "Regression Analysis",
        description:
            "Use statistical regression to model and analyze the relationships between variables for predictive insights."
    },
    "pls-analysis": {
        title: "PLS Analysis",
        description:
            "Apply Partial Least Squares (PLS) for structural equation modeling, especially with complex models and non-normal data."
    },
    "dematel-analysis": {
        title: "Dematel Analysis",
        description:
            "Understand causal relationships between complex factors to identify core problems and effective leverage points."
    },
    competitor: {
        title: "Competitor Analysis",
        description: "Deep dive into competitor strategies, market positioning, and competitive advantages."
    },
    "market-entry": {
        title: "Market Entry Strategy",
        description: "Evaluate market opportunities, entry barriers, and develop a roadmap for market penetration."
    },
    risk: {
        title: "Risk Assessment",
        description: "Identify, evaluate, and develop mitigation strategies for business risks."
    },
    "business-model": {
        title: "Business Model Canvas",
        description: "Design and analyze your business model using the proven 9-building-block framework."
    },
    "digital-transformation": {
        title: "Digital Transformation Roadmap",
        description: "Plan your organization's journey towards digital maturity."
    },
    "predictive-analysis": {
        title: "Predictive Analysis",
        description:
            "Upload your dataset (e.g., CSV) to forecast future trends and outcomes based on historical data."
    }
};

// --- Template UI Rules ---
const templateRules = {
    "thinking-system": { useThinkingSystemLayout_NS: true },
    "sem-analysis": { useSemAnalysisLayout: true },
    "predictive-analysis": { usePredictiveAnalysisLayout: true },
    "living-system": { useLivingSystemLayout_NS: true },
    "creative-dissonance": { useCreativeDissonanceLayout_NS: true },
    "system-actions": { useSystemActionsLayout_ST: true },
    "system-objectives": { useSystemObjectivesLayout_ST: true },
    "descriptive-analysis": { useDescriptiveLayout_DA: true },
    visualization: { useVisualizationLayout_DA: true },
    "pls-analysis": { usePlsLayout_DA: true },
    "mission-vision": { hideAnalysisSection: true, hideFrameworks: true },
    "regression-analysis": { useRegressionLayout_DA: true },
    "novel-goals-initiatives": { useNovelGoalsLayout_NS: true },
    "misc-summary": { useMiscLayout_MSC: true },
    "kpi-events": { useKpiLayout_KE: true },
    "action-plans": { useActionPlansLayout_AP: true },
    objectives: { hideAnalysisSection: true, hideFrameworks: true },
    "goals-initiatives": { useGoalsAndInitiativesLayout_SP: true },
    swot: { hideAnalysisSection: true },
    "swot-tows": { useSwotLayout: true },
    "leverage-points": { useLeveragePointsLayout: true },
    "system-goals-initiatives": { useSystemGoalsLayout: true },
    "archetype-analysis": { useArchetypeLayout: true },
    "factor-analysis": { useFactorAnalysisLayout: true },
    "process-mapping": { useProcessMappingLayout: true },
    "system-thinking-analysis": { useSystemThinkingLayout: true },
    competitor: { hideAnalysisSection: true },
    "market-entry": { hideAnalysisSection: true },
    risk: { hideAnalysisSection: true },
    "pareto-fishbone": { useParetoLayout: true, hideAnalysisSection: true, hideFrameworks: true },
    "external-analysis": { hideAnalysisSection: true },
    "internal-analysis": { hideAnalysisSection: true },
    "prescriptive-analysis": { usePrescriptiveLayout_DA: true },
    "dematel-analysis": { useDematelLayout: true },
    "digital-transformation": { hideAnalysisSection: true },
    "delphi-method": { preselectFramework: "Delphi Method", hideAnalysisSection: true },
    "blue-ocean": { preselectFramework: "Blue Ocean Strategy", hideAnalysisSection: true },
    "design-thinking": { preselectFramework: "Design Thinking", hideAnalysisSection: true },
    "thinking-hats": { preselectFramework: "Thinking Hats", hideAnalysisSection: true },
    "business-model": { preselectFramework: "Business Model Canvas", hideAnalysisSection: true },
    scamper: { preselectFramework: "SCAMPER", hideAnalysisSection: true },
    triz: { preselectFramework: "TRIZ (Theory of Inventive Problem Solving)", hideAnalysisSection: true },
    "reframing-thinking": { preselectFramework: "Reframing Thinking", hideAnalysisSection: true }
};

export const templateConfig = {
    templates,
    templateRules
}