import os
import requests
import google.generativeai as genai
import json
import pandas as pd
from dotenv import load_dotenv
from typing import Dict, List, Any, Callable

# Loads environment variables from a `.env` file.
load_dotenv()

# --- PROMPT TEMPLATES ---
# Extracted from frontend/data2int-web/js/analysis/analysis-handling-sp.mjs
PROMPT_TEMPLATES = {
    "mission_vision": """
        You are a top-tier strategic consultant (e.g., McKinsey, BCG). Your task is to analyze the user's provided company context **based ONLY on the text itself** and generate a comprehensive strategic foundation. You must deconstruct the Mission, Vision, Values, and Goals into their core components and provide rich, actionable detail for each.

        **USER'S COMPANY CONTEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Ground all answers *strictly* in the text):**

        1.  **Deconstruct Mission (`mission`):**
            * `statement`: Synthesize a single, powerful mission statement.
            * `breakdown`: An array of objects analyzing the mission's components:
                * `component`: "Purpose" (What we do)
                * `analysis`: "Analysis of what the company does, from the text..."
                * `component`: "Target Audience" (For whom)
                * `analysis`: "Analysis of the target customers, from the text..."
                * `component`: "Value Proposition" (What value we provide)
                * `analysis`: "Analysis of the core value delivered, from the text..."

        2.  **Deconstruct Vision (`vision`):**
            * `statement`: Synthesize a single, inspirational vision statement.
            * `breakdown`: An array of objects analyzing the vision's components:
                * `component`: "Future State" (Where we are going)
                * `analysis`: "Analysis of the company's aspirational future, from the text..."
                * `component`: "Key Differentiator" (How we will win)
                * `analysis`: "Analysis of the future competitive advantage, from the text..."
                * `component`: "Impact" (The ultimate outcome)
                * `analysis`: "Analysis of the long-term impact on the industry/world, from the text..."

        3.  **Analyze Core Values (`values`):**
            * Extract an array of 3-5 core values **from the text** (e.g., "Innovation," "Integrity").
            * For each, provide:
                * `value`: The value itself (e.g., "Innovation").
                * `description`: A 1-2 sentence explanation of *how* this value manifests **based on evidence in the text** (e.g., "This is shown by the company's heavy investment in R&D...").

        4.  **Analyze Strategic Goals (`goals`):**
            * Extract an array of 3-5 high-level S.M.A.R.T. goals **from the text**.
            * For each, provide:
                * `goal_name`: The high-level goal (e.g., "Expand Market Share").
                * `description`: A 1-2 sentence explanation of *why* this goal is critical for achieving the Vision, **based on the text**.
                * `key_initiatives`: An array of 2-3 specific initiative strings **from the text** (e.g., "Launch product in European market", "Develop new pricing model").
                * `kpis_to_track`: An array of 2-3 specific KPI strings **from the text** (e.g., "Increase market share from 15% to 25%", "Achieve 500K EU active users").

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S COMPANY CONTEXT".
        - **NO FABRICATION:** Do not invent values, goals, or aspirations not present or logically implied in the text.
        - **FULL DETAIL:** You *must* provide the full, deep analysis for all four components, including the arrays of objects.
        - **JSON FORMAT:** Adhere EXACTLY.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {{
            "mission": {{
                "statement": "[Synthesized 1-sentence mission]",
                "breakdown": [
                    {{ "component": "Purpose", "analysis": "[Analysis from text...]" }},
                    {{ "component": "Target Audience", "analysis": "[Analysis from text...]" }},
                    {{ "component": "Value Proposition", "analysis": "[Analysis from text...]" }}
                ]
            }},
            "vision": {{
                "statement": "[Synthesized 1-sentence vision]",
                "breakdown": [
                    {{ "component": "Future State", "analysis": "[Analysis from text...]" }},
                    {{ "component": "Key Differentiator", "analysis": "[Analysis from text...]" }},
                    {{ "component": "Impact", "analysis": "[Analysis from text...]" }}
                ]
            }},
            "values": [
                {{ "value": "Value 1 from text", "description": "How this is shown in the text..." }},
                {{ "value": "Value 2 from text", "description": "How this is shown in the text..." }}
                ],
            "goals": [
                {{ "goal_name": "Goal 1 from text", "description": "Why this supports the vision, based on text...", "key_initiatives": ["..."], "kpis_to_track": ["..."] }},
                {{ "goal_name": "Goal 2 from text", "description": "Why this supports the vision, based on text...", "key_initiatives": ["..."], "kpis_to_track": ["..."] }}
            ]
        }}
    """,
    "factor_analysis": """
        You are a meticulous senior strategic analyst. Your task is to perform an exhaustive and deeply detailed factor analysis based **ONLY** on the provided business text. You must find **EVERY SINGLE** relevant factor.

        **USER'S BUSINESS DESCRIPTION:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Identify Internal Factors:** Exhaustively scan the text for **ALL** internal positive factors (Strengths) and internal negative factors (Weaknesses).
        2.  **Identify External Factors:** Exhaustively scan the text for **ALL** external positive factors (Opportunities) and external negative factors (Threats).
        3.  **Provide Deep Analysis for EACH Factor:** For **EVERY** factor identified, you MUST provide the following detailed structure:
            * `factor`: The concise name of the factor (e.g., "Strong Brand Reputation").
            * `category`: The business function it relates to (e.g., "Marketing", "Operations", "Financial", "PESTEL - Technology").
            * `description`: A 1-2 sentence description summarizing the factor **using wording found in or directly inferred from the text**.
            * `impact_score`: A plausible impact score (integer 1-10, where 10 is highest impact) based **only** on its significance as suggested **by the text**.
            * `analysis`: A nested object containing the deep analysis:
                * `facts`: A list of 3-5 specific, relevant factual statements about this factor **based *only* on the text**.
                * `deductions`: A list of 3-4 logical inferences drawn **from the facts above**.
                * `conclusions`: A list of 2-3 strategic implications. Each **MUST** include: Impact (High/Medium/Low), Urgency (Critical/Important/Monitor), and Stance (Leverage/Improve/Mitigate/Monitor).
                * `summary`: A concise 2-3 sentence summary of this factor's strategic significance.

        **ABSOLUTE CONSTRAINTS:**
        - **BE EXHAUSTIVE:** Do not stop at 4-6 factors. Find all of them.
        - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided text. **DO NOT** invent factors, analysis, or recommendations not supported by the text.
        - **DEEP ANALYSIS IS MANDATORY:** The `analysis` object with its 4 parts is the most critical part of this task for **EVERY** factor.
        - **JSON FORMAT:** Adhere EXACTLY to the nested structure.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {{
            "internal_factors": {{
            "strengths": [
                {{
                "factor": "...", "category": "...", "description": "...", "impact_score": 9, 
                "analysis": {{
                    "facts": ["Fact 1...", "Fact 2..."],
                    "deductions": ["Deduction 1...", "Deduction 2..."],
                    "conclusions": ["- Impact: High...", "- Urgency: Critical...", "- Stance: Leverage..."],
                    "summary": "..."
                }}
                }}
                // ... *all* other strengths ...
            ],
            "weaknesses": [
                {{
                "factor": "...", "category": "...", "description": "...", "impact_score": 7, 
                "analysis": {{
                    "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                }}
                }}
                // ... *all* other weaknesses ...
            ]
            }},
            "external_factors": {{
            "opportunities": [
                {{
                "factor": "...", "category": "...", "description": "...", "impact_score": 8, 
                "analysis": {{
                    "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                }}
                }}
                // ... *all* other opportunities ...
            ],
            "threats": [
                {{
                "factor": "...", "category": "...", "description": "...", "impact_score": 6, 
                "analysis": {{
                    "facts": ["..."], "deductions": ["..."], "conclusions": ["- Impact: ..."], "summary": "..."
                }}
                }}
                // ... *all* other threats ...
            ]
            }}
        }}
    """,
    "goals_initiatives_ogsm": """
        You are a strategic planning consultant specializing in the OGSM (Objective, Goals, Strategies, Measures) framework. Based **ONLY** on the user's provided context (which might describe a high-level goal or general business situation), create a complete OGSM plan derived strictly from that text.

        **USER'S CONTEXT / HIGH-LEVEL GOAL:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Define Objective:** Refine the user's input or infer from the context a single, clear, overarching, and ideally measurable `main_objective` (SMART if possible).
        2.  **Define Goals (3-4 goals):** Identify specific, high-level `goals` that support the main_objective, derived **only from the text**.
        3.  **Develop Strategies & Measures:** For EACH goal, develop 1-2 supporting `strategies` **based only on actions or directions mentioned/implied in the text**. For EACH strategy:
            * Provide a concise `strategy_name` (action-oriented).
            * Provide a brief `rationale` (1-2 sentences) explaining *how* this strategy supports the parent goal and main objective, **using evidence ONLY from the text**.
            * List 1-2 specific, measurable `measures` (KPIs) **mentioned in, implied by, or logically derived ONLY from the text** to track the strategy's success.
        4.  **Self-Correction:** Rigorously check: Is the objective derived solely from input/context? Are goals/strategies/rationales/measures **strictly based ONLY on the user's text**? Is the structure logical and hierarchical? Is the JSON perfect? Fix all errors.

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S CONTEXT / HIGH-LEVEL GOAL". **DO NOT** invent information, goals, strategies, or KPIs not present or logically implied in the text.
        - **NO GENERIC EXAMPLES:** Replace **ALL** placeholder text in the RETURN FORMAT structure below with content generated **strictly from the user's input text**.
        - **JSON FORMAT:** Adhere EXACTLY.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text.
        {{
            "main_objective": "[SMART Objective derived ONLY from user text/context]",
            "goals": [ // 3-4 goals derived ONLY from text
            {{
                "goal_name": "[Goal 1 Name derived ONLY from text]",
                "strategies": [ // 1-2 strategies per goal derived ONLY from text
                {{
                    "strategy_name": "[Strategy 1.1 Name ONLY from text]",
                    "rationale": "[Rationale linking strategy to goal/objective using ONLY text evidence...]",
                    "measures": ["[Measure/KPI 1.1.1 derived ONLY from text]", "[Measure/KPI 1.1.2 derived ONLY from text]"]
                }},
                {{
                    "strategy_name": "[Strategy 1.2 Name ONLY from text]",
                    "rationale": "[Rationale linking strategy using ONLY text evidence...]",
                    "measures": ["[Measure/KPI 1.2.1 derived ONLY from text]"]
                }}
                ]
            }},
            {{
                "goal_name": "[Goal 2 Name derived ONLY from text]",
                "strategies": [
                {{
                    "strategy_name": "[Strategy 2.1 Name ONLY from text]",
                    "rationale": "[Rationale linking strategy using ONLY text evidence...]",
                    "measures": ["[Measure/KPI 2.1.1 derived ONLY from text]"]
                }}
                ]
            }}
            // ... potentially 1-2 more goals derived ONLY from text ...
            ]
        }}
    """,
    "smart_objectives": """
        You are an expert strategic planner. Analyze the user's provided goal/context **based ONLY on the text itself** and formulate a set of 3-5 detailed S.M.A.R.T. objectives.

        **USER'S GOAL / CONTEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Refine Main Goal:** Provide a concise, 1-sentence summary of the user's primary goal (`main_goal`) **based ONLY on the text**.
        2.  **Formulate S.M.A.R.T. Objectives:** Create an array of 3-5 `smart_objectives`. For EACH objective, provide the following **strictly derived from the user's text**:
            * `objective_name`: A clear, concise name for the objective.
            * `smart_breakdown`: A nested object detailing each component:
                * `specific`: What exactly will be achieved? (Be very specific, using details from the text).
                * `measurable`: How will success be measured? (Identify the key metric mentioned or implied in the text).
                * `achievable`: Why is this achievable? (Reference resources, strengths, or context from the text).
                * `relevant`: Why is this relevant to the `main_goal`? (Link it directly to the user's context).
                * `time_bound`: What is the timeframe? (Infer a realistic timeframe, e.g., "within 6 months", "by EOY", based on the text's scope).
            * `key_actions`: A list of 2-3 high-level action items **from the text** needed to start this objective.
            * `potential_risks`: A list of 1-2 potential risks **from the text** that could endanger this specific objective.
        3.  **Self-Correction:** Rigorously check: Is the main goal from text? Is EVERY detail of the SMART breakdown (S, M, A, R, T), key actions, and risks **strictly derived ONLY from the user's text**? Is the JSON perfect? Fix errors.

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT IS KING:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S GOAL / CONTEXT". **DO NOT** invent information.
        - **JSON FORMAT:** Adhere EXACTLY.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {{
            "main_goal": "[Refined main goal summary ONLY from user text]",
            "smart_objectives": [
            {{
                "objective_name": "[Objective 1 Name ONLY from text]",
                "smart_breakdown": {{
                "specific": "[Specific goal detail ONLY from text...]",
                "measurable": "[Metric/KPI ONLY from text...]",
                "achievable": "[Reason it's achievable ONLY from text...]",
                "relevant": "[Relevance to main goal ONLY from text...]",
                "time_bound": "[Timeframe inferred ONLY from text...]"
                }},
                "key_actions": ["[Action 1 ONLY from text]", "[Action 2 ONLY from text]"],
                "potential_risks": ["[Risk 1 ONLY from text]"]
            }}
            ]
        }}
    """,
    "action_plan": """
        You are an expert project manager. Your task is to analyze the provided text, determine its intent, and formulate a high-level project plan with 5-7 sequential action items. Base this *only* on the provided text.

        **USER'S TEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Follow this order):**

        **Task 1: Determine Text Intent.**
        First, read the text to determine its intent.
        - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
        - OR is it a **Descriptive Company Profile / Strategic Plan** (listing services, differentiators, and goals, like "NexaFlow Capital" or "AquaGlow Skincare")?
        - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

        **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):**

        **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
        1.  **Project Name (`project_name`):** Define a name for the plan (e.g., "Resolving [The Problem]").
        2.  **Action Items (`action_items`):** Generate 5-7 sequential action items to *fix* the problem, based on the text. For each:
            * `task_name`: Actionable name (e.g., "Audit Control Loops").
            * `description`: What needs to be done, from text.
            * `owner`: Team/role from text.
            * `timeline`: Sequential timeline (e.g., "Week 1-2").
            * `priority`: "High", "Medium", "Low" based on text.
            * `resources_needed`: Resources mentioned in text.
            * `key_dependency`: Previous task name (or null).
            * `kpis_to_track`: 1-2 metrics for *this task*.

        **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow or AquaGlow):**
        1.  **Project Name (`project_name`):** Define a name for the plan (e.g., "Strategic Plan for [Company Name]").
        2.  **Action Items (`action_items`):** Generate 5-7 sequential action items based on the **"Core Services"**, **"Differentiators"**, or **"Proposed Solutions"** listed in the text.
            * `task_name`: The service or differentiator to be amplified (e.g., "Scale NexaScore AI Engine", "Launch Retail-Ready Packaging").
            * `description`: What this initiative involves, from text.
            * `owner`: Team/role from text (e.g., "Product Development Team").
            * `timeline`: Sequential timeline (e.g., "Phase 1").
            * `priority`: "High", "Medium", "Low" based on text.
            * `resources_needed`: Resources mentioned in text.
            * `key_dependency`: Previous task name (or null).
            * `kpis_to_track`: 1-2 metrics for *this task* (e.g., "NexaScore accuracy rate", "Retailer sell-through rate").

        **IF IT IS UNANALYZABLE:**
        1.  **Project Name (`project_name`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a poem...").
        2.  **Action Items (`action_items`):** This MUST be an empty array [].
        
        **ABSOLUTE CONSTRAINTS:**
        - STICK TO THE TEXT. Do NOT invent information.
        - JSON format must be perfect.

        **RETURN FORMAT (Example for a Descriptive Profile):**
        {{
            "project_name": "Strategic Plan for NexaFlow Capital",
            "action_items": [
            {{
                "task_name": "Scale NexaScore™ AI Engine",
                "description": "Expand the proprietary AI engine for real-time creditworthiness evaluation to new markets or data sources.",
                "owner": "AI/Data Science Team",
                "timeline": "Phase 1 (Months 1-6)",
                "priority": "High",
                "resources_needed": ["AI Talent", "Cloud Infrastructure", "New Data Partnerships"],
                "key_dependency": null,
                "kpis_to_track": ["NexaScore accuracy rate", "New client acquisition"]
            }},
            {{
                "task_name": "Enhance DeFi Payments Platform",
                "description": "Build on the existing cross-border DeFi payments service, focusing on stablecoin integrations and transparency.",
                "owner": "Blockchain Team",
                "timeline": "Phase 2 (Months 4-12)",
                "priority": "Medium",
                "resources_needed": ["Smart Contract Auditors", "Stablecoin Partnerships"],
                "key_dependency": "Scale NexaScore™ AI Engine",
                "kpis_to_track": ["Transaction Volume", "Settlement Time"]
            }}
            ]
        }}
    """,
    "kpi_research_plan": """
        You are a meticulous research analyst and strategic consultant. Your task is to analyze the provided business context **ONLY** and extract its core components into a structured JSON.

        **USER'S BUSINESS CONTEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Ground all answers *strictly* in the text):**
        1.  **Extract Goal:** Identify the `main_goal` of the research/project (e.g., "to understand the key drivers of customer satisfaction...").
        2.  **Extract KPI Groups:**
            * First, identify the main constructs/problems (e.g., "SERVICE QUALITY", "Unstable Control Feedback Loops").
            * Then, for each construct, extract its *specific bulleted indicators* as the KPIs (e.g., "Website responsiveness", "Temperature regulation accuracy").
            * Create an array of `kpi_groups`. For each group:
                * `construct_name`: The parent construct (e.g., "Service Quality", "Unstable Control Feedback Loops").
                * `kpis`: An array of KPI objects. For each KPI:
                    * `name`: The specific indicator (e.g., "Website responsiveness", "Temperature regulation accuracy").
                    * `formula`: A plausible, specific measurement scale or formula for this KPI (e.g., "Page Load Time (ms)", "Avg. Deviation from Setpoint (°C)", "Latency (ms)", "% of accurate calibrations", "Uptime %"). **If the text mentions a specific scale (like '1-7 scale'), use that. Otherwise, YOU MUST GENERATE a logical one.**
                    * `type`: Infer the category (e.g., "Operational", "Customer", "Financial").
        3.  **Extract Critical Events:** Identify key project milestones **from the text** (e.g., conducting the survey, developing the roadmap). Create an array of `critical_events`. For each event:
            * `event_name`: Name of the milestone (e.g., "Conduct Customer Survey").
            * `description`: What signifies completion (e.g., "Survey of 500 customers completed").
            * `timeline`: Timeframe (e.g., "Within 6 months", "3-year").
            * `importance`: Assess importance ("High" or "Medium").
        4.  **Extract Summary:** Extract the `performance_summary` or "Expected Business Impact" section.

        **ABSOLUTE CONSTRAINTS:**
        - **USE INDICATORS AS KPIs:** The KPIs *must* be the sub-items (e.g., "Product durability"), NOT the main constructs (e.g., "PRODUCT QUALITY").
        - **STICK TO THE TEXT:** Do NOT invent KPIs, scales, or events not present in the text, *unless* you are generating a formula as instructed.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object.
        {{
            "main_goal": "[Goal extracted from text, e.g., 'To address severe challenges related to multiple dynamic systems...']",
            "kpi_groups": [
            {{
                "construct_name": "Unstable Control Feedback Loops",
                "kpis": [
                {{"name": "Automated control systems stability", "formula": "Oscillation Frequency (Hz) or Uptime %", "type": "Operational"}},
                {{"name": "Temperature regulation accuracy", "formula": "Avg. Deviation from Setpoint (°C)", "type": "Operational"}}
                ]
            }},
            {{
                "construct_name": "Cross-System Latency",
                "kpis": [
                {{"name": "IoT sensor data synchronization", "formula": "Max Data Lag (seconds)", "type": "Data"}},
                {{"name": "Communication latency", "formula": "Latency (ms)", "type": "Data"}}
                ]
            }}
            // ... *all* other constructs and their indicators found in the text ...
            ],
            "critical_events": [
            {{"event_name": "Conduct Comprehensive System Audit", "description": "Identify all conflicting dynamic interactions", "timeline": "Within 6 Months", "importance": "High"}},
            {{"event_name": "Rebuild Data Integration Pipelines", "description": "Implement asynchronous event-driven architecture", "timeline": "Within 9 Months", "importance": "High"}}
            ],
            "performance_summary": "[Summary of expected business impact, extracted from text...]"
        }}
    """
}

