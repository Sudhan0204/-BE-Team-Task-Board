import roleService from './role.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const roleController = {
  listPermissions: asyncHandler(async (req, res) => {
    const catalog = await roleService.listPermissionsCatalog();
    return sendSuccess(res, 'Permissions catalog retrieved successfully', catalog);
  }),

  list: asyncHandler(async (req, res) => {
    const roles = await roleService.listRoles(req.tenantId);
    return sendSuccess(res, 'Roles retrieved successfully', { roles });
  }),

  getById: asyncHandler(async (req, res) => {
    const role = await roleService.getRoleById(req.tenantId, req.params.id);
    return sendSuccess(res, 'Role retrieved successfully', { role });
  }),

  create: asyncHandler(async (req, res) => {
    const role = await roleService.createRole(req.tenantId, req.body);
    return sendCreated(res, 'Role created successfully', { role });
  }),

  update: asyncHandler(async (req, res) => {
    const role = await roleService.updateRole(req.tenantId, req.params.id, req.body);
    return sendSuccess(res, 'Role updated successfully', { role });
  }),

  delete: asyncHandler(async (req, res) => {
    await roleService.deleteRole(req.tenantId, req.params.id);
    return sendNoContent(res);
  }),

  getPermissions: asyncHandler(async (req, res) => {
    const permissions = await roleService.getRolePermissions(req.tenantId, req.params.id);
    return sendSuccess(res, 'Role permissions retrieved successfully', { permissions });
  }),

  updatePermissions: asyncHandler(async (req, res) => {
    const permissions = await roleService.updateRolePermissions(req.tenantId, req.params.id, req.body);
    return sendSuccess(res, 'Role permissions updated successfully', { permissions });
  }),

  getEmployees: asyncHandler(async (req, res) => {
    const employees = await roleService.getRoleEmployees(req.tenantId, req.params.id);
    return sendSuccess(res, 'Role employees retrieved successfully', { employees });
  }),
};

export default roleController;
