import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const fileParamSchema = z.object({
  id: z.string().trim().uuid(),
  fileId: z.string().trim().uuid(),
}) satisfies ZodType;

export type FileParam = z.infer<typeof fileParamSchema>;

export const projectFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().url(),
  fileType: z.string().trim().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
}) satisfies ZodType;

export const projectDetailSchema = z.object({
  detailedDescription: z.string().trim().max(5000).optional(),
  implementationGuide: z.string().trim().max(5000).optional(),
  deliverables: z.array(z.string().trim().min(1).max(255)).default([]),
  documentationUrl: z.string().trim().url().optional(),
}) satisfies ZodType;

export const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(10).max(500),
  description: z.string().trim().max(5000).optional(),
  ideaType: z.enum(["FREE", "PAID"]).default("FREE"),
  price: z.number().min(0).default(0),
  universityId: z.string().trim().uuid().optional(),
  collegeId: z.string().trim().uuid().optional(),
  departmentId: z.string().trim().uuid().optional(),
  technologies: z.array(z.string().trim().min(1).max(100)).default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(100)).default([]),
  details: projectDetailSchema.optional(),
  files: z.array(projectFileSchema).default([]),
}) satisfies ZodType;

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    summary: z.string().trim().min(10).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    ideaType: z.enum(["FREE", "PAID"]).optional(),
    price: z.number().min(0).optional(),
    universityId: z.string().trim().uuid().nullable().optional(),
    collegeId: z.string().trim().uuid().nullable().optional(),
    departmentId: z.string().trim().uuid().nullable().optional(),
    technologies: z.array(z.string().trim().min(1).max(100)).optional(),
    requiredSkills: z.array(z.string().trim().min(1).max(100)).optional(),
    isPublished: z.boolean().optional(),
    isApproved: z.boolean().optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "PUBLISHED", "COMPLETED"]).optional(),
    details: projectDetailSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const addProjectFileSchema = projectFileSchema;

export const getProjectsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "PUBLISHED", "COMPLETED"]).optional(),
  ideaType: z.enum(["FREE", "PAID"]).optional(),
  createdById: z.string().trim().uuid().optional(),
  universityId: z.string().trim().uuid().optional(),
  isPublished: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean().optional()),
  isApproved: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean().optional()),
}) satisfies ZodType;

export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type AddProjectFile = z.infer<typeof addProjectFileSchema>;
export type GetProjectsQuery = z.infer<typeof getProjectsQuerySchema>;

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

export type ProjectDetailResponse = {
  id: string;
  projectId: string;
  detailedDescription: string | null;
  implementationGuide: string | null;
  deliverables: string[];
  documentationUrl: string | null;
};

export type ProjectFileResponse = {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: string | null;
  uploadedBy: string;
  createdAt: Date;
};

export type ProjectResponse = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  status: string;
  ideaType: string;
  price: number;
  createdById: string;
  universityId: string | null;
  collegeId: string | null;
  departmentId: string | null;
  technologies: string[];
  requiredSkills: string[];
  isPublished: boolean;
  isApproved: boolean;
  viewsCount: number;
  savesCount: number;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectDetailsResponse = MessageResponse & {
  project: ProjectResponse & {
    creator: UserPreviewResponse;
    details: ProjectDetailResponse | null;
    files: ProjectFileResponse[];
  };
};

export type ProjectsListResponse = MessageResponse & {
  results: number;
  projects: (ProjectResponse & {
    creator: UserPreviewResponse;
    details: ProjectDetailResponse | null;
    filesCount: number;
  })[];
};

export type ProjectFileListResponse = MessageResponse & {
  results: number;
  files: ProjectFileResponse[];
};
