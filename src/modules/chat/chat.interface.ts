import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const messageParamSchema = z.object({
  chatId: z.string().trim().uuid(),
  messageId: z.string().trim().uuid(),
}) satisfies ZodType;

export type MessageParam = z.infer<typeof messageParamSchema>;

export const createChatSchema = z.object({
  teamId: z.string().trim().uuid(),
  type: z.enum(["TEAM", "DIRECT"]).default("TEAM"),
}) satisfies ZodType;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
}) satisfies ZodType;

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
}) satisfies ZodType;

export const getChatMessagesQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
}) satisfies ZodType;

export type CreateChat = z.infer<typeof createChatSchema>;
export type SendMessage = z.infer<typeof sendMessageSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type GetChatMessagesQuery = z.infer<typeof getChatMessagesQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type UserPreviewResponse = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
};

export type ChatMessageResponse = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatMessageDetailsResponse = MessageResponse & {
  data: ChatMessageResponse & {
    sender: UserPreviewResponse;
  };
};

export type ChatMessagesListResponse = MessageResponse & {
  results: number;
  messages: (ChatMessageResponse & {
    sender: UserPreviewResponse;
  })[];
};

export type ChatResponse = {
  id: string;
  teamId: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatDetailsResponse = MessageResponse & {
  chat: ChatResponse & {
    messagesCount: number;
    lastMessage:
      | (ChatMessageResponse & {
          sender: UserPreviewResponse;
        })
      | null;
  };
};

export type ChatsListResponse = MessageResponse & {
  results: number;
  chats: (ChatResponse & {
    messagesCount: number;
    lastMessage:
      | (ChatMessageResponse & {
          sender: UserPreviewResponse;
        })
      | null;
  })[];
};
