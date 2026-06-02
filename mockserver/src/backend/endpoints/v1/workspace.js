import jwt from 'jsonwebtoken';
import { publicKey } from '../../../mock-server.js';
import { selectedPrimaryRole, tokenFromAuthHeader } from '../../utils.js';

const actionCatalog = {
  admin: {
    title: 'Admin Operations Workspace',
    summary: 'Full operational access for identity management, security overrides, and audit review.',
    actions: [
      {
        id: 'admin-console',
        category: 'Administration',
        label: 'User Admin Console',
        description: 'Create, disable, and update operator access.',
        level: 'critical',
      },
      {
        id: 'security-override',
        category: 'Security',
        label: 'Security Override',
        description: 'Apply controlled exception handling for locked profiles.',
        level: 'critical',
      },
      {
        id: 'audit-log',
        category: 'Audit',
        label: 'Audit Log',
        description: 'Review privileged account activity and test evidence.',
        level: 'elevated',
      },
    ],
  },
  viewer: {
    title: 'Read-Only Viewer Workspace',
    summary: 'Limited access for profile lookup, operational reports, and non-mutating investigation.',
    actions: [
      {
        id: 'profile-search',
        category: 'Lookup',
        label: 'Profile Search',
        description: 'Search identity records without write permissions.',
        level: 'read',
      },
      {
        id: 'read-only-dashboard',
        category: 'Dashboard',
        label: 'Read-Only Dashboard',
        description: 'Inspect current account status and service links.',
        level: 'read',
      },
      {
        id: 'reports',
        category: 'Reports',
        label: 'View Reports',
        description: 'Open aggregate operational reports.',
        level: 'read',
      },
    ],
  },
  vip: {
    title: 'VIP Support Workspace',
    summary: 'Specialist tools for high-priority profiles, priority handling, and concierge notes.',
    actions: [
      {
        id: 'vip-desk',
        category: 'VIP',
        label: 'VIP Support Desk',
        description: 'Open the high-priority support queue.',
        level: 'vip',
      },
      {
        id: 'priority-override',
        category: 'VIP',
        label: 'Priority Override',
        description: 'Escalate urgent identity resolution paths.',
        level: 'vip',
      },
      {
        id: 'concierge-notes',
        category: 'VIP',
        label: 'Concierge Notes',
        description: 'View specialist handling notes for VIP profiles.',
        level: 'vip',
      },
    ],
  },
};

export async function workspace(ctx) {
  const downstreamError = ctx.get('downstream-error') === 'true';

  if (downstreamError) {
    ctx.status = 503;
    ctx.body = { message: 'Mocked downstream workspace service failure' };
    return;
  }

  const token = tokenFromAuthHeader(ctx);

  if (!token) {
    ctx.status = 401;
    ctx.body = { message: 'Missing bearer token' };
    return;
  }

  try {
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: 'identity-manager-frontend',
    });
    const roles = Array.isArray(payload.roles) ? payload.roles : ['viewer'];
    const primaryRole = selectedPrimaryRole(roles);

    ctx.status = 200;
    ctx.body = {
      primaryRole,
      roles,
      ...actionCatalog[primaryRole],
    };
  } catch {
    ctx.status = 401;
    ctx.body = { message: 'Invalid bearer token' };
  }
}
