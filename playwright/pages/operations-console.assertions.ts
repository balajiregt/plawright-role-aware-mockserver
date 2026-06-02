import { expect } from '@playwright/test';
import { OperationsConsolePage } from './operations-console.page';

export class OperationsConsoleAssertions {
  constructor(private readonly consolePage: OperationsConsolePage) {}

  async assertConnected() {
    await expect(this.consolePage.connectionStatus).toHaveText('Mockserver connected');
  }

  async assertRoles(expectedRoles: string[]) {
    await expect.poll(() => this.consolePage.rolesAsList()).toEqual(expectedRoles);
  }

  async assertWorkspaceTitle(title: string) {
    await expect(this.consolePage.workspaceTitle).toHaveText(title);
  }

  async assertActionVisible(actionId: string) {
    await expect(this.consolePage.action(actionId)).toBeVisible();
  }

  async assertActionNotAvailable(actionId: string) {
    await expect(this.consolePage.action(actionId)).toHaveCount(0);
  }

  async assertTokenContainsRole(role: string) {
    await expect(this.consolePage.tokenProof).toContainText(role);
  }
}
