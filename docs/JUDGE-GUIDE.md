# Try Friction

Friction helps students learn with Claude instead of immediately receiving answers. Start with the teacher's skill tree, then try the student extension.

**Current availability:** [download the prebuilt extension](https://github.com/colonfranxio/Friction/raw/refs/heads/main/releases/friction-extension.zip) and use the local setup below. Extract and load `friction/extension`. No public API is provided; hosting is optional for this repository/video submission path. Desktop Chrome 120+ and your own Claude account are required. ChatGPT and Gemini are not supported by this build. [Watch the completed demo video](https://www.youtube.com/watch?v=ZA6RmlfIPj0).

## Install the extension

Follow [README: student setup](../README.md#students-download-and-run-the-chrome-extension) to download/build or extract an organizer-supplied ZIP. In Chrome, open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select the folder containing `manifest.json`. Pin Friction.

For the local path, start the API and dashboard using the README. Use a dedicated demo database; avoid resetting a course someone else is using. Model credentials belong only on the backend, never in the extension. Organizers provide the model settings and credentials for local real-mode setup; judges should not need these once the hosted path is available.

Local extension settings:

| Setting | Value |
|---|---|
| API URL | `http://127.0.0.1:8787` |
| Dashboard URL | `http://127.0.0.1:5173` |
| Student ID | `22222222-2222-4222-8222-222222222222` (Alex, local seed only) |
| API READY SHA | Use the organizer's approved full API revision; do not guess |

Save and enable Friction. Refresh Claude after installing or reloading the extension. Confirm Friction is online; offline requests pass through without guidance.

## Walkthrough (about five minutes, excluding installation)

1. **Teacher:** open the dashboard's educator view. On a fresh local seed store this is `http://127.0.0.1:5173/educator/33333333-3333-4333-8333-333333333333`. Upload [the elementary syllabus](../fixtures/elementary-syllabus.pdf), or paste [its text](../fixtures/elementary-syllabus.md). Inspect the generated concepts and prerequisites. Uploading changes Alex's active course; wait for parsing and, when configured, Moss indexing to finish.
2. **Student:** in a new Claude chat, ask: “If I eat 3 slices of a pizza cut into 8, what do the two numbers in 3/8 mean?” Look for a Friction concept/level badge and a guiding response with a check question. This example targets the uploaded fractions course; use the actual course concept if parsing names differ.
3. **Learning:** answer Claude's actual check question in your own words. Open the learning map and compare it with the teacher view. Progress should update without refreshing. In normal mode, correct answers advance one level; a single answer need not produce a gold card. Demo mode can jump a confident correct answer to L4. The root card turns gold when its required mastery is reached.
4. **Student choice:** on a different unmastered concept, ask a question and then click Bypass after the guided reply. Friction spends a bypass and resends the question with a hidden instruction requesting full help for that message. Confirm the full answer and quota change; check the teacher notification. With an approved API readiness SHA configured, this is a one-message bypass. With the SHA empty, the real API uses legacy concept-level pause; do not describe that as a one-message bypass. The popup explains the applied scope. Model behavior varies, so report an unexpected result rather than assuming success.
5. **Mastery:** after mastering a concept, ask about it in a new chat. Friction should allow full help. Earlier course concepts remain guided until they are mastered or bypassed.

Typing “ignore friction” in a chat with an active friction target is held once with a pointer to Bypass. A second send uses normal Friction interception. Instruction-following is best effort; this is not an unbreakable anti-cheating system.

## If something goes wrong

- **Friction offline:** check the configured API's `/health`, server terminal and extension settings, then refresh Claude.
- **No matching concept:** ask about the uploaded course; unrelated prompts deliberately pass through.
- **Map missing or stale:** check Dashboard URL and that its build uses the same API as the extension; reopen the map.
- **Bypass charged but not sent:** read the badge and use Copy question. Do not keep clicking Bypass or overwrite a new draft.
- **Updated extension:** reload it at `chrome://extensions`, then refresh Claude tabs.

## Hosted judge access — organizer completion required

Before publishing a “Try it” link, replace local setup with verified HTTPS dashboard/API URLs, a guest session/student assignment, a prebuilt extension release link, and the approved API readiness revision. Never direct every public judge to the shared local seed student. Test from a clean Chrome profile on another computer, including refresh of the educator URL, extension permissions, SSE progress and bypass. The organizer's release checklist is [SUBMISSION-SETUP](SUBMISSION-SETUP.md).
