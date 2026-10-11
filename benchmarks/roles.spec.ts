import { test, expect } from '@playwright/test';
import { mockAgentRoles, mockDownstreamServerError } from '../playwright/helpers/api-mock';
import { OperationsConsolePage } from '../playwright/pages/operations-console.page';
import { OperationsConsoleAssertions } from '../playwright/pages/operations-console.assertions';
const backend = 'http://127.0.0.1:3433';
const actions: Record<string, string[]> = { admin: ['admin-console', 'security-override', 'audit-log'], viewer: ['profile-search', 'read-only-dashboard', 'reports'], vip: ['vip-desk', 'priority-override', 'concierge-notes'] };
const titles: Record<string, string> = { admin: 'Admin Operations Workspace', viewer: 'Read-Only Viewer Workspace', vip: 'VIP Support Workspace' };
for (const mode of ['legacy-interception', 'mockserver'] as const) {
  for (const scenario of ['admin', 'viewer', 'vip', 'downstream-error', 'expired-token']) {
    test(`${mode} | ${scenario} @benchmark`, async ({ page, request }, info) => {
      const role = scenario in actions ? scenario : 'viewer';
      const setupStart = performance.now();
      if (mode === 'mockserver') {
        await mockAgentRoles(page, [role as 'admin' | 'viewer' | 'vip']);
        if (scenario === 'downstream-error') await mockDownstreamServerError(page);
        if (scenario === 'expired-token') await page.route('**/auth/token**', route => route.continue({ headers: { ...route.request().headers(), 'agent-roles': role, 'benchmark-expired-token': 'true' } }));
      } else {
        // Explicit comparison arm: browser-owned responses, not backend validation.
        await page.route('**/bff/v1/ui-config**', route => route.fulfill({ json: { featureFlags: {} } }));
        const token = [Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'), Buffer.from(JSON.stringify({ roles: [role], name: 'Synthetic user', iss: 'legacy' })).toString('base64url'), 'synthetic'].join('.');
        await page.route('**/bff/auth/token**', route => route.fulfill({ json: { id_token: token } }));
        await page.route('**/bff/v1/workspace**', route => route.fulfill({ status: scenario === 'expired-token' ? 401 : scenario === 'downstream-error' ? 503 : 200,
          json: scenario === 'expired-token' ? { message: 'Invalid bearer token' } : scenario === 'downstream-error' ? { message: 'Mocked downstream workspace service failure' } : {
            title: titles[role], roles: [role], actions: actions[role].map(id => ({ id, label: id, description: 'Synthetic fixture', category: 'Benchmark', level: 'read' })) } }));
      }
      const setupMs = performance.now() - setupStart;
      const journeyStart = performance.now();
      const consolePage = new OperationsConsolePage(page);
      const assertions = new OperationsConsoleAssertions(consolePage);
      await page.goto('/');
      if (scenario === 'expired-token' || scenario === 'downstream-error') {
        await expect(page.getByTestId('connection-status')).toHaveText('Mockserver error');
        await expect(page.getByTestId('workspace-summary')).toHaveText(scenario === 'expired-token' ? 'Invalid bearer token' : 'Mocked downstream workspace service failure');
        await expect(page.getByTestId('action-grid').locator('article')).toHaveCount(0);
      } else {
        await assertions.assertConnected(); await assertions.assertRoles([role]); await assertions.assertWorkspaceTitle(titles[role]);
        for (const id of actions[role]) await assertions.assertActionVisible(id);
        for (const [other, ids] of Object.entries(actions)) if (other !== role) for (const id of ids) await assertions.assertActionNotAvailable(id);
      }
      // Independent direct HTTP check, bypassing browser interception, for both arms.
      const tokenResponse = await request.post(`${backend}/bff/auth/token`, { headers: { 'agent-roles': role, ...(scenario === 'expired-token' ? { 'benchmark-expired-token': 'true' } : {}) }, data: { scope: 'openid profile' } });
      expect(tokenResponse.status()).toBe(200);
      const tokenBody = await tokenResponse.json();
      const response = await request.get(`${backend}/bff/v1/workspace`, { headers: { authorization: `Bearer ${tokenBody.id_token}`, ...(scenario === 'downstream-error' ? { 'downstream-error': 'true' } : {}) } });
      expect(response.status()).toBe(scenario === 'expired-token' ? 401 : scenario === 'downstream-error' ? 503 : 200);
      if (scenario in actions) expect((await response.json()).actions.map((a: { id: string }) => a.id)).toEqual(actions[role]);
      await info.attach('benchmark-measurement', { contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, mode, scenario, repeat: info.repeatEachIndex, setupMs, journeyAndOracleMs: performance.now() - journeyStart, humanSetupMs: null, diagnosisMs: null }) });
    });
  }
}
test('direct backend rejects missing and forged tokens @benchmark', async ({ request }) => {
  for (const headers of [{}, { authorization: 'Bearer forged' }]) expect((await request.get(`${backend}/bff/v1/workspace`, { headers })).status()).toBe(401);
});
