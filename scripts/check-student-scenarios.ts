import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_USERS } from "../prisma/seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const students = SEED_USERS.filter((user) => user.role === "STUDENT");

const main = async () => {
  console.log("\nStudent scenario check\n");

  for (const spec of students) {
    const user = await prisma.user.findUnique({
      where: { email: spec.email },
      select: { id: true, email: true },
    });

    if (!user) {
      console.log(`${spec.key.padEnd(16)} | USER NOT FOUND`);
      continue;
    }

    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            project: { select: { title: true, status: true, isPublished: true } },
          },
        },
      },
    });

    const joins = await prisma.joinRequest.findMany({
      where: { userId: user.id },
      include: { team: { select: { name: true } } },
    });

    const teams =
      memberships
        .map(
          (membership) =>
            `${membership.team.name} [${membership.role}/${membership.status}, team:${membership.team.status}, project:${membership.team.project?.status ?? "none"}]`,
        )
        .join("; ") || "NO TEAM";

    const pendingJoins =
      joins
        .filter((join) => join.status === "PENDING")
        .map((join) => join.team.name)
        .join(", ") || "none";

    console.log(`${spec.key.padEnd(16)} | ${teams}`);
    console.log(`${"".padEnd(16)} | pending joins: ${pendingJoins}`);
    console.log(`${"".padEnd(16)} | bio: ${spec.bio}`);
    console.log("");
  }
};

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
