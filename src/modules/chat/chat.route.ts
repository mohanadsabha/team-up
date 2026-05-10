import { Router } from "express";
import { chatController } from "./chat.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * All chat endpoints require authentication
 */
router.use(protect);

// Chat management
router.post("/", chatController.createChat);
router.get("/team/:id", chatController.getTeamChats);
router.get("/:id", chatController.getChatById);

// Message operations
router.get("/:id/messages", chatController.getMessages);
router.post("/:id/messages", chatController.sendMessage);
router.patch("/:chatId/messages/:messageId", chatController.updateMessage);
router.delete("/:chatId/messages/:messageId", chatController.deleteMessage);

export default router;
