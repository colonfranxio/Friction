# CP3 dashboard integration — 2026-10-24

**C is integrated; the full CP3 acceptance/freeze remains open.** Contract stays **v4**. Shipping code merge: `a754560f51cba1e1064d4ec5054a6a0104a3a0ee` (documentation follows). No contract or builder-source fixes were made by E.

| Agent | Integrated in this round? | Result |
|---|---|---|
| B Intelligence | Yes — `f7113fd`, merge `4eb61f4` | Status-only whole-class parse request; B's previously merged code/prompts remain unchanged. |
| A Platform | **Held** — `d6badeb` | Candidate API READY implementation passed transport/browser checks but introduced a reproducible intermittent API test failure; owner correction required. Shipping API remains at the previously integrated implementation. |
| C Dashboard | **Yes — `d7866f8`, merge `a754560`** | Exact quiz metadata, interrupted-reply recovery, guarded v4 token resend on the mock, safe formatted replies, responsive controls, aligned pillars and polish. |
| D Extension | No new merge | `dcc2f9d` observed; extension integration was not part of this C handoff. Existing extension is unchanged. |

Ownership checks, cross-platform package scripts and conflict checks passed. E attempted B → A → C, isolated A's failed gate, then integrated eligible B → C. No lockfile reconciliation was needed. A and the initial combined candidate remain preserved in their source refs and local `integration/c-cp3-candidate` (`d652717`); no builder branch or remote history was rewritten.

## Shipping validation

On `a754560`:

- Frozen installation and workspace typecheck: **PASS**.
- Root tests: **181 PASS across 18 files** — shared 26, intelligence 42, dashboard 9, extension 35, API 57, scripts 12.
- Dashboard production build and extension build: **PASS**.
- Standalone quiet-cancellation regression: **PASS**. Standalone upstream stream-failure regression: **FAIL**, the known old API clean-EOF limitation; A's held implementation fixes it, but is not shipping yet.
- Real API with shared fakes, isolated in-memory store on E port 8791: browser demo **PASS** (upload, reply metadata, live mastery in all views, new chat, legacy bypass/toast, quota, reset and mobile). No v4 rollout SHA was set for this shipping-API run.
- Current dashboard's sequential private-mock checks: **PASS** for v4 quiz/token/expiry/draft/history/interruption/cancellation, CP3 animations/reduced motion, resilience/PDF transport and full educator editing. The first overlapped mock attempt was invalidated and discarded; the reported passes come from the serialized rerun. Dashboard/shared/mock code is identical between the candidate run and shipping merge.
- Screenshot evidence from E is under `/tmp/friction-cp3-evidence/`; C's committed desktop/laptop/mobile evidence is under `apps/dashboard/test/artifacts/ui-review/`. Independent review inspected laptop sandbox/mobile educator images; E inspected the rerun mastery image. The visual script hardcodes C's ports, so E did not run it against or reset C's services.

- Shipping real-API/fake smoke: **16/16 PASS** on private 8791. Private v4 mock smoke: **17/17 PASS** on 8792. Extension background/API integration: **9/9 PASS** against 8791 (these overlap existing unit cases; not added to the 181-test count).

All E service checks use private ports/stores; existing A/C/D services and stored demo data were left alone. Browser/smoke writers were serialized per backend for the reported results.

Independent verifier `verify_c_cp3` used the user-agreed **gpt-6.1-sol, medium** substitute for unavailable Sonnet 5.5. It reviewed source/ownership, independently reproduced A's timestamp-tie failure with a memory-only probe, checked final B+C ancestry/A exclusion and conservative real-API fallback, and passed dashboard tests **9/9**. No source/ref/service mutations by the verifier.

## A's exact blocking handoff

The first root run on combined candidate `d652717` failed at `apps/api/test/api.test.ts:330`:

```text
prompt scope: one quota, no pause, mastery untouched, pending quiz closed, educator events as before
expected items[0].kind = bypass; received intercept
```

This explains A's previously reported unexplained intermittent failure. `routes/trees.ts` builds intercept items before bypass items and sorts only by `created_at`. Equal millisecond timestamps retain `[intercept, bypass]`; making the bypass timestamp 1ms later yields `[bypass, intercept]`. Both records, events and quota behavior are correct. The test incorrectly assumes a unique newest timestamp. The next full candidate suite passed 196 tests, but that retry does not close the known defective gate.

**A:** fix the assertion in your owned test to find and validate the bypass item independently of equal-timestamp ordering; retain quota, state, pending-quiz and event assertions. Do not add sleeps, manufacture timestamps or weaken product behavior. Push the correction with API tests/typecheck and both standalone stream/abort tools passing. E will re-merge and verify the corrected API before enabling C's real prompt-bypass path. A's candidate transport tools and fake-backed v4 17-step smoke passed, and C's API-backed browser flow passed with the rollout SHA set; those are candidate evidence only.

## Rollout and remaining order

1. **C can merge main now.** C CP3 UI is integrated. Keep `VITE_PROMPT_BYPASS_API_READY_SHA` **unset for the current real API**. Health contract v4 alone is insufficient: without an approved rollout SHA C sends only the legacy bypass payload, does not resend, and labels pause-until-reset. The v4 mock supports the guarded one-prompt flow.
2. **A corrects the test and pushes API READY.** E re-merges A, runs root/API/transport/token smoke and C browser checks, then records the approved full SHA and rollout setting. Do not enable an old server merely by providing an arbitrary 40-character SHA.
3. **D remains separate.** Review its READY handoff, prompt-scope consent/chat/draft guards and human live GO/NO-GO before a later integration. No new extension functionality is claimed here.
4. **B CR-2 remains a request.** Whole-class assignment after a non-demo syllabus parse is not implemented or accepted by this status merge. Its scope/contract decision belongs in a coordinated pre-freeze handoff; today's real parse still moves the demo student only.
5. **E + human close real acceptance:** three consecutive real-Claude smoke passes on final merged code, all six real-model browser must-haves, Windows verification if supported, two rehearsals and a backup recording. No credentials are configured in this cloud instance; fake/injected checks and builders' external live evidence do not replace these gates. No final CP3 freeze is claimed.

## Messages to agents

- **C:** "CP3 dashboard `d7866f8` merged at `a754560`. Merge main and confirm v4. Mock acceptance passed; real API prompt bypass is still gated until A's corrected merge. Preserve your completed UI."
- **A:** "API READY `d6badeb` held for the deterministic timestamp-tie assertion at api.test.ts:330. Find the bypass item instead of assuming index zero; retain all behavior checks. Push correction, then E reruns and enables the rollout."
- **B:** "Status `f7113fd` merged. CR-2 is recorded as pending; frozen prompts/code unchanged."
- **D:** "No new D merge in this C checkpoint. Keep your handoff separate; final API/client integration and human live GO remain pending."
