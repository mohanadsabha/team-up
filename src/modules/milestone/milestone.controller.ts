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
    // Determine allowed teams for the user
    let allowedTeamIds: string[] = [];
    if (req.user.role !== "SYSTEM_ADMIN") {
      const memberTeams = await prisma.teamMember.findMany({
        where: { userId: req.user.userId },
        select: { teamId: true },
      });
      const mentorTeams = await prisma.team.findMany({
        where: { mentorId: req.user.userId },
        select: { id: true },
      });

      allowedTeamIds = [
        ...new Set([
          ...memberTeams.map((m) => m.teamId),
          ...mentorTeams.map((t) => t.id),
        ]),
      ];
    }

    // If a specific teamId was requested, ensure user has access
    if (query.teamId && req.user.role !== "SYSTEM_ADMIN") {
      if (!allowedTeamIds.includes(query.teamId)) {
        throw new AppError(
          "Not authorized to view milestones for this team.",
          403,
        );
      }
    }

    const whereClause: any = {
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (req.user.role !== "SYSTEM_ADMIN") {
      whereClause.teamId = { in: allowedTeamIds };
      if (query.teamId) whereClause.teamId = query.teamId; // already validated above
    }

    const milestones = await prisma.milestone.findMany({
      where: whereClause,
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
        tasks: {
          select: { id: true, title: true, status: true, assignedTo: true },
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
        tasks: {
          select: { id: true, title: true, status: true, assignedTo: true },
        },
        team: true,
      },
    });

    if (!milestone) {
      throw new AppError("Milestone not found.", 404);
    }
    // Restrict access to team members / mentors
    if (req.user.role !== "SYSTEM_ADMIN") {
      const isMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: milestone.teamId, userId: req.user.userId },
        },
      });
      if (!isMember && milestone.team.mentorId !== req.user.userId) {
        throw new AppError("Not authorized to view this milestone.", 403);
      }
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

    // Validate provided tasks belong to the team
    const tasks = await prisma.task.findMany({
      where: { id: { in: payload.taskIds } },
      select: { id: true, teamId: true },
    });

    if (tasks.length !== payload.taskIds.length) {
      throw new AppError("One or more tasks not found.", 404);
    }

    if (tasks.some((t) => t.teamId !== payload.teamId)) {
      throw new AppError("All tasks must belong to the milestone's team.", 400);
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

    // Link tasks to milestone
    await prisma.task.updateMany({
      where: { id: { in: payload.taskIds } },
      data: { milestoneId: milestone.id },
    });

    // Notify team members
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: payload.teamId },
      select: { userId: true },
    });
    for (const member of teamMembers) {
      const milestoneNotify = await prisma.notificationUserSetting.findFirst({
        where: { userId: member.userId },
        select: { milestoneStatus: true },
      });
      if (milestoneNotify.milestoneStatus) {
        await notificationController.createNotification({
          userId: member.userId,
          type: "MILESTONE_STATUS_CHANGED",
          title: "New Milestone Added",
          content: `Milestone "${milestone.title}" was added to your team.`,
          relatedEntityId: milestone.id,
        });
      }
    }

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
      include: { team: true },
    });
    // Notify team members about update
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: updated.teamId },
      select: { userId: true },
    });
    for (const member of teamMembers) {
      const milestoneNotify = await prisma.notificationUserSetting.findFirst({
        where: { userId: member.userId },
        select: { milestoneStatus: true },
      });
      if (milestoneNotify.milestoneStatus) {
        await notificationController.createNotification({
          userId: member.userId,
          type: "MILESTONE_STATUS_CHANGED",
          title: "Milestone Updated",
          content: `Milestone "${updated.title}" was updated.`,
          relatedEntityId: updated.id,
        });
      }
    }
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
          include: { members: { select: { userId: true, role: true } } },
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

    // Collect member ids for notification
    const membersForNotify = (milestone.team as any).members as {
      userId: string;
    }[];

    await prisma.milestone.delete({ where: { id: params.id } });

    for (const m of membersForNotify) {
      const milestoneNotify = await prisma.notificationUserSetting.findFirst({
        where: { userId: m.userId },
        select: { milestoneStatus: true },
      });
      if (milestoneNotify.milestoneStatus) {
        await notificationController.createNotification({
          userId: m.userId,
          type: "MILESTONE_STATUS_CHANGED",
          title: "Milestone Deleted",
          content: `A milestone ("${milestone.title}") was deleted from your team.`,
          relatedEntityId: params.id,
        });
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Milestone deleted successfully." });
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

    // Ensure all linked tasks are completed (DONE or APPROVED) before submission
    const incompleteCount = await prisma.task.count({
      where: {
        milestoneId: params.id,
        NOT: { status: { in: ["DONE", "APPROVED"] } },
      },
    });

    if (incompleteCount > 0) {
      throw new AppError(
        "Cannot submit milestone until all linked tasks are completed.",
        400,
      );
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        submittedAt: new Date(),
      },
    });

    // Notify mentor of submission
    if (milestone.team.mentorId) {
      const milestoneNotify = await prisma.notificationUserSetting.findFirst({
        where: { userId: milestone.team.mentorId },
        select: { milestoneStatus: true },
      });
      if (milestoneNotify.milestoneStatus) {
        await notificationController.createNotification({
          userId: milestone.team.mentorId,
          type: "MILESTONE_STATUS_CHANGED",
          title: "New Milestone Submission",
          content: `Milestone "${milestone.title}" has been submitted for review.`,
          relatedEntityId: params.id,
        });
      }
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

    // Ensure all linked tasks are APPROVED before any review
    const notApprovedCount = await prisma.task.count({
      where: { milestoneId: params.id, NOT: { status: "APPROVED" } },
    });

    if (notApprovedCount > 0) {
      throw new AppError(
        "All linked tasks must be approved before reviewing this milestone.",
        400,
      );
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        status: payload.status,
        reviewedBy: req.user.userId,
        reviewNotes: payload.reviewNotes,
      },
      include: { team: true },
    });

    // Notify team of review
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: milestone.teamId },
      select: { userId: true },
    });

    for (const member of teamMembers) {
      const milestoneNotify = await prisma.notificationUserSetting.findFirst({
        where: { userId: member.userId },
        select: { milestoneStatus: true },
      });
      if (milestoneNotify.milestoneStatus) {
        await notificationController.createNotification({
          userId: member.userId,
          type: "MILESTONE_STATUS_CHANGED",
          title: `Milestone Review: ${payload.status}`,
          content: `Milestone "${milestone.title}" has been reviewed and marked as ${payload.status}.`,
          relatedEntityId: params.id,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Milestone reviewed successfully.",
      milestone: updated,
    });
  };
}

export const milestoneController = new MilestoneController();
