import { Router } from "express";
import { notificationController } from "./notification.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * All notification endpoints require authentication
 */
router.use(protect);

// Get my notifications
router.get("/", notificationController.getMyNotifications);
router.get("/stats", notificationController.getNotificationStats);

// Mark as read operations
router.patch("/:id/read", notificationController.markAsRead);
router.post("/read-all", notificationController.markAllAsRead);

// Delete operations
router.delete("/:id", notificationController.deleteNotification);
router.delete("/", notificationController.deleteAllNotifications);

export default router;
