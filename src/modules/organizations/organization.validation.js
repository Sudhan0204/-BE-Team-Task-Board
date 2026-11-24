import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string({ error: 'Organization name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name cannot exceed 150 characters'),
  slug: z
    .string({ error: 'Organization slug is required' })
    .trim()
    .toLowerCase()
    .min(2, 'Slug must be at least 2 characters')
    .max(180, 'Slug cannot exceed 180 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const addMemberSchema = z.object({
  user_id: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  role: z.enum(['admin', 'member'], {
    error: "Role must be 'admin' or 'member'",
  }),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member'], {
    error: "Role must be 'owner', 'admin', or 'member'",
  }),
});

export default {
  createOrganizationSchema,
  updateOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
};
