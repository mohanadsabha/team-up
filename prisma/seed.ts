import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  GAZA_UNIVERSITIES,
  SEED_PASSWORD,
  SEED_USERS,
  type SeedUserSpec,
} from "./seed-data";

const shouldReset = process.argv.includes("--reset");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const wipeDatabase = async () => {
  console.log("Wiping existing application data...");

  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.joinRequest.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.projectSave.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.projectDetail.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationUserSetting.deleteMany();
  await prisma.graduationProject.deleteMany();
  await prisma.academicProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.college.deleteMany();
  await prisma.university.deleteMany();
  await prisma.platformSettings.deleteMany();

  console.log("Database wiped.");
};

const seedUniversities = async () => {
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

  await prisma.university.updateMany({
    where: { code: { notIn: GAZA_UNIVERSITIES.map((university) => university.code) } },
    data: { isActive: false },
  });

  const alAzhar = await prisma.university.findUniqueOrThrow({ where: { code: "AUG" } });

  const college = await prisma.college.upsert({
    where: {
      universityId_code: {
        universityId: alAzhar.id,
        code: "FIT",
      },
    },
    update: {
      name: "Faculty of Information Technology",
    },
    create: {
      name: "Faculty of Information Technology",
      code: "FIT",
      universityId: alAzhar.id,
    },
  });

  const department = await prisma.department.upsert({
    where: {
      collegeId_code: {
        collegeId: college.id,
        code: "CS",
      },
    },
    update: {
      name: "Computer Science",
    },
    create: {
      name: "Computer Science",
      code: "CS",
      collegeId: college.id,
    },
  });

  return { university: alAzhar, college, department };
};

const createSeedUser = async (
  spec: SeedUserSpec,
  passwordHash: string,
  universityId: string,
  collegeId: string,
  departmentId: string,
) => {
  const user = await prisma.user.create({
    data: {
      email: spec.email,
      username: spec.username,
      passwordHash,
      firstName: spec.firstName,
      lastName: spec.lastName,
      role: spec.role,
      registrationMethod: "EMAIL",
      isActive: true,
      isVerified: true,
      emailVerifiedAt: new Date(),
      universityId,
      collegeId,
      departmentId,
      bio: spec.bio,
      academicProfile: {
        create: {
          major: spec.major,
          skills: spec.skills,
          graduationYear: spec.role === "GRADUATE" ? 2024 : 2026,
        },
      },
      notificationSettings: {
        create: {},
      },
    },
  });

  return user;
};

const seedPlatformSettings = async () => {
  await prisma.platformSettings.create({
    data: {
      platformName: "TeamUp",
      requireUserApproval: false,
      autoActivateUsers: true,
      allowPaidIdeas: true,
      requireIdeaApproval: false,
      requireTeamApproval: false,
      isLive: true,
      maintenanceMode: false,
    },
  });
};

