import superAdminService from './superAdmin.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { setSuperAdminCookie, clearSuperAdminCookie } from '../../utils/cookies.js';

export const superAdminController = {
  login: asyncHandler(async (req, res) => {
    const result = await superAdminService.login(req.body);
    setSuperAdminCookie(res, result.token);
    return sendSuccess(res, 'Super Admin login successful', result);
  }),

  logout: asyncHandler(async (req, res) => {
    clearSuperAdminCookie(res);
    return sendSuccess(res, 'Super Admin logged out successfully.');
  }),

  getMe: asyncHandler(async (req, res) => {
    const superAdmin = await superAdminService.getMe(req.superAdmin.super_admin_id);
    return sendSuccess(res, 'Super Admin profile retrieved successfully', { superAdmin });
  }),

  getDashboard: asyncHandler(async (req, res) => {
    const metrics = await superAdminService.getDashboard();
    return sendSuccess(res, 'Platform dashboard metrics retrieved successfully', metrics);
  }),

  listPlans: asyncHandler(async (req, res) => {
    const plans = await superAdminService.listPlans();
    return sendSuccess(res, 'Subscription plans retrieved successfully', { plans });
  }),

  createPlan: asyncHandler(async (req, res) => {
    const plan = await superAdminService.createPlan(req.body);
    return sendCreated(res, 'Subscription plan created successfully', { plan });
  }),

  updatePlan: asyncHandler(async (req, res) => {
    const plan = await superAdminService.updatePlan(req.params.id, req.body);
    return sendSuccess(res, 'Subscription plan updated successfully', { plan });
  }),
};

export default superAdminController;
