import { prisma } from "../../config/prisma";
import { notificationController } from "../notification/notification.controller";

type ReminderWindow = {
  label: string;
  offsetMs: number;
};

const reminderWindows: ReminderWindow[] = [
  { label: "24h", offsetMs: 24 * 60 * 60 * 1000 },
  { label: "1h", offsetMs: 60 * 60 * 1000 },
];

let reminderInterval: NodeJS.Timeout | null = null;

export type TaskDueReminderRuntime = {
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
  return Number(process.env.TASK_DUE_REMINDER_INTERVAL_MS ?? 60 * 1000);
}

export async function processTaskDueReminders(now = new Date()) {
  let sent = 0;

  for (const window of reminderWindows) {
    const dueTasks = await prisma.task.findMany({
      where: {
        assignedTo: { not: null },
        dueDate: {
          gte: new Date(now.getTime() + window.offsetMs - 60 * 1000),
          lte: new Date(now.getTime() + window.offsetMs + 60 * 1000),
        },
        status: {
          notIn: ["DONE", "APPROVED"],
        },
      },
    });

    for (const task of dueTasks) {
      if (!task.assignedTo) {
        continue;
      }

      const reminderTitle = `Task Due Reminder (${window.label}): ${task.title}`;

      const existingReminder = await prisma.notification.findFirst({
        where: {
          userId: task.assignedTo,
          type: "TASK_DUE_SOON",
          relatedEntityId: task.id,
          title: reminderTitle,
        },
      });

      if (existingReminder) {
        continue;
      }

      await notificationController.createNotification({
        userId: task.assignedTo,
        type: "TASK_DUE_SOON",
        title: reminderTitle,
        content: `Task "${task.title}" is due at ${task.dueDate?.toISOString()}.`,
        relatedEntityId: task.id,
      });

      sent += 1;
    }
  }

  return sent;
}

export function startTaskDueReminderScheduler(intervalMs = 60 * 1000) {
  if (reminderInterval) {
    return reminderInterval;
  }

  reminderInterval = setInterval(async () => {
    try {
      await processTaskDueReminders();
    } catch (error) {
      console.error("Task due-date reminder job failed:", error);
    }
  }, intervalMs);

  return reminderInterval;
}

export function stopTaskDueReminderScheduler() {
  if (!reminderInterval) {
    return;
  }

  clearInterval(reminderInterval);
  reminderInterval = null;
}

export function bootstrapTaskDueReminders(): TaskDueReminderRuntime {
  if (!isWorkerEnabled()) {
    return {
      runApi: isApiEnabled(),
      stop: () => undefined,
    };
  }

  const intervalMs = getReminderIntervalMs();
  startTaskDueReminderScheduler(intervalMs);
  console.log(`Task due reminders enabled every ${intervalMs}ms.`);

  return {
    runApi: isApiEnabled(),
    stop: stopTaskDueReminderScheduler,
  };
}
