import "./config/dotenv";

process.on("uncaughtException", (err) => {
  console.log("UNCAUGT EXCEPTION! Shutting down...", err);
  process.exit(1);
});

import app from "./app";
import { bootstrapMeetingReminders } from "./modules/meeting/meeting-reminder.job";

const PORT = process.env.PORT || 3000;
const meetingRuntime = bootstrapMeetingReminders();

const server = meetingRuntime.runApi
  ? app.listen(PORT, () => {
      console.log(`App running on port ${PORT}...`);
    })
  : null;

function shutdown(exitCode: number) {
  meetingRuntime.stop();

  if (!server) {
    process.exit(exitCode);
    return;
  }

  server.close(() => {
    process.exit(exitCode);
  });
}

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err);
  shutdown(1);
});

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
  shutdown(0);
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT RECEIVED. Shutting down gracefully");
  shutdown(0);
});
