import { prisma } from "../config/prisma";
import AppError from "./appError";

export const isWorkspaceStillActive = (
  teamStatus: string,
  projectId: string | null,
  projectStatus: string | null | undefined,
) => {
  if (!projectId || !projectStatus) {
    return false;
  }

  if (teamStatus === "COMPLETED") {
    return false;
  }

  return projectStatus !== "SUBMITTED" && projectStatus !== "COMPLETED";
};

export const getActiveMemberTeamForUser = async (userId: string) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: "APPROVED" },
    include: {
      team: {
        include: {
          project: { select: { id: true, status: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  for (const membership of memberships) {
    const { team } = membership;

    if (!team.projectId || !team.project) {
      continue;
    }

    if (
      isWorkspaceStillActive(team.status, team.projectId, team.project.status)
    ) {
      return team;
    }
  }

  return null;
};

export const assertCanJoinNewWorkspace = async (
  userId: string,
  userRole: string,
) => {
  if (userRole === "MENTOR" || userRole === "SYSTEM_ADMIN") {
    return;
  }

  const activeTeam = await getActiveMemberTeamForUser(userId);

  if (activeTeam) {
    throw new AppError(
      "You already have an active project workspace. Submit your current project before joining or creating another team.",
      409,
    );
  }
};
