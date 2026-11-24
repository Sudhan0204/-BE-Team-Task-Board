import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string({ error: 'Project name is required' })
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(200, 'Project name cannot exceed 200 characters'),
  project_key: z
    .string({ error: 'Project key is required' })
    .trim()
    .toUpperCase()
    .min(2, 'Project key must be at least 2 characters')
    .max(20, 'Project key cannot exceed 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Project key must contain only uppercase alphanumeric characters (e.g. DEV, PROJ)'),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived', 'completed']).optional().default('active'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional().nullable(),
});

export const addProjectMemberSchema = z.object({
  user_id: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  role: z.enum(['project_manager', 'developer', 'viewer']).optional().default('developer'),
});

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['project_manager', 'developer', 'viewer'], {
    error: "Role must be 'project_manager', 'developer', or 'viewer'",
  }),
});

export default {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
};
