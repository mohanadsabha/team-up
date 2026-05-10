import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createMeetingSchema = z.object({
  teamId: z.string().trim().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  meetingUrl: z.string().trim().url().optional(),
  location: z.string().trim().max(255).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
}) satisfies ZodType;

export const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    meetingUrl: z.string().trim().url().nullable().optional(),
    location: z.string().trim().max(255).nullable().optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELED"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const getMeetingsQuerySchema = z.object({
  teamId: z.string().trim().uuid().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELED"]).optional(),
  upcoming: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean().optional()),
}) satisfies ZodType;

export type CreateMeeting = z.infer<typeof createMeetingSchema>;
export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;
export type GetMeetingsQuery = z.infer<typeof getMeetingsQuerySchema>;

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

export type MeetingResponse = {
  id: string;
  teamId: string;
  createdById: string;
  title: string;
  description: string | null;
  meetingUrl: string | null;
  location: string | null;
  status: string;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MeetingDetailsResponse = MessageResponse & {
  meeting: MeetingResponse & {
    creator: UserPreviewResponse;
  };
};

export type MeetingsListResponse = MessageResponse & {
  results: number;
  meetings: (MeetingResponse & {
    creator: UserPreviewResponse;
  })[];
};
