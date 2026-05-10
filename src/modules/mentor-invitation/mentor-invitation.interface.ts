import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const inviteMentorSchema = z.object({
  mentorId: z.string().trim().uuid(),
}) satisfies ZodType;

export type InviteMentor = z.infer<typeof inviteMentorSchema>;

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

export type TeamPreviewResponse = {
  id: string;
  name: string;
  description: string | null;
};

export type MentorInvitationResponse = {
  teamId: string;
  mentorId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  sentAt: Date;
  respondedAt: Date | null;
  team: TeamPreviewResponse;
  mentor: UserPreviewResponse;
};

export type MentorInvitationsListResponse = MessageResponse & {
  results: number;
  invitations: MentorInvitationResponse[];
};

export type TeamWithMentorResponse = MessageResponse & {
  team: {
    id: string;
    name: string;
    description: string | null;
    mentorId: string | null;
    mentorApproved: boolean;
    mentor: UserPreviewResponse | null;
  };
};
