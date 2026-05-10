import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createMilestoneSchema = z.object({
  teamId: z.string().trim().uuid(),
  projectId: z.string().trim().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
}) satisfies ZodType;

export const updateMilestoneSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const submitMilestoneSchema = z.object({
  submittedAt: z.coerce.date().optional(),
}) satisfies ZodType;

export const reviewMilestoneSchema = z.object({
  status: z.enum(["APPROVED", "NEEDS_REVISION", "REJECTED"]),
  reviewNotes: z.string().trim().max(1000).optional(),
}) satisfies ZodType;

export const getMilestonesQuerySchema = z.object({
  teamId: z.string().trim().uuid().optional(),
  projectId: z.string().trim().uuid().optional(),
  status: z
    .enum(["PENDING", "APPROVED", "NEEDS_REVISION", "REJECTED"])
    .optional(),
}) satisfies ZodType;

export type CreateMilestone = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;
export type SubmitMilestone = z.infer<typeof submitMilestoneSchema>;
export type ReviewMilestone = z.infer<typeof reviewMilestoneSchema>;
export type GetMilestonesQuery = z.infer<typeof getMilestonesQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type UserPreviewResponse = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
};

export type MilestoneResponse = {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MilestoneDetailsResponse = MessageResponse & {
  milestone: MilestoneResponse & {
    reviewer: UserPreviewResponse | null;
  };
};

export type MilestonesListResponse = MessageResponse & {
  results: number;
  milestones: (MilestoneResponse & {
    reviewer: UserPreviewResponse | null;
  })[];
};
