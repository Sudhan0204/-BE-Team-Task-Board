import bcrypt from 'bcryptjs';
import employeeModel from './employee.model.js';
import roleModel from '../roles/role.model.js';
import tenantModel from '../tenants/tenant.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';

const BCRYPT_SALT_ROUNDS = 12;

async function validateTenantRoles(tenantId, rawRoleIds) {
  const uniqueIds = Array.from(new Set(rawRoleIds.map(String)));
  if (uniqueIds.length === 0) return [];

  const matchedRoles = await roleModel.findByIds(tenantId, uniqueIds);
  if (matchedRoles.length !== uniqueIds.length) {
    throw ApiError.badRequest(
      'One or more selected roles do not exist in your company workspace.'
    );
  }
  return matchedRoles;
}

export const employeeService = {
  async listEmployees(tenantId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const [{ employees, total }, departments] = await Promise.all([
      employeeModel.listByTenant(tenantId, {
        search: query.search,
        department: query.department,
        status: query.status,
        roleId: query.role_id,
        offset: pagination.offset,
        limit: pagination.limit,
      }),
      employeeModel.listDepartments(tenantId),
    ]);

    return {
      employees,
      departments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  async getEmployeeById(tenantId, userId) {
    const employee = await employeeModel.findById(tenantId, userId);
    if (!employee) {
      throw ApiError.notFound('Employee not found.');
    }
    return employee;
  },

  async createEmployee(tenantId, actorUserId, data) {
    // 1. Check subscription employee seat limit
    const [subscription, usage] = await Promise.all([
      tenantModel.getActiveSubscription(tenantId),
      tenantModel.countUsage(tenantId),
    ]);

    if (subscription?.max_employees && usage.employees >= Number(subscription.max_employees)) {
      throw ApiError.forbidden(
        `Employee limit (${subscription.max_employees}) reached for your current subscription plan.`
      );
    }

    // 2. Check email uniqueness strictly within tenant
    const normalizedEmail = data.email.trim().toLowerCase();
    const existingEmail = await employeeModel.findByEmail(tenantId, normalizedEmail);
    if (existingEmail) {
      throw ApiError.conflict(`An employee with email '${normalizedEmail}' already exists in this company.`, [
        { field: 'email', message: 'Email is already used by another employee in this company' },
      ]);
    }

    // 3. Check employee_code uniqueness within tenant if provided
    const employeeCode = data.employee_code?.trim() || null;
    if (employeeCode) {
      const existingCode = await employeeModel.findByEmployeeCode(tenantId, employeeCode);
      if (existingCode) {
        throw ApiError.conflict(`Employee ID '${employeeCode}' is already assigned.`, [
          { field: 'employee_code', message: 'Employee ID must be unique within the company' },
        ]);
      }
    }

    // 4. Resolve & verify tenant-owned roles
    let roleIds = [];
    if (Array.isArray(data.role_ids) && data.role_ids.length > 0) {
      roleIds = data.role_ids;
    } else if (data.role_id) {
      roleIds = [data.role_id];
    }

    const validatedRoles = await validateTenantRoles(tenantId, roleIds);
    const password_hash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const created = await employeeModel.createWithRoles({
      tenant_id: tenantId,
      userFields: {
        full_name: data.full_name.trim(),
        email: normalizedEmail,
        employee_code: employeeCode,
        phone: data.phone?.trim() || null,
        department: data.department?.trim() || null,
        designation: data.designation?.trim() || null,
        avatar_url: data.avatar_url?.trim() || null,
        password_hash,
        is_active: data.is_active !== false,
        email_verified: true,
      },
      roleIds: validatedRoles.map((r) => r.role_id),
      assignedBy: actorUserId,
    });

    return employeeModel.findById(tenantId, created.user_id);
  },

  async updateEmployee(tenantId, actorUserId, targetUserId, data) {
    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }

    const updates = {};

    if (data.full_name !== undefined) updates.full_name = data.full_name.trim();

    if (data.email !== undefined) {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email.toLowerCase()) {
        const conflict = await employeeModel.findByEmail(tenantId, normalizedEmail);
        if (conflict && String(conflict.user_id) !== String(targetUserId)) {
          throw ApiError.conflict(`Email '${normalizedEmail}' is already used by another employee.`);
        }
        updates.email = normalizedEmail;
      }
    }

    if (data.employee_code !== undefined) {
      const code = data.employee_code?.trim() || null;
      if (code && code.toLowerCase() !== (existing.employee_code || '').toLowerCase()) {
        const conflict = await employeeModel.findByEmployeeCode(tenantId, code);
        if (conflict && String(conflict.user_id) !== String(targetUserId)) {
          throw ApiError.conflict(`Employee ID '${code}' is already assigned.`);
        }
      }
      updates.employee_code = code;
    }

    if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
    if (data.department !== undefined) updates.department = data.department?.trim() || null;
    if (data.designation !== undefined) updates.designation = data.designation?.trim() || null;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url?.trim() || null;

    if (data.is_active !== undefined && data.is_active === false && existing.is_active === true) {
      const isSystemAdmin = existing.roles.some((r) => r.is_system_role);
      if (isSystemAdmin) {
        const otherAdmins = await roleModel.countActiveSystemAdmins(tenantId, targetUserId);
        if (otherAdmins === 0) {
          throw ApiError.badRequest(
            'Cannot deactivate the last active Company Administrator.'
          );
        }
      }
      updates.is_active = false;
    } else if (data.is_active !== undefined) {
      updates.is_active = data.is_active;
    }

    if (Object.keys(updates).length > 0) {
      await employeeModel.update(tenantId, targetUserId, updates);
    }

    // Optional inline role update
    if (Array.isArray(data.role_ids) || data.role_id !== undefined) {
      const nextRoleIds = Array.isArray(data.role_ids)
        ? data.role_ids
        : data.role_id
          ? [data.role_id]
          : [];
      if (nextRoleIds.length > 0) {
        await this.assignRoles(tenantId, actorUserId, targetUserId, nextRoleIds);
      }
    }

    return employeeModel.findById(tenantId, targetUserId);
  },

  async updateStatus(tenantId, targetUserId, isActive) {
    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }

    if (!isActive) {
      const isSystemAdmin = existing.roles.some((r) => r.is_system_role);
      if (isSystemAdmin) {
        const otherAdmins = await roleModel.countActiveSystemAdmins(tenantId, targetUserId);
        if (otherAdmins === 0) {
          throw ApiError.badRequest(
            'Cannot deactivate the last active Company Administrator.'
          );
        }
      }
    }

    await employeeModel.update(tenantId, targetUserId, { is_active: isActive });
    return employeeModel.findById(tenantId, targetUserId);
  },

  async resetPassword(tenantId, targetUserId, newPassword) {
    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }

    const password_hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await employeeModel.update(tenantId, targetUserId, { password_hash });
    return { success: true };
  },

  async deleteEmployee(tenantId, actorUserId, targetUserId) {
    if (String(actorUserId) === String(targetUserId)) {
      throw ApiError.badRequest('You cannot delete your own account.');
    }

    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }

    const isSystemAdmin = existing.roles.some((r) => r.is_system_role);
    if (isSystemAdmin) {
      const otherAdmins = await roleModel.countActiveSystemAdmins(tenantId, targetUserId);
      if (otherAdmins === 0) {
        throw ApiError.badRequest(
          'Cannot delete the last active Company Administrator.'
        );
      }
    }

    await employeeModel.delete(tenantId, targetUserId);
    return { success: true };
  },

  async getEmployeeRoles(tenantId, targetUserId) {
    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }
    return existing.roles;
  },

  async assignRoles(tenantId, actorUserId, targetUserId, roleIds) {
    const existing = await employeeModel.findById(tenantId, targetUserId);
    if (!existing) {
      throw ApiError.notFound('Employee not found.');
    }

    const validatedRoles = await validateTenantRoles(tenantId, roleIds);
    const willStillBeSystemAdmin = validatedRoles.some((r) => r.is_system_role);
    const wasSystemAdmin = existing.roles.some((r) => r.is_system_role);

    if (wasSystemAdmin && !willStillBeSystemAdmin) {
      const otherAdmins = await roleModel.countActiveSystemAdmins(tenantId, targetUserId);
      if (otherAdmins === 0) {
        throw ApiError.badRequest(
          'Cannot remove Company Admin role from the last active Company Administrator.'
        );
      }
    }

    await roleModel.setUserRoles(
      tenantId,
      targetUserId,
      validatedRoles.map((r) => r.role_id),
      actorUserId
    );

    return employeeModel.findById(tenantId, targetUserId);
  },
};

export default employeeService;
