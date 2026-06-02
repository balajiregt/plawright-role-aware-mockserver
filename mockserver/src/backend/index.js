import Router from '@koa/router';
import { authorize } from './endpoints/auth/authorize.js';
import { token } from './endpoints/auth/token.js';
import { jwks } from './endpoints/auth/jwks.js';
import { wellKnown } from './endpoints/auth/well-known.js';
import { uiConfig } from './endpoints/v1/ui-config.js';
import { workspace } from './endpoints/v1/workspace.js';

export default function bffRoutes() {
  const router = new Router();

  router.get(/^\/auth\/authorize/, authorize);
  router.post(/^\/auth\/token/, token);
  router.get('/auth/jwks', jwks);
  router.get(/^\/auth\/(.*)v2.0\/\.well-known\/openid-configuration$/, wellKnown);

  router.get('/v1/ui-config', uiConfig);
  router.get('/v1/workspace', workspace);

  return router.routes();
}
