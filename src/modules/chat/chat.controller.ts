import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
import { NotificationType } from "../../generated/prisma/enums";
import {
  ChatDetailsResponse,
  ChatsListResponse,
  ChatMessageDetailsResponse,
  ChatMessagesListResponse,
  CreateChat,
  createChatSchema,
  GetChatMessagesQuery,
  getChatMessagesQuerySchema,
  IdParam,
  idParamSchema,
  MessageParam,
  messageParamSchema,
  MessageResponse,
  SendMessage,
  sendMessageSchema,
  StringObject,
  UpdateMessage,
  updateMessageSchema,
  UserPreviewResponse,
} from "./chat.interface";

class ChatController {
  public createChat = async (
    req: Request<StringObject, StringObject, CreateChat>,
    res: Response<ChatDetailsResponse>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createChatSchema, req.body);

    // Handle creation based on chat type
    if (payload.type === "TEAM") {
      if (!payload.teamId) {
        throw new AppError("teamId is required for TEAM chats.", 400);
      }

      // Verify user is team member
      const isMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: payload.teamId, userId: req.user.userId },
        },
      });

      if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
        throw new AppError("You are not a member of this team.", 403);
      }

      // Ensure only one TEAM chat per team — return existing if present
      const existing = await prisma.chat.findFirst({
        where: { teamId: payload.teamId, type: "TEAM" },
        include: { messages: { select: { id: true } } },
      });

      if (existing) {
        const lastMessage = await prisma.message.findFirst({
          where: { chatId: existing.id },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
          success: true,
          message: "Chat already exists.",
          chat: {
            id: existing.id,
            teamId: existing.teamId,
            type: existing.type,
            joinRequestId: (existing as any).joinRequestId || null,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
            messagesCount: existing.messages.length,
            lastMessage: lastMessage || null,
          },
        });
      }

      const chat = await prisma.chat.create({
        data: { teamId: payload.teamId, type: payload.type },
      });

      return res.status(201).json({
        success: true,
        message: "Chat created successfully.",
        chat: {
          id: chat.id,
          teamId: chat.teamId,
          type: chat.type,
          joinRequestId: null,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          messagesCount: 0,
          lastMessage: null,
        },
      });
    }

    if (payload.type === "JOIN_REQUEST") {
      if (!payload.joinRequestId) {
        throw new AppError(
          "joinRequestId is required for JOIN_REQUEST chats.",
          400,
        );
      }

      const jr = await prisma.joinRequest.findUnique({
        where: { id: payload.joinRequestId },
      });
      if (!jr) throw new AppError("Join request not found.", 404);

      // Allow the applicant, any team member, or system admin to create/access the chat
      const isMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: jr.teamId, userId: req.user.userId },
        },
      });

      if (
        req.user.userId !== jr.userId &&
        !isMember &&
        req.user.role !== "SYSTEM_ADMIN"
      ) {
        throw new AppError(
          "You are not authorized to create or access this join-request chat.",
          403,
        );
      }

      // Ensure one chat per join request
      const existing = await prisma.chat.findUnique({
        where: { joinRequestId: payload.joinRequestId },
        include: { messages: { select: { id: true } } },
      });
      if (existing) {
        const lastMessage = await prisma.message.findFirst({
          where: { chatId: existing.id },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
          success: true,
          message: "Chat already exists.",
          chat: {
            id: existing.id,
            teamId: existing.teamId,
            type: existing.type,
            joinRequestId: (existing as any).joinRequestId || null,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
            messagesCount: existing.messages.length,
            lastMessage: lastMessage || null,
          },
        });
      }

      const chat = await prisma.chat.create({
        data: {
          teamId: jr.teamId,
          type: "JOIN_REQUEST",
          joinRequestId: payload.joinRequestId,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Join-request chat created successfully.",
        chat: {
          id: chat.id,
          teamId: chat.teamId,
          type: chat.type,
          joinRequestId: payload.joinRequestId,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          messagesCount: 0,
          lastMessage: null,
        },
      });
    }

    throw new AppError("Unsupported chat type.", 400);
  };

  public getTeamChats = async (
    req: Request<IdParam>,
    res: Response<ChatsListResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const isMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: params.id, userId: req.user.userId } },
    });

    const applicantChat = await prisma.chat.findFirst({
      where: {
        teamId: params.id,
        type: "JOIN_REQUEST",
        joinRequest: {
          userId: req.user.userId,
        },
      },
      include: {
        messages: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let chats = await prisma.chat.findMany({
      where: { teamId: params.id },
      include: {
        messages: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (isMember || req.user.role === "SYSTEM_ADMIN") {
      // team members can see all chats for the team
    } else if (applicantChat) {
      chats = [applicantChat];
    } else {
      throw new AppError(
        "You are not a member of this team or an applicant for this team.",
        403,
      );
    }

    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await prisma.message.findFirst({
          where: { chatId: chat.id },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: chat.id,
          teamId: chat.teamId,
          type: chat.type,
          joinRequestId: (chat as any).joinRequestId || null,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          messagesCount: chat.messages.length,
          lastMessage: lastMessage ? { ...lastMessage } : null,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Team chats fetched successfully.",
      results: enrichedChats.length,
      chats: enrichedChats,
    });
  };

  public getChatById = async (
    req: Request<IdParam>,
    res: Response<ChatDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
      include: {
        messages: { select: { id: true } },
        joinRequest: { select: { userId: true } },
      },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member OR the join-request applicant
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    const isApplicant = chat.joinRequest
      ? chat.joinRequest.userId === req.user.userId
      : false;

    if (!isMember && !isApplicant && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError(
        "You are not a member of this team or a participant in this chat.",
        403,
      );
    }

    const lastMessage = await prisma.message.findFirst({
      where: { chatId: params.id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Chat fetched successfully.",
      chat: {
        id: chat.id,
        teamId: chat.teamId,
        type: chat.type,
        joinRequestId: (chat as any).joinRequestId || null,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messagesCount: chat.messages.length,
        lastMessage: lastMessage || null,
      },
    });
  };

  public getMessages = async (
    req: Request<IdParam, StringObject, StringObject, GetChatMessagesQuery>,
    res: Response<ChatMessagesListResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const query = zodValidation(getChatMessagesQuerySchema, req.query);

    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
      include: {
        joinRequest: { select: { userId: true } },
        team: { select: { id: true } },
      },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member or join-request applicant
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    const isApplicant = chat.joinRequest
      ? chat.joinRequest.userId === req.user.userId
      : false;

    if (!isMember && !isApplicant && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError(
        "You are not a member of this team or participant in this chat.",
        403,
      );
    }

    const messages = await prisma.message.findMany({
      where: { chatId: params.id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    });

    res.status(200).json({
      success: true,
      message: "Chat messages fetched successfully.",
      results: messages.length,
      messages: messages.reverse(),
    });
  };

  public sendMessage = async (
    req: Request<IdParam, StringObject, SendMessage>,
    res: Response<ChatMessageDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(sendMessageSchema, req.body);

    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
      include: { joinRequest: { select: { userId: true } } },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member or join-request applicant
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    const isApplicant = chat.joinRequest
      ? chat.joinRequest.userId === req.user.userId
      : false;

    if (!isMember && !isApplicant && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError(
        "You are not a member of this team or participant in this chat.",
        403,
      );
    }

    const message = await prisma.message.create({
      data: {
        chatId: params.id,
        senderId: req.user.userId,
        content: payload.content,
      },
      include: {
        sender: {
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

    // Notify chat members (team members + join-request applicant) except the sender
    try {
      const members = await prisma.teamMember.findMany({
        where: { teamId: chat.teamId },
        select: { userId: true },
      });
      const recipients = new Set<string>(members.map((m) => m.userId));
      if (chat.joinRequest && chat.joinRequest.userId)
        recipients.add(chat.joinRequest.userId);
      recipients.delete(req.user.userId);

      const notifications = Array.from(recipients).map((userId) => ({
        userId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: "New message",
        content: payload.content.slice(0, 240),
        relatedEntityId: message.id,
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications,
          skipDuplicates: true,
        });
      }
    } catch (err) {
      // don't block message sending if notification creation fails
      // log if a logging facility exists
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: message,
    });
  };

  public updateMessage = async (
    req: Request<MessageParam, StringObject, UpdateMessage>,
    res: Response<ChatMessageDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(messageParamSchema, req.params);
    const payload = zodValidation(updateMessageSchema, req.body);

    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      include: {
        chat: { select: { teamId: true } },
      },
    });

    if (!message) {
      throw new AppError("Message not found.", 404);
    }

    if (
      message.senderId !== req.user.userId &&
      req.user.role !== "SYSTEM_ADMIN"
    ) {
      throw new AppError("You can only edit your own messages.", 403);
    }

    const updated = await prisma.message.update({
      where: { id: params.messageId },
      data: {
        content: payload.content,
        isEdited: true,
      },
      include: {
        sender: {
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
      message: "Message updated successfully.",
      data: updated,
    });
  };

  public deleteMessage = async (
    req: Request<MessageParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(messageParamSchema, req.params);

    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
    });

    if (!message) {
      throw new AppError("Message not found.", 404);
    }

    if (
      message.senderId !== req.user.userId &&
      req.user.role !== "SYSTEM_ADMIN"
    ) {
      throw new AppError("You can only delete your own messages.", 403);
    }

    await prisma.message.delete({
      where: { id: params.messageId },
    });

    res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
    });
  };
}

export const chatController = new ChatController();
