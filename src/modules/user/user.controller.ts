import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  GetUsersQuery,
  GetUserActivityQuery,
  AcademicProfileSummary,
  getUsersQuerySchema,
  getUserActivityQuerySchema,
  IdParam,
  idParamSchema,
  ProfileCompletionResponse,
  PublicUserItem,
  SingleUserResponse,
  StringObject,
  UpdateMe,
  updateMeSchema,
  UpdateUserStatus,
  updateUserStatusSchema,
  UserActivityResponse,
  UserProfileResponse,
  UsersListResponse,
  PrivateUserItem,
} from "./user.interface";
import AppError from "../../utils/appError";
import { prisma, Prisma } from "../../config/prisma";
import { UserRole } from "../../generated/prisma/enums";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../../utils/multer.util";

type UserRecord = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  universityId: string | null;
  collegeId: string | null;
  departmentId: string | null;
  profilePictureUrl: string | null;
  bio: string | null;
  phone: string | null;
  academicProfile?: {
    major: string | null;
    skills: string[];
  } | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  statusChangedAt?: Date | null;
  statusChangedById?: string | null;
  statusChangeReason?: string | null;
  deactivatedAt?: Date | null;
};

const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

class UserController {
  public getMe = async (
    req: Request,
    res: Response<SingleUserResponse>,
    _next: NextFunction,
  ) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        academicProfile: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError("User not found or account has been deleted.", 404);
    }

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully.",
      user: this.sanitizePrivateUser(user),
    });
  };

  public updateMe = async (
    req: Request<StringObject, StringObject, UpdateMe>,
    res: Response<SingleUserResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(updateMeSchema, req.body);
    const { major, skills, ...userPayload } = payload;

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!currentUser || currentUser.deletedAt) {
      throw new AppError("User not found or account has been deleted.", 404);
    }

    if (payload.username) {
      const existingByUsername = await prisma.user.findUnique({
        where: { username: payload.username },
        select: { id: true, deletedAt: true },
      });

      if (
        existingByUsername &&
        existingByUsername.id !== req.user.userId &&
        !existingByUsername.deletedAt
      ) {
        throw new AppError("Username is already in use.", 409);
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (Object.keys(userPayload).length > 0) {
        await tx.user.update({
          where: { id: req.user.userId },
          data: userPayload,
        });
      }

      if (major !== undefined || skills !== undefined) {
        await tx.academicProfile.upsert({
          where: { userId: req.user.userId },
          create: {
            userId: req.user.userId,
            major: major ?? null,
            skills: skills ?? [],
          },
          update: {
            ...(major !== undefined ? { major } : {}),
            ...(skills !== undefined ? { skills } : {}),
          },
        });
      }

      return tx.user.findUnique({
        where: { id: req.user.userId },
        include: {
          academicProfile: true,
        },
      });
    });

    if (!updatedUser) {
      throw new AppError("User not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "User profile updated successfully.",
      user: this.sanitizePrivateUser(updatedUser),
    });
  };

  public uploadProfilePicture = async (
    req: Request,
    res: Response<SingleUserResponse>,
    _next: NextFunction,
  ) => {
    if (!req.file) {
      throw new AppError("Profile picture file is required.", 400);
    }

    this.validateProfilePictureFile(req.file);

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!currentUser) {
      throw new AppError("User not found.", 404);
    }

    const profilePictureUrl = await uploadImageToCloudinary(
      req.file,
      "profile-picture",
    );

    if (currentUser.profilePictureUrl) {
      await deleteImageFromCloudinary(currentUser.profilePictureUrl);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        profilePictureUrl,
      },
    });

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully.",
      user: this.sanitizePrivateUser(updatedUser),
    });
  };

  public getProfileCompletion = async (
    req: Request,
    res: Response<ProfileCompletionResponse>,
    _next: NextFunction,
  ) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        academicProfile: true,
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const checklist = [
      { key: "firstName", completed: !!user.firstName },
      { key: "lastName", completed: !!user.lastName },
      { key: "username", completed: !!user.username },
      { key: "email", completed: !!user.email },
      { key: "isVerified", completed: user.isVerified },
      { key: "profilePictureUrl", completed: !!user.profilePictureUrl },
      { key: "bio", completed: !!user.bio },
      { key: "phone", completed: !!user.phone },
      { key: "universityId", completed: !!user.universityId },
      { key: "collegeId", completed: !!user.collegeId },
      { key: "departmentId", completed: !!user.departmentId },
      {
        key: "academicProfile",
        completed:
          !!user.academicProfile &&
          (!!user.academicProfile.major || user.academicProfile.skills.length > 0),
      },
    ];

    const completedFields = checklist.filter((item) => item.completed).length;
    const totalFields = checklist.length;
    const score = Math.round((completedFields / totalFields) * 100);
    const missingFields = checklist
      .filter((item) => !item.completed)
      .map((item) => item.key);

    res.status(200).json({
      success: true,
      message: "Profile completion calculated successfully.",
      score,
      completedFields,
      totalFields,
      missingFields,
    });
  };

  public getUsers = async (
    req: Request,
    res: Response<UsersListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(
      getUsersQuerySchema,
      req.query as unknown as GetUsersQuery,
    );

    const roleQueryRaw = query.role;
    const search = query.search;
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const roleQuery =
      roleQueryRaw && Object.values(UserRole).includes(roleQueryRaw as UserRole)
        ? (roleQueryRaw as UserRole)
        : undefined;

    if (roleQueryRaw && !roleQuery) {
      throw new AppError("Invalid role filter value.", 400);
    }

    const whereClause: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(roleQuery ? { role: roleQuery } : {}),
      ...(query.universityId ? { universityId: query.universityId } : {}),
      ...(query.collegeId ? { collegeId: query.collegeId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(typeof query.isActive === "boolean"
        ? { isActive: query.isActive }
        : {}),
      ...(typeof query.isVerified === "boolean"
        ? { isVerified: query.isVerified }
        : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const total = await prisma.user.count({
      where: whereClause,
    });

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    const sanitizedUsers = users.map((user) => this.sanitizePrivateUser(user));

    res.status(200).json({
      success: true,
      message: "Users fetched successfully.",
      results: sanitizedUsers.length,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      users: sanitizedUsers,
    });
  };

  public getUserById = async (
    req: Request<IdParam>,
    res: Response<UserProfileResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        academicProfile: true,
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // Allow viewing own deleted profile, but not others'
    if (user.deletedAt && req.user.userId !== user.id) {
      throw new AppError("User not found.", 404);
    }

    const canViewPrivateProfile =
      req.user.userId === user.id || req.user.role === "SYSTEM_ADMIN";

    res.status(200).json({
      success: true,
      message: "User fetched successfully.",
      visibility: canViewPrivateProfile ? "private" : "public",
      user: canViewPrivateProfile
        ? this.sanitizePrivateUser(user)
        : this.sanitizePublicUser(user),
    });
  };

  public getUserActivity = async (
    req: Request<IdParam, StringObject, StringObject, GetUserActivityQuery>,
    res: Response<UserActivityResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const query = zodValidation(
      getUserActivityQuerySchema,
      req.query as unknown as GetUserActivityQuery,
    );

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const [
      projectsCreated,
      publishedProjects,
      approvedProjects,
      aggregateStats,
    ] = await Promise.all([
      prisma.graduationProject.count({ where: { createdById: params.id } }),
      prisma.graduationProject.count({
        where: { createdById: params.id, isPublished: true },
      }),
      prisma.graduationProject.count({
        where: { createdById: params.id, isApproved: true },
      }),
      prisma.graduationProject.aggregate({
        where: { createdById: params.id },
        _sum: {
          viewsCount: true,
          savesCount: true,
          purchaseCount: true,
        },
      }),
    ]);

    const recentProjects = await prisma.graduationProject.findMany({
      where: { createdById: params.id },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        isPublished: true,
        isApproved: true,
        viewsCount: true,
        savesCount: true,
        purchaseCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "User activity fetched successfully.",
      userId: params.id,
      stats: {
        projectsCreated,
        publishedProjects,
        approvedProjects,
        totalViews: aggregateStats._sum.viewsCount ?? 0,
        totalSaves: aggregateStats._sum.savesCount ?? 0,
        totalPurchases: aggregateStats._sum.purchaseCount ?? 0,
      },
      teamStats: {
        joinedTeams: 0,
        leftTeams: 0,
        blockedFromTeaming: false,
        note: "Team statistics will be connected after the team module is implemented.",
      },
      recentProjects: recentProjects.map((project) => ({
        ...project,
        status: project.status,
      })),
    });
  };

  public updateUserStatus = async (
    req: Request<IdParam, StringObject, UpdateUserStatus>,
    res: Response<SingleUserResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateUserStatusSchema, req.body);

    if (typeof payload.isActive !== "boolean") {
      throw new AppError("Field isActive is required.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const now = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        isActive: payload.isActive,
        statusChangedAt: now,
        statusChangedById: req.user.userId,
        statusChangeReason: payload.reason ?? null,
        ...(payload.isActive === false
          ? { deactivatedAt: now }
          : payload.isActive === true
            ? { deactivatedAt: null }
            : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "User status updated successfully.",
      user: this.sanitizePrivateUser(updatedUser),
    });
  };

  private sanitizePrivateUser(user: UserRecord): PrivateUserItem {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      universityId: user.universityId,
      collegeId: user.collegeId,
      departmentId: user.departmentId,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      phone: user.phone,
      academicProfile: user.academicProfile
        ? this.summarizeAcademicProfile(user.academicProfile)
        : null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private sanitizePublicUser(user: UserRecord): PublicUserItem {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      universityId: user.universityId,
      collegeId: user.collegeId,
      departmentId: user.departmentId,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      academicProfile: user.academicProfile
        ? this.summarizeAcademicProfile(user.academicProfile)
        : null,
      createdAt: user.createdAt,
    };
  }

  private summarizeAcademicProfile(
    academicProfile: NonNullable<UserRecord["academicProfile"]>,
  ): AcademicProfileSummary {
    return {
      major: academicProfile.major,
      skills: academicProfile.skills,
    };
  }

  private validateProfilePictureFile(file: Express.Multer.File): void {
    if (!ALLOWED_PROFILE_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError(
        "Invalid file type. Allowed types are jpeg, png, and webp.",
        400,
      );
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      throw new AppError("Profile picture size must be 2MB or less.", 400);
    }
  }
}

export const userController = new UserController();
