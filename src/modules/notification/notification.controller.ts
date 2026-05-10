import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  CreateNotification,
  createNotificationSchema,
  GetNotificationsQuery,
  getNotificationsQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  NotificationResponse,
  NotificationsListResponse,
  NotificationStatsResponse,
  StringObject,
} from "./notification.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class NotificationController {
  public getMyNotifications = async (
    req: Request<
      StringObject,
      StringObject,
      StringObject,
      GetNotificationsQuery
    >,
    res: Response<NotificationsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getNotificationsQuerySchema, req.query);

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.userId,
        ...(query.type ? { type: query.type } : {}),
        ...(typeof query.isRead === "boolean" ? { isRead: query.isRead } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully.",
      results: notifications.length,
      notifications,
    });
  };

  public getNotificationStats = async (
    req: Request,
    res: Response<NotificationStatsResponse>,
    _next: NextFunction,
  ) => {
    const [total, unread] = await Promise.all([
      prisma.notification.count({
        where: { userId: req.user.userId },
      }),
      prisma.notification.count({
        where: { userId: req.user.userId, isRead: false },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Notification stats fetched successfully.",
      total,
      unread,
    });
  };

  public markAsRead = async (
    req: Request<IdParam>,
    res: Response<MessageResponse & { notification: NotificationResponse }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      throw new AppError("Notification not found.", 404);
    }

    if (notification.userId !== req.user.userId) {
      throw new AppError(
        "You do not have permission to access this notification.",
        403,
      );
    }

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: updated,
    });
  };

  public markAllAsRead = async (
    req: Request,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  };

  public deleteNotification = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      throw new AppError("Notification not found.", 404);
    }

    if (notification.userId !== req.user.userId) {
      throw new AppError(
        "You do not have permission to delete this notification.",
        403,
      );
    }

    await prisma.notification.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  };

  public deleteAllNotifications = async (
    req: Request,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    await prisma.notification.deleteMany({
      where: { userId: req.user.userId },
    });

    res.status(200).json({
      success: true,
      message: "All notifications deleted successfully.",
    });
  };

  /**
   * INTERNAL METHOD - For creating notifications programmatically
   * Should be called from other services, not exposed as HTTP endpoint
   */
  public async createNotification(payload: CreateNotification) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    return prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        relatedEntityId: payload.relatedEntityId,
        isRead: false,
      },
    });
  }
}

export const notificationController = new NotificationController();
