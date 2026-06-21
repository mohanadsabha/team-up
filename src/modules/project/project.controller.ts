import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import {
  AddProjectFile,
  addProjectFileSchema,
  CreateProject,
  createProjectSchema,
  FileParam,
  fileParamSchema,
  GetProjectsQuery,
  getProjectsQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  ProjectDetailResponse,
  ProjectDetailsResponse,
  ProjectFileListResponse,
  ProjectFileResponse,
  ProjectResponse,
  ProjectsListResponse,
  RejectProject,
  rejectProjectSchema,
  SavedProjectsResponse,
  SaveProjectResponse,
  StringObject,
  UnsaveProjectResponse,
  UpdateProject,
  updateProjectSchema,
} from "./project.interface";
import { notificationController } from "../notification/notification.controller";

class ProjectController {
  private mapFile = (file: {
    id: string;
    projectId: string;
    fileName: string;
    fileUrl: string;
    fileType: string | null;
    fileSize: bigint | null;
    uploadedBy: string;
    createdAt: Date;
  }): ProjectFileResponse => ({
    ...file,
    fileSize: file.fileSize ? file.fileSize.toString() : null,
  });

  private mapDetail = (detail: {
    id: string;
    projectId: string;
    detailedDescription: string | null;
    implementationGuide: string | null;
    deliverables: string[];
    documentationUrl: string | null;
  }): ProjectDetailResponse => ({
    ...detail,
  });

