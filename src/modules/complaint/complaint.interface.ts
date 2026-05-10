import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createComplaintSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(1000),
  targetUserId: z.string().trim().uuid().optional(),
  targetProjectId: z.string().trim().uuid().optional(),
}) satisfies ZodType;

export const updateComplaintStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "INVESTIGATING", "RESOLVED"]),
}) satisfies ZodType;

export const getComplaintsQuerySchema = z.object({
  status: z.enum(["SUBMITTED", "INVESTIGATING", "RESOLVED"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}) satisfies ZodType;

export type CreateComplaint = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatus = z.infer<typeof updateComplaintStatusSchema>;
export type GetComplaintsQuery = z.infer<typeof getComplaintsQuerySchema>;

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

export type ComplaintResponse = {
  id: string;
  reporterId: string;
  title: string;
  description: string;
  status: string;
  targetUserId: string | null;
  targetProjectId: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ComplaintDetailsResponse = MessageResponse & {
  complaint: ComplaintResponse & {
    reporter: UserPreviewResponse;
    targetUser: UserPreviewResponse | null;
    resolvedByUser: UserPreviewResponse | null;
  };
};

export type ComplaintsListResponse = MessageResponse & {
  results: number;
  complaints: (ComplaintResponse & {
    reporter: UserPreviewResponse;
  })[];
};

export type ComplaintStatsResponse = MessageResponse & {
  total: number;
  submitted: number;
  investigating: number;
  resolved: number;
};
