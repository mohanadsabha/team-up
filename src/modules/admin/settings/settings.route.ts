import { Router } from "express";
import SettingsController from "./settings.controller";
import { protect, restrictTo } from "../../../middleware/auth.middleware";
import { upload } from "../../../config/multer";

const router = Router();
const settingsController = new SettingsController();

// All routes require authentication and SYSTEM_ADMIN role
router.use(protect);
router.use(restrictTo("SYSTEM_ADMIN"));

// Get system settings
router.get("/system", (req, res, next) =>
  settingsController.getSystemSettings(req, res, next),
);

// Update system settings
router.patch("/system", (req, res, next) =>
  settingsController.updateSystemSettings(req, res, next),
);

// Upload platform logo
router.post("/system/logo", upload.single("logo"), (req, res, next) =>
  settingsController.uploadLogo(req, res, next),
);

export default router;
