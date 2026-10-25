# Friction: concept-card design system

The current visual specification is [Concept Cards](docs/design/CONCEPT-CARDS.md). It supersedes the earlier circle-node, pillar-column and green/amber design. Data, prerequisite rules and the four assistance levels are unchanged.

## 1. Identity and tokens

Friction uses a light lavender ground with tactile collectible cards. Fraunces is used for headlines, card titles and the logo; Nunito for UI text. The shared mark is a tilted gold card with an ink border, used in the dashboard, favicon, extension toolbar, popup and claude.ai pill.

| Role | Colour |
|---|---|
| Ground | `#F4F1FA` |
| Surface | `#FFFFFF` |
| Border | `#E2DCEC` |
| Ink | `#231B3A` |
| Muted | `#5E5675` |
| Mastered | Gold `#E0A100`, ink `#7A5400` |
| Learning | Violet `#6D4AFF`, ink `#4B2FB8` |
| Locked | Slate `#8F86A8`, with hatching |
| Bypass | Teal `#0E7A7A` |

Errors retain a warm treatment distinct from bypass tickets. State is never communicated by colour alone.

## 2. Card anatomy

Every concept uses a fixed 132 × 172px card, regardless of major/minor metadata. The card contains a LOCKED / LEARNING / MASTERED ★ kicker, an emblem with the concept icon, a two-line title, a progress meter and a current/required mastery badge. Locked cards also show a padlock and a patterned face; learning cards tilt slightly. Class focus counts remain available on educator cards. Tooltips expose mastery criteria and keyboard focus supports inspection.

## 3. Prerequisites and navigation

Each row represents one prerequisite depth from shared `computeDepths`. Rows are centred on one axis with even spacing. Syllabus order follows module order, then API concept order, with placement adjusted beneath prerequisites. Module columns and banners are removed; modules still exist in data and the inspector.

Saved node positions are ignored. Navigation is vertical page-like scrolling, with no canvas pan or zoom and no drag-to-position. Scale starts at 1 and shrinks when required by the row width, including below 0.5 on narrow screens when necessary to keep every card visible. This minimum-scale exception was approved by the human during integration. Verify actual card bounds, not just absence of a horizontal scrollbar.

The map opens at the learning frontier: the first prerequisite row still in progress. Changing the viewer returns to that frontier; live updates and edits preserve the reading position. “Back to what you're learning” appears only when the frontier leaves view. Ctrl+scroll uses browser page zoom.

## 4. Motion and accessibility

Mastery flips the card to its gold face with contained confetti; newly unlocked children turn face up. Reduced motion skips these decorative transitions while preserving live state and announcements. Keep readable contrast, text state labels, visible focus and touch-accessible controls. Do not celebrate initial loading or a viewer switch as newly earned mastery. Decorative parallax is outside the implemented design.

## 5. Educator and student surfaces

The demo begins with the teacher creating a skill tree, then moves to student views and the extension. The sandbox remains available as a secondary testing/fallback surface.

Educators upload a syllabus, inspect/edit concepts and required levels, create/delete nodes, and connect/delete prerequisite edges. Cycles remain rejected. Dragging and module renaming from the canvas are intentionally removed. Students see the same card layout read-only, with mastery updating live through SSE.

## 6. Extension and bypass tickets

The popup, on-page pill and side-panel shell share the card identity, typography and palette. Gold denotes mastered/normal assistance, violet learning, and hatched slate a locked/idle treatment. Bypass controls and teacher notifications use a teal ticket with a ×N count: scarce and legitimate, without an alarming treatment.

Keep existing consent, offline, API-readiness, chat and draft safeguards. UI styling does not change bypass scope: certified prompt bypass affects one intended send; legacy concept bypass is labelled as pause-until-reset. If quota is spent but the intended send becomes unsafe, preserve the current draft, report “not sent” and offer Copy question. Never imply that a failed resend completed.

The side panel loads the configured `/student/:id?embed=1` view: a read-only live map with click-to-open details. Close or Escape dismisses the details and returns focus to the concept card. The full Student route is unchanged. Refer to [UI layouts](docs/ui-layouts.md) §2, §5 and §6 for the surface details.
