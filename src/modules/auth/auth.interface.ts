import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

const userRoleSchema = z.enum(["STUDENT", "MENTOR", "GRADUATE"]);

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const signUpSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email(),
  password: z.string().min(8).max(32),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  universityId: z.string().trim().uuid(),
  collegeId: z.string().trim().uuid(),
  departmentId: z.string().trim().uuid(),
  major: z.string().trim().min(2).max(120).optional(),
  skills: z.array(z.string().trim().min(2).max(50)).min(1).max(20),
  role: userRoleSchema.default("STUDENT"),
}) satisfies ZodType;

export const createDevSystemAdminSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email(),
  password: z.string().min(8).max(32),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
}) satisfies ZodType;

export type SignUp = z.infer<typeof signUpSchema>;
export type CreateDevSystemAdmin = z.infer<typeof createDevSystemAdminSchema>;

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
  verificationToken?: string;
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
export type VerifyEmail = TokenBody;

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
  userId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .refine((val) => val === undefined || val !== "", {
      message: "userId cannot be an empty string",
    }),
}) satisfies ZodType;

export type RevokeTokens = z.infer<typeof revokeTokensSchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type ForgotPasswordResponse = MessageResponse & {
  resetToken?: string;
};

export type ValidateTokenResponse = {
  success: boolean;
  valid: boolean;
  user?: AuthUser;
};

export type AdminUserResponse = MessageResponse & {
  user: AuthUser;
};
