import { z } from 'zod';

export const superAdminLoginSchema = z.object({
  email: z.string({ error: 'Email is required' }).trim().email('Valid email address is required'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const createPlanSchema = z.object({
  plan_name: z.string({ error: 'Plan name is required' }).trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  max_employees: z.coerce.number().int().min(1).max(100000),
  max_projects: z.coerce.number().int().min(1).max(100000),
  price: z.coerce.number().min(0).max(999999),
  billing_cycle: z.enum(['monthly', 'yearly', 'custom']).default('monthly'),
  is_active: z.boolean().optional().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export default {
  superAdminLoginSchema,
  createPlanSchema,
  updatePlanSchema,
};
