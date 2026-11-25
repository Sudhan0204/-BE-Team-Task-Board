import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createTenantSchema = z.object({
  company_name: z.string({ error: 'Company name is required' }).trim().min(2).max(180),
  slug: z
    .string({ error: 'Company slug is required' })
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  email: z.string({ error: 'Company email is required' }).trim().email('Valid company email is required'),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal('')),
  website: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  address: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  description: z.string().trim().max(1500).optional().nullable().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).optional().default('active'),

  // Initial Company Administrator Information
  admin_full_name: z.string({ error: 'Admin full name is required' }).trim().min(2).max(150),
  admin_email: z.string({ error: 'Admin email is required' }).trim().email('Valid admin email is required'),
  admin_password: z
    .string({ error: 'Admin password is required' })
    .min(8, 'Admin password must be at least 8 characters')
    .max(128),

  // Subscription Information
  plan_id: z.coerce.number().int().positive().optional(),
  subscription_start_date: z.string().optional().nullable().or(z.literal('')),
  subscription_end_date: z.string().optional().nullable().or(z.literal('')),
  max_employees: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  max_projects: z.coerce.number().int().min(1).max(100000).optional().nullable(),
});

export const updateTenantSchema = z.object({
  company_name: z.string().trim().min(2).max(180).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .optional(),
  email: z.string().trim().email('Valid company email is required').optional(),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal('')),
  website: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  address: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  description: z.string().trim().max(1500).optional().nullable().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  plan_id: z.coerce.number().int().positive().optional(),
  subscription_start_date: z.string().optional().nullable().or(z.literal('')),
  subscription_end_date: z.string().optional().nullable().or(z.literal('')),
  max_employees: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  max_projects: z.coerce.number().int().min(1).max(100000).optional().nullable(),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended'], {
    error: 'Status must be active, inactive, or suspended',
  }),
});

export default {
  createTenantSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
};
