export async function uiConfig(ctx) {
  const overrideFeatureFlags = ctx.get('override-feature-flags');
  const defaultFeatureFlags = {
    vipToolsEnabled: true,
    adminToolsEnabled: true,
    readOnlyBannerEnabled: true,
  };

  ctx.status = 200;
  ctx.body = {
    azure: {
      issuerUri: 'http://127.0.0.1:3333/bff/auth',
      clientId: 'local-demo-client',
      apiScopes: ['openid', 'profile'],
    },
    featureFlags: overrideFeatureFlags
      ? JSON.parse(overrideFeatureFlags).featureFlags
      : defaultFeatureFlags,
  };
}
