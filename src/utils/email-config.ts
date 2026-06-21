export const logEmailConfigurationStatus = () => {
  const required = [
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USERNAME",
    "EMAIL_PASSWORD",
    "EMAIL",
  ] as const;

  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    console.error(
      `[email] Missing configuration on startup: ${missing.join(", ")}. Verification emails will fail.`,
    );
    return;
  }

  console.log(
    `[email] SMTP configured (${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT ?? "587"})`,
  );
};
