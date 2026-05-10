import { Router } from "express";
import { complaintController } from "./complaint.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PROTECTED ENDPOINTS - Authenticated users can submit complaints
 */
router.use(protect);

// User complaint submission
router.post("/", complaintController.createComplaint);

/**
 * ADMIN ENDPOINTS - Only admins can view and manage complaints
 */
router.use(restrictTo("SYSTEM_ADMIN"));

router.get("/", complaintController.getComplaints);
router.get("/:id", complaintController.getComplaintById);
router.patch("/:id/status", complaintController.updateComplaintStatus);
router.get("/stats/overview", complaintController.getComplaintStats);

export default router;
