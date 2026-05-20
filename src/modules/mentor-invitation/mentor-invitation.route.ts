import { Router } from "express";
import { mentorInvitationController } from "./mentor-invitation.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PROTECTED ENDPOINTS - Authenticated users
 */
router.use(protect);

// Team Admin invites mentor
router.post("/:teamId/invite", mentorInvitationController.inviteMentor);

// Mentor views pending invitations
router.get("/pending", mentorInvitationController.getPendingInvitations);

// Mentor accepts/rejects invitation
router.post("/:teamId/accept", mentorInvitationController.acceptInvitation);
router.post("/:teamId/reject", mentorInvitationController.rejectInvitation);

export default router;
