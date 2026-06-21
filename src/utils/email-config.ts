const REQUIRED_EMAIL_KEYS = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USERNAME",
  "EMAIL_PASSWORD",
  "EMAIL",
] as const;

export const getEmailConfigurationStatus = () => {
  const missing = REQUIRED_EMAIL_KEYS.filter((key) => !process.env[key]?.trim());

  return {
    configured: missing.length === 0,
    missing,
    host: process.env.EMAIL_HOST ?? null,
    port: process.env.EMAIL_PORT ?? null,
    from: process.env.EMAIL ?? null,
  };
};

export const logEmailConfigurationStatus = () => {
  const status = getEmailConfigurationStatus();

  if (!status.configured) {
    console.error(
      `[email] Missing configuration on startup: ${status.missing.join(", ")}. Verification emails will fail.`,
    );
    return;
  }

  console.log(
    `[email] SMTP configured (${status.host}:${status.port ?? "587"}) from=${status.from}`,
  );
};
