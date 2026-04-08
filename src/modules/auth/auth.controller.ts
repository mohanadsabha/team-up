import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  AuthTokenResponse,
  AuthUser,
  ChangePassword,
  changePasswordSchema,
  ForgotPassword,
  forgotPasswordSchema,
  Login,
  loginSchema,
  MessageResponse,
  ForgotPasswordResponse,
  ResetPassword,
  resetPasswordSchema,
  RevokeTokens,
  revokeTokensSchema,
  SignUp,
  signUpSchema,
  StringObject,
  TokenBody,
  tokenSchema,
  ValidateTokenResponse,
  VerifyEmail,
} from "./auth.interface";
import AppError from "../../utils/appError";
import { signJWT, verifyJWT } from "../../utils/jwt.util";
import { prisma } from "../../config/prisma";
import { compare, hash } from "bcryptjs";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import type { StringValue } from "ms";
import { emailService } from "../../utils/email";

type PasswordResetTokenPayload = JwtPayload & {
  userId: string;
  checksum: string;
};

type EmailVerificationTokenPayload = JwtPayload & {
  userId: string;
  email: string;
  purpose: "verify-email";
};

class AuthController {
  public signUp = async (
    req: Request<StringObject, StringObject, SignUp>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(signUpSchema, req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: payload.email }, { username: payload.username }],
      },
    });

    if (existingUser) {
      throw new AppError("Email or username is already in use.", 409);
    }

    const passwordHash = await hash(payload.password, 12);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        registrationMethod: "EMAIL",
        isActive: true,
        isVerified: false,
        lastLogin: now,
      },
    });

    const verificationToken = sign(
      {
        userId: user.id,
        email: user.email,
        purpose: "verify-email",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d" as StringValue,
      },
    );
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await emailService.sendEmailVerification({
      to: user.email,
      name: user.firstName,
      verificationUrl,
    });

    const token = signJWT({ userId: user.id, role: user.role });

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      verificationToken,
      user: this.sanitizeUser(user),
    });
  };

  public login = async (
    req: Request<StringObject, StringObject, Login>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(loginSchema, req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || !user.passwordHash) {
      throw new AppError("Invalid email or password.", 401);
    }

    const isValidPassword = await compare(payload.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError("Invalid email or password.", 401);
    }

    if (!user.isActive) {
      throw new AppError("Your account is not active yet.", 403);
    }
    if (!user.isVerified) {
      throw new AppError("Please verify your email before logging in.", 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = signJWT({ userId: updatedUser.id, role: updatedUser.role });
    res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      token,
      user: this.sanitizeUser(updatedUser),
    });
  };

  public refreshToken = async (
    req: Request<StringObject, StringObject, Partial<TokenBody>>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const bodyToken = req.body?.token;
    const bearerToken = this.extractBearerToken(req);
    let token = bodyToken || bearerToken;

    if (!token) {
      throw new AppError("Token is required.", 400);
    }

    const decoded = await verifyJWT(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }
    if (!user.isActive) {
      throw new AppError("Your account is not active yet.", 403);
    }
    if (!user.isVerified) {
      throw new AppError("Please verify your email before continuing.", 403);
    }

    this.ensureTokenNotRevoked(decoded.iat, user.lastLogin);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    token = signJWT({ userId: updatedUser.id, role: updatedUser.role });
    res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
      token,
      user: this.sanitizeUser(updatedUser),
    });
  };

  public validateToken = async (
    req: Request<StringObject, StringObject, Partial<TokenBody>>,
    res: Response<ValidateTokenResponse>,
    _next: NextFunction,
  ) => {
    const bodyToken = req.body?.token;
    const bearerToken = this.extractBearerToken(req);
    const token = bodyToken || bearerToken;

    if (!token) {
      throw new AppError("Token is required.", 400);
    }

    const decoded = await verifyJWT(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new AppError("Token is invalid.", 401);
    }
    if (!user.isVerified) {
      throw new AppError("Please verify your email before continuing.", 403);
    }

    this.ensureTokenNotRevoked(decoded.iat, user.lastLogin);

    res.status(200).json({
      success: true,
      valid: true,
      user: this.sanitizeUser(user),
    });
  };

  public verifyEmail = async (
    req: Request<StringObject, StringObject, VerifyEmail>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(tokenSchema, req.body);
    const decodedToken = verify(payload.token, process.env.JWT_SECRET);

    if (!this.isEmailVerificationTokenPayload(decodedToken)) {
      throw new AppError("Invalid verification token.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
    });

    if (!user || user.email !== decodedToken.email) {
      throw new AppError("Invalid verification token.", 401);
    }

    if (!user.isVerified || !user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  };

  public forgotPassword = async (
    req: Request<StringObject, StringObject, ForgotPassword>,
    res: Response<ForgotPasswordResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(forgotPasswordSchema, req.body);
    let resetToken: string | undefined;

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (user && user.passwordHash) {
      const checksum = user.passwordHash.slice(-12);
      resetToken = sign({ userId: user.id, checksum }, process.env.JWT_SECRET, {
        expiresIn: "15m" as StringValue,
      });
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      await emailService.sendPasswordReset({
        to: user.email,
        name: user.firstName,
        resetUrl,
      });
    }

    res.status(200).json({
      success: true,
      resetToken,
      message:
        "If an account with this email exists, a password reset link was sent.",
    });
  };

  public resetPassword = async (
    req: Request<StringObject, StringObject, ResetPassword>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(resetPasswordSchema, req.body);
    const decodedToken = verify(payload.token, process.env.JWT_SECRET);

    if (!this.isPasswordResetTokenPayload(decodedToken)) {
      throw new AppError("Invalid reset token.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
    });

    if (!user || !user.passwordHash) {
      throw new AppError("Invalid reset token.", 401);
    }

    const expectedChecksum = user.passwordHash.slice(-12);
    if (decodedToken.checksum !== expectedChecksum) {
      throw new AppError("Reset token is no longer valid.", 401);
    }

    const passwordHash = await hash(payload.newPassword, 12);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        lastLogin: new Date(),
      },
    });

    const token = signJWT({ userId: updatedUser.id, role: updatedUser.role });
    res.status(200).json({
      success: true,
      message: "Password reset successfully.",
      token,
      user: this.sanitizeUser(updatedUser),
    });
  };

  public changePassword = async (
    req: Request<StringObject, StringObject, ChangePassword>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(changePasswordSchema, req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user || !user.passwordHash) {
      throw new AppError("User not found.", 404);
    }

    const isCurrentPasswordValid = await compare(
      payload.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect.", 401);
    }

    const isSamePassword = await compare(
      payload.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new AppError(
        "New password must be different from current password.",
        400,
      );
    }

    const newPasswordHash = await hash(payload.newPassword, 12);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        lastLogin: new Date(),
      },
    });

    const token = signJWT({ userId: updatedUser.id, role: updatedUser.role });
    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      token,
      user: this.sanitizeUser(updatedUser),
    });
  };

  public revokeTokens = async (
    req: Request<StringObject, StringObject, RevokeTokens>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(revokeTokensSchema, req.body);

    const targetUser = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!targetUser) {
      throw new AppError("User not found.", 404);
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        lastLogin: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "All active tokens for this user have been revoked.",
    });
  };

  /*
  ** Helper Methods
  */

  private sanitizeUser(user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
    lastLogin: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
    };
  }

  private extractBearerToken(req: {
    headers: Request["headers"];
  }): string | undefined {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      return req.headers.authorization.split(" ")[1];
    }
    return undefined;
  }

  private ensureTokenNotRevoked(iat?: number, lastLogin?: Date | null) {
    if (!iat || !lastLogin) {
      return;
    }
    const tokenIssuedAt = iat;
    const revokeBefore = Math.floor(lastLogin.getTime() / 1000);
    if (tokenIssuedAt < revokeBefore) {
      throw new AppError("Token has been revoked. Please log in again.", 401);
    }
  }

  private isPasswordResetTokenPayload(
    payload: unknown,
  ): payload is PasswordResetTokenPayload {
    if (!payload || typeof payload !== "object") {
      return false;
    }
    return (
      "userId" in payload &&
      "checksum" in payload &&
      typeof payload.userId === "string" &&
      typeof payload.checksum === "string"
    );
  }

  private isEmailVerificationTokenPayload(
    payload: unknown,
  ): payload is EmailVerificationTokenPayload {
    if (!payload || typeof payload !== "object") {
      return false;
    }
    return (
      "userId" in payload &&
      "email" in payload &&
      "purpose" in payload &&
      payload.purpose === "verify-email" &&
      typeof payload.userId === "string" &&
      typeof payload.email === "string"
    );
  }
}

export const authController = new AuthController();
