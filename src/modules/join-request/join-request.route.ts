import { Router } from "express";
import { joinRequestController } from "./join-request.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

// create and withdraw require auth
router.use(protect);

router.post("/", joinRequestController.createRequest);
router.get("/", joinRequestController.getRequests);
router.post("/:id/respond", joinRequestController.respondRequest);
router.post("/:id/withdraw", joinRequestController.withdrawRequest);

export default router;
