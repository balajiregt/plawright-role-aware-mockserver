import { Locator, Page } from '@playwright/test';

export class OperationsConsolePage {
  readonly connectionStatus: Locator;
  readonly roleList: Locator;
  readonly workspaceTitle: Locator;
  readonly tokenProof: Locator;
  readonly workspaceSummary: Locator;
  readonly actionCount: Locator;
  readonly actionCards: Locator;
  readonly refreshButton: Locator;

  constructor(private readonly page: Page) {
    this.connectionStatus = page.getByTestId('connection-status');
    this.roleList = page.getByTestId('role-list');
    this.workspaceTitle = page.getByTestId('workspace-title');
    this.tokenProof = page.getByTestId('token-proof');
    this.workspaceSummary = page.getByTestId('workspace-summary');
    this.actionCount = page.getByTestId('action-count');
    this.actionCards = page.getByTestId('action-grid').getByRole('article');
    this.refreshButton = page.getByRole('button', { name: 'Refresh session', exact: true });
  }

  async open() {
    await this.page.goto('/');
  }

  async refresh() {
    await this.refreshButton.click();
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
