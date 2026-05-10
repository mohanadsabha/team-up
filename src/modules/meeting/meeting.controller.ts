import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateMeeting,
  createMeetingSchema,
  GetMeetingsQuery,
  getMeetingsQuerySchema,
  IdParam,
  idParamSchema,
  MeetingDetailsResponse,
  MeetingResponse,
  MeetingsListResponse,
  MessageResponse,
  UpdateMeeting,
  updateMeetingSchema,
  StringObject,
} from "./meeting.interface";
import { notificationController } from "../notification/notification.controller";
import { processMeetingReminders } from "./meeting-reminder.job";

class MeetingController {
  private async assertTeamAccess(teamId: string, userId: string, role: string) {
    if (role === "SYSTEM_ADMIN") {
      return;
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      throw new AppError("You are not a member of this team.", 403);
    }
  }

  private async assertCanManageMeeting(
    teamId: string,
    userId: string,
    role: string,
  ) {
    if (role === "SYSTEM_ADMIN") {
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const isMentor = team.mentorId === userId && team.mentorApproved;
    const isAdmin = team.members.some((member) => member.role === "TEAM_ADMIN");

    if (!isMentor && !isAdmin) {
      throw new AppError(
        "Only team admins or approved mentors can manage meetings.",
        403,
      );
    }
  }

  public getMeetings = async (
    req: Request<StringObject, StringObject, StringObject, GetMeetingsQuery>,
    res: Response<MeetingsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getMeetingsQuerySchema, req.query);

    const meetings = await prisma.meeting.findMany({
      where: {
        ...(req.user.role !== "SYSTEM_ADMIN" && !query.teamId
          ? {
              team: {
                members: {
                  some: {
                    userId: req.user.userId,
                    status: "APPROVED",
                  },
                },
              },
            }
          : {}),
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.upcoming ? { startAt: { gte: new Date() } } : {}),
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
      },
      orderBy: { startAt: "asc" },
    });

    if (query.teamId) {
      await this.assertTeamAccess(query.teamId, req.user.userId, req.user.role);
    }

    const meetingsWithCreator = meetings.map((meeting) => ({
      id: meeting.id,
      teamId: meeting.teamId,
      createdById: meeting.createdById,
      title: meeting.title,
      description: meeting.description,
      meetingUrl: meeting.meetingUrl,
      location: meeting.location,
      status: meeting.status,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      creator: meeting.createdBy,
    }));

    res.status(200).json({
      success: true,
      message: "Meetings fetched successfully.",
      results: meetingsWithCreator.length,
      meetings: meetingsWithCreator,
    });
  };

  public getMeetingById = async (
    req: Request<IdParam>,
    res: Response<MeetingDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const meeting = await prisma.meeting.findUnique({
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
      },
    });

    if (!meeting) {
      throw new AppError("Meeting not found.", 404);
    }

    await this.assertTeamAccess(meeting.teamId, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Meeting fetched successfully.",
      meeting: {
        id: meeting.id,
        teamId: meeting.teamId,
        createdById: meeting.createdById,
        title: meeting.title,
        description: meeting.description,
        meetingUrl: meeting.meetingUrl,
        location: meeting.location,
        status: meeting.status,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
        creator: meeting.createdBy,
      },
    });
  };

  public createMeeting = async (
    req: Request<StringObject, StringObject, CreateMeeting>,
    res: Response<MessageResponse & { meeting: MeetingResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createMeetingSchema, req.body);

    if (payload.endAt <= payload.startAt) {
      throw new AppError("Meeting end time must be after the start time.", 400);
    }

    const team = await prisma.team.findUnique({
      where: { id: payload.teamId },
      select: { id: true, mentorId: true, mentorApproved: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    await this.assertCanManageMeeting(
      payload.teamId,
      req.user.userId,
      req.user.role,
    );

    const meeting = await prisma.meeting.create({
      data: {
        teamId: payload.teamId,
        createdById: req.user.userId,
        title: payload.title,
        description: payload.description,
        meetingUrl: payload.meetingUrl,
        location: payload.location,
        startAt: payload.startAt,
        endAt: payload.endAt,
      },
    });

    const members = await prisma.teamMember.findMany({
      where: { teamId: payload.teamId },
      select: { userId: true },
    });

    for (const member of members) {
      if (member.userId === req.user.userId) continue;
      await notificationController.createNotification({
        userId: member.userId,
        type: "MEETING_REMINDER",
        title: "Meeting Scheduled",
        content: `A new meeting has been scheduled for team ${team.id}: ${payload.title}.`,
        relatedEntityId: meeting.id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Meeting scheduled successfully.",
      meeting,
    });
  };

  public updateMeeting = async (
    req: Request<IdParam, StringObject, UpdateMeeting>,
    res: Response<MessageResponse & { meeting: MeetingResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateMeetingSchema, req.body);

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
    });

    if (!meeting) {
      throw new AppError("Meeting not found.", 404);
    }

    await this.assertCanManageMeeting(
      meeting.teamId,
      req.user.userId,
      req.user.role,
    );

    if (payload.startAt && payload.endAt && payload.endAt <= payload.startAt) {
      throw new AppError("Meeting end time must be after the start time.", 400);
    }

    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.meetingUrl !== undefined
          ? { meetingUrl: payload.meetingUrl }
          : {}),
        ...(payload.location !== undefined
          ? { location: payload.location }
          : {}),
        ...(payload.startAt ? { startAt: payload.startAt } : {}),
        ...(payload.endAt ? { endAt: payload.endAt } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "Meeting updated successfully.",
      meeting: updated,
    });
  };

  public deleteMeeting = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
    });

    if (!meeting) {
      throw new AppError("Meeting not found.", 404);
    }

    await this.assertCanManageMeeting(
      meeting.teamId,
      req.user.userId,
      req.user.role,
    );

    await prisma.meeting.delete({ where: { id: params.id } });

    res.status(200).json({
      success: true,
      message: "Meeting deleted successfully.",
    });
  };

  public sendDueReminders = async (
    req: Request,
    res: Response<MessageResponse & { sent: number }>,
    _next: NextFunction,
  ) => {
    // This endpoint is a manual sweep hook for cron/worker integration.
    const sent = await processMeetingReminders();

    res.status(200).json({
      success: true,
      message: "Due meeting reminders processed.",
      sent,
    });
  };
}

export const meetingController = new MeetingController();
