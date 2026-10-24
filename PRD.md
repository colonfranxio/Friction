# PRD: Project Friction (CalHacks)

## 1. Product Overview

**Elevator Pitch:** An OS-level, LLM-routing pipeline that prevents AI-induced cognitive atrophy. Friction dynamically intercepts user prompts to third-party AI tools (Claude, ChatGPT) and injects hidden system instructions to force users to learn, based on a dynamically generated, educator-defined skill tree.
**Core Differentiator:** It is a cross-app cognitive fitness tracker using Bloom's Taxonomy to dynamically adjust AI friction, rather than a walled-garden chatbot.
**Deployment Strategy:** A phased rollout starting with a universally applicable Web Extension (Phase 1), followed by a Sandboxed Desktop Workspace (Phase 2) for complete environment lockdown.

## 2. Core Modules & Architecture

### Module 1: Educator Configuration & Skill Tree Generation

**Goal:** Translate raw curriculum into a structured, visual dependency graph (inspired by *Arc Raiders* UI).

* **Inputs:** Educator uploads a syllabus (PDF) or inputs text constraints.
* **Processing:** A backend LLM parses the input into a JSON array of interrelated nodes.
* **Node Data Structure:**
* `concept_name`: String (e.g., "React useEffect")
* `dependencies`: Array of Node IDs
* `mastery_criteria`: String (e.g., "Identify and prevent an infinite render loop")
* `current_blooms_level`: Integer (1-4)


* **Educator UI:** A drag-and-drop node graph where teachers can manually edit relationships, add custom criteria, and monitor aggregate student positioning.

### Module 2: Student Evaluation & Positioning Engine

**Goal:** Track student mastery silently and bi-directionally.

* **Evaluation Mechanisms:**
* *Primary (High Confidence):* Context-aware stealth mini-quizzes injected naturally into the AI's conversational response.
* *Secondary (Low Confidence):* Asynchronous backend LLM evaluation of the user's raw chat logs against the node's `mastery_criteria`.


* **Bi-Directional Progression:** If a student demonstrates "cognitive laziness" on advanced concepts, the system regresses their node status back to lower levels, re-introducing friction.

### Module 3: Dynamic LLM Tailoring (The Friction Engine)

**Goal:** Modify the user's prompt *before* it hits the target LLM based on their exact position on the Skill Tree.

* **Friction Levels (Based on Bloom's Taxonomy):**
* *Level 1: Remember/Understand (Max Friction).* AI acts as a Socratic Tutor. Injected prompt: "Refuse direct answers. Force the user to define the core concept."
* *Level 2: Apply (Medium Friction).* AI acts as a Scaffolder. Injected prompt: "Provide pseudocode or structural outline only. User must fill in exact syntax."
* *Level 3: Analyze/Evaluate (Reverse Friction).* AI acts as a Challenger. Injected prompt: "Provide the solution but introduce one subtle logical error. Ask user to evaluate and fix it."
* *Level 4: Create (Zero Friction).* AI acts normally. Injected prompt: "Provide standard helpful assistance."


* **Frustration Bypass:**
* Users have a limited quota of "bypasses" for emergency deadlines.
* Using a bypass triggers a webhook to the educator dashboard and pauses all progression on the learning tree for that specific node.



### Module 4: Interception Layer

**Goal:** Make Friction ubiquitous across the user's workflow without forcing them into a proprietary chat UI.

* **Phase 1: Web Extension (Hackathon Primary Focus)**
* A Chrome Extension utilizing Content Scripts to read DOM inputs on target URLs (e.g., `chatgpt.com`, `claude.ai`).
* It intercepts the user's prompt *before* the network request is sent, queries the backend for the user's Bloom's Level on the detected topic, and silently appends the Friction System Prompt.
* It intercepts the LLM's response and sends the conversational pair to the backend for async evaluation.


* **Phase 2: Sandboxed Friction Workspace (Stretch Goal / Future Architecture)**
* A lightweight desktop application (built with Electron or Tauri).
* Acts as a secure container wrapping web versions of AI tools inside isolated WebViews.
* Prevents users from bypassing the Chrome extension by using desktop apps, allowing the system to natively inject prompts into the WebView payloads for total environment lockdown.



## 3. Database Schema (Supabase/PostgreSQL)

* **Users:** `id`, `role` (educator/student), `bypass_quota`
* **Trees:** `id`, `educator_id`, `source_material_ref`
* **Nodes:** `id`, `tree_id`, `concept_name`, `mastery_criteria`
* **Edges:** `parent_node_id`, `child_node_id`
* **Student_State:** `student_id`, `node_id`, `current_blooms_level`
* **Chat_Logs:** `id`, `student_id`, `raw_prompt`, `intercepted_prompt`, `llm_response`, `app_source` (Claude Web / ChatGPT Web)

## 4. Hackathon Demo Flow (3 Minutes)

1. **The Setup:** Show the Educator dashboard parsing a PDF syllabus into a stunning visual skill tree.
2. **The Interception (Phase 1):** Switch to the student screen. Open standard Claude.ai in Chrome with the Friction extension active. Show the student asking a basic question and getting a Socratic pushback (Level 1 Friction) instead of a direct answer.
3. **The Breakthrough:** Show the student correctly answering the stealth quiz generated by the AI. The backend instantly updates their state to Level 4.
4. **The Payoff:** The student asks the *exact same question*, and this time the AI instantly generates the full code block without friction.