  private mapProject = (project: {
    id: string;
    title: string;
    summary: string;
    description: string | null;
    status: string;
    ideaType: string;
    price: number;
    createdById: string;
    universityId: string | null;
    collegeId: string | null;
    departmentId: string | null;
    technologies: string[];
    requiredSkills: string[];
    isPublished: boolean;
    isApproved: boolean;
    viewsCount: number;
    savesCount: number;
    purchaseCount: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePictureUrl: string | null;
    };
    details: {
      id: string;
      projectId: string;
      detailedDescription: string | null;
      implementationGuide: string | null;
      deliverables: string[];
      documentationUrl: string | null;
    } | null;
    files: {
      id: string;
      projectId: string;
      fileName: string;
      fileUrl: string;
      fileType: string | null;
      fileSize: bigint | null;
      uploadedBy: string;
      createdAt: Date;
    }[];
  }): ProjectResponse & {
    creator: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePictureUrl: string | null;
    };
    details: ProjectDetailResponse | null;
    files: ProjectFileResponse[];
    filesCount?: number;
  } => ({
    id: project.id,
    title: project.title,
    summary: project.summary,
    description: project.description,
    status: project.status,
    ideaType: project.ideaType,
    price: project.price,
    createdById: project.createdById,
    universityId: project.universityId,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
    technologies: project.technologies,
    requiredSkills: project.requiredSkills,
    isPublished: project.isPublished,
    isApproved: project.isApproved,
    viewsCount: project.viewsCount,
    savesCount: project.savesCount,
    purchaseCount: project.purchaseCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    creator: project.createdBy,
    details: project.details ? this.mapDetail(project.details) : null,
    files: project.files.map(this.mapFile),
  });

  private canManageProject = async (
    projectId: string,
    userId: string,
    role: string,
  ) => {
    if (role === "SYSTEM_ADMIN") {
      return true;
    }

    const project = await prisma.graduationProject.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    if (project.createdById !== userId) {
      throw new AppError(
        "You do not have permission to manage this project.",
        403,
      );
    }

    return true;
  };

  private async hasWorkspaceProjectAccess(
    projectId: string,
    userId: string,
    role: string,
  ) {
    if (role === "SYSTEM_ADMIN") {
      return { isOwner: false, hasTeamAccess: true };
    }

    const project = await prisma.graduationProject.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true, isPublished: true, ideaType: true },
    });

    if (!project) {
      return null;
    }

    const isOwner = project.createdById === userId;

    const linkedTeam = await prisma.team.findFirst({
      where: {
        projectId: project.id,
        OR: [
          { mentorId: userId, mentorApproved: true },
          {
            members: {
              some: {
                userId,
                status: "APPROVED",
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return {
      project,
      isOwner,
      hasTeamAccess: Boolean(linkedTeam),
    };
  }

  private canManageProjectFiles = async (
    projectId: string,
    userId: string,
    role: string,
  ) => {
    if (role === "SYSTEM_ADMIN") {
      return true;
    }

    const access = await this.hasWorkspaceProjectAccess(projectId, userId, role);

    if (!access) {
      throw new AppError("Project not found.", 404);
    }

    if (access.isOwner) {
      return true;
    }

    const canManageTeamFiles = await prisma.team.findFirst({
      where: {
        projectId,
        OR: [
          { mentorId: userId, mentorApproved: true },
          {
            members: {
              some: {
                userId,
                status: "APPROVED",
                role: "TEAM_ADMIN",
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!canManageTeamFiles) {
      throw new AppError(
        "You do not have permission to manage project files.",
        403,
      );
    }

    return true;
  };

  public getProjects = async (
    req: Request<StringObject, StringObject, StringObject, GetProjectsQuery>,
    res: Response<ProjectsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getProjectsQuerySchema, req.query);
    const isAdmin = req.user?.role === "SYSTEM_ADMIN";

    const projects = await prisma.graduationProject.findMany({
      where: {
        ...(isAdmin ? {} : { isPublished: true }),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                { summary: { contains: query.search, mode: "insensitive" } },
                {
                  description: { contains: query.search, mode: "insensitive" },
                },
              ],
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.ideaType ? { ideaType: query.ideaType } : {}),
        ...(query.createdById ? { createdById: query.createdById } : {}),
        ...(query.universityId ? { universityId: query.universityId } : {}),
        ...(query.collegeId ? { collegeId: query.collegeId } : {}),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(typeof query.isPublished === "boolean"
          ? { isPublished: query.isPublished }
          : {}),
        ...(typeof query.isApproved === "boolean"
          ? { isApproved: query.isApproved }
          : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        details: true,
        files: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let paidProjectIds = new Set<string>();
    if (req.user?.userId && projects.length > 0) {
      const payments = await prisma.payment.findMany({
        where: {
          buyerId: req.user.userId,
          status: "SUCCESS",
          projectId: { in: projects.map((project) => project.id) },
        },
        select: { projectId: true },
      });
      paidProjectIds = new Set(payments.map((payment) => payment.projectId));
    }

    res.status(200).json({
      success: true,
      message: "Projects fetched successfully.",
      results: projects.length,
      projects: projects.map((project) => {
        const isOwner = req.user?.userId === project.createdById;
        const isAdmin = req.user?.role === "SYSTEM_ADMIN";
        const hasPaid = req.user?.userId
          ? paidProjectIds.has(project.id)
          : false;
        const canViewDetails =
          project.ideaType === "FREE" || isOwner || isAdmin || hasPaid;

        return {
          ...this.mapProject({
            ...project,
            files: [],
            details: canViewDetails ? project.details : null,
          }),
          detailsHidden: !canViewDetails,
          filesCount: project.files.length,
        };
      }),
    });
  };

  public getSavedProjects = async (
    req: Request<StringObject, StringObject, StringObject, GetProjectsQuery>,
    res: Response<SavedProjectsResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getProjectsQuerySchema, req.query);

    const savedProjects = await prisma.projectSave.findMany({
      where: {
        userId: req.user.userId,
        project: {
          isPublished: true,
          ...(query.search
            ? {
                OR: [
                  {
                    title: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    summary: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    description: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.ideaType ? { ideaType: query.ideaType } : {}),
          ...(query.createdById ? { createdById: query.createdById } : {}),
          ...(query.universityId ? { universityId: query.universityId } : {}),
          ...(query.collegeId ? { collegeId: query.collegeId } : {}),
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(typeof query.isPublished === "boolean"
            ? { isPublished: query.isPublished }
            : {}),
          ...(typeof query.isApproved === "boolean"
            ? { isApproved: query.isApproved }
            : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
            details: true,
            files: { select: { id: true } },
          },
        },
      },
    });

    let paidProjectIds = new Set<string>();
    if (savedProjects.length > 0) {
      const payments = await prisma.payment.findMany({
        where: {
          buyerId: req.user.userId,
          status: "SUCCESS",
          projectId: { in: savedProjects.map((item) => item.project.id) },
        },
        select: { projectId: true },
      });
      paidProjectIds = new Set(payments.map((payment) => payment.projectId));
    }

    res.status(200).json({
      success: true,
      message: "Saved projects fetched successfully.",
      results: savedProjects.length,
      savedProjects: savedProjects.map((item) => {
        const project = item.project;
        const isOwner = req.user.userId === project.createdById;
        const isAdmin = req.user.role === "SYSTEM_ADMIN";
        const hasPaid = paidProjectIds.has(project.id);
        const canViewDetails =
          project.ideaType === "FREE" || isOwner || isAdmin || hasPaid;

        return {
          ...this.mapProject({
            ...project,
            files: [],
            details: canViewDetails ? project.details : null,
          }),
          detailsHidden: !canViewDetails,
          filesCount: project.files.length,
          savedAt: item.createdAt,
        };
      }),
    });
  };

  public getProjectById = async (
    req: Request<IdParam>,
    res: Response<ProjectDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const isAdmin = req.user?.role === "SYSTEM_ADMIN";
    const userId = req.user?.userId;

    const project = await prisma.graduationProject.findFirst({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        details: true,
        files: true,
      },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const isOwner = userId === project.createdById;
    let hasTeamAccess = false;

    if (userId && !isAdmin) {
      const linkedTeam = await prisma.team.findFirst({
        where: {
          projectId: project.id,
          OR: [
            { mentorId: userId, mentorApproved: true },
            {
              members: {
                some: {
                  userId,
                  status: "APPROVED",
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      hasTeamAccess = Boolean(linkedTeam);
    }

    if (!isAdmin && !isOwner && !hasTeamAccess && !project.isPublished) {
      throw new AppError("Project not found.", 404);
    }

    await prisma.graduationProject.update({
      where: { id: project.id },
      data: { viewsCount: { increment: 1 } },
    });
    project.viewsCount += 1;

    const hasPaid = req.user?.userId
      ? !!(await prisma.payment.findFirst({
          where: {
            buyerId: req.user.userId,
            projectId: project.id,
            status: "SUCCESS",
          },
          select: { id: true },
        }))
      : false;
    const canViewDetails =
      project.ideaType === "FREE" || isOwner || isAdmin || hasPaid;
    const filesCount = project.files.length;

    if (!canViewDetails) {
      project.details = null;
      // Ideally lock files too since they are paid content
      project.files = [];
    }

    res.status(200).json({
      success: true,
      message: "Project fetched successfully.",
      project: {
        ...this.mapProject(project),
        detailsHidden: !canViewDetails,
        filesCount,
      },
    });
  };

  public createProject = async (
    req: Request<StringObject, StringObject, CreateProject>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createProjectSchema, req.body);

    // Ensure project university/college/department match the creating user's values
    const creator = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { universityId: true, collegeId: true, departmentId: true },
    });

    if (!creator) {
      throw new AppError("Creating user not found.", 404);
    }

    if (req.user.role !== "SYSTEM_ADMIN") {
      const settings = await prisma.platformSettings.findFirst();
      if (!settings.allowPaidIdeas) {
        if (payload.ideaType === "PAID") {
          throw new AppError("Paid ideas are currently stopped.", 400);
        }
      }
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.graduationProject.create({
        data: {
          title: payload.title,
          summary: payload.summary,
          description: payload.description,
          ideaType: payload.ideaType,
          price: payload.price,
          createdById: req.user.userId,
          universityId: payload.universityId ?? creator.universityId,
          collegeId: payload.collegeId ?? creator.collegeId,
          departmentId: payload.departmentId ?? creator.departmentId,
          technologies: payload.technologies,
          requiredSkills: payload.requiredSkills,
        },
      });

      if (payload.details) {
        await tx.projectDetail.create({
          data: {
            projectId: createdProject.id,
            detailedDescription: payload.details.detailedDescription,
            implementationGuide: payload.details.implementationGuide,
            deliverables: payload.details.deliverables,
            documentationUrl: payload.details.documentationUrl,
          },
        });
      }

      if (payload.files.length > 0) {
        await tx.projectFile.createMany({
          data: payload.files.map((file) => ({
            projectId: createdProject.id,
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            fileType: file.fileType,
            fileSize: file.fileSize ? BigInt(file.fileSize) : null,
            uploadedBy: req.user.userId,
          })),
        });
      }

      return tx.graduationProject.findUniqueOrThrow({
        where: { id: createdProject.id },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
            },
          },
          details: true,
          files: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully.",
      project: this.mapProject(project),
    });
  };

  public updateProject = async (
    req: Request<IdParam, StringObject, UpdateProject>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateProjectSchema, req.body);
    const p: Partial<UpdateProject> & Record<string, any> = { ...payload };

    // If changing to FREE and no price was provided, default price to 0 to keep consistency
    if (p.ideaType === "FREE" && p.price === undefined) {
      p.price = 0;
    }
    //if changing to paid check system settings
    const settings = await prisma.platformSettings.findFirst();
    if (!settings.allowPaidIdeas) {
      if (p.ideaType === "PAID") {
        throw new AppError("Paid ideas are currently stopped.", 400);
      }
    }

    await this.canManageProject(params.id, req.user.userId, req.user.role);

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.graduationProject.update({
        where: { id: params.id },
        data: {
          ...(p.title ? { title: p.title } : {}),
          ...(p.summary ? { summary: p.summary } : {}),
          ...(p.description !== undefined
            ? { description: p.description }
            : {}),
          ...(p.ideaType ? { ideaType: p.ideaType } : {}),
          ...(p.price !== undefined ? { price: p.price } : {}),
          ...(p.universityId !== undefined
            ? { universityId: p.universityId }
            : {}),
          ...(p.collegeId !== undefined ? { collegeId: p.collegeId } : {}),
          ...(p.departmentId !== undefined
            ? { departmentId: p.departmentId }
            : {}),
          ...(p.technologies ? { technologies: p.technologies } : {}),
          ...(p.requiredSkills ? { requiredSkills: p.requiredSkills } : {}),
          ...(p.isPublished !== undefined
            ? { isPublished: p.isPublished }
            : {}),
          ...(p.isApproved !== undefined ? { isApproved: p.isApproved } : {}),
          ...(p.status ? { status: p.status } : {}),
        },
      });

      if (payload.details) {
        await tx.projectDetail.upsert({
          where: { projectId: params.id },
          create: {
            projectId: params.id,
            detailedDescription: payload.details.detailedDescription,
            implementationGuide: payload.details.implementationGuide,
            deliverables: payload.details.deliverables,
            documentationUrl: payload.details.documentationUrl,
          },
          update: {
            ...(payload.details.detailedDescription !== undefined
              ? { detailedDescription: payload.details.detailedDescription }
              : {}),
            ...(payload.details.implementationGuide !== undefined
              ? { implementationGuide: payload.details.implementationGuide }
              : {}),
            ...(payload.details.deliverables
              ? { deliverables: payload.details.deliverables }
              : {}),
            ...(payload.details.documentationUrl !== undefined
              ? { documentationUrl: payload.details.documentationUrl }
              : {}),
          },
        });
      }

      return tx.graduationProject.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
            },
          },
          details: true,
          files: true,
        },
      });
    });

    res.status(200).json({
      success: true,
      message: "Project updated successfully.",
      project: this.mapProject(project),
    });
  };

  public deleteProject = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    await this.canManageProject(params.id, req.user.userId, req.user.role);

    await prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: { projectId: params.id },
        select: { id: true },
      });

      if (team) {
        await tx.team.delete({ where: { id: team.id } });
      }

      await tx.graduationProject.delete({
        where: { id: params.id },
      });
    });

    res.status(200).json({
      success: true,
      message: "Project deleted successfully.",
    });
  };

  public submitProject = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    await this.canManageProject(params.id, req.user.userId, req.user.role);

    const project = await prisma.graduationProject.update({
      where: { id: params.id },
      data: {
        status: "SUBMITTED",
        isPublished: false,
        isApproved: false,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        details: true,
        files: true,
      },
    });

    const team = await prisma.team.findFirst({
      where: { projectId: params.id },
      select: { mentorId: true, name: true },
    });

    if (team?.mentorId) {
      try {
        await notificationController.createNotification({
          userId: team.mentorId,
          type: "MILESTONE_STATUS_CHANGED",
          title: "Project Submitted for Review",
          content: `Team "${team.name}" submitted "${project.title}" for your review.`,
          relatedEntityId: project.id,
        });
      } catch {
        // Do not block submission if notification delivery fails.
      }
    }

    res.status(200).json({
      success: true,
      message: "Project submitted successfully.",
      project: this.mapProject(project),
    });
  };

  public approveProject = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const project = await prisma.graduationProject.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const updated = await prisma.graduationProject.update({
      where: { id: params.id },
      data: {
        status: "PUBLISHED",
        isPublished: true,
        isApproved: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            notificationSettings: { select: { projectApprovedRejected: true } },
          },
        },
        details: true,
        files: true,
      },
    });

    if (updated.createdBy.notificationSettings?.projectApprovedRejected !== false) {
      await notificationController.createNotification({
        userId: updated.createdById,
        type: "PROJECT_APPROVED",
        title: "Project Approved",
        content: `Your project \"${updated.title}\" has been approved and published.`,
        relatedEntityId: updated.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Project approved successfully.",
      project: this.mapProject(updated),
    });
  };

  public rejectProject = async (
    req: Request<IdParam, StringObject, RejectProject>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(rejectProjectSchema, req.body ?? {});

    const project = await prisma.graduationProject.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const updated = await prisma.graduationProject.update({
      where: { id: params.id },
      data: {
        status: "DRAFT",
        isPublished: false,
        isApproved: false,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            notificationSettings: { select: { projectApprovedRejected: true } },
          },
        },
        details: true,
        files: true,
      },
    });

    const reasonSuffix = payload.reason?.trim()
      ? ` Reason: ${payload.reason.trim()}`
      : "";

    if (updated.createdBy.notificationSettings?.projectApprovedRejected !== false) {
      await notificationController.createNotification({
        userId: updated.createdById,
        type: "PROJECT_REJECTED",
        title: "Project Rejected",
        content: `Your project \"${updated.title}\" has been rejected and moved back to draft.${reasonSuffix}`,
        relatedEntityId: updated.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Project rejected successfully.",
      project: this.mapProject(updated),
    });
  };

  public saveProject = async (
    req: Request<IdParam>,
    res: Response<SaveProjectResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const project = await prisma.graduationProject.findFirst({
      where: { id: params.id },
      select: {
        id: true,
        createdById: true,
        isPublished: true,
      },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const isOwner = req.user.userId === project.createdById;

    if (!isOwner && !project.isPublished) {
      throw new AppError("Project not found.", 404);
    }

    const existingSave = await prisma.projectSave.findUnique({
      where: {
        userId_projectId: {
          userId: req.user.userId,
          projectId: params.id,
        },
      },
      select: { id: true },
    });

    if (existingSave) {
      throw new AppError("Project already saved.", 409);
    }

    const [, updatedProject] = await prisma.$transaction([
      prisma.projectSave.create({
        data: {
          userId: req.user.userId,
          projectId: params.id,
        },
      }),
      prisma.graduationProject.update({
        where: { id: params.id },
        data: { savesCount: { increment: 1 } },
        select: { savesCount: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Project saved successfully.",
      projectId: params.id,
      savesCount: updatedProject.savesCount,
    });
  };

  public unsaveProject = async (
    req: Request<IdParam>,
    res: Response<UnsaveProjectResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existingSave = await prisma.projectSave.findUnique({
      where: {
        userId_projectId: {
          userId: req.user.userId,
          projectId: params.id,
        },
      },
      select: { id: true },
    });

    if (!existingSave) {
      throw new AppError("Project is not saved.", 404);
    }

    const [, updatedProject] = await prisma.$transaction([
      prisma.projectSave.delete({
        where: {
          userId_projectId: {
            userId: req.user.userId,
            projectId: params.id,
          },
        },
      }),
      prisma.graduationProject.update({
        where: { id: params.id },
        data: { savesCount: { decrement: 1 } },
        select: { savesCount: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Project unsaved successfully.",
      projectId: params.id,
      savesCount: updatedProject.savesCount,
    });
  };

  public addProjectFile = async (
    req: Request<IdParam, StringObject, AddProjectFile>,
    res: Response<MessageResponse & { file: ProjectFileResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(addProjectFileSchema, req.body);

    await this.canManageProjectFiles(params.id, req.user.userId, req.user.role);

    const file = await prisma.projectFile.create({
      data: {
        projectId: params.id,
        fileName: payload.fileName,
        fileUrl: payload.fileUrl,
        fileType: payload.fileType,
        fileSize: payload.fileSize ? BigInt(payload.fileSize) : null,
        uploadedBy: req.user.userId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Project file added successfully.",
      file: this.mapFile(file),
    });
  };

  public getProjectFiles = async (
    req: Request<IdParam>,
    res: Response<ProjectFileListResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const isAdmin = req.user?.role === "SYSTEM_ADMIN";
    const userId = req.user?.userId;

    const access = userId
      ? await this.hasWorkspaceProjectAccess(params.id, userId, req.user.role)
      : null;

    const project = access?.project
      ?? (await prisma.graduationProject.findUnique({
        where: { id: params.id },
        select: { id: true, ideaType: true, createdById: true, isPublished: true },
      }));

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const isOwner = userId === project.createdById;
    const hasTeamAccess = access?.hasTeamAccess ?? false;

    if (!isAdmin && !isOwner && !hasTeamAccess && !project.isPublished) {
      throw new AppError("Project not found.", 404);
    }

    if (project.ideaType === "PAID") {
      let hasPaidAccess = false;

      if (userId) {
        const successfulPayment = await prisma.payment.findFirst({
          where: {
            projectId: project.id,
            buyerId: userId,
            status: "SUCCESS",
          },
          select: { id: true },
        });
        hasPaidAccess = Boolean(successfulPayment);
      }

      if (!isOwner && !isAdmin && !hasTeamAccess && !hasPaidAccess) {
        throw new AppError(
          "You need to purchase this project to access its files.",
          403,
        );
      }
    }

    const files = await prisma.projectFile.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Project files fetched successfully.",
      results: files.length,
      files: files.map((file) => this.mapFile(file)),
    });
  };

  public deleteProjectFile = async (
    req: Request<FileParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(fileParamSchema, req.params);

    await this.canManageProjectFiles(params.id, req.user.userId, req.user.role);

    const file = await prisma.projectFile.findFirst({
      where: { id: params.fileId, projectId: params.id },
      select: { id: true },
    });

    if (!file) {
      throw new AppError("Project file not found.", 404);
    }

    await prisma.projectFile.delete({ where: { id: params.fileId } });

    res.status(200).json({
      success: true,
      message: "Project file deleted successfully.",
    });
  };
}

export const projectController = new ProjectController();
