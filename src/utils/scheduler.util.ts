import cron from "node-cron";
import { authController } from "../modules/auth/auth.controller";

/**
 * Initialize scheduled tasks for the application
 * Currently runs:
 * - Hard delete of accounts older than 90 days (daily at 2 AM)
 */
export const initializeScheduler = () => {
  // Run hard delete job daily at 2 AM
  const hardDeleteJob = cron.schedule("0 2 * * *", async () => {
    console.log("[Scheduler] Running hard delete job for old accounts...");
    try {
      await authController.hardDeleteOldAccounts();
    } catch (error) {
      console.error("[Scheduler] Error in hard delete job:", error);
    }
  });

  console.log("[Scheduler] Initialized scheduled jobs");

  return {
    hardDeleteJob,
  };
};

/**
 * Manually trigger hard delete (useful for admin or testing)
 */
export const triggerHardDelete = async () => {
  console.log("[Manual Trigger] Running hard delete...");
  await authController.hardDeleteOldAccounts();
};
