import { Router } from "express";
import { userController } from "./user.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { upload } from "../../config/multer";

const router = Router();

router.use(protect);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.get("/me/completion-score", userController.getProfileCompletion);
router.patch(
  "/me/profile-picture",
  upload.single("profilePicture"),
  userController.uploadProfilePicture,
);

router.get("/:id/activity", userController.getUserActivity);
router.get("/:id", userController.getUserById);

router.use(restrictTo("SYSTEM_ADMIN"));
router.get("/", userController.getUsers);
router.patch("/:id/status", userController.updateUserStatus);

export default router;
