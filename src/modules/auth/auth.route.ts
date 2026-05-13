import { Router } from "express";
import { authController } from "./auth.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

// Public endpoints - no authentication required
router.post("/dev/system-admin", authController.createDevSystemAdmin);
router.post("/signup", authController.signUp);
router.post("/login", authController.login);
router.get("/linkedin/callback", authController.linkedinCallback);
router.get("/linkedin", authController.linkedin);
router.get("/google/callback", authController.googleCallback);
router.get("/google", authController.google);
router.post("/verify-email", authController.verifyEmail);
router.post("/refresh-token", authController.refreshToken);
router.post("/validate-token", authController.validateToken);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Protected endpoints - authentication required
router.use(protect);
router.post("/change-password", authController.changePassword);
router.post("/revoke-tokens", authController.revokeTokens);
router.delete("/delete-account", authController.deleteMyAccount);

// Admin endpoints - SYSTEM_ADMIN only
router.use(restrictTo("SYSTEM_ADMIN"));
router.patch("/users/:id/activate", authController.activateUser);

export default router;
