# Role-aware local benchmark

Run `npm ci`, `npm run benchmark` (Chromium must be installed), or `npm run benchmark:summary` after execution. `BENCHMARK_REPEATS=3` is the default; valid range 1–50. Ports 3433 and 5273 are isolated from the normal demo. `npm run benchmark:test` validates the summary denominator.

Both arms execute the same admin, viewer, VIP, downstream-error and expired-token UI journeys. Legacy interception fulfills synthetic responses in the browser; mockserver uses the real local demo backend and signed role tokens. Both arms also run an independent direct HTTP oracle against the same backend. Three direct backend missing/forged-token checks run separately. This is **not** a comparison against a real identity service or production environment. The demo permits loopback benchmark CORS and an explicitly named expired-token header to create deterministic fixtures.

Each successful journey attaches mode, scenario, repeat, programmatic setup time and journey-plus-oracle time. JSON results retain failures/skips and missing measurements; summary reports inconsistent repeated outcomes, report SHA256, revision and dirty-source flag. Human setup effort and diagnosis time are null until separately observed. Sequential samples and different browser request paths are confounders: do not turn the timings into causal speedup or financial savings claims. Reproducibility here means repeated outcomes for these five fixtures, not production flake rate.

Local validation 2026-10-11: 33/33 passed (15 journeys per arm, plus three direct token-rejection checks). No inconsistent scenario outcomes in that run. Generated evidence/traces are ignored in `benchmark-results/`; review aggregates before publication.

See [automatic dashboard publication](AUTOMATIC-PUBLICATION.md) for the canonical runner, CI, privacy controls and retry behaviour.
