import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import db from '../../config/database.js';
import env from '../../config/env.js';
import tenantModel from './tenant.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';
import { SYSTEM_PERMISSIONS } from '../../constants/permissions.js';

const BCRYPT_SALT_ROUNDS = 12;

function removeUploadedFileSafely(file) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch {
    // Ignore cleanup errors
  }
}

export const tenantService = {
  async getPublicBranding(slug) {
    const tenant = await tenantModel.findPublicBySlug(slug);
    if (!tenant) {
      throw ApiError.notFound(`Company workspace '${slug}' was not found.`);
    }
    return tenant;
  },

  async listTenants(query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const { tenants, total } = await tenantModel.listAll({
      search: query.search,
      status: query.status,
      offset: pagination.offset,
      limit: pagination.limit,
    });

    return {
      tenants,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  async getTenantById(tenantId) {
    const tenant = await tenantModel.findByIdWithDetails(tenantId);
    if (!tenant) {
      throw ApiError.notFound('Company not found.');
    }
    return tenant;
  },

  /**
   * Atomically creates a new company tenant, subscription, default Company Admin role
   * with all permissions, and the initial company administrator account.
   * Rolls back completely on any failure.
   */
  async createTenant(data, logoFile = null) {
    const slug = data.slug.trim().toLowerCase();
    const companyEmail = data.email.trim().toLowerCase();
    const adminEmail = data.admin_email.trim().toLowerCase();

    try {
      // 1. Validate uniqueness of slug & company email
      const [existingSlug, existingEmail] = await Promise.all([
        tenantModel.findBySlug(slug),
        tenantModel.findByEmail(companyEmail),
      ]);

      if (existingSlug) {
        throw ApiError.conflict(`A company with slug '${slug}' already exists.`, [
          { field: 'slug', message: 'Company slug is already taken' },
        ]);
      }

      if (existingEmail) {
        throw ApiError.conflict(`A company with email '${companyEmail}' is already registered.`, [
          { field: 'email', message: 'Company email is already in use' },
        ]);
      }

      const logo_url = logoFile ? `${env.APP_URL}/uploads/logos/${logoFile.filename}` : null;
      const password_hash = await bcrypt.hash(data.admin_password, BCRYPT_SALT_ROUNDS);

      const created = await db.transaction(async (trx) => {
        // 2. Resolve subscription plan
        let plan = null;
        if (data.plan_id) {
          plan = await trx('subscription_plans').where('plan_id', data.plan_id).first();
          if (!plan) {
            throw ApiError.badRequest('Selected subscription plan was not found.');
          }
        } else {
          plan = await trx('subscription_plans').orderBy('price', 'asc').first();
        }

        // 3. Create tenant record
        const [tenant] = await trx('tenants')
          .insert({
            company_name: data.company_name.trim(),
            slug,
            email: companyEmail,
            phone: data.phone?.trim() || null,
            website: data.website?.trim() || null,
            address: data.address?.trim() || null,
            description: data.description?.trim() || null,
            logo_url,
            status: data.status || 'active',
          })
          .returning('*');

        // 4. Create subscription record
        let subscription = null;
        if (plan) {
          const startDate = data.subscription_start_date || new Date().toISOString().slice(0, 10);
          const endDate =
            data.subscription_end_date ||
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          [subscription] = await trx('tenant_subscriptions')
            .insert({
              tenant_id: tenant.tenant_id,
              plan_id: plan.plan_id,
              start_date: startDate,
              end_date: endDate,
              max_employees: data.max_employees || plan.max_employees,
              max_projects: data.max_projects || plan.max_projects,
              status: 'active',
            })
            .returning('*');
        }

        // 5. Ensure system permissions exist
        for (const perm of SYSTEM_PERMISSIONS) {
          await trx('permissions').insert(perm).onConflict('permission_key').ignore();
        }
        const allPermissions = await trx('permissions').select('permission_id');

        // 6. Create Company Admin system role for this tenant
        const [adminRole] = await trx('roles')
          .insert({
            tenant_id: tenant.tenant_id,
            role_name: 'Company Admin',
            description:
              'Primary company administrator with full access to employees, roles, permissions, projects, and tasks.',
            is_system_role: true,
          })
          .returning('*');

        // 7. Grant all permissions to Company Admin role
        if (allPermissions.length > 0) {
          await trx('role_permissions')
            .insert(
              allPermissions.map((p) => ({
                role_id: adminRole.role_id,
                permission_id: p.permission_id,
              }))
            )
            .onConflict(['role_id', 'permission_id'])
            .ignore();
        }

        // 8. Create initial Company Administrator user in tenant scope
        const [adminUser] = await trx('users')
          .insert({
            tenant_id: tenant.tenant_id,
            full_name: data.admin_full_name.trim(),
            email: adminEmail,
            employee_code: 'EMP-001',
            department: 'Administration',
            designation: 'Company Administrator',
            password_hash,
            is_active: true,
            email_verified: true,
          })
          .returning([
            'user_id',
            'tenant_id',
            'full_name',
            'email',
            'employee_code',
            'department',
            'designation',
            'is_active',
            'created_at',
          ]);

        // 9. Assign Company Admin role to initial admin user
        await trx('user_roles').insert({
          tenant_id: tenant.tenant_id,
          user_id: adminUser.user_id,
          role_id: adminRole.role_id,
          assigned_by: adminUser.user_id,
        });

        return {
          tenant,
          subscription,
          admin: adminUser,
          adminRole,
        };
      });

      return created;
    } catch (err) {
      removeUploadedFileSafely(logoFile);
      throw err;
    }
  },

  async updateTenant(tenantId, data, logoFile = null) {
    try {
      const existing = await tenantModel.findById(tenantId);
      if (!existing) {
        throw ApiError.notFound('Company not found.');
      }

      if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
        const conflict = await tenantModel.findBySlug(data.slug);
        if (conflict && String(conflict.tenant_id) !== String(tenantId)) {
          throw ApiError.conflict(`Slug '${data.slug}' is already in use.`, [
            { field: 'slug', message: 'Company slug is already taken' },
          ]);
        }
      }

      if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
        const conflict = await tenantModel.findByEmail(data.email);
        if (conflict && String(conflict.tenant_id) !== String(tenantId)) {
          throw ApiError.conflict(`Email '${data.email}' is already registered.`, [
            { field: 'email', message: 'Company email is already in use' },
          ]);
        }
      }

      const tenantUpdates = {};
      if (data.company_name !== undefined) tenantUpdates.company_name = data.company_name.trim();
      if (data.slug !== undefined) tenantUpdates.slug = data.slug.trim().toLowerCase();
      if (data.email !== undefined) tenantUpdates.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) tenantUpdates.phone = data.phone?.trim() || null;
      if (data.website !== undefined) tenantUpdates.website = data.website?.trim() || null;
      if (data.address !== undefined) tenantUpdates.address = data.address?.trim() || null;
      if (data.description !== undefined) tenantUpdates.description = data.description?.trim() || null;
      if (data.status !== undefined) tenantUpdates.status = data.status;

      if (logoFile) {
        tenantUpdates.logo_url = `${env.APP_URL}/uploads/logos/${logoFile.filename}`;
      }

      await db.transaction(async (trx) => {
        if (Object.keys(tenantUpdates).length > 0) {
          await trx('tenants')
            .where('tenant_id', tenantId)
            .update({ ...tenantUpdates, updated_at: trx.fn.now() });
        }

        // Update subscription if plan or subscription limits/dates supplied
        const hasSubUpdates =
          data.plan_id !== undefined ||
          data.subscription_start_date !== undefined ||
          data.subscription_end_date !== undefined ||
          data.max_employees !== undefined ||
          data.max_projects !== undefined;

        if (hasSubUpdates) {
          const currentSub = await trx('tenant_subscriptions')
            .where('tenant_id', tenantId)
            .orderBy('created_at', 'desc')
            .first();

          if (currentSub) {
            const subPatch = { updated_at: trx.fn.now() };
            if (data.plan_id !== undefined) subPatch.plan_id = data.plan_id;
            if (data.subscription_start_date) subPatch.start_date = data.subscription_start_date;
            if (data.subscription_end_date) subPatch.end_date = data.subscription_end_date;
            if (data.max_employees !== undefined) subPatch.max_employees = data.max_employees;
            if (data.max_projects !== undefined) subPatch.max_projects = data.max_projects;

            await trx('tenant_subscriptions')
              .where('subscription_id', currentSub.subscription_id)
              .update(subPatch);
          } else if (data.plan_id) {
            await trx('tenant_subscriptions').insert({
              tenant_id: tenantId,
              plan_id: data.plan_id,
              start_date: data.subscription_start_date || new Date().toISOString().slice(0, 10),
              end_date: data.subscription_end_date || null,
              max_employees: data.max_employees || null,
              max_projects: data.max_projects || null,
              status: 'active',
            });
          }
        }
      });

      // Clean up previous logo file if replaced
      if (logoFile && existing.logo_url && existing.logo_url.includes('/uploads/logos/')) {
        const oldFilename = path.basename(existing.logo_url);
        const oldPath = path.resolve(process.cwd(), 'uploads', 'logos', oldFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      return tenantModel.findByIdWithDetails(tenantId);
    } catch (err) {
      removeUploadedFileSafely(logoFile);
      throw err;
    }
  },

  async updateTenantStatus(tenantId, status) {
    const existing = await tenantModel.findById(tenantId);
    if (!existing) {
      throw ApiError.notFound('Company not found.');
    }
    return tenantModel.updateStatus(tenantId, status);
  },
};

export default tenantService;
