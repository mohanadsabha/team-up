import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  Login,
  loginSchema,
  LoginResponse,
  StringObject,
} from "./auth.interface";
import AppError from "../../utils/appError";
import { signJWT } from "../../utils/jwt.util";

class AuthController {
  public async login(
    req: Request<StringObject, StringObject, Login>,
    res: Response<LoginResponse>,
    next: NextFunction,
  ) {
    // Validate the request body using Zod, the error will be handled by the global error handler
    const payload = zodValidation(loginSchema, req.body);

    // TO DO:
    // Check if the user exists and the password is correct (this is just a placeholder, you should implement your own logic)
    // If the user doesn't exist or the password is incorrect, throw an error

    // If the user exists and the password is correct, generate a JWT token (this is just a placeholder, you should implement your own logic)
    const token = signJWT({ userId: "....", role: "admin" });
    res.status(200).json({
      success: true,
      token,
    });
  }
}

export const authController = new AuthController();
