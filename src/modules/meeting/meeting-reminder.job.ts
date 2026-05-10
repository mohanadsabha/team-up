import { prisma } from "../../config/prisma";
import { notificationController } from "../notification/notification.controller";

type ReminderWindow = {
  label: string;
  offsetMs: number;
};

const reminderWindows: ReminderWindow[] = [
  { label: "24h", offsetMs: 24 * 60 * 60 * 1000 },
  { label: "1h", offsetMs: 60 * 60 * 1000 },
  { label: "10m", offsetMs: 10 * 60 * 1000 },
];

let reminderInterval: NodeJS.Timeout | null = null;

export type MeetingReminderRuntime = {
  runApi: boolean;
  stop: () => void;
};

function isWorkerEnabled() {
  const mode = process.env.SERVER_MODE ?? "api";
  return mode === "worker" || mode === "all";
}

function isApiEnabled() {
  const mode = process.env.SERVER_MODE ?? "api";
  return mode === "api" || mode === "all";
}

function getReminderIntervalMs() {
  return Number(process.env.MEETING_REMINDER_INTERVAL_MS ?? 60 * 1000);
}

export async function processMeetingReminders(now = new Date()) {
  let sent = 0;

  for (const window of reminderWindows) {
    const dueMeetings = await prisma.meeting.findMany({
      where: {
        status: "SCHEDULED",
        startAt: {
          gte: new Date(now.getTime() + window.offsetMs - 60 * 1000),
          lte: new Date(now.getTime() + window.offsetMs + 60 * 1000),
        },
      },
      include: {
        team: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    });

    for (const meeting of dueMeetings) {
      const reminderTitle = `Meeting Reminder (${window.label}): ${meeting.title}`;
      const recipientIds = [
        ...meeting.team.members.map((member) => member.userId),
        meeting.team.mentorId,
      ].filter((recipientId): recipientId is string => Boolean(recipientId));

      for (const recipientId of recipientIds) {
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: recipientId,
            type: "MEETING_REMINDER",
            relatedEntityId: meeting.id,
            title: reminderTitle,
          },
        });

        if (existingReminder) {
          continue;
        }

        await notificationController.createNotification({
          userId: recipientId,
          type: "MEETING_REMINDER",
          title: reminderTitle,
          content: `Your meeting starts at ${meeting.startAt.toISOString()} (${window.label} reminder).`,
          relatedEntityId: meeting.id,
        });
      }

      sent += 1;
    }
  }

  return sent;
}

export function startMeetingReminderScheduler(intervalMs = 60 * 1000) {
  if (reminderInterval) {
    return reminderInterval;
  }

  reminderInterval = setInterval(async () => {
    try {
      await processMeetingReminders();
    } catch (error) {
      console.error("Meeting reminder job failed:", error);
    }
  }, intervalMs);

  return reminderInterval;
}

export function bootstrapMeetingReminders(): MeetingReminderRuntime {
  if (!isWorkerEnabled()) {
    return {
      runApi: isApiEnabled(),
      stop: () => undefined,
    };
  }

  const intervalMs = getReminderIntervalMs();
  startMeetingReminderScheduler(intervalMs);
  console.log(`Meeting reminders enabled every ${intervalMs}ms.`);

  return {
    runApi: isApiEnabled(),
    stop: stopMeetingReminderScheduler,
  };
}

export function stopMeetingReminderScheduler() {
  if (!reminderInterval) {
    return;
  }

  clearInterval(reminderInterval);
  reminderInterval = null;
}
