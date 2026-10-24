# B learning-map ownership and D-first integration review

Proposal `proposal/b-owns-learning-map` at `d1e83f6` is accepted on **`claude-skill-tree`**, preserving the human's feature isolation. B owns the compact embed and panel follow-up within the paths specified in B's brief. C stops embed implementation; D stops panel edits after supplying the base. B's final implementation branch is **`feature/learning-map`**. Superseded C/D feature branches must not be developed in parallel with B on these same paths.

## Integration status

- Ownership proposal merged and instructions reconciled with the isolated target. Main and Moss branches are unchanged.
- D `agent/extension` at `7e078cf` reviewed in candidate `97d8fe9`, preserved locally as `integration/d-learning-map-review`. **D merge held** for the source-review blockers below. No D runtime changes are published on the feature target yet.
- Candidate frozen installation, workspace typecheck, all **228 tests** (extension 82), dashboard build and extension build passed. These passes do not cover the discovered content-script races.
- Independent read-only `verify_d_learning_map` (agreed gpt-6.1-sol medium substitute) reviewed bypass/chat/panel behavior. It found no additional blocker in the panel shell itself: URL restrictions, consent removal, stale probe handling and synchronous Chrome user gesture are present.
- `feature/learning-map` was absent from the remote at review time; a push is required before E can review/merge it. No empty replacement branch was created and no feature implementation is claimed.

## D fixes required before merge

1. **P1: bypass completion must revalidate the target.** In D `content.ts:127–155`, chat/draft checks precede an awaited health/quota operation, but resend proceeds without checking again. `send-interceptor.ts:203–211` can overwrite whatever composer now exists. Capture target/session identity, then recheck chat, consent, current draft and send eligibility after the await and immediately before modifying/sending. If the quota was already spent but the context changed, report that outcome and do not resend or arm a stale prompt. Add deferred-response regressions for navigation, new draft, consent revocation and a new in-flight send. Do not reissue quota requests automatically.
2. **P2: alias only confirmed first-send chat creation.** `conversation.ts:55–58` currently aliases any unsaved-to-unaliased-chat transition. A failed first send followed by opening an existing chat can associate that chat with the failed attempt. Distinguish a confirmed new-chat send/UUID assignment from unrelated navigation; test failed/ignored first send followed by opening an existing conversation.
3. **P2: preserve the legitimate first-turn bypass target.** `content.ts:64–68` clears a target when the site's normal new-chat URL acquires its UUID. Key the target to the confirmed logical conversation identity, preserving it for legitimate aliasing while clearing it on an actual conversation change. Test the URL change both before and after onSent.

These are D-owned non-panel safety fixes; B's reassignment does not authorize E to edit D source. D pushes the corrected branch with regressions, tests/typecheck/build and a fresh READY handoff. Review the charge-but-no-resend UX explicitly; never overwrite the user's new draft to hide a spent bypass.

## Required order

1. D fixes and pushes `agent/extension`; E reruns review/gates and merges D into **`claude-skill-tree`**.
2. B can prepare its compact view in its own checkout while D fixes non-panel safety. B pushes **`feature/learning-map`** and merges E's D-ready feature base before final PANEL READY. Preserve the accepted panel shell rather than rewriting it. Coordinate any popup/storage overlap with D.
3. E reviews B's scoped cross-owner changes, runs narrow-screen, iframe/consent/shared-backend and regression checks, then merges B into the same feature target. D must precede B in the published feature history.
4. Human validates the actual Chrome side panel and live mastery updates. Main remains separate until instructed to release. Existing real-API v4/real-model acceptance gates are not closed by this feature review.
