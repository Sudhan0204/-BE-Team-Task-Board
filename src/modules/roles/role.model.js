import db from '../../config/database.js';

export const roleModel = {
  /**
   * Returns all permissions in the global system catalog, ordered by module.
   */
  async listAllPermissions() {
    return db('permissions')
      .select(['permission_id', 'permission_key', 'module_name', 'action_name', 'description'])
      .orderBy([
        { column: 'module_name', order: 'asc' },
        { column: 'permission_id', order: 'asc' },
      ]);
  },

  /**
   * Loads active user's roles and flattened permission keys within a tenant.
   */
  async getUserRolesAndPermissions(tenantId, userId) {
    const roles = await db('user_roles as ur')
      .join('roles as r', function () {
        this.on('ur.role_id', '=', 'r.role_id').andOn('ur.tenant_id', '=', 'r.tenant_id');
      })
      .where({
        'ur.tenant_id': tenantId,
        'ur.user_id': userId,
      })
      .select([
        'r.role_id',
        'r.tenant_id',
        'r.role_name',
        'r.description',
        'r.is_system_role',
      ])
      .orderBy('r.is_system_role', 'desc')
      .orderBy('r.role_name', 'asc');

    if (roles.length === 0) {
      return { roles: [], permissions: [] };
    }

    const roleIds = roles.map((r) => r.role_id);

    const permRows = await db('role_permissions as rp')
      .join('permissions as p', 'rp.permission_id', 'p.permission_id')
      .whereIn('rp.role_id', roleIds)
      .distinct('p.permission_key')
      .select('p.permission_key')
      .orderBy('p.permission_key', 'asc');

    return {
      roles,
      permissions: permRows.map((row) => row.permission_key),
    };
  },

  /**
   * Lists all roles belonging to a tenant with employee count and permission count.
   */
  async listByTenant(tenantId) {
    const roles = await db('roles as r')
      .where('r.tenant_id', tenantId)
      .select([
        'r.role_id',
        'r.tenant_id',
        'r.role_name',
        'r.description',
        'r.is_system_role',
        'r.created_at',
        'r.updated_at',
        db.raw('(SELECT COUNT(*)::int FROM user_roles ur WHERE ur.role_id = r.role_id AND ur.tenant_id = r.tenant_id) as employee_count'),
        db.raw('(SELECT COUNT(*)::int FROM role_permissions rp WHERE rp.role_id = r.role_id) as permission_count'),
      ])
      .orderBy('r.is_system_role', 'desc')
      .orderBy('r.role_name', 'asc');

    if (roles.length === 0) return [];

    const roleIds = roles.map((r) => r.role_id);
    const permMappings = await db('role_permissions as rp')
      .join('permissions as p', 'rp.permission_id', 'p.permission_id')
      .whereIn('rp.role_id', roleIds)
      .select(['rp.role_id', 'p.permission_id', 'p.permission_key', 'p.module_name', 'p.action_name']);

    const permsByRole = new Map();
    for (const row of permMappings) {
      const key = String(row.role_id);
      if (!permsByRole.has(key)) permsByRole.set(key, []);
      permsByRole.get(key).push({
        permission_id: row.permission_id,
        permission_key: row.permission_key,
        module_name: row.module_name,
        action_name: row.action_name,
      });
    }

    return roles.map((role) => ({
      ...role,
      permissions: permsByRole.get(String(role.role_id)) || [],
    }));
  },

  async findById(tenantId, roleId) {
    return db('roles')
      .where({ tenant_id: tenantId, role_id: roleId })
      .first();
  },

  async findByName(tenantId, roleName) {
    return db('roles')
      .where('tenant_id', tenantId)
      .whereRaw('LOWER(role_name) = ?', [roleName.trim().toLowerCase()])
      .first();
  },

  async findByIds(tenantId, roleIds) {
    if (!roleIds || roleIds.length === 0) return [];
    return db('roles')
      .where('tenant_id', tenantId)
      .whereIn('role_id', roleIds);
  },

  async createWithPermissions({ tenant_id, role_name, description = null, is_system_role = false, permissionIds = [] }) {
    return db.transaction(async (trx) => {
      const [role] = await trx('roles')
        .insert({
          tenant_id,
          role_name: role_name.trim(),
          description: description || null,
          is_system_role,
        })
        .returning('*');

      if (permissionIds.length > 0) {
        const rows = permissionIds.map((pid) => ({
          role_id: role.role_id,
          permission_id: pid,
        }));
        await trx('role_permissions').insert(rows).onConflict(['role_id', 'permission_id']).ignore();
      }

      return role;
    });
  },

  async update(tenantId, roleId, updates) {
    const [updated] = await db('roles')
      .where({ tenant_id: tenantId, role_id: roleId })
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');
    return updated;
  },

  async delete(tenantId, roleId) {
    return db('roles')
      .where({ tenant_id: tenantId, role_id: roleId })
      .delete();
  },

  async getRolePermissions(tenantId, roleId) {
    return db('role_permissions as rp')
      .join('roles as r', 'rp.role_id', 'r.role_id')
      .join('permissions as p', 'rp.permission_id', 'p.permission_id')
      .where({
        'r.tenant_id': tenantId,
        'r.role_id': roleId,
      })
      .select([
        'p.permission_id',
        'p.permission_key',
        'p.module_name',
        'p.action_name',
        'p.description',
      ])
      .orderBy('p.permission_id', 'asc');
  },

  async setRolePermissions(tenantId, roleId, permissionIds) {
    return db.transaction(async (trx) => {
      // Ensure role belongs to tenant
      const role = await trx('roles').where({ tenant_id: tenantId, role_id: roleId }).first();
      if (!role) return null;

      await trx('role_permissions').where('role_id', roleId).delete();

      if (permissionIds.length > 0) {
        const rows = permissionIds.map((pid) => ({
          role_id: roleId,
          permission_id: pid,
        }));
        await trx('role_permissions').insert(rows).onConflict(['role_id', 'permission_id']).ignore();
      }

      await trx('roles').where('role_id', roleId).update({ updated_at: trx.fn.now() });
      return role;
    });
  },

  async getRoleEmployees(tenantId, roleId) {
    return db('user_roles as ur')
      .join('users as u', function () {
        this.on('ur.user_id', '=', 'u.user_id').andOn('ur.tenant_id', '=', 'u.tenant_id');
      })
      .where({
        'ur.tenant_id': tenantId,
        'ur.role_id': roleId,
      })
      .select([
        'u.user_id',
        'u.full_name',
        'u.email',
        'u.employee_code',
        'u.department',
        'u.designation',
        'u.avatar_url',
        'u.is_active',
        'ur.created_at as assigned_at',
      ])
      .orderBy('u.full_name', 'asc');
  },

  async countAssignedEmployees(tenantId, roleId) {
    const result = await db('user_roles')
      .where({ tenant_id: tenantId, role_id: roleId })
      .count('user_role_id as count')
      .first();
    return parseInt(result?.count || 0, 10);
  },

  async countActiveSystemAdmins(tenantId, excludeUserId = null) {
    const query = db('user_roles as ur')
      .join('roles as r', 'ur.role_id', 'r.role_id')
      .join('users as u', 'ur.user_id', 'u.user_id')
      .where({
        'ur.tenant_id': tenantId,
        'r.is_system_role': true,
        'u.is_active': true,
      });

    if (excludeUserId) {
      query.whereNot('u.user_id', excludeUserId);
    }

    const result = await query.countDistinct('u.user_id as count').first();
    return parseInt(result?.count || 0, 10);
  },

  async setUserRoles(tenantId, userId, roleIds, assignedBy = null) {
    return db.transaction(async (trx) => {
      await trx('user_roles')
        .where({ tenant_id: tenantId, user_id: userId })
        .delete();

      if (roleIds.length > 0) {
        const rows = roleIds.map((rid) => ({
          tenant_id: tenantId,
          user_id: userId,
          role_id: rid,
          assigned_by: assignedBy,
        }));
        await trx('user_roles').insert(rows).onConflict(['user_id', 'role_id']).ignore();
      }
    });
  },
};

export default roleModel;
