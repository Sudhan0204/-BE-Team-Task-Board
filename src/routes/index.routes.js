import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './health.routes.js';
import superAdminRoutes from '../modules/super-admin/superAdmin.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import authController from '../modules/auth/auth.controller.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema } from '../modules/auth/auth.validation.js';
import employeeRoutes from '../modules/employees/employee.routes.js';
import roleRoutes from '../modules/roles/role.routes.js';
import permissionRoutes from '../modules/roles/permission.routes.js';
import organizationRoutes from '../modules/organizations/organization.routes.js';
import projectRoutes from '../modules/projects/project.routes.js';
import taskRoutes from '../modules/tasks/task.routes.js';
import commentRoutes from '../modules/comments/comment.routes.js';
import labelRoutes from '../modules/labels/label.routes.js';
import attachmentRoutes from '../modules/attachments/attachment.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiRouter = Router();

// Health & OpenAPI Docs
apiRouter.use('/health', healthRoutes);

apiRouter.get('/docs', (req, res) => {
  const openapiPath = path.resolve(__dirname, '../docs/openapi.json');
  if (fs.existsSync(openapiPath)) {
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    return res.json(spec);
  }
  return res.status(404).json({ success: false, message: 'OpenAPI specification not found' });
});

// Platform Super Admin & Multi-Tenant Company Management
apiRouter.use('/super-admin', superAdminRoutes);
apiRouter.use('/tenants', tenantRoutes);

// Company Admin Login alias (/api/admin/login and /api/v1/admin/login)
apiRouter.post(
  '/admin/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  authController.adminLogin
);

// Company Authentication, Employees, Dynamic Roles & Permissions
apiRouter.use('/auth', authRoutes);
apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/permissions', permissionRoutes);

// Workspace, Projects, Tasks, Comments, Labels, Attachments, Notifications, Dashboard
apiRouter.use('/organizations', organizationRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/comments', commentRoutes);
apiRouter.use('/labels', labelRoutes);
apiRouter.use('/attachments', attachmentRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

apiRouter.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Team Task Board Multi-Tenant SaaS REST API',
    version: '2.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/api/health',
      superAdmin: '/api/super-admin',
      tenants: '/api/tenants',
      adminLogin: '/api/admin/login',
      auth: '/api/auth',
      employees: '/api/employees',
      roles: '/api/roles',
      permissions: '/api/permissions',
      projects: '/api/projects',
      tasks: '/api/tasks',
      comments: '/api/comments',
      labels: '/api/labels',
      attachments: '/api/attachments',
      notifications: '/api/notifications',
      dashboard: '/api/dashboard',
    },
  });
});

export default apiRouter;
