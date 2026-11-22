import { z } from 'zod';

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Task title is required' })
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(250, 'Title cannot exceed 250 characters'),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional().default('backlog'),
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
  assigned_to: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional().nullable(),
  position: z.number().optional().default(1000),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(250).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigned_to: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional().nullable(),
  position: z.number().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(TASK_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${TASK_STATUSES.join(', ')}` }),
  }),
});

export const updateAssigneeSchema = z.object({
  assigned_to: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).nullable(),
});

export const updatePositionSchema = z.object({
  position: z.number({ required_error: 'Position number is required' }),
  status: z.enum(TASK_STATUSES).optional(),
});

export const listTasksQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigned_to: z.string().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'position', 'due_date', 'priority', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
});

export default {
  TASK_STATUSES,
  TASK_PRIORITIES,
  createTaskSchema,
  updateTaskSchema,
  updateStatusSchema,
  updateAssigneeSchema,
  updatePositionSchema,
  listTasksQuerySchema,
};
