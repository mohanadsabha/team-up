import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const updateMeSchema = z
  .object({
    username: z.string().trim().min(3).max(32).optional(),
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    profilePictureUrl: z.string().trim().url().nullable().optional(),
    universityId: z.string().trim().uuid().nullable().optional(),
    collegeId: z.string().trim().uuid().nullable().optional(),
    departmentId: z.string().trim().uuid().nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export type UpdateMe = z.infer<typeof updateMeSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean().optional(),
  reason: z.string().trim().max(255).optional(),
}) satisfies ZodType;

export type UpdateUserStatus = z.infer<typeof updateUserStatusSchema>;

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

export const getUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().optional(),
  universityId: z.string().trim().uuid().optional(),
  collegeId: z.string().trim().uuid().optional(),
  departmentId: z.string().trim().uuid().optional(),
  isActive: booleanQuerySchema.optional(),
  isVerified: booleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}) satisfies ZodType;

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;

export const getUserActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
}) satisfies ZodType;

export type GetUserActivityQuery = z.infer<typeof getUserActivityQuerySchema>;

export type PrivateUserItem = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  universityId: string | null;
  collegeId: string | null;
  departmentId: string | null;
  profilePictureUrl: string | null;
  bio: string | null;
  phone: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUserItem = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  universityId: string | null;
  collegeId: string | null;
  departmentId: string | null;
  profilePictureUrl: string | null;
  bio: string | null;
  createdAt: Date;
};

export type UserProfile = PrivateUserItem | PublicUserItem;

export type UserActivityProject = {
  id: string;
  title: string;
  summary: string;
  status: string;
  isPublished: boolean;
  isApproved: boolean;
  viewsCount: number;
  savesCount: number;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type UserProfileResponse = MessageResponse & {
  visibility: "public" | "private";
  user: UserProfile;
};

export type SingleUserResponse = MessageResponse & {
  user: PrivateUserItem;
};

export type UsersListResponse = MessageResponse & {
  results: number;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  users: PrivateUserItem[];
};

export type ProfileCompletionResponse = MessageResponse & {
  score: number;
  completedFields: number;
  totalFields: number;
  missingFields: string[];
};

export type UserActivityResponse = MessageResponse & {
  userId: string;
  stats: {
    projectsCreated: number;
    publishedProjects: number;
    approvedProjects: number;
    totalViews: number;
    totalSaves: number;
    totalPurchases: number;
  };
  teamStats: {
    joinedTeams: number;
    leftTeams: number;
    blockedFromTeaming: boolean;
    note: string;
  };
  recentProjects: UserActivityProject[];
};
