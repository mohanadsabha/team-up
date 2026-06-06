import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const GAZA_UNIVERSITIES = [
  { name: "Islamic University of Gaza", code: "IUG", country: "Palestine" },
  { name: "Al-Azhar University - Gaza", code: "AUG", country: "Palestine" },
  { name: "Al-Aqsa University", code: "AAQ", country: "Palestine" },
  { name: "University College of Applied Sciences (UCAS)", code: "UCAS", country: "Palestine" },
  { name: "Gaza University", code: "GU", country: "Palestine" },
  { name: "Palestine Technical College - Deir al-Balah", code: "PTC", country: "Palestine" },
  { name: "Al-Quds Open University - Gaza Branch", code: "QOU", country: "Palestine" },
  { name: "Palestine University - Gaza", code: "PUG", country: "Palestine" },
  { name: "Israa University", code: "ISRA", country: "Palestine" },
  { name: "University of Palestine", code: "UOP", country: "Palestine" },
  { name: "American University of Gaza", code: "AUGZ", country: "Palestine" },
  { name: "University of Science and Technology - Gaza", code: "UST", country: "Palestine" },
] as const;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  for (const university of GAZA_UNIVERSITIES) {
    await prisma.university.upsert({
      where: { code: university.code },
      update: {
        name: university.name,
        country: university.country,
        isActive: true,
      },
      create: {
        name: university.name,
        code: university.code,
        country: university.country,
        isActive: true,
      },
    });
  }

  const count = await prisma.university.count({
    where: { country: "Palestine", isActive: true },
  });

  console.log(`Seeded Gaza universities successfully (${count} active in Palestine).`);
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
