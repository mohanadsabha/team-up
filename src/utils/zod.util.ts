import { ZodError, ZodType } from "zod";
import AppError from "./appError";

export const zodValidation = <T>(schema: ZodType<T>, payload: T) => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      // Extract readable messages
      const formattedErrors = error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));

      // Combine all error messages into one readable string
      const message = formattedErrors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");

      // Throw custom AppError with more structured feedback
      throw new AppError(message, 400);
    }

    // Re-throw unexpected errors
    throw error;
  }
};
