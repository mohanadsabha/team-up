import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  AddTeamMember,
  addTeamMemberSchema,
  CreateTeam,
  createTeamSchema,
  GetTeamMembersQuery,
  getTeamMembersQuerySchema,
  GetTeamsQuery,
  getTeamsQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  StringObject,
  TeamDetailsResponse,
  TeamMembersListResponse,
  TeamMemberResponse,
  TeamsListResponse,
  TeamResponse,
  UpdateTeam,
  updateTeamSchema,
  UpdateTeamMember,
  updateTeamMemberSchema,
  UserPreviewResponse,
} from "./team.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class TeamController {
  private assertTeamAdmin = async (
    teamId: string,
    userId: string,
    role: string,
  ) => {
    if (role === "SYSTEM_ADMIN") {
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mentorId: true, mentorApproved: true },
    });

    if (team?.mentorApproved && team.mentorId === userId) {
      return;
    }

    const adminMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      select: { role: true, status: true },
    });

    if (
      !adminMembership ||
      adminMembership.role !== "TEAM_ADMIN" ||
      adminMembership.status !== "APPROVED"
    ) {
      throw new AppError("Only team admins can perform this action.", 403);
    }
  };

  public getTeams = async (
    req: Request<StringObject, StringObject, StringObject, GetTeamsQuery>,
    res: Response<TeamsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getTeamsQuerySchema, req.query);

    const teams = await prisma.team.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                {
                  description: { contains: query.search, mode: "insensitive" },
                },
              ],
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.mentorId ? { mentorId: query.mentorId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
      },
      include: {
        members: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const teamResponses = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      projectId: team.projectId,
      mentorId: team.mentorId,
      status: team.status,
      maxMembers: team.maxMembers,
      memberCount: team.members.length,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: "Teams fetched successfully.",
      results: teamResponses.length,
      teams: teamResponses,
    });
  };

  public getTeamById = async (
    req: Request<IdParam>,
    res: Response<TeamDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                profilePictureUrl: true,
              },
            },
          },
        },
        mentor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const memberCount = await prisma.teamMember.count({
      where: { teamId: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Team fetched successfully.",
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        projectId: team.projectId,
        mentorId: team.mentorId,
        status: team.status,
        maxMembers: team.maxMembers,
        memberCount,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        members: team.members,
        mentor: team.mentor,
      },
    });
  };

  public createTeam = async (
    req: Request<StringObject, StringObject, CreateTeam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createTeamSchema, req.body);

    if (payload.projectId) {
      const project = await prisma.graduationProject.findUnique({
        where: { id: payload.projectId },
        select: { id: true },
      });

      if (!project) {
        throw new AppError("Project not found.", 404);
      }
    }

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name: payload.name,
          description: payload.description,
          projectId: payload.projectId,
          maxMembers: payload.maxMembers ?? 5,
          status: "DRAFT",
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: createdTeam.id,
          userId: req.user.userId,
          role: "TEAM_ADMIN",
          status: "APPROVED",
        },
      });

      return createdTeam;
    });

    res.status(201).json({
      success: true,
      message: "Team created successfully.",
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        projectId: team.projectId,
        mentorId: team.mentorId,
        status: team.status,
        maxMembers: team.maxMembers,
        memberCount: 1,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  };

  public updateTeam = async (
    req: Request<IdParam, StringObject, UpdateTeam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateTeamSchema, req.body);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    await this.assertTeamAdmin(params.id, req.user.userId, req.user.role);

    if (payload.projectId) {
      const project = await prisma.graduationProject.findUnique({
        where: { id: payload.projectId },
        select: { id: true },
      });

      if (!project) {
        throw new AppError("Project not found.", 404);
      }
    }

    if (
      payload.maxMembers !== undefined &&
      payload.maxMembers < team.members.length
    ) {
      throw new AppError(
        "Maximum members must be greater than the current member count.",
        400,
      );
    }

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.projectId !== undefined
          ? { projectId: payload.projectId }
          : {}),
        ...(payload.maxMembers ? { maxMembers: payload.maxMembers } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
    });
    res.status(200).json({
      success: true,
      message: "Team updated successfully.",
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        projectId: updatedTeam.projectId,
        mentorId: updatedTeam.mentorId,
        status: updatedTeam.status,
        maxMembers: updatedTeam.maxMembers,
        memberCount: team.members.length,
        createdAt: updatedTeam.createdAt,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  };

  public deleteTeam = async (
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

    await this.assertTeamAdmin(params.id, req.user.userId, req.user.role);

    // Delete cascade will handle members, tasks, milestones, chats
    await prisma.team.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Team deleted successfully.",
    });
  };

  public getTeamMembers = async (
    req: Request<IdParam, StringObject, StringObject, GetTeamMembersQuery>,
    res: Response<TeamMembersListResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const query = zodValidation(getTeamMembersQuerySchema, req.query);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const members = await prisma.teamMember.findMany({
      where: {
        teamId: params.id,
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Team members fetched successfully.",
      results: members.length,
      members,
    });
  };

  public addTeamMember = async (
    req: Request<IdParam, StringObject, AddTeamMember>,
    res: Response<
      MessageResponse & {
        member: TeamMemberResponse & { user: UserPreviewResponse };
      }
    >,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(addTeamMemberSchema, req.body);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    await this.assertTeamAdmin(params.id, req.user.userId, req.user.role);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.role === "MENTOR") {
      throw new AppError("User not found.", 404);
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: params.id, userId: payload.userId },
      },
    });

    if (existingMember) {
      throw new AppError("User is already a member of this team.", 409);
    }

    if (team.members.length >= team.maxMembers) {
      throw new AppError("Team has reached maximum capacity.", 400);
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: params.id,
        userId: payload.userId,
        role: payload.role,
        status: "APPROVED",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Member added to team successfully.",
      member,
    });
  };

  public updateTeamMember = async (
    req: Request<
      { teamId: string; memberId: string },
      StringObject,
      UpdateTeamMember
    >,
    res: Response<
      MessageResponse & {
        member: TeamMemberResponse & { user: UserPreviewResponse };
      }
    >,
    _next: NextFunction,
  ) => {
    const { teamId, memberId } = req.params;

    if (!teamId || !memberId) {
      throw new AppError("Team ID and Member ID are required.", 400);
    }

    const payload = zodValidation(updateTeamMemberSchema, req.body);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    await this.assertTeamAdmin(teamId, req.user.userId, req.user.role);

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: memberId },
      },
    });

    if (!member) {
      throw new AppError("Member not found in this team.", 404);
    }

    if (member.role === "TEAM_ADMIN" && payload.role !== "TEAM_ADMIN") {
      const adminCount = await prisma.teamMember.count({
        where: { teamId, role: "TEAM_ADMIN", status: "APPROVED" },
      });

      if (adminCount <= 1) {
        throw new AppError("A team must have at least one team admin.", 400);
      }
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId: memberId },
      },
      data: { role: payload.role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Member role updated successfully.",
      member: updatedMember,
    });
  };

  public removeTeamMember = async (
    req: Request<{ teamId: string; memberId: string }>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const { teamId, memberId } = req.params;

    if (!teamId || !memberId) {
      throw new AppError("Team ID and Member ID are required.", 400);
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: memberId },
      },
    });

    if (!member) {
      throw new AppError("Member not found in this team.", 404);
    }

    if (member.role === "TEAM_ADMIN") {
      const adminCount = await prisma.teamMember.count({
        where: { teamId, role: "TEAM_ADMIN", status: "APPROVED" },
      });

      if (adminCount <= 1) {
        throw new AppError("A team must have at least one team admin.", 400);
      }
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId: memberId },
      },
    });

    res.status(200).json({
      success: true,
      message: "Member removed from team successfully.",
    });
  };
}

export const teamController = new TeamController();
