import Koa from 'koa';
import Router from '@koa/router';
import mount from 'koa-mount';
import cors from '@koa/cors';
import bodyParser from '@koa/bodyparser';
import { generateKeyPairSync } from 'node:crypto';
import bffRoutes from './backend/index.js';

export const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

export const issuerUri = 'http://127.0.0.1:3333/bff/auth';

const app = new Koa();
const router = new Router();
const port = Number(process.env.MOCKSERVER_PORT ?? 3333);

app.use(cors({
  origin: (ctx) => ['http://127.0.0.1:5173', 'http://127.0.0.1:5273'].includes(ctx.get('Origin')) ? ctx.get('Origin') : '',
  credentials: true,
  allowHeaders: ['content-type', 'authorization', 'agent-roles', 'override-feature-flags', 'downstream-error', 'benchmark-expired-token'],
}));

app.use(bodyParser());

router.get('/', (ctx) => {
  ctx.body = 'BFF mock server';
});

app.use(router.routes()).use(router.allowedMethods());
app.use(mount('/bff', bffRoutes()));

app.listen(port, '127.0.0.1', () => {
  console.log(`Role-aware BFF mockserver running at http://127.0.0.1:${port}`);
});
