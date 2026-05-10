import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  projectId: z.string().trim().uuid().optional(),
  mentorId: z.string().trim().uuid().optional(),
  maxMembers: z.number().int().min(2).max(50).optional(),
}) satisfies ZodType;

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    projectId: z.string().trim().uuid().nullable().optional(),
    mentorId: z.string().trim().uuid().nullable().optional(),
    maxMembers: z.number().int().min(2).max(50).optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "PUBLISHED", "COMPLETED"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const addTeamMemberSchema = z.object({
  userId: z.string().trim().uuid(),
  role: z.enum(["TEAM_ADMIN", "MEMBER", "MENTOR"]).default("MEMBER"),
}) satisfies ZodType;

export const updateTeamMemberSchema = z.object({
  role: z.enum(["TEAM_ADMIN", "MEMBER", "MENTOR"]),
}) satisfies ZodType;

export const getTeamsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "PUBLISHED", "COMPLETED"]).optional(),
  mentorId: z.string().trim().uuid().optional(),
  projectId: z.string().trim().uuid().optional(),
}) satisfies ZodType;

export const getTeamMembersQuerySchema = z.object({
  role: z.enum(["TEAM_ADMIN", "MEMBER", "MENTOR"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
}) satisfies ZodType;

export type CreateTeam = z.infer<typeof createTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type AddTeamMember = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
export type GetTeamsQuery = z.infer<typeof getTeamsQuerySchema>;
export type GetTeamMembersQuery = z.infer<typeof getTeamMembersQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type TeamResponse = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  mentorId: string | null;
  status: string;
  maxMembers: number;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMemberResponse = {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  status: string;
  joinedAt: Date;
};

export type UserPreviewResponse = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  profilePictureUrl: string | null;
};

export type TeamDetailsResponse = MessageResponse & {
  team: TeamResponse & {
    members: (TeamMemberResponse & { user: UserPreviewResponse })[];
    mentor: UserPreviewResponse | null;
  };
};

export type TeamsListResponse = MessageResponse & {
  results: number;
  teams: TeamResponse[];
};

export type TeamMembersListResponse = MessageResponse & {
  results: number;
  members: (TeamMemberResponse & { user: UserPreviewResponse })[];
};
