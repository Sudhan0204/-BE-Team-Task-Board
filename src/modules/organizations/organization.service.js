import organizationModel from './organization.model.js';
import authModel from '../auth/auth.model.js';
import { ApiError } from '../../utils/ApiError.js';

export const organizationService = {
  /**
   * Create new organization and bind creator as owner
   */
  async createOrganization(userId, { name, slug, description }) {
    const existing = await organizationModel.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict('An organization with this slug already exists.', [
        { field: 'slug', message: 'Slug is already in use' },
      ]);
    }

    return organizationModel.create({
      name,
      slug,
      description,
      created_by: userId,
    });
  },

  /**
   * List organizations for the user
   */
  async getUserOrganizations(userId) {
    return organizationModel.listUserOrganizations(userId);
  },

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId) {
    const org = await organizationModel.findById(organizationId);
    if (!org) {
      throw ApiError.notFound('Organization not found.');
    }
    return org;
  },

  /**
   * Update organization settings
   */
  async updateOrganization(organizationId, updates) {
    if (updates.slug) {
      const existing = await organizationModel.findBySlug(updates.slug);
      if (existing && String(existing.organization_id) !== String(organizationId)) {
        throw ApiError.conflict('This organization slug is already in use.', [
          { field: 'slug', message: 'Slug already taken' },
        ]);
      }
    }

    const updated = await organizationModel.update(organizationId, updates);
    if (!updated) {
      throw ApiError.notFound('Organization not found.');
    }
    return updated;
  },

  /**
   * List organization members
   */
  async getMembers(organizationId) {
    return organizationModel.getMembers(organizationId);
  },

  /**
   * Add a member to the organization
   */
  async addMember(organizationId, actorUser, { user_id, role }) {
    // 1. Verify user exists
    const targetUser = await authModel.findById(user_id);
    if (!targetUser) {
      throw ApiError.notFound('User to add was not found in the system.');
    }

    // 2. Check if already a member
    const existingMember = await organizationModel.getMember(organizationId, user_id);
    if (existingMember) {
      throw ApiError.conflict('This user is already a member of this organization.');
    }

    // 3. Permission checks: admin cannot add an owner
    if (role === 'owner' && actorUser.role !== 'owner') {
      throw ApiError.forbidden('Only an organization owner can assign the owner role.');
    }

    return organizationModel.addMember({
      organization_id: organizationId,
      user_id,
      role,
    });
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(organizationId, actorUser, targetUserId, newRole) {
    const targetMember = await organizationModel.getMember(organizationId, targetUserId);
    if (!targetMember) {
      throw ApiError.notFound('Target member was not found in this organization.');
    }

    // Only owner can assign owner role or demote another owner
    if (targetMember.role === 'owner' && actorUser.role !== 'owner') {
      throw ApiError.forbidden('Only an organization owner can modify another owner.');
    }

    if (newRole === 'owner' && actorUser.role !== 'owner') {
      throw ApiError.forbidden('Only an organization owner can promote a member to owner.');
    }

    // Prevent demoting the final owner
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await organizationModel.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw ApiError.badRequest(
          'Cannot demote the only owner. Transfer ownership or promote another member first.'
        );
      }
    }

    return organizationModel.updateMemberRole(organizationId, targetUserId, newRole);
  },

  /**
   * Remove a member from the organization
   */
  async removeMember(organizationId, actorUser, targetUserId) {
    const targetMember = await organizationModel.getMember(organizationId, targetUserId);
    if (!targetMember) {
      throw ApiError.notFound('Member not found in this organization.');
    }

    // Admins cannot remove owners or other admins
    if (actorUser.role === 'admin' && (targetMember.role === 'owner' || targetMember.role === 'admin')) {
      throw ApiError.forbidden('Admins cannot remove owners or fellow administrators.');
    }

    // Prevent removing the last owner
    if (targetMember.role === 'owner') {
      const ownerCount = await organizationModel.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw ApiError.badRequest(
          'Cannot remove the last owner of the organization. Transfer ownership first.'
        );
      }
    }

    await organizationModel.removeMember(organizationId, targetUserId);
    return { success: true };
  },
};

export default organizationService;