def call_ollama(prompt: str, ollama_url: str, model_name: str) -> Dict[str, Any]:
    """
    Helper function to make a single request to the Ollama API.
    """
    try:
        payload = {
            "model": model_name,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {"num_ctx": 32768}
        }
        response = requests.post(ollama_url, json=payload, timeout=180)  # Increased timeout for complex generation
        response.raise_for_status()
        response_data = response.json()
        json_string = response_data.get("response", "{}")
        return json.loads(json_string)
    except requests.exceptions.RequestException as e:
        print(f"ERROR: A connection error occurred while querying S.A.G.E model: {e}")
        return {"error": f"Failed to connect to Ollama at {ollama_url}."}
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse JSON from S.A.G.E model response: {e}")
        print(f"Raw response was: {json_string}")
        return {"error": "Failed to parse the JSON response from the S.A.G.E model."}
    except Exception as e:
        print(f"ERROR: An unexpected error occurred: {e}")
        return {"error": f"An unexpected error occurred: {e}"}


def query_sage_model(prompt_text: Any, analysis_type: str) -> Dict[str, Any]:
    """
    Queries the local S.A.G.E. model (e.g., Llama 3.1) by making an HTTP request to an Ollama-compatible API.
    """
    print(f"--- Querying S.A.G.E. model for: {analysis_type} ---")
    
    ollama_url = os.environ.get("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    model_name = os.environ.get("SAGE_MODEL_NAME", "llama3.1:latest")

    if analysis_type not in PROMPT_TEMPLATES:
        return {"error": f"Unknown analysis type: {analysis_type}"}
    
    template = PROMPT_TEMPLATES[analysis_type]
    prompt = template.format(prompt_text=str(prompt_text))
    return call_ollama(prompt, ollama_url, model_name)


# Queries a more powerful "judge" LLM.
def query_judge_model(evaluation_prompt: str) -> Dict[str, Any]:
    """
    Queries the Gemini 2.5 Flash model to get a quality assessment.
    Requires a `GEMINI_API_KEY` environment variable.
    """
    print("--- Querying Judge model (Gemini 2.5 Flash) for quality score ---")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set.")
        return {
            "quality_score": 0,
            "reasoning": "Skipped due to missing GEMINI_API_KEY."
        }

    try:
        genai.configure(api_key=api_key)
        
        judge_system_prompt = """
        You are an expert evaluation agent. Your task is to assess the quality of an LLM's output based on a user's prompt and a ground truth summary.
        You must return your assessment ONLY as a valid JSON object with two keys:
        { 
            "quality_score": int, // An integer from 1 to 5, where 1 is poor and 5 is excellent.
            "reasoning": "string" // A brief, one or two-sentence explanation for your score.
        }
        
        Do not return any other text, just the JSON object.
        """

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content([judge_system_prompt, evaluation_prompt])
        # Clean up the response text before parsing
        text_to_parse = response.text.strip().replace("```json", "").replace("```", "")

        return json.loads(text_to_parse)

    except Exception as e:
        print(f"ERROR: An exception occurred while querying the judge model: {e}")
        return {
            "quality_score": 0,
            "reasoning": f"Failed to get assessment from judge model due to an error: {e}"
        }


def query_local_judge_model(evaluation_prompt: str) -> Dict[str, Any]:
    """
    Queries a local Ollama model to get a quality assessment.
    Requires an `OLLAMA_API_URL` environment variable (defaults to http://localhost:11434/api/generate).
    """
    print("--- Querying Local Judge model (Ollama) for quality score ---")
    
    ollama_url = os.environ.get("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    model_name = "qwen3:30b-a3b-thinking"

    judge_system_prompt = """
    You are an expert evaluation agent. Your task is to assess the quality of an LLM's output based on a user's prompt and a ground truth summary.
    You must return your assessment ONLY as a valid JSON object with two keys:
    { 
        "quality_score": int, // An integer from 1 to 5, where 1 is poor and 5 is excellent.
        "reasoning": "string" // A brief, one or two-sentence explanation for your score.
    }
    
    Do not return any other text, just the JSON object.
    """
    
    full_prompt = f"{judge_system_prompt}\n\n{evaluation_prompt}"

    try:
        payload = {
            "model": model_name,
            "prompt": full_prompt,
            "format": "json",
            "stream": False,
            "options": { "num_ctx": 16384 }
        }
        
        response = requests.post(ollama_url, json=payload, timeout=60)
        response.raise_for_status() # Raise an exception for bad status codes
        # print(response)
        # The JSON response from Ollama is a string inside the 'response' key
        response_data = response.json()
        print(response_data)
        json_string = response_data.get("response", "{}")
        # json_string = response_data.get("thinking", "{}")
        print(json_string)
        return json.loads(json_string)

    except requests.exceptions.RequestException as e:
        print(f"ERROR: A connection error occurred while querying the local judge model: {e}")
        return {
            "quality_score": 0,
            "reasoning": f"Failed to connect to local judge model at {ollama_url}."
        }
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse JSON from local judge model response: {e}")
        return {
            "quality_score": 0,
            "reasoning": "Failed to parse the JSON response from the local judge model."
        }
    except Exception as e:
        print(f"ERROR: An unexpected error occurred while querying the local judge model: {e}")
        return {
            "quality_score": 0,
            "reasoning": f"An unexpected error occurred: {e}"
        }

# --- VALIDATOR CLASS (CRITICAL) ---
class SageValidator:
    """
    Programmatic checks mirroring the JS frontend logic for Strategic Planning.
    Each static method validates the JSON structure for a specific analysis type.
    """
    
    @staticmethod
    def _is_list_of_strings(data: Any) -> bool:
        return isinstance(data, list) and all(isinstance(item, str) for item in data)
    
    @staticmethod
    def _check_keys(data: Dict, keys: List[str]) -> List[str]:
        return [f"Missing key: {key}" for key in keys if key not in data]

    @staticmethod
    def validate_mission_vision(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        
        for section in ["mission", "vision"]:
            errors.extend(SageValidator._check_keys(data, [section]))
            if section in data:
                sec_data = data[section]
                errors.extend(SageValidator._check_keys(sec_data, ["statement", "breakdown"]))
                if "breakdown" in sec_data and not isinstance(sec_data["breakdown"], list):
                    errors.append(f"{section}.breakdown is not a list")

        for section in ["values", "goals"]:
            if section not in data:
                errors.append(f"Missing key: {section}")
            elif not isinstance(data[section], list):
                errors.append(f"{section} is not a list")

        return errors

    @staticmethod
    def validate_factor_analysis(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        
        for factor_type in ["internal_factors", "external_factors"]:
            if factor_type not in data:
                errors.append(f"Missing key: {factor_type}")
                continue
            
            sub_categories = ["strengths", "weaknesses"] if factor_type == "internal_factors" else ["opportunities", "threats"]
            for sub_cat in sub_categories:
                if sub_cat not in data[factor_type]:
                    errors.append(f"Missing key: {factor_type}.{sub_cat}")
                    continue
                if not isinstance(data[factor_type][sub_cat], list):
                    errors.append(f"{factor_type}.{sub_cat} is not a list")
                    continue
                for item in data[factor_type][sub_cat]:
                    errors.extend(SageValidator._check_keys(item, ["factor", "category", "description", "impact_score", "analysis"]))
                    if "impact_score" in item and not (isinstance(item["impact_score"], int) and 1 <= item["impact_score"] <= 10):
                        errors.append(f"Invalid impact_score: {item.get('impact_score')}")
                    if "analysis" in item:
                        errors.extend(SageValidator._check_keys(item["analysis"], ["facts", "deductions", "conclusions", "summary"]))
        return errors

    @staticmethod
    def validate_goals_initiatives_ogsm(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        errors.extend(SageValidator._check_keys(data, ["main_objective", "goals"]))

        if "main_objective" in data and (not isinstance(data["main_objective"], str) or "[" in data["main_objective"]):
            errors.append("main_objective is not a valid string or contains placeholders.")

        if "goals" in data:
            if not isinstance(data["goals"], list) or len(data["goals"]) == 0:
                errors.append("goals is not a non-empty list.")
            else:
                for goal in data["goals"]:
                    errors.extend(SageValidator._check_keys(goal, ["goal_name", "strategies"]))
                    if "strategies" in goal and (not isinstance(goal["strategies"], list) or len(goal["strategies"]) == 0):
                        errors.append(f"strategies for goal '{goal.get('goal_name')}' is not a non-empty list.")
                    elif "strategies" in goal:
                        for strategy in goal["strategies"]:
                            errors.extend(SageValidator._check_keys(strategy, ["strategy_name", "rationale", "measures"]))
                            if "measures" in strategy and not SageValidator._is_list_of_strings(strategy["measures"]):
                                errors.append(f"measures for strategy '{strategy.get('strategy_name')}' is not a list of strings.")
        return errors

    @staticmethod
    def validate_smart_objectives(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        errors.extend(SageValidator._check_keys(data, ["main_goal", "smart_objectives"]))

        if "smart_objectives" in data:
            if not isinstance(data["smart_objectives"], list) or len(data["smart_objectives"]) == 0:
                errors.append("smart_objectives is not a non-empty list.")
            else:
                for objective in data["smart_objectives"]:
                    errors.extend(SageValidator._check_keys(objective, ["objective_name", "smart_breakdown", "key_actions", "potential_risks"]))
                    if "smart_breakdown" in objective:
                        errors.extend(SageValidator._check_keys(objective["smart_breakdown"], ["specific", "measurable", "achievable", "relevant", "time_bound"]))
                    if "key_actions" in objective and not SageValidator._is_list_of_strings(objective["key_actions"]):
                        errors.append(f"key_actions for objective '{objective.get('objective_name')}' is not a list of strings.")
                    if "potential_risks" in objective and not SageValidator._is_list_of_strings(objective["potential_risks"]):
                         errors.append(f"potential_risks for objective '{objective.get('objective_name')}' is not a list of strings.")
        return errors

    @staticmethod
    def validate_action_plan(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        errors.extend(SageValidator._check_keys(data, ["project_name", "action_items"]))

        if "action_items" in data:
            if not isinstance(data["action_items"], list):
                errors.append("action_items must be a list.")
            else:
                is_unanalyzable = "unanalyzable" in data.get("project_name", "").lower()
                if is_unanalyzable and len(data["action_items"]) > 0:
                    errors.append("action_items should be empty for unanalyzable text.")
                if not is_unanalyzable and len(data["action_items"]) == 0:
                    errors.append("action_items should not be empty for analyzable text.")
                
                for item in data["action_items"]:
                    errors.extend(SageValidator._check_keys(item, ["task_name", "description", "owner", "timeline", "priority", "resources_needed", "key_dependency", "kpis_to_track"]))
                    if "priority" in item and item["priority"] not in ["High", "Medium", "Low"]:
                        errors.append(f"Invalid priority: {item['priority']}")
        return errors
        
    @staticmethod
    def validate_kpi_research_plan(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Root is not a dictionary."]
        errors.extend(SageValidator._check_keys(data, ["main_goal", "kpi_groups", "critical_events", "performance_summary"]))

        if "kpi_groups" in data and isinstance(data["kpi_groups"], list) and len(data["kpi_groups"]) > 0:
            for group in data["kpi_groups"]:
                errors.extend(SageValidator._check_keys(group, ["construct_name", "kpis"]))
                if "kpis" in group and isinstance(group["kpis"], list) and len(group["kpis"]) > 0:
                    for kpi in group["kpis"]:
                        errors.extend(SageValidator._check_keys(kpi, ["name", "formula", "type"]))
                        if "formula" in kpi and kpi["formula"].lower() == "none":
                            errors.append(f"KPI '{kpi.get('name')}' has a 'None' formula.")
                else:
                    errors.append(f"kpis in group '{group.get('construct_name')}' is not a non-empty list.")
        elif "kpi_groups" in data:
             errors.append("kpi_groups is not a non-empty list.")

        return errors


# --- GOLDEN DATASET ---
golden_dataset = [
    {
        "id": "SP-001", "analysis_type": "mission_vision",
        "prompt_input": "Innovate Inc. is dedicated to building sustainable urban farming solutions for metropolitan areas. Our vision is a world where every city resident has access to fresh, locally-grown produce. We value sustainability, community engagement, and technological excellence. Our goal is to deploy 50 vertical farms in 5 major cities by 2030.",
        "expected_intent": "Correctly deconstructs all four strategic pillars (Mission, Vision, Values, Goals).",
        "ground_truth_summary": "The model should identify the mission related to building urban farming, the vision of city-wide access to fresh produce, the three stated values, and the specific goal of deploying 50 farms by 2030, including associated initiatives and KPIs."
    },
    {
        "id": "SP-002", "analysis_type": "factor_analysis",
        "prompt_input": "AeroCorp has a strong patent portfolio for drone technology and a highly skilled engineering team (Strength). However, our manufacturing process is inefficient and relies on a single supplier (Weakness). A new government subsidy for green tech presents a major growth avenue (Opportunity), but emerging competition from low-cost overseas manufacturers is a significant risk (Threat).",
        "expected_intent": "Identifies all four SWOT factors and performs a deep analysis on each.",
        "ground_truth_summary": "The model must find one Strength (patents/team), one Weakness (inefficient process), one Opportunity (subsidy), and one Threat (competition). For each, it must generate a full analysis object including facts, deductions, and conclusions."
    },
    {
        "id": "SP-003", "analysis_type": "goals_initiatives_ogsm",
        "prompt_input": "Our primary objective is to become the market leader in enterprise SaaS for the financial sector. We will achieve this by expanding our product suite with AI-driven analytics, enhancing our cybersecurity features to meet new compliance standards, and launching a targeted marketing campaign in the EMEA region.",
        "expected_intent": "Creates a valid OGSM framework from the text.",
        "ground_truth_summary": "The model should set the main objective to market leadership. It should then define three goals related to product expansion, security enhancement, and marketing. Each goal should have strategies and measures directly linked to the text (e.g., Strategy: 'Launch AI Analytics', Measure: 'Adoption rate of new module')."
    },
    {
        "id": "SP-004", "analysis_type": "smart_objectives",
        "prompt_input": "We need to increase our active user base by 20% over the next fiscal year. Our marketing team has the budget and a new campaign ready. This is critical for securing our next funding round. Key actions include launching the campaign, partnering with influencers, and optimizing our onboarding flow.",
        "expected_intent": "Formulates a detailed S.M.A.R.T. objective.",
        "ground_truth_summary": "The model should produce a primary S.M.A.R.T. objective. The breakdown should be: Specific (Increase active users), Measurable (20%), Achievable (budget/team ready), Relevant (securing funding), and Time-bound (next fiscal year). Key actions and potential risks should also be extracted."
    },
    {
        "id": "SP-005", "analysis_type": "action_plan",
        "prompt_input": "Our customer service response times have degraded by 40%, leading to a drop in satisfaction scores. We need to analyze the root cause, retrain the support team on new software, and implement a tiered support system. The project should be led by the Head of Operations.",
        "expected_intent": "Generates a sequential action plan for a dynamic system problem.",
        "ground_truth_summary": "The model should identify this as a dynamic problem. The action plan should include sequential steps like 'Analyze Root Cause', 'Retrain Team', and 'Implement Tiered System'. Each item must have an owner, timeline, priority, etc., derived from the context."
    },
    {
        "id": "SP-006", "analysis_type": "kpi_research_plan",
        "prompt_input": "We are researching the drivers of churn. Our main goal is to identify factors leading to customer departure. Key constructs are: SERVICE QUALITY (measured by support ticket resolution time, agent politeness on a 1-5 scale), and PRODUCT FIT (measured by feature usage frequency, user-reported satisfaction). The project timeline is 3 months.",
        "expected_intent": "Extracts KPI groups from a research context.",
        "ground_truth_summary": "The model must identify the main goal. It should create two kpi_groups: 'SERVICE QUALITY' and 'PRODUCT FIT'. The KPIs under each group must be the specific indicators (e.g., 'support ticket resolution time'), not the construct itself. Formulas should be generated (e.g., 'Time in hours', '1-5 scale')."
    }
]

# --- RUNNER ---
def run_evaluation_suite():
    """
    Main function to run the evaluation suite.
    It iterates through the golden dataset, queries the model, validates the output,
    and gets a quality score from the judge model.
    """
    results = []
    
    # Map analysis types to validator functions
    validator_map: Dict[str, Callable[[Dict], List[str]]] = {
        "mission_vision": SageValidator.validate_mission_vision,
        "factor_analysis": SageValidator.validate_factor_analysis,
        "goals_initiatives_ogsm": SageValidator.validate_goals_initiatives_ogsm,
        "smart_objectives": SageValidator.validate_smart_objectives,
        "action_plan": SageValidator.validate_action_plan,
        "kpi_research_plan": SageValidator.validate_kpi_research_plan
    }

    for item in golden_dataset:
        print(f"\n==================== RUNNING TEST ID: {item['id']} ====================")
        analysis_type = item["analysis_type"]
        
        # 1. Run Model
        model_output = query_sage_model(item["prompt_input"], analysis_type)
        if model_output.get("error"):
            validation_errors = [f"Model query failed: {model_output['error']}"]
            judge_assessment = {"quality_score": 0, "reasoning": "Model query failed"}
        else:
            # 2. Run Programmatic Validation (Pass/Fail)
            validator = validator_map.get(analysis_type)
            if not validator:
                print(f"SKIPPING - No validator found for analysis type: {analysis_type}")
                continue
                
            validation_errors = validator(model_output)
            is_valid = not bool(validation_errors)
            
            print(f"Programmatic Validation Passed: {is_valid}")
            if not is_valid:
                print("Validation Errors:")
                for error in validation_errors:
                    print(f"- {error}")

            # 3. Run LLM-as-a-Judge (Quality Score)
            # The evaluation prompt is a combination of the user prompt, the ground truth, and the LLM's output.
            judge_prompt = f"""
            User Prompt: {item['prompt_input']}\n
            Ground Truth Summary: {item['ground_truth_summary']}\n
            LLM Output: {json.dumps(model_output, indent=2)}
            """
            print(f"Prompt sent to LLM Judge: {judge_prompt}")
            judge_assessment = query_judge_model(judge_prompt)
            # judge_assessment = query_local_judge_model(judge_prompt)
        
        # 4. Report Results
        results.append({
            "id": item['id'],
            "analysis_type": analysis_type,
            "validation_passed": is_valid,
            "validation_errors": validation_errors,
            "quality_score": judge_assessment["quality_score"],
            "judge_reasoning": judge_assessment["reasoning"],
            "model_output": model_output
        })

    # --- REPORTING ---
    # Convert results to a DataFrame for easy viewing
    df = pd.DataFrame(results, columns=["id", "analysis_type", "validation_passed", "validation_errors", "quality_score", "judge_reasoning"])
    print("\n\n====================== EVALUATION SUMMARY ======================")
    print(df[['id', 'analysis_type', 'validation_passed', 'quality_score']])

    # Calculate and print aggregate scores
    avg_quality_score = df["quality_score"].mean()
    pass_rate = (df["validation_passed"].sum() / len(df)) * 100
    
    print(f"\nAverage Quality Score: {avg_quality_score:.2f} / 5.0")
    print(f"Programmatic Validation Pass Rate: {pass_rate:.2f}%")
    
    # Save detailed results to a JSON file
    json_filename = "sage_evaluation_results_sp.json"
    with open(json_filename, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to {json_filename}")

    # Save summary results to a Markdown file
    md_filename = "sage_evaluation_results_sp.md"
    # Select columns for the markdown report
    df_for_md = df[['id', 'analysis_type', 'validation_passed', 'quality_score', 'judge_reasoning']]
    with open(md_filename, "w") as f:
        f.write("# S.A.G.E. Evaluation Summary: Strategic Planning\n\n")
        f.write(f"**Average Quality Score:** {avg_quality_score:.2f} / 5.0\n")
        f.write(f"**Programmatic Validation Pass Rate:** {pass_rate:.2f}%\n\n")
        f.write(df_for_md.to_markdown(index=False))
    
    print(f"Summary results saved to {md_filename}")


if __name__ == "__main__":
    run_evaluation_suite()
