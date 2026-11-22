import db from '../../config/database.js';

export const organizationModel = {
  /**
   * Atomically creates an organization and sets the creating user as the 'owner' in organization_members.
   */
  async create({ name, slug, description, created_by }) {
    return db.transaction(async (trx) => {
      // 1. Insert organization
      const [org] = await trx('organizations')
        .insert({
          name,
          slug,
          description: description || null,
          created_by,
        })
        .returning(['organization_id', 'name', 'slug', 'description', 'created_by', 'created_at', 'updated_at']);

      // 2. Insert creator as owner
      await trx('organization_members').insert({
        organization_id: org.organization_id,
        user_id: created_by,
        role: 'owner',
      });

      return org;
    });
  },

  /**
   * Retrieves all organizations that a user is a member of, along with their assigned role.
   */
  async listUserOrganizations(userId) {
    return db('organizations as o')
      .join('organization_members as om', 'o.organization_id', 'om.organization_id')
      .select([
        'o.organization_id',
        'o.name',
        'o.slug',
        'o.description',
        'o.created_by',
        'o.created_at',
        'o.updated_at',
        'om.role as my_role',
        'om.joined_at',
      ])
      .where('om.user_id', userId)
      .orderBy('o.created_at', 'desc');
  },

  /**
   * Retrieves organization by ID.
   */
  async findById(organizationId) {
    return db('organizations')
      .where('organization_id', organizationId)
      .first();
  },

  /**
   * Retrieves organization by unique slug.
   */
  async findBySlug(slug) {
    return db('organizations')
      .where('slug', slug)
      .first();
  },

  /**
   * Updates organization details.
   */
  async update(organizationId, updates) {
    const [updated] = await db('organizations')
      .where('organization_id', organizationId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning(['organization_id', 'name', 'slug', 'description', 'created_by', 'created_at', 'updated_at']);
    return updated;
  },

  /**
   * Lists all members of an organization with safe user details.
   */
  async getMembers(organizationId) {
    return db('organization_members as om')
      .join('users as u', 'om.user_id', 'u.user_id')
      .select([
        'om.organization_member_id',
        'om.organization_id',
        'om.user_id',
        'om.role',
        'om.joined_at',
        'u.full_name',
        'u.email',
        'u.avatar_url',
        'u.is_active',
      ])
      .where('om.organization_id', organizationId)
      .orderBy('om.joined_at', 'asc');
  },

  /**
   * Retrieves a specific member record.
   */
  async getMember(organizationId, userId) {
    return db('organization_members')
      .where({
        organization_id: organizationId,
        user_id: userId,
      })
      .first();
  },

  /**
   * Adds a new user to an organization.
   */
  async addMember({ organization_id, user_id, role }) {
    const [member] = await db('organization_members')
      .insert({
        organization_id,
        user_id,
        role,
      })
      .returning(['organization_member_id', 'organization_id', 'user_id', 'role', 'joined_at']);
    return member;
  },

  /**
   * Updates an existing member's role.
   */
  async updateMemberRole(organizationId, userId, role) {
    const [updated] = await db('organization_members')
      .where({
        organization_id: organizationId,
        user_id: userId,
      })
      .update({ role })
      .returning(['organization_member_id', 'organization_id', 'user_id', 'role', 'joined_at']);
    return updated;
  },

  /**
   * Removes a member from an organization.
   */
  async removeMember(organizationId, userId) {
    return db('organization_members')
      .where({
        organization_id: organizationId,
        user_id: userId,
      })
      .delete();
  },

  /**
   * Counts how many owners exist in the organization.
   */
  async countOwners(organizationId) {
    const result = await db('organization_members')
      .where({
        organization_id: organizationId,
        role: 'owner',
      })
      .count('organization_member_id as count')
      .first();
    return parseInt(result?.count || 0, 10);
  },
};

export default organizationModel;
