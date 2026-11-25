import db from '../../config/database.js';

const PROJECT_RETURNING = [
  'project_id',
  'tenant_id',
  'organization_id',
  'name',
  'description',
  'project_key',
  'status',
  'start_date',
  'due_date',
  'created_by',
  'created_at',
  'updated_at',
];

export const projectModel = {
  /**
   * Atomically creates a tenant-scoped project and establishes the creator as project_manager.
   */
  async create({
    tenant_id,
    organization_id = null,
    name,
    description,
    project_key,
    status,
    start_date,
    due_date,
    created_by,
  }) {
    return db.transaction(async (trx) => {
      const [project] = await trx('projects')
        .insert({
          tenant_id,
          organization_id,
          name,
          description: description || null,
          project_key,
          status: status || 'active',
          start_date: start_date || null,
          due_date: due_date || null,
          created_by,
        })
        .returning(PROJECT_RETURNING);

      await trx('project_members').insert({
        tenant_id,
        project_id: project.project_id,
        user_id: created_by,
        role: 'project_manager',
      });

      return project;
    });
  },

  /**
   * Find project by key within a specific tenant (or legacy org)
   */
  async findByTenantAndKey(tenantId, projectKey) {
    return db('projects')
      .where('tenant_id', tenantId)
      .whereRaw('UPPER(project_key) = ?', [projectKey.trim().toUpperCase()])
      .first();
  },

  async findByOrgAndKey(organizationId, projectKey) {
    return db('projects')
      .where({
        organization_id: organizationId,
        project_key: projectKey,
      })
      .first();
  },

  /**
   * Lists projects within a tenant accessible to the user, with member & task counts.
   */
  async listByTenant(tenantId, userId, { canViewAll = false, search, status, offset, limit, sortBy, sortOrder }) {
    const baseQuery = db('projects as p').where('p.tenant_id', tenantId);

    if (!canViewAll) {
      baseQuery.whereExists(function () {
        this.select(1)
          .from('project_members as pm')
          .whereRaw('pm.project_id = p.project_id')
          .andWhere('pm.tenant_id', tenantId)
          .andWhere('pm.user_id', userId);
      });
    }

    if (status && ['active', 'completed', 'archived'].includes(status)) {
      baseQuery.andWhere('p.status', status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      baseQuery.andWhere(function () {
        this.whereILike('p.name', term)
          .orWhereILike('p.project_key', term)
          .orWhereILike('p.description', term);
      });
    }

    const totalResult = await baseQuery.clone().count('p.project_id as total').first();
    const total = parseInt(totalResult?.total || 0, 10);

    const projects = await baseQuery
      .clone()
      .leftJoin('users as u', 'p.created_by', 'u.user_id')
      .select([
        'p.project_id',
        'p.tenant_id',
        'p.organization_id',
        'p.name',
        'p.description',
        'p.project_key',
        'p.status',
        'p.start_date',
        'p.due_date',
        'p.created_by',
        'p.created_at',
        'p.updated_at',
        'u.full_name as creator_name',
        db.raw('(SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.project_id AND pm.tenant_id = p.tenant_id) as member_count'),
        db.raw('(SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.project_id AND t.tenant_id = p.tenant_id) as task_count'),
        db.raw("(SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.project_id AND t.tenant_id = p.tenant_id AND t.status = 'done') as completed_task_count"),
      ])
      .orderBy(`p.${sortBy}`, sortOrder)
      .offset(offset)
      .limit(limit);

    return { projects, total };
  },

  /**
   * Lists projects within an organization (tenant-scoped) with pagination
   */
  async listByOrganization(organizationId, { offset, limit, sortBy, sortOrder }, tenantId = null) {
    const base = db('projects').where('organization_id', organizationId);
    if (tenantId) base.andWhere('tenant_id', tenantId);

    const totalQuery = base.clone().count('project_id as total').first();
    const dataQuery = base
      .clone()
      .select(PROJECT_RETURNING)
      .orderBy(sortBy, sortOrder)
      .offset(offset)
      .limit(limit);

    const [totalResult, projects] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { projects, total };
  },

  /**
   * Retrieves project by ID strictly scoped to tenantId when provided
   */
  async findById(projectId, tenantId = null) {
    const query = db('projects').where('project_id', projectId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.first();
  },

  /**
   * Updates project details strictly scoped to tenantId
   */
  async update(projectId, updates, tenantId = null) {
    const query = db('projects').where('project_id', projectId);
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const [updated] = await query
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning(PROJECT_RETURNING);
    return updated;
  },

  /**
   * Deletes a project strictly scoped to tenantId
   */
  async delete(projectId, tenantId = null) {
    const query = db('projects').where('project_id', projectId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },

  /**
   * Retrieves all members of a project with user profile details (tenant-scoped)
   */
  async getMembers(projectId, tenantId = null) {
    const query = db('project_members as pm')
      .join('users as u', 'pm.user_id', 'u.user_id')
      .select([
        'pm.project_member_id',
        'pm.tenant_id',
        'pm.project_id',
        'pm.user_id',
        'pm.role',
        'pm.added_at',
        'u.full_name',
        'u.email',
        'u.department',
        'u.designation',
        'u.avatar_url',
      ])
      .where('pm.project_id', projectId)
      .orderBy('pm.added_at', 'asc');

    if (tenantId) {
      query.andWhere('pm.tenant_id', tenantId).andWhere('u.tenant_id', tenantId);
    }

    return query;
  },

  /**
   * Retrieves single project member record (tenant-scoped)
   */
  async getMember(projectId, userId, tenantId = null) {
    const query = db('project_members').where({
      project_id: projectId,
      user_id: userId,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.first();
  },

  /**
   * Adds a member to a project (tenant-scoped)
   */
  async addMember({ tenant_id, project_id, user_id, role }) {
    const [member] = await db('project_members')
      .insert({
        tenant_id,
        project_id,
        user_id,
        role,
      })
      .returning(['project_member_id', 'tenant_id', 'project_id', 'user_id', 'role', 'added_at']);
    return member;
  },

  /**
   * Updates project member role
   */
  async updateMemberRole(projectId, userId, role, tenantId = null) {
    const query = db('project_members').where({
      project_id: projectId,
      user_id: userId,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const [updated] = await query
      .update({ role })
      .returning(['project_member_id', 'tenant_id', 'project_id', 'user_id', 'role', 'added_at']);
    return updated;
  },

  /**
   * Removes member from a project
   */
  async removeMember(projectId, userId, tenantId = null) {
    const query = db('project_members').where({
      project_id: projectId,
      user_id: userId,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },

  /**
   * Counts project leads
   */
  async countLeads(projectId, tenantId = null) {
    const query = db('project_members')
      .where({
        project_id: projectId,
        role: 'project_manager',
      });
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const result = await query.count('project_member_id as count').first();
    return parseInt(result?.count || 0, 10);
  },
};

export default projectModel;
