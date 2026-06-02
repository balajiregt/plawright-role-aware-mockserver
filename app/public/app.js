const apiBase = 'http://127.0.0.1:3333/bff';

const elements = {
  connectionStatus: document.querySelector('[data-testid="connection-status"]'),
  userName: document.querySelector('[data-testid="user-name"]'),
  roleList: document.querySelector('[data-testid="role-list"]'),
  featureFlagState: document.querySelector('[data-testid="feature-flag-state"]'),
  workspaceTitle: document.querySelector('[data-testid="workspace-title"]'),
  workspaceSummary: document.querySelector('[data-testid="workspace-summary"]'),
  refreshButton: document.querySelector('[data-testid="refresh-button"]'),
  actionCount: document.querySelector('[data-testid="action-count"]'),
  actionGrid: document.querySelector('[data-testid="action-grid"]'),
  tokenProof: document.querySelector('[data-testid="token-proof"]'),
};

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  return JSON.parse(json);
}

async function getJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || `Request failed: ${path}`);
  }

  return body;
}

async function loadSession() {
  elements.connectionStatus.textContent = 'Loading config';
  elements.connectionStatus.dataset.state = 'loading';

  const config = await getJson('/v1/ui-config');
  const tokenResponse = await getJson('/auth/token?client-request-id=role-demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      scope: 'openid profile',
      refresh_token: 'local-demo-refresh-token',
    }),
  });

  const tokenPayload = decodeJwtPayload(tokenResponse.id_token);
  const workspace = await getJson('/v1/workspace', {
    headers: {
      authorization: `Bearer ${tokenResponse.id_token}`,
    },
  });

  render({ config, tokenPayload, workspace });
}

function render({ config, tokenPayload, workspace }) {
  const roles = tokenPayload.roles?.length ? tokenPayload.roles : ['viewer'];
  const flags = config.featureFlags || {};
  const flagEntries = Object.entries(flags).map(([key, value]) => `${key}: ${value}`);

  elements.connectionStatus.textContent = 'Mockserver connected';
  elements.connectionStatus.dataset.state = 'ready';
  elements.userName.textContent = tokenPayload.name;
  elements.roleList.textContent = roles.join(', ');
  elements.featureFlagState.textContent = flagEntries.join(', ') || 'none';
  elements.workspaceTitle.textContent = workspace.title;
  elements.workspaceSummary.textContent = workspace.summary;
  elements.actionCount.textContent = `${workspace.actions.length} actions`;

  elements.actionGrid.replaceChildren();
  for (const action of workspace.actions) {
    const card = document.createElement('article');
    card.className = `action-card action-${action.level}`;
    card.dataset.testid = `action-${action.id}`;
    card.innerHTML = `
      <span>${action.category}</span>
      <h3>${action.label}</h3>
      <p>${action.description}</p>
    `;
    elements.actionGrid.append(card);
  }

  elements.tokenProof.textContent = JSON.stringify(
    {
      tokenRoles: roles,
      tokenIssuer: tokenPayload.iss,
      workspaceActions: workspace.actions.map((action) => action.id),
    },
    null,
    2,
  );
}

elements.refreshButton.addEventListener('click', () => {
  loadSession().catch((error) => {
    elements.connectionStatus.textContent = 'Mockserver error';
    elements.connectionStatus.dataset.state = 'error';
    elements.workspaceSummary.textContent = error.message;
  });
});

loadSession().catch((error) => {
  elements.connectionStatus.textContent = 'Mockserver error';
  elements.connectionStatus.dataset.state = 'error';
  elements.workspaceSummary.textContent = error.message;
});
