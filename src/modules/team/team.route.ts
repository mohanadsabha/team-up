import { Router } from "express";
import { teamController } from "./team.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PUBLIC ENDPOINTS - Read-only access to team information
 */
router.get("/", teamController.getTeams);
router.get("/:id", teamController.getTeamById);

/**
 * PROTECTED ENDPOINTS - Authenticated users can manage teams
 */
router.use(protect);

router.get("/:id/members", teamController.getTeamMembers);

// Team management
router.post("/", teamController.createTeam);
router.patch("/:id", teamController.updateTeam);
router.delete("/:id", teamController.deleteTeam);

// Team member management
router.post("/:id/members", teamController.addTeamMember);
router.patch("/:teamId/members/:memberId", teamController.updateTeamMember);
router.delete("/:teamId/members/:memberId", teamController.removeTeamMember);

export default router;
