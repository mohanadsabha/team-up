import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

const userRoleSchema = z.enum(["STUDENT", "MENTOR", "GRADUATE"]);

export const signUpSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email(),
  password: z.string().min(8).max(32),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  role: userRoleSchema.default("STUDENT"),
}) satisfies ZodType;

export type SignUp = z.infer<typeof signUpSchema>;

export type Login = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  lastLogin: Date | null;
};

export type AuthTokenResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(32),
}) satisfies ZodType;

export const tokenSchema = z.object({
  token: z.string().trim().min(1),
}) satisfies ZodType;

export type TokenBody = z.infer<typeof tokenSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
}) satisfies ZodType;

export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(8).max(32),
}) satisfies ZodType;

export type ResetPassword = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(32),
  newPassword: z.string().min(8).max(32),
}) satisfies ZodType;

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const revokeTokensSchema = z.object({
  userId: z.string().trim().uuid(),
}) satisfies ZodType;

export type RevokeTokens = z.infer<typeof revokeTokensSchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type ValidateTokenResponse = {
  success: boolean;
  valid: boolean;
  user?: AuthUser;
};
