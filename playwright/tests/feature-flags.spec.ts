import { test, expect } from '@playwright/test';
import { AgentRole, mockAgentRoles, mockDownstreamServerError, setFeatureFlags } from '../helpers/api-mock';
import { OperationsConsoleAssertions } from '../pages/operations-console.assertions';
import { OperationsConsolePage } from '../pages/operations-console.page';

test('passes feature flag overrides through the mockserver config endpoint @roles', async ({ page }) => {
  await setFeatureFlags(page, {
    featureFlags: {
      vipToolsEnabled: false,
      adminToolsEnabled: true,
      readOnlyBannerEnabled: false,
    },
  });
  await mockAgentRoles(page, ['viewer']);

  await page.goto('/');

  await expect(page.getByTestId('feature-flag-state')).toContainText('vipToolsEnabled: false');
  await expect(page.getByTestId('feature-flag-state')).toContainText('readOnlyBannerEnabled: false');
});

test('can force a downstream workspace error without changing app code @roles', async ({ page }, testInfo) => {
  const [role] = testInfo.project.metadata.roles as AgentRole[];
  await mockAgentRoles(page, [role]);
  await mockDownstreamServerError(page);

  const failure = page.waitForResponse(response => new URL(response.url()).pathname === '/bff/v1/workspace');
  await page.goto('/');
  expect((await failure).status()).toBe(503);

  await expect(page.getByTestId('connection-status')).toHaveText('Mockserver error');
  await expect(page.getByTestId('workspace-summary')).toHaveText('Mocked downstream workspace service failure');
  await new OperationsConsoleAssertions(new OperationsConsolePage(page))
    .assertWorkspaceUnavailable('Mocked downstream workspace service failure');
});
