import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;
export type IdParam = z.infer<typeof idParamSchema>;

export const createJoinRequestSchema = z.object({
  teamId: z.string().trim().uuid(),
  coverLetter: z.string().trim().max(2000).optional(),
}) satisfies ZodType;
export type CreateJoinRequest = z.infer<typeof createJoinRequestSchema>;

export const respondJoinRequestSchema = z.object({
  accept: z.boolean(),
  feedback: z.string().trim().max(1000).optional(),
}) satisfies ZodType;
export type RespondJoinRequest = z.infer<typeof respondJoinRequestSchema>;

export const getRequestsQuerySchema = z.object({
  teamId: z.string().trim().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
}) satisfies ZodType;
export type GetRequestsQuery = z.infer<typeof getRequestsQuerySchema>;

export type MessageResponse = { success: boolean; message: string };

export type JoinRequestResponse = {
  id: string;
  teamId: string;
  userId: string;
  coverLetter: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  respondedAt: Date | null;
};

export type JoinRequestsListResponse = MessageResponse & {
  results: number;
  requests: JoinRequestResponse[];
};
