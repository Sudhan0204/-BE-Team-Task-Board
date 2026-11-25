import { z } from 'zod';

export const createEmployeeSchema = z.object({
  full_name: z.string({ error: 'Full name is required' }).trim().min(2).max(150),
  email: z.string({ error: 'Email is required' }).trim().email('Valid email address is required'),
  password: z
    .string({ error: 'Temporary password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal('')),
  employee_code: z.string().trim().max(60).optional().nullable().or(z.literal('')),
  department: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  designation: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  avatar_url: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional().default(true),
  role_ids: z.array(z.union([z.number().int().positive(), z.string()])).optional(),
  role_id: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
});

export const updateEmployeeSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email('Valid email address is required').optional(),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal('')),
  employee_code: z.string().trim().max(60).optional().nullable().or(z.literal('')),
  department: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  designation: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  avatar_url: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional(),
  role_ids: z.array(z.union([z.number().int().positive(), z.string()])).optional(),
  role_id: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
});

export const updateEmployeeStatusSchema = z.object({
  is_active: z.boolean({ error: 'is_active boolean is required' }),
});

export const resetEmployeePasswordSchema = z.object({
  new_password: z
    .string({ error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

export const assignEmployeeRolesSchema = z.object({
  role_ids: z
    .array(z.union([z.number().int().positive(), z.string()]))
    .min(1, 'At least one role must be assigned to an employee'),
});

export default {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  resetEmployeePasswordSchema,
  assignEmployeeRolesSchema,
};
