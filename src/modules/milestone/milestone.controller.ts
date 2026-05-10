import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateMilestone,
  createMilestoneSchema,
  GetMilestonesQuery,
  getMilestonesQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  MilestoneDetailsResponse,
  MilestoneResponse,
  MilestonesListResponse,
  ReviewMilestone,
  reviewMilestoneSchema,
  StringObject,
  SubmitMilestone,
  submitMilestoneSchema,
  UpdateMilestone,
  updateMilestoneSchema,
  UserPreviewResponse,
} from "./milestone.interface";
import { notificationController } from "../notification/notification.controller";

class MilestoneController {
  public getMilestones = async (
    req: Request<StringObject, StringObject, StringObject, GetMilestonesQuery>,
    res: Response<MilestonesListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getMilestonesQuerySchema, req.query);

    const milestones = await prisma.milestone.findMany({
      where: {
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Milestones fetched successfully.",
      results: milestones.length,
      milestones,
    });
  };

  public getMilestoneById = async (
    req: Request<IdParam>,
    res: Response<MilestoneDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: {
        reviewer: {
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

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Milestone fetched successfully.",
      milestone,
    });
  };

  public createMilestone = async (
    req: Request<StringObject, StringObject, CreateMilestone>,
    res: Response<MessageResponse & { milestone: MilestoneResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createMilestoneSchema, req.body);

    // Verify team exists and user is team admin or mentor
    const team = await prisma.team.findUnique({
      where: { id: payload.teamId },
      include: {
        members: { where: { userId: req.user.userId }, select: { role: true } },
      },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const isAuthorized =
      team.mentorId === req.user.userId ||
      team.members.some((m) => m.role === "TEAM_ADMIN") ||
      req.user.role === "SYSTEM_ADMIN";

    if (!isAuthorized) {
      throw new AppError(
        "Only team admin or mentor can create milestones.",
        403,
      );
    }

    // Verify project exists
    const project = await prisma.graduationProject.findUnique({
      where: { id: payload.projectId },
      select: { id: true },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const milestone = await prisma.milestone.create({
      data: {
        teamId: payload.teamId,
        projectId: payload.projectId,
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
      },
    });

    res.status(201).json({
      success: true,
      message: "Milestone created successfully.",
      milestone,
    });
  };

  public updateMilestone = async (
    req: Request<IdParam, StringObject, UpdateMilestone>,
    res: Response<MessageResponse & { milestone: MilestoneResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateMilestoneSchema, req.body);

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: {
        team: {
          include: {
            members: {
              where: { userId: req.user.userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }

    const isAuthorized =
      milestone.team.mentorId === req.user.userId ||
      milestone.team.members.some((m) => m.role === "TEAM_ADMIN") ||
      req.user.role === "SYSTEM_ADMIN";

    if (!isAuthorized) {
      throw new AppError(
        "Only team admin or mentor can update milestones.",
        403,
      );
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "Milestone updated successfully.",
      milestone: updated,
    });
  };

  public deleteMilestone = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: {
        team: {
          include: {
            members: {
              where: { userId: req.user.userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }

    const isAuthorized =
      milestone.team.mentorId === req.user.userId ||
      milestone.team.members.some((m) => m.role === "TEAM_ADMIN") ||
      req.user.role === "SYSTEM_ADMIN";

    if (!isAuthorized) {
      throw new AppError(
        "Only team admin or mentor can delete milestones.",
        403,
      );
    }

    await prisma.milestone.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Milestone deleted successfully.",
    });
  };

  public submitMilestone = async (
    req: Request<IdParam, StringObject, SubmitMilestone>,
    res: Response<MessageResponse & { milestone: MilestoneResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: { team: true },
    });

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }

    // Only team members can submit
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: milestone.teamId, userId: req.user.userId },
      },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("Only team members can submit milestones.", 403);
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        submittedAt: new Date(),
      },
    });

    // Notify mentor of submission
    if (milestone.team.mentorId) {
      await notificationController.createNotification({
        userId: milestone.team.mentorId,
        type: "MILESTONE_STATUS_CHANGED",
        title: "New Milestone Submission",
        content: `Milestone "${milestone.title}" has been submitted for review.`,
        relatedEntityId: params.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone submitted successfully.",
      milestone: updated,
    });
  };

  public reviewMilestone = async (
    req: Request<IdParam, StringObject, ReviewMilestone>,
    res: Response<MessageResponse & { milestone: MilestoneResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(reviewMilestoneSchema, req.body);

    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: { team: true },
    });

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }

    // Only mentor or admin can review
    if (
      milestone.team.mentorId !== req.user.userId &&
      req.user.role !== "SYSTEM_ADMIN"
    ) {
      throw new AppError("Only mentor or admin can review milestones.", 403);
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        status: payload.status,
        reviewedBy: req.user.userId,
        reviewNotes: payload.reviewNotes,
      },
    });

    // Notify team of review
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: milestone.teamId },
      select: { userId: true },
    });

    for (const member of teamMembers) {
      await notificationController.createNotification({
        userId: member.userId,
        type: "MILESTONE_STATUS_CHANGED",
        title: `Milestone Review: ${payload.status}`,
        content: `Milestone "${milestone.title}" has been reviewed and marked as ${payload.status}.`,
        relatedEntityId: params.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone reviewed successfully.",
      milestone: updated,
    });
  };
}

export const milestoneController = new MilestoneController();
