import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createNotificationSchema = z.object({
  userId: z.string().trim().uuid(),
  type: z.enum([
    "JOIN_REQUEST_RECEIVED",
    "JOIN_REQUEST_ACCEPTED",
    "JOIN_REQUEST_REJECTED",
    "TASK_ASSIGNED",
    "TASK_COMPLETED",
    "MILESTONE_STATUS_CHANGED",
    "MEETING_REMINDER",
    "MESSAGE_RECEIVED",
    "PROJECT_APPROVED",
    "PROJECT_REJECTED",
    "MENTOR_INVITATION_SENT",
    "MENTOR_INVITATION_ACCEPTED",
    "MENTOR_INVITATION_REJECTED",
  ]),
  title: z.string().trim().min(2).max(100),
  content: z.string().trim().min(5).max(500),
  relatedEntityId: z.string().trim().uuid().optional(),
}) satisfies ZodType;

export const getNotificationsQuerySchema = z.object({
  type: z
    .enum([
      "JOIN_REQUEST_RECEIVED",
      "JOIN_REQUEST_ACCEPTED",
      "JOIN_REQUEST_REJECTED",
      "TASK_ASSIGNED",
      "TASK_COMPLETED",
      "MILESTONE_STATUS_CHANGED",
      "MEETING_REMINDER",
      "MESSAGE_RECEIVED",
      "PROJECT_APPROVED",
      "PROJECT_REJECTED",
      "MENTOR_INVITATION_SENT",
      "MENTOR_INVITATION_ACCEPTED",
      "MENTOR_INVITATION_REJECTED",
    ])
    .optional(),
  isRead: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean().optional()),
}) satisfies ZodType;

export type CreateNotification = z.infer<typeof createNotificationSchema>;
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type NotificationResponse = {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationsListResponse = MessageResponse & {
  results: number;
  notifications: NotificationResponse[];
};

export type NotificationStatsResponse = MessageResponse & {
  total: number;
  unread: number;
};
