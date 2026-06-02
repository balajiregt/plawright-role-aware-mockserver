import { test, expect } from '@playwright/test';
import { mockAgentRoles, mockDownstreamServerError, setFeatureFlags } from '../helpers/api-mock';

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

test('can force a downstream workspace error without changing app code @roles', async ({ page }) => {
  await mockAgentRoles(page, ['admin']);
  await mockDownstreamServerError(page);

  await page.goto('/');

  await expect(page.getByTestId('connection-status')).toHaveText('Mockserver error');
  await expect(page.getByTestId('workspace-summary')).toHaveText('Mocked downstream workspace service failure');
});
