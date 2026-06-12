import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../../utils/zod.util";
import {
  UpdateSystemSettingsRequest,
  UpdateApprovalSettingsRequest,
  updateSystemSettingsSchema,
  updateApprovalSettingsSchema,
  PlatformSettingsResponse,
  ApprovalSettingsResponse,
  SettingsMessageResponse,
  ApprovalSettingsMessageResponse,
  StringObject,
} from "./settings.interface";
import AppError from "../../../utils/appError";
import { prisma } from "../../../config/prisma";
import { uploadImageToCloudinary } from "../../../utils/multer.util";

class SettingsController {
  public getSystemSettings = async (
    req: Request,
    res: Response<SettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    let settings = await prisma.platformSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {},
      });
    }

    res.status(200).json({
      success: true,
      message: "System settings retrieved successfully.",
      data: this.formatSettings(settings),
    });
  };

  public updateSystemSettings = async (
    req: Request<StringObject, StringObject, UpdateSystemSettingsRequest>,
    res: Response<SettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    const validatedData = zodValidation(updateSystemSettingsSchema, req.body);

    let settings = await prisma.platformSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: validatedData,
      });
    } else {
      // Update existing settings
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: {
          ...(validatedData.platformName !== undefined && {
            platformName: validatedData.platformName,
          }),
          ...(validatedData.defaultLanguage !== undefined && {
            defaultLanguage: validatedData.defaultLanguage,
          }),
          ...(validatedData.timezone !== undefined && {
            timezone: validatedData.timezone,
          }),
          ...(validatedData.dateFormat !== undefined && {
            dateFormat: validatedData.dateFormat,
          }),
          ...(validatedData.isLive !== undefined && {
            isLive: validatedData.isLive,
          }),
          ...(validatedData.maintenanceMode !== undefined && {
            maintenanceMode: validatedData.maintenanceMode,
          }),
          ...(validatedData.maintenanceMessage !== undefined && {
            maintenanceMessage: validatedData.maintenanceMessage,
          }),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "System settings updated successfully.",
      data: this.formatSettings(settings),
    });
  };

  public uploadLogo = async (
    req: Request,
    res: Response<SettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    if (!req.file) {
      throw new AppError("No file provided", 400);
    }

    let settings = await prisma.platformSettings.findFirst();

    const logUrl = await uploadImageToCloudinary(req.file, "platform-logo");

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { logoUrl: logUrl },
      });
    } else {
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: { logoUrl: logUrl },
      });
    }

    res.status(200).json({
      success: true,
      message: "Logo uploaded successfully.",
      data: this.formatSettings(settings),
    });
  };

  public getApprovalSettings = async (
    req: Request,
    res: Response<ApprovalSettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    let settings = await prisma.platformSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {},
      });
    }

    res.status(200).json({
      success: true,
      message: "Approval settings retrieved successfully.",
      data: this.formatApprovalSettings(settings),
    });
  };

  public updateApprovalSettings = async (
    req: Request<StringObject, StringObject, UpdateApprovalSettingsRequest>,
    res: Response<ApprovalSettingsMessageResponse>,
    _next: NextFunction,
  ) => {
    const validatedData = zodValidation(updateApprovalSettingsSchema, req.body);

    let settings = await prisma.platformSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: validatedData,
      });
    } else {
      // Update existing settings
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: {
          ...(validatedData.requireUserApproval !== undefined && {
            requireUserApproval: validatedData.requireUserApproval,
          }),
          ...(validatedData.autoActivateUsers !== undefined && {
            autoActivateUsers: validatedData.autoActivateUsers,
          }),
          ...(validatedData.allowPaidIdeas !== undefined && {
            allowPaidIdeas: validatedData.allowPaidIdeas,
          }),
          ...(validatedData.requireIdeaApproval !== undefined && {
            requireIdeaApproval: validatedData.requireIdeaApproval,
          }),
          ...(validatedData.requireTeamApproval !== undefined && {
            requireTeamApproval: validatedData.requireTeamApproval,
          }),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Approval settings updated successfully.",
      data: this.formatApprovalSettings(settings),
    });
  };

  private formatSettings(settings: any): PlatformSettingsResponse {
    return {
      id: settings.id,
      platformName: settings.platformName,
      defaultLanguage: settings.defaultLanguage,
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      logoUrl: settings.logoUrl,
      isLive: settings.isLive,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private formatApprovalSettings(settings: any): ApprovalSettingsResponse {
    return {
      id: settings.id,
      requireUserApproval: settings.requireUserApproval,
      autoActivateUsers: settings.autoActivateUsers,
      allowPaidIdeas: settings.allowPaidIdeas,
      requireIdeaApproval: settings.requireIdeaApproval,
      requireTeamApproval: settings.requireTeamApproval,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}

export default SettingsController;
