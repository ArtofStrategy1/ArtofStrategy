import os
import requests
import google.generativeai as genai
import json
import pandas as pd
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional

# Loads environment variables from a `.env` file.
load_dotenv()

# --- PROMPT TEMPLATES ---
PROMPT_TEMPLATES = {
    "process_mapping": """
        You are an expert business process analyst. Analyze the following process description provided by the user and model it comprehensively. Focus on identifying bottlenecks and suggesting concrete optimizations based *only* on the provided text.

        **USER'S PROCESS DESCRIPTION:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Process Definition:** Define a clear `process_name` based on the description.
        2.  **Identify Steps (8-12 steps):** Extract the sequential steps. For each step, provide:
            * `id`: A unique sequential number (1, 2, 3...).
            * `name`: A concise action-oriented name (2-5 words).
            * `description`: A brief explanation of the step based on the context.
            * `owner`: The role or department responsible, as mentioned or implied in the context.
            * `type`: Classify as "Start", "Task", "Decision", "End", or "Sub-process" based on context.
        3.  **Define Connections:** Specify the flow between steps. For each connection:
            * `from`: The ID of the source step.
            * `to`: The ID of the target step.
            * `label`: The condition or transition (e.g., "Next", "Yes", "No", "Approved", "Rejected"), inferred from context.
        4.  **Identify Bottlenecks (2-3 bottlenecks):** Pinpoint specific steps or transitions that appear inefficient, slow, or problematic based *only* on the description. For each bottleneck:
            * `step_name`: The name of the bottleneck step (or transition description like "Handover from Sales to Ops").
            * `reason`: A detailed explanation *citing evidence from the context* why it's considered a bottleneck (e.g., "Context mentions manual data entry here", "Description implies waiting time", "Multiple approvals required as stated in text").
        5.  **Suggest Optimizations (2-3 suggestions):** For the identified bottlenecks or other inefficient steps described, propose specific improvements. For each optimization:
            * `target_step_name`: The step the optimization applies to.
            * `suggestion`: A clear description of the proposed change (e.g., "Automate data entry", "Implement parallel processing", "Simplify approval workflow").
            * `rationale`: Explain *how* this optimization addresses the inefficiency *described in the context*.
            * `type`: Categorize the optimization (e.g., "Automation", "Simplification", "Parallelization", "Standardization", "Resource Allocation").
        6.  **Recommend KPIs (4-5 KPIs):** Suggest relevant Key Performance Indicators to measure the process's efficiency and effectiveness, based on the context. For each KPI:
            * `name`: Name of the KPI (e.g., "Cycle Time").
            * `description`: What it measures specifically in relation to this process.

        7.  **Self-Correction:** Before outputting JSON, rigorously check: Is every piece of information (steps, owners, types, connections, bottlenecks, reasons, optimizations, KPIs) derived *solely* from the user's text? Are connections logical? Are bottleneck reasons and optimization rationales explicitly linked to the text? Is the JSON structure perfect? Fix all errors.

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT GROUNDING:** All output MUST be based *exclusively* on the provided PROCESS DESCRIPTION. Do NOT invent steps, roles, bottlenecks, or optimizations not supported by the text.
        - **SPECIFICITY:** Be specific in descriptions, reasons, and rationales, referencing the context where possible.
        - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys and sub-keys.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
        {{
            "process_name": "Example: Customer Order Fulfillment",
            "steps": [
            {{"id": 1, "name": "Receive Order", "description": "System receives order via web form.", "owner": "System/Sales", "type": "Start"}},
            {{"id": 2, "name": "Check Inventory", "description": "Warehouse staff manually check stock levels.", "owner": "Warehouse", "type": "Task"}},
            {{"id": 3, "name": "Stock Available?", "description": "Decision based on inventory check.", "owner": "Warehouse", "type": "Decision"}},
            {{"id": 4, "name": "Allocate Stock", "description": "If available, reserve items.", "owner": "Warehouse", "type": "Task"}},
            {{"id": 5, "name": "Notify Backorder", "description": "If unavailable, inform customer.", "owner": "Customer Service", "type": "Task"}},
            {{"id": 6, "name": "Pack Order", "description": "Warehouse packs the allocated items.", "owner": "Warehouse", "type": "Task"}},
            {{"id": 7, "name": "Ship Order", "description": "Logistics arranges shipment.", "owner": "Logistics", "type": "Task"}},
            {{"id": 8, "name": "Send Confirmation", "description": "System sends shipping confirmation.", "owner": "System", "type": "Task"}},
            {{"id": 9, "name": "Process Complete", "description": "Order fulfillment cycle ends.", "owner": "System", "type": "End"}}
            ],
            "connections": [
            {{"from": 1, "to": 2, "label": "Next"}},
            {{"from": 2, "to": 3, "label": "Next"}},
            {{"from": 3, "to": 4, "label": "Yes"}},
            {{"from": 3, "to": 5, "label": "No"}},
            {{"from": 4, "to": 6, "label": "Next"}},
            {{"from": 5, "to": 9, "label": "End Cycle"}},
            {{"from": 6, "to": 7, "label": "Ready to Ship"}},
            {{"from": 7, "to": 8, "label": "Shipped"}},
            {{"from": 8, "to": 9, "label": "Confirmed"}}
            ],
            "bottlenecks": [
            {{"step_name": "Check Inventory", "reason": "Context states 'Warehouse staff manually check stock levels', indicating a slow, error-prone step compared to automated checks."}},
            {{"step_name": "Handover from Warehouse to Logistics", "reason": "The description implies a potential delay between packing ('Pack Order') and shipping ('Ship Order') without specifying a clear trigger or SLA, suggesting a possible bottleneck."}}
            ],
            "optimizations": [
            {{
                "target_step_name": "Check Inventory",
                "suggestion": "Implement a real-time inventory management system.",
                "rationale": "Replaces the slow 'manual check' mentioned in the context with an automated system, reducing errors and speeding up the decision at step 3 ('Stock Available?').",
                "type": "Automation"
            }},
            {{
                "target_step_name": "Pack Order / Ship Order Transition",
                "suggestion": "Establish automated notification from Warehouse to Logistics upon packing completion.",
                "rationale": "Addresses the implied delay between steps 6 and 7 by creating a clear trigger, potentially reducing wait time as suggested by the lack of explicit connection in the description.",
                "type": "Process Improvement/Automation"
            }}
            ],
            "kpis": [
            {{"name": "Order Cycle Time", "description": "Total time from 'Receive Order' (Step 1) to 'Send Confirmation' (Step 8)."}},
            {{"name": "Inventory Check Time", "description": "Time taken specifically for the 'Check Inventory' step (Step 2)."}},
            {{"name": "Picking and Packing Time", "description": "Time taken for 'Allocate Stock' and 'Pack Order' (Steps 4 & 6)."}},
            {{"name": "On-Time Shipment Rate", "description": "Percentage of orders shipped by the promised date."}},
            {{"name": "Order Accuracy Rate", "description": "Percentage of orders shipped without errors (correct items, quantity)."}}
            ]
        }}
    """,
    "pareto_fishbone": """
        You are an expert quality management and process improvement consultant. Analyze the user's provided problem description using the Fishbone (Ishikawa) diagram and Pareto Principle (80/20 rule). Infer plausible causes and impacts based *only* on the context provided.

        **USER'S PROBLEM DESCRIPTION:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Problem Statement:** Clearly define the central `problem_statement` being analyzed, derived from the context.
        2.  **Fishbone Analysis:** Identify potential root causes categorized under the 6 standard Ms. For each category (Methods, Machines, Materials, Manpower, Measurement, Environment), list 2-4 specific sub-causes (2-5 words each) *inferred solely from the problem description*. If context doesn't suggest causes for a category, return an empty array for it.
        3.  **Pareto Analysis:** Based *only* on the inferred sub-causes and the problem context:
            * Estimate a plausible relative `impact_score` (percentage, summing to 100) for each identified sub-cause, reflecting its likely contribution to the main problem statement based on the context.
            * Categorize these causes into:
                * `vital_few`: The top ~20% of causes contributing to ~80% of the impact. Include cause name, estimated impact_score, and fishbone category.
                * `useful_many`: The remaining causes. Include cause name, estimated impact_score, and fishbone category.
            * Provide an `analysis_summary` explaining how the vital few dominate the impact, according to the 80/20 principle, based on your estimations.
        4.  **Action Plan (Focus on Vital Few):** Generate an array of 2-3 structured actions targeting the identified `vital_few` causes. For each action:
            * `target_cause`: The specific vital few cause being addressed.
            * `action_suggestion`: A concrete, actionable step to mitigate this cause (e.g., "Implement standardized training", "Upgrade specific software module").
            * `rationale`: Explain *how* this action addresses the target cause, referencing the problem context if possible.
            * `potential_impact`: Estimate the potential impact on the main problem (High, Medium, Low).
        5.  **Self-Correction:** Before outputting JSON, rigorously check: Is the problem statement accurate? Are all fishbone sub-causes derived *only* from the text? Are impact scores plausible estimations based on context? Does the Pareto categorization correctly reflect the 80/20 split based on *your estimated scores*? Does the action plan focus *only* on the vital few? Is the JSON structure perfect? Fix all errors.

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT GROUNDING:** All analysis (problem, causes, impacts, actions) MUST be based *exclusively* on the USER'S PROBLEM DESCRIPTION. Do NOT invent information.
        - **PLAUSIBLE ESTIMATION:** Impact scores are estimations based on context, not precise calculations, but should be logical and sum to 100.
        - **JSON FORMAT:** Adhere EXACTLY. Include ALL specified keys and sub-keys. Use standard 6M fishbone categories.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object. **CRITICAL: Include ALL keys specified below.**
        {{
        "problem_statement": "e.g., Low Customer Satisfaction Scores",
        "fishbone": {{
            "Methods": ["Sub-cause inferred from text 1", "Sub-cause inferred from text 2"],
            "Machines": ["Sub-cause inferred from text 3"],
            "Materials": [],
            "Manpower": ["Sub-cause inferred from text 4", "Sub-cause inferred from text 5"],
            "Measurement": ["Sub-cause inferred from text 6"],
            "Environment": ["Sub-cause inferred from text 7"]
        }},
        "pareto_analysis": {{
            "vital_few": [
            {{"cause": "Sub-cause inferred from text 4", "impact_score": 45, "category": "Manpower"}},
            {{"cause": "Sub-cause inferred from text 1", "impact_score": 30, "category": "Methods"}}
            ],
            "useful_many": [
            {{"cause": "Sub-cause inferred from text 6", "impact_score": 10, "category": "Measurement"}},
            {{"cause": "Sub-cause inferred from text 3", "impact_score": 8, "category": "Machines"}},
            {{"cause": "Sub-cause inferred from text 2", "impact_score": 5, "category": "Methods"}},
            {{"cause": "Sub-cause inferred from text 5", "impact_score": 1, "category": "Manpower"}},
            {{"cause": "Sub-cause inferred from text 7", "impact_score": 1, "category": "Environment"}}
            ],
            "analysis_summary": "Explanation of 80/20 finding based on estimations (e.g., 'The analysis suggests that 'Sub-cause 4' and 'Sub-cause 1' collectively account for an estimated 75% of the impact... у')"
        }},
        "action_plan": [
            {{
            "target_cause": "Sub-cause inferred from text 4",
            "action_suggestion": "e.g., Develop targeted training program",
            "rationale": "Addresses the primary driver identified (Manpower issue mentioned in context) by...",
            "potential_impact": "High"
            }},
            {{
            "target_cause": "Sub-cause inferred from text 1",
            "action_suggestion": "e.g., Standardize process documentation",
            "rationale": "Tackles the second major contributor (Methods issue described as...) by...",
            "potential_impact": "High"
            }}
        ]
        }}
    """,
    "system_thinking": """
        You are a master systems thinking analyst. Your task is to intelligently analyze the provided text and extract its systemic components.
        You MUST first determine the text's *intent*.
        - If the text is a **research plan or hypothesis list** (e.g., "H1: X -> Y", "Our study will..."), your job is to map *that* model. You will find causal_links and focus_areas. In this case, feedback_loops MUST be an empty array [] and system_archetype MUST be null.
        - If the text is a **dynamic system problem** (e.g., "Sales are up but quality is down..."), your job is to find the problem's structure. You will find feedback_loops, causal_links (for those loops), a system_archetype, and leverage_points. In this case, focus_areas MUST be null.
        
        Analyze the text and return ONLY a valid JSON object based on what you find.
        **USER'S TEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Ground all answers *strictly* in the text):
        1.  **Summary (`summary`):** A concise summary explaining *what the text is* (a research plan, a problem, etc.) and its main objective.
        2.  **Elements (`elements`):** Extract 5-8 key system elements/constructs. For each:
            * `name`: Concise name (e.g., "Sales", "Customer Satisfaction").
            * `type`: Classify as "Stock" (an accumulation) or "Variable" (a factor, state, or flow).
        3.  **Feedback Loops (`feedback_loops`):** Identify any *circular* reinforcing (R) or balancing (B) loops *if they are explicitly described*. If the text is a linear hypothesis model, this MUST be an empty array [].
        4.  **Causal Links (`causal_links`):** List ALL 1-to-1 causal links *stated in the text* (e.g., from hypotheses H1-H7, or from loop descriptions). For each link:
            * `from`: The name of the cause element.
            * `to`: The name of the effect element.
            * `polarity`: "+" or "-".
            * `loop_name`: The loop name (e.g., "R1", "B1") or "H" (for Hypothesis).
            * `description`: The rationale/hypothesis from the text (e.g., "H1: ...").
        5.  **System Archetype (`system_archetype`):** If the text describes a dynamic problem, identify the dominant archetype (e.g., "Limits to Growth"). If it is a research plan, this MUST be null.
        6.  **Leverage Points (`leverage_points`):** If it is a dynamic problem, identify 3-4 problem-solving interventions, ranked by "High", "Medium", "Low" impact. If it is a research plan, this MUST be null.
        7.  **Focus Areas (`focus_areas`):** If it is a research plan, extract the key research questions or goals from the text. If it is a dynamic problem, this MUST be null.

        **ABSOLUTE CONSTRAINTS:**
        - **NO HALLUCINATION:** Do NOT invent feedback loops, archetypes, or leverage points if the text is a research plan.
        - **STICK TO CONTEXT:** All output MUST be based *exclusively* on the provided text.
        - **JSON FORMAT:** Adhere EXACTLY.

        **RETURN FORMAT (Example for a RESEARCH PLAN):**
        {{
            "summary": "This is a research plan to understand hypothesized drivers of loyalty (Service Quality, etc.) using SEM to guide a 3-year roadmap.",
            "elements": [
            {{"name": "Service Quality", "type": "Variable"}}, {{"name": "Product Quality", "type": "Variable"}}, {{"name": "Brand Trust", "type": "Stock"}},
            {{"name": "Customer Satisfaction", "type": "Variable"}}, {{"name": "Customer Loyalty", "type": "Stock"}}
            ],
            "feedback_loops": [],
            "causal_links": [
            {{"from": "Service Quality", "to": "Customer Satisfaction", "polarity": "+", "loop_name": "H", "description": "H1: Service Quality positively influences Customer Satisfaction"}},
            {{"from": "Product Quality", "to": "Customer Satisfaction", "polarity": "+", "loop_name": "H", "description": "H2: Product Quality positively influences Customer Satisfaction"}}
            ],
            "system_archetype": null,
            "leverage_points": null,
            "focus_areas": [
            {{"area_name": "Test Brand Trust Mediation", "description": "Understand if Brand Trust acts as a mediator..."}},
            {{"area_name": "Prioritize Investment (Service vs. Product)", "description": "Compare path coefficients for H1 and H2..."}}
            ]
        }}
    """,
    "leverage_points": """
        You are a master systems thinking analyst. Your task is to analyze the provided text, determine its intent, and identify its key leverage points based *only* on the provided text.

        **USER'S SYSTEM DESCRIPTION:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Follow this order):

        **Task 1: Determine Text Intent.**
        First, read the text to determine its intent.
        - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
        - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
        - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

        **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):

        **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
        1.  **Elements (`elements`):** Extract 5-7 key elements (Stocks, Flows, Variables).
        2.  **Feedback Loops (`feedback_loops`):** Identify the 1-2 primary Reinforcing and Balancing loops *described in the text*.
        3.  **Summary (`summary`):** Summarize the dynamic problem caused by the loop interactions.
        4.  **Leverage Points (`leverage_points`):** Identify 3-4 *interventions* to fix or influence the loops. Rank them by "High", "Medium", "Low" impact. For each:
            * `point_name`: Name of the intervention (e.g., "Adjust Support Staffing").
            * `potential_impact_rank`: "High", "Medium", or "Low".
            * `intervention`: The specific action (e.g., "Increase budget parameter...").
            * `rationale`: How it fixes the loop (e.g., "Weakens B1 constraint...").
            * `expected_outcome`: The expected result (e.g., "Allow more growth...").

        **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):
        1.  **Elements (`elements`):** Extract the 5-7 key services, features, or differentiators as "Variable" or "Stock" elements (e.g., "AI-driven investment advisory", "NexaScore AI engine").
        2.  **Feedback Loops (`feedback_loops`):** This MUST be an empty array [].
        3.  **Summary (`summary`):** A simple 1-sentence description of the company (e.g., "NexaFlow Capital is a FinTech...").
        4.  **Leverage Points (`leverage_points`):** Identify the 3-4 most important **"Differentiators"** or **"Core Services"** listed. These are the leverage points.
            * `point_name`: The name of the differentiator (e.g., "NexaScore AI engine").
            * `potential_impact_rank`: "High" (for differentiators) or "Medium" (for core services).
            * `target_element_or_loop`: The name of the element itself (e.g., "NexaScore AI engine").
            * `intervention`: An action to *amplify* this strength (e.g., "Enhance and scale the NexaScore AI engine").
            * `rationale`: Why this is a key strategic advantage (e.g., "This is a proprietary asset that provides a competitive edge...").
            * `expected_outcome`: The business result of amplifying it (e.g., "Increase market share and solidify position...").
        
        **IF IT IS UNANALYZABLE:**
        1.  **Elements (`elements`):** This MUST be an empty array [].
        2.  **Feedback Loops (`feedback_loops`):** This MUST be an empty array [].
        3.  **Summary (`summary`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a [poem/story/etc.] and does not contain analyzable system components...").
        4.  **Leverage Points (`leverage_points`):** This MUST be an empty array [].
        
        **ABSOLUTE CONSTRAINTS:**
        - STICK TO THE TEXT. Do NOT invent information.
        - If the text is descriptive, DO NOT invent feedback loops.
        - JSON format must be perfect.

        **RETURN FORMAT (Example for a Descriptive Profile):**
        {{
            "elements": [
            {{"name": "AI-driven investment advisory", "type": "Variable"}},
            {{"name": "NexaScore AI engine", "type": "Variable"}},
            {{"name": "Blockchain-audited trails", "type": "Variable"}}
            ],
            "feedback_loops": [],
            "summary": "NexaFlow Capital is a digital-first financial services company offering AI-driven investment advisory...",
            "leverage_points": [
            {{
                "point_name": "Proprietary NexaScore AI engine",
                "potential_impact_rank": "High",
                "target_element_or_loop": "NexaScore AI engine",
                "intervention": "Enhance and scale the NexaScore AI engine",
                "rationale": "This is a key proprietary differentiator that provides a significant competitive advantage in real-time credit scoring.",
                "expected_outcome": "Solidify market leadership and attract more SME lending clients."
            }},
            {{
                "point_name": "Blockchain-audited transaction trails",
                "potential_impact_rank": "Medium",
                "target_element_or_loop": "Blockchain-audited trails",
                "intervention": "Market the transparency of blockchain-audited trails",
                "rationale": "This feature directly addresses the 'unprecedented transparency' value proposition.",
                "expected_outcome": "Increase trust and adoption of DeFi payment services."
            }}
            ]
        }}
    """,
    "archetype": """
        You are a system thinking expert. Analyze the provided text and the key concepts extracted from it to identify the single most fitting system archetype.

        **System Description/Text:**
        {prompt_text}

        **Task:**
        From the list of common archetypes below, select the ONE that best explains the dynamics described in the text.
        - **Success to the Successful:** One entity gets more resources, which it uses to perform better and get even more resources, starving competitors.
        - **Limits to Growth:** A reinforcing process of growth eventually meets a balancing process that slows or stops the growth.
        - **Shifting the Burden:** A short-term solution is used to correct a problem, but it undermines the ability of the system to use a more fundamental, long-term solution.
        - **Tragedy of the Commons:** Individuals use a shared resource in their own self-interest, leading to its depletion.
        - **Fixes that Fail:** A fix is applied to a problem that has immediate positive results but unforeseen long-term negative consequences.

        Also, extract key 2-4 word concepts and identify the most powerful leverage point.

        **Analysis & Response:**
        Based on the text, provide a JSON response with the following structure. The description MUST explain *why* the chosen archetype fits the specific situation described in the text.

        Return ONLY a valid JSON object:
        {{
            "concepts": [{{"name": "...", "description": "...", "effect": "...", "influence": "..."}}],
            "archetypes": [{{
                "name": "Name of the chosen archetype (e.g., Success to the Successful)",
                "relevance_score": 10,
                "description": "A detailed explanation of how the dynamics in the provided text perfectly match the chosen archetype. Reference the key concepts.",
                "leverage_points": ["Specific leverage point 1", "Specific leverage point 2"],
                "interventions": ["Specific intervention 1", "Specific intervention 2"]
            }}],
            "leverage_points": [{{
                "concept": "The name of the concept that is the best leverage point",
                "score": 10,
                "reasoning": "Explain WHY this concept is the key to overcoming the limitation and achieving the goal, based on the text.",
                "actions": ["Action 1", "Action 2", "Action 3"],
                "impact": "High"
            }}]
        }}
    """,
    "system_goals": """
        You are a master strategic consultant. Your task is to analyze the provided text, determine its intent, and formulate a high-level goal and strategic initiatives based *only* on the provided text.

        **USER'S SYSTEM DESCRIPTION / GOAL CONTEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Follow this order):

        **Task 1: Determine Text Intent.**
        First, read the text to determine its intent.
        - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
        - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
        - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

        **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):

        **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
        1.  **System Goal (`system_goal`):** Refine the user's input into a single, measurable SMART goal to *fix the problem*.
        2.  **Key Loops (`key_loops`):** Identify the primary `reinforcing_loop` and `balancing_loop` *causing the problem*.
        3.  **Strategic Initiatives (`strategic_initiatives`):** Develop 2-3 initiatives to achieve the goal by *manipulating the identified loops* (e.g., "Strengthen R1", "Weaken B1"). For each:
            * `initiative_name`: Action-oriented name.
            * `rationale`: How it fixes the loop, based on text.
            * `objectives`: 2-3 specific sub-objectives.
            * `kpis`: 2-3 KPIs to track success.

        **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):
        1.  **System Goal (`system_goal`):** Define a high-level strategic goal based on the company's description (e.g., "Achieve market leadership by leveraging core differentiators").
        2.  **Key Loops (`key_loops`):** This MUST be null or have empty loops, as no dynamic problem is described.
        3.  **Strategic Initiatives (`strategic_initiatives`):** Identify the 2-3 most important **"Differentiators"** or **"Core Services"** as initiatives. For each:
            * `initiative_name`: The name of the differentiator (e.g., "Amplify NexaScore AI Engine").
            * `rationale`: Why this is a key strategic initiative to *amplify* to achieve the goal (e.g., "This proprietary asset is the core driver of competitive advantage...").
            * `objectives`: 2-3 objectives for *amplifying* this strength (e.g., "Expand NexaScore into new verticals...").
            * `kpis`: 2-3 KPIs to track this amplification (e.g., "New client acquisition rate...").

        **IF IT IS UNANALYZABLE:**
        1.  **System Goal (`system_goal`):** A clear explanation of why the text cannot be analyzed.
        2.  **Key Loops (`key_loops`):** This MUST be null.
        3.  **Strategic Initiatives (`strategic_initiatives`):** This MUST be an empty array [].
        
        **ABSOLUTE CONSTRAINTS:**
        - STICK TO THE TEXT. Do NOT invent information.
        - If the text is descriptive, DO NOT invent feedback loops.
        - JSON format must be perfect.

        **RETURN FORMAT (Example for a Descriptive Profile):**
        {{
            "system_goal": "Achieve market leadership in FinTech by leveraging proprietary AI and blockchain technology.",
            "key_loops": null,
            "strategic_initiatives": [
            {{
                "initiative_name": "Scale Proprietary NexaScore™ AI Engine",
                "rationale": "This is the core differentiator. Scaling it amplifies the company's competitive advantage in AI-based credit scoring.",
                "objectives": [
                "Integrate new alternative data sets into the NexaScore model.",
                "Market the NexaScore engine as a standalone B2B service.",
                "Reduce credit risk scoring time by 30%."
                ],
                "kpis": ["NexaScore accuracy rate", "New B2B client acquisition", "Scoring time (ms)"]
            }},
            {{
                "initiative_name": "Expand Cross-Border DeFi Payments",
                "rationale": "Leverages the unique blockchain-audited transparency to build trust and capture a larger share of the cross-border market.",
                "objectives": [
                "Form partnerships with 3 new stablecoin providers.",
                "Increase cross-border transaction volume by 50%."
                ],
                "kpis": ["Transaction Volume", "New Partnerships", "Customer Feedback on Transparency"]
            }}
            ]
        }}
    """,
    "system_objectives": """
        You are a master strategic consultant. Your task is to analyze the provided text, determine its intent, and formulate a high-level Objective, 2-3 supporting Goals, and identify system dynamics *if they exist*.
        Base this *only* on the provided text.

        **USER'S SYSTEM DESCRIPTION / GOAL CONTEXT:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS (Follow this order):

        **Task 1: Determine Text Intent.**
        First, read the text to determine its intent.
        - Is it a **Dynamic System Problem** (contains "sales are falling", "growth stalled", "bottleneck", "we have a problem with...")?
        - OR is it a **Descriptive Company Profile** (listing services, features, and differentiators, like "NexaFlow Capital...")?
        - OR is it **Unanalyzable** (a poem, a random story, a shopping list, or text with no clear factors, services, or problems)?

        **Task 2: Generate JSON based on Intent (Ground all answers *strictly* in the text):

        **IF IT IS A DYNAMIC SYSTEM PROBLEM:**
        1.  **Main Objective (`main_objective`):** Refine the user's input into a single, measurable SMART goal to *fix the problem*.
        2.  **Feedback Loops (`feedback_loops`):** Identify the primary `reinforcing_loop` and `balancing_loop` *causing the problem*. Include "name", "description", and "elements".
        3.  **Goals (`goals`):** Define 2-3 specific, measurable Goals that support the main objective by *addressing the loops*.

        **IF IT IS A DESCRIPTIVE COMPANY PROFILE (like NexaFlow):
        1.  **Main Objective (`main_objective`):** Define a high-level strategic objective based on the company's description (e.g., "Achieve market leadership by leveraging core differentiators").
        2.  **Feedback Loops (`feedback_loops`):** This MUST be null.
        3.  **Goals (`goals`):** Identify 2-3 S.M.A.R.T. Goals based on *amplifying* the company's **"Differentiators"** or **"Core Services"**. (e.g., "Increase client acquisition for NexaScore AI Engine by 50%...").

        **IF IT IS UNANALYZABLE:**
        1.  **Main Objective (`main_objective`):** A clear explanation of why the text cannot be analyzed (e.g., "The provided text appears to be a poem...").
        2.  **Feedback Loops (`feedback_loops`):** This MUST be null.
        3.  **Goals (`goals`):** This MUST be an empty array [].
        
        **ABSOLUTE CONSTRAINTS:**
        - STICK TO THE TEXT. Do NOT invent information.
        - If the text is descriptive, DO NOT invent feedback loops or problems.
        - JSON format must be perfect.

        **RETURN FORMAT (Example for a Descriptive Profile):**
        {{
            "main_objective": "Achieve market leadership as a digital-first FinTech by leveraging proprietary AI and blockchain solutions.",
            "feedback_loops": null,
            "goals": [
            "Increase client acquisition for the NexaScore™ AI Engine by 40% within 12 months.",
            "Expand Cross-Border DeFi Payments volume by 60% by forming 3 new stablecoin partnerships in 18 months.",
            "Attract 5,000 new ESG-conscious investors to the Robo-Advisory platform by promoting built-in green finance metrics."
            ],
            "strategies_and_initiatives": null 
        }}
    """,
    "system_actions": """
        You are an expert systems thinking consultant. A user has described a recurring problem or strategic initiative. Analyze it based **ONLY** on the provided text to diagnose the underlying system structure (archetype, if applicable) and prescribe **context-specific** actions, correctly classifying them as short-term fixes or long-term solutions based *only* on the text provided.

        **USER'S SYSTEM PROBLEM/INITIATIVE DESCRIPTION:**
        \"\"\"
        {prompt_text}
        \"\"\"

        **DETAILED TASKS:**
        1.  **Diagnose Problem/Goal:** Provide a concise, one-sentence `problem_diagnosis` stating the core systemic issue or goal described **in the user's text**.
        2.  **Identify Archetype (If Applicable):** Identify the single most likely `system_archetype` (e.g., "Limits to Growth", "Shifting the Burden", etc.) evident **in the user's text**, *only if a clear recurring problem pattern is described*. If the text describes a *proactive initiative* rather than a problem cycle, state "Proactive Initiative - No Archetype" for the name. Include:
            * `name`: The archetype name or "Proactive Initiative - No Archetype" identified ONLY from user text.
            * `explanation`: Detail *how* this archetype manifests **in the user's specific situation**, referencing elements **from the text** OR explain why it's a proactive initiative based on the text. Include reinforcing/balancing loops *if identifiable from the text*.
        3.  **Identify Leverage Points (2-3):** Based **only** on the analysis and **the user's text**, identify specific `leverage_points` (key areas for intervention) described or implied **in the text**.
        4.  **Prescribe Actions (3-4 actions):** Develop an array of recommended `actions` derived **solely from the user's text and the identified leverage points/goal**. For each action:
            * `action_name`: Clear, actionable name (under 10 words) **taken directly from or summarizing actions mentioned in the user's text**.
            * `type`: Classify strictly as "Short-Term Fix" or "Long-Term Solution". **CRUCIAL RULE:** Base this classification **ONLY** on the user's text.
                * If the text describes the action as addressing an immediate symptom, a temporary measure, or a quick patch -> "Short-Term Fix".
                * If the text describes the action as part of a fundamental change, addressing a root cause, building new capabilities for a strategic goal, or having lasting impact -> "Long-Term Solution". (e.g., Building necessary infrastructure like logistics for a *new strategic direction* described in the text is "Long-Term Solution").
            * `rationale`: Explain *how* this action addresses a specific leverage point or contributes to the goal, **using evidence and reasoning found ONLY within the user's text**. Justify the 'type' classification based on the text.
            * `impact`: Estimated potential impact ("High", "Medium", "Low") **based on importance stated or implied in the text**.
            * `effort`: Estimated implementation effort ("High", "Medium", "Low") **based on complexity described or implied in the text**.
            * `kpis`: List 2-3 specific KPIs **mentioned in, implied by, or logically derived ONLY from the user's text** to track this action's success.
        5.  **Self-Correction:** Rigorously check: Is every detail (diagnosis, archetype, leverage points, action names, **action types**, rationales, KPIs) **strictly derived ONLY from the user's text**? Is the archetype choice (or lack thereof) justified **by text evidence**? Is the **action type classification strictly following the rule based on the text's description of the action's purpose/duration**? Is rationale grounded **only in text**? Is JSON perfect? Fix all errors.

        **ABSOLUTE CONSTRAINTS:**
        - **CONTEXT IS KING:** All output MUST be based **EXCLUSIVELY** on the provided "USER'S SYSTEM PROBLEM/INITIATIVE DESCRIPTION". **DO NOT** invent information.
        - **ACTION TYPE ACCURACY:** The classification of "Short-Term Fix" vs. "Long-Term Solution" **MUST strictly reflect how the action is described or purposed within the user's text**, following the rule above. Building foundational capabilities for a long-term goal described in the text is LONG-TERM.
        - **NO GENERIC EXAMPLES:** **DO NOT** use the placeholder content in the RETURN FORMAT structure below. Replace ALL placeholder text with content generated **strictly from the user's input text**.
        - **JSON FORMAT:** Adhere EXACTLY.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object. Replace ALL bracketed placeholders strictly based on the user's input text and the action classification rule.
        {{
            "problem_diagnosis": "[Concise diagnosis/goal derived ONLY from user text]",
            "system_archetype": {{
            "name": "[Archetype name or 'Proactive Initiative - No Archetype' identified ONLY from user text]",
            "explanation": "[Detailed explanation linking archetype/initiative ONLY to user's text/concepts, including loops derived ONLY from text if applicable...]",
            "leverage_points": [
                {{"point": "[Leverage point derived ONLY from user text]"}},
                {{"point": "[Another leverage point derived ONLY from user text]"}}
                ]
            }},
            "actions": [
            {{
                "action_name": "[Action Name derived ONLY from user text]",
                "type": "[Short-Term Fix or Long-Term Solution based ONLY on text description/purpose rule]",
                "rationale": "[Rationale linking action using ONLY user text evidence, justifying type classification based on text...]",
                "impact": "[High/Medium/Low based ONLY on context]",
                "effort": "[High/Medium/Low based ONLY on context]",
                "kpis": ["[KPI derived ONLY from context 1]", "[KPI derived ONLY from context 2]"]
            }},
            {{
                "action_name": "[Another Action Name derived ONLY from user text]",
                "type": "[Short-Term Fix or Long-Term Solution based ONLY on text description/purpose rule]",
                "rationale": "[Rationale linking action using ONLY user text evidence, justifying type classification based on text...",
                "impact": "[High/Medium/Low based ONLY on context]",
                "effort": "[High/Medium/Low based ONLY on context]",
                "kpis": ["[KPI derived ONLY from context 3]", "[KPI derived ONLY from context 4]"]
            }}
            ]
        }}
    """
}

