# Automatic dashboard updates

Run `npm run benchmark`. The complete fixed protocol runs, validates source evidence,
and publishes sanitised aggregates to this repository's `benchmark-results` branch.
The shared [dashboard](https://framework-benchmarks-balaji.netlify.app) refreshes
all four feeds every minute while visible. GitHub CDN caching can add a few minutes.
No dashboard import, source commit or Netlify deployment is needed for data updates.

Requires Python 3.10+, Git with push access, and the project's existing benchmark
runtime/dependencies. Browser projects need `npx playwright install chromium`;
the API needs Java 17+ and Maven. JEV needs its existing provider configuration;
missing credentials, provider errors and incomplete runs are visible as unavailable
or blocked, never model accuracy. Only JEV's explicit manual CI dispatch attempts
live evaluation; ordinary source pushes do not initiate paid model calls.

`BENCHMARK_PUBLISH=0 npm run benchmark` runs privately and prepares the ignored
public aggregate without sending it. Use this for forks, sensitive experiments
and offline work. The configured public destination is Balaji's named repository,
including when the sample project is nested in a larger local workspace.

Publication failures retain evidence locally and return a nonzero exit code.
`npm run benchmark:publish` retries publication without rerunning the benchmark.
The retry uses the original receipt and hashes; it cannot manufacture fresh results.
A run killed before publication cannot update GitHub; CI's always-run publication
step captures an incomplete receipt when possible. Interrupted local runs may leave
`benchmark-results/dashboard-run.lock`; remove it only after confirming its process
has stopped. There is no background daemon watching arbitrary files.

The supported `npm run benchmark` entry point is the automatic path. Harness
`benchmark:oracle` and `benchmark:mutation` now invoke the complete protocol so a
partial rerun cannot mix old and new reports. JEV `benchmark:crm:live` is an alias.
`benchmark:collect` in API/harness also republishes validated trial aggregates after
a previous complete benchmark. Direct Playwright/Maven/evaluator commands, preview,
unit tests and metrics-only commands do not publish. A standalone collector without
a prior benchmark receipt must first run the complete benchmark.

## Evidence and privacy

The runner clears protocol outputs before execution, records start/finish, exit code,
source revision and dirty state, and verifies report hashes, fixed case identities,
denominators, retry counts and freshness. A failed or incomplete attempt replaces
the current status; earlier evidence stays in the last 50 attempts. This is
self-published synthetic evidence, not an independent audit or production claim.
Trial metadata remains self-reported; live-agent and scripted evidence stay separate.

Only the closed public schema and versioned text vocabulary leave the checkout.
Unexpected free text is withheld; unknown keys fail export. Raw reports, traces,
logs, prompts, model outputs, gold labels, local paths, tokens and reviewer notes
remain ignored. New cases require a reviewed protocol/vocabulary update.

GitHub Actions uses its own repository-scoped `GITHUB_TOKEN` with contents:write.
Local publication uses the existing Git credential helper. No shared PAT or Netlify
secret is copied into these repos. Each push is fast-forward only; bounded retries
merge concurrent histories and older-started runs cannot replace a newer attempt.
Repeated publication of the same receipt/data is idempotent. Branch protection or
Actions policy may prevent publication; those failures are not silently ignored.

The common implementation is maintained in `framework-benchmark-dashboard/automation`
and synchronised to these checked-in copies with its `scripts/install-automation.py`.
