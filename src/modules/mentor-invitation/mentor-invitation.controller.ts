import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import {
  IdParam,
  idParamSchema,
  InviteMentor,
  inviteMentorSchema,
  MessageResponse,
  MentorInvitationsListResponse,
  TeamWithMentorResponse,
  StringObject,
} from "./mentor-invitation.interface";
import { notificationController } from "../notification/notification.controller";

class MentorInvitationController {
  public inviteMentor = async (
    req: Request<IdParam, StringObject, InviteMentor>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(inviteMentorSchema, req.body);

    // Verify team exists and user is team admin
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        members: {
          where: { userId: req.user.userId },
          select: { role: true },
        },
      },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const isTeamAdmin =
      team.members.some((m) => m.role === "TEAM_ADMIN") ||
      req.user.role === "SYSTEM_ADMIN";
    if (!isTeamAdmin) {
      throw new AppError("Only team admin can invite mentors.", 403);
    }

    // Verify mentor exists and has MENTOR role
    const mentor = await prisma.user.findUnique({
      where: { id: payload.mentorId },
      select: { id: true, role: true },
    });

    if (!mentor || !["MENTOR", "SYSTEM_ADMIN"].includes(mentor.role)) {
      throw new AppError("Mentor not found or invalid role.", 404);
    }

    // Check if invitation already pending
    if (team.mentorId === payload.mentorId && !team.mentorApproved) {
      throw new AppError("Mentor invitation already pending.", 409);
    }

    // Send invitation
    await prisma.team.update({
      where: { id: params.id },
      data: {
        mentorId: payload.mentorId,
        mentorApproved: false,
      },
    });

    // Send notification to mentor
    await notificationController.createNotification({
      userId: payload.mentorId,
      type: "MENTOR_INVITATION_SENT",
      title: `Mentorship Invitation from ${team.name}`,
      content: `You have been invited to mentor the team "${team.name}". Accept or reject this invitation.`,
      relatedEntityId: params.id,
    });

    res.status(200).json({
      success: true,
      message: "Mentor invitation sent successfully.",
    });
  };

  public getPendingInvitations = async (
    req: Request,
    res: Response<MentorInvitationsListResponse>,
    _next: NextFunction,
  ) => {
    const teams = await prisma.team.findMany({
      where: {
        mentorId: req.user.userId,
        mentorApproved: false,
      },
      include: {
        members: { select: { id: true } },
        mentor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const invitations = teams.map((team) => ({
      teamId: team.id,
      mentorId: team.mentorId || "",
      status: "PENDING" as const,
      sentAt: team.updatedAt,
      respondedAt: null as Date | null,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
      },
      mentor: team.mentor!,
    }));

    res.status(200).json({
      success: true,
      message: "Pending mentor invitations fetched successfully.",
      results: invitations.length,
      invitations,
    });
  };

  public acceptInvitation = async (
    req: Request<IdParam>,
    res: Response<TeamWithMentorResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        mentor: {
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

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    if (team.mentorId !== req.user.userId) {
      throw new AppError("You are not invited to mentor this team.", 403);
    }

    if (team.mentorApproved) {
      throw new AppError("Invitation already accepted.", 409);
    }

    const updated = await prisma.team.update({
      where: { id: params.id },
      data: { mentorApproved: true },
      include: {
        mentor: {
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

    // Send acceptance notification to team creator
    const teamCreator = await prisma.teamMember.findFirst({
      where: { teamId: params.id, role: "TEAM_ADMIN" },
      select: { userId: true },
    });

    if (teamCreator) {
      await notificationController.createNotification({
        userId: teamCreator.userId,
        type: "MENTOR_INVITATION_ACCEPTED",
        title: `Mentor Accepted Mentorship`,
        content: `Your mentor invitation for team "${team.name}" has been accepted.`,
        relatedEntityId: params.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Mentorship invitation accepted successfully.",
      team: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        mentorId: updated.mentorId,
        mentorApproved: updated.mentorApproved,
        mentor: updated.mentor,
      },
    });
  };

  public rejectInvitation = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    if (team.mentorId !== req.user.userId) {
      throw new AppError("You are not invited to mentor this team.", 403);
    }

    const mentorName = req.user.username || "A mentor";

    await prisma.team.update({
      where: { id: params.id },
      data: {
        mentorId: null,
        mentorApproved: false,
      },
    });

    // Send rejection notification to team creator
    const teamCreator = await prisma.teamMember.findFirst({
      where: { teamId: params.id, role: "TEAM_ADMIN" },
      select: { userId: true },
    });

    if (teamCreator) {
      await notificationController.createNotification({
        userId: teamCreator.userId,
        type: "MENTOR_INVITATION_REJECTED",
        title: `Mentor Rejected Mentorship`,
        content: `${mentorName} has rejected the mentorship invitation for team "${team.name}".`,
        relatedEntityId: params.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Mentorship invitation rejected successfully.",
    });
  };
}

export const mentorInvitationController = new MentorInvitationController();
