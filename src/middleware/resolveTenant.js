import tenantModel from '../modules/tenants/tenant.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Extracts a candidate tenant slug from trusted request metadata:
 * 1. Explicit route param (:slug) or query (?tenant=) or body (tenant_slug) or header (X-Tenant-Slug)
 * 2. Subdomain of Host header (e.g., kovai.teamtaskboard.app -> "kovai")
 */
export function extractTenantSlug(req) {
  const explicit =
    req.params?.slug ||
    req.query?.tenant ||
    req.body?.tenant_slug ||
    req.body?.tenant ||
    req.headers['x-tenant-slug'];

  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim().toLowerCase();
  }

  // Hostname subdomain resolution (ignored for localhost / IP addresses)
  const host = (req.hostname || '').toLowerCase();
  if (host && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.');
    if (parts.length >= 3 && !['www', 'api', 'app'].includes(parts[0])) {
      return parts[0];
    }
  }

  return null;
}

/**
 * Middleware that resolves a tenant from slug/hostname when provided,
 * and rejects inactive/suspended tenants cleanly.
 * Note: For authenticated routes, tenant context is ALWAYS bound from the
 * verified JWT + DB user record in `authenticate`, NEVER from client-supplied tenant_id.
 */
export function resolveTenant({ required = false } = {}) {
  return async (req, res, next) => {
    try {
      const slug = extractTenantSlug(req);

      if (!slug) {
        if (required) {
          throw ApiError.badRequest('Company workspace identifier (tenant slug) is required.');
        }
        return next();
      }

      const tenant = await tenantModel.findBySlug(slug);
      if (!tenant) {
        throw ApiError.notFound(`Company workspace '${slug}' was not found.`);
      }

      if (tenant.status !== 'active') {
        throw ApiError.forbidden(
          `The company workspace '${tenant.company_name}' is currently ${tenant.status}. Please contact the platform administrator.`
        );
      }

      req.resolvedTenant = tenant;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default {
  extractTenantSlug,
  resolveTenant,
};
