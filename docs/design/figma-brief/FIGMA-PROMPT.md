# Figma AI prompt: gamified visual language explorations for Friction

Attach the 6 screenshots in this folder, in order, then paste everything below the line into Figma's AI.

| # | File | What it shows |
|---|---|---|
| 1 | `01-educator-tree.png` | Educator dashboard: skill tree for an uploaded course (CS160), class panel |
| 2 | `02-student-view.png` | Student view: same tree, personal progress, "Now learning", bypasses left |
| 3 | `03-sandbox-empty.png` | Sandbox chat, empty state, with the live learning map |
| 4 | `04-sandbox-friction.png` | Sandbox mid-conversation: the AI refuses to just answer (L1 · Socratic) and asks a check question |
| 5 | `05-extension-popup.png` | Chrome extension popup (360 px wide) |
| 6 | `06-claude-badge-states.png` | Tiny status pill the extension shows on claude.ai, in all 8 states |

---

## Context: what this product is

**Friction** is a learning tool that stops AI from making students worse at thinking. When a student asks an AI assistant (claude.ai, or our built-in sandbox chat) for help, Friction checks which course concept the question is about and how well this student knows it. Then it quietly tells the AI how much to help:

| Level | Name | What the AI does |
|---|---|---|
| L1 | **Socratic** (max friction) | Won't give the answer; makes the student explain the idea first |
| L2 | **Scaffolder** | Gives an outline with blanks, not the full answer |
| L3 | **Challenger** | Gives a full answer containing one deliberate bug to find |
| L4 | **Normal** (no friction) | Helps fully |

The AI ends its reply with a short **check question**. If the student answers it correctly, the concept is **mastered**, the node on their **skill tree** turns green, and the next concepts **unlock**. Educators create the skill tree by uploading a course syllabus. Students get a few **bypasses**, a limited "skip friction this once" that notifies the teacher.

The attached screenshots are the **current, working UI** (built for a hackathon). The current visual language is calm and editorial: warm off-white background (`#FDFBF7` / `#F9FAFB`), green = mastered (`#10B981`), amber = learning (`#F59E0B`), slate = locked (`#9CA3AF`), Nunito/rounded sans, generous whitespace, soft cards. It works, but it doesn't yet feel like a **skill tree you want to grow**. The original inspiration was the progression trees in games like *Arc Raiders*, *Path of Exile*, *Civilization* and *Hades*: that pull of "one more unlock".

## Your task

Create **6 distinct gamified visual language directions** for Friction. They should be genuinely different design systems with different metaphors, not color variations of one idea. Apply **each direction to the same set of real components** (listed below), so the team can compare them side by side and pick one, or mix two.

### Required directions (one Figma page each)
1. **Living Garden.** Concepts are plants: seed (locked) → sprout (learning) → bloom (mastered). Prerequisites are roots and branches. Growth is literal and organic. Soft, botanical, hand-touched.
2. **Constellation Atlas.** Concepts are stars; mastering one lights it up and draws the constellation line to the next. Pillars are constellations. A celestial, wonder-driven feel. Make it work in **light mode** (think a daylight star chart or an antique atlas), with an optional dark variant.
3. **Tactical Tech Tree.** Inspired by *Arc Raiders* / *Civilization*: crisp hex or circuit nodes, precise connectors, unlock "power-up" moments, a HUD-like but friendly tone. Must stay approachable for non-gamers and **not** dark-mode-only.
4. **Trail Map Expedition.** The course is a national-park trail map: pillars are regions, concepts are trail markers and campsites, mastery earns a passport stamp, and topographic contours add depth. Adventurous, outdoorsy.
5. **Studio Sketchbook.** It's an HCI/design course, so lean into it: paper, tape, sticky notes, marker strokes, stickers for mastery, "desk crit" energy. Crafted and human, as if a designer built it by hand.
6. **Cozy Quest RPG.** *Stardew Valley* / cozy-game warmth: quests, an XP bar, tiny celebratory particles, collectible "concept cards". Bypasses become a small, limited inventory item. Playful, never childish.

If you have a strong seventh idea (e.g. a transit/metro map or a museum exhibit), add it as a bonus page.

