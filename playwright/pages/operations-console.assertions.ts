import { expect } from '@playwright/test';
import { OperationsConsolePage } from './operations-console.page';

export class OperationsConsoleAssertions {
  constructor(private readonly consolePage: OperationsConsolePage) {}

  async assertConnected() {
    await expect(this.consolePage.connectionStatus).toHaveText('Mockserver connected');
  }

  async assertWorkspaceUnavailable(message: string) {
    await expect(this.consolePage.connectionStatus).toHaveText('Mockserver error');
    await expect(this.consolePage.connectionStatus).toHaveAttribute('data-state', 'error');
    await this.assertWorkspaceTitle('Workspace unavailable');
    await expect(this.consolePage.workspaceSummary).toHaveText(message);
    await expect(this.consolePage.actionCards).toHaveCount(0);
    await expect(this.consolePage.actionCount).toHaveText('0 actions');
  }

  async assertWorkspaceCatalog(expected: { title: string; summary: string; visible: string[] }) {
    await this.assertConnected();
    await expect(this.consolePage.connectionStatus).toHaveAttribute('data-state', 'ready');
    await this.assertWorkspaceTitle(expected.title);
    await expect(this.consolePage.workspaceSummary).toHaveText(expected.summary);
    await expect(this.consolePage.actionCount).toHaveText('3 actions');
    await expect(this.consolePage.actionCards).toHaveCount(3);
    await expect.poll(() => this.consolePage.actionCards.evaluateAll(cards =>
      cards.map(card => card.getAttribute('data-testid')),
    )).toEqual(expected.visible.map(id => `action-${id}`));
    for (const id of expected.visible) {
      await this.assertActionVisible(id);
    }
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
