import "dotenv/config";
import { prisma } from "../src/config/prisma";

const emails = process.argv.slice(2).map((email) => email.trim().toLowerCase());

if (!emails.length) {
  console.error("Usage: npx tsx scripts/delete-users-by-email.ts <email> [email...]");
  process.exit(1);
}

async function deleteUserProjects(userId: string) {
  const projects = await prisma.graduationProject.findMany({
    where: { createdById: userId },
    select: { id: true },
  });

  for (const project of projects) {
    const team = await prisma.team.findFirst({
      where: { projectId: project.id },
      select: { id: true },
    });

    if (team) {
      await prisma.message.deleteMany({ where: { chat: { teamId: team.id } } });
      await prisma.chat.deleteMany({ where: { teamId: team.id } });
      await prisma.meeting.deleteMany({ where: { teamId: team.id } });
      await prisma.task.deleteMany({ where: { teamId: team.id } });
      await prisma.milestone.deleteMany({ where: { teamId: team.id } });
      await prisma.joinRequest.deleteMany({ where: { teamId: team.id } });
      await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
      await prisma.team.deleteMany({ where: { id: team.id } });
    }

    await prisma.projectSave.deleteMany({ where: { projectId: project.id } });
    await prisma.payment.deleteMany({ where: { projectId: project.id } });
    await prisma.complaint.updateMany({
      where: { targetProjectId: project.id },
      data: { targetProjectId: null },
    });
    await prisma.projectFile.deleteMany({ where: { projectId: project.id } });
    await prisma.projectDetail.deleteMany({ where: { projectId: project.id } });
    await prisma.graduationProject.delete({ where: { id: project.id } });
  }
}

async function hardDeleteUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, deletedAt: true },
  });

  if (!user) {
    console.log(`NOT FOUND: ${email}`);
    return;
  }

  const userId = user.id;

  await prisma.teamMember.deleteMany({ where: { userId } });
  await prisma.joinRequest.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.notificationUserSetting.deleteMany({ where: { userId } });
  await prisma.projectSave.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { buyerId: userId } });
  await prisma.message.deleteMany({ where: { senderId: userId } });
  await prisma.meeting.deleteMany({ where: { createdById: userId } });

  await prisma.task.updateMany({
    where: { assignedTo: userId },
    data: { assignedTo: null },
  });

  await prisma.milestone.updateMany({
    where: { reviewedBy: userId },
    data: { reviewedBy: null },
  });

  await prisma.complaint.deleteMany({
    where: {
      OR: [{ reporterId: userId }, { targetUserId: userId }],
    },
  });

  await prisma.complaint.updateMany({
    where: { resolvedBy: userId },
    data: { resolvedBy: null },
  });

  await prisma.team.updateMany({
    where: { mentorId: userId },
    data: { mentorId: null },
  });

  await deleteUserProjects(userId);

  await prisma.academicProfile.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  console.log(
    `DELETED: ${user.email} (${user.username})${user.deletedAt ? " [was soft-deleted]" : ""}`,
  );
}

async function main() {
  for (const email of emails) {
    try {
      await hardDeleteUserByEmail(email);
    } catch (error) {
      console.error(`FAILED: ${email}`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
