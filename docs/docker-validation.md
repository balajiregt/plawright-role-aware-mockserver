# Local Docker validation

Run the existing app, Koa mockserver and Playwright tests together in one Linux
container. The current servers and browser URLs use `127.0.0.1`, so this needs
no published ports or changes to their network configuration. Playwright's
existing `webServer` entries start both servers; `CI=1` disables server reuse.

The image pins Playwright **1.60.0**, matching the current lockfile. It installs
the locked packages with lifecycle scripts disabled and reuses the browsers in
the [official Playwright image](https://playwright.dev/docs/docker). Rebuild when
application or test source changes. When updating Playwright, align the image
tag and version guard with the lockfile in the same change.

## Build and run

Run from this repository. Use a fresh, ignored evidence directory for each run:

```sh
docker build --file Dockerfile.playwright --tag role-aware-playwright:1.60.0 .

mkdir -p artifacts/agent-tasks/UI-WORKSPACE-REFRESH-001
report_dir="$(mktemp -d "$PWD/artifacts/agent-tasks/UI-WORKSPACE-REFRESH-001/docker-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"

docker run --rm --init --network=none --cpus=2 --memory=3g --shm-size=1g \
  --user "$(id -u):$(id -g)" --env HOME=/tmp \
  --mount "type=bind,src=$report_dir,dst=/evidence" \
  role-aware-playwright:1.60.0
```

The image defaults to nonroot `pwuser`. The run command selects the host user's
nonroot UID/GID so the new bind-mounted directory remains writable without
changing host ownership. Use one worker and zero retries to preserve first-run
outcomes. The default command selects the existing `@roles` suite across admin,
viewer and VIP projects.

The run has no external network access and uses bounded CPU/memory. All browser
requests stay inside the container; package downloads happen during the build.

Outputs are `playwright.json`, `html/index.html`, and `test-results/` under the
selected evidence directory. Failure screenshots and traces follow the existing
Playwright configuration. Retain the container exit code and console output as
well; absent JSON after a setup failure is not a passing run.

Typecheck the same built source separately:

```sh
docker run --rm --init --user "$(id -u):$(id -g)" --env HOME=/tmp \
  role-aware-playwright:1.60.0 \
  node node_modules/typescript/bin/tsc -p playwright/tsconfig.json --noEmit
```

For all existing browser tests, replace the default command after the image
name with:

```sh
npm run test:e2e -- --workers=1 --retries=0 \
  --reporter=list,json,html --output=/evidence/test-results
```

## Evidence and limits

Record the source commit and any working-tree changes, source/lockfile hashes,
image ID/digest, architecture, actual Node and Playwright versions, command,
timestamp, exit code and report paths. The file-specific
[build exclusions](../Dockerfile.playwright.dockerignore) keep private contexts,
reports, credentials and host dependencies out of the image. Only the selected
fresh output directory is mounted; no Docker socket or host home is needed.

This runs application tests using the existing assertions. It does not establish
complete acceptance coverage, run a mutation campaign, measure an authoring
agent or execute a Supercheck comparison. Review criteria against the actual
assertions and retain separately requested mutation evidence. It makes no model
or provider calls. Docker execution and compatibility must be recorded from an
actual run; this guide alone is not runtime evidence.
