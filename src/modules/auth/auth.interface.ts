import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export type Login = {
  email: string;
  password: string;
};

export type LoginResponse = {
  success: boolean;
  token: string;
  // you can make the token as object and give more information with it
};

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(32),
}) satisfies ZodType;

// Importnant for other modules => LOOK DOWN THERE!
// The above implmenetation is just for auth but for other modules you should use as the example below.

/*
 ** The following is an example for other modules
 */

// Syntax Example for a Zod schema that is used to validate in zod.util.ts
export const createProject = z.object({
  title: z.string().min(2, "Title must be at least 2 characters long"),
  url: z.url("Invalid URL format"),
  image: z.string().optional(),
  category: z
    .array(
      z
        .string()
        .min(2, "Category must have at least 2 characters")
        .max(30, "Category cannot exceed 30 characters"),
    )
    .nonempty("At least one category is required"),
  service: z
    .enum([
      "Graphic Design",
      "Web Development",
      "Design & Branding",
      "App Development",
      "Filming & Editing",
      "UI/UX Design",
      "Visual Identity",
      "Custom Software Solutions",
      "Marketing Consulting",
    ])
    .optional(),
});
export const updateProject = createProject.partial(); // This makes all fields optional for update operations

// These types are used for Request interface, example: Request<StringObject, StringObject, CreateProject>
// for create operations and Request<StringObject, StringObject, UpdateProject> for update operations
export type CreateProject = z.infer<typeof createProject>;
export type UpdateProject = z.infer<typeof updateProject>;
