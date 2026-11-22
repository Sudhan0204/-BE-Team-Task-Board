import db from '../../config/database.js';

export const projectModel = {
  /**
   * Atomically creates a project and establishes the creator as 'lead' in project_members.
   */
  async create({ organization_id, name, description, project_key, status, start_date, due_date, created_by }) {
    return db.transaction(async (trx) => {
      // 1. Insert project
      const [project] = await trx('projects')
        .insert({
          organization_id,
          name,
          description: description || null,
          project_key,
          status: status || 'active',
          start_date: start_date || null,
          due_date: due_date || null,
          created_by,
        })
        .returning([
          'project_id',
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
        ]);

      // 2. Insert creator as project lead
      await trx('project_members').insert({
        project_id: project.project_id,
        user_id: created_by,
        role: 'project_manager', // Count project managers (highest project role)
      });

      return project;
    });
  },

  /**
   * Find project by key within a specific organization
   */
  async findByOrgAndKey(organizationId, projectKey) {
    return db('projects')
      .where({
        organization_id: organizationId,
        project_key: projectKey,
      })
      .first();
  },

  /**
   * Lists projects within an organization with pagination
   */
  async listByOrganization(organizationId, { offset, limit, sortBy, sortOrder }) {
    const totalQuery = db('projects')
      .where('organization_id', organizationId)
      .count('project_id as total')
      .first();

    const dataQuery = db('projects')
      .where('organization_id', organizationId)
      .select([
        'project_id',
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
      ])
      .orderBy(sortBy, sortOrder)
      .offset(offset)
      .limit(limit);

    const [totalResult, projects] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { projects, total };
  },

  /**
   * Retrieves project by ID
   */
  async findById(projectId) {
    return db('projects')
      .where('project_id', projectId)
      .first();
  },

  /**
   * Updates project details
   */
  async update(projectId, updates) {
    const [updated] = await db('projects')
      .where('project_id', projectId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning([
        'project_id',
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
      ]);
    return updated;
  },

  /**
   * Deletes a project
   */
  async delete(projectId) {
    return db('projects')
      .where('project_id', projectId)
      .delete();
  },

  /**
   * Retrieves all members of a project with user profile details
   */
  async getMembers(projectId) {
    return db('project_members as pm')
      .join('users as u', 'pm.user_id', 'u.user_id')
      .select([
        'pm.project_member_id',
        'pm.project_id',
        'pm.user_id',
        'pm.role',
        'pm.added_at',
        'u.full_name',
        'u.email',
        'u.avatar_url',
      ])
      .where('pm.project_id', projectId)
      .orderBy('pm.added_at', 'asc');
  },

  /**
   * Retrieves single project member record
   */
  async getMember(projectId, userId) {
    return db('project_members')
      .where({
        project_id: projectId,
        user_id: userId,
      })
      .first();
  },

  /**
   * Adds a member to a project
   */
  async addMember({ project_id, user_id, role }) {
    const [member] = await db('project_members')
      .insert({
        project_id,
        user_id,
        role,
      })
      .returning(['project_member_id', 'project_id', 'user_id', 'role', 'added_at']);
    return member;
  },

  /**
   * Updates project member role
   */
  async updateMemberRole(projectId, userId, role) {
    const [updated] = await db('project_members')
      .where({
        project_id: projectId,
        user_id: userId,
      })
      .update({ role })
      .returning(['project_member_id', 'project_id', 'user_id', 'role', 'added_at']);
    return updated;
  },

  /**
   * Removes member from a project
   */
  async removeMember(projectId, userId) {
    return db('project_members')
      .where({
        project_id: projectId,
        user_id: userId,
      })
      .delete();
  },

  /**
   * Counts project leads
   */
  async countLeads(projectId) {
    const result = await db('project_members')
      .where({
        project_id: projectId,
        role: 'project_manager',
      })
      .count('project_member_id as count')
      .first();
    return parseInt(result?.count || 0, 10);
  },
};

export default projectModel;
