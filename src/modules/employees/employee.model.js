import db from '../../config/database.js';

export const EMPLOYEE_COLUMNS = [
  'user_id',
  'tenant_id',
  'full_name',
  'email',
  'employee_code',
  'phone',
  'department',
  'designation',
  'avatar_url',
  'is_active',
  'email_verified',
  'created_at',
  'updated_at',
];

export const employeeModel = {
  async listByTenant(tenantId, { search, department, status, roleId, offset = 0, limit = 20 }) {
    const baseQuery = db('users as u').where('u.tenant_id', tenantId);

    if (status === 'active') {
      baseQuery.andWhere('u.is_active', true);
    } else if (status === 'inactive') {
      baseQuery.andWhere('u.is_active', false);
    }

    if (department && department.trim()) {
      baseQuery.andWhereILike('u.department', department.trim());
    }

    if (roleId) {
      baseQuery.whereExists(function () {
        this.select(1)
          .from('user_roles as ur')
          .whereRaw('ur.user_id = u.user_id')
          .andWhere('ur.tenant_id', tenantId)
          .andWhere('ur.role_id', roleId);
      });
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      baseQuery.andWhere(function () {
        this.whereILike('u.full_name', term)
          .orWhereILike('u.email', term)
          .orWhereILike('u.employee_code', term)
          .orWhereILike('u.department', term)
          .orWhereILike('u.designation', term);
      });
    }

    const totalRow = await baseQuery.clone().count('u.user_id as total').first();
    const total = parseInt(totalRow?.total || 0, 10);

    const employees = await baseQuery
      .clone()
      .select(EMPLOYEE_COLUMNS.map((c) => `u.${c}`))
      .orderBy('u.created_at', 'desc')
      .offset(offset)
      .limit(limit);

    if (employees.length === 0) {
      return { employees: [], total };
    }

    const userIds = employees.map((e) => e.user_id);
    const roleRows = await db('user_roles as ur')
      .join('roles as r', function () {
        this.on('ur.role_id', '=', 'r.role_id').andOn('ur.tenant_id', '=', 'r.tenant_id');
      })
      .where('ur.tenant_id', tenantId)
      .whereIn('ur.user_id', userIds)
      .select(['ur.user_id', 'r.role_id', 'r.role_name', 'r.is_system_role']);

    const rolesByUser = new Map();
    for (const row of roleRows) {
      const key = String(row.user_id);
      if (!rolesByUser.has(key)) rolesByUser.set(key, []);
      rolesByUser.get(key).push({
        role_id: row.role_id,
        role_name: row.role_name,
        is_system_role: row.is_system_role,
      });
    }

    return {
      employees: employees.map((emp) => ({
        ...emp,
        roles: rolesByUser.get(String(emp.user_id)) || [],
      })),
      total,
    };
  },

  async findById(tenantId, userId) {
    const emp = await db('users')
      .select(EMPLOYEE_COLUMNS)
      .where({ tenant_id: tenantId, user_id: userId })
      .first();

    if (!emp) return null;

    const roles = await db('user_roles as ur')
      .join('roles as r', function () {
        this.on('ur.role_id', '=', 'r.role_id').andOn('ur.tenant_id', '=', 'r.tenant_id');
      })
      .where({ 'ur.tenant_id': tenantId, 'ur.user_id': userId })
      .select(['r.role_id', 'r.role_name', 'r.description', 'r.is_system_role']);

    return { ...emp, roles };
  },

  async findByEmail(tenantId, email) {
    return db('users')
      .select(EMPLOYEE_COLUMNS)
      .where('tenant_id', tenantId)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()])
      .first();
  },

  async findByEmployeeCode(tenantId, employeeCode) {
    if (!employeeCode || !employeeCode.trim()) return null;
    return db('users')
      .select(EMPLOYEE_COLUMNS)
      .where('tenant_id', tenantId)
      .whereRaw('LOWER(employee_code) = ?', [employeeCode.trim().toLowerCase()])
      .first();
  },

  async createWithRoles({ tenant_id, userFields, roleIds = [], assignedBy = null }) {
    return db.transaction(async (trx) => {
      const [user] = await trx('users')
        .insert({
          tenant_id,
          ...userFields,
        })
        .returning(EMPLOYEE_COLUMNS);

      if (roleIds.length > 0) {
        await trx('user_roles')
          .insert(
            roleIds.map((rid) => ({
              tenant_id,
              user_id: user.user_id,
              role_id: rid,
              assigned_by: assignedBy,
            }))
          )
          .onConflict(['user_id', 'role_id'])
          .ignore();
      }

      return user;
    });
  },

  async update(tenantId, userId, updates) {
    const [updated] = await db('users')
      .where({ tenant_id: tenantId, user_id: userId })
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning(EMPLOYEE_COLUMNS);
    return updated;
  },

  async delete(tenantId, userId) {
    return db('users')
      .where({ tenant_id: tenantId, user_id: userId })
      .delete();
  },

  async listDepartments(tenantId) {
    const rows = await db('users')
      .where('tenant_id', tenantId)
      .whereNotNull('department')
      .whereNot('department', '')
      .distinct('department')
      .orderBy('department', 'asc');
    return rows.map((r) => r.department);
  },
};

export default employeeModel;
