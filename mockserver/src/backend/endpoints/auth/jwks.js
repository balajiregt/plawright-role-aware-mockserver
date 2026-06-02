import { publicKey } from '../../../mock-server.js';

export async function jwks(ctx) {
  const publicKeyJwk = publicKey.export({ format: 'jwk' });

  ctx.status = 200;
  ctx.body = {
    keys: [
      {
        kty: publicKeyJwk.kty,
        use: 'sig',
        kid: 'local-demo-key-id',
        alg: 'RS256',
        n: publicKeyJwk.n,
        e: publicKeyJwk.e,
      },
    ],
  };
}

