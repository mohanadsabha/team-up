import { Router } from "express";
import { notificationSettingsController } from "./notification-settings.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(protect);

// Get user's notification settings
router.get("/", notificationSettingsController.getNotificationSettings);

// Update user's notification settings
router.patch("/", notificationSettingsController.updateNotificationSettings);

// Reset notification settings to defaults
router.post("/reset", notificationSettingsController.resetNotificationSettings);

export default router;
