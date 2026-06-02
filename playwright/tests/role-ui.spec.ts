import { test } from '@playwright/test';
import { AgentRole, mockAgentRoles } from '../helpers/api-mock';
import { OperationsConsoleAssertions } from '../pages/operations-console.assertions';
import { OperationsConsolePage } from '../pages/operations-console.page';

const expectations: Record<AgentRole, {
  title: string;
  visible: string[];
  hidden: string[];
}> = {
  admin: {
    title: 'Admin Operations Workspace',
    visible: ['admin-console', 'security-override', 'audit-log'],
    hidden: ['profile-search', 'vip-desk', 'concierge-notes'],
  },
  viewer: {
    title: 'Read-Only Viewer Workspace',
    visible: ['profile-search', 'read-only-dashboard', 'reports'],
    hidden: ['admin-console', 'security-override', 'vip-desk'],
  },
  vip: {
    title: 'VIP Support Workspace',
    visible: ['vip-desk', 'priority-override', 'concierge-notes'],
    hidden: ['admin-console', 'profile-search', 'audit-log'],
  },
};

test.describe('@local @roles GIVEN the agent opens the role-aware operations console', () => {
  let operationsConsole: OperationsConsolePage;
  let operationsAssertions: OperationsConsoleAssertions;

  test.beforeEach(async ({ page }) => {
    operationsConsole = new OperationsConsolePage(page);
    operationsAssertions = new OperationsConsoleAssertions(operationsConsole);
  });

  test('renders the correct workspace and actions for the injected role', async ({ page }, testInfo) => {
    const [role] = testInfo.project.metadata.roles as AgentRole[];
    const expected = expectations[role];

    await test.step(`GIVEN the agent has the '${role}' role`, async () => {
      await mockAgentRoles(page, [role]);
    });

    await test.step('WHEN the operations console is opened', async () => {
      await operationsConsole.open();
      await operationsAssertions.assertConnected();
    });

    await test.step('THEN the roles from the mocked id_token are visible', async () => {
      await operationsAssertions.assertRoles([role]);
      await operationsAssertions.assertTokenContainsRole(role);
    });

    await test.step('AND the role-specific workspace is rendered', async () => {
      await operationsAssertions.assertWorkspaceTitle(expected.title);
    });

    await test.step('AND only the allowed actions are available', async () => {
      for (const action of expected.visible) {
        await operationsAssertions.assertActionVisible(action);
      }

      for (const action of expected.hidden) {
        await operationsAssertions.assertActionNotAvailable(action);
      }
    });
  });

  test("Agent with only 'admin' role can access admin-only actions", async ({ page }) => {
    await test.step("GIVEN the agent has the 'admin' role", async () => {
      await mockAgentRoles(page, ['admin']);
    });

    await test.step('WHEN the operations console is opened', async () => {
      await operationsConsole.open();
      await operationsAssertions.assertConnected();
    });

    await test.step('THEN they can see the correct role against their account', async () => {
      await operationsAssertions.assertRoles(['admin']);
    });

    await test.step('AND admin-only actions are available', async () => {
      await operationsAssertions.assertActionVisible('admin-console');
      await operationsAssertions.assertActionVisible('security-override');
      await operationsAssertions.assertActionVisible('audit-log');
    });
  });

  test("Agent without 'admin' role cannot access admin-only actions", async ({ page }) => {
    await test.step("GIVEN the agent does not have the 'admin' role", async () => {
      await mockAgentRoles(page, ['viewer', 'vip']);
    });

    await test.step('WHEN the operations console is opened', async () => {
      await operationsConsole.open();
      await operationsAssertions.assertConnected();
    });

    await test.step('THEN they can see the correct roles against their account', async () => {
      await operationsAssertions.assertRoles(['viewer', 'vip']);
    });

    await test.step('AND admin-only actions are not available', async () => {
      await operationsAssertions.assertActionNotAvailable('admin-console');
      await operationsAssertions.assertActionNotAvailable('security-override');
      await operationsAssertions.assertActionNotAvailable('audit-log');
    });
  });

  test('supports multiple roles with admin taking precedence', async ({ page }) => {
    await test.step("GIVEN the agent has 'viewer', 'vip', and 'admin' roles", async () => {
      await mockAgentRoles(page, ['viewer', 'vip', 'admin']);
    });

    await test.step('WHEN the operations console is opened', async () => {
      await operationsConsole.open();
      await operationsAssertions.assertConnected();
    });

    await test.step('THEN the admin workspace takes precedence', async () => {
      await operationsAssertions.assertRoles(['viewer', 'vip', 'admin']);
      await operationsAssertions.assertWorkspaceTitle('Admin Operations Workspace');
      await operationsAssertions.assertActionVisible('admin-console');
    });
  });
});
