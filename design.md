# Project Friction: Skill Tree UI/UX Design Document

## 1. Design Philosophy & Visual Identity

The Friction Skill Tree interface translates heavily gamified, vertical progression mechanics into a clean, light-mode interface suited for professional development and education. The design language is defined as "Approachable Professionalism." It avoids aggressive neon colors and dark backgrounds, utilizing soft contrast, rounded geometry, and a warm, inviting palette to reduce cognitive load while maintaining the tactile satisfaction of a gaming skill tree.

## 2. Layout & Architecture

The structural foundation optimizes complex educational curricula into digestible visual roadmaps.

* **Vertical Pillars:** Skills are organized into distinct vertical columns representing major course modules, chronologies, or distinct learning tracks.
* **Path Routing:** Nodes are connected via structured, branching lines that clearly map prerequisites. Lines use rounded corners (8px radius) to feel fluid rather than rigid, converging and diverging to illustrate alternative learning paths.
* **Node Hierarchy:** Major milestone concepts are represented by larger circular nodes, while smaller nodes represent sub-skills or intermediate steps.
* **Progress Indicators:** Pill-shaped fractional badges (e.g., 1/4, 3/4) are positioned directly beneath each node. These quantify mastery depth, representing the user's current Bloom's Taxonomy level out of the required maximum for that specific node.

## 3. Color Palette & Typography

The interface utilizes a warm, professional light-mode aesthetic to reduce eye strain during extended work sessions.

* **Background:** Off-white or soft cream (`#F9FAFB` or `#FDFBF7`).
* **Inactive/Locked Paths:** Unearned nodes use a soft slate (`#9CA3AF`) and feature a small padlock icon to denote locked prerequisites. Connecting lines are a light silver (`#E5E7EB`).
* **Active/In-Progress Paths:** Nodes currently being learned utilize a warm amber (`#F59E0B`) to indicate active engagement without inducing urgency. Solid, low-opacity lines connect active nodes.
* **Mastered Paths:** Fully completed nodes transition to a calming sage or mint green (`#10B981`).
* **Typography:** The primary typeface is a modern, geometric sans-serif with rounded terminals (*Nunito* or *Inter*), ensuring maximum legibility for small fractional badges while maintaining a friendly tone.
* **Iconography:** Node icons use abstract geometric vectors or minimalist educational symbols (e.g., a database icon for SQL, a grid for CSS) rendered in monochrome within their colored circular containers.

## 4. Micro-Animations & Additive Elements

Playful micro-animations transform the skill tree from a static syllabus into a living, responsive roadmap that rewards progress.

* **Node Unlocking Sequences:** When a user achieves a new Bloom's Level or unlocks a prerequisite, the padlock icon dissolves via a satisfying spring animation. The node's fill color pulses softly, and the newly unlocked connecting line draws itself outward using a fluid masking effect.
* **Interactive Hover States:** Hovering over an active node triggers a gentle, magnetic floating effect that slightly scales up the circle and its internal vector icon. The informational tooltip unfurls with a rapid accordion animation, displaying the mastery criteria with a subtle drop shadow to create depth.
* **Mastery Celebrations:** Reaching Level 4 (Create) on a major milestone node triggers a contained burst of geometric particles tightly bound to the node's radius. The pill-shaped fractional badge flips mimicking a mechanical scoreboard ticker when a mastery point is added.
* **Dynamic Backgrounds and Momentum:** The canvas background features a slow, breathing parallax effect to provide structural depth. For students on a high-activity learning streak, active pathways display a subtle, looping pulse of light traveling along the connecting lines, visually simulating energy flowing through the curriculum.

## 5. View Modalities

The interface adapts its toolset based on the user's role.

* **Student View (Read-Only & Interactive):** Students interact with a clean, navigable map. The focus is entirely on progress tracking, exploring upcoming prerequisites, and viewing mastery criteria via hover tooltips.
* **Educator View (Build & Edit Modality):** The interface transitions into an open canvas. When educators upload a syllabus PDF or provide text constraints, the UI auto-populates the node structure. Educators can seamlessly drag and drop nodes to redraw connecting lines, click into a node's fractional badge to override the required Bloom's mastery level, and customize overarching pillar names.