### Components to design in EVERY direction
1. **Skill-tree node** in 3 states (locked, learning, mastered), plus a **major** (milestone) and **minor** size. Include the **progress badge** (`current/required`, e.g. `1/4`) and the concept label (up to 2 lines).
2. **Connectors** between prerequisite and dependent nodes: locked, active and mastered styles, plus how a newly unlocked path is revealed.
3. **Pillar headers** (course modules, numbered `01–05`, uppercase names like "DESIGN PROCESS & NEEDFINDING").
4. **The mastery moment:** a 3–5 frame storyboard of a node going learning → mastered and its children unlocking. This is the demo's money shot; make it feel earned.
5. **Educator header + toolbar:** title, course name, Upload syllabus, Edit mode, "Viewing as: Class", Reset demo, Live indicator.
6. **Student progress card:** "2/14 concepts mastered", **Now learning** (concept, level chip, mastery goal), bypasses left (currently 3 dots).
7. **Sandbox "Friction for this turn" panel:** concept, level chip (L1 Socratic … L4 Normal), quiz status, **Use bypass (2 left)** button. Also one chat bubble from the AI showing friction.
8. **Level chips L1–L4** as a coherent set (they currently read "L1 · Socratic", "L4 · Normal").
9. **Extension popup** (360 px wide): status (Online/Offline/Paused), enabled toggle, current concept + level, **Bypass this message (N left)**, collapsed Settings.
10. **On-claude.ai status pill** (single line, ≤ 440 px, sits bottom-right over someone else's website) in all 8 states from screenshot 6: L1, L2, L3 (each with a small Bypass button), mastered/no friction, bypassed, offline, paused, "updated · reload this tab".
11. **Empty state** for the sandbox ("Start with a little curiosity").

### For each direction, also include a one-page "system card"
- **Palette:** background, surfaces, text, the 3 node states, alert/bypass colour. Show contrast ratios for text and state colours.
- **Type:** display + UI font pairing (Google Fonts), with a scale.
- **Iconography:** concept icons (the app uses keywords like `refresh, search, book, list, puzzle, layers, grid, shield, chart, cpu, zap, lock, share, globe`); show 8 in the direction's style.
- **Motion notes:** unlock, hover, mastery celebration, live "energy" along active paths. Short written spec plus key frames.
- **Gamification mechanics:** what this direction adds (XP? streaks? stamps? cards?) and how it maps to *real learning*. Only use mechanics backed by real data: mastery, levels, bypasses, prerequisite unlocks.
- **One-line rationale:** who it's for and why it fits a university classroom.

## Hard constraints (apply to all directions)
- **Information architecture stays the same.** Same screens, same data, same three node states, same four levels. Restyle; don't reorganize the product.
- **States must never rely on colour alone** (colour-blind safe). Use shape, icon, fill, or a padlock for locked.
- **Light mode first.** It must look good projected in a bright lecture hall. Dark variants are optional extras.
- **Text must stay readable** at the real sizes: node labels around 11–13 px, badge numbers around 10 px, popup at 360 px. WCAG AA contrast for text.
- **Bypass is a pressure valve, not a punishment.** It should feel legitimate to use, visibly scarce, and transparent that the teacher sees it. No shaming, no "cheater" vibes.
- **Friction is encouraging.** L1 Socratic is a coach asking "explain it to me", not a locked door or a scolding. Avoid red/danger styling for friction states.
- **The claude.ai pill must be tiny, calm and unmistakable** on top of another product's UI. It's a single line, never blocks clicks except its own Bypass button, and shouldn't look like an ad or an error.
- **Audience:** university students and instructors. Delightful, but credible enough that a professor would put it in a syllabus.
- **Frames:** desktop at **1440 × 900**, popup at **360 × 560**, pill strip at real size. Use auto-layout and components where you can.

## Output format
- **One Figma page per direction**, named `01 Living Garden`, `02 Constellation Atlas`, … Each page holds the system card, then all 11 components, then the mastery storyboard, then a full-screen **Student view** mock (like screenshot 2) and a full-screen **Sandbox** mock (like screenshot 4) in that style.
- A final **`00 Compare`** page: the same node trio (locked / learning / mastered), the extension popup, and the claude.ai pill, laid out side by side across all six directions, with a 3-bullet strengths/risks note under each.
- Keep the real copy from the screenshots ("Understanding takes shape.", "Friction for this turn", "Use bypass (2 left)", concept names from CS160) so the mocks read like the actual product.
