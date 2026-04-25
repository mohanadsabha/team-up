import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  AuthTokenResponse,
  AdminUserResponse,
  AuthUser,
  ChangePassword,
  changePasswordSchema,
  CollegeResponseItem,
  CollegesListResponse,
  CreateDevSystemAdmin,
  createDevSystemAdminSchema,
  CreateCollege,
  createCollegeSchema,
  CreateDepartment,
  createDepartmentSchema,
  CreateUniversity,
  createUniversitySchema,
  DepartmentsListResponse,
  ForgotPassword,
  forgotPasswordSchema,
  GetCollegesQuery,
  getCollegesQuerySchema,
  GetDepartmentsQuery,
  getDepartmentsQuerySchema,
  GetUniversitiesQuery,
  getUniversitiesQuerySchema,
  Login,
  loginSchema,
  MessageResponse,
  DepartmentResponseItem,
  ForgotPasswordResponse,
  IdParam,
  idParamSchema,
  ResetPassword,
  resetPasswordSchema,
  RevokeTokens,
  revokeTokensSchema,
  SignUp,
  signUpSchema,
  StringObject,
  TokenBody,
  tokenSchema,
  UniversityResponseItem,
  UpdateCollege,
  updateCollegeSchema,
  UpdateDepartment,
  updateDepartmentSchema,
  UpdateUniversity,
  updateUniversitySchema,
  UniversitiesListResponse,
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
import axios from "axios";

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
  public createDevSystemAdmin = async (
    req: Request<StringObject, StringObject, CreateDevSystemAdmin>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    if (process.env.NODE_ENV !== "development") {
      throw new AppError(
        "This endpoint is only available in development.",
        404,
      );
    }

    const payload = zodValidation(createDevSystemAdminSchema, req.body);

    const [emailExists, usernameExists] = await Promise.all([
      prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { username: payload.username },
        select: { id: true },
      }),
    ]);

    if (emailExists || usernameExists) {
      throw new AppError("Email or username is already in use.", 409);
    }

    const now = new Date();
    const passwordHash = await hash(payload.password, 12);

    const admin = await prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: "SYSTEM_ADMIN",
        registrationMethod: "EMAIL",
        isActive: true,
        isVerified: true,
        emailVerifiedAt: now,
        lastLogin: now,
      },
      // Explicit select avoids reading columns that may not exist yet in a non-migrated DB.
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
      },
    });

    const token = signJWT({ userId: admin.id, role: admin.role });
    res.status(201).json({
      success: true,
      message: "Development system admin created successfully.",
      token,
      user: this.sanitizeUser(admin),
    });
  };

  public signUp = async (
    req: Request<StringObject, StringObject, SignUp>,
    res: Response<AuthTokenResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(signUpSchema, req.body);

    const [emailExists, usernameExists] = await Promise.all([
      prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { username: payload.username },
        select: { id: true },
      }),
    ]);

    const signupConflictErrors: Array<{ path: string; message: string }> = [];
    if (emailExists) {
      signupConflictErrors.push({
        path: "email",
        message: "Email is already in use.",
      });
    }
    if (usernameExists) {
      signupConflictErrors.push({
        path: "username",
        message: "Username is already in use.",
      });
    }
    if (signupConflictErrors.length) {
      throw this.buildSignupFieldError(
        "Signup validation failed.",
        signupConflictErrors,
        409,
        "SIGNUP_CONFLICT",
      );
    }

    const { normalizedSkills } = await this.resolveSignupAffiliation({
      departmentId: payload.departmentId,
      collegeId: payload.collegeId,
      universityId: payload.universityId,
      skills: payload.skills,
    });

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
        isActive: false,
        isVerified: false,
        universityId: payload.universityId,
        collegeId: payload.collegeId,
        departmentId: payload.departmentId,
        academicProfile: {
          create: {
            major: payload.major,
            skills: normalizedSkills,
          },
        },
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
      //FIXME
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

    if (!user.isVerified) {
      throw new AppError("Please verify your email before logging in.", 403);
    }

    if (!user.isActive) {
      throw new AppError("Your account is not active.", 403);
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
  public google = async (req: Request, res: Response, _next: NextFunction) => {
    const scope = encodeURIComponent("openid email profile");

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent`;

    res.redirect(url);
  };

  public linkedin = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const scope = "openid profile email";
    const redirectUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=${scope}&state=${process.env.LINKEDIN_STATE}`;

    res.redirect(redirectUrl);
  };

  public linkedinCallback = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const { code } = req.query;
    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const access_token = tokenRes.data.access_token;

    // 2. Get user profile (OpenID)
    const userInfo = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const { sub, email, given_name, family_name } = userInfo.data;

    // 3. Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await prisma.user.create({
        // role, username, unvirsty....
        data: {
          username: sub,
          email: email,
          firstName: given_name,
          lastName: family_name,
          role: "STUDENT",
          registrationMethod: "LINKEDIN",
          isActive: true,
          isVerified: true,
          lastLogin: new Date(),
        },
      });
    }

    // 4. Create JWT
    const token = signJWT({ userId: user.id, role: user.role });

    // 5. Redirect to frontend
    res
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .redirect(`http://localhost:3000/oauth-success`);
  };

  public googleCallback = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const { code } = req.query;
    // 1. Exchange code for token
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const { access_token } = tokenRes.data;

    // 2. Get user profile (OpenID)
    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    const { sub, given_name, family_name, email } = userRes.data;

    // 3. Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await prisma.user.create({
        // role, username, unvirsty....
        data: {
          username: sub,
          email: email,
          firstName: given_name,
          lastName: family_name,
          role: "STUDENT",
          registrationMethod: "LINKEDIN",
          isActive: true,
          isVerified: true,
          lastLogin: new Date(),
        },
      });
    }

    // 4. Create JWT
    const token = signJWT({ userId: user.id, role: user.role });

    // 5. Redirect to frontend
    res
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .redirect(`http://localhost:3000/oauth-success`);
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
    const token = req.body?.token;

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
      // FIXME
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

  public activateUser = async (
    req: Request<IdParam>,
    res: Response<AdminUserResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const now = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        deactivatedAt: null,
        statusChangedAt: now,
        statusChangedById: req.user.userId,
        statusChangeReason: "Activated by SYSTEM_ADMIN",
      },
    });

    res.status(200).json({
      success: true,
      message: "User activated successfully.",
      user: this.sanitizeUser(updatedUser),
    });
  };

  public getUniversities = async (
    req: Request<
      StringObject,
      StringObject,
      StringObject,
      GetUniversitiesQuery
    >,
    res: Response<UniversitiesListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getUniversitiesQuerySchema, req.query);

    const universities = await prisma.university.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(typeof query.isActive === "boolean"
          ? { isActive: query.isActive }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Universities fetched successfully.",
      results: universities.length,
      universities,
    });
  };

  public getColleges = async (
    req: Request<StringObject, StringObject, StringObject, GetCollegesQuery>,
    res: Response<CollegesListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getCollegesQuerySchema, req.query);

    const colleges = await prisma.college.findMany({
      where: {
        ...(query.universityId ? { universityId: query.universityId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Colleges fetched successfully.",
      results: colleges.length,
      colleges,
    });
  };

  public getDepartments = async (
    req: Request<StringObject, StringObject, StringObject, GetDepartmentsQuery>,
    res: Response<DepartmentsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getDepartmentsQuerySchema, req.query);

    const departments = await prisma.department.findMany({
      where: {
        ...(query.collegeId ? { collegeId: query.collegeId } : {}),
        ...(query.universityId
          ? { college: { universityId: query.universityId } }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Departments fetched successfully.",
      results: departments.length,
      departments,
    });
  };

  public createUniversity = async (
    req: Request<StringObject, StringObject, CreateUniversity>,
    res: Response<MessageResponse & { university: UniversityResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createUniversitySchema, req.body);

    const university = await prisma.university.create({
      data: {
        name: payload.name,
        code: payload.code,
        country: payload.country,
        apiEndpoint: payload.apiEndpoint,
        isActive: payload.isActive ?? true,
      },
    });

    res.status(201).json({
      success: true,
      message: "University created successfully.",
      university,
    });
  };

  public updateUniversity = async (
    req: Request<IdParam, StringObject, UpdateUniversity>,
    res: Response<MessageResponse & { university: UniversityResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateUniversitySchema, req.body);

    const existing = await prisma.university.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      throw new AppError("University not found.", 404);
    }

    const university = await prisma.university.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.country !== undefined ? { country: payload.country } : {}),
        ...(payload.apiEndpoint !== undefined
          ? { apiEndpoint: payload.apiEndpoint }
          : {}),
        ...(typeof payload.isActive === "boolean"
          ? { isActive: payload.isActive }
          : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "University updated successfully.",
      university,
    });
  };

  public deleteUniversity = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.university.findUnique({
      where: { id: params.id },
      include: {
        colleges: { select: { id: true } },
        users: { select: { id: true } },
        projects: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("University not found.", 404);
    }

    if (
      existing.colleges.length ||
      existing.users.length ||
      existing.projects.length
    ) {
      throw new AppError(
        "Cannot delete university with linked colleges, users, or projects.",
        400,
      );
    }

    await prisma.university.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "University deleted successfully.",
    });
  };

  public createCollege = async (
    req: Request<StringObject, StringObject, CreateCollege>,
    res: Response<MessageResponse & { college: CollegeResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createCollegeSchema, req.body);

    const university = await prisma.university.findUnique({
      where: { id: payload.universityId },
      select: { id: true },
    });

    if (!university) {
      throw new AppError("University not found.", 404);
    }

    const college = await prisma.college.create({
      data: {
        name: payload.name,
        code: payload.code,
        universityId: payload.universityId,
      },
    });

    res.status(201).json({
      success: true,
      message: "College created successfully.",
      college,
    });
  };

  public updateCollege = async (
    req: Request<IdParam, StringObject, UpdateCollege>,
    res: Response<MessageResponse & { college: CollegeResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateCollegeSchema, req.body);

    const existing = await prisma.college.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("College not found.", 404);
    }

    if (payload.universityId) {
      const university = await prisma.university.findUnique({
        where: { id: payload.universityId },
        select: { id: true },
      });

      if (!university) {
        throw new AppError("University not found.", 404);
      }
    }

    const college = await prisma.college.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.universityId ? { universityId: payload.universityId } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "College updated successfully.",
      college,
    });
  };

  public deleteCollege = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.college.findUnique({
      where: { id: params.id },
      include: {
        departments: { select: { id: true } },
        users: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("College not found.", 404);
    }

    if (existing.departments.length || existing.users.length) {
      throw new AppError(
        "Cannot delete college with linked departments or users.",
        400,
      );
    }

    await prisma.college.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "College deleted successfully.",
    });
  };

  public createDepartment = async (
    req: Request<StringObject, StringObject, CreateDepartment>,
    res: Response<MessageResponse & { department: DepartmentResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createDepartmentSchema, req.body);

    const college = await prisma.college.findUnique({
      where: { id: payload.collegeId },
      select: { id: true },
    });

    if (!college) {
      throw new AppError("College not found.", 404);
    }

    const department = await prisma.department.create({
      data: {
        name: payload.name,
        code: payload.code,
        collegeId: payload.collegeId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully.",
      department,
    });
  };

  public updateDepartment = async (
    req: Request<IdParam, StringObject, UpdateDepartment>,
    res: Response<MessageResponse & { department: DepartmentResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateDepartmentSchema, req.body);

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Department not found.", 404);
    }

    if (payload.collegeId) {
      const college = await prisma.college.findUnique({
        where: { id: payload.collegeId },
        select: { id: true },
      });

      if (!college) {
        throw new AppError("College not found.", 404);
      }
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.collegeId ? { collegeId: payload.collegeId } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "Department updated successfully.",
      department,
    });
  };

  public deleteDepartment = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        users: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("Department not found.", 404);
    }

    if (existing.users.length) {
      throw new AppError("Cannot delete department with linked users.", 400);
    }

    await prisma.department.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Department deleted successfully.",
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

  private async resolveSignupAffiliation(payload: {
    departmentId: string;
    collegeId: string;
    universityId: string;
    skills: string[];
  }) {
    const department = await prisma.department.findUnique({
      where: { id: payload.departmentId },
      include: {
        college: {
          select: {
            id: true,
            universityId: true,
          },
        },
      },
    });

    if (!department) {
      throw this.buildSignupFieldError(
        "Invalid signup affiliation.",
        [
          {
            path: "departmentId",
            message: "Department not found.",
          },
        ],
        404,
        "SIGNUP_AFFILIATION_INVALID",
      );
    }

    if (department.college.universityId !== payload.universityId) {
      throw this.buildSignupFieldError(
        "Invalid signup affiliation.",
        [
          {
            path: "universityId",
            message: "University does not match selected department.",
          },
          {
            path: "departmentId",
            message: "Department does not belong to selected university.",
          },
        ],
        400,
        "SIGNUP_AFFILIATION_MISMATCH",
      );
    }

    if (department.college.id !== payload.collegeId) {
      throw this.buildSignupFieldError(
        "Invalid signup affiliation.",
        [
          {
            path: "collegeId",
            message: "College does not match selected department.",
          },
          {
            path: "departmentId",
            message: "Department does not belong to selected college.",
          },
        ],
        400,
        "SIGNUP_AFFILIATION_MISMATCH",
      );
    }

    const normalizedSkills = Array.from(
      new Set(payload.skills.map((skill) => skill.trim()).filter(Boolean)),
    );

    if (!normalizedSkills.length) {
      throw this.buildSignupFieldError(
        "Invalid signup payload.",
        [
          {
            path: "skills",
            message: "At least one valid skill is required.",
          },
        ],
        400,
        "SIGNUP_INVALID_SKILLS",
      );
    }

    return { normalizedSkills };
  }

  private buildSignupFieldError(
    message: string,
    fieldErrors: Array<{ path: string; message: string }>,
    statusCode = 400,
    errorCode = "SIGNUP_VALIDATION_FAILED",
  ) {
    return new AppError(message, statusCode, {
      errorCode,
      fieldErrors,
    });
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
