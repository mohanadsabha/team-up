import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createUniversitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(80).optional(),
  apiEndpoint: z.string().trim().url().optional(),
  isActive: z.boolean().optional(),
}) satisfies ZodType;

export const updateUniversitySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().min(2).max(20).optional(),
    country: z.string().trim().min(2).max(80).nullable().optional(),
    apiEndpoint: z.string().trim().url().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const createCollegeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20),
  universityId: z.string().trim().uuid(),
}) satisfies ZodType;

export const updateCollegeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().min(2).max(20).optional(),
    universityId: z.string().trim().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20),
  collegeId: z.string().trim().uuid(),
}) satisfies ZodType;

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().min(2).max(20).optional(),
    collegeId: z.string().trim().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  }) satisfies ZodType;

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

export const getUniversitiesQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  isActive: booleanQuerySchema.optional(),
}) satisfies ZodType;

export const getCollegesQuerySchema = z.object({
  universityId: z.string().trim().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
}) satisfies ZodType;

export const getDepartmentsQuerySchema = z.object({
  collegeId: z.string().trim().uuid().optional(),
  universityId: z.string().trim().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
}) satisfies ZodType;

export type CreateUniversity = z.infer<typeof createUniversitySchema>;
export type UpdateUniversity = z.infer<typeof updateUniversitySchema>;
export type CreateCollege = z.infer<typeof createCollegeSchema>;
export type UpdateCollege = z.infer<typeof updateCollegeSchema>;
export type CreateDepartment = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
export type GetUniversitiesQuery = z.infer<typeof getUniversitiesQuerySchema>;
export type GetCollegesQuery = z.infer<typeof getCollegesQuerySchema>;
export type GetDepartmentsQuery = z.infer<typeof getDepartmentsQuerySchema>;

export type UniversityResponseItem = {
  id: string;
  name: string;
  code: string;
  country: string | null;
  apiEndpoint: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CollegeResponseItem = {
  id: string;
  name: string;
  code: string;
  universityId: string;
  createdAt: Date;
};

export type DepartmentResponseItem = {
  id: string;
  name: string;
  code: string;
  collegeId: string;
  createdAt: Date;
};

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type UniversitiesListResponse = MessageResponse & {
  results: number;
  universities: UniversityResponseItem[];
};

export type CollegesListResponse = MessageResponse & {
  results: number;
  colleges: CollegeResponseItem[];
};

export type DepartmentsListResponse = MessageResponse & {
  results: number;
  departments: DepartmentResponseItem[];
};