def call_ollama(prompt: str, ollama_url: str, model_name: str) -> Dict[str, Any]:
    """Helper function to make a request to the Ollama API."""
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
    """Queries the local S.A.G.E. model (Llama 3.1)."""
    print(f"--- Querying S.A.G.E. model for: {analysis_type} ---")
    ollama_url = os.environ.get("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    model_name = os.environ.get("SAGE_MODEL_NAME", "llama3.1:latest")

    if analysis_type not in PROMPT_TEMPLATES:
        return {"error": f"Unknown analysis type: {analysis_type}"}
    
    template = PROMPT_TEMPLATES[analysis_type]
    
    # Handle potential truncation note for prompts that support it
    # truncated_note = ""
    # max_len = 15000
    # if len(str(prompt_text)) > max_len:
    #     prompt_text = str(prompt_text)[:max_len]
    #     truncated_note = f"(Note: Analysis based on the first {max_len} characters.)"

    # prompt = template.format(prompt_text=str(prompt_text), truncated_note=truncated_note)
    prompt = template.format(prompt_text=str(prompt_text))
    return call_ollama(prompt, ollama_url, model_name)

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
    Programmatic checks mirroring the JS frontend logic for Systems Thinking.
    Each static method validates the JSON structure for a specific analysis type.
    """
    
    @staticmethod
    def _is_list_of_strings(data: Any) -> bool:
        return isinstance(data, list) and all(isinstance(item, str) for item in data)

    @staticmethod
    def _check_keys(data: Dict, required_keys: List[str]) -> List[str]:
        return [key for key in required_keys if key not in data]

    @staticmethod
    def validate_process_mapping(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["process_name", "steps", "connections", "bottlenecks", "optimizations", "kpis"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors

        if not isinstance(data.get("process_name"), str): 
            errors.append("`process_name` must be a string.")
        if not isinstance(data.get("steps"), list) or len(data.get("steps", [])) < 3: 
            errors.append("`steps` must be a list with at least 3 items.")
        if not isinstance(data.get("connections"), list): 
            errors.append("`connections` must be a list.")
        if not isinstance(data.get("bottlenecks"), list): 
            errors.append("`bottlenecks` must be a list.")
        if not isinstance(data.get("optimizations"), list): 
            errors.append("`optimizations` must be a list.")
        if not isinstance(data.get("kpis"), list) or len(data.get("kpis", [])) < 2: 
            errors.append("`kpis` must be a list with at least 2 items.")

        # Check sub-structures
        if data.get("steps") and isinstance(data["steps"], list) and len(data["steps"]) > 0:
            step_keys = ["id", "name", "type"]
            errors.extend([f"Missing key in `steps` item: {k}" for k in SageValidator._check_keys(data["steps"][0], step_keys)])
        if data.get("connections") and isinstance(data["connections"], list) and len(data["connections"]) > 0:
             errors.extend([f"Missing key in `connections` item: {k}" for k in SageValidator._check_keys(data["connections"][0], ["from", "to"])] )

        return errors

    @staticmethod
    def validate_pareto_fishbone(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]

        required_keys = ["problem_statement", "fishbone", "pareto_analysis", "action_plan"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors
        
        if not isinstance(data.get("problem_statement"), str): 
            errors.append("`problem_statement` must be a string.")
        if not isinstance(data.get("fishbone"), dict) or "Methods" not in data.get("fishbone", {}): 
            errors.append("`fishbone` must be a dict with 6M categories.")
        if not isinstance(data.get("pareto_analysis"), dict) or not all(k in data["pareto_analysis"] for k in ["vital_few", "useful_many", "analysis_summary"]):
            errors.append("`pareto_analysis` is missing keys.")
        
        # Check pareto scores
        total_score = sum(item.get("impact_score", 0) for item in data.get("pareto_analysis", {}).get("vital_few", [])) + \
                      sum(item.get("impact_score", 0) for item in data.get("pareto_analysis", {}).get("useful_many", []))
        if abs(total_score - 100) > 5:
            errors.append(f"Pareto impact scores sum to {total_score}, not 100.")
            
        return errors
        
    @staticmethod
    def validate_system_thinking(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["summary", "elements", "causal_links", "system_archetype", "leverage_points", "focus_areas"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors
        
        # Logic check: one of leverage_points or focus_areas should be null, the other populated
        is_dynamic = data.get("system_archetype") is not None and data.get("leverage_points") is not None
        is_research = data.get("focus_areas") is not None and isinstance(data.get("focus_areas"), list)
        
        if is_dynamic and data.get("focus_areas") is not None:
            errors.append("If it is a dynamic problem, `focus_areas` must be null.")
        if is_research and (data.get("system_archetype") is not None or data.get("leverage_points") is not None):
            errors.append("If it is a research plan, `system_archetype` and `leverage_points` must be null.")
        
        return errors

    @staticmethod
    def validate_leverage_points(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]

        required_keys = ["elements", "feedback_loops", "summary", "leverage_points"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors

        if not isinstance(data.get("elements"), list): 
            errors.append("`elements` must be a list.")
        if not isinstance(data.get("feedback_loops"), list): 
            errors.append("`feedback_loops` must be a list.")
        if not isinstance(data.get("leverage_points"), list): 
            errors.append("`leverage_points` must be a list.")
        
        # Consistency check
        is_unanalyzable = len(data.get("elements", [])) == 0
        if is_unanalyzable and len(data.get("leverage_points", [])) > 0:
            errors.append("If `elements` is empty (unanalyzable), `leverage_points` must also be empty.")
        if not is_unanalyzable and len(data.get("leverage_points", [])) == 0:
            errors.append("If `elements` is present, `leverage_points` should not be empty.")

        return errors
        
    @staticmethod
    def validate_archetype(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["concepts", "archetypes", "leverage_points"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors
        
        if not isinstance(data.get("concepts"), list) or len(data.get("concepts",[])) == 0: 
            errors.append("`concepts` must be a non-empty list.")
        if not isinstance(data.get("archetypes"), list) or len(data.get("archetypes",[])) == 0: 
            errors.append("`archetypes` must be a non-empty list.")
        if not isinstance(data.get("leverage_points"), list) or len(data.get("leverage_points",[])) == 0: 
            errors.append("`leverage_points` must be a non-empty list.")
        
        return errors

    @staticmethod
    def validate_system_goals(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["system_goal", "key_loops", "strategic_initiatives"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors

        is_unanalyzable = "analyz" in data.get("system_goal", "").lower()
        if is_unanalyzable and len(data.get("strategic_initiatives", [])) > 0:
             errors.append("If unanalyzable, `strategic_initiatives` must be empty.")
        if not is_unanalyzable and len(data.get("strategic_initiatives", [])) == 0:
             errors.append("If analyzable, `strategic_initiatives` must not be empty.")
             
        return errors

    @staticmethod
    def validate_system_objectives(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["main_objective", "feedback_loops", "goals"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors

        if not isinstance(data.get("goals"), list): 
            errors.append("`goals` must be a list.")
        
        is_unanalyzable = "analyz" in data.get("main_objective", "").lower()
        if is_unanalyzable and len(data.get("goals", [])) > 0:
             errors.append("If unanalyzable, `goals` must be empty.")
        if not is_unanalyzable and len(data.get("goals", [])) == 0:
             errors.append("If analyzable, `goals` must not be empty.")

        return errors

    @staticmethod
    def validate_system_actions(data: Dict) -> List[str]:
        errors = []
        if not isinstance(data, dict): 
            return ["Response is not a dictionary."]
        
        required_keys = ["problem_diagnosis", "system_archetype", "actions"]
        errors.extend([f"Missing key: {k}" for k in SageValidator._check_keys(data, required_keys)])
        if errors: 
            return errors
        
        if not isinstance(data.get("actions"), list) or len(data.get("actions",[])) == 0: 
            errors.append("`actions` must be a non-empty list.")
        
        if data.get("actions") and isinstance(data["actions"], list) and len(data["actions"]) > 0:
            action = data["actions"][0]
            action_keys = ["action_name", "type", "rationale", "impact", "effort", "kpis"]
            errors.extend([f"Missing key in `actions` item: {k}" for k in SageValidator._check_keys(action, action_keys)])
            if "type" in action and action["type"] not in ["Short-Term Fix", "Long-Term Solution"]:
                errors.append(f"Invalid action type: {action['type']}")
                
        return errors


# --- GOLDEN DATASET ---
golden_dataset = [
    {
        "id": "ST-001",
        "analysis_type": "process_mapping",
        "prompt_input": "Our customer onboarding is a mess. First, sales sends a welcome email. Then, someone from support has to manually create their account in three different systems. After that, an implementation specialist schedules a call. But sometimes sales forgets, or support makes a typo in the username. The handover to the specialist is often delayed because they don't get a notification.",
        "expected_intent": "A valid process map with clear steps, connections, and identified bottlenecks related to manual work and poor handovers.",
        "ground_truth_summary": "The model should identify the manual account creation and the lack of automated notification between support and implementation as the key bottlenecks. Optimizations should focus on automating account provisioning and creating a system trigger for the handover."
    },
    {
        "id": "ST-002",
        "analysis_type": "pareto_fishbone",
        "prompt_input": "We're getting a lot of complaints about our software crashing. Users say it happens most often when they try to export large reports. Our developers think it could be due to memory leaks from the new charting library, but the QA team says our testing environments don't have enough RAM to replicate the issue. Also, we've had a lot of new junior developers join the team who might not be following best practices for memory management.",
        "expected_intent": "A fishbone diagram identifying causes under Manpower (junior devs), Machines (low RAM), and Methods (memory leaks). The Pareto analysis should identify 'Memory Leaks' and 'Inadequate QA environment' as the vital few.",
        "ground_truth_summary": "The output must correctly categorize root causes (e.g., 'Junior developer experience' under Manpower, 'Insufficient RAM in QA' under Machines/Environment, 'Potential memory leaks' under Methods). The 'vital_few' in the Pareto analysis should point to the technical debt (leaks) and infrastructure issues (QA environment) as the dominant sources of the problem."
    },
    {
        "id": "ST-003",
        "analysis_type": "system_thinking",
        "prompt_input": "Our startup is growing fast. As we increase our marketing spend, we get more users. More users lead to more feature requests. We hire more developers to build these features, which improves the product. But the increased complexity is also leading to more bugs, which slows down development and frustrates users, causing some to leave.",
        "expected_intent": "Identify a 'Growth and Underinvestment' or 'Limits to Growth' archetype. Should find a reinforcing loop (Marketing -> Users -> Revenue -> Marketing) and a balancing loop (Complexity -> Bugs -> Slow Development -> User Churn).",
        "ground_truth_summary": "The model must identify the conflicting loops: a reinforcing 'growth' loop (marketing->users->revenue) and a balancing 'quality' loop (new features->complexity->bugs->developer time->slower feature delivery). The archetype should be 'Limits to Growth' where the limit is development capacity/code quality."
    },
    {
        "id": "ST-004",
        "analysis_type": "leverage_points",
        "prompt_input": "NexaFlow Capital is a digital-first financial services company. Our key offerings are an AI-driven investment advisory service, a proprietary 'NexaScore' AI engine for real-time credit scoring, and blockchain-audited transaction trails for transparency.",
        "expected_intent": "Identify the text as a descriptive profile, produce no feedback loops, and identify the 'NexaScore AI engine' and 'blockchain trails' as the key leverage points (differentiators).",
        "ground_truth_summary": "The model should correctly classify this as a 'Descriptive Company Profile'. `feedback_loops` must be empty. The `leverage_points` should be the company's core differentiators, such as the 'NexaScore AI engine', with rationale explaining they are proprietary assets that provide a competitive edge."
    },
    {
        "id": "ST-005",
        "analysis_type": "system_actions",
        "prompt_input": "Every time our website traffic spikes during a sale, the server overloads and crashes. The immediate fix is always to have an engineer manually reboot the server, which causes 15 minutes of downtime. We know we need to move to an auto-scaling cloud infrastructure, which is a big project, but we keep putting it off to handle urgent feature requests.",
        "expected_intent": "Diagnose a 'Shifting the Burden' archetype. Classify 'reboot server' as a short-term fix and 'move to auto-scaling' as a long-term solution.",
        "ground_truth_summary": "The analysis must identify the 'Shifting the Burden' archetype. It must correctly classify 'manually reboot the server' as a 'Short-Term Fix' (symptomatic relief) and 'move to auto-scaling cloud infrastructure' as a 'Long-Term Solution' (fundamental fix). The rationale must explain this distinction clearly."
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
        "process_mapping": SageValidator.validate_process_mapping,
        "pareto_fishbone": SageValidator.validate_pareto_fishbone,
        "system_thinking": SageValidator.validate_system_thinking,
        "leverage_points": SageValidator.validate_leverage_points,
        "archetype": SageValidator.validate_archetype,
        "system_goals": SageValidator.validate_system_goals,
        "system_objectives": SageValidator.validate_system_objectives,
        "system_actions": SageValidator.validate_system_actions,
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
    
    # Save detailed results to a file
    filename = "sage_evaluation_results_st.json"
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed results saved to {filename}")

if __name__ == "__main__":
    run_evaluation_suite()
