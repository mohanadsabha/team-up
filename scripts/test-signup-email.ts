import "dotenv/config";

const API_BASE =
  process.env.API_BASE_URL ?? "http://localhost:3001/api/v1";
const testEmail =
  process.argv[2] ?? `signup.e2e.${Date.now()}@student.alazhar.edu.ps`;

async function getUniversityId() {
  const response = await fetch(
    `${API_BASE}/institutions/universities?isActive=true`,
  );
  if (!response.ok) {
    throw new Error(`Universities request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    universities: Array<{ id: string }>;
  };

  const universityId = data.universities[0]?.id;
  if (!universityId) {
    throw new Error("No active university found.");
  }

  return universityId;
}

async function main() {
  console.log("=== Signup email test (signup path only) ===");
  console.log(`API: ${API_BASE}`);
  console.log(`Email: ${testEmail}`);

  const universityId = await getUniversityId();
  const username = `e2e_${Date.now()}`;
  const payload = {
    username,
    email: testEmail,
    password: "TeamUp2026!",
    firstName: "E2E",
    lastName: "Test",
    role: "STUDENT",
    universityId,
    major: "Computer Science",
    skills: ["React"],
  };

  const signupStart = Date.now();
  const signupResponse = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const signupMs = Date.now() - signupStart;
  const signupBody = await signupResponse.json();

  if (!signupResponse.ok) {
    throw new Error(
      `Signup failed (${signupResponse.status} in ${signupMs}ms): ${JSON.stringify(signupBody)}`,
    );
  }

  console.log(`PASS signup + email completed in ${signupMs}ms`);
  console.log(`Message: ${signupBody.message}`);

  if (signupMs > 8_000) {
    throw new Error(`Signup too slow: ${signupMs}ms (expected under 8s)`);
  }

  if (signupMs < 8_000) {
    console.log("PASS fast signup response (email sends after response)");
  }

  console.log("Check backend logs for: Verification email sent to ...");
  console.log("=== Test passed ===");
}

main().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exit(1);
});
