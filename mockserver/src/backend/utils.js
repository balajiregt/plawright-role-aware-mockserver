export function parseCsvHeader(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function selectedPrimaryRole(roles) {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('vip')) return 'vip';
  return 'viewer';
}

export function tokenFromAuthHeader(ctx) {
  const authorization = ctx.get('authorization');
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
  return token;
}

