import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateTask,
  createTaskSchema,
  GetTasksQuery,
  getTasksQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  StringObject,
  TaskDetailsResponse,
  TaskResponse,
  TasksListResponse,
  UpdateTask,
  updateTaskSchema,
  UserPreviewResponse,
} from "./task.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class TaskController {
  private assertTeamMember = async (
    teamId: string,
    userId: string,
    role: string,
  ) => {
    if (role === "SYSTEM_ADMIN") {
      return;
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true, status: true },
    });

    if (!membership || membership.status !== "APPROVED") {
      throw new AppError("You are not a member of this team.", 403);
    }
  };

  private assertTeamAdmin = async (
    teamId: string,
    userId: string,
    role: string,
  ) => {
    if (role === "SYSTEM_ADMIN") {
      return;
    }

    const adminMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true, status: true },
    });

    if (
      !adminMembership ||
      adminMembership.status !== "APPROVED" ||
      adminMembership.role !== "TEAM_ADMIN"
    ) {
      throw new AppError("Only team admins can perform this action.", 403);
    }
  };

  public getTasks = async (
    req: Request<StringObject, StringObject, StringObject, GetTasksQuery>,
    res: Response<TasksListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getTasksQuerySchema, req.query);

    const tasks = await prisma.task.findMany({
      where: {
        ...(req.user.role !== "SYSTEM_ADMIN" && !query.teamId
          ? {
              team: {
                members: {
                  some: {
                    userId: req.user.userId,
                    status: "APPROVED",
                  },
                },
              },
            }
          : {}),
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      include: {
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });

    if (query.teamId && req.user.role !== "SYSTEM_ADMIN") {
      await this.assertTeamMember(query.teamId, req.user.userId, req.user.role);
    }

    res.status(200).json({
      success: true,
      message: "Tasks fetched successfully.",
      results: tasks.length,
      tasks,
    });
  };

  public getTaskById = async (
    req: Request<IdParam>,
    res: Response<TaskDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!task) {
      throw new AppError("Task not found.", 404);
    }

    await this.assertTeamMember(task.teamId, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Task fetched successfully.",
      task,
    });
  };

  public createTask = async (
    req: Request<StringObject, StringObject, CreateTask>,
    res: Response<MessageResponse & { task: TaskResponse }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createTaskSchema, req.body);

    const team = await prisma.team.findUnique({
      where: { id: payload.teamId },
      select: { id: true },
    });

    if (!team) {
      throw new AppError("Team not found.", 404);
    }

    await this.assertTeamAdmin(payload.teamId, req.user.userId, req.user.role);

    if (payload.assignedTo) {
      const user = await prisma.user.findUnique({
        where: { id: payload.assignedTo },
        select: { id: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        throw new AppError("Assigned user not found.", 404);
      }

      const teamMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: payload.teamId, userId: payload.assignedTo },
        },
      });

      if (!teamMember) {
        throw new AppError("Assigned user is not a member of this team.", 400);
      }
    }

    const task = await prisma.task.create({
      data: {
        teamId: payload.teamId,
        title: payload.title,
        description: payload.description,
        assignedTo: payload.assignedTo,
        dueDate: payload.dueDate,
        priority: payload.priority ?? 3,
        status: "TODO",
      },
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully.",
      task,
    });
  };

  public updateTask = async (
    req: Request<IdParam, StringObject, UpdateTask>,
    res: Response<
      MessageResponse & {
        task: TaskResponse & { assignee: UserPreviewResponse | null };
      }
    >,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateTaskSchema, req.body);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { teamId: true, assignedTo: true },
    });

    if (!task) {
      throw new AppError("Task not found.", 404);
    }

    await this.assertTeamMember(task.teamId, req.user.userId, req.user.role);

    const isAssignee = task.assignedTo === req.user.userId;
    const isSystemAdmin = req.user.role === "SYSTEM_ADMIN";
    if (!isSystemAdmin) {
      const adminMembership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: task.teamId, userId: req.user.userId },
        },
        select: { role: true, status: true },
      });
      const isTeamAdmin =
        !!adminMembership &&
        adminMembership.status === "APPROVED" &&
        adminMembership.role === "TEAM_ADMIN";

      if (!isTeamAdmin && !isAssignee) {
        throw new AppError(
          "You do not have permission to update this task.",
          403,
        );
      }

      if (!isTeamAdmin && isAssignee) {
        const assigneeOnlyAllowedKeys = ["status"];
        const payloadKeys = Object.keys(payload);
        const invalidKeys = payloadKeys.filter(
          (key) => !assigneeOnlyAllowedKeys.includes(key),
        );

        if (invalidKeys.length > 0) {
          throw new AppError("Assignees can only update task status.", 403);
        }
      }
    }

    if (payload.assignedTo !== undefined && payload.assignedTo) {
      const user = await prisma.user.findUnique({
        where: { id: payload.assignedTo },
        select: { id: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        throw new AppError("Assigned user not found.", 404);
      }

      const teamMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: task.teamId, userId: payload.assignedTo },
        },
      });

      if (!teamMember) {
        throw new AppError("Assigned user is not a member of this team.", 400);
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.assignedTo !== undefined
          ? { assignedTo: payload.assignedTo }
          : {}),
        ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
        ...(payload.priority ? { priority: payload.priority } : {}),
      },
      include: {
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Task updated successfully.",
      task: updatedTask,
    });
  };

  public deleteTask = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      throw new AppError("Task not found.", 404);
    }

    await this.assertTeamAdmin(task.teamId, req.user.userId, req.user.role);

    await prisma.task.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
    });
  };
}

export const taskController = new TaskController();
