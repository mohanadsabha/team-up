import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import { MulterError } from "multer";

const sendErrorDev = (err: Error, res: Response): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(500).json({
      status: "error",
      message: err.message,
      stack: err.stack,
    });
  }
};

const sendErrorProd = (err: Error, res: Response): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...err.extras,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
      errorCode: "INTERNAL_SERVER_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
};

const globalErrorHandler = (
  error: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // handle different error types to AppError
  // DB errors (this was another ORM, we need to rewrite for Prisma)
  // if (error instanceof UniqueConstraintViolationException) {
  //   error = handleDuplicateFieldsDB(error);
  // } else if (error instanceof NotFoundError) {
  //   error = new AppError("Resource not found", 404);
  // } else if (error instanceof ValidationError) {
  //   error = new AppError(error.message, 400);
  // } else if (error instanceof DriverException) {
  //   error = handleInvalidUUIDDB(error);
  // }
  // multer errors
  if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
    error = new AppError(
      "File size is too large. Maximum limit is 200MB.",
      400,
    );
  }
  // jwt token errors
  else if ("name" in error) {
    if (error.name === "JsonWebTokenError") {
      error = new AppError("Invalid token. Please log in again!", 401);
    } else if (error.name === "TokenExpiredError") {
      error = new AppError("Your token has expired! Please log in again.", 401);
    }
  }
  // send the error
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;
