import os
import requests
import google.generativeai as genai
import json
import pandas as pd
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional

# Loads environment variables from a `.env` file.
load_dotenv()

# --- PROMPT TEMPLATES (Adapted from frontend/data2int-web/js/analysis/analysis-handling-ns.mjs) ---

PROMPT_TEMPLATES = {
    "three_horizons": """
You are an expert corporate strategist specializing in McKinsey's "Three Horizons of Growth" framework. Your task is to analyze the user's provided text and develop a structured strategic plan *strictly grounded* in that text.

**USER'S PROVIDED CONTEXT:**
\"\"\"
{prompt_text}
\"\"\"

**TASK:**
Formulate a Three Horizons plan derived *exclusively* from the details within the USER'S PROVIDED CONTEXT.

1.  **main_goal**: First, identify the primary goal explicitly stated or strongly implied in the context. Refine this into a single, clear, measurable goal statement (under 25 words) that accurately reflects the context's focus (e.g., if the context is about research, the goal should relate to using research findings).

2.  **horizons**: Create an array containing exactly three objects, one for each horizon (H1, H2, H3). For each horizon, define initiatives *only if they directly address the main_goal and are supported by specific details in the USER'S PROVIDED CONTEXT*.

    * **Horizon 1 (Core - ~0-18 Months):** Focus on optimizing or improving the *current business* described in the context. Initiatives MUST relate to elements explicitly mentioned (e.g., improving listed service quality dimensions).
    * **Horizon 2 (Adjacent - ~12-36 Months):** Focus on leveraging insights or capabilities *mentioned in the context* to build logically adjacent growth related to the main_goal (e.g., using research findings on satisfaction drivers to propose a loyalty program *if loyalty programs are implied or discussed*).
    * **Horizon 3 (Transformational - ~3-7+ Years):** Focus on exploring future options *suggested by the context* (e.g., researching long-term implications mentioned in the text).

    For *each* horizon object, provide:
    * `horizon_name`: (e.g., "Horizon 1: Optimize Core CX Research").
    * `timeframe`: (e.g., "0-18 Months").
    * `focus`: A one-sentence description of this horizon's focus *directly tied to the main_goal and the context provided*.
    * `initiatives`: An array of 1-3 specific initiatives. **CRITICAL:** If no initiatives for a specific horizon can be reasonably derived *solely from the provided context* to support the main goal, return an empty array [] for that horizon's `initiatives`. For each valid initiative:
        * `initiative_name`: Clear name (under 10 words).
        * `description`: Brief explanation *linking it directly to specific details in the context* and explaining how it supports the horizon's focus.
        * `kpis`: 2-3 specific, measurable KPIs relevant to the initiative and context.

**ABSOLUTE CONSTRAINTS (VERY IMPORTANT):**
- **NO FABRICATION:** Do NOT invent initiatives, goals, or focus areas that are not explicitly stated or logically derived from the USER'S PROVIDED CONTEXT.
- **CONTEXT IS KING:** Your entire response must be based *only* on the text provided in the "USER'S PROVIDED CONTEXT" section.
- **AVOID GENERIC STRATEGIES:** Do NOT suggest common business strategies (like 'omnichannel expansion', 'subscription models', 'AI implementation', 'sustainability drives', 'new market entry') UNLESS these concepts are *specifically mentioned* or *directly implied as goals* within the user's text. Focus only on what the text provides.
- **RESEARCH CONTEXT AWARENESS:** If the context is about a research plan (like the example text), the goal and initiatives should relate to executing that research or acting on its *hypothesized* findings, not on unrelated business expansion.

**RETURN FORMAT:**
Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields are filled according to the constraints above. Return empty arrays [] for initiatives if none are derivable from the context for a given horizon.
{{
    "main_goal": "Refined goal statement strictly derived from user context.",
    "horizons": [
    {{ // Horizon 1
        "horizon_name": "Horizon 1: ...", "timeframe": "0-18 Months", "focus": "...",
        "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
    }},
    {{ // Horizon 2
        "horizon_name": "Horizon 2: ...", "timeframe": "12-36 Months", "focus": "...",
        "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
    }},
    {{ // Horizon 3
        "horizon_name": "Horizon 3: ...", "timeframe": "3-7+ Years", "focus": "...",
        "initiatives": [ /* Initiatives derived ONLY from context or empty [] */ ]
    }}
    ]
}}
""",
    "living_system": """
You are an expert organizational strategist specializing in applying the "Living System" or "Viable System Model" principles to diagnose business health. Analyze the user's provided description *strictly* based on that context.

**USER'S SYSTEM DESCRIPTION:**
\"\"\"
{prompt_text}
\"\"\"

**TASK:**
Perform a comprehensive Living System diagnosis. Identify the health status and provide analysis for each key system component *based solely on evidence within the user's description*. Formulate specific strategic interventions to address identified weaknesses, again, grounded *only* in the provided text.

1.  **overall_diagnosis**: Provide a concise, 1-2 sentence overall assessment of the system's health and key challenges *as described by the user*.

2.  **system_analysis**: Create an array analyzing the core system components. For each component (Metabolism, Nervous System, Immune System, Growth & Adaptation):
    * system_name: The name of the component.
    * health_status: Assess the health as "Robust," "Strained," or "Fragile" *based strictly on evidence (or lack thereof) in the user's text*. If the text provides no information to judge a component, default to "Strained" and state the lack of evidence in the analysis.
    * analysis: Explain *why* you assigned that health status, citing specific examples, phrases, or lack of information *from the user's description*.

3.  **strategic_interventions**: Develop an array of 2-4 specific strategic initiatives designed *only* to address the weaknesses identified in the system_analysis section and supported by the user's context. For each initiative:
    * initiative_name: A clear, action-oriented name (under 10 words).
    * target_system: The primary system component(s) this initiative aims to improve (e.g., "Metabolism", "Nervous System").
    * rationale: Explain *how* this initiative directly addresses a weakness identified in the system_analysis, referencing the user's context.
    * action_items: List 2-3 concrete first steps to begin implementing this initiative, logically derived from the context.
    * kpis_to_track: List 2-3 specific, measurable KPIs relevant to the initiative's goal, based on the context.

**ABSOLUTE CONSTRAINTS (CRITICAL):**
- **GROUNDING:** Every diagnosis, analysis point, health status, and intervention MUST be directly traceable to specific statements or the lack of specific information within the "USER'S SYSTEM DESCRIPTION". Do NOT infer beyond the text.
- **NO FABRICATION:** Do NOT invent organizational problems, strengths, strategies, or metrics not explicitly supported by the provided text.
- **FRAMEWORK ADHERENCE:** Interpret the user's text through the lens of the Living System components (Metabolism, Nervous System, Immune System, Growth/Adaptation).
- **HEALTH STATUS JUSTIFICATION:** Clearly justify each "Robust," "Strained," or "Fragile" assessment using evidence *from the text*. If evidence is missing, state that.
- **INTERVENTION LINKAGE:** Interventions must *only* target weaknesses identified in *your* system_analysis section.

**RETURN FORMAT:**
Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields adhere strictly to the grounding constraints.
{{
    "overall_diagnosis": "Concise overall assessment based ONLY on user text.",
    "system_analysis": [
    {{
        "system_name": "Metabolism",
        "health_status": "Robust/Strained/Fragile (Justified by text)",
        "analysis": "Explanation citing specific user text or lack thereof..."
    }},
    {{
        "system_name": "Nervous System",
        "health_status": "Robust/Strained/Fragile (Justified by text)",
        "analysis": "Explanation citing specific user text or lack thereof..."
    }},
    {{
        "system_name": "Immune System", // How it handles threats/change
        "health_status": "Robust/Strained/Fragile (Justified by text)",
        "analysis": "Explanation citing specific user text or lack thereof..."
    }},
    {{
        "system_name": "Growth & Adaptation", // How it evolves/learns
        "health_status": "Robust/Strained/Fragile (Justified by text)",
        "analysis": "Explanation citing specific user text or lack thereof..."
    }}
    ],
    "strategic_interventions": [ // Only if weaknesses identified
    {{
        "initiative_name": "Initiative Name 1",
        "target_system": "System Name(s)",
        "rationale": "How this addresses a specific weakness identified above, citing text...",
        "action_items": ["Action 1.1 derived from context", "Action 1.2 derived from context"],
        "kpis_to_track": ["KPI 1.1 from context", "KPI 1.2 from context"]
    }},
    {{ /* ... 2-4 total, if applicable ... */ }}
    ]
}}
""",
    "creative_dissonance": """
You are a master strategist applying Robert Fritz's "Creative Dissonance" framework. Analyze the user's situation based *primarily* on the provided Business Context (.txt/.docx) and Data Context (.csv) files. Use the brief "Current Reality" and "Future Vision" inputs mainly for high-level framing and goal confirmation.

**ANALYSIS INPUTS:**
* **Business Context (Primary Source):** \"\"\"{business_context}\"\"\"
* **Data Context (Primary Source):** \"\"\"{data_context}\"\"\"
* **Current Reality (Framing):** {current_reality}
* **Future Vision (Framing):** {future_vision}

**TASK:**
Perform a Creative Dissonance analysis based *strictly* on the detailed information within the **Business Context** and **Data Context** files.

1.  **dissonance_points**: Identify 2-4 key thematic points of tension between the *detailed reality described in the files* and the *envisioned future described in the files (or framed by the Future Vision input)*. Phrase as "From '[Specific Reality from Files]' to '[Specific Vision from Files/Input]'".

2.  **gap_analysis**: Create an array analyzing 2-4 major gaps *identified from the files*. For each gap:
    * `theme`: Overarching theme (e.g., "Operational Scalability," "Market Penetration," "Data Infrastructure").
    * `reality_statement`: A summary of the current state for this theme, citing specific details *from the files*.
    * `vision_statement`: A summary of the desired future state for this theme, citing specific details *from the files* or aligning with the Future Vision input.
    * `gap`: A clear description of the specific discrepancy *identified from the files*.

3.  **strategic_initiatives**: Develop an array of 2-4 strategic initiatives designed *specifically* to close the gaps *identified from the files*. For each initiative:
    * `initiative_name`: Action-oriented name (under 10 words).
    * `rationale`: Explain *how* this initiative addresses a gap *identified from the files*, citing file context where possible.
    * `impact`: Potential impact ("High", "Medium", "Low").
    * `effort`: Likely effort ("High", "Medium", "Low").
    * `action_items`: 2-3 concrete first steps derived from the necessary actions suggested by the *file context*.
    * `kpis_to_track`: 2-3 specific KPIs relevant to the gap and measurable using data *suggested by the files* or standard business metrics.

**ABSOLUTE CONSTRAINTS (CRITICAL):**
- **FILE PRIORITY:** Base your ENTIRE analysis—gaps, initiatives, actions, KPIs—primarily on the **Business Context** and **Data Context** files. Use the text box inputs only for overall direction if the files lack a clear goal.
- **EVIDENCE-BASED:** Every point, gap, and initiative detail MUST be directly traceable to, or a logical necessity based on, the information *within the uploaded files*.
- **NO FABRICATION:** Do NOT invent details, challenges, solutions, or metrics not supported by the file content. If the files lack sufficient detail for a section (e.g., H3 initiatives), state that clearly or return an empty array.
- **SPECIFICITY:** Extract and use concrete details, numbers, challenges, or opportunities mentioned in the files.

**RETURN FORMAT:**
Provide ONLY a valid JSON object with the exact structure specified below. Ensure all fields reflect the file-first analysis.
{{
    "dissonance_points": [ /* Points based primarily on file details */ ],
    "gap_analysis": [ /* Gaps identified primarily from file details */ ],
    "strategic_initiatives": [ /* Initiatives addressing file-based gaps */ ]
}}
""",
    "thinking_system": """
You are an expert facilitator applying Chris Argyris' "Ladder of Inference" framework. Analyze the user's provided text, which describes a belief, conclusion, or a problematic situation resulting from a certain line of thinking. Your task is to deconstruct the likely thought process *down* the ladder and then guide a reframing *up* a potentially more constructive ladder, based *strictly* on the provided context.

**USER'S CONTEXT (Belief/Problem Description):**
\"\"\"
{prompt_text}
\"\"\"

**TASK:**
Perform a Ladder of Inference analysis grounded *exclusively* in the USER'S CONTEXT.

1.  **Infer Top Rung:** First, infer the core problematic **Action** or **Belief** described or implied at the top of the ladder within the user's context.

2.  **Deconstruction (Working DOWN the Ladder):** Based *only* on the user's context, reconstruct the likely steps leading to that top rung. For each rung below, explain *how it derives from the rung above it*, citing evidence or logical inference *from the user's text*:
    * action (The inferred problematic action/decision based on the text).
    * belief (The inferred underlying belief driving the action, derived from the text).
    * conclusion (The inferred conclusion drawn from assumptions/interpretations, based on the text).
    * assumption (Inferred assumptions made based on interpretations, drawn from the text).
    * interpretation (How selected data/observations were likely interpreted, based on the text).
    * selection (What specific data or observations from the available 'reality' were likely focused on, ignoring others, based on the text).
    * observation (The pool of observable data/reality described or implied in the user's text).

3.  **Reframing (Identifying Leverage & Building UP a New Ladder):**
    * critical_question: Formulate a challenging question that probes the assumptions or interpretations identified in the deconstruction.
    * new_observation: Suggest broadening the pool of observable data – what else *could* be observed or considered from the context?
    * new_interpretation: Offer an alternative, potentially more constructive interpretation of the (potentially broadened) observations.
    * new_conclusion: State a different conclusion that could logically follow from the new interpretation.

4.  **New Actions:** Propose 2-3 specific, actionable initiatives based on the new_conclusion. For each action:
    * action_name: Clear name (under 10 words).
    * rationale: Explain how this action stems from the reframed perspective and helps address the original problem described in the user's context.
    * steps: List 2-3 concrete first steps to implement this action.
    * kpis: List 2-3 measurable KPIs to track the effectiveness of this new action.


**ABSOLUTE CONSTRAINTS (CRITICAL):**
- **INPUT GROUNDING:** Every step of the deconstruction and reframing MUST be directly traceable to, or a logical inference *solely based upon*, the information presented in the "USER'S CONTEXT". Do NOT introduce external knowledge or assumptions.
- **NO FABRICATION:** Do NOT invent observations, interpretations, beliefs, or actions not supported by the user's text.
- **LADDER LOGIC:** Ensure a clear, step-by-step causal link when moving both down and up the ladder rungs. Explain the connection between rungs based on the context.
- **FOCUS ON THINKING:** The analysis must focus on deconstructing and reframing the *thought process*, not just listing business problems.

**RETURN FORMAT:**
Provide ONLY a valid JSON object with the exact structure specified below. Fill all fields according to the constraints, using inferences grounded *only* in the user's context.
{{
    "deconstruction": {{
    "action": "Inferred action from user text...",
    "belief": "Inferred belief from user text...",
    "conclusion": "Inferred conclusion from user text...",
    "assumption": "Inferred assumption(s) from user text...",
    "interpretation": "Inferred interpretation from user text...",
    "selection": "Inferred selected data/observations from user text...",
    "observation": "Observable reality described/implied in user text..."
    }},
    "reframing": {{
    "critical_question": "Challenging question based on deconstruction...",
    "new_observation": "Suggestion to broaden observation based on context...",
    "new_interpretation": "Alternative interpretation grounded in context...",
    "new_conclusion": "New conclusion based on alternative interpretation..."
    }},
    "new_actions": [
    {{
        "action_name": "New Action Name 1",
        "rationale": "How this follows from reframing & addresses original problem...",
        "steps": ["Step 1.1 based on context", "Step 1.2 based on context"],
        "kpis": ["KPI 1.1 relevant to context", "KPI 1.2 relevant to context"]
    }},
    {{ /* ... 1-2 more actions ... */ }}
    ]
}}
""",
    "all_frameworks": {
        "context": """**USER'S BUSINESS CONTEXT:**\n```\n{prompt_text}\n```\n**ABSOLUTE CONSTRAINTS:** Base **ALL** output **EXCLUSIVELY** on the provided "USER'S BUSINESS CONTEXT". **DO NOT** invent information.""",
        "blue_ocean": """
{context}
**TASK:** Apply the Blue Ocean Strategy "Eliminate-Reduce-Raise-Create" (ERRC) grid to the user's context. Identify 2-3 specific factors for each of the four actions **based ONLY on the text**.
**RETURN FORMAT:** Provide ONLY a valid JSON object: 
{{"eliminate": ["Factor 1 to eliminate (from text)...", "..."], "reduce": ["Factor 1 to reduce (from text)...", "..."], "raise": ["Factor 1 to raise (from text)...", "..."], "create": ["Factor 1 to create (from text)...", "..."]}}""",
        "design_thinking": """
{context}
**TASK:** Apply the 5 stages of Design Thinking to the user's context. For each stage, provide a 2-3 sentence description of the key activity or focus **based ONLY on the text**.
**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{"empathize": "Description of user/problem to empathize with (from text)...", "define": "The core problem statement to define (from text)...", "ideate": "Key areas for brainstorming solutions (from text)...", "prototype": "A potential low-fi solution to test (from text)...", "test": "How to test this prototype with users (from text)..."}}""",
        "reframing": """
{context}
**TASK:** Apply Reframing Thinking. Identify 2-3 core assumptions **from the text**. For each assumption, provide 1-2 alternative "reframes" or perspectives.
**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{"reframes": [{{"assumption": "Core assumption from text...", "alternatives": ["Alternative perspective 1...", "Alternative perspective 2..."]}}, {{"assumption": "...", "alternatives": ["..."]}}]}}""",
        "thinking_hats": """
{context}
**TASK:** Apply De Bono's Six Thinking Hats to the user's context. Provide 1-2 key points for each hat **based ONLY on the text**.
**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{"white_hat": "Facts & data mentioned in text...", "red_hat": "Feelings or emotions implied in text...", "black_hat": "Risks or cautions mentioned in text...", "yellow_hat": "Benefits or positives mentioned in text...", "green_hat": "Creative ideas or opportunities from text...", "blue_hat": "Process or 'next step' summary from text..."}}""",
        "creative_dissonance": """
{context}
**TASK:** Apply Creative Dissonance. Identify the `current_reality` (problem) and the `future_vision` (goal) **from the text**. Then, list 2-3 key `tension_points` (gaps) between them.
**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{"current_reality": "The main problem/situation from text...", "future_vision": "The main goal/aspiration from text...", "tension_points": ["Gap 1...", "Gap 2..."]}}""",
        "ladder_of_inference": """
{context}
**TASK:** Apply the Ladder of Inference. Identify a core `belief_or_action` **from the text**. Deconstruct it into `observations`, `interpretations`, and `assumptions` **from the text**.
**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{"belief_or_action": "The core conclusion from text...", "deconstruction": {{"observations": "What data is seen in text...", "interpretations": "How that data is interpreted in text...", "assumptions": "Underlying assumptions from text..."}}}}""",
        "synthesis": """
You are a master strategist. You have just run 6 different strategic frameworks on a business problem. Now, synthesize all these findings into a cohesive analysis.

**ANALYSIS INPUTS:**
{synthesis_context}

**TASK:**
Generate a synthesis of all 6 framework outputs.
1.  **`strategic_narrative`**: Write a 3-4 sentence narrative summarizing the core problem and the overall strategic direction suggested by all frameworks combined.
2.  **`top_insights`**: Identify the 3-5 most critical insights that appeared across multiple frameworks (e.g., a "Black Hat" risk that is also a "Weakness" in the dissonance gap).
3.  **`primary_leverage_point`**: What is the single most powerful area for intervention, as suggested by the frameworks?
4.  **`priority_actions`**: List the top 3-4 specific, actionable "first steps" that synthesize the recommendations from all frameworks.

**RETURN FORMAT:** Provide ONLY a valid JSON object:
{{
    "strategic_narrative": "...",
    "top_insights": ["Insight 1...", "Insight 2...", "Insight 3..."],
    "primary_leverage_point": "The single most critical point of intervention is...",
    "priority_actions": ["Action 1...", "Action 2...", "Action 3..."]
}}"""
    }
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

    # Handle the multi-step "all_frameworks" analysis
    if analysis_type == "all_frameworks":
        framework_prompts = PROMPT_TEMPLATES["all_frameworks"]
        base_context = framework_prompts["context"].format(prompt_text=prompt_text)
        
        results = {}
        framework_keys = ["blue_ocean", "design_thinking", "reframing", "thinking_hats", "creative_dissonance", "ladder_of_inference"]

        for key in framework_keys:
            print(f"--- Running sub-analysis: {key} ---")
            prompt = framework_prompts[key].format(context=base_context)
            response = call_ollama(prompt, ollama_url, model_name)
            if "error" in response:
                return response # Abort on first error
            results[key] = response
        
        print("--- Running final analysis: synthesis ---")
        synthesis_context = f"""
**CONTEXT:** {str(prompt_text)[:1000]}...
**Blue Ocean ERRC:** {json.dumps(results.get('blue_ocean'))}
**Design Thinking:** {json.dumps(results.get('design_thinking'))}
**Reframing:** {json.dumps(results.get('reframing'))}
**Thinking Hats:** {json.dumps(results.get('thinking_hats'))}
**Creative Dissonance:** {json.dumps(results.get('creative_dissonance'))}
**Ladder of Inference:** {json.dumps(results.get('ladder_of_inference'))}
"""
        synthesis_prompt = framework_prompts["synthesis"].format(synthesis_context=synthesis_context)
        synthesis_response = call_ollama(synthesis_prompt, ollama_url, model_name)
        if "error" in synthesis_response:
            return synthesis_response
        
        results["synthesis"] = synthesis_response
        return results

    # Handle "creative_dissonance" which expects a dictionary prompt
    elif analysis_type == "creative_dissonance":
        if not isinstance(prompt_text, dict):
            return {"error": "prompt_text for creative_dissonance must be a dictionary."}
        template = PROMPT_TEMPLATES[analysis_type]
        prompt = template.format(
            current_reality=prompt_text.get("currentReality", ""),
            future_vision=prompt_text.get("futureVision", ""),
            business_context=prompt_text.get("businessContext", "Not provided."),
            data_context=prompt_text.get("dataContext", "Not provided.")
        )
        return call_ollama(prompt, ollama_url, model_name)

    # Handle all other standard, single-prompt analyses
    else:
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
    1. "quality_score": An integer from 1 to 5, where 1 is poor and 5 is excellent.
    2. "reasoning": A brief, one or two-sentence explanation for your score.

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
    Programmatic checks mirroring the JS frontend logic for Novel Strategies.
    Each static method validates the JSON structure for a specific analysis type.
    """

    @staticmethod
    def _is_list_of_strings(data: Any) -> bool:
        return isinstance(data, list) and all(isinstance(item, str) for item in data)

    @staticmethod
    def validate_three_horizons(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data.get("main_goal"), str) or not data["main_goal"]:
            errors.append("`main_goal` must be a non-empty string.")
        
        horizons = data.get("horizons")
        if not isinstance(horizons, list) or len(horizons) != 3:
            errors.append("`horizons` must be an array with exactly 3 objects.")
            return errors

        for i, h in enumerate(horizons):
            if not isinstance(h, dict):
                errors.append(f"Horizon {i+1} must be an object.")
                continue
            for key in ["horizon_name", "timeframe", "focus", "initiatives"]:
                if key not in h:
                    errors.append(f"Horizon {i+1} is missing required key: `{key}`.")
            
            if not isinstance(h.get("initiatives"), list):
                errors.append(f"Horizon {i+1} `initiatives` must be an array.")
                continue

            for j, init in enumerate(h["initiatives"]):
                if not isinstance(init, dict):
                    errors.append(f"Initiative {j+1} in Horizon {i+1} must be an object.")
                    continue
                for key in ["initiative_name", "description", "kpis"]:
                    if key not in init:
                        errors.append(f"Initiative {j+1} in Horizon {i+1} is missing key: `{key}`.")
                if not SageValidator._is_list_of_strings(init.get("kpis", [])):
                     errors.append(f"KPIs in Initiative {j+1}, Horizon {i+1} must be a list of strings.")
        return errors

    @staticmethod
    def validate_living_system(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data.get("overall_diagnosis"), str) or not data["overall_diagnosis"]:
            errors.append("`overall_diagnosis` must be a non-empty string.")

        system_analysis = data.get("system_analysis")
        if not isinstance(system_analysis, list) or len(system_analysis) != 4:
            errors.append("`system_analysis` must be an array with exactly 4 objects.")
        else:
            expected_systems = {"Metabolism", "Nervous System", "Immune System", "Growth & Adaptation"}
            found_systems = {s.get("system_name") for s in system_analysis if isinstance(s, dict)}
            if found_systems != expected_systems:
                errors.append(f"Missing or incorrect system names in `system_analysis`. Expected {expected_systems}, found {found_systems}.")
            
            for i, s in enumerate(system_analysis):
                 if not isinstance(s.get("health_status"), str) or s.get("health_status") not in ["Robust", "Strained", "Fragile"]:
                     errors.append(f"System {i+1} `health_status` must be 'Robust', 'Strained', or 'Fragile'.")
                 if not isinstance(s.get("analysis"), str):
                     errors.append(f"System {i+1} `analysis` must be a string.")

        if not isinstance(data.get("strategic_interventions"), list):
            errors.append("`strategic_interventions` must be a list.")
        else:
            for i, si in enumerate(data["strategic_interventions"]):
                if not isinstance(si, dict):
                    errors.append(f"Intervention {i+1} must be an object.")
                    continue
                for key in ["initiative_name", "target_system", "rationale", "action_items", "kpis_to_track"]:
                    if key not in si:
                         errors.append(f"Intervention {i+1} missing key: `{key}`.")
                if not SageValidator._is_list_of_strings(si.get("action_items",[])):
                    errors.append(f"Intervention {i+1} `action_items` must be a list of strings.")
                if not SageValidator._is_list_of_strings(si.get("kpis_to_track",[])):
                    errors.append(f"Intervention {i+1} `kpis_to_track` must be a list of strings.")
        return errors

    @staticmethod
    def validate_creative_dissonance(data: Dict) -> List[str]:
        errors = []
        if not SageValidator._is_list_of_strings(data.get("dissonance_points")):
            errors.append("`dissonance_points` must be an array of strings.")
        
        if not isinstance(data.get("gap_analysis"), list):
            errors.append("`gap_analysis` must be a list.")
        else:
            for i, gap in enumerate(data["gap_analysis"]):
                if not isinstance(gap, dict): 
                    errors.append(f"Gap {i+1} must be an object.")
                    continue
                for key in ["theme", "reality_statement", "vision_statement", "gap"]:
                    if not isinstance(gap.get(key), str):
                        errors.append(f"Gap {i+1} key `{key}` must be a string.")

        if not isinstance(data.get("strategic_initiatives"), list):
            errors.append("`strategic_initiatives` must be a list.")
        else:
            for i, si in enumerate(data["strategic_initiatives"]):
                if not isinstance(si, dict):
                    errors.append(f"Initiative {i+1} must be an object.")
                    continue
                if not isinstance(si.get("impact"), str) or si.get("impact") not in ["High", "Medium", "Low"]:
                    errors.append(f"Initiative {i+1} `impact` must be 'High', 'Medium', or 'Low'.")
                if not isinstance(si.get("effort"), str) or si.get("effort") not in ["High", "Medium", "Low"]:
                    errors.append(f"Initiative {i+1} `effort` must be 'High', 'Medium', or 'Low'.")
                if not SageValidator._is_list_of_strings(si.get("action_items",[])):
                    errors.append(f"Initiative {i+1} `action_items` must be a list of strings.")
                if not SageValidator._is_list_of_strings(si.get("kpis_to_track",[])):
                    errors.append(f"Initiative {i+1} `kpis_to_track` must be a list of strings.")
        return errors
        
    @staticmethod
    def validate_thinking_system(data: Dict) -> List[str]:
        errors = []
        deconstruction = data.get("deconstruction")
        if not isinstance(deconstruction, dict):
            errors.append("`deconstruction` must be an object.")
        else:
            for key in ["action", "belief", "conclusion", "assumption", "interpretation", "selection", "observation"]:
                if not isinstance(deconstruction.get(key), str):
                    errors.append(f"`deconstruction` is missing or has an invalid type for key: `{key}`.")

        reframing = data.get("reframing")
        if not isinstance(reframing, dict):
            errors.append("`reframing` must be an object.")
        else:
            for key in ["critical_question", "new_observation", "new_interpretation", "new_conclusion"]:
                if not isinstance(reframing.get(key), str):
                    errors.append(f"`reframing` is missing or has an invalid type for key: `{key}`.")
        
        new_actions = data.get("new_actions")
        if not isinstance(new_actions, list):
            errors.append("`new_actions` must be a list.")
        else:
            for i, action in enumerate(new_actions):
                if not isinstance(action, dict):
                    errors.append(f"Action {i+1} in `new_actions` must be an object.")
                    continue
                for key in ["action_name", "rationale"]:
                     if not isinstance(action.get(key), str):
                        errors.append(f"Action {i+1} has an invalid type for key: `{key}`.")
                if not SageValidator._is_list_of_strings(action.get("steps")):
                    errors.append(f"Action {i+1} `steps` must be a list of strings.")
                if not SageValidator._is_list_of_strings(action.get("kpis")):
                    errors.append(f"Action {i+1} `kpis` must be a list of strings.")
        return errors
        
    @staticmethod
    def _validate_sub_blue_ocean(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        for key in ["eliminate", "reduce", "raise", "create"]:
            if not SageValidator._is_list_of_strings(data.get(key)):
                errors.append(f"Key `{key}` in `{parent_key}` must be a list of strings.")
        return errors

    @staticmethod
    def _validate_sub_design_thinking(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        for key in ["empathize", "define", "ideate", "prototype", "test"]:
            if not isinstance(data.get(key), str):
                errors.append(f"Key `{key}` in `{parent_key}` must be a string.")
        return errors

    @staticmethod
    def _validate_sub_reframing(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
             return [f"`{parent_key}` must be an object."]
        reframes = data.get("reframes")
        if not isinstance(reframes, list):
            return [f"`reframes` in `{parent_key}` must be a list."]
        for i, reframe in enumerate(reframes):
            if not isinstance(reframe, dict):
                errors.append(f"Reframe {i+1} in `{parent_key}` must be an object.")
                continue
            if not isinstance(reframe.get("assumption"), str):
                errors.append(f"Reframe {i+1} `assumption` in `{parent_key}` must be a string.")
            if not SageValidator._is_list_of_strings(reframe.get("alternatives")):
                errors.append(f"Reframe {i+1} `alternatives` in `{parent_key}` must be a list of strings.")
        return errors

    @staticmethod
    def _validate_sub_thinking_hats(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        for key in ["white_hat", "red_hat", "black_hat", "yellow_hat", "green_hat", "blue_hat"]:
            if not isinstance(data.get(key), str):
                errors.append(f"Key `{key}` in `{parent_key}` must be a string.")
        return errors

    @staticmethod
    def _validate_sub_creative_dissonance(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        if not isinstance(data.get("current_reality"), str):
            errors.append(f"`current_reality` in `{parent_key}` must be a string.")
        if not isinstance(data.get("future_vision"), str):
            errors.append(f"`future_vision` in `{parent_key}` must be a string.")
        if not SageValidator._is_list_of_strings(data.get("tension_points")):
            errors.append(f"`tension_points` in `{parent_key}` must be a list of strings.")
        return errors

    @staticmethod
    def _validate_sub_ladder_of_inference(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        if not isinstance(data.get("belief_or_action"), str):
            errors.append(f"`belief_or_action` in `{parent_key}` must be a string.")
        deconstruction = data.get("deconstruction")
        if not isinstance(deconstruction, dict):
            errors.append(f"`deconstruction` in `{parent_key}` must be an object.")
        else:
            for key in ["observations", "interpretations", "assumptions"]:
                if not isinstance(deconstruction.get(key), str):
                    errors.append(f"Key `{key}` in `{parent_key}` deconstruction must be a string.")
        return errors
        
    @staticmethod
    def _validate_sub_synthesis(data: Any, parent_key: str) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return [f"`{parent_key}` must be an object."]
        if not isinstance(data.get("strategic_narrative"), str):
            errors.append(f"`strategic_narrative` in `{parent_key}` must be a string.")
        if not isinstance(data.get("primary_leverage_point"), str):
            errors.append(f"`primary_leverage_point` in `{parent_key}` must be a string.")
        if not SageValidator._is_list_of_strings(data.get("top_insights")):
            errors.append(f"`top_insights` in `{parent_key}` must be a list of strings.")
        if not SageValidator._is_list_of_strings(data.get("priority_actions")):
            errors.append(f"`priority_actions` in `{parent_key}` must be a list of strings.")
        return errors

    @staticmethod
    def validate_all_frameworks(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict):
            return ["Root response must be an object."]

        framework_validators = {
            "blue_ocean": SageValidator._validate_sub_blue_ocean,
            "design_thinking": SageValidator._validate_sub_design_thinking,
            "reframing": SageValidator._validate_sub_reframing,
            "thinking_hats": SageValidator._validate_sub_thinking_hats,
            "creative_dissonance": SageValidator._validate_sub_creative_dissonance,
            "ladder_of_inference": SageValidator._validate_sub_ladder_of_inference,
            "synthesis": SageValidator._validate_sub_synthesis,
        }

        for key, validator in framework_validators.items():
            if key not in data:
                errors.append(f"Missing required top-level key: `{key}`.")
            else:
                errors.extend(validator(data.get(key), key))
        
        return errors

# --- GOLDEN DATASET ---
# This dataset contains realistic examples for evaluating the model.
# Each entry defines a user scenario, the type of analysis, and the expected intent.
golden_dataset = [
    {
        "id": "NS-001",
        "analysis_type": "three_horizons",
        "prompt_input": "Our company has just completed a major 2-year research project into customer satisfaction drivers in the enterprise software space. The report identifies that 'integration support' and 'data security' are the two most critical factors. It also suggests our current support model is not scalable. We need a plan to act on these findings.",
        "expected_intent": "The model should generate a Three Horizons plan where H1 focuses on improving current support and security, H2 explores adjacent services based on these strengths, and H3 considers future business models derived from being a leader in support/security.",
        "ground_truth_summary": "Ideal answer links H1 initiatives directly to 'integration support' and 'data security'. The main goal should be about leveraging the research findings, not generic business growth."
    },
    {
        "id": "NS-002",
        "analysis_type": "living_system",
        "prompt_input": "Core Identity: We are a fast-moving startup aiming to disrupt the logistics industry with real-time tracking. Environment: Highly competitive with large incumbents. Metabolism: Our core product development is fast, but sales and marketing are slow to capitalize on new features. Nervous System: Communication between the engineering team and the sales team is almost non-existent. Sales finds out about features after they are launched.",
        "expected_intent": "The diagnosis must identify the 'Nervous System' as 'Strained' or 'Fragile' due to the communication gap. Interventions should directly target improving the information flow between engineering and sales.",
        "ground_truth_summary": "A good response correctly pinpoints the inter-departmental communication failure as the primary weakness and suggests concrete interventions like regular sync meetings or internal release notes."
    },
    {
        "id": "NS-003",
        "analysis_type": "creative_dissonance",
        "prompt_input": {
            "currentReality": "We are a small non-profit providing after-school coding classes in our local community, funded entirely by unpredictable local government grants.",
            "futureVision": "We want to become a nationally recognized organization with a self-sustaining funding model that impacts thousands of students per year.",
            "businessContext": "Our curriculum is highly rated by students. We have a waitlist in our local area. However, our reliance on grants means we cannot plan more than a year ahead.",
            "dataContext": "Annual Revenue: $50k (95% from grants). Students served: 100/year. Waitlist: 250 students."
        },
        "expected_intent": "The analysis should identify the core tension between the grant-funded reality and the self-sustaining vision. Initiatives must focus on creating new, scalable revenue streams (e.g., corporate partnerships, fee-for-service models) based on the stated strength (highly-rated curriculum).",
        "ground_truth_summary": "The analysis should be grounded in the provided files. Strategic initiatives should propose concrete ways to close the gap, like creating a paid corporate training program using the existing curriculum."
    },
    {
        "id": "NS-004",
        "analysis_type": "thinking_system",
        "prompt_input": "Our project is constantly missing deadlines. My conclusion is that the engineering team is too slow and unmotivated. We've tried adding more status meetings to fix this, but it hasn't helped. The last project was a month late and the one before that was six weeks late.",
        "expected_intent": "The model should deconstruct the user's thinking, identifying the 'observation' (missed deadlines), the 'interpretation' (team is slow), and the 'conclusion/action' (add meetings). The reframing should challenge the interpretation and suggest new actions beyond just more meetings.",
        "ground_truth_summary": "A good response correctly identifies the rungs of the ladder and proposes a 'new observation' like 'investigate root causes of delays' and a 'new action' like 'conduct a project retrospective'."
    },
    {
        "id": "NS-005",
        "analysis_type": "all_frameworks",
        "prompt_input": "We are a local bookstore. Our sales have been declining as more people buy books online. We have a loyal customer base that loves our curated selections and in-store events, but our online presence is minimal and we still rely on manual inventory tracking.",
        "expected_intent": "The model should generate outputs for all 6 frameworks and a synthesis. For example, Blue Ocean should suggest creating unique experiences online can't offer. Design Thinking should focus on the loyal customers. The synthesis should identify 'leveraging community' as the key leverage point.",
        "ground_truth_summary": "The final output should be a complete JSON with all 7 parts. The synthesis should correctly identify the core themes from the other 6 analyses, such as the conflict between the strong community and weak digital presence."
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
    validator_map = {
        "three_horizons": SageValidator.validate_three_horizons,
        "living_system": SageValidator.validate_living_system,
        "creative_dissonance": SageValidator.validate_creative_dissonance,
        "thinking_system": SageValidator.validate_thinking_system,
        "all_frameworks": SageValidator.validate_all_frameworks,
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
    
    # Save detailed results to a file
    filename = "sage_evaluation_results_ns.json"
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed results saved to {filename}")


if __name__ == "__main__":
    run_evaluation_suite()
