# Moss focused verification

Checked candidate `002ef2c`, whose API/intelligence/shared implementation is identical to main `b113cf5`. No runtime source, configuration bindings or existing services were changed for this check.

| Check | Result |
|---|---|
| Intelligence Moss adapter + missing-native-module tests | PASS — 23 tests |
| API Moss runtime tests | PASS — 21 tests |
| Intelligence and API typecheck | PASS |
| `moss:trial --check-sdk` | PASS — native SDK loads/constructs/closes on Linux; authenticated=false |
| `moss:trial` authenticated retrieval | NOT RUN — explicit credentials_missing, exit2 |

Commands executed using the installed workspace dependencies:

```text
pnpm --filter @friction/intelligence exec vitest run test/moss.test.ts test/moss-native-missing.test.ts
pnpm --filter @friction/api exec vitest run test/moss-runtime.test.ts
pnpm --filter @friction/intelligence typecheck
pnpm --filter @friction/api typecheck
pnpm --filter @friction/intelligence moss:trial --check-sdk
pnpm --filter @friction/intelligence moss:trial
```

The 44 focused tests cover default-on with real intelligence/credentials, opt-out, missing credentials, fake-mode isolation, native absence, real loader/API composition with injected providers, keyword preservation, full-catalog Claude hints/abstention, canonical IDs, stale snapshots/edits/deletes/reset, warmup, pool capacity, bounded query waiting, retry and disposal races. Injected providers do not prove live authentication or live embedding/search.

Independent read-only `verify_moss_checks` (agreed gpt-6.1-sol medium substitute) found no Moss blocker: activation, freshness, two-course cap, single outstanding native query, fallback and store-flush/native-shutdown sequencing match the documented design. A permanently hung native operation can stall preparation; baseline API remains available. No accuracy-gain claim is established.

The saved live artifact at `apps/api/harness/results/2026-10-25T00-32-07-163Z-7b01b7c/moss-live.json` records real retrieval candidates including Context API, its selection at L2, quiz/grading progression and injected fallback checks. The harness asserts the expected canonical candidate ID before serializing names. The relevant runtime and harness implementation is unchanged since that revision, but this is historical evidence, not a fresh authenticated run here.

No root .env or exported Claude/Moss/model configuration is present in this instance. Use existing secure configuration on the credentialed demo machine for `pnpm --filter @friction/api moss:live`; preserve its new SHA-tagged evidence. Do not paste credentials into chat or tracked files. Missing credentials are an environment blocker, not a failed retrieval result.

**Conclusion:** local Moss logic, native loading and failure handling pass. Fresh authenticated Moss/Claude retrieval remains unverified in this instance. The separate combined learning-map release blockers remain as recorded in [the candidate report](MOSS-LEARNING-MAP-CANDIDATE.md).
