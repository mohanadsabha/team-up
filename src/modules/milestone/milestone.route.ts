import { Router } from "express";
import { milestoneController } from "./milestone.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PROTECTED ENDPOINTS - Authenticated users
 */
router.use(protect);

router.get("/", milestoneController.getMilestones);
router.get("/:id", milestoneController.getMilestoneById);
router.post("/", milestoneController.createMilestone);
router.patch("/:id", milestoneController.updateMilestone);
router.delete("/:id", milestoneController.deleteMilestone);
router.post("/:id/submit", milestoneController.submitMilestone);
router.post("/:id/review", milestoneController.reviewMilestone);

export default router;
