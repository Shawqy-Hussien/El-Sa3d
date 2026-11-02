import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.input<typeof paginationSchema>;
export type Pagination = z.output<typeof paginationSchema>;

export const authEmailSchema = z.string().trim().toLowerCase().email().max(320);

export const strongPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registrationSchema = z
  .object({ email: authEmailSchema, password: strongPasswordSchema })
  .strict();

export const loginSchema = z
  .object({
    email: authEmailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshSchema = z
  .object({ refreshToken: z.string().min(32).max(256).optional() })
  .strict();

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: strongPasswordSchema,
  })
  .strict();

export const passwordResetRequestSchema = z
  .object({ email: authEmailSchema })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: strongPasswordSchema,
  })
  .strict();

export const emailVerificationSchema = z
  .object({ token: z.string().min(32).max(256) })
  .strict();

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
