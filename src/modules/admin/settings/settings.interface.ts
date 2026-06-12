import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const updateSystemSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(100).optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(2).max(50).optional(),
  dateFormat: z.string().trim().min(4).max(20).optional(),
  isLive: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional().nullable(),
}) satisfies ZodType;

export type UpdateSystemSettingsRequest = z.infer<
  typeof updateSystemSettingsSchema
>;

export interface PlatformSettingsResponse {
  id: string;
  platformName: string;
  defaultLanguage: string;
  timezone: string;
  dateFormat: string;
  logoUrl: string | null;
  isLive: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsMessageResponse {
  success: boolean;
  message: string;
  data?: PlatformSettingsResponse;
}
