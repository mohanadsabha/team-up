import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import { verifyJWT } from "../utils/jwt.util";
import { prisma } from "../config/prisma";

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  // 1) Getting token and check if it's there
  let token: string | undefined;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );
  }

  // 2) Verify JWT token
  const decoded = await verifyJWT(token);

  // 3) Check if user still exists in PostgreSQL
  const user = await prisma.user.findFirst({
    where: {
      id: decoded.userId,
    },
  });

  if (!user) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401,
      ),
    );
  }

  // Grant access
  req.user = decoded;
  next();
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