const main = async () => {
  if (shouldReset) {
    await wipeDatabase();
  }

  const { university, college, department } = await seedUniversities();
  const passwordHash = await hash(SEED_PASSWORD, 12);

  const users = new Map<string, { id: string; email: string; role: string }>();

  for (const spec of SEED_USERS) {
    const user = await createSeedUser(
      spec,
      passwordHash,
      university.id,
      college.id,
      department.id,
    );
    users.set(spec.key, { id: user.id, email: user.email, role: user.role });
  }

  await seedPlatformSettings();

  const mentorSara = users.get("mentor_sara")!;
  const mentorOmar = users.get("mentor_omar")!;
  const ahmad = users.get("student_ahmad")!;
  const maya = users.get("student_maya")!;
  const karim = users.get("student_karim")!;
  const nour = users.get("student_nour")!;
  const tarek = users.get("student_tarek")!;
  const hana = users.get("student_hana")!;
  const sami = users.get("student_sami")!;
  const laila = users.get("student_laila")!;
  const fadi = users.get("student_fadi")!;
  const monira = users.get("graduate_monira")!;
  const dina = users.get("student_dina")!;
  const yousef = users.get("student_yousef")!;

  // Team 1 — active smart campus project
  const campusProject = await prisma.graduationProject.create({
    data: {
      title: "Smart Campus Navigation",
      summary:
        "Mobile and web platform helping university students find classrooms, labs, and events on campus.",
      description:
        "A full-stack graduation project with maps, schedules, and push notifications for campus life.",
      status: "DRAFT",
      ideaType: "FREE",
      createdById: ahmad.id,
      universityId: university.id,
      technologies: ["React", "Node.js", "PostgreSQL", "Mapbox"],
      requiredSkills: ["React", "TypeScript", "UI Design"],
      isPublished: true,
      isApproved: true,
      details: {
        create: {
          detailedDescription:
            "Students struggle to locate rooms during their first semesters. This app centralizes navigation and announcements.",
          deliverables: ["Mobile app", "Admin dashboard", "Documentation"],
        },
      },
    },
  });

  const campusTeam = await prisma.team.create({
    data: {
      name: "Smart Campus Navigation",
      description: "Building the campus navigation experience for IUG students.",
      projectId: campusProject.id,
      mentorId: mentorSara.id,
      mentorApproved: true,
      status: "DRAFT",
      maxMembers: 5,
      members: {
        create: [
          { userId: ahmad.id, role: "TEAM_ADMIN", status: "APPROVED" },
          { userId: maya.id, role: "MEMBER", status: "APPROVED" },
          { userId: karim.id, role: "MEMBER", status: "APPROVED" },
          { userId: nour.id, role: "MEMBER", status: "APPROVED" },
        ],
      },
    },
  });

  const campusMilestone = await prisma.milestone.create({
    data: {
      teamId: campusTeam.id,
      projectId: campusProject.id,
      title: "MVP Release",
      description: "Deliver map view, search, and basic notifications.",
      status: "PENDING",
      dueDate: daysFromNow(21),
    },
  });

  await prisma.task.createMany({
    data: [
      {
        teamId: campusTeam.id,
        milestoneId: campusMilestone.id,
        title: "Design campus map UI",
        description: "Create responsive screens for map and search.",
        status: "IN_PROGRESS",
        assignedTo: maya.id,
        dueDate: daysFromNow(5),
      },
      {
        teamId: campusTeam.id,
        milestoneId: campusMilestone.id,
        title: "Build room search API",
        description: "Express endpoints for buildings and rooms.",
        status: "TODO",
        assignedTo: karim.id,
        dueDate: daysFromNow(8),
      },
      {
        teamId: campusTeam.id,
        title: "Write test plan",
        description: "QA checklist for navigation flows.",
        status: "TODO",
        assignedTo: nour.id,
        dueDate: daysFromNow(10),
      },
    ],
  });

  const campusChat = await prisma.chat.create({
    data: { teamId: campusTeam.id, type: "TEAM" },
  });

  await prisma.message.createMany({
    data: [
      {
        chatId: campusChat.id,
        senderId: ahmad.id,
        content: "Welcome everyone! Let's finalize the MVP scope this week.",
      },
      {
        chatId: campusChat.id,
        senderId: maya.id,
        content: "I uploaded the first map wireframes in our shared folder.",
      },
      {
        chatId: campusChat.id,
        senderId: mentorSara.id,
        content: "Great start. Please add acceptance criteria for each task.",
      },
    ],
  });

  await prisma.meeting.create({
    data: {
      teamId: campusTeam.id,
      createdById: ahmad.id,
      title: "Weekly Sprint Sync",
      description: "Review progress and blockers.",
      meetingUrl: "https://meet.google.com/teamup-campus-sync",
      status: "SCHEDULED",
      startAt: daysFromNow(2),
      endAt: daysFromNow(2),
    },
  });

  // Team 2 — published telemedicine team recruiting members
  const teleProject = await prisma.graduationProject.create({
    data: {
      title: "Telemedicine for Gaza Clinics",
      summary:
        "Remote consultation platform connecting patients with doctors during emergencies.",
      description:
        "Secure video visits, prescription notes, and clinic scheduling for underserved areas.",
      status: "PUBLISHED",
      ideaType: "FREE",
      createdById: tarek.id,
      universityId: university.id,
      technologies: ["React Native", "Node.js", "WebRTC"],
      requiredSkills: ["Mobile", "Healthcare", "APIs"],
      isPublished: true,
      isApproved: true,
    },
  });

  const teleTeam = await prisma.team.create({
    data: {
      name: "Telemedicine for Gaza Clinics",
      description: "Recruiting backend and mobile developers.",
      projectId: teleProject.id,
      mentorId: mentorOmar.id,
      mentorApproved: true,
      status: "PUBLISHED",
      maxMembers: 6,
      members: {
        create: [
          { userId: tarek.id, role: "TEAM_ADMIN", status: "APPROVED" },
          { userId: hana.id, role: "MEMBER", status: "APPROVED" },
        ],
      },
    },
  });

  await prisma.chat.create({ data: { teamId: teleTeam.id, type: "TEAM" } });

  const pendingJoin = await prisma.joinRequest.create({
    data: {
      teamId: teleTeam.id,
      userId: sami.id,
      coverLetter:
        "Preferred role: Backend Developer\n\nSkills: Networking, Security, Linux\n\nI have experience building secure APIs.",
      status: "PENDING",
    },
  });

  await prisma.chat.create({
    data: {
      teamId: teleTeam.id,
      type: "JOIN_REQUEST",
      joinRequestId: pendingJoin.id,
    },
  });

  // Team 3 — submitted AI tutoring project
  const aiProject = await prisma.graduationProject.create({
    data: {
      title: "AI Tutoring Assistant",
      summary: "Personalized study companion for computer science courses.",
      description: "NLP-powered hints, quiz generation, and progress tracking.",
      status: "SUBMITTED",
      ideaType: "FREE",
      createdById: laila.id,
      universityId: university.id,
      technologies: ["Python", "FastAPI", "React", "OpenAI"],
      requiredSkills: ["Python", "Machine Learning"],
      isPublished: false,
      isApproved: true,
    },
  });

  const aiTeam = await prisma.team.create({
    data: {
      name: "AI Tutoring Assistant",
      projectId: aiProject.id,
      mentorId: mentorSara.id,
      mentorApproved: true,
      status: "SUBMITTED",
      maxMembers: 4,
      members: {
        create: [
          { userId: laila.id, role: "TEAM_ADMIN", status: "APPROVED" },
          { userId: fadi.id, role: "MEMBER", status: "APPROVED" },
        ],
      },
    },
  });

  await prisma.chat.create({ data: { teamId: aiTeam.id, type: "TEAM" } });

  // Marketplace project ideas
  const freeIdea = await prisma.graduationProject.create({
    data: {
      title: "Solar Water Purifier Monitor",
      summary: "IoT dashboard for community water purification units.",
      status: "PUBLISHED",
      ideaType: "FREE",
      createdById: monira.id,
      universityId: university.id,
      technologies: ["Arduino", "React", "MQTT"],
      requiredSkills: ["IoT", "Embedded Systems"],
      isPublished: true,
      isApproved: true,
    },
  });

  const paidIdea = await prisma.graduationProject.create({
    data: {
      title: "Local Marketplace for Artisans",
      summary: "E-commerce platform for Gaza artisans to sell handmade goods.",
      status: "PUBLISHED",
      ideaType: "PAID",
      price: 15,
      createdById: monira.id,
      universityId: university.id,
      technologies: ["Next.js", "Stripe", "PostgreSQL"],
      requiredSkills: ["Full-stack", "Payments"],
      isPublished: true,
      isApproved: true,
      files: {
        create: {
          fileName: "marketplace-brief.pdf",
          fileUrl: "https://res.cloudinary.com/demo/file/upload/sample.pdf",
          fileType: "application/pdf",
          uploadedBy: monira.id,
        },
      },
    },
  });

  await prisma.projectSave.create({
    data: {
      userId: dina.id,
      projectId: freeIdea.id,
    },
  });

  await prisma.graduationProject.update({
    where: { id: freeIdea.id },
    data: { savesCount: 1 },
  });

  const haitham = users.get("graduate_haitham")!;
  const mentorLina = users.get("mentor_lina")!;

  const freeIdeaTeam = await prisma.team.create({
    data: {
      name: "Solar Water Purifier Monitor",
      description: "Recruiting IoT and embedded systems students.",
      projectId: freeIdea.id,
      mentorId: mentorLina.id,
      mentorApproved: true,
      status: "PUBLISHED",
      maxMembers: 5,
      members: {
        create: [
          { userId: monira.id, role: "TEAM_ADMIN", status: "APPROVED" },
          { userId: haitham.id, role: "MEMBER", status: "APPROVED" },
        ],
      },
    },
  });

  await prisma.chat.create({ data: { teamId: freeIdeaTeam.id, type: "TEAM" } });

  const paidIdeaTeam = await prisma.team.create({
    data: {
      name: "Local Marketplace for Artisans",
      description: "Looking for full-stack developers to build the artisan marketplace.",
      projectId: paidIdea.id,
      mentorId: mentorLina.id,
      mentorApproved: true,
      status: "PUBLISHED",
      maxMembers: 6,
      members: {
        create: [{ userId: monira.id, role: "TEAM_ADMIN", status: "APPROVED" }],
      },
    },
  });

  await prisma.chat.create({ data: { teamId: paidIdeaTeam.id, type: "TEAM" } });

  // Campus project is an active workspace — not open for public joining.
  await prisma.graduationProject.update({
    where: { id: campusProject.id },
    data: { isPublished: false },
  });

  await prisma.team.update({
    where: { id: campusTeam.id },
    data: { status: "DRAFT" },
  });

  // Complaint for admin reports section
  await prisma.complaint.create({
    data: {
      reporterId: yousef.id,
      targetProjectId: teleProject.id,
      title: "Inappropriate project description",
      description:
        "The project listing needs clearer medical compliance notes before more students join.",
      status: "SUBMITTED",
    },
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: tarek.id,
        type: "JOIN_REQUEST_RECEIVED",
        title: "New join request",
        content: "Sami Jawad requested to join Telemedicine for Gaza Clinics.",
        relatedEntityId: pendingJoin.id,
      },
      {
        userId: sami.id,
        type: "JOIN_REQUEST_RECEIVED",
        title: "Join request sent",
        content: "Your request to join Telemedicine for Gaza Clinics is pending.",
        relatedEntityId: pendingJoin.id,
      },
      {
        userId: mentorSara.id,
        type: "MILESTONE_STATUS_CHANGED",
        title: "Project submitted for review",
        content: 'Team "AI Tutoring Assistant" submitted their project for your review.',
        relatedEntityId: aiProject.id,
      },
    ],
  });

  console.log("\n========================================");
  console.log(" TeamUp demo data seeded successfully ");
  console.log("========================================\n");
  console.log(`Shared password for ALL accounts: ${SEED_PASSWORD}\n`);
  console.log("ACCOUNTS (20 users):\n");

  for (const spec of SEED_USERS) {
    console.log(
      `- ${spec.firstName} ${spec.lastName} (${spec.role})`,
    );
    console.log(`  Email: ${spec.email}`);
    console.log(`  Username: ${spec.username}`);
    console.log("");
  }

  console.log("STUDENT SCENARIOS (password: TeamUp2026!):");
  console.log("- student.ahmad / maya / karim / nour → active Smart Campus team (dashboard with workspace)");
  console.log("- student.tarek / hana → Telemedicine team lead & member (published, recruiting)");
  console.log("- student.laila / fadi → AI Tutoring team (SUBMITTED project, read-only workspace)");
  console.log("- student.sami → no team, pending join request to Telemedicine");
  console.log("- student.yousef / dina / reem → no team, can browse Find a Team and join");
  console.log("- graduate.monira → published free + paid ideas with recruiting teams");
  console.log("- admin@teamup.test → system admin dashboard");
  console.log("- mentor.sara / omar / lina → mentor dashboards with supervised teams");
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
