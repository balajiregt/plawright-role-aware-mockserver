import { Page } from '@playwright/test';

export type AgentRole = 'admin' | 'viewer' | 'vip';

export type FeatureFlagSetup = {
  featureFlags: {
    vipToolsEnabled?: boolean;
    adminToolsEnabled?: boolean;
    readOnlyBannerEnabled?: boolean;
  };
};

export async function mockAgentRoles(page: Page, roles: AgentRole[]) {
  await page.route('**/auth/token**', async (route, request) => {
    await route.continue({
      headers: {
        ...request.headers(),
        'agent-roles': roles.join(','),
      },
    });
  });
}

export async function setFeatureFlags(page: Page, featureFlagSetup: FeatureFlagSetup) {
  await page.route('**/v1/ui-config**', async (route, request) => {
    await route.continue({
      headers: {
        ...request.headers(),
        'override-feature-flags': JSON.stringify(featureFlagSetup),
      },
    });
  });
}

export async function mockDownstreamServerError(page: Page) {
  await page.route('**/bff/v1/workspace**', async (route, request) => {
    await route.continue({
      headers: {
        ...request.headers(),
        'downstream-error': 'true',
      },
    });
  });
}
