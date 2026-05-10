import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";
import { zodValidation } from "../../utils/zod.util";
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

    // Verify team exists and user is member
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: payload.teamId, userId: req.user.userId },
      },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("You are not a member of this team.", 403);
    }

    const chat = await prisma.chat.create({
      data: {
        teamId: payload.teamId,
        type: payload.type,
      },
    });

    res.status(201).json({
      success: true,
      message: "Chat created successfully.",
      chat: {
        id: chat.id,
        teamId: chat.teamId,
        type: chat.type,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messagesCount: 0,
        lastMessage: null,
      },
    });
  };

  public getTeamChats = async (
    req: Request<IdParam>,
    res: Response<ChatsListResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    // Verify user is team member
    const isMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: params.id, userId: req.user.userId } },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("You are not a member of this team.", 403);
    }

    const chats = await prisma.chat.findMany({
      where: { teamId: params.id },
      include: {
        messages: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

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
      },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("You are not a member of this team.", 403);
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
      select: { teamId: true },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("You are not a member of this team.", 403);
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
      select: { teamId: true },
    });

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Verify user is team member
    const isMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: chat.teamId, userId: req.user.userId },
      },
    });

    if (!isMember && req.user.role !== "SYSTEM_ADMIN") {
      throw new AppError("You are not a member of this team.", 403);
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
