import { Locator, Page } from '@playwright/test';

export class OperationsConsolePage {
  readonly connectionStatus: Locator;
  readonly roleList: Locator;
  readonly workspaceTitle: Locator;
  readonly tokenProof: Locator;

  constructor(private readonly page: Page) {
    this.connectionStatus = page.getByTestId('connection-status');
    this.roleList = page.getByTestId('role-list');
    this.workspaceTitle = page.getByTestId('workspace-title');
    this.tokenProof = page.getByTestId('token-proof');
  }

  async open() {
    await this.page.goto('/');
  }

  action(actionId: string) {
    return this.page.getByTestId(`action-${actionId}`);
  }

  async rolesAsList() {
    const roles = await this.roleList.textContent();
    return (roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }
}
