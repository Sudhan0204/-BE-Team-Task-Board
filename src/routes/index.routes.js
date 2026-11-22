import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
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

// Mount Health Check endpoint
apiRouter.use('/health', healthRoutes);

// Mount OpenAPI 3.0 Documentation endpoint
apiRouter.get('/docs', (req, res) => {
  const openapiPath = path.resolve(__dirname, '../docs/openapi.json');
  if (fs.existsSync(openapiPath)) {
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    return res.json(spec);
  }
  return res.status(404).json({ success: false, message: 'OpenAPI specification not found' });
});

// Mount Feature Modules
apiRouter.use('/auth', authRoutes);
apiRouter.use('/organizations', organizationRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/comments', commentRoutes);
apiRouter.use('/labels', labelRoutes);
apiRouter.use('/attachments', attachmentRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

// Root API v1 welcome message
apiRouter.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to DevFlow REST API v1',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/api/v1/health',
      docs: '/api/v1/docs',
      auth: '/api/v1/auth',
      organizations: '/api/v1/organizations',
      projects: '/api/v1/projects',
      tasks: '/api/v1/tasks',
      comments: '/api/v1/comments',
      labels: '/api/v1/labels',
      attachments: '/api/v1/attachments',
      notifications: '/api/v1/notifications',
      dashboard: '/api/v1/dashboard',
    },
  });
});

export default apiRouter;
