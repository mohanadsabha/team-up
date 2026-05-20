const fs = require('fs');
const path = require('path');

// 1) src/modules/task/task.controller.ts
const taskControllerPath = path.join(process.cwd(), 'src/modules/task/task.controller.ts');
let taskController = fs.readFileSync(taskControllerPath, 'utf8');

// Update updateTask select
taskController = taskController.replace(
  /const task = await prisma.task.findUnique\(\{[\s\S]*?where: \{ id: taskId \},[\s\S]*?select: \{ teamId: true, assignedTo: true \}[\s\S]*?\}\);/,
  (match) => match.replace('{ teamId: true, assignedTo: true }', '{ teamId: true, assignedTo: true, title: true }')
);

// Insert isReassigned logic
taskController = taskController.replace(
  /(if \(payload\.assignedTo !== undefined\) \{[\s\S]*?\n\s+\})/,
  $1\n\n    const isReassigned =\n      payload.assignedTo !== undefined && payload.assignedTo !== task.assignedTo;
);

// Insert update notification logic
taskController = taskController.replace(
  /(const updatedTask = await prisma\.task\.update\(\{[\s\S]*?\}\);)/,
  $1\n\n    if (updatedTask.assignedTo && isReassigned) {\n      await notificationController.createNotification({\n        userId: updatedTask.assignedTo,\n        type: 'TASK_ASSIGNED',\n        title: 'Task Assignment Updated',\n        content: \You were assigned task "\".\,\n        relatedEntityId: updatedTask.id,\n      });\n    }\n    if (updatedTask.assignedTo && !isReassigned && req.user.userId !== updatedTask.assignedTo) {\n      await notificationController.createNotification({\n        userId: updatedTask.assignedTo,\n        type: 'TASK_UPDATED',\n        title: 'Task Updated',\n        content: \Task "\" was updated.\,\n        relatedEntityId: updatedTask.id,\n      });\n    }
);

// Update deleteTask findUnique and notification
taskController = taskController.replace(
  /const task = await prisma\.task\.findUnique\(\{[\s\S]*?where: \{ id: taskId \},[\s\S]*?select: \{ teamId: true \},[\s\S]*?\}\);/,
  const task = await prisma.task.findUnique({\n      where: { id: taskId },\n      select: { teamId: true, assignedTo: true, title: true },\n    });
);

taskController = taskController.replace(
  /(await prisma\.task\.delete\(\{[\s\S]*?\}\);)/,
  $1\n\n    if (task.assignedTo) {\n      await notificationController.createNotification({\n        userId: task.assignedTo,\n        type: 'TASK_DELETED',\n        title: 'Task Deleted',\n        content: \Task "\" assigned to you was deleted.\,\n        relatedEntityId: task.id,\n      });\n    }
);

fs.writeFileSync(taskControllerPath, taskController);

// 2) src/server.ts
const serverPath = path.join(process.cwd(), 'src/server.ts');
let server = fs.readFileSync(serverPath, 'utf8');

// Insert import
server = server.replace(
  /(import \{ bootstrapMeetingReminders \} from '\.\/modules\/meeting\/meeting-reminder\.job';)/,
  $1\nimport { bootstrapTaskDueReminders } from './modules/task/task-due-reminder.job';
);

// Initialize taskDueRuntime
server = server.replace(
  /(const meetingRuntime = bootstrapMeetingReminders\(\);)/,
  $1\n  const taskDueRuntime = bootstrapTaskDueReminders();
);

// Update conditional start
server = server.replace(
  /if \(meetingRuntime\.runApi\) \{/,
  if (meetingRuntime.runApi && taskDueRuntime.runApi) {
);

// Update shutdown
server = server.replace(
  /meetingRuntime\.stop\(\);/,
  meetingRuntime.stop();\n    taskDueRuntime.stop();
);

fs.writeFileSync(serverPath, server);
