import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateComplaint,
  createComplaintSchema,
  GetComplaintsQuery,
  getComplaintsQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  ComplaintDetailsResponse,
  ComplaintResponse,
  ComplaintsListResponse,
  ComplaintStatsResponse,
  StringObject,
  UpdateComplaintStatus,
  updateComplaintStatusSchema,
} from "./complaint.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class ComplaintController {
  public getComplaints = async (
    req: Request<StringObject, StringObject, StringObject, GetComplaintsQuery>,
    res: Response<ComplaintsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getComplaintsQuerySchema, req.query);

    const complaints = await prisma.complaint.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.startDate || query.endDate
          ? {
              createdAt: {
                ...(query.startDate ? { gte: query.startDate } : {}),
                ...(query.endDate ? { lte: query.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Complaints fetched successfully.",
      results: complaints.length,
      complaints,
    });
  };

  public getComplaintById = async (
    req: Request<IdParam>,
    res: Response<ComplaintDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const complaint = await prisma.complaint.findUnique({
      where: { id: params.id },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError("Complaint not found.", 404);
    }

    if (
      complaint.reporterId !== req.user.userId &&
      req.user.role !== "SYSTEM_ADMIN"
    ) {
      throw new AppError(
        "You do not have permission to access this complaint.",
        403,
      );
    }

    res.status(200).json({
      success: true,
      message: "Complaint fetched successfully.",
      complaint,
    });
  };

  public createComplaint = async (
    req: Request<StringObject, StringObject, CreateComplaint>,
    res: Response<MessageResponse & { complaint: ComplaintResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createComplaintSchema, req.body);

    if (payload.targetUserId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.targetUserId },
        select: { id: true },
      });

      if (!user) {
        throw new AppError("Target user not found.", 404);
      }
    }

    if (payload.targetProjectId) {
      const project = await prisma.graduationProject.findUnique({
        where: { id: payload.targetProjectId },
        select: { id: true },
      });

      if (!project) {
        throw new AppError("Target project not found.", 404);
      }
    }

    const complaint = await prisma.complaint.create({
      data: {
        reporterId: req.user.userId,
        title: payload.title,
        description: payload.description,
        targetUserId: payload.targetUserId,
        targetProjectId: payload.targetProjectId,
        status: "SUBMITTED",
      },
    });

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      complaint,
    });
  };

  public updateComplaintStatus = async (
    req: Request<
      IdParam,
      StringObject,
      UpdateComplaintStatus & { resolutionNotes?: string }
    >,
    res: Response<MessageResponse & { complaint: ComplaintResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateComplaintStatusSchema, req.body);

    const complaint = await prisma.complaint.findUnique({
      where: { id: params.id },
    });

    if (!complaint) {
      throw new AppError("Complaint not found.", 404);
    }

    const updated = await prisma.complaint.update({
      where: { id: params.id },
      data: {
        status: payload.status,
        ...(payload.status === "RESOLVED"
          ? {
              resolvedBy: req.user.userId,
              resolution: (req.body as any).resolution,
              resolvedAt: new Date(),
            }
          : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "Complaint status updated successfully.",
      complaint: updated,
    });
  };

  public getComplaintStats = async (
    req: Request,
    res: Response<ComplaintStatsResponse>,
    _next: NextFunction,
  ) => {
    const [total, submitted, investigating, resolved] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: "SUBMITTED" } }),
      prisma.complaint.count({ where: { status: "INVESTIGATING" } }),
      prisma.complaint.count({ where: { status: "RESOLVED" } }),
    ]);

    res.status(200).json({
      success: true,
      message: "Complaint stats fetched successfully.",
      total,
      submitted,
      investigating,
      resolved,
    });
  };
}

export const complaintController = new ComplaintController();
