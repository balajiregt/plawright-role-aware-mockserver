import { expect, test } from '@playwright/test';

function base64Url(value: object) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function unsignedDemoToken(roles: string[]) {
  return [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'identity-manager-frontend',
      iss: 'legacy-playwright-interception',
      name: 'Legacy Intercepted User',
      roles,
      sub: 'legacy-intercepted-user',
    }),
    'legacy-interception-signature',
  ].join('.');
}

test('legacy integration-style interception can force admin UI without mockserver behavior @legacy-interception', async ({
  page,
}) => {
  await page.route('**/bff/v1/ui-config**', async (route) => {
    await route.fulfill({
      json: {
        azure: {
          issuerUri: 'https://real-int-idp.example/auth',
          clientId: 'real-int-client',
          apiScopes: ['openid', 'profile'],
        },
        featureFlags: {
          vipToolsEnabled: true,
          adminToolsEnabled: true,
          readOnlyBannerEnabled: false,
        },
      },
    });
  });

  await page.route('**/bff/auth/token**', async (route) => {
    await route.fulfill({
      json: {
        access_token: 'legacy-intercepted-access-token',
        id_token: unsignedDemoToken(['admin']),
        token_type: 'Bearer',
        expires_in: 3600,
      },
    });
  });

  await page.route('**/bff/v1/workspace**', async (route) => {
    await route.fulfill({
      json: {
        primaryRole: 'admin',
        roles: ['admin'],
        title: 'Admin Operations Workspace',
        summary: 'Directly fulfilled by Playwright instead of a mockserver-owned response.',
        actions: [
          {
            id: 'admin-console',
            category: 'Administration',
            label: 'User Admin Console',
            description: 'Create, disable, and update operator access.',
            level: 'critical',
          },
          {
            id: 'security-override',
            category: 'Security',
            label: 'Security Override',
            description: 'Apply controlled exception handling for locked profiles.',
            level: 'critical',
          },
        ],
      },
    });
  });

  await page.goto('/');

  await expect(page.getByTestId('role-list')).toHaveText('admin');
  await expect(page.getByTestId('workspace-title')).toHaveText('Admin Operations Workspace');
  await expect(page.getByTestId('workspace-summary')).toHaveText(
    'Directly fulfilled by Playwright instead of a mockserver-owned response.',
  );
  await expect(page.getByTestId('action-admin-console')).toBeVisible();
  await expect(page.getByTestId('action-security-override')).toBeVisible();
});
