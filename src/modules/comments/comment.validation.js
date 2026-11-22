import { z } from 'zod';

export const createCommentSchema = z.object({
  comment_text: z
    .string({ required_error: 'Comment text is required' })
    .trim()
    .min(1, 'Comment text cannot be empty')
    .max(5000, 'Comment text cannot exceed 5000 characters'),
});

export const updateCommentSchema = z.object({
  comment_text: z
    .string({ required_error: 'Comment text is required' })
    .trim()
    .min(1, 'Comment text cannot be empty')
    .max(5000, 'Comment text cannot exceed 5000 characters'),
});

export default {
  createCommentSchema,
  updateCommentSchema,
};
