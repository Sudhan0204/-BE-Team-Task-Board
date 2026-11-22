import { z } from 'zod';

export const createLabelSchema = z.object({
  name: z
    .string({ required_error: 'Label name is required' })
    .trim()
    .min(1, 'Label name cannot be empty')
    .max(80, 'Label name cannot exceed 80 characters'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid 6-character hex code (e.g. #6366F1)')
    .optional()
    .default('#6366F1'),
});

export const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid 6-character hex code (e.g. #6366F1)')
    .optional(),
});

export default {
  createLabelSchema,
  updateLabelSchema,
};
