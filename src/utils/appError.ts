class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  // extra feilds
  extras?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    extras?: Record<string, any>,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    if (extras) {
      this.extras = extras;
      Object.assign(this, extras);
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
