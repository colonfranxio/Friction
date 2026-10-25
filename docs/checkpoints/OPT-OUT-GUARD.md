# Opt-out guard integration

Reviewed PR #6, `feature/opt-out-guard` at `848c98e`, against main `ce0b29d`. Human approval to reopen prompts and raise the body limit to 140 words was relayed by B. The merge preserves the gentler L2 instruction from `81ce680`.

- Explicit skip/ignore requests in a chat with a current friction target are held on first send. The draft remains editable; a second send uses normal interception. Bypass retains its existing quota and resend behavior.
- L1–L3 tell Claude to decline requests to ignore the notes and point to Bypass. L4 is unchanged. The shared fake mirrors this line; grading, quiz cadence and mastery progression are unchanged.
- Integration review found stale held-text authorization could overwrite a later identical draft. The exception is now tied to the current composer and URL, invalidated on input, and consumed before a bypass rewrite. Regressions cover later identical drafts, composer replacement and editing/retyping.
- This phrase detector and same-role prompt instruction are best-effort guidance. They cannot guarantee Claude will resist arbitrary prompt injection. The detector intentionally does not classify every paraphrase.

Local checks: workspace typecheck, all 336 tests before the additional draft-safety regressions, and both builds passed. After the safety fix, all 129 extension tests, extension typecheck and the extension build passed. Independent read-only review found no remaining blockers and separately passed 65 focused extension checks and 10 template checks. The 140-word seed-template test passes with the merged L2 wording.

Live harness attempted with `pnpm --filter @friction/intelligence harness levels`; it stopped with `MODEL_CHAT is not set`. This environment has no `.env` or Anthropic credential, and prior live result files were preserved. No live-model or logged-in Claude success is claimed.

On the credentialed demo machine, pull final main, retain x64 Node and existing environment/database, rebuild/reload the extension and refresh Claude. Run the full live harness, including L1–L3, plus an explicit ignore-friction turn. Verify first-send hold, second-send guidance and actual Bypass quota/resend behavior in Claude. These remain open alongside the final smoke/rehearsal gates.
