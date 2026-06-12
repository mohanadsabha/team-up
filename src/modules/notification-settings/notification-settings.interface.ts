import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const updateNotificationSettingsSchema = z.object({
  joinRequestStatus: z.boolean().optional(),
  milestoneStatus: z.boolean().optional(),
  mentorInvitationStatus: z.boolean().optional(),
  meetingReminders: z.boolean().optional(),
  projectApprovedRejected: z.boolean().optional(),
  taskDeadlineReminders: z.boolean().optional(),
  taskStatus: z.boolean().optional(),
  teamStatusChanges: z.boolean().optional(),
}) satisfies ZodType;

export type UpdateNotificationSettingsRequest = z.infer<
  typeof updateNotificationSettingsSchema
>;

export interface NotificationSettingsResponse {
  id: string;
  userId: string;
  joinRequestStatus: boolean;
  milestoneStatus: boolean;
  mentorInvitationStatus: boolean;
  meetingReminders: boolean;
  projectApprovedRejected: boolean;
  taskDeadlineReminders: boolean;
  taskStatus: boolean;
  teamStatusChanges: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettingsMessageResponse {
  success: boolean;
  message: string;
  settings?: NotificationSettingsResponse;
}

export interface NotificationSettingsListResponse {
  success: boolean;
  message: string;
  settings: NotificationSettingsResponse;
}
