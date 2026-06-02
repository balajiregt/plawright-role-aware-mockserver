import { issuerUri } from '../../../mock-server.js';

export async function wellKnown(ctx) {
  ctx.status = 200;
  ctx.body = {
    issuer: issuerUri,
    authorization_endpoint: `${issuerUri}/authorize`,
    token_endpoint: `${issuerUri}/token`,
    jwks_uri: `${issuerUri}/jwks`,
  };
}

