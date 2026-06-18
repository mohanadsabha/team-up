import { prisma } from "../config/prisma";
import AppError from "./appError";

export const canAccessTeamWorkspace = async (
  teamId: string,
  userId: string,
  role: string,
) => {
  if (role === "SYSTEM_ADMIN") {
    return true;
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { mentorId: true, mentorApproved: true },
  });

  if (!team) {
    return false;
  }

  if (team.mentorId === userId && team.mentorApproved) {
    return true;
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { status: true },
  });

  return membership?.status === "APPROVED";
};

export const assertTeamWorkspaceAccess = async (
  teamId: string,
  userId: string,
  role: string,
) => {
  const allowed = await canAccessTeamWorkspace(teamId, userId, role);

  if (!allowed) {
    throw new AppError("You are not a member of this team.", 403);
  }
};

export const canAccessTeamChat = async (
  teamId: string,
  userId: string,
  role: string,
  joinRequestUserId?: string | null,
) => {
  if (role === "SYSTEM_ADMIN") {
    return true;
  }

  if (joinRequestUserId && joinRequestUserId === userId) {
    return true;
  }

  return canAccessTeamWorkspace(teamId, userId, role);
};

export const assertTeamChatAccess = async (
  teamId: string,
  userId: string,
  role: string,
  joinRequestUserId?: string | null,
) => {
  const allowed = await canAccessTeamChat(teamId, userId, role, joinRequestUserId);

  if (!allowed) {
    throw new AppError(
      "You are not a member of this team or participant in this chat.",
      403,
    );
  }
};
