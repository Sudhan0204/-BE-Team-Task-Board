import { z } from 'zod';

export const registerSchema = z.object({
  full_name: z
    .string({ error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name cannot exceed 150 characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  avatar_url: z.string().url('Avatar must be a valid URL').optional().nullable(),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
  remember_me: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Reset token is required' })
    .trim()
    .min(32, 'Invalid token length'),
  password: z
    .string({ error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export default {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
