import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateJoinRequest,
  createJoinRequestSchema,
  GetRequestsQuery,
  getRequestsQuerySchema,
  IdParam,
  idParamSchema,
  JoinRequestsListResponse,
  JoinRequestResponse,
  MessageResponse,
  RespondJoinRequest,
  respondJoinRequestSchema,
  StringObject,
} from "./join-request.interface";
import { notificationController } from "../notification/notification.controller";

class JoinRequestController {
  // student applies to a team
  public createRequest = async (
    req: Request<StringObject, MessageResponse, CreateJoinRequest>,
    res: Response<MessageResponse & { request: JoinRequestResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createJoinRequestSchema, req.body);

    const team = await prisma.team.findUnique({
      where: { id: payload.teamId },
    });
    if (!team) throw new AppError("Team not found.", 404);

    // check user is not already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: payload.teamId, userId: req.user.userId },
      },
    });
    if (existingMember)
      throw new AppError("You are already a member of this team.", 400);

    // check if there's a pending request
    const existingRequest = await prisma.joinRequest.findFirst({
      where: {
        teamId: payload.teamId,
        userId: req.user.userId,
        status: "PENDING",
      },
    });
    if (existingRequest)
      throw new AppError("You already have a pending join request.", 409);

    const request = await prisma.joinRequest.create({
      data: {
        teamId: payload.teamId,
        userId: req.user.userId,
        coverLetter: payload.coverLetter || null,
        status: "PENDING",
      },
    });

    const admins = await prisma.teamMember.findMany({
      where: {
        teamId: payload.teamId,
        role: "TEAM_ADMIN",
        status: "APPROVED",
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      await notificationController.createNotification({
        userId: admin.userId,
        type: "JOIN_REQUEST_RECEIVED",
        title: "New Join Request",
        content: `A new user has requested to join team ${team.name}.`,
        relatedEntityId: request.id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Join request submitted.",
      request,
    });
  };

  // team admins list requests for their team or admin lists across teams they manage
  public getRequests = async (
    req: Request<
      StringObject,
      JoinRequestsListResponse,
      StringObject,
      GetRequestsQuery
    >,
    res: Response<JoinRequestsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getRequestsQuerySchema, req.query);

    const where: any = {};
    if (query.teamId) where.teamId = query.teamId;
    if (query.status) where.status = query.status;

    // Non-system admins can only view requests for teams where they are team admins.
    if (req.user.role !== "SYSTEM_ADMIN") {
      if (query.teamId) {
        const admin = await prisma.teamMember.findFirst({
          where: {
            teamId: query.teamId,
            userId: req.user.userId,
            role: "TEAM_ADMIN",
          },
          select: { id: true },
        });

        if (!admin) {
          throw new AppError(
            "Not authorized to view requests for this team.",
            403,
          );
        }
      } else {
        const managedTeams = await prisma.teamMember.findMany({
          where: {
            userId: req.user.userId,
            role: "TEAM_ADMIN",
            status: "APPROVED",
          },
          select: { teamId: true },
        });

        const managedTeamIds = managedTeams.map((item) => item.teamId);
        where.teamId = {
          in: managedTeamIds.length ? managedTeamIds : [""],
        };
      }
    }

    const requests = await prisma.joinRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Join requests fetched.",
      results: requests.length,
      requests,
    });
  };

  // team admin accepts/rejects request
  public respondRequest = async (
    req: Request<IdParam, MessageResponse, RespondJoinRequest>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(respondJoinRequestSchema, req.body);

    const request = await prisma.joinRequest.findUnique({
      where: { id: params.id },
    });
    if (!request) throw new AppError("Join request not found.", 404);

    const team = await prisma.team.findUnique({
      where: { id: request.teamId },
    });
    if (!team) throw new AppError("Team not found.", 404);

    // ensure requester is team admin
    const admin = await prisma.teamMember.findFirst({
      where: { teamId: team.id, userId: req.user.userId, role: "TEAM_ADMIN" },
    });
    if (!admin && req.user.role !== "SYSTEM_ADMIN")
      throw new AppError("Only team admins can respond.", 403);

    if (request.status !== "PENDING")
      throw new AppError("Request already processed.", 409);

    if (payload.accept) {
      const [memberCount, existingMember] = await Promise.all([
        prisma.teamMember.count({ where: { teamId: team.id } }),
        prisma.teamMember.findUnique({
          where: {
            teamId_userId: { teamId: team.id, userId: request.userId },
          },
          select: { id: true },
        }),
      ]);

      if (existingMember) {
        throw new AppError("User is already a member of this team.", 409);
      }

      if (memberCount >= team.maxMembers) {
        throw new AppError("Team has reached maximum capacity.", 400);
      }

      // add member
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: request.userId,
          role: "MEMBER",
          status: "APPROVED",
        },
      });

      await prisma.joinRequest.update({
        where: { id: params.id },
        data: { status: "APPROVED", respondedAt: new Date() },
      });

      await notificationController.createNotification({
        userId: request.userId,
        type: "JOIN_REQUEST_ACCEPTED",
        title: "Join Request Approved",
        content: `Your request to join team ${team.name} was approved.`,
        relatedEntityId: team.id,
      });

      res.status(200).json({ success: true, message: "Request accepted." });
      return;
    }

    // reject
    await prisma.joinRequest.update({
      where: { id: params.id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    await notificationController.createNotification({
      userId: request.userId,
      type: "JOIN_REQUEST_REJECTED",
      title: "Join Request Rejected",
      content:
        payload.feedback ||
        `Your request to join team ${team.name} was rejected.`,
      relatedEntityId: team.id,
    });

    res.status(200).json({ success: true, message: "Request rejected." });
  };

  // withdraw request by requester
  public withdrawRequest = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const request = await prisma.joinRequest.findUnique({
      where: { id: params.id },
    });
    if (!request) throw new AppError("Join request not found.", 404);

    if (
      request.userId !== req.user.userId &&
      req.user.role !== "SYSTEM_ADMIN"
    ) {
      throw new AppError("You can only withdraw your own request.", 403);
    }

    if (request.status !== "PENDING")
      throw new AppError("Only pending requests can be withdrawn.", 409);

    await prisma.joinRequest.delete({ where: { id: params.id } });

    res.status(200).json({ success: true, message: "Join request withdrawn." });
  };
}

export const joinRequestController = new JoinRequestController();
