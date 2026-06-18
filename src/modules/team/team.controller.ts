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
  RejectTeam,
  rejectTeamSchema,
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
import { assertCanJoinNewWorkspace } from "../../utils/activeWorkspace.util";
import { notificationController } from "../notification/notification.controller";

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
    const isAdmin = req.user?.role === "SYSTEM_ADMIN";
    const userId = req.user.userId;

    const teams = await prisma.team.findMany({
      where: {
        ...(query.mine
          ? {
              OR: [
                {
                  members: {
                    some: {
                      userId,
                      status: "APPROVED",
                    },
                  },
                },
                { mentorId: userId },
              ],
            }
          : {}),
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
        ...(query.universityId
          ? {
              members: {
                some: {
                  user: { universityId: query.universityId },
                  role: "TEAM_ADMIN",
                  status: "APPROVED",
                },
              },
            }
          : {}),
        ...(query.collegeId
          ? {
              members: {
                some: {
                  user: { collegeId: query.collegeId },
                  role: "TEAM_ADMIN",
                  status: "APPROVED",
                },
              },
            }
          : {}),
        ...(query.departmentId
          ? {
              members: {
                some: {
                  user: { departmentId: query.departmentId },
                  role: "TEAM_ADMIN",
                  status: "APPROVED",
                },
              },
            }
          : {}),
      },
      include: {
        project: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            members: {
              where: { status: "APPROVED" },
            },
          },
        },
        ...(isAdmin
          ? {
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
              members: {
                take: 5,
                where: { status: "APPROVED" },
                orderBy: { joinedAt: "asc" },
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
            }
          : {}),
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
      previousStatus: team.previousStatus ?? null,
      moderationState: team.moderationState ?? null,
      maxMembers: team.maxMembers,
      memberCount: team._count.members,
      projectStatus: team.project?.status ?? null,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      ...(isAdmin
        ? {
            mentor: team.mentor ?? null,
            memberPreviews: team.members
              .map((member) => member.user)
              .filter((user): user is NonNullable<typeof user> => Boolean(user))
              .map((user) => ({
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                profilePictureUrl: user.profilePictureUrl,
              })),
          }
        : {}),
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

    // Ensure team university/college/department match the creating user's values
    const creator = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { universityId: true, collegeId: true, departmentId: true, role: true },
    });

    if (!creator) {
      throw new AppError("Creating user not found.", 404);
    }

    await assertCanJoinNewWorkspace(req.user.userId, creator.role ?? req.user.role);

    if (payload.universityId && payload.universityId !== creator.universityId) {
      throw new AppError("Team university must match your university.", 400);
    }
    if (payload.collegeId && payload.collegeId !== creator.collegeId) {
      throw new AppError("Team college must match your college.", 400);
    }
    if (payload.departmentId && payload.departmentId !== creator.departmentId) {
      throw new AppError("Team department must match your department.", 400);
    }
    const settings = await prisma.platformSettings.findFirst();

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name: payload.name,
          description: payload.description,
          projectId: payload.projectId,
          maxMembers: payload.maxMembers ?? 5,
          status: settings.requireTeamApproval ? "DRAFT" : "PUBLISHED",
          // Team is implicitly linked to creator's uni/college/department via membership
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
      select: { id: true, role: true, deletedAt: true, removalStrikes: true },
    });

    if (!user || user.deletedAt || user.role === "MENTOR") {
      throw new AppError("User not found.", 404);
    }

    if (user.removalStrikes >= 3) {
      throw new AppError("User is blocked from joining teams.", 403);
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
            notificationSettings: {
              select: {
                teamStatusChanges: true,
              },
            },
          },
        },
      },
    });

    if (member.user.notificationSettings.teamStatusChanges) {
      await notificationController.createNotification({
        userId: member.userId,
        type: "TEAM_MEMBER_ADDED",
        title: "Added to Team",
        content: `You were added to team "${team.name}".`,
        relatedEntityId: params.id,
      });
    }

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
      select: { id: true, name: true },
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
            notificationSettings: {
              select: {
                teamStatusChanges: true,
              },
            },
          },
        },
      },
    });

    if (updatedMember.user.notificationSettings.teamStatusChanges) {
      await notificationController.createNotification({
        userId: updatedMember.userId,
        type: "TEAM_MEMBER_UPDATED",
        title: "Team Role Updated",
        content: `Your role in team "${team.name}" was updated to ${updatedMember.role}.`,
        relatedEntityId: teamId,
      });
    }

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
      select: { id: true, name: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const isSelf = memberId === req.user.userId;
    if (!isSelf) {
      await this.assertTeamAdmin(teamId, req.user.userId, req.user.role);
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

    // Increment user's global removal strikes. After 3 strikes user is blocked from joining teams.
    await prisma.user.update({
      where: { id: memberId },
      data: { removalStrikes: { increment: 1 } },
    });

    const teamNotify = await prisma.notificationUserSetting.findFirst({
      where: { userId: member.userId },
      select: { teamStatusChanges: true },
    });
    if (teamNotify.teamStatusChanges) {
      await notificationController.createNotification({
        userId: member.userId,
        type: "TEAM_MEMBER_REMOVED",
        title: "Removed from Team",
        content: `You were removed from team "${team.name}".`,
        relatedEntityId: teamId,
      });
    }

    res.status(200).json({
      success: true,
      message: "Member removed from team successfully.",
    });
  };

  public approveTeam = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        status: "PUBLISHED",
        previousStatus: null,
        moderationState: null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Team approved successfully.",
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        projectId: updatedTeam.projectId,
        mentorId: updatedTeam.mentorId,
        status: updatedTeam.status,
        previousStatus: updatedTeam.previousStatus,
        moderationState: updatedTeam.moderationState,
        maxMembers: updatedTeam.maxMembers,
        memberCount: team.members.length,
        createdAt: updatedTeam.createdAt,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  };

  public rejectTeam = async (
    req: Request<IdParam, StringObject, RejectTeam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(rejectTeamSchema, req.body ?? {});

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true, userId: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        previousStatus: team.status,
        status: "DRAFT",
        moderationState: "REJECTED",
      },
    });

    res.status(200).json({
      success: true,
      message: payload.reason?.trim()
        ? `Team rejected successfully. Reason: ${payload.reason.trim()}`
        : "Team rejected successfully.",
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        projectId: updatedTeam.projectId,
        mentorId: updatedTeam.mentorId,
        status: updatedTeam.status,
        previousStatus: updatedTeam.previousStatus,
        moderationState: updatedTeam.moderationState,
        maxMembers: updatedTeam.maxMembers,
        memberCount: team.members.length,
        createdAt: updatedTeam.createdAt,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  };

  public disableTeam = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        previousStatus: team.status,
        status: "DRAFT",
        moderationState: "DISABLED",
      },
    });

    res.status(200).json({
      success: true,
      message: "Team disabled successfully.",
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        projectId: updatedTeam.projectId,
        mentorId: updatedTeam.mentorId,
        status: updatedTeam.status,
        previousStatus: updatedTeam.previousStatus,
        moderationState: updatedTeam.moderationState,
        maxMembers: updatedTeam.maxMembers,
        memberCount: team.members.length,
        createdAt: updatedTeam.createdAt,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  };

  public enableTeam = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { team: TeamResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: { members: { select: { id: true } } },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    const restoredStatus = team.previousStatus ?? "PUBLISHED";

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        status: restoredStatus,
        previousStatus: null,
        moderationState: null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Team enabled successfully.",
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        projectId: updatedTeam.projectId,
        mentorId: updatedTeam.mentorId,
        status: updatedTeam.status,
        previousStatus: updatedTeam.previousStatus,
        moderationState: updatedTeam.moderationState,
        maxMembers: updatedTeam.maxMembers,
        memberCount: team.members.length,
        createdAt: updatedTeam.createdAt,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  };
}

export const teamController = new TeamController();
