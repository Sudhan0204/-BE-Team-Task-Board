/**
 * Canonical System Permission Catalog for Dynamic Tenant RBAC.
 * Shared across migrations, seeds, and authorization checks.
 */
export const SYSTEM_PERMISSIONS = [
  // Dashboard
  { permission_key: 'dashboard.view', module_name: 'Dashboard', action_name: 'view', description: 'View company dashboard and summary metrics' },

  // Employees
  { permission_key: 'employees.view', module_name: 'Employees', action_name: 'view', description: 'View company employee directory and profiles' },
  { permission_key: 'employees.create', module_name: 'Employees', action_name: 'create', description: 'Add new employees to the company' },
  { permission_key: 'employees.update', module_name: 'Employees', action_name: 'update', description: 'Edit employee details, status, and reset passwords' },
  { permission_key: 'employees.delete', module_name: 'Employees', action_name: 'delete', description: 'Delete employee accounts' },

  // Roles & Permissions
  { permission_key: 'roles.view', module_name: 'Roles', action_name: 'view', description: 'View custom roles and permission matrix' },
  { permission_key: 'roles.create', module_name: 'Roles', action_name: 'create', description: 'Create new tenant-specific roles' },
  { permission_key: 'roles.update', module_name: 'Roles', action_name: 'update', description: 'Edit roles, configure permissions, and assign roles to employees' },
  { permission_key: 'roles.delete', module_name: 'Roles', action_name: 'delete', description: 'Delete unused custom roles' },

  // Projects
  { permission_key: 'projects.view', module_name: 'Projects', action_name: 'view', description: 'View accessible projects and project members' },
  { permission_key: 'projects.create', module_name: 'Projects', action_name: 'create', description: 'Create new projects within the company' },
  { permission_key: 'projects.update', module_name: 'Projects', action_name: 'update', description: 'Edit projects and manage project members' },
  { permission_key: 'projects.delete', module_name: 'Projects', action_name: 'delete', description: 'Delete projects' },

  // Tasks
  { permission_key: 'tasks.view', module_name: 'Tasks', action_name: 'view', description: 'View tasks, Kanban board, and activity logs' },
  { permission_key: 'tasks.create', module_name: 'Tasks', action_name: 'create', description: 'Create new tasks in projects' },
  { permission_key: 'tasks.update', module_name: 'Tasks', action_name: 'update', description: 'Update task details, status, and Kanban position' },
  { permission_key: 'tasks.delete', module_name: 'Tasks', action_name: 'delete', description: 'Delete tasks' },
  { permission_key: 'tasks.assign', module_name: 'Tasks', action_name: 'assign', description: 'Assign or reassign tasks to project members' },

  // Comments
  { permission_key: 'comments.create', module_name: 'Comments', action_name: 'create', description: 'Post comments on tasks' },
  { permission_key: 'comments.update', module_name: 'Comments', action_name: 'update', description: 'Edit comments on tasks' },
  { permission_key: 'comments.delete', module_name: 'Comments', action_name: 'delete', description: 'Delete comments on tasks' },

  // Reports
  { permission_key: 'reports.view', module_name: 'Reports', action_name: 'view', description: 'View project progress and analytics reports' },

  // Settings
  { permission_key: 'settings.view', module_name: 'Settings', action_name: 'view', description: 'View company workspace settings' },
  { permission_key: 'settings.update', module_name: 'Settings', action_name: 'update', description: 'Update company workspace settings' },
];

export const DEFAULT_EMPLOYEE_PERMISSION_KEYS = [
  'dashboard.view',
  'projects.view',
  'tasks.view',
  'tasks.create',
  'tasks.update',
  'comments.create',
  'comments.update',
];

export const ALL_PERMISSION_KEYS = SYSTEM_PERMISSIONS.map((p) => p.permission_key);

export default {
  SYSTEM_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSION_KEYS,
  ALL_PERMISSION_KEYS,
};
