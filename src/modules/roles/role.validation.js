import { z } from 'zod';

export const createRoleSchema = z.object({
  role_name: z
    .string({ error: 'Role name is required' })
    .trim()
    .min(2, 'Role name must be at least 2 characters')
    .max(100, 'Role name cannot exceed 100 characters'),
  description: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  permission_ids: z.array(z.union([z.number().int().positive(), z.string()])).optional().default([]),
  permission_keys: z.array(z.string().trim().min(1)).optional().default([]),
});

export const updateRoleSchema = z.object({
  role_name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  permission_ids: z.array(z.union([z.number().int().positive(), z.string()])).optional(),
  permission_keys: z.array(z.string().trim().min(1)).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permission_ids: z.array(z.union([z.number().int().positive(), z.string()])).optional(),
  permission_keys: z.array(z.string().trim().min(1)).optional(),
});

export default {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
};
