import tenantService from './tenant.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const tenantController = {
  getPublicBranding: asyncHandler(async (req, res) => {
    const tenant = await tenantService.getPublicBranding(req.params.slug);
    return sendSuccess(res, 'Company branding retrieved successfully', { tenant });
  }),

  list: asyncHandler(async (req, res) => {
    const { tenants, pagination } = await tenantService.listTenants(req.query);
    return sendPaginated(res, tenants, pagination, 'Companies retrieved successfully');
  }),

  getById: asyncHandler(async (req, res) => {
    const tenant = await tenantService.getTenantById(req.params.id);
    return sendSuccess(res, 'Company retrieved successfully', { tenant });
  }),

  create: asyncHandler(async (req, res) => {
    const result = await tenantService.createTenant(req.body, req.file || null);
    return sendCreated(res, 'Company created successfully', result);
  }),

  update: asyncHandler(async (req, res) => {
    const tenant = await tenantService.updateTenant(req.params.id, req.body, req.file || null);
    return sendSuccess(res, 'Company updated successfully', { tenant });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const tenant = await tenantService.updateTenantStatus(req.params.id, req.body.status);
    return sendSuccess(res, `Company status updated to ${tenant.status}`, { tenant });
  }),

  uploadLogo: asyncHandler(async (req, res) => {
    const tenant = await tenantService.updateTenant(req.params.id, {}, req.file || null);
    return sendSuccess(res, 'Company logo uploaded successfully', { tenant });
  }),
};

export default tenantController;
