const API_BASE = "https://team-up-xisr.onrender.com/api/v1";
const testEmail = process.argv[2] ?? `render.test.${Date.now()}@student.alazhar.edu.ps`;

async function main() {
  console.log("=== Render signup test ===");
  console.log(`API: ${API_BASE}`);
  console.log(`Email: ${testEmail}`);

  const uniRes = await fetch(
    `${API_BASE}/institutions/universities?isActive=true`,
  );
  if (!uniRes.ok) {
    throw new Error(`Universities failed: ${uniRes.status}`);
  }
  const uniData = (await uniRes.json()) as {
    universities: Array<{ id: string }>;
  };
  const universityId = uniData.universities[0]?.id;
  if (!universityId) {
    throw new Error("No university found");
  }

  const payload = {
    username: `render_${Date.now()}`,
    email: testEmail,
    password: "TeamUp2026!",
    firstName: "Render",
    lastName: "Test",
    role: "STUDENT",
    universityId,
    major: "Computer Science",
    skills: ["React"],
  };

  const start = Date.now();
  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const ms = Date.now() - start;
  const body = await signupRes.json();

  console.log(`Status: ${signupRes.status} in ${ms}ms`);
  console.log(JSON.stringify(body, null, 2));

  if (!signupRes.ok) {
    process.exit(1);
  }

  if (ms > 15_000) {
    console.warn(`WARN: signup slow (${ms}ms) — may timeout in browser`);
  } else {
    console.log("PASS: signup responded quickly");
  }
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
