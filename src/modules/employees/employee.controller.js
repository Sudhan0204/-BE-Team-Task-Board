import employeeService from './employee.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const employeeController = {
  list: asyncHandler(async (req, res) => {
    const { employees, departments, pagination } = await employeeService.listEmployees(
      req.tenantId,
      req.query
    );
    return res.status(200).json({
      success: true,
      message: 'Employees retrieved successfully',
      data: {
        items: employees,
        employees,
        departments,
      },
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit) || 1,
      },
    });
  }),

  getById: asyncHandler(async (req, res) => {
    const employee = await employeeService.getEmployeeById(req.tenantId, req.params.id);
    return sendSuccess(res, 'Employee retrieved successfully', { employee });
  }),

  create: asyncHandler(async (req, res) => {
    const employee = await employeeService.createEmployee(
      req.tenantId,
      req.user.user_id,
      req.body
    );
    return sendCreated(res, 'Employee created successfully', { employee });
  }),

  update: asyncHandler(async (req, res) => {
    const employee = await employeeService.updateEmployee(
      req.tenantId,
      req.user.user_id,
      req.params.id,
      req.body
    );
    return sendSuccess(res, 'Employee updated successfully', { employee });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const employee = await employeeService.updateStatus(
      req.tenantId,
      req.params.id,
      req.body.is_active
    );
    return sendSuccess(
      res,
      `Employee ${employee.is_active ? 'activated' : 'deactivated'} successfully`,
      { employee }
    );
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await employeeService.resetPassword(req.tenantId, req.params.id, req.body.new_password);
    return sendSuccess(res, 'Employee password reset successfully.');
  }),

  delete: asyncHandler(async (req, res) => {
    await employeeService.deleteEmployee(req.tenantId, req.user.user_id, req.params.id);
    return sendNoContent(res);
  }),

  getRoles: asyncHandler(async (req, res) => {
    const roles = await employeeService.getEmployeeRoles(req.tenantId, req.params.id);
    return sendSuccess(res, 'Employee roles retrieved successfully', { roles });
  }),

  assignRoles: asyncHandler(async (req, res) => {
    const employee = await employeeService.assignRoles(
      req.tenantId,
      req.user.user_id,
      req.params.id,
      req.body.role_ids
    );
    return sendSuccess(res, 'Employee roles updated successfully', { employee });
  }),
};

export default employeeController;
