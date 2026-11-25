import roleModel from './role.model.js';
import { ApiError } from '../../utils/ApiError.js';

const PROTECTED_ADMIN_PERMISSIONS = [
  'dashboard.view',
  'employees.view',
  'employees.create',
  'employees.update',
  'roles.view',
  'roles.create',
  'roles.update',
];

async function resolvePermissionIds({ permission_ids, permission_keys }) {
  const allPerms = await roleModel.listAllPermissions();
  const byId = new Map(allPerms.map((p) => [String(p.permission_id), p.permission_id]));
  const byKey = new Map(allPerms.map((p) => [p.permission_key, p.permission_id]));

  const resolved = new Set();

  if (Array.isArray(permission_ids)) {
    for (const id of permission_ids) {
      const match = byId.get(String(id));
      if (!match) {
        throw ApiError.badRequest(`Invalid permission_id: ${id}`);
      }
      resolved.add(match);
    }
  }

  if (Array.isArray(permission_keys)) {
    for (const key of permission_keys) {
      const match = byKey.get(key);
      if (!match) {
        throw ApiError.badRequest(`Invalid permission_key: ${key}`);
      }
      resolved.add(match);
    }
  }

  return Array.from(resolved);
}

export const roleService = {
  async listPermissionsCatalog() {
    const permissions = await roleModel.listAllPermissions();
    const grouped = {};
    for (const perm of permissions) {
      if (!grouped[perm.module_name]) {
        grouped[perm.module_name] = [];
      }
      grouped[perm.module_name].push(perm);
    }
    return { permissions, grouped };
  },

  async listRoles(tenantId) {
    return roleModel.listByTenant(tenantId);
  },

  async getRoleById(tenantId, roleId) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }

    const [permissions, employees] = await Promise.all([
      roleModel.getRolePermissions(tenantId, roleId),
      roleModel.getRoleEmployees(tenantId, roleId),
    ]);

    return {
      ...role,
      permissions,
      employees,
      employee_count: employees.length,
      permission_count: permissions.length,
    };
  },

  async createRole(tenantId, data) {
    const roleName = data.role_name.trim();
    const existing = await roleModel.findByName(tenantId, roleName);
    if (existing) {
      throw ApiError.conflict(`A role named '${roleName}' already exists in this company.`, [
        { field: 'role_name', message: 'Role name must be unique within the company' },
      ]);
    }

    const permissionIds = await resolvePermissionIds(data);

    const role = await roleModel.createWithPermissions({
      tenant_id: tenantId,
      role_name: roleName,
      description: data.description?.trim() || null,
      is_system_role: false,
      permissionIds,
    });

    return this.getRoleById(tenantId, role.role_id);
  },

  async updateRole(tenantId, roleId, data) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }

    const updates = {};
    if (data.role_name !== undefined && data.role_name.trim() !== role.role_name) {
      if (role.is_system_role) {
        throw ApiError.badRequest('System administrator role name cannot be renamed.');
      }
      const conflict = await roleModel.findByName(tenantId, data.role_name);
      if (conflict && String(conflict.role_id) !== String(roleId)) {
        throw ApiError.conflict(`A role named '${data.role_name.trim()}' already exists in this company.`);
      }
      updates.role_name = data.role_name.trim();
    }

    if (data.description !== undefined) {
      updates.description = data.description?.trim() || null;
    }

    if (Object.keys(updates).length > 0) {
      await roleModel.update(tenantId, roleId, updates);
    }

    if (data.permission_ids !== undefined || data.permission_keys !== undefined) {
      await this.updateRolePermissions(tenantId, roleId, data);
    }

    return this.getRoleById(tenantId, roleId);
  },

  async updateRolePermissions(tenantId, roleId, data) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }

    let permissionIds = await resolvePermissionIds(data);

    // Protect critical administrative access on system Company Admin role
    if (role.is_system_role) {
      const allPerms = await roleModel.listAllPermissions();
      const protectedIds = allPerms
        .filter((p) => PROTECTED_ADMIN_PERMISSIONS.includes(p.permission_key))
        .map((p) => p.permission_id);
      const merged = new Set([...permissionIds.map(String), ...protectedIds.map(String)]);
      permissionIds = Array.from(merged);
    }

    await roleModel.setRolePermissions(tenantId, roleId, permissionIds);
    return roleModel.getRolePermissions(tenantId, roleId);
  },

  async getRolePermissions(tenantId, roleId) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }
    return roleModel.getRolePermissions(tenantId, roleId);
  },

  async getRoleEmployees(tenantId, roleId) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }
    return roleModel.getRoleEmployees(tenantId, roleId);
  },

  async deleteRole(tenantId, roleId) {
    const role = await roleModel.findById(tenantId, roleId);
    if (!role) {
      throw ApiError.notFound('Role not found.');
    }

    if (role.is_system_role) {
      throw ApiError.badRequest('The primary system administrator role cannot be deleted.');
    }

    const assignedCount = await roleModel.countAssignedEmployees(tenantId, roleId);
    if (assignedCount > 0) {
      throw ApiError.conflict(
        `Cannot delete role '${role.role_name}' because it is currently assigned to ${assignedCount} employee(s). Reassign those employees first.`
      );
    }

    await roleModel.delete(tenantId, roleId);
    return { success: true };
  },
};

export default roleService;
