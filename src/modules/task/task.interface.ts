import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createTaskSchema = z.object({
  teamId: z.string().trim().uuid(),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  assignedTo: z.string().trim().uuid().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.number().int().min(1).max(5).optional(),
}) satisfies ZodType;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    status: z
      .enum([
        "TODO",
        "IN_PROGRESS",
        "DONE",
        "APPROVED",
        "NEEDS_REVISION",
        "REJECTED",
      ])
      .optional(),
    assignedTo: z.string().trim().uuid().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    priority: z.number().int().min(1).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const getTasksQuerySchema = z.object({
  teamId: z.string().trim().uuid().optional(),
  status: z
    .enum([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "APPROVED",
      "NEEDS_REVISION",
      "REJECTED",
    ])
    .optional(),
  assignedTo: z.string().trim().uuid().optional(),
  priority: z.number().int().min(1).max(5).optional(),
}) satisfies ZodType;

export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type TaskResponse = {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  status: string;
  assignedTo: string | null;
  dueDate: Date | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

export type UserPreviewResponse = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
};

export type TaskDetailsResponse = MessageResponse & {
  task: TaskResponse & {
    assignee: UserPreviewResponse | null;
  };
};

export type TasksListResponse = MessageResponse & {
  results: number;
  tasks: (TaskResponse & {
    assignee: UserPreviewResponse | null;
  })[];
};
