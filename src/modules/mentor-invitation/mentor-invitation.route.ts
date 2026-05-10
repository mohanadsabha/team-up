import { Router } from "express";
import { mentorInvitationController } from "./mentor-invitation.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PROTECTED ENDPOINTS - Authenticated users
 */
router.use(protect);

// Team Admin invites mentor
router.post("/:id/invite", mentorInvitationController.inviteMentor);

// Mentor views pending invitations
router.get("/pending", mentorInvitationController.getPendingInvitations);

// Mentor accepts/rejects invitation
router.post("/:id/accept", mentorInvitationController.acceptInvitation);
router.post("/:id/reject", mentorInvitationController.rejectInvitation);

export default router;
