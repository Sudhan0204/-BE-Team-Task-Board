import organizationService from './organization.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const organizationController = {
  create: asyncHandler(async (req, res) => {
    const org = await organizationService.createOrganization(req.user.user_id, req.body);
    return sendCreated(res, 'Organization created successfully', { organization: org });
  }),

  list: asyncHandler(async (req, res) => {
    const organizations = await organizationService.getUserOrganizations(req.user.user_id);
    return sendSuccess(res, 'Organizations retrieved successfully', { organizations });
  }),

  getById: asyncHandler(async (req, res) => {
    const org = await organizationService.getOrganizationById(req.params.organizationId);
    return sendSuccess(res, 'Organization retrieved successfully', { organization: org });
  }),

  update: asyncHandler(async (req, res) => {
    const updated = await organizationService.updateOrganization(req.params.organizationId, req.body);
    return sendSuccess(res, 'Organization updated successfully', { organization: updated });
  }),

  getMembers: asyncHandler(async (req, res) => {
    const members = await organizationService.getMembers(req.params.organizationId);
    return sendSuccess(res, 'Organization members retrieved successfully', { members });
  }),

  addMember: asyncHandler(async (req, res) => {
    const member = await organizationService.addMember(
      req.params.organizationId,
      req.orgMembership,
      req.body
    );
    return sendCreated(res, 'Member added to organization successfully', { member });
  }),

  updateMemberRole: asyncHandler(async (req, res) => {
    const member = await organizationService.updateMemberRole(
      req.params.organizationId,
      req.orgMembership,
      req.params.userId,
      req.body.role
    );
    return sendSuccess(res, 'Member role updated successfully', { member });
  }),

  removeMember: asyncHandler(async (req, res) => {
    await organizationService.removeMember(
      req.params.organizationId,
      req.orgMembership,
      req.params.userId
    );
    return sendNoContent(res);
  }),
};

export default organizationController;
