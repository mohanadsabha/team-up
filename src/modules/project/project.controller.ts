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
  StringObject,
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

  public getProjects = async (
    req: Request<StringObject, StringObject, StringObject, GetProjectsQuery>,
    res: Response<ProjectsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getProjectsQuerySchema, req.query);

    const projects = await prisma.graduationProject.findMany({
      where: {
        isPublished: true,
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

    res.status(200).json({
      success: true,
      message: "Projects fetched successfully.",
      results: projects.length,
      projects: projects.map((project) => ({
        ...this.mapProject({ ...project, files: [] }),
        filesCount: project.files.length,
      })),
    });
  };

  public getProjectById = async (
    req: Request<IdParam>,
    res: Response<ProjectDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const project = await prisma.graduationProject.findFirst({
      where: { id: params.id, isPublished: true },
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

    res.status(200).json({
      success: true,
      message: "Project fetched successfully.",
      project: this.mapProject(project),
    });
  };

  public createProject = async (
    req: Request<StringObject, StringObject, CreateProject>,
    res: Response<MessageResponse & { project: ProjectResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createProjectSchema, req.body);

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.graduationProject.create({
        data: {
          title: payload.title,
          summary: payload.summary,
          description: payload.description,
          ideaType: payload.ideaType,
          price: payload.price,
          createdById: req.user.userId,
          universityId: payload.universityId,
          collegeId: payload.collegeId,
          departmentId: payload.departmentId,
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

    await this.canManageProject(params.id, req.user.userId, req.user.role);

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.graduationProject.update({
        where: { id: params.id },
        data: {
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.summary ? { summary: payload.summary } : {}),
          ...(payload.description !== undefined
            ? { description: payload.description }
            : {}),
          ...(payload.ideaType ? { ideaType: payload.ideaType } : {}),
          ...(payload.price !== undefined ? { price: payload.price } : {}),
          ...(payload.universityId !== undefined
            ? { universityId: payload.universityId }
            : {}),
          ...(payload.collegeId !== undefined
            ? { collegeId: payload.collegeId }
            : {}),
          ...(payload.departmentId !== undefined
            ? { departmentId: payload.departmentId }
            : {}),
          ...(payload.technologies
            ? { technologies: payload.technologies }
            : {}),
          ...(payload.requiredSkills
            ? { requiredSkills: payload.requiredSkills }
            : {}),
          ...(payload.isPublished !== undefined
            ? { isPublished: payload.isPublished }
            : {}),
          ...(payload.isApproved !== undefined
            ? { isApproved: payload.isApproved }
            : {}),
          ...(payload.status ? { status: payload.status } : {}),
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

    await prisma.graduationProject.delete({
      where: { id: params.id },
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
          },
        },
        details: true,
        files: true,
      },
    });

    await notificationController.createNotification({
      userId: updated.createdById,
      type: "PROJECT_APPROVED",
      title: "Project Approved",
      content: `Your project \"${updated.title}\" has been approved and published.`,
      relatedEntityId: updated.id,
    });

    res.status(200).json({
      success: true,
      message: "Project approved successfully.",
      project: this.mapProject(updated),
    });
  };

  public rejectProject = async (
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
          },
        },
        details: true,
        files: true,
      },
    });

    await notificationController.createNotification({
      userId: updated.createdById,
      type: "PROJECT_REJECTED",
      title: "Project Rejected",
      content: `Your project \"${updated.title}\" has been rejected and moved back to draft.`,
      relatedEntityId: updated.id,
    });

    res.status(200).json({
      success: true,
      message: "Project rejected successfully.",
      project: this.mapProject(updated),
    });
  };

  public addProjectFile = async (
    req: Request<IdParam, StringObject, AddProjectFile>,
    res: Response<MessageResponse & { file: ProjectFileResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(addProjectFileSchema, req.body);

    await this.canManageProject(params.id, req.user.userId, req.user.role);

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

    const project = await prisma.graduationProject.findFirst({
      where: { id: params.id, isPublished: true },
      select: { id: true, ideaType: true, createdById: true },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    if (project.ideaType === "PAID") {
      const isOwner = req.user?.userId === project.createdById;
      let hasAccess = false;

      if (req.user?.userId) {
        const successfulPayment = await prisma.payment.findFirst({
          where: {
            projectId: project.id,
            buyerId: req.user.userId,
            status: "SUCCESS",
          },
          select: { id: true },
        });
        hasAccess = !!successfulPayment;
      }

      if (!isOwner && !hasAccess) {
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

    await this.canManageProject(params.id, req.user.userId, req.user.role);

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
