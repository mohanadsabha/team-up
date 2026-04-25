import { Router } from "express";
import { authController } from "./auth.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

// Required auth routes
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

router.use(protect);
router.post("/change-password", authController.changePassword);

// NOT Needed probably
router.use(restrictTo("SYSTEM_ADMIN"));
router.post("/revoke-tokens", authController.revokeTokens);

export default router;
