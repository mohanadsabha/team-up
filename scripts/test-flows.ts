import "dotenv/config";
import axios, { type AxiosInstance } from "axios";
import { SEED_PASSWORD, SEED_USERS } from "../prisma/seed-data";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.TEST_API_BASE_URL ??
  "http://localhost:3001/api/v1";

type TestResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const results: TestResult[] = [];

const record = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const login = async (client: AxiosInstance, email: string) => {
  const { data } = await client.post("/auth/login", {
    email,
    password: SEED_PASSWORD,
  });

  return data.token as string;
};

const authed = (token: string) =>
  axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

const run = async () => {
  console.log(`\nRunning flow tests against ${API_BASE_URL}\n`);

  const publicClient = axios.create({
    baseURL: API_BASE_URL,
    validateStatus: () => true,
  });

  // Auth — all roles
  for (const user of SEED_USERS) {
    try {
      const token = await login(publicClient, user.email);
      record(`Login: ${user.email}`, Boolean(token));
    } catch (error) {
      record(
        `Login: ${user.email}`,
        false,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  const studentToken = await login(publicClient, "student.ahmad@teamup.test");
  const studentClient = authed(studentToken);

  const me = await studentClient.get("/users/me");
  record("Student profile loads", me.status === 200, `status ${me.status}`);

  const teams = await studentClient.get("/teams?mine=true");
  const teamCount = teams.data?.teams?.length ?? 0;
  record(
    "Ahmad has active workspace team",
    teams.status === 200 && teamCount >= 1,
    `${teamCount} team(s)`,
  );

  const campusTeam = teams.data?.teams?.find(
    (team: { name?: string }) => team.name === "Smart Campus Navigation",
  );

  const project = campusTeam?.projectId
    ? await studentClient.get(`/projects/${campusTeam.projectId}`)
    : null;
  record(
    "Campus project loads",
    project?.status === 200,
    project?.data?.project?.title ?? "missing",
  );

  const tasks = campusTeam
    ? await studentClient.get("/tasks", { params: { teamId: campusTeam.id } })
    : null;
  record(
    "Workspace tasks load",
    tasks?.status === 200 && (tasks.data?.tasks?.length ?? 0) > 0,
    `${tasks?.data?.tasks?.length ?? 0} tasks`,
  );

  const chats = campusTeam
    ? await studentClient.get(`/chats/team/${campusTeam.id}`)
    : null;
  const teamChat = chats?.data?.chats?.find(
    (chat: { type: string }) => chat.type === "TEAM",
  );
  record("Team chat exists", Boolean(teamChat), teamChat?.id ?? "none");

  const freeStudentToken = await login(publicClient, "student.yousef@teamup.test");
  const freeStudentClient = authed(freeStudentToken);
  const freeTeams = await freeStudentClient.get("/teams?mine=true");
  const freeTeamCount = freeTeams.data?.teams?.length ?? 0;
  record(
    "Yousef has no active workspace team",
    freeTeams.status === 200 && freeTeamCount === 0,
    `${freeTeamCount} team(s)`,
  );

  const allTeams = await freeStudentClient.get("/teams");
  const teleTeam = allTeams.data?.teams?.find((team: { name?: string }) =>
    team.name?.includes("Telemedicine"),
  );
  record("Telemedicine team is discoverable", Boolean(teleTeam), teleTeam?.name);

  if (teleTeam) {
    const joinAttempt = await freeStudentClient.post("/join-requests", {
      teamId: teleTeam.id,
      coverLetter: "Automated flow test join request.",
    });
    record(
      "Yousef can request to join telemedicine team",
      joinAttempt.status === 201 || joinAttempt.status === 200,
      joinAttempt.data?.message ?? `status ${joinAttempt.status}`,
    );
  } else {
    record("Yousef can request to join telemedicine team", false, "team not found");
  }

  const tarekToken = await login(publicClient, "student.tarek@teamup.test");
  const tarekClient = authed(tarekToken);
  const joinRequests = teleTeam
    ? await tarekClient.get("/join-requests", { params: { teamId: teleTeam.id } })
    : await tarekClient.get("/join-requests");
  record(
    "Team admin sees join requests",
    joinRequests.status === 200,
    `${joinRequests.data?.requests?.length ?? 0} request(s)`,
  );

  const lailaToken = await login(publicClient, "student.laila@teamup.test");
  const lailaClient = authed(lailaToken);
  const lailaTeams = await lailaClient.get("/teams?mine=true");
  const submittedTeam = lailaTeams.data?.teams?.find(
    (team: { projectStatus?: string }) => team.projectStatus === "SUBMITTED",
  );
  record(
    "Laila submitted project workspace is viewable",
    Boolean(submittedTeam),
    submittedTeam?.name,
  );

  const mentorToken = await login(publicClient, "mentor.sara@teamup.test");
  const mentorClient = authed(mentorToken);
  const mentorTeams = await mentorClient.get("/teams?mine=true");
  record(
    "Mentor Sara supervises multiple teams",
    mentorTeams.status === 200 && (mentorTeams.data?.teams?.length ?? 0) >= 2,
    `${mentorTeams.data?.teams?.length ?? 0} team(s)`,
  );

  const ideas = await studentClient.get("/projects", {
    params: { isPublished: true },
  });
  record(
    "Published project ideas list",
    ideas.status === 200 && (ideas.data?.projects?.length ?? 0) >= 2,
    `${ideas.data?.projects?.length ?? 0} ideas`,
  );

  const adminToken = await login(publicClient, "admin@teamup.test");
  const adminClient = authed(adminToken);
  const users = await adminClient.get("/users");
  record(
    "Admin users dashboard API",
    users.status === 200,
    `${users.data?.users?.length ?? users.data?.results ?? "?"} users`,
  );

  const complaints = await adminClient.get("/complaints");
  record(
    "Admin reports API",
    complaints.status === 200,
    `${complaints.data?.complaints?.length ?? 0} report(s)`,
  );

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;

  console.log("\n----------------------------------------");
  console.log(`Results: ${passed}/${results.length} passed, ${failed} failed`);
  console.log("----------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error("Flow tests crashed:", error);
  process.exit(1);
});
