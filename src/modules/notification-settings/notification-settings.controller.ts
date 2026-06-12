import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  UpdateNotificationSettingsRequest,
  updateNotificationSettingsSchema,
  NotificationSettingsListResponse,
  NotificationSettingsMessageResponse,
  StringObject,
} from "./notification-settings.interface";
import { prisma } from "../../config/prisma";

class NotificationSettingsController {
  public getNotificationSettings = async (
    req: Request,
    res: Response<NotificationSettingsListResponse>,
    _next: NextFunction,
  ) => {
    const userId = req.user.userId;

    let settings = await prisma.notificationUserSetting.findUnique({
      where: { userId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.notificationUserSetting.create({
        data: { userId },
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification settings fetched successfully.",
      settings: {
        id: settings.id,
        userId: settings.userId,
        joinRequestStatus: settings.joinRequestStatus,
        milestoneStatus: settings.milestoneStatus,
        mentorInvitationStatus: settings.mentorInvitationStatus,
        meetingReminders: settings.meetingReminders,
        projectApprovedRejected: settings.projectApprovedRejected,
        taskDeadlineReminders: settings.taskDeadlineReminders,
        taskStatus: settings.taskStatus,
        teamStatusChanges: settings.teamStatusChanges,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      },
    });
  };

  public updateNotificationSettings = async (
    req: Request,
    res: Response<NotificationSettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    const userId = req.user.userId;
    const validatedData = zodValidation(
      updateNotificationSettingsSchema,
      req.body as UpdateNotificationSettingsRequest,
    );

    // Check if settings exist, if not create default
    let settings = await prisma.notificationUserSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.notificationUserSetting.create({
        data: { userId },
      });
    }

    // Update settings with provided data
    const updatedSettings = await prisma.notificationUserSetting.update({
      where: { userId },
      data: {
        ...(validatedData.joinRequestStatus !== undefined && {
          joinRequestStatus: validatedData.joinRequestStatus,
        }),
        ...(validatedData.milestoneStatus !== undefined && {
          milestoneStatus: validatedData.milestoneStatus,
        }),
        ...(validatedData.mentorInvitationStatus !== undefined && {
          mentorInvitationStatus: validatedData.mentorInvitationStatus,
        }),
        ...(validatedData.meetingReminders !== undefined && {
          meetingReminders: validatedData.meetingReminders,
        }),
        ...(validatedData.projectApprovedRejected !== undefined && {
          projectApprovedRejected: validatedData.projectApprovedRejected,
        }),
        ...(validatedData.taskDeadlineReminders !== undefined && {
          taskDeadlineReminders: validatedData.taskDeadlineReminders,
        }),
        ...(validatedData.taskStatus !== undefined && {
          taskStatus: validatedData.taskStatus,
        }),
        ...(validatedData.teamStatusChanges !== undefined && {
          teamStatusChanges: validatedData.teamStatusChanges,
        }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Notification settings updated successfully.",
      settings: {
        id: updatedSettings.id,
        userId: updatedSettings.userId,
        joinRequestStatus: updatedSettings.joinRequestStatus,
        milestoneStatus: updatedSettings.milestoneStatus,
        mentorInvitationStatus: updatedSettings.mentorInvitationStatus,
        meetingReminders: updatedSettings.meetingReminders,
        projectApprovedRejected: updatedSettings.projectApprovedRejected,
        taskDeadlineReminders: updatedSettings.taskDeadlineReminders,
        taskStatus: updatedSettings.taskStatus,
        teamStatusChanges: updatedSettings.teamStatusChanges,
        createdAt: updatedSettings.createdAt.toISOString(),
        updatedAt: updatedSettings.updatedAt.toISOString(),
      },
    });
  };

  public resetNotificationSettings = async (
    req: Request,
    res: Response<NotificationSettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    const userId = req.user.userId;

    const resetSettings = await prisma.notificationUserSetting.upsert({
      where: { userId },
      update: {
        joinRequestStatus: true,
        milestoneStatus: true,
        mentorInvitationStatus: true,
        meetingReminders: true,
        projectApprovedRejected: true,
        taskDeadlineReminders: true,
        taskStatus: true,
        teamStatusChanges: true,
      },
      create: {
        userId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Notification settings reset to defaults.",
      settings: {
        id: resetSettings.id,
        userId: resetSettings.userId,
        joinRequestStatus: resetSettings.joinRequestStatus,
        milestoneStatus: resetSettings.milestoneStatus,
        mentorInvitationStatus: resetSettings.mentorInvitationStatus,
        meetingReminders: resetSettings.meetingReminders,
        projectApprovedRejected: resetSettings.projectApprovedRejected,
        taskDeadlineReminders: resetSettings.taskDeadlineReminders,
        taskStatus: resetSettings.taskStatus,
        teamStatusChanges: resetSettings.teamStatusChanges,
        createdAt: resetSettings.createdAt.toISOString(),
        updatedAt: resetSettings.updatedAt.toISOString(),
      },
    });
  };
}

export const notificationSettingsController =
  new NotificationSettingsController();
