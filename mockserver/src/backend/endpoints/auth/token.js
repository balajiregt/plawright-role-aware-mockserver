import jwt from 'jsonwebtoken';
import { issuerUri, privateKey } from '../../../mock-server.js';
import { parseCsvHeader } from '../../utils.js';

export async function token(ctx) {
  const roles = parseCsvHeader(ctx.get('agent-roles'));
  const normalizedRoles = roles.length ? roles : ['viewer'];
  const now = Math.floor(Date.now() / 1000);

  const accessTokenPayload = {
    sub: 'local-demo-user',
    aud: 'identity-manager-api',
    iss: issuerUri,
    scp: `${ctx.request.body?.scope || 'openid profile'} User.Read User.Write`,
    iat: now,
    exp: now + 3600,
  };

  const idTokenPayload = {
    sub: 'local-demo-user',
    aud: 'identity-manager-frontend',
    iss: issuerUri,
    name: 'Role Demo User',
    preferred_username: 'role.demo@example.test',
    iat: now,
    exp: now + 3600,
    roles: normalizedRoles,
  };

  const signOptions = {
    algorithm: 'RS256',
    keyid: 'local-demo-key-id',
  };

  ctx.status = 200;
  ctx.body = {
    token_type: 'Bearer',
    scope: `${ctx.request.body?.scope || 'openid profile'} User.Read`,
    expires_in: 3600,
    access_token: jwt.sign(accessTokenPayload, privateKey, signOptions),
    refresh_token: ctx.request.body?.refresh_token || 'local-refresh-token',
    id_token: jwt.sign(idTokenPayload, privateKey, signOptions),
  };
}
