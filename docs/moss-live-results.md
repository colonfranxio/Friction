# Moss authenticated trial — 2026-10-24

Implementation tested: `5355f1d`, branch `experiment/moss-retrieval`.

**Technical feasibility PASS. Keep normal API activation OFF: no incremental classification
benefit has been demonstrated over the existing complete-catalog classifier.**

## Measured results

Authenticated local indexing and semantic retrieval succeeded on Windows x64 using the
configured credentials. Only the synthetic React seed curriculum was indexed: 8 skills,
23 hand-labeled prompts, no student histories and no cloud index writes.

| Metric | Retrieval-only trial | Paired Claude trial |
| --- | ---: | ---: |
| Preparation time | 14,436 ms | 1,631 ms |
| Relevant/ambiguous prompts with an acceptable skill in top 3 | 19/19 | 19/19 |
| Observed warm retrieval p50 | 24 ms | 31 ms |
| Observed warm retrieval p95 | 96 ms | 105 ms |
| Keyword-only correct, including negatives | 12/23 | 12/23 |
| Existing classifier correct | Not run | 21/23 |
| Moss-assisted classifier correct | Not run | 23/23 |
| Existing classifier provider errors | Not run | 2 |
| Moss-assisted classifier provider errors | Not run | 0 |
| Healthy paired outcomes | Not run | 21; both correct |
| Unrelated prompts correctly rejected | Not evaluated as classification | 4/4 for both |

Preparation includes authentication, indexing and model warmup. The second run follows the
first and can reuse downloaded artifacts; neither duration should be assumed for another host.

The healthy-pair count includes 8 identical keyword fastpaths and 13 pairs of valid Claude
outputs. The two baseline errors occurred on the angle-bracket markup paraphrase (3,252 ms)
and shared-theme paraphrase (3,015 ms). Errors were recorded as `provider_error`; this report
does not infer a semantic failure or a proven Moss reliability advantage from them.

Observed healthy Claude pairs added 53 input tokens with retrieval hints; the complete
canonical catalog remained present. This experiment does not demonstrate token savings.

## Interpretation and limitations

- Moss is a working optional retrieval dependency on this machine. It is not needed to preserve
  the current demo's measured healthy classification accuracy.
- Retrieval returned candidates for all unrelated prompts. Directly treating its first result as
  a classification would remove the current abstention safeguard.
- Baseline always ran before experiment, and a diagnostic retrieval query immediately preceded
  each pair. Warm caches, provider variation, and call order can favor the experiment. Do not
  claim a causal speed or reliability improvement from these timings.
- Retrieving 3 of only 8 skills makes recall a modest gate. A larger realistic curriculum is needed
  to establish benefit. These seed-aligned synthetic examples are not held-out student data.
- No student-history retrieval, cross-tool memory, private-evidence isolation, or durable mastery
  behavior was tested. Grading, policies, shared contracts, dashboard and extension are unchanged.

## Independent verification

`verify_moss_live` independently read the original saved run, inspected the fixture and harness,
and confirmed final counts, both baseline errors, correct abstentions, recall, warm timing summary,
and the absence of demonstrated semantic-quality gains. Verdict: **GO to retain the isolated
experiment; NO-GO to activate it in normal API startup on this evidence.** Preparation durations
above come from the primary execution transcript rather than the verifier's retained captures.

Capture limitation: PowerShell initially saved the output as UTF-16. A subsequent incorrect UTF-8
normalization lost the disk copy. The invalid zero-case artifacts were removed. Results above
come from the original execution transcript and the verifier's independent original-file review;
this report does not claim a complete raw JSONL artifact was retained. No measurement was
reconstructed or rerun to obtain a preferred outcome.

## Next decision

Keep the separate branch and the explicitly injected adapter. Do not change ordinary API startup.
Revisit only with a larger course where the full-catalog baseline exhibits a measured problem.
Counterbalance model-call order and remove diagnostic prequeries before comparing latency.

Setup and reproducible trial commands: [feasibility report](moss-feasibility.md).
